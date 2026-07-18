import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PipelinePage } from './PipelinePage';
import type { Deal, PipelineStage } from '../../types';

const mocks = vi.hoisted(() => ({
  deals: [] as Deal[],
  stages: [] as PipelineStage[],
  createDeal: vi.fn(),
  updateDeal: vi.fn(),
  moveDeal: vi.fn(),
  closeDeal: vi.fn(),
  deleteDeal: vi.fn(),
  isDeleting: false,
}));

vi.mock('../../hooks/usePipeline', () => ({
  usePipelineStages: () => ({ stages: mocks.stages, isLoading: false, isError: false, refetch: vi.fn() }),
  useDeals: () => ({ deals: mocks.deals, isLoading: false, isError: false, refetch: vi.fn() }),
  useDealHistory: () => ({ history: [], isLoading: false }),
  useDealMutations: () => ({
    createDeal: mocks.createDeal,
    isCreating: false,
    updateDeal: mocks.updateDeal,
    isUpdating: false,
    moveDeal: mocks.moveDeal,
    closeDeal: mocks.closeDeal,
    isClosing: false,
    deleteDeal: mocks.deleteDeal,
    isDeleting: mocks.isDeleting,
  }),
}));

vi.mock('../../hooks/useSettings', () => ({
  useSettings: () => ({ teamMembers: [{ id: 'user-1', name: 'Vendedor Teste' }] }),
}));

vi.mock('../../hooks/useCustomers', () => ({
  useCustomers: () => ({ customers: [{ id: 'cust-1', fullName: 'Cliente Alpha' }] }),
}));

vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector: (state: { profile: { id: string } }) => unknown) =>
    selector({ profile: { id: 'user-1' } }),
}));

vi.mock('../../services/dealsService', () => ({
  isDealOverdue: () => false,
}));

const stages: PipelineStage[] = [
  { id: 'stage-1', companyId: 'company-1', name: 'Novo Lead', color: '#10b981', position: 0, isActive: true, createdAt: '', updatedAt: '' },
  { id: 'stage-2', companyId: 'company-1', name: 'Proposta Enviada', color: '#3b82f6', position: 1, isActive: true, createdAt: '', updatedAt: '' },
];

const dealAlpha: Deal = {
  id: 'deal-1',
  companyId: 'company-1',
  title: 'Negócio Alpha',
  customerId: 'cust-1',
  ownerId: 'user-1',
  ownerName: 'Vendedor Teste',
  stageId: 'stage-1',
  value: 5000,
  status: 'open',
  position: 0,
  notes: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const renderPage = () => render(<MemoryRouter><PipelinePage /></MemoryRouter>);

const openDealDetail = async () => {
  fireEvent.click(screen.getByText('Negócio Alpha'));
  return screen.findByRole('button', { name: 'Salvar Alterações' });
};

describe('PipelinePage — exclusão de oportunidade', () => {
  beforeEach(() => {
    mocks.deals = [dealAlpha];
    mocks.stages = stages;
    mocks.isDeleting = false;
    mocks.createDeal.mockReset();
    mocks.updateDeal.mockReset().mockResolvedValue(undefined);
    mocks.moveDeal.mockReset().mockResolvedValue(undefined);
    mocks.closeDeal.mockReset();
    mocks.deleteDeal.mockReset().mockResolvedValue(undefined);
  });

  it('pede confirmação mostrando o nome da oportunidade antes de excluir', async () => {
    renderPage();
    await openDealDetail();

    fireEvent.click(screen.getByRole('button', { name: 'Excluir oportunidade' }));

    const dialog = await screen.findByRole('dialog', { name: 'Excluir oportunidade' });
    expect(within(dialog).getByText(/Negócio Alpha/)).toBeInTheDocument();
    // O modal de detalhes fecha ao abrir a confirmação - não fica duplicado atrás dela
    expect(screen.queryByRole('button', { name: 'Salvar Alterações' })).not.toBeInTheDocument();
  });

  it('ao confirmar, chama deleteDeal com o id correto', async () => {
    renderPage();
    await openDealDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Excluir oportunidade' }));

    const dialog = await screen.findByRole('dialog', { name: 'Excluir oportunidade' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir oportunidade' }));

    await waitFor(() => expect(mocks.deleteDeal).toHaveBeenCalledWith('deal-1'));
  });

  it('cancelar a confirmação não chama deleteDeal e fecha o diálogo', async () => {
    renderPage();
    await openDealDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Excluir oportunidade' }));

    const dialog = await screen.findByRole('dialog', { name: 'Excluir oportunidade' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mocks.deleteDeal).not.toHaveBeenCalled();
  });

  it('mantém o diálogo de confirmação disponível para nova tentativa quando a exclusão falha', async () => {
    mocks.deleteDeal.mockRejectedValue(new Error('Falha de rede'));
    renderPage();
    await openDealDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Excluir oportunidade' }));

    const dialog = await screen.findByRole('dialog', { name: 'Excluir oportunidade' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir oportunidade' }));

    await waitFor(() => expect(mocks.deleteDeal).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('dialog', { name: 'Excluir oportunidade' })).toBeInTheDocument();
  });
});

describe('PipelinePage — movimentação automática de etapa', () => {
  beforeEach(() => {
    mocks.deals = [dealAlpha];
    mocks.stages = stages;
    mocks.isDeleting = false;
    mocks.createDeal.mockReset();
    mocks.updateDeal.mockReset().mockResolvedValue(undefined);
    mocks.moveDeal.mockReset().mockResolvedValue(undefined);
    mocks.closeDeal.mockReset();
    mocks.deleteDeal.mockReset();
  });

  it('ao trocar a etapa e salvar, chama updateDeal (sem stageId) e moveDeal com o novo stageId', async () => {
    renderPage();
    await openDealDetail();

    const stageSelect = screen.getByDisplayValue('Novo Lead');
    fireEvent.change(stageSelect, { target: { value: 'stage-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }));

    await waitFor(() => expect(mocks.updateDeal).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'deal-1', data: expect.objectContaining({ title: 'Negócio Alpha' }) })
    ));
    expect(mocks.updateDeal.mock.calls[0][0].data).not.toHaveProperty('stageId');

    await waitFor(() => expect(mocks.moveDeal).toHaveBeenCalledWith({ id: 'deal-1', toStageId: 'stage-2', position: 0 }));
  });

  it('não chama moveDeal quando a etapa não muda', async () => {
    renderPage();
    await openDealDetail();

    fireEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }));

    await waitFor(() => expect(mocks.updateDeal).toHaveBeenCalledTimes(1));
    expect(mocks.moveDeal).not.toHaveBeenCalled();
  });

  it('fecha o modal de detalhes somente após updateDeal e moveDeal resolverem com sucesso', async () => {
    renderPage();
    await openDealDetail();

    const stageSelect = screen.getByDisplayValue('Novo Lead');
    fireEvent.change(stageSelect, { target: { value: 'stage-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }));

    await waitFor(() => expect(mocks.moveDeal).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Salvar Alterações' })).not.toBeInTheDocument());
  });

  it('mantém o modal de detalhes aberto quando a movimentação de etapa falha', async () => {
    mocks.moveDeal.mockRejectedValue(new Error('Erro ao mover'));
    renderPage();
    await openDealDetail();

    const stageSelect = screen.getByDisplayValue('Novo Lead');
    fireEvent.change(stageSelect, { target: { value: 'stage-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }));

    await waitFor(() => expect(mocks.moveDeal).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Salvar Alterações' })).toBeInTheDocument();
  });
});
