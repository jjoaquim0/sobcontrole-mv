import { supabase } from '../lib/supabase';
import { Customer } from '../types';
import { useAuthStore } from '../store/authStore';

// Helper maps DB snake_case columns to Frontend camelCase
const mapDbCustomer = (db: any): Customer => ({
  id: db.id,
  companyId: db.company_id,
  fullName: db.full_name,
  document: db.document,
  email: db.email || '',
  phone: db.phone || '',
  address: db.address || '{}',
  isActive: db.is_active,
  createdAt: db.created_at || db.createdAt,
});

/**
 * Carrega a lista filtrada de clientes ordenada por criado_em decrescente
 */
export const getCustomers = async (filters?: {
  search?: string;
  status?: 'active' | 'inactive' | 'all';
}): Promise<Customer[]> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  let query = supabase
    .from('customers')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (filters?.status === 'active') {
    query = query.eq('is_active', true);
  } else if (filters?.status === 'inactive') {
    query = query.eq('is_active', false);
  }

  if (filters?.search) {
    const searchVal = `%${filters.search}%`;
    query = query.or(`full_name.ilike.${searchVal},email.ilike.${searchVal},phone.ilike.${searchVal},document.ilike.${searchVal}`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(mapDbCustomer);
};

/**
 * Carrega o cliente por ID e calcula métricas operacionais vinculadas
 */
export interface CustomerDetail {
  customer: Customer;
  metrics: {
    totalSalesCount: number;
    totalSpent: number;
    averageTicket: number;
    lastPurchaseDate: string | null;
    preferredPaymentMethod: string;
  };
  salesHistory: {
    id: string;
    createdAt: string;
    products: string;
    totalAmount: number;
    status: 'paid' | 'pending' | 'canceled';
  }[];
}

const getPreferredMethod = (sales: any[]): string => {
  const paymentMethods = sales.map(s => s.payment_method).filter(Boolean);
  if (paymentMethods.length === 0) return 'Nenhum';
  const countMap: Record<string, number> = {};
  let preferred = 'Nenhum';
  let maxCount = 0;
  
  const translations: Record<string, string> = {
    money: 'Dinheiro',
    credit_card: 'Cartão de Crédito',
    debit_card: 'Cartão de Débito',
    pix: 'Pix',
    bank_slip: 'Boleto Bancário'
  };

  paymentMethods.forEach(method => {
    countMap[method] = (countMap[method] || 0) + 1;
    if (countMap[method] > maxCount) {
      maxCount = countMap[method];
      preferred = translations[method] || method;
    }
  });

  return preferred;
};

export const getCustomerById = async (id: string): Promise<CustomerDetail> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  // 1. Carregar perfil do cliente
  const { data: dbCust, error: custErr } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .eq('company_id', companyId)
    .single();

  if (custErr) throw custErr;
  const customer = mapDbCustomer(dbCust);

  // 2. Carregar vendas vinculadas a este cliente
  const { data: dbSales, error: salesErr } = await supabase
    .from('sales')
    .select(`
      id, 
      final_value, 
      payment_status, 
      created_at, 
      payment_method,
      sale_items(
        quantity,
        products(
          name
        )
      )
    `)
    .eq('customer_id', id)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (salesErr) throw salesErr;

  const salesList = dbSales || [];
  const paidSales = salesList.filter((s: any) => s.payment_status === 'paid');
  
  const totalSpent = paidSales.reduce((sum, s) => sum + Number(s.final_value), 0);
  const lastPurchaseDate = salesList.length > 0 ? salesList[0].created_at : null;
  const averageTicket = salesList.length > 0 ? totalSpent / salesList.length : 0;
  const preferredPaymentMethod = getPreferredMethod(salesList);

  const salesHistory = salesList.map((s: any) => {
    const items = s.sale_items || [];
    const names = items.map((item: any) => item.products?.name).filter(Boolean);
    
    let productsStr = 'Venda de Produtos';
    if (names.length > 0) {
      if (names.length <= 2) {
        productsStr = names.join(', ');
      } else {
        productsStr = `${names.slice(0, 2).join(', ')} e mais ${names.length - 2}`;
      }
    }

    // Status map between DB status and UI status expected
    const statusMap = s.payment_status === 'cancelled' ? 'canceled' : s.payment_status;

    return {
      id: s.id,
      createdAt: s.created_at,
      products: productsStr,
      totalAmount: Number(s.final_value),
      status: statusMap as any,
    };
  });

  return {
    customer,
    metrics: {
      totalSalesCount: salesList.length,
      totalSpent,
      averageTicket,
      lastPurchaseDate,
      preferredPaymentMethod,
    },
    salesHistory,
  };
};

/**
 * Cria um novo registro de cliente injetando o companyId logado
 */
export const createCustomer = async (
  data: Omit<Customer, 'id' | 'companyId' | 'isActive' | 'createdAt'>
): Promise<Customer> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');
  const newId = crypto.randomUUID();

  const dbInsert = {
    id: newId,
    company_id: companyId,
    full_name: data.fullName,
    document: data.document,
    email: data.email,
    phone: data.phone,
    address: data.address,
    is_active: true,
  };

  const { data: dbCust, error } = await supabase
    .from('customers')
    .insert(dbInsert)
    .select()
    .single();

  if (error) throw error;
  return mapDbCustomer(dbCust);
};

/**
 * Atualiza campos cadastrais de um cliente existente
 */
export const updateCustomer = async (
  id: string,
  data: Partial<Omit<Customer, 'id' | 'companyId' | 'createdAt'>>
): Promise<Customer> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const dbPayload: any = {};
  if (data.fullName !== undefined) dbPayload.full_name = data.fullName;
  if (data.document !== undefined) dbPayload.document = data.document;
  if (data.email !== undefined) dbPayload.email = data.email;
  if (data.phone !== undefined) dbPayload.phone = data.phone;
  if (data.address !== undefined) dbPayload.address = data.address;
  if (data.isActive !== undefined) dbPayload.is_active = data.isActive;

  const { data: dbCust, error } = await supabase
    .from('customers')
    .update(dbPayload)
    .eq('id', id)
    .eq('company_id', companyId)
    .select()
    .single();

  if (error) throw error;
  return mapDbCustomer(dbCust);
};

/**
 * Ativa ou desativa a conta de um cliente
 */
export const toggleCustomerStatus = async (
  id: string,
  isActive: boolean
): Promise<Customer> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const { data: dbCust, error } = await supabase
    .from('customers')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('company_id', companyId)
    .select()
    .single();

  if (error) throw error;
  return mapDbCustomer(dbCust);
};
