# Arquitetura — Evolução do Pipeline de Vendas

> **Status:** Draft
> **Owner:** @architect (Aria)
> **Data:** 2026-08-12
> **Fontes:** `.ai/pipeline-upgrade-brief.md`, `docs/epics/epic-pipeline-vendas-avancado.md` (FR-1 a FR-27, NFR-1 a NFR-8)
> **Fora deste documento:** DDL detalhado, índices, RPCs (responsabilidade de @data-engineer, em paralelo). Este documento define contratos, camadas e decisões que o schema precisa suportar — não o schema em si.

---

## 0. Como ler este documento

Cada seção termina com uma tabela **Decisão / Justificativa / Rastreio** ligando a escolha ao FR/NFR ou ao código existente (Artigo IV). Seção 7 lista trade-offs descartados.

---

## 1. Abstração de visões (FR-9)

### Problema

Hoje `PipelinePage.tsx` mistura em um único componente: estado de filtro, busca de dados (`useDeals`/`usePipelineStages`), DnD (`@dnd-kit`), cálculo de `summary`, e renderização do kanban. FR-9 pede lista/tabela e timeline além do kanban — se cada visão duplicar filtro+busca+summary, qualquer mudança de filtro (FR-13, FR-15) precisa ser replicada 3x.

### Decisão: página "casca" + hook de coleção compartilhado + visões plugáveis

```
PipelinePage.tsx (casca)
├── usePipelineView()          ← estado de visão (URL) + filtros (URL)
├── usePipelineCollection()    ← dados: stages, deals paginados, summary — comum às 3 visões
├── <PipelineToolbar>          ← busca, filtros, filtros salvos, seletor de visão
├── <PipelineStatCards>        ← summary (hoje inline em PipelinePage)
└── visão ativa (switch):
    ├── <PipelineKanbanView>   ← DndContext + PipelineColumn + DealCard (código atual, extraído)
    ├── <PipelineListView>     ← DataTable (já existe em src/components/shared/) + ordenação + seleção em massa
    └── <PipelineTimelineView> ← agrupamento cronológico (ver §5)
```

- **Estado de visão → URL (`?view=kanban|list|timeline`), não store nem `useState` local.** É navegação, não estado de aplicação: precisa sobreviver a F5, ser compartilhável por link, e voltar/avançar do browser deve trocar de visão. `useSearchParams` do React Router (já usado no repo para outras páginas com abas/filtros) resolve sem dependência nova.
- **Filtros (busca, responsável, etapa, status, agrupamento) → também URL**, não `useState` como hoje. Motivo direto: FR-13 (filtros salvos) precisa serializar exatamente o que está aplicado, e a forma mais barata de "salvar um filtro" é salvar a query string. Isso também resolve de graça o caso "colega manda link filtrado".
- **Dados → um hook único `usePipelineCollection(filters)`**, sucessor de `useDeals`, usado pelas 3 visões. Kanban continua agrupando por `stageId` client-side (após o fetch paginado — ver §2 sobre por que kanban não pagina igual à lista). Lista e timeline consomem a mesma coleção com apresentação diferente.
- **`summary` (StatCards) sai de dentro de `PipelinePage` para um hook derivado** (`usePipelineSummary`) que hoje é client-side sobre `deals` carregados; quando a Frente C existir, os NÚMEROS pesados (forecast, funil) vêm de RPC própria (§3), não do array de deals em memória — evitando que StatCards fiquem presos ao page size da paginação de FR-15.
- **Componentes de visão não sabem de filtro nem de fetch.** Recebem `deals`, `stages`, callbacks (`onCardClick`, `onBulkAction`) via props. Isso preserva 100% do `PipelineColumn`/`DealCard`/DnD atuais só movendo-os para `PipelineKanbanView.tsx` — sem reescrever a lógica de drag-and-drop que já funciona.

| Decisão | Justificativa | Rastreio |
|---|---|---|
| Estado de visão na URL | Compartilhável, sobrevive a refresh, padrão de navegação | FR-9 |
| Filtros na URL, não `useState` | FR-13 precisa serializar filtro aplicado; reaproveita a própria URL como formato de storage | FR-13, FR-15 |
| Hook de coleção único para as 3 visões | Elimina 3x duplicação de fetch/filtro | FR-9, FR-12 |
| Kanban/List/Timeline como componentes "burros" (props-driven) | Preserva DnD existente sem reescrita; isola cada visão para paralelizar dev entre stories 1.40/1.42 | Epic §5 (Onda 4 paralela) |

---

## 2. Camada de consulta (FR-15)

### Problema concreto

`getDeals()` hoje: `select(DEAL_SELECT).eq('status', ...)` sem `.range()`, filtra `search` em JS depois de trazer tudo. `usePipelineStages`/`useDeals` usam `['deals', filters]` como chave — funciona porque hoje é "tudo ou nada". Precisa virar paginado sem quebrar (a) o rollback otimista do DnD em `moveMutation`, que hoje reescreve a lista inteira em cache, e (b) o uso de `deals` completo para `dealsByStage` no kanban.

### Decisão: paginação server-side só para a visão lista; kanban busca por página "grande o suficiente" com aviso de WIP

O kanban é, por natureza, uma visão de **negócios abertos e ativos** — não existe caso de uso de "página 3 do kanban". Paginar o kanban por posição quebraria o DnD (mover um card para fora da página visível). Por isso:

- **Kanban continua buscando todos os negócios `status='open'` da empresa**, mas agora via `.range()` em lote (reaproveitando o padrão `fetchAllPages` já usado em `reportIntelligenceService.ts`/`stockRecommendationsService.ts`) em vez de um único `select` sem limite. Isso não é "paginação de UI" — é proteção contra o limite de 1000 linhas do PostgREST. Em conjunto com o **limite WIP por etapa (FR-5)**, o volume por empresa tende a ficar contido (é o próprio propósito de WIP limit): a Frente A entrega a mitigação estrutural para a Frente C não precisar reinventar paginação de kanban.
- **Lista/tabela (FR-9/FR-10), Ganhos/Perdidos (FR-11) e qualquer visão paginável usam paginação real**: `getDeals(filters, { page, pageSize })` retornando `{ data: Deal[], count: number }` via `.select(DEAL_SELECT, { count: 'exact' }).range(from, to)`.

### Assinatura do serviço

```ts
export interface DealFilters {
  search?: string;
  ownerId?: string;
  stageId?: string;
  status?: DealStatus | 'all';
}

export interface DealPage {
  data: Deal[];
  count: number;   // total de linhas que casam com o filtro (para paginação da UI)
}

// Kanban / agregações que precisam do conjunto completo de abertos:
export const getOpenDeals = async (filters?: DealFilters): Promise<Deal[]>;

// Lista/tabela — paginado, filtro e busca resolvidos no servidor:
export const getDealsPage = async (
  filters: DealFilters,
  pagination: { page: number; pageSize: number },
  sort?: { column: 'value' | 'expected_close_date' | 'title' | 'owner' | 'stage'; direction: 'asc' | 'desc' }
): Promise<DealPage>;
```

- `search` deixa de ser filtro em JS e vira `.or('title.ilike.%x%,customers.full_name.ilike.%x%')` (ou índice `pg_trgm`, decisão de @data-engineer) — mas o **contrato do serviço não muda com a implementação de índice por baixo**, só a query interna.
- `getDeals()` (nome atual) é mantido como alias fino de `getOpenDeals()` durante a migração, para não quebrar todos os call sites de uma vez (ver §6 ordem de refatoração).

### Chaves do React Query

Chave atual `['deals', filters]` cobre bem quando `filters` é só busca/responsável/etapa. Com paginação e ordenação, a chave cresce, mas **precisa continuar granular o suficiente para o `invalidateQueries({ queryKey: ['deals'] })` genérico continuar funcionando** (usado em toda mutation hoje):

```ts
['deals', 'open', filters]                                  // kanban
['deals', 'page', filters, pagination, sort]                 // lista/tabela paginada
```

Ambas sob o prefixo `['deals']` — `invalidateQueries({ queryKey: ['deals'] })` sem `exact` continua invalidando as duas por prefixo, como já acontece hoje. Nenhuma mutation precisa saber se está em contexto kanban ou lista.

### Preservando o rollback otimista do DnD

`moveMutation.onMutate` hoje faz `queryClient.setQueryData<Deal[]>(dealsKey, previous.map(...))` sobre uma única chave fixa (`['deals', filters]`). Com duas formas de cache (`'open'` e `'page'`), o optimistic update do DnD só precisa continuar tocando a chave `['deals', 'open', filters]` — é a única que o kanban lê, e é a única onde o drag acontece (drag-and-drop não existe na visão lista). **Nenhuma mudança de comportamento no optimistic update, só de key shape.** Ações em massa (FR-14) na lista usam invalidação normal (sem optimistic), já que atuam sobre múltiplos registros e não têm a mesma exigência de feedback instantâneo por card que o kanban tem.

| Decisão | Justificativa | Rastreio |
|---|---|---|
| Kanban não pagina; usa `fetchAllPages` interno | DnD exige a coluna inteira em memória; WIP limit (FR-5) contém o volume | FR-15, FR-5, NFR-4 |
| `getDealsPage()` novo, paginado e ordenável, para lista/tabela | FR-15 pede paginação explícita; FR-10 pede ordenação por coluna | FR-15, FR-10 |
| Duas chaves sob prefixo `['deals']`, não uma | Preserva `invalidateQueries({queryKey:['deals']})` genérico já usado em todas as mutations | Código atual `usePipeline.ts:63,112` |
| `moveMutation` só toca a chave `'open'` | DnD só existe no kanban; zero mudança no rollback já validado | Código atual `usePipeline.ts:89-114` |

---

## 3. Agregações da Frente C (FR-16 a FR-21)

Critério de decisão único: **se o cálculo precisa varrer `deal_stage_history`/`deals` além da página atual carregada no cliente, ou se precisa ser correto sob RLS multi-tenant sem trazer dados de outras empresas para o browser fazer conta, vai para RPC Postgres.** Cliente só computa o que já está na tela.

| Métrica (FR) | Onde calcular | Justificativa |
|---|---|---|
| **FR-16 Forecast ponderado** | **RPC** (`get_pipeline_forecast`) | Precisa somar `value * stage.probability` de **todos** os negócios abertos da empresa, não só da página/coluna visível — client-side ficaria inconsistente assim que a Frente B introduzir paginação (FR-15). Retorna um único agregado (`{ totalWeighted, totalOpen }`), payload pequeno. |
| **FR-17 Funil de conversão etapa a etapa** | **RPC** (`get_pipeline_funnel`) | Requer contar, por etapa, quantos negócios **passaram** por ela (via `deal_stage_history`), não quantos estão nela agora — é uma agregação de histórico completo, cara de refazer em JS e incorreta se paginada. |
| **FR-18 Tempo médio por etapa** | **RPC** (mesma função ou companion de FR-17: `get_pipeline_stage_durations`) | Mesma fonte (`deal_stage_history`), mesma janela de consulta; calcular `changed_at` consecutivo por deal exige window functions (`LAG`) — natural em SQL, custoso e frágil em JS. |
| **FR-19 Negócios estagnados** | **View materializada leve ou RPC reaproveitando FR-18** (`is_stagnant` derivado de `days_in_current_stage > limiar`) | O "limiar configurável de dias" é um parâmetro simples de comparação — mas a base (tempo na etapa atual por deal) já existe em FR-18; reaproveitar evita duas fontes de verdade para "tempo em etapa". Resultado por deal é pequeno o bastante para anotar no card/linha da lista (`deal.isStagnant: boolean`) sem RPC própria por deal. |
| **FR-20 Ranking de responsáveis** | **RPC** (`get_owner_ranking`) | Agregação por `owner_id` sobre todo o histórico de vendas fechadas da empresa — mesmo argumento de FR-16/17: não pode depender do que está paginado no cliente. Espelha o padrão já existente `get_team_sales_totals` (`peopleGoalsService.ts`), reaproveitando a convenção de RPC agregada por responsável já validada no módulo de pessoas. |
| **FR-21 Motivos de perda** | **RPC** (`get_lost_reasons_breakdown`) | `GROUP BY lost_reason` sobre `deals WHERE status='lost'` de toda a empresa — trivial em SQL, e client-side exigiria buscar todos os perdidos sem paginação (contradiz FR-15/NFR-4). |

**Nenhuma métrica agregada é "view" (tabela materializada) neste desenho** — todas viram RPC (`SECURITY INVOKER`, respeitando RLS automaticamente por rodar como o usuário autenticado, igual ao padrão `assert_report_financial_access`/`get_team_sales_totals` já existente). Justificativa: os dados-fonte (`deals`, `deal_stage_history`) já têm RLS por `company_id`; RPC herda isso sem replicar a política em uma view separada, e evita o custo de manutenção de refresh de materialized view para dados que mudam a cada drag-and-drop. Se NFR-4 (performance) mostrar necessidade real de cache sob volume alto, a evolução natural é **RPC com resultado costeado por índice em `deal_stage_history(deal_id, changed_at)`** (decisão de índice = @data-engineer), não pular direto para materialização.

**Contrato do lado cliente:** um hook por métrica (`usePipelineForecast`, `usePipelineFunnel`, `useOwnerRanking`, `useLostReasonsBreakdown`), cada um com sua própria `queryKey` (`['pipeline-forecast']`, etc., **fora** do prefixo `['deals']`) e `staleTime` mais generoso (essas métricas não precisam recalcular a cada render — um `staleTime` de 1-2 min é aceitável e reduz carga no RPC). Invalidação explícita nas mutations que afetam o número: `closeMutation` invalida forecast/ranking/lost-reasons; `moveMutation` invalida forecast/funnel/estagnação.

| Decisão | Justificativa | Rastreio |
|---|---|---|
| Todas as 6 métricas via RPC `SECURITY INVOKER`, nenhuma view materializada | RLS multi-tenant herdado automaticamente (NFR-1); evita custo de refresh de MV sob dados que mudam a cada DnD | FR-16 a FR-21, NFR-1, NFR-4 |
| FR-19 reaproveita a base de cálculo de FR-18 | Uma fonte de verdade para "tempo em etapa"; menos RPC para manter | FR-18, FR-19 |
| Ranking (FR-20) espelha padrão de `get_team_sales_totals` | Convenção já validada no módulo de pessoas (`peopleGoalsService.ts`) | Código existente |
| `queryKey` das métricas fora do prefixo `['deals']` | Ciclo de invalidação diferente (métricas toleram staleness maior que a lista de negócios) | NFR-4 |

---

## 4. Integrações da Frente D (FR-22 a FR-27)

### Problema

`dealsService.ts` não deve importar `salesService.ts`, `inventoryService.ts` ou `agendaService.ts` diretamente (e vice-versa) — isso é o caminho mais curto para dependência circular, porque `Appointment.dealId` já aponta de volta para `deals`, e uma futura necessidade de "mostrar valor do negócio na venda" criaria o ciclo inverso.

### Decisão: orquestração no hook, nunca no serviço; cada serviço de módulo continua fechado sobre sua própria tabela

```
usePipelineActions.ts  (hook novo, camada de orquestração)
├── chama salesService.createSale(...)       (FR-23, converter em venda)
├── chama agendaService.createAppointment({dealId})  (FR-25)
├── chama useEmailSender().sendTest/... variante "sendFromDeal" (FR-26)
└── chama dealLineItemsService (novo, FR-24 — ver abaixo)
```

- **Regra:** serviços de módulo (`salesService`, `agendaService`, `inventoryService`) **não sabem que `deals` existe**. Recebem parâmetros primitivos (`dealId` como string opcional, já é o caso de `CreateAppointmentInput.dealId` hoje). Quem sabe orquestrar entre módulos é a camada de hook do pipeline (`usePipelineActions`), que importa os hooks/serviços dos outros módulos — nunca o inverso.
- **FR-23 (converter em venda):** reaproveita `createSale()` como já existe (`CreateSaleInput` recebe `customerId` + `items`); `usePipelineActions.convertDealToSale(deal, items)` monta o `CreateSaleInput` a partir do `deal` e dos itens vinculados (FR-24) e chama `salesService.createSale`. Depois de sucesso, marca o deal como `won` via `closeDeal` já existente — reaproveitando o fluxo de FR-7 (etapa de ganho automatiza `status`), não duplicando lógica de fechamento.
- **FR-24 (produtos vinculados ao deal):** nova tabela de junção (`deal_line_items`, DDL de @data-engineer) e um serviço próprio e pequeno, `dealLineItemsService.ts` (não dentro de `dealsService.ts`, para não inchar o arquivo principal e para poder ser importado por `usePipelineActions` sem trazer todo o resto do CRUD de deal junto). `inventoryService` continua sem saber de `deals`; a referência de produto é só um `productId`.
- **FR-25 (compromisso na agenda):** já é suportado pelo schema (`Appointment.dealId`) e pelo serviço (`CreateAppointmentInput.dealId`) — **zero mudança de contrato em `agendaService`**, só um novo ponto de entrada na UI do deal que chama `agendaService.createAppointment({ ...defaults, dealId: deal.id })`. É a integração de menor risco do epic.
- **FR-26 (e-mail a partir do negócio):** `useEmailSender` hoje expõe `sendTest`. Para uso transacional real a partir de um deal, a Frente D precisa de uma variante não-teste (`sendFromDeal` ou reaproveitar o mesmo edge function `email-sender-api` com um payload de contexto `{ dealId, templateId? }`) — **decisão de contrato exata é da story 1.53**, mas a diretriz arquitetural é: o hook do pipeline chama o **hook** `useEmailSender` (camada de apresentação), não o `emailSenderService` direto duas vezes com lógicas divergentes. Evita duas implementações de "como mandar e-mail" convivendo no repo.
- **Evitar ciclo:** a regra de import é unidirecional — `pipeline/*` pode importar de `sales`, `inventory`, `agenda`, `emailSender`; nenhum desses pode importar de `pipeline/*` ou `dealsService`. Isso já é quase verdade hoje (só `Appointment.dealId` cruza a fronteira, e é só um campo de dado, não um import de módulo).

| Decisão | Justificativa | Rastreio |
|---|---|---|
| Orquestração entre módulos vive em `usePipelineActions`, nunca dentro de `dealsService`/`salesService`/etc. | Import unidirecional evita ciclo; cada serviço de módulo continua testável isoladamente | FR-22 a FR-26 |
| FR-24 ganha serviço próprio (`dealLineItemsService.ts`), não dentro de `dealsService.ts` | Mantém `dealsService.ts` focado no CRUD de deal; import seletivo por quem precisa | FR-24 |
| FR-25 não muda contrato de `agendaService` | `Appointment.dealId` já existe no schema e no `CreateAppointmentInput` | Código existente (`agendaService.ts:105`) |
| FR-26 passa pelo hook `useEmailSender`, não por uma segunda chamada direta a `emailSenderService` | Uma única implementação de "como enviar e-mail" no repo (Story 1.34) | `useEmailSender.ts` |

---

## 5. Timeline unificada (FR-27)

### Problema

Quatro fontes heterogêneas: `deal_stage_history` (mudança de etapa), atividades do deal (FR-22, nova tabela), `appointments` filtrados por `dealId` (FR-25), e log de e-mails enviados a partir do deal (FR-26, provavelmente `outbound_email_log` já existente no módulo de e-mail — ver `EmailSenderState.OutboundEmailLog` em `emailSenderService.ts`). Cada uma tem schema próprio; a timeline precisa de ordem cronológica única.

### Decisão: contrato de evento normalizado no cliente, busca paralela por fonte (não RPC de fan-in)

```ts
export type PipelineTimelineEventType = 'stage_change' | 'activity' | 'appointment' | 'email';

export interface PipelineTimelineEvent {
  id: string;              // prefixado por fonte: `stage:{id}`, `activity:{id}`, `appt:{id}`, `email:{id}`
  dealId: string;
  type: PipelineTimelineEventType;
  occurredAt: string;      // campo de ordenação único
  actorName?: string;      // changed_by / created_by / assigned_user / sender
  summary: string;         // texto pronto para render ("Movido para Proposta Enviada", "Reunião agendada")
  raw: DealStageHistoryEntry | DealActivity | Appointment | OutboundEmailLog;  // payload original p/ detalhe expandido
}
```

- **Por que não uma RPC única de fan-in (`UNION ALL` no banco):** as 4 fontes têm RLS e formas de leitura já implementadas e testadas separadamente (`getDealHistory` já existe; `agendaService` já filtra por `dealId` para outros usos). Uma RPC de fan-in duplicaria essa lógica de acesso em SQL e criaria um quinto lugar para manter regra de negócio de e-mail/agenda. Como cada deal tem volume baixo de eventos (é um único negócio, não a empresa inteira), o custo de 4 queries pequenas em paralelo (`Promise.all`) é desprezível — diferente das agregações da Frente C (§3), que varrem a empresa toda e por isso justificam RPC.
- **`usePipelineTimeline(dealId)`** faz `Promise.all([getDealHistory(dealId), getDealActivities(dealId), getAppointmentsByDeal(dealId), getEmailsByDeal(dealId)])`, normaliza cada resultado para `PipelineTimelineEvent` (um mapper por fonte, cada um vivendo perto do serviço de origem — `mapStageHistoryToEvent` em `dealsService.ts`, `mapAppointmentToEvent` em `agendaService.ts` — para não criar acoplamento reverso), concatena e ordena por `occurredAt`.
- **`getAppointmentsByDeal`/`getEmailsByDeal` são funções novas e pequenas** nos serviços já existentes (`agendaService`, `emailSenderService`), não uma tabela nova — só um filtro adicional (`eq('deal_id', dealId)` / equivalente) sobre o que já existe.
- Cache: `queryKey: ['pipeline-timeline', dealId]`, invalidado por qualquer mutation que grave em uma das 4 fontes a partir do contexto do deal (`moveMutation`, criação de atividade, criação de compromisso, envio de e-mail) — todas já sabem o `dealId` no momento da chamada, então a invalidação é direta.

| Decisão | Justificativa | Rastreio |
|---|---|---|
| Contrato de evento normalizado no cliente, não RPC de `UNION ALL` | Volume por deal é baixo; evita duplicar regra de RLS/acesso de 4 fontes em SQL | FR-27 |
| Mapper por fonte vive junto do serviço de origem | Evita acoplamento reverso (`agendaService` não precisa saber de `pipeline`) | §4 (regra de import unidirecional) |
| Busca paralela (`Promise.all`), não sequencial | 4 queries independentes e pequenas; latência = a mais lenta, não a soma | NFR-4 |

---

## 6. Impacto no existente e ordem segura de refatoração

### O que quebra / precisa refatorar

| Item | Situação atual | Mudança necessária |
|---|---|---|
| `updateDeal()` não grava `stage_id` (dívida FR-8) | `PipelinePage.tsx:93-107` faz `updateDeal` + `moveDeal` condicional como contorno | `updateDeal()` passa a aceitar `stageId` opcional e gravar via **o mesmo caminho de `moveDealStage`** internamente (reaproveita histórico + posição), não dois `UPDATE` divergentes. `PipelinePage.handleSaveDeal` perde o bloco de contorno (linhas 98-107). |
| `getDeals()` sem paginação | Busca tudo, filtra `search` em JS | Vira `getOpenDeals()` (kanban) + `getDealsPage()` (lista). `getDeals` mantido como alias de `getOpenDeals` até todos os call sites migrarem. |
| `['deals', filters]` chave única | Cache plano | Vira `['deals', 'open'|'page', ...]` — ver §2. Qualquer código que faz `invalidateQueries({queryKey:['deals']})` **continua funcionando sem alteração** (prefixo). |
| `PipelinePage.tsx` monolítico (369 linhas) | Estado de filtro, DnD, summary, render — tudo junto | Decompõe em casca + `PipelineKanbanView` (novo arquivo, recebe o JSX de DnD atual quase inalterado) + toolbar/summary extraídos. |
| Mensagem "contate o suporte" quando `stages.length === 0` | `PipelinePage.tsx:309-316` | Substituída por CTA de criar primeira etapa (FR-1), ligado ao novo CRUD de etapas. |

### Ordem segura

1. **FR-8 (bug de `stage_id`) e FR-1 (CRUD de etapas) primeiro, isoladas.** Não dependem de visão nova nem de paginação — podem ser feitas sobre o `dealsService`/`usePipeline` atuais quase sem tocar `PipelinePage.tsx` além do que já é a story 1.35. Isso já é o sequenciamento do epic (Onda 1); esta arquitetura confirma que é seguro porque nenhuma outra frente depende da forma final do componente decomposto.
2. **Decomposição de `PipelinePage.tsx` (casca + `PipelineKanbanView`) antes de FR-15.** Migrar para paginação dentro do componente monolítico multiplicaria o diff; extrair a visão kanban primeiro (comportamento idêntico, só movido de arquivo) dá uma base estável para introduzir `usePipelineCollection` sem misturar "mudei onde o código mora" com "mudei o que o código faz" no mesmo PR.
3. **`getDealsPage()`/paginação (FR-15) antes de lista/tabela (FR-9/FR-10).** Já é a dependência declarada no epic (1.39 antes de 1.40) — esta arquitetura não altera essa ordem, só formaliza o contrato que 1.40 vai consumir.
4. **RPCs da Frente C só depois de FR-4 (probabilidade) e FR-15 existirem.** Forecast (FR-16) precisa de `stage.probability`; ranking/motivos (FR-20/21) preferem que a query server-side de FR-15 já exista para não duplicar a lógica de filtro entre "lista paginada" e "RPC de agregação" com regras de negócio divergentes.
5. **Frente D (FR-22 a FR-26) pode começar em paralelo à Frente C**, pois só depende de FR-1 (etapas existirem) e dos serviços de `sales`/`inventory`/`agenda`/e-mail já existentes — nenhuma dependência da paginação ou das agregações. Confirma o sequenciamento do epic (Onda 6 paralela).
6. **Timeline (FR-27) por último**, estritamente depois de FR-22, FR-25, FR-26 existirem — é consumidora, não pode ser paralelizada com suas próprias fontes.

| Decisão | Justificativa | Rastreio |
|---|---|---|
| `updateDeal()` absorve `moveDealStage` internamente em vez de expor dois caminhos | Elimina a dívida citada no epic sem criar um terceiro caminho de escrita de `stage_id` | FR-8 |
| Extrair `PipelineKanbanView` antes de mexer em paginação | Separa "mover código" de "mudar comportamento" em commits distintos, reduz risco de regressão no DnD | NFR-4, código atual |

---

## 7. Riscos arquiteturais e trade-offs rejeitados

### Riscos

1. **Duas formas de leitura de `deals` (`getOpenDeals` completo vs. `getDealsPage` paginado) podem divergir em regra de filtro com o tempo.** Se alguém adicionar uma regra de negócio (ex.: excluir deals arquivados) em só uma das duas, kanban e lista mostram conjuntos inconsistentes. Mitigação: os dois devem compor sobre os mesmos predicados de `DealFilters`, construídos por uma função pura compartilhada (`buildDealFilterPredicates`) que os dois caminhos chamam — não duas implementações de filtro copiadas.
2. **RPCs da Frente C (§3) sob volume alto sem os índices certos em `deal_stage_history` podem violar NFR-4.** O desenho assume que @data-engineer cobre `deal_stage_history(company_id, deal_id, changed_at)` e `deals(company_id, status, stage_id)`; sem esses índices, `get_pipeline_funnel`/`get_pipeline_stage_durations` degradam com `LAG`/`GROUP BY` em full scan. Este documento não define o índice (fora de escopo), só sinaliza a dependência explicitamente para a Onda 5.
3. **Orquestração entre módulos (§4) concentrada em `usePipelineActions` pode virar um hook grande demais** se as 5 integrações (FR-22 a FR-26) crescerem em regras próprias. Mitigação prevista: dividir por ação assim que ultrapassar ~150-200 linhas (`useDealToSale`, `useDealAppointment`, `useDealEmail`), mantendo a regra de import unidirecional — não é uma decisão a forçar agora, é o gatilho de quando dividir.
4. **`position DOUBLE PRECISION` sob uso mais intenso de DnD (kanban continua sem paginação, FR-2 adiciona reordenação de etapas também nesse esquema)** — risco já identificado no epic (§6), não introduzido por esta arquitetura; nenhuma mitigação nova proposta aqui além de monitorar, por ser decisão de schema já validada e fora do escopo deste documento.

### Trade-offs considerados e rejeitados

- **Estado de visão/filtro em Zustand store, não na URL.** Rejeitado: perderia compartilhamento de link e não resolveria FR-13 (filtros salvos) de graça — teria que serializar o store para outro formato de qualquer forma. URL já é o formato de serialização mais barato disponível.
- **View materializada por métrica da Frente C, refrescada por trigger ou cron.** Rejeitado nesta fase: adiciona superfície de staleness (usuário move um deal e o forecast não atualiza até o próximo refresh) e um mecanismo de invalidação novo no schema, quando RPC direta sob RLS já resolve corretamente com custo aceitável até prova em contrário por métricas reais (NFR-4 pede "não degradar perceptivelmente", não "tempo real absoluto" — RPC direta atende). Reavaliar se @qa/produção medir RPC lenta sob volume real.
- **RPC única de `UNION ALL` para a timeline (FR-27), em vez de 4 buscas paralelas no cliente.** Rejeitado: moveria regra de acesso/formatação de 4 domínios diferentes para uma função SQL única, violando a mesma fronteira de módulos definida em §4 (agenda/e-mail não deveriam ter sua lógica de leitura duplicada dentro de uma função pertencente ao domínio pipeline).
- **`dealsService.ts` importando `salesService`/`agendaService` diretamente para orquestrar FR-23/FR-25.** Rejeitado: é exatamente o caminho para dependência circular que §4 evita — a orquestração pertence à camada de hook (apresentação), não à camada de serviço (acesso a dado).
- **Kanban também paginado (mesma estratégia da lista).** Rejeitado: DnD entre colunas exige a coluna inteira endereçável; paginar quebraria "arrastar para o fim da coluna" sempre que a coluna tiver mais itens que uma página. FR-5 (WIP limit) é o mecanismo correto para conter o volume do kanban, não paginação.

---

## Resumo de artefatos a criar (para @sm quebrar em stories, sem redefinir aqui o que já está no epic)

- `usePipelineView.ts`, `usePipelineCollection.ts`, `usePipelineSummary.ts` (hooks de estado/coleção)
- `PipelineKanbanView.tsx`, `PipelineListView.tsx`, `PipelineTimelineView.tsx` (extraídos/novos, casca fina em `PipelinePage.tsx`)
- `getOpenDeals()`, `getDealsPage()` em `dealsService.ts` (substituindo `getDeals()` gradualmente)
- `dealLineItemsService.ts` (FR-24, novo, pequeno)
- `usePipelineActions.ts` (orquestração entre módulos, FR-22/23/25/26)
- `usePipelineForecast`, `usePipelineFunnel`, `useStagnantDeals`, `useOwnerRanking`, `useLostReasonsBreakdown` (hooks 1:1 com RPCs da Frente C)
- `usePipelineTimeline.ts` + mappers por fonte (FR-27)

---

## Decisões de Arquitetura sobre o Schema (sign-off ao @data-engineer)

> Em resposta a `docs/architecture/pipeline-vendas-schema.md` (Dara), seção "Perguntas em aberto" (item 2) e "Riscos de dados" (itens 1 e 4). Não altero o documento do Cistern — as três decisões abaixo são vinculantes para as stories 1.37, 1.38, 1.44 e 1.51.

### Decisão 1 — FR-7: trigger `deals_apply_stage_outcome` vs. lógica em `moveDealStage()`

**Questão.** Cistern propôs um trigger `BEFORE UPDATE` em `deals` que seta `status`/`closed_at` automaticamente quando `stage_id` muda para uma etapa `is_win_stage`/`is_loss_stage`, guardado por `NEW.status = OLD.status AND OLD.status = 'open'` (só age se o chamador não decidiu `status` explicitamente no mesmo `UPDATE`). Pediu sign-off por risco de conflito com `moveDealStage()`.

**Decisão.** **Trigger aprovado exatamente como especificado.** Ele passa a ser a única fonte de verdade para essa transição — **nenhuma lógica equivalente é adicionada em `moveDealStage()` nem no caminho consolidado de `updateDeal()` (FR-8, §6 deste documento)**. Regra de precedência formalizada: se a aplicação setar `status` explicitamente na mesma escrita (hoje, só `closeDeal()` faz isso), o trigger fica inerte e a decisão explícita da aplicação prevalece; em qualquer escrita que mude `stage_id` sem tocar `status` — `moveDealStage()`, o `updateDeal()` consolidado, e a ação em massa de mudar etapa (FR-14, que Cistern já documentou como `UPDATE ... WHERE id = ANY($1)` direto, sem passar por `moveDealStage()`) — o trigger decide.

**Justificativa.**
- *Idempotência:* o guard duplo (`stage_id` mudou **e** `OLD.status = 'open'`) torna reexecuções seguras. Mover o negócio duas vezes para a mesma etapa de ganho não reseta `closed_at` na segunda vez, porque na segunda chamada `OLD.status` já não é `'open'` — o trigger não age de novo.
- *Divergência aplicação vs. trigger:* resolvida por precedência declarada, não por coincidência de guard. `closeDeal()` já não toca `stage_id`, então nem entra na condição do trigger. O único cenário de sobreposição real seria um código futuro que setasse `status` **e** `stage_id` no mesmo `UPDATE` — aí o guard `NEW.status = OLD.status` cede ao valor explícito, que é o comportamento correto: quem decidiu deliberadamente vence o inferido.
- *O argumento decisivo é FR-14, não FR-7 isolado.* A ação em massa "mudar etapa" (Onda 4) escreve direto na tabela sem passar por `moveDealStage()`. Se a regra de "etapa de ganho fecha o negócio" existisse só em JavaScript, teria que ser duplicada manualmente nesse segundo call site — e ficaria esquecida no próximo write path que surgir (importação, automação, integração futura). Um trigger `BEFORE UPDATE` cobre qualquer caminho de escrita por construção, incluindo os que ainda não existem. É exatamente o critério de "invariante de dado, não UX" que Cistern usou na convenção #4 do schema — confirmo que é o corte certo aqui, e explicitamente **diferente** do corte usado na Decisão 3 abaixo (FR-5/FR-6).
- *Efeito no rollback otimista do DnD:* **nenhuma mudança necessária em `usePipeline.moveMutation`.** O `onMutate` atual já só escreve `stageId`/`position` no cache otimista — nunca assumiu `status` (correto: só o servidor sabe se a etapa de destino é de ganho/perda). Ao arrastar um card para uma etapa de ganho, o usuário vê o card na coluna de destino por um instante com `status` ainda `'open'` no cache local; quando `onSettled` invalida `['deals','open',...]`, o card some do kanban porque `getOpenDeals()` filtra `status='open'` — comportamento correto, e é exatamente como `closeDeal()` já se comporta hoje (também sem optimistic update de status). Nenhum gap novo introduzido pelo trigger.

**Consequência para as stories.**
- 1.37 implementa o trigger tal como especificado por Cistern.
- 1.36, 1.37 e 1.44 ganham uma Dev Note explícita: nenhum código de aplicação pode setar `status` junto de `stage_id` na mesma escrita, exceto via `closeDeal()`.
- 1.44 (ação em massa "mudar etapa") ganha o comportamento de FR-7 de graça, sem código adicional — só precisa de um teste explícito confirmando que mover N negócios em lote para uma etapa de ganho fecha os N automaticamente.

### Decisão 2 — `deal_products.product_id ON DELETE RESTRICT`

**Questão.** Cistern sinalizou (Riscos de dados #4) que `RESTRICT` trava a exclusão de um produto do estoque se ele estiver vinculado a qualquer negócio, mesmo antigo ou perdido.

**Decisão.** **Mantida `ON DELETE RESTRICT`, sem alteração ao schema proposto na Onda 6.**

**Justificativa.**
- O módulo de estoque não expõe exclusão física de produto hoje — `inventoryService.ts` não tem `deleteProduct`; a única operação de remoção é `toggleProductStatus` (desativação lógica). O cenário que travaria (`DELETE FROM products` com negócio vinculado) não é alcançável pelo fluxo normal da aplicação.
- `RESTRICT` é semanticamente correto para `deal_products`, que é registro composicional/histórico do valor do negócio: `SET NULL` é inválido (`product_id NOT NULL`; `quantity`/`subtotal` perdem sentido sem o produto); `CASCADE` reescreveria silenciosamente o valor histórico de um negócio ao apagar um produto — uma corrupção de dado pior do que travar a exclusão, porque altera `deals.value` de forma implícita e retroativa.
- É o mesmo trade-off já aceito para `sale_items`/`purchase_items` no schema atual — manter `RESTRICT` aqui é consistência com convenção já validada, não uma decisão nova isolada.

**Consequência para as stories.** Nenhuma mudança na migration da Onda 6 (1.51). Se o módulo `inventory` algum dia introduzir exclusão física de produto (fora deste epic), a UI deve tratar a violação de `RESTRICT` com a mesma UX recomendada por Cistern para `pipeline_stages` (Riscos de dados #3): capturar o erro e sugerir "arquivar" em vez de deixar a exceção do Postgres vazar — isso é backlog do módulo `inventory`, não desta story.

### Decisão 3 — WIP limit (FR-5) e campos obrigatórios (FR-6): enforcement só na aplicação

**Questão.** Cistern apontou (convenção #3 e Riscos de dados #1) que essas regras não são impostas pelo banco — um write direto (`UPDATE deals SET stage_id = ...` via API/SQL, importação futura, automação) as ignora silenciosamente.

**Decisão.** **Aceito enforcement apenas na aplicação — nenhum trigger ou constraint no banco para FR-5/FR-6.** Diferente da Decisão 1 (FR-7), aqui o critério "invariante de dado vs. sinalização de UX" pesa para o lado da aplicação.

**Justificativa.**
- O próprio epic diferencia os dois casos: FR-5 diz que a UI "deve sinalizar visualmente o excesso" (sinalização, não rejeição de escrita), enquanto FR-7 descreve uma transição de estado binária e inequívoca (etapa de ganho ⇒ `status='won'`, sem leitura alternativa válida). FR-5/FR-6 são regras graduais e configuráveis por empresa (o WIP limit muda, a lista de campos obrigatórios muda) que orientam o fluxo de trabalho — um negócio com `value` vazio numa etapa que "exige" valor não é um dado inconsistente, é uma lacuna de preenchimento identificável e corrigível depois; não tem o mesmo caráter de "dado sem leitura válida" que um `status` contradizendo a etapa.
- Impor isso via trigger exigiria inventar semântica que nenhum FR especifica: a ação em massa de FR-14 ("mudar etapa" para N negócios selecionados) pode ter alguns negócios sem os campos obrigatórios da etapa de destino — um trigger bloqueante falharia a operação inteira (all-or-nothing) ou exigiria lógica de falha parcial não descrita em lugar nenhum do epic. Decidir esse comportamento agora violaria o Artigo IV (No Invention).
- RLS por `company_id` continua garantindo isolamento entre empresas mesmo num write direto que ignore WIP/campos obrigatórios — o risco sinalizado por Cistern é de qualidade de dado dentro da própria empresa, não de vazamento multi-tenant.
- Mitigação real, em vez de trigger: **um único validador puro compartilhado**, `evaluateStageGuards(deal, targetStage): { blockedReasons: string[] }`, usado pelos três pontos que podem mudar `stage_id` — drag-and-drop (`handleDragEnd`), o modal de edição (`DealModal`/`handleSaveDeal`), e a ação em massa (FR-14). Segue o mesmo princípio já registrado neste documento (§7, risco 1: função pura compartilhada para não deixar dois caminhos de leitura divergirem) — aplicado aqui para não deixar os três pontos de escrita divergirem sobre o que é "campo obrigatório" ou "limite excedido".

**Consequência para as stories.**
- 1.38 implementa `evaluateStageGuards()` como função pura (em `dealsService.ts` ou módulo irmão), consumida pelo kanban (drag) e pelo modal.
- 1.44 (ações em massa) **deve** reusar a mesma função antes de disparar o `UPDATE ... WHERE id = ANY($1)` documentado por Cistern, e a UI deve reportar quais negócios do lote ficaram de fora (ex.: "8 de 10 movidos; 2 ficaram para trás por falta de valor preenchido") em vez de mover todos silenciosamente ignorando a regra — Dev Note explícita para 1.44, já que a nota de DDL da Onda 4 de Cistern não cobre esse filtro.
- Sem impacto em nenhuma migration — decisão restrita a código de aplicação.

### Fora deste sign-off

As demais perguntas em aberto do documento de Cistern não são decisões de arquitetura e ficam com os donos naturais: **pergunta 1** (backfill de probabilidade/ganho-perda) é decisão de produto → @pm/@ux; **pergunta 3** (filtros salvos pessoais vs. compartilhados) é decisão de UX → @ux; **pergunta 4** (`idx_customers_full_name_trgm` tocar a tabela `customers`) é aprovada por mim como aditiva e de baixo risco (só cria índice, não altera comportamento do módulo de clientes) — Cistern pode incluir na migration da Onda 3 sem esperar uma segunda rodada de sign-off.
