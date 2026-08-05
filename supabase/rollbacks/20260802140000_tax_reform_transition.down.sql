-- Rollback — Story 1.30: preparação para a transição da Reforma Tributária
--
-- Rodar ANTES do rollback do perfil (20260802121000), porque remove colunas de
-- company_tax_profile.

BEGIN;

ALTER TABLE company_tax_profile
  DROP CONSTRAINT IF EXISTS company_tax_profile_ibs_cbs_regime_check;

ALTER TABLE company_tax_profile
  DROP COLUMN IF EXISTS ibs_cbs_regime_confirmed_at,
  DROP COLUMN IF EXISTS ibs_cbs_regime_effective_from,
  DROP COLUMN IF EXISTS ibs_cbs_regime;

DROP INDEX IF EXISTS idx_tax_bracket_components_lookup;

DROP TABLE IF EXISTS tax_regime_option_windows;
DROP TABLE IF EXISTS tax_bracket_components;

COMMIT;
