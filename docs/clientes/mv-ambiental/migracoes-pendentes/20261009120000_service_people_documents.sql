-- Story 1.64 — Pessoas e documentação: checklist de documentos com validade e
-- conferência, férias e afastamentos, entrega de uniformes/EPIs e transferência
-- de funcionário entre postos. Fase 3 do Roadmap do MVP da MV Ambiental.
-- Depende das migrações das Stories 1.62 (contratos, postos, alocações) e 1.63.
-- Escrita somente por RPCs SECURITY DEFINER; o tenant vem sempre da sessão.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

-- Itens do checklist. Alvo "employee": exigido de cada funcionário alocado
-- (em qualquer posto, num contrato ou num posto específico). Alvo "contract":
-- exigido do contrato (de todos os contratos ativos ou de um contrato).
CREATE TABLE public.service_document_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target TEXT NOT NULL,
  contract_id UUID,
  post_id UUID,
  validity_months INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_document_requirements_contract_fk
    FOREIGN KEY (contract_id, company_id) REFERENCES public.service_contracts(id, company_id) ON DELETE CASCADE,
  CONSTRAINT service_document_requirements_post_fk
    FOREIGN KEY (post_id, company_id) REFERENCES public.service_posts(id, company_id) ON DELETE CASCADE,
  CONSTRAINT service_document_requirements_target_check CHECK (target IN ('employee', 'contract')),
  CONSTRAINT service_document_requirements_post_scope_check
    CHECK (post_id IS NULL OR (target = 'employee' AND contract_id IS NOT NULL)),
  CONSTRAINT service_document_requirements_validity_check
    CHECK (validity_months IS NULL OR validity_months BETWEEN 1 AND 120),
  CONSTRAINT service_document_requirements_id_company_unique UNIQUE (id, company_id)
);

CREATE UNIQUE INDEX service_document_requirements_name_idx
  ON public.service_document_requirements(
    company_id, lower(name),
    COALESCE(contract_id, '00000000-0000-0000-0000-000000000000'::UUID),
    COALESCE(post_id, '00000000-0000-0000-0000-000000000000'::UUID)
  );

-- Cada entrega gera um registro novo; o mais recente de cada item/alvo vale.
-- Arquivos ficam no Drive no piloto: o registro guarda somente o link https.
CREATE TABLE public.service_document_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  requirement_id UUID NOT NULL,
  employee_id UUID,
  contract_id UUID,
  status TEXT NOT NULL DEFAULT 'submitted',
  issued_on DATE,
  expires_on DATE,
  document_url TEXT NOT NULL,
  notes TEXT,
  submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_document_records_requirement_fk
    FOREIGN KEY (requirement_id, company_id) REFERENCES public.service_document_requirements(id, company_id) ON DELETE CASCADE,
  CONSTRAINT service_document_records_employee_fk
    FOREIGN KEY (employee_id, company_id) REFERENCES public.employees(id, company_id),
  CONSTRAINT service_document_records_contract_fk
    FOREIGN KEY (contract_id, company_id) REFERENCES public.service_contracts(id, company_id),
  CONSTRAINT service_document_records_one_target_check CHECK (num_nonnulls(employee_id, contract_id) = 1),
  CONSTRAINT service_document_records_status_check CHECK (status IN ('submitted', 'verified', 'rejected')),
  CONSTRAINT service_document_records_url_check CHECK (document_url ~* '^https://'),
  CONSTRAINT service_document_records_period_check
    CHECK (issued_on IS NULL OR expires_on IS NULL OR expires_on >= issued_on),
  CONSTRAINT service_document_records_review_check
    CHECK (status = 'submitted' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)),
  CONSTRAINT service_document_records_rejection_check
    CHECK (status <> 'rejected' OR review_note IS NOT NULL)
);

-- Férias e afastamentos. Sem motivo médico: o campo de observação não deve
-- receber CID ou diagnóstico.
CREATE TABLE public.service_employee_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  kind TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  canceled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_employee_absences_employee_fk
    FOREIGN KEY (employee_id, company_id) REFERENCES public.employees(id, company_id),
  CONSTRAINT service_employee_absences_kind_check CHECK (kind IN ('vacation', 'medical_leave', 'leave', 'other')),
  CONSTRAINT service_employee_absences_period_check CHECK (end_date >= start_date AND end_date - start_date <= 730),
  CONSTRAINT service_employee_absences_cancel_check CHECK (canceled_at IS NULL OR cancel_reason IS NOT NULL)
);

CREATE TABLE public.service_equipment_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  post_id UUID,
  category TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  size TEXT,
  ca_number TEXT,
  delivered_on DATE NOT NULL,
  replace_by DATE,
  evidence_url TEXT,
  notes TEXT,
  returned_on DATE,
  return_note TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_equipment_deliveries_employee_fk
    FOREIGN KEY (employee_id, company_id) REFERENCES public.employees(id, company_id),
  CONSTRAINT service_equipment_deliveries_post_fk
    FOREIGN KEY (post_id, company_id) REFERENCES public.service_posts(id, company_id),
  CONSTRAINT service_equipment_deliveries_category_check CHECK (category IN ('uniform', 'ppe')),
  CONSTRAINT service_equipment_deliveries_quantity_check CHECK (quantity BETWEEN 1 AND 100),
  CONSTRAINT service_equipment_deliveries_ca_check CHECK (category <> 'ppe' OR ca_number IS NOT NULL),
  CONSTRAINT service_equipment_deliveries_url_check CHECK (evidence_url IS NULL OR evidence_url ~* '^https://'),
  CONSTRAINT service_equipment_deliveries_replace_check CHECK (replace_by IS NULL OR replace_by >= delivered_on),
  CONSTRAINT service_equipment_deliveries_return_check CHECK (returned_on IS NULL OR returned_on >= delivered_on)
);

-- Histórico de pessoas e documentação: nomes de campos e nota, sem valores.
CREATE TABLE public.service_people_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.service_contracts(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  changed_fields TEXT[] NOT NULL DEFAULT '{}',
  note TEXT,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_people_events_entity_check
    CHECK (entity_type IN ('requirement', 'document', 'absence', 'equipment'))
);

CREATE INDEX service_document_requirements_company_idx ON public.service_document_requirements(company_id, target, is_active);
CREATE INDEX service_document_records_lookup_idx ON public.service_document_records(company_id, requirement_id, employee_id, contract_id, created_at DESC);
CREATE INDEX service_employee_absences_period_idx ON public.service_employee_absences(company_id, employee_id, start_date, end_date);
CREATE INDEX service_equipment_deliveries_employee_idx ON public.service_equipment_deliveries(company_id, employee_id, delivered_on DESC);
CREATE INDEX service_people_events_employee_idx ON public.service_people_events(company_id, employee_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS: leitura por empresa da sessão e papel de gestão; escrita só por RPC.
-- ---------------------------------------------------------------------------

ALTER TABLE public.service_document_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_document_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_employee_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_equipment_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_people_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestores visualizam checklist de documentos da empresa"
ON public.service_document_requirements FOR SELECT TO authenticated
USING (company_id = (SELECT public.get_user_company_id()) AND (SELECT public.get_user_role()) IN ('admin', 'manager'));

CREATE POLICY "Gestores visualizam documentos entregues da empresa"
ON public.service_document_records FOR SELECT TO authenticated
USING (company_id = (SELECT public.get_user_company_id()) AND (SELECT public.get_user_role()) IN ('admin', 'manager'));

CREATE POLICY "Gestores visualizam férias e afastamentos da empresa"
ON public.service_employee_absences FOR SELECT TO authenticated
USING (company_id = (SELECT public.get_user_company_id()) AND (SELECT public.get_user_role()) IN ('admin', 'manager'));

CREATE POLICY "Gestores visualizam entregas de uniformes e EPIs"
ON public.service_equipment_deliveries FOR SELECT TO authenticated
USING (company_id = (SELECT public.get_user_company_id()) AND (SELECT public.get_user_role()) IN ('admin', 'manager'));

CREATE POLICY "Gestores visualizam histórico de pessoas e documentos"
ON public.service_people_events FOR SELECT TO authenticated
USING (company_id = (SELECT public.get_user_company_id()) AND (SELECT public.get_user_role()) IN ('admin', 'manager'));

REVOKE INSERT, UPDATE, DELETE ON public.service_document_requirements FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.service_document_records FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.service_employee_absences FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.service_equipment_deliveries FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.service_people_events FROM anon, authenticated;
GRANT SELECT ON
  public.service_document_requirements,
  public.service_document_records,
  public.service_employee_absences,
  public.service_equipment_deliveries,
  public.service_people_events
TO authenticated;

-- ---------------------------------------------------------------------------
-- Gatilhos: updated_at e histórico
-- ---------------------------------------------------------------------------

CREATE TRIGGER service_document_requirements_touch_updated_at
BEFORE UPDATE ON public.service_document_requirements
FOR EACH ROW EXECUTE FUNCTION public.people_touch_updated_at();

CREATE TRIGGER service_document_records_touch_updated_at
BEFORE UPDATE ON public.service_document_records
FOR EACH ROW EXECUTE FUNCTION public.people_touch_updated_at();

CREATE TRIGGER service_employee_absences_touch_updated_at
BEFORE UPDATE ON public.service_employee_absences
FOR EACH ROW EXECUTE FUNCTION public.people_touch_updated_at();

CREATE TRIGGER service_equipment_deliveries_touch_updated_at
BEFORE UPDATE ON public.service_equipment_deliveries
FOR EACH ROW EXECUTE FUNCTION public.people_touch_updated_at();

CREATE OR REPLACE FUNCTION public.service_people_write_event()
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
  v_changed_fields TEXT[] := '{}';
BEGIN
  v_entity := CASE TG_TABLE_NAME
    WHEN 'service_document_requirements' THEN 'requirement'
    WHEN 'service_document_records' THEN 'document'
    WHEN 'service_employee_absences' THEN 'absence'
    ELSE 'equipment'
  END;

  IF TG_OP = 'INSERT' THEN
    v_event_type := CASE v_entity
      WHEN 'requirement' THEN 'requirement_created'
      WHEN 'document' THEN 'document_submitted'
      WHEN 'absence' THEN 'absence_registered'
      ELSE 'equipment_delivered'
    END;
  ELSE
    v_old := to_jsonb(OLD);
    SELECT COALESCE(array_agg(key ORDER BY key), '{}')
    INTO v_changed_fields
    FROM jsonb_object_keys(v_new) AS key
    WHERE key NOT IN ('updated_at', 'updated_by', 'reviewed_at', 'reviewed_by', 'canceled_at')
      AND v_new -> key IS DISTINCT FROM v_old -> key;
    IF cardinality(v_changed_fields) = 0 THEN
      RETURN NEW;
    END IF;

    IF v_entity = 'document' AND (v_new ->> 'status') IS DISTINCT FROM (v_old ->> 'status') THEN
      v_event_type := 'document_' || (v_new ->> 'status');
      v_note := v_new ->> 'review_note';
    ELSIF v_entity = 'absence' AND (v_new ->> 'canceled_at') IS NOT NULL AND (v_old ->> 'canceled_at') IS NULL THEN
      v_event_type := 'absence_canceled';
      v_note := v_new ->> 'cancel_reason';
    ELSIF v_entity = 'equipment' AND (v_new ->> 'returned_on') IS NOT NULL AND (v_old ->> 'returned_on') IS NULL THEN
      v_event_type := 'equipment_returned';
      v_note := v_new ->> 'return_note';
    ELSE
      v_event_type := v_entity || '_updated';
    END IF;
  END IF;

  INSERT INTO public.service_people_events (
    company_id, employee_id, contract_id, entity_type, entity_id, event_type, changed_fields, note, actor_id
  ) VALUES (
    NEW.company_id,
    (v_new ->> 'employee_id')::UUID,
    (v_new ->> 'contract_id')::UUID,
    v_entity, NEW.id, v_event_type, v_changed_fields, v_note, auth.uid()
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER service_document_requirements_write_event
AFTER INSERT OR UPDATE ON public.service_document_requirements
FOR EACH ROW EXECUTE FUNCTION public.service_people_write_event();

CREATE TRIGGER service_document_records_write_event
AFTER INSERT OR UPDATE ON public.service_document_records
FOR EACH ROW EXECUTE FUNCTION public.service_people_write_event();

CREATE TRIGGER service_employee_absences_write_event
AFTER INSERT OR UPDATE ON public.service_employee_absences
FOR EACH ROW EXECUTE FUNCTION public.service_people_write_event();

CREATE TRIGGER service_equipment_deliveries_write_event
AFTER INSERT OR UPDATE ON public.service_equipment_deliveries
FOR EACH ROW EXECUTE FUNCTION public.service_people_write_event();

-- ---------------------------------------------------------------------------
-- Funções de apoio
-- ---------------------------------------------------------------------------

-- Funcionário da empresa que não foi removido (desligados entram quando p_allow_terminated).
CREATE OR REPLACE FUNCTION public.service_people_assert_employee(
  p_company_id UUID,
  p_employee_id UUID,
  p_allow_terminated BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.employees
    WHERE id = p_employee_id AND company_id = p_company_id AND deleted_at IS NULL
      AND (p_allow_terminated OR status <> 'terminated')
  ) THEN
    RAISE EXCEPTION 'Funcionário não encontrado ou desligado.' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPCs do checklist de documentos
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.save_document_requirement(
  p_requirement_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_target TEXT,
  p_contract_id UUID,
  p_post_id UUID,
  p_validity_months INTEGER,
  p_is_active BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
  v_requirement_id UUID := COALESCE(p_requirement_id, gen_random_uuid());
  v_current RECORD;
BEGIN
  IF NULLIF(trim(p_name), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o nome do documento.' USING ERRCODE = '22023';
  END IF;
  IF p_target NOT IN ('employee', 'contract') THEN
    RAISE EXCEPTION 'Informe se o documento é exigido do funcionário ou do contrato.' USING ERRCODE = '22023';
  END IF;
  IF p_validity_months IS NOT NULL AND (p_validity_months < 1 OR p_validity_months > 120) THEN
    RAISE EXCEPTION 'A validade deve estar entre 1 e 120 meses.' USING ERRCODE = '22023';
  END IF;
  IF p_post_id IS NOT NULL AND (p_target <> 'employee' OR p_contract_id IS NULL) THEN
    RAISE EXCEPTION 'Documento de posto específico deve ser do funcionário e indicar o contrato.' USING ERRCODE = '22023';
  END IF;
  IF p_contract_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.service_contracts
    WHERE id = p_contract_id AND company_id = v_company_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Contrato não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF p_post_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.service_posts
    WHERE id = p_post_id AND contract_id = p_contract_id AND company_id = v_company_id
  ) THEN
    RAISE EXCEPTION 'O posto informado não pertence ao contrato selecionado.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    IF p_requirement_id IS NULL THEN
      INSERT INTO public.service_document_requirements (
        id, company_id, name, description, target, contract_id, post_id, validity_months, is_active, created_by, updated_by
      ) VALUES (
        v_requirement_id, v_company_id, trim(p_name), NULLIF(trim(p_description), ''), p_target, p_contract_id,
        p_post_id, p_validity_months, COALESCE(p_is_active, true), auth.uid(), auth.uid()
      );
    ELSE
      SELECT target, contract_id, post_id INTO v_current
      FROM public.service_document_requirements
      WHERE id = p_requirement_id AND company_id = v_company_id
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Documento do checklist não encontrado.' USING ERRCODE = 'P0002';
      END IF;
      -- Alvo e abrangência definem a quem os registros já entregues pertencem.
      IF v_current.target <> p_target
         OR v_current.contract_id IS DISTINCT FROM p_contract_id
         OR v_current.post_id IS DISTINCT FROM p_post_id THEN
        RAISE EXCEPTION 'Alvo e abrangência não mudam depois de criados. Desative o item e cadastre outro.' USING ERRCODE = '22023';
      END IF;
      UPDATE public.service_document_requirements SET
        name = trim(p_name),
        description = NULLIF(trim(p_description), ''),
        validity_months = p_validity_months,
        is_active = COALESCE(p_is_active, true),
        updated_by = auth.uid()
      WHERE id = p_requirement_id AND company_id = v_company_id;
    END IF;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Já existe um documento com este nome nesta abrangência.' USING ERRCODE = '23505';
  END;

  RETURN v_requirement_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_document_record(
  p_requirement_id UUID,
  p_employee_id UUID,
  p_contract_id UUID,
  p_document_url TEXT,
  p_issued_on DATE,
  p_expires_on DATE,
  p_notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
  v_record_id UUID := gen_random_uuid();
  v_requirement RECORD;
  v_expires_on DATE := p_expires_on;
BEGIN
  SELECT target, contract_id, post_id, validity_months INTO v_requirement
  FROM public.service_document_requirements
  WHERE id = p_requirement_id AND company_id = v_company_id AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Documento do checklist não encontrado ou inativo.' USING ERRCODE = 'P0002';
  END IF;
  IF NULLIF(trim(p_document_url), '') IS NULL OR trim(p_document_url) !~* '^https://' THEN
    RAISE EXCEPTION 'O link do documento deve começar com https://.' USING ERRCODE = '22023';
  END IF;

  IF v_requirement.target = 'employee' THEN
    IF p_employee_id IS NULL OR p_contract_id IS NOT NULL THEN
      RAISE EXCEPTION 'Este documento é exigido do funcionário.' USING ERRCODE = '22023';
    END IF;
    PERFORM public.service_people_assert_employee(v_company_id, p_employee_id, false);
    IF v_requirement.contract_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.service_post_allocations allocation
      JOIN public.service_posts post ON post.id = allocation.post_id AND post.company_id = allocation.company_id
      WHERE allocation.company_id = v_company_id
        AND allocation.employee_id = p_employee_id
        AND post.contract_id = v_requirement.contract_id
        AND (v_requirement.post_id IS NULL OR post.id = v_requirement.post_id)
        AND (allocation.end_date IS NULL OR allocation.end_date >= current_date)
    ) THEN
      RAISE EXCEPTION 'O funcionário não está alocado no contrato ou posto deste documento.' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF p_contract_id IS NULL OR p_employee_id IS NOT NULL THEN
      RAISE EXCEPTION 'Este documento é exigido do contrato.' USING ERRCODE = '22023';
    END IF;
    IF v_requirement.contract_id IS NOT NULL AND v_requirement.contract_id <> p_contract_id THEN
      RAISE EXCEPTION 'Este documento é exigido de outro contrato.' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.service_contracts
      WHERE id = p_contract_id AND company_id = v_company_id AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Contrato não encontrado.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF v_expires_on IS NULL AND v_requirement.validity_months IS NOT NULL THEN
    IF p_issued_on IS NULL THEN
      RAISE EXCEPTION 'Informe a data de emissão ou a de validade do documento.' USING ERRCODE = '22023';
    END IF;
    v_expires_on := (p_issued_on + make_interval(months => v_requirement.validity_months))::DATE - 1;
  END IF;
  IF p_issued_on IS NOT NULL AND v_expires_on IS NOT NULL AND v_expires_on < p_issued_on THEN
    RAISE EXCEPTION 'A validade deve ser igual ou posterior à emissão.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.service_document_records (
    id, company_id, requirement_id, employee_id, contract_id, issued_on, expires_on, document_url, notes, submitted_by
  ) VALUES (
    v_record_id, v_company_id, p_requirement_id, p_employee_id, p_contract_id, p_issued_on, v_expires_on,
    trim(p_document_url), NULLIF(trim(p_notes), ''), auth.uid()
  );
  RETURN v_record_id;
END;
$$;

-- Conferência: aprova ou recusa um registro ainda não conferido. Recusa exige motivo.
CREATE OR REPLACE FUNCTION public.review_document_record(
  p_record_id UUID,
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
BEGIN
  IF p_approve IS NULL THEN
    RAISE EXCEPTION 'Informe se o documento foi aprovado ou recusado.' USING ERRCODE = '22023';
  END IF;
  IF NOT p_approve AND NULLIF(trim(p_note), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da recusa.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.service_document_records SET
    status = CASE WHEN p_approve THEN 'verified' ELSE 'rejected' END,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_note = NULLIF(trim(p_note), '')
  WHERE id = p_record_id AND company_id = v_company_id AND status = 'submitted';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Documento aguardando conferência não encontrado.' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPCs de férias e afastamentos
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.register_employee_absence(
  p_employee_id UUID,
  p_kind TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
  v_absence_id UUID := gen_random_uuid();
BEGIN
  IF p_kind NOT IN ('vacation', 'medical_leave', 'leave', 'other') THEN
    RAISE EXCEPTION 'Tipo de ausência inválido.' USING ERRCODE = '22023';
  END IF;
  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RAISE EXCEPTION 'Informe o início e o fim da ausência.' USING ERRCODE = '22023';
  END IF;
  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'O fim da ausência deve ser igual ou posterior ao início.' USING ERRCODE = '22023';
  END IF;
  IF p_end_date - p_start_date > 730 THEN
    RAISE EXCEPTION 'Registre ausências de até dois anos por vez.' USING ERRCODE = '22023';
  END IF;
  PERFORM public.service_people_assert_employee(v_company_id, p_employee_id, false);

  -- Evita períodos sobrepostos para o mesmo funcionário sem corrida entre gestores.
  PERFORM pg_advisory_xact_lock(hashtext('service_employee_absences:' || p_employee_id::TEXT));
  IF EXISTS (
    SELECT 1 FROM public.service_employee_absences
    WHERE company_id = v_company_id AND employee_id = p_employee_id AND canceled_at IS NULL
      AND start_date <= p_end_date AND end_date >= p_start_date
  ) THEN
    RAISE EXCEPTION 'Já existe férias ou afastamento registrado neste período.' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.service_employee_absences (
    id, company_id, employee_id, kind, start_date, end_date, notes, created_by, updated_by
  ) VALUES (
    v_absence_id, v_company_id, p_employee_id, p_kind, p_start_date, p_end_date,
    NULLIF(trim(p_notes), ''), auth.uid(), auth.uid()
  );
  RETURN v_absence_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_employee_absence(
  p_absence_id UUID,
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
  UPDATE public.service_employee_absences SET
    canceled_at = now(),
    cancel_reason = trim(p_reason),
    updated_by = auth.uid()
  WHERE id = p_absence_id AND company_id = v_company_id AND canceled_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ausência não encontrada ou já cancelada.' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPCs de uniformes e EPIs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.register_equipment_delivery(
  p_employee_id UUID,
  p_post_id UUID,
  p_category TEXT,
  p_item_name TEXT,
  p_quantity INTEGER,
  p_size TEXT,
  p_ca_number TEXT,
  p_delivered_on DATE,
  p_replace_by DATE,
  p_evidence_url TEXT,
  p_notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
  v_delivery_id UUID := gen_random_uuid();
BEGIN
  IF p_category NOT IN ('uniform', 'ppe') THEN
    RAISE EXCEPTION 'Informe se a entrega é de uniforme ou EPI.' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(trim(p_item_name), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o item entregue.' USING ERRCODE = '22023';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 100 THEN
    RAISE EXCEPTION 'A quantidade deve estar entre 1 e 100.' USING ERRCODE = '22023';
  END IF;
  IF p_category = 'ppe' AND NULLIF(trim(p_ca_number), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o número do CA do EPI.' USING ERRCODE = '22023';
  END IF;
  IF p_delivered_on IS NULL THEN
    RAISE EXCEPTION 'Informe a data da entrega.' USING ERRCODE = '22023';
  END IF;
  IF p_replace_by IS NOT NULL AND p_replace_by < p_delivered_on THEN
    RAISE EXCEPTION 'A data de troca deve ser igual ou posterior à entrega.' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(trim(p_evidence_url), '') IS NOT NULL AND trim(p_evidence_url) !~* '^https://' THEN
    RAISE EXCEPTION 'O link do comprovante deve começar com https://.' USING ERRCODE = '22023';
  END IF;
  PERFORM public.service_people_assert_employee(v_company_id, p_employee_id, false);
  IF p_post_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.service_posts WHERE id = p_post_id AND company_id = v_company_id
  ) THEN
    RAISE EXCEPTION 'Posto não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.service_equipment_deliveries (
    id, company_id, employee_id, post_id, category, item_name, quantity, size, ca_number,
    delivered_on, replace_by, evidence_url, notes, created_by, updated_by
  ) VALUES (
    v_delivery_id, v_company_id, p_employee_id, p_post_id, p_category, trim(p_item_name), p_quantity,
    NULLIF(trim(p_size), ''),
    CASE WHEN p_category = 'ppe' THEN trim(p_ca_number) ELSE NULLIF(trim(p_ca_number), '') END,
    p_delivered_on, p_replace_by, NULLIF(trim(p_evidence_url), ''), NULLIF(trim(p_notes), ''), auth.uid(), auth.uid()
  );
  RETURN v_delivery_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.return_equipment_delivery(
  p_delivery_id UUID,
  p_returned_on DATE,
  p_note TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
  v_delivered_on DATE;
BEGIN
  IF p_returned_on IS NULL THEN
    RAISE EXCEPTION 'Informe a data da devolução.' USING ERRCODE = '22023';
  END IF;
  SELECT delivered_on INTO v_delivered_on
  FROM public.service_equipment_deliveries
  WHERE id = p_delivery_id AND company_id = v_company_id AND returned_on IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entrega em uso não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF p_returned_on < v_delivered_on THEN
    RAISE EXCEPTION 'A devolução deve ser igual ou posterior à entrega.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.service_equipment_deliveries SET
    returned_on = p_returned_on,
    return_note = NULLIF(trim(p_note), ''),
    updated_by = auth.uid()
  WHERE id = p_delivery_id AND company_id = v_company_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Movimentação: transfere o funcionário para outro posto numa só operação.
-- A alocação atual termina no dia anterior e a nova começa na data informada,
-- com o mesmo papel (titular ou substituto).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.transfer_post_allocation(
  p_allocation_id UUID,
  p_to_post_id UUID,
  p_transfer_date DATE,
  p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
  v_new_allocation_id UUID := gen_random_uuid();
  v_current RECORD;
  v_from_post_name TEXT;
BEGIN
  IF p_transfer_date IS NULL OR NULLIF(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Informe a data e o motivo da transferência.' USING ERRCODE = '22023';
  END IF;

  SELECT allocation.post_id, allocation.employee_id, allocation.allocation_role, allocation.start_date, post.name AS post_name
  INTO v_current
  FROM public.service_post_allocations allocation
  JOIN public.service_posts post ON post.id = allocation.post_id AND post.company_id = allocation.company_id
  WHERE allocation.id = p_allocation_id AND allocation.company_id = v_company_id AND allocation.end_date IS NULL
  FOR UPDATE OF allocation;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Alocação aberta não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF v_current.post_id = p_to_post_id THEN
    RAISE EXCEPTION 'Escolha um posto diferente do atual.' USING ERRCODE = '22023';
  END IF;
  IF p_transfer_date <= v_current.start_date THEN
    RAISE EXCEPTION 'A transferência deve ser posterior ao início da alocação atual. Para corrigir uma alocação recém-criada, encerre-a e aloque de novo.' USING ERRCODE = '22023';
  END IF;
  v_from_post_name := v_current.post_name;

  PERFORM 1 FROM public.service_posts
  WHERE id = p_to_post_id AND company_id = v_company_id AND status = 'active'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Posto de destino não encontrado ou inativo.' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.service_people_assert_employee(v_company_id, v_current.employee_id, false);
  IF EXISTS (
    SELECT 1 FROM public.service_post_allocations
    WHERE post_id = p_to_post_id AND employee_id = v_current.employee_id AND company_id = v_company_id
      AND (end_date IS NULL OR end_date >= p_transfer_date)
  ) THEN
    RAISE EXCEPTION 'Este funcionário já possui alocação aberta no posto de destino.' USING ERRCODE = '23505';
  END IF;

  UPDATE public.service_post_allocations SET
    end_date = p_transfer_date - 1,
    end_reason = 'Transferência: ' || trim(p_reason),
    updated_by = auth.uid()
  WHERE id = p_allocation_id AND company_id = v_company_id;

  INSERT INTO public.service_post_allocations (
    id, company_id, post_id, employee_id, allocation_role, start_date, notes, created_by, updated_by
  ) VALUES (
    v_new_allocation_id, v_company_id, p_to_post_id, v_current.employee_id, v_current.allocation_role, p_transfer_date,
    left('Transferido de ' || v_from_post_name || ': ' || trim(p_reason), 1000), auth.uid(), auth.uid()
  );
  RETURN v_new_allocation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.service_people_write_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.service_people_assert_employee(UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_document_requirement(UUID, TEXT, TEXT, TEXT, UUID, UUID, INTEGER, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_document_record(UUID, UUID, UUID, TEXT, DATE, DATE, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_document_record(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_employee_absence(UUID, TEXT, DATE, DATE, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_employee_absence(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_equipment_delivery(UUID, UUID, TEXT, TEXT, INTEGER, TEXT, TEXT, DATE, DATE, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.return_equipment_delivery(UUID, DATE, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transfer_post_allocation(UUID, UUID, DATE, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.save_document_requirement(UUID, TEXT, TEXT, TEXT, UUID, UUID, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_document_record(UUID, UUID, UUID, TEXT, DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_document_record(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_employee_absence(UUID, TEXT, DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_employee_absence(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_equipment_delivery(UUID, UUID, TEXT, TEXT, INTEGER, TEXT, TEXT, DATE, DATE, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.return_equipment_delivery(UUID, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_post_allocation(UUID, UUID, DATE, TEXT) TO authenticated;

COMMENT ON TABLE public.service_document_requirements IS 'Checklist de documentos exigidos do funcionário alocado ou do contrato, com validade em meses.';
COMMENT ON TABLE public.service_document_records IS 'Entregas de documentos (link https) com validade e conferência; o registro mais recente de cada item vale.';
COMMENT ON TABLE public.service_employee_absences IS 'Férias e afastamentos que tiram o titular da cobertura do posto; sem diagnóstico ou CID.';
COMMENT ON TABLE public.service_equipment_deliveries IS 'Entregas de uniformes e EPIs (com CA) por funcionário, com data de troca e devolução.';
COMMENT ON TABLE public.service_people_events IS 'Histórico do checklist, documentos, ausências e entregas, sem valores de campos.';
