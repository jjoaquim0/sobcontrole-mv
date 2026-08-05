-- Story 1.33 — evolução de Pessoas com equipes, metas e acompanhamento.
-- Nenhuma função desta migration calcula remuneração ou gera efeitos financeiros.

CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  manager_employee_id UUID,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT teams_status_check CHECK (status IN ('active', 'inactive')),
  CONSTRAINT teams_id_company_unique UNIQUE (id, company_id)
);

CREATE UNIQUE INDEX teams_company_name_unique
  ON public.teams(company_id, lower(name));
CREATE INDEX teams_company_status_idx ON public.teams(company_id, status);

ALTER TABLE public.employees
  ADD COLUMN team_id UUID,
  ADD COLUMN manager_employee_id UUID,
  ADD COLUMN sales_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_team_company_fk
    FOREIGN KEY (team_id, company_id) REFERENCES public.teams(id, company_id) ON DELETE SET NULL,
  ADD CONSTRAINT employees_manager_company_fk
    FOREIGN KEY (manager_employee_id, company_id) REFERENCES public.employees(id, company_id) ON DELETE SET NULL,
  ADD CONSTRAINT employees_manager_not_self_check
    CHECK (manager_employee_id IS NULL OR manager_employee_id <> id);

ALTER TABLE public.teams
  ADD CONSTRAINT teams_manager_company_fk
    FOREIGN KEY (manager_employee_id, company_id) REFERENCES public.employees(id, company_id) ON DELETE SET NULL;

CREATE UNIQUE INDEX employees_company_sales_profile_unique
  ON public.employees(company_id, sales_profile_id)
  WHERE sales_profile_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX employees_company_team_idx
  ON public.employees(company_id, team_id) WHERE deleted_at IS NULL;
CREATE INDEX employees_company_manager_idx
  ON public.employees(company_id, manager_employee_id) WHERE deleted_at IS NULL;

ALTER TABLE public.commissions ADD COLUMN team_id UUID;
UPDATE public.commissions AS commission
SET team_id = employee.team_id
FROM public.employees AS employee
WHERE employee.id = commission.employee_id
  AND employee.company_id = commission.company_id;
ALTER TABLE public.commissions
  ADD CONSTRAINT commissions_team_company_fk
    FOREIGN KEY (team_id, company_id) REFERENCES public.teams(id, company_id) ON DELETE SET NULL;
CREATE INDEX commissions_company_team_idx
  ON public.commissions(company_id, team_id) WHERE deleted_at IS NULL;

CREATE TABLE public.sales_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal_type TEXT NOT NULL,
  assignment_type TEXT NOT NULL,
  employee_id UUID,
  team_id UUID,
  period_type TEXT NOT NULL,
  target_value NUMERIC(14, 2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  result_source TEXT NOT NULL DEFAULT 'manual',
  manual_result NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sales_goals_id_company_unique UNIQUE (id, company_id),
  CONSTRAINT sales_goals_type_check CHECK (goal_type IN ('sales_value', 'sales_count', 'new_customers', 'custom')),
  CONSTRAINT sales_goals_assignment_check CHECK (assignment_type IN ('employee', 'team')),
  CONSTRAINT sales_goals_assignment_target_check CHECK (
    (assignment_type = 'employee' AND employee_id IS NOT NULL AND team_id IS NULL)
    OR (assignment_type = 'team' AND team_id IS NOT NULL AND employee_id IS NULL)
  ),
  CONSTRAINT sales_goals_period_check CHECK (period_type IN ('monthly', 'quarterly', 'annual', 'custom')),
  CONSTRAINT sales_goals_status_check CHECK (status IN ('active', 'completed', 'expired', 'canceled')),
  CONSTRAINT sales_goals_source_check CHECK (result_source IN ('automatic', 'manual')),
  CONSTRAINT sales_goals_target_check CHECK (target_value > 0),
  CONSTRAINT sales_goals_result_check CHECK (manual_result >= 0),
  CONSTRAINT sales_goals_dates_check CHECK (end_date >= start_date),
  CONSTRAINT sales_goals_employee_company_fk
    FOREIGN KEY (employee_id, company_id) REFERENCES public.employees(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT sales_goals_team_company_fk
    FOREIGN KEY (team_id, company_id) REFERENCES public.teams(id, company_id) ON DELETE RESTRICT
);

CREATE INDEX sales_goals_company_period_idx
  ON public.sales_goals(company_id, start_date, end_date, status);
CREATE INDEX sales_goals_company_employee_idx
  ON public.sales_goals(company_id, employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX sales_goals_company_team_idx
  ON public.sales_goals(company_id, team_id) WHERE team_id IS NOT NULL;
CREATE INDEX sales_company_seller_period_paid_idx
  ON public.sales(company_id, seller_id, created_at)
  WHERE payment_status = 'paid';

ALTER TABLE public.people_audit_events
  DROP CONSTRAINT people_audit_entity_type_check,
  ADD COLUMN team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  ADD CONSTRAINT people_audit_entity_type_check
    CHECK (entity_type IN ('employee', 'team', 'goal', 'commission'));
CREATE INDEX people_audit_company_team_created_idx
  ON public.people_audit_events(company_id, team_id, created_at DESC);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestores visualizam equipes da própria empresa"
ON public.teams FOR SELECT TO authenticated
USING (
  company_id = (SELECT public.get_user_company_id())
  AND (SELECT public.get_user_role()) IN ('admin', 'manager')
);

CREATE POLICY "Gestores visualizam metas da própria empresa"
ON public.sales_goals FOR SELECT TO authenticated
USING (
  company_id = (SELECT public.get_user_company_id())
  AND (SELECT public.get_user_role()) IN ('admin', 'manager')
);

REVOKE INSERT, UPDATE, DELETE ON public.teams, public.sales_goals FROM anon, authenticated;
GRANT SELECT ON public.teams, public.sales_goals TO authenticated;

CREATE TRIGGER teams_touch_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.people_touch_updated_at();

CREATE TRIGGER sales_goals_touch_updated_at
BEFORE UPDATE ON public.sales_goals
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
  v_entity_type TEXT := TG_ARGV[0];
  v_employee_id UUID;
  v_team_id UUID;
BEGIN
  IF v_entity_type = 'employee' THEN
    v_employee_id := COALESCE(NEW.id, OLD.id);
    v_team_id := COALESCE(NEW.team_id, OLD.team_id);
    IF TG_OP = 'INSERT' THEN v_event_type := 'employee_created';
    ELSIF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND NEW.deleted_at IS NOT NULL THEN v_event_type := 'employee_removed';
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN v_event_type := 'employee_status_changed'; v_changed_fields := ARRAY['status'];
    ELSE
      v_event_type := 'employee_updated';
      IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN v_changed_fields := array_append(v_changed_fields, 'full_name'); END IF;
      IF NEW.email IS DISTINCT FROM OLD.email THEN v_changed_fields := array_append(v_changed_fields, 'email'); END IF;
      IF NEW.phone IS DISTINCT FROM OLD.phone THEN v_changed_fields := array_append(v_changed_fields, 'phone'); END IF;
      IF NEW.birth_date IS DISTINCT FROM OLD.birth_date THEN v_changed_fields := array_append(v_changed_fields, 'birth_date'); END IF;
      IF NEW.job_title IS DISTINCT FROM OLD.job_title THEN v_changed_fields := array_append(v_changed_fields, 'job_title'); END IF;
      IF NEW.department IS DISTINCT FROM OLD.department THEN v_changed_fields := array_append(v_changed_fields, 'department'); END IF;
      IF NEW.team_id IS DISTINCT FROM OLD.team_id THEN v_changed_fields := array_append(v_changed_fields, 'team_id'); END IF;
      IF NEW.manager_employee_id IS DISTINCT FROM OLD.manager_employee_id THEN v_changed_fields := array_append(v_changed_fields, 'manager_employee_id'); END IF;
      IF NEW.sales_profile_id IS DISTINCT FROM OLD.sales_profile_id THEN v_changed_fields := array_append(v_changed_fields, 'sales_profile_id'); END IF;
      IF NEW.employment_type IS DISTINCT FROM OLD.employment_type THEN v_changed_fields := array_append(v_changed_fields, 'employment_type'); END IF;
      IF NEW.admission_date IS DISTINCT FROM OLD.admission_date THEN v_changed_fields := array_append(v_changed_fields, 'admission_date'); END IF;
      IF NEW.internal_notes IS DISTINCT FROM OLD.internal_notes THEN v_changed_fields := array_append(v_changed_fields, 'internal_notes'); END IF;
      IF NEW.commission_enabled IS DISTINCT FROM OLD.commission_enabled THEN v_changed_fields := array_append(v_changed_fields, 'commission_enabled'); END IF;
      IF NEW.commission_rule_notes IS DISTINCT FROM OLD.commission_rule_notes THEN v_changed_fields := array_append(v_changed_fields, 'commission_rule_notes'); END IF;
      IF NEW.cpf_last_four IS DISTINCT FROM OLD.cpf_last_four THEN v_changed_fields := array_append(v_changed_fields, 'cpf'); END IF;
    END IF;
  ELSE
    v_employee_id := COALESCE(NEW.employee_id, OLD.employee_id);
    v_team_id := COALESCE(NEW.team_id, OLD.team_id);
    IF TG_OP = 'INSERT' THEN v_event_type := 'commission_created';
    ELSIF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND NEW.deleted_at IS NOT NULL THEN v_event_type := 'commission_removed';
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      v_event_type := CASE NEW.status WHEN 'paid' THEN 'commission_paid' WHEN 'canceled' THEN 'commission_canceled' ELSE 'commission_status_changed' END;
      v_changed_fields := ARRAY['status'];
    ELSE
      v_event_type := 'commission_updated';
      IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN v_changed_fields := array_append(v_changed_fields, 'employee_id'); END IF;
      IF NEW.team_id IS DISTINCT FROM OLD.team_id THEN v_changed_fields := array_append(v_changed_fields, 'team_id'); END IF;
      IF NEW.description IS DISTINCT FROM OLD.description THEN v_changed_fields := array_append(v_changed_fields, 'description'); END IF;
      IF NEW.reference_period IS DISTINCT FROM OLD.reference_period THEN v_changed_fields := array_append(v_changed_fields, 'reference_period'); END IF;
      IF NEW.gross_amount IS DISTINCT FROM OLD.gross_amount THEN v_changed_fields := array_append(v_changed_fields, 'gross_amount'); END IF;
      IF NEW.internal_notes IS DISTINCT FROM OLD.internal_notes THEN v_changed_fields := array_append(v_changed_fields, 'internal_notes'); END IF;
    END IF;
  END IF;

  INSERT INTO public.people_audit_events (
    company_id, employee_id, team_id, entity_type, entity_id, event_type, changed_fields, actor_id
  ) VALUES (
    COALESCE(NEW.company_id, OLD.company_id),
    v_employee_id, v_team_id, v_entity_type, COALESCE(NEW.id, OLD.id),
    v_event_type, v_changed_fields, auth.uid()
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.people_write_team_audit_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_fields TEXT[] := '{}'; v_event TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN v_event := 'team_created';
  ELSE
    v_event := CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'team_status_changed' ELSE 'team_updated' END;
    IF NEW.name IS DISTINCT FROM OLD.name THEN v_fields := array_append(v_fields, 'name'); END IF;
    IF NEW.description IS DISTINCT FROM OLD.description THEN v_fields := array_append(v_fields, 'description'); END IF;
    IF NEW.manager_employee_id IS DISTINCT FROM OLD.manager_employee_id THEN v_fields := array_append(v_fields, 'manager_employee_id'); END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN v_fields := array_append(v_fields, 'status'); END IF;
  END IF;
  INSERT INTO public.people_audit_events(company_id, employee_id, team_id, entity_type, entity_id, event_type, changed_fields, actor_id)
  VALUES (NEW.company_id, NEW.manager_employee_id, NEW.id, 'team', NEW.id, v_event, v_fields, auth.uid());
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.people_write_goal_audit_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_fields TEXT[] := '{}'; v_event TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN v_event := 'goal_created';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN v_event := 'goal_status_changed'; v_fields := ARRAY['status'];
  ELSIF NEW.manual_result IS DISTINCT FROM OLD.manual_result THEN v_event := 'goal_result_updated'; v_fields := ARRAY['manual_result'];
  ELSE
    v_event := 'goal_updated';
    IF NEW.name IS DISTINCT FROM OLD.name THEN v_fields := array_append(v_fields, 'name'); END IF;
    IF NEW.target_value IS DISTINCT FROM OLD.target_value THEN v_fields := array_append(v_fields, 'target_value'); END IF;
    IF NEW.start_date IS DISTINCT FROM OLD.start_date OR NEW.end_date IS DISTINCT FROM OLD.end_date THEN v_fields := array_append(v_fields, 'period'); END IF;
    IF NEW.employee_id IS DISTINCT FROM OLD.employee_id OR NEW.team_id IS DISTINCT FROM OLD.team_id THEN v_fields := array_append(v_fields, 'assignment'); END IF;
    IF NEW.notes IS DISTINCT FROM OLD.notes THEN v_fields := array_append(v_fields, 'notes'); END IF;
  END IF;
  INSERT INTO public.people_audit_events(company_id, employee_id, team_id, entity_type, entity_id, event_type, changed_fields, actor_id)
  VALUES (NEW.company_id, NEW.employee_id, NEW.team_id, 'goal', NEW.id, v_event, v_fields, auth.uid());
  RETURN NEW;
END; $$;

CREATE TRIGGER teams_write_audit_event AFTER INSERT OR UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.people_write_team_audit_event();
CREATE TRIGGER sales_goals_write_audit_event AFTER INSERT OR UPDATE ON public.sales_goals
FOR EACH ROW EXECUTE FUNCTION public.people_write_goal_audit_event();

CREATE OR REPLACE FUNCTION public.save_team(
  p_team_id UUID, p_name TEXT, p_description TEXT, p_manager_employee_id UUID, p_status TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_company_id UUID := public.people_assert_manager(); v_team_id UUID := COALESCE(p_team_id, gen_random_uuid());
BEGIN
  IF NULLIF(trim(p_name), '') IS NULL THEN RAISE EXCEPTION 'Nome da equipe é obrigatório.' USING ERRCODE = '22023'; END IF;
  IF p_status NOT IN ('active', 'inactive') THEN RAISE EXCEPTION 'Status da equipe inválido.' USING ERRCODE = '22023'; END IF;
  IF p_manager_employee_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.employees WHERE id = p_manager_employee_id AND company_id = v_company_id AND deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'Gestor responsável não encontrado.' USING ERRCODE = 'P0002'; END IF;
  IF p_team_id IS NULL THEN
    INSERT INTO public.teams(id, company_id, name, description, manager_employee_id, status, created_by, updated_by)
    VALUES (v_team_id, v_company_id, trim(p_name), NULLIF(trim(p_description), ''), p_manager_employee_id, p_status, auth.uid(), auth.uid());
  ELSE
    UPDATE public.teams SET name = trim(p_name), description = NULLIF(trim(p_description), ''),
      manager_employee_id = p_manager_employee_id, status = p_status, updated_by = auth.uid()
    WHERE id = p_team_id AND company_id = v_company_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Equipe não encontrada.' USING ERRCODE = 'P0002'; END IF;
  END IF;
  RETURN v_team_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Já existe uma equipe com este nome nesta empresa.' USING ERRCODE = '23505';
END; $$;

CREATE OR REPLACE FUNCTION public.set_team_status(p_team_id UUID, p_status TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_company_id UUID := public.people_assert_manager();
BEGIN
  IF p_status NOT IN ('active', 'inactive') THEN RAISE EXCEPTION 'Status da equipe inválido.' USING ERRCODE = '22023'; END IF;
  UPDATE public.teams SET status = p_status, updated_by = auth.uid()
  WHERE id = p_team_id AND company_id = v_company_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Equipe não encontrada.' USING ERRCODE = 'P0002'; END IF;
END; $$;

DROP FUNCTION public.save_employee(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, DATE, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, BOOLEAN, TEXT);
CREATE FUNCTION public.save_employee(
  p_employee_id UUID, p_full_name TEXT, p_email TEXT, p_phone TEXT, p_cpf TEXT,
  p_clear_cpf BOOLEAN, p_birth_date DATE, p_job_title TEXT, p_department TEXT,
  p_employment_type TEXT, p_admission_date DATE, p_status TEXT, p_internal_notes TEXT,
  p_commission_enabled BOOLEAN, p_commission_rule_notes TEXT, p_team_id UUID,
  p_manager_employee_id UUID, p_sales_profile_id UUID
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_company_id UUID := public.people_assert_manager();
  v_employee_id UUID := COALESCE(p_employee_id, gen_random_uuid());
  v_cpf TEXT; v_cpf_hash TEXT;
BEGIN
  IF NULLIF(trim(p_full_name), '') IS NULL OR NULLIF(trim(p_job_title), '') IS NULL THEN
    RAISE EXCEPTION 'Nome e cargo são obrigatórios.' USING ERRCODE = '22023';
  END IF;
  IF p_employment_type NOT IN ('clt', 'pj', 'internship', 'temporary', 'self_employed', 'other') THEN RAISE EXCEPTION 'Tipo de vínculo inválido.' USING ERRCODE = '22023'; END IF;
  IF p_status NOT IN ('active', 'on_leave', 'terminated') THEN RAISE EXCEPTION 'Status inválido.' USING ERRCODE = '22023'; END IF;
  IF p_manager_employee_id = v_employee_id THEN RAISE EXCEPTION 'O funcionário não pode ser seu próprio gestor.' USING ERRCODE = '22023'; END IF;
  IF p_team_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.teams WHERE id = p_team_id AND company_id = v_company_id) THEN RAISE EXCEPTION 'Equipe não encontrada.' USING ERRCODE = 'P0002'; END IF;
  IF p_manager_employee_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_manager_employee_id AND company_id = v_company_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Gestor não encontrado.' USING ERRCODE = 'P0002'; END IF;
  IF p_sales_profile_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_sales_profile_id AND company_id = v_company_id) THEN RAISE EXCEPTION 'Usuário vendedor não encontrado.' USING ERRCODE = 'P0002'; END IF;

  IF p_employee_id IS NULL THEN
    INSERT INTO public.employees(id, company_id, full_name, email, phone, birth_date, job_title, department,
      employment_type, admission_date, status, internal_notes, commission_enabled, commission_rule_notes,
      team_id, manager_employee_id, sales_profile_id, created_by, updated_by)
    VALUES (v_employee_id, v_company_id, trim(p_full_name), NULLIF(trim(p_email), ''), NULLIF(trim(p_phone), ''),
      p_birth_date, trim(p_job_title), NULLIF(trim(p_department), ''), p_employment_type, p_admission_date,
      p_status, NULLIF(trim(p_internal_notes), ''), COALESCE(p_commission_enabled, false),
      NULLIF(trim(p_commission_rule_notes), ''), p_team_id, p_manager_employee_id, p_sales_profile_id, auth.uid(), auth.uid());
  ELSE
    UPDATE public.employees SET full_name = trim(p_full_name), email = NULLIF(trim(p_email), ''),
      phone = NULLIF(trim(p_phone), ''), birth_date = p_birth_date, job_title = trim(p_job_title),
      department = NULLIF(trim(p_department), ''), employment_type = p_employment_type,
      admission_date = p_admission_date, status = p_status, internal_notes = NULLIF(trim(p_internal_notes), ''),
      commission_enabled = COALESCE(p_commission_enabled, false), commission_rule_notes = NULLIF(trim(p_commission_rule_notes), ''),
      team_id = p_team_id, manager_employee_id = p_manager_employee_id, sales_profile_id = p_sales_profile_id,
      updated_by = auth.uid()
    WHERE id = p_employee_id AND company_id = v_company_id AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Funcionário não encontrado.' USING ERRCODE = 'P0002'; END IF;
  END IF;

  IF COALESCE(p_clear_cpf, false) THEN
    DELETE FROM public.employee_sensitive_data WHERE employee_id = v_employee_id AND company_id = v_company_id;
    UPDATE public.employees SET cpf_last_four = NULL WHERE id = v_employee_id AND company_id = v_company_id;
  ELSIF NULLIF(trim(p_cpf), '') IS NOT NULL THEN
    v_cpf := regexp_replace(p_cpf, '\D', '', 'g');
    IF NOT public.is_valid_cpf(v_cpf) THEN RAISE EXCEPTION 'CPF inválido.' USING ERRCODE = '22023'; END IF;
    v_cpf_hash := encode(extensions.digest(v_company_id::TEXT || ':' || v_cpf, 'sha256'), 'hex');
    BEGIN
      INSERT INTO public.employee_sensitive_data(employee_id, company_id, cpf_hash) VALUES (v_employee_id, v_company_id, v_cpf_hash)
      ON CONFLICT (employee_id) DO UPDATE SET cpf_hash = EXCLUDED.cpf_hash, updated_at = now();
    EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'Já existe um funcionário com este CPF nesta empresa.' USING ERRCODE = '23505'; END;
    UPDATE public.employees SET cpf_last_four = right(v_cpf, 4), updated_by = auth.uid()
    WHERE id = v_employee_id AND company_id = v_company_id;
  END IF;
  RETURN v_employee_id;
END; $$;

DROP FUNCTION public.save_commission(UUID, UUID, TEXT, DATE, NUMERIC, TEXT);
CREATE FUNCTION public.save_commission(
  p_commission_id UUID, p_employee_id UUID, p_team_id UUID, p_description TEXT,
  p_reference_period DATE, p_gross_amount NUMERIC, p_internal_notes TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_company_id UUID := public.people_assert_manager(); v_commission_id UUID := COALESCE(p_commission_id, gen_random_uuid()); v_employee_team UUID;
BEGIN
  IF NULLIF(trim(p_description), '') IS NULL OR p_gross_amount IS NULL OR p_gross_amount <= 0 THEN
    RAISE EXCEPTION 'Funcionário, descrição e valor positivo são obrigatórios.' USING ERRCODE = '22023';
  END IF;
  SELECT team_id INTO v_employee_team FROM public.employees
  WHERE id = p_employee_id AND company_id = v_company_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Funcionário não encontrado.' USING ERRCODE = 'P0002'; END IF;
  IF p_team_id IS NOT NULL AND p_team_id IS DISTINCT FROM v_employee_team THEN
    RAISE EXCEPTION 'A equipe informada não corresponde à equipe atual do funcionário.' USING ERRCODE = '22023';
  END IF;
  IF p_commission_id IS NULL THEN
    INSERT INTO public.commissions(id, company_id, employee_id, team_id, description, reference_period, gross_amount, status, internal_notes, created_by, updated_by)
    VALUES (v_commission_id, v_company_id, p_employee_id, COALESCE(p_team_id, v_employee_team), trim(p_description), p_reference_period, p_gross_amount, 'pending', NULLIF(trim(p_internal_notes), ''), auth.uid(), auth.uid());
  ELSE
    UPDATE public.commissions SET employee_id = p_employee_id, team_id = COALESCE(p_team_id, v_employee_team),
      description = trim(p_description), reference_period = p_reference_period, gross_amount = p_gross_amount,
      internal_notes = NULLIF(trim(p_internal_notes), ''), updated_by = auth.uid()
    WHERE id = p_commission_id AND company_id = v_company_id AND deleted_at IS NULL AND status <> 'canceled';
    IF NOT FOUND THEN RAISE EXCEPTION 'Comissão não encontrada ou cancelada.' USING ERRCODE = 'P0002'; END IF;
  END IF;
  RETURN v_commission_id;
END; $$;

CREATE OR REPLACE FUNCTION public.save_sales_goal(
  p_goal_id UUID, p_name TEXT, p_goal_type TEXT, p_assignment_type TEXT,
  p_employee_id UUID, p_team_id UUID, p_period_type TEXT, p_target_value NUMERIC,
  p_start_date DATE, p_end_date DATE, p_notes TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_company_id UUID := public.people_assert_manager(); v_goal_id UUID := COALESCE(p_goal_id, gen_random_uuid()); v_source TEXT := 'manual';
BEGIN
  IF NULLIF(trim(p_name), '') IS NULL OR p_target_value IS NULL OR p_target_value <= 0 THEN RAISE EXCEPTION 'Nome e meta-alvo positiva são obrigatórios.' USING ERRCODE = '22023'; END IF;
  IF p_goal_type NOT IN ('sales_value', 'sales_count', 'new_customers', 'custom') THEN RAISE EXCEPTION 'Tipo de meta inválido.' USING ERRCODE = '22023'; END IF;
  IF p_period_type NOT IN ('monthly', 'quarterly', 'annual', 'custom') OR p_end_date < p_start_date THEN RAISE EXCEPTION 'Período da meta inválido.' USING ERRCODE = '22023'; END IF;
  IF p_assignment_type = 'employee' THEN
    IF p_employee_id IS NULL OR p_team_id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_employee_id AND company_id = v_company_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Funcionário da meta não encontrado.' USING ERRCODE = 'P0002'; END IF;
    IF p_goal_type <> 'custom' AND EXISTS (SELECT 1 FROM public.employees WHERE id = p_employee_id AND company_id = v_company_id AND sales_profile_id IS NOT NULL) THEN v_source := 'automatic'; END IF;
  ELSIF p_assignment_type = 'team' THEN
    IF p_team_id IS NULL OR p_employee_id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM public.teams WHERE id = p_team_id AND company_id = v_company_id) THEN RAISE EXCEPTION 'Equipe da meta não encontrada.' USING ERRCODE = 'P0002'; END IF;
    IF p_goal_type <> 'custom' AND EXISTS (SELECT 1 FROM public.employees WHERE team_id = p_team_id AND company_id = v_company_id AND sales_profile_id IS NOT NULL AND deleted_at IS NULL) THEN v_source := 'automatic'; END IF;
  ELSE RAISE EXCEPTION 'Aplicação da meta inválida.' USING ERRCODE = '22023'; END IF;

  IF p_goal_id IS NULL THEN
    INSERT INTO public.sales_goals(id, company_id, name, goal_type, assignment_type, employee_id, team_id, period_type, target_value, start_date, end_date, status, notes, result_source, created_by, updated_by)
    VALUES (v_goal_id, v_company_id, trim(p_name), p_goal_type, p_assignment_type, p_employee_id, p_team_id, p_period_type, p_target_value, p_start_date, p_end_date, 'active', NULLIF(trim(p_notes), ''), v_source, auth.uid(), auth.uid());
  ELSE
    UPDATE public.sales_goals SET name = trim(p_name), goal_type = p_goal_type, assignment_type = p_assignment_type,
      employee_id = p_employee_id, team_id = p_team_id, period_type = p_period_type, target_value = p_target_value,
      start_date = p_start_date, end_date = p_end_date, notes = NULLIF(trim(p_notes), ''), result_source = v_source, updated_by = auth.uid()
    WHERE id = p_goal_id AND company_id = v_company_id AND status <> 'canceled';
    IF NOT FOUND THEN RAISE EXCEPTION 'Meta não encontrada ou cancelada.' USING ERRCODE = 'P0002'; END IF;
  END IF;
  RETURN v_goal_id;
END; $$;

CREATE OR REPLACE FUNCTION public.update_sales_goal_result(p_goal_id UUID, p_manual_result NUMERIC)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_company_id UUID := public.people_assert_manager(); v_goal public.sales_goals%ROWTYPE; v_has_source BOOLEAN;
BEGIN
  IF p_manual_result IS NULL OR p_manual_result < 0 THEN RAISE EXCEPTION 'Resultado manual inválido.' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_goal FROM public.sales_goals WHERE id = p_goal_id AND company_id = v_company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Meta não encontrada.' USING ERRCODE = 'P0002'; END IF;
  SELECT CASE WHEN v_goal.assignment_type = 'employee'
    THEN EXISTS (SELECT 1 FROM public.employees WHERE id = v_goal.employee_id AND company_id = v_company_id AND sales_profile_id IS NOT NULL AND deleted_at IS NULL)
    ELSE EXISTS (SELECT 1 FROM public.employees WHERE team_id = v_goal.team_id AND company_id = v_company_id AND sales_profile_id IS NOT NULL AND deleted_at IS NULL)
  END INTO v_has_source;
  IF v_goal.result_source = 'automatic' AND v_has_source THEN RAISE EXCEPTION 'Esta meta possui fonte automática de vendas e não aceita resultado manual.' USING ERRCODE = '22023'; END IF;
  UPDATE public.sales_goals SET manual_result = p_manual_result, updated_by = auth.uid()
  WHERE id = p_goal_id AND company_id = v_company_id AND status NOT IN ('canceled', 'completed');
  IF NOT FOUND THEN RAISE EXCEPTION 'Meta concluída ou cancelada não pode ser alterada.' USING ERRCODE = '22023'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.set_sales_goal_status(p_goal_id UUID, p_status TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_company_id UUID := public.people_assert_manager();
BEGIN
  IF p_status NOT IN ('active', 'completed', 'expired', 'canceled') THEN RAISE EXCEPTION 'Status da meta inválido.' USING ERRCODE = '22023'; END IF;
  UPDATE public.sales_goals SET status = p_status, updated_by = auth.uid()
  WHERE id = p_goal_id AND company_id = v_company_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Meta não encontrada.' USING ERRCODE = 'P0002'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.get_sales_goal_progress()
RETURNS TABLE(goal_id UUID, current_result NUMERIC, progress_percent NUMERIC, effective_status TEXT, has_automatic_source BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_company_id UUID := public.people_assert_manager(); v_goal public.sales_goals%ROWTYPE; v_result NUMERIC; v_has BOOLEAN;
BEGIN
  FOR v_goal IN SELECT * FROM public.sales_goals WHERE company_id = v_company_id LOOP
    SELECT CASE WHEN v_goal.assignment_type = 'employee'
      THEN EXISTS (SELECT 1 FROM public.employees WHERE id = v_goal.employee_id AND company_id = v_company_id AND sales_profile_id IS NOT NULL AND deleted_at IS NULL)
      ELSE EXISTS (SELECT 1 FROM public.employees WHERE team_id = v_goal.team_id AND company_id = v_company_id AND sales_profile_id IS NOT NULL AND deleted_at IS NULL)
    END INTO v_has;
    v_result := v_goal.manual_result;
    IF v_goal.result_source = 'automatic' AND v_has THEN
      IF v_goal.goal_type = 'sales_value' THEN
        SELECT COALESCE(sum(s.final_value), 0) INTO v_result FROM public.sales s
        WHERE s.company_id = v_company_id AND s.payment_status = 'paid'
          AND s.created_at >= v_goal.start_date::TIMESTAMPTZ AND s.created_at < (v_goal.end_date + 1)::TIMESTAMPTZ
          AND EXISTS (SELECT 1 FROM public.employees e WHERE e.company_id = v_company_id AND e.sales_profile_id = s.seller_id AND e.deleted_at IS NULL
            AND ((v_goal.assignment_type = 'employee' AND e.id = v_goal.employee_id) OR (v_goal.assignment_type = 'team' AND e.team_id = v_goal.team_id)));
      ELSIF v_goal.goal_type = 'sales_count' THEN
        SELECT count(*)::NUMERIC INTO v_result FROM public.sales s
        WHERE s.company_id = v_company_id AND s.payment_status = 'paid'
          AND s.created_at >= v_goal.start_date::TIMESTAMPTZ AND s.created_at < (v_goal.end_date + 1)::TIMESTAMPTZ
          AND EXISTS (SELECT 1 FROM public.employees e WHERE e.company_id = v_company_id AND e.sales_profile_id = s.seller_id AND e.deleted_at IS NULL
            AND ((v_goal.assignment_type = 'employee' AND e.id = v_goal.employee_id) OR (v_goal.assignment_type = 'team' AND e.team_id = v_goal.team_id)));
      ELSIF v_goal.goal_type = 'new_customers' THEN
        SELECT count(DISTINCT s.customer_id)::NUMERIC INTO v_result FROM public.sales s
        WHERE s.company_id = v_company_id AND s.payment_status = 'paid'
          AND s.created_at >= v_goal.start_date::TIMESTAMPTZ AND s.created_at < (v_goal.end_date + 1)::TIMESTAMPTZ
          AND EXISTS (SELECT 1 FROM public.employees e WHERE e.company_id = v_company_id AND e.sales_profile_id = s.seller_id AND e.deleted_at IS NULL
            AND ((v_goal.assignment_type = 'employee' AND e.id = v_goal.employee_id) OR (v_goal.assignment_type = 'team' AND e.team_id = v_goal.team_id)))
          AND NOT EXISTS (SELECT 1 FROM public.sales previous WHERE previous.company_id = v_company_id AND previous.customer_id = s.customer_id AND previous.payment_status = 'paid' AND previous.created_at < s.created_at);
      END IF;
    END IF;
    goal_id := v_goal.id; current_result := COALESCE(v_result, 0);
    progress_percent := LEAST(999.99, round((current_result / v_goal.target_value) * 100, 2));
    has_automatic_source := v_has;
    effective_status := CASE
      WHEN v_goal.status = 'canceled' THEN 'canceled'
      WHEN v_goal.status = 'completed' OR current_result >= v_goal.target_value THEN 'completed'
      WHEN v_goal.status = 'expired' OR v_goal.end_date < CURRENT_DATE THEN 'expired'
      ELSE 'active' END;
    RETURN NEXT;
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.get_team_sales_totals(p_date_from DATE, p_date_to DATE)
RETURNS TABLE(team_id UUID, sales_total NUMERIC, has_sales_source BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_company_id UUID := public.people_assert_manager();
BEGIN
  IF p_date_to < p_date_from THEN RAISE EXCEPTION 'Período inválido.' USING ERRCODE = '22023'; END IF;
  RETURN QUERY
  SELECT t.id,
    COALESCE(sum(s.final_value) FILTER (WHERE s.payment_status = 'paid' AND s.created_at >= p_date_from::TIMESTAMPTZ AND s.created_at < (p_date_to + 1)::TIMESTAMPTZ), 0)::NUMERIC,
    bool_or(e.sales_profile_id IS NOT NULL)
  FROM public.teams t
  LEFT JOIN public.employees e ON e.team_id = t.id AND e.company_id = t.company_id AND e.deleted_at IS NULL AND e.status = 'active'
  LEFT JOIN public.sales s ON s.company_id = t.company_id AND s.seller_id = e.sales_profile_id
  WHERE t.company_id = v_company_id
  GROUP BY t.id;
END; $$;

REVOKE ALL ON FUNCTION public.people_write_team_audit_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.people_write_goal_audit_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_team(UUID, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_team_status(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_employee(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, DATE, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, BOOLEAN, TEXT, UUID, UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_commission(UUID, UUID, UUID, TEXT, DATE, NUMERIC, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_sales_goal(UUID, TEXT, TEXT, TEXT, UUID, UUID, TEXT, NUMERIC, DATE, DATE, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_sales_goal_result(UUID, NUMERIC) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_sales_goal_status(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_sales_goal_progress() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_team_sales_totals(DATE, DATE) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.save_team(UUID, TEXT, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_team_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_employee(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, DATE, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, BOOLEAN, TEXT, UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_commission(UUID, UUID, UUID, TEXT, DATE, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_sales_goal(UUID, TEXT, TEXT, TEXT, UUID, UUID, TEXT, NUMERIC, DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_sales_goal_result(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_sales_goal_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sales_goal_progress() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_sales_totals(DATE, DATE) TO authenticated;

COMMENT ON TABLE public.teams IS 'Equipes administrativas internas isoladas por empresa.';
COMMENT ON TABLE public.sales_goals IS 'Metas gerenciais sem geração automática de prêmio, comissão ou pagamento.';
COMMENT ON COLUMN public.employees.sales_profile_id IS 'Vínculo explícito e opcional com vendedor real para progresso de metas.';
COMMENT ON COLUMN public.commissions.team_id IS 'Equipe administrativa registrada; não determina nem calcula o valor da comissão.';
