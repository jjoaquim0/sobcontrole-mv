-- Rollback — Story 1.28: catálogo tributário global
--
-- Ordem inversa da criação. As tabelas de catálogo não têm dependentes fora do
-- módulo tributário; company_tax_profile é derrubado pelo rollback da migration
-- 20260802121000, que deve rodar ANTES deste arquivo.

BEGIN;

DROP INDEX IF EXISTS idx_cnpj_registry_cache_expiry;
DROP INDEX IF EXISTS idx_cnae_anexo_map_prefix;
DROP INDEX IF EXISTS idx_tax_fixed_amounts_lookup;
DROP INDEX IF EXISTS idx_tax_brackets_lookup;

DROP TABLE IF EXISTS cnpj_registry_cache;
DROP TABLE IF EXISTS cnae_anexo_map;
DROP TABLE IF EXISTS tax_due_date_rules;
DROP TABLE IF EXISTS tax_limits;
DROP TABLE IF EXISTS tax_fixed_amounts;
DROP TABLE IF EXISTS tax_brackets;

COMMIT;
