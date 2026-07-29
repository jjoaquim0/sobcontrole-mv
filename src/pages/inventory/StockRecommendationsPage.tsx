import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Layers,
  Lightbulb,
  Lock,
  PackageSearch,
  RefreshCcw,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatCard } from '../../components/shared/StatCard';
import { useAuth } from '../../hooks/useAuth';
import { useCategories } from '../../hooks/useInventory';
import { usePurchaseMutations } from '../../hooks/usePurchases';
import { CreatePurchaseInput } from '../../services/purchaseService';
import {
  useStockRecommendations,
  UseStockRecommendationsParams,
} from '../../hooks/useStockRecommendations';
import {
  AnalysisPeriodDays,
  RecommendationActionType,
  RecommendationPriority,
  RecommendationType,
  StockRecommendation,
  TargetCoverageDays,
} from '../../services/stockRecommendationsService';
import { RecommendationCard } from './components/RecommendationCard';
import { RecommendationDetailModal } from './components/RecommendationDetailModal';
import { RecommendationActionModal } from './components/RecommendationActionModal';
import { PurchaseModal, SelectedItem } from '../purchases/components/PurchaseModal';

const formatMoney = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const ANALYSIS_PERIOD_OPTIONS: { value: AnalysisPeriodDays; label: string }[] = [
  { value: 7, label: 'Últimos 7 dias' },
  { value: 30, label: 'Últimos 30 dias' },
  { value: 60, label: 'Últimos 60 dias' },
  { value: 90, label: 'Últimos 90 dias' },
];

const TARGET_COVERAGE_OPTIONS: { value: TargetCoverageDays; label: string }[] = [
  { value: 7, label: '7 dias de cobertura alvo' },
  { value: 14, label: '14 dias de cobertura alvo' },
  { value: 30, label: '30 dias de cobertura alvo' },
];

const PRIORITY_OPTIONS: { value: RecommendationPriority | 'all'; label: string }[] = [
  { value: 'all', label: 'Todas as prioridades' },
  { value: 'critica', label: 'Crítica' },
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Média' },
  { value: 'baixa', label: 'Baixa' },
  { value: 'sem_acao', label: 'Sem ação necessária' },
];

const TYPE_OPTIONS: { value: RecommendationType | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos os tipos' },
  { value: 'reposicao', label: 'Reposição recomendada' },
  { value: 'estoque_parado', label: 'Estoque parado' },
];

const CardSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-4 animate-pulse space-y-3">
    <div className="h-3 w-32 bg-gray-200 dark:bg-white/10 rounded" />
    <div className="h-4 w-48 bg-gray-200 dark:bg-white/10 rounded" />
    <div className="h-16 w-full bg-gray-100 dark:bg-white/5 rounded-xl" />
  </div>
);

export const StockRecommendationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { company, hasRole } = useAuth();
  const canCreatePurchaseDraft = hasRole(['admin', 'manager']);

  const [analysisPeriodDays, setAnalysisPeriodDays] = useState<AnalysisPeriodDays>(30);
  const [targetCoverageDays, setTargetCoverageDays] = useState<TargetCoverageDays>(14);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState<RecommendationPriority | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<RecommendationType | 'all'>('all');
  const [productSearch, setProductSearch] = useState('');
  const [showResolvedOrDismissed, setShowResolvedOrDismissed] = useState(false);

  const [detailTarget, setDetailTarget] = useState<StockRecommendation | null>(null);
  const [actionTarget, setActionTarget] = useState<{ recommendation: StockRecommendation; action: RecommendationActionType } | null>(null);
  const [draftPurchaseTarget, setDraftPurchaseTarget] = useState<StockRecommendation | null>(null);

  const params: UseStockRecommendationsParams = { analysisPeriodDays, targetCoverageDays };
  const { result, isLoading, isError, refetch, dataUpdatedAt, dismiss, isDismissing, postpone, isPostponing, resolve, isResolving } =
    useStockRecommendations(params);
  const { categories } = useCategories();
  const { createPurchase, isCreating: isCreatingPurchase } = usePurchaseMutations();

  const suppliers = useMemo(() => {
    if (!result) return [];
    const map = new Map<string, string>();
    result.recommendations.forEach((r) => {
      if (r.supplierHint) map.set(r.supplierHint.supplierId, r.supplierHint.supplierName);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [result]);

  const filteredRecommendations = useMemo(() => {
    if (!result) return [];
    const search = productSearch.trim().toLowerCase();

    return result.recommendations.filter((r) => {
      if (!showResolvedOrDismissed && r.status !== 'active') return false;
      if (categoryFilter !== 'all' && r.categoryId !== categoryFilter) return false;
      if (supplierFilter !== 'all' && r.supplierHint?.supplierId !== supplierFilter) return false;
      if (priorityFilter !== 'all' && r.priority !== priorityFilter) return false;
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      if (search && !r.productName.toLowerCase().includes(search) && !r.sku.toLowerCase().includes(search)) return false;
      return true;
    });
  }, [result, categoryFilter, supplierFilter, priorityFilter, typeFilter, productSearch, showResolvedOrDismissed]);

  const isFiltered =
    categoryFilter !== 'all' || supplierFilter !== 'all' || priorityFilter !== 'all' || typeFilter !== 'all' || productSearch !== '';

  const handleAction = async (reason?: string) => {
    if (!actionTarget) return;
    const { recommendation, action } = actionTarget;
    const snapshot = {
      priority: recommendation.priority,
      currentQuantity: recommendation.currentQuantity,
      coverageDays: recommendation.coverageDays,
    };
    const input = { productId: recommendation.productId, recommendationType: recommendation.type, reason, snapshot };

    if (action === 'dismissed') await dismiss(input);
    if (action === 'postponed') await postpone(input);
    if (action === 'resolved') await resolve(input);
    setActionTarget(null);
  };

  const handleCreateDraftPurchase = async (payload: CreatePurchaseInput) => {
    await createPurchase(payload);
    setDraftPurchaseTarget(null);
  };

  if (!company) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center">
        <Lock className="w-10 h-10 text-gray-300" />
        <h4 className="text-lg font-bold text-gray-900 dark:text-white">Acesso negado</h4>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
          Não foi possível identificar sua empresa. Faça login novamente para acessar as recomendações de estoque.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <button
        onClick={() => navigate('/inventory')}
        className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para Estoque
      </button>

      <PageHeader
        title="Recomendações de Estoque"
        subtitle="Priorize reposições e reduza riscos operacionais com base nos dados do seu negócio."
        action={
          <button
            type="button"
            onClick={() => refetch()}
            className="border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200"
          >
            <RefreshCcw className="w-4 h-4" />
            Atualizar
          </button>
        }
      />

      {/* Filtros e parâmetros de cálculo */}
      <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Buscar por produto ou SKU..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981]"
          />

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#1a1d27] text-xs font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] appearance-none cursor-pointer"
          >
            <option value="all">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#1a1d27] text-xs font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] appearance-none cursor-pointer"
          >
            <option value="all">Todos os fornecedores</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as RecommendationPriority | 'all')}
            className="px-3 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#1a1d27] text-xs font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] appearance-none cursor-pointer"
          >
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as RecommendationType | 'all')}
            className="px-3 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#1a1d27] text-xs font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] appearance-none cursor-pointer"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-white/5">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="text-[10px] uppercase font-semibold text-gray-400 block mb-1" title="Janela de tempo usada para calcular o consumo médio diário observado.">
                Período de análise de consumo
              </label>
              <select
                value={analysisPeriodDays}
                onChange={(e) => setAnalysisPeriodDays(Number(e.target.value) as AnalysisPeriodDays)}
                className="px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#1a1d27] text-xs font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] appearance-none cursor-pointer"
              >
                {ANALYSIS_PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-semibold text-gray-400 block mb-1" title="Quantos dias de estoque futuro a quantidade sugerida tenta garantir. Ajustável — não é uma configuração salva da empresa.">
                Cobertura alvo
              </label>
              <select
                value={targetCoverageDays}
                onChange={(e) => setTargetCoverageDays(Number(e.target.value) as TargetCoverageDays)}
                className="px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#1a1d27] text-xs font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] appearance-none cursor-pointer"
              >
                {TARGET_COVERAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer mt-4">
              <input
                type="checkbox"
                checked={showResolvedOrDismissed}
                onChange={(e) => setShowResolvedOrDismissed(e.target.checked)}
                className="rounded border-gray-300 text-[#10b981] focus:ring-[#10b981]"
              />
              Mostrar dispensadas/adiadas/resolvidas
            </label>
          </div>

          <p className="text-[11px] text-gray-400 dark:text-white/40 flex items-center gap-1.5">
            <CalendarClock className="w-3.5 h-3.5" />
            {dataUpdatedAt
              ? `Última atualização às ${new Date(dataUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
              : 'Carregando...'}
          </p>
        </div>
      </div>

      {isError ? (
        <div className="flex flex-col items-center justify-center bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-10 shadow-sm text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mb-3" />
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-lg mb-1">Não foi possível carregar as recomendações</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-6">
            Ocorreu um problema ao consultar os dados. Verifique sua conexão e tente novamente.
          </p>
          <button
            onClick={() => refetch()}
            className="bg-red-500 hover:bg-red-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium transition-colors duration-200"
          >
            Tentar novamente
          </button>
        </div>
      ) : isLoading || !result ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="panel-glass rounded-2xl p-5 animate-pulse">
                <div className="h-3 w-20 bg-gray-200 dark:bg-white/10 rounded mb-3" />
                <div className="h-6 w-16 bg-gray-200 dark:bg-white/10 rounded" />
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Resumo executivo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            <StatCard title="Risco de Ruptura" value={result.summary.ruptureRiskCount} icon={<ShieldAlert className="w-5 h-5" />} accentColor="yellow" />
            <StatCard title="Recomendações Críticas" value={result.summary.criticalCount} icon={<AlertTriangle className="w-5 h-5" />} accentColor="red" />
            <StatCard
              title="Valor Estimado p/ Reposição"
              value={result.summary.estimatedReorderValue !== null ? formatMoney(result.summary.estimatedReorderValue) : 'Sem custo confiável'}
              icon={<Wallet className="w-5 h-5" />}
              accentColor="blue"
            />
            <StatCard title="Produtos Parados" value={result.summary.stoppedCount} icon={<PackageSearch className="w-5 h-5" />} accentColor="purple" />
            <StatCard
              title="Cobertura Média"
              value={result.summary.averageCoverageDays !== null ? `${result.summary.averageCoverageDays.toFixed(1)} dias` : 'Indisponível'}
              icon={<Layers className="w-5 h-5" />}
              accentColor="green"
            />
          </div>

          {/* Lista de recomendações */}
          {filteredRecommendations.length === 0 ? (
            <div className="flex flex-col items-center justify-center bg-white dark:bg-[#1a1d27] border border-dashed border-gray-200 dark:border-white/10 rounded-2xl p-12 text-center">
              <Lightbulb className="w-10 h-10 text-gray-300 dark:text-white/15 mb-3" />
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                {isFiltered ? 'Nenhuma recomendação encontrada' : 'Não há recomendações críticas no momento'}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mt-1">
                {isFiltered
                  ? 'Ajuste os filtros selecionados para ver outras recomendações.'
                  : 'Continue registrando vendas, compras e movimentações para melhorar as sugestões.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRecommendations.map((r) => (
                <RecommendationCard
                  key={r.id}
                  recommendation={r}
                  canCreatePurchaseDraft={canCreatePurchaseDraft}
                  onOpenDetail={() => setDetailTarget(r)}
                  onDismiss={() => setActionTarget({ recommendation: r, action: 'dismissed' })}
                  onPostpone={() => setActionTarget({ recommendation: r, action: 'postponed' })}
                  onResolve={() => setActionTarget({ recommendation: r, action: 'resolved' })}
                  onCreateDraftPurchase={() => setDraftPurchaseTarget(r)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <RecommendationDetailModal
        recommendation={detailTarget}
        isOpen={detailTarget !== null}
        onClose={() => setDetailTarget(null)}
      />

      <RecommendationActionModal
        isOpen={actionTarget !== null}
        action={actionTarget?.action ?? null}
        productName={actionTarget?.recommendation.productName}
        onClose={() => setActionTarget(null)}
        onConfirm={handleAction}
        isLoading={isDismissing || isPostponing || isResolving}
      />

      <PurchaseModal
        isOpen={draftPurchaseTarget !== null}
        onClose={() => setDraftPurchaseTarget(null)}
        onSave={handleCreateDraftPurchase}
        isLoading={isCreatingPurchase}
        initialSupplierId={draftPurchaseTarget?.supplierHint?.supplierId}
        initialItems={
          draftPurchaseTarget
            ? ([
                {
                  productId: draftPurchaseTarget.productId,
                  name: draftPurchaseTarget.productName,
                  sku: draftPurchaseTarget.sku,
                  currentStock: draftPurchaseTarget.currentQuantity,
                  quantity: Math.max(1, draftPurchaseTarget.suggestedQuantity || 1),
                  unitCost: draftPurchaseTarget.costPrice,
                  subtotal: Math.max(1, draftPurchaseTarget.suggestedQuantity || 1) * draftPurchaseTarget.costPrice,
                },
              ] as SelectedItem[])
            : undefined
        }
      />
    </div>
  );
};

export default StockRecommendationsPage;
