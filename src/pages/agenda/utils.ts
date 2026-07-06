import { AppointmentStatus, AppointmentType } from '../../types';

export const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  reuniao: 'Reunião',
  tarefa: 'Tarefa',
  ligacao: 'Ligação',
  visita: 'Visita',
  lembrete: 'Lembrete',
};

export const APPOINTMENT_TYPE_COLORS: Record<AppointmentType, { bg: string; text: string; dot: string }> = {
  reuniao: { bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
  tarefa: { bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-700 dark:text-purple-400', dot: 'bg-purple-500' },
  ligacao: { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  visita: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  lembrete: { bg: 'bg-rose-50 dark:bg-rose-500/10', text: 'text-rose-700 dark:text-rose-400', dot: 'bg-rose-500' },
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  nao_compareceu: 'Não Compareceu',
  pendente: 'Pendente',
};

export const isSameLocalDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const startOfLocalDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const addDays = (date: Date, amount: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
};

export const startOfWeek = (date: Date): Date => {
  const d = startOfLocalDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
};

export const getMonthGridDays = (anchor: Date): Date[] => {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = addDays(firstOfMonth, -firstOfMonth.getDay());
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
};

export const toDateInputValue = (isoOrDate: string | Date): string => {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const toTimeInputValue = (iso: string): string => {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mi}`;
};

export const combineDateTime = (date: string, time: string): string => {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mi] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mi, 0, 0).toISOString();
};

export const formatMonthLabel = (date: Date): string =>
  date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

export const formatWeekLabel = (weekStart: Date): string => {
  const weekEnd = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const startLabel = weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: sameMonth ? undefined : '2-digit' });
  const endLabel = weekEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${startLabel} – ${endLabel}`;
};

export const formatDayLabel = (date: Date): string =>
  date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

export const formatTimeRange = (startAt: string, endAt: string, allDay: boolean): string => {
  if (allDay) return 'Dia inteiro';
  return `${toTimeInputValue(startAt)} – ${toTimeInputValue(endAt)}`;
};
