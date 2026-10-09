import { ObligationItemStatus, ServiceDemand } from '@/types';
import type { ContractListItem } from '@/services/contractsService';
import type { PeopleDocsOverview } from '@/services/peopleDocsService';
import type { ObligationsOverview } from '@/services/obligationsService';
import { getDueState } from '@/pages/demands/demandsDomain';
import { buildChecklist, ChecklistItem, summarizeChecklist } from '@/pages/peopleDocs/peopleDocsDomain';
import { currentWorkingCompetence, getItemDueState, isItemDone } from '@/pages/obligations/obligationsDomain';
import { todayIso } from '@/pages/contracts/contractsDomain';

export interface PanelSources {
  contracts: ContractListItem[];
  demands: ServiceDemand[];
  peopleDocs: PeopleDocsOverview;
  obligations: ObligationsOverview;
}

export interface PanelObligationItem {
  id: string;
  name: string;
  dueDate: string;
  status: ObligationItemStatus;
  responsibleName?: string;
  contractId: string;
  contractTitle: string;
  competence: string;
  dueState: 'overdue' | 'due_soon' | 'ok' | 'done';
}

export interface OperationalPanel {
  demands: { open: number; overdue: number; dueToday: number; withoutResponsible: number; attention: ServiceDemand[] };
  coverage: { uncoveredPositions: number; coveredBySubstitute: number; contracts: ContractListItem[] };
  documents: { pending: number; expired: number; expiring: number; awaitingReview: number; attention: ChecklistItem[] };
  obligations: {
    overdue: number;
    dueSoon: number;
    awaitingReview: number;
    attention: PanelObligationItem[];
    competence: string;
    notOpened: { id: string; title: string }[];
    readyToSend: { id: string; contractId: string; contractTitle: string; competence: string }[];
  };
}

const ATTENTION_LIMIT = 6;

/** Junta o que pede ação hoje: demandas, cobertura, documentos e obrigações (roadmap §3, painel operacional). */
export const buildOperationalPanel = ({ contracts, demands, peopleDocs, obligations }: PanelSources, today: string = todayIso()): OperationalPanel => {
  const openDemands = demands.filter((demand) => demand.status === 'open');
  const dueStates = new Map(openDemands.map((demand) => [demand.id, getDueState(demand, today)]));
  const attentionDemands = openDemands
    .filter((demand) => ['overdue', 'due_today'].includes(dueStates.get(demand.id)!) || !demand.responsibleId)
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
    .slice(0, ATTENTION_LIMIT);

  const activeContracts = contracts.filter((contract) => contract.status === 'active');
  const uncoveredContracts = activeContracts
    .filter((contract) => contract.uncoveredPositions > 0)
    .sort((a, b) => b.uncoveredPositions - a.uncoveredPositions);

  const checklist = buildChecklist({ ...peopleDocs, today });
  const checklistSummary = summarizeChecklist(checklist);

  const periodById = new Map(obligations.periods.map((period) => [period.id, period]));
  const openItems: PanelObligationItem[] = obligations.items
    .filter((item) => !isItemDone(item) && periodById.get(item.periodId)?.status === 'open')
    .map((item) => {
      const period = periodById.get(item.periodId)!;
      return {
        id: item.id, name: item.name, dueDate: item.dueDate, status: item.status, responsibleName: item.responsibleName,
        contractId: period.contractId, contractTitle: period.contractTitle, competence: period.competence,
        dueState: getItemDueState(item, today),
      };
    });
  const competence = currentWorkingCompetence(today);
  const openedContracts = new Set(obligations.periods.filter((period) => period.competence === competence).map((period) => period.contractId));

  return {
    demands: {
      open: openDemands.length,
      overdue: openDemands.filter((demand) => dueStates.get(demand.id) === 'overdue').length,
      dueToday: openDemands.filter((demand) => dueStates.get(demand.id) === 'due_today').length,
      withoutResponsible: openDemands.filter((demand) => !demand.responsibleId).length,
      attention: attentionDemands,
    },
    coverage: {
      uncoveredPositions: activeContracts.reduce((sum, contract) => sum + contract.uncoveredPositions, 0),
      coveredBySubstitute: activeContracts.reduce((sum, contract) => sum + contract.postsCoveredBySubstitute, 0),
      contracts: uncoveredContracts.slice(0, ATTENTION_LIMIT),
    },
    documents: {
      pending: checklistSummary.pending,
      expired: checklistSummary.expired,
      expiring: checklistSummary.expiring,
      awaitingReview: checklistSummary.awaitingReview,
      attention: checklist.filter((item) => ['expired', 'missing', 'rejected'].includes(item.state)).slice(0, ATTENTION_LIMIT),
    },
    obligations: {
      overdue: openItems.filter((item) => item.dueState === 'overdue').length,
      dueSoon: openItems.filter((item) => item.dueState === 'due_soon').length,
      awaitingReview: openItems.filter((item) => item.status === 'submitted').length,
      attention: openItems
        .filter((item) => item.dueState === 'overdue' || item.dueState === 'due_soon')
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, ATTENTION_LIMIT),
      competence,
      notOpened: activeContracts.filter((contract) => !openedContracts.has(contract.id)).map((contract) => ({ id: contract.id, title: contract.title })),
      readyToSend: obligations.periods
        .filter((period) => period.status === 'ready')
        .map((period) => ({ id: period.id, contractId: period.contractId, contractTitle: period.contractTitle, competence: period.competence })),
    },
  };
};
