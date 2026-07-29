import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type QueryResult = { data: unknown[] | null; error: { message: string } | null };

interface QueryBuilderMock {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  then: (resolve: (value: QueryResult) => void, reject: (reason: unknown) => void) => Promise<void>;
}

const mocks = vi.hoisted(() => {
  const makeBuilder = (result: QueryResult): QueryBuilderMock => {
    const builder = {} as QueryBuilderMock;
    (['select', 'eq', 'in', 'lte'] as const).forEach((method) => {
      builder[method] = vi.fn(() => builder);
    });
    builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
    return builder;
  };

  return {
    makeBuilder,
    from: vi.fn(),
    companyId: 'company-1' as string | undefined,
  };
});

vi.mock('../lib/supabase', () => ({
  supabase: { from: mocks.from },
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: {
    getState: () => ({ company: mocks.companyId ? { id: mocks.companyId } : undefined }),
  },
}));

import { calculateForecast, deriveGranularity, ForecastRawEntry, getCashFlowForecast } from './cashFlowForecastService';

// Ancorado ao meio-dia UTC para que a extração de "dia local" (getFullYear/
// getMonth/getDate) não varie por fuso horário da máquina que roda o teste -
// todos os fixtures usam a mesma âncora, então diferenças relativas de dia
// permanecem corretas independentemente do fuso local do executor.
const noon = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
const noonIso = (y: number, m: number, d: number) => noon(y, m, d).toISOString();

const receivable = (overrides: Partial<ForecastRawEntry>): ForecastRawEntry => ({
  id: 'rec-1',
  amount: 100,
  dueDate: noonIso(2026, 7, 19),
  description: 'Recebimento',
  ...overrides,
});

const payable = (overrides: Partial<ForecastRawEntry>): ForecastRawEntry => ({
  id: 'pay-1',
  amount: 100,
  dueDate: noonIso(2026, 7, 19),
  description: 'Pagamento',
  ...overrides,
});

describe('deriveGranularity', () => {
  it('usa granularidade diária até 30 dias', () => {
    expect(deriveGranularity(7)).toBe('day');
    expect(deriveGranularity(30)).toBe('day');
  });

  it('usa granularidade semanal entre 31 e 90 dias', () => {
    expect(deriveGranularity(31)).toBe('week');
    expect(deriveGranularity(90)).toBe('week');
  });

  it('usa granularidade mensal acima de 90 dias', () => {
    expect(deriveGranularity(91)).toBe('month');
    expect(deriveGranularity(365)).toBe('month');
  });
});

describe('calculateForecast — cálculo acumulado do saldo projetado', () => {
  it('acumula saldo inicial + entradas previstas - saídas previstas dia a dia', () => {
    const result = calculateForecast({
      currentBalance: 1000,
      openReceivables: [receivable({ id: 'r1', amount: 500, dueDate: noonIso(2026, 7, 20) })],
      openPayables: [payable({ id: 'p1', amount: 200, dueDate: noonIso(2026, 7, 21) })],
      startDate: noon(2026, 7, 19),
      endDate: noon(2026, 7, 21),
      now: noon(2026, 7, 19),
    });

    expect(result.buckets).toHaveLength(3);
    const [day0, day1, day2] = result.buckets;

    expect(day0.openingBalance).toBe(1000);
    expect(day0.closingBalance).toBe(1000);

    expect(day1.openingBalance).toBe(1000);
    expect(day1.inflows).toBe(500);
    expect(day1.closingBalance).toBe(1500);

    expect(day2.openingBalance).toBe(1500);
    expect(day2.outflows).toBe(200);
    expect(day2.closingBalance).toBe(1300);

    expect(result.projectedEndBalance).toBe(1300);
    expect(result.totalInflows).toBe(500);
    expect(result.totalOutflows).toBe(200);
  });

  it('o saldo final de um dia é o saldo inicial do dia seguinte', () => {
    const result = calculateForecast({
      currentBalance: 0,
      openReceivables: [receivable({ id: 'r1', amount: 300, dueDate: noonIso(2026, 7, 19) })],
      openPayables: [],
      startDate: noon(2026, 7, 19),
      endDate: noon(2026, 7, 20),
      now: noon(2026, 7, 19),
    });

    expect(result.buckets[0].closingBalance).toBe(result.buckets[1].openingBalance);
  });
});

describe('calculateForecast — separação entre realizado e previsto', () => {
  it('nunca soma valores de status pago no saldo inicial — currentBalance é um número já realizado, injetado separadamente', () => {
    // currentBalance representa a soma de tudo que já foi pago/recebido
    // (calculada fora da função pura, a partir de status = 'paid'). A função
    // de cálculo nunca reprocessa esse valor a partir de lançamentos abertos.
    const result = calculateForecast({
      currentBalance: 5000,
      openReceivables: [],
      openPayables: [],
      startDate: noon(2026, 7, 19),
      endDate: noon(2026, 7, 19),
      now: noon(2026, 7, 19),
    });

    expect(result.currentBalance).toBe(5000);
    expect(result.buckets[0].openingBalance).toBe(5000);
    expect(result.totalInflows).toBe(0);
    expect(result.totalOutflows).toBe(0);
  });
});

describe('calculateForecast — lançamentos vencidos', () => {
  it('soma lançamento vencido no primeiro dia da projeção e marca status "vencido"', () => {
    const result = calculateForecast({
      currentBalance: 0,
      openReceivables: [receivable({ id: 'r-old', amount: 300, dueDate: noonIso(2026, 7, 10) })],
      openPayables: [],
      startDate: noon(2026, 7, 19),
      endDate: noon(2026, 7, 21),
      now: noon(2026, 7, 19),
    });

    const day0 = result.buckets[0];
    expect(day0.inflows).toBe(300);
    expect(day0.entries).toHaveLength(1);
    expect(day0.entries[0].status).toBe('vencido');
    expect(result.overdueReceivablesTotal).toBe(300);
  });

  it('lançamento com vencimento futuro dentro do período aparece como "previsto"', () => {
    const result = calculateForecast({
      currentBalance: 0,
      openReceivables: [receivable({ id: 'r-future', amount: 100, dueDate: noonIso(2026, 7, 20) })],
      openPayables: [],
      startDate: noon(2026, 7, 19),
      endDate: noon(2026, 7, 21),
      now: noon(2026, 7, 19),
    });

    const day1 = result.buckets[1];
    expect(day1.entries[0].status).toBe('previsto');
    expect(result.overdueReceivablesTotal).toBe(0);
  });
});

describe('calculateForecast — filtros de período', () => {
  it('respeita a janela [startDate, endDate] e ignora lançamentos fora dela', () => {
    const result = calculateForecast({
      currentBalance: 0,
      openReceivables: [receivable({ id: 'r-out', amount: 999, dueDate: noonIso(2026, 8, 30) })],
      openPayables: [],
      startDate: noon(2026, 7, 19),
      endDate: noon(2026, 7, 25),
      now: noon(2026, 7, 19),
    });

    expect(result.totalInflows).toBe(0);
    result.buckets.forEach((bucket) => expect(bucket.entries).toHaveLength(0));
  });

  it('gera um bucket por dia dentro do período (7 dias => 7 buckets)', () => {
    const result = calculateForecast({
      currentBalance: 0,
      openReceivables: [],
      openPayables: [],
      startDate: noon(2026, 7, 19),
      endDate: noon(2026, 7, 25),
      now: noon(2026, 7, 19),
    });

    expect(result.buckets).toHaveLength(7);
    expect(result.granularity).toBe('day');
  });

  it('rejeita data final anterior à inicial', () => {
    expect(() =>
      calculateForecast({
        currentBalance: 0,
        openReceivables: [],
        openPayables: [],
        startDate: noon(2026, 7, 19),
        endDate: noon(2026, 7, 18),
      }),
    ).toThrow();
  });

  it('rejeita períodos maiores que o limite de segurança', () => {
    expect(() =>
      calculateForecast({
        currentBalance: 0,
        openReceivables: [],
        openPayables: [],
        startDate: noon(2026, 1, 1),
        endDate: noon(2030, 1, 1),
      }),
    ).toThrow();
  });
});

describe('calculateForecast — agregação semanal', () => {
  it('agrupa em blocos de 7 dias quando o período é maior que 30 dias', () => {
    const result = calculateForecast({
      currentBalance: 0,
      openReceivables: [],
      openPayables: [],
      startDate: noon(2026, 7, 1),
      endDate: noon(2026, 8, 4), // 35 dias
      now: noon(2026, 7, 1),
    });

    expect(result.granularity).toBe('week');
    expect(result.buckets).toHaveLength(5);
  });

  it('marca o bucket semanal como negativo se algum dia interno ficou negativo, mesmo que feche positivo', () => {
    const result = calculateForecast({
      currentBalance: 0,
      openReceivables: [receivable({ id: 'r1', amount: 1000, dueDate: noonIso(2026, 7, 6) })],
      openPayables: [payable({ id: 'p1', amount: 1000, dueDate: noonIso(2026, 7, 3) })],
      startDate: noon(2026, 7, 1),
      endDate: noon(2026, 8, 4),
      now: noon(2026, 7, 1),
    });

    // Semana 1 (dias 1-7): dia 3 fica em -1000, dia 6 volta para 0.
    const week1 = result.buckets[0];
    expect(week1.closingBalance).toBe(0);
    expect(week1.status).toBe('negative');
  });
});

describe('calculateForecast — saldo negativo', () => {
  it('identifica a data do primeiro saldo negativo e o menor saldo do período', () => {
    const result = calculateForecast({
      currentBalance: 100,
      openReceivables: [],
      openPayables: [payable({ id: 'p1', amount: 500, dueDate: noonIso(2026, 7, 20) })],
      startDate: noon(2026, 7, 19),
      endDate: noon(2026, 7, 22),
      now: noon(2026, 7, 19),
    });

    expect(result.negativeDate).toBe(result.buckets[1].key);
    expect(result.buckets[1].closingBalance).toBe(-400);
    expect(result.lowestBalance.amount).toBe(-400);
    expect(result.lowestBalance.date).toBe(result.buckets[1].key);
  });

  it('negativeDate é null quando o saldo nunca fica negativo', () => {
    const result = calculateForecast({
      currentBalance: 1000,
      openReceivables: [],
      openPayables: [payable({ id: 'p1', amount: 50, dueDate: noonIso(2026, 7, 20) })],
      startDate: noon(2026, 7, 19),
      endDate: noon(2026, 7, 21),
      now: noon(2026, 7, 19),
    });

    expect(result.negativeDate).toBeNull();
  });
});

describe('calculateForecast — alertas', () => {
  it('gera alerta de saldo negativo quando há uma data negativa', () => {
    const result = calculateForecast({
      currentBalance: 0,
      openReceivables: [],
      openPayables: [payable({ id: 'p1', amount: 100, dueDate: noonIso(2026, 7, 19) })],
      startDate: noon(2026, 7, 19),
      endDate: noon(2026, 7, 19),
      now: noon(2026, 7, 19),
    });

    expect(result.alerts.some((a) => a.type === 'negative_balance')).toBe(true);
  });

  it('gera alertas de vencidos apenas quando existe valor vencido em aberto', () => {
    const withOverdue = calculateForecast({
      currentBalance: 1000,
      openReceivables: [receivable({ id: 'r-old', amount: 100, dueDate: noonIso(2026, 7, 1) })],
      openPayables: [],
      startDate: noon(2026, 7, 19),
      endDate: noon(2026, 7, 19),
      now: noon(2026, 7, 19),
    });
    expect(withOverdue.alerts.some((a) => a.type === 'overdue_receivables')).toBe(true);
    expect(withOverdue.alerts.some((a) => a.type === 'overdue_payables')).toBe(false);

    const withoutOverdue = calculateForecast({
      currentBalance: 1000,
      openReceivables: [receivable({ id: 'r-future', amount: 100, dueDate: noonIso(2026, 7, 19) })],
      openPayables: [],
      startDate: noon(2026, 7, 19),
      endDate: noon(2026, 7, 19),
      now: noon(2026, 7, 19),
    });
    expect(withoutOverdue.alerts.some((a) => a.type === 'overdue_receivables')).toBe(false);
  });

  it('gera alerta de concentração quando um dia isolado tem >= 30% das saídas do período (com saídas em 3+ dias)', () => {
    const result = calculateForecast({
      currentBalance: 10000,
      openReceivables: [],
      openPayables: [
        payable({ id: 'p1', amount: 900, dueDate: noonIso(2026, 7, 19) }),
        payable({ id: 'p2', amount: 50, dueDate: noonIso(2026, 7, 20) }),
        payable({ id: 'p3', amount: 50, dueDate: noonIso(2026, 7, 21) }),
      ],
      startDate: noon(2026, 7, 19),
      endDate: noon(2026, 7, 21),
      now: noon(2026, 7, 19),
    });

    expect(result.alerts.some((a) => a.type === 'payment_concentration' && a.bucketKey === result.buckets[0].key)).toBe(
      true,
    );
  });

  it('gera alerta de recebimento relevante quando um lançamento representa >= 20% das entradas previstas', () => {
    const result = calculateForecast({
      currentBalance: 0,
      openReceivables: [
        receivable({ id: 'r-big', amount: 800, dueDate: noonIso(2026, 7, 20) }),
        receivable({ id: 'r-small', amount: 200, dueDate: noonIso(2026, 7, 21) }),
      ],
      openPayables: [],
      startDate: noon(2026, 7, 19),
      endDate: noon(2026, 7, 21),
      now: noon(2026, 7, 19),
    });

    expect(result.alerts.some((a) => a.type === 'upcoming_receivable' && a.amount === 800)).toBe(true);
  });

  it('não gera nenhum alerta quando o período é saudável e sem vencidos', () => {
    const result = calculateForecast({
      currentBalance: 10000,
      openReceivables: [receivable({ id: 'r1', amount: 50, dueDate: noonIso(2026, 7, 20) })],
      openPayables: [payable({ id: 'p1', amount: 50, dueDate: noonIso(2026, 7, 21) })],
      startDate: noon(2026, 7, 19),
      endDate: noon(2026, 7, 21),
      now: noon(2026, 7, 19),
    });

    expect(result.alerts).toHaveLength(0);
  });
});

describe('getCashFlowForecast — isolamento por empresa e separação realizado/previsto', () => {
  beforeEach(() => {
    mocks.companyId = 'company-1';
    mocks.from.mockReset();
    // "Hoje" é usado internamente por getCashFlowForecast (new Date()) para
    // definir o início da projeção — fixado para que os testes não dependam
    // da data real em que rodam nem quebrem no futuro.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 19, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('nunca busca dados quando não há empresa ativa no contexto (evita vazamento entre empresas)', async () => {
    mocks.companyId = undefined;

    await expect(getCashFlowForecast({ endDate: new Date(2026, 6, 25) })).rejects.toThrow(
      'Empresa não identificada.',
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('escopa todas as consultas por company_id e separa saldo pago (realizado) de lançamentos em aberto (previsto)', async () => {
    const paidReceivablesBuilder = mocks.makeBuilder({ data: [{ amount: 1000 }, { amount: 500 }], error: null });
    const paidPayablesBuilder = mocks.makeBuilder({ data: [{ amount: 300 }], error: null });
    const openReceivablesBuilder = mocks.makeBuilder({
      data: [{ id: 'r1', amount: 200, due_date: new Date(2026, 6, 20).toISOString(), description: 'Fatura', customers: { full_name: 'Cliente X' } }],
      error: null,
    });
    const openPayablesBuilder = mocks.makeBuilder({ data: [], error: null });

    mocks.from
      .mockImplementationOnce(() => paidReceivablesBuilder)
      .mockImplementationOnce(() => paidPayablesBuilder)
      .mockImplementationOnce(() => openReceivablesBuilder)
      .mockImplementationOnce(() => openPayablesBuilder);

    const result = await getCashFlowForecast({ endDate: new Date(2026, 6, 25) });

    expect(mocks.from.mock.calls.map((call) => call[0])).toEqual([
      'account_receivables',
      'account_payables',
      'account_receivables',
      'account_payables',
    ]);

    // Saldo realizado: soma de status = 'paid', nunca reprocessado como previsão.
    expect(paidReceivablesBuilder.eq).toHaveBeenCalledWith('company_id', 'company-1');
    expect(paidReceivablesBuilder.eq).toHaveBeenCalledWith('status', 'paid');
    expect(paidPayablesBuilder.eq).toHaveBeenCalledWith('company_id', 'company-1');
    expect(paidPayablesBuilder.eq).toHaveBeenCalledWith('status', 'paid');

    // Lançamentos em aberto: status pending/late, nunca 'paid' — filtros
    // disjuntos garantem que o mesmo lançamento nunca conta nos dois lados.
    expect(openReceivablesBuilder.eq).toHaveBeenCalledWith('company_id', 'company-1');
    expect(openReceivablesBuilder.in).toHaveBeenCalledWith('status', ['pending', 'late']);
    expect(openPayablesBuilder.eq).toHaveBeenCalledWith('company_id', 'company-1');
    expect(openPayablesBuilder.in).toHaveBeenCalledWith('status', ['pending', 'late']);

    expect(result.currentBalance).toBe(1200); // 1000 + 500 - 300
    expect(result.totalInflows).toBe(200);
    expect(result.buckets.some((b) => b.entries.some((e) => e.relatedName === 'Cliente X'))).toBe(true);
  });

  it('propaga erros do Supabase em vez de mascará-los', async () => {
    const okBuilder = () => mocks.makeBuilder({ data: [], error: null });
    mocks.from
      .mockImplementationOnce(() => mocks.makeBuilder({ data: null, error: { message: 'Falha ao consultar' } }))
      .mockImplementationOnce(okBuilder)
      .mockImplementationOnce(okBuilder)
      .mockImplementationOnce(okBuilder);

    await expect(getCashFlowForecast({ endDate: new Date(2026, 6, 25) })).rejects.toMatchObject({
      message: 'Falha ao consultar',
    });
  });
});
