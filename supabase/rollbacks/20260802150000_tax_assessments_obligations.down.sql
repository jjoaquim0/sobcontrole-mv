-- Rollback — Story 1.30: apuração e obrigações tributárias
--
-- ATENÇÃO: derruba o histórico de apurações, incluindo os valores confirmados
-- pelo contador e a base de cálculo auditável. Os títulos espelhados em
-- account_payables NÃO são removidos — ficam órfãos e devem ser tratados
-- manualmente, porque podem já ter sido pagos.

BEGIN;

DROP TRIGGER IF EXISTS trg_sync_payable_to_tax_obligation ON account_payables;
DROP TRIGGER IF EXISTS trg_sync_tax_obligation_to_payable ON tax_obligations;
DROP TRIGGER IF EXISTS trg_tax_obligations_updated_at ON tax_obligations;
DROP TRIGGER IF EXISTS trg_tax_assessments_updated_at ON tax_assessments;

DROP FUNCTION IF EXISTS public.sync_payable_to_tax_obligation();
DROP FUNCTION IF EXISTS public.sync_tax_obligation_to_payable();

DROP INDEX IF EXISTS idx_tax_obligations_payable;
DROP INDEX IF EXISTS idx_tax_obligations_company_status;
DROP INDEX IF EXISTS idx_tax_obligations_company_due;
DROP INDEX IF EXISTS idx_tax_assessments_company_month;

DROP TABLE IF EXISTS tax_obligations;
DROP TABLE IF EXISTS tax_assessments;

COMMIT;
