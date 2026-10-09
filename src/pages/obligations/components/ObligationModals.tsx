import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ObligationItemInput, ObligationSendInput, ObligationsOverview, ObligationTemplateInput } from '@/services/obligationsService';
import { ObligationItem, ObligationTemplate } from '@/types';
import { FieldError, FormModal, inputClass, labelClass } from '@/pages/contracts/components/ContractPrimitives';
import { evidenceSchema, itemEditSchema, itemSchema, sendSchema, templateSchema } from '../obligationsSchemas';
import { computeDueDate, describeSchedule, formatCompetence, formatDate, MONTH_NAMES, RECURRENCE_LABELS, todayIso } from '../obligationsDomain';

const hint = 'mt-1 block text-[11px] text-gray-400';

type TemplateForm = z.infer<typeof templateSchema>;

export const TemplateModal = ({ isOpen, template, options, isLoading, onClose, onSave }: {
  isOpen: boolean;
  template?: ObligationTemplate;
  options?: Pick<ObligationsOverview, 'contracts' | 'people'>;
  isLoading?: boolean;
  onClose: () => void;
  onSave: (input: ObligationTemplateInput) => Promise<void>;
}) => {
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<TemplateForm>({ resolver: zodResolver(templateSchema) });
  useEffect(() => {
    if (!isOpen) return;
    reset({
      name: template?.name || '',
      description: template?.description || '',
      contractId: template?.contractId || '',
      recurrence: template?.recurrence || 'monthly',
      referenceMonth: template?.referenceMonth ? String(template.referenceMonth) : '',
      dueDay: template ? String(template.dueDay) : '5',
      dueMonthOffset: String(template?.dueMonthOffset ?? 1) as '0' | '1' | '2',
      defaultResponsibleId: template?.defaultResponsibleId || '',
      requiresEvidence: template?.requiresEvidence ?? true,
      isActive: template?.isActive ?? true,
    });
  }, [isOpen, template, reset]);

  const values = watch();
  const preview = /^\d+$/.test(values.dueDay || '') && Number(values.dueDay) >= 1 && Number(values.dueDay) <= 31
    ? describeSchedule({
      recurrence: values.recurrence || 'monthly',
      referenceMonth: values.referenceMonth ? Number(values.referenceMonth) : undefined,
      dueDay: Number(values.dueDay),
      dueMonthOffset: Number(values.dueMonthOffset || 1),
    })
    : undefined;
  const activeContracts = (options?.contracts || []).filter((contract) => contract.status === 'active' || contract.id === template?.contractId);

  return (
    <FormModal
      isOpen={isOpen}
      size="md"
      title={template ? 'Editar obrigação' : 'Nova obrigação recorrente'}
      subtitle="Cada competência aberta recebe automaticamente os itens das obrigações ativas."
      isLoading={isLoading}
      submitLabel={template ? 'Salvar' : 'Cadastrar obrigação'}
      onClose={onClose}
      onSubmit={handleSubmit((form) => onSave({
        name: form.name,
        description: form.description,
        contractId: form.contractId || undefined,
        recurrence: form.recurrence,
        referenceMonth: form.recurrence === 'monthly' ? undefined : Number(form.referenceMonth),
        dueDay: Number(form.dueDay),
        dueMonthOffset: Number(form.dueMonthOffset),
        defaultResponsibleId: form.defaultResponsibleId || undefined,
        requiresEvidence: form.requiresEvidence,
        isActive: form.isActive,
      }))}
    >
      <div className="grid grid-cols-1 gap-4">
        <label><span className={labelClass}>Obrigação *</span><input className={inputClass} placeholder="Ex.: folha de ponto, guias FGTS/INSS, relatório ao fiscal" {...register('name')} /><FieldError message={errors.name?.message} /></label>
        <label><span className={labelClass}>Contrato</span>
          <select className={inputClass} disabled={Boolean(template)} {...register('contractId')}>
            <option value="">Todos os contratos ativos</option>
            {activeContracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.title} · {contract.clientName}</option>)}
          </select>
          {template && <span className={hint}>O contrato não muda depois de cadastrado. Para trocar, desative e cadastre outra.</span>}
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label><span className={labelClass}>Recorrência *</span>
            <select className={inputClass} {...register('recurrence')}>
              {Object.entries(RECURRENCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          {values.recurrence !== 'monthly' && (
            <label><span className={labelClass}>{values.recurrence === 'quarterly' ? 'Primeiro mês *' : 'Mês da competência *'}</span>
              <select className={inputClass} {...register('referenceMonth')}>
                <option value="">Selecione</option>
                {MONTH_NAMES.map((name, index) => <option key={name} value={String(index + 1)}>{name}</option>)}
              </select>
              <FieldError message={errors.referenceMonth?.message} />
            </label>
          )}
          <label><span className={labelClass}>Dia do prazo *</span><input inputMode="numeric" className={inputClass} {...register('dueDay')} /><FieldError message={errors.dueDay?.message} /></label>
          <label><span className={labelClass}>Mês do prazo *</span>
            <select className={inputClass} {...register('dueMonthOffset')}>
              <option value="0">Mesmo mês da competência</option>
              <option value="1">Mês seguinte</option>
              <option value="2">Dois meses depois</option>
            </select>
          </label>
        </div>
        {preview && <p className="rounded-xl bg-cyan-50 px-3 py-2 text-xs text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-200">{preview}. Dia maior que o mês cai no último dia.</p>}
        <label><span className={labelClass}>Responsável padrão</span>
          <select className={inputClass} {...register('defaultResponsibleId')}>
            <option value="">Definir em cada competência</option>
            {(options?.people || []).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </label>
        <label><span className={labelClass}>Como cumprir</span><textarea rows={2} className={inputClass} placeholder="Onde buscar, quem assina, para onde enviar" {...register('description')} /><FieldError message={errors.description?.message} /></label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"><input type="checkbox" {...register('requiresEvidence')} />Exige link da evidência (Drive)</label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"><input type="checkbox" {...register('isActive')} />Ativa (entra nas próximas competências)</label>
      </div>
    </FormModal>
  );
};

type ItemForm = z.infer<typeof itemSchema>;

export const AddItemModal = ({ isOpen, periodId, competence, people, isLoading, onClose, onSave }: {
  isOpen: boolean;
  periodId?: string;
  competence?: string;
  people: ObligationsOverview['people'];
  isLoading?: boolean;
  onClose: () => void;
  onSave: (input: ObligationItemInput) => Promise<void>;
}) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ItemForm>({ resolver: zodResolver(itemSchema) });
  useEffect(() => {
    if (isOpen) reset({ name: '', description: '', dueDate: competence ? computeDueDate(competence, 10, 1) : todayIso(), responsibleId: '', requiresEvidence: true });
  }, [isOpen, competence, reset]);
  return (
    <FormModal
      isOpen={isOpen}
      size="md"
      title="Incluir item na competência"
      subtitle={competence ? `Somente em ${formatCompetence(competence)}. Para todo mês, cadastre uma obrigação recorrente.` : undefined}
      isLoading={isLoading}
      submitLabel="Incluir item"
      onClose={onClose}
      onSubmit={handleSubmit((values) => (periodId ? onSave({ periodId, ...values, responsibleId: values.responsibleId || undefined }) : undefined))}
    >
      <div className="grid grid-cols-1 gap-4">
        <label><span className={labelClass}>Item *</span><input className={inputClass} {...register('name')} /><FieldError message={errors.name?.message} /></label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label><span className={labelClass}>Prazo *</span><input type="date" className={inputClass} {...register('dueDate')} /><FieldError message={errors.dueDate?.message} /></label>
          <label><span className={labelClass}>Responsável</span>
            <select className={inputClass} {...register('responsibleId')}>
              <option value="">Sem responsável</option>
              {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
          </label>
        </div>
        <label><span className={labelClass}>Descrição</span><textarea rows={2} className={inputClass} {...register('description')} /></label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"><input type="checkbox" {...register('requiresEvidence')} />Exige link da evidência</label>
      </div>
    </FormModal>
  );
};

type ItemEditForm = z.infer<typeof itemEditSchema>;

export const EditItemModal = ({ item, people, isLoading, onClose, onSave }: {
  item?: ObligationItem;
  people: ObligationsOverview['people'];
  isLoading?: boolean;
  onClose: () => void;
  onSave: (dueDate: string, responsibleId?: string) => Promise<void>;
}) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ItemEditForm>({ resolver: zodResolver(itemEditSchema) });
  useEffect(() => {
    if (item) reset({ dueDate: item.dueDate, responsibleId: item.responsibleId || '' });
  }, [item, reset]);
  return (
    <FormModal isOpen={Boolean(item)} size="md" title="Prazo e responsável" subtitle={item?.name} isLoading={isLoading} submitLabel="Salvar" onClose={onClose} onSubmit={handleSubmit((values) => onSave(values.dueDate, values.responsibleId || undefined))}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label><span className={labelClass}>Prazo *</span><input type="date" className={inputClass} {...register('dueDate')} /><FieldError message={errors.dueDate?.message} /></label>
        <label><span className={labelClass}>Responsável</span>
          <select className={inputClass} {...register('responsibleId')}>
            <option value="">Sem responsável</option>
            {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </label>
      </div>
    </FormModal>
  );
};

export const EvidenceModal = ({ item, isLoading, onClose, onSave }: {
  item?: ObligationItem;
  isLoading?: boolean;
  onClose: () => void;
  onSave: (evidenceUrl?: string, note?: string) => Promise<void>;
}) => {
  const schema = useMemo(() => evidenceSchema(item?.requiresEvidence ?? true), [item?.requiresEvidence]);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  useEffect(() => {
    if (item) reset({ evidenceUrl: item.evidenceUrl || '', note: '' });
  }, [item, reset]);
  return (
    <FormModal
      isOpen={Boolean(item)}
      size="md"
      title="Registrar evidência"
      subtitle={item ? `${item.name} · prazo ${formatDate(item.dueDate)}` : undefined}
      isLoading={isLoading}
      submitLabel="Enviar para conferência"
      onClose={onClose}
      onSubmit={handleSubmit((values) => onSave(values.evidenceUrl || undefined, values.note))}
    >
      <div className="grid grid-cols-1 gap-4">
        <label><span className={labelClass}>Link da evidência{item?.requiresEvidence ? ' *' : ''}</span><input className={inputClass} placeholder="https://drive.google.com/..." {...register('evidenceUrl')} /><FieldError message={errors.evidenceUrl?.message} /></label>
        {item?.reviewNote && item.status === 'rejected' && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">Recusado: {item.reviewNote}</p>}
        <label><span className={labelClass}>Observação</span><textarea rows={2} className={inputClass} {...register('note')} /><FieldError message={errors.note?.message} /></label>
      </div>
    </FormModal>
  );
};

export const SendPeriodModal = ({ periodId, title, isLoading, onClose, onSave }: {
  periodId?: string;
  title?: string;
  isLoading?: boolean;
  onClose: () => void;
  onSave: (input: ObligationSendInput) => Promise<void>;
}) => {
  const today = todayIso();
  const schema = useMemo(() => sendSchema(today), [today]);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  useEffect(() => {
    if (periodId) reset({ sentOn: today, sentTo: '', proofUrl: '', note: '' });
  }, [periodId, today, reset]);
  return (
    <FormModal
      isOpen={Boolean(periodId)}
      size="md"
      title="Registrar envio do pacote"
      subtitle={title}
      isLoading={isLoading}
      submitLabel="Registrar envio"
      onClose={onClose}
      onSubmit={handleSubmit((values) => (periodId ? onSave({ periodId, ...values }) : undefined))}
    >
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label><span className={labelClass}>Data do envio *</span><input type="date" max={today} className={inputClass} {...register('sentOn')} /><FieldError message={errors.sentOn?.message} /></label>
          <label><span className={labelClass}>Enviado para *</span><input className={inputClass} placeholder="Fiscal do contrato, e-mail" {...register('sentTo')} /><FieldError message={errors.sentTo?.message} /></label>
        </div>
        <label><span className={labelClass}>Comprovante *</span><input className={inputClass} placeholder="Link do e-mail ou protocolo no Drive" {...register('proofUrl')} /><FieldError message={errors.proofUrl?.message} /></label>
        <label><span className={labelClass}>Observação</span><textarea rows={2} className={inputClass} {...register('note')} /></label>
      </div>
    </FormModal>
  );
};
