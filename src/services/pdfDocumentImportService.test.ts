import { beforeEach, describe, expect, it, vi } from 'vitest';

const COMPANY_ID = '11111111-1111-4111-8111-111111111111';
const VERSION_ID = '44444444-4444-4444-8444-444444444444';
const JOB_ID = '55555555-5555-4555-8555-555555555555';

const mocks = vi.hoisted(() => {
  class MockPdfTextExtractionError extends Error {
    code: string;

    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }

  return {
    functionsInvoke: vi.fn(),
    storageDownload: vi.fn(),
    extractPdfText: vi.fn(),
    MockPdfTextExtractionError,
  };
});

vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: { invoke: mocks.functionsInvoke },
    storage: { from: vi.fn(() => ({ download: mocks.storageDownload })) },
  },
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: { getState: () => ({ company: { id: COMPANY_ID } }) },
}));

vi.mock('./pdfTextExtractor', () => ({
  extractPdfText: mocks.extractPdfText,
  PdfTextExtractionError: mocks.MockPdfTextExtractionError,
}));

import { startPdfDocumentExtraction } from './documentImportService';

describe('entrada PDF do documentImportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('baixa o arquivo autorizado, extrai no cliente e envia somente o body PDF exato', async () => {
    const file = new Blob(['bytes do pdf']);
    mocks.storageDownload.mockResolvedValue({ data: file, error: null });
    mocks.extractPdfText.mockResolvedValue({ text: 'texto DANFE', pageCount: 1, nonWhitespaceCharacters: 11 });
    mocks.functionsInvoke.mockResolvedValue({ data: { job_id: JOB_ID, status: 'queued' }, error: null });

    await expect(startPdfDocumentExtraction(VERSION_ID, 'private/company/document.pdf')).resolves.toEqual({ jobId: JOB_ID, status: 'queued' });

    expect(mocks.storageDownload).toHaveBeenCalledWith('private/company/document.pdf');
    expect(mocks.extractPdfText).toHaveBeenCalledWith(file);
    expect(mocks.functionsInvoke).toHaveBeenCalledWith('document-extraction', {
      body: { document_version_id: VERSION_ID, extracted_text: 'texto DANFE' },
    });
    expect(JSON.stringify(mocks.functionsInvoke.mock.calls)).not.toContain('bytes do pdf');
  });

  it('não cria chamada de serviço nem proposta quando a leitura client-side falha', async () => {
    mocks.storageDownload.mockResolvedValue({ data: new Blob(['pdf']), error: null });
    mocks.extractPdfText.mockRejectedValue(new mocks.MockPdfTextExtractionError('pdf_scanned'));

    await expect(startPdfDocumentExtraction(VERSION_ID, 'private/company/scanned.pdf')).rejects.toMatchObject({ code: 'pdf_scanned' });
    expect(mocks.functionsInvoke).not.toHaveBeenCalled();
  });
});
