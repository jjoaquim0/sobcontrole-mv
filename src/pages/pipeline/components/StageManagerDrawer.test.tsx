import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StageManagerDrawer } from './StageManagerDrawer';
import type { PipelineStage } from '../../../types';

// jsdom não implementa PointerEvent nativamente (mesmo em versões recentes -
// ver https://github.com/jsdom/jsdom/issues/2527). Sem ele, o fallback de
// fireEvent.pointerDown/Move/Up do testing-library usa o construtor Event
// genérico, que descarta propriedades como isPrimary/pointerId/button -
// exatamente as que @dnd-kit's PointerSensor lê para decidir se deve
// ativar o arraste. Polyfill mínimo, só para os testes de drag-and-drop
// por ponteiro desta suíte (Story 1.36).
if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    public pointerId?: number;
    public pointerType?: string;
    public isPrimary?: boolean;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId;
      this.pointerType = params.pointerType;
      this.isPrimary = params.isPrimary;
    }
  }
  // @ts-expect-error - polyfill de teste com assinatura simplificada, não a interface DOM completa
  window.PointerEvent = PointerEventPolyfill;
}

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
  updatePipelineStagePosition: vi.fn(),
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
    updatePipelineStagePosition: mocks.updatePipelineStagePosition,
    isUpdatingStagePosition: false,
  }),
  useOpenDealCountsByStage: () => ({ counts: mocks.dealCounts, isLoading: false }),
}));

// @dnd-kit mede posições via getBoundingClientRect, sempre 0 em jsdom (sem
// layout real). Damos a cada linha arrastável (marcada com
// data-stage-row-index pelo SortableStageRow) um retângulo vertical
// distinto e estável, para que closestCenter/sortableKeyboardCoordinates
// consigam calcular vizinhança de verdade nos testes de ponteiro/teclado.
const ROW_HEIGHT = 56;
const rectForIndexedElement = (element: Element): DOMRect | null => {
  const withIndex = element.closest('[data-stage-row-index]');
  if (!withIndex) return null;
  const index = Number(withIndex.getAttribute('data-stage-row-index'));
  const top = index * ROW_HEIGHT;
  return {
    top,
    bottom: top + ROW_HEIGHT,
    left: 0,
    right: 300,
    width: 300,
    height: ROW_HEIGHT,
    x: 0,
    y: top,
    toJSON: () => {},
  } as DOMRect;
};

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
    mocks.updatePipelineStagePosition.mockReset().mockResolvedValue(undefined);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      return rectForIndexedElement(this) ?? ({
        top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {},
      } as DOMRect);
    });
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

  describe('Reordenação de etapas por drag-and-drop (Story 1.36, AC1, AC2, AC5, AC7)', () => {
    it('cada etapa ativa tem alça focável com aria-label de posição e aria-roledescription "Reordenável"', () => {
      render(<StageManagerDrawer isOpen onClose={vi.fn()} canManage />);

      const firstHandle = screen.getByLabelText('Reordenar etapa Novo Contato, posição 1 de 2');
      const secondHandle = screen.getByLabelText('Reordenar etapa Proposta Enviada, posição 2 de 2');
      expect(firstHandle).toHaveAttribute('aria-roledescription', 'Reordenável');
      expect(secondHandle).toHaveAttribute('aria-roledescription', 'Reordenável');
    });

    it('etapas arquivadas não recebem alça de arraste', async () => {
      render(<StageManagerDrawer isOpen onClose={vi.fn()} canManage />);
      fireEvent.click(screen.getByRole('button', { name: /Ver etapas arquivadas/ }));

      await screen.findByLabelText('Reativar etapa Descontinuada');
      expect(screen.queryByLabelText(/Reordenar etapa Descontinuada/)).not.toBeInTheDocument();
    });

    it('arrastar por ponteiro a segunda etapa sobre a primeira chama updatePipelineStagePosition com a etapa e a posição corretas', async () => {
      render(<StageManagerDrawer isOpen onClose={vi.fn()} canManage />);

      const dragged = screen.getByLabelText('Reordenar etapa Proposta Enviada, posição 2 de 2');

      // stage-1 (Novo Contato, position 0) ocupa a linha de índice 0
      // (top 0-56); stage-2 (Proposta Enviada, position 1) ocupa a linha de
      // índice 1 (top 56-112) - ver rectForIndexedElement/ROW_HEIGHT acima.
      // Arrastar o ponteiro de dentro da linha 1 para dentro da linha 0
      // ultrapassa o activationConstraint (distance: 4) e cruza para a
      // área de colisão da primeira linha.
      fireEvent.pointerDown(dragged, { pointerId: 1, isPrimary: true, button: 0, clientX: 10, clientY: 70 });
      // O primeiro pointermove que ultrapassa o activationConstraint
      // (distance: 4) só ativa o sensor (PointerSensor.handleMove retorna
      // cedo em handleStart()) - não conta como atualização de posição. É
      // preciso um segundo pointermove, já com o arraste ativo, para que o
      // dnd-kit calcule a colisão/over de verdade.
      fireEvent.pointerMove(document, { pointerId: 1, isPrimary: true, clientX: 10, clientY: 76 });
      fireEvent.pointerMove(document, { pointerId: 1, isPrimary: true, clientX: 10, clientY: 10 });
      fireEvent.pointerUp(document, { pointerId: 1, isPrimary: true, clientX: 10, clientY: 10 });

      await waitFor(() =>
        expect(mocks.updatePipelineStagePosition).toHaveBeenCalledWith({ stageId: 'stage-2', position: -1 })
      );
    });

    it('teclado: Space seleciona, seta para cima move e Space confirma a reordenação', async () => {
      render(<StageManagerDrawer isOpen onClose={vi.fn()} canManage />);

      const secondHandle = screen.getByLabelText('Reordenar etapa Proposta Enviada, posição 2 de 2');
      secondHandle.focus();

      fireEvent.keyDown(secondHandle, { code: 'Space' });
      // KeyboardSensor anexa seu listener de keydown de continuação
      // (setas/confirmação) via setTimeout(0) dentro de attach() - sem essa
      // espera, o ArrowUp/Space seguintes chegam antes do listener existir.
      await new Promise((resolve) => setTimeout(resolve, 0));
      fireEvent.keyDown(document, { code: 'ArrowUp' });
      fireEvent.keyDown(document, { code: 'Space' });

      await waitFor(() =>
        expect(mocks.updatePipelineStagePosition).toHaveBeenCalledWith({ stageId: 'stage-2', position: -1 })
      );
    });

    it('teclado: Esc cancela a reordenação sem chamar updatePipelineStagePosition', async () => {
      render(<StageManagerDrawer isOpen onClose={vi.fn()} canManage />);

      const secondHandle = screen.getByLabelText('Reordenar etapa Proposta Enviada, posição 2 de 2');
      secondHandle.focus();

      fireEvent.keyDown(secondHandle, { code: 'Space' });
      await new Promise((resolve) => setTimeout(resolve, 0));
      fireEvent.keyDown(document, { code: 'ArrowUp' });
      fireEvent.keyDown(document, { code: 'Escape' });

      expect(mocks.updatePipelineStagePosition).not.toHaveBeenCalled();
    });
  });

  describe('Acesso negado e reordenação (AC7)', () => {
    it('employee não vê nenhuma alça de reordenar e nenhuma mutation é executada', () => {
      render(<StageManagerDrawer isOpen onClose={vi.fn()} canManage={false} />);

      expect(screen.queryByLabelText(/Reordenar etapa/)).not.toBeInTheDocument();
      expect(mocks.updatePipelineStagePosition).not.toHaveBeenCalled();
    });
  });
});
