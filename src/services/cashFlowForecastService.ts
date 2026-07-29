import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export type ForecastGranularity = 'day' | 'week' | 'month';
export type ForecastFlowType = 'in' | 'out';
// 'pago'/'recebido' existem no tipo para documentar o vocabulário completo do
// domínio, mas o cálculo atual nunca os atribui: um lançamento já liquidado
// (status 'paid') deixa de ser previsão e passa a compor apenas o saldo atual
// (currentBalance), nunca aparecendo como entrada de um bucket futuro — ver
// regra "nunca duplicar valor entre realizado e previsto" na story 1.15.
export type ForecastEntryStatus = 'previsto' | 'vencido' | 'pago' | 'recebido';
export type ForecastBucketStatus = 'healthy' | 'attention' | 'negative';
export type ForecastAlertType =
  | 'negative_balance'
  | 'overdue_receivables'
  | 'overdue_payables'
  | 'payment_concentration'
  | 'upcoming_receivable';
export type ForecastAlertSeverity = 'critical' | 'warning' | 'info';

const MAX_FORECAST_DAYS = 730;
/** Concentração de pagamentos: dia isolado cujas saídas atingem este % do total do período. */
const CONCENTRATION_THRESHOLD_RATIO = 0.3;
/** Recebimento relevante: lançamento cujo valor atinge este % do total previsto de entradas. */
const RELEVANT_RECEIVABLE_RATIO = 0.2;
const UPCOMING_RECEIVABLE_WINDOW_DAYS = 7;
const MAX_ALERTS_PER_TYPE = 3;

export interface ForecastRawEntry {
  id: string;
  amount: number;
  dueDate: string;
  description: string;
  relatedName?: string;
}

export interface ForecastEntry {
  id: string;
  type: ForecastFlowType;
  amount: number;
  dueDate: string;
  description: string;
  relatedName?: string;
  status: ForecastEntryStatus;
}

export interface ForecastBucket {
  key: string;
  label: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  inflows: number;
  outflows: number;
  closingBalance: number;
  status: ForecastBucketStatus;
  entries: ForecastEntry[];
}

export interface ForecastAlert {
  id: string;
  type: ForecastAlertType;
  severity: ForecastAlertSeverity;
  title: string;
  description: string;
  bucketKey?: string;
  amount?: number;
}

export interface CashFlowForecastResult {
  scenario: 'base';
  startDate: string;
  endDate: string;
  granularity: ForecastGranularity;
  currentBalance: number;
  totalInflows: number;
  totalOutflows: number;
  projectedEndBalance: number;
  lowestBalance: { amount: number; date: string };
  negativeDate: string | null;
  overdueReceivablesTotal: number;
  overduePayablesTotal: number;
  buckets: ForecastBucket[];
  alerts: ForecastAlert[];
}

interface OpenReceivableRow {
  id: string;
  amount: number | string | null;
  due_date: string;
  description: string | null;
  customers?: { full_name?: string } | null;
}

interface OpenPayableRow {
  id: string;
  amount: number | string | null;
  due_date: string;
  description: string | null;
  suppliers?: { name?: string } | null;
}

export interface CalculateForecastInput {
  currentBalance: number;
  openReceivables: ForecastRawEntry[];
  openPayables: ForecastRawEntry[];
  startDate: Date;
  endDate: Date;
  /** Instante usado para decidir o que já está vencido; injetável para testes. Default: `new Date()`. */
  now?: Date;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

const startOfLocalDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const dateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const diffInDays = (a: Date, b: Date): number => Math.round((a.getTime() - b.getTime()) / 86_400_000);

const formatDayLabel = (date: Date): string =>
  date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

const formatMonthLabel = (date: Date): string => {
  const raw = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

/** Mesma regra usada em getFinancialSummary (dashboardservice.ts) e getFinancialReport (reportService.ts). */
const isOverdue = (dueDateIso: string, nowIso: string): boolean => dueDateIso < nowIso;

export const deriveGranularity = (totalDays: number): ForecastGranularity => {
  if (totalDays <= 30) return 'day';
  if (totalDays <= 90) return 'week';
  return 'month';
};

const classifyEntry = (
  raw: ForecastRawEntry,
  type: ForecastFlowType,
  startKey: string,
  nowIso: string,
): { bucketKey: string; entry: ForecastEntry } => {
  const due = new Date(raw.dueDate);
  const naturalKey = dateKey(due);
  const overdue = isOverdue(raw.dueDate, nowIso);
  const bucketKey = naturalKey < startKey ? startKey : naturalKey;
  const status: ForecastEntryStatus = overdue ? 'vencido' : 'previsto';

  return {
    bucketKey,
    entry: {
      id: raw.id,
      type,
      amount: raw.amount,
      dueDate: raw.dueDate,
      description: raw.description,
      relatedName: raw.relatedName,
      status,
    },
  };
};

const aggregateBuckets = (
  daily: ForecastBucket[],
  granularity: ForecastGranularity,
): ForecastBucket[] => {
  if (granularity === 'day' || daily.length === 0) return daily;

  const groups: ForecastBucket[][] = [];
  if (granularity === 'week') {
    for (let i = 0; i < daily.length; i += 7) {
      groups.push(daily.slice(i, i + 7));
    }
  } else {
    let currentGroup: ForecastBucket[] = [];
    let currentMonthKey = '';
    daily.forEach((bucket) => {
      const monthKey = bucket.key.slice(0, 7);
      if (monthKey !== currentMonthKey && currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
      }
      currentMonthKey = monthKey;
      currentGroup.push(bucket);
    });
    if (currentGroup.length > 0) groups.push(currentGroup);
  }

  return groups.map((group) => {
    const first = group[0];
    const last = group[group.length - 1];
    const inflows = group.reduce((sum, b) => sum + b.inflows, 0);
    const outflows = group.reduce((sum, b) => sum + b.outflows, 0);
    const entries = group.flatMap((b) => b.entries);
    const hasNegative = group.some((b) => b.status === 'negative');
    const hasAttention = group.some((b) => b.status === 'attention');
    const status: ForecastBucketStatus = hasNegative ? 'negative' : hasAttention ? 'attention' : 'healthy';

    const label =
      granularity === 'week'
        ? `${formatDayLabel(new Date(`${first.key}T00:00:00`))} – ${formatDayLabel(new Date(`${last.key}T00:00:00`))}`
        : formatMonthLabel(new Date(`${first.key}T00:00:00`));

    return {
      key: first.key,
      label,
      periodStart: first.key,
      periodEnd: last.key,
      openingBalance: first.openingBalance,
      inflows,
      outflows,
      closingBalance: last.closingBalance,
      status,
      entries,
    };
  });
};

const buildAlerts = (params: {
  dailyBuckets: ForecastBucket[];
  totalInflows: number;
  totalOutflows: number;
  overdueReceivablesTotal: number;
  overduePayablesTotal: number;
  negativeDate: string | null;
  startKey: string;
}): ForecastAlert[] => {
  const { dailyBuckets, totalInflows, totalOutflows, overdueReceivablesTotal, overduePayablesTotal, negativeDate } =
    params;
  const alerts: ForecastAlert[] = [];

  if (negativeDate) {
    const bucket = dailyBuckets.find((b) => b.key === negativeDate);
    alerts.push({
      id: `negative-balance-${negativeDate}`,
      type: 'negative_balance',
      severity: 'critical',
      title: 'Possível saldo negativo',
      description: `O saldo projetado pode ficar negativo em ${bucket?.label ?? negativeDate}.`,
      bucketKey: negativeDate,
      amount: bucket?.closingBalance,
    });
  }

  if (overdueReceivablesTotal > 0) {
    alerts.push({
      id: 'overdue-receivables',
      type: 'overdue_receivables',
      severity: 'warning',
      title: 'Contas a receber vencidas',
      description: 'Existem recebimentos vencidos e ainda em aberto que impactam a projeção.',
      bucketKey: params.startKey,
      amount: overdueReceivablesTotal,
    });
  }

  if (overduePayablesTotal > 0) {
    alerts.push({
      id: 'overdue-payables',
      type: 'overdue_payables',
      severity: 'warning',
      title: 'Contas a pagar vencidas',
      description: 'Existem pagamentos vencidos e ainda em aberto que impactam a projeção.',
      bucketKey: params.startKey,
      amount: overduePayablesTotal,
    });
  }

  // Só faz sentido falar em "concentração" quando as saídas estão espalhadas
  // por dias suficientes para haver desequilíbrio real — com 1-2 dias de
  // saída no período inteiro, qualquer um deles seria >= 30% trivialmente.
  const distinctOutflowDays = dailyBuckets.filter((b) => b.outflows > 0).length;
  if (totalOutflows > 0 && distinctOutflowDays >= 3) {
    const concentrationDays = dailyBuckets
      .filter((b) => b.outflows >= totalOutflows * CONCENTRATION_THRESHOLD_RATIO)
      .sort((a, b) => b.outflows - a.outflows)
      .slice(0, MAX_ALERTS_PER_TYPE);

    concentrationDays.forEach((bucket) => {
      alerts.push({
        id: `payment-concentration-${bucket.key}`,
        type: 'payment_concentration',
        severity: 'warning',
        title: 'Pagamentos concentrados',
        description: `${bucket.label} concentra uma parcela relevante das saídas previstas do período.`,
        bucketKey: bucket.key,
        amount: bucket.outflows,
      });
    });
  }

  const totalInflowEntries = dailyBuckets.reduce(
    (count, b) => count + b.entries.filter((e) => e.type === 'in').length,
    0,
  );
  // Com um único recebimento no período, ele já é 100% das entradas por
  // definição — não é um recebimento que "se destaca", é o único que existe
  // (a mesma informação já aparece no card "Entradas Previstas").
  if (totalInflows > 0 && totalInflowEntries >= 2) {
    const upcomingCutoffIndex = Math.min(UPCOMING_RECEIVABLE_WINDOW_DAYS, dailyBuckets.length);
    const relevantReceivables = dailyBuckets
      .slice(0, upcomingCutoffIndex)
      .flatMap((bucket) => bucket.entries.filter((e) => e.type === 'in'))
      .filter((entry) => entry.amount >= totalInflows * RELEVANT_RECEIVABLE_RATIO)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, MAX_ALERTS_PER_TYPE);

    relevantReceivables.forEach((entry) => {
      alerts.push({
        id: `upcoming-receivable-${entry.id}`,
        type: 'upcoming_receivable',
        severity: 'info',
        title: 'Recebimento relevante próximo',
        description: `${entry.description} representa uma parcela relevante das entradas previstas.`,
        bucketKey: dateKey(new Date(entry.dueDate)),
        amount: entry.amount,
      });
    });
  }

  return alerts;
};

export const calculateForecast = (input: CalculateForecastInput): CashFlowForecastResult => {
  const startDate = startOfLocalDay(input.startDate);
  const endDate = startOfLocalDay(input.endDate);
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();

  if (endDate < startDate) {
    throw new Error('A data final da previsão não pode ser anterior à data inicial.');
  }

  const totalDays = diffInDays(endDate, startDate) + 1;
  if (totalDays > MAX_FORECAST_DAYS) {
    throw new Error(`O período da previsão não pode exceder ${MAX_FORECAST_DAYS} dias.`);
  }

  const startKey = dateKey(startDate);
  const endKey = dateKey(endDate);
  const granularity = deriveGranularity(totalDays);

  const dayBuckets = new Map<string, { in: ForecastEntry[]; out: ForecastEntry[] }>();
  let overdueReceivablesTotal = 0;
  let overduePayablesTotal = 0;

  const fileEntry = (raw: ForecastRawEntry, type: ForecastFlowType) => {
    const { bucketKey, entry } = classifyEntry(raw, type, startKey, nowIso);
    if (bucketKey > endKey) return;
    if (entry.status === 'vencido') {
      if (type === 'in') overdueReceivablesTotal += entry.amount;
      else overduePayablesTotal += entry.amount;
    }
    const bucket = dayBuckets.get(bucketKey) ?? { in: [], out: [] };
    if (type === 'in') bucket.in.push(entry);
    else bucket.out.push(entry);
    dayBuckets.set(bucketKey, bucket);
  };

  input.openReceivables.forEach((r) => fileEntry(r, 'in'));
  input.openPayables.forEach((p) => fileEntry(p, 'out'));

  let running = input.currentBalance;
  const dailyBuckets: ForecastBucket[] = [];

  for (let i = 0; i < totalDays; i += 1) {
    const date = addDays(startDate, i);
    const key = dateKey(date);
    const bucket = dayBuckets.get(key) ?? { in: [], out: [] };
    const inflows = bucket.in.reduce((sum, e) => sum + e.amount, 0);
    const outflows = bucket.out.reduce((sum, e) => sum + e.amount, 0);
    const opening = running;
    const closing = opening + inflows - outflows;
    running = closing;

    const hasOverdue = bucket.in.some((e) => e.status === 'vencido') || bucket.out.some((e) => e.status === 'vencido');
    const status: ForecastBucketStatus = closing < 0 ? 'negative' : hasOverdue ? 'attention' : 'healthy';
    const entries = [...bucket.in, ...bucket.out].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    dailyBuckets.push({
      key,
      label: formatDayLabel(date),
      periodStart: key,
      periodEnd: key,
      openingBalance: opening,
      inflows,
      outflows,
      closingBalance: closing,
      status,
      entries,
    });
  }

  const totalInflows = dailyBuckets.reduce((sum, b) => sum + b.inflows, 0);
  const totalOutflows = dailyBuckets.reduce((sum, b) => sum + b.outflows, 0);
  const projectedEndBalance = dailyBuckets[dailyBuckets.length - 1]?.closingBalance ?? input.currentBalance;

  const lowestBalance = dailyBuckets.reduce(
    (min, b) => (b.closingBalance < min.amount ? { amount: b.closingBalance, date: b.key } : min),
    { amount: dailyBuckets[0].closingBalance, date: dailyBuckets[0].key },
  );

  const negativeBucket = dailyBuckets.find((b) => b.closingBalance < 0);
  const negativeDate = negativeBucket?.key ?? null;

  const alerts = buildAlerts({
    dailyBuckets,
    totalInflows,
    totalOutflows,
    overdueReceivablesTotal,
    overduePayablesTotal,
    negativeDate,
    startKey,
  });

  return {
    scenario: 'base',
    startDate: startKey,
    endDate: endKey,
    granularity,
    currentBalance: input.currentBalance,
    totalInflows,
    totalOutflows,
    projectedEndBalance,
    lowestBalance,
    negativeDate,
    overdueReceivablesTotal,
    overduePayablesTotal,
    buckets: aggregateBuckets(dailyBuckets, granularity),
    alerts,
  };
};

const sumAmounts = (rows: { amount: number | string | null }[] | null): number =>
  (rows || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);

export interface CashFlowForecastQuery {
  /** Data final (inclusive) da projeção. A data inicial é sempre "hoje". */
  endDate: Date;
}

export const getCashFlowForecast = async (query: CashFlowForecastQuery): Promise<CashFlowForecastResult> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const startDate = startOfLocalDay(new Date());
  const endDate = startOfLocalDay(query.endDate);
  const periodEndIso = addDays(endDate, 1).toISOString();

  const [paidReceivablesRes, paidPayablesRes, openReceivablesRes, openPayablesRes] = await Promise.all([
    supabase.from('account_receivables').select('amount').eq('company_id', companyId).eq('status', 'paid'),
    supabase.from('account_payables').select('amount').eq('company_id', companyId).eq('status', 'paid'),
    supabase
      .from('account_receivables')
      .select('id, amount, due_date, description, customers(full_name)')
      .eq('company_id', companyId)
      .in('status', ['pending', 'late'])
      .lte('due_date', periodEndIso),
    supabase
      .from('account_payables')
      .select('id, amount, due_date, description, suppliers(name)')
      .eq('company_id', companyId)
      .in('status', ['pending', 'late'])
      .lte('due_date', periodEndIso),
  ]);

  if (paidReceivablesRes.error) throw paidReceivablesRes.error;
  if (paidPayablesRes.error) throw paidPayablesRes.error;
  if (openReceivablesRes.error) throw openReceivablesRes.error;
  if (openPayablesRes.error) throw openPayablesRes.error;

  const currentBalance = sumAmounts(paidReceivablesRes.data) - sumAmounts(paidPayablesRes.data);

  const openReceivables: ForecastRawEntry[] = ((openReceivablesRes.data || []) as OpenReceivableRow[]).map((r) => ({
    id: r.id,
    amount: Number(r.amount || 0),
    dueDate: r.due_date,
    description: r.description || 'Recebimento previsto',
    relatedName: r.customers?.full_name,
  }));

  const openPayables: ForecastRawEntry[] = ((openPayablesRes.data || []) as OpenPayableRow[]).map((p) => ({
    id: p.id,
    amount: Number(p.amount || 0),
    dueDate: p.due_date,
    description: p.description || 'Pagamento previsto',
    relatedName: p.suppliers?.name,
  }));

  return calculateForecast({ currentBalance, openReceivables, openPayables, startDate, endDate });
};
