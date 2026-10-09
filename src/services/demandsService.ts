import { supabase } from '@/lib/supabase';
import { assertPeopleCompany } from '@/services/peopleService';
import { contractErrorMessage } from '@/services/contractsService';
import {
  DemandComment,
  DemandEvent,
  DemandEvidence,
  DemandPriority,
  DemandStage,
  DemandStageCategory,
  DemandStatus,
  DemandType,
  ServiceDemand,
  UserRole,
} from '@/types';

/** Mesmas regras de mensagem do módulo de contratos: validação das RPCs passa, erro interno não. */
export const demandErrorMessage = contractErrorMessage;

export interface DemandFilters {
  typeId?: string;
  search?: string;
  responsibleId?: string;
  /** Inclui encerradas/canceladas (por padrão, só abertas e as encerradas nos últimos 30 dias). */
  includeFinished?: boolean;
}

export interface DemandInput {
  typeId: string;
  title: string;
  description?: string;
  priority: DemandPriority;
  dueDate?: string;
  contractId?: string;
  postId?: string;
  allocationId?: string;
  employeeId?: string;
  responsibleId?: string;
  approverId?: string;
}

export interface DemandUpdateInput {
  title: string;
  description?: string;
  priority: DemandPriority;
  dueDate?: string;
}

export interface DemandTypeInput {
  name: string;
  description?: string;
  defaultDueDays?: number;
  isActive: boolean;
}

export interface DemandStageInput {
  typeId: string;
  name: string;
  category: DemandStageCategory;
  isActive: boolean;
}

export interface DemandDetails {
  demand: ServiceDemand;
  type: DemandType;
  comments: DemandComment[];
  evidences: DemandEvidence[];
  events: DemandEvent[];
}

export interface DemandPerson {
  id: string;
  name: string;
  role: UserRole;
}

/** Opções para vincular a demanda ao contrato, posto, alocação e funcionário. */
export interface DemandLinkOptions {
  people: DemandPerson[];
  contracts: { id: string; title: string; clientName: string }[];
  posts: { id: string; contractId: string; name: string; jobFunction: string }[];
  allocations: { id: string; postId: string; employeeId: string; employeeName: string; endDate?: string }[];
  employees: { id: string; fullName: string }[];
}

interface DemandRow {
  id: string; demand_number: number; type_id: string; stage_id: string; title: string;
  description?: string | null; priority: DemandPriority; due_date?: string | null; status: DemandStatus;
  contract_id?: string | null; post_id?: string | null; allocation_id?: string | null; employee_id?: string | null;
  responsible_id?: string | null; approver_id?: string | null; approved_by?: string | null;
  approved_at?: string | null; closed_at?: string | null; cancel_reason?: string | null;
  created_at: string; updated_at: string;
}

interface StageRow { id: string; type_id: string; name: string; category: DemandStageCategory; position: number; is_active: boolean }
interface TypeRow { id: string; name: string; description?: string | null; default_due_days?: number | null; is_active: boolean }

const demandSelect = `
  id, demand_number, type_id, stage_id, title, description, priority, due_date, status,
  contract_id, post_id, allocation_id, employee_id, responsible_id, approver_id, approved_by,
  approved_at, closed_at, cancel_reason, created_at, updated_at
`;

const nullable = (value?: string) => (value && value.trim() ? value.trim() : null);

const nameMap = <T extends { id: string }>(rows: T[] | null | undefined, key: keyof T) =>
  new Map((rows || []).map((row) => [row.id, String(row[key] ?? '')]));

interface NameLookups {
  profiles: Map<string, string>;
  employees: Map<string, string>;
  contracts: Map<string, string>;
  posts: Map<string, string>;
}

export const mapDemand = (row: DemandRow, names: NameLookups): ServiceDemand => ({
  id: row.id,
  demandNumber: row.demand_number,
  typeId: row.type_id,
  stageId: row.stage_id,
  title: row.title,
  description: row.description || undefined,
  priority: row.priority,
  dueDate: row.due_date || undefined,
  status: row.status,
  contractId: row.contract_id || undefined,
  contractTitle: row.contract_id ? names.contracts.get(row.contract_id) : undefined,
  postId: row.post_id || undefined,
  postName: row.post_id ? names.posts.get(row.post_id) : undefined,
  allocationId: row.allocation_id || undefined,
  employeeId: row.employee_id || undefined,
  employeeName: row.employee_id ? names.employees.get(row.employee_id) : undefined,
  responsibleId: row.responsible_id || undefined,
  responsibleName: row.responsible_id ? names.profiles.get(row.responsible_id) || 'Usuário removido' : undefined,
  approverId: row.approver_id || undefined,
  approverName: row.approver_id ? names.profiles.get(row.approver_id) || 'Usuário removido' : undefined,
  approvedByName: row.approved_by ? names.profiles.get(row.approved_by) || 'Usuário removido' : undefined,
  approvedAt: row.approved_at || undefined,
  closedAt: row.closed_at || undefined,
  cancelReason: row.cancel_reason || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapStage = (row: StageRow): DemandStage => ({
  id: row.id,
  typeId: row.type_id,
  name: row.name,
  category: row.category,
  position: row.position,
  isActive: row.is_active,
});

const loadNameLookups = async (companyId: string): Promise<NameLookups> => {
  const [profiles, employees, contracts, posts] = await Promise.all([
    supabase.from('profiles').select('id, name').eq('company_id', companyId),
    supabase.from('employees').select('id, full_name').eq('company_id', companyId),
    supabase.from('service_contracts').select('id, title').eq('company_id', companyId),
    supabase.from('service_posts').select('id, name').eq('company_id', companyId),
  ]);
  if (profiles.error || employees.error || contracts.error || posts.error) {
    throw new Error('Não foi possível carregar os vínculos das demandas.');
  }
  return {
    profiles: nameMap(profiles.data as { id: string; name: string }[], 'name'),
    employees: nameMap(employees.data as { id: string; full_name: string }[], 'full_name'),
    contracts: nameMap(contracts.data as { id: string; title: string }[], 'title'),
    posts: nameMap(posts.data as { id: string; name: string }[], 'name'),
  };
};

export const getDemandTypes = async (): Promise<DemandType[]> => {
  const companyId = assertPeopleCompany();
  const [types, stages] = await Promise.all([
    supabase.from('service_demand_types').select('id, name, description, default_due_days, is_active').eq('company_id', companyId).order('name'),
    supabase.from('service_demand_stages').select('id, type_id, name, category, position, is_active').eq('company_id', companyId).order('position'),
  ]);
  if (types.error || stages.error) {
    throw new Error(demandErrorMessage(types.error || stages.error, 'Não foi possível carregar os tipos de demanda.'));
  }
  const stageRows = (stages.data || []) as StageRow[];
  return ((types.data || []) as TypeRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    defaultDueDays: row.default_due_days ?? undefined,
    isActive: row.is_active,
    stages: stageRows.filter((stage) => stage.type_id === row.id).map(mapStage),
  }));
};

const FINISHED_WINDOW_DAYS = 30;

export const getDemands = async (filters: DemandFilters = {}): Promise<ServiceDemand[]> => {
  const companyId = assertPeopleCompany();
  let query = supabase
    .from('service_demands')
    .select(demandSelect)
    .eq('company_id', companyId)
    .order('due_date', { ascending: true, nullsFirst: false });
  if (filters.typeId) query = query.eq('type_id', filters.typeId);
  if (filters.responsibleId) query = query.eq('responsible_id', filters.responsibleId);
  if (!filters.includeFinished) {
    const since = new Date(Date.now() - FINISHED_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
    query = query.or(`status.eq.open,closed_at.gte.${since}`);
  }

  const [response, names] = await Promise.all([query, loadNameLookups(companyId)]);
  if (response.error) throw new Error(demandErrorMessage(response.error, 'Não foi possível carregar as demandas.'));

  const search = filters.search?.trim().toLocaleLowerCase('pt-BR');
  return ((response.data || []) as unknown as DemandRow[])
    .map((row) => mapDemand(row, names))
    .filter((demand) => {
      if (!search) return true;
      return [`#${demand.demandNumber}`, demand.title, demand.contractTitle, demand.postName, demand.employeeName, demand.responsibleName]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase('pt-BR').includes(search));
    });
};

export const getDemandDetails = async (id: string): Promise<DemandDetails> => {
  const companyId = assertPeopleCompany();
  const [demandResponse, commentsResponse, evidencesResponse, eventsResponse, types, names] = await Promise.all([
    supabase.from('service_demands').select(demandSelect).eq('id', id).eq('company_id', companyId).maybeSingle(),
    supabase.from('service_demand_comments').select('id, body, author_id, created_at').eq('demand_id', id).eq('company_id', companyId).order('created_at'),
    supabase.from('service_demand_evidences').select('id, label, url, stage_id, added_by, created_at').eq('demand_id', id).eq('company_id', companyId).order('created_at'),
    supabase.from('service_demand_events').select('id, event_type, from_stage_id, to_stage_id, changed_fields, note, actor_id, created_at').eq('demand_id', id).eq('company_id', companyId).order('created_at', { ascending: false }).limit(200),
    getDemandTypes(),
    loadNameLookups(companyId),
  ]);
  if (demandResponse.error || !demandResponse.data) {
    throw new Error(demandErrorMessage(demandResponse.error, 'Demanda não encontrada.'));
  }
  if (commentsResponse.error || evidencesResponse.error || eventsResponse.error) {
    throw new Error('Não foi possível carregar o histórico da demanda.');
  }

  const demand = mapDemand(demandResponse.data as unknown as DemandRow, names);
  const type = types.find((item) => item.id === demand.typeId);
  if (!type) throw new Error('Tipo da demanda não encontrado.');
  const stageNames = new Map(types.flatMap((item) => item.stages).map((stage) => [stage.id, stage.name]));
  const person = (profileId?: string | null) => (profileId ? names.profiles.get(profileId) || 'Usuário removido' : 'Sistema');

  return {
    demand,
    type,
    comments: ((commentsResponse.data || []) as { id: string; body: string; author_id?: string | null; created_at: string }[])
      .map((row) => ({ id: row.id, body: row.body, authorName: person(row.author_id), createdAt: row.created_at })),
    evidences: ((evidencesResponse.data || []) as { id: string; label: string; url: string; stage_id?: string | null; added_by?: string | null; created_at: string }[])
      .map((row) => ({
        id: row.id,
        label: row.label,
        url: row.url,
        stageName: row.stage_id ? stageNames.get(row.stage_id) : undefined,
        addedByName: person(row.added_by),
        createdAt: row.created_at,
      })),
    events: ((eventsResponse.data || []) as {
      id: string; event_type: string; from_stage_id?: string | null; to_stage_id?: string | null;
      changed_fields?: string[] | null; note?: string | null; actor_id?: string | null; created_at: string;
    }[]).map((row) => ({
      id: row.id,
      eventType: row.event_type,
      fromStageName: row.from_stage_id ? stageNames.get(row.from_stage_id) : undefined,
      toStageName: row.to_stage_id ? stageNames.get(row.to_stage_id) : undefined,
      changedFields: row.changed_fields || [],
      note: row.note || undefined,
      actorName: person(row.actor_id),
      createdAt: row.created_at,
    })),
  };
};

export const getDemandLinkOptions = async (): Promise<DemandLinkOptions> => {
  const companyId = assertPeopleCompany();
  const [profiles, contracts, posts, allocations, employees] = await Promise.all([
    supabase.from('profiles').select('id, name, role').eq('company_id', companyId).order('name'),
    supabase.from('service_contracts').select('id, title, client_name').eq('company_id', companyId).is('deleted_at', null).order('title'),
    supabase.from('service_posts').select('id, contract_id, name, job_function').eq('company_id', companyId).order('name'),
    supabase.from('service_post_allocations').select('id, post_id, employee_id, end_date').eq('company_id', companyId).order('start_date', { ascending: false }),
    supabase.from('employees').select('id, full_name, status').eq('company_id', companyId).is('deleted_at', null).order('full_name'),
  ]);
  if (profiles.error || contracts.error || posts.error || allocations.error || employees.error) {
    throw new Error('Não foi possível carregar contratos, postos e pessoas.');
  }
  const employeeRows = (employees.data || []) as { id: string; full_name: string; status: string }[];
  const employeeNames = nameMap(employeeRows, 'full_name');
  return {
    people: ((profiles.data || []) as { id: string; name: string; role: UserRole }[]).map((row) => ({ id: row.id, name: row.name, role: row.role })),
    contracts: ((contracts.data || []) as { id: string; title: string; client_name: string }[]).map((row) => ({ id: row.id, title: row.title, clientName: row.client_name })),
    posts: ((posts.data || []) as { id: string; contract_id: string; name: string; job_function: string }[])
      .map((row) => ({ id: row.id, contractId: row.contract_id, name: row.name, jobFunction: row.job_function })),
    allocations: ((allocations.data || []) as { id: string; post_id: string; employee_id: string; end_date?: string | null }[])
      .map((row) => ({
        id: row.id,
        postId: row.post_id,
        employeeId: row.employee_id,
        employeeName: employeeNames.get(row.employee_id) || 'Funcionário não disponível',
        endDate: row.end_date || undefined,
      })),
    employees: employeeRows.filter((row) => row.status !== 'terminated').map((row) => ({ id: row.id, fullName: row.full_name })),
  };
};

export const ensureDefaultDemandTypes = async (): Promise<number> => {
  assertPeopleCompany();
  const { data, error } = await supabase.rpc('ensure_default_service_demand_types');
  if (error) throw new Error(demandErrorMessage(error, 'Não foi possível criar os tipos padrão.'));
  return Number(data || 0);
};

export const saveDemandType = async (input: DemandTypeInput, id?: string): Promise<string> => {
  assertPeopleCompany();
  const { data, error } = await supabase.rpc('save_service_demand_type', {
    p_type_id: id || null,
    p_name: input.name,
    p_description: nullable(input.description),
    p_default_due_days: input.defaultDueDays ?? null,
    p_is_active: input.isActive,
  });
  if (error) throw new Error(demandErrorMessage(error, 'Não foi possível salvar o tipo de demanda.'));
  return String(data);
};

export const saveDemandStage = async (input: DemandStageInput, id?: string): Promise<string> => {
  assertPeopleCompany();
  const { data, error } = await supabase.rpc('save_service_demand_stage', {
    p_stage_id: id || null,
    p_type_id: input.typeId,
    p_name: input.name,
    p_category: input.category,
    p_is_active: input.isActive,
  });
  if (error) throw new Error(demandErrorMessage(error, 'Não foi possível salvar a etapa.'));
  return String(data);
};

export const createDemand = async (input: DemandInput): Promise<string> => {
  assertPeopleCompany();
  const { data, error } = await supabase.rpc('create_service_demand', {
    p_type_id: input.typeId,
    p_title: input.title,
    p_description: nullable(input.description),
    p_priority: input.priority,
    p_due_date: input.dueDate || null,
    p_contract_id: input.contractId || null,
    p_post_id: input.postId || null,
    p_allocation_id: input.allocationId || null,
    p_employee_id: input.employeeId || null,
    p_responsible_id: input.responsibleId || null,
    p_approver_id: input.approverId || null,
  });
  if (error) throw new Error(demandErrorMessage(error, 'Não foi possível abrir a demanda.'));
  return String(data);
};

export const updateDemand = async (id: string, input: DemandUpdateInput): Promise<void> => {
  assertPeopleCompany();
  const { error } = await supabase.rpc('update_service_demand', {
    p_demand_id: id,
    p_title: input.title,
    p_description: nullable(input.description),
    p_priority: input.priority,
    p_due_date: input.dueDate || null,
  });
  if (error) throw new Error(demandErrorMessage(error, 'Não foi possível salvar a demanda.'));
};

export const assignDemand = async (id: string, responsibleId?: string, approverId?: string): Promise<void> => {
  assertPeopleCompany();
  const { error } = await supabase.rpc('assign_service_demand', {
    p_demand_id: id,
    p_responsible_id: responsibleId || null,
    p_approver_id: approverId || null,
  });
  if (error) throw new Error(demandErrorMessage(error, 'Não foi possível atribuir a demanda.'));
};

export const moveDemand = async (id: string, toStageId: string, note?: string): Promise<void> => {
  assertPeopleCompany();
  const { error } = await supabase.rpc('move_service_demand', {
    p_demand_id: id,
    p_to_stage_id: toStageId,
    p_note: nullable(note),
  });
  if (error) throw new Error(demandErrorMessage(error, 'Não foi possível mover a demanda.'));
};

export const cancelDemand = async (id: string, reason: string): Promise<void> => {
  assertPeopleCompany();
  const { error } = await supabase.rpc('cancel_service_demand', { p_demand_id: id, p_reason: reason });
  if (error) throw new Error(demandErrorMessage(error, 'Não foi possível cancelar a demanda.'));
};

export const addDemandComment = async (id: string, body: string): Promise<string> => {
  assertPeopleCompany();
  const { data, error } = await supabase.rpc('add_service_demand_comment', { p_demand_id: id, p_body: body });
  if (error) throw new Error(demandErrorMessage(error, 'Não foi possível registrar o comentário.'));
  return String(data);
};

export const addDemandEvidence = async (id: string, label: string, url: string): Promise<string> => {
  assertPeopleCompany();
  const { data, error } = await supabase.rpc('add_service_demand_evidence', {
    p_demand_id: id,
    p_label: label.trim(),
    p_url: url.trim(),
  });
  if (error) throw new Error(demandErrorMessage(error, 'Não foi possível anexar a evidência.'));
  return String(data);
};
