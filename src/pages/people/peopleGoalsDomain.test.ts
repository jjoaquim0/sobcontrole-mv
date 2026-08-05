import { describe, expect, it } from 'vitest';
import { SalesGoal } from '@/types';
import { isGoalAtRisk } from '@/services/peopleGoalsService';
import { formatGoalValue, getDefaultPeriodDates, toDateInput } from './peopleDomain';

const goal = (overrides: Partial<SalesGoal> = {}): SalesGoal => ({
  id: 'goal-1', companyId: 'company-1', name: 'Meta individual', goalType: 'sales_count',
  assignmentType: 'employee', employeeId: 'employee-1', employeeName: 'Ana', periodType: 'monthly',
  targetValue: 10, startDate: '2026-08-01', endDate: '2026-08-31', status: 'active',
  effectiveStatus: 'active', resultSource: 'manual', hasAutomaticSource: false,
  manualResult: 2, currentResult: 2, progressPercent: 20, createdAt: '', updatedAt: '', ...overrides,
});

describe('people sales goals domain', () => {
  it('supports monthly, quarterly and annual periods without inventing results', () => {
    const monthly = getDefaultPeriodDates('monthly', new Date(2026, 7, 15));
    const quarterly = getDefaultPeriodDates('quarterly', new Date(2026, 7, 15));
    const annual = getDefaultPeriodDates('annual', new Date(2026, 7, 15));
    expect([toDateInput(monthly.startDate), toDateInput(monthly.endDate)]).toEqual(['2026-08-01', '2026-08-31']);
    expect([toDateInput(quarterly.startDate), toDateInput(quarterly.endDate)]).toEqual(['2026-07-01', '2026-09-30']);
    expect([toDateInput(annual.startDate), toDateInput(annual.endDate)]).toEqual(['2026-01-01', '2026-12-31']);
  });

  it('classifies individual and team goals at risk from elapsed time and stored progress', () => {
    expect(isGoalAtRisk(goal(), new Date(2026, 7, 24, 12))).toBe(true);
    expect(isGoalAtRisk(goal({ assignmentType: 'team', employeeId: undefined, teamId: 'team-1', progressPercent: 90 }), new Date(2026, 7, 24, 12))).toBe(false);
    expect(isGoalAtRisk(goal({ effectiveStatus: 'completed' }), new Date(2026, 7, 24, 12))).toBe(false);
  });

  it('formats currency only for sales value goals', () => {
    expect(formatGoalValue(goal(), 3)).toBe('3');
    expect(formatGoalValue(goal({ goalType: 'sales_value', targetValue: 1000 }), 1000)).toMatch(/R\$\s*1\.000,00/);
  });
});
