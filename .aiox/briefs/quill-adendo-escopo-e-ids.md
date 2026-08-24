# Adendo ao brief `quill-briefs-onda2-onda3.md` — correções antes de escrever

**De:** Orion (`@aiox-master`) · **Para:** Quill · **Data:** 2026-08-22
**Este adendo corrige o brief anterior. Onde houver conflito, o adendo vence.**

---

## 1. Você estava certo sobre os IDs. Eu estava errado.

Confirmei na fonte: `docs/epics/epic-pipeline-vendas-avancado.md` reserva **1.37 a 1.54**, com dependências explícitas (linha 118: `1.45` depende de `1.37`; linha 129: `1.50` depende de `1.37`). Eu olhei só os arquivos existentes em `docs/stories/` e não os epics que reservam faixa. Erro meu, você pegou porque leu a fonte antes de escrever.

**Confirmado: use `1.55` e `1.56`.**

Mantenha os nomes de arquivo pedidos na seção 7 do brief original, ajustando o número:
- `.aiox/briefs/loom-stories-1.55-1.56.md`
- `.aiox/briefs/forge-story-1.55-parser-xml-nfe.md`

## 2. O escopo mudou — decisão do usuário, tomada agora

O coorquestrador (Vega) analisou o plano e concluiu que Ondas 2+3 completas não cabem hoje "sem transformar QA e consentimento em fachada". Verifiquei os bloqueios dele por conta própria e **os três procedem**:

- A RPC de aplicação aceita `update_cost_decision = 'pending'` e **aplica a proposta mesmo assim** (DDL `20260814100000`, linha 483: só age em `'update'`). A UI pode bloquear; o servidor não garante a decisão humana.
- **Não existe XSD no repositório.** O ADR (`ai-document-ingestion-p3.md:72`) exige validação XSD como camada estrutural. Confirmei: nenhum `.xsd` no projeto.
- O **teto de itens é requisito sem número**: o ADR (linha 122) diz que "o teto de itens por proposta deixa de ser precaução e vira requisito"; o UX `§3.6.5` diz literalmente *"Sem propor o número"*. A story não pode inventar 30.

**O usuário escolheu o corte. Escopo de hoje:**

> **Piloto de importação de cabeçalho de NF-e XML.** Upload de um XML por vez; validação estrutural, chave de acesso (módulo 11) e direção; revisão editável de **fornecedor, totais e parcelas**; tela de resumo; confirmação atômica criando/vinculando **fornecedor, compra e contas a pagar**. Banner explícito na tela: **itens, produtos e estoque não serão importados**.

**Declaradamente fora de escopo hoje, e os briefs devem dizer isso com todas as letras:** PDF, qualquer chamada a IA, criação ou vínculo de produtos, atualização de estoque, decisão de custo item a item, chips de confiança, revisão de 5-30 itens, validação XSD.

## 3. O corte NÃO é invenção — e isso é o ponto mais importante deste adendo

Não estamos inventando um modo degradado para caber no dia. **A Uma já desenhou exatamente este comportamento** como o estado "acima do teto de itens", em `docs/ux/importacao-inteligente-documentos-fluxo-ux.md` `§3.6.5` (linha 161) e no wireframe da linha 291:

> *"Fornecedor, compra e contas a pagar continuam sendo criados normalmente — não dependem dos itens. Um aviso declara o corte... 'Esta nota tem [N] itens, acima do que revisamos automaticamente aqui. Fornecedor e contas a pagar foram lançados; os produtos não foram adicionados ao estoque — lance-os manualmente.' Nenhum produto é criado ou vinculado sem revisão acima do teto; a degradação corta a automação do estoque, nunca a integridade dos outros dados."*

**Escreva os briefs ancorando o piloto nesse parágrafo, citando `§3.6.5` pelo caminho e pela linha.** Isso mantém o Artigo IV (No Invention) intacto: o comportamento vem de artefato de UX aprovado, não de decisão nossa. O wireframe da linha 291 já mostra o que aparece no lugar da tabela de itens — o executor deve segui-lo.

## 4. Baseline — eu medi, use estes números

Medi os quatro gates hoje, separadamente, cada um pelo comando que o produz. **Confira por conta própria** (você já estava medindo), mas estes são os meus números:

| Gate | Comando | Hoje | Tipo de gate |
|---|---|---|---|
| Test | `npm test` | **510 passam / 0 falham** (58 arquivos) | **Duro** — 0 falhas, sempre |
| Build | `npm run build` | **PASS** | **Duro** — continua PASS |
| Typecheck | `npm run typecheck` | **24 erros** | **Não-regressão** — não subir de 24 |
| Lint | `npm run lint` | **276 erros, 2 warnings** | **Não-regressão** — não subir de 276 |

**Este ponto é obrigatório nos dois briefs:** o lint do projeto **não passa hoje**, apesar do `--max-warnings 0`. Um brief que exigir "lint limpo" manda o Forge consertar 276 erros alheios no meio da feature. O critério correto é **não regredir**, e o brief precisa dizer isso explicitamente para o executor não se perder — e para o Beacon não reprovar por débito que não é da story.

Você já viu isso na sua medição: os 2 `EPERM` de `.tsbuildinfo` no primeiro `typecheck` eram limitação de sandbox, não dívida de código. Registre a distinção no brief — é exatamente o tipo de confusão entre checks que já custou uma arbitragem inteira aqui.

## 5. Estado do banco — mudou desde o brief original

Quando você mediu, a migration ainda não tinha sido aplicada e você registrou isso corretamente. **Mudou:** a Cistern aplicou durante a sua execução. Verifiquei pessoalmente no banco depois:

- As 3 tabelas existem e estão **vazias**: `document_extraction_jobs`, `document_import_proposals`, `document_import_proposal_items`
- **RLS habilitada nas 3/3**
- Trava `UNIQUE (company_id, idempotency_key)` **testada sob inserção real** pela Cistern, com o resíduo do teste limpo
- Coluna `text_origin` presente

**Mantenha mesmo assim a instrução de reverificação no brief do Forge** — ele deve confirmar a existência das tabelas antes de codar contra elas, não aceitar de mim nem de você.

## 6. Restrição nova e dura: `supabase db push` está proibido

A migration foi registrada no banco com timestamp **`20260822182249`**, não com o do arquivo (`20260814100000`), porque foi aplicada via MCP e não via CLI. Consequência: o CLI não reconhece a migration do repositório como aplicada e **tentaria reaplicá-la**, falhando nas policies e RPCs que já existem.

Os dois briefs devem carregar: **ninguém roda `supabase db push` até essa divergência ser reconciliada.** A reconciliação é mutação externa e exige autorização própria do usuário — não é algo que o executor resolve sozinho.

## 7. Sua observação sobre `service_role` — incorpore

Você registrou que a Edge Function assíncrona grava jobs/propostas com `service_role` enquanto leitura e autorização devem permanecer sob JWT/RLS. Está certo e é material. Leve ao brief do Forge como você propôs: **prova negativa cross-tenant antes de qualquer gravação privilegiada, e zero confiança em `company_id` vindo do payload.**

## 8. O que fazer agora

Escreva os dois briefs com as correções acima e me responda só com o resumo. Se qualquer coisa neste adendo não bater com o que você mediu, **me avise antes de escrever** — você já acertou uma vez hoje contra mim, e prefiro corrigir a fonte a propagar erro meu para dois agentes.
