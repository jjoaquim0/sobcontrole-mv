import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StageManagerDrawer } from './StageManagerDrawer';
import type { PipelineStage } from '../../../types';

const mocks = vi.hoisted(() => ({
  activeStages: [] as PipelineStage[],
  archivedStages: [] as PipelineStage[],
  dealCounts: {} as Record<string, number>,
  isStagesLoading: false,
  isStagesError: false,
  createStage: vi.fn(),
  updateStage: vi.fn(),
  archiveStage: vi.fn(),
  restoreStage: vi.fn(),
}));

vi.mock('../../../hooks/usePipeline', () => ({
  usePipelineStages: () => ({
    stages: mocks.activeStages,
    isLoading: mocks.isStagesLoading,
    isError: mocks.isStagesError,
    refetch: vi.fn(),
  }),
  useArchivedPipelineStages: (enabled: boolean) => ({
    stages: enabled ? mocks.archivedStages : [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  usePipelineStageMutations: () => ({
    createStage: mocks.createStage,
    isCreatingStage: false,
    updateStage: mocks.updateStage,
    isUpdatingStage: false,
    archiveStage: mocks.archiveStage,
    isArchivingStage: false,
    restoreStage: mocks.restoreStage,
    isRestoringStage: false,
  }),
  useOpenDealCountsByStage: () => ({ counts: mocks.dealCounts, isLoading: false }),
}));

const activeStages: PipelineStage[] = [
  { id: 'stage-1', companyId: 'company-1', name: 'Novo Contato', color: '#10b981', position: 0, isActive: true, createdAt: '', updatedAt: '' },
  { id: 'stage-2', companyId: 'company-1', name: 'Proposta Enviada', color: '#3b82f6', position: 1, isActive: true, createdAt: '', updatedAt: '' },
];

const archivedStage: PipelineStage = {
  id: 'stage-9', companyId: 'company-1', name: 'Descontinuada', color: '#6b7280', position: 5, isActive: false, createdAt: '', updatedAt: '',
};

describe('StageManagerDrawer', () => {
  beforeEach(() => {
    mocks.activeStages = activeStages;
    mocks.archivedStages = [archivedStage];
    mocks.dealCounts = {};
    mocks.isStagesLoading = false;
    mocks.isStagesError = false;
    mocks.createStage.mockReset().mockResolvedValue(undefined);
    mocks.updateStage.mockReset().mockResolvedValue(undefined);
    mocks.archiveStage.mockReset().mockResolvedValue(undefined);
    mocks.restoreStage.mockReset().mockResolvedValue(undefined);
  });

  it('exibe título e subtítulo do drawer (AC1)', () => {
    render(<StageManagerDrawer isOpen onClose={vi.fn()} canManage />);
    expect(screen.getByText('Gerenciar Etapas do Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Etapas ativas aparecem como colunas no kanban')).toBeInTheDocument();
  });

  it('lista as etapas ativas', () => {
    render(<StageManagerDrawer isOpen onClose={vi.fn()} canManage />);
    expect(screen.getByText('Novo Contato')).toBeInTheDocument();
    expect(screen.getByText('Proposta Enviada')).toBeInTheDocument();
  });

  it('não renderiza nada quando fechado', () => {
    render(<StageManagerDrawer isOpen={false} onClose={vi.fn()} canManage />);
    expect(screen.queryByText('Gerenciar Etapas do Pipeline')).not.toBeInTheDocument();
  });

  describe('Acesso negado (AC7)', () => {
    it('exibe "Acesso negado" e não lista etapas quando canManage é falso', () => {
      render(<StageManagerDrawer isOpen onClose={vi.fn()} canManage={false} />);
      expect(screen.getByText('Acesso negado')).toBeInTheDocument();
      expect(screen.queryByText('Novo Contato')).not.toBeInTheDocument();
      expect(mocks.createStage).not.toHaveBeenCalled();
      expect(mocks.archiveStage).not.toHaveBeenCalled();
    });
  });

  describe('Criação de etapa (AC2)', () => {
    it('confirmar com Enter cria a etapa e chama createStage', async () => {
      render(<StageManagerDrawer isOpen onClose={vi.fn()} canManage />);

      fireEvent.click(screen.getByRole('button', { name: 'Nova Etapa' }));
      const input = screen.getByLabelText('Nome da nova etapa');
      fireEvent.change(input, { target: { value: 'Fechamento' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() =>
        expect(mocks.createStage).toHaveBeenCalledWith(expect.objectContaining({ name: 'Fechamento' }))
      );
    });

    it('Esc cancela a criação sem chamar createStage', () => {
      render(<StageManagerDrawer isOpen onClose={vi.fn()} canManage />);

      fireEvent.click(screen.getByRole('button', { name: 'Nova Etapa' }));
      const input = screen.getByLabelText('Nome da nova etapa');
      fireEvent.change(input, { target: { value: 'Rascunho' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(screen.queryByLabelText('Nome da nova etapa')).not.toBeInTheDocument();
      expect(mocks.createStage).not.toHaveBeenCalled();
    });

    it('não cria etapa com nome vazio ao perder o foco', () => {
      render(<StageManagerDrawer isOpen onClose={vi.fn()} canManage />);

      fireEvent.click(screen.getByRole('button', { name: 'Nova Etapa' }));
      const input = screen.getByLabelText('Nome da nova etapa');
      fireEvent.blur(input);

      expect(mocks.createStage).not.toHaveBeenCalled();
    });
  });

  describe('Renomear etapa existente (AC2)', () => {
    it('Enter persiste o novo nome via updateStage', async () => {
      render(<StageManagerDrawer isOpen onClose={vi.fn()} canManage />);

      fireEvent.click(screen.getByRole('button', { name: 'Novo Contato' }));
      const input = screen.getByLabelText('Nome da etapa Novo Contato');
      fireEvent.change(input, { target: { value: 'Lead Recebido' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() =>
        expect(mocks.updateStage).toHaveBeenCalledWith({ id: 'stage-1', patch: { name: 'Lead Recebido' } })
      );
    });
  });

  describe('Cor da etapa (AC3)', () => {
    it('selecionar uma cor da paleta chama updateStage com a cor e fecha o popover', async () => {
      render(<StageManagerDrawer isOpen onClose={vi.fn()} canManage />);

      fireEvent.click(screen.getByLabelText('Cor da etapa Novo Contato, alterar cor'));
      const popover = screen.getByRole('dialog', { name: 'Escolher cor para Novo Contato' });
      const swatch = within(popover).getByLabelText('Cor #3b82f6');
      fireEvent.click(swatch);

      await waitFor(() =>
        expect(mocks.updateStage).toHaveBeenCalledWith({ id: 'stage-1', patch: { color: '#3b82f6' } })
      );
      expect(screen.queryByRole('dialog', { name: 'Escolher cor para Novo Contato' })).not.toBeInTheDocument();
    });
  });

  describe('Arquivar / reativar (AC4)', () => {
    it('arquiva a etapa quando não há negócios abertos', async () => {
      render(<StageManagerDrawer isOpen onClose={vi.fn()} canManage />);

      fireEvent.click(screen.getByLabelText('Arquivar etapa Novo Contato'));

      await waitFor(() => expect(mocks.archiveStage).toHaveBeenCalledWith('stage-1'));
    });

    it('desabilita o arquivamento quando a etapa tem negócios abertos', () => {
      mocks.dealCounts = { 'stage-1': 3 };
      render(<StageManagerDrawer isOpen onClose={vi.fn()} canManage />);

      const archiveButton = screen.getByLabelText('Arquivar etapa Novo Contato');
      expect(archiveButton).toBeDisabled();

      fireEvent.click(archiveButton);
      expect(mocks.archiveStage).not.toHaveBeenCalled();
    });

    it('a seção de arquivadas reativa a etapa selecionada', async () => {
      render(<StageManagerDrawer isOpen onClose={vi.fn()} canManage />);

      fireEvent.click(screen.getByRole('button', { name: /Ver etapas arquivadas/ }));
      fireEvent.click(await screen.findByLabelText('Reativar etapa Descontinuada'));

      await waitFor(() => expect(mocks.restoreStage).toHaveBeenCalledWith('stage-9'));
    });
  });

  describe('Estados (AC5, AC9)', () => {
    it('mostra skeleton de 5 linhas enquanto carrega', () => {
      mocks.isStagesLoading = true;
      const { container } = render(<StageManagerDrawer isOpen onClose={vi.fn()} canManage />);
      expect(container.querySelectorAll('.animate-pulse').length).toBe(5);
    });

    it('mostra o empty state "Nenhuma etapa ativa" com CTA quando não há etapas ativas', () => {
      mocks.activeStages = [];
      render(<StageManagerDrawer isOpen onClose={vi.fn()} canManage />);

      expect(screen.getByText('Nenhuma etapa ativa')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Nova Etapa' })).toBeInTheDocument();
    });

    it('abre direto no fluxo de criação quando startInCreateFlow é true', async () => {
      mocks.activeStages = [];
      render(<StageManagerDrawer isOpen onClose={vi.fn()} canManage startInCreateFlow />);

      expect(await screen.findByLabelText('Nome da nova etapa')).toBeInTheDocument();
    });
  });
});
