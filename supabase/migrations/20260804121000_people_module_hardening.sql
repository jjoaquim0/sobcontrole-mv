-- Hardening pós-advisors da Story 1.33.

-- Deixa explícito o deny-all: nem mesmo admin/manager consulta hashes de CPF.
CREATE POLICY "Dados sensíveis de funcionários não são legíveis pelo cliente"
ON public.employee_sensitive_data FOR SELECT TO authenticated
USING (false);

-- Função auxiliar interna, chamada apenas pelas RPCs públicas de escrita.
REVOKE ALL ON FUNCTION public.people_assert_manager() FROM authenticated;

-- Índices de apoio para as FKs indicadas pelos advisors. Não alteram o modelo
-- de autorização e evitam scans em manutenção/exclusão das tabelas referenciadas.
CREATE INDEX employee_sensitive_employee_company_fk_idx
  ON public.employee_sensitive_data(employee_id, company_id);
CREATE INDEX commissions_employee_company_fk_idx
  ON public.commissions(employee_id, company_id);
CREATE INDEX employees_created_by_idx ON public.employees(created_by);
CREATE INDEX employees_updated_by_idx ON public.employees(updated_by);
CREATE INDEX commissions_created_by_idx ON public.commissions(created_by);
CREATE INDEX commissions_updated_by_idx ON public.commissions(updated_by);
CREATE INDEX people_audit_employee_id_idx ON public.people_audit_events(employee_id);
CREATE INDEX people_audit_actor_id_idx ON public.people_audit_events(actor_id);
