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

export const getArchivedPipelineStages = async (): Promise<PipelineStage[]> => {
  const companyId = requireCompanyId();

  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', false)
    .order('position', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapDbStage);
};

export interface CreatePipelineStageInput {
  name: string;
  color: string;
}

export const createPipelineStage = async (input: CreatePipelineStageInput): Promise<PipelineStage> => {
  const companyId = requireCompanyId();

  // Posição = max(position) das etapas ativas + 1 (0 quando não houver
  // nenhuma), lida via getPipelineStages() para reaproveitar a mesma
  // listagem/ordenação já usada pelo kanban, em vez de duplicar a query.
  const activeStages = await getPipelineStages();
  const nextPosition = Math.max(...activeStages.map((s) => s.position), -1) + 1;

  const { data: created, error } = await supabase
    .from('pipeline_stages')
    .insert({
      id: crypto.randomUUID(),
      company_id: companyId,
      name: input.name,
      color: input.color,
      position: nextPosition,
      is_active: true,
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapDbStage(created);
};

export interface UpdatePipelineStageInput {
  name?: string;
  color?: string;
}

export const updatePipelineStage = async (id: string, patch: UpdatePipelineStageInput): Promise<PipelineStage> => {
  const companyId = requireCompanyId();

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.color !== undefined) payload.color = patch.color;

  const { data: updated, error } = await supabase
    .from('pipeline_stages')
    .update(payload)
    .eq('id', id)
    .eq('company_id', companyId)
    .select('*')
    .single();

  if (error) throw error;
  return mapDbStage(updated);
};

export const archivePipelineStage = async (id: string): Promise<PipelineStage> => {
  const companyId = requireCompanyId();

  const { data: updated, error } = await supabase
    .from('pipeline_stages')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', companyId)
    .select('*')
    .single();

  if (error) throw error;
  return mapDbStage(updated);
};

export const restorePipelineStage = async (id: string): Promise<PipelineStage> => {
  const companyId = requireCompanyId();

  const { data: updated, error } = await supabase
    .from('pipeline_stages')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', companyId)
    .select('*')
    .single();

  if (error) throw error;
  return mapDbStage(updated);
};

// Reordenação de etapas (Story 1.36, FR-2): atualiza somente `position` da
// etapa arrastada, calculada pelo chamador via ponto médio entre vizinhas
// (ver stageReorder.ts). Não renumera as demais etapas, não recalcula
// `is_active`/`name`/`color` e preserva `position DOUBLE PRECISION`.
export const updatePipelineStagePosition = async (stageId: string, position: number): Promise<PipelineStage> => {
  const companyId = requireCompanyId();

  const { data: updated, error } = await supabase
    .from('pipeline_stages')
    .update({ position, updated_at: new Date().toISOString() })
    .eq('id', stageId)
    .eq('company_id', companyId)
    .select('*')
    .single();

  if (error) throw error;
  return mapDbStage(updated);
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
  stageId?: string;
}

export const updateDeal = async (id: string, data: UpdateDealInput): Promise<Deal> => {
  const companyId = requireCompanyId();
  const { stageId, ...fields } = data;

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.title !== undefined) payload.title = fields.title;
  if (fields.customerId !== undefined) payload.customer_id = fields.customerId;
  if (fields.ownerId !== undefined) payload.owner_id = fields.ownerId;
  if (fields.value !== undefined) payload.value = fields.value;
  if (fields.expectedCloseDate !== undefined) payload.expected_close_date = fields.expectedCloseDate || null;
  if (fields.notes !== undefined) payload.notes = fields.notes;

  const { data: updated, error } = await supabase
    .from('deals')
    .update(payload)
    .eq('id', id)
    .eq('company_id', companyId)
    .select(DEAL_SELECT)
    .single();

  if (error) throw error;

  // stage_id nunca é gravado no UPDATE acima: quando fornecido e diferente
  // da etapa atual, a troca é encaminhada para moveDealStage() - o único
  // caminho de escrita de stage_id do módulo (posição + deal_stage_history).
  // Isso consolida num único caminho a mudança de etapa feita pelo
  // DealModal, eliminando o workaround que antes chamava moveDeal
  // separadamente a partir de PipelinePage (Story 1.35, FR-8). Não toca em
  // status/closed_at/lost_reason - isso é decisão de FR-7 (Story 1.37).
  if (stageId !== undefined && stageId !== updated.stage_id) {
    const { data: existing, error: posErr } = await supabase
      .from('deals')
      .select('position')
      .eq('company_id', companyId)
      .eq('stage_id', stageId)
      .eq('status', 'open')
      .order('position', { ascending: false })
      .limit(1);

    if (posErr) throw posErr;
    const nextPosition = existing && existing.length > 0 ? Number(existing[0].position) + 1 : 0;

    return moveDealStage(id, stageId, nextPosition);
  }

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

export const deleteDeal = async (id: string): Promise<void> => {
  const companyId = requireCompanyId();

  const { error } = await supabase
    .from('deals')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId);

  if (error) throw error;
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
