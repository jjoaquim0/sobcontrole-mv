import { ObligationItem, ObligationItemStatus, ObligationPeriodStatus, ObligationRecurrence, ObligationTemplate } from '@/types';
import { todayIso } from '@/pages/contracts/contractsDomain';

export { formatDate, isSafeHttpsUrl, todayIso } from '@/pages/contracts/contractsDomain';

/** Janela, em dias, para avisar obrigações que vencem em breve. */
export const OBLIGATION_SOON_DAYS = 7;

export const RECURRENCE_LABELS: Record<ObligationRecurrence, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  yearly: 'Anual',
};

export const PERIOD_STATUS_LABELS: Record<ObligationPeriodStatus, string> = {
  open: 'Em preparação',
  ready: 'Pronta para envio',
  sent: 'Enviada',
};

export const ITEM_STATUS_LABELS: Record<ObligationItemStatus, string> = {
  pending: 'Pendente',
  submitted: 'Aguardando conferência',
  verified: 'Conferido',
  rejected: 'Recusado',
  waived: 'Não se aplica',
};

export const OBLIGATION_EVENT_LABELS: Record<string, string> = {
  template_created: 'Obrigação cadastrada',
  template_updated: 'Obrigação alterada',
  period_created: 'Competência aberta',
  period_open: 'Competência reaberta',
  period_ready: 'Pacote pronto para envio',
  period_sent: 'Pacote enviado',
  period_updated: 'Competência alterada',
  item_created: 'Item incluído',
  item_updated: 'Item alterado',
  item_submitted: 'Evidência registrada',
  item_verified: 'Item conferido',
  item_rejected: 'Item recusado',
  item_waived: 'Item dispensado',
  item_pending: 'Item voltou a pendente',
};

export const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const daysBetween = (fromIso: string, toIso: string) =>
  Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);

/** Competência no formato do banco: primeiro dia do mês. */
export const toCompetence = (isoDate: string) => `${isoDate.slice(0, 7)}-01`;

/** "2026-07-01" → "julho/2026". */
export const formatCompetence = (competence: string) => {
  const [year, month] = competence.split('-').map(Number);
  return `${MONTH_NAMES[month - 1]}/${year}`;
};

/** Mês da competência deslocado (negativo para trás), sempre no dia 1. */
export const shiftCompetence = (competence: string, months: number) => {
  const [year, month] = competence.split('-').map(Number);
  const total = year * 12 + (month - 1) + months;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`;
};

/** Competência que normalmente se prepara agora: o mês anterior ao atual. */
export const currentWorkingCompetence = (today: string = todayIso()) => shiftCompetence(toCompetence(today), -1);

/** Mesma regra do banco: dia do prazo no mês (competência + deslocamento), limitado ao último dia. */
export const computeDueDate = (competence: string, dueDay: number, dueMonthOffset: number) => {
  const month = shiftCompetence(competence, dueMonthOffset);
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month.slice(0, 8)}${String(Math.min(dueDay, lastDay)).padStart(2, '0')}`;
};

/** Mesma regra do banco: em que competências o modelo gera item. */
export const templateApplies = (template: Pick<ObligationTemplate, 'recurrence' | 'referenceMonth'>, competence: string) => {
  const month = Number(competence.slice(5, 7));
  if (template.recurrence === 'monthly') return true;
  if (!template.referenceMonth) return false;
  if (template.recurrence === 'quarterly') return (month - template.referenceMonth + 12) % 3 === 0;
  return month === template.referenceMonth;
};

const OFFSET_LABELS = ['do mês da competência', 'do mês seguinte', 'do segundo mês seguinte'];

export const describeSchedule = (template: Pick<ObligationTemplate, 'recurrence' | 'referenceMonth' | 'dueDay' | 'dueMonthOffset'>) => {
  const due = `até o dia ${template.dueDay} ${OFFSET_LABELS[template.dueMonthOffset] || ''}`.trim();
  if (template.recurrence === 'monthly') return `Mensal, ${due}`;
  const month = template.referenceMonth ? MONTH_NAMES[template.referenceMonth - 1] : '?';
  if (template.recurrence === 'quarterly') return `Trimestral a partir de ${month}, ${due}`;
  return `Anual em ${month}, ${due}`;
};

export type ItemDueState = 'done' | 'overdue' | 'due_soon' | 'ok';

export const isItemDone = (item: Pick<ObligationItem, 'status'>) => item.status === 'verified' || item.status === 'waived';

export const getItemDueState = (item: Pick<ObligationItem, 'status' | 'dueDate'>, today: string = todayIso()): ItemDueState => {
  if (isItemDone(item)) return 'done';
  if (item.dueDate < today) return 'overdue';
  if (daysBetween(today, item.dueDate) <= OBLIGATION_SOON_DAYS) return 'due_soon';
  return 'ok';
};

export const describeItemDue = (item: Pick<ObligationItem, 'status' | 'dueDate'>, today: string = todayIso()) => {
  if (isItemDone(item)) return ITEM_STATUS_LABELS[item.status];
  const days = daysBetween(today, item.dueDate);
  if (days < 0) return `Atrasado há ${-days} dia(s)`;
  if (days === 0) return 'Vence hoje';
  return `Vence em ${days} dia(s)`;
};

export interface PeriodSummary {
  total: number;
  done: number;
  awaitingReview: number;
  open: number;
  overdue: number;
  percent: number;
}

export const summarizeItems = (items: Pick<ObligationItem, 'status' | 'dueDate'>[], today: string = todayIso()): PeriodSummary => {
  const done = items.filter(isItemDone).length;
  return {
    total: items.length,
    done,
    awaitingReview: items.filter((item) => item.status === 'submitted').length,
    open: items.filter((item) => item.status === 'pending' || item.status === 'rejected').length,
    overdue: items.filter((item) => getItemDueState(item, today) === 'overdue').length,
    percent: items.length ? Math.round((done / items.length) * 100) : 0,
  };
};

const ITEM_ORDER: ItemDueState[] = ['overdue', 'due_soon', 'ok', 'done'];

/** Itens da agenda: o que está atrasado ou vence antes aparece primeiro. */
export const sortItemsForAgenda = <T extends Pick<ObligationItem, 'status' | 'dueDate' | 'name'>>(items: T[], today: string = todayIso()) =>
  [...items].sort((a, b) => ITEM_ORDER.indexOf(getItemDueState(a, today)) - ITEM_ORDER.indexOf(getItemDueState(b, today))
    || a.dueDate.localeCompare(b.dueDate)
    || a.name.localeCompare(b.name, 'pt-BR'));
