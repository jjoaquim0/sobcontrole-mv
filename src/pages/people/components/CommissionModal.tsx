import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Commission, Employee } from '@/types';
import { CommissionInput } from '@/services/peopleService';

const schema = z.object({
  employeeId: z.string().uuid('Selecione um funcionário.'),
  teamId: z.string().optional(),
  description: z.string().trim().min(3, 'Informe a descrição ou origem.'),
  referencePeriod: z.string().optional(),
  grossAmount: z.coerce.number().positive('Informe um valor maior que zero.'),
  internalNotes: z.string().trim().max(2000, 'Use até 2.000 caracteres.').optional(),
});
type FormValues = z.infer<typeof schema>;
const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus-visible:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white';
const labelClass = 'mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300';

export const CommissionModal = ({ isOpen, commission, employees, isLoading, onClose, onSave }: { isOpen: boolean; commission?: Commission; employees: Employee[]; isLoading?: boolean; onClose: () => void; onSave: (input: CommissionInput) => Promise<void> }) => {
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const selectedEmployeeId = watch('employeeId');
  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId);
  useEffect(() => { if (isOpen) reset({ employeeId: commission?.employeeId || '', teamId: commission?.teamId || '', description: commission?.description || '', referencePeriod: commission?.referencePeriod?.slice(0, 7) || '', grossAmount: commission?.grossAmount || undefined, internalNotes: commission?.internalNotes || '' }); }, [commission, isOpen, reset]);
  useEffect(() => { setValue('teamId', selectedEmployee?.teamId || ''); }, [selectedEmployee?.teamId, setValue]);
  return <AnimatePresence>{isOpen && <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="commission-modal-title"><motion.button type="button" aria-label="Fechar formulário" className="fixed inset-0 bg-black/55 backdrop-blur-sm" onClick={isLoading ? undefined : onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /><motion.div className="relative z-10 w-full max-w-xl rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl dark:border-white/5 dark:bg-[#1a1d27]" initial={{ opacity: 0, y: 16, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: .98 }}><div className="mb-5 flex items-start justify-between border-b border-gray-100 pb-4 dark:border-white/5"><div><h2 id="commission-modal-title" className="text-lg font-bold text-gray-900 dark:text-white">{commission ? 'Editar comissão' : 'Registrar comissão'}</h2><p className="mt-1 text-xs text-gray-500">O valor será armazenado exatamente como informado.</p></div><button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:hover:bg-white/5"><X className="h-5 w-5" /></button></div><form onSubmit={handleSubmit((values) => onSave(values as CommissionInput))} className="space-y-4">
    <label><span className={labelClass}>Funcionário *</span><select className={inputClass} {...register('employeeId')}><option value="">Selecione</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}</select>{errors.employeeId && <span className="mt-1 block text-xs text-red-500">{errors.employeeId.message}</span>}</label>
    <label><span className={labelClass}>Equipe</span><input type="hidden" {...register('teamId')} /><div className={`${inputClass} bg-gray-50 text-gray-600 dark:bg-white/[0.03]`}>{selectedEmployee?.teamName || 'Funcionário sem equipe vinculada'}</div></label>
    <label><span className={labelClass}>Descrição / origem *</span><input className={inputClass} placeholder="Ex.: Bonificação comercial" {...register('description')} />{errors.description && <span className="mt-1 block text-xs text-red-500">{errors.description.message}</span>}</label>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label><span className={labelClass}>Período de referência</span><input type="month" className={inputClass} {...register('referencePeriod')} /></label><label><span className={labelClass}>Valor bruto informado *</span><input type="number" min="0.01" step="0.01" inputMode="decimal" className={inputClass} {...register('grossAmount')} />{errors.grossAmount && <span className="mt-1 block text-xs text-red-500">{errors.grossAmount.message}</span>}</label></div>
    <label><span className={labelClass}>Observações internas</span><textarea rows={4} className={inputClass} {...register('internalNotes')} /></label>
    <div className="rounded-xl bg-gray-50 p-3 text-xs leading-relaxed text-gray-500 dark:bg-white/5 dark:text-gray-400">O SobControle não calcula comissão, impostos, descontos ou valor líquido e não cria pagamentos ou lançamentos financeiros.</div>
    <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-white/5"><button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5">Cancelar</button><button type="submit" disabled={isLoading} className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:opacity-60">{isLoading && <Loader2 className="h-4 w-4 animate-spin" />}{commission ? 'Salvar alterações' : 'Registrar comissão'}</button></div>
  </form></motion.div></div>}</AnimatePresence>;
};
