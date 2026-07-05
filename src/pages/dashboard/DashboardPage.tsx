import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { useDashboard } from '../../hooks/useDashboard';
import { StatCard } from '../../components/shared/StatCard';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { SectionEyebrow, gradientTextStyle } from '../../components/shared/brand';
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
  ShoppingBag,
  Sparkles,
  Wallet,
  Target,
  ChevronRight,
  Loader,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const formatCurrency = (value?: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
};

const revenueGradientId = 'dashboardRevenueGradient';

export const DashboardPage: React.FC = () => {
  const { company, profile } = useAuth();
  const navigate = useNavigate();
  const {
    sales, inventory, customer, financial, activity,
    weeklySales, topProducts, financialHealth, purchases,
  } = useDashboard();

  const firstName = profile?.name?.split(' ')[0];
  const lowStockVal = inventory.data?.lowStockCount ?? 0;
  const weeklyTotal = weeklySales.data?.reduce((sum, d) => sum + d.value, 0) ?? 0;
  const activeDays = weeklySales.data?.filter((d) => d.value > 0).length ?? 0;

  const handleExportReport = () => {
    toast.success('Relatório gerado! O download iniciará em instantes.');
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-5 max-w-[1400px] mx-auto"
    >
      <svg width="0" height="0">
        <defs>
          <linearGradient id={revenueGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00d2ff" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#00d2ff" stopOpacity={0} />
          </linearGradient>
        </defs>
      </svg>

      {/* Hero */}
      <motion.div variants={itemVariants} className="panel-glass relative overflow-hidden rounded-3xl p-6 md:p-10">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(700px circle at 15% 0%, rgba(0,210,255,0.14), transparent 65%)',
          }}
        />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-white/50 mb-3">
              <Sparkles className="w-3.5 h-3.5" style={{ color: '#00d2ff' }} />
              <span>{greeting()}{firstName ? `, ${firstName}` : ''}! Bem-vindo ao seu painel</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
              <span className="block text-gray-900 dark:text-white">Sua gestão em</span>
              <span className="block animate-shiny" style={gradientTextStyle}>
                um só lugar
              </span>
            </h1>
            <p className="text-gray-600 dark:text-white/60 text-sm md:text-base mt-4 max-w-xl leading-[1.6]">
              Aqui está o resumo da saúde operacional e financeira {company?.name ? `da ${company.name}` : 'da sua empresa'}.
              Tudo que você precisa para tomar decisões com confiança.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => navigate('/sales')}
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0B2551] to-[#00d2ff] text-white text-sm font-semibold px-5 py-2.5 shadow-lg shadow-[#00a8d8]/20 hover:brightness-110 active:scale-[0.98] transition-all duration-200"
              >
                <Eye className="w-4 h-4" />
                Ver Vendas
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <button
                type="button"
                onClick={handleExportReport}
                className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/15 text-gray-700 dark:text-white text-sm font-medium px-5 py-2.5 hover:bg-black/[0.03] dark:hover:bg-white/5 transition-all duration-200"
              >
                <Download className="w-4 h-4" />
                Exportar Relatório
              </button>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6 shrink-0">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{sales.data?.totalSales ?? 0}</div>
              <div className="text-[11px] text-gray-500 dark:text-white/50 font-medium uppercase tracking-wider mt-0.5">Vendas no Mês</div>
            </div>
            <div className="w-px h-10 bg-black/10 dark:bg-white/15" />
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{customer.data?.activeCustomers ?? 0}</div>
              <div className="text-[11px] text-gray-500 dark:text-white/50 font-medium uppercase tracking-wider mt-0.5">Clientes Ativos</div>
            </div>
            <div className="w-px h-10 bg-black/10 dark:bg-white/15" />
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(sales.data?.averageTicket)}</div>
              <div className="text-[11px] text-gray-500 dark:text-white/50 font-medium uppercase tracking-wider mt-0.5">Ticket Médio</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Big revenue trend chart — primeira visualização de dados */}
      <motion.div variants={itemVariants} className="panel-glass rounded-3xl p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <SectionEyebrow label="Receita" tag="Últimos 7 dias" />
            {weeklySales.isLoading ? (
              <div className="h-10 w-40 mt-3 bg-gray-200 dark:bg-white/10 rounded animate-pulse" />
            ) : (
              <div className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-gray-900 dark:text-white">
                {formatCurrency(weeklyTotal)}
              </div>
            )}
            <p className="text-sm text-gray-500 dark:text-white/50 mt-1.5">
              {activeDays > 0
                ? `Receita bruta consolidada em ${activeDays} dia${activeDays > 1 ? 's' : ''} com vendas no período.`
                : 'Nenhuma venda registrada nos últimos 7 dias.'}
            </p>
          </div>
          <Link
            to="/reports"
            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/15 text-gray-700 dark:text-white text-xs font-medium px-4 py-2 hover:bg-black/[0.03] dark:hover:bg-white/5 transition-all duration-200 shrink-0"
          >
            Ver relatório completo
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {weeklySales.isLoading ? (
          <div className="h-[260px] md:h-[300px] flex items-center justify-center">
            <Loader className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : weeklySales.isError ? (
          <div className="h-[260px] md:h-[300px] flex items-center justify-center text-sm text-red-500">
            Erro ao carregar gráfico de receita.
          </div>
        ) : (
          <div className="h-[260px] md:h-[300px] -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklySales.data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 6" stroke="rgba(148,163,184,0.18)" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: 'none',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
                    background: 'rgba(10,11,14,0.92)',
                    color: '#fff',
                    fontSize: 13,
                  }}
                  labelStyle={{ color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}
                  formatter={(val: number) => [formatCurrency(val), 'Receita']}
                  cursor={{ stroke: '#00d2ff', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#00a8d8"
                  strokeWidth={2.5}
                  fill={`url(#${revenueGradientId})`}
                  activeDot={{ r: 5, fill: '#00d2ff', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.div>

      {/* KPI Cards Row */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {sales.isLoading || inventory.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[120px] panel-glass rounded-2xl animate-pulse" />
          ))
        ) : sales.isError || inventory.isError ? (
          <div className="md:col-span-2 lg:col-span-4 flex items-center justify-center h-[120px] panel-glass rounded-2xl text-sm text-red-500">
            Erro ao carregar os indicadores principais.
          </div>
        ) : (
          <>
            <StatCard
              title="Receita do Mês"
              value={formatCurrency(sales.data?.monthlyRevenue)}
              trend={sales.data?.revenueVariance}
              accentColor="green"
              icon={<DollarSign className="w-5 h-5" />}
            />
            <StatCard
              title="Total de Vendas"
              value={sales.data?.totalSales ?? 0}
              trend={sales.data?.salesVariance}
              accentColor="blue"
              icon={<ShoppingCart className="w-5 h-5" />}
            />
            <StatCard
              title="Ticket Médio"
              value={formatCurrency(sales.data?.averageTicket)}
              trend={sales.data?.ticketVariance}
              accentColor="purple"
              icon={<Target className="w-5 h-5" />}
            />
            <StatCard
              title="Estoque Baixo"
              value={
                lowStockVal > 0 ? (
                  <span className="text-amber-500">{lowStockVal}</span>
                ) : (
                  lowStockVal
                )
              }
              accentColor="yellow"
              icon={<AlertTriangle className="w-5 h-5" />}
            />
          </>
        )}
      </motion.div>

      {/* Atividade Recente + Top Produtos / Saúde Financeira */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Activity */}
        <motion.div variants={itemVariants} className="panel-glass rounded-2xl p-5 transition-all duration-300 hover:shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
              Atividade Recente
            </h3>
            <Link to="/financial" className="text-xs text-[#00a8d8] font-semibold hover:underline flex items-center gap-0.5">
              Ver Tudo
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {activity.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3 animate-pulse">
                  <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-white/[0.06] shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-2/3" />
                    <div className="h-2.5 bg-gray-200 dark:bg-white/10 rounded w-1/3" />
                  </div>
                </div>
              ))
            ) : activity.isError ? (
              <div className="text-center py-8 text-xs text-red-500">Erro ao carregar atividades.</div>
            ) : activity.data?.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400">Nenhuma movimentação recente.</div>
            ) : (
              activity.data?.map((act) => {
                const isReceivable = act.type === 'receivable' || act.type === 'sale';
                const Icon = isReceivable ? TrendingUp : TrendingDown;
                const colors = isReceivable
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400';

                return (
                  <div key={act.id} className="flex items-center gap-3 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] rounded-lg px-1 transition-colors -mx-1">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colors}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate leading-snug">
                        {act.description}
                      </p>
                      <span className="text-[11px] text-gray-400">{formatDate(act.date)}</span>
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
        </motion.div>

        {/* Top Products + Financial Health */}
        <motion.div variants={itemVariants} className="panel-glass rounded-2xl p-5 transition-all duration-300 hover:shadow-lg flex flex-col">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider mb-4">
            Top Produtos
          </h3>

          <div className="flex-1 space-y-3">
            {topProducts.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-5 h-5 bg-gray-200 dark:bg-white/10 rounded" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-2/3" />
                    <div className="h-2 bg-gray-200 dark:bg-white/10 rounded w-1/4" />
                  </div>
                </div>
              ))
            ) : topProducts.isError ? (
              <div className="text-xs text-red-500 text-center py-4">Erro ao carregar produtos</div>
            ) : topProducts.data?.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-4">Nenhum produto vendido no mês.</div>
            ) : (
              topProducts.data?.map((prod, i) => {
                const maxVal = Math.max(...(topProducts.data?.map(p => p.value) || [1]));
                const pct = (prod.value / maxVal) * 100;
                return (
                  <div key={prod.id} className="group">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-[#00a8d8] w-4 shrink-0">#{i + 1}</span>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[160px] leading-tight">
                            {prod.name}
                          </p>
                        </div>
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-white text-xs">
                        {formatCurrency(prod.value)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-black/5 dark:bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-green-600 rounded-full transition-all duration-500 group-hover:opacity-80"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 mt-0.5 block">{prod.quantity} unidades</span>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-black/5 dark:border-white/[0.06] my-4" />

          {/* Financial Health */}
          <div>
            {financialHealth.isLoading ? (
              <div className="flex items-center justify-center py-2">
                <Loader className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
            ) : financialHealth.isError ? (
              <div className="text-center py-2 text-xs text-red-500">Erro ao carregar saúde financeira.</div>
            ) : (
              <Link to="/financial" className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="relative w-14 h-14 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 48 48">
                      <circle cx="24" cy="24" r="18" className="stroke-black/10 dark:stroke-white/10" strokeWidth="4" fill="transparent" />
                      <circle
                        cx="24" cy="24" r="18"
                        className="stroke-emerald-500 transition-all duration-1000 ease-out"
                        strokeWidth="4" fill="transparent"
                        strokeDasharray={113.1}
                        strokeDashoffset={113.1 - (113.1 * (financialHealth.data || 0)) / 100}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute text-[10px] font-bold text-gray-900 dark:text-white">
                      {Math.round(financialHealth.data || 0)}%
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Saúde Financeira</p>
                    <p className="text-[11px] text-gray-400">Contas em dia</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#00a8d8] transition-colors" />
              </Link>
            )}
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants} className="panel-glass rounded-2xl p-5 transition-all duration-300 hover:shadow-lg">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider mb-4">
          Ações Rápidas
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Nova Venda', icon: Zap, className: 'from-[#0B2551] to-[#00d2ff]', path: '/sales' },
            { label: 'Novo Produto', icon: Package, className: 'from-blue-500 to-indigo-600', path: '/inventory' },
            { label: 'Novo Cliente', icon: Users, className: 'from-purple-500 to-violet-600', path: '/customers' },
            { label: 'Ver Relatórios', icon: BarChart3, className: 'from-amber-500 to-orange-600', path: '/reports' },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className={`group relative overflow-hidden rounded-xl p-4 bg-gradient-to-br ${action.className} text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98]`}
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10 flex flex-col items-center gap-2">
                <action.icon className="w-6 h-6" />
                <span className="text-xs font-semibold">{action.label}</span>
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Financial Summary */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {financial.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[100px] panel-glass rounded-2xl animate-pulse" />
          ))
        ) : financial.isError ? (
          <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-center h-[100px] panel-glass rounded-2xl text-sm text-red-500">
            Erro ao carregar o resumo financeiro.
          </div>
        ) : (
          <>
            <StatCard title="A Receber" value={formatCurrency(financial.data?.toReceive)} accentColor="blue" icon={<TrendingUp className="w-5 h-5" />} />
            <StatCard title="A Pagar" value={formatCurrency(financial.data?.toPay)} accentColor="yellow" icon={<TrendingDown className="w-5 h-5" />} />
            <StatCard title="Vencidos a Receber" value={formatCurrency(financial.data?.overdueReceive)} accentColor="red" icon={<AlertCircle className="w-5 h-5" />} />
            <StatCard title="Vencidos a Pagar" value={formatCurrency(financial.data?.overduePay)} accentColor="red" icon={<AlertCircle className="w-5 h-5" />} />
          </>
        )}
      </motion.div>

      {/* Purchases Summary */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-2">
        {purchases.isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-[100px] panel-glass rounded-2xl animate-pulse" />
          ))
        ) : purchases.isError ? (
          <div className="sm:col-span-2 flex items-center justify-center h-[100px] panel-glass rounded-2xl text-sm text-red-500">
            Erro ao carregar o resumo de compras.
          </div>
        ) : (
          <>
            <StatCard title="Compras do Mês" value={purchases.data?.totalPurchasesThisMonth ?? 0} accentColor="blue" icon={<ShoppingBag className="w-5 h-5" />} />
            <StatCard title="Gasto com Compras" value={formatCurrency(purchases.data?.totalSpentThisMonth)} accentColor="yellow" icon={<Wallet className="w-5 h-5" />} />
          </>
        )}
      </motion.div>
    </motion.div>
  );
};

export default DashboardPage;
