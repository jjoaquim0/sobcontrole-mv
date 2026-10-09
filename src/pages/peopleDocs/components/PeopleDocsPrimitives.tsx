import { ChecklistState, CHECKLIST_STATE_LABELS, ReplacementState } from '../peopleDocsDomain';

const badgeBase = 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold';
const tone = {
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  gray: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
};

const checklistTone: Record<ChecklistState, keyof typeof tone> = {
  expired: 'red', missing: 'red', rejected: 'red', awaiting_review: 'blue', expiring: 'amber', valid: 'green',
};

export const ChecklistBadge = ({ state }: { state: ChecklistState }) => (
  <span data-state={state} className={`${badgeBase} ${tone[checklistTone[state]]}`}>{CHECKLIST_STATE_LABELS[state]}</span>
);

const replacementLabel: Record<ReplacementState, string> = {
  returned: 'Devolvido', overdue: 'Troca vencida', soon: 'Trocar em breve', ok: 'Em uso', none: 'Em uso',
};
const replacementTone: Record<ReplacementState, keyof typeof tone> = {
  returned: 'gray', overdue: 'red', soon: 'amber', ok: 'green', none: 'green',
};

export const ReplacementBadge = ({ state }: { state: ReplacementState }) => (
  <span data-state={state} className={`${badgeBase} ${tone[replacementTone[state]]}`}>{replacementLabel[state]}</span>
);

export const Badge = ({ color, children }: { color: keyof typeof tone; children: string }) => (
  <span className={`${badgeBase} ${tone[color]}`}>{children}</span>
);
