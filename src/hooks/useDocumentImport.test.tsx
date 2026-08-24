import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Document } from '../types';

const mocks = vi.hoisted(() => ({
  apply: vi.fn(),
  findLatest: vi.fn(),
  findSupplier: vi.fn(),
  getProposal: vi.fn(),
  save: vi.fn(),
  start: vi.fn(),
  isEligible: vi.fn(() => true),
}));

vi.mock('../services/documentImportService', () => ({
  applyNfePurchaseProposal: mocks.apply,
  findLatestNfeExtraction: mocks.findLatest,
  findSupplierMatchByDocument: mocks.findSupplier,
  getDocumentImportErrorMessage: vi.fn(() => 'Erro seguro.'),
  getNfeImportProposalByJobId: mocks.getProposal,
  isNfeDocumentImportEligible: mocks.isEligible,
  saveNfeProposalPayload: mocks.save,
  startNfeDocumentExtraction: mocks.start,
  DocumentImportError: class DocumentImportError extends Error {
    code: string;

    constructor(code: string, message = code) {
      super(message);
      this.code = code;
    }
  },
}));

import { useDocumentImport } from './useDocumentImport';

const document = {
  id: 'document-1',
  companyId: 'company-1',
  name: 'nota.xml',
  originalName: 'nota.xml',
  category: 'nota_fiscal',
  mimeType: 'application/xml',
  size: 100,
  storagePath: 'documents/nota.xml',
  status: 'active',
  visibility: 'company',
  versionCount: 1,
  currentVersionId: 'version-1',
  createdAt: '2026-08-24T00:00:00.000Z',
  updatedAt: '2026-08-24T00:00:00.000Z',
} as Document;

const job = (status: 'queued' | 'running' | 'failed' | 'done', error?: string) => ({
  id: 'job-1',
  companyId: 'company-1',
  documentVersionId: 'version-1',
  documentCategory: 'nota_fiscal' as const,
  status,
  error: error ?? null,
  createdAt: '2026-08-24T00:00:00.000Z',
  updatedAt: '2026-08-24T00:00:00.000Z',
});

const proposal = (status: 'pending' | 'applied' = 'pending') => ({
  id: 'proposal-1',
  jobId: 'job-1',
  companyId: 'company-1',
  documentCategory: 'nota_fiscal' as const,
  status,
  payload: {
    supplier: { document: '12345678000190', name: 'Fornecedor XML' },
    purchase: {
      total_amount: 100,
      discount: 0,
      fee: 0,
      final_value: 100,
      payment_method: 'other' as const,
      notes: '',
      installments: [{ amount: 100, due_date: '2026-09-01T00:00:00.000Z' }],
    },
  },
  fieldOrigins: {},
  textOrigin: 'xml',
  truncated: false,
  expiresAt: null,
  appliedAt: status === 'applied' ? '2026-08-24T00:01:00.000Z' : null,
  createdAt: '2026-08-24T00:00:00.000Z',
  updatedAt: '2026-08-24T00:00:00.000Z',
});

describe('useDocumentImport', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.isEligible.mockReturnValue(true);
    mocks.findSupplier.mockResolvedValue({ status: 'new', normalizedDocument: '12345678000190', supplier: null });
  });

  it('inicia uma única extração ao abrir e mantém o estado queued', async () => {
    mocks.findLatest.mockResolvedValue(null);
    mocks.start.mockResolvedValue({ jobId: 'job-1', status: 'queued' });

    const { result } = renderHook(() => useDocumentImport(document, true));

    await waitFor(() => expect(result.current.state).toBe('queued'));
    expect(mocks.start).toHaveBeenCalledTimes(1);
    expect(mocks.start).toHaveBeenCalledWith('version-1');
  });

  it('não repete automaticamente uma extração falha e permite retry explícito', async () => {
    mocks.findLatest.mockResolvedValue(job('failed', 'nfe_xml_invalid'));
    mocks.start.mockResolvedValue({ jobId: 'job-2', status: 'queued' });

    const { result } = renderHook(() => useDocumentImport(document, true));

    await waitFor(() => expect(result.current.state).toBe('failed'));
    expect(mocks.start).not.toHaveBeenCalled();

    await act(async () => result.current.retry());
    expect(mocks.start).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe('queued');
  });

  it('acompanha queued até done e abre a revisão da proposta', async () => {
    vi.useFakeTimers();
    try {
      mocks.findLatest.mockResolvedValueOnce(job('queued')).mockResolvedValueOnce(job('done'));
      mocks.getProposal.mockResolvedValue(proposal());

      const { result } = renderHook(() => useDocumentImport(document, true));
      await act(async () => { await Promise.resolve(); });
      expect(result.current.state).toBe('queued');
      await act(async () => { await vi.advanceTimersByTimeAsync(800); });

      expect(result.current.state).toBe('review');
      expect(mocks.getProposal).toHaveBeenCalledWith('job-1');
    } finally {
      vi.useRealTimers();
    }
  });

  it('acompanha queued até failed sem iniciar retry automático', async () => {
    vi.useFakeTimers();
    try {
      mocks.findLatest.mockResolvedValueOnce(job('queued')).mockResolvedValueOnce(job('failed', 'nfe_xml_invalid'));

      const { result } = renderHook(() => useDocumentImport(document, true));
      await act(async () => { await Promise.resolve(); });
      expect(result.current.state).toBe('queued');
      await act(async () => { await vi.advanceTimersByTimeAsync(800); });

      expect(result.current.state).toBe('failed');
      expect(mocks.start).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('carrega proposta pendente e confirma salvando antes de aplicar', async () => {
    const pending = proposal();
    const applied = proposal('applied');
    mocks.findLatest.mockResolvedValue(job('done'));
    mocks.getProposal.mockResolvedValue(pending);
    mocks.save.mockResolvedValue(pending);
    mocks.apply.mockResolvedValue(applied);

    const { result } = renderHook(() => useDocumentImport(document, true));

    await waitFor(() => expect(result.current.state).toBe('review'));
    expect(mocks.findSupplier).toHaveBeenCalledWith('12345678000190');

    await act(async () => result.current.confirm(pending.payload));
    expect(result.current.state).toBe('success');
    expect(mocks.save).toHaveBeenCalledWith('proposal-1', pending.payload);
    expect(mocks.apply).toHaveBeenCalledWith('proposal-1');
    expect(mocks.save.mock.invocationCallOrder[0]).toBeLessThan(mocks.apply.mock.invocationCallOrder[0]);
  });
});
