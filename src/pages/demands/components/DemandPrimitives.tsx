import { AlertCircle, CalendarClock } from 'lucide-react';
import { DemandPriority, DemandStatus, ServiceDemand } from '@/types';
import { DEMAND_STATUS_LABELS, describeDue, DueState, getDueState, PRIORITY_LABELS } from '../demandsDomain';

export { FieldError, FormModal, SectionTitle } from '@/pages/contracts/components/ContractPrimitives';

const badgeBase = 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold';
const tone = {
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  gray: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
};

const priorityTone: Record<DemandPriority, keyof typeof tone> = { low: 'gray', normal: 'blue', high: 'amber', urgent: 'red' };

export const PriorityBadge = ({ priority }: { priority: DemandPriority }) => (
  <span className={`${badgeBase} ${tone[priorityTone[priority]]}`}>{PRIORITY_LABELS[priority]}</span>
);

const statusTone: Record<DemandStatus, keyof typeof tone> = { open: 'blue', closed: 'green', canceled: 'gray' };

export const DemandStatusBadge = ({ status }: { status: DemandStatus }) => (
  <span className={`${badgeBase} ${tone[statusTone[status]]}`}>{DEMAND_STATUS_LABELS[status]}</span>
);

const dueTone: Record<DueState, keyof typeof tone> = { overdue: 'red', due_today: 'amber', upcoming: 'gray', none: 'gray', finished: 'gray' };

export const DueBadge = ({ demand, today }: { demand: Pick<ServiceDemand, 'dueDate' | 'status'>; today?: string }) => {
  const state = getDueState(demand, today);
  const Icon = state === 'overdue' || state === 'due_today' ? AlertCircle : CalendarClock;
  return (
    <span data-due-state={state} className={`${badgeBase} ${tone[dueTone[state]]}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />{describeDue(demand, today)}
    </span>
  );
};
