# Pesquisa técnica — Importação inteligente de documentos (PDF/NF-e/boleto/extrato) em Deno/Supabase Edge Functions

**Data:** 2026-08-13
**Autor:** Atlas (@analyst) — a pedido de Orion (@aiox-master), para uso do Compass (@architect) no ADR de importação de documentos do Gestly.
**Escopo:** Pesquisa técnica. NÃO é decisão de arquitetura, NÃO contém código de implementação.

> Convenção de leitura: toda afirmação técnica traz a fonte (URL) entre colchetes logo em seguida. Onde não encontrei evidência, escrevo **NAO**.

---

## 0. Contexto verificado no repositório (antes de pesquisar fora)

Conferi diretamente o código do gateway de IA para não pesquisar em cima de premissa errada:

- O runtime é mesmo Deno/Supabase Edge Functions: `supabase/functions/ai-gateway/index.ts` usa `import 'jsr:@supabase/functions-js/edge-runtime.d.ts'` e `Deno.serve(...)`.
- O provider é OpenAI **Responses API** (`https://api.openai.com/v1/responses`), confirmado em `supabase/functions/_shared/ai/providers/openai.ts`.
- O gateway hoje só aceita texto: `supabase/functions/_shared/ai/validation.ts` (`parseChatPayloadText`) exige um payload `{ messages: [{ role, content: string }] }`, com `content` obrigatoriamente `string` — não há campo de arquivo, imagem ou anexo. Limite de corpo: `MAX_BODY_BYTES = 25_000` bytes; `MAX_MESSAGE_LENGTH = 2_000`; `MAX_TOTAL_MESSAGE_LENGTH = 12_000` caracteres.
- **Achado adicional não mencionado no brief, relevante para o Compass dimensionar:** o body atual do gateway é limitado a 25 KB e o total de conteúdo das mensagens a 12.000 caracteres. Um XML de NF-e ou um PDF convertido para markdown facilmente ultrapassam isso — qualquer rota de importação de documentos vai precisar de um payload/endpoint diferente do chat atual, não do `parseChatPayloadText` existente.
- Não existe hoje nenhum arquivo `deno.json` ou `import_map.json` em `supabase/` (busquei e não encontrei) — os imports observados usam especificadores `jsr:` diretamente inline. Isso é relevante para a seção 1: qualquer lib nova precisará ser importada via `npm:` ou `jsr:` (ou `esm.sh` como fallback, mas ver risco na seção 1.1).

---

## 1. PDF → texto/markdown em Deno / Supabase Edge Functions

### 1.1 Tabela comparativa

| Lib | Nativa Deno? | Runtime edge (sem binário nativo/fs)? | Licença | Última versão observada | Peso | Veredito |
|---|---|---|---|---|---|---|
| **unpdf** | Não nativa, mas com build dedicado a edge (`npm:`/`esm.sh`) | Sim, na teoria — projetada para isso | MIT | 1.8.1 [npm](https://registry.npmjs.org/unpdf/latest) | Depende do build de pdf.js embutido (não obtive número exato de KB) | **Candidata principal, com ressalva de risco em produção (ver 1.2)** |
| **pdfjs-dist** (uso direto) | Não | Não sem adaptação — a build "legacy" empacota renderização em `<canvas>`, indisponível em Deno/Workers [WebSearch: pdfjs-dist Deno] | Apache-2.0 (Mozilla) | — | ~262-300 KB minificado / ~73 KB gzip por versão antiga (varia por versão) [Lightrun/GitHub sobre bundle size](https://github.com/agentcooper/react-pdf-highlighter/issues/112) | **NÃO usar direto** — é a base que `unpdf` empacota e adapta para edge; usar `unpdf` em vez de `pdfjs-dist` cru |
| **mupdf.js / mupdf (Artifex)** | Roda em Deno via WASM, sem dependências nativas — "no native dependencies" [GitHub ArtifexSoftware/mupdf.js](https://github.com/ArtifexSoftware/mupdf.js/) | Sim, tecnicamente (WASM puro) | **AGPL-3.0-or-later** [registry.npmjs.org/mupdf](https://registry.npmjs.org/mupdf/latest) — dual license: grátis só para software AGPL-compliant; **uso comercial/SaaS fechado exige licença paga da Artifex** [GitHub ArtifexSoftware/mupdf.js](https://github.com/ArtifexSoftware/mupdf.js/) | 1.28.0 | NAO (não encontrei número de KB) | **NÃO usar sem contratar licença comercial** — tecnicamente funciona, mas o SobControle é SaaS fechado; distribuir/rodar como serviço de rede sob AGPL obriga a abrir o código-fonte, o que descarta uso gratuito |
| **pdf-parse** | Não | **Não** — a v2.4.5 depende de `pdfjs-dist@5.4.296` **e `@napi-rs/canvas@0.1.80`** [registry.npmjs.org/pdf-parse](https://registry.npmjs.org/pdf-parse/latest); `@napi-rs/canvas` é um addon nativo (N-API/Rust), que não roda em Deno Edge Runtime | Apache-2.0 | 2.4.5 | NAO | **NÃO serve** — dependência nativa obrigatória incompatível com edge |
| **pdf2md (opengovsg)** | Não confirmado | Ferramenta Node.js (CLI/lib) [GitHub opengovsg/pdf2md via busca] | NAO confirmado | NAO | NAO | **NAO investigado a fundo** — indícios de ser voltado a Node.js, não Deno; não priorizado dado que unpdf/mupdf já cobrem a extração |
| **marker** | Não — é Python (usa modelos de layout/ML) | Não roda em Deno de forma alguma; é um pacote Python com dependências pesadas de ML | NAO | NAO | Pesado (modelos ML) | **NÃO serve para edge Deno** — arquitetura incompatível (Python, ML local) |
| **docling (IBM)** | Não — também é Python | Não roda em Deno | NAO | NAO | Pesado | **NÃO serve para edge Deno** — mesmo motivo do marker |
| **markitdown (Microsoft)** | Não — Python ≥3.10 [Real Python sobre markitdown](https://realpython.com/python-markitdown/) | Não roda em Deno | NAO | NAO | NAO | **NÃO serve para edge Deno** |

### 1.2 Risco concreto documentado: `unpdf` falhando em produção no Supabase Edge Functions

Existe um relato aberto na própria issue tracker do `unpdf` de alguém que conseguiu rodar localmente (Docker) mas recebeu o erro `"PDF.js is not available. Please add the package as a dependency"` **especificamente em produção no Supabase Edge Functions**, mesmo após tentar `configureUnPDF()` e `getResolvedPDFJS()`. A issue foi fechada **sem solução documentada** [GitHub unjs/unpdf#3](https://github.com/unjs/unpdf/issues/3).

Um exemplo de configuração encontrado para contornar isso usa import via CDN `esm.sh` (`import { configureUnPDF, getResolvedPDFJS } from 'https://esm.sh/unpdf@0.10.0'`), mas a própria documentação de boas práticas do Supabase recomenda **minimizar** importações via `esm.sh` em favor de `npm:`/`jsr:` [busca sobre unpdf + Supabase edge function]. Isso é uma tensão: a forma que "funciona" na prática (esm.sh) é a forma desaconselhada pela Supabase, e a forma recomendada (`npm:unpdf`) é a que falhou no relato acima.

**Conclusão da seção 1.1–1.2:** nenhuma lib está livre de risco:
- `unpdf` é MIT, projetada para edge, mas tem relato de falha real em Supabase Edge Functions especificamente, sem solução publicada.
- `mupdf.js` funciona tecnicamente mas é AGPL — custo de licença comercial, não custo zero.
- `pdf-parse`, `marker`, `docling`, `markitdown` estão descartadas por dependência nativa ou runtime incompatível (Node/Python).

### 1.3 Limite de CPU do Supabase Edge Functions — restrição dura para qualquer parsing de PDF em WASM

Achado que não estava no brief mas é crítico para o Compass dimensionar:

- **CPU time máximo por request: 2 segundos** (tempo de CPU efetivo, não conta I/O assíncrono) [Supabase Docs — Limits](https://supabase.com/docs/guides/functions/limits)
- Memória máxima: 256 MB [mesma fonte]
- Wall clock: até 400s em planos pagos, mas isso não ajuda se o gargalo é CPU, não I/O [mesma fonte]
- Tamanho máximo do bundle da function: 20 MB via CLI, 5 MB via dashboard/Management API [mesma fonte]
- Bibliotecas que exigem multithreading (ex.: `libvips`, `sharp`) **não são suportadas**; Web Worker API e Node `vm` API também não estão disponíveis [mesma fonte]

Parsing de PDF via WASM (pdf.js ou MuPDF) é CPU-bound. Um PDF de poucas páginas de texto nativo provavelmente cabe nos 2s, mas isso **precisa ser medido empiricamente antes da decisão** — não achei benchmark publicado de tempo de CPU de `unpdf`/`mupdf.js` rodando dentro do Supabase Edge Runtime especificamente. Marco isso como **NAO** (sem dado direto) e como risco a validar com um protótipo, não a resolver só com pesquisa de documentação.

### 1.4 Suporte a npm em Deno/Supabase — o mecanismo em si funciona

O Supabase Edge Runtime é Deno-compatível e suporta nativamente módulos npm via especificador `npm:`, com os módulos empacotados via `eszip` para funcionar igual em ambiente hospedado, local e self-hosted [Supabase Blog — Edge Functions: Node and native npm compatibility](https://supabase.com/blog/edge-functions-node-npm) [DEV.to — Using npm packages on Supabase Deno runtime](https://dev.to/yigit-konur/using-npm-packages-on-supabase-deno-runtime-4p32). Isso confirma que a via de importação (`npm:unpdf`, `npm:mupdf`) é suportada em princípio — o problema relatado na seção 1.2 é de comportamento em runtime, não de mecanismo de import.

---

## 2. Alternativa de onde converter

### 2.1 Converter no navegador do cliente antes do upload

Tecnicamente viável: `pdfjs-dist` (a mesma lib que `unpdf` empacota) roda em browser nativamente — é o motor por trás do próprio visualizador de PDF do Firefox. Peso de bundle:

- `pdf.min.js` isolado: por volta de 299 KB minificado [GitHub mozilla/pdf.js#9087](https://github.com/mozilla/pdf.js/issues/9087)
- Empacotado via Webpack sem otimização cuidadosa, o bundle final pode passar de ~988 KB [mesma fonte]
- Uma versão específica reportada: 262,6 KB minificado / 73,3 KB gzip [GitHub agentcooper/react-pdf-highlighter#112](https://github.com/agentcooper/react-pdf-highlighter/issues/112)
- A lib completa do Mozilla (não tree-shaken) pesa cerca de 1.800 KB antes de compressão [mesma fonte/contexto da busca]

Ou seja: **é viável em termos de peso** (73–300 KB gzip é aceitável para um fluxo de upload, que não é uma rota crítica de first-load), mas exige processamento client-side em JS (worker do pdf.js) antes de mandar o resultado para o backend — muda a superfície de código (frontend React+Vite passa a ter essa responsabilidade, não mais só o Edge Function).

Não encontrei um "PDF → markdown" pronto para browser (as libs de markdown, como `pdf2md`, são voltadas a Node); no browser o caminho realista é "PDF → texto/estrutura via pdf.js" e a formatação em markdown feita à mão a partir da extração. **NAO encontrei benchmark de peso de bundle específico de `unpdf` no browser.**

### 2.2 Serviço gerenciado de PDF → markdown

| Serviço | Preço | Fonte |
|---|---|---|
| **LlamaParse** | Grátis até 1.000 páginas/dia; depois ~US$ 0,003/página (US$ 3 por 1.000 páginas) no modo básico; até 7.000 páginas/semana grátis no plano pago + US$0,003/página adicional; modos mais avançados ("Agentic") custam mais créditos por página | [LlamaIndex Pricing Docs](https://developers.llamaindex.ai/llamaparse/general/pricing/) |
| **Unstructured.io** | US$ 0,03/página via API paga-conforme-uso, 15.000 páginas grátis/mês; a partir de US$ 3.000 gastos, páginas ficam grátis até 1M/mês. Para arquivos não-PDF, "página" = tamanho do arquivo ÷ 100 KB | [busca Unstructured.io pricing] |
| **Azure Document Intelligence** | US$ 1,50 por 1.000 páginas (OCR/Read básico); US$ 10 por 1.000 (prebuilt); US$ 30 por 1.000 (extração customizada) | [busca Azure Document Intelligence pricing, jul/2026] |
| **Google Document AI** | US$ 1,50 por 1.000 páginas (OCR básico) até US$ 30 por 1.000 (extractor customizado), mais ~US$ 0,05/hora de hospedagem do processor customizado (~US$ 438/ano fixos por processor ativo) | [busca Google Document AI pricing] |

**Risco LGPD relevante:** enviar o documento do cliente (que pode conter dados de CNPJ, nomes, valores — e em boletos/extratos, potencialmente dados pessoais de terceiros) para um provedor terceiro fora do Brasil configura tratamento de dados por operador estrangeiro. Pela LGPD, a transferência internacional só é permitida em cenários específicos: país/organismo com grau de proteção adequado, garantias contratuais específicas (cláusulas-padrão, normas corporativas globais aprovadas pela ANPD), ou hipóteses excepcionais (cooperação jurídica, consentimento específico do titular, etc.) — Art. 33 da LGPD [LGPD Brasil — Art. 33](https://lgpd-brasil.info/capitulo_05/artigo_33) [ANPD — Transferência Internacional de Dados](https://www.gov.br/anpd/pt-br/assuntos/assuntos-internacionais/transferencia-internacional-de-dados). Isso não inviabiliza o uso desses serviços, mas exige avaliação de base legal e, tipicamente, um DPA (Data Processing Agreement) com cláusulas-padrão — o mesmo problema, aliás, que já existe com o envio de texto para a OpenAI hoje.

---

## 3. NF-e XML brasileira

### 3.1 Estrutura do layout 4.00 — grupos principais confirmados

A partir de múltiplas fontes convergentes [busca sobre layout NF-e 4.00] e do Manual de Orientação do Contribuinte oficial da SEFAZ (fonte primária, não fiz scraping do PDF mas localizei a referência oficial):

- **Manual de Orientação do Contribuinte (MOC), fonte primária/oficial:** [nfe.fazenda.gov.br — Manual de Orientação do Contribuinte](https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=ndIjl+iEFdE%3D) — inclui Anexo I (Leiaute e Regras de Validação NF-e/NFC-e) com os XSDs oficiais.

Grupos do XML (tag raiz `infNFe`, com atributo `Id` contendo a chave de acesso de 44 dígitos prefixada por "NFe"):

| Grupo/tag | Conteúdo | Confirmado por |
|---|---|---|
| `ide` | Identificação da nota: `nNF` (número), `serie`, `dhEmi` (data/hora de emissão), modelo, tipo de emissão, código numérico aleatório (`cNF`) | [Grid Sistemas — Estrutura XML NFe](https://gridsistemas.com.br/estruturaxml/) e corroborado pela estrutura da chave de acesso (3.2) |
| `emit` | Emitente: CNPJ, razão social (`xNome`), Inscrição Estadual | [mesma fonte] |
| `dest` | Destinatário: CNPJ/CPF, nome | [mesma fonte] |
| `det` (repetido por item) → `prod` | Itens: código do produto, descrição (`xProd`, limite de 120 caracteres — usar `infAdProd` para complemento, até 500 caracteres), NCM, CFOP, quantidade, valor unitário, valor total | [mesma fonte] + [flexdocs.net sobre limite de xProd via busca DANFE] |
| `det` → `imposto` | Tributos do item: ICMS, PIS, COFINS (e outros conforme regime) | [mesma fonte] |
| `total` → `ICMSTot` | Totais da nota, incluindo `vNF` (valor total da nota) | [mesma fonte] |
| `cobr` → `dup` (repetido por parcela) | Duplicatas/faturas: `nDup` (número da parcela, 3 dígitos sequenciais), `dVenc` (data de vencimento), `vDup` (valor da parcela). Só aparece quando a forma de pagamento é "14 - Duplicata Mercantil"; vencimentos devem estar em ordem cronológica crescente | [FlexDocs — grupo cobr/dup](https://flexdocs.net/guia-nfe/dup/) [Focus NFe — DuplicataNotaFiscalXML](https://campos.focusnfe.com.br/nfe/DuplicataNotaFiscalXML.html) |
| `Signature` | Assinatura digital sobre o conteúdo de `infNFe`, com o certificado digital usado | [busca sobre validação/assinatura digital NF-e] |

Tamanho: o XML de uma NF-e não pode exceder **500 KB** quando transmitido à SEFAZ para autorização; uma nota aceita até **990 itens** [busca DANFE/XML NFe tamanho — TOTVS/Datamex]. Uma nota simples de poucos itens fica, na prática, na casa de poucos KB a poucas dezenas de KB (não achei um número médio publicado — **NAO**).

### 3.2 Chave de acesso (44 dígitos) — estrutura determinística, valida sem precisar de IA nem de consulta à SEFAZ

Estrutura confirmada por múltiplas fontes convergentes [busca "chave de acesso NF-e 44 dígitos"]:

`UF (2) + AAMM emissão (4) + CNPJ emitente (14) + modelo (2, geralmente "55" para NF-e) + série (3) + número da NF-e (9) + tipo de emissão (1) + código numérico aleatório (8) + dígito verificador (1)` = 44 dígitos.

O dígito verificador (44º) é calculado por **módulo 11**, com pesos de 2 a 9 aplicados da direita para a esquerda sobre os 43 primeiros dígitos — permite validar matematicamente a integridade da chave **sem consultar a SEFAZ e sem IA**.

### 3.3 Como validar que o XML é uma NF-e legítima e bem formada

Duas camadas distintas, confirmadas via busca sobre validação/webservices SEFAZ:

1. **Validação estrutural (offline, sem IA):** conferir o XML contra o XSD oficial do layout (disponível no Anexo I do MOC), verificar bem-formação, ordenação/nome de tags, e recalcular o dígito verificador da chave de acesso (módulo 11, seção 3.2). Isso pega XML malformado ou adulterado grosseiramente, sem depender de rede.
2. **Validação de autenticidade/assinatura (mais forte, mas não é offline puro):** a NF-e é assinada digitalmente pelo emitente sobre o conteúdo de `infNFe` (grupo `Signature`); validar a assinatura contra a cadeia de certificação ICP-Brasil confirma que o emitente é quem diz ser e que o conteúdo não foi alterado após a assinatura [busca sobre assinatura digital NF-e].
3. **Validação de existência/situação (exige rede):** a Sefaz oferece consulta pela chave de acesso para confirmar que a nota foi de fato autorizada (e não cancelada/denegada) — isso é uma chamada de rede a um webservice estadual, não algo que dá pra fazer só lendo o XML [busca sobre consulta NF-e SEFAZ].

**Não é preciso IA para nenhuma dessas três camadas** — é parsing de XML + aritmética + (opcionalmente) uma chamada HTTP a um webservice público.

### 3.4 Bibliotecas JS/TS para parsing de NF-e

- **`djf-nfe`** (npm/GitHub `djalmaoliveira/djf-nfe`): parser MIT, API fluente, "independente da versão do schema" — mas a própria documentação admite que **não cobre todos os campos definidos no schema da NF-e** e não faz validação de valores de campo. Roda em Node.js; não há menção a compatibilidade Deno/edge. Indícios de baixa manutenção atual (CI via Travis, hoje descontinuado; poucos commits recentes) [GitHub djalmaoliveira/djf-nfe].
- **`d-nfe`**: parser similar, mesma limitação de cobertura parcial de campos [busca npm nfe].
- **NFE.io client-nodejs**: é um SDK para **emitir** NFS-e (nota de **serviço**, não a NF-e de mercadoria) e consultar CNPJ/CEP via API do próprio provedor NFE.io — não é um parser de XML de NF-e de terceiros, é outra coisa [GitHub nfe/client-nodejs].

**Conclusão da seção 3.4:** as libs prontas existentes são parciais e não confirmadamente edge-compatible. Para os campos que o brief lista (emitente, destinatário, chave, itens, impostos, totais, duplicatas), **um parser XML genérico é suficiente e mais confiável** do que essas libs incompletas — a estrutura do NF-e é publicamente documentada e estável (layout 4.00), então mapear os `XPath`/caminhos manualmente sobre um parser XML genérico evita a lacuna de cobertura das libs prontas.

Para o parser XML genérico em si: `fast-xml-parser` é puro JavaScript (sem libs C/C++), funciona via `npm:fast-xml-parser` em Deno, e também tem porta dedicada `deno-fast-xml-parser` [busca sobre fast-xml-parser Deno]. Não encontrei benchmark de tempo de parsing dele especificamente dentro do limite de CPU de 2s do Supabase (seção 1.3), mas XML de NF-e é ordens de grandeza mais leve que um PDF renderizado via WASM, então o risco de estourar CPU aqui é muito menor.

---

## 4. Boleto e extrato bancário

### 4.1 Boleto — linha digitável / código de barras é determinística, dá para extrair valor e vencimento sem IA

Confirmado por múltiplas fontes convergentes, com o layout padrão FEBRABAN oficial disponível publicamente [FEBRABAN — Layout Código de Barras v7](https://cmsarquivos.febraban.org.br/Arquivos/documentos/PDF/Layout%20-%20C%C3%B3digo%20de%20Barras%20-%20Vers%C3%A3o%207%20-%2001_03_2023_mn.pdf):

- O **código de barras** tem 44 dígitos (43 de dados + 1 dígito verificador, calculado por **módulo 11**).
- A **linha digitável** (a sequência numérica impressa, mais fácil de digitar/OCRear) tem 47 dígitos: os mesmos 43 dígitos de dados do código de barras, reorganizados em 5 campos, sendo que os 3 primeiros campos têm dígito verificador próprio calculado por **módulo 10**, e o código de barras completo (com seu dígito módulo 11) mais o valor formam os campos finais.
- **Fator de vencimento:** um número de 4 dígitos dentro do campo "valor" da linha digitável, representando dias corridos desde uma data-base (07/10/1997). Importante: pelo Comunicado FB-009/2023 da FEBRABAN, esse fator **estourou o limite máximo (9999) em 21/02/2025** e foi reiniciado para 1000 a partir de 22/02/2025 — **qualquer lógica de decodificação de vencimento precisa tratar essa mudança de regra, senão calcula data errada para boletos emitidos antes vs. depois dessa virada** [Superlógica — Fator de Vencimento FEBRABAN](https://assinaturas.superlogica.com/hc/pt-br/articles/29654851094807-Fator-de-Vencimento-dos-Boletos-Atualiza%C3%A7%C3%A3o-FEBRABAN-o-que-vai-mudar).
- **Valor:** os últimos 10 dígitos da linha digitável são o valor em centavos, sem separador decimal [Toolspace — 47 dígitos do boleto](https://www.toolspace.com.br/blog/o-que-sao-os-47-digitos-boleto).

Ou seja: **sim, dá para extrair valor e vencimento de um boleto sem IA**, desde que o PDF contenha a linha digitável/código de barras como texto (não como imagem escaneada — o que já está fora de escopo pela restrição do usuário). Isso é aritmética determinística sobre uma string de 44 ou 47 dígitos, não interpretação de linguagem natural.

### 4.2 Extrato bancário — formatos padronizados além do PDF

- **OFX (Open Financial Exchange):** formato aberto e amplamente suportado pelos bancos brasileiros para exportação de extrato; a maioria dos internet bankings tem opção "exportar/salvar como OFX" na tela de extrato [busca sobre OFX/CNAB extrato bancário].
- **CNAB (Centro Nacional de Automação Bancária):** criado pela FEBRABAN para troca de arquivos entre empresas e bancos; existe a variante **CNAB240** usada também para extrato, mas o uso mais comum de CNAB no dia a dia de PMEs é para remessa/retorno de cobrança (boletos), não necessariamente extrato — a diferença exata de cobertura de campos entre OFX e CNAB para extrato **não encontrei detalhada o suficiente para afirmar com confiança qual é mais completo; marco como NAO** [busca sobre OFX vs CNAB].

**Conclusão:** se o cliente conseguir exportar OFX (mais provável, é a opção padrão de "extrato" na maioria dos bancos) em vez de subir um PDF, o parsing vira trivial (XML-like, sem necessidade de IA nem de conversão PDF→markdown). Vale considerar oferecer isso como caminho alternativo de upload para extratos, mas essa é uma decisão de produto/UX, não peguei essa recomendação como escopo desta pesquisa.

---

## 5. Custo de token — ordem de grandeza (estimativa, não medição direta)

**Importante:** não encontrei nenhuma fonte que meça diretamente "tokens de uma DANFE de 1 página convertida em markdown" ou "extrato de 5 páginas". O que segue é uma estimativa por composição de duas fontes públicas, não uma medição.

- Regra geral da OpenAI: **~4 caracteres por token** em inglês; a própria OpenAI alerta que **texto denso (código, tabelas) tende a 2–3 caracteres por token**, ou seja, mais tokens que a regra geral sugere [OpenAI Help Center — What are tokens](https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them). Português não é o idioma de referência da regra e tende a tokenizar de forma parecida ou levemente pior que inglês nos tokenizers da OpenAI — não achei número específico para PT-BR (**NAO**).
- Estimativas de mercado por página de documento: documentos "moderadamente densos" (relatórios, artigos) ficam na faixa de **500–800 tokens/página**; documentos densos (jurídico/técnico, com tabelas e números) ficam na faixa de **800–1.200 tokens/página**; tabelas tokenizam pior (mais tokens por caractere visível) do que prosa [busca sobre tokens por página PDF/GPT].

Uma DANFE é essencialmente uma tabela densa de números, códigos (NCM, CFOP), CNPJs e valores — perfil mais próximo do extremo "documento denso com tabela" do que de "prosa". Combinando isso:

| Documento | Estimativa de tokens (markdown) | Base do cálculo |
|---|---|---|
| DANFE, 1 página | **~800 a 1.200 tokens** | Perfil de documento denso/tabular, extremo superior da faixa 500–1.200 tokens/página |
| Extrato bancário, 5 páginas | **~4.000 a 6.000 tokens** (pode passar disso se o extrato tiver muitas linhas de lançamento por página, já que tabela tokeniza pior que prosa) | 5× o intervalo denso por página, com viés para cima pela natureza tabular |

Como referência adicional e não comparável 1:1 (é tokenização de PDF bruto por um modelo de visão, não de markdown pré-convertido): um relato não-oficial no X/Twitter menciona 58.495 tokens para um PDF de 25 páginas processado inteiro (texto+imagem) pelo Claude Sonnet 4.5 — daria ~2.340 tokens/página nesse modo, bem acima da nossa estimativa de markdown puro, o que faz sentido porque processar como imagem custa mais [busca sobre tokens por página PDF]. Isso reforça a lógica da hipótese do usuário: converter para markdown **antes** de mandar pro modelo custa bem menos tokens do que mandar o documento "bruto"/como imagem.

**Recomendação para o Compass dimensionar teto:** usar 1.200 tokens/página como teto conservador de entrada por página de documento convertido, e medir com um protótipo real assim que houver amostras de DANFE/extrato reais — esta é uma estimativa de ordem de grandeza, não um número para configurar limite de produção sem validação empírica.

---

## 6. Itens do brief sem resposta encontrada (NAO)

- Tamanho médio em KB de um XML de NF-e "típico" (poucos itens): **NAO**.
- Benchmark de tempo de CPU de `unpdf`/`mupdf.js` rodando dentro do Supabase Edge Runtime real (só documentação de limites, não medição de uso real dessas libs): **NAO**.
- Peso de bundle específico de `unpdf` (não apenas do `pdfjs-dist` que ele empacota): **NAO**.
- Comparação detalhada de cobertura de campos entre OFX e CNAB240 para extrato bancário (qual tem mais informação, ex. categoria/filial): **NAO** — só achei a afirmação genérica de que OFX "não traz certas informações" sem detalhar quais.
- Número de tokens PT-BR por caractere nos tokenizers da OpenAI (o rule-of-thumb encontrado é para inglês): **NAO**.
- `pdf2md` (opengovsg): licença, última versão, se roda fora de Node.js: **NAO** — não aprofundei porque já havia descartado por indício de ser Node-only e a lacuna já estava coberta por unpdf/mupdf na comparação de extração.

---

## 7. Lista consolidada de fontes

- [unpdf — npm registry](https://registry.npmjs.org/unpdf/latest)
- [unpdf — GitHub](https://github.com/unjs/unpdf)
- [unpdf issue #3 — falha em Supabase Edge Function](https://github.com/unjs/unpdf/issues/3)
- [mupdf — npm registry](https://registry.npmjs.org/mupdf/latest)
- [mupdf.js — GitHub / licenciamento AGPL](https://github.com/ArtifexSoftware/mupdf.js/)
- [pdf-parse — npm registry](https://registry.npmjs.org/pdf-parse/latest)
- [Supabase Docs — Edge Functions Limits](https://supabase.com/docs/guides/functions/limits)
- [Supabase Blog — Edge Functions: Node and native npm compatibility](https://supabase.com/blog/edge-functions-node-npm)
- [djf-nfe — GitHub](https://github.com/djalmaoliveira/djf-nfe)
- [Manual de Orientação do Contribuinte NF-e — Portal Nacional NF-e](https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=ndIjl+iEFdE%3D)
- [Grid Sistemas — Estrutura XML NFe](https://gridsistemas.com.br/estruturaxml/)
- [FlexDocs — grupo cobr/dup](https://flexdocs.net/guia-nfe/dup/)
- [Focus NFe — DuplicataNotaFiscalXML](https://campos.focusnfe.com.br/nfe/DuplicataNotaFiscalXML.html)
- [FEBRABAN — Layout Código de Barras v7 (PDF oficial)](https://cmsarquivos.febraban.org.br/Arquivos/documentos/PDF/Layout%20-%20C%C3%B3digo%20de%20Barras%20-%20Vers%C3%A3o%207%20-%2001_03_2023_mn.pdf)
- [Superlógica — Fator de Vencimento FEBRABAN 2025](https://assinaturas.superlogica.com/hc/pt-br/articles/29654851094807-Fator-de-Vencimento-dos-Boletos-Atualiza%C3%A7%C3%A3o-FEBRABAN-o-que-vai-mudar)
- [OpenAI Help Center — What are tokens and how to count them](https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them)
- [LGPD Brasil — Art. 33, transferência internacional de dados](https://lgpd-brasil.info/capitulo_05/artigo_33)
- [ANPD — Transferência Internacional de Dados](https://www.gov.br/anpd/pt-br/assuntos/assuntos-internacionais/transferencia-internacional-de-dados)
- [LlamaIndex — LlamaParse Pricing](https://developers.llamaindex.ai/llamaparse/general/pricing/)

---

*— Atlas, investigando a verdade 🔎*
