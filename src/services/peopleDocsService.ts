import { supabase } from '@/lib/supabase';
import { assertPeopleCompany } from '@/services/peopleService';
import { contractErrorMessage } from '@/services/contractsService';
import {
  AbsenceKind,
  DocumentRecord,
  DocumentRecordStatus,
  DocumentRequirement,
  DocumentTarget,
  EmployeeAbsence,
  EquipmentCategory,
  EquipmentDelivery,
  PeopleEvent,
  PostAllocationRole,
  ServicePostStatus,
} from '@/types';

/** Mesmas regras de mensagem do módulo de contratos: validação das RPCs passa, erro interno não. */
export const peopleDocsErrorMessage = contractErrorMessage;

export interface RequirementInput {
  name: string;
  description?: string;
  target: DocumentTarget;
  contractId?: string;
  postId?: string;
  validityMonths?: number;
  isActive: boolean;
}

export interface DocumentSubmissionInput {
  requirementId: string;
  employeeId?: string;
  contractId?: string;
  documentUrl: string;
  issuedOn?: string;
  expiresOn?: string;
  notes?: string;
}

export interface DocumentReviewInput {
  recordId: string;
  approve: boolean;
  note?: string;
}

export interface AbsenceInput {
  employeeId: string;
  kind: AbsenceKind;
  startDate: string;
  endDate: string;
  notes?: string;
}

export interface DeliveryInput {
  employeeId: string;
  postId?: string;
  category: EquipmentCategory;
  itemName: string;
  quantity: number;
  size?: string;
  caNumber?: string;
  deliveredOn: string;
  replaceBy?: string;
  evidenceUrl?: string;
  notes?: string;
}

export interface DeliveryReturnInput {
  deliveryId: string;
  returnedOn: string;
  note?: string;
}

export interface PeopleDocsOverview {
  contracts: { id: string; title: string; clientName: string; status: string }[];
  posts: { id: string; contractId: string; name: string; jobFunction: string; status: ServicePostStatus }[];
  allocations: { id: string; postId: string; employeeId: string; allocationRole: PostAllocationRole; startDate: string; endDate?: string }[];
  employees: { id: string; fullName: string; jobTitle: string; status: string }[];
  requirements: DocumentRequirement[];
  records: DocumentRecord[];
  absences: EmployeeAbsence[];
  deliveries: EquipmentDelivery[];
  events: PeopleEvent[];
}

interface RequirementRow {
  id: string; name: string; description?: string | null; target: DocumentTarget; contract_id?: string | null;
  post_id?: string | null; validity_months?: number | null; is_active: boolean;
}
interface RecordRow {
  id: string; requirement_id: string; employee_id?: string | null; contract_id?: string | null; status: DocumentRecordStatus;
  issued_on?: string | null; expires_on?: string | null; document_url: string; notes?: string | null;
  submitted_by?: string | null; reviewed_by?: string | null; reviewed_at?: string | null; review_note?: string | null; created_at: string;
}
interface AbsenceRow {
  id: string; employee_id: string; kind: AbsenceKind; start_date: string; end_date: string; notes?: string | null;
  canceled_at?: string | null; cancel_reason?: string | null; created_at: string;
}
interface DeliveryRow {
  id: string; employee_id: string; post_id?: string | null; category: EquipmentCategory; item_name: string; quantity: number;
  size?: string | null; ca_number?: string | null; delivered_on: string; replace_by?: string | null; evidence_url?: string | null;
  notes?: string | null; returned_on?: string | null; return_note?: string | null; created_at: string;
}
interface EventRow {
  id: string; employee_id?: string | null; contract_id?: string | null; entity_type: PeopleEvent['entityType']; event_type: string;
  changed_fields?: string[] | null; note?: string | null; actor_id?: string | null; created_at: string;
}

const nullable = (value?: string) => (value && value.trim() ? value.trim() : null);

const nameMap = (rows: { id: string; name: string }[]) => new Map(rows.map((row) => [row.id, row.name]));

export const getPeopleDocsOverview = async (): Promise<PeopleDocsOverview> => {
  const companyId = assertPeopleCompany();
  const [contracts, posts, allocations, employees, profiles, requirements, records, absences, deliveries, events] = await Promise.all([
    supabase.from('service_contracts').select('id, title, client_name, status').eq('company_id', companyId).is('deleted_at', null).order('title'),
    supabase.from('service_posts').select('id, contract_id, name, job_function, status').eq('company_id', companyId).order('name'),
    supabase.from('service_post_allocations').select('id, post_id, employee_id, allocation_role, start_date, end_date').eq('company_id', companyId).order('start_date', { ascending: false }),
    supabase.from('employees').select('id, full_name, job_title, status').eq('company_id', companyId).is('deleted_at', null).order('full_name'),
    supabase.from('profiles').select('id, name').eq('company_id', companyId),
    supabase.from('service_document_requirements').select('id, name, description, target, contract_id, post_id, validity_months, is_active').eq('company_id', companyId).order('name'),
    supabase.from('service_document_records').select('id, requirement_id, employee_id, contract_id, status, issued_on, expires_on, document_url, notes, submitted_by, reviewed_by, reviewed_at, review_note, created_at').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('service_employee_absences').select('id, employee_id, kind, start_date, end_date, notes, canceled_at, cancel_reason, created_at').eq('company_id', companyId).order('start_date', { ascending: false }),
    supabase.from('service_equipment_deliveries').select('id, employee_id, post_id, category, item_name, quantity, size, ca_number, delivered_on, replace_by, evidence_url, notes, returned_on, return_note, created_at').eq('company_id', companyId).order('delivered_on', { ascending: false }),
    supabase.from('service_people_events').select('id, employee_id, contract_id, entity_type, event_type, changed_fields, note, actor_id, created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(200),
  ]);
  const failed = [contracts, posts, allocations, employees, profiles, requirements, records, absences, deliveries, events].find((response) => response.error);
  if (failed) throw new Error(peopleDocsErrorMessage(failed.error, 'Não foi possível carregar documentos, férias e EPIs.'));

  const employeeRows = (employees.data || []) as { id: string; full_name: string; job_title: string; status: string }[];
  const employeeNames = new Map(employeeRows.map((row) => [row.id, row.full_name]));
  const profileNames = nameMap((profiles.data || []) as { id: string; name: string }[]);
  const contractRows = (contracts.data || []) as { id: string; title: string; client_name: string; status: string }[];
  const contractTitles = new Map(contractRows.map((row) => [row.id, row.title]));
  const postRows = (posts.data || []) as { id: string; contract_id: string; name: string; job_function: string; status: ServicePostStatus }[];
  const postNames = new Map(postRows.map((row) => [row.id, row.name]));
  const employeeName = (id: string) => employeeNames.get(id) || 'Funcionário não disponível';
  const actorName = (id?: string | null) => (id ? profileNames.get(id) || 'Usuário removido' : 'Sistema');

  return {
    contracts: contractRows.map((row) => ({ id: row.id, title: row.title, clientName: row.client_name, status: row.status })),
    posts: postRows.map((row) => ({ id: row.id, contractId: row.contract_id, name: row.name, jobFunction: row.job_function, status: row.status })),
    allocations: ((allocations.data || []) as { id: string; post_id: string; employee_id: string; allocation_role: PostAllocationRole; start_date: string; end_date?: string | null }[])
      .map((row) => ({ id: row.id, postId: row.post_id, employeeId: row.employee_id, allocationRole: row.allocation_role, startDate: row.start_date, endDate: row.end_date || undefined })),
    employees: employeeRows.map((row) => ({ id: row.id, fullName: row.full_name, jobTitle: row.job_title, status: row.status })),
    requirements: ((requirements.data || []) as RequirementRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      target: row.target,
      contractId: row.contract_id || undefined,
      contractTitle: row.contract_id ? contractTitles.get(row.contract_id) : undefined,
      postId: row.post_id || undefined,
      postName: row.post_id ? postNames.get(row.post_id) : undefined,
      validityMonths: row.validity_months ?? undefined,
      isActive: row.is_active,
    })),
    records: ((records.data || []) as RecordRow[]).map((row) => ({
      id: row.id,
      requirementId: row.requirement_id,
      employeeId: row.employee_id || undefined,
      contractId: row.contract_id || undefined,
      status: row.status,
      issuedOn: row.issued_on || undefined,
      expiresOn: row.expires_on || undefined,
      documentUrl: row.document_url,
      notes: row.notes || undefined,
      submittedByName: actorName(row.submitted_by),
      reviewedByName: row.reviewed_by ? actorName(row.reviewed_by) : undefined,
      reviewedAt: row.reviewed_at || undefined,
      reviewNote: row.review_note || undefined,
      createdAt: row.created_at,
    })),
    absences: ((absences.data || []) as AbsenceRow[]).map((row) => ({
      id: row.id,
      employeeId: row.employee_id,
      employeeName: employeeName(row.employee_id),
      kind: row.kind,
      startDate: row.start_date,
      endDate: row.end_date,
      notes: row.notes || undefined,
      canceledAt: row.canceled_at || undefined,
      cancelReason: row.cancel_reason || undefined,
      createdAt: row.created_at,
    })),
    deliveries: ((deliveries.data || []) as DeliveryRow[]).map((row) => ({
      id: row.id,
      employeeId: row.employee_id,
      employeeName: employeeName(row.employee_id),
      postId: row.post_id || undefined,
      postName: row.post_id ? postNames.get(row.post_id) : undefined,
      category: row.category,
      itemName: row.item_name,
      quantity: row.quantity,
      size: row.size || undefined,
      caNumber: row.ca_number || undefined,
      deliveredOn: row.delivered_on,
      replaceBy: row.replace_by || undefined,
      evidenceUrl: row.evidence_url || undefined,
      notes: row.notes || undefined,
      returnedOn: row.returned_on || undefined,
      returnNote: row.return_note || undefined,
      createdAt: row.created_at,
    })),
    events: ((events.data || []) as EventRow[]).map((row) => ({
      id: row.id,
      employeeId: row.employee_id || undefined,
      employeeName: row.employee_id ? employeeName(row.employee_id) : undefined,
      contractId: row.contract_id || undefined,
      entityType: row.entity_type,
      eventType: row.event_type,
      changedFields: row.changed_fields || [],
      note: row.note || undefined,
      actorName: actorName(row.actor_id),
      createdAt: row.created_at,
    })),
  };
};

export const saveRequirement = async (input: RequirementInput, id?: string): Promise<string> => {
  assertPeopleCompany();
  const { data, error } = await supabase.rpc('save_document_requirement', {
    p_requirement_id: id || null,
    p_name: input.name.trim(),
    p_description: nullable(input.description),
    p_target: input.target,
    p_contract_id: input.contractId || null,
    p_post_id: input.target === 'employee' && input.contractId ? input.postId || null : null,
    p_validity_months: input.validityMonths ?? null,
    p_is_active: input.isActive,
  });
  if (error) throw new Error(peopleDocsErrorMessage(error, 'Não foi possível salvar o documento do checklist.'));
  return String(data);
};

export const submitDocument = async (input: DocumentSubmissionInput): Promise<string> => {
  assertPeopleCompany();
  const { data, error } = await supabase.rpc('submit_document_record', {
    p_requirement_id: input.requirementId,
    p_employee_id: input.employeeId || null,
    p_contract_id: input.contractId || null,
    p_document_url: input.documentUrl.trim(),
    p_issued_on: input.issuedOn || null,
    p_expires_on: input.expiresOn || null,
    p_notes: nullable(input.notes),
  });
  if (error) throw new Error(peopleDocsErrorMessage(error, 'Não foi possível registrar o documento.'));
  return String(data);
};

export const reviewDocument = async (input: DocumentReviewInput): Promise<void> => {
  assertPeopleCompany();
  const { error } = await supabase.rpc('review_document_record', {
    p_record_id: input.recordId,
    p_approve: input.approve,
    p_note: nullable(input.note),
  });
  if (error) throw new Error(peopleDocsErrorMessage(error, 'Não foi possível registrar a conferência.'));
};

export const registerAbsence = async (input: AbsenceInput): Promise<string> => {
  assertPeopleCompany();
  const { data, error } = await supabase.rpc('register_employee_absence', {
    p_employee_id: input.employeeId,
    p_kind: input.kind,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_notes: nullable(input.notes),
  });
  if (error) throw new Error(peopleDocsErrorMessage(error, 'Não foi possível registrar a ausência.'));
  return String(data);
};

export const cancelAbsence = async (absenceId: string, reason: string): Promise<void> => {
  assertPeopleCompany();
  const { error } = await supabase.rpc('cancel_employee_absence', { p_absence_id: absenceId, p_reason: reason.trim() });
  if (error) throw new Error(peopleDocsErrorMessage(error, 'Não foi possível cancelar a ausência.'));
};

export const registerDelivery = async (input: DeliveryInput): Promise<string> => {
  assertPeopleCompany();
  const { data, error } = await supabase.rpc('register_equipment_delivery', {
    p_employee_id: input.employeeId,
    p_post_id: input.postId || null,
    p_category: input.category,
    p_item_name: input.itemName.trim(),
    p_quantity: input.quantity,
    p_size: nullable(input.size),
    p_ca_number: nullable(input.caNumber),
    p_delivered_on: input.deliveredOn,
    p_replace_by: input.replaceBy || null,
    p_evidence_url: nullable(input.evidenceUrl),
    p_notes: nullable(input.notes),
  });
  if (error) throw new Error(peopleDocsErrorMessage(error, 'Não foi possível registrar a entrega.'));
  return String(data);
};

export const returnDelivery = async (input: DeliveryReturnInput): Promise<void> => {
  assertPeopleCompany();
  const { error } = await supabase.rpc('return_equipment_delivery', {
    p_delivery_id: input.deliveryId,
    p_returned_on: input.returnedOn,
    p_note: nullable(input.note),
  });
  if (error) throw new Error(peopleDocsErrorMessage(error, 'Não foi possível registrar a devolução.'));
};
