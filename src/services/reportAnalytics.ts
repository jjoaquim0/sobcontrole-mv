export type ReportTimeGrain = 'day' | 'week' | 'month';

export interface ReportTimeBucket {
  key: string;
  label: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const calculateVariance = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
};

export const isCancelledStatus = (status?: string | null) =>
  status === 'cancelled' || status === 'canceled';

export const isOverdue = (status: string, dueDate: string, reference = new Date()) =>
  status === 'late' || (status === 'pending' && new Date(dueDate).getTime() < reference.getTime());

export const daysSince = (date: string, reference = new Date()) =>
  Math.max(0, Math.floor((reference.getTime() - new Date(date).getTime()) / DAY_MS));

export const resolveTimeGrain = (dateFrom: string, dateTo: string): ReportTimeGrain => {
  const days = Math.max(1, Math.ceil((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / DAY_MS));
  if (days <= 45) return 'day';
  if (days <= 180) return 'week';
  return 'month';
};

const startOfBucket = (date: Date, grain: ReportTimeGrain) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  if (grain === 'week') {
    const day = result.getDay();
    const distanceFromMonday = day === 0 ? 6 : day - 1;
    result.setDate(result.getDate() - distanceFromMonday);
  }
  if (grain === 'month') {
    result.setDate(1);
  }
  return result;
};

const keyFromDate = (date: Date, grain: ReportTimeGrain) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  if (grain === 'month') return `${year}-${month}`;
  return `${year}-${month}-${String(date.getDate()).padStart(2, '0')}`;
};

export const getTimeBucketKey = (date: string, grain: ReportTimeGrain) =>
  keyFromDate(startOfBucket(new Date(date), grain), grain);

const formatBucketLabel = (date: Date, grain: ReportTimeGrain) => {
  if (grain === 'month') {
    return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(date);
  }
  if (grain === 'week') {
    return `Sem. ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date)}`;
  }
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date);
};

export const createTimeBuckets = (dateFrom: string, dateTo: string): { grain: ReportTimeGrain; buckets: ReportTimeBucket[] } => {
  const grain = resolveTimeGrain(dateFrom, dateTo);
  const cursor = startOfBucket(new Date(dateFrom), grain);
  const end = new Date(dateTo);
  const buckets: ReportTimeBucket[] = [];
  const maxBuckets = 400;

  while (cursor <= end && buckets.length < maxBuckets) {
    buckets.push({ key: keyFromDate(cursor, grain), label: formatBucketLabel(cursor, grain) });
    if (grain === 'day') cursor.setDate(cursor.getDate() + 1);
    if (grain === 'week') cursor.setDate(cursor.getDate() + 7);
    if (grain === 'month') cursor.setMonth(cursor.getMonth() + 1);
  }

  return { grain, buckets };
};

export interface AmountEvent {
  occurredAt: string;
  amount: number;
}

export const buildAmountTimeSeries = <TSeries extends Record<string, readonly AmountEvent[]>>(
  dateFrom: string,
  dateTo: string,
  series: TSeries,
): Array<ReportTimeBucket & { [Key in keyof TSeries]: number }> => {
  const { grain, buckets } = createTimeBuckets(dateFrom, dateTo);
  const values = new Map<string, Record<string, string | number>>(
    buckets.map((bucket) => [
      bucket.key,
      { ...bucket, ...Object.fromEntries(Object.keys(series).map((key) => [key, 0])) },
    ])
  );

  Object.entries(series).forEach(([seriesKey, events]) => {
    events.forEach((event) => {
      const bucket = values.get(getTimeBucketKey(event.occurredAt, grain));
      if (bucket) bucket[seriesKey] = Number(bucket[seriesKey] ?? 0) + event.amount;
    });
  });

  return Array.from(values.values()) as Array<
    ReportTimeBucket & { [Key in keyof TSeries]: number }
  >;
};
