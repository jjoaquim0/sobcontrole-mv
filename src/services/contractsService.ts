import { supabase } from '@/lib/supabase';
import { assertPeopleCompany } from '@/services/peopleService';
import {
  ContractValidationStatus,
  ContractVersionKind,
  PostAllocation,
  PostAllocationRole,
  ServiceContract,
  ServiceContractAuditEvent,
  ServiceContractStatus,
  ServiceContractVersion,
  ServicePost,
  ServicePostStatus,
} from '@/types';
import { getPostCoverage, todayIso } from '@/pages/contracts/contractsDomain';

export interface ContractFilters {
  search?: string;
  status?: ServiceContractStatus | 'all';
  validationStatus?: ContractValidationStatus | 'all';
}

export interface ContractInput {
  customerId?: string;
  clientName: string;
  title: string;
  contractNumber?: string;
  location?: string;
  scopeSummary?: string;
  startDate?: string;
  endDate?: string;
  cctReference?: string;
  sourceDocumentsUrl?: string;
  validationStatus: ContractValidationStatus;
  status: ServiceContractStatus;
  internalNotes?: string;
}

export interface ContractVersionInput {
  kind: ContractVersionKind;
  title: string;
  signedAt?: string;
  effectiveStart?: string;
  effectiveEnd?: string;
  documentUrl?: string;
  changeSummary?: string;
  validationStatus: ContractValidationStatus;
}

export interface PostInput {
  name: string;
  jobFunction: string;
  workSchedule: string;
  requiredHeadcount: number;
  operationalManagerId?: string;
  requirements?: string;
  status: ServicePostStatus;
}

export interface AllocationInput {
  postId: string;
  employeeId: string;
  allocationRole: PostAllocationRole;
  startDate: string;
  notes?: string;
}

export interface EndAllocationInput {
  allocationId: string;
  endDate: string;
  endReason: string;
}

/** Contrato com o resumo de cobertura dos postos ativos no dia. */
export interface ContractListItem extends ServiceContract {
  customerName?: string;
  activePosts: number;
  requiredHeadcount: number;
  uncoveredPositions: number;
  postsCoveredBySubstitute: number;
}

export interface ContractDetails {
  contract: ServiceContract & { customerName?: string };
  versions: ServiceContractVersion[];
  posts: ServicePost[];
  allocations: PostAllocation[];
  audit: ServiceContractAuditEvent[];
}

const contractSelect = `
  id, company_id, customer_id, client_name, title, contract_number, location, scope_summary,
  start_date, end_date, cct_reference, source_documents_url, validation_status, status,
  internal_notes, created_at, updated_at
`;

interface ContractRow {
  id: string; company_id: string; customer_id?: string | null; client_name: string; title: string;
  contract_number?: string | null; location?: string | null; scope_summary?: string | null;
  start_date?: string | null; end_date?: string | null; cct_reference?: string | null;
  source_documents_url?: string | null; validation_status: ContractValidationStatus;
  status: ServiceContractStatus; internal_notes?: string | null; created_at: string; updated_at: string;
}

interface VersionRow {
  id: string; contract_id: string; version_number: number; kind: ContractVersionKind; title: string;
  signed_at?: string | null; effective_start?: string | null; effective_end?: string | null;
  document_url?: string | null; change_summary?: string | null; validation_status: ContractValidationStatus;
  created_at: string;
}

interface PostRow {
  id: string; contract_id: string; name: string; job_function: string; work_schedule: string;
  required_headcount: number; operational_manager_id?: string | null; requirements?: string | null;
  status: ServicePostStatus; created_at: string;
}

interface AllocationRow {
  id: string; post_id: string; employee_id: string; allocation_role: PostAllocationRole;
  start_date: string; end_date?: string | null; end_reason?: string | null; notes?: string | null;
  created_at: string;
}

interface AuditRow {
  id: string; contract_id?: string | null; entity_type: ServiceContractAuditEvent['entityType'];
  entity_id: string; event_type: string; changed_fields?: string[] | null; actor_id?: string | null;
  created_at: string;
}

/** Códigos usados pelas RPCs para mensagens de validação escritas para o usuário. */
const USER_FACING_CODES = new Set(['22023', 'P0002', '23505']);

export const contractErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error !== 'object' || error === null) return fallback;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (code === '42501' || String(message || '').includes('Acesso não autorizado')) {
    return 'Você não tem permissão para realizar esta ação.';
  }
  if (typeof code === 'string' && USER_FACING_CODES.has(code) && typeof message === 'string' && message) {
    return message;
  }
  return fallback;
};

const nullable = (value?: string) => (value && value.trim() ? value.trim() : null);

export const mapContract = (row: ContractRow): ServiceContract => ({
  id: row.id,
  companyId: row.company_id,
  customerId: row.customer_id || undefined,
  clientName: row.client_name,
  title: row.title,
  contractNumber: row.contract_number || undefined,
  location: row.location || undefined,
  scopeSummary: row.scope_summary || undefined,
  startDate: row.start_date || undefined,
  endDate: row.end_date || undefined,
  cctReference: row.cct_reference || undefined,
  sourceDocumentsUrl: row.source_documents_url || undefined,
  validationStatus: row.validation_status,
  status: row.status,
  internalNotes: row.internal_notes || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapVersion = (row: VersionRow): ServiceContractVersion => ({
  id: row.id,
  contractId: row.contract_id,
  versionNumber: row.version_number,
  kind: row.kind,
  title: row.title,
  signedAt: row.signed_at || undefined,
  effectiveStart: row.effective_start || undefined,
  effectiveEnd: row.effective_end || undefined,
  documentUrl: row.document_url || undefined,
  changeSummary: row.change_summary || undefined,
  validationStatus: row.validation_status,
  createdAt: row.created_at,
});

const mapPost = (row: PostRow, employeeNames: Map<string, string>): ServicePost => ({
  id: row.id,
  contractId: row.contract_id,
  name: row.name,
  jobFunction: row.job_function,
  workSchedule: row.work_schedule,
  requiredHeadcount: row.required_headcount,
  operationalManagerId: row.operational_manager_id || undefined,
  operationalManagerName: row.operational_manager_id ? employeeNames.get(row.operational_manager_id) : undefined,
  requirements: row.requirements || undefined,
  status: row.status,
  createdAt: row.created_at,
});

const mapAllocation = (row: AllocationRow, employeeNames: Map<string, string>): PostAllocation => ({
  id: row.id,
  postId: row.post_id,
  employeeId: row.employee_id,
  employeeName: employeeNames.get(row.employee_id) || 'Funcionário não disponível',
  allocationRole: row.allocation_role,
  startDate: row.start_date,
  endDate: row.end_date || undefined,
  endReason: row.end_reason || undefined,
  notes: row.notes || undefined,
  createdAt: row.created_at,
});

const nameMap = <T extends { id: string }>(rows: T[] | null | undefined, key: keyof T) =>
  new Map((rows || []).map((row) => [row.id, String(row[key] ?? '')]));

export const getContracts = async (filters: ContractFilters = {}): Promise<ContractListItem[]> => {
  const companyId = assertPeopleCompany();
  let query = supabase
    .from('service_contracts')
    .select(contractSelect)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('end_date', { ascending: true, nullsFirst: false });
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
  if (filters.validationStatus && filters.validationStatus !== 'all') {
    query = query.eq('validation_status', filters.validationStatus);
  }

  const today = todayIso();
  const [contractsResponse, postsResponse, allocationsResponse, customersResponse] = await Promise.all([
    query,
    supabase.from('service_posts').select('id, contract_id, required_headcount, status').eq('company_id', companyId),
    supabase
      .from('service_post_allocations')
      .select('post_id, allocation_role, start_date, end_date')
      .eq('company_id', companyId)
      .or(`end_date.is.null,end_date.gte.${today}`),
    supabase.from('customers').select('id, full_name').eq('company_id', companyId),
  ]);
  if (contractsResponse.error) {
    throw new Error(contractErrorMessage(contractsResponse.error, 'Não foi possível carregar os contratos.'));
  }
  if (postsResponse.error || allocationsResponse.error || customersResponse.error) {
    throw new Error('Não foi possível carregar os postos dos contratos.');
  }

  const posts = (postsResponse.data || []) as { id: string; contract_id: string; required_headcount: number; status: ServicePostStatus }[];
  const allocations = ((allocationsResponse.data || []) as { post_id: string; allocation_role: PostAllocationRole; start_date: string; end_date?: string | null }[])
    .map((row) => ({ postId: row.post_id, allocationRole: row.allocation_role, startDate: row.start_date, endDate: row.end_date || undefined }));
  const customerNames = nameMap(customersResponse.data as { id: string; full_name: string }[], 'full_name');

  const search = filters.search?.trim().toLocaleLowerCase('pt-BR');
  return ((contractsResponse.data || []) as unknown as ContractRow[])
    .map((row) => {
      const contract = mapContract(row);
      const activePosts = posts.filter((post) => post.contract_id === row.id && post.status === 'active');
      const coverages = activePosts.map((post) =>
        getPostCoverage({ id: post.id, requiredHeadcount: post.required_headcount, status: post.status }, allocations, today));
      return {
        ...contract,
        customerName: contract.customerId ? customerNames.get(contract.customerId) : undefined,
        activePosts: activePosts.length,
        requiredHeadcount: coverages.reduce((total, coverage) => total + coverage.required, 0),
        uncoveredPositions: coverages.reduce((total, coverage) => total + coverage.uncovered, 0),
        postsCoveredBySubstitute: coverages.filter((coverage) => coverage.state === 'covered_by_substitute').length,
      };
    })
    .filter((contract) => {
      if (!search) return true;
      return [contract.title, contract.clientName, contract.contractNumber, contract.location]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase('pt-BR').includes(search));
    });
};

export const getContractDetails = async (id: string): Promise<ContractDetails> => {
  const companyId = assertPeopleCompany();
  const [contractResponse, versionsResponse, postsResponse, allocationsResponse, auditResponse, employeesResponse, profilesResponse, customersResponse] = await Promise.all([
    supabase.from('service_contracts').select(contractSelect).eq('id', id).eq('company_id', companyId).is('deleted_at', null).single(),
    supabase.from('service_contract_versions').select('id, contract_id, version_number, kind, title, signed_at, effective_start, effective_end, document_url, change_summary, validation_status, created_at').eq('contract_id', id).eq('company_id', companyId).order('version_number'),
    supabase.from('service_posts').select('id, contract_id, name, job_function, work_schedule, required_headcount, operational_manager_id, requirements, status, created_at').eq('contract_id', id).eq('company_id', companyId).order('name'),
    supabase.from('service_post_allocations').select('id, post_id, employee_id, allocation_role, start_date, end_date, end_reason, notes, created_at').eq('company_id', companyId).order('start_date', { ascending: false }),
    supabase.from('service_contract_audit_events').select('id, contract_id, entity_type, entity_id, event_type, changed_fields, actor_id, created_at').eq('contract_id', id).eq('company_id', companyId).order('created_at', { ascending: false }).limit(100),
    supabase.from('employees').select('id, full_name').eq('company_id', companyId),
    supabase.from('profiles').select('id, name').eq('company_id', companyId),
    supabase.from('customers').select('id, full_name').eq('company_id', companyId),
  ]);
  if (contractResponse.error || !contractResponse.data) {
    throw new Error(contractErrorMessage(contractResponse.error, 'Contrato não encontrado.'));
  }
  if (versionsResponse.error || postsResponse.error || allocationsResponse.error || auditResponse.error
    || employeesResponse.error || profilesResponse.error || customersResponse.error) {
    throw new Error('Não foi possível carregar os detalhes do contrato.');
  }

  const employeeNames = nameMap(employeesResponse.data as { id: string; full_name: string }[], 'full_name');
  const profileNames = nameMap(profilesResponse.data as { id: string; name: string }[], 'name');
  const customerNames = nameMap(customersResponse.data as { id: string; full_name: string }[], 'full_name');
  const contract = mapContract(contractResponse.data as unknown as ContractRow);
  const posts = ((postsResponse.data || []) as unknown as PostRow[]).map((row) => mapPost(row, employeeNames));
  const postIds = new Set(posts.map((post) => post.id));

  return {
    contract: { ...contract, customerName: contract.customerId ? customerNames.get(contract.customerId) : undefined },
    versions: ((versionsResponse.data || []) as unknown as VersionRow[]).map(mapVersion),
    posts,
    allocations: ((allocationsResponse.data || []) as unknown as AllocationRow[])
      .filter((row) => postIds.has(row.post_id))
      .map((row) => mapAllocation(row, employeeNames)),
    audit: ((auditResponse.data || []) as unknown as AuditRow[]).map((row) => ({
      id: row.id,
      contractId: row.contract_id || undefined,
      entityType: row.entity_type,
      entityId: row.entity_id,
      eventType: row.event_type,
      changedFields: row.changed_fields || [],
      actorName: row.actor_id ? profileNames.get(row.actor_id) || 'Usuário removido' : 'Sistema',
      createdAt: row.created_at,
    })),
  };
};

export const saveContract = async (input: ContractInput, id?: string): Promise<string> => {
  assertPeopleCompany();
  const { data, error } = await supabase.rpc('save_service_contract', {
    p_contract_id: id || null,
    p_customer_id: input.customerId || null,
    p_client_name: input.clientName,
    p_title: input.title,
    p_contract_number: nullable(input.contractNumber),
    p_location: nullable(input.location),
    p_scope_summary: nullable(input.scopeSummary),
    p_start_date: input.startDate || null,
    p_end_date: input.endDate || null,
    p_cct_reference: nullable(input.cctReference),
    p_source_documents_url: nullable(input.sourceDocumentsUrl),
    p_validation_status: input.validationStatus,
    p_status: input.status,
    p_internal_notes: nullable(input.internalNotes),
  });
  if (error) throw new Error(contractErrorMessage(error, 'Não foi possível salvar o contrato.'));
  return String(data);
};

export const saveContractVersion = async (contractId: string, input: ContractVersionInput, id?: string): Promise<string> => {
  assertPeopleCompany();
  const { data, error } = await supabase.rpc('save_service_contract_version', {
    p_version_id: id || null,
    p_contract_id: contractId,
    p_kind: input.kind,
    p_title: input.title,
    p_signed_at: input.signedAt || null,
    p_effective_start: input.effectiveStart || null,
    p_effective_end: input.effectiveEnd || null,
    p_document_url: nullable(input.documentUrl),
    p_change_summary: nullable(input.changeSummary),
    p_validation_status: input.validationStatus,
  });
  if (error) throw new Error(contractErrorMessage(error, 'Não foi possível salvar a versão do contrato.'));
  return String(data);
};

export const savePost = async (contractId: string, input: PostInput, id?: string): Promise<string> => {
  assertPeopleCompany();
  const { data, error } = await supabase.rpc('save_service_post', {
    p_post_id: id || null,
    p_contract_id: contractId,
    p_name: input.name,
    p_job_function: input.jobFunction,
    p_work_schedule: input.workSchedule,
    p_required_headcount: input.requiredHeadcount,
    p_operational_manager_id: input.operationalManagerId || null,
    p_requirements: nullable(input.requirements),
    p_status: input.status,
  });
  if (error) throw new Error(contractErrorMessage(error, 'Não foi possível salvar o posto.'));
  return String(data);
};

export const allocateEmployee = async (input: AllocationInput): Promise<string> => {
  assertPeopleCompany();
  const { data, error } = await supabase.rpc('allocate_employee_to_post', {
    p_post_id: input.postId,
    p_employee_id: input.employeeId,
    p_allocation_role: input.allocationRole,
    p_start_date: input.startDate,
    p_notes: nullable(input.notes),
  });
  if (error) throw new Error(contractErrorMessage(error, 'Não foi possível alocar o funcionário.'));
  return String(data);
};

export const endAllocation = async (input: EndAllocationInput): Promise<void> => {
  assertPeopleCompany();
  const { error } = await supabase.rpc('end_post_allocation', {
    p_allocation_id: input.allocationId,
    p_end_date: input.endDate,
    p_end_reason: input.endReason,
  });
  if (error) throw new Error(contractErrorMessage(error, 'Não foi possível encerrar a alocação.'));
};
