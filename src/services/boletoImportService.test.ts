import { beforeEach, describe, expect, it, vi } from 'vitest';

const COMPANY_ID = '11111111-1111-4111-8111-111111111111';
const PROPOSAL_ID = '22222222-2222-4222-8222-222222222222';
const JOB_ID = '33333333-3333-4333-8333-333333333333';
const FIXTURE_A = '00190000090001234000605678901231599260000025000';

const mocks = vi.hoisted(() => {
  const functionsInvoke = vi.fn();
  const rpc = vi.fn();
  const results = new Map<string, { data: unknown; error: unknown }>();
  const resultQueues = new Map<string, Array<{ data: unknown; error: unknown }>>();
  const queries = new Map<string, Record<string, ReturnType<typeof vi.fn>>>();
  const makeQuery = (table: string) => {
    const query: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const method of ['select', 'eq', 'order', 'limit', 'update']) {
      query[method] = vi.fn(() => query) as unknown as ReturnType<typeof vi.fn>;
    }
    query.maybeSingle = vi.fn(() => {
      const queued = resultQueues.get(table);
      if (queued && queued.length > 0) return Promise.resolve(queued.shift());
      return Promise.resolve(results.get(table) || { data: null, error: null });
    }) as unknown as ReturnType<typeof vi.fn>;
    queries.set(table, query);
    return query;
  };
  const from = vi.fn((table: string) => queries.get(table) || makeQuery(table));
  const createSyntheticDocument = vi.fn();
  const findSupplierMatchByDocument = vi.fn();
  return { functionsInvoke, rpc, results, resultQueues, queries, from, createSyntheticDocument, findSupplierMatchByDocument };
});

vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: { invoke: mocks.functionsInvoke },
    rpc: mocks.rpc,
    from: mocks.from,
  },
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: {
    getState: () => ({ company: { id: COMPANY_ID } }),
  },
}));

vi.mock('./documentService', () => ({
  createSyntheticDocument: mocks.createSyntheticDocument,
}));

vi.mock('./documentImportService', () => ({
  findSupplierMatchByDocument: mocks.findSupplierMatchByDocument,
}));

import {
  applyBoletoPayableProposal,
  findBoletoProposalByLine,
  getBoletoImportErrorMessage,
  saveBoletoSupplier,
  startBoletoDocumentExtraction,
} from './boletoImportService';

const proposalRow = (overrides: Record<string, unknown> = {}) => ({
  id: PROPOSAL_ID,
  job_id: JOB_ID,
  company_id: COMPANY_ID,
  document_category: 'boleto',
  idempotency_key: FIXTURE_A,
  status: 'pending',
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
  expires_at: '2026-09-01T00:00:00Z',
  applied_at: null,
  created_at: '2026-08-26T12:00:00Z',
  updated_at: '2026-08-26T12:00:00Z',
  ...overrides,
});

describe('boletoImportService — fluxo de proposta e aplicação', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.results.clear();
    mocks.resultQueues.clear();
    mocks.queries.clear();
    mocks.createSyntheticDocument.mockResolvedValue({
      id: 'document-1',
      companyId: COMPANY_ID,
      category: 'boleto',
      currentVersionId: 'version-1',
    });
    mocks.functionsInvoke.mockResolvedValue({ data: { job_id: JOB_ID, status: 'done' }, error: null });
  });

  it('normaliza a linha uma vez, cria documento sintético e envia somente o contrato da rota', async () => {
    mocks.results.set('document_import_proposals', { data: null, error: null });
    mocks.resultQueues.set('document_import_proposals', [
      { data: null, error: null },
      { data: proposalRow(), error: null },
    ]);

    const result = await startBoletoDocumentExtraction('00190.00009 00012.340006 05678.901231 5 99260000025000');

    expect(result.resumed).toBe(false);
    expect(mocks.createSyntheticDocument).toHaveBeenCalledWith({
      name: 'boleto-linha-digitavel.xml',
      category: 'boleto',
      content: FIXTURE_A,
      mimeType: 'application/xml',
    });
    expect(mocks.functionsInvoke).toHaveBeenCalledTimes(1);
    expect(mocks.functionsInvoke).toHaveBeenCalledWith('document-extraction', {
      body: { document_version_id: 'version-1', digitable_line: FIXTURE_A },
    });
  });

  it('não corrige caracteres heurísticos nem cria documento para linha inválida', async () => {
    await expect(startBoletoDocumentExtraction(FIXTURE_A.slice(0, 46) + 'O')).rejects.toMatchObject({ code: 'boleto_line_invalid' });
    expect(mocks.createSyntheticDocument).not.toHaveBeenCalled();
    expect(mocks.functionsInvoke).not.toHaveBeenCalled();
  });

  it.each(['pending', 'applied'] as const)('retoma %s sem criar segundo documento ou proposta', async (status) => {
    mocks.results.set('document_import_proposals', { data: proposalRow({ status }), error: null });

    const result = await startBoletoDocumentExtraction(FIXTURE_A);

    expect(result).toMatchObject({ resumed: true, proposal: { status } });
    expect(mocks.createSyntheticDocument).not.toHaveBeenCalled();
    expect(mocks.functionsInvoke).not.toHaveBeenCalled();
  });

  it('deixa rejected e expired seguirem nova tentativa após a regra de unicidade parcial', async () => {
    mocks.results.set('document_import_proposals', { data: proposalRow({ status: 'rejected' }), error: null });

    const result = await startBoletoDocumentExtraction(FIXTURE_A);

    expect(result.resumed).toBe(false);
    expect(mocks.createSyntheticDocument).toHaveBeenCalledOnce();
    expect(mocks.functionsInvoke).toHaveBeenCalledOnce();
  });

  it('salva somente fornecedor no payload, com tenant e pending, preservando o valor protegido', async () => {
    mocks.results.set('document_import_proposals', { data: proposalRow(), error: null });

    await saveBoletoSupplier(PROPOSAL_ID, {
      supplierDocument: '12.345.678/0001-90',
      supplierName: 'Fornecedor do boleto',
    });

    const query = mocks.queries.get('document_import_proposals');
    expect(query?.update).toHaveBeenCalledWith({
      payload: expect.objectContaining({
        supplier: { document: '12345678000190', name: 'Fornecedor do boleto' },
        payable: { amount: 250, due_date: '2024-12-10T00:00:00Z' },
      }),
    });
    expect(query?.eq).toHaveBeenCalledWith('id', PROPOSAL_ID);
    expect(query?.eq).toHaveBeenCalledWith('company_id', COMPANY_ID);
    expect(query?.eq).toHaveBeenCalledWith('status', 'pending');
  });

  it('chama a RPC de boleto exatamente uma vez e não chama novamente para applied', async () => {
    mocks.results.set('document_import_proposals', { data: proposalRow(), error: null });
    mocks.rpc.mockResolvedValue({ data: proposalRow({ status: 'applied', applied_at: '2026-08-26T12:01:00Z' }), error: null });

    await expect(applyBoletoPayableProposal(PROPOSAL_ID)).resolves.toMatchObject({ status: 'applied' });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith('apply_boleto_payable_proposal', { p_proposal_id: PROPOSAL_ID });

    vi.clearAllMocks();
    mocks.results.set('document_import_proposals', { data: proposalRow({ status: 'applied' }), error: null });
    await expect(applyBoletoPayableProposal(PROPOSAL_ID)).resolves.toMatchObject({ status: 'applied' });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('converte falha de aplicação em erro seguro e não oferece bypass', async () => {
    mocks.results.set('document_import_proposals', { data: proposalRow(), error: null });
    mocks.rpc.mockResolvedValue({ data: null, error: new Error('SQL internal detail') });

    await expect(applyBoletoPayableProposal(PROPOSAL_ID)).rejects.toMatchObject({ code: 'apply_failed' });
    expect(getBoletoImportErrorMessage('duplicate_boleto')).not.toMatch(/Enviar mesmo assim|chave alternativa|operaÃ§Ã£o serÃ¡ realizada/i);
    expect(getBoletoImportErrorMessage('duplicate_boleto')).toContain('boleto');
  });

  it('isola a busca por linha em empresa e categoria', async () => {
    mocks.results.set('document_import_proposals', { data: proposalRow(), error: null });
    await findBoletoProposalByLine(FIXTURE_A);
    const query = mocks.queries.get('document_import_proposals');
    expect(query?.eq).toHaveBeenCalledWith('company_id', COMPANY_ID);
    expect(query?.eq).toHaveBeenCalledWith('document_category', 'boleto');
    expect(query?.eq).toHaveBeenCalledWith('idempotency_key', FIXTURE_A);
  });
});
