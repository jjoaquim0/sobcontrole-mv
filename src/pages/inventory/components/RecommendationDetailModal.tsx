import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Calculator, Clock, Info, Loader2, Package, Truck, User, X } from 'lucide-react';
import { StockRecommendation } from '../../../services/stockRecommendationsService';
import { useProductDetails } from '../../../hooks/useInventory';
import { useProductSupplierSuggestion, useRecommendationActionHistory } from '../../../hooks/useStockRecommendations';

const formatMoney = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const ACTION_LABELS: Record<string, string> = {
  dismissed: 'Dispensada',
  postponed: 'Adiada por 7 dias',
  resolved: 'Marcada como resolvida',
};

export interface RecommendationDetailModalProps {
  recommendation: StockRecommendation | null;
  isOpen: boolean;
  onClose: () => void;
}

export const RecommendationDetailModal: React.FC<RecommendationDetailModalProps> = ({ recommendation, isOpen, onClose }) => {
  const navigate = useNavigate();
  const productId = recommendation?.productId ?? null;

  const { data: productDetail, isLoading: isProductLoading } = useProductDetails(isOpen ? productId || '' : '');
  const { suggestion, isLoading: isSupplierLoading } = useProductSupplierSuggestion(isOpen ? productId : null);
  const { history, isLoading: isHistoryLoading } = useRecommendationActionHistory(isOpen ? productId : null);

  if (!recommendation) return null;
  const r = recommendation;
  const isReposicao = r.type === 'reposicao';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/55 backdrop-blur-sm"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 shadow-2xl p-6 w-full max-w-3xl z-10 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-start mb-5 border-b border-gray-100 dark:border-white/5 pb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{r.productName}</h3>
                <p className="text-xs font-mono text-gray-400 mt-0.5">
                  {r.sku}
                  {r.barcode ? ` · ${r.barcode}` : ''} · {r.categoryName}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Cálculo resumido */}
              <section className="bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calculator className="w-4 h-4 text-[#10b981]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Critérios e cálculo usados
                  </h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-gray-400 block">Estoque atual</span>
                    <span className="font-bold text-gray-900 dark:text-white">{r.currentQuantity} {r.unit}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Estoque mínimo</span>
                    <span className="font-bold text-gray-900 dark:text-white">{r.minQuantity} {r.unit}</span>
                  </div>
                  {isReposicao && (
                    <>
                      <div>
                        <span className="text-gray-400 block">Consumo médio/dia</span>
                        <span className="font-bold text-gray-900 dark:text-white">
                          {r.averageDailyDemand > 0 ? r.averageDailyDemand.toFixed(2) : 'Sem consumo no período'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Cobertura atual</span>
                        <span className="font-bold text-gray-900 dark:text-white">
                          {r.coverageDays !== null ? `${r.coverageDays.toFixed(1)} dias` : 'Indisponível'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Cobertura após compra sugerida</span>
                        <span className="font-bold text-gray-900 dark:text-white">
                          {r.coverageAfterPurchase !== null ? `${r.coverageAfterPurchase.toFixed(1)} dias` : 'Indisponível'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Quantidade sugerida</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{r.suggestedQuantity ?? 0} {r.unit}</span>
                      </div>
                    </>
                  )}
                  {!isReposicao && (
                    <>
                      <div>
                        <span className="text-gray-400 block">Dias sem saída</span>
                        <span className="font-bold text-gray-900 dark:text-white">
                          {r.daysWithoutExitIsMinimum ? `${r.daysWithoutExit}+ dias (mínimo do período)` : `${r.daysWithoutExit} dias`}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Valor estimado parado</span>
                        <span className="font-bold text-gray-900 dark:text-white">
                          {r.estimatedStoppedValue !== null ? formatMoney(r.estimatedStoppedValue) : 'Sem custo confiável cadastrado'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                <ul className="text-xs text-gray-600 dark:text-gray-300 mt-3 space-y-1 list-disc list-inside">
                  {r.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </section>

              {/* Compras pendentes / em trânsito */}
              <section className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400 bg-blue-50/50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/10 rounded-xl p-3">
                <Truck className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
                <p>
                  <strong className="text-gray-700 dark:text-gray-300">Compras pendentes/em trânsito:</strong> não aplicável — o
                  SobControle credita o estoque no momento em que a compra é registrada, não existe um status separado de
                  "recebimento" para acompanhar mercadoria em trânsito.
                </p>
              </section>

              {/* Sugestão de fornecedor */}
              {isReposicao && (
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-[#10b981]" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                      Fornecedor sugerido
                    </h4>
                  </div>
                  {isSupplierLoading ? (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando histórico de compras...
                    </div>
                  ) : suggestion ? (
                    <div className="bg-white dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-xl p-3 text-xs flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-gray-900 dark:text-white block">{suggestion.supplierName}</span>
                        <span className="text-gray-400">
                          Última compra em {formatDate(suggestion.lastPurchaseAt)} · {suggestion.purchaseCount}{' '}
                          {suggestion.purchaseCount === 1 ? 'compra registrada' : 'compras registradas'} deste produto
                        </span>
                      </div>
                      <span className="font-bold text-gray-900 dark:text-white">Custo mais recente: {formatMoney(suggestion.lastUnitCost)}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 shrink-0" /> Não há dados suficientes para recomendar um fornecedor.
                    </p>
                  )}
                </section>
              )}

              {/* Histórico de estoque */}
              <section className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-gray-400" />
                <p>
                  <strong className="text-gray-700 dark:text-gray-300">Histórico de saldo de estoque:</strong> dados insuficientes
                  — o sistema não mantém um snapshot histórico de quantidade em estoque, apenas o saldo atual.
                </p>
              </section>

              {/* Histórico de saídas/vendas */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-4 h-4 text-[#10b981]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Histórico de saídas (vendas)
                  </h4>
                </div>
                {isProductLoading ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...
                  </div>
                ) : !productDetail || productDetail.history.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">Nenhuma saída registrada para este produto.</p>
                ) : (
                  <div className="border border-gray-100 dark:border-white/5 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 dark:bg-white/5 sticky top-0">
                        <tr className="text-[10px] uppercase font-bold text-gray-400">
                          <th className="px-3 py-2">Data</th>
                          <th className="px-3 py-2">Cliente</th>
                          <th className="px-3 py-2">Qtd</th>
                          <th className="px-3 py-2 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                        {productDetail.history.slice(0, 20).map((mov) => (
                          <tr key={mov.id}>
                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{formatDate(mov.date)}</td>
                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300 truncate max-w-[140px]">{mov.customerName}</td>
                            <td className="px-3 py-2 font-semibold text-gray-900 dark:text-white">{mov.quantity} {r.unit}</td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-white">{formatMoney(mov.totalAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Histórico de ações sobre a recomendação */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-[#10b981]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Histórico de ações
                  </h4>
                </div>
                {isHistoryLoading ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...
                  </div>
                ) : history.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">Nenhuma ação registrada para este produto ainda.</p>
                ) : (
                  <ul className="space-y-2">
                    {history.map((entry) => (
                      <li key={entry.id} className="text-xs bg-gray-50 dark:bg-white/[0.02] rounded-xl p-3">
                        <div className="flex justify-between gap-2 flex-wrap">
                          <span className="font-semibold text-gray-800 dark:text-gray-200">
                            {ACTION_LABELS[entry.action] || entry.action} · {entry.recommendationType === 'reposicao' ? 'Reposição' : 'Estoque parado'}
                          </span>
                          <span className="text-gray-400">{formatDateTime(entry.performedAt)}</span>
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                          {entry.performedByName || 'Usuário'}
                          {entry.reason ? ` — ${entry.reason}` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => navigate(`/inventory/${r.productId}`)}
                  className="text-sm font-semibold text-[#10b981] hover:underline"
                >
                  Ver cadastro completo do produto
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default RecommendationDetailModal;
