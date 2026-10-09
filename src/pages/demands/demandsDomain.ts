import { DemandPriority, DemandStage, DemandStageCategory, DemandStatus, ServiceDemand } from '@/types';
import { todayIso } from '@/pages/contracts/contractsDomain';
import { formatDate } from '@/pages/people/peopleDomain';

export { formatDate };
export { isSafeHttpsUrl, todayIso } from '@/pages/contracts/contractsDomain';

/** Nome do tipo padrão usado pelo atalho "Abrir demanda de reposição". */
export const REPLACEMENT_TYPE_NAME = 'Reposição de posto';

export const PRIORITY_LABELS: Record<DemandPriority, string> = {
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

export const DEMAND_STATUS_LABELS: Record<DemandStatus, string> = {
  open: 'Em andamento',
  closed: 'Encerrada',
  canceled: 'Cancelada',
};

export const STAGE_CATEGORY_LABELS: Record<DemandStageCategory, string> = {
  intake: 'Abertura',
  triage: 'Triagem',
  execution: 'Execução',
  review: 'Conferência',
  done: 'Encerramento',
};

export const DEMAND_EVENT_LABELS: Record<string, string> = {
  demand_created: 'Demanda aberta',
  demand_updated: 'Dados da demanda alterados',
  demand_assigned: 'Responsável ou aprovador alterado',
  stage_changed: 'Etapa alterada',
  demand_closed: 'Conferida e encerrada',
  demand_canceled: 'Demanda cancelada',
  comment_added: 'Comentário adicionado',
  evidence_added: 'Evidência anexada',
};

export const DEMAND_FIELD_LABELS: Record<string, string> = {
  title: 'título',
  description: 'descrição',
  priority: 'prioridade',
  due_date: 'prazo',
  responsible_id: 'responsável',
  approver_id: 'aprovador',
  stage_id: 'etapa',
  status: 'situação',
  cancel_reason: 'motivo do cancelamento',
};

const PRIORITY_WEIGHT: Record<DemandPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export type DueState = 'none' | 'overdue' | 'due_today' | 'upcoming' | 'finished';

/** Prazo vencido fica vermelho e "vence hoje" fica âmbar; demanda encerrada não é cobrada. */
export const getDueState = (
  demand: Pick<ServiceDemand, 'dueDate' | 'status'>,
  today: string = todayIso(),
): DueState => {
  if (demand.status !== 'open') return 'finished';
  if (!demand.dueDate) return 'none';
  if (demand.dueDate < today) return 'overdue';
  if (demand.dueDate === today) return 'due_today';
  return 'upcoming';
};

const daysBetween = (fromIso: string, toIso: string) =>
  Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);

export const describeDue = (demand: Pick<ServiceDemand, 'dueDate' | 'status'>, today: string = todayIso()) => {
  const state = getDueState(demand, today);
  if (state === 'none' || !demand.dueDate) return 'Sem prazo';
  if (state === 'overdue') return `Atrasada há ${daysBetween(demand.dueDate, today)} dia(s)`;
  if (state === 'due_today') return 'Vence hoje';
  if (state === 'finished') return `Prazo: ${formatDate(demand.dueDate)}`;
  return `Vence em ${daysBetween(today, demand.dueDate)} dia(s)`;
};

/** Ordem dentro da coluna: atrasadas, vencendo hoje, prioridade e prazo. */
export const sortDemandsForBoard = <T extends Pick<ServiceDemand, 'dueDate' | 'status' | 'priority' | 'demandNumber'>>(
  demands: T[],
  today: string = todayIso(),
) => {
  const dueWeight = (demand: T) => ({ overdue: 0, due_today: 1, upcoming: 2, none: 3, finished: 4 })[getDueState(demand, today)];
  return [...demands].sort((a, b) =>
    dueWeight(a) - dueWeight(b)
    || PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]
    || (a.dueDate || '9999').localeCompare(b.dueDate || '9999')
    || a.demandNumber - b.demandNumber);
};

export const activeStages = (stages: DemandStage[]) =>
  stages.filter((stage) => stage.isActive).sort((a, b) => a.position - b.position);

export type TransitionCheck =
  | { allowed: true; direction: 'forward' | 'back'; requiresNote: boolean; closes: boolean }
  | { allowed: false; reason: string };

/**
 * Espelha as regras de move_service_demand para orientar o usuário antes de
 * chamar o banco, que continua sendo quem decide.
 */
export const checkTransition = (
  demand: Pick<ServiceDemand, 'stageId' | 'status' | 'responsibleId' | 'approverId'>,
  stages: DemandStage[],
  toStageId: string,
  actorId?: string,
): TransitionCheck => {
  if (demand.status !== 'open') return { allowed: false, reason: 'Demanda encerrada ou cancelada não muda de etapa.' };
  const ordered = activeStages(stages);
  const from = stages.find((stage) => stage.id === demand.stageId);
  const to = ordered.find((stage) => stage.id === toStageId);
  if (!from || !to) return { allowed: false, reason: 'Etapa não encontrada para este tipo de demanda.' };
  if (from.id === to.id) return { allowed: false, reason: 'A demanda já está nesta etapa.' };

  if (to.position < from.position) return { allowed: true, direction: 'back', requiresNote: true, closes: false };

  const next = ordered.find((stage) => stage.position > from.position);
  if (next && next.id !== to.id) return { allowed: false, reason: `Avance uma etapa por vez. A próxima etapa é "${next.name}".` };
  if (['execution', 'review', 'done'].includes(to.category) && !demand.responsibleId) {
    return { allowed: false, reason: `Defina o responsável antes de avançar para "${to.name}".` };
  }
  if ((to.category === 'review' || to.category === 'done') && !demand.approverId) {
    return { allowed: false, reason: 'Defina o aprovador antes de enviar a demanda para conferência.' };
  }
  if (to.category === 'done' && (from.category !== 'review' || !actorId || actorId !== demand.approverId)) {
    return { allowed: false, reason: 'Somente o aprovador definido pode concluir a conferência e encerrar a demanda.' };
  }
  return { allowed: true, direction: 'forward', requiresNote: false, closes: to.category === 'done' };
};

/** Próxima etapa ativa, usada no botão "Avançar" do detalhe. */
export const getNextStage = (stages: DemandStage[], currentStageId: string) => {
  const ordered = activeStages(stages);
  const current = stages.find((stage) => stage.id === currentStageId);
  return current ? ordered.find((stage) => stage.position > current.position) : undefined;
};

export const getPreviousStages = (stages: DemandStage[], currentStageId: string) => {
  const current = stages.find((stage) => stage.id === currentStageId);
  return current ? activeStages(stages).filter((stage) => stage.position < current.position) : [];
};
