import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useDashboard } from '../../hooks/useDashboard';
import { StatCard } from '../../components/shared/StatCard';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { PageHeader } from '../../components/shared/PageHeader';
import { 
  DollarSign, 
  ShoppingCart, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Zap, 
  Package, 
  Users, 
  BarChart3,
  Download,
  Eye,
  ArrowRight,
  ShoppingBag
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar } from 'recharts';
import { toast } from 'sonner';

export const DashboardPage: React.FC = () => {
  const { company } = useAuth();
  const navigate = useNavigate();
  const {
    sales,
    inventory,
    customer,
    financial,
    activity,
    weeklySales,
    topProducts,
    financialHealth,
    purchases,
  } = useDashboard();

  // Formatador de Moeda R$
  const formatCurrency = (value?: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

  // Formatador de data simplificado
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleExportReport = () => {
    toast.success('Relatório gerado! O download iniciará em instantes.');
  };

  const lowStockVal = inventory.data?.lowStockCount ?? 0;

  return (
    <div className="space-y-4 p-6 bg-[#f0f2f5] dark:bg-[#0f1117] min-h-screen transition-colors duration-300">
      
      {/* Cabeçalho Opcional para consistência geral */}
      <PageHeader 
        title="Painel Executivo" 
        subtitle="Indicadores integrados da saúde operacional da sua PME"
      />

      {/* Linha 1 — Hero + Métricas */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        
        {/* Card Hero */}
        <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 transition-colors duration-300">
          
          {/* Lado Esquerdo do Hero */}
          <div className="flex flex-col gap-3 w-full md:w-1/2">
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Resumo do Negócio
            </span>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
              {company?.name || 'Carregando Empresa...'}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
              Bem-vindo de volta! Seus indicadores operacionais e conciliação financeira do período estão atualizados.
            </p>
            <div className="flex items-center gap-3 mt-2">
              <button
                type="button"
                onClick={handleExportReport}
                className="border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 transition-colors duration-200 flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                Exportar Relatório
              </button>
              <button
                type="button"
                onClick={() => navigate('/reports')}
                className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-200 flex items-center gap-1.5"
              >
                <Eye className="w-4 h-4" />
                Ver Detalhes
              </button>
            </div>
          </div>

          {/* Lado Direito do Hero — Gráfico de Barras */}
          <div className="w-full md:w-1/2 h-[120px] relative flex flex-col justify-end">
            {weeklySales.isLoading ? (
              /* Skeleton do Gráfico */
              <div className="w-full h-full bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse flex items-end justify-between p-3 gap-2">
                <div className="bg-gray-200 dark:bg-white/10 w-full rounded-t-md h-[40%]"></div>
                <div className="bg-gray-200 dark:bg-white/10 w-full rounded-t-md h-[60%]"></div>
                <div className="bg-gray-200 dark:bg-white/10 w-full rounded-t-md h-[50%]"></div>
                <div className="bg-gray-200 dark:bg-white/10 w-full rounded-t-md h-[80%]"></div>
                <div className="bg-gray-200 dark:bg-white/10 w-full rounded-t-md h-[30%]"></div>
                <div className="bg-gray-200 dark:bg-white/10 w-full rounded-t-md h-[90%]"></div>
                <div className="bg-gray-200 dark:bg-white/10 w-full rounded-t-md h-[45%]"></div>
              </div>
            ) : weeklySales.isError ? (
              <div className="w-full h-full flex items-center justify-center border border-dashed border-gray-200 dark:border-white/10 rounded-xl text-xs text-red-500">
                Erro ao carregar gráfico semanal
              </div>
            ) : (
              <div className="w-full h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklySales.data} margin={{ top: 5, bottom: 5, left: 5, right: 5 }}>
                    <Bar
                      dataKey="value"
                      fill="#10b981"
                      radius={[6, 6, 0, 0]}
                      barSize={16}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Coluna Direita — 3 StatCards empilhados */}
        <div className="flex flex-col gap-3 w-full">
          {/* Receita do Mês */}
          {sales.isLoading ? (
            <div className="h-28 bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 animate-pulse" />
          ) : (
            <StatCard
              title="Receita do Mês"
              value={formatCurrency(sales.data?.monthlyRevenue)}
              trend={sales.data?.revenueVariance}
              accentColor="green"
              icon={<DollarSign className="w-5 h-5" />}
            />
          )}

          {/* Total de Vendas */}
          {sales.isLoading ? (
            <div className="h-28 bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 animate-pulse" />
          ) : (
            <StatCard
              title="Total de Vendas"
              value={sales.data?.totalSales ?? 0}
              trend={sales.data?.salesVariance}
              accentColor="blue"
              icon={<ShoppingCart className="w-5 h-5" />}
            />
          )}

          {/* Estoque Baixo */}
          {inventory.isLoading ? (
            <div className="h-28 bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 animate-pulse" />
          ) : (
            <StatCard
              title="Estoque Baixo"
              value={
                lowStockVal > 0 ? (
                  <span className="text-yellow-500 font-bold">{lowStockVal}</span>
                ) : (
                  lowStockVal
                )
              }
              accentColor="yellow"
              icon={<AlertTriangle className="w-5 h-5" />}
            />
          )}
        </div>

      </div>

      {/* Linha 2 — Três cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* Card: Atividade Recente */}
        <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-colors duration-300">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                Atividade Recente
              </h3>
              <Link to="/financial" className="text-xs text-[#10b981] font-semibold hover:underline flex items-center gap-0.5">
                Ver Tudo
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {activity.isLoading ? (
                /* Skeleton com 5 linhas */
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-3 animate-pulse">
                    <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-white/5 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-gray-200 dark:bg-white/10 rounded w-2/3" />
                      <div className="h-2.5 bg-gray-200 dark:bg-white/10 rounded w-1/3" />
                    </div>
                    <div className="w-16 h-5 bg-gray-200 dark:bg-white/10 rounded shrink-0" />
                  </div>
                ))
              ) : activity.isError ? (
                <div className="text-center py-8 text-xs text-red-500">
                  Erro ao carregar últimas atividades.
                </div>
              ) : activity.data?.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-400">
                  Nenhuma movimentação identificada.
                </div>
              ) : (
                activity.data?.map((act) => {
                  const isReceivable = act.type === 'receivable' || act.type === 'sale';
                  const iconBg = isReceivable
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400';
                  const Icon = isReceivable ? TrendingUp : TrendingDown;

                  return (
                    <div key={act.id} className="flex items-center gap-3 py-3 hover:bg-gray-50/50 dark:hover:bg-white/[0.01] rounded-lg px-1 transition-colors duration-150">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate leading-snug">
                          {act.description}
                        </p>
                        <span className="text-xs text-gray-400">
                          {formatDate(act.date)}
                        </span>
                      </div>
                      <div className="flex flex-col items-end shrink-0 gap-1">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(act.value)}
                        </span>
                        <StatusBadge status={act.status} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Card: Ações Rápidas */}
        <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm transition-colors duration-300">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4 uppercase tracking-wider">
            Ações Rápidas
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {/* Botão Nova Venda */}
            <button
              onClick={() => navigate('/sales')}
              className="bg-[#1a1d27] dark:bg-white/10 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2 cursor-pointer hover:bg-black/90 dark:hover:bg-white/15 transition-all duration-200 text-white shadow-sm"
            >
              <Zap className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              <span className="text-xs font-semibold">Nova Venda</span>
            </button>

            {/* Novo Produto */}
            <button
              onClick={() => navigate('/inventory')}
              className="bg-[#f0f2f5] dark:bg-white/5 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2 cursor-pointer hover:bg-gray-200 dark:hover:bg-white/10 transition-all duration-200 text-gray-700 dark:text-gray-200"
            >
              <div className="bg-white dark:bg-white/10 rounded-full p-2 text-brand shadow-sm">
                <Package className="w-4 h-4 text-[#10b981]" />
              </div>
              <span className="text-xs font-medium">Novo Produto</span>
            </button>

            {/* Novo Cliente */}
            <button
              onClick={() => navigate('/customers')}
              className="bg-[#f0f2f5] dark:bg-white/5 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2 cursor-pointer hover:bg-gray-200 dark:hover:bg-white/10 transition-all duration-200 text-gray-700 dark:text-gray-200"
            >
              <div className="bg-white dark:bg-white/10 rounded-full p-2 text-brand shadow-sm">
                <Users className="w-4 h-4 text-[#10b981]" />
              </div>
              <span className="text-xs font-medium">Novo Cliente</span>
            </button>

            {/* Ver Relatórios */}
            <button
              onClick={() => navigate('/reports')}
              className="bg-[#f0f2f5] dark:bg-white/5 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2 cursor-pointer hover:bg-gray-200 dark:hover:bg-white/10 transition-all duration-200 text-gray-700 dark:text-gray-200"
            >
              <div className="bg-white dark:bg-white/10 rounded-full p-2 text-brand shadow-sm">
                <BarChart3 className="w-4 h-4 text-[#10b981]" />
              </div>
              <span className="text-xs font-medium">Ver Relatórios</span>
            </button>
          </div>
        </div>

        {/* Card: Top Produtos + Saúde Financeira */}
        <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-colors duration-300">
          
          {/* Seção Superior: Top Produtos */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 uppercase tracking-wider">
              Top Produtos
            </h3>
            
            <div className="space-y-3">
              {topProducts.isLoading ? (
                /* Skeleton do Top Produtos */
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex justify-between items-center py-1 animate-pulse">
                    <div className="flex items-center gap-2 flex-1">
                      <div className="w-4 h-4 bg-gray-200 dark:bg-white/10 rounded" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-2/3" />
                        <div className="h-2 bg-gray-200 dark:bg-white/10 rounded w-1/3" />
                      </div>
                    </div>
                    <div className="w-12 h-4 bg-gray-200 dark:bg-white/10 rounded" />
                  </div>
                ))
              ) : topProducts.isError ? (
                <div className="text-xs text-red-500 text-center py-2">
                  Erro ao carregar top produtos
                </div>
              ) : topProducts.data?.length === 0 ? (
                <div className="text-xs text-gray-400 text-center py-2">
                  Nenhum produto vendido no mês.
                </div>
              ) : (
                topProducts.data?.map((prod, i) => (
                  <div key={prod.id} className="flex items-center justify-between py-1.5 text-sm">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs font-bold text-[#10b981] w-4 shrink-0">
                        #{i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[140px] leading-tight">
                          {prod.name}
                        </p>
                        <span className="text-xs text-gray-400 block mt-0.5">
                          {prod.quantity} unidades vendidas
                        </span>
                      </div>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white shrink-0">
                      {formatCurrency(prod.value)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Divisor */}
          <div className="border-t border-gray-100 dark:border-white/5 my-4" />

          {/* Seção Inferior: Saúde Financeira */}
          <div>
            {financialHealth.isLoading ? (
              <div className="h-24 w-full flex items-center justify-center animate-pulse">
                <div className="w-16 h-16 rounded-full border-4 border-gray-200 dark:border-white/10 border-t-transparent animate-spin" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 96 96">
                    {/* Circle Bg */}
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      className="stroke-gray-100 dark:stroke-white/10"
                      strokeWidth="8"
                      fill="transparent"
                    />
                    {/* Circle Progress */}
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      className="stroke-[#10b981] transition-all duration-500 ease-in-out"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={251.3}
                      strokeDashoffset={251.3 - (251.3 * (financialHealth.data || 0)) / 100}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute text-center">
                    <span className="text-base font-bold text-gray-900 dark:text-white">
                      {Math.round(financialHealth.data || 0)}%
                    </span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-gray-400">
                  Contas em dia
                </span>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Linha 3 — Resumo Financeiro */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* A Receber */}
        {financial.isLoading ? (
          <div className="h-24 bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 animate-pulse" />
        ) : (
          <StatCard
            title="A Receber"
            value={formatCurrency(financial.data?.toReceive)}
            accentColor="blue"
            icon={<TrendingUp className="w-5 h-5" />}
          />
        )}

        {/* A Pagar */}
        {financial.isLoading ? (
          <div className="h-24 bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 animate-pulse" />
        ) : (
          <StatCard
            title="A Pagar"
            value={formatCurrency(financial.data?.toPay)}
            accentColor="yellow"
            icon={<TrendingDown className="w-5 h-5" />}
          />
        )}

        {/* Vencidos a Receber */}
        {financial.isLoading ? (
          <div className="h-24 bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 animate-pulse" />
        ) : (
          <StatCard
            title="Vencidos a Receber"
            value={formatCurrency(financial.data?.overdueReceive)}
            accentColor="red"
            icon={<AlertCircle className="w-5 h-5" />}
          />
        )}

        {/* Vencidos a Pagar */}
        {financial.isLoading ? (
          <div className="h-24 bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 animate-pulse" />
        ) : (
          <StatCard
            title="Vencidos a Pagar"
            value={formatCurrency(financial.data?.overduePay)}
            accentColor="red"
            icon={<AlertCircle className="w-5 h-5" />}
          />
        )}
      </div>

      {/* Linha 4 — Resumo de Compras */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {purchases.isLoading ? (
          <div className="h-24 bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 animate-pulse" />
        ) : (
          <StatCard
            title="Compras do Mês"
            value={purchases.data?.totalPurchasesThisMonth ?? 0}
            accentColor="blue"
            icon={<ShoppingBag className="w-5 h-5" />}
          />
        )}

        {purchases.isLoading ? (
          <div className="h-24 bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 animate-pulse" />
        ) : (
          <StatCard
            title="Gasto com Compras no Mês"
            value={formatCurrency(purchases.data?.totalSpentThisMonth)}
            accentColor="yellow"
            icon={<DollarSign className="w-5 h-5" />}
          />
        )}
      </div>

    </div>
  );
};
export default DashboardPage;
