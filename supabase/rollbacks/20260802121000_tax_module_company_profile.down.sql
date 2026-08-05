-- Rollback — Story 1.28: perfil tributário por empresa
--
-- Rodar ANTES do rollback do catálogo (20260802120000).
--
-- ATENÇÃO: derruba o perfil tributário e a folha informada manualmente. A folha
-- não existe em nenhuma outra tabela do sistema — exportar antes se os dados
-- forem necessários.

BEGIN;

DROP TRIGGER IF EXISTS trg_company_payroll_entries_updated_at ON company_payroll_entries;
DROP TRIGGER IF EXISTS trg_company_tax_profile_updated_at ON company_tax_profile;

DROP INDEX IF EXISTS idx_company_payroll_entries_company_month;
DROP INDEX IF EXISTS idx_company_tax_profile_company;

DROP TABLE IF EXISTS company_payroll_entries;
DROP TABLE IF EXISTS company_tax_profile;

DROP FUNCTION IF EXISTS public.tax_set_updated_at();
DROP FUNCTION IF EXISTS public.assert_tax_management_access();
DROP FUNCTION IF EXISTS public.is_tax_manager();

COMMIT;
