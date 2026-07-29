import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Loader2, X, XCircle, CheckCircle2 } from 'lucide-react';
import { RecommendationActionType } from '../../../services/stockRecommendationsService';

const ACTION_COPY: Record<RecommendationActionType, { title: string; confirmText: string; icon: React.ElementType }> = {
  dismissed: { title: 'Dispensar recomendação', confirmText: 'Dispensar', icon: XCircle },
  postponed: { title: 'Adiar recomendação por 7 dias', confirmText: 'Adiar 7 dias', icon: Clock },
  resolved: { title: 'Marcar recomendação como resolvida', confirmText: 'Marcar como resolvida', icon: CheckCircle2 },
};

export interface RecommendationActionModalProps {
  isOpen: boolean;
  action: RecommendationActionType | null;
  productName?: string;
  onClose: () => void;
  onConfirm: (reason?: string) => void | Promise<void>;
  isLoading?: boolean;
}

export const RecommendationActionModal: React.FC<RecommendationActionModalProps> = ({
  isOpen,
  action,
  productName,
  onClose,
  onConfirm,
  isLoading = false,
}) => {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) setReason('');
  }, [isOpen]);

  if (!action) return null;
  const copy = ACTION_COPY[action];
  const Icon = copy.icon;

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
            role="dialog"
            aria-modal="true"
            className="relative bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 shadow-2xl p-6 w-full max-w-md z-10"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <Icon className="w-5 h-5 text-[#10b981]" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{copy.title}</h3>
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

            {productName && <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{productName}</p>}

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Motivo (opcional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Explique o motivo desta ação, se quiser registrar mais contexto..."
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors duration-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => onConfirm(reason.trim() || undefined)}
                disabled={isLoading}
                className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 shadow-md shadow-emerald-500/10 disabled:opacity-70"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {copy.confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default RecommendationActionModal;
