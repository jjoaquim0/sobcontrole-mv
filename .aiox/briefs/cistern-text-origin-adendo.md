# BRIEF — Acrescentar `text_origin` à migration de propostas, antes que ela seja aplicada

**ID:** `cistern-text-origin-adendo`
**Versão:** v1
**De:** Orion (`@aiox-master`)
**Para:** Cistern (`@data-engineer`)
**Natureza:** dados — adendo à entrega de hoje
**Arquivo autoritativo:** `.aiox/briefs/cistern-text-origin-adendo.md`
**Complementa:** `.aiox/briefs/cistern-ddl-propostas-importacao.md` — todas as fronteiras e restrições daquele brief continuam valendo **na íntegra**, e estão repetidas na seção 5 aqui para você não precisar voltar lá.

---

## 1. Pedido original completo do usuário — OBRIGATÓRIO

Transcrição literal, sem corte:

> "preciso da criacao da minha importacao de documentos, cliente joga um documento tipo um pdf, minha ia gestly le os dados, pergunta se pode integrar ao sistema, e se sim integra ao sistema, quero isso funcionando, use o time, o maestri, os agentes aiox e etc"

Esclarecimento posterior dele, que alterou escopo:

> "foto nao, e pdf eu pensei em primeiro ser convertido pra markdown ou html, pra sair mais barato pra ia ler. Geralmente vai jogar nfe, xml, pdf,"

**E a decisão dele que origina este adendo**, tomada em 2026-08-14 sobre cinco opções de rota de PDF que eu levei a ele com custo e trade-off:

> **"XML agora, PDF no navegador depois."**

Ou seja: a v1 é XML determinístico + linha digitável de boleto; numa onda posterior, o PDF será convertido em texto **no navegador do cliente**, via pdf.js — não no servidor.

## 2. Objetivo e contexto — OBRIGATÓRIO

**Objetivo:** acrescentar uma coluna `text_origin` à tabela de proposta, **na migration que você acabou de escrever e que ainda não foi aplicada**.

**Por que agora, e este é o ponto todo:** o `@architect` levantou que, se o schema de proposta já estivesse congelado, `text_origin` viraria uma migration adicional lá na onda 5. Ele mandou isso para a minha fila supondo que o schema já estava fechado.

**Não está.** Verifiquei: **nenhuma das suas duas migrations foi aplicada** — nem `20260814100000`, nem `20260814101500`. Elas existem como arquivo e esperam autorização do usuário. Enquanto isso for verdade, acrescentar uma coluna é **de graça**: edita-se o arquivo e o rollback, e nunca existe uma segunda migration.

Se eu deixar passar, o custo vira migration + rollback + revisão + mais uma autorização do usuário, numa onda futura. A janela é hoje.

**A razão de existir da coluna, que é de segurança e não de conveniência:** a partir da onda 5, o texto do PDF passa a ser produzido **no navegador do cliente**, num ambiente que o servidor não controla e não consegue reconferir contra o arquivo guardado. Isso enfraquece a trilha de auditoria — e é uma consequência que o usuário conhecia quando decidiu, porque estava escrita no texto da opção A que eu levei a ele. A salvaguarda é declarar a origem do texto na proposta, para que a tela de revisão avise o revisor de que ele está conferindo contra texto que o servidor não pode validar.

Registrado no ADR como **R10** (`docs/architecture/ai-document-ingestion-p3.md:342`) e na proposta de salvaguarda da linha 258.

**Não-objetivos:** não é implementar a onda 5, não é mexer na rota XML, não é tela.

## 3. Escopo esperado do entregável — OBRIGATÓRIO

**Artefatos — os dois arquivos que você já escreveu, editados:**

1. `supabase/migrations/20260814100000_document_import_proposals.sql`
2. `supabase/rollbacks/20260814100000_document_import_proposals.down.sql`

Se você concluir que a coluna pertence a outra das três tabelas, ou a mais de uma, **a decisão é sua** — você desenhou o schema e conhece a granularidade melhor que eu.

**Deve conter:**

- Coluna que declare a origem do texto que alimentou a extração. Valores previstos hoje: **servidor** e **cliente/navegador**. Rota XML e linha digitável não passam por conversão de texto — decida se ficam nulas, se ganham valor próprio, ou se o domínio de valores é maior que dois. **É desenho seu.**
- Coerência com o padrão do projeto: `TEXT` + `CHECK` versus enum nativo — siga o que você já fez nas outras colunas do mesmo arquivo, não o que eu acharia.
- O rollback correspondente atualizado.
- Uma linha na sua nota em `docs/data/` explicando por que a coluna existe e que ela só passa a ser preenchida com valor de cliente a partir da onda 5.

**Fora do entregável:**

- **Aplicar qualquer migration.** Ver seção 5.
- Mexer em `20260814101500_ai_usage_feature_dimension.sql` — não tem relação.
- Lógica de preenchimento, validação de origem, código, tela.

**Definição de pronto:** os dois arquivos e a nota atualizados, e você me reportou.

## 4. O que verifiquei por conta própria

| Afirmação | Como medi | Resultado |
|---|---|---|
| Nenhuma migration aplicada | inspeção; nenhum caminho ao banco usado por ninguém nesta sessão | confirmado |
| Seus 4 arquivos existem e estão pareados | `ls supabase/migrations/ supabase/rollbacks/` | 2 migrations, 2 rollbacks |
| Zero `ALTER` em tabela de domínio | `grep -inE "ALTER TABLE .*(purchases\|account_payables\|products\|customers\|deals\|suppliers)"` | nenhum |
| RLS em toda tabela nova | `grep -c` | 3 tabelas, 3 `ENABLE ROW LEVEL SECURITY` |
| Os 2 `SECURITY DEFINER` não são violação | comparação com `20260725120000:164` e `:439` | são as reescritas de `reserve_ai_usage` e `finalize_ai_usage`, que **já eram** DEFINER, com o mesmo `SET search_path` |
| R10 e a salvaguarda estão no ADR | leitura | `ai-document-ingestion-p3.md:258` e `:342` |

**Sobre a sua entrega de hoje, e digo porque é merecido:** separar a migration de `feature` da de propostas foi a decisão certa, e você ainda pegou `finalize_ai_usage`, que eu não tinha apontado no brief — eu só tinha visto `reserve_ai_usage` e os `UPDATE` do `gestly_read_only_tools_p1`. E a honestidade sobre não ter banco descartável no ambiente, documentando os comandos que a revisão humana deve rodar, é exatamente o que eu quero de um relatório.

**Este brief não é prova.** Reverifique o que sustentar sua decisão, inclusive o que afirmo ter medido.

## 5. Fronteiras duras — repetidas por inteiro, de propósito

**Pode tocar:** os dois arquivos da seção 3 e sua nota em `docs/data/`.

**Não pode tocar:** `src/` · `supabase/functions/` · qualquer migration anterior a hoje · `docs/architecture/` (do `@architect`) · `docs/epics/` (do `@pm`) · `docs/ux/` (do `@ux-design-expert`) · gate e QA Results (**exclusivos do `@qa`**) · `git push` e `gh pr create` (**exclusivos do `@devops`**).

**EXIGE APROVAÇÃO HUMANA EXPLÍCITA — inalterado e absoluto:**

> **Você edita a migration. Você NÃO aplica.**
>
> Nada de `supabase db push`, `supabase migration up`, `psql`, `execute_sql`, `apply_migration` ou MCP de Supabase. **Inclusive no-op.** NFR-2, sem exceção.
>
> Autorização anterior não vale para esta execução. Ausência de autorização é "não autorizado". Se aplicar parecer necessário para validar, **pare e me chame.**

**Não fale com outro agente.** Se precisar de algo do `@architect`, peça a mim.

## 6. Se você discordar

Se na sua avaliação `text_origin` **não** deve entrar agora — porque é especulativo para uma onda distante, ou porque polui a tabela, ou por qualquer motivo que eu não enxerguei — **não acrescente e me diga o motivo.** A janela barata é um argumento a favor, não uma ordem. Prefiro a coluna fora com bom motivo do que dentro por inércia minha.

## 7. Retorno

1. Resultado em uma frase.
2. O que mudou, em qual tabela e por quê.
3. Domínio de valores que escolheu e como tratou XML e linha digitável.
4. Confirmação de que o rollback acompanha.
5. Se discordou, o motivo.
6. Confirmação explícita: **nenhuma migration aplicada.**
