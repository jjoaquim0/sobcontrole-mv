import {
  AbsenceKind,
  DocumentRecord,
  DocumentRecordStatus,
  DocumentRequirement,
  DocumentTarget,
  EmployeeAbsence,
  EquipmentCategory,
  EquipmentDelivery,
} from '@/types';
import { todayIso } from '@/pages/contracts/contractsDomain';

export { formatDate, isSafeHttpsUrl, todayIso } from '@/pages/contracts/contractsDomain';

/** Janela, em dias, para avisar documentos e trocas de EPI que vencem em breve. */
export const EXPIRING_DOCUMENT_DAYS = 30;

export const DOCUMENT_TARGET_LABELS: Record<DocumentTarget, string> = {
  employee: 'Funcionário alocado',
  contract: 'Contrato',
};

export const DOCUMENT_RECORD_STATUS_LABELS: Record<DocumentRecordStatus, string> = {
  submitted: 'Aguardando conferência',
  verified: 'Conferido',
  rejected: 'Recusado',
};

export const ABSENCE_KIND_LABELS: Record<AbsenceKind, string> = {
  vacation: 'Férias',
  medical_leave: 'Afastamento médico',
  leave: 'Licença',
  other: 'Outra ausência',
};

export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  uniform: 'Uniforme',
  ppe: 'EPI',
};

export const PEOPLE_EVENT_LABELS: Record<string, string> = {
  requirement_created: 'Documento incluído no checklist',
  requirement_updated: 'Documento do checklist alterado',
  document_submitted: 'Documento entregue',
  document_verified: 'Documento conferido',
  document_rejected: 'Documento recusado',
  document_updated: 'Documento alterado',
  absence_registered: 'Férias/afastamento registrado',
  absence_canceled: 'Férias/afastamento cancelado',
  absence_updated: 'Férias/afastamento alterado',
  equipment_delivered: 'Uniforme/EPI entregue',
  equipment_returned: 'Uniforme/EPI devolvido',
  equipment_updated: 'Entrega de uniforme/EPI alterada',
};

const daysBetween = (fromIso: string, toIso: string) =>
  Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);

export type ChecklistState = 'expired' | 'missing' | 'rejected' | 'awaiting_review' | 'expiring' | 'valid';

export const CHECKLIST_STATE_LABELS: Record<ChecklistState, string> = {
  expired: 'Vencido',
  missing: 'Não entregue',
  rejected: 'Recusado',
  awaiting_review: 'Aguardando conferência',
  expiring: 'Vence em breve',
  valid: 'Em dia',
};

/** Ordem de atenção: o que impede a operação vem primeiro. */
const STATE_ORDER: ChecklistState[] = ['expired', 'missing', 'rejected', 'awaiting_review', 'expiring', 'valid'];

/**
 * Situação de um item do checklist pelo registro mais recente. Um documento
 * vencido continua vencido mesmo que ainda não tenha sido conferido.
 */
export const getChecklistState = (
  record: Pick<DocumentRecord, 'status' | 'expiresOn'> | undefined,
  today: string = todayIso(),
): ChecklistState => {
  if (!record) return 'missing';
  if (record.status === 'rejected') return 'rejected';
  if (record.expiresOn && record.expiresOn < today) return 'expired';
  if (record.status === 'submitted') return 'awaiting_review';
  if (record.expiresOn && daysBetween(today, record.expiresOn) <= EXPIRING_DOCUMENT_DAYS) return 'expiring';
  return 'valid';
};

export const describeExpiry = (expiresOn: string | undefined, today: string = todayIso()) => {
  if (!expiresOn) return 'Sem validade';
  const days = daysBetween(today, expiresOn);
  if (days < 0) return `Venceu há ${-days} dia(s)`;
  if (days === 0) return 'Vence hoje';
  return `Vence em ${days} dia(s)`;
};

export interface ChecklistContract { id: string; title: string; status: string }
export interface ChecklistPost { id: string; contractId: string; name: string }
export interface ChecklistAllocation { employeeId: string; postId: string; startDate: string; endDate?: string }
export interface ChecklistEmployee { id: string; fullName: string; status: string }

export interface ChecklistItem {
  key: string;
  requirement: DocumentRequirement;
  target: DocumentTarget;
  employeeId?: string;
  contractId?: string;
  targetName: string;
  /** Contratos a que o item se refere, para filtrar a lista. */
  contractIds: string[];
  /** Contratos/postos em que o funcionário está alocado, para contexto na lista. */
  context?: string;
  record?: DocumentRecord;
  state: ChecklistState;
}

const latestRecords = (records: DocumentRecord[]) => {
  const map = new Map<string, DocumentRecord>();
  records.forEach((record) => {
    const key = `${record.requirementId}:${record.employeeId || record.contractId}`;
    const current = map.get(key);
    if (!current || record.createdAt > current.createdAt) map.set(key, record);
  });
  return map;
};

/**
 * Monta o checklist do dia: cada documento ativo vezes cada alvo em que ele é
 * exigido. Funcionários entram enquanto têm alocação não encerrada (inclusive
 * a que começa em breve, para o documento chegar antes do primeiro dia).
 */
export const buildChecklist = ({
  requirements, records, contracts, posts, allocations, employees, today = todayIso(),
}: {
  requirements: DocumentRequirement[];
  records: DocumentRecord[];
  contracts: ChecklistContract[];
  posts: ChecklistPost[];
  allocations: ChecklistAllocation[];
  employees: ChecklistEmployee[];
  today?: string;
}): ChecklistItem[] => {
  const latest = latestRecords(records);
  const postById = new Map(posts.map((post) => [post.id, post]));
  const contractById = new Map(contracts.map((contract) => [contract.id, contract]));
  const employeeById = new Map(employees.filter((employee) => employee.status !== 'terminated').map((employee) => [employee.id, employee]));
  const openAllocations = allocations.filter((allocation) => !allocation.endDate || allocation.endDate >= today);
  const items: ChecklistItem[] = [];

  requirements.filter((requirement) => requirement.isActive).forEach((requirement) => {
    if (requirement.target === 'contract') {
      contracts
        .filter((contract) => contract.status === 'active' && (!requirement.contractId || contract.id === requirement.contractId))
        .forEach((contract) => {
          const record = latest.get(`${requirement.id}:${contract.id}`);
          items.push({
            key: `${requirement.id}:${contract.id}`, requirement, target: 'contract', contractId: contract.id,
            targetName: contract.title, contractIds: [contract.id], record, state: getChecklistState(record, today),
          });
        });
      return;
    }

    const contextByEmployee = new Map<string, Set<string>>();
    const contractsByEmployee = new Map<string, Set<string>>();
    openAllocations.forEach((allocation) => {
      const post = postById.get(allocation.postId);
      if (!post || !employeeById.has(allocation.employeeId)) return;
      if (requirement.contractId && post.contractId !== requirement.contractId) return;
      if (requirement.postId && post.id !== requirement.postId) return;
      const contract = contractById.get(post.contractId);
      const labels = contextByEmployee.get(allocation.employeeId) || new Set<string>();
      labels.add(contract ? `${contract.title} · ${post.name}` : post.name);
      contextByEmployee.set(allocation.employeeId, labels);
      const contractIds = contractsByEmployee.get(allocation.employeeId) || new Set<string>();
      contractIds.add(post.contractId);
      contractsByEmployee.set(allocation.employeeId, contractIds);
    });
    contextByEmployee.forEach((labels, employeeId) => {
      const record = latest.get(`${requirement.id}:${employeeId}`);
      items.push({
        key: `${requirement.id}:${employeeId}`, requirement, target: 'employee', employeeId,
        targetName: employeeById.get(employeeId)!.fullName, contractIds: [...(contractsByEmployee.get(employeeId) || [])],
        context: [...labels].join(' | '),
        record, state: getChecklistState(record, today),
      });
    });
  });

  return items.sort((a, b) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state)
    || a.targetName.localeCompare(b.targetName, 'pt-BR')
    || a.requirement.name.localeCompare(b.requirement.name, 'pt-BR'));
};

export const summarizeChecklist = (items: ChecklistItem[]) => {
  const count = (state: ChecklistState) => items.filter((item) => item.state === state).length;
  return {
    pending: count('missing') + count('rejected'),
    awaitingReview: count('awaiting_review'),
    expired: count('expired'),
    expiring: count('expiring'),
    valid: count('valid'),
  };
};

/** Validade sugerida no formulário: emissão + meses, menos um dia (mesma regra do banco). */
export const suggestExpiry = (issuedOn: string | undefined, validityMonths: number | undefined) => {
  if (!issuedOn || !validityMonths) return undefined;
  const [year, month, day] = issuedOn.split('-').map(Number);
  const totalMonths = month - 1 + validityMonths;
  const targetYear = year + Math.floor(totalMonths / 12);
  const targetMonth = totalMonths % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const date = new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay)));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

export type AbsenceState = 'current' | 'upcoming' | 'finished' | 'canceled';

export const getAbsenceState = (absence: Pick<EmployeeAbsence, 'startDate' | 'endDate' | 'canceledAt'>, today: string = todayIso()): AbsenceState => {
  if (absence.canceledAt) return 'canceled';
  if (absence.startDate > today) return 'upcoming';
  if (absence.endDate < today) return 'finished';
  return 'current';
};

/** Funcionários fora do posto no dia por férias ou afastamento não cancelado. */
export const getAbsentEmployeeIds = (absences: Pick<EmployeeAbsence, 'employeeId' | 'startDate' | 'endDate' | 'canceledAt'>[], today: string = todayIso()) =>
  new Set(absences.filter((absence) => getAbsenceState(absence, today) === 'current').map((absence) => absence.employeeId));

export type ReplacementState = 'returned' | 'overdue' | 'soon' | 'ok' | 'none';

export const getReplacementState = (delivery: Pick<EquipmentDelivery, 'replaceBy' | 'returnedOn'>, today: string = todayIso()): ReplacementState => {
  if (delivery.returnedOn) return 'returned';
  if (!delivery.replaceBy) return 'none';
  if (delivery.replaceBy < today) return 'overdue';
  if (daysBetween(today, delivery.replaceBy) <= EXPIRING_DOCUMENT_DAYS) return 'soon';
  return 'ok';
};
