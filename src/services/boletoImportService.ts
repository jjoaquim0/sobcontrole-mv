import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { Document } from '../types';
import { createSyntheticDocument } from './documentService';
import {
  findSupplierMatchByDocument,
  SupplierMatchResult,
} from './documentImportService';

export interface BoletoPayableProposalPayload {
  amount: number;
  due_date: string;
}

export interface BoletoProposalPayload {
  supplier: {
    document: string;
    name: string;
  };
  payable: BoletoPayableProposalPayload;
}

export type BoletoProposalStatus = 'pending' | 'applied' | 'rejected' | 'expired';

export interface BoletoImportProposal {
  id: string;
  jobId: string;
  companyId: string;
  documentCategory: 'boleto';
  idempotencyKey: string;
  status: BoletoProposalStatus;
  payload: BoletoProposalPayload;
  fieldOrigins: Record<string, string>;
  textOrigin: 'server' | 'client' | null;
  truncated: boolean;
  expiresAt: string;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BoletoSupplierFormValues {
  supplierDocument: string;
  supplierName: string;
}

export interface BoletoSupplierValidationResult {
  errors: Record<string, string>;
  supplier?: { document: string; name: string };
}

export type BoletoImportErrorCode =
  | 'boleto_line_invalid'
  | 'duplicate_boleto'
  | 'document_not_found'
  | 'unauthorized'
  | 'internal_error'
  | 'validation_error'
  | 'apply_failed';

const PUBLIC_ERROR_MESSAGES: Record<BoletoImportErrorCode, string> = {
  boleto_line_invalid: 'A linha digitável deve conter 47 dígitos e DVs válidos.',
  duplicate_boleto: 'Este boleto já possui uma importação ativa ou já foi importado.',
  document_not_found: 'Boleto não encontrado.',
  unauthorized: 'Sessão inválida ou expirada.',
  internal_error: 'Não foi possível processar o boleto.',
  validation_error: 'Informe um fornecedor válido antes de continuar.',
  apply_failed: 'Nada foi gravado. O boleto original continua salvo. Tente novamente.',
};

export class BoletoImportError extends Error {
  readonly code: BoletoImportErrorCode;

  constructor(code: BoletoImportErrorCode, message = PUBLIC_ERROR_MESSAGES[code]) {
    super(message);
    this.name = 'BoletoImportError';
    this.code = code;
  }
}

const PROPOSAL_SELECT = 'id, job_id, company_id, document_category, idempotency_key, status, payload, field_origins, text_origin, truncated, expires_at, applied_at, created_at, updated_at';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requireCompanyId = (): string => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new BoletoImportError('unauthorized');
  return companyId;
};

export const normalizeBoletoLine = (value: string): string => value.replace(/[^0-9]/g, '');

const hasValidBoletoShape = (line: string): boolean => /^\d{47}$/.test(line);

export const validateBoletoSupplierForm = (
  form: BoletoSupplierFormValues,
): BoletoSupplierValidationResult => {
  const document = normalizeBoletoLine(form.supplierDocument);
  const name = form.supplierName.trim();
  const errors: Record<string, string> = {};
  if (document.length !== 14) errors.supplierDocument = 'Informe um CNPJ com 14 dígitos.';
  if (!name) errors.supplierName = 'Informe o nome do fornecedor.';
  return Object.keys(errors).length > 0 ? { errors } : { errors, supplier: { document, name } };
};

const normalizePayload = (value: unknown): BoletoProposalPayload | null => {
  if (!isRecord(value) || !isRecord(value.supplier) || !isRecord(value.payable)) return null;
  const amount = Number(value.payable.amount);
  const dueDate = value.payable.due_date;
  const document = String(value.supplier.document ?? '');
  const name = String(value.supplier.name ?? '');
  if (!Number.isFinite(amount) || amount < 0 || typeof dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}T00:00:00Z$/.test(dueDate)) return null;
  return {
    supplier: { document, name },
    payable: { amount, due_date: dueDate },
  };
};

const mapProposal = (row: Record<string, unknown>): BoletoImportProposal => {
  const payload = normalizePayload(row.payload);
  const idempotencyKey = row.idempotency_key;
  if (!payload || typeof idempotencyKey !== 'string' || !/^\d{47}$/.test(idempotencyKey)) {
    throw new BoletoImportError('internal_error');
  }
  return {
    id: String(row.id),
    jobId: String(row.job_id),
    companyId: String(row.company_id),
    documentCategory: 'boleto',
    idempotencyKey,
    status: row.status as BoletoProposalStatus,
    payload,
    fieldOrigins: isRecord(row.field_origins)
      ? Object.fromEntries(Object.entries(row.field_origins).map(([key, value]) => [key, String(value)]))
      : {},
    textOrigin: row.text_origin === 'server' || row.text_origin === 'client' ? row.text_origin : null,
    truncated: row.truncated === true,
    expiresAt: String(row.expires_at),
    appliedAt: typeof row.applied_at === 'string' ? row.applied_at : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
};

const extractFunctionError = async (error: unknown): Promise<BoletoImportError> => {
  let code: BoletoImportErrorCode | null = null;
  if (error instanceof FunctionsHttpError) {
    const context = error.context as { json?: () => Promise<unknown> } | undefined;
    if (context?.json) {
      try {
        const body = await context.json();
        if (isRecord(body) && isRecord(body.error) && typeof body.error.code === 'string') {
          const value = body.error.code;
          if (value === 'duplicate_boleto') code = value;
          else if (value.startsWith('boleto_')) code = 'boleto_line_invalid';
          else if (value === 'unauthorized') code = value;
        }
      } catch {
        // Resposta inválida continua sendo convertida para mensagem segura.
      }
    }
  }
  return new BoletoImportError(code ?? 'internal_error');
};

const getBoletoProposalById = async (proposalId: string): Promise<BoletoImportProposal | null> => {
  const companyId = requireCompanyId();
  const { data, error } = await supabase
    .from('document_import_proposals')
    .select(PROPOSAL_SELECT)
    .eq('id', proposalId)
    .eq('company_id', companyId)
    .eq('document_category', 'boleto')
    .maybeSingle();
  if (error) throw error;
  return data ? mapProposal(data as Record<string, unknown>) : null;
};

export const findBoletoProposalByLine = async (line: string): Promise<BoletoImportProposal | null> => {
  const companyId = requireCompanyId();
  const canonicalLine = normalizeBoletoLine(line);
  if (!hasValidBoletoShape(canonicalLine)) return null;
  const { data, error } = await supabase
    .from('document_import_proposals')
    .select(PROPOSAL_SELECT)
    .eq('company_id', companyId)
    .eq('document_category', 'boleto')
    .eq('idempotency_key', canonicalLine)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProposal(data as Record<string, unknown>) : null;
};

export const getBoletoImportProposalByJobId = async (jobId: string): Promise<BoletoImportProposal | null> => {
  const companyId = requireCompanyId();
  const { data, error } = await supabase
    .from('document_import_proposals')
    .select(PROPOSAL_SELECT)
    .eq('job_id', jobId)
    .eq('company_id', companyId)
    .eq('document_category', 'boleto')
    .maybeSingle();
  if (error) throw error;
  return data ? mapProposal(data as Record<string, unknown>) : null;
};

export const startBoletoDocumentExtraction = async (
  line: string,
): Promise<{ document: Document | null; proposal: BoletoImportProposal; resumed: boolean }> => {
  requireCompanyId();
  const canonicalLine = normalizeBoletoLine(line);
  if (!hasValidBoletoShape(canonicalLine)) throw new BoletoImportError('boleto_line_invalid');

  const existing = await findBoletoProposalByLine(canonicalLine);
  if (existing?.status === 'pending' || existing?.status === 'applied') {
    return {
      document: null,
      proposal: existing,
      resumed: true,
    };
  }

  const document = await createSyntheticDocument({
    name: 'boleto-linha-digitavel.xml',
    category: 'boleto',
    content: canonicalLine,
    mimeType: 'application/xml',
  });

  try {
    const { data, error } = await supabase.functions.invoke('document-extraction', {
      body: { document_version_id: document.currentVersionId, digitable_line: canonicalLine },
    });
    if (error) throw await extractFunctionError(error);
    if (!isRecord(data) || typeof data.job_id !== 'string' || data.status !== 'done') {
      throw new BoletoImportError('internal_error');
    }
    const proposal = await getBoletoImportProposalByJobId(data.job_id);
    if (!proposal) throw new BoletoImportError('internal_error');
    return { document, proposal, resumed: false };
  } catch (error) {
    if (error instanceof BoletoImportError) {
      if (error.code === 'duplicate_boleto') {
        const duplicate = await findBoletoProposalByLine(canonicalLine);
        if (duplicate?.status === 'pending' || duplicate?.status === 'applied') {
          return { document, proposal: duplicate, resumed: true };
        }
      }
      throw error;
    }
    throw await extractFunctionError(error);
  }
};

export const saveBoletoSupplier = async (
  proposalId: string,
  form: BoletoSupplierFormValues,
): Promise<BoletoImportProposal> => {
  const validated = validateBoletoSupplierForm(form);
  if (!validated.supplier) throw new BoletoImportError('validation_error');
  const proposal = await getBoletoProposalById(proposalId);
  if (!proposal || proposal.status !== 'pending') throw new BoletoImportError('document_not_found');

  const payload: BoletoProposalPayload = {
    ...proposal.payload,
    supplier: validated.supplier,
  };
  const companyId = requireCompanyId();
  const { data, error } = await supabase
    .from('document_import_proposals')
    .update({ payload })
    .eq('id', proposalId)
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .select(PROPOSAL_SELECT)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new BoletoImportError('document_not_found');
  return mapProposal(data as Record<string, unknown>);
};

export const applyBoletoPayableProposal = async (proposalId: string): Promise<BoletoImportProposal> => {
  const proposal = await getBoletoProposalById(proposalId);
  if (!proposal) throw new BoletoImportError('document_not_found');
  if (proposal.status === 'applied') return proposal;
  if (proposal.status !== 'pending') throw new BoletoImportError('apply_failed');

  const { data, error } = await supabase.rpc('apply_boleto_payable_proposal', {
    p_proposal_id: proposalId,
  });
  if (!error && data) return mapProposal(data as Record<string, unknown>);

  try {
    const after = await getBoletoProposalById(proposalId);
    if (after?.status === 'applied') return after;
  } catch {
    // Releitura não deve expor detalhes do banco nem iniciar retry automático.
  }
  throw new BoletoImportError('apply_failed');
};

export const isBoletoDocumentImportEligible = (document: Document): boolean =>
  document.category === 'boleto' && Boolean(document.currentVersionId);

export const findBoletoSupplierMatch = (document: string): Promise<SupplierMatchResult> =>
  findSupplierMatchByDocument(document);

export const getBoletoImportErrorMessage = (code: string | null | undefined): string =>
  PUBLIC_ERROR_MESSAGES[code as BoletoImportErrorCode] || PUBLIC_ERROR_MESSAGES.internal_error;

export const isBoletoSupplierResolved = (
  match: SupplierMatchResult | null,
  form: BoletoSupplierFormValues,
): boolean => {
  const validation = validateBoletoSupplierForm(form);
  return Boolean(validation.supplier && match && match.status !== 'invalid' && match.status !== 'conflict');
};
