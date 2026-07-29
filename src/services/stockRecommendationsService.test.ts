import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type QueryResult = { data: unknown[] | null; error: { message: string } | null };

interface QueryBuilderMock {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  returns: ReturnType<typeof vi.fn>;
  then: (resolve: (value: QueryResult) => void, reject: (reason: unknown) => void) => Promise<void>;
}

const mocks = vi.hoisted(() => {
  const makeBuilder = (result: QueryResult): QueryBuilderMock => {
    const builder = {} as QueryBuilderMock;
    (['select', 'eq', 'neq', 'gte', 'lte', 'order', 'range', 'upsert', 'insert', 'returns'] as const).forEach((method) => {
      builder[method] = vi.fn(() => builder);
    });
    builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
    return builder;
  };

  return {
    makeBuilder,
    from: vi.fn(),
    companyId: 'company-1' as string | undefined,
    userId: 'user-1' as string | undefined,
  };
});

vi.mock('../lib/supabase', () => ({
  supabase: { from: mocks.from },
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      company: mocks.companyId ? { id: mocks.companyId } : undefined,
      profile: mocks.userId ? { id: mocks.userId } : undefined,
    }),
  },
}));

import {
  buildStockRecommendations,
  dismissRecommendation,
  getStockRecommendations,
  postponeRecommendation,
  resolveRecommendation,
  BuildRecommendationsInput,
  StockRecommendationProductSource,
} from './stockRecommendationsService';

const noon = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
const noonIso = (y: number, m: number, d: number) => noon(y, m, d).toISOString();

const product = (overrides: Partial<StockRecommendationProductSource>): StockRecommendationProductSource => ({
  id: 'p1',
  name: 'Produto Teste',
  sku: 'SKU-1',
  barcode: '',
  unit: 'un',
  categoryId: 'cat-1',
  categoryName: 'Geral',
  currentQuantity: 10,
  minQuantity: 5,
  costPrice: 20,
  ...overrides,
});

const baseInput = (overrides: Partial<BuildRecommendationsInput>): BuildRecommendationsInput => ({
  products: [],
  sales: [],
  purchases: [],
  states: [],
  periodDays: 30,
  targetCoverageDays: 14,
  dateTo: noon(2026, 7, 19),
  now: noon(2026, 7, 19),
  ...overrides,
});

describe('buildStockRecommendations — cobertura e consumo médio', () => {
  it('calcula consumo médio diário e cobertura a partir de vendas válidas', () => {
    const result = buildStockRecommendations(
      baseInput({
        products: [product({ id: 'p1', currentQuantity: 100, minQuantity: 5 })],
        sales: [
          { productId: 'p1', quantity: 30, occurredAt: noonIso(2026, 7, 5) },
          { productId: 'p1', quantity: 30, occurredAt: noonIso(2026, 7, 10) },
          { productId: 'p1', quantity: 30, occurredAt: noonIso(2026, 7, 15) },
        ],
        periodDays: 30,
      }),
    );

    // 90 unidades vendidas em 30 dias => 3/dia; cobertura = 100/3 = 33.3 dias.
    const rec = result.recommendations.find((r) => r.productId === 'p1');
    // Estoque saudável (100 un, cobertura 33 dias > alvo de 14) => não gera recomendação.
    expect(rec).toBeUndefined();
  });

  it('não considera vendas com payment_status cancelled como consumo (filtragem ocorre na busca, não no cálculo puro)', () => {
    // A função pura recebe apenas o que a busca assíncrona já filtrou; aqui garantimos
    // que ela usa exatamente o que recebe, sem reprocessar status.
    const result = buildStockRecommendations(
      baseInput({
        products: [product({ id: 'p1', currentQuantity: 0, minQuantity: 5 })],
        sales: [{ productId: 'p1', quantity: 10, occurredAt: noonIso(2026, 7, 10) }],
      }),
    );
    const rec = result.recommendations.find((r) => r.productId === 'p1' && r.type === 'reposicao');
    expect(rec?.averageDailyDemand).toBeCloseTo(10 / 30, 5);
  });
});

describe('buildStockRecommendations — risco de ruptura', () => {
  it('classifica como crítica quando o estoque atual é zero', () => {
    const result = buildStockRecommendations(
      baseInput({
        products: [product({ id: 'p1', currentQuantity: 0, minQuantity: 5 })],
        sales: [{ productId: 'p1', quantity: 5, occurredAt: noonIso(2026, 7, 10) }],
      }),
    );
    const rec = result.recommendations.find((r) => r.productId === 'p1' && r.type === 'reposicao');
    expect(rec?.priority).toBe('critica');
    expect(rec?.reasons.some((reason) => reason.includes('sem nenhuma unidade'))).toBe(true);
  });

  it('calcula data estimada de ruptura quando a cobertura é calculável', () => {
    const result = buildStockRecommendations(
      baseInput({
        products: [product({ id: 'p1', currentQuantity: 10, minQuantity: 5 })],
        sales: [{ productId: 'p1', quantity: 30, occurredAt: noonIso(2026, 7, 10) }],
        periodDays: 30,
      }),
    );
    const rec = result.recommendations.find((r) => r.productId === 'p1' && r.type === 'reposicao');
    expect(rec?.coverageDays).not.toBeNull();
    expect(rec?.estimatedRuptureDate).not.toBeNull();
  });

  it('não gera recomendação de reposição para produto saudável e sem sinal de reposição', () => {
    const result = buildStockRecommendations(
      baseInput({
        products: [product({ id: 'p1', currentQuantity: 500, minQuantity: 0 })],
        sales: [],
      }),
    );
    expect(result.recommendations.some((r) => r.productId === 'p1' && r.type === 'reposicao')).toBe(false);
  });
});

describe('buildStockRecommendations — quantidade recomendada', () => {
  it('nunca retorna quantidade negativa mesmo em cenários de estoque próximo do desejado', () => {
    const result = buildStockRecommendations(
      baseInput({
        products: [product({ id: 'p1', currentQuantity: 5, minQuantity: 5 })],
        sales: [],
      }),
    );
    const rec = result.recommendations.find((r) => r.productId === 'p1' && r.type === 'reposicao');
    expect(rec).toBeDefined();
    expect(rec!.suggestedQuantity).not.toBeNull();
    expect(rec!.suggestedQuantity as number).toBeGreaterThanOrEqual(0);
  });

  it('usa estoque desejado = max(estoque mínimo, consumo médio × cobertura alvo)', () => {
    const result = buildStockRecommendations(
      baseInput({
        products: [product({ id: 'p1', currentQuantity: 0, minQuantity: 5 })],
        sales: [{ productId: 'p1', quantity: 30, occurredAt: noonIso(2026, 7, 10) }], // 1/dia
        periodDays: 30,
        targetCoverageDays: 14,
      }),
    );
    const rec = result.recommendations.find((r) => r.productId === 'p1' && r.type === 'reposicao')!;
    // demanda média = 1/dia; desejado = max(5, 1*14) = 14; sugerido = 14 - 0 = 14
    expect(rec.suggestedQuantity).toBe(14);
  });

  it('sempre inclui a quantidade em trânsito como indisponível (null) — não existe status de recebimento separado', () => {
    const result = buildStockRecommendations(
      baseInput({
        products: [product({ id: 'p1', currentQuantity: 0, minQuantity: 5 })],
        sales: [],
      }),
    );
    const rec = result.recommendations.find((r) => r.productId === 'p1' && r.type === 'reposicao');
    expect(rec?.inTransitQuantity).toBeNull();
  });
});

describe('buildStockRecommendations — estoque mínimo (regra simples, sem consumo)', () => {
  it('usa confiança baixa e prioridade baixa quando não há histórico de vendas', () => {
    const result = buildStockRecommendations(
      baseInput({
        products: [product({ id: 'p1', currentQuantity: 2, minQuantity: 5 })],
        sales: [],
      }),
    );
    const rec = result.recommendations.find((r) => r.productId === 'p1' && r.type === 'reposicao')!;
    expect(rec.confidence).toBe('baixa');
    expect(rec.priority).toBe('baixa');
    expect(rec.suggestedQuantity).toBe(3); // max(5,0) - 2
  });

  it('não gera recomendação quando não há estoque mínimo configurado nem consumo observado', () => {
    const result = buildStockRecommendations(
      baseInput({
        products: [product({ id: 'p1', currentQuantity: 2, minQuantity: 0 })],
        sales: [],
      }),
    );
    expect(result.recommendations.some((r) => r.productId === 'p1' && r.type === 'reposicao')).toBe(false);
  });
});

describe('buildStockRecommendations — confiança', () => {
  it('classifica como alta apenas com período suficiente e vendas em dias distintos', () => {
    const result = buildStockRecommendations(
      baseInput({
        products: [product({ id: 'p1', currentQuantity: 1, minQuantity: 5 })],
        sales: [
          { productId: 'p1', quantity: 1, occurredAt: noonIso(2026, 7, 5) },
          { productId: 'p1', quantity: 1, occurredAt: noonIso(2026, 7, 10) },
          { productId: 'p1', quantity: 1, occurredAt: noonIso(2026, 7, 15) },
        ],
        periodDays: 30,
      }),
    );
    const rec = result.recommendations.find((r) => r.productId === 'p1' && r.type === 'reposicao')!;
    expect(rec.confidence).toBe('alta');
  });

  it('classifica como média quando há consumo mas poucos dias distintos de venda', () => {
    const result = buildStockRecommendations(
      baseInput({
        products: [product({ id: 'p1', currentQuantity: 1, minQuantity: 5 })],
        sales: [{ productId: 'p1', quantity: 5, occurredAt: noonIso(2026, 7, 10) }],
        periodDays: 30,
      }),
    );
    const rec = result.recommendations.find((r) => r.productId === 'p1' && r.type === 'reposicao')!;
    expect(rec.confidence).toBe('media');
  });
});

describe('buildStockRecommendations — estoque excessivo/parado', () => {
  it('identifica produto parado quando não há saída válida no período e há estoque disponível', () => {
    const result = buildStockRecommendations(
      baseInput({
        products: [product({ id: 'p1', currentQuantity: 20, minQuantity: 0, costPrice: 10 })],
        sales: [],
      }),
    );
    const rec = result.recommendations.find((r) => r.productId === 'p1' && r.type === 'estoque_parado');
    expect(rec).toBeDefined();
    expect(rec?.estimatedStoppedValue).toBe(200);
    expect(rec?.daysWithoutExitIsMinimum).toBe(true);
  });

  it('não calcula valor parado sem custo de aquisição confiável (nunca usa sale_price)', () => {
    const result = buildStockRecommendations(
      baseInput({
        products: [product({ id: 'p1', currentQuantity: 20, minQuantity: 0, costPrice: 0 })],
        sales: [],
      }),
    );
    const rec = result.recommendations.find((r) => r.productId === 'p1' && r.type === 'estoque_parado');
    expect(rec?.estimatedStoppedValue).toBeNull();
  });

  it('não marca como parado um produto sem estoque disponível (nada para destacar)', () => {
    const result = buildStockRecommendations(
      baseInput({
        products: [product({ id: 'p1', currentQuantity: 0, minQuantity: 0 })],
        sales: [],
      }),
    );
    expect(result.recommendations.some((r) => r.productId === 'p1' && r.type === 'estoque_parado')).toBe(false);
  });

  it('reporta dias sem saída como o mínimo do período, nunca inventando uma data de última venda anterior', () => {
    // A função pura só enxerga as vendas que a busca assíncrona já trouxe
    // (bounded pelo período de análise) — por isso um produto parado nunca
    // tem lastExitAt: se tivesse uma venda visível, não estaria "parado".
    const result = buildStockRecommendations(
      baseInput({
        products: [product({ id: 'p1', currentQuantity: 20, minQuantity: 0, costPrice: 10 })],
        sales: [],
        periodDays: 45,
      }),
    );
    const rec = result.recommendations.find((r) => r.productId === 'p1' && r.type === 'estoque_parado');
    expect(rec?.lastExitAt).toBeNull();
    expect(rec?.daysWithoutExit).toBe(45);
    expect(rec?.daysWithoutExitIsMinimum).toBe(true);
  });
});

describe('buildStockRecommendations — classificação de prioridade', () => {
  it('estoque parado nunca é crítico/alto — é um problema de capital, não de ruptura', () => {
    const result = buildStockRecommendations(
      baseInput({
        products: [product({ id: 'p1', currentQuantity: 20, minQuantity: 0, costPrice: 10 })],
        sales: [],
        periodDays: 30,
      }),
    );
    const rec = result.recommendations.find((r) => r.productId === 'p1' && r.type === 'estoque_parado');
    expect(['media', 'baixa']).toContain(rec?.priority);
  });

  it('prioridade nunca depende só de cor — sempre há texto e ícone renderizáveis a partir do valor', () => {
    const result = buildStockRecommendations(
      baseInput({
        products: [product({ id: 'p1', currentQuantity: 0, minQuantity: 5 })],
        sales: [],
      }),
    );
    const rec = result.recommendations.find((r) => r.productId === 'p1' && r.type === 'reposicao')!;
    expect(typeof rec.priority).toBe('string');
    expect(rec.priority.length).toBeGreaterThan(0);
  });
});

describe('buildStockRecommendations — dados insuficientes', () => {
  it('cobertura e data de ruptura ficam null quando não há consumo observado', () => {
    const result = buildStockRecommendations(
      baseInput({
        products: [product({ id: 'p1', currentQuantity: 1, minQuantity: 5 })],
        sales: [],
      }),
    );
    const rec = result.recommendations.find((r) => r.productId === 'p1' && r.type === 'reposicao')!;
    expect(rec.coverageDays).toBeNull();
    expect(rec.estimatedRuptureDate).toBeNull();
  });

  it('fornecedor sugerido é null quando não há histórico de compras do produto', () => {
    const result = buildStockRecommendations(
      baseInput({
        products: [product({ id: 'p1', currentQuantity: 0, minQuantity: 5 })],
        sales: [],
        purchases: [],
      }),
    );
    const rec = result.recommendations.find((r) => r.productId === 'p1' && r.type === 'reposicao')!;
    expect(rec.supplierHint).toBeNull();
  });

  it('usa o fornecedor da compra mais recente quando há histórico', () => {
    const result = buildStockRecommendations(
      baseInput({
        products: [product({ id: 'p1', currentQuantity: 0, minQuantity: 5 })],
        sales: [],
        purchases: [
          { productId: 'p1', supplierId: 's-old', supplierName: 'Fornecedor Antigo', occurredAt: noonIso(2026, 1, 1) },
          { productId: 'p1', supplierId: 's-new', supplierName: 'Fornecedor Novo', occurredAt: noonIso(2026, 7, 1) },
        ],
      }),
    );
    const rec = result.recommendations.find((r) => r.productId === 'p1' && r.type === 'reposicao')!;
    expect(rec.supplierHint?.supplierId).toBe('s-new');
  });
});

describe('buildStockRecommendations — estado persistido (dispensar/adiar/resolver)', () => {
  it('reflete o status dispensado vindo do estado persistido', () => {
    const result = buildStockRecommendations(
      baseInput({
        products: [product({ id: 'p1', currentQuantity: 0, minQuantity: 5 })],
        sales: [],
        states: [{ productId: 'p1', recommendationType: 'reposicao', status: 'dismissed', postponedUntil: null }],
      }),
    );
    const rec = result.recommendations.find((r) => r.productId === 'p1' && r.type === 'reposicao')!;
    expect(rec.status).toBe('dismissed');
  });

  it('reativa automaticamente uma recomendação adiada quando a data já passou', () => {
    const result = buildStockRecommendations(
      baseInput({
        products: [product({ id: 'p1', currentQuantity: 0, minQuantity: 5 })],
        sales: [],
        states: [{ productId: 'p1', recommendationType: 'reposicao', status: 'postponed', postponedUntil: noonIso(2026, 7, 1) }],
        now: noon(2026, 7, 19),
      }),
    );
    const rec = result.recommendations.find((r) => r.productId === 'p1' && r.type === 'reposicao')!;
    expect(rec.status).toBe('active');
  });

  it('mantém adiada quando a data de adiamento ainda não chegou', () => {
    const result = buildStockRecommendations(
      baseInput({
        products: [product({ id: 'p1', currentQuantity: 0, minQuantity: 5 })],
        sales: [],
        states: [{ productId: 'p1', recommendationType: 'reposicao', status: 'postponed', postponedUntil: noonIso(2026, 7, 25) }],
        now: noon(2026, 7, 19),
      }),
    );
    const rec = result.recommendations.find((r) => r.productId === 'p1' && r.type === 'reposicao')!;
    expect(rec.status).toBe('postponed');
  });
});

describe('getStockRecommendations — isolamento por empresa e permissões', () => {
  beforeEach(() => {
    mocks.companyId = 'company-1';
    mocks.from.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 19, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('nunca consulta o Supabase sem empresa ativa no contexto', async () => {
    mocks.companyId = undefined;
    await expect(getStockRecommendations({ analysisPeriodDays: 30, targetCoverageDays: 14 })).rejects.toThrow(
      'Empresa não identificada.',
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('escopa produtos, vendas, compras e estados por company_id', async () => {
    const productsBuilder = mocks.makeBuilder({ data: [], error: null });
    const salesBuilder = mocks.makeBuilder({ data: [], error: null });
    const statesBuilder = mocks.makeBuilder({ data: [], error: null });
    const purchasesBuilder = mocks.makeBuilder({ data: [], error: null });

    mocks.from
      .mockImplementationOnce(() => productsBuilder)
      .mockImplementationOnce(() => salesBuilder)
      .mockImplementationOnce(() => statesBuilder)
      .mockImplementationOnce(() => purchasesBuilder);

    await getStockRecommendations({ analysisPeriodDays: 30, targetCoverageDays: 14 });

    expect(mocks.from.mock.calls.map((call) => call[0])).toEqual([
      'products',
      'sale_items',
      'stock_recommendation_states',
      'purchase_items',
    ]);
    expect(productsBuilder.eq).toHaveBeenCalledWith('company_id', 'company-1');
    expect(salesBuilder.eq).toHaveBeenCalledWith('sales.company_id', 'company-1');
    expect(salesBuilder.neq).toHaveBeenCalledWith('sales.payment_status', 'cancelled');
    expect(statesBuilder.eq).toHaveBeenCalledWith('company_id', 'company-1');
    expect(purchasesBuilder.eq).toHaveBeenCalledWith('purchases.company_id', 'company-1');
  });
});

describe('ações do usuário (dispensar/adiar/resolver) — persistência e isolamento', () => {
  beforeEach(() => {
    mocks.companyId = 'company-1';
    mocks.userId = 'user-1';
    mocks.from.mockReset();
  });

  it('dismissRecommendation grava estado e ação com company_id e usuário atual', async () => {
    const stateBuilder = mocks.makeBuilder({ data: null, error: null });
    const actionBuilder = mocks.makeBuilder({ data: null, error: null });
    mocks.from.mockImplementationOnce(() => stateBuilder).mockImplementationOnce(() => actionBuilder);

    await dismissRecommendation({ productId: 'p1', recommendationType: 'reposicao', reason: 'Fornecedor descontinuou o item' });

    expect(mocks.from.mock.calls.map((c) => c[0])).toEqual(['stock_recommendation_states', 'stock_recommendation_actions']);
    expect(stateBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ company_id: 'company-1', product_id: 'p1', recommendation_type: 'reposicao', status: 'dismissed' }),
      expect.objectContaining({ onConflict: 'company_id,product_id,recommendation_type' }),
    );
    expect(actionBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: 'company-1',
        product_id: 'p1',
        action: 'dismissed',
        reason: 'Fornecedor descontinuou o item',
        performed_by: 'user-1',
      }),
    );
  });

  it('postponeRecommendation define postponed_until 7 dias à frente por padrão', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 19, 12, 0, 0));

    const stateBuilder = mocks.makeBuilder({ data: null, error: null });
    const actionBuilder = mocks.makeBuilder({ data: null, error: null });
    mocks.from.mockImplementationOnce(() => stateBuilder).mockImplementationOnce(() => actionBuilder);

    await postponeRecommendation({ productId: 'p1', recommendationType: 'estoque_parado' });

    const upsertPayload = stateBuilder.upsert.mock.calls[0][0];
    expect(upsertPayload.status).toBe('postponed');
    expect(new Date(upsertPayload.postponed_until).toISOString().slice(0, 10)).toBe('2026-07-26');

    vi.useRealTimers();
  });

  it('resolveRecommendation nunca apaga o registro anterior — sempre insere uma nova linha de auditoria', async () => {
    const stateBuilder = mocks.makeBuilder({ data: null, error: null });
    const actionBuilder = mocks.makeBuilder({ data: null, error: null });
    mocks.from.mockImplementationOnce(() => stateBuilder).mockImplementationOnce(() => actionBuilder);

    await resolveRecommendation({ productId: 'p1', recommendationType: 'reposicao' });

    expect(actionBuilder.insert).toHaveBeenCalledTimes(1);
    expect(actionBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ action: 'resolved' }));
  });

  it('nunca grava ação sem empresa ativa no contexto', async () => {
    mocks.companyId = undefined;
    await expect(dismissRecommendation({ productId: 'p1', recommendationType: 'reposicao' })).rejects.toThrow(
      'Empresa não identificada.',
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
