import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export interface SalesStats {
  totalSales: number;
  monthlyRevenue: number;
  averageTicket: number;
  salesVariance: number;
  revenueVariance: number;
  ticketVariance: number;
}

export interface InventoryStats {
  lowStockCount: number;
  totalInventoryValue: number;
}

export interface CustomerStats {
  activeCustomers: number;
  newCustomersThisMonth: number;
}

export interface FinancialSummary {
  toReceive: number;
  toPay: number;
  overdueReceive: number;
  overduePay: number;
}

export interface RecentActivity {
  id: string;
  description: string;
  type: 'sale' | 'payable' | 'receivable';
  value: number;
  status: 'paid' | 'pending' | 'late' | 'canceled';
  date: string;
}

export interface WeeklySales {
  day: string;
  value: number;
}

export interface TopProduct {
  id: string;
  name: string;
  quantity: number;
  value: number;
}

/**
 * Retorna as estatísticas de vendas do mês atual e a variação contra o mês anterior.
 */
export const getSalesStats = async (): Promise<SalesStats> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const startCurrent = new Date(currentYear, currentMonth, 1).toISOString();
  const endCurrent = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999).toISOString();

  const startPrev = new Date(currentYear, currentMonth - 1, 1).toISOString();
  const endPrev = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999).toISOString();

  // Vendas do mês atual
  const { data: currSales, error: currErr } = await supabase
    .from('sales')
    .select('final_value, payment_status')
    .eq('company_id', companyId)
    .gte('created_at', startCurrent)
    .lte('created_at', endCurrent);

  if (currErr) throw currErr;

  // Vendas do mês anterior
  const { data: prevSales, error: prevErr } = await supabase
    .from('sales')
    .select('final_value, payment_status')
    .eq('company_id', companyId)
    .gte('created_at', startPrev)
    .lte('created_at', endPrev);

  if (prevErr) throw prevErr;

  const totalSalesCurrent = currSales?.length || 0;
  const paidSalesCurrent = currSales?.filter((s) => s.payment_status === 'paid') || [];
  const revenueCurrent = paidSalesCurrent.reduce((sum, s) => sum + Number(s.final_value), 0);
  const averageTicketCurrent = totalSalesCurrent > 0 ? revenueCurrent / totalSalesCurrent : 0;

  const totalSalesPrev = prevSales?.length || 0;
  const paidSalesPrev = prevSales?.filter((s) => s.payment_status === 'paid') || [];
  const revenuePrev = paidSalesPrev.reduce((sum, s) => sum + Number(s.final_value), 0);
  const averageTicketPrev = totalSalesPrev > 0 ? revenuePrev / totalSalesPrev : 0;

  const calcVariance = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };

  return {
    totalSales: totalSalesCurrent,
    monthlyRevenue: revenueCurrent,
    averageTicket: averageTicketCurrent,
    salesVariance: calcVariance(totalSalesCurrent, totalSalesPrev),
    revenueVariance: calcVariance(revenueCurrent, revenuePrev),
    ticketVariance: calcVariance(averageTicketCurrent, averageTicketPrev),
  };
};

/**
 * Retorna estatísticas de estoque como itens com nível baixo e valor total do estoque.
 */
export const getInventoryStats = async (): Promise<InventoryStats> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const { data, error } = await supabase
    .from('products')
    .select('current_quantity, min_quantity, sale_price, cost_price')
    .eq('is_active', true)
    .eq('company_id', companyId);

  if (error) throw error;

  const lowStockCount = data?.filter((p) => Number(p.current_quantity) <= Number(p.min_quantity)).length || 0;
  const totalInventoryValue = data?.reduce((sum, p) => sum + (Number(p.current_quantity) * Number(p.cost_price || p.sale_price || 0)), 0) || 0;

  return {
    lowStockCount,
    totalInventoryValue,
  };
};

/**
 * Retorna as estatísticas de clientes ativos e novos no mês.
 */
export const getCustomerStats = async (): Promise<CustomerStats> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const now = new Date();
  const startCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: activeData, error: activeErr } = await supabase
    .from('customers')
    .select('id')
    .eq('is_active', true)
    .eq('company_id', companyId);

  if (activeErr) throw activeErr;

  const { data: newData, error: newErr } = await supabase
    .from('customers')
    .select('id')
    .eq('company_id', companyId)
    .gte('created_at', startCurrentMonth);

  if (newErr) throw newErr;

  return {
    activeCustomers: activeData?.length || 0,
    newCustomersThisMonth: newData?.length || 0,
  };
};

/**
 * Retorna o resumo financeiro com contas a pagar/receber e montantes vencidos.
 */
export const getFinancialSummary = async (): Promise<FinancialSummary> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const today = new Date().toISOString();

  const { data: recData, error: recErr } = await supabase
    .from('account_receivables')
    .select('amount, status, due_date')
    .eq('company_id', companyId);

  if (recErr) throw recErr;

  const { data: payData, error: payErr } = await supabase
    .from('account_payables')
    .select('amount, status, due_date')
    .eq('company_id', companyId);

  if (payErr) throw payErr;

  const toReceive = recData?.filter((r) => r.status === 'pending').reduce((sum, r) => sum + Number(r.amount), 0) || 0;
  const overdueReceive = recData?.filter((r) => r.status === 'late' || (r.status === 'pending' && r.due_date < today)).reduce((sum, r) => sum + Number(r.amount), 0) || 0;

  const toPay = payData?.filter((p) => p.status === 'pending').reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const overduePay = payData?.filter((p) => p.status === 'late' || (p.status === 'pending' && p.due_date < today)).reduce((sum, p) => sum + Number(p.amount), 0) || 0;

  return {
    toReceive,
    toPay,
    overdueReceive,
    overduePay,
  };
};

/**
 * Consolida as movimentações recentes (vendas e faturas financeiras).
 */
export const getRecentActivity = async (limit: number = 5): Promise<RecentActivity[]> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const { data: sales, error: salesErr } = await supabase
    .from('sales')
    .select('id, final_value, payment_status, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (salesErr) throw salesErr;

  const { data: payables, error: payErr } = await supabase
    .from('account_payables')
    .select('id, amount, status, due_date, description')
    .eq('company_id', companyId)
    .order('due_date', { ascending: false })
    .limit(limit);

  if (payErr) throw payErr;

  const { data: receivables, error: recErr } = await supabase
    .from('account_receivables')
    .select('id, amount, status, due_date, description')
    .eq('company_id', companyId)
    .order('due_date', { ascending: false })
    .limit(limit);

  if (recErr) throw recErr;

  const activities: RecentActivity[] = [];

  sales?.forEach((s) => {
    const statusMap = s.payment_status === 'cancelled' ? 'canceled' : s.payment_status;
    activities.push({
      id: s.id,
      description: `Venda registrada - #${s.id.slice(0, 6)}`,
      type: 'sale',
      value: Number(s.final_value),
      status: statusMap as any,
      date: s.created_at,
    });
  });

  payables?.forEach((p) => {
    activities.push({
      id: p.id,
      description: p.description || 'Conta a Pagar',
      type: 'payable',
      value: Number(p.amount),
      status: p.status as any,
      date: p.due_date,
    });
  });

  receivables?.forEach((r) => {
    activities.push({
      id: r.id,
      description: r.description || 'Conta a Receber',
      type: 'receivable',
      value: Number(r.amount),
      status: r.status as any,
      date: r.due_date,
    });
  });

  return activities
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
};

/**
 * Retorna o faturamento dos últimos 7 dias.
 */
export const getWeeklySales = async (): Promise<WeeklySales[]> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const start = sevenDaysAgo.toISOString();

  const { data, error } = await supabase
    .from('sales')
    .select('final_value, created_at')
    .eq('company_id', companyId)
    .gte('created_at', start);

  if (error) throw error;

  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const result = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      day: days[d.getDay()],
      dateStr: d.toDateString(),
      value: 0,
    };
  });

  data?.forEach((s) => {
    const saleDate = new Date(s.created_at).toDateString();
    const match = result.find((r) => r.dateStr === saleDate);
    if (match) {
      match.value += Number(s.final_value);
    }
  });

  return result.map((r) => ({ day: r.day, value: r.value }));
};

/**
 * Retorna os produtos mais vendidos no mês.
 */
export const getTopProducts = async (limit: number = 3): Promise<TopProduct[]> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const { data: prods, error: prodErr } = await supabase
    .from('products')
    .select('id, name')
    .eq('company_id', companyId);

  if (prodErr) throw prodErr;

  const productMap = new Map<string, string>();
  prods?.forEach((p) => productMap.set(p.id, p.name));

  const { data, error } = await supabase
    .from('sale_items')
    .select('quantity, subtotal, product_id');

  if (error) throw error;

  const counts: Record<string, { quantity: number; value: number; name: string }> = {};
  data?.forEach((item) => {
    const prodId = item.product_id;
    if (productMap.has(prodId)) {
      const name = productMap.get(prodId) || 'Produto Desconhecido';
      if (!counts[prodId]) {
        counts[prodId] = { quantity: 0, value: 0, name };
      }
      counts[prodId].quantity += Number(item.quantity);
      counts[prodId].value += Number(item.subtotal);
    }
  });

  return Object.entries(counts)
    .map(([id, stats]) => ({
      id,
      name: stats.name,
      quantity: stats.quantity,
      value: stats.value,
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
};

/**
 * Retorna a saúde financeira da empresa (percentual de contas pagas no total geral).
 */
export const getFinancialHealth = async (): Promise<number> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const { data: rec, error: recErr } = await supabase
    .from('account_receivables')
    .select('status')
    .eq('company_id', companyId);

  if (recErr) throw recErr;

  const { data: pay, error: payErr } = await supabase
    .from('account_payables')
    .select('status')
    .eq('company_id', companyId);

  if (payErr) throw payErr;

  const totalRec = rec?.length || 0;
  const paidRec = rec?.filter((r) => r.status === 'paid').length || 0;

  const totalPay = pay?.length || 0;
  const paidPay = pay?.filter((p) => p.status === 'paid').length || 0;

  const total = totalRec + totalPay;
  const paid = paidRec + paidPay;

  if (total === 0) return 100;
  return (paid / total) * 100;
};
