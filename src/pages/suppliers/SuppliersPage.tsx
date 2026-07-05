import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatCard } from '../../components/shared/StatCard';
import { DataTable } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ConfirmModal } from '../../components/shared/ConfirmModal';
import { SupplierModal } from './components/SupplierModal';
import { useSuppliers } from '../../hooks/useSuppliers';
import { Supplier } from '../../types';
import {
  Truck,
  UserCheck,
  UserPlus,
  Search,
  Eye,
  Pencil,
  Power,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const AvatarName: React.FC<{ name: string }> = ({ name }) => {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

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
  const colorClass = colors[Math.abs(hash) % colors.length];

  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 shadow-sm border border-black/5 ${colorClass}`}>
      {initials}
    </div>
  );
};

export const SuppliersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | undefined>(undefined);
  const [supplierToToggle, setSupplierToToggle] = useState<Supplier | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchInput]);

  const {
    suppliers,
    isLoading,
    isError,
    refetch,
    createSupplier,
    isCreating,
    updateSupplier,
    isUpdating,
    toggleStatus,
    isToggling,
  } = useSuppliers({
    search: debouncedSearch,
    status: statusFilter,
  });

  const isFiltered = searchInput !== '' || statusFilter !== 'all';
  const handleClearFilters = () => {
    setSearchInput('');
    setStatusFilter('all');
    setCurrentPage(1);
  };

  const totalCount = suppliers.length;
  const activeCount = suppliers.filter((s) => s.status === 'active').length;

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const newThisMonth = suppliers.filter((s) => {
    const d = new Date(s.createdAt);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;

  const formatDocument = (doc: string) => {
    const clean = doc.replace(/\D/g, '');
    if (clean.length === 14) {
      return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return doc;
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalCount);
  const paginatedSuppliers = suppliers.slice(startIndex, endIndex);

  const handleOpenCreateModal = () => {
    setSelectedSupplier(undefined);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsModalOpen(true);
  };

  const handleSaveSupplier = async (data: any) => {
    try {
      if (selectedSupplier) {
        await updateSupplier({ id: selectedSupplier.id, data });
        toast.success(`Cadastro do fornecedor "${data.name}" atualizado!`);
      } else {
        await createSupplier(data);
        toast.success(`Fornecedor "${data.name}" cadastrado com sucesso!`);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      // toast.error já é disparado no useSuppliers
    }
  };

  const handleToggleStatus = async (supplier: Supplier) => {
    if (supplier.status === 'active') {
      setSupplierToToggle(supplier);
      setIsConfirmOpen(true);
    } else {
      try {
        await toggleStatus({ id: supplier.id, isActive: true });
      } catch (err) {}
    }
  };

  const handleConfirmDeactivate = async () => {
    if (supplierToToggle) {
      try {
        await toggleStatus({ id: supplierToToggle.id, isActive: false });
        setIsConfirmOpen(false);
        setSupplierToToggle(null);
      } catch (err) {}
    }
  };

  const tableColumns = [
    {
      key: 'avatar',
      label: '',
      render: (row: Supplier) => <AvatarName name={row.name} />,
    },
    {
      key: 'name',
      label: 'Nome',
      render: (row: Supplier) => (
        <button
          onClick={() => navigate(`/suppliers/${row.id}`)}
          className="font-semibold text-gray-800 dark:text-gray-200 hover:text-[#10b981] dark:hover:text-[#10b981] text-left transition-colors duration-150"
        >
          {row.name}
        </button>
      ),
    },
    {
      key: 'document',
      label: 'Documento (CNPJ)',
      render: (row: Supplier) => <span className="font-mono text-xs">{formatDocument(row.document)}</span>,
    },
    {
      key: 'email',
      label: 'E-mail',
      render: (row: Supplier) => row.email || <span className="text-gray-400 dark:text-gray-600">-</span>,
    },
    {
      key: 'phone',
      label: 'Telefone',
      render: (row: Supplier) => row.phone || <span className="text-gray-400 dark:text-gray-600">-</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: Supplier) => <StatusBadge status={row.status} />,
    },
    {
      key: 'createdAt',
      label: 'Cadastro',
      render: (row: Supplier) => (
        <span className="text-xs">
          {new Date(row.createdAt).toLocaleDateString('pt-BR')}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (row: Supplier) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate(`/suppliers/${row.id}`)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors duration-150"
            title="Visualizar Detalhes"
          >
            <Eye className="w-4.5 h-4.5" />
          </button>

          <button
            type="button"
            onClick={() => handleOpenEditModal(row)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors duration-150"
            title="Editar Cadastro"
          >
            <Pencil className="w-4.5 h-4.5" />
          </button>

          <button
            type="button"
            onClick={() => handleToggleStatus(row)}
            className={`p-1.5 rounded-lg transition-colors duration-150 ${
              row.status === 'active'
                ? 'text-gray-400 hover:text-red-500 hover:bg-red-500/10'
                : 'text-gray-400 hover:text-emerald-500 hover:bg-emerald-500/10'
            }`}
            title={row.status === 'active' ? 'Desativar Fornecedor' : 'Ativar Fornecedor'}
          >
            <Power className="w-4.5 h-4.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Fornecedores"
        subtitle={`${totalCount} fornecedores cadastrados no total`}
        action={
          <button
            onClick={handleOpenCreateModal}
            className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-4 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors duration-200 shadow-md shadow-emerald-500/10 animate-fade-in"
          >
            <Plus className="w-4 h-4" />
            Novo Fornecedor
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          title="Total de Fornecedores"
          value={isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : totalCount}
          icon={<Truck className="w-5 h-5" />}
          accentColor="blue"
        />
        <StatCard
          title="Fornecedores Ativos"
          value={isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : activeCount}
          icon={<UserCheck className="w-5 h-5" />}
          accentColor="green"
        />
        <StatCard
          title="Novos este Mês"
          value={isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : newThisMonth}
          icon={<UserPlus className="w-5 h-5" />}
          accentColor="green"
        />
      </div>

      <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors duration-300">

        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
            <Search className="w-4.5 h-4.5" />
          </span>
          <input
            type="text"
            placeholder="Pesquisar por nome, e-mail, telefone ou documento..."
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

        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl border border-gray-200/50 dark:border-white/5">
            <button
              onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-[#1a1d27] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => { setStatusFilter('active'); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                statusFilter === 'active'
                  ? 'bg-white dark:bg-[#1a1d27] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Ativos
            </button>
            <button
              onClick={() => { setStatusFilter('inactive'); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                statusFilter === 'inactive'
                  ? 'bg-white dark:bg-[#1a1d27] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Inativos
            </button>
          </div>

          {isFiltered && (
            <button
              onClick={handleClearFilters}
              className="text-xs text-red-500 hover:text-red-700 font-semibold px-3 py-2 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all duration-200"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

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
        <>
          <DataTable
            columns={tableColumns}
            data={paginatedSuppliers}
            isLoading={isLoading}
            emptyMessage={
              debouncedSearch || statusFilter !== 'all'
                ? 'Nenhum fornecedor atende aos filtros definidos.'
                : 'Sua empresa ainda não possui fornecedores cadastrados.'
            }
          />

          {!isLoading && totalCount > 0 && (
            <div className="flex items-center justify-between mt-4 bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-4 shadow-sm transition-colors duration-300">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Exibindo <span className="font-semibold text-gray-800 dark:text-white">{startIndex + 1}</span> a{' '}
                <span className="font-semibold text-gray-800 dark:text-white">{endIndex}</span> de{' '}
                <span className="font-semibold text-gray-800 dark:text-white">{totalCount}</span> fornecedores
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="border border-gray-200 dark:border-white/10 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-40 transition-colors duration-200"
                  title="Página Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold px-3 text-gray-700 dark:text-gray-300">
                  Pág. {currentPage} de {totalPages || 1}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="border border-gray-200 dark:border-white/10 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-40 transition-colors duration-200"
                  title="Próxima Página"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <SupplierModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        supplier={selectedSupplier}
        onSave={handleSaveSupplier}
        isLoading={isCreating || isUpdating}
      />

      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Desativar Fornecedor"
        message={`Tem certeza que deseja desativar o cadastro de "${supplierToToggle?.name}"? O status será alterado para inativo no sistema.`}
        onConfirm={handleConfirmDeactivate}
        onCancel={() => { setIsConfirmOpen(false); setSupplierToToggle(null); }}
        isLoading={isToggling}
        confirmText="Desativar"
        variant="danger"
      />
    </div>
  );
};
export default SuppliersPage;
