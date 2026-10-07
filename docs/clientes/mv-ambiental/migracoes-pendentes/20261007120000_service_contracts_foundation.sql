-- Story 1.62 — Contratos terceirizados: contratos versionados, postos e alocações.
-- Fase 1 do Roadmap do MVP da MV Ambiental (docs/clientes/mv-ambiental).
-- O módulo registra somente dados informados pelo gestor. Não interpreta
-- convenções coletivas, não calcula folha e não declara conformidade.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

CREATE TABLE public.service_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  title TEXT NOT NULL,
  contract_number TEXT,
  location TEXT,
  scope_summary TEXT,
  start_date DATE,
  end_date DATE,
  cct_reference TEXT,
  source_documents_url TEXT,
  validation_status TEXT NOT NULL DEFAULT 'pending',
  status TEXT NOT NULL DEFAULT 'draft',
  internal_notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT service_contracts_validation_status_check CHECK (validation_status IN ('pending', 'confirmed', 'historical')),
  CONSTRAINT service_contracts_status_check CHECK (status IN ('draft', 'active', 'suspended', 'closed')),
  CONSTRAINT service_contracts_period_check CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date),
  -- Contrato ativo somente com vigência conferida (roadmap §5: "antes de cadastrar
  -- como contrato ativo, é necessário localizar o instrumento atual e seus aditivos").
  CONSTRAINT service_contracts_active_requires_confirmed CHECK (status <> 'active' OR validation_status = 'confirmed'),
  CONSTRAINT service_contracts_source_url_check CHECK (source_documents_url IS NULL OR source_documents_url ~* '^https://'),
  CONSTRAINT service_contracts_id_company_unique UNIQUE (id, company_id)
);

-- Instrumento original e aditivos. Cada versão guarda a própria vigência e
-- situação de conferência; o histórico nunca é sobrescrito por um aditivo novo.
CREATE TABLE public.service_contract_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  contract_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  signed_at DATE,
  effective_start DATE,
  effective_end DATE,
  document_url TEXT,
  change_summary TEXT,
  validation_status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_contract_versions_contract_fk
    FOREIGN KEY (contract_id, company_id)
    REFERENCES public.service_contracts(id, company_id) ON DELETE CASCADE,
  CONSTRAINT service_contract_versions_kind_check CHECK (kind IN ('original', 'amendment')),
  CONSTRAINT service_contract_versions_validation_status_check CHECK (validation_status IN ('pending', 'confirmed', 'historical')),
  CONSTRAINT service_contract_versions_period_check CHECK (effective_start IS NULL OR effective_end IS NULL OR effective_end >= effective_start),
  CONSTRAINT service_contract_versions_document_url_check CHECK (document_url IS NULL OR document_url ~* '^https://'),
  CONSTRAINT service_contract_versions_number_check CHECK (version_number > 0),
  CONSTRAINT service_contract_versions_number_unique UNIQUE (contract_id, version_number)
);

CREATE UNIQUE INDEX service_contract_versions_one_original_idx
  ON public.service_contract_versions(contract_id) WHERE kind = 'original';

CREATE TABLE public.service_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  contract_id UUID NOT NULL,
  name TEXT NOT NULL,
  job_function TEXT NOT NULL,
  work_schedule TEXT NOT NULL,
  required_headcount INTEGER NOT NULL,
  operational_manager_id UUID,
  requirements TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_posts_contract_fk
    FOREIGN KEY (contract_id, company_id)
    REFERENCES public.service_contracts(id, company_id) ON DELETE CASCADE,
  CONSTRAINT service_posts_manager_fk
    FOREIGN KEY (operational_manager_id, company_id)
    REFERENCES public.employees(id, company_id),
  CONSTRAINT service_posts_status_check CHECK (status IN ('active', 'inactive')),
  CONSTRAINT service_posts_headcount_check CHECK (required_headcount BETWEEN 1 AND 500),
  CONSTRAINT service_posts_id_company_unique UNIQUE (id, company_id)
);

CREATE TABLE public.service_post_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  post_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  allocation_role TEXT NOT NULL DEFAULT 'holder',
  start_date DATE NOT NULL,
  end_date DATE,
  end_reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_post_allocations_post_fk
    FOREIGN KEY (post_id, company_id)
    REFERENCES public.service_posts(id, company_id) ON DELETE CASCADE,
  CONSTRAINT service_post_allocations_employee_fk
    FOREIGN KEY (employee_id, company_id)
    REFERENCES public.employees(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT service_post_allocations_role_check CHECK (allocation_role IN ('holder', 'substitute')),
  CONSTRAINT service_post_allocations_period_check CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE public.service_contract_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.service_contracts(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  changed_fields TEXT[] NOT NULL DEFAULT '{}',
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_contract_audit_entity_type_check
    CHECK (entity_type IN ('contract', 'contract_version', 'post', 'allocation'))
);

CREATE INDEX service_contracts_company_status_idx
  ON public.service_contracts(company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX service_contracts_company_end_date_idx
  ON public.service_contracts(company_id, end_date) WHERE deleted_at IS NULL;
CREATE INDEX service_contract_versions_contract_idx
  ON public.service_contract_versions(company_id, contract_id, version_number);
CREATE INDEX service_posts_contract_idx
  ON public.service_posts(company_id, contract_id, status);
CREATE INDEX service_post_allocations_post_idx
  ON public.service_post_allocations(company_id, post_id, end_date);
CREATE INDEX service_post_allocations_employee_idx
  ON public.service_post_allocations(company_id, employee_id, end_date);
CREATE INDEX service_contract_audit_contract_created_idx
  ON public.service_contract_audit_events(company_id, contract_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS: leitura por empresa da sessão e papel de gestão; escrita só por RPC.
-- ---------------------------------------------------------------------------

ALTER TABLE public.service_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_contract_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_post_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_contract_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestores visualizam contratos da própria empresa"
ON public.service_contracts FOR SELECT TO authenticated
USING (
  company_id = (SELECT public.get_user_company_id())
  AND (SELECT public.get_user_role()) IN ('admin', 'manager')
  AND deleted_at IS NULL
);

CREATE POLICY "Gestores visualizam versões de contratos da própria empresa"
ON public.service_contract_versions FOR SELECT TO authenticated
USING (
  company_id = (SELECT public.get_user_company_id())
  AND (SELECT public.get_user_role()) IN ('admin', 'manager')
);

CREATE POLICY "Gestores visualizam postos da própria empresa"
ON public.service_posts FOR SELECT TO authenticated
USING (
  company_id = (SELECT public.get_user_company_id())
  AND (SELECT public.get_user_role()) IN ('admin', 'manager')
);

CREATE POLICY "Gestores visualizam alocações da própria empresa"
ON public.service_post_allocations FOR SELECT TO authenticated
USING (
  company_id = (SELECT public.get_user_company_id())
  AND (SELECT public.get_user_role()) IN ('admin', 'manager')
);

CREATE POLICY "Gestores visualizam auditoria de contratos da própria empresa"
ON public.service_contract_audit_events FOR SELECT TO authenticated
USING (
  company_id = (SELECT public.get_user_company_id())
  AND (SELECT public.get_user_role()) IN ('admin', 'manager')
);

REVOKE INSERT, UPDATE, DELETE ON public.service_contracts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.service_contract_versions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.service_posts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.service_post_allocations FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.service_contract_audit_events FROM anon, authenticated;
GRANT SELECT ON
  public.service_contracts,
  public.service_contract_versions,
  public.service_posts,
  public.service_post_allocations,
  public.service_contract_audit_events
TO authenticated;

-- ---------------------------------------------------------------------------
-- Funções de apoio
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.service_contracts_assert_manager()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.get_user_company_id();
  v_role TEXT := public.get_user_role();
BEGIN
  IF auth.uid() IS NULL OR v_company_id IS NULL OR v_role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Acesso não autorizado.' USING ERRCODE = '42501';
  END IF;
  RETURN v_company_id;
END;
$$;

CREATE TRIGGER service_contracts_touch_updated_at
BEFORE UPDATE ON public.service_contracts
FOR EACH ROW EXECUTE FUNCTION public.people_touch_updated_at();

CREATE TRIGGER service_contract_versions_touch_updated_at
BEFORE UPDATE ON public.service_contract_versions
FOR EACH ROW EXECUTE FUNCTION public.people_touch_updated_at();

CREATE TRIGGER service_posts_touch_updated_at
BEFORE UPDATE ON public.service_posts
FOR EACH ROW EXECUTE FUNCTION public.people_touch_updated_at();

CREATE TRIGGER service_post_allocations_touch_updated_at
BEFORE UPDATE ON public.service_post_allocations
FOR EACH ROW EXECUTE FUNCTION public.people_touch_updated_at();

-- Auditoria registra apenas nomes de campos alterados, nunca valores.
CREATE OR REPLACE FUNCTION public.service_contracts_write_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_entity_type TEXT := TG_ARGV[0];
  v_event_type TEXT;
  v_changed_fields TEXT[] := '{}';
  v_contract_id UUID;
  v_new JSONB := to_jsonb(NEW);
  v_old JSONB;
BEGIN
  IF v_entity_type = 'contract' THEN
    v_contract_id := NEW.id;
  ELSIF v_entity_type = 'allocation' THEN
    SELECT contract_id INTO v_contract_id FROM public.service_posts WHERE id = NEW.post_id;
  ELSE
    v_contract_id := (v_new ->> 'contract_id')::UUID;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_event_type := v_entity_type || '_created';
  ELSE
    v_old := to_jsonb(OLD);
    SELECT COALESCE(array_agg(key ORDER BY key), '{}')
    INTO v_changed_fields
    FROM jsonb_object_keys(v_new) AS key
    WHERE key NOT IN ('updated_at', 'updated_by')
      AND v_new -> key IS DISTINCT FROM v_old -> key;

    IF cardinality(v_changed_fields) = 0 THEN
      RETURN NEW;
    END IF;

    IF v_entity_type = 'contract' AND (v_new ->> 'deleted_at') IS NOT NULL AND (v_old ->> 'deleted_at') IS NULL THEN
      v_event_type := 'contract_removed';
    ELSIF v_entity_type = 'allocation' AND (v_new ->> 'end_date') IS NOT NULL AND (v_old ->> 'end_date') IS NULL THEN
      v_event_type := 'allocation_ended';
    ELSIF 'status' = ANY (v_changed_fields) THEN
      v_event_type := v_entity_type || '_status_changed';
    ELSIF 'validation_status' = ANY (v_changed_fields) THEN
      v_event_type := v_entity_type || '_validation_changed';
    ELSE
      v_event_type := v_entity_type || '_updated';
    END IF;
  END IF;

  INSERT INTO public.service_contract_audit_events (
    company_id, contract_id, entity_type, entity_id, event_type, changed_fields, actor_id
  ) VALUES (
    NEW.company_id, v_contract_id, v_entity_type, NEW.id, v_event_type, v_changed_fields, auth.uid()
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER service_contracts_write_audit_event
AFTER INSERT OR UPDATE ON public.service_contracts
FOR EACH ROW EXECUTE FUNCTION public.service_contracts_write_audit_event('contract');

CREATE TRIGGER service_contract_versions_write_audit_event
AFTER INSERT OR UPDATE ON public.service_contract_versions
FOR EACH ROW EXECUTE FUNCTION public.service_contracts_write_audit_event('contract_version');

CREATE TRIGGER service_posts_write_audit_event
AFTER INSERT OR UPDATE ON public.service_posts
FOR EACH ROW EXECUTE FUNCTION public.service_contracts_write_audit_event('post');

CREATE TRIGGER service_post_allocations_write_audit_event
AFTER INSERT OR UPDATE ON public.service_post_allocations
FOR EACH ROW EXECUTE FUNCTION public.service_contracts_write_audit_event('allocation');

-- ---------------------------------------------------------------------------
-- RPCs de escrita. O tenant vem sempre da sessão; nenhuma recebe company_id.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.save_service_contract(
  p_contract_id UUID,
  p_customer_id UUID,
  p_client_name TEXT,
  p_title TEXT,
  p_contract_number TEXT,
  p_location TEXT,
  p_scope_summary TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_cct_reference TEXT,
  p_source_documents_url TEXT,
  p_validation_status TEXT,
  p_status TEXT,
  p_internal_notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
  v_contract_id UUID := COALESCE(p_contract_id, gen_random_uuid());
BEGIN
  IF NULLIF(trim(p_client_name), '') IS NULL OR NULLIF(trim(p_title), '') IS NULL THEN
    RAISE EXCEPTION 'Cliente e título do contrato são obrigatórios.' USING ERRCODE = '22023';
  END IF;
  IF p_validation_status NOT IN ('pending', 'confirmed', 'historical') THEN
    RAISE EXCEPTION 'Situação de validação inválida.' USING ERRCODE = '22023';
  END IF;
  IF p_status NOT IN ('draft', 'active', 'suspended', 'closed') THEN
    RAISE EXCEPTION 'Status inválido.' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'active' AND p_validation_status <> 'confirmed' THEN
    RAISE EXCEPTION 'Contrato só pode ficar ativo com a vigência conferida.' USING ERRCODE = '22023';
  END IF;
  IF p_start_date IS NOT NULL AND p_end_date IS NOT NULL AND p_end_date < p_start_date THEN
    RAISE EXCEPTION 'A data final deve ser igual ou posterior à data inicial.' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(trim(p_source_documents_url), '') IS NOT NULL AND trim(p_source_documents_url) !~* '^https://' THEN
    RAISE EXCEPTION 'O link dos documentos deve começar com https://.' USING ERRCODE = '22023';
  END IF;
  IF p_customer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.customers WHERE id = p_customer_id AND company_id = v_company_id
  ) THEN
    RAISE EXCEPTION 'Cliente não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF p_contract_id IS NULL THEN
    INSERT INTO public.service_contracts (
      id, company_id, customer_id, client_name, title, contract_number, location,
      scope_summary, start_date, end_date, cct_reference, source_documents_url,
      validation_status, status, internal_notes, created_by, updated_by
    ) VALUES (
      v_contract_id, v_company_id, p_customer_id, trim(p_client_name), trim(p_title),
      NULLIF(trim(p_contract_number), ''), NULLIF(trim(p_location), ''),
      NULLIF(trim(p_scope_summary), ''), p_start_date, p_end_date,
      NULLIF(trim(p_cct_reference), ''), NULLIF(trim(p_source_documents_url), ''),
      p_validation_status, p_status, NULLIF(trim(p_internal_notes), ''), auth.uid(), auth.uid()
    );
  ELSE
    UPDATE public.service_contracts SET
      customer_id = p_customer_id,
      client_name = trim(p_client_name),
      title = trim(p_title),
      contract_number = NULLIF(trim(p_contract_number), ''),
      location = NULLIF(trim(p_location), ''),
      scope_summary = NULLIF(trim(p_scope_summary), ''),
      start_date = p_start_date,
      end_date = p_end_date,
      cct_reference = NULLIF(trim(p_cct_reference), ''),
      source_documents_url = NULLIF(trim(p_source_documents_url), ''),
      validation_status = p_validation_status,
      status = p_status,
      internal_notes = NULLIF(trim(p_internal_notes), ''),
      updated_by = auth.uid()
    WHERE id = p_contract_id AND company_id = v_company_id AND deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Contrato não encontrado.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  RETURN v_contract_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_service_contract_version(
  p_version_id UUID,
  p_contract_id UUID,
  p_kind TEXT,
  p_title TEXT,
  p_signed_at DATE,
  p_effective_start DATE,
  p_effective_end DATE,
  p_document_url TEXT,
  p_change_summary TEXT,
  p_validation_status TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
  v_version_id UUID := COALESCE(p_version_id, gen_random_uuid());
  v_next_number INTEGER;
BEGIN
  IF NULLIF(trim(p_title), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o título da versão.' USING ERRCODE = '22023';
  END IF;
  IF p_kind NOT IN ('original', 'amendment') THEN
    RAISE EXCEPTION 'Tipo de versão inválido.' USING ERRCODE = '22023';
  END IF;
  IF p_validation_status NOT IN ('pending', 'confirmed', 'historical') THEN
    RAISE EXCEPTION 'Situação de validação inválida.' USING ERRCODE = '22023';
  END IF;
  IF p_effective_start IS NOT NULL AND p_effective_end IS NOT NULL AND p_effective_end < p_effective_start THEN
    RAISE EXCEPTION 'A data final deve ser igual ou posterior à data inicial.' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(trim(p_document_url), '') IS NOT NULL AND trim(p_document_url) !~* '^https://' THEN
    RAISE EXCEPTION 'O link do documento deve começar com https://.' USING ERRCODE = '22023';
  END IF;

  -- Trava o contrato para numerar versões sem corrida entre gestores.
  PERFORM 1 FROM public.service_contracts
  WHERE id = p_contract_id AND company_id = v_company_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF p_version_id IS NULL THEN
    SELECT COALESCE(max(version_number), 0) + 1 INTO v_next_number
    FROM public.service_contract_versions
    WHERE contract_id = p_contract_id AND company_id = v_company_id;

    BEGIN
      INSERT INTO public.service_contract_versions (
        id, company_id, contract_id, version_number, kind, title, signed_at,
        effective_start, effective_end, document_url, change_summary,
        validation_status, created_by, updated_by
      ) VALUES (
        v_version_id, v_company_id, p_contract_id, v_next_number, p_kind, trim(p_title),
        p_signed_at, p_effective_start, p_effective_end, NULLIF(trim(p_document_url), ''),
        NULLIF(trim(p_change_summary), ''), p_validation_status, auth.uid(), auth.uid()
      );
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'Este contrato já possui um instrumento original.' USING ERRCODE = '23505';
    END;
  ELSE
    BEGIN
      UPDATE public.service_contract_versions SET
        kind = p_kind,
        title = trim(p_title),
        signed_at = p_signed_at,
        effective_start = p_effective_start,
        effective_end = p_effective_end,
        document_url = NULLIF(trim(p_document_url), ''),
        change_summary = NULLIF(trim(p_change_summary), ''),
        validation_status = p_validation_status,
        updated_by = auth.uid()
      WHERE id = p_version_id AND contract_id = p_contract_id AND company_id = v_company_id;
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'Este contrato já possui um instrumento original.' USING ERRCODE = '23505';
    END;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Versão não encontrada.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  RETURN v_version_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_service_post(
  p_post_id UUID,
  p_contract_id UUID,
  p_name TEXT,
  p_job_function TEXT,
  p_work_schedule TEXT,
  p_required_headcount INTEGER,
  p_operational_manager_id UUID,
  p_requirements TEXT,
  p_status TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
  v_post_id UUID := COALESCE(p_post_id, gen_random_uuid());
BEGIN
  IF NULLIF(trim(p_name), '') IS NULL OR NULLIF(trim(p_job_function), '') IS NULL
     OR NULLIF(trim(p_work_schedule), '') IS NULL THEN
    RAISE EXCEPTION 'Nome do posto, função e escala são obrigatórios.' USING ERRCODE = '22023';
  END IF;
  IF p_required_headcount IS NULL OR p_required_headcount < 1 OR p_required_headcount > 500 THEN
    RAISE EXCEPTION 'Quantitativo previsto deve estar entre 1 e 500.' USING ERRCODE = '22023';
  END IF;
  IF p_status NOT IN ('active', 'inactive') THEN
    RAISE EXCEPTION 'Status inválido.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.service_contracts
    WHERE id = p_contract_id AND company_id = v_company_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Contrato não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF p_operational_manager_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.employees
    WHERE id = p_operational_manager_id AND company_id = v_company_id
      AND deleted_at IS NULL AND status <> 'terminated'
  ) THEN
    RAISE EXCEPTION 'Responsável operacional não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF p_post_id IS NULL THEN
    INSERT INTO public.service_posts (
      id, company_id, contract_id, name, job_function, work_schedule, required_headcount,
      operational_manager_id, requirements, status, created_by, updated_by
    ) VALUES (
      v_post_id, v_company_id, p_contract_id, trim(p_name), trim(p_job_function),
      trim(p_work_schedule), p_required_headcount, p_operational_manager_id,
      NULLIF(trim(p_requirements), ''), p_status, auth.uid(), auth.uid()
    );
  ELSE
    IF p_status = 'inactive' AND EXISTS (
      SELECT 1 FROM public.service_post_allocations
      WHERE post_id = p_post_id AND company_id = v_company_id
        AND (end_date IS NULL OR end_date >= current_date)
    ) THEN
      RAISE EXCEPTION 'Encerre as alocações abertas antes de desativar o posto.' USING ERRCODE = '22023';
    END IF;
    UPDATE public.service_posts SET
      name = trim(p_name),
      job_function = trim(p_job_function),
      work_schedule = trim(p_work_schedule),
      required_headcount = p_required_headcount,
      operational_manager_id = p_operational_manager_id,
      requirements = NULLIF(trim(p_requirements), ''),
      status = p_status,
      updated_by = auth.uid()
    WHERE id = p_post_id AND contract_id = p_contract_id AND company_id = v_company_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Posto não encontrado.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  RETURN v_post_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.allocate_employee_to_post(
  p_post_id UUID,
  p_employee_id UUID,
  p_allocation_role TEXT,
  p_start_date DATE,
  p_notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
  v_allocation_id UUID := gen_random_uuid();
BEGIN
  IF p_allocation_role NOT IN ('holder', 'substitute') THEN
    RAISE EXCEPTION 'Tipo de alocação inválido.' USING ERRCODE = '22023';
  END IF;
  IF p_start_date IS NULL THEN
    RAISE EXCEPTION 'Informe a data de início da alocação.' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.service_posts
  WHERE id = p_post_id AND company_id = v_company_id AND status = 'active'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Posto não encontrado ou inativo.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.employees
    WHERE id = p_employee_id AND company_id = v_company_id
      AND deleted_at IS NULL AND status <> 'terminated'
  ) THEN
    RAISE EXCEPTION 'Funcionário não encontrado ou desligado.' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.service_post_allocations
    WHERE post_id = p_post_id AND employee_id = p_employee_id AND company_id = v_company_id
      AND (end_date IS NULL OR end_date >= p_start_date)
  ) THEN
    RAISE EXCEPTION 'Este funcionário já possui alocação aberta neste posto.' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.service_post_allocations (
    id, company_id, post_id, employee_id, allocation_role, start_date, notes, created_by, updated_by
  ) VALUES (
    v_allocation_id, v_company_id, p_post_id, p_employee_id, p_allocation_role, p_start_date,
    NULLIF(trim(p_notes), ''), auth.uid(), auth.uid()
  );

  RETURN v_allocation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.end_post_allocation(
  p_allocation_id UUID,
  p_end_date DATE,
  p_end_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.service_contracts_assert_manager();
  v_start_date DATE;
BEGIN
  IF p_end_date IS NULL OR NULLIF(trim(p_end_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Informe a data e o motivo do encerramento.' USING ERRCODE = '22023';
  END IF;

  SELECT start_date INTO v_start_date
  FROM public.service_post_allocations
  WHERE id = p_allocation_id AND company_id = v_company_id AND end_date IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Alocação aberta não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF p_end_date < v_start_date THEN
    RAISE EXCEPTION 'A data de encerramento deve ser igual ou posterior ao início.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.service_post_allocations SET
    end_date = p_end_date,
    end_reason = trim(p_end_reason),
    updated_by = auth.uid()
  WHERE id = p_allocation_id AND company_id = v_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.service_contracts_assert_manager() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.service_contracts_write_audit_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_service_contract(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, DATE, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_service_contract_version(UUID, UUID, TEXT, TEXT, DATE, DATE, DATE, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_service_post(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.allocate_employee_to_post(UUID, UUID, TEXT, DATE, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.end_post_allocation(UUID, DATE, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.save_service_contract(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, DATE, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_service_contract_version(UUID, UUID, TEXT, TEXT, DATE, DATE, DATE, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_service_post(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_employee_to_post(UUID, UUID, TEXT, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_post_allocation(UUID, DATE, TEXT) TO authenticated;

COMMENT ON TABLE public.service_contracts IS 'Contratos de prestação de serviço terceirizado; vigência e validação informadas pelo gestor.';
COMMENT ON TABLE public.service_contract_versions IS 'Instrumento original e aditivos de cada contrato, com vigência e conferência próprias.';
COMMENT ON TABLE public.service_posts IS 'Postos de trabalho previstos em contrato: função, escala, quantitativo e requisitos.';
COMMENT ON TABLE public.service_post_allocations IS 'Histórico de alocação de funcionários em postos; encerramento exige data e motivo.';
COMMENT ON TABLE public.service_contract_audit_events IS 'Auditoria de contratos sem valores anteriores/novos, apenas nomes de campos.';
