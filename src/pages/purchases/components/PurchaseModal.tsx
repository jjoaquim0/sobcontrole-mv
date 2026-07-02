import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Trash2, Loader2, AlertCircle, ShoppingCart } from 'lucide-react';
import { useSuppliers } from '../../../hooks/useSuppliers';
import { useInventory } from '../../../hooks/useInventory';

const purchaseSchema = z.object({
  supplierId: z.string().min(1, 'Fornecedor é obrigatório'),
  paymentMethod: z.enum(['cash', 'money', 'credit_card', 'debit_card', 'pix', 'bank_transfer', 'other']),
  paymentStatus: z.enum(['paid', 'pending', 'canceled']),
  discount: z.coerce.number().nonnegative('Desconto deve ser maior ou igual a zero'),
  fee: z.coerce.number().nonnegative('Taxa deve ser maior ou igual a zero'),
  notes: z.string().optional().or(z.literal('')),
});

type PurchaseForm = z.infer<typeof purchaseSchema>;

interface SelectedItem {
  productId: string;
  name: string;
  sku: string;
  currentStock: number;
  quantity: number;
  unitCost: number;
  subtotal: number;
}

export interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  isLoading?: boolean;
}

export const PurchaseModal: React.FC<PurchaseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  isLoading = false,
}) => {
  const { suppliers } = useSuppliers({ status: 'active' });

  const [prodQuery, setProdQuery] = useState('');
  const [debouncedProdQuery, setDebouncedProdQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const [addedItems, setAddedItems] = useState<SelectedItem[]>([]);
  const [itemsError, setItemsError] = useState<string | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedProdQuery(prodQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [prodQuery]);

  const { products } = useInventory({ search: debouncedProdQuery });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<PurchaseForm>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      supplierId: '',
      paymentMethod: 'pix',
      paymentStatus: 'paid',
      discount: 0,
      fee: 0,
      notes: '',
    },
  });

  const discountVal = watch('discount') || 0;
  const feeVal = watch('fee') || 0;

  useEffect(() => {
    if (isOpen) {
      reset({
        supplierId: '',
        paymentMethod: 'pix',
        paymentStatus: 'paid',
        discount: 0,
        fee: 0,
        notes: '',
      });
      setAddedItems([]);
      setProdQuery('');
      setDebouncedProdQuery('');
      setShowResults(false);
      setItemsError(null);
    }
  }, [isOpen, reset]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectProduct = (prod: any) => {
    const exists = addedItems.find(item => item.productId === prod.id);
    if (exists) {
      setAddedItems(prev => prev.map(item =>
        item.productId === prod.id
          ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unitCost }
          : item
      ));
    } else {
      setAddedItems(prev => [
        ...prev,
        {
          productId: prod.id,
          name: prod.name,
          sku: prod.sku,
          currentStock: prod.currentQuantity,
          quantity: 1,
          unitCost: prod.costPrice,
          subtotal: prod.costPrice
        }
      ]);
    }

    setProdQuery('');
    setDebouncedProdQuery('');
    setShowResults(false);
    setItemsError(null);
  };

  const handleRemoveItem = (productId: string) => {
    setAddedItems(prev => prev.filter(item => item.productId !== productId));
  };

  const handleQtyChange = (productId: string, valStr: string) => {
    const val = parseInt(valStr, 10);
    if (isNaN(val)) return;

    setAddedItems(prev => prev.map(item => {
      if (item.productId === productId) {
        const targetQty = Math.max(1, val);
        return {
          ...item,
          quantity: targetQty,
          subtotal: targetQty * item.unitCost
        };
      }
      return item;
    }));
  };

  const handleCostChange = (productId: string, valStr: string) => {
    const val = parseFloat(valStr);
    if (isNaN(val) || val < 0) return;

    setAddedItems(prev => prev.map(item => {
      if (item.productId === productId) {
        return {
          ...item,
          unitCost: val,
          subtotal: item.quantity * val
        };
      }
      return item;
    }));
  };

  const itemsSubtotal = addedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const finalValue = Math.max(0, itemsSubtotal - discountVal + feeVal);

  const onSubmit = async (formValues: PurchaseForm) => {
    if (addedItems.length === 0) {
      setItemsError('Adicione pelo menos um produto à compra.');
      return;
    }

    const payload = {
      supplierId: formValues.supplierId,
      discount: formValues.discount,
      fee: formValues.fee,
      paymentMethod: formValues.paymentMethod,
      paymentStatus: formValues.paymentStatus,
      notes: formValues.notes,
      items: addedItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitCost: item.unitCost
      }))
    };

    await onSave(payload);
    onClose();
  };

  const paymentOptions = [
    { value: 'pix', label: 'PIX ⚡' },
    { value: 'credit_card', label: 'Cartão de Crédito 💳' },
    { value: 'debit_card', label: 'Cartão de Débito 💳' },
    { value: 'cash', label: 'Dinheiro 💵' },
    { value: 'bank_transfer', label: 'Transferência Bancária 🏦' },
    { value: 'other', label: 'Outro 📝' }
  ];

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
            className="relative bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 shadow-2xl p-6 w-full max-w-4xl z-10 max-h-[90vh] overflow-y-auto transition-colors duration-300"
          >

            <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-white/5 pb-4">
              <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                <ShoppingCart className="w-5.5 h-5.5 text-[#10b981]" />
                <div>
                  <h3 className="text-lg font-bold">Registrar Nova Compra</h3>
                  <p className="text-xs text-gray-400 mt-1">Abra um novo pedido de compra creditando estoque em tempo real</p>
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

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                <div className="lg:col-span-3 space-y-4">
                  <div className="border-b border-gray-100 dark:border-white/5 pb-2">
                    <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Produtos da Compra</h4>
                  </div>

                  <div className="relative" ref={resultsRef}>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                        <Search className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        placeholder="Pesquisar produto por nome ou SKU..."
                        value={prodQuery}
                        onChange={(e) => {
                          setProdQuery(e.target.value);
                          setShowResults(true);
                        }}
                        onFocus={() => setShowResults(true)}
                        className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200"
                      />
                      {prodQuery && (
                        <button
                          type="button"
                          onClick={() => setProdQuery('')}
                          className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {showResults && prodQuery.trim() !== '' && (
                      <div className="absolute left-0 right-0 mt-1 max-h-[220px] overflow-y-auto bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 shadow-2xl rounded-xl z-20 transition-all duration-300 divide-y divide-gray-50 dark:divide-white/5">
                        {products.length === 0 ? (
                          <div className="p-4 text-center text-xs text-gray-400">Nenhum produto localizado</div>
                        ) : (
                          products.map(p => (
                            <div
                              key={p.id}
                              onClick={() => handleSelectProduct(p)}
                              className="p-3 flex justify-between items-center text-xs transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer"
                            >
                              <div>
                                <span className="font-bold text-gray-900 dark:text-white block">{p.name}</span>
                                <span className="text-[10px] text-gray-400 font-mono mt-0.5">SKU: {p.sku}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-bold text-[#10b981] block">R$ {p.costPrice.toFixed(2)}</span>
                                <span className="text-[10px] font-semibold text-gray-400">
                                  Estoque atual: {p.currentQuantity} {p.unit}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {addedItems.length === 0 ? (
                    <div className="border border-dashed border-gray-200 dark:border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-2">
                      <ShoppingCart className="w-8 h-8 text-gray-300 dark:text-white/10" />
                      <div>
                        <h5 className="text-xs font-bold text-gray-700 dark:text-gray-300">Nenhum Item Adicionado</h5>
                        <p className="text-[10px] text-gray-400 max-w-xs mt-0.5">Utilize a barra de pesquisa acima para selecionar e adicionar produtos a esta compra.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                      {addedItems.map(item => (
                        <div
                          key={item.productId}
                          className="bg-gray-50 dark:bg-white/5 border border-gray-200/50 dark:border-white/5 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-bold text-gray-900 dark:text-white truncate block">{item.name}</span>
                            <span className="text-[10px] text-gray-400 font-mono block mt-0.5">SKU: {item.sku}</span>
                            <span className="text-[10px] text-gray-500 font-semibold block mt-0.5">Estoque atual: {item.currentStock}</span>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="space-y-0.5 w-16">
                              <span className="text-[9px] uppercase font-bold text-gray-400 block">Qtd</span>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleQtyChange(item.productId, e.target.value)}
                                className="w-full px-2 py-1.5 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1d27] rounded-lg outline-none focus:ring-1 focus:ring-[#10b981] font-bold text-center"
                              />
                            </div>

                            <div className="space-y-0.5 w-24">
                              <span className="text-[9px] uppercase font-bold text-gray-400 block">Custo (R$)</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.unitCost}
                                onChange={(e) => handleCostChange(item.productId, e.target.value)}
                                className="w-full px-2 py-1.5 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1d27] rounded-lg outline-none focus:ring-1 focus:ring-[#10b981] font-bold"
                              />
                            </div>

                            <div className="text-right min-w-[70px] space-y-0.5">
                              <span className="text-[9px] uppercase font-bold text-gray-400 block">Subtotal</span>
                              <span className="font-bold text-gray-900 dark:text-white block mt-1.5">R$ {item.subtotal.toFixed(2)}</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.productId)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 shrink-0 self-end mt-4 sm:mt-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-[#10b981] rounded-xl flex gap-2 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="leading-relaxed font-semibold">
                      Ao confirmar, o estoque de cada produto será incrementado automaticamente.
                    </p>
                  </div>

                  {itemsError && (
                    <p className="text-xs text-red-500 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> {itemsError}
                    </p>
                  )}
                </div>

                <div className="lg:col-span-2 space-y-4 border-t lg:border-t-0 lg:border-l border-gray-100 dark:border-white/5 pt-6 lg:pt-0 lg:pl-6">
                  <div className="border-b border-gray-100 dark:border-white/5 pb-2">
                    <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Dados da Compra</h4>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Fornecedor *
                    </label>
                    <select
                      {...register('supplierId')}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#1a1d27] text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] appearance-none cursor-pointer"
                    >
                      <option value="" className="text-gray-500">Selecione o fornecedor</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>
                          🏭 {s.name}
                        </option>
                      ))}
                    </select>
                    {errors.supplierId && (
                      <p className="text-xs text-red-500 font-medium">{errors.supplierId.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">

                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Forma Pagto *
                      </label>
                      <select
                        {...register('paymentMethod')}
                        className="w-full px-3 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#1a1d27] text-xs font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] appearance-none cursor-pointer"
                      >
                        {paymentOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Status Inic. *
                      </label>
                      <select
                        {...register('paymentStatus')}
                        className="w-full px-3 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#1a1d27] text-xs font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] appearance-none cursor-pointer"
                      >
                        <option value="paid">Pago</option>
                        <option value="pending">Pendente</option>
                      </select>
                    </div>

                  </div>

                  <div className="grid grid-cols-2 gap-3">

                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Desconto (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        {...register('discount')}
                        className="w-full px-3 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981]"
                      />
                      {errors.discount && (
                        <p className="text-xs text-red-500 font-medium">{errors.discount.message}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Acréscimo (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        {...register('fee')}
                        className="w-full px-3 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981]"
                      />
                      {errors.fee && (
                        <p className="text-xs text-red-500 font-medium">{errors.fee.message}</p>
                      )}
                    </div>

                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Observações
                    </label>
                    <textarea
                      placeholder="Observações da compra, número de nota fiscal, detalhes de entrega..."
                      rows={3}
                      {...register('notes')}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] resize-none"
                    />
                  </div>

                </div>

              </div>

              <div className="border-t border-gray-100 dark:border-white/5 pt-4 mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">

                <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400 max-w-md font-semibold">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>R$ {itemsSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-red-500">
                    <span>Desconto:</span>
                    <span>- R$ {discountVal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Acréscimo (Taxa):</span>
                    <span>+ R$ {feeVal.toFixed(2)}</span>
                  </div>
                  <div className="h-px bg-gray-200/60 dark:bg-white/5 my-1" />
                  <div className="flex justify-between text-base font-bold text-gray-950 dark:text-white">
                    <span>Total Final:</span>
                    <span>R$ {finalValue.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-3 shrink-0">
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
                    disabled={isLoading || addedItems.length === 0}
                    className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 shadow-md shadow-emerald-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isLoading ? 'Registrando...' : 'Finalizar Compra'}
                  </button>
                </div>

              </div>

            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
