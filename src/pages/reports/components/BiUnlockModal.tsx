import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Sparkles, X } from 'lucide-react';

export interface BiUnlockModalProps {
  isOpen: boolean;
  moduleName: string;
  benefits: readonly string[];
  onClose: () => void;
  onViewPlans: () => void;
}

export const BiUnlockModal: React.FC<BiUnlockModalProps> = ({ isOpen, moduleName, benefits, onClose, onViewPlans }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 shadow-2xl p-6 w-full max-w-md z-10 overflow-hidden"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors duration-200"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex gap-4">
              <div className="p-3 rounded-full self-start bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
                <Lock className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
                  <Sparkles className="w-3 h-3" />
                  Recurso premium
                </span>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{moduleName}</h3>
                <p className="text-sm text-gray-500 dark:text-white/50 mt-1">
                  Este módulo ainda não está incluído no seu plano atual.
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-2">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#10b981] shrink-0" />
                  {benefit}
                </li>
              ))}
            </ul>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 rounded-xl px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors duration-200"
              >
                Agora não
              </button>
              <button
                type="button"
                onClick={onViewPlans}
                className="bg-gradient-to-r from-[#0B2551] to-[#00d2ff] hover:brightness-110 text-white rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-1.5 transition-all duration-200"
              >
                <Sparkles className="w-4 h-4" />
                Ver planos
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
