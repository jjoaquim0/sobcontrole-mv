-- Story 1.30 — Apuração mensal e obrigações tributárias
--
-- Duas ideias sustentam este schema:
--
-- 1. A APURAÇÃO É UM SNAPSHOT, NÃO UMA VIEW.
--    calculation_basis grava as entradas e a versão do catálogo usada. O número
--    de março precisa continuar reproduzível em outubro, mesmo depois de o
--    cliente reclassificar produtos ou de a legislação mudar. Recalcular só por
--    ação explícita.
--
-- 2. A GUIA É A FONTE DA VERDADE; account_payables É ESPELHO.
--    O imposto precisa aparecer no fluxo de caixa e no DRE, o que exige um
--    título financeiro. Mas duas fontes independentes divergem. Por isso a
--    obrigação referencia seu espelho por payable_id, e a baixa é sincronizada
--    nos dois sentidos por trigger.

BEGIN;

-- =========================================================================
-- 1. APURAÇÃO MENSAL
-- =========================================================================

CREATE TABLE IF NOT EXISTS tax_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    -- Sempre o primeiro dia do mês de competência.
    reference_month DATE NOT NULL,

    regime TEXT NOT NULL,
    ibs_cbs_regime TEXT NOT NULL DEFAULT 'simples',

    -- RBT12 é ÚNICO E TOTAL: a mesma base de faixa serve a todos os anexos.
    rbt12 NUMERIC(14, 2) NOT NULL DEFAULT 0,
    rbt12_from_initial_load NUMERIC(14, 2) NOT NULL DEFAULT 0,
    rbt12_months_from_system INTEGER NOT NULL DEFAULT 0,

    gross_revenue_month NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_taxable_base NUMERIC(14, 2) NOT NULL DEFAULT 0,
    estimated_tax NUMERIC(14, 2) NOT NULL DEFAULT 0,

    -- Detalhamento por anexo: receita, base, alíquotas e imposto de cada um.
    per_anexo JSONB NOT NULL DEFAULT '[]'::jsonb,

    fator_r NUMERIC(6, 4),
    fator_r_available BOOLEAN NOT NULL DEFAULT false,

    -- Fração de 0 a 1 da receita com classificação fiscal explícita.
    classification_coverage NUMERIC(6, 4),

    status TEXT NOT NULL DEFAULT 'estimated',
    -- Valor real do DAS informado pelo contador. Quando presente, prevalece
    -- sobre a estimativa em todas as superfícies.
    confirmed_amount NUMERIC(14, 2),
    confirmed_at TIMESTAMPTZ,
    confirmed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    -- (confirmado − estimado) / estimado. Alimenta o erro medido exibido ao
    -- cliente: o módulo não promete acertar, ele mostra o quanto está acertando.
    variance_pct NUMERIC(8, 4),

    -- true enquanto alguma linha de catálogo usada não tiver sido conferida.
    requires_catalog_validation BOOLEAN NOT NULL DEFAULT true,

    -- Entradas, contagens e versão do catálogo. É o que torna o número
    -- auditável meses depois.
    calculation_basis JSONB NOT NULL DEFAULT '{}'::jsonb,
    warnings JSONB NOT NULL DEFAULT '[]'::jsonb,

    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

    CONSTRAINT tax_assessments_regime_check
      CHECK (regime IN ('mei', 'simples_nacional', 'lucro_presumido', 'lucro_real')),
    CONSTRAINT tax_assessments_ibs_cbs_check CHECK (ibs_cbs_regime IN ('simples', 'regular')),
    CONSTRAINT tax_assessments_status_check CHECK (status IN ('estimated', 'confirmed')),
    CONSTRAINT tax_assessments_month_check
      CHECK (reference_month = date_trunc('month', reference_month)::date),
    CONSTRAINT tax_assessments_coverage_check
      CHECK (classification_coverage IS NULL OR (classification_coverage >= 0 AND classification_coverage <= 1)),
    -- Status 'confirmed' sem valor informado seria confirmação vazia.
    CONSTRAINT tax_assessments_confirmed_requires_amount
      CHECK (status <> 'confirmed' OR confirmed_amount IS NOT NULL),
    CONSTRAINT tax_assessments_unique UNIQUE (company_id, reference_month)
);

CREATE INDEX IF NOT EXISTS idx_tax_assessments_company_month
  ON tax_assessments(company_id, reference_month DESC);

CREATE TRIGGER trg_tax_assessments_updated_at
  BEFORE UPDATE ON tax_assessments
  FOR EACH ROW EXECUTE FUNCTION public.tax_set_updated_at();

-- =========================================================================
-- 2. OBRIGAÇÕES (GUIAS)
-- =========================================================================

CREATE TABLE IF NOT EXISTS tax_obligations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    assessment_id UUID REFERENCES tax_assessments(id) ON DELETE SET NULL,

    kind TEXT NOT NULL,
    label TEXT NOT NULL,
    reference_month DATE NOT NULL,
    due_date DATE NOT NULL,
    amount NUMERIC(14, 2) NOT NULL DEFAULT 0,

    status TEXT NOT NULL DEFAULT 'pending',
    paid_at TIMESTAMPTZ,

    -- Comprovante ou guia anexada, reaproveitando o módulo de documentos.
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    -- Espelho financeiro. A guia é a fonte da verdade; o título existe para o
    -- imposto aparecer no fluxo de caixa e no DRE.
    payable_id TEXT REFERENCES account_payables(id) ON DELETE SET NULL,

    -- true quando o valor foi digitado à mão (regimes sem estimativa).
    is_manual BOOLEAN NOT NULL DEFAULT false,
    note TEXT,

    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

    CONSTRAINT tax_obligations_kind_check
      CHECK (kind IN ('das', 'iss', 'icms', 'irpj', 'csll', 'cbs', 'ibs', 'outros')),
    CONSTRAINT tax_obligations_status_check
      CHECK (status IN ('pending', 'paid', 'late', 'canceled')),
    CONSTRAINT tax_obligations_amount_check CHECK (amount >= 0),
    CONSTRAINT tax_obligations_month_check
      CHECK (reference_month = date_trunc('month', reference_month)::date),
    CONSTRAINT tax_obligations_paid_requires_date
      CHECK (status <> 'paid' OR paid_at IS NOT NULL),
    -- Uma guia por tipo e competência: impede duplicar o DAS do mesmo mês.
    CONSTRAINT tax_obligations_unique UNIQUE (company_id, kind, reference_month)
);

CREATE INDEX IF NOT EXISTS idx_tax_obligations_company_due
  ON tax_obligations(company_id, due_date);
CREATE INDEX IF NOT EXISTS idx_tax_obligations_company_status
  ON tax_obligations(company_id, status, due_date);
-- Índice parcial único: nenhum título financeiro pode espelhar duas guias.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_obligations_payable
  ON tax_obligations(payable_id)
  WHERE payable_id IS NOT NULL;

CREATE TRIGGER trg_tax_obligations_updated_at
  BEFORE UPDATE ON tax_obligations
  FOR EACH ROW EXECUTE FUNCTION public.tax_set_updated_at();

-- =========================================================================
-- 3. SINCRONIZAÇÃO COM O FINANCEIRO
-- =========================================================================

-- Baixar a guia reflete no título espelhado, e vice-versa. Sem isso, o cliente
-- veria a guia paga e a conta a pagar em aberto, ou o contrário — e o fluxo de
-- caixa mentiria.
CREATE OR REPLACE FUNCTION public.sync_tax_obligation_to_payable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.payable_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.amount IS NOT DISTINCT FROM OLD.amount
     AND NEW.due_date IS NOT DISTINCT FROM OLD.due_date THEN
    RETURN NEW;
  END IF;

  UPDATE public.account_payables
     SET amount = NEW.amount,
         due_date = NEW.due_date,
         status = NEW.status,
         paid_at = NEW.paid_at
   WHERE id = NEW.payable_id
     AND company_id = NEW.company_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_tax_obligation_to_payable
  AFTER INSERT OR UPDATE ON tax_obligations
  FOR EACH ROW EXECUTE FUNCTION public.sync_tax_obligation_to_payable();

CREATE OR REPLACE FUNCTION public.sync_payable_to_tax_obligation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.paid_at IS NOT DISTINCT FROM OLD.paid_at THEN
    RETURN NEW;
  END IF;

  UPDATE public.tax_obligations
     SET status = NEW.status,
         paid_at = NEW.paid_at
   WHERE payable_id = NEW.id
     AND company_id = NEW.company_id
     AND (status IS DISTINCT FROM NEW.status OR paid_at IS DISTINCT FROM NEW.paid_at);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_payable_to_tax_obligation
  AFTER UPDATE ON account_payables
  FOR EACH ROW EXECUTE FUNCTION public.sync_payable_to_tax_obligation();

-- =========================================================================
-- 4. SEGURANÇA
-- =========================================================================

ALTER TABLE tax_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_obligations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Apuracao tributaria da propria empresa" ON tax_assessments
FOR ALL
USING (company_id = get_user_company_id() AND is_tax_manager())
WITH CHECK (company_id = get_user_company_id() AND is_tax_manager());

CREATE POLICY "Obrigacoes tributarias da propria empresa" ON tax_obligations
FOR ALL
USING (company_id = get_user_company_id() AND is_tax_manager())
WITH CHECK (company_id = get_user_company_id() AND is_tax_manager());

REVOKE ALL ON tax_assessments, tax_obligations FROM anon;

COMMENT ON COLUMN tax_assessments.calculation_basis IS
  'Entradas e versão do catálogo usadas na apuração. Torna o número reproduzível meses depois, mesmo após reclassificação de produtos ou mudança de legislação.';
COMMENT ON COLUMN tax_assessments.variance_pct IS
  'Divergência entre estimado e confirmado. Base do erro medido exibido ao cliente.';
COMMENT ON COLUMN tax_obligations.payable_id IS
  'Espelho em account_payables. A guia é a fonte da verdade; a baixa é sincronizada nos dois sentidos por trigger.';

COMMIT;
