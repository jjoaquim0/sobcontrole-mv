import { supabase } from '../lib/supabase';
import { Appointment, AppointmentStatus, AppointmentType } from '../types';
import { useAuthStore } from '../store/authStore';

const APPOINTMENT_SELECT = '*, customers(*), deals(title), profiles!appointments_assigned_user_id_fkey(name)';

export const isAppointmentOverdue = (appointment: Pick<Appointment, 'endAt' | 'status'>): boolean => {
  if (appointment.status === 'concluido' || appointment.status === 'cancelado') return false;
  return new Date(appointment.endAt).getTime() < Date.now();
};

const mapDbAppointment = (db: any): Appointment => ({
  id: db.id,
  companyId: db.company_id,
  customerId: db.customer_id || undefined,
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
  dealId: db.deal_id || undefined,
  dealTitle: db.deals?.title,
  assignedUserId: db.assigned_user_id,
  assignedUserName: db.profiles?.name || 'Sem responsável',
  createdBy: db.created_by || undefined,
  title: db.title,
  description: db.description || '',
  type: db.type as AppointmentType,
  status: db.status as AppointmentStatus,
  startAt: db.start_at,
  endAt: db.end_at,
  allDay: db.all_day,
  location: db.location || '',
  notes: db.notes || '',
  createdAt: db.created_at,
  updatedAt: db.updated_at,
});

const requireCompanyId = (): string => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');
  return companyId;
};

export interface AppointmentFilters {
  rangeStart?: string;
  rangeEnd?: string;
  assignedUserId?: string;
  type?: AppointmentType | 'all';
  status?: AppointmentStatus | 'all';
  customerId?: string;
}

export const getAppointments = async (filters?: AppointmentFilters): Promise<Appointment[]> => {
  const companyId = requireCompanyId();

  let query = supabase
    .from('appointments')
    .select(APPOINTMENT_SELECT)
    .eq('company_id', companyId)
    .order('start_at', { ascending: true });

  if (filters?.rangeStart) {
    query = query.lt('start_at', filters.rangeEnd);
    query = query.gt('end_at', filters.rangeStart);
  }

  if (filters?.assignedUserId) {
    query = query.eq('assigned_user_id', filters.assignedUserId);
  }

  if (filters?.type && filters.type !== 'all') {
    query = query.eq('type', filters.type);
  }

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters?.customerId) {
    query = query.eq('customer_id', filters.customerId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(mapDbAppointment);
};

export interface CreateAppointmentInput {
  title: string;
  description?: string;
  type: AppointmentType;
  status: AppointmentStatus;
  startAt: string;
  endAt: string;
  allDay: boolean;
  customerId?: string;
  dealId?: string;
  assignedUserId: string;
  location?: string;
  notes?: string;
}

export const createAppointment = async (data: CreateAppointmentInput): Promise<Appointment> => {
  const companyId = requireCompanyId();
  const newId = crypto.randomUUID();
  const currentProfileId = useAuthStore.getState().profile?.id;

  const { error: insertErr } = await supabase.from('appointments').insert({
    id: newId,
    company_id: companyId,
    customer_id: data.customerId || null,
    deal_id: data.dealId || null,
    assigned_user_id: data.assignedUserId,
    created_by: currentProfileId || null,
    title: data.title,
    description: data.description || '',
    type: data.type,
    status: data.status,
    start_at: data.startAt,
    end_at: data.endAt,
    all_day: data.allDay,
    location: data.location || '',
    notes: data.notes || '',
  });

  if (insertErr) throw insertErr;

  const { data: fresh, error: fetchErr } = await supabase
    .from('appointments')
    .select(APPOINTMENT_SELECT)
    .eq('id', newId)
    .eq('company_id', companyId)
    .single();

  if (fetchErr) throw fetchErr;
  return mapDbAppointment(fresh);
};

export interface UpdateAppointmentInput {
  title?: string;
  description?: string;
  type?: AppointmentType;
  status?: AppointmentStatus;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
  customerId?: string | null;
  dealId?: string | null;
  assignedUserId?: string;
  location?: string;
  notes?: string;
}

export const updateAppointment = async (id: string, data: UpdateAppointmentInput): Promise<Appointment> => {
  const companyId = requireCompanyId();

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.title !== undefined) payload.title = data.title;
  if (data.description !== undefined) payload.description = data.description;
  if (data.type !== undefined) payload.type = data.type;
  if (data.status !== undefined) payload.status = data.status;
  if (data.startAt !== undefined) payload.start_at = data.startAt;
  if (data.endAt !== undefined) payload.end_at = data.endAt;
  if (data.allDay !== undefined) payload.all_day = data.allDay;
  if (data.customerId !== undefined) payload.customer_id = data.customerId;
  if (data.dealId !== undefined) payload.deal_id = data.dealId;
  if (data.assignedUserId !== undefined) payload.assigned_user_id = data.assignedUserId;
  if (data.location !== undefined) payload.location = data.location;
  if (data.notes !== undefined) payload.notes = data.notes;

  const { data: updated, error } = await supabase
    .from('appointments')
    .update(payload)
    .eq('id', id)
    .eq('company_id', companyId)
    .select(APPOINTMENT_SELECT)
    .single();

  if (error) throw error;
  return mapDbAppointment(updated);
};

export const deleteAppointment = async (id: string): Promise<void> => {
  const companyId = requireCompanyId();

  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId);

  if (error) throw error;
};
