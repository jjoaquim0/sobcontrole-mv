import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

const getCompanyId = () => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');
  return companyId;
};

const calcVariance = (curr: number, prev: number) => {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
};

const previousPeriod = (dateFrom: string, dateTo: string) => {
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  const diff = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - diff);
  return { prevFrom: prevFrom.toISOString(), prevTo: prevTo.toISOString() };
};

export interface OverviewReport {
  revenue: { current: number; previous: number; variance: number };
  expenses: { current: number; previous: number; variance: number };
  profit: { current: number; previous: number; variance: number };
  salesCount: { current: number; previous: number; variance: number };
  averageTicket: { current: number; previous: number; variance: number };
  activeCustomers: number;
  lowStockProducts: number;
  pendingReceivables: number;
  pendingPayables: number;
  financialHealth: number;
  revenueExpenseByPeriod: { label: string; revenue: number; expenses: number }[];
  profitEvolution: { label: string; profit: number }[];
}

export const getOverviewReport = async (dateFrom: string, dateTo: string): Promise<OverviewReport> => {
  const companyId = getCompanyId();
  const { prevFrom, prevTo } = previousPeriod(dateFrom, dateTo);

  const { data: currSales, error: currSalesErr } = await supabase
    .from('sales')
    .select('final_value, payment_status, created_at')
    .eq('company_id', companyId)
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo);
  if (currSalesErr) throw currSalesErr;

  const { data: prevSales, error: prevSalesErr } = await supabase
    .from('sales')
    .select('final_value, payment_status, created_at')
    .eq('company_id', companyId)
    .gte('created_at', prevFrom)
    .lte('created_at', prevTo);
  if (prevSalesErr) throw prevSalesErr;

  const { data: currPurchases, error: currPurchasesErr } = await supabase
    .from('purchases')
    .select('final_value, status, created_at')
    .eq('company_id', companyId)
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo);
  if (currPurchasesErr) throw currPurchasesErr;

  const { data: prevPurchases, error: prevPurchasesErr } = await supabase
    .from('purchases')
    .select('final_value, status, created_at')
    .eq('company_id', companyId)
    .gte('created_at', prevFrom)
    .lte('created_at', prevTo);
  if (prevPurchasesErr) throw prevPurchasesErr;

  const { data: customersData, error: customersErr } = await supabase
    .from('customers')
    .select('id')
    .eq('company_id', companyId)
    .eq('is_active', true);
  if (customersErr) throw customersErr;

  const { data: productsData, error: productsErr } = await supabase
    .from('products')
    .select('current_quantity, min_quantity')
    .eq('company_id', companyId)
    .eq('is_active', true);
  if (productsErr) throw productsErr;

  const { data: receivablesData, error: receivablesErr } = await supabase
    .from('account_receivables')
    .select('amount, status')
    .eq('company_id', companyId);
  if (receivablesErr) throw receivablesErr;

  const { data: payablesData, error: payablesErr } = await supabase
    .from('account_payables')
    .select('amount, status')
    .eq('company_id', companyId);
  if (payablesErr) throw payablesErr;

  const revenueCurrent = (currSales || []).filter((s) => s.payment_status === 'paid').reduce((sum, s) => sum + Number(s.final_value), 0);
  const revenuePrevious = (prevSales || []).filter((s) => s.payment_status === 'paid').reduce((sum, s) => sum + Number(s.final_value), 0);

  const expensesCurrent = (currPurchases || []).filter((p) => p.status === 'paid').reduce((sum, p) => sum + Number(p.final_value), 0);
  const expensesPrevious = (prevPurchases || []).filter((p) => p.status === 'paid').reduce((sum, p) => sum + Number(p.final_value), 0);

  const profitCurrent = revenueCurrent - expensesCurrent;
  const profitPrevious = revenuePrevious - expensesPrevious;

  const salesCountCurrent = (currSales || []).length;
  const salesCountPrevious = (prevSales || []).length;

  const averageTicketCurrent = salesCountCurrent > 0 ? revenueCurrent / salesCountCurrent : 0;
  const averageTicketPrevious = salesCountPrevious > 0 ? revenuePrevious / salesCountPrevious : 0;

  const lowStockProducts = (productsData || []).filter((p) => Number(p.current_quantity) <= Number(p.min_quantity)).length;

  const pendingReceivables = (receivablesData || []).filter((r) => r.status === 'pending' || r.status === 'late').reduce((sum, r) => sum + Number(r.amount), 0);
  const pendingPayables = (payablesData || []).filter((p) => p.status === 'pending' || p.status === 'late').reduce((sum, p) => sum + Number(p.amount), 0);

  const totalAccounts = (receivablesData || []).length + (payablesData || []).length;
  const paidAccounts = (receivablesData || []).filter((r) => r.status === 'paid').length + (payablesData || []).filter((p) => p.status === 'paid').length;
  const financialHealth = totalAccounts === 0 ? 100 : (paidAccounts / totalAccounts) * 100;

  const byDate = new Map<string, { revenue: number; expenses: number }>();
  (currSales || []).filter((s) => s.payment_status === 'paid').forEach((s) => {
    const label = new Date(s.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const entry = byDate.get(label) || { revenue: 0, expenses: 0 };
    entry.revenue += Number(s.final_value);
    byDate.set(label, entry);
  });
  (currPurchases || []).filter((p) => p.status === 'paid').forEach((p) => {
    const label = new Date(p.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const entry = byDate.get(label) || { revenue: 0, expenses: 0 };
    entry.expenses += Number(p.final_value);
    byDate.set(label, entry);
  });

  const revenueExpenseByPeriod = Array.from(byDate.entries())
    .map(([label, v]) => ({ label, revenue: v.revenue, expenses: v.expenses }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const profitEvolution = revenueExpenseByPeriod.map((r) => ({ label: r.label, profit: r.revenue - r.expenses }));

  return {
    revenue: { current: revenueCurrent, previous: revenuePrevious, variance: calcVariance(revenueCurrent, revenuePrevious) },
    expenses: { current: expensesCurrent, previous: expensesPrevious, variance: calcVariance(expensesCurrent, expensesPrevious) },
    profit: { current: profitCurrent, previous: profitPrevious, variance: calcVariance(profitCurrent, profitPrevious) },
    salesCount: { current: salesCountCurrent, previous: salesCountPrevious, variance: calcVariance(salesCountCurrent, salesCountPrevious) },
    averageTicket: { current: averageTicketCurrent, previous: averageTicketPrevious, variance: calcVariance(averageTicketCurrent, averageTicketPrevious) },
    activeCustomers: (customersData || []).length,
    lowStockProducts,
    pendingReceivables,
    pendingPayables,
    financialHealth,
    revenueExpenseByPeriod,
    profitEvolution,
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
  summary: { grossRevenue: number; deductions: number; netRevenue: number; totalExpenses: number; netProfit: number; profitMargin: number };
}

export const getDREReport = async (dateFrom: string, dateTo: string): Promise<DREReport> => {
  const companyId = getCompanyId();

  const { data: sales, error: salesErr } = await supabase
    .from('sales')
    .select('final_value, discount, payment_status, created_at')
    .eq('company_id', companyId)
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo);
  if (salesErr) throw salesErr;

  const { data: purchases, error: purchasesErr } = await supabase
    .from('purchases')
    .select('final_value, status, created_at')
    .eq('company_id', companyId)
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo);
  if (purchasesErr) throw purchasesErr;

  const { data: manualExpenses, error: manualErr } = await supabase
    .from('account_payables')
    .select('amount, status, due_date, purchase_id')
    .eq('company_id', companyId)
    .is('purchase_id', null)
    .gte('due_date', dateFrom)
    .lte('due_date', dateTo);
  if (manualErr) throw manualErr;

  const paidSales = (sales || []).filter((s) => s.payment_status === 'paid');
  const grossRevenue = paidSales.reduce((sum, s) => sum + Number(s.final_value), 0);
  const deductions = paidSales.reduce((sum, s) => sum + Number(s.discount || 0), 0);
  const netRevenue = grossRevenue - deductions;

  const costs = (purchases || []).filter((p) => p.status === 'paid').reduce((sum, p) => sum + Number(p.final_value), 0);
  const grossProfit = netRevenue - costs;

  const operatingExpenses = (manualExpenses || []).filter((e) => e.status === 'paid').reduce((sum, e) => sum + Number(e.amount), 0);
  const netProfit = grossProfit - operatingExpenses;

  const profitMargin = netRevenue !== 0 ? (netProfit / netRevenue) * 100 : 0;

  const entries: DREEntry[] = [
    { category: 'RECEITA BRUTA', type: 'revenue', value: grossRevenue },
    { category: '(-) DEDUÇÕES', type: 'deduction', value: deductions },
    { category: '(=) RECEITA LÍQUIDA', type: 'total', value: netRevenue },
    { category: '(-) CUSTOS', type: 'expense', value: costs },
    { category: '(=) LUCRO BRUTO', type: 'total', value: grossProfit },
    { category: '(-) DESPESAS OPERACIONAIS', type: 'expense', value: operatingExpenses },
    { category: '(=) LUCRO LÍQUIDO', type: 'total', value: netProfit },
  ];

  return {
    entries,
    period: { dateFrom, dateTo },
    summary: { grossRevenue, deductions, netRevenue, totalExpenses: costs + operatingExpenses, netProfit, profitMargin },
  };
};

export interface SalesReport {
  summary: { totalSales: number; totalRevenue: number; averageTicket: number; totalDiscount: number };
  byDay: { date: string; count: number; revenue: number }[];
  byProduct: { productId: string; productName: string; quantity: number; revenue: number }[];
  byPaymentMethod: { method: string; count: number; total: number }[];
  topCustomers: { customerId: string; customerName: string; totalSpent: number; saleCount: number }[];
}

export const getSalesReport = async (dateFrom: string, dateTo: string): Promise<SalesReport> => {
  const companyId = getCompanyId();

  const { data: sales, error: salesErr } = await supabase
    .from('sales')
    .select('id, final_value, discount, payment_method, payment_status, customer_id, created_at, customers(full_name)')
    .eq('company_id', companyId)
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo);
  if (salesErr) throw salesErr;

  const saleIds = (sales || []).map((s) => s.id);

  const { data: items, error: itemsErr } = saleIds.length > 0
    ? await supabase
        .from('sale_items')
        .select('sale_id, product_id, quantity, subtotal, products(name)')
        .in('sale_id', saleIds)
    : { data: [], error: null };
  if (itemsErr) throw itemsErr;

  const paidSales = (sales || []).filter((s) => s.payment_status === 'paid');
  const totalRevenue = paidSales.reduce((sum, s) => sum + Number(s.final_value), 0);
  const totalDiscount = paidSales.reduce((sum, s) => sum + Number(s.discount || 0), 0);
  const totalSales = (sales || []).length;
  const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

  const byDayMap = new Map<string, { count: number; revenue: number }>();
  (sales || []).forEach((s) => {
    const date = new Date(s.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const entry = byDayMap.get(date) || { count: 0, revenue: 0 };
    entry.count += 1;
    if (s.payment_status === 'paid') entry.revenue += Number(s.final_value);
    byDayMap.set(date, entry);
  });
  const byDay = Array.from(byDayMap.entries()).map(([date, v]) => ({ date, count: v.count, revenue: v.revenue })).sort((a, b) => a.date.localeCompare(b.date));

  const byProductMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  (items || []).forEach((item: any) => {
    const id = item.product_id;
    const name = item.products?.name || 'Produto Desconhecido';
    const entry = byProductMap.get(id) || { name, quantity: 0, revenue: 0 };
    entry.quantity += Number(item.quantity);
    entry.revenue += Number(item.subtotal);
    byProductMap.set(id, entry);
  });
  const byProduct = Array.from(byProductMap.entries())
    .map(([productId, v]) => ({ productId, productName: v.name, quantity: v.quantity, revenue: v.revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  const byMethodMap = new Map<string, { count: number; total: number }>();
  (sales || []).forEach((s) => {
    const entry = byMethodMap.get(s.payment_method) || { count: 0, total: 0 };
    entry.count += 1;
    entry.total += Number(s.final_value);
    byMethodMap.set(s.payment_method, entry);
  });
  const byPaymentMethod = Array.from(byMethodMap.entries()).map(([method, v]) => ({ method, count: v.count, total: v.total }));

  const byCustomerMap = new Map<string, { name: string; totalSpent: number; saleCount: number }>();
  (sales || []).forEach((s: any) => {
    const id = s.customer_id;
    const name = s.customers?.full_name || 'Consumidor Final';
    const entry = byCustomerMap.get(id) || { name, totalSpent: 0, saleCount: 0 };
    if (s.payment_status === 'paid') entry.totalSpent += Number(s.final_value);
    entry.saleCount += 1;
    byCustomerMap.set(id, entry);
  });
  const topCustomers = Array.from(byCustomerMap.entries())
    .map(([customerId, v]) => ({ customerId, customerName: v.name, totalSpent: v.totalSpent, saleCount: v.saleCount }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 10);

  return {
    summary: { totalSales, totalRevenue, averageTicket, totalDiscount },
    byDay,
    byProduct,
    byPaymentMethod,
    topCustomers,
  };
};

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
  cashFlow: { date: string; inflows: number; outflows: number; balance: number }[];
  aging: { range: string; receivables: number; payables: number }[];
}

export const getFinancialReport = async (dateFrom: string, dateTo: string): Promise<FinancialReport> => {
  const companyId = getCompanyId();
  const today = new Date().toISOString();

  const { data: receivables, error: recErr } = await supabase
    .from('account_receivables')
    .select('amount, status, due_date')
    .eq('company_id', companyId)
    .gte('due_date', dateFrom)
    .lte('due_date', dateTo);
  if (recErr) throw recErr;

  const { data: payables, error: payErr } = await supabase
    .from('account_payables')
    .select('amount, status, due_date')
    .eq('company_id', companyId)
    .gte('due_date', dateFrom)
    .lte('due_date', dateTo);
  if (payErr) throw payErr;

  const sumBy = (arr: any[], predicate: (x: any) => boolean) => arr.filter(predicate).reduce((sum, x) => sum + Number(x.amount), 0);

  const recTotal = (receivables || []).reduce((sum, r) => sum + Number(r.amount), 0);
  const recPaid = sumBy(receivables || [], (r) => r.status === 'paid');
  const recPending = sumBy(receivables || [], (r) => r.status === 'pending');
  const recOverdue = sumBy(receivables || [], (r) => r.status === 'late' || (r.status === 'pending' && r.due_date < today));

  const payTotal = (payables || []).reduce((sum, p) => sum + Number(p.amount), 0);
  const payPaid = sumBy(payables || [], (p) => p.status === 'paid');
  const payPending = sumBy(payables || [], (p) => p.status === 'pending');
  const payOverdue = sumBy(payables || [], (p) => p.status === 'late' || (p.status === 'pending' && p.due_date < today));

  const groupByDate = (arr: any[]) => {
    const map = new Map<string, number>();
    arr.forEach((x) => {
      const date = new Date(x.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      map.set(date, (map.get(date) || 0) + Number(x.amount));
    });
    return Array.from(map.entries()).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date));
  };

  const cashFlowMap = new Map<string, { inflows: number; outflows: number }>();
  (receivables || []).forEach((r) => {
    const date = new Date(r.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const entry = cashFlowMap.get(date) || { inflows: 0, outflows: 0 };
    entry.inflows += Number(r.amount);
    cashFlowMap.set(date, entry);
  });
  (payables || []).forEach((p) => {
    const date = new Date(p.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const entry = cashFlowMap.get(date) || { inflows: 0, outflows: 0 };
    entry.outflows += Number(p.amount);
    cashFlowMap.set(date, entry);
  });

  let runningBalance = 0;
  const cashFlow = Array.from(cashFlowMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => {
      runningBalance += v.inflows - v.outflows;
      return { date, inflows: v.inflows, outflows: v.outflows, balance: runningBalance };
    });

  const agingRanges = [
    { range: '0-30 dias', min: 0, max: 30 },
    { range: '31-60 dias', min: 31, max: 60 },
    { range: '61-90 dias', min: 61, max: 90 },
    { range: '90+ dias', min: 91, max: Infinity },
  ];

  const daysOverdue = (dueDate: string) => Math.floor((new Date(today).getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));

  const aging = agingRanges.map(({ range, min, max }) => {
    const recSum = (receivables || [])
      .filter((r) => r.status !== 'paid' && daysOverdue(r.due_date) >= min && daysOverdue(r.due_date) <= max)
      .reduce((sum, r) => sum + Number(r.amount), 0);
    const paySum = (payables || [])
      .filter((p) => p.status !== 'paid' && daysOverdue(p.due_date) >= min && daysOverdue(p.due_date) <= max)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    return { range, receivables: recSum, payables: paySum };
  });

  return {
    receivables: { total: recTotal, paid: recPaid, pending: recPending, overdue: recOverdue, byDueDate: groupByDate(receivables || []) },
    payables: { total: payTotal, paid: payPaid, pending: payPending, overdue: payOverdue, byDueDate: groupByDate(payables || []) },
    cashFlow,
    aging,
  };
};

export interface InventoryReport {
  summary: { totalProducts: number; activeProducts: number; totalValue: number; lowStock: number; outOfStock: number };
  byCategory: { categoryName: string; count: number; value: number }[];
  topSellers: { productId: string; productName: string; quantitySold: number; revenue: number }[];
  movements: { date: string; productName: string; type: 'in' | 'out'; quantity: number }[];
}

export const getInventoryReport = async (dateFrom: string, dateTo: string): Promise<InventoryReport> => {
  const companyId = getCompanyId();

  const { data: products, error: productsErr } = await supabase
    .from('products')
    .select('id, name, current_quantity, min_quantity, cost_price, sale_price, is_active, category_id, categories(name)')
    .eq('company_id', companyId);
  if (productsErr) throw productsErr;

  const activeProducts = (products || []).filter((p) => p.is_active);
  const totalValue = activeProducts.reduce((sum, p) => sum + Number(p.current_quantity) * Number(p.cost_price || p.sale_price || 0), 0);
  const lowStock = activeProducts.filter((p) => Number(p.current_quantity) > 0 && Number(p.current_quantity) <= Number(p.min_quantity)).length;
  const outOfStock = activeProducts.filter((p) => Number(p.current_quantity) <= 0).length;

  const byCategoryMap = new Map<string, { count: number; value: number }>();
  activeProducts.forEach((p: any) => {
    const name = p.categories?.name || 'Sem Categoria';
    const entry = byCategoryMap.get(name) || { count: 0, value: 0 };
    entry.count += 1;
    entry.value += Number(p.current_quantity) * Number(p.cost_price || p.sale_price || 0);
    byCategoryMap.set(name, entry);
  });
  const byCategory = Array.from(byCategoryMap.entries()).map(([categoryName, v]) => ({ categoryName, count: v.count, value: v.value }));

  const { data: saleItems, error: saleItemsErr } = await supabase
    .from('sale_items')
    .select('product_id, quantity, subtotal, sales!inner(created_at, company_id)')
    .eq('sales.company_id', companyId)
    .gte('sales.created_at', dateFrom)
    .lte('sales.created_at', dateTo);
  if (saleItemsErr) throw saleItemsErr;

  const productMap = new Map<string, string>();
  (products || []).forEach((p) => productMap.set(p.id, p.name));

  const topSellersMap = new Map<string, { quantitySold: number; revenue: number }>();
  (saleItems || []).forEach((item: any) => {
    const entry = topSellersMap.get(item.product_id) || { quantitySold: 0, revenue: 0 };
    entry.quantitySold += Number(item.quantity);
    entry.revenue += Number(item.subtotal);
    topSellersMap.set(item.product_id, entry);
  });
  const topSellers = Array.from(topSellersMap.entries())
    .map(([productId, v]) => ({ productId, productName: productMap.get(productId) || 'Produto Desconhecido', quantitySold: v.quantitySold, revenue: v.revenue }))
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, 10);

  const { data: purchaseItems, error: purchaseItemsErr } = await supabase
    .from('purchase_items')
    .select('product_id, quantity, purchases!inner(created_at, company_id)')
    .eq('purchases.company_id', companyId)
    .gte('purchases.created_at', dateFrom)
    .lte('purchases.created_at', dateTo);
  if (purchaseItemsErr) throw purchaseItemsErr;

  const movements: InventoryReport['movements'] = [];
  (saleItems || []).forEach((item: any) => {
    movements.push({
      date: new Date(item.sales.created_at).toLocaleDateString('pt-BR'),
      productName: productMap.get(item.product_id) || 'Produto Desconhecido',
      type: 'out',
      quantity: Number(item.quantity),
    });
  });
  (purchaseItems || []).forEach((item: any) => {
    movements.push({
      date: new Date(item.purchases.created_at).toLocaleDateString('pt-BR'),
      productName: productMap.get(item.product_id) || 'Produto Desconhecido',
      type: 'in',
      quantity: Number(item.quantity),
    });
  });

  return {
    summary: { totalProducts: (products || []).length, activeProducts: activeProducts.length, totalValue, lowStock, outOfStock },
    byCategory,
    topSellers,
    movements: movements.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50),
  };
};

export interface CustomerReport {
  summary: { total: number; active: number; newThisPeriod: number; totalRevenue: number };
  topBuyers: { customerId: string; customerName: string; totalSpent: number; saleCount: number; averageTicket: number; lastPurchase: string }[];
  byMonth: { month: string; newCustomers: number; revenue: number }[];
  paymentMethodPreference: { method: string; count: number }[];
}

export const getCustomerReport = async (dateFrom: string, dateTo: string): Promise<CustomerReport> => {
  const companyId = getCompanyId();

  const { data: customers, error: customersErr } = await supabase
    .from('customers')
    .select('id, full_name, is_active, created_at')
    .eq('company_id', companyId);
  if (customersErr) throw customersErr;

  const { data: sales, error: salesErr } = await supabase
    .from('sales')
    .select('customer_id, final_value, payment_method, payment_status, created_at, customers(full_name)')
    .eq('company_id', companyId)
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo);
  if (salesErr) throw salesErr;

  const newThisPeriod = (customers || []).filter((c) => c.created_at >= dateFrom && c.created_at <= dateTo).length;
  const active = (customers || []).filter((c) => c.is_active).length;

  const paidSales = (sales || []).filter((s) => s.payment_status === 'paid');
  const totalRevenue = paidSales.reduce((sum, s) => sum + Number(s.final_value), 0);

  const byCustomerMap = new Map<string, { name: string; totalSpent: number; saleCount: number; lastPurchase: string }>();
  (sales || []).forEach((s: any) => {
    const id = s.customer_id;
    const name = s.customers?.full_name || 'Consumidor Final';
    const entry = byCustomerMap.get(id) || { name, totalSpent: 0, saleCount: 0, lastPurchase: s.created_at };
    if (s.payment_status === 'paid') entry.totalSpent += Number(s.final_value);
    entry.saleCount += 1;
    if (s.created_at > entry.lastPurchase) entry.lastPurchase = s.created_at;
    byCustomerMap.set(id, entry);
  });
  const topBuyers = Array.from(byCustomerMap.entries())
    .map(([customerId, v]) => ({
      customerId,
      customerName: v.name,
      totalSpent: v.totalSpent,
      saleCount: v.saleCount,
      averageTicket: v.saleCount > 0 ? v.totalSpent / v.saleCount : 0,
      lastPurchase: v.lastPurchase,
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 10);

  const byMonthMap = new Map<string, { newCustomers: number; revenue: number }>();
  (customers || []).forEach((c) => {
    const month = new Date(c.created_at).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    const entry = byMonthMap.get(month) || { newCustomers: 0, revenue: 0 };
    entry.newCustomers += 1;
    byMonthMap.set(month, entry);
  });
  paidSales.forEach((s) => {
    const month = new Date(s.created_at).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    const entry = byMonthMap.get(month) || { newCustomers: 0, revenue: 0 };
    entry.revenue += Number(s.final_value);
    byMonthMap.set(month, entry);
  });
  const byMonth = Array.from(byMonthMap.entries()).map(([month, v]) => ({ month, newCustomers: v.newCustomers, revenue: v.revenue }));

  const methodMap = new Map<string, number>();
  (sales || []).forEach((s) => {
    methodMap.set(s.payment_method, (methodMap.get(s.payment_method) || 0) + 1);
  });
  const paymentMethodPreference = Array.from(methodMap.entries()).map(([method, count]) => ({ method, count }));

  return {
    summary: { total: (customers || []).length, active, newThisPeriod, totalRevenue },
    topBuyers,
    byMonth,
    paymentMethodPreference,
  };
};
