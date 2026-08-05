import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Employee, SalesGoal, SalesGoalPeriod, Team } from '@/types';
import { SalesGoalInput } from '@/services/peopleGoalsService';
import { getDefaultPeriodDates, SALES_GOAL_PERIOD_LABELS, SALES_GOAL_TYPE_LABELS, toDateInput } from '../peopleDomain';

const schema = z.object({
  name: z.string().trim().min(3, 'Informe o nome da meta.'),
  goalType: z.enum(['sales_value', 'sales_count', 'new_customers', 'custom']),
  assignmentType: z.enum(['employee', 'team']),
  employeeId: z.string().optional(),
  teamId: z.string().optional(),
  periodType: z.enum(['monthly', 'quarterly', 'annual', 'custom']),
  targetValue: z.coerce.number().positive('Informe uma meta-alvo maior que zero.'),
  startDate: z.string().min(1, 'Informe a data inicial.'),
  endDate: z.string().min(1, 'Informe a data final.'),
  notes: z.string().trim().max(2000, 'Use até 2.000 caracteres.').optional(),
}).superRefine((value, context) => {
  if (value.assignmentType === 'employee' && !value.employeeId) context.addIssue({ code: 'custom', path: ['employeeId'], message: 'Selecione um funcionário.' });
  if (value.assignmentType === 'team' && !value.teamId) context.addIssue({ code: 'custom', path: ['teamId'], message: 'Selecione uma equipe.' });
  if (value.endDate < value.startDate) context.addIssue({ code: 'custom', path: ['endDate'], message: 'A data final deve ser posterior à inicial.' });
});

type FormValues = z.infer<typeof schema>;
const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus-visible:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white';
const labelClass = 'mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300';

export const GoalModal = ({ isOpen, goal, employees, teams, isLoading, onClose, onSave }: {
  isOpen: boolean; goal?: SalesGoal; employees: Employee[]; teams: Team[]; isLoading?: boolean;
  onClose: () => void; onSave: (input: SalesGoalInput) => Promise<void>;
}) => {
  const defaults = getDefaultPeriodDates('monthly');
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { goalType: 'sales_value', assignmentType: 'employee', periodType: 'monthly', startDate: toDateInput(defaults.startDate), endDate: toDateInput(defaults.endDate) } });
  const assignment = watch('assignmentType'); const period = watch('periodType');
  useEffect(() => {
    if (isOpen) reset({ name: goal?.name || '', goalType: goal?.goalType || 'sales_value', assignmentType: goal?.assignmentType || 'employee', employeeId: goal?.employeeId || '', teamId: goal?.teamId || '', periodType: goal?.periodType || 'monthly', targetValue: goal?.targetValue || undefined, startDate: goal?.startDate || toDateInput(defaults.startDate), endDate: goal?.endDate || toDateInput(defaults.endDate), notes: goal?.notes || '' });
  // defaults are intentionally captured when the modal renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, isOpen, reset]);
  useEffect(() => {
    if (!isOpen || goal || period === 'custom') return;
    const dates = getDefaultPeriodDates(period as SalesGoalPeriod);
    setValue('startDate', toDateInput(dates.startDate)); setValue('endDate', toDateInput(dates.endDate));
  }, [goal, isOpen, period, setValue]);
  return <AnimatePresence>{isOpen && <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="goal-modal-title"><motion.button type="button" aria-label="Fechar formulário" className="fixed inset-0 bg-black/55 backdrop-blur-sm" onClick={isLoading ? undefined : onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /><motion.div className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl dark:border-white/5 dark:bg-[#1a1d27]" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}><div className="mb-5 flex items-start justify-between border-b border-gray-100 pb-4 dark:border-white/5"><div><h2 id="goal-modal-title" className="text-lg font-bold text-gray-900 dark:text-white">{goal ? 'Editar meta' : 'Criar meta de vendas'}</h2><p className="mt-1 text-xs text-gray-500">Metas acompanham resultados; não geram comissão ou pagamento.</p></div><button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"><X className="h-5 w-5" /></button></div><form onSubmit={handleSubmit((values) => onSave(values as SalesGoalInput))} className="space-y-4">
    <label><span className={labelClass}>Nome da meta *</span><input autoFocus className={inputClass} {...register('name')} />{errors.name && <span className="mt-1 block text-xs text-red-500">{errors.name.message}</span>}</label>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label><span className={labelClass}>Tipo de meta *</span><select className={inputClass} {...register('goalType')}>{Object.entries(SALES_GOAL_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className={labelClass}>Aplicação *</span><select className={inputClass} {...register('assignmentType')}><option value="employee">Funcionário</option><option value="team">Equipe</option></select></label></div>
    {assignment === 'employee' ? <label><span className={labelClass}>Funcionário *</span><select className={inputClass} {...register('employeeId')}><option value="">Selecione</option>{employees.filter((employee) => employee.status === 'active').map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}</select>{errors.employeeId && <span className="mt-1 block text-xs text-red-500">{errors.employeeId.message}</span>}</label> : <label><span className={labelClass}>Equipe *</span><select className={inputClass} {...register('teamId')}><option value="">Selecione</option>{teams.filter((team) => team.status === 'active').map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select>{errors.teamId && <span className="mt-1 block text-xs text-red-500">{errors.teamId.message}</span>}</label>}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label><span className={labelClass}>Período *</span><select className={inputClass} {...register('periodType')}>{Object.entries(SALES_GOAL_PERIOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className={labelClass}>Meta-alvo *</span><input type="number" min="0.01" step="0.01" className={inputClass} {...register('targetValue')} />{errors.targetValue && <span className="mt-1 block text-xs text-red-500">{errors.targetValue.message}</span>}</label><label><span className={labelClass}>Data inicial *</span><input type="date" className={inputClass} {...register('startDate')} /></label><label><span className={labelClass}>Data final *</span><input type="date" className={inputClass} {...register('endDate')} />{errors.endDate && <span className="mt-1 block text-xs text-red-500">{errors.endDate.message}</span>}</label></div>
    <label><span className={labelClass}>Observações</span><textarea rows={3} className={inputClass} {...register('notes')} /></label><div className="rounded-xl bg-cyan-50 p-3 text-xs leading-relaxed text-cyan-900 dark:bg-cyan-400/10 dark:text-cyan-100">Quando houver um usuário vendedor explicitamente vinculado, o progresso usa vendas pagas reais. Sem fonte compatível, o resultado será atualizado manualmente.</div>
    <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-white/5"><button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold dark:border-white/10">Cancelar</button><button type="submit" disabled={isLoading} className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-60">{isLoading && <Loader2 className="h-4 w-4 animate-spin" />}{goal ? 'Salvar alterações' : 'Criar meta'}</button></div>
  </form></motion.div></div>}</AnimatePresence>;
};
