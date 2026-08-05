import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Employee, Team } from '@/types';
import { TeamInput } from '@/services/peopleGoalsService';

const schema = z.object({
  name: z.string().trim().min(2, 'Informe o nome da equipe.'),
  description: z.string().trim().max(500, 'Use até 500 caracteres.').optional(),
  managerEmployeeId: z.string().optional(),
  status: z.enum(['active', 'inactive']),
});

const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus-visible:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white';
const labelClass = 'mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300';

export const TeamModal = ({ isOpen, team, employees, isLoading, onClose, onSave }: {
  isOpen: boolean;
  team?: Team;
  employees: Employee[];
  isLoading?: boolean;
  onClose: () => void;
  onSave: (input: TeamInput) => Promise<void>;
}) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema), defaultValues: { status: 'active' },
  });
  useEffect(() => {
    if (isOpen) reset({ name: team?.name || '', description: team?.description || '', managerEmployeeId: team?.managerEmployeeId || '', status: team?.status || 'active' });
  }, [isOpen, reset, team]);
  return <AnimatePresence>{isOpen && <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="team-modal-title">
    <motion.button type="button" aria-label="Fechar formulário" className="fixed inset-0 bg-black/55 backdrop-blur-sm" onClick={isLoading ? undefined : onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
    <motion.div className="relative z-10 w-full max-w-xl rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl dark:border-white/5 dark:bg-[#1a1d27]" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}>
      <div className="mb-5 flex items-start justify-between border-b border-gray-100 pb-4 dark:border-white/5"><div><h2 id="team-modal-title" className="text-lg font-bold text-gray-900 dark:text-white">{team ? 'Editar equipe' : 'Criar equipe'}</h2><p className="mt-1 text-xs text-gray-500">Organização interna de pessoas e metas.</p></div><button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:hover:bg-white/5"><X className="h-5 w-5" /></button></div>
      <form onSubmit={handleSubmit((values) => onSave(values as TeamInput))} className="space-y-4">
        <label><span className={labelClass}>Nome da equipe *</span><input autoFocus className={inputClass} placeholder="Ex.: Comercial" {...register('name')} />{errors.name && <span className="mt-1 block text-xs text-red-500">{errors.name.message}</span>}</label>
        <label><span className={labelClass}>Descrição</span><textarea rows={3} className={inputClass} {...register('description')} />{errors.description && <span className="mt-1 block text-xs text-red-500">{errors.description.message}</span>}</label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label><span className={labelClass}>Gestor / responsável</span><select className={inputClass} {...register('managerEmployeeId')}><option value="">Não informado</option>{employees.filter((employee) => employee.status === 'active').map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}</select></label><label><span className={labelClass}>Status *</span><select className={inputClass} {...register('status')}><option value="active">Ativa</option><option value="inactive">Inativa</option></select></label></div>
        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-white/5"><button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold dark:border-white/10">Cancelar</button><button type="submit" disabled={isLoading} className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-60">{isLoading && <Loader2 className="h-4 w-4 animate-spin" />}{team ? 'Salvar alterações' : 'Criar equipe'}</button></div>
      </form>
    </motion.div>
  </div>}</AnimatePresence>;
};
