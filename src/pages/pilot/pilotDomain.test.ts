import { describe, expect, it, vi } from 'vitest';
import type { PilotMetrics, PilotSnapshot } from '@/types';
import { mapPilotMetrics } from '@/services/pilotService';
import {
  compareMetric,
  defaultPilotPeriod,
  evaluateCriteria,
  formatMetric,
  pickBaseline,
  pickFinal,
  summarizeCriteria,
  validatePeriod,
} from './pilotDomain';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

const metrics = (overrides: Partial<PilotMetrics> = {}, acceptance: Partial<PilotMetrics['acceptance']> = {}): PilotMetrics => ({
  periodFrom: '2026-09-01', periodTo: '2026-09-30', computedAt: '2026-10-01T00:00:00Z',
  demandsClosed: 2, demandsClosedOnTime: 1, demandsOnTimePct: 50, demandsOpenWithoutResponsible: 0, demandsOpenOverdue: 1,
  replacementsClosed: 2, replacementAvgDays: 3.3, obligationItemsDue: 4, obligationItemsOnTime: 3, obligationItemsOnTimePct: 75,
  packagesReady: 0, packagesSent: 1, usersTotal: 3, usersActive: 1, usersActivePct: 33.3,
  ...overrides,
  acceptance: { contractsConfirmed: 1, activePosts: 2, activeAllocations: 2, demandsFullFlow: 1, periodsControlled: 1, itemsOpenWithoutResponsible: 0, ...acceptance },
});

const snapshot = (overrides: Partial<PilotSnapshot>): PilotSnapshot => ({
  id: 's', label: 'Medição', kind: 'checkpoint', periodFrom: '2026-09-01', periodTo: '2026-09-30', metrics: metrics(), createdAt: '2026-10-01T00:00:00Z', ...overrides,
});

describe('pilot domain', () => {
  it('formata percentuais, dias e ausência de base', () => {
    expect(formatMetric(50, 'pct')).toBe('50,0%');
    expect(formatMetric(3.3, 'days')).toBe('3,3 dias');
    expect(formatMetric(1, 'days')).toBe('1,0 dia');
    expect(formatMetric(4, 'count')).toBe('4');
    expect(formatMetric(null, 'pct')).toBe('—');
  });

  it('compara com a linha de base respeitando o sentido de melhora', () => {
    expect(compareMetric(60, 50, 'pct', 'higher')).toEqual({ tone: 'better', text: '+10,0 p.p. em relação à linha de base' });
    expect(compareMetric(5, 3, 'days', 'lower').tone).toBe('worse');
    expect(compareMetric(1, 3, 'count', 'lower')).toEqual({ tone: 'better', text: '−2 em relação à linha de base' });
    expect(compareMetric(2, 2, 'count', 'lower').tone).toBe('same');
    expect(compareMetric(null, 2, 'pct', 'higher').tone).toBe('none');
  });

  it('valida o período e usa os últimos 30 dias por padrão', () => {
    expect(defaultPilotPeriod('2026-10-09')).toEqual({ from: '2026-09-10', to: '2026-10-09' });
    expect(defaultPilotPeriod('2026-03-01')).toEqual({ from: '2026-01-31', to: '2026-03-01' });
    expect(validatePeriod('2026-10-09', '2026-10-01')).toMatch('anterior');
    expect(validatePeriod('2025-01-01', '2026-10-01')).toMatch('400 dias');
    expect(validatePeriod('', '2026-10-01')).toMatch('duas datas');
    expect(validatePeriod('2026-09-01', '2026-09-30')).toBeUndefined();
  });

  it('escolhe a linha de base mais antiga e a decisão final mais recente', () => {
    const list = [
      snapshot({ id: 'b2', kind: 'baseline', createdAt: '2026-09-10T00:00:00Z' }),
      snapshot({ id: 'b1', kind: 'baseline', createdAt: '2026-09-01T00:00:00Z' }),
      snapshot({ id: 'f1', kind: 'final', decision: 'adjust', createdAt: '2026-10-01T00:00:00Z' }),
      snapshot({ id: 'f2', kind: 'final', decision: 'expand', createdAt: '2026-10-05T00:00:00Z' }),
    ];
    expect(pickBaseline(list)?.id).toBe('b1');
    expect(pickFinal(list)?.id).toBe('f2');
    expect(pickBaseline([])).toBeUndefined();
  });

  it('avalia os 7 critérios de aceite com evidência automática e confirmações manuais', () => {
    const pending = evaluateCriteria(undefined, [], []);
    expect(pending).toHaveLength(7);
    expect(summarizeCriteria(pending).met).toBe(0);

    const full = evaluateCriteria(
      metrics(),
      [
        { criterion: 4, isConfirmed: true, note: 'Testado com perfil Yuri', updatedByName: 'Gestor', updatedAt: '' },
        { criterion: 5, isConfirmed: false, updatedAt: '' },
      ],
      [snapshot({ kind: 'final', decision: 'expand', label: 'Final' })],
    );
    expect(full.filter((criterion) => criterion.state === 'met').map((criterion) => criterion.number)).toEqual([1, 2, 3, 4, 6, 7]);
    expect(full[3].evidence).toBe('Confirmado por Gestor: Testado com perfil Yuri');
    expect(full[6].evidence).toContain('ampliar');

    const gaps = evaluateCriteria(metrics({ demandsOpenWithoutResponsible: 1 }, { activeAllocations: 0 }), [], []);
    expect(gaps[0].state).toBe('pending');
    expect(gaps[5].state).toBe('pending');
    expect(gaps[5].evidence).toContain('não declara conformidade');
  });

  it('converte o JSON da RPC e mantém percentuais nulos', () => {
    const mapped = mapPilotMetrics({ demands_closed: 2, demands_on_time_pct: null, replacement_avg_days: '3.3', acceptance: { periods_controlled: 1 } });
    expect(mapped.demandsClosed).toBe(2);
    expect(mapped.demandsOnTimePct).toBeNull();
    expect(mapped.replacementAvgDays).toBe(3.3);
    expect(mapped.acceptance.periodsControlled).toBe(1);
    expect(mapped.usersTotal).toBe(0);
  });
});
