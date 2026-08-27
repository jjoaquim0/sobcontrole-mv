import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDocumentExtractionHandler,
  DocumentExtractionPersistenceError,
  type AuthorizedDocumentVersion,
  type DocumentExtractionDependencies,
} from '../../supabase/functions/_shared/document-import/handler.ts';

const COMPANY_ID = 'company-a';
const USER_ID = 'user-a';
const VERSION_ID = '11111111-1111-4111-8111-111111111111';
const JOB_ID = 'job-boleto';
const ORIGIN = 'https://app.sobcontrole.com';
const FIXTURE_A = '00190000090001234000605678901231599260000025000';

const createDocument = (overrides: Partial<AuthorizedDocumentVersion> = {}): AuthorizedDocumentVersion => ({
  userId: USER_ID,
  companyId: COMPANY_ID,
  companyCnpj: '12345678000195',
  documentVersionId: VERSION_ID,
  documentId: 'document-boleto',
  category: 'boleto',
  mimeType: 'application/xml',
  storagePath: 'private/company-a/boleto.xml',
  readXml: vi.fn(async () => FIXTURE_A),
  ...overrides,
});

const createDeps = (overrides: Partial<DocumentExtractionDependencies> = {}): DocumentExtractionDependencies => ({
  allowedOrigins: [ORIGIN],
  authenticate: vi.fn(async () => ({ userId: USER_ID, accessToken: 'token-a' })),
  resolveDocument: vi.fn(async () => createDocument()),
  createJob: vi.fn(async () => ({ id: JOB_ID })),
  markJobRunning: vi.fn(async () => {}),
  createProposal: vi.fn(async () => {}),
  markJobDone: vi.fn(async () => {}),
  markJobFailed: vi.fn(async () => {}),
  setDocumentSource: vi.fn(async () => {}),
  waitUntil: vi.fn(),
  logger: vi.fn(),
  createRequestId: () => 'request-boleto',
  ...overrides,
});

const createRequest = (body: unknown): Request => new Request(
  'https://edge.local/document-extraction',
  {
    method: 'POST',
    headers: { Authorization: 'Bearer token-a', Origin: ORIGIN },
    body: JSON.stringify(body),
  },
);

describe('document-extraction handler — boleto síncrono', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('valida no servidor, cria job done e proposta pending com contrato determinístico', async () => {
    const deps = createDeps();
    const response = await createDocumentExtractionHandler(deps)(createRequest({
      document_version_id: VERSION_ID,
      digitable_line: FIXTURE_A,
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ job_id: JOB_ID, status: 'done' });
    expect(deps.waitUntil).not.toHaveBeenCalled();
    expect(deps.setDocumentSource).toHaveBeenCalledWith('document-boleto', COMPANY_ID, 'digitable_line');
    expect(deps.createJob).toHaveBeenCalledWith({
      company_id: COMPANY_ID,
      document_version_id: VERSION_ID,
      document_category: 'boleto',
      requested_by: USER_ID,
      idempotency_key: FIXTURE_A,
    });
    expect(deps.createProposal).toHaveBeenCalledWith({
      job_id: JOB_ID,
      company_id: COMPANY_ID,
      document_category: 'boleto',
      status: 'pending',
      idempotency_key: FIXTURE_A,
      payload: {
        supplier: { document: '', name: '' },
        payable: { amount: 250, due_date: '2024-12-10T00:00:00Z' },
      },
      field_origins: {
        'supplier.document': 'manual',
        'supplier.name': 'manual',
        'payable.amount': 'deterministic',
        'payable.due_date': 'deterministic',
      },
      text_origin: null,
      truncated: false,
      items: [],
    });
    expect(deps.markJobRunning).toHaveBeenCalledWith(JOB_ID, COMPANY_ID);
    expect(deps.markJobDone).toHaveBeenCalledWith(JOB_ID, COMPANY_ID);
  });

  it('rejeita DV inválido antes de criar documento lógico, job ou proposta', async () => {
    const deps = createDeps();
    const invalidLine = '1' + FIXTURE_A.slice(1);
    const response = await createDocumentExtractionHandler(deps)(createRequest({
      document_version_id: VERSION_ID,
      digitable_line: invalidLine,
    }));

    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe('boleto_field_1_dv_invalid');
    expect(deps.setDocumentSource).not.toHaveBeenCalled();
    expect(deps.createJob).not.toHaveBeenCalled();
    expect(deps.createProposal).not.toHaveBeenCalled();
  });

  it('mantém o tratamento reativo de 23505 como duplicata legítima, sem concluir o job', async () => {
    const deps = createDeps({
      createProposal: vi.fn(async () => {
        throw new DocumentExtractionPersistenceError('23505');
      }),
    });
    const response = await createDocumentExtractionHandler(deps)(createRequest({
      document_version_id: VERSION_ID,
      digitable_line: FIXTURE_A,
    }));

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe('duplicate_boleto');
    expect(deps.markJobFailed).toHaveBeenCalledWith(JOB_ID, COMPANY_ID, 'duplicate_boleto');
    expect(deps.markJobDone).not.toHaveBeenCalled();
  });

  it('não aceita tenant, categoria ou campos extras no corpo da rota', async () => {
    const deps = createDeps();
    const response = await createDocumentExtractionHandler(deps)(createRequest({
      document_version_id: VERSION_ID,
      digitable_line: FIXTURE_A,
      company_id: 'company-b',
    }));

    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe('invalid_request');
    expect(deps.authenticate).not.toHaveBeenCalled();
    expect(deps.createJob).not.toHaveBeenCalled();
  });
});
