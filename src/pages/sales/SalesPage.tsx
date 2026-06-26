import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatCard } from '../../components/shared/StatCard';
import { DataTable } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ConfirmModal } from '../../components/shared/ConfirmModal';

import { SaleModal } from './components/SaleModal';
import { EditStatusModal } from './components/EditStatusModal';

import { useSales, useSalesStats, useSaleMutations } from '../../hooks/useSales';
import { Sale } from '../../types';
import { 
  ShoppingCart, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  Search, 
  X, 
  Eye, 
  Pencil, 
  XCircle, 
  Plus, 
  Loader2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

export const SalesPage: React.FC = () => {
  const navigate = useNavigate();

  // Filters State
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending' | 'cancelled'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination Control
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modals state
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isEditStatusOpen, setIsEditStatusOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | undefined>(undefined);

  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);

  // Debounce search input (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1); // Reset to page 1 on filter
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Hook queries
  const { sales, isLoading: isSalesLoading, isError, refetch } = useSales({
    search: debouncedSearch,
    paymentStatus: statusFilter,
    dateFrom,
    dateTo
  });

  const { stats, isLoading: isStatsLoading } = useSalesStats();

  // Hook mutations
  const { createSale, isCreating, updateSaleStatus, isUpdatingStatus, cancelSale: cancelSaleMutation, isCancelling } = useSaleMutations();

  // Reset page on filter changes
  const handleFilterChange = (type: 'status' | 'dateFrom' | 'dateTo', value: string) => {
    if (type === 'status') {
      setStatusFilter(value as any);
    } else if (type === 'dateFrom') {
      setDateFrom(value);
    } else if (type === 'dateTo') {
      setDateTo(value);
    }
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  const isFiltered = searchInput !== '' || statusFilter !== 'all' || dateFrom !== '' || dateTo !== '';

  // Modal actions triggers
  const handleOpenSaleModal = () => {
    setIsSaleModalOpen(true);
  };

  const handleOpenStatusModal = (sale: Sale) => {
    setSelectedSale(sale);
    setIsEditStatusOpen(true);
  };

  const handleCancelClick = (sale: Sale) => {
    if (sale.paymentStatus === 'cancelled') {
      toast.warning('Esta venda já está cancelada.');
      return;
    }
    setSaleToCancel(sale);
    setIsCancelConfirmOpen(true);
  };

  // Submit mutations
  const handleCreateSale = async (data: any) => {
    try {
      await createSale(data);
      setIsSaleModalOpen(false);
    } catch (e) {
      // handled
    }
  };

  const handleUpdateSaleStatus = async (id: string, paymentStatus: 'paid' | 'pending' | 'cancelled') => {
    try {
      await updateSaleStatus({ id, paymentStatus });
      setIsEditStatusOpen(false);
    } catch (e) {
      // handled
    }
  };

  const handleConfirmCancelSale = async () => {
    if (!saleToCancel) return;
    try {
      await cancelSaleMutation(saleToCancel.id);
      setIsCancelConfirmOpen(false);
      setSaleToCancel(null);
    } catch (e) {
      // handled
    }
  };

  // Format money BRL
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Avatar Initials Name
  const getInitials = (name?: string) => {
    if (!name) return '??';
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  // Consistent Avatar Color Hash
  const getAvatarBgClass = (name: string) => {
    const colors = [
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
      'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    ];

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Render Payment Method translate label and emoji/icon
  const renderPaymentMethod = (method: string) => {
    const maps: Record<string, { label: string, emoji: string, color: string }> = {
      cash: { label: 'Dinheiro', emoji: '💵', color: 'text-emerald-500' },
      money: { label: 'Dinheiro', emoji: '💵', color: 'text-emerald-500' },
      credit_card: { label: 'Cartão Crédito', emoji: '💳', color: 'text-blue-500' },
      debit_card: { label: 'Cartão Débito', emoji: '💳', color: 'text-indigo-500' },
      pix: { label: 'PIX', emoji: '⚡', color: 'text-cyan-500 font-bold' },
      bank_transfer: { label: 'Transferência', emoji: '🏦', color: 'text-amber-500' },
      other: { label: 'Outro', emoji: '📝', color: 'text-gray-500' }
    };
    const info = maps[method] || { label: 'Outro', emoji: '📝', color: 'text-gray-500' };
    return (
      <span className="flex items-center gap-1 font-semibold text-xs text-gray-700 dark:text-gray-300">
        <span className={info.color}>{info.emoji}</span>
        <span>{info.label}</span>
      </span>
    );
  };

  // Pagination bounds
  const totalCount = sales.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const paginatedSales = sales.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Table Columns Definition
  const columns = [
    {
      key: 'id',
      label: '# ID',
      render: (row: Sale) => (
        <span 
          className="font-mono font-bold text-[#10b981] hover:underline cursor-pointer select-all"
          onClick={() => navigate(`/sales/${row.id}`)}
        >
          {row.id.slice(0, 8).toUpperCase()}...
        </span>
      ),
    },
    {
      key: 'customer',
      label: 'Cliente',
      render: (row: Sale) => {
        const clientName = row.customer?.fullName || 'Consumidor Final';
        return (
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 border border-black/5 ${getAvatarBgClass(clientName)}`}>
              {getInitials(clientName)}
            </div>
            <span 
              className="font-bold text-gray-900 dark:text-white hover:text-[#10b981] transition-colors cursor-pointer block truncate max-w-[140px]"
              onClick={() => row.customerId && navigate(`/customers/${row.customerId}`)}
              title={clientName}
            >
              {clientName}
            </span>
          </div>
        );
      },
    },
    {
      key: 'products',
      label: 'Produtos',
      render: (row: any) => (
        <span className="text-gray-600 dark:text-gray-300 font-semibold block truncate max-w-[190px]" title={row.products}>
          {row.products || 'Diversos Itens'}
        </span>
      ),
    },
    {
      key: 'total',
      label: 'Total Bruto',
      render: (row: Sale) => (
        <span className="text-gray-500 font-medium">
          {formatMoney(row.total)}
        </span>
      ),
    },
    {
      key: 'discount',
      label: 'Desconto',
      render: (row: Sale) => (
        <span className={`font-semibold ${row.discount > 0 ? 'text-red-500' : 'text-gray-400'}`}>
          {row.discount > 0 ? `-${formatMoney(row.discount)}` : formatMoney(0)}
        </span>
      ),
    },
    {
      key: 'finalValue',
      label: 'Valor Final',
      render: (row: Sale) => (
        <span className="font-bold text-gray-900 dark:text-white">
          {formatMoney(row.finalValue)}
        </span>
      ),
    },
    {
      key: 'paymentMethod',
      label: 'Pagamento',
      render: (row: Sale) => renderPaymentMethod(row.paymentMethod),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: Sale) => {
        // StatusBadge maps 'canceled' (single l)
        const statusMap = row.paymentStatus === 'cancelled' ? 'canceled' : row.paymentStatus;
        return <StatusBadge status={statusMap} />;
      },
    },
    {
      key: 'createdAt',
      label: 'Data',
      render: (row: Sale) => (
        <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
          {new Date(row.createdAt).toLocaleDateString('pt-BR')}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (row: Sale) => (
        <div className="flex items-center gap-0.5">
          {/* Eye Details */}
          <button
            type="button"
            onClick={() => navigate(`/sales/${row.id}`)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
            title="Ver Venda"
          >
            <Eye className="w-4.5 h-4.5" />
          </button>

          {/* Pencil Edit Status */}
          <button
            type="button"
            onClick={() => handleOpenStatusModal(row)}
            disabled={row.paymentStatus === 'cancelled'}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
            title="Alterar Status"
          >
            <Pencil className="w-4.5 h-4.5" />
          </button>

          {/* XCircle Cancel Venda */}
          <button
            type="button"
            onClick={() => handleCancelClick(row)}
            disabled={row.paymentStatus === 'cancelled'}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
            title="Cancelar Venda"
          >
            <XCircle className="w-4.5 h-4.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      
      {/* Top Page Header */}
      <PageHeader
        title="Vendas"
        subtitle={`${totalCount} pedidos de vendas localizados`}
        action={
          <button
            onClick={handleOpenSaleModal}
            className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 shadow-md shadow-emerald-500/10"
          >
            <Plus className="w-4.5 h-4.5" />
            Nova Venda
          </button>
        }
      />

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Vendas do Mês"
          value={isStatsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : stats?.salesCountThisMonth}
          icon={<ShoppingCart className="w-5 h-5" />}
          accentColor="blue"
        />
        <StatCard
          title="Receita do Mês"
          value={isStatsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : formatMoney(stats?.revenueThisMonth || 0)}
          icon={<DollarSign className="w-5 h-5" />}
          accentColor="green"
        />
        <StatCard
          title="Ticket Médio"
          value={isStatsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : formatMoney(stats?.averageTicket || 0)}
          icon={<TrendingUp className="w-5 h-5" />}
          accentColor="green"
        />
        <StatCard
          title="A Receber"
          value={isStatsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : formatMoney(stats?.receivablePendingValue || 0)}
          icon={<Clock className="w-5 h-5" />}
          accentColor="yellow"
        />
      </div>

      {/* Filter panel card */}
      <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors duration-300">
        
        {/* Term Search */}
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
            <Search className="w-4.5 h-4.5" />
          </span>
          <input
            type="text"
            placeholder="Pesquisar por nome do cliente..."
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

        {/* Status and Dates select boxes */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Status select */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="px-4 py-2.5 pr-8 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#1a1d27] text-xs font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] appearance-none cursor-pointer"
            >
              <option value="all">Todos os Status</option>
              <option value="paid">Pago</option>
              <option value="pending">Pendente</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>

          {/* Date Picker Range Inputs */}
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-1 text-xs">
            <span className="text-gray-400 flex items-center gap-1 px-1 font-semibold">
              <CalendarDays className="w-3.5 h-3.5" /> Período:
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              className="bg-transparent text-gray-700 dark:text-gray-300 outline-none p-1 font-semibold cursor-pointer dark:[color-scheme:dark]"
            />
            <span className="text-gray-300 dark:text-white/10 px-0.5">/</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className="bg-transparent text-gray-700 dark:text-gray-300 outline-none p-1 font-semibold cursor-pointer dark:[color-scheme:dark]"
            />
          </div>

          {/* Clear Filters Button */}
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

      {/* Grid of Results / Tables */}
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
              data={paginatedSales}
              columns={columns}
              isLoading={isSalesLoading}
              emptyIcon={<ShoppingCart className="w-12 h-12 text-[#10b981] mb-3" />}
              emptyTitle="Nenhuma venda encontrada"
              emptySubtitle="Suas vendas aparecerão aqui"
            />
          </div>

          {/* Pagination Controls */}
          {!isSalesLoading && totalPages > 1 && (
            <div className="flex justify-between items-center px-1">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                Mostrando {paginatedSales.length} de {totalCount} vendas
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
      <SaleModal
        isOpen={isSaleModalOpen}
        onClose={() => setIsSaleModalOpen(false)}
        onSave={handleCreateSale}
        isLoading={isCreating}
      />

      <EditStatusModal
        isOpen={isEditStatusOpen}
        onClose={() => setIsEditStatusOpen(false)}
        sale={selectedSale}
        onUpdateStatus={handleUpdateSaleStatus}
        isLoading={isUpdatingStatus}
      />

      {/* ConfirmModal para Cancelamento de Venda */}
      <ConfirmModal
        isOpen={isCancelConfirmOpen}
        onClose={() => { setIsCancelConfirmOpen(false); setSaleToCancel(null); }}
        onConfirm={handleConfirmCancelSale}
        title="Cancelar Venda"
        message={
          saleToCancel
            ? `Tem certeza que deseja cancelar a venda #${saleToCancel.id.slice(0, 8).toUpperCase()}? O estoque de cada produto associado será restaurado no inventário e a respectiva conta a receber será cancelada.`
            : ''
        }
        confirmText="Confirmar Cancelamento"
        variant="danger"
        isLoading={isCancelling}
      />

    </div>
  );
};
