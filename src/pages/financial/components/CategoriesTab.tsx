import React, { useState } from 'react';
import { DataTable } from '../../../components/shared/DataTable';
import { ConfirmModal } from '../../../components/shared/ConfirmModal';
import { useFinancial } from '../../../hooks/useFinancial';
import { FinancialCategory } from '../../../types';
import { CategoryInput } from '../../../services/financialService';
import { CategoryModal } from './CategoryModal';
import { Pencil, Plus, Tag, Trash2 } from 'lucide-react';

export const CategoriesTab: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialCategory | undefined>(undefined);
  const [toDelete, setToDelete] = useState<FinancialCategory | null>(null);

  const {
    categories,
    isCategoriesLoading,
    createCategory,
    isCreatingCategory,
    updateCategory,
    isUpdatingCategory,
    deleteCategory,
    isDeletingCategory,
  } = useFinancial({
    enableReceivables: false,
    enablePayables: false,
    enableCashFlow: false,
  });

  const handleOpenNew = () => {
    setEditing(undefined);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (row: FinancialCategory) => {
    setEditing(row);
    setIsModalOpen(true);
  };

  const handleSave = async (data: CategoryInput) => {
    if (editing) {
      await updateCategory({ id: editing.id, data });
    } else {
      await createCategory(data);
    }
  };

  const handleConfirmDelete = async () => {
    if (!toDelete) return;
    await deleteCategory(toDelete.id);
    setToDelete(null);
  };

  const columns = [
    {
      key: 'name',
      label: 'Nome',
      render: (row: FinancialCategory) => (
        <span className="font-semibold text-gray-900 dark:text-white">{row.name}</span>
      ),
    },
    {
      key: 'type',
      label: 'Tipo',
      render: (row: FinancialCategory) => (
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
            row.type === 'revenue'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
          }`}
        >
          {row.type === 'revenue' ? 'Receita' : 'Despesa'}
        </span>
      ),
    },
    {
      key: 'color',
      label: 'Cor',
      render: (row: FinancialCategory) => (
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg border border-gray-200 dark:border-white/10" style={{ backgroundColor: row.color }} />
          <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{row.color?.toUpperCase()}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (row: FinancialCategory) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleOpenEdit(row)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
            title="Editar"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setToDelete(row)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400 font-semibold">
          Cadastro de categorias de receita e despesa para organização financeira.
        </p>
        <button
          onClick={handleOpenNew}
          className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 shadow-md shadow-emerald-500/10 self-start"
        >
          <Plus className="w-4 h-4" />
          Nova Categoria
        </button>
      </div>

      <DataTable
        data={categories}
        columns={columns}
        isLoading={isCategoriesLoading}
        emptyIcon={<Tag className="w-12 h-12 text-[#10b981] mb-3" />}
        emptyTitle="Nenhuma categoria cadastrada"
        emptySubtitle="Crie categorias para classificar suas receitas e despesas"
      />

      <CategoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        category={editing}
        onSave={handleSave}
        isLoading={isCreatingCategory || isUpdatingCategory}
      />

      <ConfirmModal
        isOpen={toDelete !== null}
        title="Excluir Categoria"
        message={`Tem certeza que deseja excluir a categoria "${toDelete?.name ?? ''}"? Esta ação não pode ser desfeita.`}
        variant="danger"
        confirmText="Excluir"
        isLoading={isDeletingCategory}
        onConfirm={handleConfirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
};

export default CategoriesTab;
