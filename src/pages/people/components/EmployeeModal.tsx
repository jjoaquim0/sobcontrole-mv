import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, ShieldCheck, X } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Employee } from '@/types';
import { EmployeeInput } from '@/services/peopleService';
import { useSalesProfiles, useTeams } from '@/hooks/usePeople';
import { EMPLOYMENT_TYPE_LABELS, formatCpfInput, isValidCpf } from '../peopleDomain';

const employeeSchema = z.object({
  fullName: z.string().trim().min(2, 'Informe o nome completo.'),
  email: z.string().trim().email('Informe um e-mail válido.').optional().or(z.literal('')),
  phone: z.string().trim().optional(),
  cpf: z.string().trim().optional().refine((value) => !value || isValidCpf(value), 'Informe um CPF válido.'),
  clearCpf: z.boolean(),
  birthDate: z.string().optional(),
  jobTitle: z.string().trim().min(2, 'Informe o cargo.'),
  department: z.string().trim().optional(),
  teamId: z.string().optional(),
  managerEmployeeId: z.string().optional(),
  salesProfileId: z.string().optional(),
  employmentType: z.enum(['clt', 'pj', 'internship', 'temporary', 'self_employed', 'other']),
  admissionDate: z.string().optional(),
  status: z.enum(['active', 'on_leave', 'terminated']),
  internalNotes: z.string().trim().max(2000, 'Use até 2.000 caracteres.').optional(),
  commissionEnabled: z.boolean(),
  commissionRuleNotes: z.string().trim().max(1000, 'Use até 1.000 caracteres.').optional(),
});

type EmployeeForm = z.infer<typeof employeeSchema>;

const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus-visible:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white';
const labelClass = 'mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300';

export interface EmployeeModalProps {
  isOpen: boolean;
  employee?: Employee;
  employees?: Employee[];
  isLoading?: boolean;
  onClose: () => void;
  onSave: (input: EmployeeInput) => Promise<void>;
}

export const EmployeeModal = ({ isOpen, employee, employees = [], isLoading, onClose, onSave }: EmployeeModalProps) => {
  const { teams } = useTeams({ status: 'active' });
  const salesProfiles = useSalesProfiles();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<EmployeeForm>({
    resolver: zodResolver(employeeSchema),
    defaultValues: { employmentType: 'clt', status: 'active', clearCpf: false, commissionEnabled: false },
  });
  const commissionEnabled = watch('commissionEnabled');
  const clearCpf = watch('clearCpf');

  useEffect(() => {
    if (!isOpen) return;
    reset({
      fullName: employee?.fullName || '', email: employee?.email || '', phone: employee?.phone || '',
      cpf: '', clearCpf: false, birthDate: employee?.birthDate || '', jobTitle: employee?.jobTitle || '',
      department: employee?.department || '', employmentType: employee?.employmentType || 'clt',
      teamId: employee?.teamId || '', managerEmployeeId: employee?.managerEmployeeId || '',
      salesProfileId: employee?.salesProfileId || '',
      admissionDate: employee?.admissionDate || '', status: employee?.status || 'active',
      internalNotes: employee?.internalNotes || '', commissionEnabled: employee?.commissionEnabled || false,
      commissionRuleNotes: employee?.commissionRuleNotes || '',
    });
  }, [employee, isOpen, reset]);

  const submit = async (values: EmployeeForm) => onSave(values as EmployeeInput);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="employee-modal-title">
          <motion.button type="button" aria-label="Fechar formulário" className="fixed inset-0 bg-black/55 backdrop-blur-sm" onClick={isLoading ? undefined : onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div className="relative z-10 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-gray-100 bg-white p-5 shadow-2xl dark:border-white/5 dark:bg-[#1a1d27] sm:p-6" initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.98 }}>
            <div className="mb-6 flex items-start justify-between border-b border-gray-100 pb-4 dark:border-white/5">
              <div><h2 id="employee-modal-title" className="text-lg font-bold text-gray-900 dark:text-white">{employee ? 'Editar funcionário' : 'Adicionar funcionário'}</h2><p className="mt-1 text-xs text-gray-500">Informações administrativas internas da equipe.</p></div>
              <button type="button" onClick={onClose} disabled={isLoading} aria-label="Fechar" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:hover:bg-white/5 dark:hover:text-white"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleSubmit(submit)} className="space-y-6">
              <section><h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-cyan-700 dark:text-cyan-300">Dados pessoais</h3><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2"><span className={labelClass}>Nome completo *</span><input className={inputClass} autoFocus {...register('fullName')} />{errors.fullName && <span className="mt-1 block text-xs text-red-500">{errors.fullName.message}</span>}</label>
                <label><span className={labelClass}>E-mail</span><input type="email" className={inputClass} {...register('email')} />{errors.email && <span className="mt-1 block text-xs text-red-500">{errors.email.message}</span>}</label>
                <label><span className={labelClass}>Telefone</span><input className={inputClass} {...register('phone')} /></label>
                <label><span className={labelClass}>CPF</span><input inputMode="numeric" autoComplete="off" placeholder={employee?.cpfMasked || '000.000.000-00'} disabled={clearCpf} className={inputClass} {...register('cpf')} onChange={(event) => setValue('cpf', formatCpfInput(event.target.value), { shouldValidate: true })} />{errors.cpf && <span className="mt-1 block text-xs text-red-500">{errors.cpf.message}</span>}<span className="mt-1 flex items-center gap-1 text-[11px] text-gray-400"><ShieldCheck className="h-3 w-3" />O CPF completo não é armazenado nem exibido.</span></label>
                <label><span className={labelClass}>Data de nascimento</span><input type="date" className={inputClass} {...register('birthDate')} /></label>
                {employee?.cpfMasked && <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300"><input type="checkbox" className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" {...register('clearCpf')} />Remover o CPF protegido atual ({employee.cpfMasked})</label>}
              </div></section>

              <section><h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-cyan-700 dark:text-cyan-300">Dados profissionais</h3><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label><span className={labelClass}>Cargo *</span><input className={inputClass} {...register('jobTitle')} />{errors.jobTitle && <span className="mt-1 block text-xs text-red-500">{errors.jobTitle.message}</span>}</label>
                <label><span className={labelClass}>Setor / departamento</span><input className={inputClass} {...register('department')} /></label>
                <label><span className={labelClass}>Equipe / setor</span><select className={inputClass} {...register('teamId')}><option value="">Sem equipe</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
                <label><span className={labelClass}>Gestor responsável</span><select className={inputClass} {...register('managerEmployeeId')}><option value="">Não informado</option>{employees.filter((candidate) => candidate.id !== employee?.id && candidate.status === 'active').map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.fullName}</option>)}</select></label>
                <label className="sm:col-span-2"><span className={labelClass}>Usuário vendedor vinculado</span><select className={inputClass} {...register('salesProfileId')}><option value="">Sem vínculo automático</option>{(salesProfiles.data || []).map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {profile.email}</option>)}</select><span className="mt-1 block text-[11px] text-gray-400">Vínculo opcional usado somente para consultar vendas reais no progresso das metas.</span></label>
                <label><span className={labelClass}>Tipo de vínculo *</span><select className={inputClass} {...register('employmentType')}>{Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label><span className={labelClass}>Data de admissão</span><input type="date" className={inputClass} {...register('admissionDate')} /></label>
                <label><span className={labelClass}>Status *</span><select className={inputClass} {...register('status')}><option value="active">Ativo</option><option value="on_leave">Afastado</option><option value="terminated">Desligado</option></select></label>
                <label className="sm:col-span-2"><span className={labelClass}>Observações internas</span><textarea rows={3} className={inputClass} {...register('internalNotes')} />{errors.internalNotes && <span className="mt-1 block text-xs text-red-500">{errors.internalNotes.message}</span>}</label>
              </div></section>

              <section><h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-cyan-700 dark:text-cyan-300">Configuração administrativa</h3><label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200"><input type="checkbox" className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" {...register('commissionEnabled')} />Participa de comissão</label>{commissionEnabled && <label className="mt-4 block"><span className={labelClass}>Observação sobre a regra de comissão</span><textarea rows={3} className={inputClass} placeholder="Texto livre. Nenhum cálculo será realizado." {...register('commissionRuleNotes')} />{errors.commissionRuleNotes && <span className="mt-1 block text-xs text-red-500">{errors.commissionRuleNotes.message}</span>}</label>}</section>

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-white/5"><button type="button" onClick={onClose} disabled={isLoading} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5">Cancelar</button><button type="submit" disabled={isLoading} className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:opacity-60">{isLoading && <Loader2 className="h-4 w-4 animate-spin" />}{employee ? 'Salvar alterações' : 'Adicionar funcionário'}</button></div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
