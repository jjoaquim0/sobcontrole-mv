import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCustomerDetails, useCustomers } from '../../hooks/useCustomers';
import { StatCard } from '../../components/shared/StatCard';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { CustomerModal } from './components/CustomerModal';
import { ConfirmModal } from '../../components/shared/ConfirmModal';
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  MapPin, 
  ShoppingBag, 
  DollarSign, 
  Calendar,
  Pencil,
  Loader2,
  Eye,
  Copy,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  UserCheck,
  CreditCard
} from 'lucide-react';
import { toast } from 'sonner';

export const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  
  // Local pagination for history
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Query details data
  const { data, isLoading, isError, refetch } = useCustomerDetails(id || '');
  
  // Customers mutations
  const { updateCustomer, isUpdating, toggleStatus, isToggling } = useCustomers();

  // Format currency
  const formatCurrency = (value?: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

  // Format date
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Nenhuma compra';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatFullDateTime = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format CPF/CNPJ
  const formatDocument = (doc: string) => {
    const clean = doc.replace(/\D/g, '');
    if (clean.length === 11) {
      return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (clean.length === 14) {
      return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return doc;
  };

  // Click to copy customer ID
  const handleCopyId = (clientId: string) => {
    navigator.clipboard.writeText(clientId);
    toast.success('ID do cliente copiado para a área de transferência!');
  };

  // Get initials for avatar
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

  // Hash name for consistent avatar color
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

  // Extract address details
  const getAddressInfo = (addressStr?: string) => {
    const defaultAddr = { logradouro: '', numero: '', complemento: '', bairro: '', localidade: '', cep: '' };
    if (!addressStr) return defaultAddr;
    try {
      const addr = JSON.parse(addressStr);
      return {
        logradouro: addr.logradouro || '',
        numero: addr.number || '',
        complemento: addr.complement || '',
        bairro: addr.bairro || '',
        localidade: addr.cidade ? `${addr.cidade} - ${addr.estado || ''}` : '',
        cep: addr.cep || ''
      };
    } catch (e) {
      return { ...defaultAddr, logradouro: addressStr };
    }
  };

  const handleSaveCustomer = async (formData: any) => {
    if (id) {
      try {
        await updateCustomer({ id, data: formData });
        toast.success('Cadastro do cliente atualizado com sucesso!');
        refetch();
        setIsEditModalOpen(false);
      } catch (err) {}
    }
  };

  const handleConfirmToggleStatus = async () => {
    if (!data?.customer) return;
    try {
      await toggleStatus({ id: data.customer.id, isActive: !data.customer.isActive });
      setIsConfirmOpen(false);
      refetch();
    } catch (err) {}
  };

  // Skeleton Loader screen
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Back Link skeleton */}
        <div className="h-4 bg-gray-200 dark:bg-white/5 rounded w-32" />
        
        {/* Header card skeleton */}
        <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-20 h-20 bg-gray-200 dark:bg-white/5 rounded-full shrink-0" />
            <div className="space-y-2 text-center sm:text-left">
              <div className="h-6 bg-gray-200 dark:bg-white/5 rounded w-48 mx-auto sm:mx-0" />
              <div className="h-4 bg-gray-200 dark:bg-white/5 rounded w-36 mx-auto sm:mx-0" />
              <div className="h-4 bg-gray-200 dark:bg-white/5 rounded w-56 mx-auto sm:mx-0" />
            </div>
          </div>
          <div className="flex gap-2.5">
            <div className="h-10 bg-gray-200 dark:bg-white/5 rounded-xl w-24" />
            <div className="h-10 bg-gray-200 dark:bg-white/5 rounded-xl w-36" />
          </div>
        </div>

        {/* 4 StatCards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl" />
          ))}
        </div>

        {/* 2 columns layout skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 h-96 bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl" />
          <div className="space-y-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/customers')}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Clientes
        </button>
        <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-12 text-center text-red-500 font-medium">
          Ocorreu um erro ao carregar as informações do cliente ou o registro não foi localizado.
        </div>
      </div>
    );
  }

  const { customer, metrics, salesHistory } = data;

  // Address parsing
  const addr = getAddressInfo(customer.address);
  const addressLines = [
    addr.logradouro ? `${addr.logradouro}, ${addr.numero}` : '',
    addr.complemento ? addr.complemento : '',
    addr.bairro ? addr.bairro : '',
    addr.localidade ? addr.localidade : '',
    addr.cep ? `CEP: ${addr.cep}` : ''
  ].filter(Boolean);

  const fullAddressString = addressLines.join(', ');

  // Paginated sales list
  const totalCount = salesHistory.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const paginatedSales = salesHistory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Voltar button */}
      <button
        onClick={() => navigate('/customers')}
        className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para Clientes
      </button>

      {/* Header CRM */}
      <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-6 transition-colors duration-300">
        
        {/* Left header profile */}
        <div className="flex flex-col sm:flex-row items-center text-center sm:text-left gap-5">
          
          {/* Circular 80px Avatar */}
          <div className={`w-20 h-20 rounded-full flex items-center justify-center font-bold text-2xl border border-black/5 shrink-0 shadow-sm ${getAvatarBgClass(customer.fullName)}`}>
            {getInitials(customer.fullName)}
          </div>

          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-none">
                {customer.fullName}
              </h2>
              <StatusBadge status={customer.isActive ? 'active' : 'inactive'} />
            </div>

            <div className="text-xs font-mono text-gray-400 dark:text-gray-500">
              Documento: <span className="font-bold">{formatDocument(customer.document)}</span>
            </div>

            {/* Quick Contact line */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
              {customer.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-gray-400" /> {customer.email}
                </span>
              )}
              {customer.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-gray-400" /> {customer.phone}
                </span>
              )}
              {addr.localidade && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" /> {addr.localidade}
                </span>
              )}
            </div>

          </div>
        </div>

        {/* Right header actions */}
        <div className="flex gap-2.5 shrink-0 w-full sm:w-auto justify-center">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200"
          >
            <Pencil className="w-4 h-4" />
            Editar
          </button>
          <button
            onClick={() => setIsConfirmOpen(true)}
            className={`border rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 ${
              customer.isActive
                ? 'border-red-200 text-red-500 hover:bg-red-500/10 dark:border-red-500/20'
                : 'border-emerald-200 text-emerald-500 hover:bg-emerald-500/10 dark:border-emerald-500/20'
            }`}
          >
            {customer.isActive ? 'Desativar' : 'Ativar'}
          </button>
        </div>

      </div>

      {/* Grid containing 4 StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total de Compras"
          value={metrics.totalSalesCount}
          icon={<ShoppingBag className="w-5 h-5" />}
          accentColor="blue"
        />
        <StatCard
          title="Total Gasto"
          value={formatCurrency(metrics.totalSpent)}
          icon={<DollarSign className="w-5 h-5" />}
          accentColor="green"
        />
        <StatCard
          title="Ticket Médio"
          value={formatCurrency(metrics.averageTicket)}
          icon={<TrendingUp className="w-5 h-5" />}
          accentColor="green"
        />
        <StatCard
          title="Última Compra"
          value={formatDate(metrics.lastPurchaseDate)}
          icon={<Calendar className="w-5 h-5" />}
          accentColor="blue"
        />
      </div>

      {/* Two columns layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Left Column (60%): Purchase History */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-colors duration-300">
          <div>
            <div className="border-b border-gray-100 dark:border-white/5 pb-3 mb-4 flex items-center gap-2">
              <ShoppingBag className="w-4.5 h-4.5 text-[#10b981]" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Histórico de Compras
              </h3>
            </div>

            {salesHistory.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center justify-center gap-3 animate-fade-in">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-[#10b981]">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-950 dark:text-gray-200">Nenhuma compra registrada</h4>
                  <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">As compras deste cliente aparecerão aqui assim que as vendas forem registradas.</p>
                </div>
              </div>
            ) : (
              <div className="border border-gray-100 dark:border-white/5 rounded-xl overflow-hidden bg-gray-50 dark:bg-white/5">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-gray-200/60 dark:border-white/5 text-[10px] uppercase font-bold tracking-wider text-gray-400">
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">Produtos</th>
                        <th className="px-4 py-3">Valor Total</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedSales.map((sale) => (
                        <tr key={sale.id} className="border-b border-gray-200/20 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 transition-colors">
                          <td className="px-4 py-3">
                            {new Date(sale.createdAt).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white truncate max-w-[200px]">
                            {sale.products}
                          </td>
                          <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                            {formatCurrency(sale.totalAmount)}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={sale.status} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => navigate('/sales')}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                              title="Visualizar Venda"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center px-1 mt-4">
              <span className="text-[10px] text-gray-400 font-semibold">
                Mostrando {paginatedSales.length} de {totalCount} compras
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="flex items-center text-[10px] font-bold text-gray-700 dark:text-gray-300 px-2">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (40%): Contact cards panels */}
        <div className="space-y-5">
          
          {/* Card 1: Contact info */}
          <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm transition-colors duration-300 space-y-4">
            <div className="border-b border-gray-100 dark:border-white/5 pb-2.5 flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#10b981]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                Informações de Contato
              </h3>
            </div>

            <div className="space-y-3">
              {/* Mail */}
              <div className="flex items-start gap-3">
                <Mail className="w-4.5 h-4.5 text-gray-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wide">E-mail</span>
                  {customer.email ? (
                    <a
                      href={`mailto:${customer.email}`}
                      className="text-sm font-semibold text-gray-800 dark:text-gray-200 hover:text-[#10b981] dark:hover:text-[#10b981] transition-colors break-all"
                    >
                      {customer.email}
                    </a>
                  ) : (
                    <span className="text-sm text-gray-400 font-medium">Não cadastrado</span>
                  )}
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-start gap-3">
                <Phone className="w-4.5 h-4.5 text-gray-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wide">Telefone</span>
                  {customer.phone ? (
                    <a
                      href={`tel:${customer.phone.replace(/\D/g, '')}`}
                      className="text-sm font-semibold text-gray-800 dark:text-gray-200 hover:text-[#10b981] dark:hover:text-[#10b981] transition-colors"
                    >
                      {customer.phone}
                    </a>
                  ) : (
                    <span className="text-sm text-gray-400 font-medium">Não cadastrado</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Address maps card */}
          <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm transition-colors duration-300 space-y-4">
            <div className="border-b border-gray-100 dark:border-white/5 pb-2.5 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#10b981]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                Endereço
              </h3>
            </div>

            {addressLines.length > 0 ? (
              <div className="space-y-3.5">
                <div className="space-y-1 font-medium text-gray-800 dark:text-gray-200 text-sm leading-relaxed">
                  {addressLines.map((line, idx) => (
                    <p key={idx}>{line}</p>
                  ))}
                </div>
                <a
                  href={`https://maps.google.com?q=${encodeURIComponent(fullAddressString)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full justify-center inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 text-xs font-semibold text-gray-700 dark:text-gray-300 rounded-xl transition-all duration-200"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400" /> Ver no Google Maps
                </a>
              </div>
            ) : (
              <p className="text-sm text-gray-400 font-medium">Nenhum endereço informado</p>
            )}
          </div>

          {/* Card 3: Metadata audit details */}
          <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm transition-colors duration-300 space-y-4">
            <div className="border-b border-gray-100 dark:border-white/5 pb-2.5 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#10b981]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                Informações do Cadastro
              </h3>
            </div>

            <div className="space-y-3.5">
              {/* ID Cliente */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wide">ID do Cliente</span>
                <div 
                  onClick={() => handleCopyId(customer.id)}
                  className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200/50 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/20 transition-all duration-150 cursor-pointer text-xs font-mono font-bold text-gray-600 dark:text-gray-400 group"
                  title="Clique para copiar ID completo"
                >
                  <span className="truncate max-w-[170px] select-none">{customer.id}</span>
                  <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#10b981] transition-colors" />
                </div>
              </div>

              {/* Data Criação */}
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wide">Criado em</span>
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                  {formatFullDateTime(customer.createdAt)}
                </span>
              </div>

              {/* Forma pagamento preferido */}
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wide">Pagamento Preferido</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <CreditCard className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                    {metrics.preferredPaymentMethod}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Editing Dialog Modal */}
      <CustomerModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        customer={customer}
        onSave={handleSaveCustomer}
        isLoading={isUpdating}
      />

      {/* Toggle active status confirmation modal */}
      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmToggleStatus}
        title={customer.isActive ? 'Desativar Cliente' : 'Ativar Cliente'}
        message={
          customer.isActive
            ? `Tem certeza que deseja desativar o cliente "${customer.fullName}"? O cadastro dele será marcado como inativo.`
            : `Deseja ativar o cliente "${customer.fullName}" no sistema?`
        }
        confirmText={customer.isActive ? 'Desativar' : 'Ativar'}
        variant={customer.isActive ? 'danger' : 'success'}
        isLoading={isToggling}
      />

    </div>
  );
};
export default CustomerDetailPage;
