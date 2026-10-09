import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AbsenceInput, DeliveryInput, DeliveryReturnInput, DocumentSubmissionInput, PeopleDocsOverview, RequirementInput } from '@/services/peopleDocsService';
import { DocumentRequirement, EquipmentDelivery } from '@/types';
import { FieldError, FormModal, inputClass, labelClass } from '@/pages/contracts/components/ContractPrimitives';
import { absenceSchema, deliverySchema, requirementSchema, returnSchema, reviewRejectSchema, submissionSchema } from '../peopleDocsSchemas';
import { ABSENCE_KIND_LABELS, ChecklistItem, DOCUMENT_TARGET_LABELS, EQUIPMENT_CATEGORY_LABELS, formatDate, suggestExpiry, todayIso } from '../peopleDocsDomain';

const hint = 'mt-1 block text-[11px] text-gray-400';

type RequirementForm = z.infer<typeof requirementSchema>;

export const RequirementModal = ({ isOpen, requirement, options, isLoading, onClose, onSave }: {
  isOpen: boolean;
  requirement?: DocumentRequirement;
  options?: Pick<PeopleDocsOverview, 'contracts' | 'posts'>;
  isLoading?: boolean;
  onClose: () => void;
  onSave: (input: RequirementInput) => Promise<void>;
}) => {
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<RequirementForm>({ resolver: zodResolver(requirementSchema) });
  useEffect(() => {
    if (!isOpen) return;
    reset({
      name: requirement?.name || '',
      description: requirement?.description || '',
      target: requirement?.target || 'employee',
      contractId: requirement?.contractId || '',
      postId: requirement?.postId || '',
      validityMonths: requirement?.validityMonths ? String(requirement.validityMonths) : '',
      isActive: requirement?.isActive ?? true,
    });
  }, [isOpen, requirement, reset]);

  const target = watch('target');
  const contractId = watch('contractId');
  const locked = Boolean(requirement);
  const posts = (options?.posts || []).filter((post) => post.contractId === contractId);

  return (
    <FormModal
      isOpen={isOpen}
      size="md"
      title={requirement ? 'Editar documento do checklist' : 'Novo documento do checklist'}
      subtitle="O checklist mostra quem ainda não entregou, o que venceu e o que falta conferir."
      isLoading={isLoading}
      submitLabel={requirement ? 'Salvar' : 'Incluir no checklist'}
      onClose={onClose}
      onSubmit={handleSubmit((values) => onSave({
        name: values.name,
        description: values.description,
        target: values.target,
        contractId: values.contractId || undefined,
        postId: values.target === 'employee' && values.contractId ? values.postId || undefined : undefined,
        validityMonths: values.validityMonths ? Number(values.validityMonths) : undefined,
        isActive: values.isActive,
      }))}
    >
      <div className="grid grid-cols-1 gap-4">
        <label><span className={labelClass}>Documento *</span><input className={inputClass} placeholder="Ex.: ASO, NR-35, ficha de EPI, certidão do FGTS" {...register('name')} /><FieldError message={errors.name?.message} /></label>
        <label><span className={labelClass}>Exigido de *</span>
          <select className={inputClass} disabled={locked} {...register('target', { onChange: () => setValue('postId', '') })}>
            {Object.entries(DOCUMENT_TARGET_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label><span className={labelClass}>Contrato</span>
          <select className={inputClass} disabled={locked} {...register('contractId', { onChange: () => setValue('postId', '') })}>
            <option value="">{target === 'employee' ? 'Todos os contratos' : 'Todos os contratos ativos'}</option>
            {(options?.contracts || []).map((contract) => <option key={contract.id} value={contract.id}>{contract.title} · {contract.clientName}</option>)}
          </select>
        </label>
        {target === 'employee' && (
          <label><span className={labelClass}>Posto</span>
            <select className={inputClass} disabled={locked || !contractId} {...register('postId')}>
              <option value="">Todos os postos do contrato</option>
              {posts.map((post) => <option key={post.id} value={post.id}>{post.name} · {post.jobFunction}</option>)}
            </select>
            <FieldError message={errors.postId?.message} />
          </label>
        )}
        {locked && <span className={hint}>A quem o documento é exigido não muda depois de criado. Para mudar, desative este item e cadastre outro.</span>}
        <label><span className={labelClass}>Validade (meses)</span><input type="number" min={1} max={120} className={inputClass} placeholder="Sem validade" {...register('validityMonths')} /><FieldError message={errors.validityMonths?.message} /><span className={hint}>Com validade, a data de vencimento é calculada pela emissão.</span></label>
        <label><span className={labelClass}>Orientação</span><textarea rows={2} className={inputClass} placeholder="Onde conseguir, quem confere, o que observar" {...register('description')} /><FieldError message={errors.description?.message} /></label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"><input type="checkbox" {...register('isActive')} />Exigir este documento</label>
      </div>
    </FormModal>
  );
};

type SubmissionForm = z.infer<typeof submissionSchema>;

export const SubmitDocumentModal = ({ item, isLoading, onClose, onSave }: {
  item?: ChecklistItem;
  isLoading?: boolean;
  onClose: () => void;
  onSave: (input: DocumentSubmissionInput) => Promise<void>;
}) => {
  const validityMonths = item?.requirement.validityMonths;
  const schema = submissionSchema.refine((values) => !validityMonths || Boolean(values.issuedOn || values.expiresOn), {
    path: ['issuedOn'], message: 'Informe a emissão ou a validade do documento.',
  });
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<SubmissionForm>({ resolver: zodResolver(schema) });
  useEffect(() => {
    if (item) reset({ documentUrl: '', issuedOn: '', expiresOn: '', notes: '' });
  }, [item, reset]);
  const suggested = suggestExpiry(watch('issuedOn'), validityMonths);

  return (
    <FormModal
      isOpen={Boolean(item)}
      size="md"
      title={`Registrar entrega: ${item?.requirement.name || ''}`}
      subtitle={item ? `${item.targetName}${item.context ? ` · ${item.context}` : ''}` : undefined}
      isLoading={isLoading}
      submitLabel="Registrar entrega"
      onClose={onClose}
      onSubmit={handleSubmit((values) => item ? onSave({
        requirementId: item.requirement.id,
        employeeId: item.employeeId,
        contractId: item.contractId,
        documentUrl: values.documentUrl,
        issuedOn: values.issuedOn || undefined,
        expiresOn: values.expiresOn || undefined,
        notes: values.notes,
      }) : Promise.resolve())}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className={labelClass}>Link do documento *</span><input className={inputClass} placeholder="https://drive.google.com/..." {...register('documentUrl')} /><FieldError message={errors.documentUrl?.message} /><span className={hint}>O arquivo fica no Drive; aqui guardamos só o link.</span></label>
        <label><span className={labelClass}>Emissão{validityMonths ? ' *' : ''}</span><input type="date" className={inputClass} {...register('issuedOn')} /><FieldError message={errors.issuedOn?.message} /></label>
        <label><span className={labelClass}>Validade</span><input type="date" className={inputClass} {...register('expiresOn')} /><FieldError message={errors.expiresOn?.message} />{validityMonths && <span className={hint}>{suggested && !watch('expiresOn') ? `Será ${formatDate(suggested)} (${validityMonths} meses).` : `Em branco: emissão + ${validityMonths} meses.`}</span>}</label>
        <label className="sm:col-span-2"><span className={labelClass}>Observações</span><textarea rows={2} className={inputClass} {...register('notes')} /><FieldError message={errors.notes?.message} /></label>
      </div>
    </FormModal>
  );
};

type RejectForm = z.infer<typeof reviewRejectSchema>;

export const RejectDocumentModal = ({ item, isLoading, onClose, onSave }: {
  item?: ChecklistItem;
  isLoading?: boolean;
  onClose: () => void;
  onSave: (note: string) => Promise<void>;
}) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<RejectForm>({ resolver: zodResolver(reviewRejectSchema) });
  useEffect(() => {
    if (item) reset({ note: '' });
  }, [item, reset]);
  return (
    <FormModal isOpen={Boolean(item)} size="md" title="Recusar documento" subtitle={item ? `${item.requirement.name} · ${item.targetName}` : undefined} isLoading={isLoading} submitLabel="Recusar" onClose={onClose} onSubmit={handleSubmit((values) => onSave(values.note))}>
      <label><span className={labelClass}>Motivo *</span><textarea rows={3} className={inputClass} placeholder="Ex.: ilegível, vencido, sem assinatura" {...register('note')} /><FieldError message={errors.note?.message} /></label>
    </FormModal>
  );
};

type AbsenceForm = z.infer<typeof absenceSchema>;

export const AbsenceModal = ({ isOpen, employees, defaultEmployeeId, isLoading, onClose, onSave }: {
  isOpen: boolean;
  employees: PeopleDocsOverview['employees'];
  defaultEmployeeId?: string;
  isLoading?: boolean;
  onClose: () => void;
  onSave: (input: AbsenceInput) => Promise<void>;
}) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AbsenceForm>({ resolver: zodResolver(absenceSchema) });
  useEffect(() => {
    if (isOpen) reset({ employeeId: defaultEmployeeId || '', kind: 'vacation', startDate: todayIso(), endDate: '', notes: '' });
  }, [isOpen, defaultEmployeeId, reset]);
  const available = employees.filter((employee) => employee.status !== 'terminated');
  return (
    <FormModal isOpen={isOpen} size="md" title="Registrar férias ou afastamento" subtitle="Durante o período o titular deixa de contar na cobertura do posto." isLoading={isLoading} submitLabel="Registrar" onClose={onClose} onSubmit={handleSubmit((values) => onSave(values))}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className={labelClass}>Funcionário *</span><select className={inputClass} {...register('employeeId')}><option value="">Selecione</option>{available.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName} · {employee.jobTitle}</option>)}</select><FieldError message={errors.employeeId?.message} /></label>
        <label className="sm:col-span-2"><span className={labelClass}>Tipo *</span><select className={inputClass} {...register('kind')}>{Object.entries(ABSENCE_KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span className={labelClass}>Início *</span><input type="date" className={inputClass} {...register('startDate')} /><FieldError message={errors.startDate?.message} /></label>
        <label><span className={labelClass}>Fim *</span><input type="date" className={inputClass} {...register('endDate')} /><FieldError message={errors.endDate?.message} /></label>
        <label className="sm:col-span-2"><span className={labelClass}>Observações</span><textarea rows={2} className={inputClass} {...register('notes')} /><FieldError message={errors.notes?.message} /><span className={hint}>Não registre diagnóstico nem CID.</span></label>
      </div>
    </FormModal>
  );
};

type DeliveryForm = z.infer<typeof deliverySchema>;

export const DeliveryModal = ({ isOpen, options, defaultEmployeeId, isLoading, onClose, onSave }: {
  isOpen: boolean;
  options?: Pick<PeopleDocsOverview, 'employees' | 'posts' | 'allocations' | 'contracts'>;
  defaultEmployeeId?: string;
  isLoading?: boolean;
  onClose: () => void;
  onSave: (input: DeliveryInput) => Promise<void>;
}) => {
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<DeliveryForm>({ resolver: zodResolver(deliverySchema) });
  useEffect(() => {
    if (isOpen) reset({ employeeId: defaultEmployeeId || '', postId: '', category: 'ppe', itemName: '', quantity: '1', size: '', caNumber: '', deliveredOn: todayIso(), replaceBy: '', evidenceUrl: '', notes: '' });
  }, [isOpen, defaultEmployeeId, reset]);
  const employeeId = watch('employeeId');
  const category = watch('category');
  const today = todayIso();
  const contractTitles = new Map((options?.contracts || []).map((contract) => [contract.id, contract.title]));
  const employeePostIds = new Set((options?.allocations || []).filter((allocation) => allocation.employeeId === employeeId && (!allocation.endDate || allocation.endDate >= today)).map((allocation) => allocation.postId));
  const posts = (options?.posts || []).filter((post) => employeePostIds.has(post.id));
  const available = (options?.employees || []).filter((employee) => employee.status !== 'terminated');

  return (
    <FormModal
      isOpen={isOpen}
      title="Registrar entrega de uniforme ou EPI"
      subtitle="Guarde o link da ficha de entrega assinada como comprovante."
      isLoading={isLoading}
      submitLabel="Registrar entrega"
      onClose={onClose}
      onSubmit={handleSubmit((values) => onSave({ ...values, quantity: Number(values.quantity), postId: values.postId || undefined, replaceBy: values.replaceBy || undefined }))}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label><span className={labelClass}>Funcionário *</span><select className={inputClass} {...register('employeeId')}><option value="">Selecione</option>{available.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}</select><FieldError message={errors.employeeId?.message} /></label>
        <label><span className={labelClass}>Posto</span><select className={inputClass} disabled={!posts.length} {...register('postId')}><option value="">{posts.length ? 'Sem posto' : 'Sem alocação aberta'}</option>{posts.map((post) => <option key={post.id} value={post.id}>{post.name} · {contractTitles.get(post.contractId) || ''}</option>)}</select></label>
        <label><span className={labelClass}>Tipo *</span><select className={inputClass} {...register('category')}>{Object.entries(EQUIPMENT_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span className={labelClass}>Item *</span><input className={inputClass} placeholder={category === 'ppe' ? 'Ex.: bota de segurança, luva nitrílica' : 'Ex.: camisa polo, calça'} {...register('itemName')} /><FieldError message={errors.itemName?.message} /></label>
        <label><span className={labelClass}>Quantidade *</span><input type="number" min={1} max={100} className={inputClass} {...register('quantity')} /><FieldError message={errors.quantity?.message} /></label>
        <label><span className={labelClass}>Tamanho</span><input className={inputClass} {...register('size')} /><FieldError message={errors.size?.message} /></label>
        <label><span className={labelClass}>CA{category === 'ppe' ? ' *' : ''}</span><input className={inputClass} placeholder="Certificado de Aprovação" {...register('caNumber')} /><FieldError message={errors.caNumber?.message} /></label>
        <label><span className={labelClass}>Entrega *</span><input type="date" className={inputClass} {...register('deliveredOn')} /><FieldError message={errors.deliveredOn?.message} /></label>
        <label><span className={labelClass}>Trocar até</span><input type="date" className={inputClass} {...register('replaceBy')} /><FieldError message={errors.replaceBy?.message} /></label>
        <label><span className={labelClass}>Ficha de entrega (link)</span><input className={inputClass} placeholder="https://drive.google.com/..." {...register('evidenceUrl')} /><FieldError message={errors.evidenceUrl?.message} /></label>
        <label className="sm:col-span-2"><span className={labelClass}>Observações</span><textarea rows={2} className={inputClass} {...register('notes')} /><FieldError message={errors.notes?.message} /></label>
      </div>
    </FormModal>
  );
};

type ReturnForm = z.infer<typeof returnSchema>;

export const ReturnDeliveryModal = ({ delivery, isLoading, onClose, onSave }: {
  delivery?: EquipmentDelivery;
  isLoading?: boolean;
  onClose: () => void;
  onSave: (input: DeliveryReturnInput) => Promise<void>;
}) => {
  const schema = returnSchema.refine((values) => !delivery || values.returnedOn >= delivery.deliveredOn, {
    path: ['returnedOn'], message: 'A devolução deve ser igual ou posterior à entrega.',
  });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ReturnForm>({ resolver: zodResolver(schema) });
  useEffect(() => {
    if (delivery) reset({ returnedOn: todayIso(), note: '' });
  }, [delivery, reset]);
  return (
    <FormModal isOpen={Boolean(delivery)} size="md" title="Registrar devolução" subtitle={delivery ? `${delivery.itemName} · ${delivery.employeeName} · entregue em ${formatDate(delivery.deliveredOn)}` : undefined} isLoading={isLoading} submitLabel="Registrar devolução" onClose={onClose} onSubmit={handleSubmit((values) => delivery ? onSave({ deliveryId: delivery.id, ...values }) : Promise.resolve())}>
      <div className="grid grid-cols-1 gap-4">
        <label><span className={labelClass}>Data da devolução *</span><input type="date" className={inputClass} {...register('returnedOn')} /><FieldError message={errors.returnedOn?.message} /></label>
        <label><span className={labelClass}>Observação</span><textarea rows={2} className={inputClass} placeholder="Ex.: desgaste, troca de tamanho, desligamento" {...register('note')} /><FieldError message={errors.note?.message} /></label>
      </div>
    </FormModal>
  );
};
