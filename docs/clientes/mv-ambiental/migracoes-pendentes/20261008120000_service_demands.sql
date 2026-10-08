-- Story 1.63 — Demandas operacionais: tipos, etapas configuráveis, demandas,
-- comentários, evidências e histórico. Fase 2 do Roadmap do MVP da MV Ambiental.
-- Depende da migração da Story 1.62 (service_contracts_assert_manager, postos e alocações).
-- Escrita somente por RPCs SECURITY DEFINER; o tenant vem sempre da sessão.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

CREATE TABLE public.service_demand_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  default_due_days INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_demand_types_due_days_check CHECK (default_due_days IS NULL OR default_due_days BETWEEN 0 AND 365),
  CONSTRAINT service_demand_types_id_company_unique UNIQUE (id, company_id)
);

CREATE UNIQUE INDEX service_demand_types_company_name_idx
  ON public.service_demand_types(company_id, lower(name));

-- Etapas por tipo. A categoria fixa o papel da etapa no fluxo: abertura (primeira),
-- triagem/execução (configuráveis), conferência e encerramento (última).
CREATE TABLE public.service_demand_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  type_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  position INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_demand_stages_type_fk
    FOREIGN KEY (type_id, company_id)
    REFERENCES public.service_demand_types(id, company_id) ON DELETE CASCADE,
  CONSTRAINT service_demand_stages_category_check
    CHECK (category IN ('intake', 'triage', 'execution', 'review', 'done')),
  CONSTRAINT service_demand_stages_fixed_active_check
    CHECK (is_active OR category IN ('triage', 'execution')),
  CONSTRAINT service_demand_stages_position_unique UNIQUE (type_id, position) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT service_demand_stages_id_company_unique UNIQUE (id, company_id)
);

CREATE UNIQUE INDEX service_demand_stages_one_fixed_idx
  ON public.service_demand_stages(type_id, category) WHERE category IN ('intake', 'review', 'done');

CREATE TABLE public.service_demands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  demand_number INTEGER NOT NULL,
  type_id UUID NOT NULL,
  stage_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'open',
  contract_id UUID,
  post_id UUID,
  allocation_id UUID REFERENCES public.service_post_allocations(id) ON DELETE SET NULL,
  employee_id UUID,
  responsible_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_demands_type_fk
    FOREIGN KEY (type_id, company_id) REFERENCES public.service_demand_types(id, company_id),
  CONSTRAINT service_demands_stage_fk
    FOREIGN KEY (stage_id, company_id) REFERENCES public.service_demand_stages(id, company_id),
  CONSTRAINT service_demands_contract_fk
    FOREIGN KEY (contract_id, company_id) REFERENCES public.service_contracts(id, company_id),
  CONSTRAINT service_demands_post_fk
    FOREIGN KEY (post_id, company_id) REFERENCES public.service_posts(id, company_id),
  CONSTRAINT service_demands_employee_fk
    FOREIGN KEY (employee_id, company_id) REFERENCES public.employees(id, company_id),
  CONSTRAINT service_demands_priority_check CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT service_demands_status_check CHECK (status IN ('open', 'closed', 'canceled')),
  CONSTRAINT service_demands_number_unique UNIQUE (company_id, demand_number),
  CONSTRAINT service_demands_id_company_unique UNIQUE (id, company_id),
  -- Conferência separada da execução: quem executa não aprova a própria demanda.
  CONSTRAINT service_demands_segregation_check
    CHECK (responsible_id IS NULL OR approver_id IS NULL OR responsible_id <> approver_id),
  CONSTRAINT service_demands_closed_check
    CHECK (status <> 'closed' OR (closed_at IS NOT NULL AND approved_by IS NOT NULL)),
  CONSTRAINT service_demands_canceled_check
    CHECK (status <> 'canceled' OR (closed_at IS NOT NULL AND cancel_reason IS NOT NULL))
);

CREATE TABLE public.service_demand_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  demand_id UUID NOT NULL,
  body TEXT NOT NULL,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_demand_comments_demand_fk
    FOREIGN KEY (demand_id, company_id) REFERENCES public.service_demands(id, company_id) ON DELETE CASCADE,
  CONSTRAINT service_demand_comments_body_check CHECK (char_length(body) BETWEEN 1 AND 4000)
);

CREATE TABLE public.service_demand_evidences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  demand_id UUID NOT NULL,
  stage_id UUID,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  added_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_demand_evidences_demand_fk
    FOREIGN KEY (demand_id, company_id) REFERENCES public.service_demands(id, company_id) ON DELETE CASCADE,
  CONSTRAINT service_demand_evidences_url_check CHECK (url ~* '^https://')
);

-- Histórico da demanda: guarda etapa de origem/destino, nomes de campos e a nota
-- informada na transição; nunca guarda valores anteriores de campos.
CREATE TABLE public.service_demand_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  demand_id UUID REFERENCES public.service_demands(id) ON DELETE CASCADE,
  type_id UUID REFERENCES public.service_demand_types(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_stage_id UUID REFERENCES public.service_demand_stages(id) ON DELETE SET NULL,
  to_stage_id UUID REFERENCES public.service_demand_stages(id) ON DELETE SET NULL,
  changed_fields TEXT[] NOT NULL DEFAULT '{}',
  note TEXT,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX service_demand_stages_type_idx ON public.service_demand_stages(company_id, type_id, position);
CREATE INDEX service_demands_board_idx ON public.service_demands(company_id, type_id, status, stage_id);
CREATE INDEX service_demands_due_idx ON public.service_demands(company_id, due_date) WHERE status = 'open';
CREATE INDEX service_demands_post_idx ON public.service_demands(company_id, post_id);
CREATE INDEX service_demand_comments_demand_idx ON public.service_demand_comments(company_id, demand_id, created_at);
CREATE INDEX service_demand_evidences_demand_idx ON public.service_demand_evidences(company_id, demand_id, created_at);
CREATE INDEX service_demand_events_demand_idx ON public.service_demand_events(company_id, demand_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS: leitura por empresa da sessão e papel de gestão; escrita só por RPC.
-- ---------------------------------------------------------------------------

ALTER TABLE public.service_demand_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_demand_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_demands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_demand_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_demand_evidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_demand_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestores visualizam tipos de demanda da empresa"
ON public.service_demand_types FOR SELECT TO authenticated
USING (company_id = (SELECT public.get_user_company_id()) AND (SELECT public.get_user_role()) IN ('admin', 'manager'));

CREATE POLICY "Gestores visualizam etapas de demanda da empresa"
ON public.service_demand_stages FOR SELECT TO authenticated
USING (company_id = (SELECT public.get_user_company_id()) AND (SELECT public.get_user_role()) IN ('admin', 'manager'));

CREATE POLICY "Gestores visualizam demandas da própria empresa"
ON public.service_demands FOR SELECT TO authenticated
USING (company_id = (SELECT public.get_user_company_id()) AND (SELECT public.get_user_role()) IN ('admin', 'manager'));

CREATE POLICY "Gestores visualizam comentários de demandas da empresa"
ON public.service_demand_comments FOR SELECT TO authenticated
USING (company_id = (SELECT public.get_user_company_id()) AND (SELECT public.get_user_role()) IN ('admin', 'manager'));

CREATE POLICY "Gestores visualizam evidências de demandas da empresa"
ON public.service_demand_evidences FOR SELECT TO authenticated
USING (company_id = (SELECT public.get_user_company_id()) AND (SELECT public.get_user_role()) IN ('admin', 'manager'));

CREATE POLICY "Gestores visualizam histórico de demandas da empresa"
ON public.service_demand_events FOR SELECT TO authenticated
USING (company_id = (SELECT public.get_user_company_id()) AND (SELECT public.get_user_role()) IN ('admin', 'manager'));

REVOKE INSERT, UPDATE, DELETE ON public.service_demand_types FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.service_demand_stages FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.service_demands FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.service_demand_comments FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.service_demand_evidences FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.service_demand_events FROM anon, authenticated;
GRANT SELECT ON
  public.service_demand_types,
  public.service_demand_stages,
  public.service_demands,
  public.service_demand_comments,
  public.service_demand_evidences,
  public.service_demand_events
TO authenticated;

-- ---------------------------------------------------------------------------
-- Gatilhos: updated_at e histórico
-- ---------------------------------------------------------------------------

CREATE TRIGGER service_demand_types_touch_updated_at
BEFORE UPDATE ON public.service_demand_types
FOR EACH ROW EXECUTE FUNCTION public.people_touch_updated_at();

CREATE TRIGGER service_demand_stages_touch_updated_at
BEFORE UPDATE ON public.service_demand_stages
FOR EACH ROW EXECUTE FUNCTION public.people_touch_updated_at();

CREATE TRIGGER service_demands_touch_updated_at
BEFORE UPDATE ON public.service_demands
FOR EACH ROW EXECUTE FUNCTION public.people_touch_updated_at();

-- A nota da transição chega pela configuração local da transação
-- (app.service_demand_note), definida pela RPC que move a demanda.
CREATE OR REPLACE FUNCTION public.service_demands_write_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_type TEXT;
  v_changed_fields TEXT[] := '{}';
  v_note TEXT := NULLIF(current_setting('app.service_demand_note', true), '');
  v_new JSONB := to_jsonb(NEW);
  v_old JSONB;
BEGIN
  IF TG_TABLE_NAME = 'service_demand_comments' THEN
    INSERT INTO public.service_demand_events (company_id, demand_id, event_type, actor_id)
    VALUES (NEW.company_id, NEW.demand_id, 'comment_added', auth.uid());
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'service_demand_evidences' THEN
    INSERT INTO public.service_demand_events (company_id, demand_id, event_type, to_stage_id, note, actor_id)
    VALUES (NEW.company_id, NEW.demand_id, 'evidence_added', NEW.stage_id, NEW.label, auth.uid());
    RETURN NEW;
  ELSIF TG_TABLE_NAME IN ('service_demand_types', 'service_demand_stages') THEN
    -- Reordenação automática de etapas não polui o histórico.
    IF TG_OP = 'UPDATE'
       AND (v_new - 'position' - 'updated_at' - 'updated_by') = (to_jsonb(OLD) - 'position' - 'updated_at' - 'updated_by') THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.service_demand_events (company_id, type_id, event_type, actor_id)
    VALUES (
      NEW.company_id,
      CASE WHEN TG_TABLE_NAME = 'service_demand_types' THEN NEW.id ELSE (v_new ->> 'type_id')::UUID END,
      CASE WHEN TG_TABLE_NAME = 'service_demand_types' THEN 'type_' ELSE 'stage_' END
        || CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'updated' END,
      auth.uid()
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.service_demand_events (company_id, demand_id, event_type, to_stage_id, actor_id)
    VALUES (NEW.company_id, NEW.id, 'demand_created', NEW.stage_id, auth.uid());
    RETURN NEW;
  END IF;

  v_old := to_jsonb(OLD);
  SELECT COALESCE(array_agg(key ORDER BY key), '{}')
  INTO v_changed_fields
  FROM jsonb_object_keys(v_new) AS key
  WHERE key NOT IN ('updated_at', 'updated_by', 'approved_at', 'approved_by', 'closed_at')
    AND v_new -> key IS DISTINCT FROM v_old -> key;

  IF cardinality(v_changed_fields) = 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'canceled' AND OLD.status <> 'canceled' THEN
    v_event_type := 'demand_canceled';
    v_note := NEW.cancel_reason;
  ELSIF NEW.status = 'closed' AND OLD.status <> 'closed' THEN
    v_event_type := 'demand_closed';
  ELSIF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    v_event_type := 'stage_changed';
  ELSIF 'responsible_id' = ANY (v_changed_fields) OR 'approver_id' = ANY (v_changed_fields) THEN
    v_event_type := 'demand_assigned';
  ELSE
    v_event_type := 'demand_updated';
  END IF;

  INSERT INTO public.service_demand_events (
    company_id, demand_id, event_type, from_stage_id, to_stage_id, changed_fields, note, actor_id
  ) VALUES (
    NEW.company_id, NEW.id, v_event_type,
    CASE WHEN NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN OLD.stage_id END,
    CASE WHEN NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN NEW.stage_id END,
    v_changed_fields, v_note, auth.uid()
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER service_demand_types_write_event
AFTER INSERT OR UPDATE ON public.service_demand_types
FOR EACH ROW EXECUTE FUNCTION public.service_demands_write_event();

CREATE TRIGGER service_demand_stages_write_event
AFTER INSERT OR UPDATE ON public.service_demand_stages
FOR EACH ROW EXECUTE FUNCTION public.service_demands_write_event();

CREATE TRIGGER service_demands_write_event
AFTER INSERT OR UPDATE ON public.service_demands
FOR EACH ROW EXECUTE FUNCTION public.service_demands_write_event();

CREATE TRIGGER service_demand_comments_write_event
AFTER INSERT ON public.service_demand_comments
FOR EACH ROW EXECUTE FUNCTION public.service_demands_write_event();

CREATE TRIGGER service_demand_evidences_write_event
AFTER INSERT ON public.service_demand_evidences
FOR EACH ROW EXECUTE FUNCTION public.service_demands_write_event();

-- ---------------------------------------------------------------------------
-- Funções de apoio
-- ---------------------------------------------------------------------------

-- Usuário da empresa (responsável) ou gestor da empresa (aprovador).
CREATE OR REPLACE FUNCTION public.service_demands_assert_profile(
  p_company_id UUID,
  p_profile_id UUID,
  p_require_manager BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_profile_id IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_profile_id AND company_id = p_company_id
      AND (NOT p_require_manager OR role IN ('admin', 'manager'))
  ) THEN
    IF p_require_manager THEN
      RAISE EXCEPTION 'O aprovador deve ser um gestor ou administrador da empresa.' USING ERRCODE = 'P0002';
    END IF;
    RAISE EXCEPTION 'Responsável não encontrado na empresa.' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.service_demands_create_default_stages(p_company_id UUID, p_type_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.service_demand_stages (company_id, type_id, name, category, position, created_by, updated_by)
  SELECT p_company_id, p_type_id, stage.name, stage.category, stage.position, auth.uid(), auth.uid()
  FROM (VALUES
    ('Abertura', 'intake', 1),
    ('Triagem', 'triage', 2),
    ('Execução', 'execution', 3),
    ('Conferência', 'review', 4),
    ('Encerramento', 'done', 5)
  ) AS stage(name, category, position);
$$;

-- ---------------------------------------------------------------------------
-- RPCs de configuração (tipos e etapas)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.save_service_demand_type(
  p_type_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_default_due_days INTEGER,
  p_is_active BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
  v_type_id UUID := COALESCE(p_type_id, gen_random_uuid());
BEGIN
  IF NULLIF(trim(p_name), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o nome do tipo de demanda.' USING ERRCODE = '22023';
  END IF;
  IF p_default_due_days IS NOT NULL AND (p_default_due_days < 0 OR p_default_due_days > 365) THEN
    RAISE EXCEPTION 'O prazo padrão deve estar entre 0 e 365 dias.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    IF p_type_id IS NULL THEN
      INSERT INTO public.service_demand_types (
        id, company_id, name, description, default_due_days, is_active, created_by, updated_by
      ) VALUES (
        v_type_id, v_company_id, trim(p_name), NULLIF(trim(p_description), ''), p_default_due_days,
        COALESCE(p_is_active, true), auth.uid(), auth.uid()
      );
      PERFORM public.service_demands_create_default_stages(v_company_id, v_type_id);
    ELSE
      UPDATE public.service_demand_types SET
        name = trim(p_name),
        description = NULLIF(trim(p_description), ''),
        default_due_days = p_default_due_days,
        is_active = COALESCE(p_is_active, true),
        updated_by = auth.uid()
      WHERE id = p_type_id AND company_id = v_company_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Tipo de demanda não encontrado.' USING ERRCODE = 'P0002';
      END IF;
    END IF;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Já existe um tipo de demanda com este nome.' USING ERRCODE = '23505';
  END;

  RETURN v_type_id;
END;
$$;

-- Cria os dois tipos dos fluxos prioritários do roadmap quando a empresa ainda não tem nenhum.
CREATE OR REPLACE FUNCTION public.ensure_default_service_demand_types()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
  v_type_id UUID;
  v_default RECORD;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('service_demand_types:' || v_company_id::TEXT));
  IF EXISTS (SELECT 1 FROM public.service_demand_types WHERE company_id = v_company_id) THEN
    RETURN 0;
  END IF;

  FOR v_default IN
    SELECT * FROM (VALUES
      ('Reposição de posto', 'Vaga ou ausência prolongada que exige reposição autorizada e confirmação de cobertura.', 15),
      ('Ausência / ocorrência de campo', 'Falta, atraso ou ocorrência registrada em campo e tratada pelo DP.', 3)
    ) AS item(name, description, due_days)
  LOOP
    v_type_id := gen_random_uuid();
    INSERT INTO public.service_demand_types (
      id, company_id, name, description, default_due_days, created_by, updated_by
    ) VALUES (
      v_type_id, v_company_id, v_default.name, v_default.description, v_default.due_days, auth.uid(), auth.uid()
    );
    PERFORM public.service_demands_create_default_stages(v_company_id, v_type_id);
  END LOOP;

  RETURN 2;
END;
$$;

-- Novas etapas entram antes da conferência. Abertura, conferência e encerramento
-- podem ser renomeadas, mas não mudam de papel nem são desativadas.
CREATE OR REPLACE FUNCTION public.save_service_demand_stage(
  p_stage_id UUID,
  p_type_id UUID,
  p_name TEXT,
  p_category TEXT,
  p_is_active BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
  v_stage_id UUID := COALESCE(p_stage_id, gen_random_uuid());
  v_current RECORD;
  v_review_position INTEGER;
BEGIN
  IF NULLIF(trim(p_name), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o nome da etapa.' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.service_demand_types
  WHERE id = p_type_id AND company_id = v_company_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tipo de demanda não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF p_stage_id IS NULL THEN
    IF p_category NOT IN ('triage', 'execution') THEN
      RAISE EXCEPTION 'Novas etapas devem ser de triagem ou execução.' USING ERRCODE = '22023';
    END IF;
    SELECT position INTO v_review_position
    FROM public.service_demand_stages
    WHERE type_id = p_type_id AND company_id = v_company_id AND category = 'review';

    UPDATE public.service_demand_stages SET position = position + 1, updated_by = auth.uid()
    WHERE type_id = p_type_id AND company_id = v_company_id AND position >= v_review_position;

    INSERT INTO public.service_demand_stages (
      id, company_id, type_id, name, category, position, is_active, created_by, updated_by
    ) VALUES (
      v_stage_id, v_company_id, p_type_id, trim(p_name), p_category, v_review_position,
      COALESCE(p_is_active, true), auth.uid(), auth.uid()
    );
    RETURN v_stage_id;
  END IF;

  SELECT category, is_active INTO v_current
  FROM public.service_demand_stages
  WHERE id = p_stage_id AND type_id = p_type_id AND company_id = v_company_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF v_current.category IN ('intake', 'review', 'done') AND (p_category <> v_current.category OR NOT COALESCE(p_is_active, true)) THEN
    RAISE EXCEPTION 'Abertura, conferência e encerramento podem ser renomeadas, mas não alteradas ou desativadas.' USING ERRCODE = '22023';
  END IF;
  IF v_current.category IN ('triage', 'execution') AND p_category NOT IN ('triage', 'execution') THEN
    RAISE EXCEPTION 'Etapas intermediárias devem ser de triagem ou execução.' USING ERRCODE = '22023';
  END IF;
  IF NOT COALESCE(p_is_active, true) AND v_current.is_active AND EXISTS (
    SELECT 1 FROM public.service_demands
    WHERE stage_id = p_stage_id AND company_id = v_company_id AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'Mova as demandas abertas antes de desativar a etapa.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.service_demand_stages SET
    name = trim(p_name),
    category = p_category,
    is_active = COALESCE(p_is_active, true),
    updated_by = auth.uid()
  WHERE id = p_stage_id AND company_id = v_company_id;

  RETURN v_stage_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPCs das demandas
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_service_demand(
  p_type_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_priority TEXT,
  p_due_date DATE,
  p_contract_id UUID,
  p_post_id UUID,
  p_allocation_id UUID,
  p_employee_id UUID,
  p_responsible_id UUID,
  p_approver_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
  v_demand_id UUID := gen_random_uuid();
  v_default_due_days INTEGER;
  v_stage_id UUID;
  v_contract_id UUID := p_contract_id;
  v_post_id UUID := p_post_id;
  v_employee_id UUID := p_employee_id;
  v_link RECORD;
  v_number INTEGER;
BEGIN
  IF NULLIF(trim(p_title), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o título da demanda.' USING ERRCODE = '22023';
  END IF;
  IF p_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Prioridade inválida.' USING ERRCODE = '22023';
  END IF;

  SELECT default_due_days INTO v_default_due_days
  FROM public.service_demand_types
  WHERE id = p_type_id AND company_id = v_company_id AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tipo de demanda não encontrado ou inativo.' USING ERRCODE = 'P0002';
  END IF;
  SELECT id INTO v_stage_id
  FROM public.service_demand_stages
  WHERE type_id = p_type_id AND company_id = v_company_id AND category = 'intake';

  -- Vínculos: alocação define o posto; posto define o contrato. Divergências são recusadas.
  IF p_allocation_id IS NOT NULL THEN
    SELECT post_id, employee_id INTO v_link
    FROM public.service_post_allocations
    WHERE id = p_allocation_id AND company_id = v_company_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Alocação não encontrada.' USING ERRCODE = 'P0002';
    END IF;
    IF v_post_id IS NOT NULL AND v_post_id <> v_link.post_id THEN
      RAISE EXCEPTION 'A alocação informada não pertence ao posto selecionado.' USING ERRCODE = '22023';
    END IF;
    v_post_id := v_link.post_id;
    v_employee_id := COALESCE(v_employee_id, v_link.employee_id);
  END IF;
  IF v_post_id IS NOT NULL THEN
    SELECT contract_id INTO v_link
    FROM public.service_posts
    WHERE id = v_post_id AND company_id = v_company_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Posto não encontrado.' USING ERRCODE = 'P0002';
    END IF;
    IF v_contract_id IS NOT NULL AND v_contract_id <> v_link.contract_id THEN
      RAISE EXCEPTION 'O posto informado não pertence ao contrato selecionado.' USING ERRCODE = '22023';
    END IF;
    v_contract_id := v_link.contract_id;
  END IF;
  IF v_contract_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.service_contracts
    WHERE id = v_contract_id AND company_id = v_company_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Contrato não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF v_employee_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.employees
    WHERE id = v_employee_id AND company_id = v_company_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Funcionário não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.service_demands_assert_profile(v_company_id, p_responsible_id, false);
  PERFORM public.service_demands_assert_profile(v_company_id, p_approver_id, true);
  IF p_responsible_id IS NOT NULL AND p_responsible_id = p_approver_id THEN
    RAISE EXCEPTION 'Responsável e aprovador devem ser pessoas diferentes.' USING ERRCODE = '22023';
  END IF;

  -- Numeração sequencial por empresa sem corrida entre gestores.
  PERFORM pg_advisory_xact_lock(hashtext('service_demands:' || v_company_id::TEXT));
  SELECT COALESCE(max(demand_number), 0) + 1 INTO v_number
  FROM public.service_demands WHERE company_id = v_company_id;

  INSERT INTO public.service_demands (
    id, company_id, demand_number, type_id, stage_id, title, description, priority, due_date,
    contract_id, post_id, allocation_id, employee_id, responsible_id, approver_id, created_by, updated_by
  ) VALUES (
    v_demand_id, v_company_id, v_number, p_type_id, v_stage_id, trim(p_title), NULLIF(trim(p_description), ''),
    p_priority,
    COALESCE(p_due_date, CASE WHEN v_default_due_days IS NOT NULL THEN current_date + v_default_due_days END),
    v_contract_id, v_post_id, p_allocation_id, v_employee_id, p_responsible_id, p_approver_id, auth.uid(), auth.uid()
  );

  RETURN v_demand_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_service_demand(
  p_demand_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_priority TEXT,
  p_due_date DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
BEGIN
  IF NULLIF(trim(p_title), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o título da demanda.' USING ERRCODE = '22023';
  END IF;
  IF p_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Prioridade inválida.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.service_demands SET
    title = trim(p_title),
    description = NULLIF(trim(p_description), ''),
    priority = p_priority,
    due_date = p_due_date,
    updated_by = auth.uid()
  WHERE id = p_demand_id AND company_id = v_company_id AND status = 'open';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demanda aberta não encontrada.' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_service_demand(
  p_demand_id UUID,
  p_responsible_id UUID,
  p_approver_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
  v_category TEXT;
BEGIN
  SELECT stage.category INTO v_category
  FROM public.service_demands demand
  JOIN public.service_demand_stages stage ON stage.id = demand.stage_id
  WHERE demand.id = p_demand_id AND demand.company_id = v_company_id AND demand.status = 'open'
  FOR UPDATE OF demand;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demanda aberta não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.service_demands_assert_profile(v_company_id, p_responsible_id, false);
  PERFORM public.service_demands_assert_profile(v_company_id, p_approver_id, true);
  IF p_responsible_id IS NOT NULL AND p_responsible_id = p_approver_id THEN
    RAISE EXCEPTION 'Responsável e aprovador devem ser pessoas diferentes.' USING ERRCODE = '22023';
  END IF;
  IF v_category IN ('execution', 'review') AND p_responsible_id IS NULL THEN
    RAISE EXCEPTION 'A demanda em execução ou conferência precisa de um responsável.' USING ERRCODE = '22023';
  END IF;
  IF v_category = 'review' AND p_approver_id IS NULL THEN
    RAISE EXCEPTION 'A demanda em conferência precisa de um aprovador.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.service_demands SET
    responsible_id = p_responsible_id,
    approver_id = p_approver_id,
    updated_by = auth.uid()
  WHERE id = p_demand_id AND company_id = v_company_id;
END;
$$;

-- Transições: avança uma etapa ativa por vez; volta a qualquer etapa anterior com
-- motivo; execução exige responsável; conferência exige aprovador; somente o
-- aprovador encerra a demanda a partir da conferência.
CREATE OR REPLACE FUNCTION public.move_service_demand(
  p_demand_id UUID,
  p_to_stage_id UUID,
  p_note TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
  v_demand RECORD;
  v_from RECORD;
  v_to RECORD;
  v_next RECORD;
BEGIN
  SELECT id, type_id, stage_id, responsible_id, approver_id INTO v_demand
  FROM public.service_demands
  WHERE id = p_demand_id AND company_id = v_company_id AND status = 'open'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demanda aberta não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  SELECT id, name, category, position INTO v_from
  FROM public.service_demand_stages WHERE id = v_demand.stage_id;
  SELECT id, name, category, position INTO v_to
  FROM public.service_demand_stages
  WHERE id = p_to_stage_id AND type_id = v_demand.type_id AND company_id = v_company_id AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa não encontrada para este tipo de demanda.' USING ERRCODE = 'P0002';
  END IF;
  IF v_to.id = v_from.id THEN
    RAISE EXCEPTION 'A demanda já está nesta etapa.' USING ERRCODE = '22023';
  END IF;

  IF v_to.position > v_from.position THEN
    SELECT id, name INTO v_next
    FROM public.service_demand_stages
    WHERE type_id = v_demand.type_id AND company_id = v_company_id AND is_active AND position > v_from.position
    ORDER BY position
    LIMIT 1;
    IF v_next.id <> v_to.id THEN
      RAISE EXCEPTION 'Avance uma etapa por vez. A próxima etapa é "%".', v_next.name USING ERRCODE = '22023';
    END IF;
  ELSIF NULLIF(trim(p_note), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo para devolver a demanda a uma etapa anterior.' USING ERRCODE = '22023';
  END IF;

  IF v_to.category IN ('execution', 'review', 'done') AND v_to.position > v_from.position AND v_demand.responsible_id IS NULL THEN
    RAISE EXCEPTION 'Defina o responsável antes de avançar para "%".', v_to.name USING ERRCODE = '22023';
  END IF;
  IF v_to.category IN ('review', 'done') AND v_demand.approver_id IS NULL THEN
    RAISE EXCEPTION 'Defina o aprovador antes de enviar a demanda para conferência.' USING ERRCODE = '22023';
  END IF;
  IF v_to.category = 'done' AND (v_from.category <> 'review' OR auth.uid() IS DISTINCT FROM v_demand.approver_id) THEN
    RAISE EXCEPTION 'Somente o aprovador definido pode concluir a conferência e encerrar a demanda.' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.service_demand_note', COALESCE(trim(p_note), ''), true);
  UPDATE public.service_demands SET
    stage_id = v_to.id,
    status = CASE WHEN v_to.category = 'done' THEN 'closed' ELSE status END,
    approved_by = CASE WHEN v_to.category = 'done' THEN auth.uid() ELSE approved_by END,
    approved_at = CASE WHEN v_to.category = 'done' THEN now() ELSE approved_at END,
    closed_at = CASE WHEN v_to.category = 'done' THEN now() ELSE closed_at END,
    updated_by = auth.uid()
  WHERE id = p_demand_id AND company_id = v_company_id;
  PERFORM set_config('app.service_demand_note', '', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_service_demand(
  p_demand_id UUID,
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
    RAISE EXCEPTION 'Informe o motivo do cancelamento.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.service_demands SET
    status = 'canceled',
    cancel_reason = trim(p_reason),
    closed_at = now(),
    updated_by = auth.uid()
  WHERE id = p_demand_id AND company_id = v_company_id AND status = 'open';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demanda aberta não encontrada.' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_service_demand_comment(
  p_demand_id UUID,
  p_body TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
  v_comment_id UUID := gen_random_uuid();
BEGIN
  IF NULLIF(trim(p_body), '') IS NULL OR char_length(trim(p_body)) > 4000 THEN
    RAISE EXCEPTION 'Escreva um comentário de até 4.000 caracteres.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.service_demands WHERE id = p_demand_id AND company_id = v_company_id) THEN
    RAISE EXCEPTION 'Demanda não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.service_demand_comments (id, company_id, demand_id, body, author_id)
  VALUES (v_comment_id, v_company_id, p_demand_id, trim(p_body), auth.uid());
  RETURN v_comment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_service_demand_evidence(
  p_demand_id UUID,
  p_label TEXT,
  p_url TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
  v_evidence_id UUID := gen_random_uuid();
  v_stage_id UUID;
BEGIN
  IF NULLIF(trim(p_label), '') IS NULL OR char_length(trim(p_label)) > 200 THEN
    RAISE EXCEPTION 'Descreva a evidência em até 200 caracteres.' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(trim(p_url), '') IS NULL OR trim(p_url) !~* '^https://' THEN
    RAISE EXCEPTION 'O link da evidência deve começar com https://.' USING ERRCODE = '22023';
  END IF;
  SELECT stage_id INTO v_stage_id
  FROM public.service_demands
  WHERE id = p_demand_id AND company_id = v_company_id AND status = 'open';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demanda aberta não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.service_demand_evidences (id, company_id, demand_id, stage_id, label, url, added_by)
  VALUES (v_evidence_id, v_company_id, p_demand_id, v_stage_id, trim(p_label), trim(p_url), auth.uid());
  RETURN v_evidence_id;
END;
$$;

REVOKE ALL ON FUNCTION public.service_demands_write_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.service_demands_assert_profile(UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.service_demands_create_default_stages(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_service_demand_type(UUID, TEXT, TEXT, INTEGER, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ensure_default_service_demand_types() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_service_demand_stage(UUID, UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_service_demand(UUID, TEXT, TEXT, TEXT, DATE, UUID, UUID, UUID, UUID, UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_service_demand(UUID, TEXT, TEXT, TEXT, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_service_demand(UUID, UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.move_service_demand(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_service_demand(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_service_demand_comment(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_service_demand_evidence(UUID, TEXT, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.save_service_demand_type(UUID, TEXT, TEXT, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_default_service_demand_types() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_service_demand_stage(UUID, UUID, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_service_demand(UUID, TEXT, TEXT, TEXT, DATE, UUID, UUID, UUID, UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_service_demand(UUID, TEXT, TEXT, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_service_demand(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_service_demand(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_service_demand(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_service_demand_comment(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_service_demand_evidence(UUID, TEXT, TEXT) TO authenticated;

COMMENT ON TABLE public.service_demand_types IS 'Tipos de demanda operacional (ex.: reposição de posto, ausência) com prazo padrão.';
COMMENT ON TABLE public.service_demand_stages IS 'Etapas configuráveis por tipo: abertura, triagem/execução, conferência e encerramento.';
COMMENT ON TABLE public.service_demands IS 'Demandas operacionais com responsável, aprovador, prazo, prioridade e vínculo opcional com contrato/posto/alocação/funcionário.';
COMMENT ON TABLE public.service_demand_comments IS 'Comentários das demandas; somente inclusão.';
COMMENT ON TABLE public.service_demand_evidences IS 'Evidências das demandas como links https; somente inclusão.';
COMMENT ON TABLE public.service_demand_events IS 'Histórico das demandas e da configuração de tipos/etapas, sem valores de campos.';
