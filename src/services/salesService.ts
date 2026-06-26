import { supabase } from '../lib/supabase';
import { Sale, SaleItem } from '../types';
import { useAuthStore } from '../store/authStore';

// Helper maps DB snake_case to Frontend CamelCase
const mapDbSale = (db: any): Sale => ({
  id: db.id,
  companyId: db.company_id,
  customerId: db.customer_id,
  customer: db.customers ? {
    id: db.customers.id,
    companyId: db.customers.company_id,
    fullName: db.customers.full_name,
    document: db.customers.document,
    email: db.customers.email || '',
    phone: db.customers.phone || '',
    address: db.customers.address || '{}',
    isActive: db.customers.is_active,
    createdAt: db.customers.created_at,
  } : undefined,
  sellerId: db.seller_id,
  sellerName: db.profiles?.name || 'Vendedor Comercial',
  total: Number(db.total || 0),
  discount: Number(db.discount || 0),
  fee: Number(db.fee || 0),
  finalValue: Number(db.final_value || 0),
  paymentMethod: db.payment_method,
  paymentStatus: db.payment_status,
  notes: db.notes || '',
  createdAt: db.created_at || db.createdAt,
});

const mapDbSaleItem = (db: any): SaleItem => ({
  id: db.id,
  saleId: db.sale_id,
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
  unitPrice: Number(db.unit_price || 0),
  subtotal: Number(db.subtotal || 0),
});

/**
 * Fetch sales list applying filters
 */
export interface SaleFilters {
  search?: string;
  paymentStatus?: 'all' | 'paid' | 'pending' | 'cancelled';
  dateFrom?: string;
  dateTo?: string;
}

export const getSales = async (filters?: SaleFilters): Promise<Sale[]> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  let query = supabase
    .from('sales')
    .select('*, customers(*), profiles(name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (filters?.paymentStatus && filters.paymentStatus !== 'all') {
    query = query.eq('payment_status', filters.paymentStatus);
  }
  
  if (filters?.dateFrom) {
    query = query.gte('created_at', `${filters.dateFrom}T00:00:00.000Z`);
  }

  if (filters?.dateTo) {
    query = query.lte('created_at', `${filters.dateTo}T23:59:59.999Z`);
  }

  const { data, error } = await query;
  if (error) throw error;

  let result = (data || []).map(mapDbSale);

  if (filters?.search) {
    const searchVal = filters.search.toLowerCase();
    result = result.filter(s => s.customer?.fullName.toLowerCase().includes(searchVal));
  }

  return result;
};

/**
 * Fetch a complete sale object by id, including nested items, product models and seller names
 */
export interface SaleDetailData {
  sale: Sale;
  items: SaleItem[];
}

export const getSaleById = async (id: string): Promise<SaleDetailData> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const { data: dbSale, error: saleErr } = await supabase
    .from('sales')
    .select('*, customers(*), profiles(name)')
    .eq('id', id)
    .eq('company_id', companyId)
    .single();

  if (saleErr) throw saleErr;
  const sale = mapDbSale(dbSale);

  const { data: dbItems, error: itemsErr } = await supabase
    .from('sale_items')
    .select('*, products(*)')
    .eq('sale_id', id);

  if (itemsErr) throw itemsErr;
  const items = dbItems.map(mapDbSaleItem);

  return { sale, items };
};

/**
 * Fetch consolidated dashboard metrics for sales
 */
export interface SalesSummaryStats {
  salesCountThisMonth: number;
  revenueThisMonth: number;
  averageTicket: number;
  receivablePendingValue: number;
}

export const getSalesStats = async (): Promise<SalesSummaryStats> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: dbSales, error: salesErr } = await supabase
    .from('sales')
    .select('final_value, payment_status, created_at')
    .eq('company_id', companyId);

  if (salesErr) throw salesErr;

  const currentMonthSales = dbSales?.filter(s => s.created_at >= startOfMonth) || [];
  const salesCountThisMonth = currentMonthSales.length;

  const paidCurrentMonth = currentMonthSales.filter(s => s.payment_status === 'paid');
  const revenueThisMonth = paidCurrentMonth.reduce((sum, s) => sum + Number(s.final_value), 0);

  const averageTicket = paidCurrentMonth.length > 0 ? revenueThisMonth / paidCurrentMonth.length : 0;

  const pendingSales = dbSales?.filter(s => s.payment_status === 'pending') || [];
  const receivablePendingValue = pendingSales.reduce((sum, s) => sum + Number(s.final_value), 0);

  return {
    salesCountThisMonth,
    revenueThisMonth,
    averageTicket,
    receivablePendingValue
  };
};

/**
 * Inserts a new sale, its items, decrements the product stocks, and creates a receivable log
 */
export interface CreateSaleInput {
  customerId: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
  }[];
  discount: number;
  fee: number;
  paymentMethod: 'cash' | 'credit_card' | 'debit_card' | 'pix' | 'bank_transfer' | 'other';
  paymentStatus: 'paid' | 'pending' | 'cancelled';
  notes?: string;
}

export const createSale = async (data: CreateSaleInput): Promise<Sale> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');
  const sellerId = useAuthStore.getState().profile?.id;
  if (!sellerId) throw new Error('Usuário/Vendedor não identificado.');
  
  const newSaleId = `VND-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

  // Computations
  const subtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const finalValue = Math.max(0, subtotal - data.discount + data.fee);

  const dbInsertSale = {
    id: newSaleId,
    company_id: companyId,
    customer_id: data.customerId,
    seller_id: sellerId,
    total: subtotal,
    discount: data.discount,
    fee: data.fee,
    final_value: finalValue,
    payment_method: data.paymentMethod,
    payment_status: data.paymentStatus,
    notes: data.notes || ''
  };

  const dbInsertItems = data.items.map(item => ({
    id: `VNDIT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    sale_id: newSaleId,
    product_id: item.productId,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    subtotal: item.quantity * item.unitPrice
  }));

  const dbInsertReceivable = {
    id: `REC-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    company_id: companyId,
    sale_id: newSaleId,
    customer_id: data.customerId,
    amount: finalValue,
    due_date: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(), // 30 days due
    status: data.paymentStatus === 'paid' ? 'paid' : data.paymentStatus === 'cancelled' ? 'canceled' : 'pending',
    description: `Recebimento de Venda ${newSaleId}`
  };

  // DB insertions in sequence
  const { error: saleErr } = await supabase.from('sales').insert(dbInsertSale);
  if (saleErr) throw saleErr;

  const { error: itemsErr } = await supabase.from('sale_items').insert(dbInsertItems);
  if (itemsErr) throw itemsErr;

  // Decrement stock for each item in Supabase
  for (const item of data.items) {
    const { data: prodData, error: readErr } = await supabase
      .from('products')
      .select('current_quantity')
      .eq('id', item.productId)
      .eq('company_id', companyId)
      .single();
    
    if (!readErr && prodData) {
      const nextQty = Math.max(0, Number(prodData.current_quantity) - item.quantity);
      await supabase.from('products').update({ current_quantity: nextQty }).eq('id', item.productId).eq('company_id', companyId);
    }
  }

  // Insert accounts receivable
  const { error: recErr } = await supabase.from('account_receivables').insert(dbInsertReceivable);
  if (recErr) throw recErr;

  const { data: freshSale, error: fetchErr } = await supabase
    .from('sales')
    .select('*, customers(*), profiles(name)')
    .eq('id', newSaleId)
    .eq('company_id', companyId)
    .single();

  if (fetchErr) throw fetchErr;
  return mapDbSale(freshSale);
};

/**
 * Update payment status for a sale, mirroring state to its receivable log
 */
export const updateSaleStatus = async (id: string, paymentStatus: 'paid' | 'pending' | 'cancelled'): Promise<Sale> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const { data: dbSale, error: saleErr } = await supabase
    .from('sales')
    .update({ payment_status: paymentStatus })
    .eq('id', id)
    .eq('company_id', companyId)
    .select('*, customers(*), profiles(name)')
    .single();

  if (saleErr) throw saleErr;

  // Mirror to receivable status
  const recStatus = paymentStatus === 'paid' ? 'paid' : paymentStatus === 'cancelled' ? 'canceled' : 'pending';
  await supabase
    .from('account_receivables')
    .update({ status: recStatus })
    .eq('sale_id', id)
    .eq('company_id', companyId);

  return mapDbSale(dbSale);
};

/**
 * Cancel a sale, restore stock quantities and mark its receivable log cancelled
 */
export const cancelSale = async (id: string): Promise<Sale> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  // 1. Fetch sale items to restore stock
  const { data: dbItems, error: itemsErr } = await supabase
    .from('sale_items')
    .select('product_id, quantity')
    .eq('sale_id', id);

  if (itemsErr) throw itemsErr;

  // Restore stock in Supabase
  for (const item of dbItems || []) {
    const { data: prodData, error: readErr } = await supabase
      .from('products')
      .select('current_quantity')
      .eq('id', item.product_id)
      .eq('company_id', companyId)
      .single();
    
    if (!readErr && prodData) {
      const nextQty = Number(prodData.current_quantity) + Number(item.quantity);
      await supabase.from('products').update({ current_quantity: nextQty }).eq('id', item.product_id).eq('company_id', companyId);
    }
  }

  // 2. Set sale status to cancelled
  const { data: dbSale, error: saleErr } = await supabase
    .from('sales')
    .update({ payment_status: 'cancelled' })
    .eq('id', id)
    .eq('company_id', companyId)
    .select('*, customers(*), profiles(name)')
    .single();

  if (saleErr) throw saleErr;

  // 3. Set receivable status to cancelled
  await supabase
    .from('account_receivables')
    .update({ status: 'canceled' })
    .eq('sale_id', id)
    .eq('company_id', companyId);

  return mapDbSale(dbSale);
};
