import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StockRecommendationsPage } from './StockRecommendationsPage';
import { StockRecommendationsResult } from '../../services/stockRecommendationsService';

const useAuthMock = vi.fn();
const useStockRecommendationsMock = vi.fn();
const useCategoriesMock = vi.fn();
const usePurchaseMutationsMock = vi.fn();
const useProductDetailsMock = vi.fn();
const useProductSupplierSuggestionMock = vi.fn();
const useRecommendationActionHistoryMock = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../../hooks/useInventory', () => ({
  useCategories: () => useCategoriesMock(),
  useProductDetails: (...args: unknown[]) => useProductDetailsMock(...args),
}));

vi.mock('../../hooks/usePurchases', () => ({
  usePurchaseMutations: () => usePurchaseMutationsMock(),
}));

vi.mock('../../hooks/useStockRecommendations', () => ({
  useStockRecommendations: (...args: unknown[]) => useStockRecommendationsMock(...args),
  useProductSupplierSuggestion: (...args: unknown[]) => useProductSupplierSuggestionMock(...args),
  useRecommendationActionHistory: (...args: unknown[]) => useRecommendationActionHistoryMock(...args),
}));

vi.mock('../purchases/components/PurchaseModal', () => ({
  PurchaseModal: () => null,
}));

const buildResult = (overrides: Partial<StockRecommendationsResult> = {}): StockRecommendationsResult => ({
  period: { days: 30, dateFrom: '2026-06-19T12:00:00.000Z', dateTo: '2026-07-19T12:00:00.000Z' },
  targetCoverageDays: 14,
  summary: {
    productsAnalyzed: 10,
    ruptureRiskCount: 1,
    criticalCount: 1,
    stoppedCount: 0,
    estimatedReorderValue: 500,
    averageCoverageDays: 8,
  },
  categories: [{ id: 'cat-1', name: 'Bebidas' }],
  recommendations: [
    {
      id: 'p1:reposicao',
      productId: 'p1',
      productName: 'Refrigerante 2L',
      sku: 'SKU-REFRI',
      barcode: '',
      unit: 'un',
      categoryId: 'cat-1',
      categoryName: 'Bebidas',
      type: 'reposicao',
      priority: 'critica',
      confidence: 'alta',
      status: 'active',
      postponedUntil: null,
      reasons: ['Produto sem nenhuma unidade disponível em estoque.'],
      suggestedAction: 'Comprar com urgência — produto sem estoque disponível.',
      currentQuantity: 0,
      minQuantity: 10,
      costPrice: 5,
      averageDailyDemand: 2,
      coverageDays: 0,
      estimatedRuptureDate: '2026-07-19T12:00:00.000Z',
      inTransitQuantity: null,
      suggestedQuantity: 28,
      coverageAfterPurchase: 14,
      daysWithoutExit: null,
      daysWithoutExitIsMinimum: false,
      lastExitAt: null,
      estimatedStoppedValue: null,
      supplierHint: { supplierId: 'sup-1', supplierName: 'Distribuidora ABC' },
    },
  ],
  ...overrides,
});

describe('StockRecommendationsPage', () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({ company: { id: 'company-1' }, hasRole: () => true });
    useCategoriesMock.mockReturnValue({ categories: [{ id: 'cat-1', name: 'Bebidas' }] });
    usePurchaseMutationsMock.mockReturnValue({ createPurchase: vi.fn(), isCreating: false });
    useProductDetailsMock.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    useProductSupplierSuggestionMock.mockReturnValue({ suggestion: null, isLoading: false, isError: false });
    useRecommendationActionHistoryMock.mockReturnValue({ history: [], isLoading: false, isError: false });
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <StockRecommendationsPage />
      </MemoryRouter>,
    );

  it('mostra o cabeçalho mesmo durante o carregamento, sem quebrar', () => {
    useStockRecommendationsMock.mockReturnValue({
      result: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
      dataUpdatedAt: undefined,
      dismiss: vi.fn(),
      isDismissing: false,
      postpone: vi.fn(),
      isPostponing: false,
      resolve: vi.fn(),
      isResolving: false,
    });

    renderPage();
    expect(screen.getByText('Recomendações de Estoque')).toBeInTheDocument();
  });

  it('mostra estado de erro com opção de tentar novamente', () => {
    const refetch = vi.fn();
    useStockRecommendationsMock.mockReturnValue({
      result: undefined,
      isLoading: false,
      isError: true,
      refetch,
      dataUpdatedAt: undefined,
      dismiss: vi.fn(),
      isDismissing: false,
      postpone: vi.fn(),
      isPostponing: false,
      resolve: vi.fn(),
      isResolving: false,
    });

    renderPage();
    expect(screen.getByText('Não foi possível carregar as recomendações')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Tentar novamente'));
    expect(refetch).toHaveBeenCalled();
  });

  it('mostra o estado vazio honesto quando não há recomendações', () => {
    useStockRecommendationsMock.mockReturnValue({
      result: buildResult({ recommendations: [], summary: { productsAnalyzed: 5, ruptureRiskCount: 0, criticalCount: 0, stoppedCount: 0, estimatedReorderValue: null, averageCoverageDays: null } }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      dataUpdatedAt: Date.now(),
      dismiss: vi.fn(),
      isDismissing: false,
      postpone: vi.fn(),
      isPostponing: false,
      resolve: vi.fn(),
      isResolving: false,
    });

    renderPage();
    expect(screen.getByText('Não há recomendações críticas no momento')).toBeInTheDocument();
  });

  it('mostra os cards de resumo e a recomendação na lista', () => {
    useStockRecommendationsMock.mockReturnValue({
      result: buildResult(),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      dataUpdatedAt: Date.now(),
      dismiss: vi.fn(),
      isDismissing: false,
      postpone: vi.fn(),
      isPostponing: false,
      resolve: vi.fn(),
      isResolving: false,
    });

    renderPage();
    expect(screen.getByText('Refrigerante 2L')).toBeInTheDocument();
    expect(screen.getAllByText('Crítica').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Distribuidora ABC').length).toBeGreaterThan(0);
  });

  it('esconde a ação "Criar rascunho de compra" para quem não é admin/manager', () => {
    useAuthMock.mockReturnValue({ company: { id: 'company-1' }, hasRole: () => false });
    useStockRecommendationsMock.mockReturnValue({
      result: buildResult(),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      dataUpdatedAt: Date.now(),
      dismiss: vi.fn(),
      isDismissing: false,
      postpone: vi.fn(),
      isPostponing: false,
      resolve: vi.fn(),
      isResolving: false,
    });

    renderPage();
    expect(screen.queryByText('Criar rascunho de compra')).not.toBeInTheDocument();
  });

  it('aciona dismiss com o motivo informado ao confirmar a ação de dispensar', async () => {
    const dismiss = vi.fn().mockResolvedValue(undefined);
    useStockRecommendationsMock.mockReturnValue({
      result: buildResult(),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      dataUpdatedAt: Date.now(),
      dismiss,
      isDismissing: false,
      postpone: vi.fn(),
      isPostponing: false,
      resolve: vi.fn(),
      isResolving: false,
    });

    renderPage();
    fireEvent.click(screen.getByTitle('Dispensar'));

    const dialog = await screen.findByRole('dialog');
    const textarea = within(dialog).getByPlaceholderText(/Explique o motivo/);
    fireEvent.change(textarea, { target: { value: 'Fornecedor avisou atraso' } });
    fireEvent.click(within(dialog).getByText('Dispensar'));

    await waitFor(() =>
      expect(dismiss).toHaveBeenCalledWith(
        expect.objectContaining({ productId: 'p1', recommendationType: 'reposicao', reason: 'Fornecedor avisou atraso' }),
      ),
    );
  });

  it('esconde recomendações dispensadas por padrão e as exibe (sem ações) ao marcar "mostrar"', () => {
    useStockRecommendationsMock.mockReturnValue({
      result: buildResult({
        recommendations: [
          {
            ...buildResult().recommendations[0],
            status: 'dismissed',
          },
        ],
      }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      dataUpdatedAt: Date.now(),
      dismiss: vi.fn(),
      isDismissing: false,
      postpone: vi.fn(),
      isPostponing: false,
      resolve: vi.fn(),
      isResolving: false,
    });

    renderPage();
    expect(screen.getByText('Não há recomendações críticas no momento')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Mostrar dispensadas/));

    expect(screen.getByText('Dispensada')).toBeInTheDocument();
    expect(screen.queryByTitle('Dispensar')).not.toBeInTheDocument();
  });
});
