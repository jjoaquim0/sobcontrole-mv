import { describe, expect, it } from 'vitest';
import {
  calculateEffectiveRate,
  calculateFatorR,
  calculateRbt12,
  calculateTaxAssessment,
  FATOR_R_THRESHOLD,
  findBracket,
  type MonthlyRevenueEntry,
  type TaxCalculationInput,
  type TaxCalculationSuccess,
  type TaxCatalog,
} from './taxCalculation';
import { buildClassificationSources, type ClassificationSourceRow } from './taxClassification';

/** Espelha o seed da migration 20260802120000 para os anexos usados nos testes. */
const CATALOG: TaxCatalog = {
  brackets: [
    // Anexo I — Comércio
    ...[
      [1, 0, 180000, 0.04, 0],
      [2, 180000.01, 360000, 0.073, 5940],
      [3, 360000.01, 720000, 0.095, 13860],
      [4, 720000.01, 1800000, 0.107, 22500],
      [5, 1800000.01, 3600000, 0.143, 87300],
      [6, 3600000.01, 4800000, 0.19, 378000],
    ].map(([order, min, max, rate, deduction]) => ({
      anexo: 'I' as const,
      bracketOrder: order,
      rbt12Min: min,
      rbt12Max: max,
      nominalRate: rate,
      deduction,
      effectiveFrom: '2018-01-01',
      effectiveTo: null,
      requiresValidation: true,
    })),
    // Anexo III — Serviços
    ...[
      [1, 0, 180000, 0.06, 0],
      [2, 180000.01, 360000, 0.112, 9360],
      [3, 360000.01, 720000, 0.135, 17640],
      [4, 720000.01, 1800000, 0.16, 35640],
    ].map(([order, min, max, rate, deduction]) => ({
      anexo: 'III' as const,
      bracketOrder: order,
      rbt12Min: min,
      rbt12Max: max,
      nominalRate: rate,
      deduction,
      effectiveFrom: '2018-01-01',
      effectiveTo: null,
      requiresValidation: true,
    })),
    // Anexo V
    ...[
      [1, 0, 180000, 0.155, 0],
      [2, 180000.01, 360000, 0.18, 4500],
      [3, 360000.01, 720000, 0.195, 9900],
    ].map(([order, min, max, rate, deduction]) => ({
      anexo: 'V' as const,
      bracketOrder: order,
      rbt12Min: min,
      rbt12Max: max,
      nominalRate: rate,
      deduction,
      effectiveFrom: '2018-01-01',
      effectiveTo: null,
      requiresValidation: true,
    })),
    // Anexo IV
    {
      anexo: 'IV' as const,
      bracketOrder: 3,
      rbt12Min: 360000.01,
      rbt12Max: 720000,
      nominalRate: 0.102,
      deduction: 12420,
      effectiveFrom: '2018-01-01',
      effectiveTo: null,
      requiresValidation: true,
    },
  ],
};

const historyOf = (months: string[], amount: number): MonthlyRevenueEntry[] =>
  months.map((month) => ({ month, amount }));

/** Doze meses encerrados antes de 2026-08, cada um com `amount`. */
const twelveMonthsBefore = (amount: number): MonthlyRevenueEntry[] =>
  historyOf(
    [
      '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07',
    ],
    amount,
  );

const buildInput = (overrides: Partial<TaxCalculationInput> = {}): TaxCalculationInput => ({
  profile: {
    regime: 'simples_nacional',
    anexo: 'I',
    meiActivityType: null,
    fatorREnabled: false,
    rbt12Initial: 0,
    rbt12InitialReferenceMonth: null,
    isConfirmed: true,
  },
  referenceMonth: '2026-08',
  items: [{ productId: 'p1', categoryId: null, amount: 55000 }],
  classification: buildClassificationSources([], 'I'),
  revenueHistory: twelveMonthsBefore(50000),
  payrollHistory: [],
  catalog: CATALOG,
  ...overrides,
});

const expectCalculated = (result: ReturnType<typeof calculateTaxAssessment>): TaxCalculationSuccess => {
  if (result.status !== 'calculated') {
    throw new Error(`esperava cálculo, veio not_calculable: ${result.reason}`);
  }
  return result;
};

const classify = (rows: ClassificationSourceRow[], companyAnexo: 'I' | 'III' | null = 'I') =>
  buildClassificationSources(rows, companyAnexo);

// =========================================================================

describe('calculateRbt12', () => {
  it('soma os 12 meses ANTERIORES, sem incluir a competência apurada', () => {
    const result = calculateRbt12(
      '2026-08',
      [...twelveMonthsBefore(50000), { month: '2026-08', amount: 999999 }],
      0,
    );

    expect(result.rbt12).toBe(600000);
    expect(result.monthsFromSystem).toBe(12);
  });

  it('completa proporcionalmente com a carga inicial quando falta histórico', () => {
    // 6 meses no sistema (6 × 50.000 = 300.000) + metade da carga inicial.
    const result = calculateRbt12(
      '2026-08',
      historyOf(['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'], 50000),
      600000,
    );

    expect(result.fromSystem).toBe(300000);
    expect(result.fromInitialLoad).toBe(300000);
    expect(result.rbt12).toBe(600000);
    expect(result.monthsFromSystem).toBe(6);
  });

  it('não usa a carga inicial quando já há 12 meses de histórico', () => {
    const result = calculateRbt12('2026-08', twelveMonthsBefore(50000), 999999);
    expect(result.fromInitialLoad).toBe(0);
  });

  it('atravessa a virada de ano corretamente', () => {
    const result = calculateRbt12(
      '2026-01',
      historyOf(['2025-12', '2025-11', '2025-10'], 10000),
      0,
    );
    expect(result.fromSystem).toBe(30000);
    expect(result.monthsFromSystem).toBe(3);
  });

  it('ignora mês malformado no histórico', () => {
    const result = calculateRbt12(
      '2026-08',
      [{ month: '2026-13', amount: 100000 }, { month: '2026-07', amount: 50000 }],
      0,
    );
    expect(result.rbt12).toBe(50000);
  });
});

describe('calculateEffectiveRate', () => {
  it('aplica a fórmula (RBT12 × nominal − PD) ÷ RBT12', () => {
    // 3ª faixa do Anexo I com RBT12 de 600.000:
    // (600000 × 0,095 − 13860) / 600000 = 43140 / 600000 = 7,19%
    expect(calculateEffectiveRate(600000, 0.095, 13860)).toBeCloseTo(0.0719, 6);
  });

  it('usa a alíquota nominal quando o RBT12 é zero', () => {
    expect(calculateEffectiveRate(0, 0.04, 0)).toBe(0.04);
  });

  it('nunca devolve alíquota negativa com catálogo inconsistente', () => {
    expect(calculateEffectiveRate(100000, 0.04, 999999)).toBe(0);
  });
});

describe('findBracket', () => {
  it('encontra a faixa pelo intervalo de RBT12', () => {
    expect(findBracket(CATALOG.brackets, 'I', 600000, '2026-08-01')?.bracketOrder).toBe(3);
    expect(findBracket(CATALOG.brackets, 'I', 180000, '2026-08-01')?.bracketOrder).toBe(1);
    expect(findBracket(CATALOG.brackets, 'I', 180000.01, '2026-08-01')?.bracketOrder).toBe(2);
  });

  it('devolve null acima do teto em vez de mascarar o estouro', () => {
    // Devolver a última faixa esconderia exatamente o alerta mais valioso.
    expect(findBracket(CATALOG.brackets, 'I', 5000000, '2026-08-01')).toBeNull();
  });

  it('respeita a vigência da faixa', () => {
    expect(findBracket(CATALOG.brackets, 'I', 600000, '2017-06-01')).toBeNull();
  });
});

describe('calculateTaxAssessment — Simples Nacional, caso direto', () => {
  it('calcula o DAS estimado do comércio no Anexo I', () => {
    const result = expectCalculated(calculateTaxAssessment(buildInput()));

    expect(result.rbt12).toBe(600000);
    expect(result.perAnexo).toHaveLength(1);
    expect(result.perAnexo[0].effectiveRate).toBeCloseTo(0.0719, 6);
    // 55.000 × 7,19% = 3.954,50
    expect(result.estimatedTax).toBeCloseTo(3954.5, 2);
  });

  it('sinaliza que o catálogo ainda não foi validado por contador', () => {
    const result = expectCalculated(calculateTaxAssessment(buildInput()));
    expect(result.requiresCatalogValidation).toBe(true);
  });

  it('avisa quando falta histórico e não há carga inicial de RBT12', () => {
    const result = expectCalculated(
      calculateTaxAssessment(
        buildInput({ revenueHistory: historyOf(['2026-07'], 50000) }),
      ),
    );

    expect(result.rbt12MonthsFromSystem).toBe(1);
    expect(result.warnings.join(' ')).toContain('subestimada');
  });
});

describe('calculateTaxAssessment — segregação por anexo', () => {
  it('separa comércio e serviço usando o MESMO RBT12 para as duas tabelas', () => {
    // O caso que justifica a Story 1.29 inteira. RBT12 é único e total (600.000):
    //   Anexo I  → (600000×0,095−13860)/600000 = 7,19%  sobre 30.000 = 2.157,00
    //   Anexo III→ (600000×0,135−17640)/600000 = 10,56% sobre 20.000 = 2.112,00
    const result = expectCalculated(
      calculateTaxAssessment(
        buildInput({
          items: [
            { productId: 'mercadoria', categoryId: 'cat-com', amount: 30000 },
            { productId: 'servico', categoryId: 'cat-srv', amount: 20000 },
          ],
          classification: classify([
            { productId: null, categoryId: 'cat-com', anexo: 'I', tributacao: null },
            { productId: null, categoryId: 'cat-srv', anexo: 'III', tributacao: null },
          ]),
        }),
      ),
    );

    expect(result.perAnexo).toHaveLength(2);
    expect(result.rbt12).toBe(600000);

    const comercio = result.perAnexo.find((entry) => entry.anexo === 'I');
    const servico = result.perAnexo.find((entry) => entry.anexo === 'III');

    expect(comercio?.effectiveRate).toBeCloseTo(0.0719, 6);
    expect(servico?.effectiveRate).toBeCloseTo(0.1056, 6);
    expect(comercio?.tax).toBeCloseTo(2157, 2);
    expect(servico?.tax).toBeCloseTo(2112, 2);
    expect(result.estimatedTax).toBeCloseTo(4269, 2);
  });

  it('remove monofásico e ST da base tributável do anexo', () => {
    const result = expectCalculated(
      calculateTaxAssessment(
        buildInput({
          items: [
            { productId: 'normal', categoryId: null, amount: 30000 },
            { productId: 'mono', categoryId: null, amount: 15000 },
            { productId: 'subst', categoryId: null, amount: 10000 },
          ],
          classification: classify([
            { productId: 'mono', categoryId: null, anexo: 'I', tributacao: 'monofasico' },
            { productId: 'subst', categoryId: null, anexo: 'I', tributacao: 'st' },
          ]),
        }),
      ),
    );

    const anexoI = result.perAnexo[0];
    expect(anexoI.grossRevenue).toBe(55000);
    expect(anexoI.exemptRevenue).toBe(25000);
    expect(anexoI.taxableBase).toBe(30000);
    expect(anexoI.exemptBreakdown.monofasico).toBe(15000);
    expect(anexoI.exemptBreakdown.st).toBe(10000);
    // Sem a remoção, o imposto seria 55.000 × 7,19% = 3.954,50 — quase o dobro.
    expect(result.estimatedTax).toBeCloseTo(2157, 2);
  });

  it('cobre comércio, serviço e monofásico no mesmo mês', () => {
    const result = expectCalculated(
      calculateTaxAssessment(
        buildInput({
          items: [
            { productId: 'merc', categoryId: 'cat-com', amount: 30000 },
            { productId: 'remedio', categoryId: 'cat-com', amount: 12000 },
            { productId: 'servico', categoryId: 'cat-srv', amount: 20000 },
          ],
          classification: classify([
            { productId: null, categoryId: 'cat-com', anexo: 'I', tributacao: null },
            { productId: null, categoryId: 'cat-srv', anexo: 'III', tributacao: null },
            { productId: 'remedio', categoryId: null, anexo: null, tributacao: 'monofasico' },
          ]),
        }),
      ),
    );

    const comercio = result.perAnexo.find((entry) => entry.anexo === 'I');
    // O remédio herda o Anexo I da categoria e sobrescreve só a tributação.
    expect(comercio?.grossRevenue).toBe(42000);
    expect(comercio?.taxableBase).toBe(30000);
    expect(result.estimatedTax).toBeCloseTo(2157 + 2112, 2);
  });

  it('isento e exportação também saem da base', () => {
    const result = expectCalculated(
      calculateTaxAssessment(
        buildInput({
          items: [
            { productId: 'export', categoryId: null, amount: 20000 },
            { productId: 'isento', categoryId: null, amount: 10000 },
          ],
          classification: classify([
            { productId: 'export', categoryId: null, anexo: 'I', tributacao: 'exportacao' },
            { productId: 'isento', categoryId: null, anexo: 'I', tributacao: 'isento' },
          ]),
        }),
      ),
    );

    expect(result.perAnexo[0].taxableBase).toBe(0);
    expect(result.estimatedTax).toBe(0);
  });
});

describe('calculateTaxAssessment — Fator R', () => {
  const fatorRInput = (payrollPerMonth: number) =>
    buildInput({
      profile: {
        regime: 'simples_nacional',
        anexo: 'V',
        meiActivityType: null,
        fatorREnabled: true,
        rbt12Initial: 0,
        rbt12InitialReferenceMonth: null,
        isConfirmed: true,
      },
      items: [{ productId: 'servico', categoryId: null, amount: 50000 }],
      classification: classify([], 'III'),
      payrollHistory: twelveMonthsBefore(payrollPerMonth),
    });

  it('tributa pelo Anexo III quando o Fator R alcança 28%', () => {
    // RBT12 = 600.000; folha 12 meses = 12 × 15.000 = 180.000 → 30%.
    const result = expectCalculated(calculateTaxAssessment(fatorRInput(15000)));

    expect(result.fatorRAvailable).toBe(true);
    expect(result.fatorR).toBeCloseTo(0.3, 6);
    expect(result.perAnexo[0].appliedAnexo).toBe('III');
  });

  it('tributa pelo Anexo V abaixo do limiar de 28%', () => {
    // folha 12 meses = 12 × 10.000 = 120.000 → 20%.
    const result = expectCalculated(calculateTaxAssessment(fatorRInput(10000)));

    expect(result.fatorR).toBeCloseTo(0.2, 6);
    expect(result.perAnexo[0].appliedAnexo).toBe('V');
  });

  it('trata exatamente 28% como Anexo III', () => {
    // folha 12 meses = 0,28 × 600.000 = 168.000 → 14.000/mês.
    const result = expectCalculated(calculateTaxAssessment(fatorRInput(14000)));

    expect(result.fatorR).toBeCloseTo(FATOR_R_THRESHOLD, 6);
    expect(result.perAnexo[0].appliedAnexo).toBe('III');
  });

  it('NÃO estima folha quando não há lançamento: mantém o anexo de origem', () => {
    const input = fatorRInput(0);
    const result = expectCalculated(
      calculateTaxAssessment({ ...input, payrollHistory: [] }),
    );

    expect(result.fatorRAvailable).toBe(false);
    expect(result.perAnexo[0].appliedAnexo).toBe('III');
    expect(result.warnings.join(' ')).toContain('folha informada');
  });

  it('não aplica Fator R ao Anexo IV', () => {
    // No Anexo IV a CPP é recolhida à parte; a regra não o alcança.
    const result = expectCalculated(
      calculateTaxAssessment({
        ...fatorRInput(15000),
        items: [{ productId: 'obra', categoryId: null, amount: 50000 }],
        classification: classify(
          [{ productId: 'obra', categoryId: null, anexo: 'IV', tributacao: null }],
          'IV' as 'III',
        ),
      }),
    );

    expect(result.perAnexo[0].anexo).toBe('IV');
    expect(result.perAnexo[0].appliedAnexo).toBe('IV');
    expect(result.perAnexo[0].fatorRApplied).toBe(false);
  });

  it('não aplica Fator R quando a empresa não está sujeita à regra', () => {
    const result = expectCalculated(
      calculateTaxAssessment(
        buildInput({ payrollHistory: twelveMonthsBefore(30000) }),
      ),
    );

    expect(result.fatorRAvailable).toBe(false);
    expect(result.perAnexo[0].appliedAnexo).toBe('I');
  });
});

describe('calculateTaxAssessment — não calculável', () => {
  it('recusa apuração com perfil não confirmado', () => {
    const input = buildInput();
    const result = calculateTaxAssessment({
      ...input,
      profile: { ...input.profile, isConfirmed: false },
    });

    expect(result.status).toBe('not_calculable');
    if (result.status === 'not_calculable') {
      expect(result.reason).toBe('perfil_nao_confirmado');
      // A receita continua disponível mesmo sem imposto calculável.
      expect(result.grossRevenueMonth).toBe(55000);
    }
  });

  it('recusa estimativa para Lucro Presumido com mensagem acionável', () => {
    const input = buildInput();
    const result = calculateTaxAssessment({
      ...input,
      profile: { ...input.profile, regime: 'lucro_presumido' },
    });

    expect(result.status).toBe('not_calculable');
    if (result.status === 'not_calculable') {
      expect(result.reason).toBe('regime_sem_estimativa');
      expect(result.message).toContain('contador');
    }
  });

  it('recusa regime indeterminado', () => {
    const input = buildInput();
    const result = calculateTaxAssessment({
      ...input,
      profile: { ...input.profile, regime: 'indeterminado' },
    });

    expect(result.status).toBe('not_calculable');
  });

  it('recusa quando um item não tem anexo em nenhum nível da cascata', () => {
    const result = calculateTaxAssessment(
      buildInput({ classification: buildClassificationSources([], null) }),
    );

    expect(result.status).toBe('not_calculable');
    if (result.status === 'not_calculable') {
      expect(result.reason).toBe('anexo_indefinido');
    }
  });

  it('recusa quando não há faixa vigente para o RBT12 apurado', () => {
    const result = calculateTaxAssessment(
      buildInput({ revenueHistory: twelveMonthsBefore(500000) }),
    );

    expect(result.status).toBe('not_calculable');
    if (result.status === 'not_calculable') {
      expect(result.reason).toBe('faixa_inexistente');
      expect(result.message).toContain('teto');
    }
  });

  it('recusa competência malformada', () => {
    const result = calculateTaxAssessment(buildInput({ referenceMonth: '2026-13' }));

    expect(result.status).toBe('not_calculable');
    if (result.status === 'not_calculable') {
      expect(result.reason).toBe('competencia_invalida');
    }
  });

  it('nunca devolve NaN no imposto estimado', () => {
    const result = expectCalculated(
      calculateTaxAssessment(
        buildInput({
          items: [
            { productId: 'p1', categoryId: null, amount: Number.NaN },
            { productId: 'p2', categoryId: null, amount: 1000 },
          ],
        }),
      ),
    );

    expect(Number.isNaN(result.estimatedTax)).toBe(false);
    expect(result.grossRevenueMonth).toBe(1000);
  });
});

describe('calculateTaxAssessment — Reforma Tributária (regime híbrido)', () => {
  // LC 214/2025 + Resolução CGSN nº 186/2026: a partir de 2027 o optante do
  // Simples pode apurar IBS e CBS pelo regime regular, fora do DAS. A parcela
  // correspondente sai da alíquota efetiva — aplicar a cheia superestima.
  const hybridProfile = {
    regime: 'simples_nacional' as const,
    anexo: 'I' as const,
    meiActivityType: null,
    fatorREnabled: false,
    rbt12Initial: 0,
    rbt12InitialReferenceMonth: null,
    isConfirmed: true,
    ibsCbsRegime: 'regular' as const,
  };

  const componentsFor = (share: number) => [
    {
      anexo: 'I' as const,
      bracketOrder: 3,
      tributo: 'cbs' as const,
      share: share * 0.75,
      effectiveFrom: '2027-01-01',
      effectiveTo: null,
      requiresValidation: true,
    },
    {
      anexo: 'I' as const,
      bracketOrder: 3,
      tributo: 'ibs' as const,
      share: share * 0.25,
      effectiveFrom: '2027-01-01',
      effectiveTo: null,
      requiresValidation: true,
    },
  ];

  it('remove a parcela de IBS/CBS da alíquota aplicada ao DAS', () => {
    const result = expectCalculated(
      calculateTaxAssessment(
        buildInput({
          referenceMonth: '2027-03',
          profile: hybridProfile,
          revenueHistory: historyOf(
            [
              '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08',
              '2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02',
            ],
            50000,
          ),
          catalog: { ...CATALOG, bracketComponents: componentsFor(0.4) },
        }),
      ),
    );

    const anexoI = result.perAnexo[0];
    expect(result.hybridRegimeApplied).toBe(true);
    expect(anexoI.effectiveRate).toBeCloseTo(0.0719, 6);
    expect(anexoI.ibsCbsShareRemoved).toBeCloseTo(0.4, 6);
    // 7,19% × (1 − 0,40) = 4,314% sobre 55.000 = 2.372,70
    expect(anexoI.appliedRate).toBeCloseTo(0.04314, 6);
    expect(result.estimatedTax).toBeCloseTo(2372.7, 2);
  });

  it('RECUSA calcular quando a repartição não está cadastrada, em vez de chutar', () => {
    // Estimar a fatia de IBS/CBS produziria um DAS plausível e errado.
    const result = calculateTaxAssessment(
      buildInput({
        referenceMonth: '2027-03',
        profile: hybridProfile,
        revenueHistory: historyOf(
          [
            '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08',
            '2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02',
          ],
          50000,
        ),
      }),
    );

    expect(result.status).toBe('not_calculable');
    if (result.status === 'not_calculable') {
      expect(result.reason).toBe('reparticao_indisponivel');
      expect(result.message).toContain('regime regular');
    }
  });

  it('ignora repartição fora de vigência e recusa o cálculo', () => {
    const result = calculateTaxAssessment(
      buildInput({
        referenceMonth: '2026-08',
        profile: hybridProfile,
        catalog: { ...CATALOG, bracketComponents: componentsFor(0.4) },
      }),
    );

    // A repartição só vige a partir de 2027; em 2026 não se aplica.
    expect(result.status).toBe('not_calculable');
    if (result.status === 'not_calculable') {
      expect(result.reason).toBe('reparticao_indisponivel');
    }
  });

  it('não altera o cálculo do regime padrão em 2026', () => {
    // Confirmação de que a Reforma não afeta a competência corrente do Simples:
    // optantes só passam a destacar IBS/CBS a partir de 2027.
    const result = expectCalculated(calculateTaxAssessment(buildInput()));

    expect(result.hybridRegimeApplied).toBe(false);
    expect(result.perAnexo[0].ibsCbsShareRemoved).toBe(0);
    expect(result.perAnexo[0].appliedRate).toBeCloseTo(result.perAnexo[0].effectiveRate, 10);
    expect(result.estimatedTax).toBeCloseTo(3954.5, 2);
  });

  it('não estima nada para o MEI, mesmo com regime híbrido marcado', () => {
    const result = calculateTaxAssessment(
      buildInput({
        profile: {
          regime: 'mei',
          anexo: null,
          meiActivityType: 'comercio',
          fatorREnabled: false,
          rbt12Initial: 0,
          rbt12InitialReferenceMonth: null,
          isConfirmed: true,
          ibsCbsRegime: 'regular',
        },
        items: [{ productId: 'p1', categoryId: null, amount: 6000 }],
        revenueHistory: [],
      }),
    );

    expect(result.status).toBe('not_calculable');
    if (result.status === 'not_calculable') {
      expect(result.reason).toBe('regime_sem_estimativa');
    }
  });
});

describe('calculateTaxAssessment — MEI sem estimativa', () => {
  // O DAS de valor fixo do MEI saiu do escopo por não ter sido aprovado pelo
  // contador. O regime segue cadastrável, mas o sistema não estima o valor.
  const meiInput = buildInput({
    profile: {
      regime: 'mei',
      anexo: null,
      meiActivityType: 'comercio',
      fatorREnabled: false,
      rbt12Initial: 0,
      rbt12InitialReferenceMonth: null,
      isConfirmed: true,
    },
    items: [{ productId: 'p1', categoryId: null, amount: 6000 }],
    revenueHistory: historyOf(['2026-01', '2026-02', '2026-03'], 6000),
  });

  it('recusa a estimativa com motivo e mensagem acionável', () => {
    const result = calculateTaxAssessment(meiInput);

    expect(result.status).toBe('not_calculable');
    if (result.status === 'not_calculable') {
      expect(result.reason).toBe('regime_sem_estimativa');
      expect(result.message).toContain('contador');
    }
  });

  it('preserva a receita apurada mesmo sem imposto calculável', () => {
    const result = calculateTaxAssessment(meiInput);

    if (result.status === 'not_calculable') {
      expect(result.grossRevenueMonth).toBe(6000);
    }
  });
});

describe('calculateFatorR', () => {
  it('devolve indisponível sem folha lançada', () => {
    expect(calculateFatorR('2026-08', [], 600000).available).toBe(false);
  });

  it('devolve indisponível com RBT12 zerado', () => {
    expect(calculateFatorR('2026-08', twelveMonthsBefore(10000), 0).available).toBe(false);
  });

  it('usa apenas os 12 meses anteriores à competência', () => {
    const result = calculateFatorR(
      '2026-08',
      [...twelveMonthsBefore(15000), { month: '2026-08', amount: 999999 }],
      600000,
    );
    expect(result.value).toBeCloseTo(0.3, 6);
  });
});
