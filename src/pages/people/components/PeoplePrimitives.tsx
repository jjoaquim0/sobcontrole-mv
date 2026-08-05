import { CommissionStatus, EmployeeStatus, SalesGoalStatus, TeamStatus } from '@/types';
import {
  COMMISSION_STATUS_LABELS,
  EMPLOYEE_STATUS_LABELS,
  getInitials,
  SALES_GOAL_STATUS_LABELS,
  TEAM_STATUS_LABELS,
} from '../peopleDomain';

export const EmployeeAvatar = ({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) => (
  <div
    aria-hidden="true"
    className={`flex shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-cyan-50 font-bold text-cyan-800 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-200 ${size === 'lg' ? 'h-14 w-14 text-lg' : 'h-9 w-9 text-xs'}`}
  >
    {getInitials(name)}
  </div>
);

const employeeClasses: Record<EmployeeStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  on_leave: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  terminated: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
};

const commissionClasses: Record<CommissionStatus, string> = {
  pending: 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300',
  approved: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  canceled: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
};

export const EmployeeStatusBadge = ({ status }: { status: EmployeeStatus }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${employeeClasses[status]}`}>
    {EMPLOYEE_STATUS_LABELS[status]}
  </span>
);

export const CommissionStatusBadge = ({ status }: { status: CommissionStatus }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${commissionClasses[status]}`}>
    {COMMISSION_STATUS_LABELS[status]}
  </span>
);

const goalClasses: Record<SalesGoalStatus, string> = {
  active: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  expired: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  canceled: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
};

export const GoalStatusBadge = ({ status }: { status: SalesGoalStatus }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${goalClasses[status]}`}>
    {SALES_GOAL_STATUS_LABELS[status]}
  </span>
);

export const TeamStatusBadge = ({ status }: { status: TeamStatus }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${status === 'active' ? employeeClasses.active : employeeClasses.terminated}`}>
    {TEAM_STATUS_LABELS[status]}
  </span>
);

export const GoalProgress = ({ value }: { value: number }) => {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className="min-w-32" aria-label={`${value.toFixed(0)}% de progresso`}>
      <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-gray-500">
        <span>Progresso</span><span>{value.toFixed(0)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-[#0B2551] to-[#00a8d8] transition-all" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
};

export const FieldValue = ({ label, children }: { label: string; children?: React.ReactNode }) => (
  <div className="space-y-1">
    <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</dt>
    <dd className="text-sm font-medium text-gray-800 dark:text-gray-200">{children || 'Não informado'}</dd>
  </div>
);
