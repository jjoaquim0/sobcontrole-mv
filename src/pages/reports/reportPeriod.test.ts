import { describe, expect, it } from 'vitest';
import { getReportDateRange } from './reportPeriod';

const REFERENCE = new Date('2026-07-29T15:30:00.000-03:00');

describe('getReportDateRange', () => {
  it('calcula hoje a partir do início do dia local', () => {
    const range = getReportDateRange({ type: 'today' }, REFERENCE);
    expect(new Date(range.dateFrom).toLocaleDateString('en-CA')).toBe('2026-07-29');
    expect(range.dateTo).toBe(REFERENCE.toISOString());
  });

  it('calcula últimos 7 dias incluindo o dia atual', () => {
    const range = getReportDateRange({ type: '7d' }, REFERENCE);
    expect(new Date(range.dateFrom).toLocaleDateString('en-CA')).toBe('2026-07-23');
    expect(range.label).toContain('2026');
  });

  it('calcula o mês anterior completo', () => {
    const range = getReportDateRange({ type: 'previous_month' }, REFERENCE);
    expect(new Date(range.dateFrom).toLocaleDateString('en-CA')).toBe('2026-06-01');
    expect(new Date(range.dateTo).toLocaleDateString('en-CA')).toBe('2026-06-30');
  });

  it('calcula o trimestre atual', () => {
    const range = getReportDateRange({ type: 'quarter' }, REFERENCE);
    expect(new Date(range.dateFrom).toLocaleDateString('en-CA')).toBe('2026-07-01');
  });

  it('normaliza período personalizado invertido', () => {
    const range = getReportDateRange(
      { type: 'custom', dateFrom: '2026-07-20', dateTo: '2026-07-10' },
      REFERENCE,
    );
    expect(new Date(range.dateFrom).toLocaleDateString('en-CA')).toBe('2026-07-10');
    expect(new Date(range.dateTo).toLocaleDateString('en-CA')).toBe('2026-07-20');
  });

  it('produz comparação anterior com a mesma duração', () => {
    const range = getReportDateRange({ type: '7d' }, REFERENCE);
    const currentDuration = new Date(range.dateTo).getTime() - new Date(range.dateFrom).getTime();
    const previousDuration = new Date(range.previousDateTo).getTime() - new Date(range.previousDateFrom).getTime();
    expect(previousDuration).toBe(currentDuration);
    expect(new Date(range.previousDateTo).getTime()).toBe(new Date(range.dateFrom).getTime() - 1);
  });
});
