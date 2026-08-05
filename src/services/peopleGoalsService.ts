import { supabase } from '@/lib/supabase';
import {
  PeopleAuditEvent,
  SalesGoal,
  SalesGoalAssignment,
  SalesGoalPeriod,
  SalesGoalStatus,
  SalesGoalType,
  SalesProfileOption,
  Team,
  TeamPerformance,
  TeamStatus,
} from '@/types';
import { assertPeopleCompany, getEmployees } from '@/services/peopleService';

export interface TeamFilters {
  search?: string;
  status?: TeamStatus | 'all';
}

export interface TeamInput {
  name: string;
  description?: string;
  managerEmployeeId?: string;
  status: TeamStatus;
}

export interface SalesGoalFilters {
  search?: string;
  teamId?: string;
  employeeId?: string;
  status?: SalesGoalStatus | 'all';
  dateFrom?: string;
  dateTo?: string;
}

export interface SalesGoalInput {
  name: string;
  goalType: SalesGoalType;
  assignmentType: SalesGoalAssignment;
  employeeId?: string;
  teamId?: string;
  periodType: SalesGoalPeriod;
  targetValue: number;
  startDate: string;
  endDate: string;
  notes?: string;
}

interface TeamRow {
  id: string;
  company_id: string;
  name: string;
  description?: string | null;
  manager_employee_id?: string | null;
  status: TeamStatus;
  created_at: string;
  updated_at: string;
}

interface GoalRow {
  id: string;
  company_id: string;
  name: string;
  goal_type: SalesGoalType;
  assignment_type: SalesGoalAssignment;
  employee_id?: string | null;
  team_id?: string | null;
  period_type: SalesGoalPeriod;
  target_value: string | number;
  start_date: string;
  end_date: string;
  status: SalesGoalStatus;
  notes?: string | null;
  result_source: 'automatic' | 'manual';
  manual_result: string | number;
  created_at: string;
  updated_at: string;
}

interface ProgressRow {
  goal_id: string;
  current_result: string | number;
  progress_percent: string | number;
  effective_status: SalesGoalStatus;
  has_automatic_source: boolean;
}

interface TeamSalesRow {
  team_id: string;
  sales_total: string | number;
  has_sales_source: boolean;
}

interface AuditRow {
  id: string;
  company_id: string;
  employee_id?: string | null;
  team_id?: string | null;
  entity_type: 'employee' | 'team' | 'goal' | 'commission';
  entity_id: string;
  event_type: string;
  changed_fields?: string[] | null;
  actor_id?: string | null;
  created_at: string;
}

export const isGoalAtRisk = (goal: SalesGoal, today = new Date()) => {
  if (goal.effectiveStatus !== 'active') return false;
  const start = new Date(`${goal.startDate}T12:00:00`);
  const end = new Date(`${goal.endDate}T12:00:00`);
  if (today < start || today > end) return false;
  const total = Math.max(1, end.getTime() - start.getTime());
  const elapsed = Math.min(1, Math.max(0, (today.getTime() - start.getTime()) / total));
  return goal.progressPercent + 10 < elapsed * 100;
};

const safeMessage = (error: unknown, fallback: string) => {
  const message = typeof error === 'object' && error !== null && 'message' in error
    ? String((error as { message?: unknown }).message || '')
    : '';
  if (message.includes('Acesso não autorizado')) return 'Você não tem permissão para realizar esta ação.';
  if (message.includes('Já existe uma equipe')) return message;
  return fallback;
};

export const getTeams = async (filters: TeamFilters = {}): Promise<Team[]> => {
  const companyId = assertPeopleCompany();
  let query = supabase
    .from('teams')
    .select('id, company_id, name, description, manager_employee_id, status, created_at, updated_at')
    .eq('company_id', companyId)
    .order('name');
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
  const [{ data, error }, employees] = await Promise.all([query, getEmployees()]);
  if (error) throw new Error(safeMessage(error, 'Não foi possível carregar as equipes.'));
  const employeeNames = new Map(employees.map((employee) => [employee.id, employee.fullName]));
  const search = filters.search?.trim().toLocaleLowerCase('pt-BR');
  return ((data || []) as TeamRow[]).map((row) => ({
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    description: row.description || undefined,
    managerEmployeeId: row.manager_employee_id || undefined,
    managerName: row.manager_employee_id ? employeeNames.get(row.manager_employee_id) : undefined,
    status: row.status,
    activeMembers: employees.filter((employee) => employee.teamId === row.id && employee.status === 'active').length,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })).filter((team) => !search || [team.name, team.description, team.managerName]
    .filter(Boolean).some((value) => value!.toLocaleLowerCase('pt-BR').includes(search)));
};

export const saveTeam = async (input: TeamInput, id?: string) => {
  assertPeopleCompany();
  const { data, error } = await supabase.rpc('save_team', {
    p_team_id: id || null,
    p_name: input.name,
    p_description: input.description || null,
    p_manager_employee_id: input.managerEmployeeId || null,
    p_status: input.status,
  });
  if (error) throw new Error(safeMessage(error, 'Não foi possível salvar a equipe.'));
  return String(data);
};

export const setTeamStatus = async (id: string, status: TeamStatus) => {
  assertPeopleCompany();
  const { error } = await supabase.rpc('set_team_status', { p_team_id: id, p_status: status });
  if (error) throw new Error(safeMessage(error, 'Não foi possível alterar o status da equipe.'));
};

export const getSalesProfiles = async (): Promise<SalesProfileOption[]> => {
  const companyId = assertPeopleCompany();
  const { data, error } = await supabase.from('profiles').select('id, name, email').eq('company_id', companyId).order('name');
  if (error) throw new Error('Não foi possível carregar os usuários vendedores.');
  return (data || []).map((profile) => ({ id: profile.id, name: profile.name, email: profile.email }));
};

export const getSalesGoals = async (filters: SalesGoalFilters = {}): Promise<SalesGoal[]> => {
  const companyId = assertPeopleCompany();
  let query = supabase.from('sales_goals').select(`
    id, company_id, name, goal_type, assignment_type, employee_id, team_id, period_type,
    target_value, start_date, end_date, status, notes, result_source, manual_result, created_at, updated_at
  `).eq('company_id', companyId).order('start_date', { ascending: false });
  if (filters.teamId) query = query.eq('team_id', filters.teamId);
  if (filters.employeeId) query = query.eq('employee_id', filters.employeeId);
  if (filters.dateFrom) query = query.gte('end_date', filters.dateFrom);
  if (filters.dateTo) query = query.lte('start_date', filters.dateTo);
  const [{ data, error }, progressResponse, employees, teamsResponse] = await Promise.all([
    query,
    supabase.rpc('get_sales_goal_progress'),
    getEmployees(),
    supabase.from('teams').select('id, name').eq('company_id', companyId),
  ]);
  if (error || progressResponse.error || teamsResponse.error) throw new Error('Não foi possível carregar as metas de vendas.');
  const progress = new Map(((progressResponse.data || []) as ProgressRow[]).map((row) => [row.goal_id, row]));
  const employeeNames = new Map(employees.map((employee) => [employee.id, employee.fullName]));
  const teamNames = new Map((teamsResponse.data || []).map((team) => [team.id, team.name]));
  const search = filters.search?.trim().toLocaleLowerCase('pt-BR');
  return ((data || []) as GoalRow[]).map((row) => {
    const result = progress.get(row.id);
    return {
      id: row.id,
      companyId: row.company_id,
      name: row.name,
      goalType: row.goal_type,
      assignmentType: row.assignment_type,
      employeeId: row.employee_id || undefined,
      employeeName: row.employee_id ? employeeNames.get(row.employee_id) : undefined,
      teamId: row.team_id || undefined,
      teamName: row.team_id ? teamNames.get(row.team_id) : undefined,
      periodType: row.period_type,
      targetValue: Number(row.target_value),
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      effectiveStatus: result?.effective_status || row.status,
      notes: row.notes || undefined,
      resultSource: row.result_source,
      hasAutomaticSource: Boolean(result?.has_automatic_source),
      manualResult: Number(row.manual_result),
      currentResult: Number(result?.current_result || row.manual_result),
      progressPercent: Number(result?.progress_percent || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }).filter((goal) => {
    if (filters.status && filters.status !== 'all' && goal.effectiveStatus !== filters.status) return false;
    if (!search) return true;
    return [goal.name, goal.employeeName, goal.teamName].filter(Boolean)
      .some((value) => value!.toLocaleLowerCase('pt-BR').includes(search));
  });
};

export const saveSalesGoal = async (input: SalesGoalInput, id?: string) => {
  assertPeopleCompany();
  const { data, error } = await supabase.rpc('save_sales_goal', {
    p_goal_id: id || null,
    p_name: input.name,
    p_goal_type: input.goalType,
    p_assignment_type: input.assignmentType,
    p_employee_id: input.assignmentType === 'employee' ? input.employeeId || null : null,
    p_team_id: input.assignmentType === 'team' ? input.teamId || null : null,
    p_period_type: input.periodType,
    p_target_value: input.targetValue,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_notes: input.notes || null,
  });
  if (error) throw new Error(safeMessage(error, 'Não foi possível salvar a meta.'));
  return String(data);
};

export const updateSalesGoalResult = async (id: string, value: number) => {
  assertPeopleCompany();
  const { error } = await supabase.rpc('update_sales_goal_result', { p_goal_id: id, p_manual_result: value });
  if (error) throw new Error(safeMessage(error, 'Não foi possível atualizar o resultado manual.'));
};

export const setSalesGoalStatus = async (id: string, status: SalesGoalStatus) => {
  assertPeopleCompany();
  const { error } = await supabase.rpc('set_sales_goal_status', { p_goal_id: id, p_status: status });
  if (error) throw new Error(safeMessage(error, 'Não foi possível alterar o status da meta.'));
};

export const getTeamPerformance = async (dateFrom: string, dateTo: string): Promise<TeamPerformance[]> => {
  const [teams, employees, goals, salesResponse] = await Promise.all([
    getTeams(),
    getEmployees(),
    getSalesGoals({ dateFrom, dateTo }),
    supabase.rpc('get_team_sales_totals', { p_date_from: dateFrom, p_date_to: dateTo }),
  ]);
  if (salesResponse.error) throw new Error('Não foi possível carregar as vendas reais por equipe.');
  const sales = new Map(((salesResponse.data || []) as TeamSalesRow[]).map((row) => [row.team_id, row]));
  return teams.map((team) => {
    const memberIds = new Set(employees.filter((employee) => employee.teamId === team.id).map((employee) => employee.id));
    const teamGoals = goals.filter((goal) => goal.teamId === team.id || Boolean(goal.employeeId && memberIds.has(goal.employeeId)));
    const valueGoals = teamGoals.filter((goal) => goal.teamId === team.id && goal.goalType === 'sales_value');
    const goalTarget = valueGoals.reduce((sum, goal) => sum + goal.targetValue, 0);
    const goalResult = valueGoals.reduce((sum, goal) => sum + goal.currentResult, 0);
    const salesRow = sales.get(team.id);
    return {
      team,
      goalTarget,
      goalResult,
      progressPercent: goalTarget > 0 ? Math.min(999.99, (goalResult / goalTarget) * 100) : 0,
      goalsAtRisk: teamGoals.filter((goal) => isGoalAtRisk(goal)).length,
      goalsCompleted: teamGoals.filter((goal) => goal.effectiveStatus === 'completed').length,
      salesTotal: salesRow?.has_sales_source ? Number(salesRow.sales_total) : undefined,
      hasSalesSource: Boolean(salesRow?.has_sales_source),
    };
  });
};

export const getTeamAudit = async (teamId: string): Promise<PeopleAuditEvent[]> => {
  const companyId = assertPeopleCompany();
  const [{ data, error }, profilesResponse] = await Promise.all([
    supabase.from('people_audit_events').select(`
    id, company_id, employee_id, team_id, entity_type, entity_id, event_type,
    changed_fields, actor_id, created_at
  `).eq('company_id', companyId).eq('team_id', teamId).order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, name').eq('company_id', companyId),
  ]);
  if (error) throw new Error('Não foi possível carregar o histórico da equipe.');
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
