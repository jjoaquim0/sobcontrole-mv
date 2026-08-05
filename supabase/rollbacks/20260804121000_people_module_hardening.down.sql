DROP INDEX IF EXISTS public.people_audit_actor_id_idx;
DROP INDEX IF EXISTS public.people_audit_employee_id_idx;
DROP INDEX IF EXISTS public.commissions_updated_by_idx;
DROP INDEX IF EXISTS public.commissions_created_by_idx;
DROP INDEX IF EXISTS public.employees_updated_by_idx;
DROP INDEX IF EXISTS public.employees_created_by_idx;
DROP INDEX IF EXISTS public.commissions_employee_company_fk_idx;
DROP INDEX IF EXISTS public.employee_sensitive_employee_company_fk_idx;
DROP POLICY IF EXISTS "Dados sensíveis de funcionários não são legíveis pelo cliente"
  ON public.employee_sensitive_data;
