-- Story 1.28 — Módulo Tributário: perfil tributário por empresa
--
-- Dado tributário é dado financeiro: leitura e escrita restritas a admin e
-- manager, validadas no banco e não apenas na rota React — mesma defesa em
-- profundidade de 20260729171032_reports_financial_access_guard.sql.

BEGIN;

-- =========================================================================
-- 1. HELPERS
-- =========================================================================

-- Versão booleana do guard, para uso dentro de políticas RLS (política precisa
-- de predicado, não de exceção). O guard que levanta exceção fica logo abaixo,
-- para uso em RPC.
CREATE OR REPLACE FUNCTION public.is_tax_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = auth.uid()
      AND profile.role IN ('admin', 'manager')
  );
$$;

REVOKE ALL ON FUNCTION public.is_tax_manager() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tax_manager() TO authenticated;

CREATE OR REPLACE FUNCTION public.assert_tax_management_access()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id UUID;
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'authentication required';
  END IF;

  SELECT profile.company_id, profile.role
    INTO v_company_id, v_role
  FROM public.profiles AS profile
  WHERE profile.id = auth.uid();

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'company context unavailable';
  END IF;

  IF v_role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'tax permission denied';
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_tax_management_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_tax_management_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.tax_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- =========================================================================
-- 2. PERFIL TRIBUTÁRIO (1:1 com companies)
-- =========================================================================

CREATE TABLE IF NOT EXISTS company_tax_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE UNIQUE NOT NULL,

    regime TEXT NOT NULL,
    simples_anexo TEXT,
    mei_activity_type TEXT,

    uf TEXT DEFAULT '',
    municipio TEXT DEFAULT '',
    codigo_municipio_ibge TEXT DEFAULT '',
    iss_rate NUMERIC(6, 4) NOT NULL DEFAULT 0,

    -- 'competencia' usa sales.created_at; 'caixa' usa account_receivables.paid_at.
    -- A escolha muda o número e por isso é exibida na interface.
    revenue_basis TEXT NOT NULL DEFAULT 'competencia',

    -- Sem isso, os 12 primeiros meses de uso produzem RBT12 irreal e, portanto,
    -- alíquota efetiva irreal. Obrigatório no onboarding do Simples.
    rbt12_initial NUMERIC(14, 2) NOT NULL DEFAULT 0,
    rbt12_initial_reference_month DATE,

    fator_r_enabled BOOLEAN NOT NULL DEFAULT false,

    cnae_principal TEXT DEFAULT '',
    cnaes_secundarios JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Rastreabilidade da origem: dado derivado da Receita, declarado à mão, ou
    -- derivado e corrigido pelo usuário.
    source TEXT NOT NULL DEFAULT 'manual',
    source_fetched_at TIMESTAMPTZ,
    -- Perfil só vale depois de confirmado explicitamente. Nulo = pendente.
    confirmed_at TIMESTAMPTZ,
    confirmed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    -- Marcado pela revalidação quando a Receita indica mudança de regime.
    needs_reconfirmation BOOLEAN NOT NULL DEFAULT false,
    reconfirmation_reason TEXT,

    opted_at DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

    CONSTRAINT company_tax_profile_regime_check
      CHECK (regime IN ('mei', 'simples_nacional', 'lucro_presumido', 'lucro_real', 'indeterminado')),
    CONSTRAINT company_tax_profile_anexo_check
      CHECK (simples_anexo IS NULL OR simples_anexo IN ('I', 'II', 'III', 'IV', 'V')),
    CONSTRAINT company_tax_profile_mei_activity_check
      CHECK (mei_activity_type IS NULL OR mei_activity_type IN ('comercio', 'servicos', 'comercio_servicos')),
    CONSTRAINT company_tax_profile_revenue_basis_check
      CHECK (revenue_basis IN ('competencia', 'caixa')),
    CONSTRAINT company_tax_profile_source_check
      CHECK (source IN ('receita', 'manual', 'receita_corrigido')),
    CONSTRAINT company_tax_profile_iss_check CHECK (iss_rate >= 0 AND iss_rate < 1),
    CONSTRAINT company_tax_profile_rbt12_check CHECK (rbt12_initial >= 0),
    -- Simples exige anexo; MEI exige tipo de atividade. Sem isso não há cálculo.
    CONSTRAINT company_tax_profile_simples_requires_anexo
      CHECK (regime <> 'simples_nacional' OR simples_anexo IS NOT NULL),
    CONSTRAINT company_tax_profile_mei_requires_activity
      CHECK (regime <> 'mei' OR mei_activity_type IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_company_tax_profile_company
  ON company_tax_profile(company_id);

CREATE TRIGGER trg_company_tax_profile_updated_at
  BEFORE UPDATE ON company_tax_profile
  FOR EACH ROW EXECUTE FUNCTION public.tax_set_updated_at();

-- =========================================================================
-- 3. FOLHA MENSAL (base do Fator R)
-- =========================================================================

-- O sistema não tem folha de pagamento. Anexos IV e V dependem do Fator R
-- (folha 12 meses / RBT12), então a folha entra à mão, mês a mês. Sem lançamento
-- no período, o Fator R é declarado indisponível — nunca estimado.
CREATE TABLE IF NOT EXISTS company_payroll_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    -- Sempre o primeiro dia do mês de competência.
    reference_month DATE NOT NULL,
    payroll_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    note TEXT,
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT company_payroll_entries_amount_check CHECK (payroll_amount >= 0),
    CONSTRAINT company_payroll_entries_month_check
      CHECK (reference_month = date_trunc('month', reference_month)::date),
    CONSTRAINT company_payroll_entries_unique UNIQUE (company_id, reference_month)
);

CREATE INDEX IF NOT EXISTS idx_company_payroll_entries_company_month
  ON company_payroll_entries(company_id, reference_month DESC);

CREATE TRIGGER trg_company_payroll_entries_updated_at
  BEFORE UPDATE ON company_payroll_entries
  FOR EACH ROW EXECUTE FUNCTION public.tax_set_updated_at();

-- =========================================================================
-- 4. SEGURANÇA
-- =========================================================================

ALTER TABLE company_tax_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_payroll_entries ENABLE ROW LEVEL SECURITY;

-- Isolamento por empresa E restrição de papel, nas duas direções (USING para
-- leitura/atualização, WITH CHECK para inserção/atualização).
CREATE POLICY "Gestao tributaria da propria empresa" ON company_tax_profile
FOR ALL
USING (company_id = get_user_company_id() AND is_tax_manager())
WITH CHECK (company_id = get_user_company_id() AND is_tax_manager());

CREATE POLICY "Folha da propria empresa" ON company_payroll_entries
FOR ALL
USING (company_id = get_user_company_id() AND is_tax_manager())
WITH CHECK (company_id = get_user_company_id() AND is_tax_manager());

REVOKE ALL ON company_tax_profile, company_payroll_entries FROM anon;

COMMENT ON TABLE company_tax_profile IS
  'Perfil tributário da empresa. Só vale com confirmed_at preenchido: dado derivado da Receita nunca é gravado sem confirmação do usuário.';
COMMENT ON COLUMN company_tax_profile.needs_reconfirmation IS
  'Marcado pela revalidação periódica do CNPJ quando a Receita indica mudança de regime (exclusão do Simples, desenquadramento do MEI).';
COMMENT ON COLUMN company_tax_profile.rbt12_initial IS
  'Receita bruta dos 12 meses anteriores à adoção do sistema. Sem ela, o RBT12 do primeiro ano é irreal e a alíquota efetiva também.';

COMMIT;
