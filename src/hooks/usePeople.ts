import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CommissionFilters,
  CommissionInput,
  EmployeeFilters,
  EmployeeInput,
  getCommissions,
  getEmployeeById,
  getEmployees,
  getPeopleAudit,
  saveCommission,
  saveEmployee,
  setCommissionStatus,
  setEmployeeStatus,
} from '@/services/peopleService';
import { CommissionStatus, EmployeeStatus } from '@/types';
import {
  getSalesGoals,
  getSalesProfiles,
  getTeamAudit,
  getTeamPerformance,
  getTeams,
  SalesGoalFilters,
  SalesGoalInput,
  saveSalesGoal,
  saveTeam,
  setSalesGoalStatus,
  setTeamStatus,
  TeamFilters,
  TeamInput,
  updateSalesGoalResult,
} from '@/services/peopleGoalsService';
import { SalesGoalStatus, TeamStatus } from '@/types';

export const useEmployees = (filters: EmployeeFilters = {}) => {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['people', 'employees', filters], queryFn: () => getEmployees(filters) });
  const save = useMutation({
    mutationFn: ({ input, id }: { input: EmployeeInput; id?: string }) => saveEmployee(input, id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      toast.success(variables.id ? 'Funcionário atualizado com sucesso.' : 'Funcionário cadastrado com sucesso.');
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const status = useMutation({
    mutationFn: ({ id, value }: { id: string; value: EmployeeStatus }) => setEmployeeStatus(id, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      toast.success('Status do funcionário atualizado.');
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return {
    employees: list.data || [],
    isLoading: list.isLoading,
    isError: list.isError,
    refetch: list.refetch,
    saveEmployee: save.mutateAsync,
    isSaving: save.isPending,
    updateStatus: status.mutateAsync,
    isUpdatingStatus: status.isPending,
  };
};

export const useEmployeeDetails = (id: string) => {
  const employee = useQuery({
    queryKey: ['people', 'employee', id],
    queryFn: () => getEmployeeById(id),
    enabled: Boolean(id),
  });
  const commissions = useQuery({
    queryKey: ['people', 'commissions', 'employee', id],
    queryFn: () => getCommissions({ employeeId: id }),
    enabled: Boolean(id),
  });
  const audit = useQuery({
    queryKey: ['people', 'audit', id],
    queryFn: () => getPeopleAudit(id),
    enabled: Boolean(id),
  });
  return { employee, commissions, audit };
};

export const useCommissions = (filters: CommissionFilters = {}) => {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['people', 'commissions', filters], queryFn: () => getCommissions(filters) });
  const save = useMutation({
    mutationFn: ({ input, id }: { input: CommissionInput; id?: string }) => saveCommission(input, id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      toast.success(variables.id ? 'Comissão atualizada com sucesso.' : 'Comissão registrada com sucesso.');
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const status = useMutation({
    mutationFn: ({ id, value }: { id: string; value: CommissionStatus }) => setCommissionStatus(id, value),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      toast.success(variables.value === 'canceled' ? 'Comissão cancelada.' : 'Status da comissão atualizado.');
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return {
    commissions: list.data || [],
    isLoading: list.isLoading,
    isError: list.isError,
    refetch: list.refetch,
    saveCommission: save.mutateAsync,
    isSaving: save.isPending,
    updateStatus: status.mutateAsync,
    isUpdatingStatus: status.isPending,
  };
};

export const useTeams = (filters: TeamFilters = {}) => {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['people', 'teams', filters], queryFn: () => getTeams(filters) });
  const save = useMutation({
    mutationFn: ({ input, id }: { input: TeamInput; id?: string }) => saveTeam(input, id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      toast.success(variables.id ? 'Equipe atualizada com sucesso.' : 'Equipe criada com sucesso.');
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const status = useMutation({
    mutationFn: ({ id, value }: { id: string; value: TeamStatus }) => setTeamStatus(id, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      toast.success('Status da equipe atualizado.');
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return {
    teams: list.data || [], isLoading: list.isLoading, isError: list.isError, refetch: list.refetch,
    saveTeam: save.mutateAsync, isSaving: save.isPending,
    updateStatus: status.mutateAsync, isUpdatingStatus: status.isPending,
  };
};

export const useSalesProfiles = () => useQuery({
  queryKey: ['people', 'sales-profiles'],
  queryFn: getSalesProfiles,
});

export const useSalesGoals = (filters: SalesGoalFilters = {}) => {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['people', 'goals', filters], queryFn: () => getSalesGoals(filters) });
  const save = useMutation({
    mutationFn: ({ input, id }: { input: SalesGoalInput; id?: string }) => saveSalesGoal(input, id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      toast.success(variables.id ? 'Meta atualizada com sucesso.' : 'Meta criada com sucesso.');
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const result = useMutation({
    mutationFn: ({ id, value }: { id: string; value: number }) => updateSalesGoalResult(id, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      toast.success('Resultado manual atualizado.');
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const status = useMutation({
    mutationFn: ({ id, value }: { id: string; value: SalesGoalStatus }) => setSalesGoalStatus(id, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      toast.success('Status da meta atualizado.');
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return {
    goals: list.data || [], isLoading: list.isLoading, isError: list.isError, refetch: list.refetch,
    saveGoal: save.mutateAsync, isSaving: save.isPending,
    updateResult: result.mutateAsync, isUpdatingResult: result.isPending,
    updateStatus: status.mutateAsync, isUpdatingStatus: status.isPending,
  };
};

export const useTeamDetails = (teamId: string, dateFrom: string, dateTo: string) => {
  const performance = useQuery({
    queryKey: ['people', 'team-performance', dateFrom, dateTo],
    queryFn: () => getTeamPerformance(dateFrom, dateTo),
  });
  const employees = useQuery({
    queryKey: ['people', 'employees', 'team', teamId],
    queryFn: () => getEmployees({ teamId }),
    enabled: Boolean(teamId),
  });
  const goals = useQuery({
    queryKey: ['people', 'goals', 'team', teamId, dateFrom, dateTo],
    queryFn: async () => {
      const [collective, individual] = await Promise.all([
        getSalesGoals({ teamId, dateFrom, dateTo }),
        getSalesGoals({ dateFrom, dateTo }),
      ]);
      const memberIds = new Set((employees.data || []).map((employee) => employee.id));
      return [...collective, ...individual.filter((goal) => goal.employeeId && memberIds.has(goal.employeeId))]
        .filter((goal, index, values) => values.findIndex((candidate) => candidate.id === goal.id) === index);
    },
    enabled: Boolean(teamId) && employees.isSuccess,
  });
  const audit = useQuery({
    queryKey: ['people', 'audit', 'team', teamId],
    queryFn: () => getTeamAudit(teamId),
    enabled: Boolean(teamId),
  });
  return { performance, employees, goals, audit };
};

export const useTeamPerformance = (dateFrom: string, dateTo: string) => useQuery({
  queryKey: ['people', 'team-performance', dateFrom, dateTo],
  queryFn: () => getTeamPerformance(dateFrom, dateTo),
});
