import { describe, expect, it } from 'vitest';
import type { ContractListItem } from '@/services/contractsService';
import type { ObligationsOverview } from '@/services/obligationsService';
import type { PeopleDocsOverview } from '@/services/peopleDocsService';
import type { ServiceDemand } from '@/types';
import { buildOperationalPanel } from './operationalPanelDomain';

const TODAY = '2026-10-09';

const contract = (id: string, uncoveredPositions: number, status: ContractListItem['status'] = 'active') => ({
  id, title: `Contrato ${id}`, clientName: 'Cliente', status, validationStatus: 'confirmed', activePosts: 1, requiredHeadcount: 2,
  uncoveredPositions, postsCoveredBySubstitute: 0, createdAt: '', updatedAt: '',
}) as unknown as ContractListItem;

const demand = (id: string, overrides: Partial<ServiceDemand>): ServiceDemand => ({
  id, demandNumber: Number(id), typeId: 't', stageId: 's', title: `Demanda ${id}`, priority: 'normal', status: 'open',
  responsibleId: 'u1', createdAt: '', updatedAt: '', ...overrides,
});

const peopleDocs: PeopleDocsOverview = {
  contracts: [{ id: 'c1', title: 'Contrato c1', clientName: 'Cliente', status: 'active' }],
  posts: [{ id: 'p1', contractId: 'c1', name: 'Portaria', jobFunction: 'Porteiro', status: 'active' }],
  allocations: [{ id: 'a1', postId: 'p1', employeeId: 'e1', allocationRole: 'holder', startDate: '2026-01-01' }],
  employees: [{ id: 'e1', fullName: 'Ana', jobTitle: 'Porteira', status: 'active' }],
  requirements: [{ id: 'aso', name: 'ASO', target: 'employee', isActive: true }],
  records: [], absences: [], deliveries: [], events: [],
};

const obligations: ObligationsOverview = {
  contracts: [], people: [], templates: [], events: [],
  periods: [
    { id: 'per1', contractId: 'c1', contractTitle: 'Contrato c1', competence: '2026-09-01', status: 'open' },
    { id: 'per2', contractId: 'c1', contractTitle: 'Contrato c1', competence: '2026-08-01', status: 'ready', readyAt: 'x' },
  ],
  items: [
    { id: 'i1', periodId: 'per1', name: 'Ponto', dueDate: '2026-10-05', requiresEvidence: true, status: 'pending' },
    { id: 'i2', periodId: 'per1', name: 'FGTS', dueDate: '2026-10-12', requiresEvidence: true, status: 'submitted', responsibleName: 'Yuri' },
    { id: 'i3', periodId: 'per1', name: 'Relatório', dueDate: '2026-10-30', requiresEvidence: true, status: 'verified' },
    { id: 'i4', periodId: 'per2', name: 'Antigo', dueDate: '2026-09-01', requiresEvidence: true, status: 'pending' },
  ],
};

describe('buildOperationalPanel', () => {
  it('soma o que pede ação em cada frente', () => {
    const panel = buildOperationalPanel({
      contracts: [contract('c1', 1), contract('c2', 0), contract('c3', 4, 'draft')],
      demands: [
        demand('1', { dueDate: '2026-10-01' }),
        demand('2', { dueDate: TODAY, responsibleId: undefined }),
        demand('3', { dueDate: '2026-12-01' }),
        demand('4', { dueDate: '2026-09-01', status: 'closed' }),
      ],
      peopleDocs,
      obligations,
    }, TODAY);

    expect(panel.demands).toMatchObject({ open: 3, overdue: 1, dueToday: 1, withoutResponsible: 1 });
    expect(panel.demands.attention.map((item) => item.id)).toEqual(['1', '2']);
    expect(panel.coverage.uncoveredPositions).toBe(1);
    expect(panel.coverage.contracts.map((item) => item.id)).toEqual(['c1']);
    expect(panel.documents).toMatchObject({ pending: 1, expired: 0 });
    expect(panel.obligations).toMatchObject({ overdue: 1, dueSoon: 1, awaitingReview: 1, competence: '2026-09-01' });
    expect(panel.obligations.attention.map((item) => item.id)).toEqual(['i1', 'i2']);
    expect(panel.obligations.notOpened).toEqual([{ id: 'c2', title: 'Contrato c2' }]);
    expect(panel.obligations.readyToSend.map((item) => item.id)).toEqual(['per2']);
  });
});
