import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatCard } from '../../components/shared/StatCard';
import { DataTable } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ConfirmModal } from '../../components/shared/ConfirmModal';
import { CustomerModal } from './components/CustomerModal';
import { useCustomers } from '../../hooks/useCustomers';
import { Customer } from '../../types';
import { 
  Users, 
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

// Avatar dinâmico baseado no hash do nome
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

export const CustomersPage: React.FC = () => {
  const navigate = useNavigate();

  // Estados dos filtros
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Controle de paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Controle de Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | undefined>(undefined);
  const [customerToToggle, setCustomerToToggle] = useState<Customer | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Debounce do input de busca (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1); // Resetar para primeira página ao filtrar
    }, 300);

    return () => clearTimeout(handler);
  }, [searchInput]);

  // Hook de clientes (TanStack Query)
  const {
    customers,
    isLoading,
    isError,
    refetch,
    createCustomer,
    isCreating,
    updateCustomer,
    isUpdating,
    toggleStatus,
    isToggling,
  } = useCustomers({
    search: debouncedSearch,
    status: statusFilter,
  });

  // Limpeza de filtros
  const isFiltered = searchInput !== '' || statusFilter !== 'all';
  const handleClearFilters = () => {
    setSearchInput('');
    setStatusFilter('all');
    setCurrentPage(1);
  };

  // Cálculos de métricas rápidos (baseado em todos os registros carregados no query)
  const totalCount = customers.length;
  const activeCount = customers.filter((c) => c.isActive).length;
  
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const newThisMonth = customers.filter((c) => {
    const d = new Date(c.createdAt);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;

  // Formatar CPF/CNPJ
  const formatDocument = (doc: string) => {
    const clean = doc.replace(/\D/g, '');
    if (clean.length === 11) {
      return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (clean.length === 14) {
      return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return doc;
  };

  // Paginação local dos dados vindos filtrados do React Query
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalCount);
  const paginatedCustomers = customers.slice(startIndex, endIndex);

  // Ações de criação/edição
  const handleOpenCreateModal = () => {
    setSelectedCustomer(undefined);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cust: Customer) => {
    setSelectedCustomer(cust);
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (data: any) => {
    try {
      if (selectedCustomer) {
        await updateCustomer({ id: selectedCustomer.id, data });
        toast.success(`Cadastro do cliente "${data.fullName}" atualizado!`);
      } else {
        await createCustomer(data);
        toast.success(`Cliente "${data.fullName}" cadastrado com sucesso!`);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      // toast.error já é disparado no useCustomers
    }
  };

  // Ação de ativar/desativar status
  const handleToggleStatus = async (cust: Customer) => {
    if (cust.isActive) {
      // Se for desativar, requer modal de confirmação
      setCustomerToToggle(cust);
      setIsConfirmOpen(true);
    } else {
      // Se for ativar, executa direto para melhor UX
      try {
        await toggleStatus({ id: cust.id, isActive: true });
      } catch (err) {}
    }
  };

  const handleConfirmDeactivate = async () => {
    if (customerToToggle) {
      try {
        await toggleStatus({ id: customerToToggle.id, isActive: false });
        setIsConfirmOpen(false);
        setCustomerToToggle(null);
      } catch (err) {}
    }
  };

  // Definição das colunas da DataTable
  const tableColumns = [
    {
      key: 'avatar',
      label: '',
      render: (row: Customer) => <AvatarName name={row.fullName} />,
    },
    {
      key: 'fullName',
      label: 'Nome Completo',
      render: (row: Customer) => (
        <button
          onClick={() => navigate(`/customers/${row.id}`)}
          className="font-semibold text-gray-800 dark:text-gray-200 hover:text-[#10b981] dark:hover:text-[#10b981] text-left transition-colors duration-150"
        >
          {row.fullName}
        </button>
      ),
    },
    {
      key: 'document',
      label: 'Documento',
      render: (row: Customer) => <span className="font-mono text-xs">{formatDocument(row.document)}</span>,
    },
    {
      key: 'email',
      label: 'E-mail',
      render: (row: Customer) => row.email || <span className="text-gray-400 dark:text-gray-600">-</span>,
    },
    {
      key: 'phone',
      label: 'Telefone',
      render: (row: Customer) => row.phone || <span className="text-gray-400 dark:text-gray-600">-</span>,
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row: Customer) => <StatusBadge status={row.isActive ? 'active' : 'inactive'} />,
    },
    {
      key: 'createdAt',
      label: 'Cadastro',
      render: (row: Customer) => (
        <span className="text-xs">
          {new Date(row.createdAt).toLocaleDateString('pt-BR')}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (row: Customer) => (
        <div className="flex items-center gap-1">
          {/* Detalhes */}
          <button
            type="button"
            onClick={() => navigate(`/customers/${row.id}`)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-[#10b981] hover:bg-[#10b981]/10 transition-colors duration-150"
            title="Visualizar Detalhes"
          >
            <Eye className="w-4.5 h-4.5" />
          </button>
          
          {/* Editar */}
          <button
            type="button"
            onClick={() => handleOpenEditModal(row)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors duration-150"
            title="Editar Cadastro"
          >
            <Pencil className="w-4.5 h-4.5" />
          </button>
          
          {/* Desativar/Ativar */}
          <button
            type="button"
            onClick={() => handleToggleStatus(row)}
            className={`p-1.5 rounded-lg transition-colors duration-150 ${
              row.isActive 
                ? 'text-gray-400 hover:text-red-500 hover:bg-red-500/10'
                : 'text-gray-400 hover:text-emerald-500 hover:bg-emerald-500/10'
            }`}
            title={row.isActive ? 'Desativar Cliente' : 'Ativar Cliente'}
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
        title="Clientes"
        subtitle={`${totalCount} clientes cadastrados no total`}
        action={
          <button
            onClick={handleOpenCreateModal}
            className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-4 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors duration-200 shadow-md shadow-emerald-500/10 animate-fade-in"
          >
            <Plus className="w-4 h-4" />
            Novo Cliente
          </button>
        }
      />

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          title="Total de Clientes"
          value={isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : totalCount}
          icon={<Users className="w-5 h-5" />}
          accentColor="blue"
        />
        <StatCard
          title="Clientes Ativos"
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

      {/* Cartão de Filtros */}
      <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors duration-300">
        
        {/* Barra de Busca com Debounce */}
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

        {/* Filtros de Status */}
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

          {/* Limpar Filtros */}
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

      {/* Grid de Dados (DataTable) */}
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
            data={paginatedCustomers}
            isLoading={isLoading}
            emptyMessage={
              debouncedSearch || statusFilter !== 'all'
                ? 'Nenhum cliente atende aos filtros definidos.'
                : 'Sua empresa ainda não possui clientes cadastrados.'
            }
          />

          {/* Paginação */}
          {!isLoading && totalCount > 0 && (
            <div className="flex items-center justify-between mt-4 bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-4 shadow-sm transition-colors duration-300">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Exibindo <span className="font-semibold text-gray-800 dark:text-white">{startIndex + 1}</span> a{' '}
                <span className="font-semibold text-gray-800 dark:text-white">{endIndex}</span> de{' '}
                <span className="font-semibold text-gray-800 dark:text-white">{totalCount}</span> clientes
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

      {/* Modal de Criação / Edição */}
      <CustomerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        customer={selectedCustomer}
        onSave={handleSaveCustomer}
        isLoading={isCreating || isUpdating}
      />

      {/* ConfirmModal de Desativação */}
      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Desativar Cliente"
        message={`Tem certeza que deseja desativar o cadastro de "${customerToToggle?.fullName}"? O status será alterado para inativo no sistema.`}
        onConfirm={handleConfirmDeactivate}
        onCancel={() => { setIsConfirmOpen(false); setCustomerToToggle(null); }}
        isLoading={isToggling}
        confirmText="Desativar"
        variant="danger"
      />
    </div>
  );
};
export default CustomersPage;
