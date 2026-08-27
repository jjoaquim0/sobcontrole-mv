import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoletoImportError } from '../services/boletoImportService';

const FIXTURE_A = '00190000090001234000605678901231599260000025000';

const mocks = vi.hoisted(() => ({
  startBoletoDocumentExtraction: vi.fn(),
  findBoletoSupplierMatch: vi.fn(),
  saveBoletoSupplier: vi.fn(),
  applyBoletoPayableProposal: vi.fn(),
}));

vi.mock('../services/boletoImportService', async () => {
  const actual = await vi.importActual<typeof import('../services/boletoImportService')>('../services/boletoImportService');
  return {
    ...actual,
    startBoletoDocumentExtraction: mocks.startBoletoDocumentExtraction,
    findBoletoSupplierMatch: mocks.findBoletoSupplierMatch,
    saveBoletoSupplier: mocks.saveBoletoSupplier,
    applyBoletoPayableProposal: mocks.applyBoletoPayableProposal,
  };
});

import { useBoletoImport } from './useBoletoImport';
import type { BoletoImportProposal } from '../services/boletoImportService';

const pendingProposal: BoletoImportProposal = {
  id: 'proposal-1',
  jobId: 'job-1',
  companyId: 'company-1',
  documentCategory: 'boleto',
  idempotencyKey: FIXTURE_A,
  status: 'pending',
  payload: {
    supplier: { document: '12345678000190', name: 'Fornecedor' },
    payable: { amount: 250, due_date: '2024-12-10T00:00:00Z' },
  },
  fieldOrigins: { 'payable.amount': 'deterministic' },
  textOrigin: null,
  truncated: false,
  expiresAt: '2026-09-01T00:00:00Z',
  appliedAt: null,
  createdAt: '2026-08-27T12:00:00Z',
  updatedAt: '2026-08-27T12:00:00Z',
};

describe('useBoletoImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findBoletoSupplierMatch.mockResolvedValue({
      status: 'existing',
      normalizedDocument: '12345678000190',
      supplier: { id: 'supplier-1', name: 'Fornecedor', document: '12345678000190', status: 'active' },
    });
    mocks.saveBoletoSupplier.mockResolvedValue(pendingProposal);
    mocks.applyBoletoPayableProposal.mockResolvedValue({ ...pendingProposal, status: 'applied', appliedAt: '2026-08-27T12:01:00Z' });
  });

  it('carrega uma retomada pending, consulta fornecedor e aplica uma única confirmação', async () => {
    mocks.startBoletoDocumentExtraction.mockResolvedValue({ document: null, proposal: pendingProposal, resumed: true });
    const { result } = renderHook(() => useBoletoImport(true));

    await act(async () => {
      await result.current.start(FIXTURE_A);
    });
    expect(result.current.state).toBe('review');
    expect(result.current.isResumed).toBe(true);
    expect(mocks.findBoletoSupplierMatch).toHaveBeenCalledWith('12345678000190');

    await act(async () => {
      await result.current.confirm({ supplierDocument: '12345678000190', supplierName: 'Fornecedor' });
    });
    expect(result.current.state).toBe('success');
    expect(mocks.saveBoletoSupplier).toHaveBeenCalledTimes(1);
    expect(mocks.applyBoletoPayableProposal).toHaveBeenCalledTimes(1);
  });

  it('mostra applied como bloqueio e não tenta confirmação', async () => {
    mocks.startBoletoDocumentExtraction.mockResolvedValue({
      document: null,
      proposal: { ...pendingProposal, status: 'applied' },
      resumed: true,
    });
    const { result } = renderHook(() => useBoletoImport(true));

    await act(async () => {
      await result.current.start(FIXTURE_A);
    });
    expect(result.current.state).toBe('applied');
    expect(mocks.applyBoletoPayableProposal).not.toHaveBeenCalled();
  });

  it('converte erro de duplicata sem oferecer retry alternativo', async () => {
    mocks.startBoletoDocumentExtraction.mockRejectedValue(new BoletoImportError('duplicate_boleto'));
    const { result } = renderHook(() => useBoletoImport(true));

    await act(async () => {
      await result.current.start(FIXTURE_A);
    });
    expect(result.current.state).toBe('error');
    expect(result.current.error?.code).toBe('duplicate_boleto');
    expect(result.current.getErrorMessage('duplicate_boleto')).toContain('boleto');
  });

  it('limpa estado ao fechar o modal', async () => {
    mocks.startBoletoDocumentExtraction.mockResolvedValue({ document: null, proposal: pendingProposal, resumed: false });
    const { result, rerender } = renderHook(({ isOpen }) => useBoletoImport(isOpen), { initialProps: { isOpen: true } });

    await act(async () => {
      await result.current.start(FIXTURE_A);
    });
    rerender({ isOpen: false });
    await waitFor(() => expect(result.current.state).toBe('idle'));
    expect(result.current.proposal).toBeNull();
  });
});
