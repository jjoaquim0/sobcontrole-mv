import { describe, expect, it, vi } from 'vitest';
import {
  createDocumentExtractionHandler,
  DocumentExtractionPersistenceError,
  type AuthorizedDocumentVersion,
  type DocumentExtractionDependencies,
} from '../../supabase/functions/_shared/document-import/handler.ts';

const COMPANY_ID = 'company-a';
const USER_ID = 'user-a';
const EMITTER = '12345678000195';
const RECIPIENT = '99888777000166';
const VERSION_ID = '11111111-1111-4111-8111-111111111111';
const JOB_ID = 'job-a';
const ORIGIN = 'https://app.sobcontrole.com';
const ACCESS_KEY_BASE = '352608' + EMITTER + '55001000000123112345678';

const checkDigit = (base: string): string => {
  let weight = 2;
  let sum = 0;
  for (let index = base.length - 1; index >= 0; index -= 1) {
    sum += Number(base[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const digit = 11 - (sum % 11);
  return String(digit === 10 || digit === 11 ? 0 : digit);
};

const ACCESS_KEY = ACCESS_KEY_BASE + checkDigit(ACCESS_KEY_BASE);

const VALID_XML =
  '<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe versao="4.00" Id="NFe' +
  ACCESS_KEY +
  '"><ide><mod>55</mod></ide><emit><CNPJ>' +
  EMITTER +
  '</CNPJ><xNome>Fornecedor Teste</xNome></emit><dest><CNPJ>' +
  RECIPIENT +
  '</CNPJ></dest><total><ICMSTot><vProd>10.00</vProd><vNF>10.00</vNF></ICMSTot></total></infNFe></NFe>';

const createDocument = (
  overrides: Partial<AuthorizedDocumentVersion> = {},
): AuthorizedDocumentVersion => ({
  userId: USER_ID,
  companyId: COMPANY_ID,
  companyCnpj: RECIPIENT,
  documentVersionId: VERSION_ID,
  documentId: 'document-a',
  category: 'nota_fiscal',
  mimeType: 'application/xml',
  storagePath: 'private/company-a/document-a.xml',
  readXml: vi.fn(async () => VALID_XML),
  ...overrides,
});

const createDeps = (
  overrides: Partial<DocumentExtractionDependencies> = {},
): { deps: DocumentExtractionDependencies; tasks: Promise<void>[] } => {
  const tasks: Promise<void>[] = [];
  const deps: DocumentExtractionDependencies = {
    allowedOrigins: [ORIGIN],
    authenticate: vi.fn(async () => ({ userId: USER_ID, accessToken: 'token-a' })),
    resolveDocument: vi.fn(async () => createDocument()),
    createJob: vi.fn(async () => ({ id: JOB_ID })),
    markJobRunning: vi.fn(async () => {}),
    createProposal: vi.fn(async () => {}),
    markJobDone: vi.fn(async () => {}),
    markJobFailed: vi.fn(async () => {}),
    waitUntil: vi.fn((task: Promise<void>) => tasks.push(task)),
    logger: vi.fn(),
    createRequestId: () => 'request-a',
    ...overrides,
  };
  return { deps, tasks };
};

const createRequest = (
  body: unknown,
  authorization = 'Bearer token-a',
  method = 'POST',
): Request => {
  const headers = new Headers({ Authorization: authorization, Origin: ORIGIN });
  return new Request('https://edge.local/document-extraction', {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
};

const runBackgroundTask = async (tasks: Promise<void>[]): Promise<void> => {
  expect(tasks).toHaveLength(1);
  await tasks[0];
};

describe('document-extraction handler security and persistence boundary', () => {
  it('rejects extra tenant and storage fields before authentication or insertion', async () => {
    const { deps, tasks } = createDeps();
    const response = await createDocumentExtractionHandler(deps)(
      createRequest({ document_version_id: VERSION_ID, company_id: 'company-b', storage_path: 'evil.xml' }),
    );

    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe('invalid_request');
    expect(deps.authenticate).not.toHaveBeenCalled();
    expect(deps.createJob).not.toHaveBeenCalled();
    expect(tasks).toHaveLength(0);
  });

  it.each([
    ['array body', []],
    ['empty body', {}],
    ['raw XML', { document_version_id: VERSION_ID, xml: VALID_XML }],
    ['category override', { document_version_id: VERSION_ID, category: 'nota_fiscal' }],
  ])('rejects %s as a non-exact request contract', async (_label, body) => {
    const { deps } = createDeps();
    const response = await createDocumentExtractionHandler(deps)(createRequest(body));

    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe('invalid_request');
    expect(deps.authenticate).not.toHaveBeenCalled();
    expect(deps.createJob).not.toHaveBeenCalled();
  });

  it('rejects missing or expired authentication without creating a job', async () => {
    const { deps } = createDeps({ authenticate: vi.fn(async () => null) });
    const response = await createDocumentExtractionHandler(deps)(
      createRequest({ document_version_id: VERSION_ID }, ''),
    );

    expect(response.status).toBe(401);
    expect(deps.resolveDocument).not.toHaveBeenCalled();
    expect(deps.createJob).not.toHaveBeenCalled();
  });

  it('returns the same not-found boundary for a cross-tenant document', async () => {
    const { deps, tasks } = createDeps({ resolveDocument: vi.fn(async () => null) });
    const response = await createDocumentExtractionHandler(deps)(
      createRequest({ document_version_id: VERSION_ID }),
    );

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe('document_not_found');
    expect(deps.createJob).not.toHaveBeenCalled();
    expect(deps.createProposal).not.toHaveBeenCalled();
    expect(tasks).toHaveLength(0);
  });

  it('accepts one authorized document, queues once, and persists only a pending header proposal', async () => {
    const { deps, tasks } = createDeps();
    const response = await createDocumentExtractionHandler(deps)(
      createRequest({ document_version_id: VERSION_ID }),
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ job_id: JOB_ID, status: 'queued' });
    expect(deps.createJob).toHaveBeenCalledWith({
      company_id: COMPANY_ID,
      document_version_id: VERSION_ID,
      document_category: 'nota_fiscal',
      requested_by: USER_ID,
      idempotency_key: null,
    });
    await runBackgroundTask(tasks);
    expect(deps.markJobRunning).toHaveBeenCalledWith(JOB_ID, COMPANY_ID);
    expect(deps.createProposal).toHaveBeenCalledOnce();
    expect(deps.createProposal).toHaveBeenCalledWith(expect.objectContaining({
      job_id: JOB_ID,
      company_id: COMPANY_ID,
      status: 'pending',
      idempotency_key: ACCESS_KEY,
      text_origin: null,
      truncated: false,
    }));
    expect(deps.markJobDone).toHaveBeenCalledWith(JOB_ID, COMPANY_ID);
    expect(deps.markJobFailed).not.toHaveBeenCalled();
    expect(JSON.stringify((deps.logger as ReturnType<typeof vi.fn>).mock.calls)).not.toContain(VALID_XML);
    expect(JSON.stringify((deps.logger as ReturnType<typeof vi.fn>).mock.calls)).not.toContain(RECIPIENT);
  });

  it('rejects a document with a category outside the pilot', async () => {
    const { deps } = createDeps({
      resolveDocument: vi.fn(async () => createDocument({ category: 'contrato' })),
    });
    const response = await createDocumentExtractionHandler(deps)(
      createRequest({ document_version_id: VERSION_ID }),
    );

    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe('document_category_invalid');
    expect(deps.createJob).not.toHaveBeenCalled();
  });

  it('rejects an unsupported MIME before scheduling work', async () => {
    const { deps } = createDeps({
      resolveDocument: vi.fn(async () => createDocument({ mimeType: 'application/pdf' })),
    });
    const response = await createDocumentExtractionHandler(deps)(
      createRequest({ document_version_id: VERSION_ID }),
    );

    expect(response.status).toBe(415);
    expect((await response.json()).error.code).toBe('document_mime_invalid');
    expect(deps.createJob).not.toHaveBeenCalled();
  });

  it('marks malformed XML as a safe parser failure without creating a proposal', async () => {
    const { deps, tasks } = createDeps({
      resolveDocument: vi.fn(async () => createDocument({ readXml: vi.fn(async () => '<NFe>') })),
    });
    const response = await createDocumentExtractionHandler(deps)(
      createRequest({ document_version_id: VERSION_ID }),
    );

    expect(response.status).toBe(202);
    await runBackgroundTask(tasks);
    expect(deps.createProposal).not.toHaveBeenCalled();
    expect(deps.markJobFailed).toHaveBeenCalledWith(JOB_ID, COMPANY_ID, 'nfe_xml_malformed');
    expect(deps.markJobDone).not.toHaveBeenCalled();
  });

  it('maps a unique-key conflict to duplicate_nfe and does not complete the job', async () => {
    const { deps, tasks } = createDeps({
      createProposal: vi.fn(async () => {
        throw new DocumentExtractionPersistenceError('23505');
      }),
    });
    const response = await createDocumentExtractionHandler(deps)(
      createRequest({ document_version_id: VERSION_ID }),
    );

    expect(response.status).toBe(202);
    await runBackgroundTask(tasks);
    expect(deps.markJobFailed).toHaveBeenCalledWith(JOB_ID, COMPANY_ID, 'duplicate_nfe');
    expect(deps.markJobDone).not.toHaveBeenCalled();
  });

  it('sanitizes unexpected read failures and never logs the source error', async () => {
    const secret = 'raw-xml-secret-' + RECIPIENT;
    const { deps, tasks } = createDeps({
      resolveDocument: vi.fn(async () => createDocument({
        readXml: vi.fn(async () => {
          throw new Error(secret);
        }),
      })),
    });
    const response = await createDocumentExtractionHandler(deps)(
      createRequest({ document_version_id: VERSION_ID }),
    );

    expect(response.status).toBe(202);
    await runBackgroundTask(tasks);
    expect(deps.markJobFailed).toHaveBeenCalledWith(JOB_ID, COMPANY_ID, 'internal_error');
    expect(JSON.stringify((deps.logger as ReturnType<typeof vi.fn>).mock.calls)).not.toContain(secret);
  });
});
