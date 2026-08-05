-- Story 1.33 — Pessoas: funcionários e comissões administrativas.
-- O módulo armazena somente dados informados pelo gestor. Não executa cálculos
-- trabalhistas, tributários, contábeis, financeiros ou regras automáticas.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  birth_date DATE,
  job_title TEXT NOT NULL,
  department TEXT,
  employment_type TEXT NOT NULL,
  admission_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  internal_notes TEXT,
  commission_enabled BOOLEAN NOT NULL DEFAULT false,
  commission_rule_notes TEXT,
  cpf_last_four TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT employees_employment_type_check CHECK (
    employment_type IN ('clt', 'pj', 'internship', 'temporary', 'self_employed', 'other')
  ),
  CONSTRAINT employees_status_check CHECK (status IN ('active', 'on_leave', 'terminated')),
  CONSTRAINT employees_cpf_last_four_check CHECK (cpf_last_four IS NULL OR cpf_last_four ~ '^\d{4}$'),
  CONSTRAINT employees_id_company_unique UNIQUE (id, company_id)
);

-- O CPF completo nunca é persistido. O hash recebe company_id como salt para
-- impedir correlação entre tenants; esta tabela não possui política SELECT.
CREATE TABLE public.employee_sensitive_data (
  employee_id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  cpf_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT employee_sensitive_employee_fk
    FOREIGN KEY (employee_id, company_id)
    REFERENCES public.employees(id, company_id) ON DELETE CASCADE,
  CONSTRAINT employee_sensitive_cpf_company_unique UNIQUE (company_id, cpf_hash)
);

CREATE TABLE public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL,
  description TEXT NOT NULL,
  reference_period DATE,
  gross_amount NUMERIC(14, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  internal_notes TEXT,
  paid_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT commissions_employee_company_fk
    FOREIGN KEY (employee_id, company_id)
    REFERENCES public.employees(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT commissions_status_check CHECK (status IN ('pending', 'approved', 'paid', 'canceled')),
  CONSTRAINT commissions_gross_amount_check CHECK (gross_amount > 0)
);

CREATE TABLE public.people_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  changed_fields TEXT[] NOT NULL DEFAULT '{}',
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT people_audit_entity_type_check CHECK (entity_type IN ('employee', 'commission'))
);

CREATE INDEX employees_company_status_idx
  ON public.employees(company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX employees_company_department_idx
  ON public.employees(company_id, department) WHERE deleted_at IS NULL;
CREATE INDEX commissions_company_status_period_idx
  ON public.commissions(company_id, status, reference_period) WHERE deleted_at IS NULL;
CREATE INDEX commissions_company_employee_idx
  ON public.commissions(company_id, employee_id) WHERE deleted_at IS NULL;
CREATE INDEX people_audit_company_employee_created_idx
  ON public.people_audit_events(company_id, employee_id, created_at DESC);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_sensitive_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestores visualizam funcionários da própria empresa"
ON public.employees FOR SELECT TO authenticated
USING (
  company_id = (SELECT public.get_user_company_id())
  AND (SELECT public.get_user_role()) IN ('admin', 'manager')
  AND deleted_at IS NULL
);

CREATE POLICY "Gestores visualizam comissões da própria empresa"
ON public.commissions FOR SELECT TO authenticated
USING (
  company_id = (SELECT public.get_user_company_id())
  AND (SELECT public.get_user_role()) IN ('admin', 'manager')
  AND deleted_at IS NULL
);

CREATE POLICY "Gestores visualizam auditoria de pessoas da própria empresa"
ON public.people_audit_events FOR SELECT TO authenticated
USING (
  company_id = (SELECT public.get_user_company_id())
  AND (SELECT public.get_user_role()) IN ('admin', 'manager')
);

-- Escrita direta é intencionalmente bloqueada. RPCs abaixo derivam o tenant da
-- sessão autenticada e nunca aceitam company_id como argumento.
REVOKE ALL ON public.employee_sensitive_data FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.employees FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.commissions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.people_audit_events FROM anon, authenticated;
GRANT SELECT ON public.employees, public.commissions, public.people_audit_events TO authenticated;

CREATE OR REPLACE FUNCTION public.is_valid_cpf(p_cpf TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_cpf TEXT := regexp_replace(COALESCE(p_cpf, ''), '\D', '', 'g');
  v_sum INTEGER;
  v_digit INTEGER;
  i INTEGER;
BEGIN
  IF length(v_cpf) <> 11 OR v_cpf ~ '^([0-9])\1{10}$' THEN
    RETURN false;
  END IF;

  v_sum := 0;
  FOR i IN 1..9 LOOP
    v_sum := v_sum + substring(v_cpf, i, 1)::INTEGER * (11 - i);
  END LOOP;
  v_digit := 11 - (v_sum % 11);
  IF v_digit >= 10 THEN v_digit := 0; END IF;
  IF v_digit <> substring(v_cpf, 10, 1)::INTEGER THEN RETURN false; END IF;

  v_sum := 0;
  FOR i IN 1..10 LOOP
    v_sum := v_sum + substring(v_cpf, i, 1)::INTEGER * (12 - i);
  END LOOP;
  v_digit := 11 - (v_sum % 11);
  IF v_digit >= 10 THEN v_digit := 0; END IF;
  RETURN v_digit = substring(v_cpf, 11, 1)::INTEGER;
END;
$$;

CREATE OR REPLACE FUNCTION public.people_assert_manager()
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

CREATE OR REPLACE FUNCTION public.people_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER employees_touch_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.people_touch_updated_at();

CREATE TRIGGER employee_sensitive_touch_updated_at
BEFORE UPDATE ON public.employee_sensitive_data
FOR EACH ROW EXECUTE FUNCTION public.people_touch_updated_at();

CREATE TRIGGER commissions_touch_updated_at
BEFORE UPDATE ON public.commissions
FOR EACH ROW EXECUTE FUNCTION public.people_touch_updated_at();

CREATE OR REPLACE FUNCTION public.people_write_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_type TEXT;
  v_changed_fields TEXT[] := '{}';
  v_employee_id UUID;
  v_entity_type TEXT := TG_ARGV[0];
BEGIN
  IF v_entity_type = 'employee' THEN
    v_employee_id := COALESCE(NEW.id, OLD.id);
    IF TG_OP = 'INSERT' THEN
      v_event_type := 'employee_created';
    ELSIF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND NEW.deleted_at IS NOT NULL THEN
      v_event_type := 'employee_removed';
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      v_event_type := 'employee_status_changed';
      v_changed_fields := ARRAY['status'];
    ELSE
      v_event_type := 'employee_updated';
      IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN v_changed_fields := array_append(v_changed_fields, 'full_name'); END IF;
      IF NEW.email IS DISTINCT FROM OLD.email THEN v_changed_fields := array_append(v_changed_fields, 'email'); END IF;
      IF NEW.phone IS DISTINCT FROM OLD.phone THEN v_changed_fields := array_append(v_changed_fields, 'phone'); END IF;
      IF NEW.birth_date IS DISTINCT FROM OLD.birth_date THEN v_changed_fields := array_append(v_changed_fields, 'birth_date'); END IF;
      IF NEW.job_title IS DISTINCT FROM OLD.job_title THEN v_changed_fields := array_append(v_changed_fields, 'job_title'); END IF;
      IF NEW.department IS DISTINCT FROM OLD.department THEN v_changed_fields := array_append(v_changed_fields, 'department'); END IF;
      IF NEW.employment_type IS DISTINCT FROM OLD.employment_type THEN v_changed_fields := array_append(v_changed_fields, 'employment_type'); END IF;
      IF NEW.admission_date IS DISTINCT FROM OLD.admission_date THEN v_changed_fields := array_append(v_changed_fields, 'admission_date'); END IF;
      IF NEW.internal_notes IS DISTINCT FROM OLD.internal_notes THEN v_changed_fields := array_append(v_changed_fields, 'internal_notes'); END IF;
      IF NEW.commission_enabled IS DISTINCT FROM OLD.commission_enabled THEN v_changed_fields := array_append(v_changed_fields, 'commission_enabled'); END IF;
      IF NEW.commission_rule_notes IS DISTINCT FROM OLD.commission_rule_notes THEN v_changed_fields := array_append(v_changed_fields, 'commission_rule_notes'); END IF;
      IF NEW.cpf_last_four IS DISTINCT FROM OLD.cpf_last_four THEN v_changed_fields := array_append(v_changed_fields, 'cpf'); END IF;
    END IF;
  ELSE
    v_employee_id := COALESCE(NEW.employee_id, OLD.employee_id);
    IF TG_OP = 'INSERT' THEN
      v_event_type := 'commission_created';
    ELSIF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND NEW.deleted_at IS NOT NULL THEN
      v_event_type := 'commission_removed';
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      v_event_type := CASE NEW.status
        WHEN 'paid' THEN 'commission_paid'
        WHEN 'canceled' THEN 'commission_canceled'
        ELSE 'commission_status_changed'
      END;
      v_changed_fields := ARRAY['status'];
    ELSE
      v_event_type := 'commission_updated';
      IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN v_changed_fields := array_append(v_changed_fields, 'employee_id'); END IF;
      IF NEW.description IS DISTINCT FROM OLD.description THEN v_changed_fields := array_append(v_changed_fields, 'description'); END IF;
      IF NEW.reference_period IS DISTINCT FROM OLD.reference_period THEN v_changed_fields := array_append(v_changed_fields, 'reference_period'); END IF;
      IF NEW.gross_amount IS DISTINCT FROM OLD.gross_amount THEN v_changed_fields := array_append(v_changed_fields, 'gross_amount'); END IF;
      IF NEW.internal_notes IS DISTINCT FROM OLD.internal_notes THEN v_changed_fields := array_append(v_changed_fields, 'internal_notes'); END IF;
    END IF;
  END IF;

  INSERT INTO public.people_audit_events (
    company_id, employee_id, entity_type, entity_id, event_type, changed_fields, actor_id
  ) VALUES (
    COALESCE(NEW.company_id, OLD.company_id),
    v_employee_id,
    v_entity_type,
    COALESCE(NEW.id, OLD.id),
    v_event_type,
    v_changed_fields,
    auth.uid()
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER employees_write_audit_event
AFTER INSERT OR UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.people_write_audit_event('employee');

CREATE TRIGGER commissions_write_audit_event
AFTER INSERT OR UPDATE ON public.commissions
FOR EACH ROW EXECUTE FUNCTION public.people_write_audit_event('commission');

CREATE OR REPLACE FUNCTION public.save_employee(
  p_employee_id UUID,
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_cpf TEXT,
  p_clear_cpf BOOLEAN,
  p_birth_date DATE,
  p_job_title TEXT,
  p_department TEXT,
  p_employment_type TEXT,
  p_admission_date DATE,
  p_status TEXT,
  p_internal_notes TEXT,
  p_commission_enabled BOOLEAN,
  p_commission_rule_notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.people_assert_manager();
  v_employee_id UUID := COALESCE(p_employee_id, gen_random_uuid());
  v_cpf TEXT;
  v_cpf_hash TEXT;
BEGIN
  IF NULLIF(trim(p_full_name), '') IS NULL OR NULLIF(trim(p_job_title), '') IS NULL THEN
    RAISE EXCEPTION 'Nome e cargo são obrigatórios.' USING ERRCODE = '22023';
  END IF;
  IF p_employment_type NOT IN ('clt', 'pj', 'internship', 'temporary', 'self_employed', 'other') THEN
    RAISE EXCEPTION 'Tipo de vínculo inválido.' USING ERRCODE = '22023';
  END IF;
  IF p_status NOT IN ('active', 'on_leave', 'terminated') THEN
    RAISE EXCEPTION 'Status inválido.' USING ERRCODE = '22023';
  END IF;

  IF p_employee_id IS NULL THEN
    INSERT INTO public.employees (
      id, company_id, full_name, email, phone, birth_date, job_title, department,
      employment_type, admission_date, status, internal_notes, commission_enabled,
      commission_rule_notes, created_by, updated_by
    ) VALUES (
      v_employee_id, v_company_id, trim(p_full_name), NULLIF(trim(p_email), ''),
      NULLIF(trim(p_phone), ''), p_birth_date, trim(p_job_title),
      NULLIF(trim(p_department), ''), p_employment_type, p_admission_date, p_status,
      NULLIF(trim(p_internal_notes), ''), COALESCE(p_commission_enabled, false),
      NULLIF(trim(p_commission_rule_notes), ''), auth.uid(), auth.uid()
    );
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.employees
      WHERE id = p_employee_id AND company_id = v_company_id AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Funcionário não encontrado.' USING ERRCODE = 'P0002';
    END IF;
    UPDATE public.employees SET
      full_name = trim(p_full_name), email = NULLIF(trim(p_email), ''),
      phone = NULLIF(trim(p_phone), ''), birth_date = p_birth_date,
      job_title = trim(p_job_title), department = NULLIF(trim(p_department), ''),
      employment_type = p_employment_type, admission_date = p_admission_date,
      status = p_status, internal_notes = NULLIF(trim(p_internal_notes), ''),
      commission_enabled = COALESCE(p_commission_enabled, false),
      commission_rule_notes = NULLIF(trim(p_commission_rule_notes), ''),
      updated_by = auth.uid()
    WHERE id = p_employee_id AND company_id = v_company_id;
  END IF;

  IF COALESCE(p_clear_cpf, false) THEN
    DELETE FROM public.employee_sensitive_data
    WHERE employee_id = v_employee_id AND company_id = v_company_id;
    UPDATE public.employees SET cpf_last_four = NULL WHERE id = v_employee_id;
  ELSIF NULLIF(trim(p_cpf), '') IS NOT NULL THEN
    v_cpf := regexp_replace(p_cpf, '\D', '', 'g');
    IF NOT public.is_valid_cpf(v_cpf) THEN
      RAISE EXCEPTION 'CPF inválido.' USING ERRCODE = '22023';
    END IF;
    v_cpf_hash := encode(extensions.digest(v_company_id::TEXT || ':' || v_cpf, 'sha256'), 'hex');
    BEGIN
      INSERT INTO public.employee_sensitive_data (employee_id, company_id, cpf_hash)
      VALUES (v_employee_id, v_company_id, v_cpf_hash)
      ON CONFLICT (employee_id) DO UPDATE
      SET cpf_hash = EXCLUDED.cpf_hash, updated_at = now();
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'Já existe um funcionário com este CPF nesta empresa.' USING ERRCODE = '23505';
    END;
    UPDATE public.employees
    SET cpf_last_four = right(v_cpf, 4), updated_by = auth.uid()
    WHERE id = v_employee_id AND company_id = v_company_id;
  END IF;

  RETURN v_employee_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_employee_status(p_employee_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_company_id UUID := public.people_assert_manager();
BEGIN
  IF p_status NOT IN ('active', 'on_leave', 'terminated') THEN
    RAISE EXCEPTION 'Status inválido.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.employees
  SET status = p_status, updated_by = auth.uid()
  WHERE id = p_employee_id AND company_id = v_company_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Funcionário não encontrado.' USING ERRCODE = 'P0002'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_commission(
  p_commission_id UUID,
  p_employee_id UUID,
  p_description TEXT,
  p_reference_period DATE,
  p_gross_amount NUMERIC,
  p_internal_notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.people_assert_manager();
  v_commission_id UUID := COALESCE(p_commission_id, gen_random_uuid());
BEGIN
  IF NULLIF(trim(p_description), '') IS NULL OR p_gross_amount IS NULL OR p_gross_amount <= 0 THEN
    RAISE EXCEPTION 'Funcionário, descrição e valor positivo são obrigatórios.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.employees
    WHERE id = p_employee_id AND company_id = v_company_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Funcionário não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF p_commission_id IS NULL THEN
    INSERT INTO public.commissions (
      id, company_id, employee_id, description, reference_period, gross_amount,
      status, internal_notes, created_by, updated_by
    ) VALUES (
      v_commission_id, v_company_id, p_employee_id, trim(p_description),
      p_reference_period, p_gross_amount, 'pending', NULLIF(trim(p_internal_notes), ''),
      auth.uid(), auth.uid()
    );
  ELSE
    UPDATE public.commissions SET
      employee_id = p_employee_id, description = trim(p_description),
      reference_period = p_reference_period, gross_amount = p_gross_amount,
      internal_notes = NULLIF(trim(p_internal_notes), ''), updated_by = auth.uid()
    WHERE id = p_commission_id AND company_id = v_company_id
      AND deleted_at IS NULL AND status <> 'canceled';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Comissão não encontrada ou cancelada.' USING ERRCODE = 'P0002';
    END IF;
  END IF;
  RETURN v_commission_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_commission_status(p_commission_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID := public.people_assert_manager();
  v_current_status TEXT;
BEGIN
  SELECT status INTO v_current_status
  FROM public.commissions
  WHERE id = p_commission_id AND company_id = v_company_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comissão não encontrada.' USING ERRCODE = 'P0002'; END IF;
  IF p_status = v_current_status THEN RETURN; END IF;
  IF NOT (
    (v_current_status = 'pending' AND p_status IN ('approved', 'canceled')) OR
    (v_current_status = 'approved' AND p_status IN ('paid', 'canceled'))
  ) THEN
    RAISE EXCEPTION 'Transição de status não permitida.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.commissions SET
    status = p_status,
    paid_at = CASE WHEN p_status = 'paid' THEN now() ELSE paid_at END,
    canceled_at = CASE WHEN p_status = 'canceled' THEN now() ELSE canceled_at END,
    updated_by = auth.uid()
  WHERE id = p_commission_id AND company_id = v_company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_commission(p_commission_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_company_id UUID := public.people_assert_manager();
BEGIN
  UPDATE public.commissions
  SET deleted_at = now(), updated_by = auth.uid()
  WHERE id = p_commission_id AND company_id = v_company_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comissão não encontrada.' USING ERRCODE = 'P0002'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.people_assert_manager() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.people_write_audit_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_employee(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, DATE, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_employee_status(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_commission(UUID, UUID, TEXT, DATE, NUMERIC, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_commission_status(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_commission(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.save_employee(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, DATE, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_employee_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_commission(UUID, UUID, TEXT, DATE, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_commission_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_commission(UUID) TO authenticated;

COMMENT ON TABLE public.employees IS 'Cadastro administrativo interno de funcionários; não representa folha de pagamento.';
COMMENT ON TABLE public.commissions IS 'Valores de comissão informados manualmente; sem cálculo, imposto, desconto ou pagamento automático.';
COMMENT ON TABLE public.people_audit_events IS 'Auditoria sem dados sensíveis ou valores anteriores/novos.';
