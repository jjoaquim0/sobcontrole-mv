# Schema — Evolução do Pipeline de Vendas

> **Autor:** @data-engineer (Dara)
> **Status:** Design — nenhuma migration foi criada nem aplicada
> **Fontes:** `.ai/pipeline-upgrade-brief.md`, `docs/epics/epic-pipeline-vendas-avancado.md` (27 FRs, 8 NFRs, 20 stories/7 ondas), `supabase/migrations/20260705000000_sales_pipeline_module_schema.sql` (schema atual), `supabase/migrations/20260805232055_email_transactional_multi_tenant.sql` e `supabase/migrations/20260805004736_people_teams_goals.sql` (padrões recentes de RLS/rollback)

Este documento projeta o schema completo do epic, organizado pelas 7 ondas do sequenciamento (seção 5 do epic). **Nenhum DDL aqui é uma migration real** — cada story escreve a sua própria migration + rollback em `supabase/rollbacks/`, usando este documento como especificação. Nada é aplicado ao banco.

---

## 0. Convenções adotadas (premissas para @architect)

Decisões de banco que impactam o desenho de aplicação, declaradas aqui para alinhamento:

1. **RLS denormalizada nas tabelas novas.** As migrations mais recentes do repo (`email_transactional_multi_tenant`, `people_teams_goals`) migraram do padrão antigo `EXISTS (SELECT 1 FROM deals WHERE ...)` (usado em `deal_stage_history` desde a Story 1.3) para `company_id` denormalizado + `company_id = (SELECT public.get_user_company_id())` + FK composta `(id, company_id)`. É mais rápido (evita subquery correlacionada por linha) e é o padrão que a NFR-4 pede. **Toda tabela nova deste epic segue o padrão novo.** Não retrabalho `deal_stage_history` para o padrão novo por completo — apenas adiciono `company_id` a ela na Onda 5, pois passa a ser consultada pesadamente pela Frente C (ver seção 5).
2. **Abertura de acesso igual ao módulo atual.** `pipeline_stages`/`deals` usam `FOR ALL` sem checagem de role — qualquer membro da empresa lê e escreve. Tabelas novas do próprio módulo pipeline (`deal_activities`, `deal_products`) seguem a mesma abertura, por consistência com o que já existe. Exceção: `pipeline_saved_filters` é pessoal (linha visível só a quem criou).
3. **Regras de negócio "soft" ficam na aplicação, não em trigger/constraint.** FR-5 (limite WIP) e FR-6 (campos obrigatórios) são descritos como sinalização de UI ("a UI deve sinalizar", "bloqueiam o avanço") — não como integridade de dados. O banco armazena a configuração; **não** impede via trigger que alguém insira além do WIP ou avance sem o campo preenchido. Ver riscos (seção 6).
4. **FR-7 (etapa de ganho/perda) é candidato a trigger de consistência**, diferente do item acima, porque é uma invariante de dado (`status` inconsistente com a etapa é um dado corrompido, não só uma UX pior). Proponho o trigger na Onda 2, mas **sinalizo explicitamente que @architect precisa validar** — se `moveDealStage()` já for reescrito para setar `status`/`closed_at` explicitamente no mesmo UPDATE, o trigger deve ser idempotente com isso (só age quando `NEW.status = OLD.status`, i.e., quando o chamador não decidiu o status).
5. **Nenhuma agregação da Frente C precisa de `SECURITY DEFINER`.** As RPCs do módulo de pessoas usam `SECURITY DEFINER` porque restringem por role (admin/manager) além do `company_id`. O pipeline não tem essa restrição de role — a política `FOR ALL` já libera para qualquer membro. As RPCs de agregação abaixo são `SECURITY INVOKER` (padrão), `STABLE`, respeitando a RLS de quem chama.

---

## Onda 1 — Story 1.35 (CRUD de etapas + bug `stage_id`)

**Nenhum DDL novo.** `pipeline_stages` já tem `name`, `color`, `is_active`; a política `FOR ALL USING (company_id = get_user_company_id())` já cobre INSERT/UPDATE/DELETE de qualquer membro — CRUD de etapas (FR-1, FR-3) não precisa de mudança de schema, só de UI e do service (`dealsService.ts`/novo `stagesService.ts`). Arquivar = `UPDATE is_active = false` (já existe). FR-8 (`updateDeal()` gravar `stage_id`) é bug de aplicação — a coluna já existe desde a Story 1.3.

---

## Onda 2 — Stories 1.36-1.38 (reordenação, probabilidade, ganho/perda, WIP, campos obrigatórios)

### DDL

```sql
-- 1.37 — FR-4 (probabilidade), FR-7 (etapa de ganho/perda)
ALTER TABLE pipeline_stages
  ADD COLUMN probability_percent SMALLINT NOT NULL DEFAULT 0
    CONSTRAINT pipeline_stages_probability_check CHECK (probability_percent BETWEEN 0 AND 100),
  ADD COLUMN is_win_stage BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_loss_stage BOOLEAN NOT NULL DEFAULT false,
  ADD CONSTRAINT pipeline_stages_win_loss_exclusive_check CHECK (NOT (is_win_stage AND is_loss_stage));

-- 1.38 — FR-5 (limite WIP), FR-6 (campos obrigatórios para avançar)
ALTER TABLE pipeline_stages
  ADD COLUMN wip_limit INTEGER
    CONSTRAINT pipeline_stages_wip_limit_check CHECK (wip_limit IS NULL OR wip_limit > 0),
  ADD COLUMN required_fields_to_advance TEXT[] NOT NULL DEFAULT '{}'
    CONSTRAINT pipeline_stages_required_fields_check
      CHECK (required_fields_to_advance <@ ARRAY['value', 'expected_close_date']::TEXT[]);
```

`required_fields_to_advance` fica restrito à whitelist `('value','expected_close_date')` — são exatamente os dois campos citados pelo FR-6 (`ex.: valor, data prevista de fechamento`); não inventei um terceiro campo.

`position` (1.36 — reordenação por drag-and-drop) **não muda**: já é `DOUBLE PRECISION`, a estratégia de ponto médio já existe desde a Story 1.3. Zero DDL para FR-2.

### Trigger de consistência (FR-7) — proposta, requer sign-off de @architect

```sql
CREATE OR REPLACE FUNCTION public.pipeline_apply_stage_outcome()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_stage public.pipeline_stages%ROWTYPE;
BEGIN
  -- só age se o chamador não decidiu o status explicitamente neste mesmo UPDATE
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id AND NEW.status = OLD.status AND OLD.status = 'open' THEN
    SELECT * INTO v_stage FROM public.pipeline_stages WHERE id = NEW.stage_id;
    IF v_stage.is_win_stage THEN
      NEW.status := 'won'; NEW.closed_at := now();
    ELSIF v_stage.is_loss_stage THEN
      NEW.status := 'lost'; NEW.closed_at := now();
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER deals_apply_stage_outcome
BEFORE UPDATE ON deals
FOR EACH ROW EXECUTE FUNCTION public.pipeline_apply_stage_outcome();
```

### Rollback (Onda 2)

```sql
DROP TRIGGER IF EXISTS deals_apply_stage_outcome ON deals;
DROP FUNCTION IF EXISTS public.pipeline_apply_stage_outcome();
ALTER TABLE pipeline_stages
  DROP CONSTRAINT IF EXISTS pipeline_stages_required_fields_check,
  DROP COLUMN IF EXISTS required_fields_to_advance,
  DROP CONSTRAINT IF EXISTS pipeline_stages_wip_limit_check,
  DROP COLUMN IF EXISTS wip_limit,
  DROP CONSTRAINT IF EXISTS pipeline_stages_win_loss_exclusive_check,
  DROP COLUMN IF EXISTS is_loss_stage,
  DROP COLUMN IF EXISTS is_win_stage,
  DROP CONSTRAINT IF EXISTS pipeline_stages_probability_check,
  DROP COLUMN IF EXISTS probability_percent;
```

Nenhuma RLS nova — as colunas herdam a política `FOR ALL` já existente em `pipeline_stages`.

---

## Onda 3 — Story 1.39 (busca e paginação server-side)

Sem tabela nova. `getDeals()` hoje busca tudo e filtra em JS (busca por `title`/`customer.fullName` via `.includes()`). Para manter a mesma UX no servidor preciso de busca por substring — não apenas prefixo — então uso `pg_trgm` (ainda não habilitado no projeto; é uma extensão nova, sinalizo explicitamente).

### DDL

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Kanban por etapa + paginação/ordenação por posição (query mais frequente do módulo)
CREATE INDEX idx_deals_company_status_stage_position
  ON deals(company_id, status, stage_id, position);

-- Busca textual server-side (substitui o .includes() client-side em título)
CREATE INDEX idx_deals_title_trgm ON deals USING GIN (title gin_trgm_ops);

-- getDeals() também casa por nome do cliente (customer.fullName) — para preservar
-- esse comportamento no servidor, o índice equivalente precisa existir em
-- customers.full_name. customers não tem índice de busca hoje. Ver nota abaixo.
CREATE INDEX idx_customers_full_name_trgm ON customers USING GIN (full_name gin_trgm_ops);

-- Filtro por responsável
CREATE INDEX idx_deals_company_owner_status ON deals(company_id, owner_id, status);

-- Ordenação/filtro por data prevista (também serve "atrasados" já usado em isDealOverdue)
CREATE INDEX idx_deals_company_expected_close
  ON deals(company_id, expected_close_date) WHERE status = 'open';

-- Ordenação por valor (FR-10)
CREATE INDEX idx_deals_company_value ON deals(company_id, status, value);

-- Ordenação por nome (FR-10) — trgm não serve para ORDER BY, precisa de btree
CREATE INDEX idx_deals_company_title ON deals(company_id, title);
```

**Nota sobre `idx_customers_full_name_trgm`:** `customers` é uma tabela de outro módulo. Incluo o índice aqui porque é estritamente necessário para a FR-15 preservar o comportamento atual de busca (que já casa por nome do cliente) — sem ele, a busca no servidor regride em relação à busca atual client-side. É aditivo e de baixo risco (só cria índice), mas **sinalizo para @architect coordenar com o dono do módulo de clientes** antes de aplicar, já que a tabela não pertence a este epic.

### Rollback (Onda 3)

```sql
DROP INDEX IF EXISTS idx_deals_company_title;
DROP INDEX IF EXISTS idx_deals_company_value;
DROP INDEX IF EXISTS idx_deals_company_expected_close;
DROP INDEX IF EXISTS idx_deals_company_owner_status;
DROP INDEX IF EXISTS idx_customers_full_name_trgm;
DROP INDEX IF EXISTS idx_deals_title_trgm;
DROP INDEX IF EXISTS idx_deals_company_status_stage_position;
-- pg_trgm não é removida (outras features podem passar a depender dela; DROP EXTENSION
-- é destrutivo para qualquer índice trgm criado por outro módulo no meio tempo).
```

---

## Onda 4 — Stories 1.40-1.44 (lista, ganhos/perdidos, agrupamento, filtros salvos, ações em massa)

### DDL

```sql
-- FR-11 — aba Ganhos/Perdidos
CREATE INDEX idx_deals_company_status_closed
  ON deals(company_id, status, closed_at DESC) WHERE status IN ('won', 'lost');

-- FR-13 — filtros salvos (pessoais: cada usuário vê e gerencia só os seus)
CREATE TABLE pipeline_saved_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
  filters JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(filters) = 'object'),
  position DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pipeline_saved_filters_owner_name_unique UNIQUE (company_id, created_by, name)
);

CREATE INDEX idx_pipeline_saved_filters_owner
  ON pipeline_saved_filters(company_id, created_by, position);

ALTER TABLE pipeline_saved_filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário gerencia os próprios filtros salvos" ON pipeline_saved_filters
FOR ALL USING (
  company_id = (SELECT public.get_user_company_id())
  AND created_by = auth.uid()
);

REVOKE ALL ON pipeline_saved_filters FROM anon;
```

`filters` é `JSONB` livre porque espelha exatamente `DealFilters` já definido em `dealsService.ts` (`search`, `ownerId`, `stageId`, `status`) — nenhum campo novo inventado; a forma exata do objeto é responsabilidade do service/TypeScript, não do banco.

**Posição (NFR-8):** `position DOUBLE PRECISION` com reposicionamento por ponto médio, mesma estratégia de `pipeline_stages`/`deals` — não reintroduzo renumeração sequencial.

FR-9/10/12 (visões lista/timeline, ordenação, agrupamento por responsável) e FR-14 (ações em massa) **não precisam de DDL** — usam os índices já criados nas Ondas 3-4 e updates em lote via `.in('id', [...])` (a política `FOR ALL` já cobre; RLS filtra por `company_id` automaticamente, então um `UPDATE ... WHERE id = ANY($1)` só afeta linhas da própria empresa mesmo que a lista de IDs contenha algo de outra empresa por engano).

### Rollback (Onda 4)

```sql
REVOKE ALL ON pipeline_saved_filters FROM anon;
DROP POLICY IF EXISTS "Usuário gerencia os próprios filtros salvos" ON pipeline_saved_filters;
DROP TABLE IF EXISTS pipeline_saved_filters;
DROP INDEX IF EXISTS idx_deals_company_status_closed;
```

---

## Onda 5 — Stories 1.45-1.48 (forecast, funil, tempo em etapa, estagnação, ranking, motivos de perda)

Pré-requisito de todas: `deal_stage_history` hoje **não tem `company_id`** (usa `EXISTS` contra `deals` desde a Story 1.3) e **não tem nenhum índice** além da PK. A Frente C consulta essa tabela pesadamente (funil, tempo em etapa, estagnação). Faço uma migration de "hardening" nela antes das RPCs, no mesmo espírito de `20260805012430_people_teams_goals_hardening.down.sql`.

### DDL — hardening de `deal_stage_history`

```sql
ALTER TABLE deal_stage_history ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

UPDATE deal_stage_history dsh
SET company_id = d.company_id
FROM deals d
WHERE d.id = dsh.deal_id;

ALTER TABLE deal_stage_history ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX idx_deal_stage_history_deal_changed ON deal_stage_history(deal_id, changed_at);
CREATE INDEX idx_deal_stage_history_company_stage_changed
  ON deal_stage_history(company_id, to_stage_id, changed_at);

DROP POLICY IF EXISTS "Acesso total ao histórico de negócios da empresa" ON deal_stage_history;
CREATE POLICY "Acesso total ao histórico de negócios da empresa" ON deal_stage_history
FOR ALL USING (company_id = (SELECT public.get_user_company_id()));
```

`dealsService.ts` precisa passar a gravar `company_id` nos dois `INSERT INTO deal_stage_history` existentes (`createDeal`, `moveDealStage`) — sinalizo para @dev na story 1.46.

### DDL — limite de estagnação configurável (FR-19)

```sql
ALTER TABLE company_settings
  ADD COLUMN pipeline_stagnation_threshold_days INTEGER NOT NULL DEFAULT 14
    CONSTRAINT company_settings_stagnation_days_check CHECK (pipeline_stagnation_threshold_days > 0);
```

Reaproveita `company_settings` (tabela 1:1 por empresa já existente desde `20260706115000`) em vez de criar uma tabela nova — é exatamente o tipo de configuração que ela já guarda (timezone, moeda, cores). A política de UPDATE já restrita a admin/manager se aplica automaticamente à coluna nova, sem mudança de RLS.

### Estratégia de agregação — RPCs `SECURITY INVOKER STABLE`

Todas seguem `SET search_path = ''` e referências totalmente qualificadas (`public.`), como as RPCs mais recentes do repo. Não uso `SECURITY DEFINER` (ver premissa 5) — a RLS de `deals`/`deal_stage_history` já restringe por `company_id` para qualquer chamador autenticado.

| RPC | FR | Retorno | Lógica |
|---|---|---|---|
| `get_pipeline_forecast()` | FR-16 | `(open_value NUMERIC, weighted_forecast NUMERIC, open_deals_count BIGINT)` | `SUM(value)`, `SUM(value * probability_percent / 100.0)` em `deals JOIN pipeline_stages` para `status = 'open'` |
| `get_pipeline_funnel()` | FR-17 | `TABLE(stage_id UUID, stage_name TEXT, stage_position DOUBLE PRECISION, reached_count BIGINT, conversion_rate NUMERIC)` | por etapa, `reached_count` = negócios distintos com alguma linha `to_stage_id = etapa` em `deal_stage_history`; `conversion_rate` = `reached_count` da etapa seguinte (por `position`) dividido pela etapa atual |
| `get_pipeline_stage_durations()` | FR-18 | `TABLE(stage_id UUID, stage_name TEXT, avg_days_in_stage NUMERIC, deals_sampled BIGINT)` | `LEAD(changed_at) OVER (PARTITION BY deal_id ORDER BY changed_at)` menos `changed_at`; se não há próxima transição, usa `COALESCE(deals.closed_at, now())`; média por `to_stage_id` |
| `get_pipeline_stagnant_deals(p_threshold_days INTEGER DEFAULT NULL)` | FR-19 | `TABLE(deal_id UUID, title TEXT, stage_id UUID, stage_name TEXT, owner_id UUID, days_in_stage INTEGER, value NUMERIC)` | `status = 'open'` e `now() - MAX(changed_at)` (por `deal_id`) `> COALESCE(p_threshold_days, company_settings.pipeline_stagnation_threshold_days) dias` |
| `get_pipeline_owner_ranking(p_date_from DATE, p_date_to DATE)` | FR-20 | `TABLE(owner_id UUID, owner_name TEXT, won_value NUMERIC, won_count BIGINT, lost_count BIGINT, conversion_rate NUMERIC, avg_cycle_days NUMERIC)` | agrega `deals` com `status IN ('won','lost')` e `closed_at` no período, agrupado por `owner_id`, join `profiles` para nome; `avg_cycle_days = AVG(closed_at - created_at)` |
| `get_pipeline_lost_reasons(p_date_from DATE, p_date_to DATE)` | FR-21 | `TABLE(lost_reason TEXT, deal_count BIGINT, total_value NUMERIC, pct_of_lost NUMERIC)` | agrupa `deals` com `status = 'lost'` por `lost_reason` no período |

Todas filtram implicitamente por `company_id = (SELECT public.get_user_company_id())` na primeira CTE/join — como são `SECURITY INVOKER`, a RLS do chamador garante isolamento mesmo que eu esqueça o filtro explícito, mas incluo explicitamente por clareza e para permitir o planner usar os índices de `(company_id, ...)`.

`GRANT EXECUTE ... TO authenticated` (sem restrição a `anon`, seguindo o padrão do resto do repo).

### Rollback (Onda 5)

```sql
DROP FUNCTION IF EXISTS public.get_pipeline_lost_reasons(DATE, DATE);
DROP FUNCTION IF EXISTS public.get_pipeline_owner_ranking(DATE, DATE);
DROP FUNCTION IF EXISTS public.get_pipeline_stagnant_deals(INTEGER);
DROP FUNCTION IF EXISTS public.get_pipeline_stage_durations();
DROP FUNCTION IF EXISTS public.get_pipeline_funnel();
DROP FUNCTION IF EXISTS public.get_pipeline_forecast();

ALTER TABLE company_settings
  DROP CONSTRAINT IF EXISTS company_settings_stagnation_days_check,
  DROP COLUMN IF EXISTS pipeline_stagnation_threshold_days;

DROP POLICY IF EXISTS "Acesso total ao histórico de negócios da empresa" ON deal_stage_history;
CREATE POLICY "Acesso total ao histórico de negócios da empresa" ON deal_stage_history
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.deals WHERE deals.id = deal_stage_history.deal_id AND deals.company_id = get_user_company_id())
);
DROP INDEX IF EXISTS idx_deal_stage_history_company_stage_changed;
DROP INDEX IF EXISTS idx_deal_stage_history_deal_changed;
ALTER TABLE deal_stage_history DROP COLUMN IF EXISTS company_id;
```

---

## Onda 6 — Stories 1.49-1.53 (atividades, converter em venda, produtos, agenda, e-mail)

### DDL

```sql
-- Pré-requisito para FK composta a partir daqui
ALTER TABLE deals ADD CONSTRAINT deals_id_company_unique UNIQUE (id, company_id);

-- 1.49 — FR-22 (atividades/tarefas do negócio)
CREATE TABLE deal_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'tarefa' CHECK (type IN ('tarefa', 'ligacao', 'reuniao', 'nota')),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  description TEXT DEFAULT '',
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluida', 'cancelada')),
  assigned_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (deal_id, company_id) REFERENCES deals(id, company_id) ON DELETE CASCADE
);

CREATE INDEX idx_deal_activities_deal ON deal_activities(deal_id, status, due_date);
CREATE INDEX idx_deal_activities_company_assigned ON deal_activities(company_id, assigned_user_id, status);

ALTER TABLE deal_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total dos membros da empresa às atividades do negócio" ON deal_activities
FOR ALL USING (company_id = (SELECT public.get_user_company_id()));
REVOKE ALL ON deal_activities FROM anon;

-- 1.50 — FR-23 (converter negócio ganho em venda)
ALTER TABLE deals
  ADD COLUMN converted_sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  ADD CONSTRAINT deals_converted_sale_requires_won_check
    CHECK (converted_sale_id IS NULL OR status = 'won'),
  ADD CONSTRAINT deals_converted_sale_unique UNIQUE (converted_sale_id);

CREATE INDEX idx_deals_converted_sale ON deals(converted_sale_id) WHERE converted_sale_id IS NOT NULL;

-- 1.51 — FR-24 (vincular produtos ao negócio) — mesmo shape de sale_items/purchase_items
CREATE TABLE deal_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (deal_id, company_id) REFERENCES deals(id, company_id) ON DELETE CASCADE
);

CREATE INDEX idx_deal_products_deal ON deal_products(deal_id);
CREATE INDEX idx_deal_products_company_product ON deal_products(company_id, product_id);

ALTER TABLE deal_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total dos membros da empresa aos produtos do negócio" ON deal_products
FOR ALL USING (company_id = (SELECT public.get_user_company_id()));
REVOKE ALL ON deal_products FROM anon;
```

**FR-25 (agenda) e FR-26 (e-mail) não precisam de DDL:**
- `appointments.deal_id` já existe desde a Story 1.4 (`20260705010000_agenda_module_schema.sql`) — o schema já previa exatamente essa integração.
- `outbound_email_logs.source_type`/`source_id` (Story 1.34) já são `TEXT` livres sem `CHECK` de valores — a aplicação grava `source_type = 'deal'`, `source_id = deal.id` sem alteração de schema.

**`deal_products` é informativo, não transacional.** Vincular um produto a um negócio (1.51) não baixa estoque nem reserva quantidade — isso só acontece quando o negócio é convertido em venda (1.50) via `createSale()`, que já tem sua própria lógica de baixa de estoque em `sale_items`. Sinalizo esse limite explicitamente para @architect/@dev não assumirem reserva de estoque implícita.

### Rollback (Onda 6)

```sql
REVOKE ALL ON deal_products FROM anon;
DROP POLICY IF EXISTS "Acesso total dos membros da empresa aos produtos do negócio" ON deal_products;
DROP TABLE IF EXISTS deal_products;

ALTER TABLE deals
  DROP CONSTRAINT IF EXISTS deals_converted_sale_unique,
  DROP CONSTRAINT IF EXISTS deals_converted_sale_requires_won_check,
  DROP COLUMN IF EXISTS converted_sale_id;

REVOKE ALL ON deal_activities FROM anon;
DROP POLICY IF EXISTS "Acesso total dos membros da empresa às atividades do negócio" ON deal_activities;
DROP TABLE IF EXISTS deal_activities;

ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_id_company_unique;
```

---

## Onda 7 — Story 1.54 (timeline rica de eventos)

**Sem tabela/view nova.** A timeline agrega 4 fontes heterogêneas (`deal_stage_history`, `deal_activities`, `appointments` filtrado por `deal_id`, `outbound_email_logs` filtrado por `source_type='deal' AND source_id=deal.id`) que já têm RLS independentes e índices por `deal_id`/`company_id` das ondas anteriores. Volume por negócio é pequeno (um negócio não acumula milhares de eventos), então recomendo compor a timeline **no service layer** (4 queries paralelas + merge/sort por timestamp em TS), não uma `VIEW`/RPC de `UNION ALL` no banco — uma view misturando 4 tabelas com bases de RLS diferentes é mais frágil de manter do que 4 queries simples scoped por `deal_id`.

Único ajuste de índice necessário — `outbound_email_logs` não tem índice por `source_id` hoje:

```sql
CREATE INDEX idx_outbound_email_logs_source
  ON outbound_email_logs(company_id, source_type, source_id) WHERE source_type IS NOT NULL;
```

### Rollback (Onda 7)

```sql
DROP INDEX IF EXISTS idx_outbound_email_logs_source;
```

---

## Compatibilidade (NFR-3)

- **Toda coluna nova tem default seguro** (`probability_percent DEFAULT 0`, `is_win_stage`/`is_loss_stage DEFAULT false`, `wip_limit DEFAULT NULL` = sem limite, `required_fields_to_advance DEFAULT '{}'` = nada obrigatório, `pipeline_stagnation_threshold_days DEFAULT 14`). Nenhuma empresa ou negócio existente quebra.
- **Não faço backfill de `probability_percent` nem de `is_win_stage`/`is_loss_stage` para as 5 etapas seeded** (Novo Contato, Qualificação, Proposta Enviada, Negociação, Fechamento). Inventar uma curva de probabilidade ou decidir que "Fechamento" é etapa de ganho seria assumir um processo de vendas que a empresa não configurou — viola Artigo IV (No Invention). Efeito prático: toda empresa existente vê forecast ponderado = R$ 0,00 até configurar probabilidades pela UI da Story 1.37. **Decisão para @pm/@ux:** vale um banner/CTA "configure probabilidades" quando `SUM(probability_percent) = 0` — fora do escopo deste documento, só sinalizo o ponto.
- **`complete_company_signup()` não precisa mudar em nenhuma onda.** Diferente da Story 1.3 (que teve que semear 5 etapas na função porque criava linhas novas obrigatórias), este epic só adiciona colunas com default a tabelas existentes ou tabelas novas que não exigem seed por empresa — nada aqui precisa existir automaticamente no momento do cadastro.
- **`deal_stage_history.company_id` (Onda 5)** é a única migration que faz backfill de dado — `UPDATE ... FROM deals` determinístico e sem perda (toda linha de histórico sempre teve um `deal_id` válido apontando para uma empresa).

---

## Riscos de dados

1. **`required_fields_to_advance` e `wip_limit` não são impostos pelo banco.** Um `UPDATE deals SET stage_id = ...` direto via API/SQL ignora as duas regras — elas são gates de UX na aplicação (`moveDealStage()`), não constraints. Não é falha de segurança (RLS ainda isola por empresa), mas é uma lacuna de integridade se algo além do fluxo normal escrever na tabela (import futuro, automação). Se isso virar requisito real, precisa de trigger — está fora do escopo atual porque a FR não pede bloqueio rígido.
2. **Trigger `deals_apply_stage_outcome` (Onda 2) pode conflitar com lógica futura de `moveDealStage()`** se @architect decidir setar `status`/`closed_at` explicitamente no mesmo `UPDATE` sem saber do trigger — o trigger foi desenhado para ser inerte nesse caso (`NEW.status = OLD.status` como guarda), mas precisa de validação conjunta antes da story 1.37 ser implementada.
3. **`deals.stage_id`/`customer_id`/`owner_id` continuam `ON DELETE RESTRICT`** (herdado da Story 1.3) — arquivar uma etapa (`is_active = false`) não a remove fisicamente, então negócios antigos continuam resolvendo `stage_id` normalmente. Um `DELETE` físico de etapa com negócios ainda vinculados falha por `RESTRICT` — comportamento correto, mas a UI de CRUD de etapas (1.35) precisa tratar esse erro (ex.: sugerir arquivar em vez de excluir) em vez de deixar a exceção do Postgres vazar para o usuário.
4. **`deal_products.product_id ON DELETE RESTRICT`** significa que um produto vinculado a qualquer negócio — mesmo perdido/antigo — não pode ser excluído do estoque. Mesmo trade-off já aceito em `sale_items`/`purchase_items`; sinalizo para não ser surpresa nova.
5. **`converted_sale_id` pode ficar `NULL` retroativamente** se a venda gerada for excluída no módulo `sales` depois (`ON DELETE SET NULL`) — o negócio volta a aparecer como "não convertido" mesmo tendo sido, no passado. Acervo de auditoria completo depende de `deal_stage_history`/`deal_activities`, não só dessa coluna.
6. **Reposicionamento por `DOUBLE PRECISION`** (`pipeline_stages.position`, `deals.position`, `pipeline_saved_filters.position`) — risco herdado e já registrado no epic (seção 6): uso intenso de drag-and-drop ao longo do tempo pode aproximar valores até o limite de precisão do tipo. Nenhuma ação nova proposta aqui; monitorar.
7. **`pipeline_saved_filters.filters` é `JSONB` sem schema validado no banco** (só `jsonb_typeof = 'object'`) — um filtro salvo referenciando um `stageId`/`ownerId` que foi excluído depois vira uma referência pendurada sem erro. É aceitável (filtro salvo é conveniência, não integridade referencial) mas o service deve tratar "filtro aponta para algo que não existe mais" ao reaplicar.

---

## Resumo de índices propostos

| Índice | Tabela | Serve |
|---|---|---|
| `idx_deals_company_status_stage_position` | deals | Kanban por etapa (FR-9), fetch mais frequente do módulo |
| `idx_deals_title_trgm` | deals | Busca textual server-side em título (FR-15) |
| `idx_customers_full_name_trgm` | customers | Busca textual server-side em nome do cliente (FR-15, preserva UX atual) |
| `idx_deals_company_owner_status` | deals | Filtro por responsável (FR-15), agrupamento por responsável (FR-12) |
| `idx_deals_company_expected_close` | deals | Ordenação por data prevista (FR-10), detecção de atrasados |
| `idx_deals_company_value` | deals | Ordenação por valor (FR-10) |
| `idx_deals_company_title` | deals | Ordenação por nome (FR-10) |
| `idx_deals_company_status_closed` | deals | Aba Ganhos/Perdidos (FR-11) |
| `idx_pipeline_saved_filters_owner` | pipeline_saved_filters | Listar filtros salvos do usuário, ordenados (FR-13) |
| `idx_deal_stage_history_deal_changed` | deal_stage_history | Tempo em etapa via `LEAD()` (FR-18), histórico por negócio |
| `idx_deal_stage_history_company_stage_changed` | deal_stage_history | Funil de conversão (FR-17) |
| `idx_deal_activities_deal` | deal_activities | Atividades de um negócio, por status/prazo (FR-22) |
| `idx_deal_activities_company_assigned` | deal_activities | Atividades por responsável |
| `idx_deals_converted_sale` | deals | Checar/consultar conversão (FR-23) |
| `idx_deal_products_deal` | deal_products | Produtos de um negócio (FR-24) |
| `idx_outbound_email_logs_source` | outbound_email_logs | E-mails de um negócio na timeline (FR-27) |

---

## Perguntas em aberto

1. **Backfill de probabilidade/ganho-perda para etapas existentes** — decisão de produto, não técnica (ver Compatibilidade).
2. **Trigger de FR-7 vs. lógica em `moveDealStage()`** — precisa de sign-off de @architect antes da story 1.37.
3. **`pipeline_saved_filters` pessoal vs. compartilhado por empresa** — assumi pessoal (`created_by = auth.uid()`); se o UX (Prism) quiser filtros compartilhados por toda a empresa, a RLS muda para `company_id = get_user_company_id()` sem checar `created_by`, e a UNIQUE de nome também.
4. **`idx_customers_full_name_trgm`** toca uma tabela de outro módulo — confirmar com @architect antes de incluir na migration da Onda 3.
