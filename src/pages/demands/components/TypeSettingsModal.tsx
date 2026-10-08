import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Plus } from 'lucide-react';
import { KeyboardEvent, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { DemandStageInput, DemandTypeInput } from '@/services/demandsService';
import { DemandStage, DemandStageCategory, DemandType } from '@/types';
import { demandTypeSchema, stageNameSchema } from '../demandSchemas';
import { STAGE_CATEGORY_LABELS } from '../demandsDomain';
import { inputClass, labelClass, secondaryButtonClass } from '@/pages/contracts/components/ContractPrimitives';
import { FieldError, FormModal, SectionTitle } from './DemandPrimitives';

type TypeForm = z.infer<typeof demandTypeSchema>;

export interface TypeSettingsModalProps {
  isOpen: boolean;
  /** Sem tipo: cadastro de um novo tipo (as etapas padrão são criadas pelo banco). */
  type?: DemandType;
  isSavingType?: boolean;
  isSavingStage?: boolean;
  onClose: () => void;
  onSaveType: (input: DemandTypeInput) => Promise<void>;
  onSaveStage: (input: DemandStageInput, id?: string) => Promise<void>;
}

const FIXED: DemandStageCategory[] = ['intake', 'review', 'done'];
const blockEnter = (event: KeyboardEvent) => { if (event.key === 'Enter') event.preventDefault(); };

const StageRow = ({ stage, disabled, onSave }: { stage: DemandStage; disabled?: boolean; onSave: (input: Omit<DemandStageInput, 'typeId'>) => Promise<void> }) => {
  const [name, setName] = useState(stage.name);
  const [error, setError] = useState<string>();
  useEffect(() => setName(stage.name), [stage.name]);
  const fixed = FIXED.includes(stage.category);
  const save = (isActive: boolean) => {
    const parsed = stageNameSchema.safeParse(name);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message); return; }
    setError(undefined);
    onSave({ name: parsed.data, category: stage.category, isActive }).catch(() => undefined);
  };
  return (
    <li className={`flex flex-wrap items-center gap-2 py-2 ${stage.isActive ? '' : 'opacity-60'}`}>
      <span className="w-6 text-xs font-bold text-gray-400">{stage.position}</span>
      <input aria-label={`Nome da etapa ${stage.name}`} className={`${inputClass} flex-1`} value={name} onChange={(event) => setName(event.target.value)} onKeyDown={blockEnter} />
      <span className="w-24 text-xs text-gray-500">{STAGE_CATEGORY_LABELS[stage.category]}</span>
      <button type="button" disabled={disabled || name === stage.name} onClick={() => save(stage.isActive)} className="rounded-lg p-2 text-cyan-700 hover:bg-cyan-500/10 disabled:opacity-30" aria-label={`Salvar nome da etapa ${stage.name}`}><Check className="h-4 w-4" /></button>
      {!fixed && <button type="button" disabled={disabled} onClick={() => save(!stage.isActive)} className="rounded-lg px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5">{stage.isActive ? 'Desativar' : 'Reativar'}</button>}
      {error && <FieldError message={error} />}
    </li>
  );
};

export const TypeSettingsModal = ({ isOpen, type, isSavingType, isSavingStage, onClose, onSaveType, onSaveStage }: TypeSettingsModalProps) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<TypeForm>({ resolver: zodResolver(demandTypeSchema) });
  const [newStage, setNewStage] = useState({ name: '', category: 'execution' as DemandStageCategory });
  const [newStageError, setNewStageError] = useState<string>();

  useEffect(() => {
    if (!isOpen) return;
    reset({ name: type?.name || '', description: type?.description || '', defaultDueDays: type?.defaultDueDays ?? '', isActive: type?.isActive ?? true });
    setNewStage({ name: '', category: 'execution' });
    setNewStageError(undefined);
  }, [isOpen, type, reset]);

  const addStage = () => {
    if (!type) return;
    const parsed = stageNameSchema.safeParse(newStage.name);
    if (!parsed.success) { setNewStageError(parsed.error.issues[0]?.message); return; }
    setNewStageError(undefined);
    onSaveStage({ typeId: type.id, name: parsed.data, category: newStage.category, isActive: true })
      .then(() => setNewStage({ name: '', category: 'execution' }))
      .catch(() => undefined);
  };

  return (
    <FormModal
      isOpen={isOpen}
      title={type ? `Configurar "${type.name}"` : 'Novo tipo de demanda'}
      subtitle={type ? undefined : 'O tipo nasce com as etapas Abertura, Triagem, Execução, Conferência e Encerramento.'}
      isLoading={isSavingType}
      submitLabel={type ? 'Salvar tipo' : 'Criar tipo'}
      onClose={onClose}
      onSubmit={handleSubmit((values) => onSaveType({
        name: values.name,
        description: values.description,
        defaultDueDays: values.defaultDueDays === '' || values.defaultDueDays === undefined ? undefined : Number(values.defaultDueDays),
        isActive: values.isActive,
      }))}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className={labelClass}>Nome *</span><input className={inputClass} {...register('name')} /><FieldError message={errors.name?.message} /></label>
        <label className="sm:col-span-2"><span className={labelClass}>Descrição</span><textarea rows={2} className={inputClass} {...register('description')} /><FieldError message={errors.description?.message} /></label>
        <label><span className={labelClass}>Prazo padrão (dias)</span><input type="number" min={0} max={365} className={inputClass} {...register('defaultDueDays')} /><FieldError message={errors.defaultDueDays?.message} /></label>
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-gray-700 dark:text-gray-200"><input type="checkbox" {...register('isActive')} />Tipo ativo para novas demandas</label>
      </div>

      {type && (
        <div>
          <SectionTitle>Etapas</SectionTitle>
          <p className="mb-2 text-xs text-gray-500">Abertura, conferência e encerramento fazem parte de todo fluxo. Etapas de triagem e execução podem ser adicionadas antes da conferência ou desativadas quando não houver demanda aberta nelas.</p>
          <ul className="divide-y divide-gray-100 dark:divide-white/5">
            {[...type.stages].sort((a, b) => a.position - b.position).map((stage) => (
              <StageRow key={stage.id} stage={stage} disabled={isSavingStage} onSave={(input) => onSaveStage({ ...input, typeId: type.id }, stage.id)} />
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input aria-label="Nome da nova etapa" placeholder="Nova etapa, ex.: Autorização da direção" className={`${inputClass} flex-1`} value={newStage.name} onChange={(event) => setNewStage((state) => ({ ...state, name: event.target.value }))} onKeyDown={blockEnter} />
            <select aria-label="Papel da nova etapa" className={`${inputClass} w-36`} value={newStage.category} onChange={(event) => setNewStage((state) => ({ ...state, category: event.target.value as DemandStageCategory }))}>
              <option value="triage">{STAGE_CATEGORY_LABELS.triage}</option>
              <option value="execution">{STAGE_CATEGORY_LABELS.execution}</option>
            </select>
            <button type="button" disabled={isSavingStage} onClick={addStage} className={secondaryButtonClass}><Plus className="h-4 w-4" />Adicionar etapa</button>
          </div>
          <FieldError message={newStageError} />
        </div>
      )}
    </FormModal>
  );
};
