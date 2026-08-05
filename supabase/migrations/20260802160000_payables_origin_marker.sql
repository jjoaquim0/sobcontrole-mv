-- Story 1.30 — Marcador de origem em account_payables
--
-- POR QUE ISTO É NECESSÁRIO
--
-- A DRE monta "DESPESAS OPERACIONAIS MANUAIS" a partir de account_payables com
-- purchase_id nulo. As guias tributárias espelhadas caem exatamente nesse
-- filtro. Sem um marcador, acrescentar a linha de imposto ao DRE contaria o
-- mesmo valor DUAS VEZES — uma como despesa manual, outra como dedução — e o
-- resultado sairia errado pelo dobro do imposto.
--
-- O marcador resolve de forma definitiva: a DRE exclui origin = 'tax' das
-- despesas manuais e apresenta o imposto na própria linha de dedução.

BEGIN;

ALTER TABLE account_payables
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'manual';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'account_payables_origin_check'
  ) THEN
    ALTER TABLE account_payables
      ADD CONSTRAINT account_payables_origin_check
      CHECK (origin IN ('manual', 'purchase', 'tax'));
  END IF;
END $$;

-- Títulos legados originados de compra passam a se identificar como tais.
-- Os demais permanecem 'manual', que é o comportamento atual.
UPDATE account_payables
   SET origin = 'purchase'
 WHERE purchase_id IS NOT NULL
   AND origin = 'manual';

CREATE INDEX IF NOT EXISTS idx_account_payables_company_origin
  ON account_payables(company_id, origin, due_date);

COMMENT ON COLUMN account_payables.origin IS
  'manual | purchase | tax. Impede dupla contagem na DRE: títulos com origin = tax aparecem na linha de impostos, não em despesas operacionais.';

COMMIT;
