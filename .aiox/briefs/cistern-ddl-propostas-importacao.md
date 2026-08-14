# BRIEF — Escrever o DDL das tabelas de proposta, RLS e RPCs de aplicação da importação inteligente de documentos

**ID:** `cistern-ddl-propostas-importacao`
**Versão:** v1
**De:** Orion (`@aiox-master`)
**Para:** Cistern (`@data-engineer`)
**Natureza:** dados
**Arquivo autoritativo:** `.aiox/briefs/cistern-ddl-propostas-importacao.md`
**Substitui:** nenhum
**Story/epic:** ainda não existe — o epic está sendo escrito pelo Helm em paralelo. Este trabalho é o passo 1 da sequência do ADR e não espera o epic.
**Branch:** `docs/importacao-inteligente-documentos`

---

## 1. Pedido original completo do usuário — OBRIGATÓRIO

Transcrição literal. Não resumi, não corrigi a redação, não cortei nada.

> "preciso da criacao da minha importacao de documentos, cliente joga um documento tipo um pdf, minha ia gestly le os dados, pergunta se pode integrar ao sistema, e se sim integra ao sistema, quero isso funcionando, use o time, o maestri, os agentes aiox e etc"

Esclarecimento posterior dele, que **alterou escopo**:

> "foto nao, e pdf eu pensei em primeiro ser convertido pra markdown ou html, pra sair mais barato pra ia ler. Geralmente vai jogar nfe, xml, pdf,"

Feedback dele sobre **método de delegação**, que é o motivo de este brief ter este formato:

> "ele quer prompts precisos para todos os agentes, explicando bem cada tarefa antes de delegar" — incluindo sempre (1) pedido original completo, (2) objetivo/contexto, (3) escopo do entregável.

**Interpretação necessária:** o usuário disse "pergunta se pode integrar". A arquitetura traduziu isso em **tela de revisão com confirmação por clique**, e não em turno de conversa com a IA. Isso não é liberdade criativa: um PDF é entrada não confiável e pode conter instrução injetada; se o consentimento vier em linguagem natural pelo mesmo canal do documento, o documento passa a controlar o banco. Dois agentes chegaram a essa conclusão de forma independente (Aria no ADR D3, Uma no fluxo de UX). O "pergunta" do usuário está atendido — muda o meio, não a intenção.

Decisões do usuário que fecham escopo (todas dele, registradas em `.aiox/briefs/decisoes-usuario-importacao-documentos.md`):

| Questão | Decisão do usuário |
|---|---|
| Tipos de documento | NF-e, boleto, contrato — em ondas. **Extrato ficou fora** (é conciliação bancária, epic próprio) |
| Foto / PDF escaneado | Fora. Sem OCR, sem visão |
| Direção da NF-e | **Só entrada.** Saída é rejeitada com aviso claro |
| Custo do produto | **Perguntar na tela**, por item: custo atual × custo da nota |
| Contrato comercial | Cria **cliente + oportunidade**, faltantes coletados na tela |
| Rota do PDF | **Opção E agora, A depois:** v1 só XML + boleto por linha digitável colada; PDF via pdf.js no navegador numa onda posterior |

## 2. Objetivo e contexto — OBRIGATÓRIO

**Objetivo:** entregar os **arquivos** de migration e rollback que criam a camada de persistência de propostas de importação — tabelas, RLS, RPCs de aplicação e a dimensão `feature` na contabilidade de uso de IA — sem aplicar nada no banco.

**Por que agora:** é o passo 1 da sequência do ADR (`docs/architecture/ai-document-ingestion-p3.md`, seção "Sequência sugerida"). Todo o resto — rota XML, tela de revisão, rota de boleto — grava ou lê dessas tabelas. Nada avança antes.

**Estado atual verificado** (medi eu mesmo hoje, os comandos estão na seção 4):

- 32 migrations em `supabase/migrations/`, a mais recente `20260812013600_pipeline_stage_reorder_noop.sql`.
- `supabase/rollbacks/` existe e é usado, com convenção `<timestamp>_<nome>.down.sql`.
- A IA hoje é **read-only por invariante estrutural**, não por convenção: `supabase/functions/_shared/ai/tools/registry.ts:45` lança `configuration_error` se `mode !== 'read_only'`.
- As 15 tools existentes passam por RPCs `gestly_*` com `SECURITY INVOKER`, `auth.uid()`, `REVOKE ... FROM anon`, `GRANT ... TO authenticated` (`supabase/migrations/20260725130000_gestly_read_only_tools_p1.sql`). **Esse é o padrão a seguir.**
- Não existe nenhuma tabela bancária, de movimentação ou de conciliação no projeto.

**Relação com o pedido:** "e se sim integra ao sistema" é exatamente a RPC de aplicação que você vai desenhar. Ela é o único ponto onde um dado extraído por IA vira registro do domínio, e ela roda com o JWT do usuário, sob RLS — não com privilégio de serviço.

**Não-objetivos:** não é a Edge Function de extração, não é o parser de NF-e, não é a tela de revisão, não é conciliação bancária.

## 3. Escopo esperado do entregável — OBRIGATÓRIO

**Artefatos:**

1. `supabase/migrations/<timestamp>_document_import_proposals.sql`
2. `supabase/rollbacks/<timestamp>_document_import_proposals.down.sql`
3. `docs/data/document-import-proposals-schema.md` — nota de desenho explicando as escolhas, os trade-offs e o que você decidiu contra

Se você julgar que a mudança em `ai_usage_windows`/`ai_usage_logs` deve ser **migration separada** — e leia a seção 5 antes de decidir, porque acho que deve — entregue o par adicional com nome próprio. Essa decisão é sua.

**Formato:** mesmo padrão das migrations existentes — `BEGIN; ... COMMIT;`, `CREATE TABLE IF NOT EXISTS`, `CHECK` constraints explícitos, comentário de cabeçalho dizendo a que serve.

**Profundidade:** DDL final, pronto para revisão humana. Não é esboço.

**Deve conter:**

- Tabela de **job de extração**: `document_version_id`, `company_id`, categoria, status (`queued`/`running`/`failed`/`done`), `idempotency_key`, erro, timestamps. O desenho é assíncrono por decisão de arquitetura — o job sobrevive a timeout e permite retry.
- Tabela de **proposta**: status (`pending`/`applied`/`rejected`/`expired`), payload extraído, **origem por campo** (determinístico × modelo — a tela precisa mostrar isso), marcação `truncated`, vínculo com o job.
- Tabela ou estrutura de **item de proposta**, com N itens por documento (NF-e multi-item exige), incluindo o campo de **decisão por item** que a QA-2 do usuário criou: custo atual do cadastro × custo da nota, e a escolha dele item a item.
- **Trava de idempotência:** `UNIQUE (company_id, idempotency_key)` na proposta. A chave é a chave de acesso de 44 dígitos da NF-e (valida offline por módulo 11) ou a linha digitável de 47 dígitos do boleto. **Não crie coluna de proveniência em tabela do domínio** — a trava mora na proposta justamente para não poluir `purchases` e `account_payables`.
- **RLS em todas as tabelas novas**, com o padrão já provado no projeto.
- **RPCs de aplicação**, `SECURITY INVOKER`, `auth.uid()`, `REVOKE ... FROM anon`, `GRANT ... TO authenticated`. Uma por tipo de documento, ou uma genérica — sua decisão, justifique.
- **Dimensão `feature`** em `ai_usage_windows` e `ai_usage_logs`, para que uma importação não consuma a janela de quota do chat da empresa. **Leia a seção 5 antes de escrever uma linha disso.**

**Fora do entregável:**

- Aplicar qualquer migration (ver seção 7 — isto é absoluto).
- Código TypeScript, Edge Function, parser, componente de UI.
- Alterar `purchases`, `account_payables`, `products`, `customers`, `deals`, `suppliers`.
- Criar a categoria `extrato_bancario` — está **suspensa** por decisão do usuário até o epic de conciliação existir.

**Definição de pronto:** os arquivos existem, o `.down.sql` reverte o `.sql` integralmente, a nota de desenho explica as escolhas, e você me reportou no formato da seção 13 sem ter tocado no banco.

## 4. Fontes de verdade e contexto verificado

| Afirmação | Fonte exata | Estado medido por mim | Como você reverifica |
|---|---|---|---|
| IA é read-only por invariante | `supabase/functions/_shared/ai/tools/registry.ts:45` | lança `configuration_error` se `mode !== 'read_only'` | ler o arquivo |
| Padrão de RPC segura do projeto | `supabase/migrations/20260725130000_gestly_read_only_tools_p1.sql` | `SECURITY INVOKER` + `auth.uid()` + `REVOKE`/`GRANT` | `grep -n "SECURITY INVOKER" nesse arquivo` |
| `AccountPayable.supplierId` é **obrigatório** | `src/types/index.ts:336-349` | obrigatório, não opcional | ler o arquivo |
| `Purchase` não tem chave de acesso nem nº de documento | `src/types/index.ts:294-309` | ausentes | ler o arquivo |
| `Deal` exige `customerId`, `ownerId`, `stageId`, **`title` e `value`** | `src/types/index.ts:444-462` | cinco obrigatórios | ler o arquivo |
| `rollbacks/` existe e é convenção viva | `supabase/rollbacks/` | 8+ arquivos `.down.sql` | `ls supabase/rollbacks/` |
| `ai_usage_windows` tem UNIQUE de 5 colunas | `supabase/migrations/20260725120000_ai_secure_gateway.sql:74` | `UNIQUE (company_id, scope, subject_id, window_start, window_seconds)` | ler a linha |

**Regra:** este brief não é prova. Reverifique por conta própria tudo que sustentar sua decisão — inclusive o que eu afirmo ter medido. Se divergir do que escrevi, o código ganha e eu quero saber.

## 5. A armadilha da dimensão `feature` — leia antes de escrever o DDL

Investiguei isso hoje porque `ALTER TABLE ... ADD COLUMN feature` parece trivial e **não é**. São três fatos encadeados, todos verificados por mim:

**Fato 1 — a definição de `reserve_ai_usage` que está no repositório não é a que está no banco.**
A migration `supabase/migrations/20260725123000_fix_ai_usage_conflict.sql` reescreve a função **em tempo de execução**: ela lê `pg_get_functiondef()`, faz um `replace()` de string trocando `ON CONFLICT (company_id, scope, subject_id, window_start, window_seconds) DO NOTHING` por `ON CONFLICT DO NOTHING`, e dá `EXECUTE` no resultado (linhas 9-35). Ou seja: `20260725120000_ai_secure_gateway.sql:339,346` mostra a cláusula nomeada, mas **em produção ela é a genérica**. Ler os arquivos de migration dá o retrato errado do que está vivo. Confirme com `pg_get_functiondef` no banco antes de assumir qualquer coisa.

**Fato 2 — o `ON CONFLICT DO NOTHING` genérico esconde a quebra em vez de mostrá-la.**
Uma cláusula nomeada falharia alto se a constraint mudasse. A genérica não infere constraint nenhuma: ela absorve qualquer conflito calado. Se você acrescentar `feature` ao `UNIQUE`, o `INSERT` continua "funcionando" — sem erro, sem aviso.

**Fato 3 — e aí o `SELECT` seguinte lê a linha errada.**
`20260725120000_ai_secure_gateway.sql:350-366` faz `SELECT * INTO v_company_window ... FOR UPDATE` filtrando por `company_id`, `scope`, `subject_id`, `window_start`, `window_seconds` — **sem `feature`, sem `LIMIT`**. Com `feature` na chave, passa a existir mais de uma linha para esse filtro. `SELECT INTO` sem `STRICT` em PL/pgSQL **pega a primeira linha e segue em silêncio**. O rate limit passaria a ler o contador de uma feature arbitrária, e o `FOR UPDATE` mudaria de escopo de lock.

**A consequência:** o limite de quota erraria sem levantar exceção nenhuma. É o mesmo tipo de bug do fator de vencimento do boleto — número plausível, silenciosamente errado. Nunca aparece em teste que só verifica "não deu erro".

**O que eu quero de você, e é decisão sua qual caminho:**

- Acrescentar `feature` exige **reescrever `reserve_ai_usage` por inteiro**, com a coluna no `INSERT`, na cláusula de conflito e em **todos** os `SELECT ... FOR UPDATE`. Não é `ALTER TABLE`.
- Verifique também `20260725130000_gestly_read_only_tools_p1.sql:523-541`, que faz `UPDATE` casando a mesma chave de cinco colunas. Se ficar sem `feature`, atualiza a linha errada.
- Decida o **backfill**: as linhas existentes precisam de um valor. Sugiro `'chat'` como default e `NOT NULL`, mas o desenho é seu.
- Considere seriamente entregar isso como **migration separada** da criação das tabelas de proposta. As tabelas novas não têm risco de regressão; mexer no caminho de rate limit do chat em produção tem. Separadas, o usuário pode autorizar uma sem autorizar a outra. Se você discordar, me diga por quê.

**Se concluir que a dimensão `feature` não vale o risco agora** e que há alternativa melhor — tabela de contabilidade própria da importação, por exemplo — **não a implemente por conta própria: me traga a comparação.** O ADR pediu `feature`; se a evidência contrariar o ADR, quem decide é o usuário, e eu levo.

## 6. Contratos fechados e liberdades declaradas

**Contratos fechados — não reinterpretar:**

- A IA **nunca** escreve no domínio. Grava proposta `pending`; a escrita acontece na RPC de aplicação chamada pela confirmação humana (ADR D2).
- A RPC de aplicação é `SECURITY INVOKER`, com o JWT do usuário, sob RLS. **Nunca `SECURITY DEFINER`** para escrita de domínio vinda de proposta.
- Idempotência mora na proposta, não no domínio (ADR D8).
- Sem categoria `extrato_bancario`.

**Decisões que são suas, e eu não vou palpitar:**

- Número, nome e granularidade das tabelas.
- Se a RPC de aplicação é uma por tipo ou genérica com discriminador.
- Tipos das colunas, uso de `JSONB` versus colunas tipadas, estratégia de índice.
- Como modelar origem por campo e a decisão de custo por item.
- Enum nativo versus `TEXT` + `CHECK` (veja o que o projeto já faz e seja coerente).
- Separar ou não a migration de `feature`.

**Questões abertas que não bloqueiam:**

- Teto de itens por proposta — o número sai de protótipo depois; deixe a coluna e o `CHECK` parametrizáveis.
- Política de expiração de proposta `pending` — proponha, registre como recomendação.

**Questões que bloqueiam:**

- Se a reescrita de `reserve_ai_usage` não puder ser feita com segurança: pare **só essa parte**, entregue as tabelas de proposta, e me escale com evidência.

## 7. Fronteiras duras e autoridade

**Pode tocar:**

- `supabase/migrations/` — criar arquivos novos
- `supabase/rollbacks/` — criar arquivos novos
- `docs/data/` — criar a nota de desenho

**Não pode tocar:**

- Qualquer migration já existente (são histórico aplicado; corrige-se com migration nova)
- `src/` — nenhum arquivo
- `supabase/functions/` — nenhum arquivo
- `docs/architecture/ai-document-ingestion-p3.md` — é da Aria; leia, não edite
- `git push`, `gh pr create` — exclusivos do Anchor (`@devops`)

**Proprietários de artefato:**

| Artefato | Dono | Sua ação |
|---|---|---|
| ADR `ai-document-ingestion-p3.md` | Aria (`@architect`) | ler |
| Fluxo de UX `importacao-inteligente-documentos-fluxo-ux.md` | Uma (`@ux-design-expert`) | ler |
| Gate e QA Results | Beacon (`@qa`) | nenhuma |
| Story/epic | Loom (`@sm`) / Helm (`@pm`) | nenhuma |
| Migrations e rollbacks novos | **você** | criar |

**EXIGE APROVAÇÃO HUMANA EXPLÍCITA — e este é o ponto mais importante deste brief:**

> **Você escreve a migration. Você NÃO aplica.**
>
> Nada de `supabase db push`, `supabase migration up`, `psql`, `execute_sql`, `apply_migration`, MCP de Supabase ou qualquer caminho que chegue ao banco. **Inclusive migration no-op.** Isso é NFR-2 do projeto e não tem exceção.
>
> Autorização anterior não vale para esta execução. Ausência de autorização é "não autorizado". Se em algum momento parecer que aplicar é necessário para validar, **pare e me chame** — eu levo ao usuário, uma a uma.

Se precisar validar sintaxe, use análise estática ou um banco descartável local que você mesmo suba, **nunca** o projeto Supabase remoto — e me diga no relatório o que usou.

## 8. Baselines e gates numéricos

| Gate | Comando/evidência | Baseline | Alvo |
|---|---|---:|---:|
| Migrations existentes | `ls supabase/migrations/ \| wc -l` | **32** | 32 + as novas, nenhuma existente alterada |
| Rollback correspondente | `ls supabase/rollbacks/` | 1 `.down.sql` por migration nova | 100% |
| Tabelas do domínio alteradas | inspeção do DDL | **0** | **0** |
| Migrations aplicadas nesta execução | — | **0** | **0** |
| Decisões de desenho registradas | nota em `docs/data/` | 0 | todas, com trade-off |

Se não conseguir medir um baseline, registre `DESCONHECIDO` e explique. **Não assuma zero.**

## 9. Métodos proibidos e substitutos

| Não usar | Usar no lugar | Motivo |
|---|---|---|
| `git stash` + `git stash pop` | `git worktree add --detach <path> <commit>` | stash prende trabalho não commitado se a comparação falhar |
| Ler o arquivo de migration para saber a definição viva de `reserve_ai_usage` | `pg_get_functiondef` no banco | a função foi reescrita em runtime — ver seção 5, Fato 1 |
| `ALTER TABLE` isolado para `feature` | reescrita completa da função + constraint + backfill | ver seção 5, Fatos 2 e 3 |
| Confiar em "não deu erro" como validação de quota | teste que confere o **número** do contador | a falha desta área é silenciosa por construção |

## 10. Critérios de aceitação

| ID | Critério falsificável | Verificação | Esperado |
|---|---|---|---|
| AC-1 | Nenhuma migration foi aplicada | seu relatório + ausência de chamada a ferramenta de banco | zero |
| AC-2 | Toda migration nova tem `.down.sql` que a reverte | `ls supabase/rollbacks/` | 1:1 |
| AC-3 | Nenhuma tabela de domínio alterada | leitura do DDL | zero `ALTER` em `purchases`, `account_payables`, `products`, `customers`, `deals`, `suppliers` |
| AC-4 | RLS habilitada em toda tabela nova | `grep "ENABLE ROW LEVEL SECURITY"` no DDL | 1 por tabela nova |
| AC-5 | RPC de aplicação é `SECURITY INVOKER` | `grep "SECURITY DEFINER"` no DDL | nenhuma RPC de escrita de domínio como DEFINER |
| AC-6 | Trava de idempotência existe na proposta | `grep "idempotency_key"` | `UNIQUE (company_id, idempotency_key)` |
| AC-7 | Se `feature` foi adicionada, `reserve_ai_usage` foi reescrita por inteiro | leitura do DDL | função completa, não `ALTER` avulso |
| AC-8 | Nenhuma migration existente foi modificada | `git status --short supabase/migrations/` | só arquivos novos |

## 11. Bloqueios, escalada e aprovações

- Ao bloquear: não invente, preserve o que já está válido, reporte a mim.
- Informe ponto exato, evidência, impacto, o que tentou e a menor decisão necessária.
- Continue nas partes independentes do bloqueio.
- **Não fale com outro agente.** Eu coordeno dependências. Se precisar de algo da Aria, do Helm ou da Uma, peça a mim.
- Se algo exigir humano, **pare antes da ação** e me peça a autorização.

## 12. Formato do retorno a Orion

1. Resultado em uma frase.
2. Caminhos exatos dos arquivos criados.
3. Baseline × resultado de cada gate da seção 8, com o comando que produziu cada um.
4. Decisões que você tomou dentro da liberdade delegada, com o porquê.
5. O que você **reverificou** deste brief e onde eu estava errado, se estive.
6. Sua conclusão sobre a dimensão `feature`: reescreveu, separou em migration própria, ou está me escalando alternativa.
7. Questões abertas, riscos, bloqueios.
8. Confirmação explícita: **nenhuma migration aplicada**.

## 13. Recomendações fora do pedido

Se identificar melhorias não pedidas — coluna de chave de acesso em `purchases` para rastreabilidade fiscal, por exemplo, que a Aria já levantou como recomendação — registre em seção separada e claramente marcada. **Não implemente sem nova decisão minha ou do usuário.** Artigo IV da Constitution: nada de invenção fora do pedido.
