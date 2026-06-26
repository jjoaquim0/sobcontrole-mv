import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSaleDetails, useSaleMutations } from '../../hooks/useSales';
import { StatCard } from '../../components/shared/StatCard';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { EditStatusModal } from './components/EditStatusModal';
import { ConfirmModal } from '../../components/shared/ConfirmModal';
import { supabase } from '../../lib/supabase';
import { 
  ArrowLeft, 
  ShoppingCart, 
  DollarSign, 
  TrendingUp, 
  Calendar,
  Pencil,
  Loader2,
  Copy,
  ExternalLink,
  CreditCard,
  UserCheck,
  XCircle,
  FileText,
  AlertTriangle,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

export const SaleDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Modals state
  const [isEditStatusOpen, setIsEditStatusOpen] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [receivable, setReceivable] = useState<any>(null);
  const [isReceivableLoading, setIsReceivableLoading] = useState(false);

  // Query details data
  const { data, isLoading, isError, refetch } = useSaleDetails(id || '');
  
  // Mutations
  const { updateSaleStatus, isUpdatingStatus, cancelSale, isCancelling } = useSaleMutations();

  // Load finance receivable linked to this sale
  useEffect(() => {
    const fetchReceivable = async () => {
      if (!id) return;
      setIsReceivableLoading(true);
      try {
        const { data: recs, error } = await supabase
          .from('account_receivables')
          .select('*')
          .eq('sale_id', id);
        
        if (error) throw error;
        if (recs && recs.length > 0) {
          const raw = recs[0];
          setReceivable({
            id: raw.id,
            companyId: raw.company_id,
            saleId: raw.sale_id,
            customerId: raw.customer_id,
            amount: Number(raw.amount || 0),
            dueDate: raw.due_date,
            status: raw.status,
            description: raw.description,
          });
        } else {
          setReceivable(null);
        }
      } catch (err) {
        console.error('Erro ao carregar faturamento a receber:', err);
        setReceivable(null);
      } finally {
        setIsReceivableLoading(false);
      }
    };

    fetchReceivable();
  }, [id, data?.sale?.paymentStatus]);

  // Format BRL currency
  const formatCurrency = (value?: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

  // Format dates
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
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

  // Click to copy Sale ID
  const handleCopyId = (saleId: string) => {
    navigator.clipboard.writeText(saleId);
    toast.success('ID da venda copiado para a área de transferência!');
  };

  // Get initials for customer avatar
  const getInitials = (name?: string) => {
    if (!name) return 'CF';
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  // Avatar consistent color helper
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

  // Mapped payment methods
  const renderPaymentMethod = (method: string) => {
    const maps: Record<string, { label: string, emoji: string, color: string }> = {
      cash: { label: 'Dinheiro', emoji: '💵', color: 'text-emerald-500' },
      money: { label: 'Dinheiro', emoji: '💵', color: 'text-emerald-500' },
      credit_card: { label: 'Cartão de Crédito', emoji: '💳', color: 'text-blue-500' },
      debit_card: { label: 'Cartão de Débito', emoji: '💳', color: 'text-indigo-500' },
      pix: { label: 'PIX', emoji: '⚡', color: 'text-cyan-500 font-bold' },
      bank_transfer: { label: 'Transferência Bancária', emoji: '🏦', color: 'text-amber-500' },
      other: { label: 'Outro', emoji: '📝', color: 'text-gray-500' }
    };
    const info = maps[method] || { label: 'Outro', emoji: '📝', color: 'text-gray-500' };
    return (
      <span className="flex items-center gap-1.5 font-bold text-gray-800 dark:text-gray-200">
        <span className={info.color}>{info.emoji}</span>
        <span>{info.label}</span>
      </span>
    );
  };

  const handleUpdateStatus = async (saleId: string, status: 'paid' | 'pending' | 'cancelled') => {
    try {
      await updateSaleStatus({ id: saleId, paymentStatus: status });
      refetch();
    } catch (err) {}
  };

  const handleConfirmCancel = async () => {
    if (!id) return;
    try {
      await cancelSale(id);
      setIsCancelConfirmOpen(false);
      refetch();
    } catch (err) {}
  };

  // Parse customer address details
  const getAddressLines = (addressStr?: string) => {
    if (!addressStr) return [];
    try {
      const addr = JSON.parse(addressStr);
      return [
        addr.logradouro ? `${addr.logradouro}, ${addr.number || ''}` : '',
        addr.complement ? addr.complement : '',
        addr.bairro ? addr.bairro : '',
        addr.cidade ? `${addr.cidade} - ${addr.estado || ''}` : '',
        addr.cep ? `CEP: ${addr.cep}` : ''
      ].filter(Boolean);
    } catch (e) {
      return [addressStr];
    }
  };

  // Loading Skeleton State
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-white/5 rounded w-32" />
        <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-16 h-16 bg-gray-200 dark:bg-white/5 rounded-full shrink-0" />
            <div className="space-y-2 text-center sm:text-left">
              <div className="h-6 bg-gray-200 dark:bg-white/5 rounded w-48" />
              <div className="h-4 bg-gray-200 dark:bg-white/5 rounded w-32" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-10 bg-gray-200 dark:bg-white/5 rounded-xl w-24" />
            <div className="h-10 bg-gray-200 dark:bg-white/5 rounded-xl w-36" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 h-96 bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl" />
          <div className="space-y-5">
            <div className="h-40 bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl" />
            <div className="h-40 bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (isError || !data || !data.sale) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/sales')}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Vendas
        </button>
        <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-12 text-center text-red-500 font-bold">
          Ocorreu um erro ao carregar as informações do pedido de venda ou o registro não foi localizado.
        </div>
      </div>
    );
  }

  const { sale, items } = data;
  const isCancelled = sale.paymentStatus === 'cancelled';
  const customerName = sale.customer?.fullName || 'Consumidor Final';
  const addressLines = getAddressLines(sale.customer?.address);

  // Status Badge parsing
  const mappedStatus = sale.paymentStatus === 'cancelled' ? 'canceled' : sale.paymentStatus;

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Back button */}
      <button
        onClick={() => navigate('/sales')}
        className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para Vendas
      </button>

      {/* CRM styled page header */}
      <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-6 transition-colors duration-300">
        
        {/* Left header details */}
        <div className="flex flex-col sm:flex-row items-center text-center sm:text-left gap-5">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-[#10b981] border border-[#10b981]/15 shrink-0">
            <ShoppingCart className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-none">
                Venda #{sale.id.toUpperCase()}
              </h2>
              <StatusBadge status={mappedStatus} />
            </div>

            <div className="text-xs text-gray-400 dark:text-gray-500 font-medium">
              Cliente: <span className="font-bold text-gray-600 dark:text-gray-400">{customerName}</span>
            </div>

            <div className="text-xs text-gray-400 dark:text-gray-500">
              Registrada em {formatFullDateTime(sale.createdAt)}
            </div>
          </div>
        </div>

        {/* Right header actions */}
        <div className="flex gap-2.5 shrink-0 w-full sm:w-auto justify-center">
          <button
            onClick={() => setIsEditStatusOpen(true)}
            disabled={isCancelled}
            className="border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-35 disabled:cursor-not-allowed"
          >
            <Pencil className="w-4 h-4" />
            Alterar Status
          </button>
          
          <button
            onClick={() => setIsCancelConfirmOpen(true)}
            disabled={isCancelled}
            className={`border rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-1.5 transition-all duration-200 ${
              isCancelled
                ? 'border-gray-100 dark:border-white/5 text-gray-400 bg-gray-50 dark:bg-white/5 cursor-not-allowed'
                : 'border-red-200 text-red-500 hover:bg-red-500/10 dark:border-red-500/20'
            }`}
          >
            <XCircle className="w-4 h-4" />
            Cancelar Pedido
          </button>
        </div>

      </div>

      {/* 4 Financial Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Bruto"
          value={formatCurrency(sale.total)}
          icon={<ShoppingCart className="w-5 h-5" />}
          accentColor="blue"
        />
        <StatCard
          title="Descontos"
          value={sale.discount > 0 ? `-${formatCurrency(sale.discount)}` : formatCurrency(0)}
          icon={<TrendingUp className="w-5 h-5 rotate-180 text-red-500" />}
          accentColor={sale.discount > 0 ? 'red' : 'gray'}
        />
        <StatCard
          title="Taxas / Frete"
          value={formatCurrency(sale.fee)}
          icon={<DollarSign className="w-5 h-5 text-amber-500" />}
          accentColor="yellow"
        />
        <StatCard
          title="Valor Final Líquido"
          value={formatCurrency(sale.finalValue)}
          icon={<CreditCard className="w-5 h-5 text-emerald-500" />}
          accentColor="green"
        />
      </div>

      {/* Main detail columns grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Left Column (66%): Items list */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm transition-colors duration-300">
          <div className="border-b border-gray-100 dark:border-white/5 pb-3 mb-4 flex items-center gap-2">
            <FileText className="w-4.5 h-4.5 text-[#10b981]" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
              Itens da Venda ({items.length})
            </h3>
          </div>

          <div className="border border-gray-100 dark:border-white/5 rounded-xl overflow-hidden bg-gray-50 dark:bg-white/5">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200/60 dark:border-white/5 text-[10px] uppercase font-bold tracking-wider text-gray-400">
                    <th className="px-4 py-3">Produto</th>
                    <th className="px-4 py-3">Cód. SKU</th>
                    <th className="px-4 py-3 text-center">Quantidade</th>
                    <th className="px-4 py-3 text-right">Preço Unitário</th>
                    <th className="px-4 py-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const prodName = item.product?.name || 'Produto Não Localizado';
                    const sku = item.product?.sku || 'SKU-INDISPONIVEL';
                    return (
                      <tr 
                        key={item.id} 
                        className="border-b border-gray-200/20 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 transition-colors"
                      >
                        <td className="px-4 py-3.5">
                          {item.productId ? (
                            <span 
                              onClick={() => navigate(`/inventory/${item.productId}`)}
                              className="font-bold text-gray-900 dark:text-white hover:text-[#10b981] hover:underline cursor-pointer transition-colors"
                            >
                              {prodName}
                            </span>
                          ) : (
                            <span className="font-semibold text-gray-500">{prodName}</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-gray-400">
                          {sku}
                        </td>
                        <td className="px-4 py-3.5 text-center font-bold text-gray-900 dark:text-white">
                          {item.quantity} {item.product?.unit || 'un'}
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-gray-600 dark:text-gray-400">
                          {formatCurrency(item.unitPrice)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-gray-900 dark:text-white">
                          {formatCurrency(item.subtotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing calculations details review */}
          <div className="flex flex-col items-end gap-2 mt-5 text-xs font-semibold px-4">
            <div className="flex justify-between w-64 border-b border-gray-100 dark:border-white/5 pb-2 text-gray-500">
              <span>Subtotal dos Itens:</span>
              <span className="text-gray-900 dark:text-white font-bold">{formatCurrency(sale.total)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between w-64 border-b border-gray-100 dark:border-white/5 pb-2 text-red-500">
                <span>Desconto Aplicado:</span>
                <span className="font-bold">-{formatCurrency(sale.discount)}</span>
              </div>
            )}
            {sale.fee > 0 && (
              <div className="flex justify-between w-64 border-b border-gray-100 dark:border-white/5 pb-2 text-amber-500">
                <span>Taxas / Logística:</span>
                <span className="font-bold">+{formatCurrency(sale.fee)}</span>
              </div>
            )}
            <div className="flex justify-between w-64 text-sm font-bold text-gray-900 dark:text-white pt-1">
              <span>Valor Líquido Recebido:</span>
              <span className="text-[#10b981] text-base">{formatCurrency(sale.finalValue)}</span>
            </div>
          </div>

        </div>

        {/* Right Column (33%): Customer Card, Metadata & Finance connection */}
        <div className="space-y-5">
          
          {/* Card 1: Customer Info details */}
          <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm transition-colors duration-300 space-y-4">
            <div className="border-b border-gray-100 dark:border-white/5 pb-2.5 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#10b981]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                Informações do Cliente
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm border border-black/5 shrink-0 ${getAvatarBgClass(customerName)}`}>
                {getInitials(customerName)}
              </div>
              <div className="min-w-0">
                {sale.customerId ? (
                  <h4 
                    onClick={() => navigate(`/customers/${sale.customerId}`)}
                    className="font-bold text-sm text-gray-900 dark:text-white hover:text-[#10b981] hover:underline cursor-pointer truncate"
                  >
                    {customerName}
                  </h4>
                ) : (
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                    {customerName}
                  </h4>
                )}
                {sale.customer?.document && (
                  <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 font-bold block mt-0.5">
                    Doc: {sale.customer.document}
                  </span>
                )}
              </div>
            </div>

            {sale.customer ? (
              <div className="space-y-2.5 pt-2 border-t border-gray-100 dark:border-white/5 text-xs text-gray-600 dark:text-gray-400 font-medium">
                {sale.customer.email && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">E-mail:</span>
                    <a href={`mailto:${sale.customer.email}`} className="text-gray-800 dark:text-gray-200 hover:text-[#10b981] font-semibold truncate block">
                      {sale.customer.email}
                    </a>
                  </div>
                )}
                {sale.customer.phone && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Tel:</span>
                    <a href={`tel:${sale.customer.phone.replace(/\D/g, '')}`} className="text-gray-800 dark:text-gray-200 hover:text-[#10b981] font-semibold">
                      {sale.customer.phone}
                    </a>
                  </div>
                )}
                {addressLines.length > 0 && (
                  <div className="space-y-0.5 pt-1.5 border-t border-gray-100 dark:border-white/5">
                    <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wide">Endereço de Entrega</span>
                    <div className="text-gray-800 dark:text-gray-200 leading-relaxed font-semibold">
                      {addressLines.map((line, idx) => (
                        <p key={idx}>{line}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400 font-medium">Venda registrada como Consumidor Final sem dados cadastrais vinculados.</p>
            )}

          </div>

          {/* Card 2: Transaction Audit details */}
          <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm transition-colors duration-300 space-y-4">
            <div className="border-b border-gray-100 dark:border-white/5 pb-2.5 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#10b981]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                Detalhes da Transação
              </h3>
            </div>

            <div className="space-y-3.5 text-xs font-medium">
              
              {/* Payment Method */}
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wide">Forma de Pagamento</span>
                <div className="mt-1 font-bold">
                  {renderPaymentMethod(sale.paymentMethod)}
                </div>
              </div>

              {/* Seller */}
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wide">Vendedor Responsável</span>
                <span className="text-gray-800 dark:text-gray-200 font-bold block mt-0.5">
                  👤 {sale.sellerName || 'Vendedor Comercial'}
                </span>
              </div>

              {/* Notes */}
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wide">Observações do Pedido</span>
                <p className="text-gray-700 dark:text-gray-300 mt-1 leading-relaxed bg-gray-50 dark:bg-white/5 p-2.5 rounded-xl border border-gray-100 dark:border-white/5 font-semibold text-xs whitespace-pre-line italic">
                  {sale.notes || 'Nenhuma observação informada para esta venda.'}
                </p>
              </div>

              {/* ID Auditoria */}
              <div className="pt-2 border-t border-gray-100 dark:border-white/5">
                <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wide">ID Interno do Sistema</span>
                <div 
                  onClick={() => handleCopyId(sale.id)}
                  className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200/50 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/20 transition-all duration-150 cursor-pointer text-xs font-mono font-bold text-gray-600 dark:text-gray-400 group mt-1"
                  title="Clique para copiar ID completo"
                >
                  <span className="truncate select-none font-bold">{sale.id}</span>
                  <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#10b981] transition-colors" />
                </div>
              </div>

            </div>
          </div>

          {/* Card 3: Finance Connection (Account Receivables) */}
          <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm transition-colors duration-300 space-y-4">
            <div className="border-b border-gray-100 dark:border-white/5 pb-2.5 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#10b981]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                Integração Financeira
              </h3>
            </div>

            {isReceivableLoading ? (
              <div className="flex items-center justify-center py-4 text-xs text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin text-[#10b981] mr-2" />
                <span>Carregando conexões...</span>
              </div>
            ) : receivable ? (
              <div className="space-y-3 text-xs font-medium">
                
                <div className="p-3.5 rounded-xl border border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-mono font-bold text-gray-500 text-[10px]">Lançamento: {receivable.id}</span>
                    <StatusBadge status={receivable.status} />
                  </div>
                  <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                    <div className="flex justify-between">
                      <span>Valor Financeiro:</span>
                      <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(receivable.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Vencimento:</span>
                      <span className="font-bold text-gray-900 dark:text-white">{formatDate(receivable.dueDate)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-[#10b981] rounded-xl flex gap-2 text-[10px] font-semibold leading-relaxed">
                  <Info className="w-4 h-4 shrink-0" />
                  <p>Este lançamento foi gerado automaticamente pelo PDV e está conectado em tempo real com as contas a receber.</p>
                </div>

                <button
                  onClick={() => navigate('/financial')}
                  className="w-full justify-center inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 text-xs font-semibold text-gray-700 dark:text-gray-300 rounded-xl transition-all duration-200"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400" /> Ir para Contas a Receber
                </button>

              </div>
            ) : (
              <div className="p-3.5 rounded-xl border border-dashed border-gray-200 dark:border-white/10 flex flex-col items-center justify-center text-center gap-1.5 py-6">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
                <span className="text-xs text-gray-500 font-semibold">Sem lançamentos a receber vinculados</span>
                <span className="text-[10px] text-gray-400 max-w-[180px]">Não encontramos lançamentos financeiros ativos para esta venda.</span>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Edit Status Dialog Modal */}
      <EditStatusModal
        isOpen={isEditStatusOpen}
        onClose={() => setIsEditStatusOpen(false)}
        sale={sale}
        onUpdateStatus={handleUpdateStatus}
        isLoading={isUpdatingStatus}
      />

      {/* Cancel Confirmation Modal */}
      <ConfirmModal
        isOpen={isCancelConfirmOpen}
        onClose={() => setIsCancelConfirmOpen(false)}
        onConfirm={handleConfirmCancel}
        title="Cancelar Pedido de Venda"
        message={`Tem certeza que deseja cancelar a venda #${sale.id.toUpperCase()}? Esta ação restaurará as quantidades de estoque dos itens (${items.map(i => `${i.product?.name || 'produto'} x${i.quantity}`).join(', ')}) e cancelará o lançamento a receber associado. Esta operação não pode ser revertida.`}
        confirmText="Sim, Cancelar Venda"
        variant="danger"
        isLoading={isCancelling}
      />

    </div>
  );
};

export default SaleDetailPage;
