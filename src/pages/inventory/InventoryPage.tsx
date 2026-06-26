import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatCard } from '../../components/shared/StatCard';
import { DataTable } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ConfirmModal } from '../../components/shared/ConfirmModal';

import { ProductModal } from './components/ProductModal';
import { StockAdjustModal } from './components/StockAdjustModal';
import { CSVImportModal } from './components/CSVImportModal';

import { useInventory, useInventoryStats, useCategories, useProductMutations } from '../../hooks/useInventory';
import { Product } from '../../types';
import { 
  Package, 
  AlertTriangle, 
  PackageX, 
  DollarSign, 
  Search, 
  X, 
  Eye, 
  Pencil, 
  RefreshCw, 
  Power, 
  Plus, 
  Upload,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

export const InventoryPage: React.FC = () => {
  const navigate = useNavigate();

  // Filters state
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCatId, setSelectedCatId] = useState('all');
  const [stockStatus, setStockStatus] = useState<'all' | 'available' | 'low' | 'out'>('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>(undefined);
  
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [productToAdjust, setProductToAdjust] = useState<Product | undefined>(undefined);

  const [isCSVModalOpen, setIsCSVModalOpen] = useState(false);

  const [productToToggle, setProductToToggle] = useState<Product | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Debounce search input (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1); // Reset to page 1 on search
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Hook queries
  const { products, isLoading: isProductsLoading, isError, refetch } = useInventory({
    search: debouncedSearch,
    categoryId: selectedCatId,
    stockStatus
  });

  const { stats, isLoading: isStatsLoading } = useInventoryStats();
  const { categories } = useCategories();

  // Mutations
  const { 
    createProduct, 
    isCreating, 
    updateProduct, 
    isUpdating, 
    adjustStock, 
    isAdjustingStock,
    toggleStatus, 
    isToggling,
    importCSV, 
    isImportingCSV 
  } = useProductMutations();

  // Reset pagination when other filters change
  const handleFilterChange = (type: 'category' | 'status', value: string) => {
    if (type === 'category') {
      setSelectedCatId(value);
    } else {
      setStockStatus(value as any);
    }
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setSelectedCatId('all');
    setStockStatus('all');
    setCurrentPage(1);
  };

  const isFiltered = searchInput !== '' || selectedCatId !== 'all' || stockStatus !== 'all';

  // Modal handlers
  const handleOpenCreateModal = () => {
    setSelectedProduct(undefined);
    setIsProductModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setSelectedProduct(product);
    setIsProductModalOpen(true);
  };

  const handleOpenAdjustModal = (product: Product) => {
    setProductToAdjust(product);
    setIsAdjustModalOpen(true);
  };

  const handleToggleClick = (product: Product) => {
    setProductToToggle(product);
    setIsConfirmOpen(true);
  };

  // Mutator triggers
  const handleSaveProduct = async (data: any) => {
    try {
      if (selectedProduct) {
        await updateProduct({ id: selectedProduct.id, data });
        toast.success(`Produto "${data.name}" atualizado com sucesso!`);
      } else {
        await createProduct(data);
        toast.success(`Produto "${data.name}" cadastrado com sucesso!`);
      }
      setIsProductModalOpen(false);
    } catch (e) {
      // toast already shown in hook
    }
  };

  const handleAdjustStock = async (id: string, quantity: number, operation: 'set' | 'add' | 'subtract') => {
    try {
      await adjustStock({ id, quantity, operation });
      setIsAdjustModalOpen(false);
    } catch (e) {
      // handled
    }
  };

  const handleConfirmToggleStatus = async () => {
    if (!productToToggle) return;
    try {
      await toggleStatus({ id: productToToggle.id, isActive: !productToToggle.isActive });
      setIsConfirmOpen(false);
      setProductToToggle(null);
    } catch (e) {
      // handled
    }
  };

  // Format money pt-BR
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Pagination bounds
  const totalCount = products.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const paginatedProducts = products.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Table Columns Definition
  const columns = [
    {
      key: 'name',
      label: 'Produto',
      render: (row: Product) => {
        // Status calculations:
        // currentQuantity = 0 -> Sem Estoque
        // currentQuantity <= minQuantity -> Estoque Baixo
        // available otherwise
        const isOut = row.currentQuantity === 0;
        const isLow = row.currentQuantity > 0 && row.currentQuantity <= row.minQuantity;
        
        let statusColor = 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
        if (isOut) {
          statusColor = 'bg-rose-500/10 text-rose-500 border border-rose-500/20';
        } else if (isLow) {
          statusColor = 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
        }

        return (
          <div className="flex items-center gap-3">
            <div className={`w-8.5 h-8.5 rounded-lg flex items-center justify-center shrink-0 ${statusColor}`}>
              <Package className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-gray-900 dark:text-white text-sm hover:text-[#10b981] transition-colors cursor-pointer block truncate" onClick={() => navigate(`/inventory/${row.id}`)}>
                {row.name}
              </span>
              <span className="text-xs font-mono text-gray-400 dark:text-gray-500 block select-all mt-0.5">
                {row.sku}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'category',
      label: 'Categoria',
      render: (row: Product) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 border border-gray-200/40 dark:border-white/5">
          {row.category?.name || 'Geral'}
        </span>
      ),
    },
    {
      key: 'costPrice',
      label: 'Custo',
      render: (row: Product) => (
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          {formatMoney(row.costPrice)}
        </span>
      ),
    },
    {
      key: 'salePrice',
      label: 'Venda',
      render: (row: Product) => (
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          {formatMoney(row.salePrice)}
        </span>
      ),
    },
    {
      key: 'margin',
      label: 'Margem %',
      render: (row: Product) => {
        const margin = row.costPrice > 0 ? ((row.salePrice - row.costPrice) / row.costPrice) * 100 : 0;
        
        let badgeColor: 'green' | 'yellow' | 'red' = 'green';
        if (margin < 5) badgeColor = 'red';
        else if (margin <= 20) badgeColor = 'yellow';

        return (
          <StatusBadge
            variant={badgeColor}
            label={`${margin.toFixed(1)}%`}
          />
        );
      },
    },
    {
      key: 'stock',
      label: 'Estoque',
      render: (row: Product) => {
        const percent = Math.min(100, row.maxQuantity > 0 ? (row.currentQuantity / row.maxQuantity) * 100 : 0);
        const isOut = row.currentQuantity === 0;
        const isLow = row.currentQuantity > 0 && row.currentQuantity <= row.minQuantity;

        let barColor = 'bg-[#10b981]';
        let textColor = 'text-gray-900 dark:text-white font-bold';
        if (isOut) {
          barColor = 'bg-rose-500';
          textColor = 'text-rose-500 font-bold';
        } else if (isLow) {
          barColor = 'bg-amber-500';
          textColor = 'text-amber-500 font-bold';
        }

        return (
          <div className="w-[120px] space-y-1">
            <div className="flex justify-between text-xs">
              <span className={textColor}>{row.currentQuantity}</span>
              <span className="text-gray-400 font-medium">/ {row.maxQuantity}</span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div 
                className={`h-full ${barColor}`} 
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: 'unit',
      label: 'Unidade',
      render: (row: Product) => (
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
          {row.unit}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (row: Product) => (
        <div className="flex items-center gap-1">
          {/* Visualizar detalhes */}
          <button
            type="button"
            onClick={() => navigate(`/inventory/${row.id}`)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors duration-150"
            title="Ver Detalhes"
          >
            <Eye className="w-4.5 h-4.5" />
          </button>

          {/* Editar cadastro */}
          <button
            type="button"
            onClick={() => handleOpenEditModal(row)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors duration-150"
            title="Editar Produto"
          >
            <Pencil className="w-4.5 h-4.5" />
          </button>

          {/* Ajustar estoque rápido */}
          <button
            type="button"
            onClick={() => handleOpenAdjustModal(row)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors duration-150"
            title="Ajustar Quantidades"
          >
            <RefreshCw className="w-4.5 h-4.5" />
          </button>
          
          {/* Desativar/Ativar */}
          <button
            type="button"
            onClick={() => handleToggleClick(row)}
            className={`p-1.5 rounded-lg transition-colors duration-150 ${
              row.isActive 
                ? 'text-gray-400 hover:text-red-500 hover:bg-red-500/10'
                : 'text-gray-400 hover:text-emerald-500 hover:bg-emerald-500/10'
            }`}
            title={row.isActive ? 'Desativar Produto' : 'Ativar Produto'}
          >
            <Power className="w-4.5 h-4.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Cabeçalho */}
      <PageHeader
        title="Estoque"
        subtitle={`${totalCount} produtos listados de acordo com os filtros`}
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setIsCSVModalOpen(true)}
              className="border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200"
            >
              <Upload className="w-4 h-4" />
              Importar CSV
            </button>
            <button
              onClick={handleOpenCreateModal}
              className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 shadow-md shadow-emerald-500/10"
            >
              <Plus className="w-4 h-4" />
              Novo Produto
            </button>
          </div>
        }
      />

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total de Produtos"
          value={isStatsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : stats?.totalActiveProducts}
          icon={<Package className="w-5 h-5" />}
          accentColor="blue"
        />
        <StatCard
          title="Estoque Baixo"
          value={isStatsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : stats?.lowStockProducts}
          icon={<AlertTriangle className="w-5 h-5" />}
          accentColor="yellow"
        />
        <StatCard
          title="Sem Estoque"
          value={isStatsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : stats?.outOfStockProducts}
          icon={<PackageX className="w-5 h-5" />}
          accentColor="red"
        />
        <StatCard
          title="Valor do Estoque"
          value={isStatsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : formatMoney(stats?.totalInventoryValue || 0)}
          icon={<DollarSign className="w-5 h-5" />}
          accentColor="green"
        />
      </div>

      {/* Cartão de Filtros */}
      <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors duration-300">
        
        {/* Barra de Busca */}
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
            <Search className="w-4.5 h-4.5" />
          </span>
          <input
            type="text"
            placeholder="Pesquisar por nome ou SKU..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Categoria e Status */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Categoria Select */}
          <div className="relative">
            <select
              value={selectedCatId}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="px-4 py-2.5 pr-8 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200 appearance-none cursor-pointer"
            >
              <option value="all" className="dark:bg-[#1a1d27]">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id} className="dark:bg-[#1a1d27]">{c.name}</option>
              ))}
            </select>
          </div>

          {/* Status Select */}
          <div className="relative">
            <select
              value={stockStatus}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="px-4 py-2.5 pr-8 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200 appearance-none cursor-pointer"
            >
              <option value="all" className="dark:bg-[#1a1d27]">Todos os status</option>
              <option value="available" className="dark:bg-[#1a1d27]">Disponível</option>
              <option value="low" className="dark:bg-[#1a1d27]">Estoque Baixo</option>
              <option value="out" className="dark:bg-[#1a1d27]">Sem Estoque</option>
            </select>
          </div>

          {/* Limpar Filtros */}
          {isFiltered && (
            <button
              onClick={handleClearFilters}
              className="text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white flex items-center gap-1 py-2 px-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all duration-200"
            >
              <X className="w-3.5 h-3.5" />
              Limpar Filtros
            </button>
          )}

        </div>

      </div>

      {/* Grid de Dados */}
      {isError ? (
        <div className="flex flex-col items-center justify-center bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-10 shadow-sm transition-colors duration-300 text-center animate-fade-in">
          <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-full text-red-500 mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-lg mb-1">
            Não foi possível carregar os dados
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-6">
            Ocorreu um problema ao conectar com o banco de dados. Verifique sua conexão e tente novamente.
          </p>
          <button
            onClick={() => refetch()}
            className="bg-red-500 hover:bg-red-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium transition-colors duration-200 shadow-md shadow-red-500/10 active:scale-95"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm transition-colors duration-300 overflow-hidden">
            <DataTable
              data={paginatedProducts}
              columns={columns}
              isLoading={isProductsLoading}
              emptyIcon={<Package className="w-12 h-12 text-[#10b981] mb-3" />}
              emptyTitle="Nenhum produto localizado"
              emptySubtitle={
                isFiltered
                  ? 'Tente ajustar os termos de busca ou filtros de categorias selecionados.'
                  : 'Cadastre seu primeiro produto manualmente ou realize uma importação em lote de arquivo CSV.'
              }
            />
          </div>

          {/* Paginação */}
          {!isProductsLoading && totalPages > 1 && (
            <div className="flex justify-between items-center px-1">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                Mostrando {paginatedProducts.length} de {totalCount} produtos
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="flex items-center text-xs font-bold text-gray-700 dark:text-gray-300 px-2">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modais do Módulo */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        product={selectedProduct}
        onSave={handleSaveProduct}
        isLoading={isCreating || isUpdating}
      />

      <StockAdjustModal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        product={productToAdjust}
        onAdjust={handleAdjustStock}
        isLoading={isAdjustingStock}
      />

      <CSVImportModal
        isOpen={isCSVModalOpen}
        onClose={() => setIsCSVModalOpen(false)}
        onImport={importCSV}
        isLoading={isImportingCSV}
      />

      {/* ConfirmModal para Desativação/Ativação */}
      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => { setIsConfirmOpen(false); setProductToToggle(null); }}
        onConfirm={handleConfirmToggleStatus}
        title={productToToggle?.isActive ? 'Desativar Produto' : 'Ativar Produto'}
        message={
          productToToggle?.isActive
            ? `Tem certeza que deseja desativar o produto "${productToToggle.name}"? Ele deixará de aparecer ativo nos módulos de vendas.`
            : `Deseja reativar o produto "${productToToggle?.name}" no estoque?`
        }
        confirmText={productToToggle?.isActive ? 'Desativar' : 'Ativar'}
        variant={productToToggle?.isActive ? 'danger' : 'success'}
        isLoading={isToggling}
      />

    </div>
  );
};
