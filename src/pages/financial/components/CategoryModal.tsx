import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Tag } from 'lucide-react';
import { FinancialCategory } from '../../../types';
import { CategoryInput } from '../../../services/financialService';

const COLOR_PRESETS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];

const categorySchema = z.object({
  name: z.string().min(2, 'O nome deve conter pelo menos 2 caracteres'),
  type: z.enum(['revenue', 'expense']),
});

type CategoryForm = z.infer<typeof categorySchema>;

export interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category?: FinancialCategory;
  onSave: (data: CategoryInput) => Promise<void>;
  isLoading?: boolean;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  category,
  onSave,
  isLoading = false,
}) => {
  const [color, setColor] = useState('#10b981');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', type: 'expense' },
  });

  useEffect(() => {
    if (isOpen) {
      if (category) {
        reset({ name: category.name, type: category.type });
        setColor(category.color || '#10b981');
      } else {
        reset({ name: '', type: 'expense' });
        setColor('#10b981');
      }
    }
  }, [isOpen, category, reset]);

  const onSubmit = async (values: CategoryForm) => {
    await onSave({ name: values.name, type: values.type, color });
    onClose();
  };

  const inputClass =
    'w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200';
  const labelClass = 'text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400';

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
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-[#10b981]" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {category ? 'Editar Categoria' : 'Nova Categoria'}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1">
                <label className={labelClass}>Nome *</label>
                <input type="text" placeholder="Ex: Fornecedores" {...register('name')} className={inputClass} />
                {errors.name && <p className="text-xs text-red-500 font-medium">{errors.name.message}</p>}
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Tipo *</label>
                <select {...register('type')} className={`${inputClass} cursor-pointer appearance-none`}>
                  <option value="expense">Despesa</option>
                  <option value="revenue">Receita</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Cor</label>
                <div className="flex items-center gap-3 flex-wrap">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setColor(preset)}
                      className={`w-9 h-9 rounded-xl transition-transform duration-200 ${
                        color.toLowerCase() === preset.toLowerCase() ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#1a1d27] scale-105' : ''
                      }`}
                      style={{ backgroundColor: preset, boxShadow: '0 0 0 1px rgba(0,0,0,0.05)' }}
                      title={preset}
                    />
                  ))}
                  <label className="flex items-center gap-2 ml-1 cursor-pointer">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-9 h-9 rounded-xl border border-gray-200 dark:border-white/10 bg-transparent cursor-pointer p-0.5"
                    />
                    <span className="text-sm font-mono text-gray-600 dark:text-gray-300">{color.toUpperCase()}</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-100 dark:border-white/5 pt-4 mt-6">
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
                  disabled={isLoading}
                  className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 shadow-md shadow-emerald-500/10 disabled:opacity-70"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isLoading ? 'Salvando...' : 'Salvar Categoria'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CategoryModal;
