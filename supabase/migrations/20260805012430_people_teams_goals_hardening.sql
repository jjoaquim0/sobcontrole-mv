-- Índices de suporte às FKs apontados pelos advisors do Supabase.
CREATE INDEX teams_manager_company_fk_idx ON public.teams(manager_employee_id, company_id);
CREATE INDEX teams_created_by_fk_idx ON public.teams(created_by);
CREATE INDEX teams_updated_by_fk_idx ON public.teams(updated_by);

CREATE INDEX employees_team_company_fk_idx ON public.employees(team_id, company_id);
CREATE INDEX employees_manager_company_fk_idx ON public.employees(manager_employee_id, company_id);
CREATE INDEX employees_sales_profile_fk_idx ON public.employees(sales_profile_id);

CREATE INDEX commissions_team_company_fk_idx ON public.commissions(team_id, company_id);

CREATE INDEX sales_goals_employee_company_fk_idx ON public.sales_goals(employee_id, company_id);
CREATE INDEX sales_goals_team_company_fk_idx ON public.sales_goals(team_id, company_id);
CREATE INDEX sales_goals_created_by_fk_idx ON public.sales_goals(created_by);
CREATE INDEX sales_goals_updated_by_fk_idx ON public.sales_goals(updated_by);

CREATE INDEX people_audit_events_team_fk_idx ON public.people_audit_events(team_id);
