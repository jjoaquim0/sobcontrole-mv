import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { contractSchema } from '../contractSchemas';
import { useCustomers } from '@/hooks/useCustomers';
import { ContractInput } from '@/services/contractsService';
import { ServiceContract } from '@/types';
import { CONTRACT_STATUS_LABELS, VALIDATION_STATUS_LABELS } from '../contractsDomain';
import { FieldError, FormModal, inputClass, labelClass, SectionTitle } from './ContractPrimitives';

type ContractForm = z.infer<typeof contractSchema>;

export interface ContractModalProps {
  isOpen: boolean;
  contract?: ServiceContract;
  isLoading?: boolean;
  onClose: () => void;
  onSave: (input: ContractInput) => Promise<void>;
}

export const ContractModal = ({ isOpen, contract, isLoading, onClose, onSave }: ContractModalProps) => {
  const { customers } = useCustomers();
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<ContractForm>({
    resolver: zodResolver(contractSchema),
    defaultValues: { validationStatus: 'pending', status: 'draft' },
  });

  useEffect(() => {
    if (!isOpen) return;
    reset({
      customerId: contract?.customerId || '', clientName: contract?.clientName || '', title: contract?.title || '',
      contractNumber: contract?.contractNumber || '', location: contract?.location || '',
      scopeSummary: contract?.scopeSummary || '', startDate: contract?.startDate || '', endDate: contract?.endDate || '',
      cctReference: contract?.cctReference || '', sourceDocumentsUrl: contract?.sourceDocumentsUrl || '',
      validationStatus: contract?.validationStatus || 'pending', status: contract?.status || 'draft',
      internalNotes: contract?.internalNotes || '',
    });
  }, [contract, isOpen, reset]);

  const onCustomerChange = (customerId: string) => {
    setValue('customerId', customerId);
    const customer = customers.find((item) => item.id === customerId);
    if (customer) setValue('clientName', customer.fullName, { shouldValidate: true });
  };

  return (
    <FormModal
      isOpen={isOpen}
      title={contract ? 'Editar contrato' : 'Cadastrar contrato'}
      subtitle="Dados informados pelo gestor a partir dos documentos do contrato."
      isLoading={isLoading}
      submitLabel={contract ? 'Salvar alterações' : 'Cadastrar contrato'}
      onClose={onClose}
      onSubmit={handleSubmit((values) => onSave(values as ContractInput))}
    >
      <section><SectionTitle>Identificação</SectionTitle><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label><span className={labelClass}>Cliente cadastrado</span><select className={inputClass} {...register('customerId')} onChange={(event) => onCustomerChange(event.target.value)}><option value="">Não vincular</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.fullName}</option>)}</select></label>
        <label><span className={labelClass}>Cliente (tomador) *</span><input className={inputClass} {...register('clientName')} /><FieldError message={errors.clientName?.message} /></label>
        <label className="sm:col-span-2"><span className={labelClass}>Título do contrato *</span><input className={inputClass} placeholder="Ex.: Limpeza e conservação — Sede" {...register('title')} /><FieldError message={errors.title?.message} /></label>
        <label><span className={labelClass}>Número do contrato</span><input className={inputClass} {...register('contractNumber')} /><FieldError message={errors.contractNumber?.message} /></label>
        <label><span className={labelClass}>Local de execução</span><input className={inputClass} {...register('location')} /><FieldError message={errors.location?.message} /></label>
        <label className="sm:col-span-2"><span className={labelClass}>Escopo resumido</span><textarea rows={3} className={inputClass} {...register('scopeSummary')} /><FieldError message={errors.scopeSummary?.message} /></label>
      </div></section>

      <section><SectionTitle>Vigência e validação</SectionTitle><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label><span className={labelClass}>Início da vigência</span><input type="date" className={inputClass} {...register('startDate')} /></label>
        <label><span className={labelClass}>Fim da vigência</span><input type="date" className={inputClass} {...register('endDate')} /><FieldError message={errors.endDate?.message} /></label>
        <label><span className={labelClass}>Situação da vigência *</span><select className={inputClass} {...register('validationStatus')}>{Object.entries(VALIDATION_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><span className="mt-1 block text-[11px] text-gray-400">Marque como conferida só depois de checar as datas no contrato assinado.</span></label>
        <label><span className={labelClass}>Status *</span><select className={inputClass} {...register('status')}>{Object.entries(CONTRACT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><FieldError message={errors.status?.message} /></label>
        <label><span className={labelClass}>Convenção coletiva de referência</span><input className={inputClass} placeholder="Ex.: CCT Asseio e Conservação 2026" {...register('cctReference')} /><FieldError message={errors.cctReference?.message} /><span className="mt-1 block text-[11px] text-gray-400">Somente referência. O sistema não interpreta a convenção.</span></label>
        <label><span className={labelClass}>Link dos documentos</span><input type="url" className={inputClass} placeholder="https://" {...register('sourceDocumentsUrl')} /><FieldError message={errors.sourceDocumentsUrl?.message} /></label>
        <label className="sm:col-span-2"><span className={labelClass}>Observações internas</span><textarea rows={3} className={inputClass} {...register('internalNotes')} /><FieldError message={errors.internalNotes?.message} /></label>
      </div></section>
    </FormModal>
  );
};
