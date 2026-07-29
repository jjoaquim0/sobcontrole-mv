import { AIServiceError } from '../errors.ts';

export type PeriodPreset = 'current_month' | 'previous_month' | 'last_7_days' | 'custom';

export interface PeriodInput {
  period: PeriodPreset;
  dateFrom: string | null;
  dateTo: string | null;
}

export interface ResolvedPeriod {
  startDate: string;
  endDate: string;
  startIso: string;
  endExclusiveIso: string;
  label: string;
}

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

interface ZonedDateTimeParts extends CalendarDate {
  hour: number;
  minute: number;
  second: number;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const toIsoDate = ({ year, month, day }: CalendarDate): string =>
  `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
    .toString()
    .padStart(2, '0')}`;

const toBrazilianDate = (value: string): string => {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
};

const fromUtcCalendar = (date: Date): CalendarDate => ({
  year: date.getUTCFullYear(),
  month: date.getUTCMonth() + 1,
  day: date.getUTCDate(),
});

const addCalendarDays = (value: CalendarDate, days: number): CalendarDate =>
  fromUtcCalendar(new Date(Date.UTC(value.year, value.month - 1, value.day + days)));

const addCalendarMonths = (value: CalendarDate, months: number): CalendarDate =>
  fromUtcCalendar(new Date(Date.UTC(value.year, value.month - 1 + months, value.day)));

const parseIsoDate = (value: string): CalendarDate => {
  if (!ISO_DATE.test(value)) throw new AIServiceError('invalid_tool_arguments');
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    throw new AIServiceError('invalid_tool_arguments');
  }
  return { year, month, day };
};

const getZonedParts = (date: Date, timezone: string): ZonedDateTimeParts => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
};

const zonedMidnightToUtc = (value: CalendarDate, timezone: string): Date => {
  const targetUtc = Date.UTC(value.year, value.month - 1, value.day);
  let candidate = targetUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = getZonedParts(new Date(candidate), timezone);
    const representedUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const correction = targetUtc - representedUtc;
    candidate += correction;
    if (correction === 0) break;
  }

  return new Date(candidate);
};

const calendarDaysInclusive = (start: CalendarDate, end: CalendarDate): number =>
  Math.floor(
    (Date.UTC(end.year, end.month - 1, end.day) -
      Date.UTC(start.year, start.month - 1, start.day)) /
      86_400_000,
  ) + 1;

export const normalizeTimezone = (value: string | null | undefined): string => {
  const candidate = value?.trim() || 'America/Sao_Paulo';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date(0));
    return candidate;
  } catch {
    return 'America/Sao_Paulo';
  }
};

export interface AgendaWindow {
  referenceIso: string;
  dayStartIso: string;
  dayEndIso: string;
  weekEndIso: string;
  dayLabel: string;
}

/**
 * Limites de "hoje" e "próximos 7 dias" no fuso da empresa.
 *
 * O cálculo fica aqui, e não no SQL, para reaproveitar a mesma conversão de
 * meia-noite local já testada pelos períodos de vendas.
 */
export const resolveAgendaWindow = (timezone: string, now = new Date()): AgendaWindow => {
  const zone = normalizeTimezone(timezone);
  const current = getZonedParts(now, zone);
  const today: CalendarDate = {
    year: current.year,
    month: current.month,
    day: current.day,
  };
  const dayStart = zonedMidnightToUtc(today, zone);
  const dayEnd = zonedMidnightToUtc(addCalendarDays(today, 1), zone);
  const weekEnd = zonedMidnightToUtc(addCalendarDays(today, 7), zone);

  return {
    referenceIso: now.toISOString(),
    dayStartIso: dayStart.toISOString(),
    dayEndIso: dayEnd.toISOString(),
    weekEndIso: weekEnd.toISOString(),
    dayLabel: toBrazilianDate(toIsoDate(today)),
  };
};

export const resolvePeriod = (
  input: PeriodInput,
  timezone: string,
  maxCustomPeriodDays: number,
  now = new Date(),
): ResolvedPeriod => {
  const current = getZonedParts(now, normalizeTimezone(timezone));
  let start: CalendarDate;
  let end: CalendarDate;

  switch (input.period) {
    case 'current_month':
      start = { year: current.year, month: current.month, day: 1 };
      end = { year: current.year, month: current.month, day: current.day };
      break;
    case 'previous_month': {
      const currentMonthStart = { year: current.year, month: current.month, day: 1 };
      start = addCalendarMonths(currentMonthStart, -1);
      end = addCalendarDays(currentMonthStart, -1);
      break;
    }
    case 'last_7_days':
      end = { year: current.year, month: current.month, day: current.day };
      start = addCalendarDays(end, -6);
      break;
    case 'custom':
      if (!input.dateFrom || !input.dateTo) {
        throw new AIServiceError('invalid_tool_arguments');
      }
      start = parseIsoDate(input.dateFrom);
      end = parseIsoDate(input.dateTo);
      if (
        calendarDaysInclusive(start, end) < 1 ||
        calendarDaysInclusive(start, end) > maxCustomPeriodDays
      ) {
        throw new AIServiceError('invalid_tool_arguments');
      }
      break;
    default:
      throw new AIServiceError('invalid_tool_arguments');
  }

  if (input.period !== 'custom' && (input.dateFrom !== null || input.dateTo !== null)) {
    throw new AIServiceError('invalid_tool_arguments');
  }

  const startDate = toIsoDate(start);
  const endDate = toIsoDate(end);
  const startIso = zonedMidnightToUtc(start, timezone).toISOString();
  const endExclusiveIso = zonedMidnightToUtc(addCalendarDays(end, 1), timezone).toISOString();

  return {
    startDate,
    endDate,
    startIso,
    endExclusiveIso,
    label: `${toBrazilianDate(startDate)} a ${toBrazilianDate(endDate)}`,
  };
};
