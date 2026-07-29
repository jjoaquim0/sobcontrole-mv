-- Story 1.16 — Recomendações de Estoque e Compras
-- As recomendações em si são calculadas em tempo real a partir de products +
-- sale_items + purchase_items já existentes (sem tabela própria). Estas duas
-- tabelas persistem apenas as ações do usuário sobre uma recomendação
-- (dispensar/adiar/resolver), com auditoria append-only, conforme exigido
-- pela story (nunca apagar recomendações anteriores sem histórico).

CREATE TABLE IF NOT EXISTS stock_recommendation_states (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    recommendation_type TEXT NOT NULL, -- 'reposicao', 'estoque_parado'
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'dismissed', 'postponed', 'resolved'
    postponed_until TIMESTAMPTZ,
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT stock_recommendation_states_unique UNIQUE (company_id, product_id, recommendation_type),
    CONSTRAINT stock_recommendation_states_type_check CHECK (recommendation_type IN ('reposicao', 'estoque_parado')),
    CONSTRAINT stock_recommendation_states_status_check CHECK (status IN ('active', 'dismissed', 'postponed', 'resolved'))
);

CREATE INDEX IF NOT EXISTS idx_stock_recommendation_states_company_status
  ON stock_recommendation_states(company_id, status);

ALTER TABLE stock_recommendation_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total dos membros da empresa aos estados de recomendação" ON stock_recommendation_states
FOR ALL USING (company_id = get_user_company_id());

CREATE TABLE IF NOT EXISTS stock_recommendation_actions (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    recommendation_type TEXT NOT NULL,
    action TEXT NOT NULL, -- 'dismissed', 'postponed', 'resolved'
    reason TEXT,
    snapshot_priority TEXT,
    snapshot_current_quantity NUMERIC(12, 3),
    snapshot_coverage_days NUMERIC(12, 2),
    performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    performed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT stock_recommendation_actions_type_check CHECK (recommendation_type IN ('reposicao', 'estoque_parado')),
    CONSTRAINT stock_recommendation_actions_action_check CHECK (action IN ('dismissed', 'postponed', 'resolved'))
);

CREATE INDEX IF NOT EXISTS idx_stock_recommendation_actions_company_product
  ON stock_recommendation_actions(company_id, product_id, performed_at DESC);

ALTER TABLE stock_recommendation_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total dos membros da empresa ao historico de recomendacoes" ON stock_recommendation_actions
FOR ALL USING (company_id = get_user_company_id());

REVOKE ALL ON stock_recommendation_states, stock_recommendation_actions FROM anon;
