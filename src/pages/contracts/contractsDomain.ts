import {
  ContractValidationStatus,
  ContractVersionKind,
  PostAllocation,
  PostAllocationRole,
  ServiceContract,
  ServiceContractStatus,
  ServicePost,
  ServicePostStatus,
} from '@/types';

export { formatDate } from '@/pages/people/peopleDomain';

/** Janela, em dias, para sinalizar contratos próximos do fim da vigência. */
export const EXPIRING_SOON_DAYS = 60;

export const CONTRACT_STATUS_LABELS: Record<ServiceContractStatus, string> = {
  draft: 'Rascunho',
  active: 'Ativo',
  suspended: 'Suspenso',
  closed: 'Encerrado',
};

export const VALIDATION_STATUS_LABELS: Record<ContractValidationStatus, string> = {
  pending: 'Vigência a confirmar',
  confirmed: 'Vigência conferida',
  historical: 'Referência histórica',
};

export const VERSION_KIND_LABELS: Record<ContractVersionKind, string> = {
  original: 'Instrumento original',
  amendment: 'Aditivo',
};

export const POST_STATUS_LABELS: Record<ServicePostStatus, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
};

export const ALLOCATION_ROLE_LABELS: Record<PostAllocationRole, string> = {
  holder: 'Titular',
  substitute: 'Substituto / cobertura',
};

export const CONTRACT_AUDIT_EVENT_LABELS: Record<string, string> = {
  contract_created: 'Contrato cadastrado',
  contract_updated: 'Dados do contrato alterados',
  contract_status_changed: 'Status do contrato alterado',
  contract_validation_changed: 'Situação de validação alterada',
  contract_removed: 'Contrato removido',
  contract_version_created: 'Versão/aditivo registrado',
  contract_version_updated: 'Versão/aditivo alterado',
  contract_version_validation_changed: 'Conferência da versão alterada',
  post_created: 'Posto cadastrado',
  post_updated: 'Posto alterado',
  post_status_changed: 'Status do posto alterado',
  allocation_created: 'Funcionário alocado',
  allocation_updated: 'Alocação alterada',
  allocation_ended: 'Alocação encerrada',
};

export const CONTRACT_FIELD_LABELS: Record<string, string> = {
  customer_id: 'cliente vinculado',
  client_name: 'cliente',
  title: 'título',
  contract_number: 'número',
  location: 'local',
  scope_summary: 'escopo',
  start_date: 'início',
  end_date: 'fim',
  cct_reference: 'convenção coletiva',
  source_documents_url: 'link dos documentos',
  validation_status: 'validação',
  status: 'status',
  internal_notes: 'observações',
  kind: 'tipo',
  signed_at: 'assinatura',
  effective_start: 'início da vigência',
  effective_end: 'fim da vigência',
  document_url: 'link do documento',
  change_summary: 'resumo da alteração',
  name: 'nome',
  job_function: 'função',
  work_schedule: 'escala',
  required_headcount: 'quantitativo',
  operational_manager_id: 'responsável operacional',
  requirements: 'requisitos',
  end_reason: 'motivo do encerramento',
  notes: 'observações',
  deleted_at: 'remoção',
};

/** Data local de hoje no formato ISO (AAAA-MM-DD), sem deslocamento de fuso. */
export const todayIso = (now: Date = new Date()) => {
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

const daysBetween = (fromIso: string, toIso: string) =>
  Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);

export type ContractValidity =
  | { kind: 'unconfirmed' }
  | { kind: 'historical' }
  | { kind: 'no_period' }
  | { kind: 'not_started'; daysUntilStart: number }
  | { kind: 'in_force'; daysUntilEnd?: number }
  | { kind: 'expiring'; daysUntilEnd: number }
  | { kind: 'expired'; daysSinceEnd: number };

/**
 * Situação da vigência para exibição. Um contrato com validação pendente nunca
 * é tratado como vigente, mesmo que as datas informadas cubram o dia de hoje.
 */
export const getContractValidity = (
  contract: Pick<ServiceContract, 'startDate' | 'endDate' | 'validationStatus'>,
  today: string = todayIso(),
): ContractValidity => {
  if (contract.validationStatus === 'pending') return { kind: 'unconfirmed' };
  if (contract.validationStatus === 'historical') return { kind: 'historical' };
  if (!contract.startDate && !contract.endDate) return { kind: 'no_period' };
  if (contract.startDate && contract.startDate > today) {
    return { kind: 'not_started', daysUntilStart: daysBetween(today, contract.startDate) };
  }
  if (!contract.endDate) return { kind: 'in_force' };
  const daysUntilEnd = daysBetween(today, contract.endDate);
  if (daysUntilEnd < 0) return { kind: 'expired', daysSinceEnd: -daysUntilEnd };
  if (daysUntilEnd <= EXPIRING_SOON_DAYS) return { kind: 'expiring', daysUntilEnd };
  return { kind: 'in_force', daysUntilEnd };
};

export const describeValidity = (validity: ContractValidity): string => {
  switch (validity.kind) {
    case 'unconfirmed': return 'Vigência a confirmar';
    case 'historical': return 'Referência histórica';
    case 'no_period': return 'Período não informado';
    case 'not_started': return `Inicia em ${validity.daysUntilStart} dia(s)`;
    case 'in_force': return 'Vigente';
    case 'expiring': return validity.daysUntilEnd === 0 ? 'Vence hoje' : `Vence em ${validity.daysUntilEnd} dia(s)`;
    case 'expired': return `Vencido há ${validity.daysSinceEnd} dia(s)`;
  }
};

/** Alocação vigente no dia: já começou e não terminou antes de hoje. */
export const isAllocationActive = (allocation: Pick<PostAllocation, 'startDate' | 'endDate'>, today: string = todayIso()) =>
  allocation.startDate <= today && (!allocation.endDate || allocation.endDate >= today);

export interface PostCoverage {
  required: number;
  holders: number;
  substitutes: number;
  /** Vagas de titular sem ninguém (titular ou substituto) cobrindo. */
  uncovered: number;
  state: 'covered' | 'covered_by_substitute' | 'uncovered' | 'inactive';
}

/**
 * Cobertura do posto no dia. Substitutos cobrem vagas de titular em aberto
 * (férias, ausência), mas o posto continua sinalizado como "coberto por
 * substituto" para que a reposição definitiva seja acompanhada.
 */
export const getPostCoverage = (
  post: Pick<ServicePost, 'id' | 'requiredHeadcount' | 'status'>,
  allocations: Pick<PostAllocation, 'postId' | 'allocationRole' | 'startDate' | 'endDate'>[],
  today: string = todayIso(),
): PostCoverage => {
  const active = allocations.filter((allocation) => allocation.postId === post.id && isAllocationActive(allocation, today));
  const holders = active.filter((allocation) => allocation.allocationRole === 'holder').length;
  const substitutes = active.length - holders;
  const required = post.requiredHeadcount;
  if (post.status === 'inactive') return { required, holders, substitutes, uncovered: 0, state: 'inactive' };
  const holderGap = Math.max(0, required - holders);
  const uncovered = Math.max(0, holderGap - substitutes);
  const state = uncovered > 0 ? 'uncovered' : holderGap > 0 ? 'covered_by_substitute' : 'covered';
  return { required, holders, substitutes, uncovered, state };
};

/** Aceita somente links https para não renderizar esquemas perigosos em href. */
export const isSafeHttpsUrl = (value?: string) => {
  if (!value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};
