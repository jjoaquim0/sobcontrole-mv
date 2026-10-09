import { supabase } from '@/lib/supabase';
import { assertPeopleCompany } from '@/services/peopleService';
import { contractErrorMessage } from '@/services/contractsService';
import {
  ObligationEvent,
  ObligationItem,
  ObligationItemStatus,
  ObligationPeriod,
  ObligationPeriodStatus,
  ObligationRecurrence,
  ObligationTemplate,
  UserRole,
} from '@/types';

/** Mesmas regras de mensagem do módulo de contratos: validação das RPCs passa, erro interno não. */
export const obligationsErrorMessage = contractErrorMessage;

export interface ObligationTemplateInput {
  contractId?: string;
  name: string;
  description?: string;
  recurrence: ObligationRecurrence;
  referenceMonth?: number;
  dueDay: number;
  dueMonthOffset: number;
  defaultResponsibleId?: string;
  requiresEvidence: boolean;
  isActive: boolean;
}

export interface ObligationItemInput {
  periodId: string;
  name: string;
  description?: string;
  dueDate: string;
  responsibleId?: string;
  requiresEvidence: boolean;
}

export interface ObligationSendInput {
  periodId: string;
  sentOn: string;
  sentTo: string;
  proofUrl: string;
  note?: string;
}

export interface ObligationsOverview {
  contracts: { id: string; title: string; clientName: string; status: string }[];
  people: { id: string; name: string; role: UserRole }[];
  templates: ObligationTemplate[];
  periods: ObligationPeriod[];
  items: ObligationItem[];
  events: ObligationEvent[];
}

interface TemplateRow {
  id: string; contract_id?: string | null; name: string; description?: string | null; recurrence: ObligationRecurrence;
  reference_month?: number | null; due_day: number; due_month_offset: number; default_responsible_id?: string | null;
  requires_evidence: boolean; is_active: boolean;
}
interface PeriodRow {
  id: string; contract_id: string; competence: string; status: ObligationPeriodStatus; ready_at?: string | null; ready_by?: string | null;
  sent_on?: string | null; sent_to?: string | null; sent_proof_url?: string | null; sent_by?: string | null; notes?: string | null;
}
interface ItemRow {
  id: string; period_id: string; template_id?: string | null; name: string; description?: string | null; due_date: string;
  responsible_id?: string | null; requires_evidence: boolean; status: ObligationItemStatus; evidence_url?: string | null;
  submission_note?: string | null; submitted_by?: string | null; submitted_at?: string | null; reviewed_by?: string | null;
  reviewed_at?: string | null; review_note?: string | null;
}
interface EventRow {
  id: string; contract_id?: string | null; period_id?: string | null; entity_type: ObligationEvent['entityType']; event_type: string;
  changed_fields?: string[] | null; note?: string | null; actor_id?: string | null; created_at: string;
}

const nullable = (value?: string) => (value && value.trim() ? value.trim() : null);

export const getObligationsOverview = async (): Promise<ObligationsOverview> => {
  const companyId = assertPeopleCompany();
  const [contracts, profiles, templates, periods, items, events] = await Promise.all([
    supabase.from('service_contracts').select('id, title, client_name, status').eq('company_id', companyId).is('deleted_at', null).order('title'),
    supabase.from('profiles').select('id, name, role').eq('company_id', companyId).order('name'),
    supabase.from('service_obligation_templates').select('id, contract_id, name, description, recurrence, reference_month, due_day, due_month_offset, default_responsible_id, requires_evidence, is_active').eq('company_id', companyId).order('name'),
    supabase.from('service_obligation_periods').select('id, contract_id, competence, status, ready_at, ready_by, sent_on, sent_to, sent_proof_url, sent_by, notes').eq('company_id', companyId).order('competence', { ascending: false }),
    supabase.from('service_obligation_items').select('id, period_id, template_id, name, description, due_date, responsible_id, requires_evidence, status, evidence_url, submission_note, submitted_by, submitted_at, reviewed_by, reviewed_at, review_note').eq('company_id', companyId).order('due_date'),
    supabase.from('service_obligation_events').select('id, contract_id, period_id, entity_type, event_type, changed_fields, note, actor_id, created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(200),
  ]);
  const failed = [contracts, profiles, templates, periods, items, events].find((response) => response.error);
  if (failed) throw new Error(obligationsErrorMessage(failed.error, 'Não foi possível carregar as obrigações.'));

  const contractRows = (contracts.data || []) as { id: string; title: string; client_name: string; status: string }[];
  const contractTitles = new Map(contractRows.map((row) => [row.id, row.title]));
  const peopleRows = (profiles.data || []) as { id: string; name: string; role: UserRole }[];
  const names = new Map(peopleRows.map((row) => [row.id, row.name]));
  const personName = (id?: string | null) => (id ? names.get(id) || 'Usuário removido' : undefined);

  return {
    contracts: contractRows.map((row) => ({ id: row.id, title: row.title, clientName: row.client_name, status: row.status })),
    people: peopleRows.map((row) => ({ id: row.id, name: row.name, role: row.role })),
    templates: ((templates.data || []) as TemplateRow[]).map((row) => ({
      id: row.id,
      contractId: row.contract_id || undefined,
      contractTitle: row.contract_id ? contractTitles.get(row.contract_id) : undefined,
      name: row.name,
      description: row.description || undefined,
      recurrence: row.recurrence,
      referenceMonth: row.reference_month ?? undefined,
      dueDay: row.due_day,
      dueMonthOffset: row.due_month_offset,
      defaultResponsibleId: row.default_responsible_id || undefined,
      defaultResponsibleName: personName(row.default_responsible_id),
      requiresEvidence: row.requires_evidence,
      isActive: row.is_active,
    })),
    periods: ((periods.data || []) as PeriodRow[]).map((row) => ({
      id: row.id,
      contractId: row.contract_id,
      contractTitle: contractTitles.get(row.contract_id) || 'Contrato não disponível',
      competence: row.competence,
      status: row.status,
      readyAt: row.ready_at || undefined,
      readyByName: personName(row.ready_by),
      sentOn: row.sent_on || undefined,
      sentTo: row.sent_to || undefined,
      sentProofUrl: row.sent_proof_url || undefined,
      sentByName: personName(row.sent_by),
      notes: row.notes || undefined,
    })),
    items: ((items.data || []) as ItemRow[]).map((row) => ({
      id: row.id,
      periodId: row.period_id,
      templateId: row.template_id || undefined,
      name: row.name,
      description: row.description || undefined,
      dueDate: row.due_date,
      responsibleId: row.responsible_id || undefined,
      responsibleName: personName(row.responsible_id),
      requiresEvidence: row.requires_evidence,
      status: row.status,
      evidenceUrl: row.evidence_url || undefined,
      submissionNote: row.submission_note || undefined,
      submittedByName: personName(row.submitted_by),
      submittedAt: row.submitted_at || undefined,
      reviewedByName: personName(row.reviewed_by),
      reviewedAt: row.reviewed_at || undefined,
      reviewNote: row.review_note || undefined,
    })),
    events: ((events.data || []) as EventRow[]).map((row) => ({
      id: row.id,
      contractId: row.contract_id || undefined,
      periodId: row.period_id || undefined,
      entityType: row.entity_type,
      eventType: row.event_type,
      changedFields: row.changed_fields || [],
      note: row.note || undefined,
      actorName: personName(row.actor_id) || 'Sistema',
      createdAt: row.created_at,
    })),
  };
};

export const saveObligationTemplate = async (input: ObligationTemplateInput, id?: string): Promise<string> => {
  assertPeopleCompany();
  const { data, error } = await supabase.rpc('save_obligation_template', {
    p_template_id: id || null,
    p_contract_id: input.contractId || null,
    p_name: input.name.trim(),
    p_description: nullable(input.description),
    p_recurrence: input.recurrence,
    p_reference_month: input.recurrence === 'monthly' ? null : input.referenceMonth ?? null,
    p_due_day: input.dueDay,
    p_due_month_offset: input.dueMonthOffset,
    p_default_responsible_id: input.defaultResponsibleId || null,
    p_requires_evidence: input.requiresEvidence,
    p_is_active: input.isActive,
  });
  if (error) throw new Error(obligationsErrorMessage(error, 'Não foi possível salvar a obrigação.'));
  return String(data);
};

export const openObligationPeriod = async (contractId: string, competence: string): Promise<string> => {
  assertPeopleCompany();
  const { data, error } = await supabase.rpc('open_obligation_period', { p_contract_id: contractId, p_competence: competence });
  if (error) throw new Error(obligationsErrorMessage(error, 'Não foi possível abrir a competência.'));
  return String(data);
};

export const addObligationItem = async (input: ObligationItemInput): Promise<string> => {
  assertPeopleCompany();
  const { data, error } = await supabase.rpc('add_obligation_item', {
    p_period_id: input.periodId,
    p_name: input.name.trim(),
    p_description: nullable(input.description),
    p_due_date: input.dueDate,
    p_responsible_id: input.responsibleId || null,
    p_requires_evidence: input.requiresEvidence,
  });
  if (error) throw new Error(obligationsErrorMessage(error, 'Não foi possível incluir o item.'));
  return String(data);
};

export const updateObligationItem = async (itemId: string, dueDate: string, responsibleId?: string): Promise<void> => {
  assertPeopleCompany();
  const { error } = await supabase.rpc('update_obligation_item', { p_item_id: itemId, p_due_date: dueDate, p_responsible_id: responsibleId || null });
  if (error) throw new Error(obligationsErrorMessage(error, 'Não foi possível alterar o item.'));
};

export const submitObligationItem = async (itemId: string, evidenceUrl?: string, note?: string): Promise<void> => {
  assertPeopleCompany();
  const { error } = await supabase.rpc('submit_obligation_item', { p_item_id: itemId, p_evidence_url: nullable(evidenceUrl), p_note: nullable(note) });
  if (error) throw new Error(obligationsErrorMessage(error, 'Não foi possível registrar a evidência.'));
};

export const reviewObligationItem = async (itemId: string, approve: boolean, note?: string): Promise<void> => {
  assertPeopleCompany();
  const { error } = await supabase.rpc('review_obligation_item', { p_item_id: itemId, p_approve: approve, p_note: nullable(note) });
  if (error) throw new Error(obligationsErrorMessage(error, 'Não foi possível registrar a conferência.'));
};

export const waiveObligationItem = async (itemId: string, reason: string): Promise<void> => {
  assertPeopleCompany();
  const { error } = await supabase.rpc('waive_obligation_item', { p_item_id: itemId, p_reason: reason.trim() });
  if (error) throw new Error(obligationsErrorMessage(error, 'Não foi possível dispensar o item.'));
};

export const markPeriodReady = async (periodId: string, note?: string): Promise<void> => {
  assertPeopleCompany();
  const { error } = await supabase.rpc('mark_obligation_period_ready', { p_period_id: periodId, p_note: nullable(note) });
  if (error) throw new Error(obligationsErrorMessage(error, 'Não foi possível fechar o pacote.'));
};

export const reopenPeriod = async (periodId: string, reason: string): Promise<void> => {
  assertPeopleCompany();
  const { error } = await supabase.rpc('reopen_obligation_period', { p_period_id: periodId, p_reason: reason.trim() });
  if (error) throw new Error(obligationsErrorMessage(error, 'Não foi possível reabrir a competência.'));
};

export const markPeriodSent = async (input: ObligationSendInput): Promise<void> => {
  assertPeopleCompany();
  const { error } = await supabase.rpc('mark_obligation_period_sent', {
    p_period_id: input.periodId,
    p_sent_on: input.sentOn,
    p_sent_to: input.sentTo.trim(),
    p_proof_url: input.proofUrl.trim(),
    p_note: nullable(input.note),
  });
  if (error) throw new Error(obligationsErrorMessage(error, 'Não foi possível registrar o envio.'));
};
