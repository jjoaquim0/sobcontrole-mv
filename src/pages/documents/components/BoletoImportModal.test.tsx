import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { useBoletoImport } from '../../../hooks/useBoletoImport';
import type { BoletoImportProposal } from '../../../services/boletoImportService';

const FIXTURE_A = '00190000090001234000605678901231599260000025000';

const flow = vi.hoisted(() => ({ current: null as ReturnType<typeof useBoletoImport> | null }));

vi.mock('../../../hooks/useBoletoImport', () => ({
  useBoletoImport: vi.fn(() => flow.current),
}));

import { BoletoImportModal } from './BoletoImportModal';

const pendingProposal: BoletoImportProposal = {
  id: 'proposal-1',
  jobId: 'job-1',
  companyId: 'company-1',
  documentCategory: 'boleto',
  idempotencyKey: FIXTURE_A,
  status: 'pending',
  payload: {
    supplier: { document: '', name: '' },
    payable: { amount: 250, due_date: '2024-12-10T00:00:00Z' },
  },
  fieldOrigins: {
    'supplier.document': 'manual',
    'supplier.name': 'manual',
    'payable.amount': 'deterministic',
    'payable.due_date': 'deterministic',
  },
  textOrigin: null,
  truncated: false,
  expiresAt: '2026-09-01T00:00:00Z',
  appliedAt: null,
  createdAt: '2026-08-27T12:00:00Z',
  updatedAt: '2026-08-27T12:00:00Z',
};

const createFlow = (overrides: Partial<ReturnType<typeof useBoletoImport>> = {}): ReturnType<typeof useBoletoImport> => ({
  state: 'idle',
  proposal: null,
  supplierMatch: null,
  isSupplierMatchLoading: false,
  error: null,
  isResumed: false,
  isBusy: false,
  start: vi.fn(async () => undefined),
  reset: vi.fn(),
  refreshSupplierMatch: vi.fn(async () => undefined),
  saveSupplier: vi.fn(async () => pendingProposal),
  goToSummary: vi.fn(),
  backToReview: vi.fn(),
  confirm: vi.fn(async () => undefined),
  getErrorMessage: vi.fn((code: string | null | undefined) => code || 'Erro'),
  ...overrides,
});

const renderModal = (onClose = vi.fn()) => render(
  <MemoryRouter>
    <BoletoImportModal isOpen onClose={onClose} />
  </MemoryRouter>,
);

describe('BoletoImportModal', () => {
  beforeEach(() => {
    flow.current = createFlow();
  });

  it('aceita somente 47 dígitos normalizados e envia a linha canônica ao fluxo', () => {
    renderModal();

    const input = screen.getByLabelText('Linha digitável');
    expect(screen.getByRole('button', { name: 'Validar boleto' })).toBeDisabled();
    fireEvent.change(input, { target: { value: '00190.00009 00012.340006 05678.901231 5 99260000025000' } });
    expect(screen.getByText('47/47 dígitos após a normalização.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Validar boleto' }));
    expect(flow.current?.start).toHaveBeenCalledWith(FIXTURE_A);
  });

  it('mostra valor e vencimento estáticos, selo textual e descrição acessível, bloqueando Gravar sem fornecedor', () => {
    flow.current = createFlow({
      state: 'review',
      proposal: pendingProposal,
      supplierMatch: { status: 'new', normalizedDocument: '12345678000190', supplier: null },
    });
    renderModal();

    expect(screen.getByText('Verificado pela linha digitável')).toBeInTheDocument();
    expect(screen.getByText(FIXTURE_A)).toBeInTheDocument();
    const amount = screen.getByText('R$ 250,00');
    const dueDate = screen.getByText('10/12/2024');
    expect(amount.closest('dd')).toHaveAttribute('aria-describedby', 'boleto-derived-fields-description');
    expect(dueDate.closest('dd')).toHaveAttribute('aria-describedby', 'boleto-derived-fields-description');
    expect(screen.getByText('Valor e vencimento são calculados a partir dos dígitos validados e não podem ser editados nesta tela.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Valor')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Vencimento')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver resumo e gravar' })).toBeDisabled();
  });

  it('autosalva somente fornecedor e habilita o resumo após dados mínimos válidos', async () => {
    const saveSupplier = vi.fn(async () => pendingProposal);
    const goToSummary = vi.fn();
    flow.current = createFlow({
      state: 'review',
      proposal: pendingProposal,
      supplierMatch: { status: 'new', normalizedDocument: '12345678000190', supplier: null },
      saveSupplier,
      goToSummary,
    });
    renderModal();

    fireEvent.change(screen.getByLabelText('CNPJ'), { target: { value: '12.345.678/0001-90' } });
    fireEvent.change(screen.getByLabelText('Nome do fornecedor'), { target: { value: 'Fornecedor do boleto' } });
    fireEvent.blur(screen.getByLabelText('Nome do fornecedor'));
    await waitFor(() => expect(saveSupplier).toHaveBeenCalledWith({
      supplierDocument: '12.345.678/0001-90',
      supplierName: 'Fornecedor do boleto',
    }));
    expect(screen.getByRole('button', { name: 'Ver resumo e gravar' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Ver resumo e gravar' }));
    expect(goToSummary).toHaveBeenCalledOnce();
  });

  it('trata applied como bloqueio definitivo sem bypass e oferece a conta a pagar', () => {
    flow.current = createFlow({
      state: 'applied',
      proposal: { ...pendingProposal, status: 'applied', appliedAt: '2026-08-27T12:01:00Z' },
      isResumed: true,
    });
    renderModal();

    expect(screen.getAllByText('Este boleto já foi aplicado e não pode ser enviado novamente.')).not.toHaveLength(0);
    expect(screen.queryByText(/Enviar mesmo assim|chave alternativa/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver conta a pagar' })).toHaveAttribute('href', '/financial');
    expect(document.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it('fecha com Escape e devolve o foco ao título do diálogo', async () => {
    const onClose = vi.fn();
    renderModal(onClose);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Importar boleto por linha digitável' })).toHaveFocus());
  });
});
