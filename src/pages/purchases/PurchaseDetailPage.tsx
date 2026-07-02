import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePurchaseDetails, usePurchaseMutations } from '../../hooks/usePurchases';
import { StatCard } from '../../components/shared/StatCard';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { EditPurchaseStatusModal } from './components/EditPurchaseStatusModal';
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
  Truck,
  XCircle,
  FileText,
  AlertTriangle,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

export const PurchaseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [isEditStatusOpen, setIsEditStatusOpen] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [payable, setPayable] = useState<any>(null);
  const [isPayableLoading, setIsPayableLoading] = useState(false);

  const { data, isLoading, isError, refetch } = usePurchaseDetails(id || '');

  const { updatePurchaseStatus, isUpdatingStatus, cancelPurchase, isCancelling } = usePurchaseMutations();

  useEffect(() => {
    const fetchPayable = async () => {
      if (!id) return;
      setIsPayableLoading(true);
      try {
        const { data: pays, error } = await supabase
          .from('account_payables')
          .select('*')
          .eq('purchase_id', id);

        if (error) throw error;
        if (pays && pays.length > 0) {
          const raw = pays[0];
          setPayable({
            id: raw.id,
            companyId: raw.company_id,
            purchaseId: raw.purchase_id,
            supplierId: raw.supplier_id,
            amount: Number(raw.amount || 0),
            dueDate: raw.due_date,
            status: raw.status,
            description: raw.description,
          });
        } else {
          setPayable(null);
        }
      } catch (err) {
        console.error('Erro ao carregar conta a pagar:', err);
        setPayable(null);
      } finally {
        setIsPayableLoading(false);
      }
    };

    fetchPayable();
  }, [id, data?.purchase?.status]);

  const formatCurrency = (value?: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

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

  const handleCopyId = (purchaseId: string) => {
    navigator.clipboard.writeText(purchaseId);
    toast.success('ID da compra copiado para a área de transferência!');
  };

  const getInitials = (name?: string) => {
    if (!name) return 'FR';
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

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

  const handleUpdateStatus = async (purchaseId: string, status: 'paid' | 'pending' | 'canceled') => {
    try {
      await updatePurchaseStatus({ id: purchaseId, status });
      refetch();
    } catch (err) {}
  };

  const handleConfirmCancel = async () => {
    if (!id) return;
    try {
      await cancelPurchase(id);
      setIsCancelConfirmOpen(false);
      refetch();
    } catch (err) {}
  };

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

  if (isError || !data || !data.purchase) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/purchases')}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Compras
        </button>
        <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-12 text-center text-red-500 font-bold">
          Ocorreu um erro ao carregar as informações do pedido de compra ou o registro não foi localizado.
        </div>
      </div>
    );
  }

  const { purchase, items } = data;
  const isCanceled = purchase.status === 'canceled';
  const supplierName = purchase.supplier?.name || 'Fornecedor Removido';

  return (
    <div className="space-y-6 animate-fade-in">

      <button
        onClick={() => navigate('/purchases')}
        className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para Compras
      </button>

      <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-6 transition-colors duration-300">

        <div className="flex flex-col sm:flex-row items-center text-center sm:text-left gap-5">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-[#10b981] border border-[#10b981]/15 shrink-0">
            <ShoppingCart className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-none">
                Compra #{purchase.id}
              </h2>
              <StatusBadge status={purchase.status} />
            </div>

            <div className="text-xs text-gray-400 dark:text-gray-500 font-medium">
              Fornecedor: <span className="font-bold text-gray-600 dark:text-gray-400">{supplierName}</span>
            </div>

            <div className="text-xs text-gray-400 dark:text-gray-500">
              Registrada em {formatFullDateTime(purchase.createdAt)}
            </div>
          </div>
        </div>

        <div className="flex gap-2.5 shrink-0 w-full sm:w-auto justify-center">
          <button
            onClick={() => setIsEditStatusOpen(true)}
            disabled={isCanceled}
            className="border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-35 disabled:cursor-not-allowed"
          >
            <Pencil className="w-4 h-4" />
            Alterar Status
          </button>

          <button
            onClick={() => setIsCancelConfirmOpen(true)}
            disabled={isCanceled}
            className={`border rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-1.5 transition-all duration-200 ${
              isCanceled
                ? 'border-gray-100 dark:border-white/5 text-gray-400 bg-gray-50 dark:bg-white/5 cursor-not-allowed'
                : 'border-red-200 text-red-500 hover:bg-red-500/10 dark:border-red-500/20'
            }`}
          >
            <XCircle className="w-4 h-4" />
            Cancelar Compra
          </button>
        </div>

      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Bruto"
          value={formatCurrency(purchase.totalAmount)}
          icon={<ShoppingCart className="w-5 h-5" />}
          accentColor="blue"
        />
        <StatCard
          title="Descontos"
          value={purchase.discount > 0 ? `-${formatCurrency(purchase.discount)}` : formatCurrency(0)}
          icon={<TrendingUp className="w-5 h-5 rotate-180 text-red-500" />}
          accentColor={purchase.discount > 0 ? 'red' : 'gray' as any}
        />
        <StatCard
          title="Fornecedor"
          value={supplierName}
          icon={<Truck className="w-5 h-5 text-amber-500" />}
          accentColor="yellow"
        />
        <StatCard
          title="Valor Final"
          value={formatCurrency(purchase.finalValue)}
          icon={<CreditCard className="w-5 h-5 text-emerald-500" />}
          accentColor="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        <div className="lg:col-span-2 bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm transition-colors duration-300">
          <div className="border-b border-gray-100 dark:border-white/5 pb-3 mb-4 flex items-center gap-2">
            <FileText className="w-4.5 h-4.5 text-[#10b981]" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
              Itens da Compra ({items.length})
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
                    <th className="px-4 py-3 text-right">Custo Unitário</th>
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
                          {formatCurrency(item.unitCost)}
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

          <div className="flex flex-col items-end gap-2 mt-5 text-xs font-semibold px-4">
            <div className="flex justify-between w-64 border-b border-gray-100 dark:border-white/5 pb-2 text-gray-500">
              <span>Subtotal dos Itens:</span>
              <span className="text-gray-900 dark:text-white font-bold">{formatCurrency(purchase.totalAmount)}</span>
            </div>
            {purchase.discount > 0 && (
              <div className="flex justify-between w-64 border-b border-gray-100 dark:border-white/5 pb-2 text-red-500">
                <span>Desconto Aplicado:</span>
                <span className="font-bold">-{formatCurrency(purchase.discount)}</span>
              </div>
            )}
            {purchase.fee > 0 && (
              <div className="flex justify-between w-64 border-b border-gray-100 dark:border-white/5 pb-2 text-amber-500">
                <span>Taxas / Logística:</span>
                <span className="font-bold">+{formatCurrency(purchase.fee)}</span>
              </div>
            )}
            <div className="flex justify-between w-64 text-sm font-bold text-gray-900 dark:text-white pt-1">
              <span>Valor Líquido a Pagar:</span>
              <span className="text-[#10b981] text-base">{formatCurrency(purchase.finalValue)}</span>
            </div>
          </div>

        </div>

        <div className="space-y-5">

          <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm transition-colors duration-300 space-y-4">
            <div className="border-b border-gray-100 dark:border-white/5 pb-2.5 flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#10b981]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                Informações do Fornecedor
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm border border-black/5 shrink-0 ${getAvatarBgClass(supplierName)}`}>
                {getInitials(supplierName)}
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                  {supplierName}
                </h4>
                {purchase.supplier?.document && (
                  <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 font-bold block mt-0.5">
                    Doc: {purchase.supplier.document}
                  </span>
                )}
              </div>
            </div>

            {purchase.supplier ? (
              <div className="space-y-2.5 pt-2 border-t border-gray-100 dark:border-white/5 text-xs text-gray-600 dark:text-gray-400 font-medium">
                {purchase.supplier.email && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">E-mail:</span>
                    <a href={`mailto:${purchase.supplier.email}`} className="text-gray-800 dark:text-gray-200 hover:text-[#10b981] font-semibold truncate block">
                      {purchase.supplier.email}
                    </a>
                  </div>
                )}
                {purchase.supplier.phone && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Tel:</span>
                    <a href={`tel:${purchase.supplier.phone.replace(/\D/g, '')}`} className="text-gray-800 dark:text-gray-200 hover:text-[#10b981] font-semibold">
                      {purchase.supplier.phone}
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400 font-medium">Fornecedor removido do cadastro, sem dados vinculados.</p>
            )}

          </div>

          <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm transition-colors duration-300 space-y-4">
            <div className="border-b border-gray-100 dark:border-white/5 pb-2.5 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#10b981]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                Detalhes da Transação
              </h3>
            </div>

            <div className="space-y-3.5 text-xs font-medium">

              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wide">Forma de Pagamento</span>
                <div className="mt-1 font-bold">
                  {renderPaymentMethod(purchase.paymentMethod)}
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wide">Responsável pelo Registro</span>
                <span className="text-gray-800 dark:text-gray-200 font-bold block mt-0.5">
                  👤 {purchase.createdByName || 'Usuário do Sistema'}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wide">Observações da Compra</span>
                <p className="text-gray-700 dark:text-gray-300 mt-1 leading-relaxed bg-gray-50 dark:bg-white/5 p-2.5 rounded-xl border border-gray-100 dark:border-white/5 font-semibold text-xs whitespace-pre-line italic">
                  {purchase.notes || 'Nenhuma observação informada para esta compra.'}
                </p>
              </div>

              <div className="pt-2 border-t border-gray-100 dark:border-white/5">
                <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wide">ID Interno do Sistema</span>
                <div
                  onClick={() => handleCopyId(purchase.id)}
                  className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200/50 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/20 transition-all duration-150 cursor-pointer text-xs font-mono font-bold text-gray-600 dark:text-gray-400 group mt-1"
                  title="Clique para copiar ID completo"
                >
                  <span className="truncate select-none font-bold">{purchase.id}</span>
                  <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#10b981] transition-colors" />
                </div>
              </div>

            </div>
          </div>

          <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm transition-colors duration-300 space-y-4">
            <div className="border-b border-gray-100 dark:border-white/5 pb-2.5 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#10b981]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                Integração Financeira
              </h3>
            </div>

            {isPayableLoading ? (
              <div className="flex items-center justify-center py-4 text-xs text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin text-[#10b981] mr-2" />
                <span>Carregando conexões...</span>
              </div>
            ) : payable ? (
              <div className="space-y-3 text-xs font-medium">

                <div className="p-3.5 rounded-xl border border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-mono font-bold text-gray-500 text-[10px]">Lançamento: {payable.id}</span>
                    <StatusBadge status={payable.status} />
                  </div>
                  <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                    <div className="flex justify-between">
                      <span>Valor Financeiro:</span>
                      <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(payable.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Vencimento:</span>
                      <span className="font-bold text-gray-900 dark:text-white">{formatDate(payable.dueDate)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-[#10b981] rounded-xl flex gap-2 text-[10px] font-semibold leading-relaxed">
                  <Info className="w-4 h-4 shrink-0" />
                  <p>Este lançamento foi gerado automaticamente pela compra e está conectado em tempo real com as contas a pagar.</p>
                </div>

                <button
                  onClick={() => navigate('/financial')}
                  className="w-full justify-center inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 text-xs font-semibold text-gray-700 dark:text-gray-300 rounded-xl transition-all duration-200"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400" /> Ir para Contas a Pagar
                </button>

              </div>
            ) : (
              <div className="p-3.5 rounded-xl border border-dashed border-gray-200 dark:border-white/10 flex flex-col items-center justify-center text-center gap-1.5 py-6">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
                <span className="text-xs text-gray-500 font-semibold">Sem lançamentos a pagar vinculados</span>
                <span className="text-[10px] text-gray-400 max-w-[180px]">Não encontramos lançamentos financeiros ativos para esta compra.</span>
              </div>
            )}
          </div>

        </div>

      </div>

      <EditPurchaseStatusModal
        isOpen={isEditStatusOpen}
        onClose={() => setIsEditStatusOpen(false)}
        purchase={purchase}
        onUpdateStatus={handleUpdateStatus}
        isLoading={isUpdatingStatus}
      />

      <ConfirmModal
        isOpen={isCancelConfirmOpen}
        onCancel={() => setIsCancelConfirmOpen(false)}
        onConfirm={handleConfirmCancel}
        title="Cancelar Pedido de Compra"
        message={`Tem certeza que deseja cancelar a compra #${purchase.id}? Esta ação estornará as quantidades de estoque dos itens (${items.map(i => `${i.product?.name || 'produto'} x${i.quantity}`).join(', ')}) e cancelará o lançamento a pagar associado. Esta operação não pode ser revertida.`}
        confirmText="Sim, Cancelar Compra"
        variant="danger"
        isLoading={isCancelling}
      />

    </div>
  );
};

export default PurchaseDetailPage;
