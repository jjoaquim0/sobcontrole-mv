import { supabase } from '../lib/supabase';
import { Supplier } from '../types';
import { useAuthStore } from '../store/authStore';

const mapDbSupplier = (db: any): Supplier => ({
  id: db.id,
  companyId: db.company_id,
  name: db.name,
  email: db.email || '',
  phone: db.phone || '',
  document: db.document,
  status: db.status,
  createdAt: db.created_at || db.createdAt,
});

export const getSuppliers = async (filters?: {
  search?: string;
  status?: 'active' | 'inactive' | 'all';
}): Promise<Supplier[]> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  let query = supabase
    .from('suppliers')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (filters?.status === 'active') {
    query = query.eq('status', 'active');
  } else if (filters?.status === 'inactive') {
    query = query.eq('status', 'inactive');
  }

  if (filters?.search) {
    const searchVal = `%${filters.search}%`;
    query = query.or(`name.ilike.${searchVal},email.ilike.${searchVal},phone.ilike.${searchVal},document.ilike.${searchVal}`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(mapDbSupplier);
};

export const createSupplier = async (
  data: Omit<Supplier, 'id' | 'companyId' | 'status' | 'createdAt'>
): Promise<Supplier> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');
  const newId = crypto.randomUUID();

  const dbInsert = {
    id: newId,
    company_id: companyId,
    name: data.name,
    document: data.document,
    email: data.email,
    phone: data.phone,
    status: 'active',
  };

  const { data: dbSupplier, error } = await supabase
    .from('suppliers')
    .insert(dbInsert)
    .select()
    .single();

  if (error) throw error;
  return mapDbSupplier(dbSupplier);
};

export const updateSupplier = async (
  id: string,
  data: Partial<Omit<Supplier, 'id' | 'companyId' | 'createdAt'>>
): Promise<Supplier> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const dbPayload: any = {};
  if (data.name !== undefined) dbPayload.name = data.name;
  if (data.document !== undefined) dbPayload.document = data.document;
  if (data.email !== undefined) dbPayload.email = data.email;
  if (data.phone !== undefined) dbPayload.phone = data.phone;
  if (data.status !== undefined) dbPayload.status = data.status;

  const { data: dbSupplier, error } = await supabase
    .from('suppliers')
    .update(dbPayload)
    .eq('id', id)
    .eq('company_id', companyId)
    .select()
    .single();

  if (error) throw error;
  return mapDbSupplier(dbSupplier);
};

export const toggleSupplierStatus = async (
  id: string,
  isActive: boolean
): Promise<Supplier> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const { data: dbSupplier, error } = await supabase
    .from('suppliers')
    .update({ status: isActive ? 'active' : 'inactive' })
    .eq('id', id)
    .eq('company_id', companyId)
    .select()
    .single();

  if (error) throw error;
  return mapDbSupplier(dbSupplier);
};

export interface SupplierDetail {
  supplier: Supplier;
  metrics: {
    totalPurchasesCount: number;
    totalSpent: number;
    averageTicket: number;
    lastPurchaseDate: string | null;
    preferredPaymentMethod: string;
  };
  purchaseHistory: {
    id: string;
    createdAt: string;
    products: string;
    totalAmount: number;
    status: 'paid' | 'pending' | 'canceled';
  }[];
}

const getPreferredPurchaseMethod = (purchases: any[]): string => {
  const paymentMethods = purchases.map((p) => p.payment_method).filter(Boolean);
  if (paymentMethods.length === 0) return 'Nenhum';
  const countMap: Record<string, number> = {};
  let preferred = 'Nenhum';
  let maxCount = 0;

  const translations: Record<string, string> = {
    money: 'Dinheiro',
    cash: 'Dinheiro',
    credit_card: 'Cartão de Crédito',
    debit_card: 'Cartão de Débito',
    pix: 'Pix',
    bank_slip: 'Boleto Bancário',
    bank_transfer: 'Transferência',
  };

  paymentMethods.forEach((method) => {
    countMap[method] = (countMap[method] || 0) + 1;
    if (countMap[method] > maxCount) {
      maxCount = countMap[method];
      preferred = translations[method] || method;
    }
  });

  return preferred;
};

export const getSupplierById = async (id: string): Promise<SupplierDetail> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const { data: dbSupplier, error: supplierErr } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .eq('company_id', companyId)
    .single();

  if (supplierErr) throw supplierErr;
  const supplier = mapDbSupplier(dbSupplier);

  const { data: dbPurchases, error: purchasesErr } = await supabase
    .from('purchases')
    .select(`
      id,
      final_value,
      status,
      created_at,
      payment_method,
      purchase_items(
        quantity,
        products(
          name
        )
      )
    `)
    .eq('supplier_id', id)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (purchasesErr) throw purchasesErr;

  const purchasesList = dbPurchases || [];
  const paidPurchases = purchasesList.filter((p: any) => p.status === 'paid');

  const totalSpent = paidPurchases.reduce((sum, p) => sum + Number(p.final_value), 0);
  const lastPurchaseDate = purchasesList.length > 0 ? purchasesList[0].created_at : null;
  const averageTicket = purchasesList.length > 0 ? totalSpent / purchasesList.length : 0;
  const preferredPaymentMethod = getPreferredPurchaseMethod(purchasesList);

  const purchaseHistory = purchasesList.map((p: any) => {
    const items = p.purchase_items || [];
    const names = items.map((item: any) => item.products?.name).filter(Boolean);

    let productsStr = 'Compra de Produtos';
    if (names.length > 0) {
      if (names.length <= 2) {
        productsStr = names.join(', ');
      } else {
        productsStr = `${names.slice(0, 2).join(', ')} e mais ${names.length - 2}`;
      }
    }

    return {
      id: p.id,
      createdAt: p.created_at,
      products: productsStr,
      totalAmount: Number(p.final_value),
      status: p.status as any,
    };
  });

  return {
    supplier,
    metrics: {
      totalPurchasesCount: purchasesList.length,
      totalSpent,
      averageTicket,
      lastPurchaseDate,
      preferredPaymentMethod,
    },
    purchaseHistory,
  };
};
