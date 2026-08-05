-- Story 1.30 — Preparação para a transição da Reforma Tributária (EC 132/2023,
-- LC 214/2025, Resolução CGSN nº 186/2026).
--
-- POR QUE ISTO ENTRA AGORA, E NÃO DEPOIS
--
-- 2026 não exige nada do módulo: optantes do Simples e MEI não têm alteração
-- neste ano e só passam a destacar IBS/CBS a partir de 2027. O motor atual está
-- correto para a competência corrente.
--
-- A partir de 2027, porém, o optante do Simples pode escolher apurar IBS e CBS
-- pelo REGIME REGULAR, fora do DAS ("regime híbrido"): IRPJ, CSLL, CPP e IPI
-- permanecem no DAS, e IBS/CBS saem. Nesse cenário, aplicar a alíquota efetiva
-- cheia do anexo SUPERESTIMA o imposto, porque parte dela corresponde a
-- tributos que deixaram de ser recolhidos ali.
--
-- Corrigir isso exige decompor a alíquota da faixa por tributo — uma mudança
-- estrutural no catálogo. Fazer depois significaria migrar apurações já
-- gravadas. Fazer agora custa uma migration.
--
-- DECISÃO SOBRE O SEED: as tabelas de repartição da LC 123 não são semeadas
-- aqui. Semear percentual errado seria pior do que não semear — o motor
-- devolve "não calculável" com motivo explícito quando o regime híbrido está
-- ativo e a repartição não foi cadastrada. Ele se recusa a chutar.

BEGIN;

-- =========================================================================
-- 1. REPARTIÇÃO DA ALÍQUOTA POR TRIBUTO
-- =========================================================================

-- Percentual de cada tributo dentro da alíquota da faixa (LC 123/2006, tabelas
-- de repartição dos Anexos I a V). Necessário para separar o que sai do DAS
-- quando a empresa opta pelo regime regular de IBS/CBS.
CREATE TABLE IF NOT EXISTS tax_bracket_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    regime TEXT NOT NULL DEFAULT 'simples_nacional',
    anexo TEXT NOT NULL,
    bracket_order INTEGER NOT NULL,
    tributo TEXT NOT NULL,
    -- Fração da alíquota da faixa: 0.3350 = 33,50% da alíquota vai para este
    -- tributo. A soma dos componentes de uma faixa deve fechar em 1.
    share NUMERIC(6, 4) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    legal_reference TEXT NOT NULL,
    requires_validation BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT tax_bracket_components_anexo_check CHECK (anexo IN ('I', 'II', 'III', 'IV', 'V')),
    CONSTRAINT tax_bracket_components_tributo_check
      CHECK (tributo IN ('irpj', 'csll', 'cofins', 'pis', 'cpp', 'icms', 'iss', 'ipi', 'cbs', 'ibs')),
    CONSTRAINT tax_bracket_components_share_check CHECK (share >= 0 AND share <= 1),
    CONSTRAINT tax_bracket_components_validity_check
      CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT tax_bracket_components_unique
      UNIQUE (regime, anexo, bracket_order, tributo, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_tax_bracket_components_lookup
  ON tax_bracket_components(regime, anexo, bracket_order, effective_from);

-- =========================================================================
-- 2. JANELAS DE OPÇÃO DE REGIME
-- =========================================================================

-- Prazos legais de opção, versionados como dado. O alerta que avisa o cliente
-- da janela lê daqui — não de constante em código, porque as datas mudam a
-- cada exercício.
CREATE TABLE IF NOT EXISTS tax_regime_option_windows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    option_kind TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT NOT NULL,
    opens_on DATE NOT NULL,
    closes_on DATE NOT NULL,
    -- Data em que a escolha passa a produzir efeito.
    effect_starts_on DATE NOT NULL,
    -- Prazo final para cancelar a opção, quando existir.
    cancellable_until DATE,
    legal_reference TEXT NOT NULL,
    requires_validation BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT tax_regime_option_windows_kind_check
      CHECK (option_kind IN ('simples_nacional', 'ibs_cbs_regime_regular')),
    CONSTRAINT tax_regime_option_windows_range_check CHECK (closes_on >= opens_on),
    CONSTRAINT tax_regime_option_windows_unique UNIQUE (option_kind, opens_on)
);

-- Resolução CGSN nº 186/2026. Conferir as datas com o contador antes de
-- disparar alerta em produção — requires_validation = true por isso.
INSERT INTO tax_regime_option_windows
  (option_kind, label, description, opens_on, closes_on, effect_starts_on, cancellable_until, legal_reference)
VALUES
  ('simples_nacional',
   'Opção pelo Simples Nacional para 2027',
   'Janela de formalização da opção pelo Simples Nacional com efeitos a partir de 1º de janeiro de 2027.',
   '2026-09-01', '2026-09-30', '2027-01-01', '2026-11-30',
   'Resolução CGSN nº 186/2026'),
  ('ibs_cbs_regime_regular',
   'Opção pelo regime regular de IBS e CBS (1º semestre de 2027)',
   'Optantes do Simples podem escolher apurar IBS e CBS pelo regime regular, fora do DAS. Nesse caso, essas parcelas deixam de ser devidas dentro do Simples.',
   '2026-09-01', '2026-09-30', '2027-01-01', '2026-11-30',
   'Resolução CGSN nº 186/2026; LC 214/2025')
ON CONFLICT (option_kind, opens_on) DO NOTHING;

-- =========================================================================
-- 3. REGIME DE IBS/CBS NO PERFIL DA EMPRESA
-- =========================================================================

ALTER TABLE company_tax_profile
  -- 'simples': IBS e CBS recolhidos dentro do DAS (padrão até 2027).
  -- 'regular': regime híbrido — IBS e CBS apurados fora do DAS.
  ADD COLUMN IF NOT EXISTS ibs_cbs_regime TEXT NOT NULL DEFAULT 'simples',
  -- A opção é semestral; guardar a vigência evita reescrever apuração passada.
  ADD COLUMN IF NOT EXISTS ibs_cbs_regime_effective_from DATE,
  ADD COLUMN IF NOT EXISTS ibs_cbs_regime_confirmed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_tax_profile_ibs_cbs_regime_check'
  ) THEN
    ALTER TABLE company_tax_profile
      ADD CONSTRAINT company_tax_profile_ibs_cbs_regime_check
      CHECK (ibs_cbs_regime IN ('simples', 'regular'));
  END IF;
END $$;

-- =========================================================================
-- 4. SEGURANÇA
-- =========================================================================

ALTER TABLE tax_bracket_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_regime_option_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura da repartição de tributos" ON tax_bracket_components
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Leitura das janelas de opção" ON tax_regime_option_windows
  FOR SELECT TO authenticated USING (true);

REVOKE ALL ON tax_bracket_components, tax_regime_option_windows FROM anon;

COMMENT ON TABLE tax_bracket_components IS
  'Repartição da alíquota da faixa por tributo. Necessária a partir de 2027 para o regime híbrido, quando IBS e CBS saem do DAS. Não semeada: o motor recusa o cálculo em vez de estimar a repartição.';
COMMENT ON TABLE tax_regime_option_windows IS
  'Janelas legais de opção de regime. Alimenta o alerta que avisa o cliente antes do prazo — nenhuma data vive em código.';
COMMENT ON COLUMN company_tax_profile.ibs_cbs_regime IS
  'simples = IBS/CBS dentro do DAS; regular = regime híbrido, apurados fora. Opção semestral a partir de 2027 (LC 214/2025).';

COMMIT;
