-- Story 1.66 — Piloto e decisão de expansão: indicadores do piloto (roadmap §9),
-- medições salvas (linha de base, acompanhamento e final), critérios de aceite
-- confirmados manualmente (roadmap §11) e decisão da direção.
-- Fase 5 do Roadmap do MVP da MV Ambiental. Depende das Stories 1.62 a 1.65.
-- Escrita somente por RPCs SECURITY DEFINER; o tenant vem sempre da sessão.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

-- Medição salva do piloto. Imutável: uma nova medição nunca altera a anterior.
CREATE TABLE public.service_pilot_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  kind TEXT NOT NULL,
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  metrics JSONB NOT NULL,
  offline_steps INTEGER,
  notes TEXT,
  decision TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_pilot_snapshots_kind_check CHECK (kind IN ('baseline', 'checkpoint', 'final')),
  CONSTRAINT service_pilot_snapshots_period_check CHECK (period_to >= period_from),
  CONSTRAINT service_pilot_snapshots_offline_check CHECK (offline_steps IS NULL OR offline_steps BETWEEN 0 AND 1000),
  CONSTRAINT service_pilot_snapshots_decision_check
    CHECK ((kind = 'final' AND decision IN ('expand', 'adjust', 'pause')) OR (kind <> 'final' AND decision IS NULL))
);

-- Critério de aceite que depende de confirmação humana (ex.: treinamento feito).
CREATE TABLE public.service_pilot_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  criterion INTEGER NOT NULL,
  is_confirmed BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_pilot_criteria_criterion_check CHECK (criterion BETWEEN 1 AND 7),
  CONSTRAINT service_pilot_criteria_note_check CHECK (NOT is_confirmed OR note IS NOT NULL),
  CONSTRAINT service_pilot_criteria_unique UNIQUE (company_id, criterion)
);

CREATE INDEX service_pilot_snapshots_company_idx ON public.service_pilot_snapshots(company_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS: leitura por empresa da sessão e papel de gestão; escrita só por RPC.
-- ---------------------------------------------------------------------------

ALTER TABLE public.service_pilot_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_pilot_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestores visualizam medições do piloto da empresa"
ON public.service_pilot_snapshots FOR SELECT TO authenticated
USING (company_id = (SELECT public.get_user_company_id()) AND (SELECT public.get_user_role()) IN ('admin', 'manager'));

CREATE POLICY "Gestores visualizam critérios do piloto da empresa"
ON public.service_pilot_criteria FOR SELECT TO authenticated
USING (company_id = (SELECT public.get_user_company_id()) AND (SELECT public.get_user_role()) IN ('admin', 'manager'));

REVOKE INSERT, UPDATE, DELETE ON public.service_pilot_snapshots FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.service_pilot_criteria FROM anon, authenticated;
GRANT SELECT ON public.service_pilot_snapshots, public.service_pilot_criteria TO authenticated;

CREATE TRIGGER service_pilot_criteria_touch_updated_at
BEFORE UPDATE ON public.service_pilot_criteria
FOR EACH ROW EXECUTE FUNCTION public.people_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Cálculo dos indicadores (roadmap §9) e das evidências dos critérios (§11)
-- ---------------------------------------------------------------------------

-- Percentual com uma casa decimal; NULL quando não há base de cálculo.
CREATE OR REPLACE FUNCTION public.service_pilot_pct(p_part BIGINT, p_total BIGINT)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE WHEN COALESCE(p_total, 0) = 0 THEN NULL ELSE round(100.0 * p_part / p_total, 1) END;
$$;

-- Indicadores da empresa no período [p_from, p_to]. Contagens de "agora"
-- (demandas abertas sem responsável ou vencidas) usam a data do cálculo.
CREATE OR REPLACE FUNCTION public.service_pilot_compute(
  p_company_id UUID,
  p_from DATE,
  p_to DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- Limites do período em horário de Brasília, independente do fuso da sessão.
  v_from TIMESTAMPTZ := p_from::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo';
  v_to TIMESTAMPTZ := (p_to + 1)::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo';
  v_closed BIGINT;
  v_closed_on_time BIGINT;
  v_open_without_owner BIGINT;
  v_open_overdue BIGINT;
  v_repl_count BIGINT;
  v_repl_days NUMERIC;
  v_items_due BIGINT;
  v_items_on_time BIGINT;
  v_periods_ready BIGINT;
  v_periods_sent BIGINT;
  v_users_total BIGINT;
  v_users_active BIGINT;
  v_contracts_confirmed BIGINT;
  v_posts BIGINT;
  v_allocations BIGINT;
  v_full_flow BIGINT;
  v_periods_controlled BIGINT;
  v_items_without_owner BIGINT;
BEGIN
  -- Demandas concluídas no período que tinham prazo.
  SELECT count(*), count(*) FILTER (WHERE (demand.closed_at AT TIME ZONE 'America/Sao_Paulo')::DATE <= demand.due_date)
  INTO v_closed, v_closed_on_time
  FROM public.service_demands demand
  WHERE demand.company_id = p_company_id AND demand.status = 'closed' AND demand.due_date IS NOT NULL
    AND demand.closed_at >= v_from AND demand.closed_at < v_to;

  SELECT count(*) FILTER (WHERE responsible_id IS NULL),
         count(*) FILTER (WHERE due_date < (now() AT TIME ZONE 'America/Sao_Paulo')::DATE)
  INTO v_open_without_owner, v_open_overdue
  FROM public.service_demands
  WHERE company_id = p_company_id AND status = 'open';

  -- Reposição: da abertura ao encerramento (cobertura confirmada na conferência).
  SELECT count(*), round(avg(EXTRACT(EPOCH FROM (demand.closed_at - demand.created_at)) / 86400.0)::NUMERIC, 1)
  INTO v_repl_count, v_repl_days
  FROM public.service_demands demand
  JOIN public.service_demand_types type ON type.id = demand.type_id AND type.company_id = demand.company_id
  WHERE demand.company_id = p_company_id AND demand.status = 'closed'
    AND lower(type.name) = lower('Reposição de posto')
    AND demand.closed_at >= v_from AND demand.closed_at < v_to;

  -- Itens de comprovação com prazo no período (dispensados não contam).
  SELECT count(*), count(*) FILTER (
    WHERE item.status = 'verified' AND (item.reviewed_at AT TIME ZONE 'America/Sao_Paulo')::DATE <= item.due_date
  )
  INTO v_items_due, v_items_on_time
  FROM public.service_obligation_items item
  WHERE item.company_id = p_company_id AND item.status <> 'waived'
    AND item.due_date BETWEEN p_from AND p_to;

  SELECT count(*) FILTER (WHERE status = 'ready'), count(*) FILTER (WHERE status = 'sent' AND sent_on BETWEEN p_from AND p_to)
  INTO v_periods_ready, v_periods_sent
  FROM public.service_obligation_periods
  WHERE company_id = p_company_id;

  -- Usuários que registraram algo no sistema no período.
  SELECT count(*) INTO v_users_total FROM public.profiles WHERE company_id = p_company_id;
  SELECT count(DISTINCT actor.actor_id) INTO v_users_active
  FROM (
    SELECT actor_id FROM public.service_demand_events WHERE company_id = p_company_id AND created_at >= v_from AND created_at < v_to
    UNION ALL
    SELECT author_id FROM public.service_demand_comments WHERE company_id = p_company_id AND created_at >= v_from AND created_at < v_to
    UNION ALL
    SELECT actor_id FROM public.service_people_events WHERE company_id = p_company_id AND created_at >= v_from AND created_at < v_to
    UNION ALL
    SELECT actor_id FROM public.service_obligation_events WHERE company_id = p_company_id AND created_at >= v_from AND created_at < v_to
    UNION ALL
    SELECT actor_id FROM public.service_contract_audit_events WHERE company_id = p_company_id AND created_at >= v_from AND created_at < v_to
  ) actor
  JOIN public.profiles profile ON profile.id = actor.actor_id AND profile.company_id = p_company_id;

  -- Evidências dos critérios de aceite (estado atual, sem recorte de período).
  SELECT count(*) INTO v_contracts_confirmed
  FROM public.service_contracts
  WHERE company_id = p_company_id AND deleted_at IS NULL AND status = 'active' AND validation_status = 'confirmed';
  SELECT count(*) INTO v_posts
  FROM public.service_posts post
  JOIN public.service_contracts contract ON contract.id = post.contract_id AND contract.company_id = post.company_id
  WHERE post.company_id = p_company_id AND post.status = 'active' AND contract.status = 'active' AND contract.deleted_at IS NULL;
  SELECT count(*) INTO v_allocations
  FROM public.service_post_allocations
  WHERE company_id = p_company_id AND end_date IS NULL;
  SELECT count(*) INTO v_full_flow
  FROM public.service_demands demand
  WHERE demand.company_id = p_company_id AND demand.status = 'closed'
    AND demand.responsible_id IS NOT NULL AND demand.due_date IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.service_demand_events event WHERE event.demand_id = demand.id AND event.event_type = 'stage_changed');
  SELECT count(*) INTO v_periods_controlled
  FROM public.service_obligation_periods
  WHERE company_id = p_company_id AND status IN ('ready', 'sent');
  SELECT count(*) INTO v_items_without_owner
  FROM public.service_obligation_items item
  JOIN public.service_obligation_periods period ON period.id = item.period_id AND period.company_id = item.company_id
  WHERE item.company_id = p_company_id AND period.status = 'open'
    AND item.status IN ('pending', 'submitted', 'rejected') AND item.responsible_id IS NULL;

  RETURN jsonb_build_object(
    'period_from', p_from,
    'period_to', p_to,
    'computed_at', now(),
    'demands_closed', v_closed,
    'demands_closed_on_time', v_closed_on_time,
    'demands_on_time_pct', public.service_pilot_pct(v_closed_on_time, v_closed),
    'demands_open_without_responsible', v_open_without_owner,
    'demands_open_overdue', v_open_overdue,
    'replacements_closed', v_repl_count,
    'replacement_avg_days', v_repl_days,
    'obligation_items_due', v_items_due,
    'obligation_items_on_time', v_items_on_time,
    'obligation_items_on_time_pct', public.service_pilot_pct(v_items_on_time, v_items_due),
    'packages_ready', v_periods_ready,
    'packages_sent', v_periods_sent,
    'users_total', v_users_total,
    'users_active', v_users_active,
    'users_active_pct', public.service_pilot_pct(v_users_active, v_users_total),
    'acceptance', jsonb_build_object(
      'contracts_confirmed', v_contracts_confirmed,
      'active_posts', v_posts,
      'active_allocations', v_allocations,
      'demands_full_flow', v_full_flow,
      'periods_controlled', v_periods_controlled,
      'items_open_without_responsible', v_items_without_owner
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pilot_indicators(
  p_from DATE,
  p_to DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
    RAISE EXCEPTION 'Informe um período válido (início antes do fim).' USING ERRCODE = '22023';
  END IF;
  IF p_to - p_from > 400 THEN
    RAISE EXCEPTION 'Use um período de até 400 dias.' USING ERRCODE = '22023';
  END IF;
  RETURN public.service_pilot_compute(v_company_id, p_from, p_to);
END;
$$;

-- Salva a medição do período com os números calculados agora.
CREATE OR REPLACE FUNCTION public.capture_pilot_snapshot(
  p_label TEXT,
  p_kind TEXT,
  p_from DATE,
  p_to DATE,
  p_offline_steps INTEGER,
  p_notes TEXT,
  p_decision TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
  v_snapshot_id UUID := gen_random_uuid();
BEGIN
  IF NULLIF(trim(p_label), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o nome da medição.' USING ERRCODE = '22023';
  END IF;
  IF p_kind NOT IN ('baseline', 'checkpoint', 'final') THEN
    RAISE EXCEPTION 'Tipo de medição inválido.' USING ERRCODE = '22023';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from OR p_to - p_from > 400 THEN
    RAISE EXCEPTION 'Informe um período válido de até 400 dias.' USING ERRCODE = '22023';
  END IF;
  IF p_offline_steps IS NOT NULL AND p_offline_steps NOT BETWEEN 0 AND 1000 THEN
    RAISE EXCEPTION 'Informe quantas etapas ainda dependem de planilha ou cobrança informal (0 a 1000).' USING ERRCODE = '22023';
  END IF;
  IF p_kind = 'final' AND COALESCE(p_decision, '') NOT IN ('expand', 'adjust', 'pause') THEN
    RAISE EXCEPTION 'Na medição final, registre a decisão da direção: ampliar, ajustar ou pausar.' USING ERRCODE = '22023';
  END IF;
  IF p_kind = 'final' AND NULLIF(trim(p_notes), '') IS NULL THEN
    RAISE EXCEPTION 'Na medição final, registre os motivos da decisão.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.service_pilot_snapshots (
    id, company_id, label, kind, period_from, period_to, metrics, offline_steps, notes, decision, created_by
  ) VALUES (
    v_snapshot_id, v_company_id, trim(p_label), p_kind, p_from, p_to,
    public.service_pilot_compute(v_company_id, p_from, p_to), p_offline_steps, NULLIF(trim(p_notes), ''),
    CASE WHEN p_kind = 'final' THEN p_decision END, auth.uid()
  );
  RETURN v_snapshot_id;
END;
$$;

-- Confirma (ou retira a confirmação de) um critério de aceite com observação.
CREATE OR REPLACE FUNCTION public.set_pilot_criterion(
  p_criterion INTEGER,
  p_confirmed BOOLEAN,
  p_note TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
BEGIN
  IF p_criterion IS NULL OR p_criterion NOT BETWEEN 1 AND 7 THEN
    RAISE EXCEPTION 'Critério de aceite inválido.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(p_confirmed, false) AND NULLIF(trim(p_note), '') IS NULL THEN
    RAISE EXCEPTION 'Descreva como o critério foi verificado.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.service_pilot_criteria (company_id, criterion, is_confirmed, note, updated_by)
  VALUES (v_company_id, p_criterion, COALESCE(p_confirmed, false), NULLIF(trim(p_note), ''), auth.uid())
  ON CONFLICT (company_id, criterion) DO UPDATE SET
    is_confirmed = EXCLUDED.is_confirmed,
    note = EXCLUDED.note,
    updated_by = EXCLUDED.updated_by;
END;
$$;

REVOKE ALL ON FUNCTION public.service_pilot_pct(BIGINT, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.service_pilot_compute(UUID, DATE, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pilot_indicators(DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.capture_pilot_snapshot(TEXT, TEXT, DATE, DATE, INTEGER, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_pilot_criterion(INTEGER, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pilot_indicators(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.capture_pilot_snapshot(TEXT, TEXT, DATE, DATE, INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_pilot_criterion(INTEGER, BOOLEAN, TEXT) TO authenticated;

COMMENT ON TABLE public.service_pilot_snapshots IS 'Medições do piloto (linha de base, acompanhamento e final com decisão da direção). Imutáveis.';
COMMENT ON TABLE public.service_pilot_criteria IS 'Critérios de aceite do MVP que dependem de confirmação humana, com observação de como foram verificados.';
