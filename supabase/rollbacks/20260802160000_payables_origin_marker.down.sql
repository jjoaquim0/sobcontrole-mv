-- Rollback — Story 1.30: marcador de origem em account_payables
--
-- ATENÇÃO: sem a coluna, a DRE volta a contar guias tributárias como despesa
-- operacional manual. Reverter esta migration exige reverter também a linha de
-- imposto na DRE (reportIntelligenceService), sob pena de dupla contagem.

BEGIN;

DROP INDEX IF EXISTS idx_account_payables_company_origin;

ALTER TABLE account_payables
  DROP CONSTRAINT IF EXISTS account_payables_origin_check;

ALTER TABLE account_payables
  DROP COLUMN IF EXISTS origin;

COMMIT;
