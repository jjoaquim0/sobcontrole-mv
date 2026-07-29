-- Story 1.15 — Previsão de Fluxo de Caixa
-- A nova aba consulta account_receivables/account_payables filtrando por
-- company_id + status + due_date (saldo realizado e lançamentos em aberto
-- até o fim do período). Nenhuma tabela nova é criada; apenas índices para
-- essas consultas, que também beneficiam o Dashboard e os Relatórios
-- (getFinancialSummary/getFinancialReport já filtram pelas mesmas colunas).

CREATE INDEX IF NOT EXISTS idx_account_receivables_company_status_due
  ON account_receivables(company_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_account_payables_company_status_due
  ON account_payables(company_id, status, due_date);
