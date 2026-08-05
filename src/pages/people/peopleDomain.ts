import {
  CommissionStatus,
  EmployeeStatus,
  EmploymentType,
  SalesGoal,
  SalesGoalPeriod,
  SalesGoalStatus,
  SalesGoalType,
  TeamStatus,
} from '@/types';

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: 'Ativo',
  on_leave: 'Afastado',
  terminated: 'Desligado',
};

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  clt: 'CLT',
  pj: 'PJ',
  internship: 'Estágio',
  temporary: 'Temporário',
  self_employed: 'Autônomo',
  other: 'Outro',
};

export const COMMISSION_STATUS_LABELS: Record<CommissionStatus, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  paid: 'Paga',
  canceled: 'Cancelada',
};

export const TEAM_STATUS_LABELS: Record<TeamStatus, string> = { active: 'Ativa', inactive: 'Inativa' };

export const SALES_GOAL_TYPE_LABELS: Record<SalesGoalType, string> = {
  sales_value: 'Valor de vendas',
  sales_count: 'Quantidade de vendas',
  new_customers: 'Novos clientes',
  custom: 'Meta personalizada',
};

export const SALES_GOAL_PERIOD_LABELS: Record<SalesGoalPeriod, string> = {
  monthly: 'Mensal', quarterly: 'Trimestral', annual: 'Anual', custom: 'Personalizado',
};

export const SALES_GOAL_STATUS_LABELS: Record<SalesGoalStatus, string> = {
  active: 'Ativa', completed: 'Concluída', expired: 'Vencida', canceled: 'Cancelada',
};

export const AUDIT_EVENT_LABELS: Record<string, string> = {
  employee_created: 'Funcionário criado',
  employee_updated: 'Dados do funcionário alterados',
  employee_status_changed: 'Status do funcionário alterado',
  employee_removed: 'Funcionário removido',
  commission_created: 'Comissão registrada',
  commission_updated: 'Comissão alterada',
  commission_status_changed: 'Status da comissão alterado',
  commission_paid: 'Comissão marcada como paga',
  commission_canceled: 'Comissão cancelada',
  commission_removed: 'Comissão removida',
  team_created: 'Equipe criada',
  team_updated: 'Equipe atualizada',
  team_status_changed: 'Status da equipe alterado',
  goal_created: 'Meta criada',
  goal_updated: 'Meta atualizada',
  goal_result_updated: 'Resultado manual atualizado',
  goal_status_changed: 'Status da meta alterado',
};

export const normalizeCpf = (value: string) => value.replace(/\D/g, '').slice(0, 11);

export const isValidCpf = (value: string) => {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const calculateDigit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(cpf[index]) * (length + 1 - index);
    }
    const result = 11 - (sum % 11);
    return result >= 10 ? 0 : result;
  };

  return calculateDigit(9) === Number(cpf[9]) && calculateDigit(10) === Number(cpf[10]);
};

export const formatCpfInput = (value: string) => {
  const digits = normalizeCpf(value);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

export const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const formatDate = (value?: string) =>
  value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : 'Não informado';

export const formatReferencePeriod = (value?: string) => {
  if (!value) return 'Não informado';
  const [year, month] = value.slice(0, 7).split('-');
  return `${month}/${year}`;
};

export const formatGoalValue = (goal: Pick<SalesGoal, 'goalType' | 'targetValue'>, value = goal.targetValue) =>
  goal.goalType === 'sales_value' ? formatCurrency(value) : new Intl.NumberFormat('pt-BR').format(value);

export const getDefaultPeriodDates = (period: SalesGoalPeriod, base = new Date()) => {
  const year = base.getFullYear();
  const month = base.getMonth();
  if (period === 'monthly') {
    return { startDate: new Date(year, month, 1), endDate: new Date(year, month + 1, 0) };
  }
  if (period === 'quarterly') {
    const quarterStart = Math.floor(month / 3) * 3;
    return { startDate: new Date(year, quarterStart, 1), endDate: new Date(year, quarterStart + 3, 0) };
  }
  return { startDate: new Date(year, 0, 1), endDate: new Date(year, 11, 31) };
};

export const toDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
