import { supabase } from '../lib/supabase';
import { Purchase, PurchaseItem } from '../types';
import { useAuthStore } from '../store/authStore';

const mapDbPurchase = (db: any): Purchase => ({
  id: db.id,
  companyId: db.company_id,
  supplierId: db.supplier_id,
  supplier: db.suppliers ? {
    id: db.suppliers.id,
    companyId: db.suppliers.company_id,
    name: db.suppliers.name,
    email: db.suppliers.email || '',
    phone: db.suppliers.phone || '',
    document: db.suppliers.document,
    status: db.suppliers.status,
    createdAt: db.suppliers.created_at,
  } : undefined,
  totalAmount: Number(db.total_amount || 0),
  discount: Number(db.discount || 0),
  fee: Number(db.fee || 0),
  finalValue: Number(db.final_value || 0),
  status: db.status,
  paymentMethod: db.payment_method,
  notes: db.notes || '',
  createdAt: db.created_at || db.createdAt,
  createdBy: db.created_by,
  createdByName: db.profiles?.name || 'Usuário do Sistema',
});

const mapDbPurchaseItem = (db: any): PurchaseItem => ({
  id: db.id,
  purchaseId: db.purchase_id,
  productId: db.product_id,
  product: db.products ? {
    id: db.products.id,
    companyId: db.products.company_id,
    categoryId: db.products.category_id,
    name: db.products.name,
    description: db.products.description,
    sku: db.products.sku,
    barcode: db.products.barcode,
    unit: db.products.unit,
    costPrice: Number(db.products.cost_price || 0),
    salePrice: Number(db.products.sale_price || 0),
    currentQuantity: Number(db.products.current_quantity || 0),
    minQuantity: Number(db.products.min_quantity || 0),
    maxQuantity: Number(db.products.max_quantity || 0),
    isActive: db.products.is_active,
    createdAt: db.products.created_at,
  } : undefined,
  quantity: Number(db.quantity || 0),
  unitCost: Number(db.unit_cost || 0),
  subtotal: Number(db.subtotal || 0),
});

export interface PurchaseFilters {
  search?: string;
  status?: 'all' | 'paid' | 'pending' | 'canceled';
  dateFrom?: string;
  dateTo?: string;
}

export const getPurchases = async (filters?: PurchaseFilters): Promise<Purchase[]> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  let query = supabase
    .from('purchases')
    .select('*, suppliers(*), profiles(name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters?.dateFrom) {
    query = query.gte('created_at', `${filters.dateFrom}T00:00:00.000Z`);
  }

  if (filters?.dateTo) {
    query = query.lte('created_at', `${filters.dateTo}T23:59:59.999Z`);
  }

  const { data, error } = await query;
  if (error) throw error;

  let result = (data || []).map(mapDbPurchase);

  if (filters?.search) {
    const searchVal = filters.search.toLowerCase();
    result = result.filter(p => p.supplier?.name.toLowerCase().includes(searchVal));
  }

  return result;
};

export interface PurchaseDetailData {
  purchase: Purchase;
  items: PurchaseItem[];
}

export const getPurchaseById = async (id: string): Promise<PurchaseDetailData> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const { data: dbPurchase, error: purchaseErr } = await supabase
    .from('purchases')
    .select('*, suppliers(*), profiles(name)')
    .eq('id', id)
    .eq('company_id', companyId)
    .single();

  if (purchaseErr) throw purchaseErr;
  const purchase = mapDbPurchase(dbPurchase);

  const { data: dbItems, error: itemsErr } = await supabase
    .from('purchase_items')
    .select('*, products(*)')
    .eq('purchase_id', id);

  if (itemsErr) throw itemsErr;
  const items = (dbItems || []).map(mapDbPurchaseItem);

  return { purchase, items };
};

export interface PurchaseSummaryStats {
  purchasesCountThisMonth: number;
  totalSpentThisMonth: number;
  averagePurchaseValue: number;
  pendingPayablesValue: number;
}

export const getPurchaseStats = async (): Promise<PurchaseSummaryStats> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: dbPurchases, error: purchasesErr } = await supabase
    .from('purchases')
    .select('final_value, status, created_at')
    .eq('company_id', companyId);

  if (purchasesErr) throw purchasesErr;

  const currentMonthPurchases = dbPurchases?.filter(p => p.created_at >= startOfMonth) || [];
  const purchasesCountThisMonth = currentMonthPurchases.length;

  const paidCurrentMonth = currentMonthPurchases.filter(p => p.status === 'paid');
  const totalSpentThisMonth = paidCurrentMonth.reduce((sum, p) => sum + Number(p.final_value), 0);

  const averagePurchaseValue = currentMonthPurchases.length > 0
    ? currentMonthPurchases.reduce((sum, p) => sum + Number(p.final_value), 0) / currentMonthPurchases.length
    : 0;

  const pendingPurchases = dbPurchases?.filter(p => p.status === 'pending') || [];
  const pendingPayablesValue = pendingPurchases.reduce((sum, p) => sum + Number(p.final_value), 0);

  return {
    purchasesCountThisMonth,
    totalSpentThisMonth,
    averagePurchaseValue,
    pendingPayablesValue,
  };
};

export interface CreatePurchaseInput {
  supplierId: string;
  items: {
    productId: string;
    quantity: number;
    unitCost: number;
  }[];
  discount: number;
  fee: number;
  paymentMethod: string;
  paymentStatus: 'paid' | 'pending' | 'canceled';
  notes?: string;
}

export const createPurchase = async (data: CreatePurchaseInput): Promise<Purchase> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');
  const createdBy = useAuthStore.getState().profile?.id;
  if (!createdBy) throw new Error('Usuário não identificado.');

  const newPurchaseId = `CMP-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

  const subtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
  const finalValue = Math.max(0, subtotal - data.discount + data.fee);

  const dbInsertPurchase = {
    id: newPurchaseId,
    company_id: companyId,
    supplier_id: data.supplierId,
    total_amount: subtotal,
    discount: data.discount,
    fee: data.fee,
    final_value: finalValue,
    status: data.paymentStatus,
    payment_method: data.paymentMethod,
    notes: data.notes || '',
    created_by: createdBy,
  };

  const dbInsertItems = data.items.map(item => ({
    id: `CMPIT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    purchase_id: newPurchaseId,
    product_id: item.productId,
    quantity: item.quantity,
    unit_cost: item.unitCost,
    subtotal: item.quantity * item.unitCost,
  }));

  const dbInsertPayable = {
    id: `PAG-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    company_id: companyId,
    purchase_id: newPurchaseId,
    supplier_id: data.supplierId,
    amount: finalValue,
    due_date: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    status: data.paymentStatus === 'paid' ? 'paid' : data.paymentStatus === 'canceled' ? 'canceled' : 'pending',
    description: `Pagamento de Compra ${newPurchaseId}`,
  };

  const { error: purchaseErr } = await supabase.from('purchases').insert(dbInsertPurchase);
  if (purchaseErr) throw purchaseErr;

  const { error: itemsErr } = await supabase.from('purchase_items').insert(dbInsertItems);
  if (itemsErr) throw itemsErr;

  for (const item of data.items) {
    const { data: prodData, error: readErr } = await supabase
      .from('products')
      .select('current_quantity')
      .eq('id', item.productId)
      .eq('company_id', companyId)
      .single();

    if (!readErr && prodData) {
      const nextQty = Number(prodData.current_quantity) + item.quantity;
      await supabase.from('products').update({ current_quantity: nextQty }).eq('id', item.productId).eq('company_id', companyId);
    }
  }

  const { error: payableErr } = await supabase.from('account_payables').insert(dbInsertPayable);
  if (payableErr) throw payableErr;

  const { data: freshPurchase, error: fetchErr } = await supabase
    .from('purchases')
    .select('*, suppliers(*), profiles(name)')
    .eq('id', newPurchaseId)
    .eq('company_id', companyId)
    .single();

  if (fetchErr) throw fetchErr;
  return mapDbPurchase(freshPurchase);
};

export const updatePurchaseStatus = async (id: string, status: 'paid' | 'pending' | 'canceled'): Promise<Purchase> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const { data: dbPurchase, error: purchaseErr } = await supabase
    .from('purchases')
    .update({ status })
    .eq('id', id)
    .eq('company_id', companyId)
    .select('*, suppliers(*), profiles(name)')
    .single();

  if (purchaseErr) throw purchaseErr;

  await supabase
    .from('account_payables')
    .update({ status })
    .eq('purchase_id', id)
    .eq('company_id', companyId);

  return mapDbPurchase(dbPurchase);
};

export const cancelPurchase = async (id: string): Promise<Purchase> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const { data: dbItems, error: itemsErr } = await supabase
    .from('purchase_items')
    .select('product_id, quantity')
    .eq('purchase_id', id);

  if (itemsErr) throw itemsErr;

  for (const item of dbItems || []) {
    const { data: prodData, error: readErr } = await supabase
      .from('products')
      .select('current_quantity')
      .eq('id', item.product_id)
      .eq('company_id', companyId)
      .single();

    if (!readErr && prodData) {
      const nextQty = Math.max(0, Number(prodData.current_quantity) - Number(item.quantity));
      await supabase.from('products').update({ current_quantity: nextQty }).eq('id', item.product_id).eq('company_id', companyId);
    }
  }

  const { data: dbPurchase, error: purchaseErr } = await supabase
    .from('purchases')
    .update({ status: 'canceled' })
    .eq('id', id)
    .eq('company_id', companyId)
    .select('*, suppliers(*), profiles(name)')
    .single();

  if (purchaseErr) throw purchaseErr;

  await supabase
    .from('account_payables')
    .update({ status: 'canceled' })
    .eq('purchase_id', id)
    .eq('company_id', companyId);

  return mapDbPurchase(dbPurchase);
};
