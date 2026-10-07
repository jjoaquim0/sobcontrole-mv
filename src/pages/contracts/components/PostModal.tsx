import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { postSchema } from '../contractSchemas';
import { PostInput } from '@/services/contractsService';
import { Employee, ServicePost } from '@/types';
import { POST_STATUS_LABELS } from '../contractsDomain';
import { FieldError, FormModal, inputClass, labelClass } from './ContractPrimitives';

type PostForm = z.infer<typeof postSchema>;

export interface PostModalProps {
  isOpen: boolean;
  post?: ServicePost;
  employees: Employee[];
  isLoading?: boolean;
  onClose: () => void;
  onSave: (input: PostInput) => Promise<void>;
}

export const PostModal = ({ isOpen, post, employees, isLoading, onClose, onSave }: PostModalProps) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PostForm>({
    resolver: zodResolver(postSchema),
    defaultValues: { requiredHeadcount: 1, status: 'active' },
  });

  useEffect(() => {
    if (!isOpen) return;
    reset({
      name: post?.name || '', jobFunction: post?.jobFunction || '', workSchedule: post?.workSchedule || '',
      requiredHeadcount: post?.requiredHeadcount || 1, operationalManagerId: post?.operationalManagerId || '',
      requirements: post?.requirements || '', status: post?.status || 'active',
    });
  }, [isOpen, post, reset]);

  const managers = employees.filter((employee) => employee.status !== 'terminated' || employee.id === post?.operationalManagerId);

  return (
    <FormModal
      isOpen={isOpen}
      title={post ? 'Editar posto' : 'Cadastrar posto'}
      subtitle="Posto de trabalho previsto no contrato."
      isLoading={isLoading}
      submitLabel={post ? 'Salvar alterações' : 'Cadastrar posto'}
      onClose={onClose}
      onSubmit={handleSubmit((values) => onSave(values as PostInput))}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className={labelClass}>Nome do posto *</span><input className={inputClass} placeholder="Ex.: Portaria — Bloco A" {...register('name')} /><FieldError message={errors.name?.message} /></label>
        <label><span className={labelClass}>Função *</span><input className={inputClass} placeholder="Ex.: Auxiliar de limpeza" {...register('jobFunction')} /><FieldError message={errors.jobFunction?.message} /></label>
        <label><span className={labelClass}>Escala *</span><input className={inputClass} placeholder="Ex.: 12x36 diurno" {...register('workSchedule')} /><FieldError message={errors.workSchedule?.message} /></label>
        <label><span className={labelClass}>Quantitativo previsto *</span><input type="number" min={1} max={500} className={inputClass} {...register('requiredHeadcount')} /><FieldError message={errors.requiredHeadcount?.message} /></label>
        <label><span className={labelClass}>Status *</span><select className={inputClass} {...register('status')}>{Object.entries(POST_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="sm:col-span-2"><span className={labelClass}>Responsável operacional</span><select className={inputClass} {...register('operationalManagerId')}><option value="">Não informado</option>{managers.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}</select></label>
        <label className="sm:col-span-2"><span className={labelClass}>Requisitos do posto</span><textarea rows={3} className={inputClass} placeholder="Ex.: ASO em dia, NR-35, uniforme completo" {...register('requirements')} /><FieldError message={errors.requirements?.message} /></label>
      </div>
    </FormModal>
  );
};
