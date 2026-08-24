import { beforeEach, describe, expect, it, vi } from 'vitest';

const COMPANY_ID = '11111111-1111-4111-8111-111111111111';
const PROPOSAL_ID = '22222222-2222-4222-8222-222222222222';
const JOB_ID = '33333333-3333-4333-8333-333333333333';

const mocks = vi.hoisted(() => {
  const functionsInvoke = vi.fn();
  const rpc = vi.fn();
  const results = new Map<string, { data: unknown; error: unknown }>();
  const queries = new Map<string, Record<string, ReturnType<typeof vi.fn>>>();
  const makeQuery = (table: string) => {
    const query: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const method of ['select', 'eq', 'order', 'limit', 'update']) query[method] = vi.fn(() => query) as unknown as ReturnType<typeof vi.fn>;
    query.maybeSingle = vi.fn(() => Promise.resolve(results.get(table) || { data: null, error: null })) as unknown as ReturnType<typeof vi.fn>;
    query.then = vi.fn((resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(results.get(table) || { data: [], error: null }).then(resolve, reject)) as unknown as ReturnType<typeof vi.fn>;
    queries.set(table, query);
    return query;
  };
  const from = vi.fn((table: string) => queries.get(table) || makeQuery(table));
  return { functionsInvoke, rpc, results, queries, from };
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

import {
  applyNfePurchaseProposal,
  ATOMIC_APPLY_ERROR_MESSAGE,
  createNfeProposalForm,
  findSupplierMatchByDocument,
  getDocumentImportErrorMessage,
  isNfeDocumentImportEligible,
  moneyToCents,
  saveNfeProposalPayload,
  startNfeDocumentExtraction,
  validateNfeProposalForm,
} from './documentImportService';
import type { NfeHeaderProposalPayload } from './documentImportService';

const proposalRow = (overrides: Record<string, unknown> = {}) => ({
  id: PROPOSAL_ID,
  job_id: JOB_ID,
  company_id: COMPANY_ID,
  document_category: 'nota_fiscal',
  status: 'pending',
  payload: {
    supplier: { document: '12345678000190', name: 'Fornecedor XML', email: 'xml@example.com', phone: '11999999999' },
    purchase: {
      total_amount: 10.01,
      discount: 0,
      fee: 0,
      final_value: 10.01,
      payment_method: 'other',
      notes: 'observação fiscal',
      installments: [{ amount: 10.01, due_date: '2026-09-01T00:00:00Z' }],
    },
  },
  field_origins: { 'supplier.document': 'deterministic' },
  text_origin: null,
  truncated: false,
  expires_at: '2026-09-08T00:00:00Z',
  applied_at: null,
  created_at: '2026-08-24T12:00:00Z',
  updated_at: '2026-08-24T12:00:00Z',
  ...overrides,
});

describe('documentImportService — contratos de extração e validação', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.results.clear();
    mocks.queries.clear();
  });

  it('invoca a extração uma única vez com o body exato e sem tenant controlável', async () => {
    mocks.functionsInvoke.mockResolvedValue({ data: { job_id: JOB_ID, status: 'queued' }, error: null });

    await expect(startNfeDocumentExtraction('44444444-4444-4444-8444-444444444444')).resolves.toEqual({ jobId: JOB_ID, status: 'queued' });

    expect(mocks.functionsInvoke).toHaveBeenCalledTimes(1);
    expect(mocks.functionsInvoke).toHaveBeenCalledWith('document-extraction', {
      body: { document_version_id: '44444444-4444-4444-8444-444444444444' },
    });
  });

  it('valida CNPJ, dinheiro e parcelas em centavos sem arredondamento implícito', () => {
    expect(moneyToCents(1.005)).toBeNull();
    const form = createNfeProposalForm({
      supplier: { document: '12.345.678/0001-90', name: 'Fornecedor' },
      purchase: { total_amount: 10.01, discount: 0, fee: 0, final_value: 10.01, payment_method: 'other', notes: '', installments: [] },
    });
    form.installments = [{ amount: '3,33', dueDate: '2026-09-01' }, { amount: '6.68', dueDate: '2026-09-30' }];
    const result = validateNfeProposalForm(form);
    expect(result.errors).toEqual({});
    expect(result.payload?.purchase.installments).toEqual([
      { amount: 3.33, due_date: '2026-09-01T00:00:00Z' },
      { amount: 6.68, due_date: '2026-09-30T00:00:00Z' },
    ]);
  });

  it('rejeita valores negativos, CNPJ/nome ausentes, data inválida, parcela zero e soma divergente', () => {
    const result = validateNfeProposalForm({
      supplierDocument: '', supplierName: ' ', totalAmount: '-1', discount: '-2', fee: '-3', finalValue: '10.00',
      installments: [{ amount: '0', dueDate: '2026-02-30' }],
    });
    expect(Object.keys(result.errors)).toEqual(expect.arrayContaining([
      'supplierDocument', 'supplierName', 'totalAmount', 'discount', 'fee', 'installments[0].amount', 'installments[0].dueDate', 'installments',
    ]));
  });

  it('mantém parcelas vazias quando o XML não trouxe duplicatas, mas não permite confirmação', () => {
    const form = createNfeProposalForm({
      supplier: { document: '12345678000190', name: 'Fornecedor' },
      purchase: { total_amount: 10, discount: 0, fee: 0, final_value: 10, payment_method: 'other', notes: '', installments: [] },
    });
    expect(form.installments).toEqual([]);
    expect(validateNfeProposalForm(form).errors.installments).toBe('Informe pelo menos uma parcela.');
  });

  it('consulta fornecedores somente no tenant e distingue um cadastro formatado', async () => {
    mocks.results.set('suppliers', {
      data: [{ id: 'supplier-1', company_id: COMPANY_ID, name: 'Fornecedor Cadastrado', document: '12.345.678/0001-90', status: 'active' }],
      error: null,
    });

    await expect(findSupplierMatchByDocument('12345678000190')).resolves.toEqual({
      status: 'existing',
      normalizedDocument: '12345678000190',
      supplier: { id: 'supplier-1', name: 'Fornecedor Cadastrado', document: '12.345.678/0001-90', status: 'active' },
    });
    const query = mocks.queries.get('suppliers');
    expect(query?.select).toHaveBeenCalledWith('id, company_id, name, document, status');
    expect(query?.eq).toHaveBeenCalledWith('company_id', COMPANY_ID);
  });

  it('trata proposta estrangeira como inexistente e não chama a RPC', async () => {
    mocks.results.set('document_import_proposals', { data: null, error: null });

    await expect(applyNfePurchaseProposal(PROPOSAL_ID)).rejects.toMatchObject({ code: 'document_not_found' });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.queries.get('document_import_proposals')?.eq).toHaveBeenCalledWith('company_id', COMPANY_ID);
  });

  it('salva somente o payload permitido com tenant, status pending e preserva opcionais', async () => {
    mocks.results.set('document_import_proposals', { data: proposalRow(), error: null });
    const payload = proposalRow().payload as NfeHeaderProposalPayload;
    await saveNfeProposalPayload(PROPOSAL_ID, payload);

    const query = mocks.queries.get('document_import_proposals');
    expect(query?.update).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ supplier: expect.objectContaining({ email: 'xml@example.com' }), purchase: expect.objectContaining({ notes: 'observação fiscal', payment_method: 'other' }) }) }));
    expect(query?.eq).toHaveBeenCalledWith('id', PROPOSAL_ID);
    expect(query?.eq).toHaveBeenCalledWith('company_id', COMPANY_ID);
    expect(query?.eq).toHaveBeenCalledWith('status', 'pending');
    expect((query?.update.mock.calls[0][0] as { payload: Record<string, unknown> }).payload).not.toHaveProperty('items');
  });

  it('não salva proposta sem parcela e não consulta nem escreve itens', async () => {
    const payload = proposalRow().payload as NfeHeaderProposalPayload;
    payload.purchase.installments = [];

    await expect(saveNfeProposalPayload(PROPOSAL_ID, payload)).rejects.toMatchObject({ code: 'validation_error' });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('faz preflight sob RLS e chama a RPC exatamente uma vez por confirmação', async () => {
    mocks.results.set('document_import_proposals', { data: proposalRow(), error: null });
    mocks.rpc.mockResolvedValue({ data: proposalRow({ status: 'applied', applied_at: '2026-08-24T12:01:00Z' }), error: null });

    const result = await applyNfePurchaseProposal(PROPOSAL_ID);

    expect(result.status).toBe('applied');
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith('apply_nfe_purchase_proposal', { p_proposal_id: PROPOSAL_ID });
  });

  it('não chama RPC novamente quando a proposta já está aplicada', async () => {
    mocks.results.set('document_import_proposals', { data: proposalRow({ status: 'applied', applied_at: '2026-08-24T12:01:00Z' }), error: null });

    await expect(applyNfePurchaseProposal(PROPOSAL_ID)).resolves.toMatchObject({ status: 'applied' });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('traduz falha de aplicação para mensagem atômica sem expor erro bruto', async () => {
    mocks.results.set('document_import_proposals', { data: proposalRow(), error: null });
    mocks.rpc.mockResolvedValue({ data: null, error: new Error('SQL internal detail') });

    await expect(applyNfePurchaseProposal(PROPOSAL_ID)).rejects.toMatchObject({ code: 'apply_failed', message: ATOMIC_APPLY_ERROR_MESSAGE });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it('mantém mensagens públicas para rejeições do parser e restringe a ação a XML de NF-e', () => {
    expect(getDocumentImportErrorMessage('nfe_saida_nao_suportada')).toContain('saída');
    expect(getDocumentImportErrorMessage('nfe_cnpj_suspeito')).toContain('CNPJs');
    expect(getDocumentImportErrorMessage('nfe_xml_malformed')).toContain('validado');
    expect(getDocumentImportErrorMessage('nfe_access_key_invalid')).toContain('chave');
    expect(getDocumentImportErrorMessage('duplicate_nfe')).toContain('já possui');
    expect(getDocumentImportErrorMessage('unknown_raw_sql')).toBe('Não foi possível processar o documento.');

    const base = { category: 'nota_fiscal' as const, currentVersionId: 'version-1' };
    expect(isNfeDocumentImportEligible({ ...base, mimeType: 'application/xml' } as never)).toBe(true);
    expect(isNfeDocumentImportEligible({ ...base, mimeType: 'application/pdf' } as never)).toBe(false);
    expect(isNfeDocumentImportEligible({ ...base, mimeType: 'image/png' } as never)).toBe(false);
  });
});
