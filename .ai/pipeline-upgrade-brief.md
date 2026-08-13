# Brief — Evolução do Módulo Pipeline de Vendas (SobControle)

> Documento de contexto compartilhado. Orquestrado por @aiox-master (Orion) via Maestri.
> Data: 2026-08-12. Base: commit `11fda03` (main, working tree limpa).

## 1. Decisão do usuário

O usuário pediu para "melhorar a pipeline do site, com mais opções, algo bem top".
Escopo aprovado explicitamente: **as 4 frentes abaixo, todas**.
Método aprovado: **Epic completo AIOX (SDC)** — @pm epic → @architect/@data-engineer design → @sm stories → @po validação → @dev implementação → @qa gate.

## 2. Estado atual do módulo (levantado por Orion)

### Arquivos
| Caminho | Papel |
|---|---|
| `src/pages/pipeline/PipelinePage.tsx` | Página principal, kanban com `@dnd-kit`, 4 StatCards, filtros, DnD |
| `src/pages/pipeline/components/PipelineColumn.tsx` | Coluna (etapa) |
| `src/pages/pipeline/components/DealCard.tsx` | Card do negócio + `DealCardOverlay` |
| `src/pages/pipeline/components/DealModal.tsx` | Modal criar/editar/ganhar/perder/excluir |
| `src/hooks/usePipeline.ts` | `usePipelineStages`, `useDeals`, `useDealHistory`, `useDealMutations` (React Query) |
| `src/services/dealsService.ts` | Acesso Supabase + mapeamento snake_case→camelCase |
| `src/types/index.ts` | `PipelineStage`, `Deal`, `DealStageHistoryEntry`, `DealStatus` |
| `supabase/migrations/20260705000000_sales_pipeline_module_schema.sql` | Schema original (Story 1.3) |
| Stories anteriores | `1.3.sales-pipeline`, `1.9.pipeline-delete-and-stage-automove` |

### Schema atual
- **`pipeline_stages`**: `id, company_id, name, color, position (DOUBLE PRECISION), is_active, created_at, updated_at`
- **`deals`**: `id, company_id, title, customer_id, owner_id, stage_id, value NUMERIC(12,2), status ('open'|'won'|'lost'), expected_close_date DATE, position DOUBLE PRECISION, notes, lost_reason, closed_at, created_at, updated_at`
- **`deal_stage_history`**: `id, deal_id, from_stage_id, to_stage_id, changed_by, changed_at`
- RLS multi-tenant em todas: `company_id = get_user_company_id()`; `REVOKE ALL ... FROM anon`.
- `position` é `DOUBLE PRECISION` de propósito: reordenação por ponto médio (1 e 2 → 1.5) sem renumerar a coluna. **Preservar essa decisão.**
- Seed de 5 etapas padrão (Novo Contato, Qualificação, Proposta Enviada, Negociação, Fechamento) tanto para empresas existentes quanto via `complete_company_signup()`.

### O que já funciona
Kanban drag-and-drop com rollback otimista, filtros (busca/responsável/etapa), StatCards (oportunidades, valor, ticket médio, atrasadas), ganhar/perder com motivo, histórico de etapas, exclusão com confirmação.

## 3. Lacunas identificadas (motivam o epic)

1. **Etapas não são configuráveis pela UI.** `PipelinePage.tsx` literalmente exibe *"Entre em contato com o suporte para configurá-las"* quando não há etapas. Não existe CRUD de etapas em lugar nenhum. É o buraco mais grave.
2. **Só existe a visão kanban de `status='open'`.** `getDeals()` filtra `status='open'` por padrão; negócios ganhos e perdidos ficam invisíveis no módulo.
3. **Zero inteligência.** Sem probabilidade por etapa, forecast ponderado, taxa de conversão etapa a etapa, tempo médio em etapa, detecção de negócios estagnados, análise de motivos de perda, ranking de responsáveis.
4. **Deal é uma ilha.** Não converte em venda (módulo `sales` existe), não tem atividades/tarefas, não vincula produtos (módulo `inventory` existe), não cria compromisso na agenda (módulo `agenda` existe com `Appointment.dealId` já previsto!), não usa o e-mail transacional recém-criado (Story 1.34).
5. **Escala.** Busca é client-side (`getDeals` filtra em JS após buscar tudo), sem paginação nem virtualização. Degrada com volume.
6. **`updateDeal()` não grava `stage_id`** — contornado na página com uma chamada extra a `moveDeal` (ver comentário em `PipelinePage.tsx:98-102`). Dívida técnica a resolver.

## 4. As 4 frentes aprovadas

### Frente A — Configuração de etapas
CRUD de etapas na UI (criar, renomear, reordenar, cor, arquivar), probabilidade % por etapa, limite WIP por etapa, campos obrigatórios para avançar, etapas de ganho/perda customizadas.

### Frente B — Visões e produtividade
Visão lista/tabela e timeline além do kanban, aba de Ganhos/Perdidos, agrupamento por responsável, ordenação, filtros salvos, seleção múltipla e ações em massa.

### Frente C — Inteligência e forecast
Forecast ponderado por probabilidade, taxa de conversão etapa a etapa (gráfico de funil), tempo médio por etapa, negócios estagnados, ranking de responsáveis, análise de motivos de perda.

### Frente D — Ações e integrações
Atividades/tarefas dentro do negócio, converter negócio ganho em venda, vincular produtos ao deal, criar compromisso na agenda, enviar e-mail pelo módulo da Story 1.34, timeline rica de eventos.

## 5. Restrições inegociáveis

- **Multi-tenant.** Toda tabela nova precisa de `company_id` + RLS `= get_user_company_id()` + `REVOKE ALL FROM anon`. Nenhuma query pode confiar em `company_id` vindo do frontend.
- **Migrations exigem aprovação manual** (ver commit `d8d8a47`). Escrever a migration e o rollback correspondente em `supabase/rollbacks/`, mas **não aplicar** sem autorização explícita.
- **Compatibilidade.** Empresas existentes já têm etapas e negócios. Toda coluna nova precisa de default seguro; nenhuma migration pode quebrar dados existentes.
- **Padrões do repo.** React Query para estado servidor, `sonner` para toast, Tailwind com dark mode (`dark:`), verde da marca `#10b981`, componentes compartilhados em `src/components/shared/`, testes com Vitest ao lado do arquivo.
- **Artigo IV (No Invention).** Toda decisão precisa rastrear a este brief, a um FR/NFR do epic ou a código existente. Não inventar requisito.
- **Baseline legado.** `npm run lint` e `npm run typecheck` globais já falham por dívida anterior à Story 1.34. Validar de forma focada nos arquivos tocados.

## 6. Papéis nesta orquestração (terminais Maestri)

| Terminal | Agente | Responsabilidade |
|---|---|---|
| Helm | @pm | Epic, FRs/NFRs, sequenciamento |
| Lantern | @analyst | Benchmark de CRMs, priorização |
| Compass | @architect | Arquitetura, camadas, estado, performance |
| Cistern | @data-engineer | Migrations, RLS, índices |
| Prism | @ux | Especificação de UX das novas visões |
| Loom | @sm | Redação das stories |
| Ledger | @po | Validação das stories (10 pontos) |
| Forge | @dev | Implementação |
| Beacon | @qa | Quality gate |
| Anchor | @devops | Push/PR (exclusivo) |
