import { supabase } from '../lib/supabase';
import {
  AccountReceivable,
  AccountPayable,
  FinancialCategory,
  TransactionStatus,
  PaymentMethod,
} from '../types';
import { useAuthStore } from '../store/authStore';

const mapDbReceivable = (db: any): AccountReceivable => ({
  id: db.id,
  companyId: db.company_id,
  saleId: db.sale_id || undefined,
  customerId: db.customer_id,
  customer: db.customers
    ? {
        id: db.customers.id,
        companyId: db.customers.company_id,
        fullName: db.customers.full_name,
        document: db.customers.document,
        email: db.customers.email || '',
        phone: db.customers.phone || '',
        address: db.customers.address || '',
        isActive: db.customers.is_active,
        createdAt: db.customers.created_at,
      }
    : undefined,
  amount: Number(db.amount || 0),
  dueDate: db.due_date,
  status: db.status,
  paidAt: db.paid_at || undefined,
  paymentMethod: db.payment_method || undefined,
  description: db.description || '',
});

const mapDbPayable = (db: any): AccountPayable => ({
  id: db.id,
  companyId: db.company_id,
  purchaseId: db.purchase_id || undefined,
  supplierId: db.supplier_id || '',
  supplier: db.suppliers
    ? {
        id: db.suppliers.id,
        companyId: db.suppliers.company_id,
        name: db.suppliers.name,
        email: db.suppliers.email || '',
        phone: db.suppliers.phone || '',
        document: db.suppliers.document,
        status: db.suppliers.status,
        createdAt: db.suppliers.created_at,
      }
    : undefined,
  amount: Number(db.amount || 0),
  dueDate: db.due_date,
  status: db.status,
  paidAt: db.paid_at || undefined,
  paymentMethod: db.payment_method || undefined,
  description: db.description || '',
});

const mapDbCategory = (db: any): FinancialCategory => ({
  id: db.id,
  companyId: db.company_id,
  name: db.name,
  type: db.type,
  color: db.color || '#10b981',
  createdAt: db.created_at || db.createdAt,
  updatedAt: db.updated_at || db.updatedAt,
});

export interface FinancialFilters {
  status?: TransactionStatus | 'all';
  startDate?: string;
  endDate?: string;
}

export interface ManualReceivableInput {
  customerId: string;
  amount: number;
  dueDate: string;
  description?: string;
}

export interface ManualPayableInput {
  supplierId?: string;
  amount: number;
  dueDate: string;
  description?: string;
}

export interface CategoryInput {
  name: string;
  type: FinancialCategory['type'];
  color: string;
}

export interface CashFlowPoint {
  date: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

export interface CashFlowRange {
  days: number;
}

export const getReceivables = async (filters?: FinancialFilters): Promise<AccountReceivable[]> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  let query = supabase
    .from('account_receivables')
    .select('*, customers(*)')
    .eq('company_id', companyId)
    .order('due_date', { ascending: false });

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters?.startDate) {
    query = query.gte('due_date', `${filters.startDate}T00:00:00.000Z`);
  }

  if (filters?.endDate) {
    query = query.lte('due_date', `${filters.endDate}T23:59:59.999Z`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(mapDbReceivable);
};

export const getPayables = async (filters?: FinancialFilters): Promise<AccountPayable[]> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  let query = supabase
    .from('account_payables')
    .select('*, suppliers(*)')
    .eq('company_id', companyId)
    .order('due_date', { ascending: false });

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters?.startDate) {
    query = query.gte('due_date', `${filters.startDate}T00:00:00.000Z`);
  }

  if (filters?.endDate) {
    query = query.lte('due_date', `${filters.endDate}T23:59:59.999Z`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(mapDbPayable);
};

export const updateReceivableStatus = async (
  id: string,
  status: TransactionStatus,
  paymentMethod?: PaymentMethod,
): Promise<AccountReceivable> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const payload: Record<string, unknown> = { status };
  if (status === 'paid') {
    payload.paid_at = new Date().toISOString();
    if (paymentMethod) payload.payment_method = paymentMethod;
  } else {
    payload.paid_at = null;
  }

  const { data, error } = await supabase
    .from('account_receivables')
    .update(payload)
    .eq('id', id)
    .eq('company_id', companyId)
    .select('*, customers(*)')
    .single();

  if (error) throw error;
  return mapDbReceivable(data);
};

export const updatePayableStatus = async (
  id: string,
  status: TransactionStatus,
  paymentMethod?: PaymentMethod,
): Promise<AccountPayable> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const payload: Record<string, unknown> = { status };
  if (status === 'paid') {
    payload.paid_at = new Date().toISOString();
    if (paymentMethod) payload.payment_method = paymentMethod;
  } else {
    payload.paid_at = null;
  }

  const { data, error } = await supabase
    .from('account_payables')
    .update(payload)
    .eq('id', id)
    .eq('company_id', companyId)
    .select('*, suppliers(*)')
    .single();

  if (error) throw error;
  return mapDbPayable(data);
};

export const createManualReceivable = async (
  input: ManualReceivableInput,
): Promise<AccountReceivable> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const dbInsert = {
    id: `REC-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    company_id: companyId,
    customer_id: input.customerId,
    amount: input.amount,
    due_date: new Date(input.dueDate).toISOString(),
    status: 'pending' as TransactionStatus,
    payment_method: '',
    description: input.description || '',
  };

  const { data, error } = await supabase
    .from('account_receivables')
    .insert(dbInsert)
    .select('*, customers(*)')
    .single();

  if (error) throw error;
  return mapDbReceivable(data);
};

export const createManualPayable = async (
  input: ManualPayableInput,
): Promise<AccountPayable> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const dbInsert = {
    id: `PAG-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    company_id: companyId,
    supplier_id: input.supplierId || null,
    amount: input.amount,
    due_date: new Date(input.dueDate).toISOString(),
    status: 'pending' as TransactionStatus,
    payment_method: '',
    description: input.description || '',
  };

  const { data, error } = await supabase
    .from('account_payables')
    .insert(dbInsert)
    .select('*, suppliers(*)')
    .single();

  if (error) throw error;
  return mapDbPayable(data);
};

export const getCashFlow = async (range: CashFlowRange): Promise<CashFlowPoint[]> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const totalDays = range?.days && range.days > 0 ? range.days : 7;
  const start = new Date();
  start.setDate(start.getDate() - (totalDays - 1));
  start.setHours(0, 0, 0, 0);
  const startIso = start.toISOString();

  const { data: recData, error: recErr } = await supabase
    .from('account_receivables')
    .select('amount, status, paid_at')
    .eq('company_id', companyId)
    .eq('status', 'paid')
    .gte('paid_at', startIso);

  if (recErr) throw recErr;

  const { data: payData, error: payErr } = await supabase
    .from('account_payables')
    .select('amount, status, paid_at')
    .eq('company_id', companyId)
    .eq('status', 'paid')
    .gte('paid_at', startIso);

  if (payErr) throw payErr;

  const buckets = Array.from({ length: totalDays }).map((_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return {
      dateStr: d.toDateString(),
      date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      entradas: 0,
      saidas: 0,
      saldo: 0,
    };
  });

  recData?.forEach((r) => {
    if (!r.paid_at) return;
    const key = new Date(r.paid_at).toDateString();
    const match = buckets.find((b) => b.dateStr === key);
    if (match) match.entradas += Number(r.amount || 0);
  });

  payData?.forEach((p) => {
    if (!p.paid_at) return;
    const key = new Date(p.paid_at).toDateString();
    const match = buckets.find((b) => b.dateStr === key);
    if (match) match.saidas += Number(p.amount || 0);
  });

  return buckets.map((b) => ({
    date: b.date,
    entradas: b.entradas,
    saidas: b.saidas,
    saldo: b.entradas - b.saidas,
  }));
};

export const getCategories = async (): Promise<FinancialCategory[]> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const { data, error } = await supabase
    .from('financial_categories')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapDbCategory);
};

export const createCategory = async (input: CategoryInput): Promise<FinancialCategory> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const dbInsert = {
    id: crypto.randomUUID(),
    company_id: companyId,
    name: input.name,
    type: input.type,
    color: input.color,
  };

  const { data, error } = await supabase
    .from('financial_categories')
    .insert(dbInsert)
    .select()
    .single();

  if (error) throw error;
  return mapDbCategory(data);
};

export const updateCategory = async (
  id: string,
  input: Partial<CategoryInput>,
): Promise<FinancialCategory> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) payload.name = input.name;
  if (input.type !== undefined) payload.type = input.type;
  if (input.color !== undefined) payload.color = input.color;

  const { data, error } = await supabase
    .from('financial_categories')
    .update(payload)
    .eq('id', id)
    .eq('company_id', companyId)
    .select()
    .single();

  if (error) throw error;
  return mapDbCategory(data);
};

export const deleteCategory = async (id: string): Promise<void> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const { error } = await supabase
    .from('financial_categories')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId);

  if (error) throw error;
};
