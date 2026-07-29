import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const storageUpload = vi.fn();
  const storageRemove = vi.fn();
  const storageCreateSignedUrl = vi.fn();
  const rpc = vi.fn();
  const documentSingle = vi.fn();
  const permissionsQuery: { select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>; then: (resolve: (value: unknown) => unknown) => Promise<unknown> } = {
    select: vi.fn(),
    eq: vi.fn(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
  };
  permissionsQuery.select.mockReturnValue(permissionsQuery);
  permissionsQuery.eq.mockReturnValue(permissionsQuery);
  const documentsQuery: { select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>; single: ReturnType<typeof vi.fn> } = { select: vi.fn(), eq: vi.fn(), single: documentSingle };
  documentsQuery.select.mockReturnValue(documentsQuery);
  documentsQuery.eq.mockReturnValue(documentsQuery);
  return { storageUpload, storageRemove, storageCreateSignedUrl, rpc, documentSingle, permissionsQuery, documentsQuery };
});

vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: { from: vi.fn(() => ({ upload: mocks.storageUpload, remove: mocks.storageRemove, createSignedUrl: mocks.storageCreateSignedUrl })) },
    rpc: mocks.rpc,
    from: vi.fn((table: string) => table === 'documents' ? mocks.documentsQuery : mocks.permissionsQuery),
  },
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      company: { id: '11111111-1111-4111-8111-111111111111', name: 'Empresa A' },
      profile: { id: '22222222-2222-4222-8222-222222222222', name: 'Usuário', role: 'admin', companyId: '11111111-1111-4111-8111-111111111111' },
    }),
  },
}));

import { getDocumentDownloadUrl, uploadDocument } from './documentService';

const dbDocument = {
  id: '33333333-3333-4333-8333-333333333333',
  company_id: '11111111-1111-4111-8111-111111111111',
  name: 'contrato.pdf',
  original_name: 'contrato.pdf',
  category: 'contrato',
  mime_type: 'application/pdf',
  size: 10,
  storage_path: '11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333/44444444-4444-4444-8444-444444444444/contrato.pdf',
  status: 'active',
  visibility: 'company',
  owner_id: '22222222-2222-4222-8222-222222222222',
  uploaded_by: '22222222-2222-4222-8222-222222222222',
  document_versions: [{ count: 1 }],
  created_at: '2026-07-19T12:00:00.000Z',
  updated_at: '2026-07-19T12:00:00.000Z',
};

describe('documentService — upload e URLs temporárias', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storageUpload.mockResolvedValue({ error: null });
    mocks.storageRemove.mockResolvedValue({ error: null });
    mocks.storageCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.example/document' }, error: null });
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.documentSingle.mockResolvedValue({ data: dbDocument, error: null });
  });

  it('envia um objeto novo sem upsert e registra o documento pela RPC atômica', async () => {
    const file = new File(['pdf'], 'contrato.pdf', { type: 'application/pdf' });
    await uploadDocument(file, { category: 'contrato', visibility: 'company' });

    expect(mocks.storageUpload).toHaveBeenCalledWith(expect.stringMatching(/^11111111-1111-4111-8111-111111111111\/[\w-]+\/[\w-]+\/contrato\.pdf$/), file, expect.objectContaining({ upsert: false, contentType: 'application/pdf' }));
    expect(mocks.rpc).toHaveBeenCalledWith('create_document_with_initial_version', expect.objectContaining({ p_category: 'contrato', p_visibility: 'company', p_created_by: '22222222-2222-4222-8222-222222222222' }));
  });

  it('não envia arquivo que falha na validação antes do Storage', async () => {
    const unsafeFile = new File(['x'], 'malware.exe', { type: 'application/pdf' });
    await expect(uploadDocument(unsafeFile, { category: 'outros', visibility: 'private' })).rejects.toThrow('extensão não suportada');
    expect(mocks.storageUpload).not.toHaveBeenCalled();
  });

  it('registra o download e entrega somente URL assinada de curta duração', async () => {
    const url = await getDocumentDownloadUrl({ id: dbDocument.id, storagePath: dbDocument.storage_path });
    expect(mocks.rpc).toHaveBeenCalledWith('record_document_download', { p_document_id: dbDocument.id });
    expect(mocks.storageCreateSignedUrl).toHaveBeenCalledWith(dbDocument.storage_path, 60);
    expect(url).toBe('https://signed.example/document');
  });
});
