import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import {
  Commission,
  CommissionStatus,
  Employee,
  EmployeeStatus,
  EmploymentType,
  PeopleAuditEvent,
} from '@/types';

export interface EmployeeFilters {
  search?: string;
  status?: EmployeeStatus | 'all';
  department?: string;
  teamId?: string;
  employmentType?: EmploymentType | 'all';
}

export interface EmployeeInput {
  fullName: string;
  email?: string;
  phone?: string;
  cpf?: string;
  clearCpf?: boolean;
  birthDate?: string;
  jobTitle: string;
  department?: string;
  teamId?: string;
  managerEmployeeId?: string;
  salesProfileId?: string;
  employmentType: EmploymentType;
  admissionDate?: string;
  status: EmployeeStatus;
  internalNotes?: string;
  commissionEnabled: boolean;
  commissionRuleNotes?: string;
}

export interface CommissionFilters {
  search?: string;
  employeeId?: string;
  teamId?: string;
  status?: CommissionStatus | 'all';
  dateFrom?: string;
  dateTo?: string;
}

export interface CommissionInput {
  employeeId: string;
  teamId?: string;
  description: string;
  referencePeriod?: string;
  grossAmount: number;
  internalNotes?: string;
}

const employeeSelect = `
  id, company_id, full_name, email, phone, cpf_last_four, birth_date,
  job_title, department, team_id, manager_employee_id, sales_profile_id,
  employment_type, admission_date, status, internal_notes, commission_enabled,
  commission_rule_notes, created_at, updated_at
`;

interface EmployeeRow {
  id: string; company_id: string; full_name: string; email?: string | null; phone?: string | null;
  cpf_last_four?: string | null; birth_date?: string | null; job_title: string; department?: string | null;
  team_id?: string | null; manager_employee_id?: string | null; sales_profile_id?: string | null;
  employment_type: EmploymentType; admission_date?: string | null; status: EmployeeStatus;
  internal_notes?: string | null; commission_enabled: boolean; commission_rule_notes?: string | null;
  created_at: string; updated_at: string;
}

interface CommissionRow {
  id: string; company_id: string; employee_id: string; description: string; reference_period?: string | null;
  team_id?: string | null;
  gross_amount: number | string; status: CommissionStatus; internal_notes?: string | null; paid_at?: string | null;
  canceled_at?: string | null; created_by?: string | null; created_at: string; updated_at: string;
}

interface AuditRow {
  id: string; company_id: string; employee_id?: string | null; team_id?: string | null;
  entity_type: 'employee' | 'team' | 'goal' | 'commission';
  entity_id: string; event_type: string; changed_fields?: string[] | null; actor_id?: string | null;
  created_at: string;
}

const monthEndDate = (month: string): string => {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
};

export const assertPeopleCompany = () => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada. Entre novamente.');
  return companyId;
};

const mapEmployee = (
  row: EmployeeRow,
  teamNames: Map<string, string> = new Map(),
  employeeNames: Map<string, string> = new Map(),
): Employee => ({
  id: row.id,
  companyId: row.company_id,
  fullName: row.full_name,
  email: row.email || undefined,
  phone: row.phone || undefined,
  cpfMasked: row.cpf_last_four ? `***.***.***-${row.cpf_last_four}` : undefined,
  birthDate: row.birth_date || undefined,
  jobTitle: row.job_title,
  department: row.department || undefined,
  teamId: row.team_id || undefined,
  teamName: row.team_id ? teamNames.get(row.team_id) : undefined,
  managerEmployeeId: row.manager_employee_id || undefined,
  managerName: row.manager_employee_id ? employeeNames.get(row.manager_employee_id) : undefined,
  salesProfileId: row.sales_profile_id || undefined,
  employmentType: row.employment_type,
  admissionDate: row.admission_date || undefined,
  status: row.status,
  internalNotes: row.internal_notes || undefined,
  commissionEnabled: row.commission_enabled,
  commissionRuleNotes: row.commission_rule_notes || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapCommission = (
  row: CommissionRow,
  employeeNames: Map<string, string>,
  teamNames: Map<string, string>,
  profileNames: Map<string, string>,
): Commission => ({
  id: row.id,
  companyId: row.company_id,
  employeeId: row.employee_id,
  employeeName: employeeNames.get(row.employee_id) || 'Funcionário não disponível',
  teamId: row.team_id || undefined,
  teamName: row.team_id ? teamNames.get(row.team_id) : undefined,
  description: row.description,
  referencePeriod: row.reference_period || undefined,
  grossAmount: Number(row.gross_amount),
  status: row.status,
  internalNotes: row.internal_notes || undefined,
  paidAt: row.paid_at || undefined,
  canceledAt: row.canceled_at || undefined,
  createdBy: row.created_by || undefined,
  createdByName: row.created_by ? profileNames.get(row.created_by) : undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const safeMessage = (error: unknown, fallback: string) => {
  const message = typeof error === 'object' && error !== null && 'message' in error
    ? String((error as { message?: unknown }).message || '')
    : '';
  if (message.includes('Já existe um funcionário') || message.includes('CPF inválido')) return message;
  if (message.includes('Acesso não autorizado')) return 'Você não tem permissão para realizar esta ação.';
  return fallback;
};

export const getEmployees = async (filters: EmployeeFilters = {}): Promise<Employee[]> => {
  const companyId = assertPeopleCompany();
  let query = supabase
    .from('employees')
    .select(employeeSelect)
    .eq('company_id', companyId)
    .order('full_name');

  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
  if (filters.department) query = query.eq('department', filters.department);
  if (filters.teamId) query = query.eq('team_id', filters.teamId);
  if (filters.employmentType && filters.employmentType !== 'all') {
    query = query.eq('employment_type', filters.employmentType);
  }

  const [{ data, error }, teamsResponse, namesResponse] = await Promise.all([
    query,
    supabase.from('teams').select('id, name').eq('company_id', companyId),
    supabase.from('employees').select('id, full_name').eq('company_id', companyId),
  ]);
  if (error) throw new Error(safeMessage(error, 'Não foi possível carregar os funcionários.'));
  if (teamsResponse.error || namesResponse.error) {
    throw new Error('Não foi possível carregar os relacionamentos dos funcionários.');
  }
  const teamNames = new Map((teamsResponse.data || []).map((team) => [team.id, team.name]));
  const employeeNames = new Map((namesResponse.data || []).map((employee) => [employee.id, employee.full_name]));

  const search = filters.search?.trim().toLocaleLowerCase('pt-BR');
  return ((data || []) as unknown as EmployeeRow[]).map((row) => mapEmployee(row, teamNames, employeeNames)).filter((employee) => {
    if (!search) return true;
    return [employee.fullName, employee.jobTitle, employee.department, employee.email]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase('pt-BR').includes(search));
  });
};

export const getEmployeeById = async (id: string): Promise<Employee> => {
  const companyId = assertPeopleCompany();
  const [{ data, error }, teamsResponse, namesResponse] = await Promise.all([
    supabase.from('employees').select(employeeSelect).eq('id', id).eq('company_id', companyId).single(),
    supabase.from('teams').select('id, name').eq('company_id', companyId),
    supabase.from('employees').select('id, full_name').eq('company_id', companyId),
  ]);
  if (error) throw new Error(safeMessage(error, 'Funcionário não encontrado.'));
  if (teamsResponse.error || namesResponse.error) {
    throw new Error('Não foi possível carregar os relacionamentos do funcionário.');
  }
  return mapEmployee(
    data as unknown as EmployeeRow,
    new Map((teamsResponse.data || []).map((team) => [team.id, team.name])),
    new Map((namesResponse.data || []).map((employee) => [employee.id, employee.full_name])),
  );
};

export const saveEmployee = async (input: EmployeeInput, id?: string): Promise<string> => {
  assertPeopleCompany();
  const { data, error } = await supabase.rpc('save_employee', {
    p_employee_id: id || null,
    p_full_name: input.fullName,
    p_email: input.email || null,
    p_phone: input.phone || null,
    p_cpf: input.cpf || null,
    p_clear_cpf: Boolean(input.clearCpf),
    p_birth_date: input.birthDate || null,
    p_job_title: input.jobTitle,
    p_department: input.department || null,
    p_team_id: input.teamId || null,
    p_manager_employee_id: input.managerEmployeeId || null,
    p_sales_profile_id: input.salesProfileId || null,
    p_employment_type: input.employmentType,
    p_admission_date: input.admissionDate || null,
    p_status: input.status,
    p_internal_notes: input.internalNotes || null,
    p_commission_enabled: input.commissionEnabled,
    p_commission_rule_notes: input.commissionRuleNotes || null,
  });
  if (error) throw new Error(safeMessage(error, 'Não foi possível salvar o funcionário.'));
  return String(data);
};

export const setEmployeeStatus = async (id: string, status: EmployeeStatus) => {
  assertPeopleCompany();
  const { error } = await supabase.rpc('set_employee_status', {
    p_employee_id: id,
    p_status: status,
  });
  if (error) throw new Error(safeMessage(error, 'Não foi possível alterar o status.'));
};

export const getCommissions = async (filters: CommissionFilters = {}): Promise<Commission[]> => {
  const companyId = assertPeopleCompany();
  let query = supabase
    .from('commissions')
    .select(`
      id, company_id, employee_id, team_id, description, reference_period, gross_amount, status,
      internal_notes, paid_at, canceled_at, created_by, created_at, updated_at
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (filters.employeeId) query = query.eq('employee_id', filters.employeeId);
  if (filters.teamId) query = query.eq('team_id', filters.teamId);
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
  if (filters.dateFrom) query = query.gte('reference_period', `${filters.dateFrom}-01`);
  if (filters.dateTo) query = query.lte('reference_period', monthEndDate(filters.dateTo));

  const [{ data, error }, employeesResponse, teamsResponse, profilesResponse] = await Promise.all([
    query,
    supabase.from('employees').select('id, full_name').eq('company_id', companyId),
    supabase.from('teams').select('id, name').eq('company_id', companyId),
    supabase.from('profiles').select('id, name').eq('company_id', companyId),
  ]);
  if (error) throw new Error(safeMessage(error, 'Não foi possível carregar as comissões.'));
  if (employeesResponse.error || teamsResponse.error || profilesResponse.error) {
    throw new Error('Não foi possível carregar os relacionamentos das comissões.');
  }
  const employeeNames = new Map((employeesResponse.data || []).map((employee) => [employee.id, employee.full_name]));
  const teamNames = new Map((teamsResponse.data || []).map((team) => [team.id, team.name]));
  const profileNames = new Map((profilesResponse.data || []).map((profile) => [profile.id, profile.name]));
  const search = filters.search?.trim().toLocaleLowerCase('pt-BR');
  return ((data || []) as CommissionRow[]).map((row) => mapCommission(row, employeeNames, teamNames, profileNames)).filter((commission) => {
    if (!search) return true;
    return [commission.employeeName, commission.description]
      .some((value) => value.toLocaleLowerCase('pt-BR').includes(search));
  });
};

export const saveCommission = async (input: CommissionInput, id?: string): Promise<string> => {
  assertPeopleCompany();
  const { data, error } = await supabase.rpc('save_commission', {
    p_commission_id: id || null,
    p_employee_id: input.employeeId,
    p_team_id: input.teamId || null,
    p_description: input.description,
    p_reference_period: input.referencePeriod ? `${input.referencePeriod}-01` : null,
    p_gross_amount: input.grossAmount,
    p_internal_notes: input.internalNotes || null,
  });
  if (error) throw new Error(safeMessage(error, 'Não foi possível salvar a comissão.'));
  return String(data);
};

export const setCommissionStatus = async (id: string, status: CommissionStatus) => {
  assertPeopleCompany();
  const { error } = await supabase.rpc('set_commission_status', {
    p_commission_id: id,
    p_status: status,
  });
  if (error) throw new Error(safeMessage(error, 'Não foi possível alterar o status da comissão.'));
};

export const getPeopleAudit = async (employeeId: string): Promise<PeopleAuditEvent[]> => {
  const companyId = assertPeopleCompany();
  const [{ data, error }, profilesResponse] = await Promise.all([
    supabase.from('people_audit_events').select(`
      id, company_id, employee_id, team_id, entity_type, entity_id, event_type,
      changed_fields, actor_id, created_at
    `).eq('company_id', companyId).eq('employee_id', employeeId).order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, name').eq('company_id', companyId),
  ]);
  if (error) throw new Error(safeMessage(error, 'Não foi possível carregar o histórico.'));
  if (profilesResponse.error) throw new Error('Não foi possível carregar os responsáveis do histórico.');
  const profileNames = new Map((profilesResponse.data || []).map((profile) => [profile.id, profile.name]));
  return ((data || []) as AuditRow[]).map((row) => ({
    id: row.id,
    companyId: row.company_id,
    employeeId: row.employee_id || undefined,
    teamId: row.team_id || undefined,
    entityType: row.entity_type,
    entityId: row.entity_id,
    eventType: row.event_type,
    changedFields: row.changed_fields || [],
    actorId: row.actor_id || undefined,
    actorName: row.actor_id ? profileNames.get(row.actor_id) || 'Usuário não disponível' : 'Sistema',
    createdAt: row.created_at,
  }));
};
