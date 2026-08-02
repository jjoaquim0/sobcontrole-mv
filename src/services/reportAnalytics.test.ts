import { describe, expect, it } from 'vitest';
import {
  buildAmountTimeSeries,
  calculateVariance,
  createTimeBuckets,
  isCancelledStatus,
  isOverdue,
} from './reportAnalytics';

describe('reportAnalytics', () => {
  it('calcula comparação de períodos, inclusive baseline zero', () => {
    expect(calculateVariance(120, 100)).toBe(20);
    expect(calculateVariance(10, 0)).toBe(100);
    expect(calculateVariance(0, 0)).toBe(0);
  });

  it('reconhece as duas grafias legadas de cancelamento', () => {
    expect(isCancelledStatus('cancelled')).toBe(true);
    expect(isCancelledStatus('canceled')).toBe(true);
    expect(isCancelledStatus('paid')).toBe(false);
  });

  it('classifica pendente vencido sem depender apenas do status late', () => {
    const reference = new Date('2026-07-29T12:00:00Z');
    expect(isOverdue('pending', '2026-07-28T12:00:00Z', reference)).toBe(true);
    expect(isOverdue('pending', '2026-07-30T12:00:00Z', reference)).toBe(false);
    expect(isOverdue('late', '2026-08-01T12:00:00Z', reference)).toBe(true);
  });

  it('mantém buckets em ordem cronológica, não pela legenda formatada', () => {
    const { buckets } = createTimeBuckets('2026-06-29T00:00:00-03:00', '2026-07-02T23:59:59-03:00');
    expect(buckets.map((bucket) => bucket.key)).toEqual(['2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02']);
  });

  it('reconcilia séries no mesmo conjunto de buckets', () => {
    const result = buildAmountTimeSeries(
      '2026-07-01T00:00:00-03:00',
      '2026-07-03T23:59:59-03:00',
      {
        revenue: [
          { occurredAt: '2026-07-01T10:00:00-03:00', amount: 100 },
          { occurredAt: '2026-07-01T14:00:00-03:00', amount: 50 },
        ],
        expenses: [{ occurredAt: '2026-07-02T10:00:00-03:00', amount: 40 }],
      },
    );
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ revenue: 150, expenses: 0 });
    expect(result[1]).toMatchObject({ revenue: 0, expenses: 40 });
  });
});
