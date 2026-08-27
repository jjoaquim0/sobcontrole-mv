import {
  extractNfeHeader,
  NfeParserError,
  type NfeHeaderProposalInput,
  type NfeParserErrorCode,
} from './nfe.ts';
import {
  BoletoParserError,
  extractBoletoProposal,
  type BoletoParserErrorCode,
  type BoletoProposalInput,
} from './boleto.ts';

export interface DocumentExtractionIdentity {
  userId: string;
  accessToken: string;
}

export interface AuthorizedDocumentVersion {
  userId: string;
  companyId: string;
  companyCnpj: string;
  documentVersionId: string;
  documentId: string;
  category: string;
  mimeType: string;
  storagePath: string;
  readXml: () => Promise<string | Uint8Array>;
}

export interface DocumentExtractionJobInput {
  company_id: string;
  document_version_id: string;
  document_category: 'nota_fiscal' | 'boleto';
  requested_by: string;
  idempotency_key: string | null;
}

export type DocumentExtractionProposalInput = DocumentExtractionProposalInputNfe | (Omit<
  DocumentExtractionProposalInputNfe,
  'document_category' | 'payload' | 'field_origins' | 'items'
> & {
  document_category: 'boleto';
  payload: BoletoProposalInput['payload'];
  field_origins: BoletoProposalInput['field_origins'];
  items: [];
});

type DocumentExtractionProposalInputNfe = {
  job_id: string;
  company_id: string;
  document_category: 'nota_fiscal';
  status: 'pending';
  idempotency_key: string;
  payload: NfeHeaderProposalInput['payload'];
  field_origins: NfeHeaderProposalInput['field_origins'];
  items: NfeHeaderProposalInput['items'];
  text_origin: null;
  truncated: false;
};

export interface DocumentExtractionJobReference {
  id: string;
}

export class DocumentExtractionPersistenceError extends Error {
  readonly databaseCode: string | undefined;

  constructor(databaseCode?: string) {
    super('document extraction persistence failed');
    this.name = 'DocumentExtractionPersistenceError';
    this.databaseCode = databaseCode;
  }
}

export interface DocumentExtractionDependencies {
  allowedOrigins: string[];
  authenticate: (authorization: string) => Promise<DocumentExtractionIdentity | null>;
  resolveDocument: (
    identity: DocumentExtractionIdentity,
    documentVersionId: string,
  ) => Promise<AuthorizedDocumentVersion | null>;
  createJob: (input: DocumentExtractionJobInput) => Promise<DocumentExtractionJobReference>;
  markJobRunning: (jobId: string, companyId: string) => Promise<void>;
  createProposal: (input: DocumentExtractionProposalInput) => Promise<void>;
  markJobDone: (jobId: string, companyId: string) => Promise<void>;
  markJobFailed: (jobId: string, companyId: string, code: string) => Promise<void>;
  setDocumentSource?: (documentId: string, companyId: string, source: 'digitable_line') => Promise<void>;
  waitUntil: (task: Promise<void>) => void;
  logger: (event: Record<string, unknown>) => void;
  createRequestId?: () => string;
}

type HandlerErrorCode =
  | 'invalid_request'
  | 'method_not_allowed'
  | 'origin_not_allowed'
  | 'unauthorized'
  | 'document_not_found'
  | 'document_category_invalid'
  | 'document_mime_invalid'
  | 'duplicate_nfe'
  | 'duplicate_boleto'
  | 'internal_error'
  | NfeParserErrorCode
  | BoletoParserErrorCode;

const PUBLIC_MESSAGES: Record<HandlerErrorCode, string> = {
  invalid_request: 'Corpo de requisicao invalido.',
  method_not_allowed: 'Metodo nao suportado.',
  origin_not_allowed: 'Origem nao autorizada.',
  unauthorized: 'Sessao invalida ou expirada.',
  document_not_found: 'Documento nao encontrado.',
  document_category_invalid: 'O documento autorizado nao e uma nota fiscal ou boleto.',
  document_mime_invalid: 'O documento autorizado nao possui um formato suportado.',
  duplicate_nfe: 'Esta NF-e ja possui uma proposta para esta empresa.',
  duplicate_boleto: 'Este boleto ja possui uma importacao ativa ou ja foi importado.',
  internal_error: 'Nao foi possivel processar o documento.',
  nfe_xml_empty: 'O XML da NF-e esta vazio.',
  nfe_xml_too_large: 'O XML da NF-e excede o limite permitido.',
  nfe_xml_unsafe: 'O XML da NF-e contem uma declaracao nao permitida.',
  nfe_xml_malformed: 'O XML da NF-e esta malformado.',
  nfe_structure_invalid: 'A estrutura da NF-e nao e suportada.',
  nfe_ambiguous: 'O XML contem mais de uma NF-e valida.',
  nfe_version_invalid: 'A versao da NF-e nao e suportada.',
  nfe_model_invalid: 'O modelo da NF-e nao e 55.',
  nfe_required_field_missing: 'A NF-e nao possui todos os campos obrigatorios.',
  nfe_access_key_invalid: 'A chave de acesso da NF-e e invalida.',
  nfe_access_key_company_mismatch: 'A chave de acesso nao corresponde ao emitente.',
  nfe_money_invalid: 'A NF-e possui valor monetario invalido.',
  nfe_item_invalid: 'A NF-e possui item com quantidade, custo ou unidade invalida.',
  nfe_installment_invalid: 'A NF-e possui parcela ou vencimento invalido.',
  nfe_saida_nao_suportada: 'NF-e de saida nao e suportada nesta rota.',
  nfe_cnpj_suspeito: 'Os CNPJs da NF-e nao correspondem a uma entrada segura.',
  company_cnpj_missing: 'O CNPJ da empresa nao esta configurado corretamente.',
  boleto_line_empty: 'Informe a linha digitavel do boleto.',
  boleto_line_length_invalid: 'A linha digitavel deve conter exatamente 47 digitos.',
  boleto_field_1_dv_invalid: 'O primeiro campo da linha digitavel e invalido.',
  boleto_field_2_dv_invalid: 'O segundo campo da linha digitavel e invalido.',
  boleto_field_3_dv_invalid: 'O terceiro campo da linha digitavel e invalido.',
  boleto_currency_invalid: 'A linha digitavel nao corresponde a um boleto bancario em reais.',
  boleto_general_dv_invalid: 'O codigo de barras do boleto e invalido.',
  boleto_due_date_ambiguous: 'Nao foi possivel confirmar o vencimento da linha digitavel.',
};

const corsHeaders = (origin: string): Record<string, string> => ({
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': origin,
  'Content-Type': 'application/json',
  Vary: 'Origin',
});

const isOriginAllowed = (origin: string | null, allowedOrigins: string[]): boolean =>
  allowedOrigins.includes('*') || (origin !== null && allowedOrigins.includes(origin));

const errorResponse = (code: HandlerErrorCode, origin: string): Response =>
  new Response(JSON.stringify({ error: { code, message: PUBLIC_MESSAGES[code] } }), {
    status:
      code === 'unauthorized'
        ? 401
        : code === 'method_not_allowed'
          ? 405
          : code === 'origin_not_allowed'
            ? 403
            : code === 'document_not_found'
              ? 404
              : code === 'document_mime_invalid'
                ? 415
                : code === 'duplicate_nfe' || code === 'duplicate_boleto'
                  ? 409
                : code === 'internal_error'
                  ? 500
                  : 422,
    headers: corsHeaders(origin),
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface DocumentExtractionRequest {
  documentVersionId: string;
  digitableLine?: string;
}

const readExtractionRequest = async (
  request: Request,
): Promise<DocumentExtractionRequest | null> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }

  if (!isRecord(body)) return null;
  const documentVersionId = body.document_version_id;
  if (typeof documentVersionId !== 'string' || !UUID_PATTERN.test(documentVersionId)) return null;

  const hasDigitableLine = Object.prototype.hasOwnProperty.call(body, 'digitable_line');
  if (!hasDigitableLine) {
    return Object.keys(body).length === 1 ? { documentVersionId } : null;
  }

  return Object.keys(body).length === 2 && typeof body.digitable_line === 'string'
    ? { documentVersionId, digitableLine: body.digitable_line }
    : null;
};

const errorCodeFromFailure = (error: unknown, category: 'nota_fiscal' | 'boleto'): HandlerErrorCode => {
  if (error instanceof NfeParserError) return error.code;
  if (error instanceof BoletoParserError) return error.code;
  if (
    error instanceof DocumentExtractionPersistenceError &&
    error.databaseCode === '23505'
  ) {
    return category === 'boleto' ? 'duplicate_boleto' : 'duplicate_nfe';
  }
  return 'internal_error';
};

const xmlText = async (source: string | Uint8Array): Promise<string> => {
  if (typeof source === 'string') return source;
  return new TextDecoder().decode(source);
};

type DocumentProcessInput =
  | { category: 'nota_fiscal' }
  | { category: 'boleto'; proposal: BoletoProposalInput };

const processDocument = async (
  deps: DocumentExtractionDependencies,
  document: AuthorizedDocumentVersion,
  jobId: string,
  input: DocumentProcessInput,
): Promise<HandlerErrorCode | null> => {
  let failureCode: HandlerErrorCode = 'internal_error';

  try {
    await deps.markJobRunning(jobId, document.companyId);
    failureCode = 'internal_error';

    if (input.category === 'boleto') {
      await deps.createProposal({
        job_id: jobId,
        company_id: document.companyId,
        document_category: input.proposal.document_category,
        status: input.proposal.status,
        idempotency_key: input.proposal.idempotency_key,
        payload: input.proposal.payload,
        field_origins: input.proposal.field_origins,
        text_origin: input.proposal.text_origin,
        truncated: input.proposal.truncated,
        items: [],
      });
    } else {
      const proposal = extractNfeHeader(await xmlText(await document.readXml()), document.companyCnpj);
      await deps.createProposal({
        job_id: jobId,
        company_id: document.companyId,
        document_category: proposal.document_category,
        status: proposal.status,
        idempotency_key: proposal.idempotency_key,
        payload: proposal.payload,
        field_origins: proposal.field_origins,
        text_origin: proposal.text_origin,
        truncated: proposal.truncated,
      // Acima do corte a proposta mantém apenas o cabeçalho. O item_count no
      // payload permite à revisão exibir o aviso sem criar/aplicar domínio.
        items: proposal.items.length <= 60 ? proposal.items : [],
      });
    }
    await deps.markJobDone(jobId, document.companyId);
    return null;
  } catch (error) {
    failureCode = errorCodeFromFailure(error, input.category);
    try {
      await deps.markJobFailed(jobId, document.companyId, failureCode);
    } catch {
      deps.logger({
        event: 'document_extraction_failure_persist_failed',
        job_id: jobId,
      });
    }
    deps.logger({
      event: 'document_extraction_failed',
      job_id: jobId,
      code: failureCode,
    });
    return failureCode;
  }
};

export const createDocumentExtractionHandler = (
  deps: DocumentExtractionDependencies,
): ((request: Request) => Promise<Response>) => {
  const requestId = deps.createRequestId ?? (() => crypto.randomUUID());

  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('Origin') ?? '*';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== 'POST') {
      return errorResponse('method_not_allowed', origin);
    }
    if (!isOriginAllowed(request.headers.get('Origin'), deps.allowedOrigins)) {
      return errorResponse('origin_not_allowed', origin);
    }

    const extractionRequest = await readExtractionRequest(request);
    if (!extractionRequest) return errorResponse('invalid_request', origin);

    let identity: DocumentExtractionIdentity | null;
    try {
      identity = await deps.authenticate(request.headers.get('Authorization') ?? '');
    } catch {
      identity = null;
    }
    if (!identity) return errorResponse('unauthorized', origin);

    let document: AuthorizedDocumentVersion | null;
    try {
      document = await deps.resolveDocument(identity, extractionRequest.documentVersionId);
    } catch {
      document = null;
    }
    if (!document) return errorResponse('document_not_found', origin);
    if (document.category !== 'nota_fiscal' && document.category !== 'boleto') {
      return errorResponse('document_category_invalid', origin);
    }
    if (document.category === 'nota_fiscal' && extractionRequest.digitableLine !== undefined) {
      return errorResponse('invalid_request', origin);
    }
    if (document.category === 'boleto' && extractionRequest.digitableLine === undefined) {
      return errorResponse('invalid_request', origin);
    }
    if (!['text/xml', 'application/xml'].includes(document.mimeType)) {
      return errorResponse('document_mime_invalid', origin);
    }

    if (document.category === 'boleto' && extractionRequest.digitableLine !== undefined) {
      try {
        const validatedProposal = extractBoletoProposal(extractionRequest.digitableLine);
        if (deps.setDocumentSource) {
          await deps.setDocumentSource(document.documentId, document.companyId, 'digitable_line');
        }
        const id = requestId();
        const job = await deps.createJob({
          company_id: document.companyId,
          document_version_id: extractionRequest.documentVersionId,
          document_category: 'boleto',
          requested_by: identity.userId,
          idempotency_key: validatedProposal.idempotency_key,
        });
        const failureCode = await processDocument(deps, document, job.id, {
          category: 'boleto',
          proposal: validatedProposal,
        });
        if (failureCode) return errorResponse(failureCode, origin);
        deps.logger({
          event: 'document_extraction_completed',
          job_id: job.id,
          request_id: id,
          document_category: 'boleto',
        });
        return new Response(JSON.stringify({ job_id: job.id, status: 'done' }), {
          status: 200,
          headers: corsHeaders(origin),
        });
      } catch (error) {
        const code = errorCodeFromFailure(error, 'boleto');
        deps.logger({ event: 'document_extraction_boleto_start_failed', code });
        return errorResponse(code, origin);
      }
    }

    const id = requestId();
    let job: DocumentExtractionJobReference;
    try {
      job = await deps.createJob({
        company_id: document.companyId,
        document_version_id: extractionRequest.documentVersionId,
        document_category: 'nota_fiscal',
        requested_by: identity.userId,
        idempotency_key: null,
      });
    } catch {
      deps.logger({ event: 'document_extraction_job_create_failed' });
      return errorResponse('internal_error', origin);
    }

    deps.waitUntil(processDocument(deps, document, job.id, { category: 'nota_fiscal' }).then(() => undefined));
    deps.logger({
      event: 'document_extraction_queued',
      job_id: job.id,
      request_id: id,
    });
    return new Response(JSON.stringify({ job_id: job.id, status: 'queued' }), {
      status: 202,
      headers: corsHeaders(origin),
    });
  };
};
