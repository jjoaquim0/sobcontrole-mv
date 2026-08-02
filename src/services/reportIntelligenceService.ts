import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import {
  buildAmountTimeSeries,
  calculateVariance,
  createTimeBuckets,
  daysSince,
  getTimeBucketKey,
  isCancelledStatus,
  isOverdue,
} from './reportAnalytics';

const PAGE_SIZE = 1000;
const MAX_PAGES = 200;
const STALE_DEAL_DAYS = 14;

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

const fetchAllPages = async <T>(
  queryBuilder: (from: number, to: number) => PromiseLike<QueryResult>,
): Promise<T[]> => {
  const rows: T[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await queryBuilder(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = Array.isArray(data) ? (data as T[]) : [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }

  throw new Error('O relatório excedeu o limite seguro de paginação.');
};

const requireCompanyId = () => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');
  return companyId;
};

export const assertFinancialReportAccess = async () => {
  const role = useAuthStore.getState().profile?.role;
  if (role !== 'admin' && role !== 'manager') {
    const error = new Error('Acesso financeiro não autorizado.');
    error.name = 'FinancialPermissionError';
    throw error;
  }

  const { error } = await supabase.rpc('assert_report_financial_access');
  if (error) {
    const denied = new Error(error.message || 'Acesso financeiro não autorizado.');
    denied.name = 'FinancialPermissionError';
    throw denied;
  }
};

const previousPeriod = (dateFrom: string, dateTo: string) => {
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  const duration = Math.max(0, to.getTime() - from.getTime());
  const previousDateTo = new Date(from.getTime() - 1);
  const previousDateFrom = new Date(previousDateTo.getTime() - duration);
  return { previousDateFrom: previousDateFrom.toISOString(), previousDateTo: previousDateTo.toISOString() };
};

const inRange = (value: string | null | undefined, dateFrom: string, dateTo: string) => {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return timestamp >= new Date(dateFrom).getTime() && timestamp <= new Date(dateTo).getTime();
};

const firstRelation = <T>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

const sum = <T>(rows: readonly T[], getValue: (row: T) => number) =>
  rows.reduce((total, row) => total + getValue(row), 0);

interface SaleRow {
  id: string;
  customer_id: string;
  seller_id: string;
  total: number | string;
  discount: number | string;
  fee: number | string;
  final_value: number | string;
  payment_method: string;
  payment_status: string;
  created_at: string;
  customers?: { full_name?: string } | { full_name?: string }[] | null;
  profiles?: { name?: string } | { name?: string }[] | null;
}

interface PurchaseRow {
  id: string;
  supplier_id: string;
  total_amount: number | string;
  discount: number | string;
  fee: number | string;
  final_value: number | string;
  status: string;
  created_at: string;
  suppliers?: { name?: string } | { name?: string }[] | null;
}

interface CustomerRow {
  id: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
}

interface ProductRow {
  id: string;
  name: string;
  sku: string;
  current_quantity: number | string;
  min_quantity: number | string;
  cost_price: number | string;
  is_active: boolean;
  category_id: string | null;
  categories?: { name?: string } | { name?: string }[] | null;
}

interface ReceivableRow {
  id: string;
  amount: number | string;
  status: string;
  due_date: string;
  description: string | null;
  customer_id: string | null;
  customers?: { full_name?: string } | { full_name?: string }[] | null;
}

interface PayableRow {
  id: string;
  amount: number | string;
  status: string;
  due_date: string;
  description: string | null;
  supplier_id: string | null;
  purchase_id: string | null;
  suppliers?: { name?: string } | { name?: string }[] | null;
}

interface PipelineStageRow {
  id: string;
  name: string;
  color: string;
  position: number | string;
}

interface DealRow {
  id: string;
  title: string;
  customer_id: string;
  owner_id: string;
  stage_id: string;
  value: number | string;
  status: 'open' | 'won' | 'lost';
  expected_close_date: string | null;
  lost_reason: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  customers?: { full_name?: string } | { full_name?: string }[] | null;
  profiles?: { name?: string } | { name?: string }[] | null;
}

interface SaleItemRow {
  sale_id: string;
  product_id: string;
  quantity: number | string;
  subtotal: number | string;
  products?: { name?: string } | { name?: string }[] | null;
  sales: { payment_status?: string; created_at?: string } | { payment_status?: string; created_at?: string }[] | null;
}

interface PurchaseItemRow {
  product_id: string;
  quantity: number | string;
  purchases: { status?: string; created_at?: string } | { status?: string; created_at?: string }[] | null;
}

const fetchSales = (companyId: string, dateFrom: string, dateTo: string, includeRelations = false) =>
  fetchAllPages<SaleRow>((from, to) =>
    supabase
      .from('sales')
      .select(includeRelations
        ? 'id, customer_id, seller_id, total, discount, fee, final_value, payment_method, payment_status, created_at, customers(full_name), profiles(name)'
        : 'id, customer_id, seller_id, total, discount, fee, final_value, payment_method, payment_status, created_at')
      .eq('company_id', companyId)
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo)
      .order('created_at', { ascending: true })
      .range(from, to),
  );

const fetchPurchases = (companyId: string, dateFrom: string, dateTo: string, includeSupplier = false) =>
  fetchAllPages<PurchaseRow>((from, to) =>
    supabase
      .from('purchases')
      .select(includeSupplier
        ? 'id, supplier_id, total_amount, discount, fee, final_value, status, created_at, suppliers(name)'
        : 'id, supplier_id, total_amount, discount, fee, final_value, status, created_at')
      .eq('company_id', companyId)
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo)
      .order('created_at', { ascending: true })
      .range(from, to),
  );

const fetchDeals = (companyId: string) =>
  fetchAllPages<DealRow>((from, to) =>
    supabase
      .from('deals')
      .select('id, title, customer_id, owner_id, stage_id, value, status, expected_close_date, lost_reason, closed_at, created_at, updated_at, customers(full_name), profiles(name)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })
      .range(from, to),
  );

const fetchProducts = (companyId: string) =>
  fetchAllPages<ProductRow>((from, to) =>
    supabase
      .from('products')
      .select('id, name, sku, current_quantity, min_quantity, cost_price, is_active, category_id, categories(name)')
      .eq('company_id', companyId)
      .order('name', { ascending: true })
      .range(from, to),
  );

export interface MetricComparison {
  current: number;
  previous: number;
  variance: number;
}

export interface ReportInsight {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'info';
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}

export interface OverviewReport {
  revenue: MetricComparison;
  expenses: MetricComparison;
  profit: MetricComparison;
  salesCount: MetricComparison;
  averageTicket: MetricComparison;
  pipelineValue: number;
  activeCustomers: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  pendingReceivables: number;
  overdueReceivables: number;
  pendingPayables: number;
  stalledDeals: number;
  revenueExpenseByPeriod: { key: string; label: string; revenue: number; expenses: number }[];
  profitEvolution: { key: string; label: string; profit: number }[];
  insights: ReportInsight[];
}

const buildOverviewInsights = (input: {
  revenueVariance: number;
  overdueReceivables: number;
  lowStockProducts: number;
  stalledDeals: number;
}): ReportInsight[] => {
  const insights: ReportInsight[] = [];
  if (input.revenueVariance <= -5) {
    insights.push({
      id: 'revenue-down',
      priority: input.revenueVariance <= -20 ? 'high' : 'medium',
      title: 'Receita abaixo do período anterior',
      description: `A receita paga recuou ${Math.abs(input.revenueVariance).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% na comparação equivalente.`,
      href: '/relatorios/vendas-pipeline',
      actionLabel: 'Analisar vendas',
    });
  }
  if (input.overdueReceivables > 0) {
    insights.push({
      id: 'overdue-receivables',
      priority: 'critical',
      title: 'Contas vencidas exigem atenção',
      description: 'Existem recebíveis pendentes com vencimento no período selecionado.',
      href: '/financial',
      actionLabel: 'Abrir Financeiro',
    });
  }
  if (input.lowStockProducts > 0) {
    insights.push({
      id: 'low-stock',
      priority: 'high',
      title: 'Produtos abaixo do estoque mínimo',
      description: `${input.lowStockProducts} produto(s) ativo(s) estão no ou abaixo do mínimo cadastrado.`,
      href: '/inventory/recommendations',
      actionLabel: 'Revisar reposição',
    });
  }
  if (input.stalledDeals > 0) {
    insights.push({
      id: 'stalled-deals',
      priority: 'medium',
      title: 'Oportunidades sem atualização',
      description: `${input.stalledDeals} oportunidade(s) aberta(s) estão há ${STALE_DEAL_DAYS} dias ou mais sem atualização.`,
      href: '/pipeline',
      actionLabel: 'Abrir pipeline',
    });
  }
  return insights;
};

export const getOverviewReport = async (dateFrom: string, dateTo: string): Promise<OverviewReport> => {
  await assertFinancialReportAccess();
  const companyId = requireCompanyId();
  const { previousDateFrom, previousDateTo } = previousPeriod(dateFrom, dateTo);

  const [currentSales, previousSales, currentPurchases, previousPurchases, customers, products, receivables, payables, deals] = await Promise.all([
    fetchSales(companyId, dateFrom, dateTo),
    fetchSales(companyId, previousDateFrom, previousDateTo),
    fetchPurchases(companyId, dateFrom, dateTo),
    fetchPurchases(companyId, previousDateFrom, previousDateTo),
    fetchAllPages<CustomerRow>((from, to) =>
      supabase.from('customers').select('id, full_name, is_active, created_at').eq('company_id', companyId).order('created_at').range(from, to)),
    fetchProducts(companyId),
    fetchAllPages<ReceivableRow>((from, to) =>
      supabase.from('account_receivables').select('id, amount, status, due_date, description, customer_id').eq('company_id', companyId).gte('due_date', dateFrom).lte('due_date', dateTo).order('due_date').range(from, to)),
    fetchAllPages<PayableRow>((from, to) =>
      supabase.from('account_payables').select('id, amount, status, due_date, description, supplier_id, purchase_id').eq('company_id', companyId).gte('due_date', dateFrom).lte('due_date', dateTo).order('due_date').range(from, to)),
    fetchDeals(companyId),
  ]);

  const validCurrentSales = currentSales.filter((sale) => !isCancelledStatus(sale.payment_status));
  const validPreviousSales = previousSales.filter((sale) => !isCancelledStatus(sale.payment_status));
  const paidCurrentSales = validCurrentSales.filter((sale) => sale.payment_status === 'paid');
  const paidPreviousSales = validPreviousSales.filter((sale) => sale.payment_status === 'paid');
  const paidCurrentPurchases = currentPurchases.filter((purchase) => purchase.status === 'paid');
  const paidPreviousPurchases = previousPurchases.filter((purchase) => purchase.status === 'paid');

  const revenueCurrent = sum(paidCurrentSales, (sale) => Number(sale.final_value));
  const revenuePrevious = sum(paidPreviousSales, (sale) => Number(sale.final_value));
  const expensesCurrent = sum(paidCurrentPurchases, (purchase) => Number(purchase.final_value));
  const expensesPrevious = sum(paidPreviousPurchases, (purchase) => Number(purchase.final_value));
  const profitCurrent = revenueCurrent - expensesCurrent;
  const profitPrevious = revenuePrevious - expensesPrevious;
  const averageTicketCurrent = paidCurrentSales.length ? revenueCurrent / paidCurrentSales.length : 0;
  const averageTicketPrevious = paidPreviousSales.length ? revenuePrevious / paidPreviousSales.length : 0;
  const reference = new Date(dateTo);

  const activeProducts = products.filter((product) => product.is_active);
  const lowStockProducts = activeProducts.filter((product) => Number(product.current_quantity) <= Number(product.min_quantity)).length;
  const outOfStockProducts = activeProducts.filter((product) => Number(product.current_quantity) <= 0).length;
  const validReceivables = receivables.filter((row) => row.status !== 'canceled');
  const validPayables = payables.filter((row) => row.status !== 'canceled');
  const pendingReceivables = sum(validReceivables.filter((row) => row.status === 'pending' || row.status === 'late'), (row) => Number(row.amount));
  const overdueReceivables = sum(validReceivables.filter((row) => isOverdue(row.status, row.due_date, reference)), (row) => Number(row.amount));
  const pendingPayables = sum(validPayables.filter((row) => row.status === 'pending' || row.status === 'late'), (row) => Number(row.amount));
  const openDeals = deals.filter((deal) => deal.status === 'open' && inRange(deal.created_at, dateFrom, dateTo));
  const pipelineValue = sum(openDeals, (deal) => Number(deal.value));
  const stalledDeals = openDeals.filter((deal) => daysSince(deal.updated_at, reference) >= STALE_DEAL_DAYS).length;

  const series = buildAmountTimeSeries(dateFrom, dateTo, {
    revenue: paidCurrentSales.map((sale) => ({ occurredAt: sale.created_at, amount: Number(sale.final_value) })),
    expenses: paidCurrentPurchases.map((purchase) => ({ occurredAt: purchase.created_at, amount: Number(purchase.final_value) })),
  }).map((point) => ({
    key: String(point.key),
    label: String(point.label),
    revenue: Number(point.revenue),
    expenses: Number(point.expenses),
  }));

  const revenueVariance = calculateVariance(revenueCurrent, revenuePrevious);

  return {
    revenue: { current: revenueCurrent, previous: revenuePrevious, variance: revenueVariance },
    expenses: { current: expensesCurrent, previous: expensesPrevious, variance: calculateVariance(expensesCurrent, expensesPrevious) },
    profit: { current: profitCurrent, previous: profitPrevious, variance: calculateVariance(profitCurrent, profitPrevious) },
    salesCount: { current: validCurrentSales.length, previous: validPreviousSales.length, variance: calculateVariance(validCurrentSales.length, validPreviousSales.length) },
    averageTicket: { current: averageTicketCurrent, previous: averageTicketPrevious, variance: calculateVariance(averageTicketCurrent, averageTicketPrevious) },
    pipelineValue,
    activeCustomers: customers.filter((customer) => customer.is_active).length,
    lowStockProducts,
    outOfStockProducts,
    pendingReceivables,
    overdueReceivables,
    pendingPayables,
    stalledDeals,
    revenueExpenseByPeriod: series,
    profitEvolution: series.map((point) => ({ key: point.key, label: point.label, profit: point.revenue - point.expenses })),
    insights: buildOverviewInsights({ revenueVariance, overdueReceivables, lowStockProducts, stalledDeals }),
  };
};

export interface DREEntry {
  category: string;
  type: 'revenue' | 'expense' | 'deduction' | 'total';
  value: number;
}

export interface DREReport {
  entries: DREEntry[];
  period: { dateFrom: string; dateTo: string };
  summary: {
    grossRevenue: number;
    additions: number;
    deductions: number;
    netRevenue: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin: number;
  };
  basisNote: string;
}

export const getDREReport = async (dateFrom: string, dateTo: string): Promise<DREReport> => {
  await assertFinancialReportAccess();
  const companyId = requireCompanyId();

  const [sales, purchases, manualExpenses] = await Promise.all([
    fetchSales(companyId, dateFrom, dateTo),
    fetchPurchases(companyId, dateFrom, dateTo),
    fetchAllPages<PayableRow>((from, to) =>
      supabase
        .from('account_payables')
        .select('id, amount, status, due_date, description, supplier_id, purchase_id')
        .eq('company_id', companyId)
        .is('purchase_id', null)
        .gte('due_date', dateFrom)
        .lte('due_date', dateTo)
        .order('due_date')
        .range(from, to)),
  ]);

  const paidSales = sales.filter((sale) => sale.payment_status === 'paid');
  const grossRevenue = sum(paidSales, (sale) => Number(sale.total));
  const additions = sum(paidSales, (sale) => Number(sale.fee));
  const deductions = sum(paidSales, (sale) => Number(sale.discount));
  const netRevenue = sum(paidSales, (sale) => Number(sale.final_value));
  const costs = sum(purchases.filter((purchase) => purchase.status === 'paid'), (purchase) => Number(purchase.final_value));
  const operatingExpenses = sum(manualExpenses.filter((expense) => expense.status === 'paid'), (expense) => Number(expense.amount));
  const netProfit = netRevenue - costs - operatingExpenses;
  const profitMargin = netRevenue ? (netProfit / netRevenue) * 100 : 0;

  return {
    entries: [
      { category: 'RECEITA BRUTA DE VENDAS', type: 'revenue', value: grossRevenue },
      { category: '(+) TAXAS E ACRÉSCIMOS', type: 'revenue', value: additions },
      { category: '(-) DESCONTOS CONCEDIDOS', type: 'deduction', value: deductions },
      { category: '(=) RECEITA LÍQUIDA', type: 'total', value: netRevenue },
      { category: '(-) COMPRAS E CUSTOS DIRETOS', type: 'expense', value: costs },
      { category: '(=) RESULTADO BRUTO', type: 'total', value: netRevenue - costs },
      { category: '(-) DESPESAS OPERACIONAIS MANUAIS', type: 'expense', value: operatingExpenses },
      { category: '(=) RESULTADO LÍQUIDO GERENCIAL', type: 'total', value: netProfit },
    ],
    period: { dateFrom, dateTo },
    summary: { grossRevenue, additions, deductions, netRevenue, totalExpenses: costs + operatingExpenses, netProfit, profitMargin },
    basisNote: 'DRE gerencial: vendas e compras pagas pela data de registro; despesas manuais pagas pelo vencimento. Não substitui escrituração contábil.',
  };
};

export interface SalesReport {
  summary: {
    totalSales: number;
    totalRevenue: number;
    averageTicket: number;
    totalDiscount: number;
    pipelineValue: number;
    closedConversion: number | null;
    stalledDeals: number;
  };
  comparison: {
    totalSales: MetricComparison;
    totalRevenue: MetricComparison;
    averageTicket: MetricComparison;
  };
  byDay: { key: string; label: string; count: number; revenue: number }[];
  byProduct: { productId: string; productName: string; quantity: number; revenue: number }[];
  byPaymentMethod: { method: string; count: number; total: number }[];
  topCustomers: { customerId: string; customerName: string; totalSpent: number; saleCount: number }[];
  bySeller: { sellerId: string; sellerName: string; revenue: number; saleCount: number }[];
  pipelineStages: { stageId: string; stageName: string; color: string; position: number; count: number; value: number }[];
  lostReasons: { reason: string; count: number; value: number }[];
  stalledOpportunities: {
    id: string;
    title: string;
    customerName: string;
    ownerName: string;
    stageName: string;
    value: number;
    daysWithoutUpdate: number;
  }[];
  recentSales: {
    id: string;
    customerName: string;
    sellerName: string;
    value: number;
    status: string;
    createdAt: string;
  }[];
}

export const getSalesReport = async (dateFrom: string, dateTo: string): Promise<SalesReport> => {
  const companyId = requireCompanyId();
  const { previousDateFrom, previousDateTo } = previousPeriod(dateFrom, dateTo);

  const [sales, previousSales, saleItems, stages, deals] = await Promise.all([
    fetchSales(companyId, dateFrom, dateTo, true),
    fetchSales(companyId, previousDateFrom, previousDateTo),
    fetchAllPages<SaleItemRow>((from, to) =>
      supabase
        .from('sale_items')
        .select('sale_id, product_id, quantity, subtotal, products(name), sales!inner(payment_status, created_at, company_id)')
        .eq('sales.company_id', companyId)
        .gte('sales.created_at', dateFrom)
        .lte('sales.created_at', dateTo)
        .order('sale_id')
        .range(from, to)),
    fetchAllPages<PipelineStageRow>((from, to) =>
      supabase.from('pipeline_stages').select('id, name, color, position').eq('company_id', companyId).eq('is_active', true).order('position').range(from, to)),
    fetchDeals(companyId),
  ]);

  const validSales = sales.filter((sale) => !isCancelledStatus(sale.payment_status));
  const previousValidSales = previousSales.filter((sale) => !isCancelledStatus(sale.payment_status));
  const paidSales = validSales.filter((sale) => sale.payment_status === 'paid');
  const previousPaidSales = previousValidSales.filter((sale) => sale.payment_status === 'paid');
  const paidSaleIds = new Set(paidSales.map((sale) => sale.id));
  const validItems = saleItems.filter((item) => {
    const relatedSale = firstRelation(item.sales);
    return paidSaleIds.has(item.sale_id) && !isCancelledStatus(relatedSale?.payment_status);
  });

  const totalRevenue = sum(paidSales, (sale) => Number(sale.final_value));
  const previousRevenue = sum(previousPaidSales, (sale) => Number(sale.final_value));
  const averageTicket = paidSales.length ? totalRevenue / paidSales.length : 0;
  const previousAverageTicket = previousPaidSales.length ? previousRevenue / previousPaidSales.length : 0;

  const byProductMap = new Map<string, SalesReport['byProduct'][number]>();
  validItems.forEach((item) => {
    const productName = firstRelation(item.products)?.name || 'Produto sem nome';
    const current = byProductMap.get(item.product_id) || { productId: item.product_id, productName, quantity: 0, revenue: 0 };
    current.quantity += Number(item.quantity);
    current.revenue += Number(item.subtotal);
    byProductMap.set(item.product_id, current);
  });

  const paymentMap = new Map<string, SalesReport['byPaymentMethod'][number]>();
  paidSales.forEach((sale) => {
    const current = paymentMap.get(sale.payment_method) || { method: sale.payment_method, count: 0, total: 0 };
    current.count += 1;
    current.total += Number(sale.final_value);
    paymentMap.set(sale.payment_method, current);
  });

  const customerMap = new Map<string, SalesReport['topCustomers'][number]>();
  const sellerMap = new Map<string, SalesReport['bySeller'][number]>();
  paidSales.forEach((sale) => {
    const customerName = firstRelation(sale.customers)?.full_name || 'Consumidor final';
    const customer = customerMap.get(sale.customer_id) || { customerId: sale.customer_id, customerName, totalSpent: 0, saleCount: 0 };
    customer.totalSpent += Number(sale.final_value);
    customer.saleCount += 1;
    customerMap.set(sale.customer_id, customer);

    const sellerName = firstRelation(sale.profiles)?.name || 'Sem responsável';
    const seller = sellerMap.get(sale.seller_id) || { sellerId: sale.seller_id, sellerName, revenue: 0, saleCount: 0 };
    seller.revenue += Number(sale.final_value);
    seller.saleCount += 1;
    sellerMap.set(sale.seller_id, seller);
  });

  const { grain } = createTimeBuckets(dateFrom, dateTo);
  const counts = new Map<string, number>();
  validSales.forEach((sale) => {
    const key = getTimeBucketKey(sale.created_at, grain);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const byDay = buildAmountTimeSeries(dateFrom, dateTo, {
    revenue: paidSales.map((sale) => ({ occurredAt: sale.created_at, amount: Number(sale.final_value) })),
  }).map((point) => ({
    key: String(point.key),
    label: String(point.label),
    count: counts.get(String(point.key)) || 0,
    revenue: Number(point.revenue),
  }));

  const reference = new Date(dateTo);
  const stageNameMap = new Map(stages.map((stage) => [stage.id, stage.name]));
  const openDeals = deals.filter((deal) => deal.status === 'open' && inRange(deal.created_at, dateFrom, dateTo));
  const closedDeals = deals.filter((deal) => (deal.status === 'won' || deal.status === 'lost') && inRange(deal.closed_at, dateFrom, dateTo));
  const wonDeals = closedDeals.filter((deal) => deal.status === 'won');
  const stalled = openDeals
    .filter((deal) => daysSince(deal.updated_at, reference) >= STALE_DEAL_DAYS)
    .sort((a, b) => a.updated_at.localeCompare(b.updated_at));

  const pipelineStages = stages.map((stage) => {
    const stageDeals = openDeals.filter((deal) => deal.stage_id === stage.id);
    return {
      stageId: stage.id,
      stageName: stage.name,
      color: stage.color,
      position: Number(stage.position),
      count: stageDeals.length,
      value: sum(stageDeals, (deal) => Number(deal.value)),
    };
  });

  const lostReasonMap = new Map<string, { reason: string; count: number; value: number }>();
  closedDeals.filter((deal) => deal.status === 'lost').forEach((deal) => {
    const reason = deal.lost_reason?.trim() || 'Motivo não informado';
    const current = lostReasonMap.get(reason) || { reason, count: 0, value: 0 };
    current.count += 1;
    current.value += Number(deal.value);
    lostReasonMap.set(reason, current);
  });

  return {
    summary: {
      totalSales: validSales.length,
      totalRevenue,
      averageTicket,
      totalDiscount: sum(paidSales, (sale) => Number(sale.discount)),
      pipelineValue: sum(openDeals, (deal) => Number(deal.value)),
      closedConversion: closedDeals.length ? (wonDeals.length / closedDeals.length) * 100 : null,
      stalledDeals: stalled.length,
    },
    comparison: {
      totalSales: { current: validSales.length, previous: previousValidSales.length, variance: calculateVariance(validSales.length, previousValidSales.length) },
      totalRevenue: { current: totalRevenue, previous: previousRevenue, variance: calculateVariance(totalRevenue, previousRevenue) },
      averageTicket: { current: averageTicket, previous: previousAverageTicket, variance: calculateVariance(averageTicket, previousAverageTicket) },
    },
    byDay,
    byProduct: Array.from(byProductMap.values()).sort((a, b) => b.revenue - a.revenue),
    byPaymentMethod: Array.from(paymentMap.values()).sort((a, b) => b.total - a.total),
    topCustomers: Array.from(customerMap.values()).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10),
    bySeller: Array.from(sellerMap.values()).sort((a, b) => b.revenue - a.revenue),
    pipelineStages,
    lostReasons: Array.from(lostReasonMap.values()).sort((a, b) => b.count - a.count),
    stalledOpportunities: stalled.slice(0, 10).map((deal) => ({
      id: deal.id,
      title: deal.title,
      customerName: firstRelation(deal.customers)?.full_name || 'Cliente sem nome',
      ownerName: firstRelation(deal.profiles)?.name || 'Sem responsável',
      stageName: stageNameMap.get(deal.stage_id) || 'Etapa não identificada',
      value: Number(deal.value),
      daysWithoutUpdate: daysSince(deal.updated_at, reference),
    })),
    recentSales: [...validSales].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8).map((sale) => ({
      id: sale.id,
      customerName: firstRelation(sale.customers)?.full_name || 'Consumidor final',
      sellerName: firstRelation(sale.profiles)?.name || 'Sem responsável',
      value: Number(sale.final_value),
      status: sale.payment_status,
      createdAt: sale.created_at,
    })),
  };
};

export interface FinancialReportItem {
  id: string;
  type: 'receivable' | 'payable';
  description: string;
  counterparty: string;
  amount: number;
  dueDate: string;
  status: string;
  overdue: boolean;
}

export interface FinancialReport {
  receivables: {
    total: number;
    paid: number;
    pending: number;
    overdue: number;
    byDueDate: { date: string; amount: number }[];
  };
  payables: {
    total: number;
    paid: number;
    pending: number;
    overdue: number;
    byDueDate: { date: string; amount: number }[];
  };
  cashFlow: { key: string; date: string; inflows: number; outflows: number; balance: number }[];
  aging: { range: string; receivables: number; payables: number }[];
  overdueItems: FinancialReportItem[];
  upcomingItems: FinancialReportItem[];
}

const toFinancialItem = (
  row: ReceivableRow | PayableRow,
  type: FinancialReportItem['type'],
  reference: Date,
): FinancialReportItem => {
  const counterparty = type === 'receivable'
    ? firstRelation((row as ReceivableRow).customers)?.full_name
    : firstRelation((row as PayableRow).suppliers)?.name;
  return {
    id: row.id,
    type,
    description: row.description || (type === 'receivable' ? 'Conta a receber' : 'Conta a pagar'),
    counterparty: counterparty || 'Não informado',
    amount: Number(row.amount),
    dueDate: row.due_date,
    status: row.status,
    overdue: isOverdue(row.status, row.due_date, reference),
  };
};

export const getFinancialReport = async (dateFrom: string, dateTo: string): Promise<FinancialReport> => {
  await assertFinancialReportAccess();
  const companyId = requireCompanyId();
  const reference = new Date(dateTo);

  const [receivables, payables] = await Promise.all([
    fetchAllPages<ReceivableRow>((from, to) =>
      supabase
        .from('account_receivables')
        .select('id, amount, status, due_date, description, customer_id, customers(full_name)')
        .eq('company_id', companyId)
        .gte('due_date', dateFrom)
        .lte('due_date', dateTo)
        .order('due_date')
        .range(from, to)),
    fetchAllPages<PayableRow>((from, to) =>
      supabase
        .from('account_payables')
        .select('id, amount, status, due_date, description, supplier_id, purchase_id, suppliers(name)')
        .eq('company_id', companyId)
        .gte('due_date', dateFrom)
        .lte('due_date', dateTo)
        .order('due_date')
        .range(from, to)),
  ]);

  const validReceivables = receivables.filter((row) => row.status !== 'canceled');
  const validPayables = payables.filter((row) => row.status !== 'canceled');
  const receivableItems = validReceivables.map((row) => toFinancialItem(row, 'receivable', reference));
  const payableItems = validPayables.map((row) => toFinancialItem(row, 'payable', reference));
  const openReceivables = validReceivables.filter((row) => row.status === 'pending' || row.status === 'late');
  const openPayables = validPayables.filter((row) => row.status === 'pending' || row.status === 'late');

  const groupByDate = (rows: readonly (ReceivableRow | PayableRow)[]) => {
    const grouped = new Map<string, number>();
    rows.forEach((row) => {
      const key = row.due_date.slice(0, 10);
      grouped.set(key, (grouped.get(key) || 0) + Number(row.amount));
    });
    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, amount }));
  };

  let balance = 0;
  const cashFlow = buildAmountTimeSeries(dateFrom, dateTo, {
    inflows: validReceivables.map((row) => ({ occurredAt: row.due_date, amount: Number(row.amount) })),
    outflows: validPayables.map((row) => ({ occurredAt: row.due_date, amount: Number(row.amount) })),
  }).map((point) => {
    balance += Number(point.inflows) - Number(point.outflows);
    return { key: String(point.key), date: String(point.label), inflows: Number(point.inflows), outflows: Number(point.outflows), balance };
  });

  const ranges = [
    { range: '0–30 dias', min: 0, max: 30 },
    { range: '31–60 dias', min: 31, max: 60 },
    { range: '61–90 dias', min: 61, max: 90 },
    { range: '90+ dias', min: 91, max: Number.POSITIVE_INFINITY },
  ];
  const aging = ranges.map(({ range, min, max }) => ({
    range,
    receivables: sum(receivableItems.filter((item) => item.overdue && daysSince(item.dueDate, reference) >= min && daysSince(item.dueDate, reference) <= max), (item) => item.amount),
    payables: sum(payableItems.filter((item) => item.overdue && daysSince(item.dueDate, reference) >= min && daysSince(item.dueDate, reference) <= max), (item) => item.amount),
  }));

  const allItems = [...receivableItems, ...payableItems];

  return {
    receivables: {
      total: sum(validReceivables, (row) => Number(row.amount)),
      paid: sum(validReceivables.filter((row) => row.status === 'paid'), (row) => Number(row.amount)),
      pending: sum(openReceivables, (row) => Number(row.amount)),
      overdue: sum(receivableItems.filter((item) => item.overdue), (item) => item.amount),
      byDueDate: groupByDate(validReceivables),
    },
    payables: {
      total: sum(validPayables, (row) => Number(row.amount)),
      paid: sum(validPayables.filter((row) => row.status === 'paid'), (row) => Number(row.amount)),
      pending: sum(openPayables, (row) => Number(row.amount)),
      overdue: sum(payableItems.filter((item) => item.overdue), (item) => item.amount),
      byDueDate: groupByDate(validPayables),
    },
    cashFlow,
    aging,
    overdueItems: allItems.filter((item) => item.overdue).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    upcomingItems: allItems.filter((item) => !item.overdue && (item.status === 'pending' || item.status === 'late')).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 12),
  };
};

export interface InventoryReport {
  summary: {
    totalProducts: number;
    activeProducts: number;
    totalValue: number | null;
    costCoveragePercent: number;
    lowStock: number;
    outOfStock: number;
    withoutExit: number;
    pendingPurchases: number;
    pendingPurchaseValue: number;
  };
  byCategory: { categoryName: string; count: number; knownCostValue: number }[];
  topSellers: { productId: string; productName: string; quantitySold: number; revenue: number }[];
  movements: { date: string; productName: string; type: 'in' | 'out'; quantity: number }[];
  withoutExitProducts: { productId: string; productName: string; sku: string; currentQuantity: number; knownCostValue: number | null }[];
  topSuppliers: { supplierId: string; supplierName: string; purchaseCount: number; total: number }[];
}

export const getInventoryReport = async (dateFrom: string, dateTo: string): Promise<InventoryReport> => {
  const companyId = requireCompanyId();
  const [products, saleItems, purchaseItems, purchases] = await Promise.all([
    fetchProducts(companyId),
    fetchAllPages<SaleItemRow>((from, to) =>
      supabase
        .from('sale_items')
        .select('sale_id, product_id, quantity, subtotal, sales!inner(payment_status, created_at, company_id)')
        .eq('sales.company_id', companyId)
        .gte('sales.created_at', dateFrom)
        .lte('sales.created_at', dateTo)
        .order('sale_id')
        .range(from, to)),
    fetchAllPages<PurchaseItemRow>((from, to) =>
      supabase
        .from('purchase_items')
        .select('product_id, quantity, purchases!inner(status, created_at, company_id)')
        .eq('purchases.company_id', companyId)
        .gte('purchases.created_at', dateFrom)
        .lte('purchases.created_at', dateTo)
        .order('purchase_id')
        .range(from, to)),
    fetchPurchases(companyId, dateFrom, dateTo, true),
  ]);

  const activeProducts = products.filter((product) => product.is_active);
  const productMap = new Map(activeProducts.map((product) => [product.id, product]));
  const validSaleItems = saleItems.filter((item) => {
    const sale = firstRelation(item.sales);
    return sale && !isCancelledStatus(sale.payment_status);
  });
  const validPurchaseItems = purchaseItems.filter((item) => {
    const purchase = firstRelation(item.purchases);
    return purchase && purchase.status !== 'canceled';
  });
  const productsWithExit = new Set(validSaleItems.map((item) => item.product_id));
  const stockPositive = activeProducts.filter((product) => Number(product.current_quantity) > 0);
  const reliableCostProducts = stockPositive.filter((product) => Number(product.cost_price) > 0);
  const costCoveragePercent = stockPositive.length ? (reliableCostProducts.length / stockPositive.length) * 100 : 100;
  const totalValue = costCoveragePercent === 100
    ? sum(stockPositive, (product) => Number(product.current_quantity) * Number(product.cost_price))
    : null;

  const categoryMap = new Map<string, InventoryReport['byCategory'][number]>();
  activeProducts.forEach((product) => {
    const categoryName = firstRelation(product.categories)?.name || 'Sem categoria';
    const current = categoryMap.get(categoryName) || { categoryName, count: 0, knownCostValue: 0 };
    current.count += 1;
    if (Number(product.cost_price) > 0) current.knownCostValue += Number(product.current_quantity) * Number(product.cost_price);
    categoryMap.set(categoryName, current);
  });

  const sellerMap = new Map<string, InventoryReport['topSellers'][number]>();
  validSaleItems.forEach((item) => {
    const product = productMap.get(item.product_id);
    if (!product) return;
    const current = sellerMap.get(item.product_id) || { productId: item.product_id, productName: product.name, quantitySold: 0, revenue: 0 };
    current.quantitySold += Number(item.quantity);
    current.revenue += Number(item.subtotal);
    sellerMap.set(item.product_id, current);
  });

  const movements: InventoryReport['movements'] = [];
  validSaleItems.forEach((item) => {
    const sale = firstRelation(item.sales);
    if (!sale?.created_at) return;
    movements.push({ date: sale.created_at, productName: productMap.get(item.product_id)?.name || 'Produto sem nome', type: 'out', quantity: Number(item.quantity) });
  });
  validPurchaseItems.forEach((item) => {
    const purchase = firstRelation(item.purchases);
    if (!purchase?.created_at) return;
    movements.push({ date: purchase.created_at, productName: productMap.get(item.product_id)?.name || 'Produto sem nome', type: 'in', quantity: Number(item.quantity) });
  });

  const pendingPurchases = purchases.filter((purchase) => purchase.status === 'pending');
  const supplierMap = new Map<string, InventoryReport['topSuppliers'][number]>();
  purchases.filter((purchase) => purchase.status !== 'canceled').forEach((purchase) => {
    const supplierName = firstRelation(purchase.suppliers)?.name || 'Fornecedor não informado';
    const current = supplierMap.get(purchase.supplier_id) || { supplierId: purchase.supplier_id, supplierName, purchaseCount: 0, total: 0 };
    current.purchaseCount += 1;
    current.total += Number(purchase.final_value);
    supplierMap.set(purchase.supplier_id, current);
  });

  const withoutExitProducts = activeProducts
    .filter((product) => Number(product.current_quantity) > 0 && !productsWithExit.has(product.id))
    .map((product) => ({
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      currentQuantity: Number(product.current_quantity),
      knownCostValue: Number(product.cost_price) > 0 ? Number(product.current_quantity) * Number(product.cost_price) : null,
    }))
    .sort((a, b) => b.currentQuantity - a.currentQuantity);

  return {
    summary: {
      totalProducts: products.length,
      activeProducts: activeProducts.length,
      totalValue,
      costCoveragePercent,
      lowStock: activeProducts.filter((product) => Number(product.current_quantity) > 0 && Number(product.current_quantity) <= Number(product.min_quantity)).length,
      outOfStock: activeProducts.filter((product) => Number(product.current_quantity) <= 0).length,
      withoutExit: withoutExitProducts.length,
      pendingPurchases: pendingPurchases.length,
      pendingPurchaseValue: sum(pendingPurchases, (purchase) => Number(purchase.final_value)),
    },
    byCategory: Array.from(categoryMap.values()).sort((a, b) => b.count - a.count),
    topSellers: Array.from(sellerMap.values()).sort((a, b) => b.quantitySold - a.quantitySold).slice(0, 10),
    movements: movements.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50),
    withoutExitProducts: withoutExitProducts.slice(0, 12),
    topSuppliers: Array.from(supplierMap.values()).sort((a, b) => b.total - a.total).slice(0, 8),
  };
};

export interface CustomerReport {
  summary: {
    total: number;
    active: number;
    newThisPeriod: number;
    withoutPurchaseInPeriod: number;
    totalRevenue: number;
    averageTicket: number;
  };
  comparison: { newCustomers: MetricComparison; revenue: MetricComparison };
  topBuyers: {
    customerId: string;
    customerName: string;
    totalSpent: number;
    saleCount: number;
    averageTicket: number;
    lastPurchase: string;
  }[];
  byMonth: { key: string; month: string; newCustomers: number; revenue: number }[];
  attentionCustomers: { customerId: string; customerName: string; createdAt: string; reason: string }[];
  paymentMethodPreference: { method: string; count: number }[];
}

export const getCustomerReport = async (dateFrom: string, dateTo: string): Promise<CustomerReport> => {
  const companyId = requireCompanyId();
  const { previousDateFrom, previousDateTo } = previousPeriod(dateFrom, dateTo);
  const [customers, sales, previousSales] = await Promise.all([
    fetchAllPages<CustomerRow>((from, to) =>
      supabase.from('customers').select('id, full_name, is_active, created_at').eq('company_id', companyId).order('created_at').range(from, to)),
    fetchSales(companyId, dateFrom, dateTo),
    fetchSales(companyId, previousDateFrom, previousDateTo),
  ]);

  const validSales = sales.filter((sale) => !isCancelledStatus(sale.payment_status));
  const paidSales = validSales.filter((sale) => sale.payment_status === 'paid');
  const previousPaidSales = previousSales.filter((sale) => sale.payment_status === 'paid');
  const totalRevenue = sum(paidSales, (sale) => Number(sale.final_value));
  const previousRevenue = sum(previousPaidSales, (sale) => Number(sale.final_value));
  const newCustomers = customers.filter((customer) => inRange(customer.created_at, dateFrom, dateTo));
  const previousNewCustomers = customers.filter((customer) => inRange(customer.created_at, previousDateFrom, previousDateTo));
  const customersWithPurchase = new Set(validSales.map((sale) => sale.customer_id));
  const activeCustomers = customers.filter((customer) => customer.is_active);

  const buyerMap = new Map<string, CustomerReport['topBuyers'][number]>();
  paidSales.forEach((sale) => {
    const customer = customers.find((candidate) => candidate.id === sale.customer_id);
    const current = buyerMap.get(sale.customer_id) || {
      customerId: sale.customer_id,
      customerName: customer?.full_name || 'Consumidor final',
      totalSpent: 0,
      saleCount: 0,
      averageTicket: 0,
      lastPurchase: sale.created_at,
    };
    current.totalSpent += Number(sale.final_value);
    current.saleCount += 1;
    if (sale.created_at > current.lastPurchase) current.lastPurchase = sale.created_at;
    current.averageTicket = current.totalSpent / current.saleCount;
    buyerMap.set(sale.customer_id, current);
  });

  const { grain, buckets } = createTimeBuckets(dateFrom, dateTo);
  const byPeriod = new Map(buckets.map((bucket) => [bucket.key, { key: bucket.key, month: bucket.label, newCustomers: 0, revenue: 0 }]));
  newCustomers.forEach((customer) => {
    const bucket = byPeriod.get(getTimeBucketKey(customer.created_at, grain));
    if (bucket) bucket.newCustomers += 1;
  });
  paidSales.forEach((sale) => {
    const bucket = byPeriod.get(getTimeBucketKey(sale.created_at, grain));
    if (bucket) bucket.revenue += Number(sale.final_value);
  });

  const methodMap = new Map<string, number>();
  validSales.forEach((sale) => methodMap.set(sale.payment_method, (methodMap.get(sale.payment_method) || 0) + 1));

  const attentionCustomers = activeCustomers
    .filter((customer) => !customersWithPurchase.has(customer.id))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'pt-BR'))
    .slice(0, 12)
    .map((customer) => ({
      customerId: customer.id,
      customerName: customer.full_name,
      createdAt: customer.created_at,
      reason: 'Sem compra válida no período selecionado',
    }));

  return {
    summary: {
      total: customers.length,
      active: activeCustomers.length,
      newThisPeriod: newCustomers.length,
      withoutPurchaseInPeriod: activeCustomers.filter((customer) => !customersWithPurchase.has(customer.id)).length,
      totalRevenue,
      averageTicket: paidSales.length ? totalRevenue / paidSales.length : 0,
    },
    comparison: {
      newCustomers: { current: newCustomers.length, previous: previousNewCustomers.length, variance: calculateVariance(newCustomers.length, previousNewCustomers.length) },
      revenue: { current: totalRevenue, previous: previousRevenue, variance: calculateVariance(totalRevenue, previousRevenue) },
    },
    topBuyers: Array.from(buyerMap.values()).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10),
    byMonth: Array.from(byPeriod.values()),
    attentionCustomers,
    paymentMethodPreference: Array.from(methodMap.entries()).map(([method, count]) => ({ method, count })).sort((a, b) => b.count - a.count),
  };
};
