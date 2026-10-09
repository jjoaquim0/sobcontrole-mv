import { describe, expect, it } from 'vitest';
import {
  computeDueDate, currentWorkingCompetence, describeItemDue, describeSchedule, formatCompetence, getItemDueState,
  shiftCompetence, sortItemsForAgenda, summarizeItems, templateApplies,
} from './obligationsDomain';

const TODAY = '2026-10-09';

describe('competências', () => {
  it('formata, desloca e escolhe o mês de trabalho', () => {
    expect(formatCompetence('2026-07-01')).toBe('julho/2026');
    expect(shiftCompetence('2026-01-01', -1)).toBe('2025-12-01');
    expect(shiftCompetence('2026-11-01', 3)).toBe('2027-02-01');
    expect(currentWorkingCompetence(TODAY)).toBe('2026-09-01');
  });

  it('calcula o prazo como o banco, limitado ao último dia do mês', () => {
    expect(computeDueDate('2026-07-01', 5, 1)).toBe('2026-08-05');
    expect(computeDueDate('2027-01-01', 31, 1)).toBe('2027-02-28');
    expect(computeDueDate('2026-07-01', 15, 0)).toBe('2026-07-15');
    expect(computeDueDate('2026-11-01', 10, 2)).toBe('2027-01-10');
  });

  it('aplica recorrência mensal, trimestral e anual', () => {
    expect(templateApplies({ recurrence: 'monthly' }, '2026-08-01')).toBe(true);
    expect(templateApplies({ recurrence: 'quarterly', referenceMonth: 1 }, '2026-07-01')).toBe(true);
    expect(templateApplies({ recurrence: 'quarterly', referenceMonth: 1 }, '2026-08-01')).toBe(false);
    expect(templateApplies({ recurrence: 'quarterly', referenceMonth: 11 }, '2026-02-01')).toBe(true);
    expect(templateApplies({ recurrence: 'yearly', referenceMonth: 7 }, '2026-07-01')).toBe(true);
    expect(templateApplies({ recurrence: 'yearly', referenceMonth: 7 }, '2026-08-01')).toBe(false);
  });

  it('descreve o calendário da obrigação', () => {
    expect(describeSchedule({ recurrence: 'monthly', dueDay: 5, dueMonthOffset: 1 })).toBe('Mensal, até o dia 5 do mês seguinte');
    expect(describeSchedule({ recurrence: 'yearly', referenceMonth: 7, dueDay: 15, dueMonthOffset: 0 })).toBe('Anual em julho, até o dia 15 do mês da competência');
  });
});

describe('itens', () => {
  it('classifica prazo e descreve', () => {
    expect(getItemDueState({ status: 'pending', dueDate: '2026-10-08' }, TODAY)).toBe('overdue');
    expect(getItemDueState({ status: 'rejected', dueDate: '2026-10-16' }, TODAY)).toBe('due_soon');
    expect(getItemDueState({ status: 'submitted', dueDate: '2026-10-17' }, TODAY)).toBe('ok');
    expect(getItemDueState({ status: 'verified', dueDate: '2026-10-01' }, TODAY)).toBe('done');
    expect(describeItemDue({ status: 'pending', dueDate: '2026-10-06' }, TODAY)).toBe('Atrasado há 3 dia(s)');
    expect(describeItemDue({ status: 'pending', dueDate: TODAY }, TODAY)).toBe('Vence hoje');
    expect(describeItemDue({ status: 'waived', dueDate: TODAY }, TODAY)).toBe('Não se aplica');
  });

  it('resume a competência e ordena a agenda', () => {
    const items = [
      { name: 'B', status: 'pending' as const, dueDate: '2026-11-01' },
      { name: 'A', status: 'verified' as const, dueDate: '2026-09-01' },
      { name: 'C', status: 'submitted' as const, dueDate: '2026-10-01' },
      { name: 'D', status: 'waived' as const, dueDate: '2026-10-01' },
      { name: 'E', status: 'pending' as const, dueDate: '2026-10-12' },
    ];
    expect(summarizeItems(items, TODAY)).toEqual({ total: 5, done: 2, awaitingReview: 1, open: 2, overdue: 1, percent: 40 });
    expect(sortItemsForAgenda(items, TODAY).map((item) => item.name)).toEqual(['C', 'E', 'B', 'A', 'D']);
  });
});
