import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { useCustomers } from '../../../hooks/useCustomers';
import { useSuppliers } from '../../../hooks/useSuppliers';
import { ManualReceivableInput, ManualPayableInput } from '../../../services/financialService';

const entrySchema = z.object({
  description: z.string().min(3, 'A descrição deve conter pelo menos 3 caracteres'),
  amount: z.coerce.number().positive('O valor deve ser maior que zero'),
  dueDate: z.string().min(1, 'A data de vencimento é obrigatória'),
  relationId: z.string().optional().or(z.literal('')),
});

type EntryForm = z.infer<typeof entrySchema>;

export interface ManualEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'receivable' | 'payable';
  onSaveReceivable: (data: ManualReceivableInput) => Promise<void>;
  onSavePayable: (data: ManualPayableInput) => Promise<void>;
  isLoading?: boolean;
}

export const ManualEntryModal: React.FC<ManualEntryModalProps> = ({
  isOpen,
  onClose,
  type,
  onSaveReceivable,
  onSavePayable,
  isLoading = false,
}) => {
  const isReceivable = type === 'receivable';
  const { customers, isLoading: isCustomersLoading } = useCustomers({ status: 'active' });
  const { suppliers, isLoading: isSuppliersLoading } = useSuppliers({ status: 'active' });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EntryForm>({
    resolver: zodResolver(entrySchema),
    defaultValues: { description: '', amount: 0, dueDate: '', relationId: '' },
  });

  useEffect(() => {
    if (isOpen) {
      reset({ description: '', amount: 0, dueDate: '', relationId: '' });
    }
  }, [isOpen, type, reset]);

  const onSubmit = async (values: EntryForm) => {
    if (isReceivable) {
      if (!values.relationId) return;
      await onSaveReceivable({
        customerId: values.relationId,
        amount: values.amount,
        dueDate: values.dueDate,
        description: values.description,
      });
    } else {
      await onSavePayable({
        supplierId: values.relationId || undefined,
        amount: values.amount,
        dueDate: values.dueDate,
        description: values.description,
      });
    }
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
            className="relative bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 shadow-2xl p-6 w-full max-w-lg z-10 max-h-[90vh] overflow-y-auto transition-colors duration-300"
          >
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-white/5 pb-4">
              <div className="flex items-center gap-2">
                {isReceivable ? (
                  <ArrowDownCircle className="w-5 h-5 text-[#10b981]" />
                ) : (
                  <ArrowUpCircle className="w-5 h-5 text-red-500" />
                )}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {isReceivable ? 'Nova Conta a Receber' : 'Nova Conta a Pagar'}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">Lançamento manual não vinculado a venda/compra</p>
                </div>
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
                <label className={labelClass}>Descrição *</label>
                <input type="text" placeholder="Ex: Aluguel do escritório" {...register('description')} className={inputClass} />
                {errors.description && <p className="text-xs text-red-500 font-medium">{errors.description.message}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={labelClass}>Valor (R$) *</label>
                  <input type="number" step="0.01" min="0" placeholder="0,00" {...register('amount')} className={inputClass} />
                  {errors.amount && <p className="text-xs text-red-500 font-medium">{errors.amount.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Vencimento *</label>
                  <input type="date" {...register('dueDate')} className={`${inputClass} dark:[color-scheme:dark]`} />
                  {errors.dueDate && <p className="text-xs text-red-500 font-medium">{errors.dueDate.message}</p>}
                </div>
              </div>

              {isReceivable ? (
                <div className="space-y-1">
                  <label className={labelClass}>Cliente *</label>
                  <select {...register('relationId')} className={inputClass} disabled={isCustomersLoading}>
                    <option value="">Selecione um cliente</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName}
                      </option>
                    ))}
                  </select>
                  {!errors.relationId && (
                    <p className="text-[11px] text-gray-400">
                      Contas a receber exigem um cliente vinculado (restrição do banco de dados).
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <label className={labelClass}>Fornecedor (opcional)</label>
                  <select {...register('relationId')} className={inputClass} disabled={isSuppliersLoading}>
                    <option value="">Sem fornecedor vinculado</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                  {isLoading ? 'Salvando...' : 'Salvar Lançamento'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ManualEntryModal;
