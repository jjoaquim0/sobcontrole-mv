# Pesquisa técnica — pdf.js no navegador para extração de DANFE (Onda 5)

**Data:** 2026-08-29
**Autor:** Lantern (@analyst) — a pedido de Orion (@aiox-master), para uso do @sm (Loom) na story da Onda 5 de `docs/epics/epic-importacao-inteligente-documentos.md`.
**Escopo:** Pesquisa técnica sobre **como usar** pdf.js. A escolha da biblioteca já está fechada (ver §0) — não reabro essa decisão. NÃO é story, NÃO é código de implementação, NÃO cobre OCR/PDF escaneado.

> Convenção: toda afirmação traz a fonte entre colchetes. Onde medi algo eu mesma, digo o comando e o número literal, separado do que apenas li. Onde não encontrei evidência confiável, escrevo **NAO** e proponho como medir.

---

## 0. Verificação do que já estava decidido (não reabro, só confirmo)

Conferi os três documentos que o brief citou antes de pesquisar:

- **`docs/research/2026-08-13-importacao-documentos-pdf-nfe-deno/README.md`** (minha própria pesquisa de 13/08): confirma que `unpdf` foi descartada por falha documentada em produção no Supabase Edge Functions, sem solução publicada (issue fechada) [`docs/research/2026-08-13.../README.md:40`]; `mupdf.js` descartada por AGPL-3.0 com exigência de licença comercial Artifex para SaaS fechado [mesma linha 31]; `pdf-parse`/`marker`/`docling`/`markitdown` descartadas por dependência nativa ou runtime Python [mesma seção 1.1]. **Confirmo: o resumo do brief §3 está fiel à minha pesquisa original.**
- **`docs/architecture/ai-document-ingestion-p3.md`**: confirma a decisão do usuário de 2026-08-14 (linha 4), a estimativa "73 a 300 KB gzip" que o brief pede para eu medir (linha 203), e o risco **R6** reformulado — "não é *se há rota*, e sim **se pdf.js reconstrói tabela de DANFE com qualidade suficiente**" (linha 338), com mitigação explícita de que a v1 não depende disso.
- **`supabase/migrations/20260814100000_document_import_proposals.sql:67`**: confirmo no schema real, não só no ADR — `idempotency_key TEXT NOT NULL CHECK (length(btrim(idempotency_key)) > 0)` na tabela `document_import_proposals`. A pergunta 6 do brief (chave de acesso confiável) tem, portanto, impacto real e verificado sobre uma constraint que já existe no banco, não é hipotético.
- **`vite.config.ts`**: lido, não editado. A modificação local (`server.allowedHosts: true`, para túnel externo) é alheia a este trabalho, confirmado via `git diff`.
- **`package.json`**: projeto usa `vite: ^5.1.6`, `react: ^18.3.1`, `typescript: ^5.2.2`, `"type": "module"`. Sem `browserslist` configurado, sem `build.target` custom no `vite.config.ts` — Vite usa o baseline moderno por padrão.
- **Branch `perf/code-splitting-rotas`** (não mergeada, existe local e em `origin`): usa `React.lazy(() => import(...))` por rota mais `build.rollupOptions.output.manualChunks` por biblioteca (`git show perf/code-splitting-rotas:src/routes/index.tsx`, `git show perf/code-splitting-rotas:vite.config.ts`). É o padrão de "carregar sob demanda" já validado neste repo — ver §3.4.

---

## 1. Versão e build

**Versão estável recomendada: `pdfjs-dist@6.3.289`** (a mais recente publicada no npm em 2026-08-29, licença Apache-2.0, confirmada via `https://registry.npmjs.org/pdfjs-dist/latest`, consultado 2026-08-29).

**Build: o "modern" (`build/pdf.mjs`), não o "legacy".**

- O `package.json` do pacote declara `"main": "build/pdf.mjs"`, `"types": "types/src/pdf.d.ts"` — ESM nativo é o entry point padrão [`registry.npmjs.org/pdfjs-dist/latest`, 2026-08-29].
- A FAQ oficial do projeto distingue os dois builds: o **modern** assume suporte nativo aos recursos JS mais recentes, sem polyfill/transpilação, testado contra as versões atuais de Firefox e Chrome; o **legacy** existe para navegadores mais antigos — Firefox ESR, Chrome 125+, Edge/Opera baseados em Chromium, Safari 18+, Node 22+ — com polyfills e traduções adicionais [github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions, seção "FAQ support", consultado 2026-08-29].
- Este projeto não declara `browserslist` nem `build.target` customizado (verificado por busca em `package.json` e `vite.config.ts`) — herda o baseline moderno do Vite/esbuild, que já é mais novo que o que o build legacy existe para cobrir. **Não há motivo para usar o legacy aqui.**
- ESM vs UMD: só existe build ESM (`.mjs`) e o worker (`.mjs`) — não há UMD nesta versão. Isso é compatível com `"type": "module"` do `package.json` do projeto e com o import nativo de ESM que Vite já faz.

**Import concreto (sem instalar, apenas o padrão documentado publicamente):**
```ts
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
// worker: ver §2
```

---

## 2. O web worker em Vite — a armadilha

**Confirmado: existe uma armadilha real e documentada, não hipotética.** A partir da v4 do pdfjs-dist, o pacote parou de expor o worker num formato que o Vite resolve sozinho — isso gerou uma issue/discussion dedicada no próprio repositório do pdf.js sobre falha de import do worker especificamente em Vite [github.com/mozilla/pdf.js/issues/19519 e /discussions/19520, consultado 2026-08-29]. Testei a v6.3.289 via `unpkg` e o arquivo do worker (`pdf.worker.min.mjs`) existe e é servido normalmente (`curl` retornou HTTP 200) — o problema não é o arquivo não existir, é o **bundler não achar sozinho onde ele está**.

**Dois padrões documentados que funcionam, com trade-off diferente para produção:**

1. **`new URL(..., import.meta.url)`** — o padrão mais citado:
   ```ts
   GlobalWorkerOptions.workerSrc = new URL(
     'pdfjs-dist/build/pdf.worker.min.mjs',
     import.meta.url,
   ).toString();
   ```
   Vite reconhece esse padrão estaticamente (é o mecanismo nativo de asset do Vite) e copia o worker para `dist/assets/` com hash no nome durante `vite build` — funciona em dev **e** em build de produção, é o caso de uso que o próprio Vite documenta para workers de terceiros [github.com/vitejs/vite/discussions/16501, /issues/10837, consultado 2026-08-29]. **Risco relatado:** hashing do nome do arquivo pode gerar inconsistência de cache entre deploys se o service worker/CDN do cliente cachear a versão antiga do JS principal (que referencia um hash de worker que já não existe após um novo deploy) — mencionado em relato de terceiro sobre "funciona no fresh deploy, para de funcionar depois" [medium.com/@prospercoded, "How I Fixed the It Works on My Machine PDF.js Nightmare in Vite", dez/2025, consultado 2026-08-29 — fonte de blog pessoal, não oficial, tratar como relato e não como garantia].

2. **Import com sufixo `?url`:**
   ```ts
   import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
   GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
   ```
   Mesmo mecanismo do Vite por baixo (asset com hash), variante mais explícita. Mesma ressalva de hashing.

3. **Cópia manual para `public/`** (alternativa mais defensiva, não testada por mim): copiar `pdf.worker.min.mjs` para `public/pdf.worker.min.mjs` no repo e apontar `workerSrc = '/pdf.worker.min.mjs'` como string literal. Elimina o hashing e o risco de cache-mismatch entre deploys, ao custo de precisar atualizar o arquivo manualmente a cada bump de versão da lib (fácil de esquecer). Documentado como abordagem usada na prática por mantenedores de libs que embrulham pdf.js [mesma fonte de blog + `vite-plugin-static-copy`, citado em múltiplas issues como alternativa].

**Recomendação:** opção 1 (`new URL(..., import.meta.url)`) é a que casa com o padrão já usado no repo — a branch `perf/code-splitting-rotas` já usa `import()` dinâmico do Vite como mecanismo de carregamento sob demanda (§3.4), então usar o mecanismo de asset nativo do Vite para o worker é consistente, não introduz uma segunda convenção. **Não encontrei confirmação de que o risco de cache-mismatch do parágrafo 1 se materializa neste projeto especificamente — é um relato de terceiro, não uma medição minha nem um caso documentado oficialmente.** Recomendo ao @dev testar um `vite build` + `vite preview` real antes de fechar a story, e considerar a opção 3 (cópia para `public/`) como plano B se o cache-mismatch aparecer nos testes.

**Não testei isto rodando `npm install` nem `vite build`** — o brief proíbe instalar. Esta seção é leitura de documentação e relatos públicos, não medição.

---

## 3. Tamanho real do bundle

### 3.1 O que medi (comando literal, resultado literal)

Baixei os arquivos publicados de `pdfjs-dist@6.3.289` via `unpkg` (CDN público que serve o conteúdo exato do pacote npm, sem instalar nada localmente) e medi bytes reais, tanto comprimidos (como trafegam na rede, com `Content-Encoding: gzip`) quanto descomprimidos:

```
curl -s -H "Accept-Encoding: gzip" -o main.raw.gz  https://unpkg.com/pdfjs-dist@6.3.289/build/pdf.min.mjs
curl -s --compressed -o main.dec.mjs               https://unpkg.com/pdfjs-dist@6.3.289/build/pdf.min.mjs
curl -s -H "Accept-Encoding: gzip" -o worker.raw.gz https://unpkg.com/pdfjs-dist@6.3.289/build/pdf.worker.min.mjs
curl -s --compressed -o worker.dec.mjs              https://unpkg.com/pdfjs-dist@6.3.289/build/pdf.worker.min.mjs
```

| Arquivo | Bytes gzip (rede) | Bytes descomprimido | Em KB (base 1000) | Em KiB (base 1024) |
|---|---:|---:|---:|---:|
| `build/pdf.min.mjs` (biblioteca principal, minificada) | 131.288 | 458.705 | 131,3 KB gzip / 458,7 KB cru | 128,2 KiB gzip / 448,0 KiB cru |
| `build/pdf.worker.min.mjs` (worker, minificado) | 373.343 | 1.265.413 | 373,3 KB gzip / 1.265,4 KB cru | 364,6 KiB gzip / 1.235,7 KiB cru |
| **Total (principal + worker), gzip** | **504.631** | — | **≈ 504,6 KB** | **≈ 492,8 KiB** |

**Todas as unidades acima são KB decimal (1000 bytes) ou KiB binário (1024 bytes), explicitado na própria coluna — não confundi as duas.**

Medi também o build `legacy` para registro (não é o recomendado, §1): `legacy/build/pdf.worker.min.mjs` = 389.924 bytes gzip / 1.317.034 bytes cru — um pouco maior que o modern, como esperado (carrega polyfill extra).

Como segunda fonte, independente do meu `curl`: a API pública do Bundlephobia mediu o pacote `pdfjs-dist` (entry principal) em `size: 473061, gzip: 133448, dependencyCount: 0` bytes [bundlephobia.com/api/size?package=pdfjs-dist@6.3.289, consultado 2026-08-29] — na mesma ordem de grandeza do meu `pdf.min.mjs` medido diretamente (458.705 / 131.288 bytes), a pequena diferença é método de minificação/medição do próprio Bundlephobia. As duas medições convergem.

### 3.2 Correção ao ADR — o número "73 a 300 KB gzip" está desatualizado e incompleto

O ADR (`docs/architecture/ai-document-ingestion-p3.md:203`) usa a faixa "73 a 300 KB gzip", que por sua vez vem da minha pesquisa de 13/08, que citava um número de **2018**, de uma versão antiga (v3.1.81) e **só da biblioteca principal**, sem contar o worker [`docs/research/2026-08-13.../README.md:75`, citando github.com/agentcooper/react-pdf-highlighter/issues/112].

Medindo a versão atual (6.3.289) e **somando o worker, que é obrigatório para qualquer parsing** (pdf.js não funciona sem ele — é onde o parsing de fato roda, fora da main thread):

- **O extremo inferior do ADR (73 KB) já não corresponde a nenhuma medição atual — nem só a lib principal chega perto disso hoje (131 KB gzip).**
- **O extremo superior do ADR (300 KB) cobre só a lib principal (131 KB) com folga, mas fica abaixo do total real quando o worker entra na conta (≈ 505 KB gzip).**

Isto não muda a decisão (pdf.js no navegador continua correta — ver §7), mas muda o número de planejamento: **o custo real de rede, quando a rota de upload de PDF é de fato usada, é da ordem de 500 KB gzip, não de 73–300 KB.** Isso é maior que qualquer chunk de rota já existente hoje neste repo (o próprio `vite.config.ts` da branch de perf usa `chunkSizeWarningLimit: 600` KB como teto de aviso — este par de arquivos, sozinho, chegaria a ~83% desse teto).

### 3.3 Isso é ruim? Só parcialmente — depende de quando carrega

O ponto que salva o orçamento é o mesmo que o ADR já previu (linha 203: "na rota de upload e não no first-load crítico"): **isso continua correto**, mas o mecanismo que garante isso é o `import()` dinâmico, e ele se aplica de formas diferentes aos dois arquivos:

- **A lib principal** (`pdf.min.mjs`, 131 KB gzip): se importada via `import('pdfjs-dist')` dentro do componente/handler de upload (não no topo do arquivo de rota), vira um chunk JS próprio que só baixa quando o usuário abre a tela de importação de PDF — mesmo padrão de `React.lazy()` já usado pela branch `perf/code-splitting-rotas` para páginas inteiras (`git show perf/code-splitting-rotas:src/routes/index.tsx`). **Não fica no first-load.**
- **O worker** (`pdf.worker.min.mjs`, 373 KB gzip): não é bundlado dentro do JS da aplicação de jeito nenhum — vira um **arquivo estático separado** (asset do Vite, ver §2), baixado pelo navegador só no momento em que o `Worker` é instanciado (ou seja, só quando o código chama `getDocument()` pela primeira vez). Isso significa que o worker nunca conta para o tamanho de nenhum chunk JS da aplicação — é uma segunda requisição HTTP, disparada só quando o usuário efetivamente sobe um PDF.

**Conclusão da seção:** o padrão de `import()` dinâmico + asset do Vite mantém os 505 KB fora do first-load, mas o custo real, no momento em que o usuário sobe um PDF, é a ordem de meio megabyte em rede — bem mais que a faixa que o ADR estimou. Isso não bloqueia a decisão, mas é informação que o @sm precisa para a UX (ex.: mostrar um indicador de carregamento na primeira vez que o worker precisa baixar, especialmente em conexão móvel).

### 3.4 Tree-shaking da lib principal — não medi, não encontrei fonte pública

Não encontrei fonte pública que meça se o Rollup/Vite consegue eliminar código não usado de dentro de `pdf.mjs` quando a aplicação só chama `getDocument`/`getPage`/`getTextContent` (sem renderizar em `<canvas>`, sem anotações, sem XFA). O pacote é distribuído já como um bundle único da própria build do pdf.js — não é garantido que seja tree-shakeable de forma eficaz por um bundler externo. **NAO — proponho medir**: rodar `vite build` num app mínimo que só importa `getDocument`/`getTextContent` e comparar o tamanho do chunk gerado contra os 131 KB gzip medidos aqui. Se o Rollup não conseguir eliminar nada, o número da tabela acima (§3.1) já é o número final; se conseguir, pode ficar menor — mas isso é validação de protótipo, não pesquisa de documentação.

---

## 4. API de extração de texto — o que ela devolve

Fluxo confirmado na documentação oficial (JSDoc do pdf.js) [mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html, consultado 2026-08-29] e em issues/discussions da própria comunidade sobre a forma dos dados:

```
getDocument(source) → PDFDocumentProxy
  .numPages
  .getPage(n) → PDFPageProxy
    .getTextContent({ includeMarkedContent?, disableNormalization? }) → Promise<TextContent>
      .items: (TextItem | TextMarkedContent)[]
```

**Cada `TextItem` carrega, confirmado:**
- `str` — a string de texto do fragmento.
- `dir` — direção do texto (`"ltr"`/`"rtl"`).
- `transform` — matriz afim de 6 elementos; `transform[4]` e `transform[5]` são as coordenadas X/Y de onde o texto foi posicionado na página [github.com/mozilla/pdf.js/issues/12031, consultado 2026-08-29].
- `width`, `height` — dimensões do fragmento.
- `fontName` — código interno da fonte (não o nome legível).
- `hasEOL` — se o fragmento é seguido por quebra de linha.

**Resposta direta à pergunta do brief:** sim, `getTextContent()` devolve **posição (coordenadas X/Y) por fragmento de texto**, não só a string corrida. Isso é matéria-prima suficiente, em princípio, para reconstruir estrutura de tabela (agrupar fragmentos por Y para formar linhas, detectar colunas por lacunas de X) — é a técnica documentada por implementações de terceiros que fazem extração de tabela sobre pdf.js, ex. `pdf.js-extract` [npmjs.com/package/pdf.js-extract, consultado 2026-08-29].

**O que isso NÃO é:** pdf.js **não reconstrói tabela nenhuma sozinho**. Ele devolve uma lista plana de fragmentos posicionados; agrupar isso em linhas/colunas de uma DANFE é lógica de aplicação a ser escrita — clustering por tolerância de Y para linha, por gap mínimo de X para coluna, é o padrão citado por implementações de terceiros, mas não existe biblioteca padrão nem função pronta no próprio pdf.js para isso.

**Isso responde ao R6 do ADR com mais precisão:** a pergunta "pdf.js reconstrói tabela de DANFE com qualidade suficiente" tem uma resposta enganosamente simples — **pdf.js não reconstrói tabela nenhuma, nunca**; a qualidade da reconstrução depende inteiramente do algoritmo de clustering que o @dev escrever sobre os dados brutos de posição, e isso **não tem como ser avaliado por pesquisa de documentação** — só testando contra DANFEs reais de diferentes emissores (o layout visual de DANFE varia por software emissor, mesmo com o XML padronizado por trás). Isto está alinhado com o que o próprio ADR já concluiu (linha 338: "a v1 não depende disso... se a onda 5 mostrar que não sustenta, a decisão volta ao usuário") — só estou dando o motivo técnico concreto de por que é um risco que só se resolve empiricamente.

---

## 5. Detectar PDF sem camada de texto — critério determinístico

**Não existe uma função pronta `isScanned()` no pdf.js.** O sinal disponível é indireto: chamar `getTextContent()` em cada página e observar quanto texto real volta.

**Critério recomendado (determinístico, verificável sem protótipo):**

1. Para **todas** as páginas do documento (não só a primeira — um PDF pode ter uma capa em branco ou uma página de rosto sem texto mesmo sendo um documento com texto real nas demais), chamar `getTextContent()`.
2. Concatenar `item.str.trim()` de todos os itens de todas as páginas.
3. Se o total de caracteres não-espaço for **zero** (ou abaixo de um limiar mínimo pequeno, para tolerar um carimbo/rodapé isolado que não é o conteúdo real), tratar como "sem camada de texto extraível" — cair no estado de erro desenhado pela UX ("não conseguimos ler o texto deste arquivo... salvar só o arquivo"), nunca silenciosamente.

**Onde esse critério erra (documentado, não hipotético):**

- **Falso "tem texto"**: um PDF escaneado que já passou por OCR em algum momento (mesmo fora deste sistema) tem uma camada de texto real, só que invisível visualmente — `getTextContent()` devolve texto normalmente. Isso não é um problema para nós: se há texto extraível de verdade, o documento não está mais no caso "escaneado sem texto" que o usuário pediu para excluir — está fora de escopo de qualquer forma (OCR já rodou, por outra ferramenta).
- **Falso "sem texto"**: um limiar de "zero caracteres" é seguro (não gera falso positivo de rejeição de documento válido), mas um limiar maior que zero (para tolerar ruído) pode rejeitar um DANFE legítimo cujo texto está mal-formado por outro motivo que não é "ser escaneado" (ex.: fonte customizada não mapeada corretamente — problema conhecido do pdf.js, ver issue sobre `fontName`/caracteres especiais não capturados [github.com/mozilla/pdf.js/issues/16796, /issues/11016, consultado 2026-08-29]). **Recomendo o limiar mais simples e mais seguro: zero caracteres = sem texto.** Qualquer coisa acima de zero, por menor que seja, já não é "escaneado" no sentido que o usuário quis excluir — é outro tipo de falha de extração, que deveria gerar um erro diferente (e mais específico) do que "documento escaneado".

**Não encontrei nenhum benchmark público que valide esse limiar contra uma amostra real de DANFEs escaneadas vs. nativas** — é uma lacuna honesta, e a forma de fechá-la é testar com amostras reais (algumas dezenas de PDFs, nativos e escaneados, de fontes diferentes) antes de travar o número em produção. Isso não é diferente do padrão de outras ferramentas maduras da área: até o OCRmyPDF, ferramenta consolidada de OCR, documenta que **não consegue sempre distinguir** "tem texto real" de "tem camada de OCR invisível sobre imagem" de forma automática [ocrmypdf.readthedocs.io, seção de erros comuns, consultado 2026-08-29] — ou seja, esse não é um problema que o pdf.js resolve mal; é um problema que a categoria inteira de ferramentas trata como heurística, não como certeza.

---

## 6. A chave de acesso de 44 dígitos — a pergunta de maior impacto

**Resposta honesta: NAO encontrei nenhuma fonte pública que meça especificamente "pdf.js extraindo a chave de acesso de uma DANFE".** Não existe benchmark, não existe issue, não existe post de blog testando esse caso exato. Isto não é uma resposta vazia — é o resultado real da busca, e o brief pede explicitamente para eu dizer isso em vez de estimar.

**O que encontrei, e que é evidência indireta forte, na mesma categoria de falha:**

O pdf.js tem um histórico longo (issues abertas entre 2015 e 2024, ainda sem solução geral) de reconstruir **incorretamente o espaçamento** entre caracteres/fragmentos em `getTextContent()`, nos dois sentidos:

- **Espaços que deveriam existir somem**, colando fragmentos: um exemplo documentado é literalmente uma sequência numérica agrupada — `"256 36 30"` extraído como `"2563630"` [github.com/mozilla/pdf.js/issues/14497, consultado 2026-08-29].
- **Espaços aparecem onde não deveriam**, entre cada caractere: `"VELKOMMEN TIL ALMINDINGEN"` virando `"V E L K O M M E N T I L..."` [github.com/mozilla/pdf.js/issues/6705, consultado 2026-08-29].
- Comportamento inconsistente de quebra de texto em geral, "muito inconsistente" nas palavras da própria issue [github.com/mozilla/pdf.js/issues/18201, consultado 2026-08-26].

A chave de acesso é impressa na DANFE exatamente na forma do primeiro exemplo — uma sequência numérica longa, visualmente agrupada em blocos de 4 dígitos separados por espaço. **É plausível, mas não confirmado, que ela sofra o mesmo tipo de falha**: os blocos podem sair colados (sem os espaços visuais — inofensivo para nós, ver mitigação abaixo), ou podem sair fragmentados de formas inesperadas entre múltiplos `TextItem`, exigindo reconcatenação cuidadosa.

**A mitigação que torna isso tratável, mesmo sem pdf.js ser "confiável":** a chave de acesso tem um dígito verificador calculável por módulo 11 sobre os 43 primeiros dígitos — isto já está documentado na minha pesquisa de 13/08 [`docs/research/2026-08-13.../README.md:122-124`] e é aritmética determinística, não depende de rede nem de IA. O desenho recomendado não pergunta "pdf.js extraiu certo?" — pergunta **"o que pdf.js extraiu passa no dígito verificador?"**:

1. Extrair todo o texto da(s) página(s) onde a chave costuma aparecer (topo da DANFE, abaixo do código de barras).
2. Isolar sequências de dígitos (ignorando espaços/quebras entre fragmentos — juntando tudo que for dígito, descartando o resto) até achar uma sequência de exatamente 44 dígitos.
3. Recalcular o dígito verificador (módulo 11) sobre os 43 primeiros contra o 44º.
4. **Se bater:** usa como `idempotency_key`, com confiança alta — o checksum não é adivinhável por acaso em 43 dígitos aleatoriamente corrompidos.
5. **Se não bater:** é falha de extração declarada, não silenciosa — cai no mesmo estado de erro do §5 (ou um estado de erro mais específico: "não conseguimos confirmar a chave de acesso"), nunca grava um valor não-verificado no `idempotency_key NOT NULL` do banco.

Isso muda a pergunta do brief de "pdf.js extrai a chave com confiança?" (sem resposta pública) para "o pipeline consegue *saber* quando a extração da chave falhou, mesmo sem saber de antemão a taxa de acerto do pdf.js?" — e a resposta a essa segunda pergunta é **sim**, porque o checksum é uma segunda fonte de verdade independente do pdf.js.

**O que isso não resolve:** a taxa de sucesso real (quantos PDFs de DANFE, de quantos emissores diferentes, vão bater o checksum de primeira) continua desconhecida até testar com amostras reais. Se a taxa for muito baixa na prática, a UX de "falha, tente de novo" pode ficar frustrante mesmo com o pipeline seguro — isso é uma questão de qualidade de produto, não de correção, e só se responde com amostras reais de DANFE de diferentes softwares emissores (Sefaz, Bling, Tiny, Omie, etc. — o XML é padronizado, o PDF não).

**Proposta de medição concreta para o @dev ou para antes da story fechar:** reunir 10–20 PDFs de DANFE reais de emissores diferentes (não gerados sinteticamente), rodar `getDocument` + `getTextContent` sobre eles (em um protótipo isolado, fora deste repo se necessário para não violar a fronteira de "não instalar"), e medir quantos batem o checksum de primeira sem tratamento especial. Isso é a única forma de fechar esta pergunta com números reais.

---

## 7. Licença

**pdf.js / pdfjs-dist@6.3.289: Apache-2.0**, confirmado tanto no campo `license` do `package.json` publicado no npm [`registry.npmjs.org/pdfjs-dist/latest`, consultado 2026-08-29] quanto no README do projeto [github.com/mozilla/pdf.js/blob/master/README.md, consultado 2026-08-29].

**Dependências:** o registro do npm lista **zero dependências obrigatórias** para `pdfjs-dist@6.3.289` (`dependencyCount: 0`, confirmado também via Bundlephobia). Existe uma única `optionalDependency`: `@napi-rs/canvas@^1.0.0`, licença **MIT** [`registry.npmjs.org/@napi-rs/canvas/latest`, consultado 2026-08-29] — sem conflito de licença de qualquer forma.

**Essa dependência opcional não deveria nem ser relevante para este projeto**, porque ela só existe para o caso de pdf.js rodar em Node.js e precisar desenhar num canvas (ex.: gerar thumbnail de PDF no servidor) — não é usada em navegador, onde o `<canvas>` já é nativo. Como este projeto usa pdf.js **só no navegador do cliente** (decisão já fechada), essa dependência nunca deveria ser carregada.

**Ressalva de build, não de licença:** encontrei múltiplas issues de terceiros relatando que alguns bundlers (incluindo setups baseados em Vite com SSR, como electron-vite e SvelteKit) tentam resolver estaticamente o import condicional que o pdf.js faz para `canvas`/`@napi-rs/canvas` mesmo em contexto de navegador puro, e falham no build por não achar o pacote [github.com/mozilla/pdf.js/issues/19145, /issues/19047, consultado 2026-08-29]. Este projeto não usa SSR (é SPA Vite puro), o que reduz a chance de o problema aparecer, mas **não encontrei confirmação de que Vite SPA client-only está livre disso** — é um ponto a verificar no primeiro `vite build` real, com a mitigação já documentada pela comunidade de excluir `canvas`/`@napi-rs/canvas` via `optimizeDeps.exclude` ou `resolve.alias` para um módulo vazio, se aparecer.

**Conclusão:** sem risco de licença. O motivo que matou `mupdf.js` (AGPL) não se repete aqui.

---

## 8. Recomendação e custo de estar errada

**Recomendação:** seguir com `pdfjs-dist@6.3.289`, build modern (`build/pdf.mjs`), worker configurado via `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`, ambos carregados via `import()` dinâmico restrito ao componente/rota de upload de PDF — não no topo da árvore de rotas. Extração de texto via `getDocument → getPage → getTextContent`, com a chave de acesso validada por dígito verificador (módulo 11) antes de ser aceita como `idempotency_key`, e detecção de "sem texto" por contagem zero de caracteres em todas as páginas.

**Onde esta pesquisa muda o que o ADR já sabia (não a decisão, o dimensionamento):**
- O bundle real (principal + worker) é **≈ 505 KB gzip**, não 73–300 KB. A decisão continua certa (custo zero de licença/infra, LGPD melhor, fora do first-load), mas o número para dimensionar UX de carregamento no momento do upload precisa ser este, maior.
- A "reconstrução de tabela de DANFE" (R6 do ADR) não é uma pergunta que pdf.js responde — pdf.js só devolve posição por fragmento; a qualidade é 100% do algoritmo de clustering a ser escrito, e só se mede com DANFEs reais.
- A confiabilidade da chave de acesso não tem resposta pública, mas tem uma mitigação concreta (validação por checksum) que torna a pergunta "isso é seguro?" respondível sem depender da taxa de acerto do pdf.js — e essa mitigação já é consistente com o desenho do ADR (a chave é validável offline por módulo 11, isso já estava na minha pesquisa de 13/08).

**Custo de eu estar errada:**
- Se o número de bundle (§3) estiver errado para pior (mais alto na prática, ex. por falta de tree-shaking, §3.4): o impacto é UX de carregamento mais lento na tela de upload, não uma falha de arquitetura — é ajustável com um indicador de progresso, não exige trocar de biblioteca.
- Se a reconstrução de tabela (§4) não sustentar qualidade suficiente na prática: o próprio ADR já previu esse desfecho e o desenhou como não-bloqueante (R6, v1 não depende disso) — o custo já está absorvido pela arquitetura, não pela minha pesquisa.
- **Se a chave de acesso (§6) não sair confiável na prática, mesmo com a mitigação de checksum** (ex.: taxa de falha alta o suficiente para irritar o usuário, mesmo que nunca grave um valor errado): o custo é de produto/UX, não de integridade de dado — o `NOT NULL CHECK` do banco nunca aceita uma chave não validada, então o pior caso é "pedir para o usuário tentar de novo ou digitar a chave manualmente" com mais frequência do que seria ideal. Isso é uma decisão de produto para o usuário/Orion tomar depois de ver dados reais, não algo que eu deveria resolver nesta pesquisa.

---

## 9. Fontes consultadas (2026-08-29)

- [npm registry — pdfjs-dist@latest](https://registry.npmjs.org/pdfjs-dist/latest)
- [npm registry — @napi-rs/canvas@latest](https://registry.npmjs.org/@napi-rs/canvas/latest)
- [Bundlephobia API — pdfjs-dist@6.3.289](https://bundlephobia.com/api/size?package=pdfjs-dist@6.3.289)
- [unpkg — pdfjs-dist@6.3.289/build/](https://unpkg.com/pdfjs-dist@6.3.289/build/) (medição direta via `curl`, ver §3.1)
- [mozilla/pdf.js — README](https://github.com/mozilla/pdf.js/blob/master/README.md)
- [mozilla/pdf.js — FAQ (modern vs legacy)](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions)
- [mozilla/pdf.js — Issue #19519, Discussion #19520 (worker em Vite)](https://github.com/mozilla/pdf.js/discussions/19520)
- [mozilla/pdf.js — Issue #19145, #19047 (canvas/napi-rs em bundlers)](https://github.com/mozilla/pdf.js/issues/19145)
- [mozilla/pdf.js — Issue #12031 (coordenadas transform de TextItem)](https://github.com/mozilla/pdf.js/issues/12031)
- [mozilla/pdf.js — Issue #14497 (espaços somem: "256 36 30" → "2563630")](https://github.com/mozilla/pdf.js/issues/14497)
- [mozilla/pdf.js — Issue #6705 (espaço extra entre cada caractere)](https://github.com/mozilla/pdf.js/issues/6705)
- [mozilla/pdf.js — Issue #9998, #7327, #18201, #16796, #11016 (outras falhas de espaçamento/caractere em getTextContent)](https://github.com/mozilla/pdf.js/issues/9998)
- [mozilla/pdf.js — JSDoc PDFPageProxy](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html)
- [pdf.js-extract — npm (técnica de reconstrução de tabela por coordenadas)](https://www.npmjs.com/package/pdf.js-extract)
- [OCRmyPDF — documentação de erros comuns (limite da própria categoria de ferramenta em distinguir texto real de OCR invisível)](https://ocrmypdf.readthedocs.io/en/latest/errors.html)
- [Medium — "How I Fixed the It Works on My Machine PDF.js Nightmare in Vite" (relato de terceiro, não fonte oficial)](https://medium.com/@prospercoded/how-i-fixed-the-it-works-on-my-machine-pdf-js-nightmare-in-vite-54adfe92e7f2)
- [vitejs/vite — Discussion #16501, Issue #10837 (assets/worker de terceiros em Vite)](https://github.com/vitejs/vite/discussions/16501)
- Repositório local: `docs/research/2026-08-13-importacao-documentos-pdf-nfe-deno/README.md`, `docs/architecture/ai-document-ingestion-p3.md`, `docs/epics/epic-importacao-inteligente-documentos.md`, `supabase/migrations/20260814100000_document_import_proposals.sql`, `package.json`, `vite.config.ts`, branch `perf/code-splitting-rotas` (`git show`).

---

*— Lantern, investigando a verdade 🔎*
