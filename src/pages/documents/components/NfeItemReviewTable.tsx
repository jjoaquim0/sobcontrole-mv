import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, ChevronDown, Loader2, Plus, Search } from 'lucide-react';
import {
  getNfeProposalItemAttentionCount,
  getNfeProposalItemCounts,
  getNfeProposalItemReviewState,
  isNfeProposalItemReady,
  nfeProductUnits,
  NfeImportProposalItem,
  NfeProductSuggestion,
  NfeProposalItemPatch,
} from '../../../services/documentImportService';

export interface NfeProductCategoryOption {
  id: string;
  name: string;
}

export interface NfeItemReviewTableProps {
  items: NfeImportProposalItem[];
  onSaveItem: (itemId: string, patch: NfeProposalItemPatch) => Promise<NfeImportProposalItem>;
  onSearchProducts: (query: string) => Promise<NfeProductSuggestion[]>;
  loadCategories: () => Promise<NfeProductCategoryOption[]>;
  createCategory: (name: string) => Promise<NfeProductCategoryOption>;
}

const money = (value: number | null): string => value === null ? '—' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const stateLabel = (item: NfeImportProposalItem): string => {
  switch (getNfeProposalItemReviewState(item)) {
    case 'resolved': return 'Resolvido';
    case 'new_product_pending': return 'Novo produto — dados pendentes';
    case 'new_product_ready': return 'Novo produto — pronto';
    case 'link_review': return 'Vínculo a revisar';
    case 'cost_divergence': return 'Custo divergente';
    case 'link_and_cost_review': return 'Vínculo e custo a revisar';
  }
};

const stateClass = (item: NfeImportProposalItem): string => {
  const state = getNfeProposalItemReviewState(item);
  if (state === 'resolved') return 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200';
  if (state === 'new_product_ready') return 'bg-cyan-50 text-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-200';
  return 'bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100';
};

const getSelectedProduct = (item: NfeImportProposalItem): NfeProductSuggestion | null => {
  if (!item.matchedProductId && item.suggestedProduct) return item.suggestedProduct;
  if (item.matchedProductId && item.suggestedProduct?.id === item.matchedProductId) return item.suggestedProduct;
  return item.matchedProductId ? {
    id: item.matchedProductId,
    name: 'Produto vinculado',
    barcode: null,
    unit: null,
    costPrice: item.currentCost,
    salePrice: null,
    categoryId: null,
    confidence: 'high',
  } : null;
};

export const NfeItemReviewTable: React.FC<NfeItemReviewTableProps> = ({
  items,
  onSaveItem,
  onSearchProducts,
  loadCategories,
  createCategory,
}) => {
  const [showAlertsOnly, setShowAlertsOnly] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [margin, setMargin] = useState('');
  const [categories, setCategories] = useState<NfeProductCategoryOption[]>([]);
  const [categoryName, setCategoryName] = useState('');
  const [categoryItemId, setCategoryItemId] = useState<string | null>(null);
  const [searchValues, setSearchValues] = useState<Record<string, string>>({});
  const [searchResults, setSearchResults] = useState<Record<string, NfeProductSuggestion[]>>({});
  const [searching, setSearching] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadCategories().then((loaded) => {
      if (active) setCategories(loaded);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [loadCategories]);

  useEffect(() => {
    setExpanded((current) => {
      const next = new Set(current);
      for (const item of items) {
        if (!isNfeProposalItemReady(item)) next.add(item.id);
      }
      return next;
    });
  }, [items]);

  const counts = useMemo(() => getNfeProposalItemCounts(items), [items]);
  const attentionCount = getNfeProposalItemAttentionCount(items);
  const visibleItems = showAlertsOnly
    ? items.filter((item) => !isNfeProposalItemReady(item))
    : items;
  const firstChosenCategory = items.find((item) => item.payload.new_product_category_id)?.payload.new_product_category_id;
  const uncategorizedNewProducts = items.filter((item) =>
    !getSelectedProduct(item) && !item.payload.new_product_category_id,
  );

  const save = async (item: NfeImportProposalItem, patch: NfeProposalItemPatch) => {
    setSaving(item.id);
    setSaveError(null);
    try {
      await onSaveItem(item.id, patch);
    } catch {
      setSaveError('Não foi possível salvar esta alteração. A proposta continua pendente; tente novamente.');
    } finally {
      setSaving(null);
    }
  };

  const updatePayload = (item: NfeImportProposalItem, patch: Partial<NfeImportProposalItem['payload']>) => {
    void save(item, { payload: { ...item.payload, ...patch } });
  };

  const applyMarginToEmptyPrices = () => {
    const value = Number(margin.replace(',', '.'));
    if (!Number.isFinite(value) || value < 0) return;
    for (const item of items) {
      if (getSelectedProduct(item) || item.payload.new_product_sale_price !== undefined) continue;
      const price = Math.round(item.payload.document_unit_cost * (1 + value / 100) * 100) / 100;
      updatePayload(item, { new_product_sale_price: price });
    }
  };

  const applyCategoryToEmptyItems = () => {
    if (!firstChosenCategory) return;
    for (const item of uncategorizedNewProducts) {
      updatePayload(item, { new_product_category_id: firstChosenCategory });
    }
  };

  const addCategory = async () => {
    const name = categoryName.trim();
    if (!name) return;
    setSaving(categoryItemId);
    try {
      const category = await createCategory(name);
      setCategories((current) => [...current, category]);
      if (categoryItemId) {
        const item = items.find((candidate) => candidate.id === categoryItemId);
        if (item) updatePayload(item, { new_product_category_id: category.id });
      }
      setCategoryName('');
      setCategoryItemId(null);
    } catch {
      setSaveError('Não foi possível cadastrar a categoria.');
    } finally {
      setSaving(null);
    }
  };

  const search = async (itemId: string) => {
    const query = searchValues[itemId]?.trim() ?? '';
    if (!query) return;
    setSearching(itemId);
    try {
      const results = await onSearchProducts(query);
      setSearchResults((current) => ({ ...current, [itemId]: results }));
    } catch {
      setSaveError('Não foi possível buscar produtos desta empresa.');
    } finally {
      setSearching(null);
    }
  };

  if (items.length === 0) {
    return <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-200">Não foi possível identificar itens nesta nota. Revise o restante dos dados — produtos podem ser lançados manualmente depois.</p>;
  }

  return (
    <section aria-labelledby="nfe-items-title" className="space-y-4 rounded-2xl border border-gray-200 p-4 dark:border-white/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="nfe-items-title" className="font-bold text-gray-900 dark:text-white">Itens da nota</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{counts.newProducts} novos · {counts.linked} vinculados · {counts.needsReview} revisar</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
          <input type="checkbox" checked={showAlertsOnly} onChange={(event) => setShowAlertsOnly(event.target.checked)} className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-400" />
          Mostrar só os com alerta
        </label>
      </div>

      {attentionCount > 20 && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium leading-5 text-amber-900 dark:border-amber-400/20 dark:bg-amber-950/20 dark:text-amber-100">Esta nota tem {attentionCount} itens que precisam da sua atenção. Nada será perdido se você revisar em mais de uma vez.</p>}
      {saveError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/20 dark:bg-red-950/20 dark:text-red-200">{saveError}</p>}

      <div className="flex flex-wrap items-end gap-3 rounded-xl bg-gray-50 p-3 dark:bg-white/[0.03]">
        <div>
          <label htmlFor="nfe-suggested-margin" className="block text-xs font-semibold text-gray-700 dark:text-gray-200">Sugerir preço de venda com margem (%) sobre o custo</label>
          <input id="nfe-suggested-margin" value={margin} onChange={(event) => setMargin(event.target.value)} inputMode="decimal" className="mt-1 w-28 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" />
        </div>
        <button type="button" onClick={applyMarginToEmptyPrices} className="rounded-lg border border-cyan-200 px-3 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-cyan-400/30 dark:text-cyan-200 dark:hover:bg-cyan-950/30">Aplicar aos vazios</button>
        {firstChosenCategory && uncategorizedNewProducts.length > 0 && <button type="button" onClick={applyCategoryToEmptyItems} className="rounded-lg border border-cyan-200 px-3 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-cyan-400/30 dark:text-cyan-200 dark:hover:bg-cyan-950/30">Usar categoria também nos outros {uncategorizedNewProducts.length}</button>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <caption className="sr-only">Revisão dos itens extraídos da nota fiscal</caption>
          <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-gray-400">
            <tr><th scope="col" className="px-2 py-3">Item</th><th scope="col" className="px-2 py-3">Quantidade</th><th scope="col" className="px-2 py-3">Custo nota</th><th scope="col" className="px-2 py-3">Produto</th><th scope="col" className="px-2 py-3">Estado</th><th scope="col" className="px-2 py-3"><span className="sr-only">Ações</span></th></tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => {
              const itemState = getNfeProposalItemReviewState(item);
              const product = getSelectedProduct(item);
              const isExpanded = expanded.has(item.id);
              return <React.Fragment key={item.id}>
                <tr className="border-b border-gray-100 align-top dark:border-white/5">
                  <td className="px-2 py-3 font-semibold text-gray-900 dark:text-white"><span className="mr-2 text-xs text-gray-400">#{item.position + 1}</span>{item.payload.new_product_name || 'Item sem nome'}</td>
                  <td className="px-2 py-3 text-gray-700 dark:text-gray-300">{item.payload.quantity}</td>
                  <td className="px-2 py-3 text-gray-700 dark:text-gray-300">{money(item.documentCost ?? item.payload.document_unit_cost)}</td>
                  <td className="px-2 py-3 text-gray-700 dark:text-gray-300">{product?.name ?? 'Novo produto'}</td>
                  <td className="px-2 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${stateClass(item)}`}>{itemState === 'resolved' ? <Check className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> : <AlertCircle className="mr-1 h-3.5 w-3.5" aria-hidden="true" />}{stateLabel(item)}</span></td>
                  <td className="px-2 py-3 text-right"><button type="button" aria-expanded={isExpanded} aria-controls={`nfe-item-details-${item.id}`} onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:hover:bg-white/10 dark:text-gray-300"><ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true" /><span className="sr-only">{isExpanded ? 'Recolher' : 'Expandir'} item {item.position + 1}</span></button></td>
                </tr>
                {isExpanded && <tr id={`nfe-item-details-${item.id}`}><td colSpan={6} className="bg-gray-50 px-3 py-4 dark:bg-white/[0.02]"><NfeItemDetails item={item} product={product} categories={categories} categoryName={categoryItemId === item.id ? categoryName : ''} isCategoryOpen={categoryItemId === item.id} isSaving={saving === item.id} searchValue={searchValues[item.id] ?? ''} searchResults={searchResults[item.id] ?? []} isSearching={searching === item.id} onPayloadChange={(patch) => updatePayload(item, patch)} onSelectProduct={(selected) => { void save(item, { matchedProductId: selected.id, currentCost: selected.costPrice, suggestedProduct: selected, updateCostDecision: 'pending' }); }} onCreateNew={() => { void save(item, { matchedProductId: null, currentCost: null, suggestedProduct: null, updateCostDecision: 'pending' }); }} onCostDecision={(decision) => { void save(item, { updateCostDecision: decision }); }} onSearchValueChange={(value) => setSearchValues((current) => ({ ...current, [item.id]: value }))} onSearch={() => { void search(item.id); }} onSelectCategory={(value) => updatePayload(item, { new_product_category_id: value })} onOpenCategory={() => { setCategoryItemId(item.id); setCategoryName(''); }} onCategoryNameChange={setCategoryName} onAddCategory={() => { void addCategory(); }} /></td></tr>}
              </React.Fragment>;
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

interface NfeItemDetailsProps {
  item: NfeImportProposalItem;
  product: NfeProductSuggestion | null;
  categories: NfeProductCategoryOption[];
  categoryName: string;
  isCategoryOpen: boolean;
  isSaving: boolean;
  searchValue: string;
  searchResults: NfeProductSuggestion[];
  isSearching: boolean;
  onPayloadChange: (patch: Partial<NfeImportProposalItem['payload']>) => void;
  onSelectProduct: (product: NfeProductSuggestion) => void;
  onCreateNew: () => void;
  onCostDecision: (decision: 'update' | 'keep') => void;
  onSearchValueChange: (value: string) => void;
  onSearch: () => void;
  onSelectCategory: (value: string) => void;
  onOpenCategory: () => void;
  onCategoryNameChange: (value: string) => void;
  onAddCategory: () => void;
}

const NfeItemDetails: React.FC<NfeItemDetailsProps> = ({
  item,
  product,
  categories,
  categoryName,
  isCategoryOpen,
  isSaving,
  searchValue,
  searchResults,
  isSearching,
  onPayloadChange,
  onSelectProduct,
  onCreateNew,
  onCostDecision,
  onSearchValueChange,
  onSearch,
  onSelectCategory,
  onOpenCategory,
  onCategoryNameChange,
  onAddCategory,
}) => {
  const state = getNfeProposalItemReviewState(item);
  const currentCost = item.currentCost ?? product?.costPrice ?? null;
  const hasCostDivergence = currentCost !== null && item.documentCost !== null && Math.abs(currentCost - item.documentCost) > 0.0001;
  const newProduct = !product;
  return <div className="space-y-4" aria-live="polite">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-gray-900 dark:text-white">Decisão do item {item.position + 1}</p>{isSaving && <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400"><Loader2 className="h-3.5 w-3.5 animate-spin" />Salvando…</span>}</div>
    <div className="grid gap-3 md:grid-cols-[1fr_auto]">
      <div><label htmlFor={`nfe-product-search-${item.id}`} className="block text-xs font-semibold text-gray-700 dark:text-gray-200">Buscar outro produto</label><div className="mt-1 flex gap-2"><input id={`nfe-product-search-${item.id}`} value={searchValue} onChange={(event) => onSearchValueChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); onSearch(); } }} placeholder="Nome do produto" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" /><button type="button" onClick={onSearch} disabled={isSearching} aria-label="Buscar produtos" className="rounded-lg border border-gray-200 px-3 text-gray-600 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/10">{isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</button></div>{searchResults.length > 0 && <ul className="mt-2 space-y-1 rounded-lg border border-gray-200 bg-white p-2 dark:border-white/10 dark:bg-[#1a1d27]">{searchResults.map((result) => <li key={result.id}><button type="button" onClick={() => onSelectProduct(result)} className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-gray-100 dark:hover:bg-white/10 dark:text-gray-200">{result.name} · custo {money(result.costPrice)}</button></li>)}</ul>}</div>
      <button type="button" onClick={onCreateNew} className={`self-end rounded-lg border px-3 py-2 text-xs font-semibold ${newProduct ? 'border-cyan-300 bg-cyan-50 text-cyan-900 dark:border-cyan-400/40 dark:bg-cyan-950/30 dark:text-cyan-100' : 'border-gray-200 text-gray-700 dark:border-white/10 dark:text-gray-200'}`}>Criar novo produto</button>
    </div>
    {product && <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-900 dark:border-cyan-400/20 dark:bg-cyan-950/20 dark:text-cyan-100"><strong>{product.name}</strong> · vínculo {product.confidence === 'high' ? 'por código de barras' : 'selecionado manualmente'} · custo atual {money(currentCost)} · custo da nota {money(item.documentCost)}</div>}
    {hasCostDivergence && <fieldset className="rounded-lg border border-amber-200 p-3 dark:border-amber-400/20"><legend className="px-1 text-xs font-semibold text-amber-900 dark:text-amber-100">Custo divergente — escolha uma opção</legend><div className="mt-2 flex flex-wrap gap-2"><button type="button" aria-pressed={item.updateCostDecision === 'keep'} onClick={() => onCostDecision('keep')} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${item.updateCostDecision === 'keep' ? 'border-cyan-500 bg-cyan-50 text-cyan-900' : 'border-gray-200 text-gray-700 dark:border-white/10 dark:text-gray-200'}`}>Manter {money(currentCost)}</button><button type="button" aria-pressed={item.updateCostDecision === 'update'} onClick={() => onCostDecision('update')} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${item.updateCostDecision === 'update' ? 'border-cyan-500 bg-cyan-50 text-cyan-900' : 'border-gray-200 text-gray-700 dark:border-white/10 dark:text-gray-200'}`}>Atualizar para {money(item.documentCost)}</button></div></fieldset>}
    {newProduct && <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><label htmlFor={`nfe-new-name-${item.id}`} className="block text-xs font-semibold text-gray-700 dark:text-gray-200">Nome do produto *</label><input id={`nfe-new-name-${item.id}`} value={item.payload.new_product_name} onChange={(event) => onPayloadChange({ new_product_name: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" /></div>
      <div><label htmlFor={`nfe-new-unit-${item.id}`} className="block text-xs font-semibold text-gray-700 dark:text-gray-200">Unidade *</label><select id={`nfe-new-unit-${item.id}`} value={item.payload.new_product_unit} onChange={(event) => onPayloadChange({ new_product_unit: event.target.value })} className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm dark:bg-white/5 dark:text-white ${item.payload.source_unit_code ? 'border-amber-400' : 'border-gray-200 dark:border-white/10'}`}>{nfeProductUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select>{item.payload.source_unit_code && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Código fiscal “{item.payload.source_unit_code}” não reconhecido; confirme a unidade.</p>}</div>
      <div><div className="flex items-center justify-between"><label htmlFor={`nfe-new-category-${item.id}`} className="block text-xs font-semibold text-gray-700 dark:text-gray-200">Categoria *</label><button type="button" onClick={onOpenCategory} className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300"><Plus className="h-3.5 w-3.5" />Nova</button></div><select id={`nfe-new-category-${item.id}`} value={item.payload.new_product_category_id ?? ''} onChange={(event) => onSelectCategory(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"><option value="">Selecione uma categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{isCategoryOpen && <div className="mt-2 flex gap-2"><input value={categoryName} onChange={(event) => onCategoryNameChange(event.target.value)} placeholder="Nome da categoria" className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-white/10 dark:bg-white/5 dark:text-white" /><button type="button" onClick={onAddCategory} className="rounded-lg bg-cyan-700 px-2 py-1.5 text-xs font-semibold text-white">Adicionar</button></div>}</div>
      <div><label htmlFor={`nfe-new-price-${item.id}`} className="block text-xs font-semibold text-gray-700 dark:text-gray-200">Preço de venda *</label><input id={`nfe-new-price-${item.id}`} type="number" min="0.01" step="0.01" value={item.payload.new_product_sale_price ?? ''} onChange={(event) => { const value = event.target.value; onPayloadChange({ new_product_sale_price: value === '' ? undefined : Number(value) }); }} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" /></div>
      <p className={`sm:col-span-2 text-xs font-semibold ${state === 'new_product_pending' ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{state === 'new_product_pending' ? 'Novo produto — dados pendentes. Categoria, nome, unidade e preço de venda são obrigatórios.' : 'Novo produto — pronto para gravar. O custo inicial será o custo da nota.'}</p>
    </div>}
  </div>;
};
