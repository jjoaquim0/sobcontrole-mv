# Brief — escreva o prompt do Forge para a Story 1.56 (Onda 3, UI de revisão e confirmação)

**De:** Orion (`@aiox-master`) · **Para:** Quill (`@prompt-engineer`) · **Data:** 2026-08-24

---

## 1. Pedido do usuário, na íntegra

Linha de trabalho (2026-08-13):

> "preciso da criacao da minha importacao de documentos, cliente joga um documento tipo um pdf, minha ia gestly le os dados, pergunta se pode integrar ao sistema, e se sim integra ao sistema, quero isso funcionando, use o time, o maestri, os agentes aiox e etc"

Esclarecimento que alterou escopo (2026-08-13):

> "foto nao, e pdf eu pensei em primeiro ser convertido pra markdown ou html, pra sair mais barato pra ia ler. Geralmente vai jogar nfe, xml, pdf,"

Método, exigido por ele e obrigatório em todo brief que você escrever:

> "ele quer prompts precisos para todos os agentes, explicando bem cada tarefa antes de delegar"

Sempre com (1) pedido original completo, (2) objetivo e contexto, (3) escopo do entregável.
Formato em `docs/agents/brief-template.md`. Brief vai **em arquivo**; a mensagem leva só o ponteiro.

Sessão de 2026-08-22, literal:

> "pode continuar tudo ai, so quero lembrar de usar o engenheiro de prompt e o coorquestrador, quero essa funcionalidade funcionando hoje"

Hoje (2026-08-24) ele pediu apenas: *"continue a tarefa que estavamos fazendo"*.

## 2. Objetivo desta tarefa

**A Story 1.56 é a peça que torna o pedido dele verdade.** O loop que ele descreveu
("sobe documento → sistema pergunta → confirma → dados no sistema") não existe até a Onda 3
fechar. A Onda 2 (Story 1.55) entregou só o lado de trás: parser determinístico e gravação de
proposta `pending`. Ninguém consegue confirmar nada ainda, porque não há tela.

Você vai escrever **um** brief: o prompt do **Forge (`@dev`, Dex)** para implementar a
Story 1.56. Um só executor, um só brief.

Você **não** implementa, não fala com o Forge nem com nenhum outro agente, e não delega.
Devolve o arquivo a mim, eu reviso e eu envio.

## 3. Estado que eu verifiquei nesta sessão — desconfie e confira

- **Story 1.55 = Done.** `docs/stories/1.55.piloto-cabecalho-nfe-xml.story.md`, Change Log
  versão 0.1.4, transição `InReview → Done` assinada `@qa`.
- **Gate da 1.55 = CONCERNS**, não FAIL. `docs/qa/gates/1.55-piloto-deterministico-cabecalho-nfe-xml.yml`,
  `waiver.active: false`, quatro issues abertas: TEST-001 e TEST-002 (medium), REL-001 (medium),
  TEST-003 (low). **Nenhuma é bloqueante da 1.56**, mas TEST-002 e REL-001 tocam terreno que a
  1.56 pisa (constraint UNIQUE real e runtime Deno/Edge). O brief do Forge deve dizer
  explicitamente que ele **não** deve tentar fechar issues de gate da 1.55 — isso é do `@qa`
  e de outra story.
- **`npm test` = 60 arquivos / 551 testes / 0 falhas.** Eu rodei agora, nesta sessão, e o
  número bate exatamente com o que o Forge e o Beacon reportaram em 2026-08-22. Este é o
  baseline real de hoje, **não** os 510 do texto do AC13.
- **Baselines que eu NÃO medi nesta sessão** e que o brief deve mandar o Forge medir antes de
  começar, sem herdar de mim: `npm run lint` (última medida: 276 erros / 2 warnings),
  `npm run typecheck` (última medida: 24 diagnósticos), `npm run build` (última medida: PASS).
- **Código da 1.55 no disco, tudo untracked**, branch `docs/importacao-inteligente-documentos`,
  último commit `3c13648`:
  `supabase/functions/_shared/document-import/nfe.ts`,
  `supabase/functions/_shared/document-import/handler.ts`,
  `supabase/functions/document-extraction/index.ts`,
  `src/services/documentImportNfe.test.ts`,
  `src/services/documentExtractionSecurity.test.ts`.
- **Migration `20260814100000` foi aplicada no banco remoto** com autorização do usuário em
  2026-08-22. O Dev Agent Record da 1.55 registra verificação remota somente leitura: três
  tabelas com RLS, coluna `text_origin`, `UNIQUE (company_id, idempotency_key)` e a RPC
  `apply_nfe_purchase_proposal(UUID)` `SECURITY INVOKER` com grant `authenticated`.
  **Confirme isso na sua leitura** — é a base do AC8 da 1.56.
- **A Story 1.56 está em Draft.** O Ledger (`@po`) está revalidando **agora, em paralelo com
  você**, porque a única causa do NO-GO anterior era "1.55 não está Done", e essa causa acabou.
  Escreva o brief assumindo GO, mas deixe escrito nele que **o Forge só começa com a story em
  `Ready`**, e que a transição é do `@po`.
- **Todos os agentes estavam ociosos** ao início desta sessão. Ninguém edita esses arquivos.

## 4. Fontes obrigatórias para você ler antes de escrever

Não escreva sobre lacuna preenchida por suposição — está no seu charter.

- `docs/stories/1.56.revisao-confirmacao-cabecalho-nfe.story.md` — **os 13 AC são a lei**.
  O brief não pode contradizê-los, ampliá-los nem "melhorá-los". Se algum AC estiver errado ou
  desatualizado, me avise **antes** de escrever; corrigir AC é do `@po`/`@sm`, nunca do `@dev`.
- `docs/ux/importacao-inteligente-documentos-fluxo-ux.md` — §3.1, §3.2, §3.6 (em especial
  §3.6.5, o corte do piloto), §4, §5, §6 (acessibilidade), §7, §8.1 e o wireframe §8.1b.
- `docs/architecture/ai-document-ingestion-p3.md` — D1 a D9, QA-1 a QA-4, riscos R1-R10.
  Em especial **D2** (propose-then-apply, a IA nunca escreve no domínio) e o princípio de que
  **consentimento é ato de UI, nunca turno de conversa** — se o "pode integrar?" virar chat, o
  documento controla o banco. Isso é a razão de existir da 1.56.
- `docs/data/document-import-proposals-schema.md` — §2.5, §2.6, §6.
- `supabase/migrations/20260814100000_document_import_proposals.sql` — a RPC
  `apply_nfe_purchase_proposal` está em `:362-543` e o grant em `:768`. **Confira as linhas.**
- `src/types/index.ts` — `PaymentMethod` em `:5`, `AccountPayable.supplierId` obrigatório em
  `:341`, `Deal` em `:444-462`.
- Os três arquivos de runtime da 1.55, para o Forge saber o que já existe e não reescrever.
- Padrões do próprio repositório para tela autenticada: como outras páginas obtêm
  `company_id` (`requireCompanyId()` / `useAuthStore`), como chamam RPC, como testam componente.
  **O brief deve mandar o Forge seguir o padrão existente, não inventar um novo.**

## 5. O que o brief do Forge precisa conter — não negociável

Use os dez itens da seção 11 do meu charter. Em cima deles, estes pontos específicos:

1. **Contexto verificado por mim**, marcado como tal, com a instrução explícita
   "confirme por conta própria, não aceite de mim".
2. **Contratos fechados**: nome exato da RPC e assinatura, nome exato de cada tabela e coluna
   que a UI toca, forma exata do payload da proposta, texto **literal** do aviso do corte
   exigido pelo AC4 — o teste procura o texto exato.
3. **Fronteiras duras, por nome de arquivo**: não tocar nos três arquivos de runtime da 1.55
   a não ser que um AC exija; não tocar em `docs/qa/gates/`; não tocar na seção QA Results de
   nenhuma story; não tocar em `.claude/launch.json` nem `vite.config.ts` — esses dois já
   estavam modificados antes desta linha de trabalho e **não são nossos**.
4. **Números de baseline**, com a distinção entre o que eu medi hoje (`npm test` = 551/0) e o
   que ele mesmo tem de medir antes de começar (lint, typecheck, build). E o alerta de que o
   texto do AC13 cita 510 testes, número anterior à 1.55 — o gate é **0 falhas sobre o baseline
   que ele medir**, não um alvo numérico de testes novos.
5. **Quatro comandos distintos**: `npm run lint`, `npm run typecheck`, `npm test`,
   `npm run build`. Nomear cada gate pelo comando que o produz. Confundir dois deles já custou
   uma arbitragem inteira aqui.
6. **Restrições de autoridade, explícitas**: sem `git push`, sem `gh pr`, sem migration, sem
   `supabase db push`, sem deploy de function, sem CodeRabbit. CodeRabbit transmite código para
   fora e exige autorização do usuário por ocorrência. `git add` e `git commit` locais são
   permitidos ao `@dev`; push não.
7. **Transições de status com o dono de cada uma**: `Draft → Ready` é do `@po`;
   `Ready → InProgress` e `InProgress → InReview` são dele, `@dev`; `InReview → Done` é do
   `@qa`. Ele preenche Dev Agent Record, File List e checkboxes — **nunca** QA Results.
8. **O que fazer ao bloquear e a quem escalar**: a mim, com o ponto exato. Nunca marcar AC como
   satisfeito por aproximação.
9. **Armadilhas de ambiente que valem para ele**, tiradas de
   `.aiox/handoffs/handoff-2026-08-14-importacao-documentos.md` §7 e §8 — em especial que
   `AccountPayable.supplierId` é obrigatório e que boleto/`Deal` têm campos que não saem do
   documento. E o `EPERM` de `.tsbuildinfo`, que deve ser registrado separadamente se ocorrer.

## 6. Riscos que quero endereçados dentro do brief

- **R7, fadiga de revisão.** O escopo da 1.56 é **só cabeçalho** — fornecedor, totais,
  parcelas. Sem itens, sem chips de confiança, sem decisão de custo por item. O AC5 é um AC
  **negativo**: a tela falha se renderizar item. O brief tem de deixar isso impossível de
  confundir, porque a UX documenta a tela completa de itens em §3.6 e o Forge pode implementar
  a mais achando que está ajudando.
- **Atomicidade.** AC8 e AC11: a RPC é a única escrita de domínio e é transacional. A UI não
  pode fazer escrita própria "para completar". Falha = nada gravado, documento original preservado.
- **Cross-tenant.** AC10: `company_id` vem da sessão, nunca de body, URL ou estado editável.
- **Duplo clique e F5.** AC8: uma RPC por confirmação, segunda chamada encontra proposta não
  `pending` e é tratada com segurança.

## 7. Como entregar

Formato da seção 9 do seu charter: objetivo, destinatário, o prompt em bloco, decisões de
design do prompt, riscos, como medir se funcionou.

Grave em: **`.aiox/briefs/forge-story-1.56-ui-revisao-confirmacao.md`**

Responda a mim com o resumo e com as divergências que você encontrou entre o que eu afirmei
aqui e o que está nos arquivos. **Não cole o brief inteiro na resposta** — eu leio o arquivo.

## 8. Desconfie de mim

Tudo na seção 3 eu medi nesta sessão. Confira mesmo assim: caminhos, números de linha, seções
de documento, estado do banco, estado da story. Se algo meu não bater, me avise **antes** de
escrever. Prefiro corrigir a fonte a propagar um erro meu para dentro do executor.

Se faltar informação, pergunte antes de escrever.
