import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Purchase } from '../../../types';

export interface EditPurchaseStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchase?: Purchase;
  onUpdateStatus: (id: string, status: 'paid' | 'pending' | 'canceled') => Promise<void>;
  isLoading?: boolean;
}

export const EditPurchaseStatusModal: React.FC<EditPurchaseStatusModalProps> = ({
  isOpen,
  onClose,
  purchase,
  onUpdateStatus,
  isLoading = false,
}) => {
  const [status, setStatus] = useState<'paid' | 'pending' | 'canceled'>('paid');

  useEffect(() => {
    if (purchase && isOpen) {
      setStatus(purchase.status);
    }
  }, [purchase, isOpen]);

  if (!purchase) return null;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateStatus(purchase.id, status);
    onClose();
  };

  const isCanceled = purchase.status === 'canceled';
  const showPaidWarning = status === 'paid' && purchase.status !== 'paid';

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isLoading ? undefined : onClose}
            className="fixed inset-0 bg-black/55 backdrop-blur-sm"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 shadow-2xl p-6 w-full max-w-md z-10 transition-colors duration-300"
          >

            <div className="flex justify-between items-center mb-5 border-b border-gray-100 dark:border-white/5 pb-3">
              <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                <RefreshCw className="w-5 h-5 text-[#10b981]" />
                <h3 className="text-lg font-bold">Alterar Status da Compra</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirm} className="space-y-4">

              <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-200/50 dark:border-white/5 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Código da Compra</span>
                <h4 className="text-sm font-mono font-bold text-[#10b981] select-all mt-0.5">#{purchase.id}</h4>
                <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-200/30 dark:border-white/5 text-sm font-semibold">
                  <span className="text-gray-500 dark:text-gray-400">Valor Final:</span>
                  <span className="text-gray-950 dark:text-white font-bold">{formatMoney(purchase.finalValue)}</span>
                </div>
              </div>

              {isCanceled ? (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-xl flex gap-2 text-xs font-semibold">
                  <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
                  <p>Esta compra já foi cancelada e seu estoque foi estornado. Não é possível alterar seu status.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Selecione o Novo Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#1a1d27] text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] cursor-pointer appearance-none"
                  >
                    <option value="paid">Pago</option>
                    <option value="pending">Pendente</option>
                  </select>
                </div>
              )}

              {showPaidWarning && !isCanceled && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-xl flex gap-2 text-xs font-semibold animate-fade-in">
                  <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
                  <p>Alterar para Pago irá marcar a conta a pagar como paga.</p>
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-gray-100 dark:border-white/5 pt-4 mt-5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading || isCanceled || status === purchase.status}
                  className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 shadow-md shadow-emerald-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isLoading ? 'Atualizando...' : 'Confirmar Status'}
                </button>
              </div>

            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
export default EditPurchaseStatusModal;
