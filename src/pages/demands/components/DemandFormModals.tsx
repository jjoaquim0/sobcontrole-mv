import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { DemandPerson, DemandUpdateInput } from '@/services/demandsService';
import { ServiceDemand } from '@/types';
import { assignSchema, demandUpdateSchema, reasonSchema } from '../demandSchemas';
import { PRIORITY_LABELS } from '../demandsDomain';
import { inputClass, labelClass } from '@/pages/contracts/components/ContractPrimitives';
import { FieldError, FormModal } from './DemandPrimitives';

type UpdateForm = z.infer<typeof demandUpdateSchema>;

export const DemandEditModal = ({ isOpen, demand, isLoading, onClose, onSave }: {
  isOpen: boolean;
  demand: ServiceDemand;
  isLoading?: boolean;
  onClose: () => void;
  onSave: (input: DemandUpdateInput) => Promise<void>;
}) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<UpdateForm>({ resolver: zodResolver(demandUpdateSchema) });
  useEffect(() => {
    if (isOpen) reset({ title: demand.title, description: demand.description || '', priority: demand.priority, dueDate: demand.dueDate || '' });
  }, [isOpen, demand, reset]);
  return (
    <FormModal isOpen={isOpen} size="md" title="Editar demanda" isLoading={isLoading} submitLabel="Salvar alterações" onClose={onClose} onSubmit={handleSubmit((values) => onSave(values as DemandUpdateInput))}>
      <div className="grid grid-cols-1 gap-4">
        <label><span className={labelClass}>Título *</span><input className={inputClass} {...register('title')} /><FieldError message={errors.title?.message} /></label>
        <label><span className={labelClass}>Descrição</span><textarea rows={3} className={inputClass} {...register('description')} /><FieldError message={errors.description?.message} /></label>
        <div className="grid grid-cols-2 gap-4">
          <label><span className={labelClass}>Prioridade *</span><select className={inputClass} {...register('priority')}>{Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span className={labelClass}>Prazo</span><input type="date" className={inputClass} {...register('dueDate')} /></label>
        </div>
      </div>
    </FormModal>
  );
};

type AssignForm = z.infer<typeof assignSchema>;

export const AssignModal = ({ isOpen, demand, people, isLoading, onClose, onSave }: {
  isOpen: boolean;
  demand: ServiceDemand;
  people: DemandPerson[];
  isLoading?: boolean;
  onClose: () => void;
  onSave: (input: AssignForm) => Promise<void>;
}) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AssignForm>({ resolver: zodResolver(assignSchema) });
  useEffect(() => {
    if (isOpen) reset({ responsibleId: demand.responsibleId || '', approverId: demand.approverId || '' });
  }, [isOpen, demand, reset]);
  const approvers = people.filter((person) => person.role === 'admin' || person.role === 'manager');
  return (
    <FormModal isOpen={isOpen} size="md" title="Responsável e aprovador" subtitle="Quem executa não pode conferir a própria demanda." isLoading={isLoading} submitLabel="Salvar" onClose={onClose} onSubmit={handleSubmit(onSave)}>
      <div className="grid grid-cols-1 gap-4">
        <label><span className={labelClass}>Responsável</span><select className={inputClass} {...register('responsibleId')}><option value="">Não definido</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
        <label><span className={labelClass}>Aprovador</span><select className={inputClass} {...register('approverId')}><option value="">Não definido</option>{approvers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select><FieldError message={errors.approverId?.message} /></label>
      </div>
    </FormModal>
  );
};

type ReasonForm = z.infer<typeof reasonSchema>;

/** Motivo obrigatório: devolver a uma etapa anterior ou cancelar a demanda. */
export const ReasonModal = ({ isOpen, title, subtitle, label, submitLabel, isLoading, onClose, onSave }: {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  label: string;
  submitLabel: string;
  isLoading?: boolean;
  onClose: () => void;
  onSave: (reason: string) => Promise<void>;
}) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ReasonForm>({ resolver: zodResolver(reasonSchema) });
  useEffect(() => {
    if (isOpen) reset({ reason: '' });
  }, [isOpen, reset]);
  return (
    <FormModal isOpen={isOpen} size="md" title={title} subtitle={subtitle} isLoading={isLoading} submitLabel={submitLabel} onClose={onClose} onSubmit={handleSubmit((values) => onSave(values.reason))}>
      <label><span className={labelClass}>{label} *</span><textarea rows={3} className={inputClass} {...register('reason')} /><FieldError message={errors.reason?.message} /></label>
    </FormModal>
  );
};
