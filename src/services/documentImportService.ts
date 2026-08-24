import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { Document } from '../types';

export type DocumentExtractionJobStatus = 'queued' | 'running' | 'done' | 'failed';
export type DocumentImportProposalStatus = 'pending' | 'applied' | 'rejected' | 'expired';

export interface NfeInstallment {
  amount: number;
  due_date: string;
}

export interface NfeHeaderProposalPayload {
  supplier: {
    document: string;
    name: string;
    email?: string;
    phone?: string;
  };
  purchase: {
    total_amount: number;
    discount: number;
    fee: number;
    final_value: number;
    payment_method: 'other';
    notes: string;
    installments: NfeInstallment[];
  };
}

export interface NfeProposalFormValues {
  supplierDocument: string;
  supplierName: string;
  totalAmount: string;
  discount: string;
  fee: string;
  finalValue: string;
  installments: Array<{ amount: string; dueDate: string }>;
}

export interface NfePayloadValidationResult {
  payload?: NfeHeaderProposalPayload;
  errors: Record<string, string>;
}

export interface DocumentExtractionJob {
  id: string;
  companyId: string;
  documentVersionId: string;
  documentCategory: 'nota_fiscal';
  status: DocumentExtractionJobStatus;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface NfeImportProposal {
  id: string;
  jobId: string;
  companyId: string;
  documentCategory: 'nota_fiscal';
  status: DocumentImportProposalStatus;
  payload: NfeHeaderProposalPayload;
  fieldOrigins: Record<string, string>;
  textOrigin: 'server' | 'client' | null;
  truncated: boolean;
  expiresAt: string;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierMatch {
  id: string;
  name: string;
  document: string;
  status: string;
}

export type SupplierMatchResult =
  | { status: 'new'; normalizedDocument: string; supplier: null }
  | { status: 'existing'; normalizedDocument: string; supplier: SupplierMatch }
  | { status: 'conflict'; normalizedDocument: string; suppliers: SupplierMatch[] }
  | { status: 'invalid'; normalizedDocument: string; supplier: null };

export type DocumentImportErrorCode =
  | 'nfe_saida_nao_suportada'
  | 'nfe_cnpj_suspeito'
  | 'nfe_xml_invalid'
  | 'nfe_access_key_invalid'
  | 'duplicate_nfe'
  | 'document_not_found'
  | 'unauthorized'
  | 'internal_error'
  | 'validation_error'
  | 'apply_failed';

export const ATOMIC_APPLY_ERROR_MESSAGE = 'Nada foi gravado. O documento original continua salvo. Tente novamente.';

const PUBLIC_ERROR_MESSAGES: Record<DocumentImportErrorCode, string> = {
  nfe_saida_nao_suportada: 'NF-e de saída não é suportada nesta rota.',
  nfe_cnpj_suspeito: 'Os CNPJs da NF-e não correspondem a uma entrada segura.',
  nfe_xml_invalid: 'O XML da NF-e não pôde ser validado com segurança.',
  nfe_access_key_invalid: 'A chave de acesso da NF-e é inválida.',
  duplicate_nfe: 'Esta NF-e já possui uma proposta para esta empresa.',
  document_not_found: 'Documento não encontrado.',
  unauthorized: 'Sessão inválida ou expirada.',
  internal_error: 'Não foi possível processar o documento.',
  validation_error: 'Revise os campos obrigatórios antes de continuar.',
  apply_failed: ATOMIC_APPLY_ERROR_MESSAGE,
};

export class DocumentImportError extends Error {
  readonly code: DocumentImportErrorCode;

  constructor(code: DocumentImportErrorCode, message = PUBLIC_ERROR_MESSAGES[code]) {
    super(message);
    this.name = 'DocumentImportError';
    this.code = code;
  }
}

const requireCompanyId = (): string => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');
  return companyId;
};

const JOB_SELECT = 'id, company_id, document_version_id, document_category, status, error, created_at, updated_at, started_at, completed_at';
const PROPOSAL_SELECT = 'id, job_id, company_id, document_category, status, payload, field_origins, text_origin, truncated, expires_at, applied_at, created_at, updated_at';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | null => typeof value === 'string' ? value : null;

const mapJob = (row: Record<string, unknown>): DocumentExtractionJob => ({
  id: String(row.id),
  companyId: String(row.company_id),
  documentVersionId: String(row.document_version_id),
  documentCategory: 'nota_fiscal',
  status: row.status as DocumentExtractionJobStatus,
  error: asString(row.error),
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
  startedAt: asString(row.started_at),
  completedAt: asString(row.completed_at),
});

const mapProposal = (row: Record<string, unknown>): NfeImportProposal => {
  const payloadResult = normalizeStoredPayload(row.payload);
  if (!payloadResult.payload) throw new DocumentImportError('internal_error');

  return {
    id: String(row.id),
    jobId: String(row.job_id),
    companyId: String(row.company_id),
    documentCategory: 'nota_fiscal',
    status: row.status as DocumentImportProposalStatus,
    payload: payloadResult.payload,
    fieldOrigins: isRecord(row.field_origins) ? Object.fromEntries(Object.entries(row.field_origins).map(([key, value]) => [key, String(value)])) : {},
    textOrigin: row.text_origin === 'server' || row.text_origin === 'client' ? row.text_origin : null,
    truncated: row.truncated === true,
    expiresAt: String(row.expires_at),
    appliedAt: asString(row.applied_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
};

const digitsOnly = (value: string): string => value.replace(/\D/g, '');

export const normalizeCnpj = (value: string): string => digitsOnly(value);

const isValidCalendarDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

export const serializeDueDate = (value: string): string | null => {
  const date = value.slice(0, 10);
  return isValidCalendarDate(date) ? `${date}T00:00:00Z` : null;
};

const parseMoneyToCents = (value: string | number): number | null => {
  const normalized = String(value).trim().replace(',', '.');
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
};

export const moneyToCents = (value: number): number | null => parseMoneyToCents(value);

const centsToMoney = (cents: number): number => cents / 100;

const formatMoneyInput = (value: number): string => value.toFixed(2);

export const createNfeProposalForm = (payload: NfeHeaderProposalPayload): NfeProposalFormValues => ({
  supplierDocument: payload.supplier.document,
  supplierName: payload.supplier.name,
  totalAmount: formatMoneyInput(payload.purchase.total_amount),
  discount: formatMoneyInput(payload.purchase.discount),
  fee: formatMoneyInput(payload.purchase.fee),
  finalValue: formatMoneyInput(payload.purchase.final_value),
  installments: payload.purchase.installments.map((installment) => ({
    amount: formatMoneyInput(installment.amount),
    dueDate: installment.due_date.slice(0, 10),
  })),
});

const buildPayload = (
  form: NfeProposalFormValues,
  requireInstallments: boolean,
): NfePayloadValidationResult => {
  const errors: Record<string, string> = {};
  const supplierDocument = normalizeCnpj(form.supplierDocument);
  const supplierName = form.supplierName.trim();
  if (supplierDocument.length !== 14) errors.supplierDocument = 'Informe um CNPJ com 14 dígitos.';
  if (!supplierName) errors.supplierName = 'Informe o nome do fornecedor.';

  const moneyFields = [
    ['totalAmount', form.totalAmount],
    ['discount', form.discount],
    ['fee', form.fee],
    ['finalValue', form.finalValue],
  ] as const;
  const moneyCents: Record<string, number> = {};
  for (const [field, value] of moneyFields) {
    const cents = parseMoneyToCents(value);
    if (cents === null) errors[field] = 'Informe um valor não negativo com até duas casas decimais.';
    else moneyCents[field] = cents;
  }

  if (requireInstallments && form.installments.length === 0) {
    errors.installments = 'Informe pelo menos uma parcela.';
  }

  const installments: NfeInstallment[] = [];
  let installmentCents = 0;
  form.installments.forEach((installment, index) => {
    const amountCents = parseMoneyToCents(installment.amount);
    const dueDate = serializeDueDate(installment.dueDate);
    if (amountCents === null || amountCents <= 0) errors[`installments[${index}].amount`] = 'A parcela deve ser maior que zero.';
    if (!dueDate) errors[`installments[${index}].dueDate`] = 'Informe uma data de vencimento válida.';
    if (amountCents !== null && amountCents > 0) installmentCents += amountCents;
    if (amountCents !== null && amountCents > 0 && dueDate) installments.push({ amount: centsToMoney(amountCents), due_date: dueDate });
  });

  if (moneyCents.finalValue !== undefined && form.installments.length > 0 && installmentCents !== moneyCents.finalValue) {
    errors.installments = 'A soma das parcelas deve ser igual ao valor final.';
  }

  if (Object.keys(errors).length > 0) return { errors };

  return {
    errors,
    payload: {
      supplier: { document: supplierDocument, name: supplierName },
      purchase: {
        total_amount: centsToMoney(moneyCents.totalAmount),
        discount: centsToMoney(moneyCents.discount),
        fee: centsToMoney(moneyCents.fee),
        final_value: centsToMoney(moneyCents.finalValue),
        payment_method: 'other',
        notes: '',
        installments,
      },
    },
  };
};

export const validateNfeProposalForm = (form: NfeProposalFormValues): NfePayloadValidationResult =>
  buildPayload(form, true);

const normalizeStoredPayload = (value: unknown, requireInstallments = false): NfePayloadValidationResult => {
  if (!isRecord(value)) return { errors: { payload: 'Payload inválido.' } };
  const supplier = isRecord(value.supplier) ? value.supplier : {};
  const purchase = isRecord(value.purchase) ? value.purchase : {};
  const installmentsValue = Array.isArray(purchase.installments) ? purchase.installments : [];
  const form: NfeProposalFormValues = {
    supplierDocument: String(supplier.document ?? ''),
    supplierName: String(supplier.name ?? ''),
    totalAmount: String(purchase.total_amount ?? ''),
    discount: String(purchase.discount ?? ''),
    fee: String(purchase.fee ?? ''),
    finalValue: String(purchase.final_value ?? ''),
    installments: installmentsValue.map((item) => {
      const installment = isRecord(item) ? item : {};
      return { amount: String(installment.amount ?? ''), dueDate: String(installment.due_date ?? '') };
    }),
  };
  const result = buildPayload(form, requireInstallments);
  if (!result.payload) return result;
  const optionalSupplier = {
    ...(typeof supplier.email === 'string' && supplier.email ? { email: supplier.email } : {}),
    ...(typeof supplier.phone === 'string' && supplier.phone ? { phone: supplier.phone } : {}),
  };
  result.payload.supplier = { ...result.payload.supplier, ...optionalSupplier };
  result.payload.purchase.notes = typeof purchase.notes === 'string' ? purchase.notes : '';
  return result;
};

export const validateNfeProposalPayload = (payload: NfeHeaderProposalPayload): NfePayloadValidationResult =>
  normalizeStoredPayload(payload);

const errorCodeFromValue = (value: unknown): DocumentImportErrorCode | null => {
  if (typeof value !== 'string') return null;
  if (value === 'nfe_saida_nao_suportada' || value === 'nfe_cnpj_suspeito' || value === 'duplicate_nfe' || value === 'document_not_found' || value === 'unauthorized') return value;
  if (value === 'nfe_access_key_invalid' || value.startsWith('nfe_access_key_')) return 'nfe_access_key_invalid';
  if (value.startsWith('nfe_xml_') || value.startsWith('nfe_structure') || value.startsWith('nfe_version') || value.startsWith('nfe_model') || value.startsWith('nfe_required') || value.startsWith('nfe_money') || value.startsWith('nfe_installment') || value.startsWith('company_cnpj')) return 'nfe_xml_invalid';
  if (value === 'internal_error') return 'internal_error';
  return null;
};

const extractFunctionError = async (error: unknown): Promise<DocumentImportError> => {
  let code: DocumentImportErrorCode | null = null;
  if (error instanceof FunctionsHttpError) {
    const context = error.context as { json?: () => Promise<unknown> } | undefined;
    if (context?.json) {
      try {
        const body = await context.json();
        if (isRecord(body) && isRecord(body.error)) {
          code = errorCodeFromValue(body.error.code);
        }
      } catch {
        // A resposta inválida continua sendo traduzida para erro seguro.
      }
    }
  }
  code = code ?? errorCodeFromValue(isRecord(error) ? error.code : undefined) ?? 'internal_error';
  return new DocumentImportError(code);
};

export const getDocumentImportErrorMessage = (code: string | null | undefined): string => {
  const normalized = errorCodeFromValue(code) ?? 'internal_error';
  return PUBLIC_ERROR_MESSAGES[normalized];
};

export const startNfeDocumentExtraction = async (
  documentVersionId: string,
): Promise<{ jobId: string; status: 'queued' }> => {
  requireCompanyId();
  try {
    const { data, error } = await supabase.functions.invoke('document-extraction', {
      body: { document_version_id: documentVersionId },
    });
    if (error) throw await extractFunctionError(error);
    if (!isRecord(data) || typeof data.job_id !== 'string' || data.status !== 'queued') {
      throw new DocumentImportError('internal_error');
    }
    return { jobId: data.job_id, status: 'queued' };
  } catch (error) {
    if (error instanceof DocumentImportError) throw error;
    throw await extractFunctionError(error);
  }
};

export const findLatestNfeExtraction = async (
  documentVersionId: string,
): Promise<DocumentExtractionJob | null> => {
  const companyId = requireCompanyId();
  const { data, error } = await supabase
    .from('document_extraction_jobs')
    .select(JOB_SELECT)
    .eq('document_version_id', documentVersionId)
    .eq('company_id', companyId)
    .eq('document_category', 'nota_fiscal')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapJob(data as Record<string, unknown>) : null;
};

const getNfeImportProposalById = async (proposalId: string): Promise<NfeImportProposal | null> => {
  const companyId = requireCompanyId();
  const { data, error } = await supabase
    .from('document_import_proposals')
    .select(PROPOSAL_SELECT)
    .eq('id', proposalId)
    .eq('company_id', companyId)
    .eq('document_category', 'nota_fiscal')
    .maybeSingle();
  if (error) throw error;
  return data ? mapProposal(data as Record<string, unknown>) : null;
};

export const getNfeImportProposalByJobId = async (
  jobId: string,
): Promise<NfeImportProposal | null> => {
  const companyId = requireCompanyId();
  const { data, error } = await supabase
    .from('document_import_proposals')
    .select(PROPOSAL_SELECT)
    .eq('job_id', jobId)
    .eq('company_id', companyId)
    .eq('document_category', 'nota_fiscal')
    .maybeSingle();
  if (error) throw error;
  return data ? mapProposal(data as Record<string, unknown>) : null;
};

export const saveNfeProposalPayload = async (
  proposalId: string,
  payload: NfeHeaderProposalPayload,
): Promise<NfeImportProposal> => {
  const companyId = requireCompanyId();
  const normalized = normalizeStoredPayload(payload, true);
  if (!normalized.payload) throw new DocumentImportError('validation_error');
  const { data, error } = await supabase
    .from('document_import_proposals')
    .update({ payload: normalized.payload })
    .eq('id', proposalId)
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .select(PROPOSAL_SELECT)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new DocumentImportError('document_not_found');
  return mapProposal(data as Record<string, unknown>);
};

export const findSupplierMatchByDocument = async (
  document: string,
): Promise<SupplierMatchResult> => {
  const companyId = requireCompanyId();
  const normalizedDocument = normalizeCnpj(document);
  if (normalizedDocument.length !== 14) return { status: 'invalid', normalizedDocument, supplier: null };
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, company_id, name, document, status')
    .eq('company_id', companyId);
  if (error) throw error;
  const matches = (data || [])
    .filter((row) => normalizeCnpj(String(row.document ?? '')) === normalizedDocument)
    .map((row) => ({ id: String(row.id), name: String(row.name ?? ''), document: String(row.document ?? ''), status: String(row.status ?? '') }));
  if (matches.length === 0) return { status: 'new', normalizedDocument, supplier: null };
  if (matches.length > 1) return { status: 'conflict', normalizedDocument, suppliers: matches };
  return { status: 'existing', normalizedDocument, supplier: matches[0] };
};

export const applyNfePurchaseProposal = async (proposalId: string): Promise<NfeImportProposal> => {
  const proposal = await getNfeImportProposalById(proposalId);
  if (!proposal) throw new DocumentImportError('document_not_found');
  if (proposal.status === 'applied') return proposal;
  if (proposal.status !== 'pending') throw new DocumentImportError('apply_failed');

  const { data, error } = await supabase.rpc('apply_nfe_purchase_proposal', {
    p_proposal_id: proposalId,
  });
  if (!error && data) return mapProposal(data as Record<string, unknown>);

  try {
    const after = await getNfeImportProposalById(proposalId);
    if (after?.status === 'applied') return after;
  } catch {
    // Falha de releitura não pode expor detalhes nem transformar a UI em retry automático.
  }
  throw new DocumentImportError('apply_failed');
};

export const isNfeDocumentImportEligible = (document: Document): boolean =>
  document.category === 'nota_fiscal' &&
  (document.mimeType === 'text/xml' || document.mimeType === 'application/xml') &&
  Boolean(document.currentVersionId);

export const getNfeProposalFormWithNotes = (
  payload: NfeHeaderProposalPayload,
  form: NfeProposalFormValues,
  supplierDocument: string,
): NfeHeaderProposalPayload => {
  const result = validateNfeProposalForm(form);
  if (!result.payload) throw new DocumentImportError('validation_error');
  return {
    ...result.payload,
    supplier: {
      ...result.payload.supplier,
      document: supplierDocument,
      ...(payload.supplier.email ? { email: payload.supplier.email } : {}),
      ...(payload.supplier.phone ? { phone: payload.supplier.phone } : {}),
    },
    purchase: {
      ...result.payload.purchase,
      notes: payload.purchase.notes,
    },
  };
};
