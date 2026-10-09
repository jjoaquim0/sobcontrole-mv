import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { DemandInput, DemandLinkOptions } from '@/services/demandsService';
import { DemandType } from '@/types';
import { demandSchema } from '../demandSchemas';
import { PRIORITY_LABELS, todayIso } from '../demandsDomain';
import { inputClass, labelClass } from '@/pages/contracts/components/ContractPrimitives';
import { FieldError, FormModal, SectionTitle } from './DemandPrimitives';

type DemandForm = z.infer<typeof demandSchema>;

export interface DemandModalDefaults {
  typeId?: string;
  title?: string;
  contractId?: string;
  postId?: string;
}

export interface DemandModalProps {
  isOpen: boolean;
  types: DemandType[];
  options?: DemandLinkOptions;
  defaults?: DemandModalDefaults;
  isLoading?: boolean;
  onClose: () => void;
  onSave: (input: DemandInput) => Promise<void>;
}

const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const DemandModal = ({ isOpen, types, options, defaults, isLoading, onClose, onSave }: DemandModalProps) => {
  const activeTypes = types.filter((type) => type.isActive);
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<DemandForm>({
    resolver: zodResolver(demandSchema),
    defaultValues: { priority: 'normal' },
  });

  useEffect(() => {
    if (!isOpen) return;
    const typeId = defaults?.typeId || activeTypes[0]?.id || '';
    const type = activeTypes.find((item) => item.id === typeId);
    const post = options?.posts.find((item) => item.id === defaults?.postId);
    reset({
      typeId,
      title: defaults?.title || '',
      description: '',
      priority: 'normal',
      dueDate: type?.defaultDueDays !== undefined ? addDays(todayIso(), type.defaultDueDays) : '',
      contractId: defaults?.contractId || post?.contractId || '',
      postId: defaults?.postId || '',
      allocationId: '',
      employeeId: '',
      responsibleId: '',
      approverId: '',
    });
    // Só reinicia ao abrir; mudanças de tipos/opções em segundo plano não apagam o que foi digitado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, reset]);

  const typeId = watch('typeId');
  const contractId = watch('contractId');
  const postId = watch('postId');
  const allocationId = watch('allocationId');
  const today = todayIso();

  const posts = (options?.posts || []).filter((post) => !contractId || post.contractId === contractId);
  const allocations = (options?.allocations || []).filter((allocation) => allocation.postId === postId && (!allocation.endDate || allocation.endDate >= today));
  const people = options?.people || [];
  const approvers = people.filter((person) => person.role === 'admin' || person.role === 'manager');

  return (
    <FormModal
      isOpen={isOpen}
      title="Abrir demanda"
      subtitle="A demanda começa na etapa de abertura e segue o fluxo do tipo escolhido."
      isLoading={isLoading}
      submitLabel="Abrir demanda"
      onClose={onClose}
      onSubmit={handleSubmit((values) => onSave(values as DemandInput))}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label>
          <span className={labelClass}>Tipo *</span>
          <select
            className={inputClass}
            {...register('typeId', {
              onChange: (event) => {
                const type = activeTypes.find((item) => item.id === event.target.value);
                if (type?.defaultDueDays !== undefined) setValue('dueDate', addDays(today, type.defaultDueDays));
              },
            })}
          >
            {activeTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
          </select>
          <FieldError message={errors.typeId?.message} />
          {activeTypes.find((type) => type.id === typeId)?.description && <span className="mt-1 block text-[11px] text-gray-400">{activeTypes.find((type) => type.id === typeId)?.description}</span>}
        </label>
        <label><span className={labelClass}>Prioridade *</span><select className={inputClass} {...register('priority')}>{Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="sm:col-span-2"><span className={labelClass}>Título *</span><input className={inputClass} placeholder="Ex.: Repor porteiro noturno — férias de 30 dias" {...register('title')} /><FieldError message={errors.title?.message} /></label>
        <label className="sm:col-span-2"><span className={labelClass}>Descrição</span><textarea rows={3} className={inputClass} placeholder="Função, escala, data necessária, justificativa" {...register('description')} /><FieldError message={errors.description?.message} /></label>
        <label><span className={labelClass}>Prazo</span><input type="date" className={inputClass} {...register('dueDate')} /></label>
      </div>

      <div>
        <SectionTitle>Vínculos</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label>
            <span className={labelClass}>Contrato</span>
            <select className={inputClass} {...register('contractId', { onChange: () => { setValue('postId', ''); setValue('allocationId', ''); } })}>
              <option value="">Sem contrato</option>
              {(options?.contracts || []).map((contract) => <option key={contract.id} value={contract.id}>{contract.title} · {contract.clientName}</option>)}
            </select>
          </label>
          <label>
            <span className={labelClass}>Posto</span>
            <select className={inputClass} {...register('postId', { onChange: () => setValue('allocationId', '') })}>
              <option value="">Sem posto</option>
              {posts.map((post) => <option key={post.id} value={post.id}>{post.name} · {post.jobFunction}</option>)}
            </select>
          </label>
          <label>
            <span className={labelClass}>Alocação afetada</span>
            <select className={inputClass} disabled={!postId} {...register('allocationId')}>
              <option value="">Nenhuma</option>
              {allocations.map((allocation) => <option key={allocation.id} value={allocation.id}>{allocation.employeeName}</option>)}
            </select>
          </label>
          <label>
            <span className={labelClass}>Funcionário</span>
            <select className={inputClass} disabled={Boolean(allocationId)} {...register('employeeId')}>
              <option value="">{allocationId ? 'O da alocação' : 'Nenhum'}</option>
              {(options?.employees || []).map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div>
        <SectionTitle>Responsabilidades</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label>
            <span className={labelClass}>Responsável</span>
            <select className={inputClass} {...register('responsibleId')}><option value="">Definir depois</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select>
            <span className="mt-1 block text-[11px] text-gray-400">Obrigatório para iniciar a execução.</span>
          </label>
          <label>
            <span className={labelClass}>Aprovador</span>
            <select className={inputClass} {...register('approverId')}><option value="">Definir depois</option>{approvers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select>
            <FieldError message={errors.approverId?.message} />
            <span className="mt-1 block text-[11px] text-gray-400">Gestor que confere e encerra. Obrigatório para a conferência.</span>
          </label>
        </div>
      </div>
    </FormModal>
  );
};
