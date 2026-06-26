import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Plus } from 'lucide-react';
import { Product } from '../../../types';
import { useCategories } from '../../../hooks/useInventory';
import { toast } from 'sonner';

// Zod validation schema
const productSchema = z.object({
  name: z.string().min(2, 'O nome deve conter pelo menos 2 caracteres'),
  description: z.string().optional().or(z.literal('')),
  sku: z.string().min(3, 'O SKU deve conter pelo menos 3 caracteres'),
  barcode: z.string().optional().or(z.literal('')),
  categoryId: z.string().min(1, 'A categoria é obrigatória'),
  unit: z.string().min(1, 'A unidade é obrigatória'),
  costPrice: z.coerce.number({ invalid_type_error: 'Deve ser um número' }).positive('Preço de custo deve ser maior que zero'),
  salePrice: z.coerce.number({ invalid_type_error: 'Deve ser um número' }).positive('Preço de venda deve ser maior que zero'),
  currentQuantity: z.coerce.number({ invalid_type_error: 'Deve ser um número' }).nonnegative('A quantidade deve ser zero ou maior'),
  minQuantity: z.coerce.number({ invalid_type_error: 'Deve ser um número' }).nonnegative('A quantidade mínima deve ser zero ou maior'),
  maxQuantity: z.coerce.number({ invalid_type_error: 'Deve ser um número' }).nonnegative('A quantidade máxima deve ser zero ou maior'),
}).refine((data) => data.salePrice >= data.costPrice, {
  message: 'Preço de venda não pode ser inferior ao custo',
  path: ['salePrice'],
});

type ProductForm = z.infer<typeof productSchema>;

export interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product; // Se fornecido, modo edição
  onSave: (data: any) => Promise<void>;
  isLoading?: boolean;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  product,
  onSave,
  isLoading = false,
}) => {
  const { categories, createCategory, isCreatingCategory } = useCategories();
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      description: '',
      sku: '',
      barcode: '',
      categoryId: '',
      unit: 'Unidade',
      costPrice: 0,
      salePrice: 0,
      currentQuantity: 0,
      minQuantity: 0,
      maxQuantity: 0,
    },
  });

  // Preencher formulário em caso de edição
  useEffect(() => {
    if (product && isOpen) {
      reset({
        name: product.name,
        description: product.description || '',
        sku: product.sku,
        barcode: product.barcode || '',
        categoryId: product.categoryId,
        unit: product.unit || 'Unidade',
        costPrice: product.costPrice,
        salePrice: product.salePrice,
        currentQuantity: product.currentQuantity,
        minQuantity: product.minQuantity,
        maxQuantity: product.maxQuantity,
      });
    } else if (!product && isOpen) {
      reset({
        name: '',
        description: '',
        sku: '',
        barcode: '',
        categoryId: '',
        unit: 'Unidade',
        costPrice: 0,
        salePrice: 0,
        currentQuantity: 0,
        minQuantity: 0,
        maxQuantity: 0,
      });
    }
    setShowAddCategory(false);
    setNewCatName('');
  }, [product, isOpen, reset]);

  // Gerar SKU automático aleatório
  const handleGenerateSku = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomStr = '';
    for (let i = 0; i < 6; i++) {
      randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setValue('sku', `SKU-${randomStr}`, { shouldValidate: true });
  };

  // Cadastrar nova categoria rápida inline
  const handleAddCategoryInline = async () => {
    if (!newCatName.trim()) {
      toast.error('O nome da categoria não pode estar vazio.');
      return;
    }
    try {
      const created = await createCategory(newCatName);
      setValue('categoryId', created.id, { shouldValidate: true });
      setShowAddCategory(false);
      setNewCatName('');
    } catch (e) {
      // toast já disparado no hook
    }
  };

  const onSubmit = async (formValues: ProductForm) => {
    await onSave(formValues);
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
            className="relative bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 shadow-2xl p-6 w-full max-w-lg z-10 max-h-[90vh] overflow-y-auto transition-colors duration-300"
          >
            
            {/* Header */}
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-white/5 pb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {product ? 'Editar Produto' : 'Novo Produto'}
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  {product ? 'Atualize as especificações e custos do item' : 'Cadastre um novo item ao inventário'}
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

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              
              {/* Grid Geral */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Nome do Produto */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Nome do Produto *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Notebook Dell Inspiron 15"
                    {...register('name')}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200"
                  />
                  {errors.name && (
                    <p className="text-xs text-red-500 font-medium">{errors.name.message}</p>
                  )}
                </div>

                {/* Descrição */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Descrição
                  </label>
                  <textarea
                    placeholder="Descrição detalhada do produto, especificações técnicas, etc..."
                    rows={3}
                    {...register('description')}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200 resize-none"
                  />
                </div>

                {/* SKU */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    SKU / Código do Produto *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ex: SKU-DELL15"
                      {...register('sku')}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateSku}
                      className="px-3 border border-gray-200 dark:border-white/10 text-xs font-semibold text-[#10b981] hover:bg-[#10b981]/10 rounded-xl transition-all duration-200 shrink-0"
                    >
                      Gerar
                    </button>
                  </div>
                  {errors.sku && (
                    <p className="text-xs text-red-500 font-medium">{errors.sku.message}</p>
                  )}
                </div>

                {/* Código de barras */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Código de Barras (EAN)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 7891234567890"
                    {...register('barcode')}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200"
                  />
                </div>

                {/* Categoria */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Categoria *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddCategory(!showAddCategory)}
                      className="text-xs text-[#10b981] hover:text-[#059669] flex items-center gap-0.5 font-medium transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Nova
                    </button>
                  </div>
                  <select
                    {...register('categoryId')}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200 appearance-none cursor-pointer"
                  >
                    <option value="" className="text-gray-500 dark:bg-[#1a1d27]">Selecione uma categoria</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id} className="dark:bg-[#1a1d27]">
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  {errors.categoryId && (
                    <p className="text-xs text-red-500 font-medium">{errors.categoryId.message}</p>
                  )}

                  {/* Input inline de categoria rápida */}
                  {showAddCategory && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-2 mt-2 p-2 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200/50 dark:border-white/5"
                    >
                      <input
                        type="text"
                        placeholder="Nome da categoria"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#10b981]"
                      />
                      <button
                        type="button"
                        onClick={handleAddCategoryInline}
                        disabled={isCreatingCategory}
                        className="px-3 py-1.5 bg-[#10b981] hover:bg-[#059669] text-white font-medium text-xs rounded-lg transition-colors duration-200 shrink-0"
                      >
                        {isCreatingCategory ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Adicionar'}
                      </button>
                    </motion.div>
                  )}
                </div>

                {/* Unidade */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Unidade de Medida *
                  </label>
                  <select
                    {...register('unit')}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200 appearance-none cursor-pointer"
                  >
                    <option value="Unidade" className="dark:bg-[#1a1d27]">Unidade</option>
                    <option value="Kg" className="dark:bg-[#1a1d27]">Kg</option>
                    <option value="Litro" className="dark:bg-[#1a1d27]">Litro</option>
                    <option value="Caixa" className="dark:bg-[#1a1d27]">Caixa</option>
                    <option value="Par" className="dark:bg-[#1a1d27]">Par</option>
                    <option value="Metro" className="dark:bg-[#1a1d27]">Metro</option>
                  </select>
                  {errors.unit && (
                    <p className="text-xs text-red-500 font-medium">{errors.unit.message}</p>
                  )}
                </div>

                {/* Preço de Custo */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Preço de Custo (R$) *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-4 flex items-center text-gray-400 text-sm">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      {...register('costPrice')}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200"
                    />
                  </div>
                  {errors.costPrice && (
                    <p className="text-xs text-red-500 font-medium">{errors.costPrice.message}</p>
                  )}
                </div>

                {/* Preço de Venda */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Preço de Venda (R$) *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-4 flex items-center text-gray-400 text-sm">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      {...register('salePrice')}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200"
                    />
                  </div>
                  {errors.salePrice && (
                    <p className="text-xs text-red-500 font-medium">{errors.salePrice.message}</p>
                  )}
                </div>

                {/* Quantidades em uma linha */}
                <div className="md:col-span-2 grid grid-cols-3 gap-3 border-t border-gray-100 dark:border-white/5 pt-4 mt-2">
                  
                  {/* Quantidade Atual */}
                  <div className="space-y-1">
                    <label className="text-[10px] md:text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 truncate block">
                      Qtd Atual *
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      disabled={!!product} // Desabilita em edição, obrigando a usar o StockAdjustModal
                      title={product ? 'Use o botão de ajuste rápido na listagem para alterar quantidades' : ''}
                      {...register('currentQuantity')}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    />
                    {errors.currentQuantity && (
                      <p className="text-[10px] text-red-500 font-semibold">{errors.currentQuantity.message}</p>
                    )}
                  </div>

                  {/* Quantidade Mínima */}
                  <div className="space-y-1">
                    <label className="text-[10px] md:text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 truncate block">
                      Qtd Mínima *
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      {...register('minQuantity')}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200"
                    />
                    {errors.minQuantity && (
                      <p className="text-[10px] text-red-500 font-semibold">{errors.minQuantity.message}</p>
                    )}
                  </div>

                  {/* Quantidade Máxima */}
                  <div className="space-y-1">
                    <label className="text-[10px] md:text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 truncate block">
                      Qtd Máxima *
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      {...register('maxQuantity')}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200"
                    />
                    {errors.maxQuantity && (
                      <p className="text-[10px] text-red-500 font-semibold">{errors.maxQuantity.message}</p>
                    )}
                  </div>

                </div>

              </div>

              {/* Actions Footer */}
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
                  className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 shadow-md shadow-emerald-500/10"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isLoading ? 'Salvando...' : 'Salvar Produto'}
                </button>
              </div>

            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
