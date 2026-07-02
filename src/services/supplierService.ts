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
