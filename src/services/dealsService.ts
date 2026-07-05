import { supabase } from '../lib/supabase';
import { Deal, DealStageHistoryEntry, DealStatus, PipelineStage } from '../types';
import { useAuthStore } from '../store/authStore';

const DEAL_SELECT = '*, customers(*), profiles(name)';

export const isDealOverdue = (deal: Pick<Deal, 'expectedCloseDate' | 'status'>): boolean => {
  if (!deal.expectedCloseDate || deal.status !== 'open') return false;
  const todayLocal = new Date().toLocaleDateString('en-CA');
  return deal.expectedCloseDate < todayLocal;
};

const mapDbStage = (db: any): PipelineStage => ({
  id: db.id,
  companyId: db.company_id,
  name: db.name,
  color: db.color || '#10b981',
  position: Number(db.position || 0),
  isActive: db.is_active,
  createdAt: db.created_at,
  updatedAt: db.updated_at,
});

const mapDbDeal = (db: any): Deal => ({
  id: db.id,
  companyId: db.company_id,
  title: db.title,
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
  ownerId: db.owner_id,
  ownerName: db.profiles?.name || 'Sem responsável',
  stageId: db.stage_id,
  value: Number(db.value || 0),
  status: db.status as DealStatus,
  expectedCloseDate: db.expected_close_date || undefined,
  position: Number(db.position || 0),
  notes: db.notes || '',
  lostReason: db.lost_reason || undefined,
  closedAt: db.closed_at || undefined,
  createdAt: db.created_at,
  updatedAt: db.updated_at,
});

const requireCompanyId = (): string => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');
  return companyId;
};

export const getPipelineStages = async (): Promise<PipelineStage[]> => {
  const companyId = requireCompanyId();

  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('position', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapDbStage);
};

export interface DealFilters {
  search?: string;
  ownerId?: string;
  stageId?: string;
  status?: DealStatus | 'all';
}

export const getDeals = async (filters?: DealFilters): Promise<Deal[]> => {
  const companyId = requireCompanyId();

  let query = supabase
    .from('deals')
    .select(DEAL_SELECT)
    .eq('company_id', companyId)
    .eq('status', filters?.status && filters.status !== 'all' ? filters.status : 'open')
    .order('position', { ascending: true });

  if (filters?.ownerId) {
    query = query.eq('owner_id', filters.ownerId);
  }

  if (filters?.stageId) {
    query = query.eq('stage_id', filters.stageId);
  }

  const { data, error } = await query;
  if (error) throw error;

  let result = (data || []).map(mapDbDeal);

  if (filters?.search) {
    const searchVal = filters.search.toLowerCase();
    result = result.filter(d =>
      d.title.toLowerCase().includes(searchVal) ||
      d.customer?.fullName.toLowerCase().includes(searchVal)
    );
  }

  return result;
};

export interface CreateDealInput {
  title: string;
  customerId: string;
  ownerId: string;
  stageId: string;
  value: number;
  expectedCloseDate?: string;
  notes?: string;
}

export const createDeal = async (data: CreateDealInput): Promise<Deal> => {
  const companyId = requireCompanyId();
  const newId = crypto.randomUUID();

  const { data: existing, error: posErr } = await supabase
    .from('deals')
    .select('position')
    .eq('company_id', companyId)
    .eq('stage_id', data.stageId)
    .eq('status', 'open')
    .order('position', { ascending: false })
    .limit(1);

  if (posErr) throw posErr;
  const nextPosition = existing && existing.length > 0 ? Number(existing[0].position) + 1 : 0;

  const { error: insertErr } = await supabase.from('deals').insert({
    id: newId,
    company_id: companyId,
    title: data.title,
    customer_id: data.customerId,
    owner_id: data.ownerId,
    stage_id: data.stageId,
    value: data.value,
    status: 'open',
    expected_close_date: data.expectedCloseDate || null,
    position: nextPosition,
    notes: data.notes || '',
  });

  if (insertErr) throw insertErr;

  await supabase.from('deal_stage_history').insert({
    id: crypto.randomUUID(),
    deal_id: newId,
    from_stage_id: null,
    to_stage_id: data.stageId,
    changed_by: useAuthStore.getState().profile?.id || null,
  });

  const { data: fresh, error: fetchErr } = await supabase
    .from('deals')
    .select(DEAL_SELECT)
    .eq('id', newId)
    .eq('company_id', companyId)
    .single();

  if (fetchErr) throw fetchErr;
  return mapDbDeal(fresh);
};

export interface UpdateDealInput {
  title?: string;
  customerId?: string;
  ownerId?: string;
  value?: number;
  expectedCloseDate?: string | null;
  notes?: string;
}

export const updateDeal = async (id: string, data: UpdateDealInput): Promise<Deal> => {
  const companyId = requireCompanyId();

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.title !== undefined) payload.title = data.title;
  if (data.customerId !== undefined) payload.customer_id = data.customerId;
  if (data.ownerId !== undefined) payload.owner_id = data.ownerId;
  if (data.value !== undefined) payload.value = data.value;
  if (data.expectedCloseDate !== undefined) payload.expected_close_date = data.expectedCloseDate || null;
  if (data.notes !== undefined) payload.notes = data.notes;

  const { data: updated, error } = await supabase
    .from('deals')
    .update(payload)
    .eq('id', id)
    .eq('company_id', companyId)
    .select(DEAL_SELECT)
    .single();

  if (error) throw error;
  return mapDbDeal(updated);
};

export const moveDealStage = async (id: string, toStageId: string, position: number): Promise<Deal> => {
  const companyId = requireCompanyId();

  const { data: current, error: curErr } = await supabase
    .from('deals')
    .select('stage_id')
    .eq('id', id)
    .eq('company_id', companyId)
    .single();

  if (curErr) throw curErr;
  const fromStageId = current.stage_id as string;

  const { data: updated, error } = await supabase
    .from('deals')
    .update({ stage_id: toStageId, position, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', companyId)
    .select(DEAL_SELECT)
    .single();

  if (error) throw error;

  if (fromStageId !== toStageId) {
    await supabase.from('deal_stage_history').insert({
      id: crypto.randomUUID(),
      deal_id: id,
      from_stage_id: fromStageId,
      to_stage_id: toStageId,
      changed_by: useAuthStore.getState().profile?.id || null,
    });
  }

  return mapDbDeal(updated);
};

export const getDealHistory = async (dealId: string): Promise<DealStageHistoryEntry[]> => {
  const { data, error } = await supabase
    .from('deal_stage_history')
    .select(`
      *,
      from_stage:pipeline_stages!deal_stage_history_from_stage_id_fkey(name),
      to_stage:pipeline_stages!deal_stage_history_to_stage_id_fkey(name),
      profiles(name)
    `)
    .eq('deal_id', dealId)
    .order('changed_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((db: any) => ({
    id: db.id,
    dealId: db.deal_id,
    fromStageId: db.from_stage_id || undefined,
    fromStageName: db.from_stage?.name,
    toStageId: db.to_stage_id,
    toStageName: db.to_stage?.name,
    changedBy: db.changed_by || undefined,
    changedByName: db.profiles?.name || 'Sistema',
    changedAt: db.changed_at,
  }));
};

export const closeDeal = async (id: string, status: 'won' | 'lost', lostReason?: string): Promise<Deal> => {
  const companyId = requireCompanyId();

  const { data: updated, error } = await supabase
    .from('deals')
    .update({
      status,
      lost_reason: status === 'lost' ? (lostReason || null) : null,
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('company_id', companyId)
    .select(DEAL_SELECT)
    .single();

  if (error) throw error;
  return mapDbDeal(updated);
};
