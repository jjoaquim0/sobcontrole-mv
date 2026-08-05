-- Story 1.28 — Módulo Tributário: catálogo global versionado
--
-- Faixas, alíquotas, parcelas a deduzir, tetos e valores fixos MUDAM POR LEI.
-- Nenhum desses números pode existir como constante em TypeScript: eles vivem
-- aqui, versionados por vigência (effective_from / effective_to), e toda
-- apuração grava qual versão usou. Atualizar legislação passa a ser migração de
-- dados, não deploy de lógica.
--
-- Mesmo padrão de catálogo global de analytics_modules e notification_templates:
-- sem company_id, leitura para authenticated, escrita apenas por migração.
--
-- ATENÇÃO — requires_validation:
-- Toda linha semeada aqui nasce com requires_validation = true. O motor de
-- apuração (Story 1.30) sinaliza a apuração como "pendente de validação de
-- catálogo" enquanto houver linha não validada em uso. Só um contador,
-- conferindo contra a legislação vigente, deve virar essa flag por migração.
-- Isso impede que o produto apresente número com confiança antes de alguém
-- competente ter conferido a fonte.

BEGIN;

-- =========================================================================
-- 1. FAIXAS DO SIMPLES NACIONAL
-- =========================================================================

CREATE TABLE IF NOT EXISTS tax_brackets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    regime TEXT NOT NULL,
    anexo TEXT NOT NULL,
    bracket_order INTEGER NOT NULL,
    rbt12_min NUMERIC(14, 2) NOT NULL,
    -- NULL representa "sem teto" na última faixa, evitando sentinela mágica.
    rbt12_max NUMERIC(14, 2),
    -- Fração decimal: 0.0400 = 4,00%.
    nominal_rate NUMERIC(6, 4) NOT NULL,
    -- Parcela a deduzir (PD), em reais.
    deduction NUMERIC(14, 2) NOT NULL DEFAULT 0,
    effective_from DATE NOT NULL,
    effective_to DATE,
    legal_reference TEXT NOT NULL,
    requires_validation BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT tax_brackets_regime_check CHECK (regime IN ('simples_nacional')),
    CONSTRAINT tax_brackets_anexo_check CHECK (anexo IN ('I', 'II', 'III', 'IV', 'V')),
    CONSTRAINT tax_brackets_range_check CHECK (rbt12_max IS NULL OR rbt12_max > rbt12_min),
    CONSTRAINT tax_brackets_rate_check CHECK (nominal_rate > 0 AND nominal_rate < 1),
    CONSTRAINT tax_brackets_deduction_check CHECK (deduction >= 0),
    CONSTRAINT tax_brackets_validity_check CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT tax_brackets_unique UNIQUE (regime, anexo, bracket_order, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_tax_brackets_lookup
  ON tax_brackets(regime, anexo, effective_from, effective_to);

-- =========================================================================
-- 2. VALORES FIXOS (DAS DO MEI)
-- =========================================================================

CREATE TABLE IF NOT EXISTS tax_fixed_amounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    regime TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    -- Composição explícita: o DAS do MEI é INSS (percentual do salário mínimo)
    -- + ICMS e/ou ISS fixos. Guardar a composição — e não só o total — permite
    -- explicar o número ao usuário e recalcular quando o salário mínimo muda.
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

-- =========================================================================
-- 3. TETOS E SUBLIMITES
-- =========================================================================

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

-- =========================================================================
-- 4. REGRAS DE VENCIMENTO
-- =========================================================================

CREATE TABLE IF NOT EXISTS tax_due_date_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    regime TEXT NOT NULL,
    obligation_kind TEXT NOT NULL,
    label TEXT NOT NULL,
    -- Dia do mês do vencimento e deslocamento em meses sobre a competência.
    -- DAS: dia 20 do mês seguinte → day_of_month = 20, month_offset = 1.
    day_of_month INTEGER NOT NULL,
    month_offset INTEGER NOT NULL DEFAULT 1,
    effective_from DATE NOT NULL,
    effective_to DATE,
    legal_reference TEXT NOT NULL,
    requires_validation BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT tax_due_date_rules_regime_check CHECK (regime IN ('mei', 'simples_nacional')),
    CONSTRAINT tax_due_date_rules_kind_check
      CHECK (obligation_kind IN ('das', 'iss', 'icms', 'irpj', 'csll', 'outros')),
    CONSTRAINT tax_due_date_rules_day_check CHECK (day_of_month BETWEEN 1 AND 31),
    CONSTRAINT tax_due_date_rules_offset_check CHECK (month_offset BETWEEN 0 AND 12),
    CONSTRAINT tax_due_date_rules_validity_check
      CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT tax_due_date_rules_unique UNIQUE (regime, obligation_kind, effective_from)
);

-- =========================================================================
-- 5. MAPA CNAE -> ANEXO
-- =========================================================================

-- Mapeamento por PREFIXO, com vitória do prefixo mais longo. Um mapa completo
-- de CNAE teria ~1300 linhas e envelheceria mal; por prefixo, a divisão cobre o
-- caso geral e as exceções entram como prefixo mais específico.
--
-- confidence controla a interface: 'alta' pré-seleciona o anexo, 'media' e
-- 'requer_confirmacao' obrigam escolha explícita do usuário. CNAE sem match
-- nenhum também cai em confirmação manual.
CREATE TABLE IF NOT EXISTS cnae_anexo_map (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cnae_prefix TEXT NOT NULL,
    anexo TEXT NOT NULL,
    confidence TEXT NOT NULL,
    note TEXT,
    effective_from DATE NOT NULL,
    effective_to DATE,
    requires_validation BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT cnae_anexo_map_anexo_check CHECK (anexo IN ('I', 'II', 'III', 'IV', 'V')),
    CONSTRAINT cnae_anexo_map_confidence_check
      CHECK (confidence IN ('alta', 'media', 'requer_confirmacao')),
    CONSTRAINT cnae_anexo_map_prefix_check CHECK (cnae_prefix ~ '^[0-9]{2,7}$'),
    CONSTRAINT cnae_anexo_map_validity_check
      CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT cnae_anexo_map_unique UNIQUE (cnae_prefix, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_cnae_anexo_map_prefix ON cnae_anexo_map(cnae_prefix);

-- =========================================================================
-- 6. CACHE DE CONSULTA DE CNPJ
-- =========================================================================

-- Catálogo global por CNPJ. A API pública da Receita é gratuita, sem SLA e com
-- rate limit: sem cache, um punhado de empresas derruba a funcionalidade para
-- todo mundo. Escrita apenas pela Edge Function (service_role).
CREATE TABLE IF NOT EXISTS cnpj_registry_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cnpj TEXT NOT NULL UNIQUE,
    payload JSONB NOT NULL,
    source TEXT NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT cnpj_registry_cache_cnpj_check CHECK (cnpj ~ '^[0-9]{14}$'),
    CONSTRAINT cnpj_registry_cache_expiry_check CHECK (expires_at > fetched_at)
);

CREATE INDEX IF NOT EXISTS idx_cnpj_registry_cache_expiry ON cnpj_registry_cache(expires_at);

-- =========================================================================
-- 7. SEGURANÇA DO CATÁLOGO
-- =========================================================================

ALTER TABLE tax_brackets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_fixed_amounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_due_date_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE cnae_anexo_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE cnpj_registry_cache ENABLE ROW LEVEL SECURITY;

-- Catálogo é referência pública para usuário autenticado: leitura liberada,
-- escrita inexistente (apenas migração via service_role, que ignora RLS).
CREATE POLICY "Leitura do catalogo de faixas" ON tax_brackets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Leitura do catalogo de valores fixos" ON tax_fixed_amounts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Leitura do catalogo de limites" ON tax_limits
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Leitura do catalogo de vencimentos" ON tax_due_date_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Leitura do mapa de CNAE" ON cnae_anexo_map
  FOR SELECT TO authenticated USING (true);

-- O cache de CNPJ NÃO tem política de leitura para authenticated: ele guarda
-- dado cadastral de terceiros e só é acessado pela Edge Function.
REVOKE ALL ON tax_brackets, tax_fixed_amounts, tax_limits, tax_due_date_rules,
              cnae_anexo_map, cnpj_registry_cache FROM anon;
REVOKE ALL ON cnpj_registry_cache FROM authenticated;

-- =========================================================================
-- 8. SEED — SIMPLES NACIONAL (LC 123/2006 com redação da LC 155/2016)
-- =========================================================================
--
-- CONFERIR ANTES DE PRODUÇÃO. Todas as linhas nascem com
-- requires_validation = true justamente porque não foram conferidas contra a
-- publicação oficial por um profissional habilitado.

INSERT INTO tax_brackets
  (regime, anexo, bracket_order, rbt12_min, rbt12_max, nominal_rate, deduction, effective_from, legal_reference)
VALUES
  -- Anexo I — Comércio
  ('simples_nacional', 'I', 1,          0.00,   180000.00, 0.0400,      0.00, '2018-01-01', 'LC 123/2006, Anexo I'),
  ('simples_nacional', 'I', 2,     180000.01,   360000.00, 0.0730,   5940.00, '2018-01-01', 'LC 123/2006, Anexo I'),
  ('simples_nacional', 'I', 3,     360000.01,   720000.00, 0.0950,  13860.00, '2018-01-01', 'LC 123/2006, Anexo I'),
  ('simples_nacional', 'I', 4,     720000.01,  1800000.00, 0.1070,  22500.00, '2018-01-01', 'LC 123/2006, Anexo I'),
  ('simples_nacional', 'I', 5,    1800000.01,  3600000.00, 0.1430,  87300.00, '2018-01-01', 'LC 123/2006, Anexo I'),
  ('simples_nacional', 'I', 6,    3600000.01,  4800000.00, 0.1900, 378000.00, '2018-01-01', 'LC 123/2006, Anexo I'),

  -- Anexo II — Indústria
  ('simples_nacional', 'II', 1,         0.00,   180000.00, 0.0450,      0.00, '2018-01-01', 'LC 123/2006, Anexo II'),
  ('simples_nacional', 'II', 2,    180000.01,   360000.00, 0.0780,   5940.00, '2018-01-01', 'LC 123/2006, Anexo II'),
  ('simples_nacional', 'II', 3,    360000.01,   720000.00, 0.1000,  13860.00, '2018-01-01', 'LC 123/2006, Anexo II'),
  ('simples_nacional', 'II', 4,    720000.01,  1800000.00, 0.1120,  22500.00, '2018-01-01', 'LC 123/2006, Anexo II'),
  ('simples_nacional', 'II', 5,   1800000.01,  3600000.00, 0.1470,  85500.00, '2018-01-01', 'LC 123/2006, Anexo II'),
  ('simples_nacional', 'II', 6,   3600000.01,  4800000.00, 0.3000, 720000.00, '2018-01-01', 'LC 123/2006, Anexo II'),

  -- Anexo III — Serviços
  ('simples_nacional', 'III', 1,        0.00,   180000.00, 0.0600,      0.00, '2018-01-01', 'LC 123/2006, Anexo III'),
  ('simples_nacional', 'III', 2,   180000.01,   360000.00, 0.1120,   9360.00, '2018-01-01', 'LC 123/2006, Anexo III'),
  ('simples_nacional', 'III', 3,   360000.01,   720000.00, 0.1350,  17640.00, '2018-01-01', 'LC 123/2006, Anexo III'),
  ('simples_nacional', 'III', 4,   720000.01,  1800000.00, 0.1600,  35640.00, '2018-01-01', 'LC 123/2006, Anexo III'),
  ('simples_nacional', 'III', 5,  1800000.01,  3600000.00, 0.2100, 125640.00, '2018-01-01', 'LC 123/2006, Anexo III'),
  ('simples_nacional', 'III', 6,  3600000.01,  4800000.00, 0.3300, 648000.00, '2018-01-01', 'LC 123/2006, Anexo III'),

  -- Anexo IV — Serviços (sem CPP no DAS)
  ('simples_nacional', 'IV', 1,         0.00,   180000.00, 0.0450,      0.00, '2018-01-01', 'LC 123/2006, Anexo IV'),
  ('simples_nacional', 'IV', 2,    180000.01,   360000.00, 0.0900,   8100.00, '2018-01-01', 'LC 123/2006, Anexo IV'),
  ('simples_nacional', 'IV', 3,    360000.01,   720000.00, 0.1020,  12420.00, '2018-01-01', 'LC 123/2006, Anexo IV'),
  ('simples_nacional', 'IV', 4,    720000.01,  1800000.00, 0.1400,  39780.00, '2018-01-01', 'LC 123/2006, Anexo IV'),
  ('simples_nacional', 'IV', 5,   1800000.01,  3600000.00, 0.2200, 183780.00, '2018-01-01', 'LC 123/2006, Anexo IV'),
  ('simples_nacional', 'IV', 6,   3600000.01,  4800000.00, 0.3300, 828000.00, '2018-01-01', 'LC 123/2006, Anexo IV'),

  -- Anexo V — Serviços com Fator R abaixo de 28%
  ('simples_nacional', 'V', 1,          0.00,   180000.00, 0.1550,      0.00, '2018-01-01', 'LC 123/2006, Anexo V'),
  ('simples_nacional', 'V', 2,     180000.01,   360000.00, 0.1800,   4500.00, '2018-01-01', 'LC 123/2006, Anexo V'),
  ('simples_nacional', 'V', 3,     360000.01,   720000.00, 0.1950,   9900.00, '2018-01-01', 'LC 123/2006, Anexo V'),
  ('simples_nacional', 'V', 4,     720000.01,  1800000.00, 0.2050,  17100.00, '2018-01-01', 'LC 123/2006, Anexo V'),
  ('simples_nacional', 'V', 5,    1800000.01,  3600000.00, 0.2300,  62100.00, '2018-01-01', 'LC 123/2006, Anexo V'),
  ('simples_nacional', 'V', 6,    3600000.01,  4800000.00, 0.3050, 540000.00, '2018-01-01', 'LC 123/2006, Anexo V')
ON CONFLICT (regime, anexo, bracket_order, effective_from) DO NOTHING;

-- =========================================================================
-- 9. SEED — LIMITES E VENCIMENTOS
-- =========================================================================

INSERT INTO tax_limits (regime, limit_kind, amount, effective_from, legal_reference)
VALUES
  ('simples_nacional', 'teto_anual', 4800000.00, '2018-01-01', 'LC 123/2006, art. 3º, II'),
  ('simples_nacional', 'sublimite',  3600000.00, '2018-01-01', 'LC 123/2006, art. 19'),
  ('mei',              'teto_anual',   81000.00, '2018-01-01', 'LC 123/2006, art. 18-A')
ON CONFLICT (regime, limit_kind, effective_from) DO NOTHING;

INSERT INTO tax_due_date_rules
  (regime, obligation_kind, label, day_of_month, month_offset, effective_from, legal_reference)
VALUES
  ('simples_nacional', 'das', 'DAS — Simples Nacional', 20, 1, '2018-01-01', 'LC 123/2006, art. 21, III'),
  ('mei',              'das', 'DAS — MEI',              20, 1, '2018-01-01', 'LC 123/2006, art. 18-A')
ON CONFLICT (regime, obligation_kind, effective_from) DO NOTHING;

-- =========================================================================
-- 10. SEED — MAPA CNAE -> ANEXO (por prefixo, mais longo vence)
-- =========================================================================

INSERT INTO cnae_anexo_map (cnae_prefix, anexo, confidence, note, effective_from)
VALUES
  -- Indústria e transformação → Anexo II
  ('10', 'II', 'alta', 'Fabricação de produtos alimentícios', '2018-01-01'),
  ('11', 'II', 'alta', 'Fabricação de bebidas', '2018-01-01'),
  ('13', 'II', 'alta', 'Fabricação de produtos têxteis', '2018-01-01'),
  ('14', 'II', 'alta', 'Confecção de artigos do vestuário', '2018-01-01'),
  ('15', 'II', 'alta', 'Couro e calçados', '2018-01-01'),
  ('16', 'II', 'alta', 'Produtos de madeira', '2018-01-01'),
  ('17', 'II', 'alta', 'Celulose e papel', '2018-01-01'),
  ('18', 'II', 'alta', 'Impressão e reprodução', '2018-01-01'),
  ('20', 'II', 'alta', 'Produtos químicos', '2018-01-01'),
  ('22', 'II', 'alta', 'Borracha e plástico', '2018-01-01'),
  ('23', 'II', 'alta', 'Produtos de minerais não metálicos', '2018-01-01'),
  ('25', 'II', 'alta', 'Produtos de metal', '2018-01-01'),
  ('31', 'II', 'alta', 'Móveis', '2018-01-01'),
  ('32', 'II', 'alta', 'Produtos diversos', '2018-01-01'),

  -- Comércio → Anexo I
  ('45', 'I', 'alta', 'Comércio e reparação de veículos', '2018-01-01'),
  ('46', 'I', 'alta', 'Comércio por atacado', '2018-01-01'),
  ('47', 'I', 'alta', 'Comércio varejista', '2018-01-01'),

  -- Serviços → Anexo III
  ('55', 'III', 'alta', 'Alojamento', '2018-01-01'),
  ('56', 'III', 'alta', 'Alimentação', '2018-01-01'),
  ('59', 'III', 'media', 'Audiovisual', '2018-01-01'),
  ('62', 'III', 'media', 'Serviços de TI — sujeito a Fator R', '2018-01-01'),
  ('63', 'III', 'media', 'Serviços de informação — sujeito a Fator R', '2018-01-01'),
  ('73', 'III', 'media', 'Publicidade e pesquisa de mercado', '2018-01-01'),
  ('79', 'III', 'alta', 'Agências de viagem', '2018-01-01'),
  ('82', 'III', 'media', 'Serviços administrativos', '2018-01-01'),
  ('85', 'III', 'alta', 'Educação', '2018-01-01'),
  ('86', 'III', 'media', 'Saúde humana — sujeito a Fator R', '2018-01-01'),
  ('93', 'III', 'media', 'Esporte e recreação', '2018-01-01'),
  ('95', 'III', 'alta', 'Reparação de equipamentos', '2018-01-01'),
  ('96', 'III', 'alta', 'Serviços pessoais', '2018-01-01'),

  -- Serviços do Anexo IV (CPP fora do DAS)
  ('41', 'IV', 'alta', 'Construção de edifícios', '2018-01-01'),
  ('42', 'IV', 'alta', 'Obras de infraestrutura', '2018-01-01'),
  ('43', 'IV', 'alta', 'Serviços especializados para construção', '2018-01-01'),
  ('6911', 'IV', 'alta', 'Atividades jurídicas', '2018-01-01'),
  ('8011', 'IV', 'alta', 'Vigilância e segurança privada', '2018-01-01'),
  ('8121', 'IV', 'alta', 'Limpeza em prédios e domicílios', '2018-01-01'),
  ('8122', 'IV', 'alta', 'Imunização e controle de pragas', '2018-01-01'),

  -- Serviços tipicamente do Anexo V quando o Fator R não alcança 28%
  ('6920', 'V', 'requer_confirmacao', 'Contabilidade — verificar Fator R', '2018-01-01'),
  ('7111', 'V', 'requer_confirmacao', 'Engenharia e arquitetura — verificar Fator R', '2018-01-01'),
  ('7112', 'V', 'requer_confirmacao', 'Engenharia — verificar Fator R', '2018-01-01'),
  ('7020', 'V', 'requer_confirmacao', 'Consultoria em gestão — verificar Fator R', '2018-01-01'),
  ('6202', 'V', 'requer_confirmacao', 'Desenvolvimento de software sob encomenda — verificar Fator R', '2018-01-01')
ON CONFLICT (cnae_prefix, effective_from) DO NOTHING;

COMMENT ON TABLE tax_brackets IS
  'Faixas do Simples Nacional versionadas por vigência. requires_validation = true bloqueia a exibição do número como validado.';
COMMENT ON TABLE cnae_anexo_map IS
  'Mapa CNAE -> anexo por prefixo, com vitória do prefixo mais longo. confidence controla se a interface pré-seleciona ou exige confirmação.';
COMMENT ON COLUMN tax_brackets.requires_validation IS
  'true enquanto a linha não tiver sido conferida contra a publicação oficial por profissional habilitado. Vira false apenas por migração.';

COMMIT;
