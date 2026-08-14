# INSUMO DE PESQUISA — para o ADR de importação de documentos

**De:** Orion (@aiox-master) · **Para:** Compass (@architect)
**Origem:** pesquisa do Lantern (@analyst), + verificação minha por cima dela.
**Documento completo com fontes:** `docs/research/2026-08-13-importacao-documentos-pdf-nfe-deno/README.md`

---

## 1. Achado que eu verifiquei pessoalmente e que é mais duro do que o Lantern reportou

O Lantern reportou que o gateway limita o corpo a 25 KB e o total de mensagens a 12.000 caracteres. **Fui conferir em `supabase/functions/_shared/ai/validation.ts` e há um quarto limite que ele não mencionou:**

```
linha 3:  MAX_BODY_BYTES            = 25_000
linha 4:  MAX_MESSAGES              = 12
linha 5:  MAX_MESSAGE_LENGTH        =  2_000   <-- este
linha 6:  MAX_TOTAL_MESSAGE_LENGTH  = 12_000
```

**`MAX_MESSAGE_LENGTH = 2.000` é por mensagem individual** (aplicado em `validation.ts:37`).

Consequência: pela estimativa do próprio Lantern, uma DANFE de 1 página em markdown dá ~800–1200 tokens, algo em torno de 3.000–5.000 caracteres. **Uma única DANFE já estoura o limite de uma mensagem**, muito antes de encostar nos 12.000 do total.

Some a isso `validation.ts:19-20`: o corpo aceita **exclusivamente** a chave `messages`, e cada item aceita **exclusivamente** `content` e `role` — qualquer campo extra é rejeitado. O schema é fechado por design.

**Leitura minha, que você deve validar ou derrubar:** isto não é "precisa de payload próprio", é que o endpoint de chat rejeitaria a importação **estruturalmente**, não por tuning. Reforça de forma independente o seu D1 (função separada). Se você discorda, quero o argumento — mas parece que a evidência caiu do seu lado.

## 2. Extração de PDF em Deno — o quadro é ruim, e isso é decisivo

| Opção | Veredito do Lantern |
|---|---|
| **unpdf** (MIT) | Mais viável no papel, **mas há relato real de falha em produção especificamente no Supabase Edge Functions** (`"PDF.js is not available"`), issue fechada sem solução |
| **mupdf.js** | Roda tecnicamente, **mas é AGPL-3.0** — uso comercial em SaaS fechado exige licença paga da Artifex |
| **pdf-parse** | Não serve: depende de `@napi-rs/canvas`, binário nativo |
| **marker / docling / markitdown** | Não servem: são Python, fora do runtime |

Mais: **Supabase Edge Functions tem teto de 2 segundos de CPU time por request.** O Lantern não achou benchmark publicado de parsing de PDF via WASM nesse teto.

**Dois pontos que quero endereçados no ADR, explicitamente:**

- **O AGPL do mupdf é risco jurídico, não preferência técnica.** Se o Gestly é SaaS fechado, AGPL contamina. Não escolha essa rota sem dizer isso em voz alta no ADR. Se for a única viável, é decisão do usuário — e eu levo a ele, não você.
- **Se a extração em edge não se sustenta**, a alternativa do Lantern é pdf.js **no browser** (73–300 KB gzip), o que move a superfície de código para o frontend. Pese isso contra o teto de 2s de CPU.

## 3. Onde a IA é dispensável (e isso vale dinheiro)

- **Boleto:** a linha digitável de 47 dígitos é **100% determinística** — módulo 10 nos três primeiros campos, módulo 11 no código de barras. Valor e vencimento saem **sem IA nenhuma**.
  **Armadilha datada:** o fator de vencimento estourou o limite em **21/02/2025** e reiniciou a contagem. A decodificação precisa tratar as duas eras. Sem isso, todo vencimento sai errado.
- **NF-e:** a chave de acesso de 44 dígitos **valida com módulo 11, offline** — sem IA e sem consultar a SEFAZ. Serve como trava de idempotência.
- **Libs de NF-e** (`djf-nfe`, `d-nfe`) são parciais e não confirmadamente edge-compatible. O Lantern recomenda **parser XML genérico** (`fast-xml-parser`, roda em Deno) **+ mapeamento manual** dos campos — mais confiável que lib incompleta.
- Estrutura NF-e confirmada: `ide` / `emit` / `dest` / `det>prod` / `imposto` / `total` / `cobr>dup`.
- **Extrato:** OFX é o formato mais provável de o cliente exportar do banco. CNAB240 existe, mas é mais associado a remessa/retorno de cobrança.

**Isso reforça sua separação rota XML determinística × rota PDF com IA — e sugere uma terceira: rota linha digitável, também determinística.**

## 4. Serviços gerenciados (se a rota local não fechar)

LlamaParse ~US$ 3/1.000 pg · Unstructured ~US$ 30/1.000 pg · Azure/Google Document AI ~US$ 1,50–30/1.000 pg.

Levantam transferência internacional de dados sob **LGPD Art. 33**. O Lantern observa que a questão **já existe hoje** com a OpenAI — mas registre no ADR mesmo assim, porque documento de cliente é material mais sensível que pergunta de chat.

## 5. Honestidade do que NÃO se sabe

O Lantern marcou como não encontrado, e eu respeito isso — **não preencha esses buracos com chute**:

- Custo de token: **não há medição direta.** As estimativas (DANFE 1 pg ~800–1200 tokens; extrato 5 pg ~4.000–6.000) são **composição, não medida**. Ele recomenda protótipo real antes de fixar teto de produção. **Concordo: não fixe teto no ADR como se fosse fato.**
- Benchmark de CPU real de unpdf/mupdf no Supabase — não existe publicado.
- Peso de bundle do unpdf isolado, tamanho médio de XML de NF-e típico, OFX vs CNAB240 em detalhe, tokens PT-BR por caractere.

## 6. O que eu quero do ADR agora

Escreva com o que tem. Onde a evidência não fecha, **escreva "pendente de protótipo" em vez de decidir no escuro** — decisão errada documentada como certa é pior que buraco declarado.

Se a extração de PDF em edge não se sustentar, isso pode virar decisão do usuário (frontend × serviço externo × licença paga). Nesse caso **me diga**, com as opções e o custo de cada uma. Eu levo a ele. Você não decide o que sai da máquina do cliente, e eu também não.

Fronteiras inalteradas: sem código, sem migration, sem push, sem PR.
