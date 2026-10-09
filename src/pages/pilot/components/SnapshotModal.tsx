import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FieldError, FormModal, inputClass, labelClass } from '@/pages/contracts/components/ContractPrimitives';
import { PilotSnapshotInput } from '@/services/pilotService';
import { DECISION_LABELS, SNAPSHOT_KIND_LABELS } from '../pilotDomain';
import { SnapshotForm, snapshotSchema } from '../pilotSchemas';

export const SnapshotModal = ({ isOpen, period, hasBaseline, isLoading, onClose, onSave }: {
  isOpen: boolean;
  period: { from: string; to: string };
  hasBaseline: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onSave: (input: PilotSnapshotInput) => Promise<void>;
}) => {
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<SnapshotForm>({ resolver: zodResolver(snapshotSchema) });
  useEffect(() => {
    if (isOpen) {
      reset({
        label: hasBaseline ? '' : 'Linha de base',
        kind: hasBaseline ? 'checkpoint' : 'baseline',
        periodFrom: period.from,
        periodTo: period.to,
        offlineSteps: '',
        notes: '',
        decision: '',
      });
    }
  }, [isOpen, hasBaseline, period.from, period.to, reset]);
  const kind = watch('kind');

  return (
    <FormModal
      isOpen={isOpen}
      title="Salvar medição do piloto"
      subtitle="Os números do período são calculados agora e ficam guardados sem alteração."
      isLoading={isLoading}
      submitLabel="Salvar medição"
      onClose={onClose}
      onSubmit={handleSubmit((values) => onSave({
        label: values.label,
        kind: values.kind,
        periodFrom: values.periodFrom,
        periodTo: values.periodTo,
        offlineSteps: values.offlineSteps ? Number(values.offlineSteps) : undefined,
        notes: values.notes || undefined,
        decision: values.kind === 'final' && values.decision ? values.decision : undefined,
      }))}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label><span className={labelClass}>Nome *</span><input className={inputClass} placeholder="Ex.: Semana 6" {...register('label')} /><FieldError message={errors.label?.message} /></label>
        <label><span className={labelClass}>Tipo *</span>
          <select className={inputClass} {...register('kind')}>
            {(Object.keys(SNAPSHOT_KIND_LABELS) as (keyof typeof SNAPSHOT_KIND_LABELS)[]).map((key) => <option key={key} value={key}>{SNAPSHOT_KIND_LABELS[key]}</option>)}
          </select>
        </label>
        <label><span className={labelClass}>Início do período *</span><input type="date" className={inputClass} {...register('periodFrom')} /><FieldError message={errors.periodFrom?.message} /></label>
        <label><span className={labelClass}>Fim do período *</span><input type="date" className={inputClass} {...register('periodTo')} /><FieldError message={errors.periodTo?.message} /></label>
        <label className="sm:col-span-2"><span className={labelClass}>Etapas que ainda exigem planilha ou cobrança informal</span>
          <input inputMode="numeric" className={inputClass} placeholder="Conte com a equipe; ex.: 4" {...register('offlineSteps')} />
          <FieldError message={errors.offlineSteps?.message} />
        </label>
        {kind === 'final' && (
          <label className="sm:col-span-2"><span className={labelClass}>Decisão da direção *</span>
            <select className={inputClass} {...register('decision')}>
              <option value="">Selecione</option>
              {(Object.keys(DECISION_LABELS) as (keyof typeof DECISION_LABELS)[]).map((key) => <option key={key} value={key}>{DECISION_LABELS[key]}</option>)}
            </select>
            <FieldError message={errors.decision?.message} />
          </label>
        )}
        <label className="sm:col-span-2"><span className={labelClass}>{kind === 'final' ? 'Motivos da decisão e próximos passos *' : 'Observações'}</span>
          <textarea rows={3} className={inputClass} {...register('notes')} />
          <FieldError message={errors.notes?.message} />
        </label>
      </div>
    </FormModal>
  );
};
