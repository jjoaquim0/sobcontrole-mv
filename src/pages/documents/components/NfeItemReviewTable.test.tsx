import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NfeImportProposalItem, NfeProductSuggestion } from '../../../services/documentImportService';
import { NfeItemReviewTable } from './NfeItemReviewTable';

const baseItem = (overrides: Partial<NfeImportProposalItem> = {}): NfeImportProposalItem => ({
  id: 'item-1',
  proposalId: 'proposal-1',
  companyId: 'company-1',
  position: 0,
  payload: {
    quantity: 2,
    document_unit_cost: 4.5,
    new_product_name: 'Café XML',
    new_product_unit: 'Kg',
  },
  fieldOrigins: { new_product_name: 'deterministic' },
  matchedProductId: null,
  currentCost: null,
  documentCost: 4.5,
  updateCostDecision: 'pending',
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

const props = (overrides: Partial<React.ComponentProps<typeof NfeItemReviewTable>> = {}) => ({
  items: [baseItem()],
  onSaveItem: vi.fn(async (itemId: string, patch: object) => ({ ...baseItem({ id: itemId }), payload: { ...baseItem().payload, ...(patch as { payload?: object }).payload } })),
  onSearchProducts: vi.fn(async () => [] as NfeProductSuggestion[]),
  loadCategories: vi.fn(async () => [{ id: 'category-1', name: 'Bebidas' }]),
  createCategory: vi.fn(async (name: string) => ({ id: 'category-2', name })),
  ...overrides,
});

describe('NfeItemReviewTable', () => {
  it('exibe estado vazio sem bloquear o restante do fluxo', () => {
    render(<NfeItemReviewTable {...props({ items: [], loadCategories: vi.fn(() => new Promise<never[]>(() => undefined)) })} />);

    expect(screen.getByText('Não foi possível identificar itens nesta nota. Revise o restante dos dados — produtos podem ser lançados manualmente depois.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('mantém produto novo pendente até autosalvar categoria e preço', async () => {
    const onSaveItem = vi.fn(async (itemId: string, patch: object) => ({ ...baseItem({ id: itemId }), payload: { ...baseItem().payload, ...(patch as { payload?: object }).payload } }));
    render(<NfeItemReviewTable {...props({ onSaveItem })} />);

    await waitFor(() => expect(screen.getByLabelText('Nome do produto *')).toHaveValue('Café XML'));
    expect(screen.getByText('Novo produto — dados pendentes. Categoria, nome, unidade e preço de venda são obrigatórios.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Categoria *'), { target: { value: 'category-1' } });
    fireEvent.change(screen.getByLabelText('Preço de venda *'), { target: { value: '12.50' } });

    await waitFor(() => expect(onSaveItem).toHaveBeenCalledTimes(2));
    expect(onSaveItem.mock.calls[0][1]).toEqual(expect.objectContaining({ payload: expect.objectContaining({ new_product_category_id: 'category-1' }) }));
    expect(onSaveItem.mock.calls[1][1]).toEqual(expect.objectContaining({ payload: expect.objectContaining({ new_product_sale_price: 12.5 }) }));
  });

  it('mostra as duas decisões independentes quando há custo divergente', async () => {
    const product: NfeProductSuggestion = { id: 'product-1', name: 'Produto existente', barcode: null, unit: 'Unidade', costPrice: 2, salePrice: 5, categoryId: 'category-1', confidence: 'high' };
    render(<NfeItemReviewTable {...props({ items: [baseItem({ matchedProductId: 'product-1', suggestedProduct: product, currentCost: 2 })] })} />);

    await waitFor(() => expect(screen.getByText('Custo divergente — escolha uma opção')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Manter R$ 2,00' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Atualizar para R$ 4,50' })).toBeInTheDocument();
  });

  it('avisa acima de vinte itens que precisam de atenção sem esconder a tabela', async () => {
    const items = Array.from({ length: 21 }, (_, position) => baseItem({ id: `item-${position}`, position }));
    render(<NfeItemReviewTable {...props({ items })} />);

    expect(await screen.findByText('Esta nota tem 21 itens que precisam da sua atenção. Nada será perdido se você revisar em mais de uma vez.')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});
