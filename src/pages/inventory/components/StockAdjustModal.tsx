import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, RefreshCw } from 'lucide-react';
import { Product } from '../../../types';

export interface StockAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product;
  onAdjust: (id: string, quantity: number, operation: 'set' | 'add' | 'subtract', reason?: string) => Promise<void>;
  isLoading?: boolean;
}

export const StockAdjustModal: React.FC<StockAdjustModalProps> = ({
  isOpen,
  onClose,
  product,
  onAdjust,
  isLoading = false,
}) => {
  const [operation, setOperation] = useState<'set' | 'add' | 'subtract'>('add');
  const [valueStr, setValueStr] = useState('0');
  const [reason, setReason] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setOperation('add');
      setValueStr('0');
      setReason('');
    }
  }, [isOpen]);

  if (!product) return null;

  const currentQty = product.currentQuantity || 0;
  const value = parseFloat(valueStr) || 0;

  // Real-time stock result calculation
  let resultingQty = currentQty;
  if (operation === 'set') {
    resultingQty = value;
  } else if (operation === 'add') {
    resultingQty = currentQty + value;
  } else if (operation === 'subtract') {
    resultingQty = Math.max(0, currentQty - value);
  }

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (value < 0) return;
    await onAdjust(product.id, value, operation, reason);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isLoading ? undefined : onClose}
            className="fixed inset-0 bg-black/55 backdrop-blur-sm"
          />

          {/* Container Dialog */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 shadow-2xl p-6 w-full max-w-md z-10 transition-colors duration-300"
          >
            
            {/* Header */}
            <div className="flex justify-between items-center mb-5 border-b border-gray-100 dark:border-white/5 pb-3">
              <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                <RefreshCw className="w-5 h-5 text-[#10b981]" />
                <h3 className="text-lg font-bold">Ajustar Estoque</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <form onSubmit={handleConfirm} className="space-y-4">
              
              {/* Product Info Summary */}
              <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-200/50 dark:border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Produto</span>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate mt-0.5">{product.name}</h4>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200/30 dark:border-white/5">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Estoque Atual:</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{currentQty} {product.unit}</span>
                </div>
              </div>

              {/* Operation Selection (Radio Group with Premium Buttons) */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Tipo de Movimentação
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setOperation('add')}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all duration-200 text-center ${
                      operation === 'add'
                        ? 'border-[#10b981] bg-[#10b981]/10 text-[#10b981] dark:bg-[#10b981]/20'
                        : 'border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                    }`}
                  >
                    Adicionar
                  </button>
                  <button
                    type="button"
                    onClick={() => setOperation('subtract')}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all duration-200 text-center ${
                      operation === 'subtract'
                        ? 'border-red-500 bg-red-500/10 text-red-500 dark:bg-red-500/20'
                        : 'border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                    }`}
                  >
                    Remover
                  </button>
                  <button
                    type="button"
                    onClick={() => setOperation('set')}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all duration-200 text-center ${
                      operation === 'set'
                        ? 'border-blue-500 bg-blue-500/10 text-blue-500 dark:bg-blue-500/20'
                        : 'border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                    }`}
                  >
                    Definir
                  </button>
                </div>
              </div>

              {/* Input Quantidade */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Quantidade ({product.unit})
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={valueStr}
                  onChange={(e) => setValueStr(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200"
                  required
                />
              </div>

              {/* Motivo do Ajuste */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Motivo da Alteração (Opcional)
                </label>
                <textarea
                  placeholder="Ex: Correção de inventário anual, devolução de cliente..."
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200 resize-none"
                />
              </div>

              {/* Resulting Preview Box */}
              <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-dashed border-gray-200 dark:border-white/10 flex justify-between items-center transition-all duration-300">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Estoque Resultante:</span>
                <span className={`text-base font-bold transition-colors ${
                  resultingQty === currentQty
                    ? 'text-gray-900 dark:text-white'
                    : resultingQty > currentQty
                      ? 'text-emerald-500'
                      : 'text-red-500'
                }`}>
                  {resultingQty} {product.unit}
                </span>
              </div>

              {/* Actions Footer */}
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
                  disabled={isLoading || value < 0}
                  className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 shadow-md shadow-emerald-500/10"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isLoading ? 'Salvando...' : 'Confirmar Ajuste'}
                </button>
              </div>

            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
