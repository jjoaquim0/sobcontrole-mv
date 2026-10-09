import { describe, expect, it } from 'vitest';
import { DocumentRecord, DocumentRequirement } from '@/types';
import {
  buildChecklist, describeExpiry, getAbsenceState, getAbsentEmployeeIds, getChecklistState,
  getReplacementState, suggestExpiry, summarizeChecklist,
} from './peopleDocsDomain';

const TODAY = '2026-10-09';

const record = (overrides: Partial<DocumentRecord> = {}): DocumentRecord => ({
  id: 'r1', requirementId: 'aso', employeeId: 'e1', status: 'verified', documentUrl: 'https://docs/aso.pdf',
  submittedByName: 'Gestor', createdAt: '2026-10-01T10:00:00Z', ...overrides,
});
const requirement = (overrides: Partial<DocumentRequirement> = {}): DocumentRequirement => ({
  id: 'aso', name: 'ASO', target: 'employee', isActive: true, ...overrides,
});

describe('getChecklistState', () => {
  it('classifica cada situação do documento', () => {
    expect(getChecklistState(undefined, TODAY)).toBe('missing');
    expect(getChecklistState(record({ status: 'rejected' }), TODAY)).toBe('rejected');
    expect(getChecklistState(record({ expiresOn: '2026-10-08' }), TODAY)).toBe('expired');
    expect(getChecklistState(record({ status: 'submitted', expiresOn: '2026-10-08' }), TODAY)).toBe('expired');
    expect(getChecklistState(record({ status: 'submitted', expiresOn: '2027-10-01' }), TODAY)).toBe('awaiting_review');
    expect(getChecklistState(record({ expiresOn: '2026-11-08' }), TODAY)).toBe('expiring');
    expect(getChecklistState(record({ expiresOn: '2026-11-09' }), TODAY)).toBe('valid');
    expect(getChecklistState(record(), TODAY)).toBe('valid');
  });

  it('descreve a validade', () => {
    expect(describeExpiry(undefined, TODAY)).toBe('Sem validade');
    expect(describeExpiry('2026-10-06', TODAY)).toBe('Venceu há 3 dia(s)');
    expect(describeExpiry(TODAY, TODAY)).toBe('Vence hoje');
    expect(describeExpiry('2026-10-19', TODAY)).toBe('Vence em 10 dia(s)');
  });
});

describe('suggestExpiry', () => {
  it('soma os meses e tira um dia, como o banco', () => {
    expect(suggestExpiry('2026-10-09', 12)).toBe('2027-10-08');
    expect(suggestExpiry('2026-01-31', 1)).toBe('2026-02-27');
    expect(suggestExpiry('2026-03-01', 6)).toBe('2026-08-31');
    expect(suggestExpiry(undefined, 12)).toBeUndefined();
    expect(suggestExpiry('2026-10-09', undefined)).toBeUndefined();
  });
});

describe('buildChecklist', () => {
  const contracts = [
    { id: 'c1', title: 'Prefeitura', status: 'active' },
    { id: 'c2', title: 'Hospital', status: 'active' },
    { id: 'c3', title: 'Encerrado', status: 'closed' },
  ];
  const posts = [
    { id: 'p1', contractId: 'c1', name: 'Portaria' },
    { id: 'p2', contractId: 'c2', name: 'Limpeza' },
  ];
  const employees = [
    { id: 'e1', fullName: 'Ana', status: 'active' },
    { id: 'e2', fullName: 'Bruno', status: 'active' },
    { id: 'e3', fullName: 'Carla', status: 'terminated' },
    { id: 'e4', fullName: 'Diego', status: 'active' },
  ];
  const allocations = [
    { employeeId: 'e1', postId: 'p1', startDate: '2026-01-01' },
    { employeeId: 'e2', postId: 'p2', startDate: '2026-10-20' },
    { employeeId: 'e3', postId: 'p1', startDate: '2026-01-01' },
    { employeeId: 'e4', postId: 'p1', startDate: '2026-01-01', endDate: '2026-10-01' },
  ];

  it('cruza documentos com funcionários alocados e contratos ativos', () => {
    const items = buildChecklist({
      requirements: [
        requirement(),
        requirement({ id: 'nr', name: 'NR-35', contractId: 'c1', postId: 'p1' }),
        requirement({ id: 'cert', name: 'Certidão', target: 'contract' }),
        requirement({ id: 'old', name: 'Inativo', isActive: false }),
      ],
      records: [
        record({ id: 'old', createdAt: '2026-01-01T00:00:00Z', status: 'rejected', reviewNote: 'ilegível' }),
        record({ id: 'new', expiresOn: '2027-01-01' }),
        record({ id: 'c', requirementId: 'cert', employeeId: undefined, contractId: 'c1', expiresOn: '2026-10-01' }),
      ],
      contracts, posts, allocations, employees, today: TODAY,
    });

    expect(items.map((item) => item.key)).toEqual(['cert:c1', 'nr:e1', 'aso:e2', 'cert:c2', 'aso:e1']);
    expect(items.map((item) => item.state)).toEqual(['expired', 'missing', 'missing', 'missing', 'valid']);
    expect(items.find((item) => item.key === 'aso:e1')).toMatchObject({ targetName: 'Ana', context: 'Prefeitura · Portaria', contractIds: ['c1'] });
    expect(items.some((item) => item.employeeId === 'e3' || item.employeeId === 'e4')).toBe(false);
    expect(summarizeChecklist(items)).toEqual({ pending: 3, awaitingReview: 0, expired: 1, expiring: 0, valid: 1 });
  });
});

describe('ausências e trocas', () => {
  it('identifica férias em curso e quem está fora do posto', () => {
    const absences = [
      { employeeId: 'e1', startDate: '2026-10-01', endDate: '2026-10-30' },
      { employeeId: 'e2', startDate: '2026-10-10', endDate: '2026-10-20' },
      { employeeId: 'e3', startDate: '2026-10-01', endDate: '2026-10-30', canceledAt: '2026-10-02T00:00:00Z' },
      { employeeId: 'e4', startDate: '2026-09-01', endDate: '2026-10-08' },
    ];
    expect(absences.map((absence) => getAbsenceState(absence, TODAY))).toEqual(['current', 'upcoming', 'canceled', 'finished']);
    expect([...getAbsentEmployeeIds(absences, TODAY)]).toEqual(['e1']);
  });

  it('avisa a troca de uniforme/EPI', () => {
    expect(getReplacementState({ returnedOn: '2026-10-01', replaceBy: '2026-09-01' }, TODAY)).toBe('returned');
    expect(getReplacementState({}, TODAY)).toBe('none');
    expect(getReplacementState({ replaceBy: '2026-10-08' }, TODAY)).toBe('overdue');
    expect(getReplacementState({ replaceBy: '2026-11-01' }, TODAY)).toBe('soon');
    expect(getReplacementState({ replaceBy: '2027-01-01' }, TODAY)).toBe('ok');
  });
});
