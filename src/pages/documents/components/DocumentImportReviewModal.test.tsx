import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Document } from '../../../types';
import type { useDocumentImport } from '../../../hooks/useDocumentImport';
import type { NfeImportProposal } from '../../../services/documentImportService';

const flow = vi.hoisted(() => ({ current: null as ReturnType<typeof useDocumentImport> | null }));

vi.mock('../../../lib/supabase', () => ({ supabase: {} }));

vi.mock('../../../hooks/useDocumentImport', () => ({
  useDocumentImport: vi.fn(() => flow.current),
}));

import { DocumentImportReviewModal } from './DocumentImportReviewModal';

const document = {
  id: 'document-1',
  name: 'nota.xml',
  originalName: 'nota.xml',
  category: 'nota_fiscal',
  mimeType: 'application/xml',
  currentVersionId: 'version-1',
} as Document;

const pendingProposal: NfeImportProposal = {
  id: 'proposal-1',
  jobId: 'job-1',
  companyId: 'company-1',
  documentCategory: 'nota_fiscal' as const,
  status: 'pending' as const,
  payload: {
    supplier: { document: '12.345.678/0001-90', name: 'Fornecedor XML', email: 'fiscal@example.com' },
    purchase: {
      total_amount: 100,
      discount: 0,
      fee: 0,
      final_value: 100,
      payment_method: 'other' as const,
      notes: 'Observação original',
      installments: [{ amount: 100, due_date: '2026-09-01T00:00:00.000Z' }],
    },
  },
  fieldOrigins: {},
  textOrigin: 'server',
  truncated: false,
  expiresAt: '2026-08-25T00:00:00.000Z',
  appliedAt: null,
  createdAt: '2026-08-24T00:00:00.000Z',
  updatedAt: '2026-08-24T00:00:00.000Z',
};

const createFlow = (): ReturnType<typeof useDocumentImport> => ({
  eligible: true,
  state: 'review' as const,
  job: null,
  proposal: pendingProposal,
  supplierMatch: { status: 'new' as const, normalizedDocument: '12345678000190', supplier: null },
  isSupplierMatchLoading: false,
  error: null,
  isBusy: false,
  start: vi.fn(),
  retry: vi.fn(),
  refresh: vi.fn(),
  refreshSupplierMatch: vi.fn(),
  goToSummary: vi.fn(),
  backToReview: vi.fn(),
  confirm: vi.fn(),
});

describe('DocumentImportReviewModal', () => {
  beforeEach(() => {
    flow.current = createFlow();
  });

  it('apresenta somente o escopo de cabeçalho, compra e contas a pagar', () => {
    render(<DocumentImportReviewModal isOpen onClose={vi.fn()} document={document} />);

    expect(screen.getByRole('heading', { name: 'Revisar importação — Nota Fiscal' })).toBeInTheDocument();
    expect(screen.getByText('Proposta carregada para revisão.')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Este piloto importa somente fornecedor, compra e contas a pagar. Itens, produtos e estoque não serão importados.')).toBeInTheDocument();
    expect(screen.getByLabelText('CNPJ')).toHaveValue('12.345.678/0001-90');
    expect(screen.getByLabelText('Valor final')).toHaveValue('100.00');
    expect(screen.getByRole('button', { name: 'Ver resumo e confirmar' })).toBeEnabled();
    expect(screen.queryByText('Item 1')).not.toBeInTheDocument();
    expect(screen.queryByText('SKU')).not.toBeInTheDocument();
  });

  it('bloqueia confirmação quando há conflito de fornecedor e exibe aviso de estoque no sucesso', () => {
    const current = createFlow();
    current.supplierMatch = {
      status: 'conflict',
      normalizedDocument: '12345678000190',
      suppliers: [],
    };
    flow.current = current;
    const { rerender } = render(<DocumentImportReviewModal isOpen onClose={vi.fn()} document={document} />);

    expect(screen.getByText('Conflito: mais de um fornecedor possui este CNPJ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver resumo e confirmar' })).toBeDisabled();

    flow.current = { ...createFlow(), state: 'summary' as const };
    rerender(<DocumentImportReviewModal isOpen onClose={vi.fn()} document={document} />);
    expect(screen.getByText('Este piloto importa somente fornecedor, compra e contas a pagar. Itens, produtos e estoque não serão importados.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar e gravar' })).toBeInTheDocument();

    flow.current = { ...current, state: 'success' as const };
    rerender(<DocumentImportReviewModal isOpen onClose={vi.fn()} document={document} />);
    expect(screen.getByText('Os produtos não foram adicionados ao estoque — lance-os manualmente.')).toBeInTheDocument();
  });
});
