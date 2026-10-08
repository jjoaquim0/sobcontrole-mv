import { DueState } from '../demandsDomain';

/** Vermelho para prazo vencido e âmbar para "vence hoje". */
export const dueTextClass: Record<DueState, string> = {
  overdue: 'text-red-600 dark:text-red-400',
  due_today: 'text-amber-700 dark:text-amber-300',
  upcoming: 'text-gray-500 dark:text-gray-400',
  none: 'text-gray-400 dark:text-gray-500',
  finished: 'text-gray-400 dark:text-gray-500',
};
