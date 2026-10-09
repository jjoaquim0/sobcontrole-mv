import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { allocationSchema, endAllocationSchema, transferSchema } from '../contractSchemas';
import { AllocationInput, EndAllocationInput, TransferAllocationInput } from '@/services/contractsService';
import { Employee, PostAllocation, ServicePost } from '@/types';
import { ALLOCATION_ROLE_LABELS, formatDate, todayIso } from '../contractsDomain';
import { FieldError, FormModal, inputClass, labelClass } from './ContractPrimitives';

type AllocationForm = z.infer<typeof allocationSchema>;

export interface AllocationModalProps {
  isOpen: boolean;
  post?: ServicePost;
  employees: Employee[];
  /** Funcionários já alocados (em aberto) neste posto, para não oferecer de novo. */
  allocatedEmployeeIds: string[];
  isLoading?: boolean;
  onClose: () => void;
  onSave: (input: AllocationInput) => Promise<void>;
}

export const AllocationModal = ({ isOpen, post, employees, allocatedEmployeeIds, isLoading, onClose, onSave }: AllocationModalProps) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AllocationForm>({
    resolver: zodResolver(allocationSchema),
    defaultValues: { allocationRole: 'holder' },
  });

  useEffect(() => {
    if (isOpen) reset({ employeeId: '', allocationRole: 'holder', startDate: todayIso(), notes: '' });
  }, [isOpen, reset]);

  const available = employees.filter((employee) => employee.status !== 'terminated' && !allocatedEmployeeIds.includes(employee.id));

  return (
    <FormModal
      isOpen={isOpen}
      size="md"
      title="Alocar funcionário"
      subtitle={post ? `${post.name} · ${post.jobFunction} · ${post.workSchedule}` : undefined}
      isLoading={isLoading}
      submitLabel="Alocar"
      onClose={onClose}
      onSubmit={handleSubmit((values) => post ? onSave({ ...values, postId: post.id }) : Promise.resolve())}
    >
      <div className="grid grid-cols-1 gap-4">
        <label><span className={labelClass}>Funcionário *</span><select className={inputClass} {...register('employeeId')}><option value="">Selecione</option>{available.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName} · {employee.jobTitle}</option>)}</select><FieldError message={errors.employeeId?.message} />{available.length === 0 && <span className="mt-1 block text-[11px] text-gray-400">Nenhum funcionário disponível. Cadastre em Pessoas › Funcionários.</span>}</label>
        <label><span className={labelClass}>Tipo de alocação *</span><select className={inputClass} {...register('allocationRole')}>{Object.entries(ALLOCATION_ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><span className="mt-1 block text-[11px] text-gray-400">Substituto cobre férias e ausências sem ocupar a vaga de titular.</span></label>
        <label><span className={labelClass}>Início *</span><input type="date" className={inputClass} {...register('startDate')} /><FieldError message={errors.startDate?.message} /></label>
        <label><span className={labelClass}>Observações</span><textarea rows={2} className={inputClass} {...register('notes')} /><FieldError message={errors.notes?.message} /></label>
      </div>
    </FormModal>
  );
};

type EndAllocationForm = z.infer<typeof endAllocationSchema>;

export interface EndAllocationModalProps {
  allocation?: PostAllocation;
  isLoading?: boolean;
  onClose: () => void;
  onSave: (input: EndAllocationInput) => Promise<void>;
}

export const EndAllocationModal = ({ allocation, isLoading, onClose, onSave }: EndAllocationModalProps) => {
  const schema = endAllocationSchema.refine((values) => !allocation || values.endDate >= allocation.startDate, {
    path: ['endDate'], message: 'A data de encerramento deve ser igual ou posterior ao início.',
  });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<EndAllocationForm>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (allocation) reset({ endDate: todayIso(), endReason: '' });
  }, [allocation, reset]);

  return (
    <FormModal
      isOpen={Boolean(allocation)}
      size="md"
      title="Encerrar alocação"
      subtitle={allocation ? `${allocation.employeeName} · desde ${formatDate(allocation.startDate)}` : undefined}
      isLoading={isLoading}
      submitLabel="Encerrar alocação"
      onClose={onClose}
      onSubmit={handleSubmit((values) => allocation ? onSave({ ...values, allocationId: allocation.id }) : Promise.resolve())}
    >
      <div className="grid grid-cols-1 gap-4">
        <label><span className={labelClass}>Data de encerramento *</span><input type="date" className={inputClass} {...register('endDate')} /><FieldError message={errors.endDate?.message} /></label>
        <label><span className={labelClass}>Motivo *</span><textarea rows={3} className={inputClass} placeholder="Ex.: remanejado para outro posto, desligamento, fim da cobertura de férias" {...register('endReason')} /><FieldError message={errors.endReason?.message} /></label>
      </div>
    </FormModal>
  );
};

type TransferForm = z.infer<typeof transferSchema>;

export interface TransferDestination {
  id: string;
  name: string;
  jobFunction: string;
  contractTitle: string;
}

export interface TransferAllocationModalProps {
  allocation?: PostAllocation;
  /** Postos ativos que podem receber o funcionário (o atual fica de fora). */
  destinations: TransferDestination[];
  isLoading?: boolean;
  onClose: () => void;
  onSave: (input: TransferAllocationInput) => Promise<void>;
}

export const TransferAllocationModal = ({ allocation, destinations, isLoading, onClose, onSave }: TransferAllocationModalProps) => {
  const schema = transferSchema.refine((values) => !allocation || values.transferDate > allocation.startDate, {
    path: ['transferDate'], message: 'A transferência deve ser posterior ao início da alocação atual.',
  });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<TransferForm>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (allocation) reset({ toPostId: '', transferDate: todayIso(), reason: '' });
  }, [allocation, reset]);

  const options = destinations.filter((destination) => destination.id !== allocation?.postId);

  return (
    <FormModal
      isOpen={Boolean(allocation)}
      size="md"
      title="Transferir para outro posto"
      subtitle={allocation ? `${allocation.employeeName} · ${ALLOCATION_ROLE_LABELS[allocation.allocationRole]} desde ${formatDate(allocation.startDate)}` : undefined}
      isLoading={isLoading}
      submitLabel="Transferir"
      onClose={onClose}
      onSubmit={handleSubmit((values) => allocation ? onSave({ ...values, allocationId: allocation.id }) : Promise.resolve())}
    >
      <div className="grid grid-cols-1 gap-4">
        <label><span className={labelClass}>Posto de destino *</span><select className={inputClass} {...register('toPostId')}><option value="">Selecione</option>{options.map((destination) => <option key={destination.id} value={destination.id}>{destination.name} · {destination.jobFunction} · {destination.contractTitle}</option>)}</select><FieldError message={errors.toPostId?.message} /></label>
        <label><span className={labelClass}>Começa no novo posto em *</span><input type="date" className={inputClass} {...register('transferDate')} /><FieldError message={errors.transferDate?.message} /><span className="mt-1 block text-[11px] text-gray-400">A alocação atual termina no dia anterior, com o mesmo papel no novo posto.</span></label>
        <label><span className={labelClass}>Motivo *</span><textarea rows={3} className={inputClass} placeholder="Ex.: remanejamento pedido pelo cliente, cobertura de outro posto" {...register('reason')} /><FieldError message={errors.reason?.message} /></label>
      </div>
    </FormModal>
  );
};
