-- Story 1.2 — Módulo Financeiro
-- Adiciona colunas de método de pagamento / quitação em contas a receber e a
-- pagar, vincula contas a pagar à compra e ao fornecedor de origem, e cria a
-- tabela financial_categories com RLS multi-tenant espelhando o padrão das
-- demais tabelas do schema (company_id = get_user_company_id()).
--
-- Todas as adições usam IF NOT EXISTS para serem reversíveis e não
-- destrutivas sobre dados legados. supplier_id NÃO é NOT NULL porque linhas
-- de account_payables criadas antes desta story não possuem esse valor.

ALTER TABLE account_receivables
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE account_payables
  ADD COLUMN IF NOT EXISTS purchase_id TEXT REFERENCES purchases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS financial_categories (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'expense', -- 'revenue', 'expense'
    color TEXT DEFAULT '#10b981',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE financial_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total dos membros da empresa às categorias financeiras" ON financial_categories
FOR ALL USING (company_id = get_user_company_id());

REVOKE ALL ON financial_categories FROM anon;
