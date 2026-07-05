import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { DollarSign, TrendingDown, TrendingUp, ShoppingCart, Users, Package, Clock, Activity } from 'lucide-react';
import { OverviewReport } from '../../../services/reportService';
import { ReportCard, ReportCardSkeleton } from '../components/ReportCard';
import { ReportChart, chartTooltipFormatter } from '../components/ReportChart';
import { ExportButton } from '../components/ExportButton';

interface OverviewTabProps {
  data?: OverviewReport;
  isLoading: boolean;
  isError: boolean;
  formatCurrency: (value?: number) => string;
  onExport: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ data, isLoading, isError, formatCurrency, onExport }) => {
  if (isError) {
    return (
      <div className="text-center py-10 text-sm text-red-500">
        Erro ao carregar a Visão Geral. Tente novamente.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Visão Geral</h2>
        <ExportButton onExport={onExport} disabled={!data} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <ReportCardSkeleton key={i} />)
        ) : (
          <>
            <ReportCard title="Receita" value={formatCurrency(data?.revenue.current)} trend={data?.revenue.variance} accentColor="green" icon={<DollarSign className="w-5 h-5" />} />
            <ReportCard title="Despesas" value={formatCurrency(data?.expenses.current)} trend={data?.expenses.variance} accentColor="yellow" icon={<TrendingDown className="w-5 h-5" />} />
            <ReportCard
              title="Lucro"
              value={<span className={(data?.profit.current || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}>{formatCurrency(data?.profit.current)}</span>}
              trend={data?.profit.variance}
              accentColor={(data?.profit.current || 0) >= 0 ? 'green' : 'red'}
              icon={<TrendingUp className="w-5 h-5" />}
            />
            <ReportCard title="Vendas" value={data?.salesCount.current ?? 0} trend={data?.salesCount.variance} accentColor="blue" icon={<ShoppingCart className="w-5 h-5" />} />
            <ReportCard title="Ticket Médio" value={formatCurrency(data?.averageTicket.current)} trend={data?.averageTicket.variance} accentColor="purple" icon={<Activity className="w-5 h-5" />} />
            <ReportCard title="Saúde Financeira" value={`${Math.round(data?.financialHealth ?? 0)}%`} accentColor="green" icon={<Clock className="w-5 h-5" />} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportChart title="Receita vs Despesas" isLoading={isLoading} isEmpty={!data?.revenueExpenseByPeriod?.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.revenueExpenseByPeriod}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-white/5" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => chartTooltipFormatter(v)} />
              <Legend />
              <Bar dataKey="revenue" name="Receita" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ReportChart>

        <ReportChart title="Evolução do Lucro" isLoading={isLoading} isEmpty={!data?.profitEvolution?.length}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.profitEvolution}>
              <defs>
                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-white/5" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => chartTooltipFormatter(v)} />
              <Area type="monotone" dataKey="profit" name="Lucro" stroke="#10b981" fill="url(#profitGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ReportChart>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <ReportCardSkeleton key={i} />)
        ) : (
          <>
            <ReportCard title="Clientes Ativos" value={data?.activeCustomers ?? 0} accentColor="blue" icon={<Users className="w-5 h-5" />} />
            <ReportCard title="Estoque Baixo" value={data?.lowStockProducts ?? 0} accentColor="yellow" icon={<Package className="w-5 h-5" />} />
            <ReportCard
              title="Contas Pendentes"
              value={formatCurrency((data?.pendingReceivables ?? 0) + (data?.pendingPayables ?? 0))}
              accentColor="purple"
              icon={<Clock className="w-5 h-5" />}
            />
          </>
        )}
      </div>
    </div>
  );
};
