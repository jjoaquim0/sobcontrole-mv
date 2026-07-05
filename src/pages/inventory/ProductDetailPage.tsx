import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Pencil, 
  Package, 
  DollarSign, 
  TrendingUp, 
  Warehouse, 
  AlertTriangle, 
  Clock, 
  Info,
  Loader2,
  Barcode,
  Grid,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { useProductDetails, useProductMutations } from '../../hooks/useInventory';
import { ProductModal } from './components/ProductModal';
import { StatCard } from '../../components/shared/StatCard';
import { toast } from 'sonner';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Hook details query
  const { data, isLoading, isError } = useProductDetails(id || '');

  // Mutation
  const { updateProduct, isUpdating } = useProductMutations();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-[#10b981] animate-spin" />
        <p className="text-sm text-gray-500">Carregando detalhes do produto...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 mb-2">
          <Package className="w-8 h-8" />
        </div>
        <h4 className="text-lg font-bold text-gray-900 dark:text-white">Produto não localizado</h4>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
          Ocorreu um erro ao buscar os dados deste item ou ele foi excluído do sistema.
        </p>
        <button
          onClick={() => navigate('/inventory')}
          className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-4 py-2 text-xs font-semibold mt-2 transition-all duration-200"
        >
          Voltar para o Estoque
        </button>
      </div>
    );
  }

  const { product, history } = data;

  const handleEditSave = async (updatedFields: any) => {
    try {
      await updateProduct({ id: product.id, data: updatedFields });
      toast.success('Produto atualizado com sucesso!');
      setIsEditModalOpen(false);
    } catch (e) {
      // handled
    }
  };

  // Format currency
  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  // Status computation
  const isOut = product.currentQuantity === 0;
  const isLow = product.currentQuantity > 0 && product.currentQuantity <= product.minQuantity;

  let statusLabel = 'Disponível';
  let statusBadgeColor = 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
  if (isOut) {
    statusLabel = 'Sem Estoque';
    statusBadgeColor = 'bg-rose-500/10 text-rose-500 border border-rose-500/20';
  } else if (isLow) {
    statusLabel = 'Estoque Baixo';
    statusBadgeColor = 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
  }

  // Stock KPI Values
  const profitMargin = product.costPrice > 0 ? ((product.salePrice - product.costPrice) / product.costPrice) * 100 : 0;
  const totalStockValue = product.currentQuantity * product.costPrice;

  // Custom visual gauge computations
  const maxCap = product.maxQuantity || 100;
  const currentPercent = Math.min(100, (product.currentQuantity / maxCap) * 100);
  const minPercent = Math.min(100, (product.minQuantity / maxCap) * 100);

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Return button */}
      <button
        onClick={() => navigate('/inventory')}
        className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para Estoque
      </button>

      {/* Header Profile */}
      <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors duration-300">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
            isOut
              ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
              : isLow
                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
          }`}>
            <Package className="w-7 h-7" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{product.name}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadgeColor}`}>
                {statusLabel}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              SKU: <span className="font-mono select-all font-bold">{product.sku}</span>
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsEditModalOpen(true)}
          className="border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl px-4 py-2 text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors duration-200"
        >
          <Pencil className="w-4 h-4" />
          Editar Cadastro
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Estoque Atual"
          value={`${product.currentQuantity} ${product.unit}`}
          icon={<Warehouse className="w-5 h-5" />}
          accentColor={isOut ? 'red' : isLow ? 'yellow' : 'green'}
        />
        <StatCard
          title="Preço de Venda"
          value={formatMoney(product.salePrice)}
          icon={<DollarSign className="w-5 h-5" />}
          accentColor="blue"
        />
        <StatCard
          title="Margem de Lucro"
          value={`${profitMargin.toFixed(1)}%`}
          icon={<TrendingUp className="w-5 h-5" />}
          accentColor={profitMargin > 20 ? 'green' : profitMargin >= 5 ? 'yellow' : 'red'}
        />
        <StatCard
          title="Valor em Estoque"
          value={formatMoney(totalStockValue)}
          icon={<DollarSign className="w-5 h-5" />}
          accentColor="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Left Column: Specifications & Stock Visual Level */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* Detailed information card */}
          <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm transition-colors duration-300 space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 dark:border-white/5 pb-3">
              <Info className="w-4.5 h-4.5 text-[#10b981]" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Detalhes do Produto</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <span className="text-xs text-gray-400 block font-medium">Nome</span>
                <span className="font-bold text-gray-800 dark:text-gray-200">{product.name}</span>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-gray-400 block font-medium">Categoria</span>
                <span className="font-bold text-gray-800 dark:text-gray-200">{product.category?.name || 'Geral'}</span>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-gray-400 block font-medium">Código de Barras</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                  <Barcode className="w-4 h-4 text-gray-400" /> {product.barcode || 'Não cadastrado'}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-gray-400 block font-medium">Unidade de Medida</span>
                <span className="font-bold text-gray-800 dark:text-gray-200">{product.unit}</span>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-gray-400 block font-medium">Preço de Custo</span>
                <span className="font-bold text-gray-800 dark:text-gray-200">{formatMoney(product.costPrice)}</span>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-gray-400 block font-medium">Preço de Venda</span>
                <span className="font-bold text-gray-800 dark:text-gray-200">{formatMoney(product.salePrice)}</span>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-gray-400 block font-medium">Situação de Cadastro</span>
                <span className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                  {product.isActive ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Ativo
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-red-500" /> Inativo
                    </>
                  )}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-gray-400 block font-medium">Data de Cadastro</span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {new Date(product.createdAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              {product.description && (
                <div className="sm:col-span-2 space-y-1 pt-2 border-t border-gray-100 dark:border-white/5">
                  <span className="text-xs text-gray-400 block font-medium">Descrição</span>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-white/5 p-3 rounded-xl border border-gray-200/50 dark:border-white/5">
                    {product.description}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Historical Movement of Sales */}
          <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm transition-colors duration-300 space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 dark:border-white/5 pb-3">
              <Clock className="w-4.5 h-4.5 text-[#10b981]" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Histórico de Saídas (Vendas)</h3>
            </div>

            {history.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="text-sm font-bold text-gray-800 dark:text-gray-200">Sem saídas recentes</h5>
                  <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">Nenhuma venda utilizando este produto foi registrada para a empresa logada.</p>
                </div>
              </div>
            ) : (
              <div className="border border-gray-100 dark:border-white/5 rounded-xl overflow-hidden bg-gray-50 dark:bg-white/5">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-gray-200/60 dark:border-white/5 text-[10px] uppercase font-bold tracking-wider text-gray-400">
                        <th className="px-4 py-3">Código Venda</th>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">Cliente</th>
                        <th className="px-4 py-3">Qtd Retirada</th>
                        <th className="px-4 py-3">Preço Un.</th>
                        <th className="px-4 py-3 text-right">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((mov) => (
                        <tr key={mov.id} className="border-b border-gray-200/20 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold select-all text-[#10b981] hover:underline cursor-pointer" onClick={() => navigate(`/sales`)}>
                            #{mov.saleId.slice(0, 8).toUpperCase()}
                          </td>
                          <td className="px-4 py-3">
                            {new Date(mov.date).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                          </td>
                          <td className="px-4 py-3 truncate max-w-[150px] font-medium">{mov.customerName}</td>
                          <td className="px-4 py-3 font-bold">{mov.quantity} {product.unit}</td>
                          <td className="px-4 py-3">{formatMoney(mov.unitPrice)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                            {formatMoney(mov.totalAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Visual stock gauge, limits warnings */}
        <div className="space-y-5">
          
          {/* Stock Level Gauge Panel */}
          <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm transition-colors duration-300 space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 dark:border-white/5 pb-3">
              <Warehouse className="w-4.5 h-4.5 text-[#10b981]" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Nível do Estoque</h3>
            </div>

            {/* Gauge progress bar visualization */}
            <div className="space-y-6 py-2">
              <div className="relative w-full h-4 bg-gray-100 dark:bg-white/5 rounded-full border border-gray-200/50 dark:border-white/5">
                
                {/* Minimum Threshold Marker Line */}
                <div 
                  className="absolute inset-y-0 w-0.5 bg-amber-500 border-l border-dashed border-white dark:border-[#1a1d27] z-10"
                  style={{ left: `${minPercent}%` }}
                  title={`Nível Mínimo: ${product.minQuantity}`}
                />

                {/* Current Quantity bar width */}
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    isOut
                      ? 'bg-rose-500'
                      : isLow
                        ? 'bg-amber-500'
                        : 'bg-emerald-500 shadow-md shadow-emerald-500/20'
                  }`}
                  style={{ width: `${currentPercent}%` }}
                />
              </div>

              {/* Threshold numeric indicators */}
              <div className="grid grid-cols-3 text-[11px] text-gray-400 font-semibold uppercase tracking-wider text-center">
                <div className="text-left">
                  <span>Mínimo</span>
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mt-1">{product.minQuantity} {product.unit}</p>
                </div>
                <div className="text-center">
                  <span>Atual</span>
                  <p className={`text-sm font-bold mt-1 ${isOut ? 'text-rose-500' : isLow ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {product.currentQuantity} {product.unit}
                  </p>
                </div>
                <div className="text-right">
                  <span>Cap. Máxima</span>
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mt-1">{product.maxQuantity} {product.unit}</p>
                </div>
              </div>
            </div>

            {/* Safety Alerts Box */}
            {isOut && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 rounded-xl flex gap-2 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium">
                  <strong>Atenção:</strong> Estoque zerado! A venda deste produto está impedida ou suspensa até reposição física.
                </p>
              </div>
            )}
            {isLow && !isOut && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-xl flex gap-2 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium">
                  <strong>Aviso:</strong> O estoque atual está abaixo do limite de segurança mínimo configurado.
                </p>
              </div>
            )}
            {!isOut && !isLow && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-xl flex gap-2 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium">
                  Estoque operando em níveis seguros de armazenamento.
                </p>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Editing product dialog hookup */}
      <ProductModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        product={product}
        onSave={handleEditSave}
        isLoading={isUpdating}
      />

    </div>
  );
};
export default ProductDetailPage;
