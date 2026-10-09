-- Story 1.65 — Obrigações e painel: agenda de obrigações por contrato e
-- competência, pacote de comprovação mensal com conferência e envio.
-- Fase 4 do Roadmap do MVP da MV Ambiental. Depende das Stories 1.62 a 1.64.
-- Escrita somente por RPCs SECURITY DEFINER; o tenant vem sempre da sessão.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

-- Modelo de obrigação recorrente. Sem contrato: vale para todos os contratos
-- ativos. O prazo é o dia "due_day" do mês da competência + "due_month_offset".
CREATE TABLE public.service_obligation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contract_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  recurrence TEXT NOT NULL DEFAULT 'monthly',
  reference_month INTEGER,
  due_day INTEGER NOT NULL,
  due_month_offset INTEGER NOT NULL DEFAULT 1,
  default_responsible_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  requires_evidence BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_obligation_templates_contract_fk
    FOREIGN KEY (contract_id, company_id) REFERENCES public.service_contracts(id, company_id) ON DELETE CASCADE,
  CONSTRAINT service_obligation_templates_recurrence_check CHECK (recurrence IN ('monthly', 'quarterly', 'yearly')),
  CONSTRAINT service_obligation_templates_reference_check
    CHECK ((recurrence = 'monthly' AND reference_month IS NULL) OR (recurrence <> 'monthly' AND reference_month BETWEEN 1 AND 12)),
  CONSTRAINT service_obligation_templates_due_day_check CHECK (due_day BETWEEN 1 AND 31),
  CONSTRAINT service_obligation_templates_offset_check CHECK (due_month_offset BETWEEN 0 AND 2),
  CONSTRAINT service_obligation_templates_id_company_unique UNIQUE (id, company_id)
);

CREATE UNIQUE INDEX service_obligation_templates_name_idx
  ON public.service_obligation_templates(
    company_id, lower(name), COALESCE(contract_id, '00000000-0000-0000-0000-000000000000'::UUID)
  );

-- Competência mensal de um contrato: o pacote de comprovação.
CREATE TABLE public.service_obligation_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  contract_id UUID NOT NULL,
  competence DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  ready_at TIMESTAMPTZ,
  ready_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_on DATE,
  sent_to TEXT,
  sent_proof_url TEXT,
  sent_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_obligation_periods_contract_fk
    FOREIGN KEY (contract_id, company_id) REFERENCES public.service_contracts(id, company_id) ON DELETE CASCADE,
  CONSTRAINT service_obligation_periods_competence_check CHECK (EXTRACT(DAY FROM competence) = 1),
  CONSTRAINT service_obligation_periods_status_check CHECK (status IN ('open', 'ready', 'sent')),
  CONSTRAINT service_obligation_periods_ready_check CHECK (status = 'open' OR ready_at IS NOT NULL),
  CONSTRAINT service_obligation_periods_sent_check
    CHECK (status <> 'sent' OR (sent_on IS NOT NULL AND sent_to IS NOT NULL AND sent_proof_url IS NOT NULL)),
  CONSTRAINT service_obligation_periods_proof_url_check CHECK (sent_proof_url IS NULL OR sent_proof_url ~* '^https://'),
  CONSTRAINT service_obligation_periods_unique UNIQUE (company_id, contract_id, competence),
  CONSTRAINT service_obligation_periods_id_company_unique UNIQUE (id, company_id)
);

-- Item exigido na competência (gerado do modelo ou incluído à mão).
CREATE TABLE public.service_obligation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  period_id UUID NOT NULL,
  template_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  responsible_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  requires_evidence BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'pending',
  evidence_url TEXT,
  submission_note TEXT,
  submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_obligation_items_period_fk
    FOREIGN KEY (period_id, company_id) REFERENCES public.service_obligation_periods(id, company_id) ON DELETE CASCADE,
  CONSTRAINT service_obligation_items_template_fk
    FOREIGN KEY (template_id, company_id) REFERENCES public.service_obligation_templates(id, company_id),
  CONSTRAINT service_obligation_items_status_check CHECK (status IN ('pending', 'submitted', 'verified', 'rejected', 'waived')),
  CONSTRAINT service_obligation_items_url_check CHECK (evidence_url IS NULL OR evidence_url ~* '^https://'),
  CONSTRAINT service_obligation_items_evidence_check
    CHECK (status NOT IN ('submitted', 'verified') OR NOT requires_evidence OR evidence_url IS NOT NULL),
  CONSTRAINT service_obligation_items_review_check
    CHECK (status NOT IN ('verified', 'rejected', 'waived') OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)),
  CONSTRAINT service_obligation_items_note_check CHECK (status NOT IN ('rejected', 'waived') OR review_note IS NOT NULL)
);

CREATE UNIQUE INDEX service_obligation_items_template_idx
  ON public.service_obligation_items(period_id, template_id) WHERE template_id IS NOT NULL;

-- Histórico de obrigações: nomes de campos e nota, sem valores.
CREATE TABLE public.service_obligation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.service_contracts(id) ON DELETE CASCADE,
  period_id UUID REFERENCES public.service_obligation_periods(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  changed_fields TEXT[] NOT NULL DEFAULT '{}',
  note TEXT,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_obligation_events_entity_check CHECK (entity_type IN ('template', 'period', 'item'))
);

CREATE INDEX service_obligation_templates_company_idx ON public.service_obligation_templates(company_id, is_active);
CREATE INDEX service_obligation_periods_company_idx ON public.service_obligation_periods(company_id, competence DESC);
CREATE INDEX service_obligation_items_period_idx ON public.service_obligation_items(company_id, period_id, due_date);
CREATE INDEX service_obligation_items_due_idx ON public.service_obligation_items(company_id, status, due_date);
CREATE INDEX service_obligation_events_period_idx ON public.service_obligation_events(company_id, period_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS: leitura por empresa da sessão e papel de gestão; escrita só por RPC.
-- ---------------------------------------------------------------------------

ALTER TABLE public.service_obligation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_obligation_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_obligation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_obligation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestores visualizam modelos de obrigações da empresa"
ON public.service_obligation_templates FOR SELECT TO authenticated
USING (company_id = (SELECT public.get_user_company_id()) AND (SELECT public.get_user_role()) IN ('admin', 'manager'));

CREATE POLICY "Gestores visualizam competências da empresa"
ON public.service_obligation_periods FOR SELECT TO authenticated
USING (company_id = (SELECT public.get_user_company_id()) AND (SELECT public.get_user_role()) IN ('admin', 'manager'));

CREATE POLICY "Gestores visualizam itens de obrigações da empresa"
ON public.service_obligation_items FOR SELECT TO authenticated
USING (company_id = (SELECT public.get_user_company_id()) AND (SELECT public.get_user_role()) IN ('admin', 'manager'));

CREATE POLICY "Gestores visualizam histórico de obrigações da empresa"
ON public.service_obligation_events FOR SELECT TO authenticated
USING (company_id = (SELECT public.get_user_company_id()) AND (SELECT public.get_user_role()) IN ('admin', 'manager'));

REVOKE INSERT, UPDATE, DELETE ON public.service_obligation_templates FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.service_obligation_periods FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.service_obligation_items FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.service_obligation_events FROM anon, authenticated;
GRANT SELECT ON
  public.service_obligation_templates,
  public.service_obligation_periods,
  public.service_obligation_items,
  public.service_obligation_events
TO authenticated;

-- ---------------------------------------------------------------------------
-- Gatilhos: updated_at e histórico
-- ---------------------------------------------------------------------------

CREATE TRIGGER service_obligation_templates_touch_updated_at
BEFORE UPDATE ON public.service_obligation_templates
FOR EACH ROW EXECUTE FUNCTION public.people_touch_updated_at();

CREATE TRIGGER service_obligation_periods_touch_updated_at
BEFORE UPDATE ON public.service_obligation_periods
FOR EACH ROW EXECUTE FUNCTION public.people_touch_updated_at();

CREATE TRIGGER service_obligation_items_touch_updated_at
BEFORE UPDATE ON public.service_obligation_items
FOR EACH ROW EXECUTE FUNCTION public.people_touch_updated_at();

CREATE OR REPLACE FUNCTION public.service_obligations_write_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new JSONB := to_jsonb(NEW);
  v_old JSONB;
  v_entity TEXT;
  v_event_type TEXT;
  v_note TEXT;
  v_contract_id UUID;
  v_period_id UUID;
  v_changed_fields TEXT[] := '{}';
BEGIN
  v_entity := CASE TG_TABLE_NAME
    WHEN 'service_obligation_templates' THEN 'template'
    WHEN 'service_obligation_periods' THEN 'period'
    ELSE 'item'
  END;

  IF v_entity = 'template' THEN
    v_contract_id := (v_new ->> 'contract_id')::UUID;
  ELSIF v_entity = 'period' THEN
    v_contract_id := (v_new ->> 'contract_id')::UUID;
    v_period_id := NEW.id;
  ELSE
    v_period_id := (v_new ->> 'period_id')::UUID;
    SELECT contract_id INTO v_contract_id FROM public.service_obligation_periods WHERE id = v_period_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_event_type := v_entity || '_created';
  ELSE
    v_old := to_jsonb(OLD);
    SELECT COALESCE(array_agg(key ORDER BY key), '{}')
    INTO v_changed_fields
    FROM jsonb_object_keys(v_new) AS key
    WHERE key NOT IN ('updated_at', 'updated_by', 'reviewed_at', 'reviewed_by', 'submitted_at', 'submitted_by', 'ready_at', 'ready_by', 'sent_by')
      AND v_new -> key IS DISTINCT FROM v_old -> key;
    IF cardinality(v_changed_fields) = 0 THEN
      RETURN NEW;
    END IF;

    IF v_entity IN ('period', 'item') AND (v_new ->> 'status') IS DISTINCT FROM (v_old ->> 'status') THEN
      v_event_type := v_entity || '_' || (v_new ->> 'status');
      v_note := CASE WHEN v_entity = 'item' THEN COALESCE(v_new ->> 'review_note', v_new ->> 'submission_note') ELSE v_new ->> 'notes' END;
    ELSE
      v_event_type := v_entity || '_updated';
    END IF;
  END IF;

  INSERT INTO public.service_obligation_events (
    company_id, contract_id, period_id, entity_type, entity_id, event_type, changed_fields, note, actor_id
  ) VALUES (
    NEW.company_id, v_contract_id, v_period_id, v_entity, NEW.id, v_event_type, v_changed_fields, v_note, auth.uid()
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER service_obligation_templates_write_event
AFTER INSERT OR UPDATE ON public.service_obligation_templates
FOR EACH ROW EXECUTE FUNCTION public.service_obligations_write_event();

CREATE TRIGGER service_obligation_periods_write_event
AFTER INSERT OR UPDATE ON public.service_obligation_periods
FOR EACH ROW EXECUTE FUNCTION public.service_obligations_write_event();

CREATE TRIGGER service_obligation_items_write_event
AFTER INSERT OR UPDATE ON public.service_obligation_items
FOR EACH ROW EXECUTE FUNCTION public.service_obligations_write_event();

-- ---------------------------------------------------------------------------
-- Funções de apoio
-- ---------------------------------------------------------------------------

-- Prazo do item: dia "due_day" do mês (competência + deslocamento), limitado ao último dia.
CREATE OR REPLACE FUNCTION public.service_obligations_due_date(
  p_competence DATE,
  p_due_day INTEGER,
  p_due_month_offset INTEGER
)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT (
    date_trunc('month', p_competence::TIMESTAMP) + make_interval(months => p_due_month_offset)
  )::DATE + (LEAST(
    p_due_day,
    EXTRACT(DAY FROM (date_trunc('month', p_competence::TIMESTAMP) + make_interval(months => p_due_month_offset + 1) - INTERVAL '1 day'))::INTEGER
  ) - 1);
$$;

-- Modelo vale na competência: mensal sempre; trimestral a cada 3 meses a partir
-- do mês de referência; anual somente no mês de referência.
CREATE OR REPLACE FUNCTION public.service_obligations_applies(
  p_recurrence TEXT,
  p_reference_month INTEGER,
  p_competence DATE
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_recurrence
    WHEN 'monthly' THEN true
    WHEN 'quarterly' THEN (EXTRACT(MONTH FROM p_competence)::INTEGER - p_reference_month + 12) % 3 = 0
    WHEN 'yearly' THEN EXTRACT(MONTH FROM p_competence)::INTEGER = p_reference_month
    ELSE false
  END;
$$;

-- Gera os itens que faltam na competência a partir dos modelos ativos.
CREATE OR REPLACE FUNCTION public.service_obligations_fill_period(
  p_company_id UUID,
  p_period_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_period RECORD;
  v_count INTEGER;
BEGIN
  SELECT contract_id, competence INTO v_period
  FROM public.service_obligation_periods
  WHERE id = p_period_id AND company_id = p_company_id;

  INSERT INTO public.service_obligation_items (
    company_id, period_id, template_id, name, description, due_date, responsible_id, requires_evidence, created_by, updated_by
  )
  SELECT
    p_company_id, p_period_id, template.id, template.name, template.description,
    public.service_obligations_due_date(v_period.competence, template.due_day, template.due_month_offset),
    template.default_responsible_id, template.requires_evidence, auth.uid(), auth.uid()
  FROM public.service_obligation_templates template
  WHERE template.company_id = p_company_id
    AND template.is_active
    AND (template.contract_id IS NULL OR template.contract_id = v_period.contract_id)
    AND public.service_obligations_applies(template.recurrence, template.reference_month, v_period.competence)
    AND NOT EXISTS (
      SELECT 1 FROM public.service_obligation_items item
      WHERE item.period_id = p_period_id AND item.template_id = template.id
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Item editável: competência aberta e item ainda não conferido/dispensado.
CREATE OR REPLACE FUNCTION public.service_obligations_lock_item(
  p_company_id UUID,
  p_item_id UUID,
  OUT status TEXT,
  OUT requires_evidence BOOLEAN
)
RETURNS RECORD
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_period_status TEXT;
BEGIN
  SELECT item.status, item.requires_evidence, period.status
  INTO status, requires_evidence, v_period_status
  FROM public.service_obligation_items item
  JOIN public.service_obligation_periods period ON period.id = item.period_id AND period.company_id = item.company_id
  WHERE item.id = p_item_id AND item.company_id = p_company_id
  FOR UPDATE OF item;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item da competência não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF v_period_status <> 'open' THEN
    RAISE EXCEPTION 'A competência já foi fechada. Reabra-a para alterar os itens.' USING ERRCODE = '22023';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPCs dos modelos
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.save_obligation_template(
  p_template_id UUID,
  p_contract_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_recurrence TEXT,
  p_reference_month INTEGER,
  p_due_day INTEGER,
  p_due_month_offset INTEGER,
  p_default_responsible_id UUID,
  p_requires_evidence BOOLEAN,
  p_is_active BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
  v_template_id UUID := COALESCE(p_template_id, gen_random_uuid());
  v_current_contract UUID;
BEGIN
  IF NULLIF(trim(p_name), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o nome da obrigação.' USING ERRCODE = '22023';
  END IF;
  IF p_recurrence NOT IN ('monthly', 'quarterly', 'yearly') THEN
    RAISE EXCEPTION 'Recorrência inválida.' USING ERRCODE = '22023';
  END IF;
  IF p_recurrence <> 'monthly' AND (p_reference_month IS NULL OR p_reference_month NOT BETWEEN 1 AND 12) THEN
    RAISE EXCEPTION 'Informe o mês de referência da obrigação trimestral ou anual.' USING ERRCODE = '22023';
  END IF;
  IF p_due_day IS NULL OR p_due_day NOT BETWEEN 1 AND 31 THEN
    RAISE EXCEPTION 'O dia do prazo deve estar entre 1 e 31.' USING ERRCODE = '22023';
  END IF;
  IF p_due_month_offset IS NULL OR p_due_month_offset NOT BETWEEN 0 AND 2 THEN
    RAISE EXCEPTION 'O prazo deve cair no mês da competência ou em até dois meses depois.' USING ERRCODE = '22023';
  END IF;
  IF p_contract_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.service_contracts
    WHERE id = p_contract_id AND company_id = v_company_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Contrato não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.service_demands_assert_profile(v_company_id, p_default_responsible_id, false);

  BEGIN
    IF p_template_id IS NULL THEN
      INSERT INTO public.service_obligation_templates (
        id, company_id, contract_id, name, description, recurrence, reference_month, due_day, due_month_offset,
        default_responsible_id, requires_evidence, is_active, created_by, updated_by
      ) VALUES (
        v_template_id, v_company_id, p_contract_id, trim(p_name), NULLIF(trim(p_description), ''), p_recurrence,
        CASE WHEN p_recurrence = 'monthly' THEN NULL ELSE p_reference_month END, p_due_day, p_due_month_offset,
        p_default_responsible_id, COALESCE(p_requires_evidence, true), COALESCE(p_is_active, true), auth.uid(), auth.uid()
      );
    ELSE
      SELECT contract_id INTO v_current_contract
      FROM public.service_obligation_templates
      WHERE id = p_template_id AND company_id = v_company_id
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Obrigação não encontrada.' USING ERRCODE = 'P0002';
      END IF;
      IF v_current_contract IS DISTINCT FROM p_contract_id THEN
        RAISE EXCEPTION 'O contrato da obrigação não muda depois de criado. Desative o modelo e cadastre outro.' USING ERRCODE = '22023';
      END IF;
      UPDATE public.service_obligation_templates SET
        name = trim(p_name),
        description = NULLIF(trim(p_description), ''),
        recurrence = p_recurrence,
        reference_month = CASE WHEN p_recurrence = 'monthly' THEN NULL ELSE p_reference_month END,
        due_day = p_due_day,
        due_month_offset = p_due_month_offset,
        default_responsible_id = p_default_responsible_id,
        requires_evidence = COALESCE(p_requires_evidence, true),
        is_active = COALESCE(p_is_active, true),
        updated_by = auth.uid()
      WHERE id = p_template_id AND company_id = v_company_id;
    END IF;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Já existe uma obrigação com este nome para este contrato.' USING ERRCODE = '23505';
  END;

  RETURN v_template_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPCs das competências
-- ---------------------------------------------------------------------------

-- Abre a competência (ou completa uma já aberta com modelos novos).
CREATE OR REPLACE FUNCTION public.open_obligation_period(
  p_contract_id UUID,
  p_competence DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
  v_competence DATE := date_trunc('month', p_competence::TIMESTAMP)::DATE;
  v_period_id UUID;
  v_status TEXT;
BEGIN
  IF p_competence IS NULL THEN
    RAISE EXCEPTION 'Informe a competência.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.service_contracts
    WHERE id = p_contract_id AND company_id = v_company_id AND deleted_at IS NULL AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Contrato ativo não encontrado. Somente contratos ativos têm competência.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('service_obligation_periods:' || p_contract_id::TEXT || ':' || v_competence::TEXT));
  SELECT id, status INTO v_period_id, v_status
  FROM public.service_obligation_periods
  WHERE company_id = v_company_id AND contract_id = p_contract_id AND competence = v_competence;

  IF v_period_id IS NULL THEN
    v_period_id := gen_random_uuid();
    INSERT INTO public.service_obligation_periods (id, company_id, contract_id, competence, created_by, updated_by)
    VALUES (v_period_id, v_company_id, p_contract_id, v_competence, auth.uid(), auth.uid());
  ELSIF v_status <> 'open' THEN
    RETURN v_period_id;
  END IF;

  PERFORM public.service_obligations_fill_period(v_company_id, v_period_id);
  RETURN v_period_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_obligation_item(
  p_period_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_due_date DATE,
  p_responsible_id UUID,
  p_requires_evidence BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
  v_item_id UUID := gen_random_uuid();
BEGIN
  IF NULLIF(trim(p_name), '') IS NULL OR p_due_date IS NULL THEN
    RAISE EXCEPTION 'Informe o nome e o prazo do item.' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.service_obligation_periods
  WHERE id = p_period_id AND company_id = v_company_id AND status = 'open'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Competência aberta não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.service_demands_assert_profile(v_company_id, p_responsible_id, false);

  INSERT INTO public.service_obligation_items (
    id, company_id, period_id, name, description, due_date, responsible_id, requires_evidence, created_by, updated_by
  ) VALUES (
    v_item_id, v_company_id, p_period_id, trim(p_name), NULLIF(trim(p_description), ''), p_due_date,
    p_responsible_id, COALESCE(p_requires_evidence, true), auth.uid(), auth.uid()
  );
  RETURN v_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_obligation_item(
  p_item_id UUID,
  p_due_date DATE,
  p_responsible_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
  v_item RECORD;
BEGIN
  IF p_due_date IS NULL THEN
    RAISE EXCEPTION 'Informe o prazo do item.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_item FROM public.service_obligations_lock_item(v_company_id, p_item_id);
  IF v_item.status IN ('verified', 'waived') THEN
    RAISE EXCEPTION 'Item já conferido ou dispensado não muda de prazo nem de responsável.' USING ERRCODE = '22023';
  END IF;
  PERFORM public.service_demands_assert_profile(v_company_id, p_responsible_id, false);
  UPDATE public.service_obligation_items SET
    due_date = p_due_date,
    responsible_id = p_responsible_id,
    updated_by = auth.uid()
  WHERE id = p_item_id AND company_id = v_company_id;
END;
$$;

-- Registra a evidência do item (link https). Recusado volta a ser enviado.
CREATE OR REPLACE FUNCTION public.submit_obligation_item(
  p_item_id UUID,
  p_evidence_url TEXT,
  p_note TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
  v_item RECORD;
  v_url TEXT := NULLIF(trim(p_evidence_url), '');
BEGIN
  SELECT * INTO v_item FROM public.service_obligations_lock_item(v_company_id, p_item_id);
  IF v_item.status NOT IN ('pending', 'rejected') THEN
    RAISE EXCEPTION 'Somente itens pendentes ou recusados recebem evidência.' USING ERRCODE = '22023';
  END IF;
  IF v_item.requires_evidence AND v_url IS NULL THEN
    RAISE EXCEPTION 'Este item exige o link da evidência.' USING ERRCODE = '22023';
  END IF;
  IF v_url IS NOT NULL AND v_url !~* '^https://' THEN
    RAISE EXCEPTION 'O link da evidência deve começar com https://.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.service_obligation_items SET
    status = 'submitted',
    evidence_url = v_url,
    submission_note = NULLIF(trim(p_note), ''),
    submitted_by = auth.uid(),
    submitted_at = now(),
    reviewed_by = NULL,
    reviewed_at = NULL,
    review_note = NULL,
    updated_by = auth.uid()
  WHERE id = p_item_id AND company_id = v_company_id;
END;
$$;

-- Conferência: aprova ou recusa (com motivo) um item enviado.
CREATE OR REPLACE FUNCTION public.review_obligation_item(
  p_item_id UUID,
  p_approve BOOLEAN,
  p_note TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
  v_item RECORD;
BEGIN
  IF p_approve IS NULL THEN
    RAISE EXCEPTION 'Informe se o item foi aprovado ou recusado.' USING ERRCODE = '22023';
  END IF;
  IF NOT p_approve AND NULLIF(trim(p_note), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da recusa.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_item FROM public.service_obligations_lock_item(v_company_id, p_item_id);
  IF v_item.status <> 'submitted' THEN
    RAISE EXCEPTION 'Item aguardando conferência não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.service_obligation_items SET
    status = CASE WHEN p_approve THEN 'verified' ELSE 'rejected' END,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_note = NULLIF(trim(p_note), ''),
    updated_by = auth.uid()
  WHERE id = p_item_id AND company_id = v_company_id;
END;
$$;

-- Dispensa o item nesta competência (não se aplica), com motivo.
CREATE OR REPLACE FUNCTION public.waive_obligation_item(
  p_item_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
  v_item RECORD;
BEGIN
  IF NULLIF(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Informe por que o item não se aplica nesta competência.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_item FROM public.service_obligations_lock_item(v_company_id, p_item_id);
  IF v_item.status IN ('verified', 'waived') THEN
    RAISE EXCEPTION 'Item já conferido ou dispensado.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.service_obligation_items SET
    status = 'waived',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_note = trim(p_reason),
    updated_by = auth.uid()
  WHERE id = p_item_id AND company_id = v_company_id;
END;
$$;

-- Fecha o pacote: todos os itens conferidos ou dispensados.
CREATE OR REPLACE FUNCTION public.mark_obligation_period_ready(
  p_period_id UUID,
  p_note TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
  v_open_items INTEGER;
BEGIN
  PERFORM 1 FROM public.service_obligation_periods
  WHERE id = p_period_id AND company_id = v_company_id AND status = 'open'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Competência aberta não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.service_obligation_items WHERE period_id = p_period_id AND company_id = v_company_id) THEN
    RAISE EXCEPTION 'A competência não tem itens. Cadastre as obrigações do contrato antes de fechar o pacote.' USING ERRCODE = '22023';
  END IF;
  SELECT count(*) INTO v_open_items
  FROM public.service_obligation_items
  WHERE period_id = p_period_id AND company_id = v_company_id AND status NOT IN ('verified', 'waived');
  IF v_open_items > 0 THEN
    RAISE EXCEPTION 'Ainda há % item(ns) sem conferência. Confira ou dispense todos antes de fechar o pacote.', v_open_items USING ERRCODE = '22023';
  END IF;
  UPDATE public.service_obligation_periods SET
    status = 'ready',
    ready_at = now(),
    ready_by = auth.uid(),
    notes = COALESCE(NULLIF(trim(p_note), ''), notes),
    updated_by = auth.uid()
  WHERE id = p_period_id AND company_id = v_company_id;
END;
$$;

-- Reabre um pacote pronto que ainda não foi enviado.
CREATE OR REPLACE FUNCTION public.reopen_obligation_period(
  p_period_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
BEGIN
  IF NULLIF(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo para reabrir a competência.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.service_obligation_periods SET
    status = 'open',
    ready_at = NULL,
    ready_by = NULL,
    notes = trim(p_reason),
    updated_by = auth.uid()
  WHERE id = p_period_id AND company_id = v_company_id AND status = 'ready';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Somente competências prontas e ainda não enviadas podem ser reabertas.' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

-- Registra o envio do pacote ao cliente: data, destinatário e comprovante.
CREATE OR REPLACE FUNCTION public.mark_obligation_period_sent(
  p_period_id UUID,
  p_sent_on DATE,
  p_sent_to TEXT,
  p_proof_url TEXT,
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
  IF p_sent_on IS NULL OR NULLIF(trim(p_sent_to), '') IS NULL THEN
    RAISE EXCEPTION 'Informe a data do envio e o destinatário.' USING ERRCODE = '22023';
  END IF;
  IF p_sent_on > current_date THEN
    RAISE EXCEPTION 'A data do envio não pode ser futura.' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(trim(p_proof_url), '') IS NULL OR trim(p_proof_url) !~* '^https://' THEN
    RAISE EXCEPTION 'Informe o link do comprovante de envio (https://).' USING ERRCODE = '22023';
  END IF;
  UPDATE public.service_obligation_periods SET
    status = 'sent',
    sent_on = p_sent_on,
    sent_to = trim(p_sent_to),
    sent_proof_url = trim(p_proof_url),
    sent_by = auth.uid(),
    notes = COALESCE(NULLIF(trim(p_note), ''), notes),
    updated_by = auth.uid()
  WHERE id = p_period_id AND company_id = v_company_id AND status = 'ready';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Somente competências prontas podem ser marcadas como enviadas.' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.service_obligations_write_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.service_obligations_due_date(DATE, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.service_obligations_applies(TEXT, INTEGER, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.service_obligations_fill_period(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.service_obligations_lock_item(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_obligation_template(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, UUID, BOOLEAN, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.open_obligation_period(UUID, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_obligation_item(UUID, TEXT, TEXT, DATE, UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_obligation_item(UUID, DATE, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_obligation_item(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_obligation_item(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.waive_obligation_item(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_obligation_period_ready(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reopen_obligation_period(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_obligation_period_sent(UUID, DATE, TEXT, TEXT, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.save_obligation_template(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, UUID, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_obligation_period(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_obligation_item(UUID, TEXT, TEXT, DATE, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_obligation_item(UUID, DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_obligation_item(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_obligation_item(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.waive_obligation_item(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_obligation_period_ready(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_obligation_period(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_obligation_period_sent(UUID, DATE, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON TABLE public.service_obligation_templates IS 'Modelos de obrigações recorrentes (mensal, trimestral, anual) por contrato ou para todos os contratos ativos.';
COMMENT ON TABLE public.service_obligation_periods IS 'Competência mensal de um contrato: pacote de comprovação com fechamento e registro de envio.';
COMMENT ON TABLE public.service_obligation_items IS 'Itens exigidos na competência com responsável, prazo, evidência (link https) e conferência.';
COMMENT ON TABLE public.service_obligation_events IS 'Histórico de modelos, competências e itens, sem valores de campos.';
