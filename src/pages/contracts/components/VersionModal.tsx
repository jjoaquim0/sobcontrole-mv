import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { versionSchema } from '../contractSchemas';
import { ContractVersionInput } from '@/services/contractsService';
import { ServiceContractVersion } from '@/types';
import { VALIDATION_STATUS_LABELS, VERSION_KIND_LABELS } from '../contractsDomain';
import { FieldError, FormModal, inputClass, labelClass } from './ContractPrimitives';

type VersionForm = z.infer<typeof versionSchema>;

export interface VersionModalProps {
  isOpen: boolean;
  version?: ServiceContractVersion;
  hasOriginal: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onSave: (input: ContractVersionInput) => Promise<void>;
}

export const VersionModal = ({ isOpen, version, hasOriginal, isLoading, onClose, onSave }: VersionModalProps) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<VersionForm>({
    resolver: zodResolver(versionSchema),
    defaultValues: { kind: 'amendment', validationStatus: 'pending' },
  });

  useEffect(() => {
    if (!isOpen) return;
    reset({
      kind: version?.kind || (hasOriginal ? 'amendment' : 'original'), title: version?.title || '',
      signedAt: version?.signedAt || '', effectiveStart: version?.effectiveStart || '', effectiveEnd: version?.effectiveEnd || '',
      documentUrl: version?.documentUrl || '', changeSummary: version?.changeSummary || '',
      validationStatus: version?.validationStatus || 'pending',
    });
  }, [hasOriginal, isOpen, reset, version]);

  const originalLocked = hasOriginal && version?.kind !== 'original';

  return (
    <FormModal
      isOpen={isOpen}
      title={version ? `Editar versão ${version.versionNumber}` : 'Registrar versão ou aditivo'}
      subtitle="Cada aditivo guarda sua própria vigência e conferência."
      isLoading={isLoading}
      submitLabel={version ? 'Salvar alterações' : 'Registrar'}
      onClose={onClose}
      onSubmit={handleSubmit((values) => onSave(values as ContractVersionInput))}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label><span className={labelClass}>Tipo *</span><select className={inputClass} {...register('kind')}>{Object.entries(VERSION_KIND_LABELS).map(([value, label]) => <option key={value} value={value} disabled={value === 'original' && originalLocked}>{label}</option>)}</select>{originalLocked && <span className="mt-1 block text-[11px] text-gray-400">Este contrato já possui um instrumento original.</span>}</label>
        <label><span className={labelClass}>Situação *</span><select className={inputClass} {...register('validationStatus')}>{Object.entries(VALIDATION_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="sm:col-span-2"><span className={labelClass}>Título *</span><input className={inputClass} placeholder="Ex.: 1º Termo Aditivo — prorrogação" {...register('title')} /><FieldError message={errors.title?.message} /></label>
        <label><span className={labelClass}>Data de assinatura</span><input type="date" className={inputClass} {...register('signedAt')} /></label>
        <span className="hidden sm:block" />
        <label><span className={labelClass}>Início da vigência</span><input type="date" className={inputClass} {...register('effectiveStart')} /></label>
        <label><span className={labelClass}>Fim da vigência</span><input type="date" className={inputClass} {...register('effectiveEnd')} /><FieldError message={errors.effectiveEnd?.message} /></label>
        <label className="sm:col-span-2"><span className={labelClass}>Link do documento</span><input type="url" className={inputClass} placeholder="https://" {...register('documentUrl')} /><FieldError message={errors.documentUrl?.message} /></label>
        <label className="sm:col-span-2"><span className={labelClass}>O que mudou</span><textarea rows={3} className={inputClass} {...register('changeSummary')} /><FieldError message={errors.changeSummary?.message} /></label>
      </div>
    </FormModal>
  );
};
