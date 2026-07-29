import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export type RecommendationType = 'reposicao' | 'estoque_parado';
export type RecommendationPriority = 'critica' | 'alta' | 'media' | 'baixa' | 'sem_acao';
export type RecommendationConfidence = 'alta' | 'media' | 'baixa';
export type RecommendationStatus = 'active' | 'dismissed' | 'postponed' | 'resolved';
export type RecommendationActionType = 'dismissed' | 'postponed' | 'resolved';

export type AnalysisPeriodDays = 7 | 30 | 60 | 90;
export type TargetCoverageDays = 7 | 14 | 30;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
/** Confiança "alta" exige janela mínima e mais de um evento de venda distinto — um único pico não vira tendência confiável. */
const MIN_DAYS_FOR_HIGH_CONFIDENCE = 14;
const MIN_SALE_DAYS_FOR_HIGH_CONFIDENCE = 3;
/** Estoque parado "há muito tempo" quando o produto passa 2x a janela de análise sem nenhuma saída. */
const STOPPED_LONG_PERIOD_MULTIPLIER = 2;

export interface StockRecommendationProductSource {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  unit: string;
  categoryId: string | null;
  categoryName: string;
  currentQuantity: number;
  minQuantity: number;
  costPrice: number;
}

export interface StockRecommendationSaleSource {
  productId: string;
  quantity: number;
  occurredAt: string;
}

export interface RecommendationStateSource {
  productId: string;
  recommendationType: RecommendationType;
  status: RecommendationStatus;
  postponedUntil: string | null;
}

export interface StockRecommendation {
  /** Identidade estável `${productId}:${type}` — usada para casar com o estado persistido. */
  id: string;
  productId: string;
  productName: string;
  sku: string;
  barcode: string;
  unit: string;
  categoryId: string | null;
  categoryName: string;
  type: RecommendationType;
  priority: RecommendationPriority;
  confidence: RecommendationConfidence;
  status: RecommendationStatus;
  postponedUntil: string | null;
  reasons: string[];
  suggestedAction: string;
  currentQuantity: number;
  minQuantity: number;
  costPrice: number;
  averageDailyDemand: number;
  coverageDays: number | null;
  estimatedRuptureDate: string | null;
  /** Sempre null: o sistema credita o estoque no ato da compra, não existe status de "em trânsito". */
  inTransitQuantity: null;
  suggestedQuantity: number | null;
  coverageAfterPurchase: number | null;
  daysWithoutExit: number | null;
  daysWithoutExitIsMinimum: boolean;
  lastExitAt: string | null;
  estimatedStoppedValue: number | null;
  /** Fornecedor mais recente usado para este produto (agregado em lote, sem N+1) — só para reposição. */
  supplierHint: SupplierHint | null;
}

export interface SupplierHint {
  supplierId: string;
  supplierName: string;
}

export interface StockRecommendationPurchaseSource {
  productId: string;
  supplierId: string;
  supplierName: string;
  occurredAt: string;
}

export interface StockRecommendationsSummary {
  productsAnalyzed: number;
  ruptureRiskCount: number;
  criticalCount: number;
  stoppedCount: number;
  estimatedReorderValue: number | null;
  averageCoverageDays: number | null;
}

export interface StockRecommendationsResult {
  period: { days: number; dateFrom: string; dateTo: string };
  targetCoverageDays: TargetCoverageDays;
  summary: StockRecommendationsSummary;
  categories: { id: string | null; name: string }[];
  recommendations: StockRecommendation[];
}

export interface BuildRecommendationsInput {
  products: StockRecommendationProductSource[];
  sales: StockRecommendationSaleSource[];
  purchases: StockRecommendationPurchaseSource[];
  states: RecommendationStateSource[];
  periodDays: AnalysisPeriodDays;
  targetCoverageDays: TargetCoverageDays;
  dateTo: Date;
  now?: Date;
}

const getDaysSince = (occurredAt: string, referenceIso: string): number =>
  Math.max(0, Math.floor((new Date(referenceIso).getTime() - new Date(occurredAt).getTime()) / MILLISECONDS_PER_DAY));

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + Math.ceil(days));
  return result;
};

const classifyConfidence = (quantitySold: number, distinctSaleDays: number, periodDays: number): RecommendationConfidence => {
  if (quantitySold > 0 && periodDays >= MIN_DAYS_FOR_HIGH_CONFIDENCE && distinctSaleDays >= MIN_SALE_DAYS_FOR_HIGH_CONFIDENCE) {
    return 'alta';
  }
  if (quantitySold > 0) return 'media';
  return 'baixa';
};

const classifyReposicaoPriority = (params: {
  currentQuantity: number;
  minQuantity: number;
  coverageDays: number | null;
  confidence: RecommendationConfidence;
  targetCoverageDays: number;
}): RecommendationPriority => {
  const { currentQuantity, minQuantity, coverageDays, confidence, targetCoverageDays } = params;

  if (currentQuantity === 0) return 'critica';

  if (confidence === 'baixa') {
    // Sem sinal de demanda — só a regra explícita de estoque mínimo, nunca uma urgência inventada.
    return currentQuantity <= minQuantity ? 'baixa' : 'sem_acao';
  }

  if (coverageDays === null) return 'sem_acao';
  if (coverageDays <= targetCoverageDays * 0.5) return 'alta';
  if (coverageDays <= targetCoverageDays) return 'media';
  if (minQuantity > 0 && currentQuantity <= minQuantity) return 'alta';
  return 'sem_acao';
};

const classifyEstoqueParadoPriority = (daysWithoutExit: number, periodDays: number): RecommendationPriority =>
  daysWithoutExit >= periodDays * STOPPED_LONG_PERIOD_MULTIPLIER ? 'media' : 'baixa';

const buildReposicaoReasons = (params: {
  currentQuantity: number;
  minQuantity: number;
  coverageDays: number | null;
  confidence: RecommendationConfidence;
  targetCoverageDays: number;
}): string[] => {
  const reasons: string[] = [];
  const { currentQuantity, minQuantity, coverageDays, confidence, targetCoverageDays } = params;

  if (currentQuantity === 0) reasons.push('Produto sem nenhuma unidade disponível em estoque.');
  if (minQuantity > 0 && currentQuantity <= minQuantity) reasons.push(`Estoque atual (${currentQuantity}) está no ou abaixo do mínimo configurado (${minQuantity}).`);
  if (coverageDays !== null) reasons.push(`Cobertura estimada de ${coverageDays.toFixed(1)} dia(s), abaixo da cobertura alvo de ${targetCoverageDays} dias.`);
  if (confidence === 'baixa') reasons.push('Sem histórico de vendas suficiente no período — recomendação baseada apenas no estoque mínimo cadastrado.');

  return reasons;
};

const findRecommendationState = (
  states: RecommendationStateSource[],
  productId: string,
  type: RecommendationType,
  nowIso: string,
): { status: RecommendationStatus; postponedUntil: string | null } => {
  const found = states.find((s) => s.productId === productId && s.recommendationType === type);
  if (!found) return { status: 'active', postponedUntil: null };

  if (found.status === 'postponed' && found.postponedUntil && found.postponedUntil < nowIso) {
    return { status: 'active', postponedUntil: null };
  }
  return { status: found.status, postponedUntil: found.postponedUntil };
};

export const buildStockRecommendations = (input: BuildRecommendationsInput): StockRecommendationsResult => {
  const { products, sales, purchases, states, periodDays, targetCoverageDays, dateTo } = input;
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const dateToIso = dateTo.toISOString();

  const salesByProduct = new Map<string, { quantity: number; lastExitAt: string | null; saleDays: Set<string> }>();
  sales.forEach((sale) => {
    if (!Number.isFinite(sale.quantity) || sale.quantity <= 0) return;
    const current = salesByProduct.get(sale.productId) ?? { quantity: 0, lastExitAt: null, saleDays: new Set<string>() };
    current.quantity += sale.quantity;
    if (!current.lastExitAt || sale.occurredAt > current.lastExitAt) current.lastExitAt = sale.occurredAt;
    current.saleDays.add(sale.occurredAt.slice(0, 10));
    salesByProduct.set(sale.productId, current);
  });

  const latestSupplierByProduct = new Map<string, SupplierHint & { occurredAt: string }>();
  purchases.forEach((purchase) => {
    const current = latestSupplierByProduct.get(purchase.productId);
    if (!current || purchase.occurredAt > current.occurredAt) {
      latestSupplierByProduct.set(purchase.productId, {
        supplierId: purchase.supplierId,
        supplierName: purchase.supplierName,
        occurredAt: purchase.occurredAt,
      });
    }
  });

  const recommendations: StockRecommendation[] = [];
  const categoriesMap = new Map<string, { id: string | null; name: string }>();

  products.forEach((product) => {
    categoriesMap.set(product.categoryId ?? `name:${product.categoryName}`, { id: product.categoryId, name: product.categoryName });

    const saleInfo = salesByProduct.get(product.id);
    const quantitySold = saleInfo?.quantity ?? 0;
    const distinctSaleDays = saleInfo?.saleDays.size ?? 0;
    const lastExitAt = saleInfo?.lastExitAt ?? null;
    const averageDailyDemand = quantitySold / periodDays;
    const coverageDays = averageDailyDemand > 0 ? Math.max(0, product.currentQuantity) / averageDailyDemand : null;
    const estimatedRuptureDate = coverageDays !== null ? addDays(dateTo, coverageDays).toISOString() : null;
    const hasReliableCost = Number.isFinite(product.costPrice) && product.costPrice > 0;

    // --- Reposição (risco de ruptura + quantidade sugerida) ---
    const hasReplenishmentSignal = product.minQuantity > 0 || averageDailyDemand > 0;
    if (hasReplenishmentSignal) {
      const confidence = classifyConfidence(quantitySold, distinctSaleDays, periodDays);
      const needsReplenishment =
        product.currentQuantity <= product.minQuantity || (coverageDays !== null && coverageDays <= targetCoverageDays);

      if (needsReplenishment) {
        const desiredStock = Math.max(product.minQuantity, averageDailyDemand * targetCoverageDays);
        const suggestedQuantity = Math.max(0, Math.round((desiredStock - product.currentQuantity) * 1000) / 1000);
        const coverageAfterPurchase =
          averageDailyDemand > 0 ? (product.currentQuantity + suggestedQuantity) / averageDailyDemand : null;
        const priority = classifyReposicaoPriority({
          currentQuantity: product.currentQuantity,
          minQuantity: product.minQuantity,
          coverageDays,
          confidence,
          targetCoverageDays,
        });
        const state = findRecommendationState(states, product.id, 'reposicao', nowIso);

        recommendations.push({
          id: `${product.id}:reposicao`,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          barcode: product.barcode,
          unit: product.unit,
          categoryId: product.categoryId,
          categoryName: product.categoryName,
          type: 'reposicao',
          priority,
          confidence,
          status: state.status,
          postponedUntil: state.postponedUntil,
          reasons: buildReposicaoReasons({
            currentQuantity: product.currentQuantity,
            minQuantity: product.minQuantity,
            coverageDays,
            confidence,
            targetCoverageDays,
          }),
          suggestedAction:
            product.currentQuantity === 0
              ? 'Comprar com urgência — produto sem estoque disponível.'
              : `Planejar compra de ${suggestedQuantity} ${product.unit} para atingir a cobertura alvo.`,
          currentQuantity: product.currentQuantity,
          minQuantity: product.minQuantity,
          costPrice: product.costPrice,
          averageDailyDemand,
          coverageDays,
          estimatedRuptureDate,
          inTransitQuantity: null,
          suggestedQuantity,
          coverageAfterPurchase,
          daysWithoutExit: null,
          daysWithoutExitIsMinimum: false,
          lastExitAt,
          estimatedStoppedValue: null,
          supplierHint: latestSupplierByProduct.has(product.id)
            ? {
                supplierId: latestSupplierByProduct.get(product.id)!.supplierId,
                supplierName: latestSupplierByProduct.get(product.id)!.supplierName,
              }
            : null,
        });
      }
    }

    // --- Estoque parado/excessivo ---
    const isStopped = quantitySold === 0 && product.currentQuantity > 0;
    if (isStopped) {
      const daysWithoutExit = lastExitAt ? getDaysSince(lastExitAt, dateToIso) : periodDays;
      const daysWithoutExitIsMinimum = !lastExitAt;
      const estimatedStoppedValue = hasReliableCost ? Math.max(0, product.currentQuantity) * product.costPrice : null;
      const priority = classifyEstoqueParadoPriority(daysWithoutExit, periodDays);
      const state = findRecommendationState(states, product.id, 'estoque_parado', nowIso);

      recommendations.push({
        id: `${product.id}:estoque_parado`,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        barcode: product.barcode,
        unit: product.unit,
        categoryId: product.categoryId,
        categoryName: product.categoryName,
        type: 'estoque_parado',
        priority,
        confidence: 'alta', // "sem saída" é um fato observado diretamente, não uma estimativa
        status: state.status,
        postponedUntil: state.postponedUntil,
        reasons: [
          daysWithoutExitIsMinimum
            ? `Nenhuma saída registrada nos últimos ${periodDays} dias (ou mais — sem venda anterior encontrada).`
            : `${daysWithoutExit} dia(s) sem nenhuma saída válida.`,
        ],
        suggestedAction:
          daysWithoutExit >= periodDays * STOPPED_LONG_PERIOD_MULTIPLIER
            ? 'Revisar cadastro do produto ou considerar descontinuação.'
            : 'Avaliar promoção, redução de reposição futura ou revisão de cadastro.',
        currentQuantity: product.currentQuantity,
        minQuantity: product.minQuantity,
        costPrice: product.costPrice,
        averageDailyDemand,
        coverageDays: null,
        estimatedRuptureDate: null,
        inTransitQuantity: null,
        suggestedQuantity: null,
        coverageAfterPurchase: null,
        daysWithoutExit,
        daysWithoutExitIsMinimum,
        lastExitAt,
        estimatedStoppedValue,
        supplierHint: null,
      });
    }
  });

  const coverageValues = recommendations
    .map((r) => r.coverageDays)
    .filter((c): c is number => c !== null && Number.isFinite(c));

  const reorderValues = recommendations.filter((r) => r.type === 'reposicao' && r.costPrice > 0 && r.suggestedQuantity);
  const estimatedReorderValue =
    reorderValues.length > 0
      ? reorderValues.reduce((sum, r) => sum + (r.suggestedQuantity ?? 0) * r.costPrice, 0)
      : null;

  const summary: StockRecommendationsSummary = {
    productsAnalyzed: products.length,
    ruptureRiskCount: recommendations.filter((r) => r.type === 'reposicao').length,
    criticalCount: recommendations.filter((r) => r.priority === 'critica').length,
    stoppedCount: recommendations.filter((r) => r.type === 'estoque_parado').length,
    estimatedReorderValue,
    averageCoverageDays: coverageValues.length > 0 ? coverageValues.reduce((s, c) => s + c, 0) / coverageValues.length : null,
  };

  return {
    period: { days: periodDays, dateFrom: addDays(dateTo, -periodDays).toISOString(), dateTo: dateToIso },
    targetCoverageDays,
    summary,
    categories: Array.from(categoriesMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    recommendations,
  };
};

// ---------------------------------------------------------------------------
// Busca assíncrona (Supabase) — escopada por company_id
// ---------------------------------------------------------------------------

interface ProductRow {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  unit: string;
  category_id: string | null;
  current_quantity: number | string;
  min_quantity: number | string;
  cost_price: number | string;
  categories?: { name?: string } | null;
}

interface SaleItemRow {
  product_id: string;
  quantity: number | string;
  sales: { created_at: string } | null;
}

interface RecommendationStateRow {
  product_id: string;
  recommendation_type: RecommendationType;
  status: RecommendationStatus;
  postponed_until: string | null;
}

interface PurchaseItemForHintRow {
  product_id: string;
  purchases: { supplier_id: string; created_at: string; suppliers: { name?: string } | null } | null;
}

const PAGE_SIZE = 1000;

const fetchAllPages = async <T>(
  queryBuilder: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> => {
  const rows: T[] = [];
  let page = 0;
  // Protege contra loop infinito em caso de resposta inesperada do backend.
  const MAX_PAGES = 200;

  while (page < MAX_PAGES) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await queryBuilder(from, to);
    if (error) throw error;
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    page += 1;
  }

  return rows;
};

export interface StockRecommendationsQuery {
  analysisPeriodDays: AnalysisPeriodDays;
  targetCoverageDays: TargetCoverageDays;
}

export const getStockRecommendations = async (query: StockRecommendationsQuery): Promise<StockRecommendationsResult> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const dateTo = new Date();
  const dateFrom = new Date(dateTo);
  dateFrom.setDate(dateFrom.getDate() - query.analysisPeriodDays + 1);
  dateFrom.setHours(0, 0, 0, 0);

  // As quatro buscas são independentes entre si — executadas em paralelo
  // para não somar a latência de cada uma (cada fetchAllPages já pagina
  // internamente de forma sequencial, o que é necessário).
  const [productsRows, saleItemsRows, statesRows, purchaseItemsRows] = await Promise.all([
    fetchAllPages<ProductRow>((from, to) =>
      supabase
        .from('products')
        .select('id, name, sku, barcode, unit, category_id, current_quantity, min_quantity, cost_price, categories(name)')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name', { ascending: true })
        .range(from, to),
    ),
    fetchAllPages<SaleItemRow>((from, to) =>
      supabase
        .from('sale_items')
        .select('product_id, quantity, sales!inner(company_id, payment_status, created_at)')
        .eq('sales.company_id', companyId)
        .neq('sales.payment_status', 'cancelled')
        .gte('sales.created_at', dateFrom.toISOString())
        .lte('sales.created_at', dateTo.toISOString())
        .range(from, to),
    ),
    fetchAllPages<RecommendationStateRow>((from, to) =>
      supabase
        .from('stock_recommendation_states')
        .select('product_id, recommendation_type, status, postponed_until')
        .eq('company_id', companyId)
        .range(from, to),
    ),
    // Histórico completo de compras (não limitado ao período de análise de
    // consumo) apenas para saber qual foi o fornecedor mais recente por
    // produto — usado no filtro por fornecedor e como dica na listagem.
    fetchAllPages<PurchaseItemForHintRow>((from, to) =>
      supabase
        .from('purchase_items')
        .select('product_id, purchases!inner(company_id, supplier_id, created_at, suppliers(name))')
        .eq('purchases.company_id', companyId)
        .range(from, to),
    ),
  ]);

  const products: StockRecommendationProductSource[] = productsRows.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode || '',
    unit: p.unit,
    categoryId: p.category_id,
    categoryName: p.categories?.name || 'Geral',
    currentQuantity: Number(p.current_quantity || 0),
    minQuantity: Number(p.min_quantity || 0),
    costPrice: Number(p.cost_price || 0),
  }));

  const sales: StockRecommendationSaleSource[] = saleItemsRows
    .filter((s) => !!s.sales?.created_at)
    .map((s) => ({
      productId: s.product_id,
      quantity: Number(s.quantity || 0),
      occurredAt: s.sales!.created_at,
    }));

  const states: RecommendationStateSource[] = statesRows.map((s) => ({
    productId: s.product_id,
    recommendationType: s.recommendation_type,
    status: s.status,
    postponedUntil: s.postponed_until,
  }));

  const purchases: StockRecommendationPurchaseSource[] = purchaseItemsRows
    .filter((row) => !!row.purchases)
    .map((row) => ({
      productId: row.product_id,
      supplierId: row.purchases!.supplier_id,
      supplierName: row.purchases!.suppliers?.name || 'Fornecedor',
      occurredAt: row.purchases!.created_at,
    }));

  return buildStockRecommendations({
    products,
    sales,
    purchases,
    states,
    periodDays: query.analysisPeriodDays,
    targetCoverageDays: query.targetCoverageDays,
    dateTo,
  });
};

// ---------------------------------------------------------------------------
// Sugestão de fornecedor (sob demanda, por produto — nunca na listagem principal)
// ---------------------------------------------------------------------------

export interface SupplierSuggestion {
  supplierId: string;
  supplierName: string;
  lastUnitCost: number;
  lastPurchaseAt: string;
  purchaseCount: number;
}

interface PurchaseItemForSupplierRow {
  unit_cost: number | string;
  purchases: { supplier_id: string; created_at: string; suppliers: { name?: string } | null } | null;
}

export const getProductSupplierSuggestion = async (productId: string): Promise<SupplierSuggestion | null> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const { data, error } = await supabase
    .from('purchase_items')
    .select('unit_cost, purchases!inner(company_id, supplier_id, created_at, suppliers(name))')
    .eq('product_id', productId)
    .eq('purchases.company_id', companyId)
    .returns<PurchaseItemForSupplierRow[]>();

  if (error) throw error;

  const rows = (data || []).filter((row) => !!row.purchases);
  if (rows.length === 0) return null;

  const sorted = [...rows].sort((a, b) => (b.purchases!.created_at || '').localeCompare(a.purchases!.created_at || ''));
  const latest = sorted[0];
  const purchaseCount = sorted.filter((row) => row.purchases!.supplier_id === latest.purchases!.supplier_id).length;

  return {
    supplierId: latest.purchases!.supplier_id,
    supplierName: latest.purchases!.suppliers?.name || 'Fornecedor',
    lastUnitCost: Number(latest.unit_cost || 0),
    lastPurchaseAt: latest.purchases!.created_at,
    purchaseCount,
  };
};

// ---------------------------------------------------------------------------
// Ações do usuário (dispensar / adiar / resolver) — persistem estado e
// histórico append-only. Nunca apagam recomendações anteriores.
// ---------------------------------------------------------------------------

export interface RecommendationActionSnapshot {
  priority: RecommendationPriority;
  currentQuantity: number;
  coverageDays: number | null;
}

export interface RecommendationActionInput {
  productId: string;
  recommendationType: RecommendationType;
  reason?: string;
  snapshot?: RecommendationActionSnapshot;
}

const upsertRecommendationState = async (params: {
  companyId: string;
  userId?: string;
  productId: string;
  recommendationType: RecommendationType;
  status: RecommendationStatus;
  postponedUntil: string | null;
}): Promise<void> => {
  const { error } = await supabase.from('stock_recommendation_states').upsert(
    {
      id: crypto.randomUUID(),
      company_id: params.companyId,
      product_id: params.productId,
      recommendation_type: params.recommendationType,
      status: params.status,
      postponed_until: params.postponedUntil,
      updated_by: params.userId || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id,product_id,recommendation_type' },
  );
  if (error) throw error;
};

const insertRecommendationAction = async (params: {
  companyId: string;
  userId?: string;
  productId: string;
  recommendationType: RecommendationType;
  action: RecommendationActionType;
  reason?: string;
  snapshot?: RecommendationActionSnapshot;
}): Promise<void> => {
  const { error } = await supabase.from('stock_recommendation_actions').insert({
    id: crypto.randomUUID(),
    company_id: params.companyId,
    product_id: params.productId,
    recommendation_type: params.recommendationType,
    action: params.action,
    reason: params.reason || null,
    snapshot_priority: params.snapshot?.priority || null,
    snapshot_current_quantity: params.snapshot?.currentQuantity ?? null,
    snapshot_coverage_days: params.snapshot?.coverageDays ?? null,
    performed_by: params.userId || null,
    performed_at: new Date().toISOString(),
  });
  if (error) throw error;
};

const requireCompanyAndUser = (): { companyId: string; userId?: string } => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');
  const userId = useAuthStore.getState().profile?.id;
  return { companyId, userId };
};

export const dismissRecommendation = async (input: RecommendationActionInput): Promise<void> => {
  const { companyId, userId } = requireCompanyAndUser();
  await upsertRecommendationState({
    companyId,
    userId,
    productId: input.productId,
    recommendationType: input.recommendationType,
    status: 'dismissed',
    postponedUntil: null,
  });
  await insertRecommendationAction({
    companyId,
    userId,
    productId: input.productId,
    recommendationType: input.recommendationType,
    action: 'dismissed',
    reason: input.reason,
    snapshot: input.snapshot,
  });
};

export const postponeRecommendation = async (
  input: RecommendationActionInput & { days?: number },
): Promise<void> => {
  const { companyId, userId } = requireCompanyAndUser();
  const postponedUntil = new Date();
  postponedUntil.setDate(postponedUntil.getDate() + (input.days ?? 7));

  await upsertRecommendationState({
    companyId,
    userId,
    productId: input.productId,
    recommendationType: input.recommendationType,
    status: 'postponed',
    postponedUntil: postponedUntil.toISOString(),
  });
  await insertRecommendationAction({
    companyId,
    userId,
    productId: input.productId,
    recommendationType: input.recommendationType,
    action: 'postponed',
    reason: input.reason,
    snapshot: input.snapshot,
  });
};

export const resolveRecommendation = async (input: RecommendationActionInput): Promise<void> => {
  const { companyId, userId } = requireCompanyAndUser();
  await upsertRecommendationState({
    companyId,
    userId,
    productId: input.productId,
    recommendationType: input.recommendationType,
    status: 'resolved',
    postponedUntil: null,
  });
  await insertRecommendationAction({
    companyId,
    userId,
    productId: input.productId,
    recommendationType: input.recommendationType,
    action: 'resolved',
    reason: input.reason,
    snapshot: input.snapshot,
  });
};

export interface RecommendationActionLogEntry {
  id: string;
  recommendationType: RecommendationType;
  action: RecommendationActionType;
  reason: string | null;
  performedAt: string;
  performedByName: string | null;
}

interface RecommendationActionLogRow {
  id: string;
  recommendation_type: RecommendationType;
  action: RecommendationActionType;
  reason: string | null;
  performed_at: string;
  profiles: { name?: string } | null;
}

export const getRecommendationActionHistory = async (productId: string): Promise<RecommendationActionLogEntry[]> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const { data, error } = await supabase
    .from('stock_recommendation_actions')
    .select('id, recommendation_type, action, reason, performed_at, profiles(name)')
    .eq('company_id', companyId)
    .eq('product_id', productId)
    .order('performed_at', { ascending: false })
    .returns<RecommendationActionLogRow[]>();

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    recommendationType: row.recommendation_type,
    action: row.action,
    reason: row.reason,
    performedAt: row.performed_at,
    performedByName: row.profiles?.name || null,
  }));
};
