import { ReportPeriod } from '../../types';

export interface ReportDateRange {
  dateFrom: string;
  dateTo: string;
  previousDateFrom: string;
  previousDateTo: string;
  label: string;
}

const startOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const endOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
};

const startOfMonth = (date: Date) => {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
};

const formatShortDate = (date: Date) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);

const createPreviousRange = (dateFrom: Date, dateTo: Date) => {
  const duration = Math.max(0, dateTo.getTime() - dateFrom.getTime());
  const previousDateTo = new Date(dateFrom.getTime() - 1);
  const previousDateFrom = new Date(previousDateTo.getTime() - duration);
  return { previousDateFrom, previousDateTo };
};

const safeCustomDate = (value: string | undefined, fallback: Date, end = false) => {
  if (!value) return fallback;
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return end ? endOfDay(parsed) : startOfDay(parsed);
};

export const getReportDateRange = (period: ReportPeriod, now = new Date()): ReportDateRange => {
  const dateToDefault = new Date(now);
  let dateFrom: Date;
  let dateTo = dateToDefault;

  switch (period.type) {
    case 'today':
      dateFrom = startOfDay(now);
      break;
    case '7d':
      dateFrom = startOfDay(now);
      dateFrom.setDate(dateFrom.getDate() - 6);
      break;
    case 'current_month':
      dateFrom = startOfMonth(now);
      break;
    case 'previous_month': {
      const currentMonthStart = startOfMonth(now);
      dateTo = new Date(currentMonthStart.getTime() - 1);
      dateFrom = startOfMonth(dateTo);
      break;
    }
    case 'quarter': {
      dateFrom = startOfMonth(now);
      dateFrom.setMonth(Math.floor(now.getMonth() / 3) * 3);
      break;
    }
    case 'year':
      dateFrom = startOfDay(new Date(now.getFullYear(), 0, 1));
      break;
    case 'custom': {
      const fallbackFrom = startOfDay(now);
      fallbackFrom.setDate(fallbackFrom.getDate() - 29);
      dateFrom = safeCustomDate(period.dateFrom, fallbackFrom);
      dateTo = safeCustomDate(period.dateTo, dateToDefault, true);
      if (dateTo > now) dateTo = dateToDefault;
      if (dateFrom > dateTo) {
        const previousFrom = dateFrom;
        dateFrom = startOfDay(dateTo);
        dateTo = endOfDay(previousFrom);
        if (dateTo > now) dateTo = dateToDefault;
      }
      break;
    }
    default:
      dateFrom = startOfMonth(now);
  }

  const { previousDateFrom, previousDateTo } = createPreviousRange(dateFrom, dateTo);

  return {
    dateFrom: dateFrom.toISOString(),
    dateTo: dateTo.toISOString(),
    previousDateFrom: previousDateFrom.toISOString(),
    previousDateTo: previousDateTo.toISOString(),
    label: `${formatShortDate(dateFrom)} – ${formatShortDate(dateTo)}`,
  };
};

export const REPORT_PERIOD_OPTIONS: readonly { type: ReportPeriod['type']; label: string; shortLabel: string }[] = [
  { type: 'today', label: 'Hoje', shortLabel: 'Hoje' },
  { type: '7d', label: 'Últimos 7 dias', shortLabel: '7 dias' },
  { type: 'current_month', label: 'Mês atual', shortLabel: 'Mês atual' },
  { type: 'previous_month', label: 'Mês anterior', shortLabel: 'Mês anterior' },
  { type: 'quarter', label: 'Trimestre', shortLabel: 'Trimestre' },
  { type: 'year', label: 'Ano', shortLabel: 'Ano' },
  { type: 'custom', label: 'Período personalizado', shortLabel: 'Personalizado' },
] as const;
