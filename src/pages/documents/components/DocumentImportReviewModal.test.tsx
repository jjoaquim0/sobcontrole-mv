import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Document } from '../../../types';
import type { useDocumentImport } from '../../../hooks/useDocumentImport';
import { DocumentImportError } from '../../../services/documentImportService';
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

const pdfDocument = { ...document, name: 'danfe.pdf', originalName: 'danfe.pdf', mimeType: 'application/pdf' } as Document;

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
  items: [],
  itemCount: 0,
  saveItem: vi.fn(),
  searchProducts: vi.fn(async () => []),
  loadCategories: vi.fn(() => new Promise<never[]>(() => undefined)),
  createCategory: vi.fn(),
});

describe('DocumentImportReviewModal', () => {
  beforeEach(() => {
    flow.current = createFlow();
  });

  it('apresenta o escopo completo e mantém a revisão sem itens identificados', () => {
    render(<DocumentImportReviewModal isOpen onClose={vi.fn()} document={document} />);

    expect(screen.getByRole('heading', { name: 'Revisar importação — Nota Fiscal' })).toBeInTheDocument();
    expect(screen.getByText('Proposta carregada para revisão.')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Não foi possível identificar itens nesta nota. Revise o restante dos dados — produtos podem ser lançados manualmente depois.')).toBeInTheDocument();
    expect(screen.getByLabelText('CNPJ')).toHaveValue('12.345.678/0001-90');
    expect(screen.getByLabelText('Valor final')).toHaveValue('100.00');
    expect(screen.getByRole('button', { name: 'Ver resumo e confirmar' })).toBeEnabled();
    expect(screen.queryByText('Este piloto importa somente fornecedor, compra e contas a pagar. Itens, produtos e estoque não serão importados.')).not.toBeInTheDocument();
  });

  it('bloqueia confirmação quando há conflito e mostra resultado de aplicação', () => {
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
    expect(screen.getByText('Não foi possível identificar itens nesta nota. Eles poderão ser lançados manualmente depois.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar e gravar' })).toBeInTheDocument();

    flow.current = { ...current, state: 'success' as const };
    rerender(<DocumentImportReviewModal isOpen onClose={vi.fn()} document={document} />);
    expect(screen.getByText('Fornecedor, compra, itens, produtos e estoque foram aplicados pela confirmação.')).toBeInTheDocument();
  });

  it('mantém o cabeçalho confirmável acima do corte e mostra somente o aviso condicional de volume', () => {
    flow.current = { ...createFlow(), itemCount: 61 };
    render(<DocumentImportReviewModal isOpen onClose={vi.fn()} document={document} />);

    expect(screen.getByText('Esta nota tem 61 itens — acima dos 60 que revisamos automaticamente aqui. Fornecedor e contas a pagar foram lançados; os produtos não foram adicionados ao estoque — lance-os manualmente.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Este piloto importa somente fornecedor, compra e contas a pagar. Itens, produtos e estoque não serão importados.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver resumo e confirmar' })).toBeEnabled();
  });

  it('keeps the normal review flow at the limit of 60 items', () => {
    flow.current = { ...createFlow(), itemCount: 60 };
    render(<DocumentImportReviewModal isOpen onClose={vi.fn()} document={document} />);

    expect(screen.queryByText('Esta nota tem 60 itens — acima dos 60 que revisamos automaticamente aqui. Fornecedor e contas a pagar foram lançados; os produtos não foram adicionados ao estoque — lance-os manualmente.')).not.toBeInTheDocument();
    expect(screen.getByText('Não foi possível identificar itens nesta nota. Revise o restante dos dados — produtos podem ser lançados manualmente depois.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver resumo e confirmar' })).toBeEnabled();
  });

  it('mostra aviso de origem, rastreabilidade e escopo header-only no PDF', () => {
    flow.current = {
      ...createFlow(),
      proposal: {
        ...pendingProposal,
        textOrigin: 'client',
        fieldSources: {
          'supplier.name': 'RAZÃO SOCIAL: Fornecedor DANFE',
          'purchase.final_value': 'VALOR TOTAL DA NOTA: 100,00',
        },
      },
    };
    render(<DocumentImportReviewModal isOpen onClose={vi.fn()} document={pdfDocument} />);

    expect(screen.getByText('Este texto foi extraído no seu navegador. O servidor não consegue reconferi-lo contra o PDF original; revise os campos antes de confirmar.')).toBeInTheDocument();
    expect(screen.getByText('Este piloto importa somente fornecedor, compra e contas a pagar. Itens, produtos e estoque não serão importados.')).toBeInTheDocument();
    expect(screen.getByText('Ver trecho original: supplier.name')).toBeInTheDocument();
    expect(screen.getByText('RAZÃO SOCIAL: Fornecedor DANFE')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('mantém “Salvar só o arquivo” no erro de PDF escaneado e não exibe revisão parcial', () => {
    const onClose = vi.fn();
    flow.current = {
      ...createFlow(),
      proposal: null,
      state: 'failed' as const,
      error: new DocumentImportError('pdf_scanned'),
    };
    render(<DocumentImportReviewModal isOpen onClose={onClose} document={pdfDocument} />);

    expect(screen.getByText('Não conseguimos ler o texto deste arquivo. Ele parece ser uma imagem escaneada, e no momento não lemos PDFs escaneados.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar só o arquivo' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Ver resumo e confirmar' })).not.toBeInTheDocument();
  });

  it('não promete itens no resumo ou sucesso do PDF', () => {
    flow.current = { ...createFlow(), proposal: { ...pendingProposal, textOrigin: 'client' }, state: 'summary' as const };
    const { rerender } = render(<DocumentImportReviewModal isOpen onClose={vi.fn()} document={pdfDocument} />);

    expect(screen.getByRole('heading', { name: 'Confirmar importação do PDF' })).toBeInTheDocument();
    expect(screen.getByText('Não importados neste piloto')).toBeInTheDocument();
    expect(screen.queryByText('Fornecedor, compra, itens, produtos e estoque foram aplicados pela confirmação.')).not.toBeInTheDocument();

    flow.current = { ...createFlow(), proposal: { ...pendingProposal, textOrigin: 'client' }, state: 'success' as const };
    rerender(<DocumentImportReviewModal isOpen onClose={vi.fn()} document={pdfDocument} />);
    expect(screen.getByText(/Fornecedor, compra e contas a pagar foram aplicados\./)).toBeInTheDocument();
    expect(screen.getByText(/Itens, produtos e estoque não serão importados\./)).toBeInTheDocument();
  });
});
