import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DealModal } from './DealModal';
import type { Deal, PipelineStage } from '../../../types';

vi.mock('../../../hooks/useCustomers', () => ({
  useCustomers: () => ({ customers: [{ id: 'cust-1', fullName: 'Cliente Teste' }] }),
}));

vi.mock('../../../hooks/useSettings', () => ({
  useSettings: () => ({ teamMembers: [{ id: 'user-1', name: 'Vendedor Teste' }] }),
}));

vi.mock('../../../hooks/usePipeline', () => ({
  useDealHistory: () => ({ history: [], isLoading: false }),
}));

vi.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (state: { profile: { id: string } }) => unknown) =>
    selector({ profile: { id: 'user-1' } }),
}));

const stages: PipelineStage[] = [
  { id: 'stage-1', companyId: 'company-1', name: 'Novo Lead', color: '#10b981', position: 0, isActive: true, createdAt: '', updatedAt: '' },
  { id: 'stage-2', companyId: 'company-1', name: 'Proposta Enviada', color: '#3b82f6', position: 1, isActive: true, createdAt: '', updatedAt: '' },
];

const baseDeal: Deal = {
  id: 'deal-1',
  companyId: 'company-1',
  title: 'Negócio Teste',
  customerId: 'cust-1',
  ownerId: 'user-1',
  stageId: 'stage-1',
  value: 1000,
  status: 'open',
  position: 0,
  notes: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const noop = () => Promise.resolve();

describe('DealModal — ação de excluir', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('não exibe a ação de excluir ao criar um novo negócio (sem deal)', () => {
    render(
      <DealModal isOpen onClose={vi.fn()} stages={stages} onSave={vi.fn()} onMarkWon={noop} onMarkLost={noop} onDelete={vi.fn()} />
    );
    expect(screen.queryByRole('button', { name: /Excluir oportunidade/ })).not.toBeInTheDocument();
  });

  it('não exibe a ação de excluir quando onDelete não é fornecido', () => {
    render(
      <DealModal isOpen onClose={vi.fn()} deal={baseDeal} stages={stages} onSave={vi.fn()} onMarkWon={noop} onMarkLost={noop} />
    );
    expect(screen.queryByRole('button', { name: /Excluir oportunidade/ })).not.toBeInTheDocument();
  });

  it('exibe a ação de excluir em modo edição e aciona onDelete ao clicar', async () => {
    const onDelete = vi.fn();
    render(
      <DealModal
        isOpen
        onClose={vi.fn()}
        deal={baseDeal}
        stages={stages}
        onSave={vi.fn()}
        onMarkWon={noop}
        onMarkLost={noop}
        onDelete={onDelete}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Excluir oportunidade' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
  });

  it('desabilita a ação de excluir enquanto isDeleting está ativo', () => {
    render(
      <DealModal
        isOpen
        onClose={vi.fn()}
        deal={baseDeal}
        stages={stages}
        onSave={vi.fn()}
        onMarkWon={noop}
        onMarkLost={noop}
        onDelete={vi.fn()}
        isDeleting
      />
    );
    expect(screen.getByRole('button', { name: /Excluir oportunidade/ })).toBeDisabled();
  });
});

describe('DealModal — troca de etapa', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('envia o stageId real selecionado no payload ao salvar', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <DealModal
        isOpen
        onClose={vi.fn()}
        deal={baseDeal}
        stages={stages}
        onSave={onSave}
        onMarkWon={noop}
        onMarkLost={noop}
      />
    );

    const stageSelect = screen.getByDisplayValue('Novo Lead');
    fireEvent.change(stageSelect, { target: { value: 'stage-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ stageId: 'stage-2' }))
    );
  });

  it('mantém o stageId original quando o usuário não altera a etapa', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <DealModal
        isOpen
        onClose={vi.fn()}
        deal={baseDeal}
        stages={stages}
        onSave={onSave}
        onMarkWon={noop}
        onMarkLost={noop}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ stageId: 'stage-1' }))
    );
  });
});
