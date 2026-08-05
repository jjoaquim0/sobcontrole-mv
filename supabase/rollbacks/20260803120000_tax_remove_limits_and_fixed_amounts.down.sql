-- Rollback — restaura teto/sublimite e DAS de valor fixo do MEI
--
-- ATENÇÃO: recria as ESTRUTURAS, mas NÃO ressemeia os valores. Os números
-- (tetos, sublimite e composição do DAS do MEI) foram retirados justamente por
-- não terem sido aprovados pelo contador. Se este rollback for aplicado, as
-- tabelas voltam vazias e devem ser populadas por migration própria, com os
-- valores conferidos contra a publicação oficial.

BEGIN;

CREATE TABLE IF NOT EXISTS tax_fixed_amounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    regime TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    inss_amount NUMERIC(14, 2) NOT NULL,
    icms_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    iss_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    amount NUMERIC(14, 2) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    legal_reference TEXT NOT NULL,
    requires_validation BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT tax_fixed_amounts_regime_check CHECK (regime IN ('mei')),
    CONSTRAINT tax_fixed_amounts_activity_check
      CHECK (activity_type IN ('comercio', 'servicos', 'comercio_servicos')),
    CONSTRAINT tax_fixed_amounts_total_check
      CHECK (amount = inss_amount + icms_amount + iss_amount),
    CONSTRAINT tax_fixed_amounts_validity_check
      CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT tax_fixed_amounts_unique UNIQUE (regime, activity_type, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_tax_fixed_amounts_lookup
  ON tax_fixed_amounts(regime, activity_type, effective_from, effective_to);

CREATE TABLE IF NOT EXISTS tax_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    regime TEXT NOT NULL,
    limit_kind TEXT NOT NULL,
    amount NUMERIC(14, 2) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    legal_reference TEXT NOT NULL,
    requires_validation BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT tax_limits_regime_check CHECK (regime IN ('mei', 'simples_nacional')),
    CONSTRAINT tax_limits_kind_check CHECK (limit_kind IN ('teto_anual', 'sublimite')),
    CONSTRAINT tax_limits_amount_check CHECK (amount > 0),
    CONSTRAINT tax_limits_validity_check CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT tax_limits_unique UNIQUE (regime, limit_kind, effective_from)
);

ALTER TABLE tax_fixed_amounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura do catalogo de valores fixos" ON tax_fixed_amounts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Leitura do catalogo de limites" ON tax_limits
  FOR SELECT TO authenticated USING (true);

REVOKE ALL ON tax_fixed_amounts, tax_limits FROM anon;

COMMIT;
