import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, History, Info, ShoppingCart, XCircle } from 'lucide-react';
import {
  RecommendationConfidence,
  RecommendationPriority,
  StockRecommendation,
} from '../../../services/stockRecommendationsService';

const formatMoney = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const PRIORITY_CONFIG: Record<RecommendationPriority, { label: string; classes: string; icon: React.ElementType }> = {
  critica: { label: 'Crítica', classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle },
  alta: { label: 'Alta', classes: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: AlertTriangle },
  media: { label: 'Média', classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
  baixa: { label: 'Baixa', classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Info },
  sem_acao: { label: 'Sem ação necessária', classes: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400', icon: CheckCircle2 },
};

const CONFIDENCE_CONFIG: Record<RecommendationConfidence, { label: string; classes: string }> = {
  alta: { label: 'Confiança alta', classes: 'text-emerald-600 dark:text-emerald-400' },
  media: { label: 'Confiança média', classes: 'text-amber-600 dark:text-amber-400' },
  baixa: { label: 'Confiança baixa', classes: 'text-gray-500 dark:text-gray-400' },
};

export interface RecommendationCardProps {
  recommendation: StockRecommendation;
  canCreatePurchaseDraft: boolean;
  onOpenDetail: () => void;
  onDismiss: () => void;
  onPostpone: () => void;
  onResolve: () => void;
  onCreateDraftPurchase: () => void;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation: r,
  canCreatePurchaseDraft,
  onOpenDetail,
  onDismiss,
  onPostpone,
  onResolve,
  onCreateDraftPurchase,
}) => {
  const navigate = useNavigate();
  const priorityConfig = PRIORITY_CONFIG[r.priority];
  const PriorityIcon = priorityConfig.icon;
  const isReposicao = r.type === 'reposicao';
  const isActionable = r.status === 'active';

  return (
    <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${priorityConfig.classes}`}>
              <PriorityIcon className="w-3 h-3" /> {priorityConfig.label}
            </span>
            <span className="text-[11px] text-gray-400 dark:text-white/40">
              {isReposicao ? 'Reposição recomendada' : 'Estoque parado'}
            </span>
            <span
              className={`text-[10px] font-semibold ${CONFIDENCE_CONFIG[r.confidence].classes}`}
              title="Nível de confiança da recomendação, baseado na robustez dos dados disponíveis (histórico de vendas e estoque mínimo)."
            >
              {CONFIDENCE_CONFIG[r.confidence].label}
            </span>
            {!isActionable && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400">
                {r.status === 'dismissed' && 'Dispensada'}
                {r.status === 'resolved' && 'Resolvida'}
                {r.status === 'postponed' && r.postponedUntil && `Adiada até ${formatDate(r.postponedUntil)}`}
              </span>
            )}
          </div>
          <button type="button" onClick={onOpenDetail} className="text-left group">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-[#10b981] transition-colors">
              {r.productName}
            </h4>
            <p className="text-[11px] font-mono text-gray-400">
              {r.sku}
              {r.barcode ? ` · ${r.barcode}` : ''}
            </p>
          </button>
        </div>

        <div className="text-right shrink-0">
          <span className="text-[10px] uppercase font-semibold text-gray-400 block">Estoque atual</span>
          <span className={`text-lg font-bold ${r.currentQuantity === 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
            {r.currentQuantity} {r.unit}
          </span>
        </div>
      </div>

      {isReposicao ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-gray-50 dark:bg-white/[0.02] rounded-xl p-3">
          <div>
            <span className="text-gray-400 block" title="Quantidade média vendida por dia no período de análise, com base em vendas válidas.">
              Consumo médio/dia
            </span>
            <span className="font-bold text-gray-900 dark:text-white">
              {r.averageDailyDemand > 0 ? r.averageDailyDemand.toFixed(2) : 'Sem consumo'}
            </span>
          </div>
          <div>
            <span className="text-gray-400 block" title="Estoque atual dividido pelo consumo médio diário — quantos dias o estoque atual ainda dura.">
              Cobertura
            </span>
            <span className="font-bold text-gray-900 dark:text-white">
              {r.coverageDays !== null ? `${r.coverageDays.toFixed(1)} dias` : 'Indisponível'}
            </span>
          </div>
          <div>
            <span className="text-gray-400 block" title="Quantidade calculada para atingir a cobertura alvo definida no filtro, respeitando o estoque mínimo.">
              Qtd. sugerida
            </span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{r.suggestedQuantity ?? 0} {r.unit}</span>
          </div>
          <div>
            <span className="text-gray-400 block">Ruptura estimada</span>
            <span className="font-bold text-gray-900 dark:text-white">
              {r.estimatedRuptureDate ? formatDate(r.estimatedRuptureDate) : 'Não calculável'}
            </span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-gray-50 dark:bg-white/[0.02] rounded-xl p-3">
          <div>
            <span className="text-gray-400 block">Dias sem saída</span>
            <span className="font-bold text-gray-900 dark:text-white">
              {r.daysWithoutExitIsMinimum ? `${r.daysWithoutExit}+ dias` : `${r.daysWithoutExit} dias`}
            </span>
          </div>
          <div>
            <span className="text-gray-400 block">Última saída</span>
            <span className="font-bold text-gray-900 dark:text-white">{r.lastExitAt ? formatDate(r.lastExitAt) : 'Sem registro'}</span>
          </div>
          <div>
            <span className="text-gray-400 block" title="Estoque atual multiplicado pelo custo de aquisição — só calculado quando há custo confiável cadastrado.">
              Valor parado
            </span>
            <span className="font-bold text-gray-900 dark:text-white">
              {r.estimatedStoppedValue !== null ? formatMoney(r.estimatedStoppedValue) : 'Custo não confiável'}
            </span>
          </div>
        </div>
      )}

      {r.reasons.length > 0 && (
        <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1 list-disc list-inside">
          {r.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}

      {isReposicao && (
        <p className="text-[11px] text-gray-400 dark:text-white/40">
          Fornecedor sugerido:{' '}
          <span className="font-semibold text-gray-600 dark:text-gray-300">
            {r.supplierHint ? r.supplierHint.supplierName : 'Não há dados suficientes para recomendar um fornecedor.'}
          </span>
        </p>
      )}

      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10 rounded-xl px-3 py-2">
        {r.suggestedAction}
      </p>

      <div className="flex items-center flex-wrap gap-x-4 gap-y-2 pt-2 border-t border-gray-100 dark:border-white/5">
        <button
          type="button"
          onClick={() => navigate(`/inventory/${r.productId}`)}
          className="text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white flex items-center gap-1"
        >
          Ver produto
        </button>
        <button
          type="button"
          onClick={onOpenDetail}
          className="text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white flex items-center gap-1"
        >
          <History className="w-3.5 h-3.5" /> Ver histórico
        </button>
        {isReposicao && canCreatePurchaseDraft && (
          <button
            type="button"
            onClick={onCreateDraftPurchase}
            className="text-xs font-semibold text-[#10b981] hover:underline flex items-center gap-1"
          >
            <ShoppingCart className="w-3.5 h-3.5" /> Criar rascunho de compra
          </button>
        )}

        {isActionable && (
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onDismiss}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-white/5 dark:hover:text-gray-200 transition-colors"
              title="Dispensar"
            >
              <XCircle className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onPostpone}
              className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
              title="Adiar por 7 dias"
            >
              <Clock className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onResolve}
              className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
              title="Marcar como resolvida"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecommendationCard;
