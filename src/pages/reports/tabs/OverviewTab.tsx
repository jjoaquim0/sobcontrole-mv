import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BadgeDollarSign,
  Boxes,
  CircleAlert,
  CircleDollarSign,
  Gauge,
  ShoppingBag,
  Target,
  ReceiptText,
  Users,
} from 'lucide-react';
import { OverviewReport } from '../../../services/reportService';
import { ChartCard } from '../components/ChartCard';
import { DashboardSection } from '../components/DashboardSection';
import { DataFreshnessIndicator } from '../components/DataFreshnessIndicator';
import { ExportButton } from '../components/ExportButton';
import { InsightCard } from '../components/InsightCard';
import { MetricCard } from '../components/MetricCard';
import { ReportEmptyState } from '../components/ReportEmptyState';
import { ReportErrorState } from '../components/ReportErrorState';

interface OverviewTabProps {
  data?: OverviewReport;
  isLoading: boolean;
  isError: boolean;
  isAccessDenied?: boolean;
  formatCurrency: (value?: number) => string;
  onExport: () => void;
  onRetry: () => void;
  updatedAt?: number;
  periodLabel: string;
}

const compactCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(value);

export const OverviewTab: React.FC<OverviewTabProps> = ({
  data,
  isLoading,
  isError,
  isAccessDenied = false,
  formatCurrency,
  onExport,
  onRetry,
  updatedAt,
  periodLabel,
}) => {
  if (isError) return <ReportErrorState onRetry={onRetry} denied={isAccessDenied} />;

  const hasActivity = Boolean(
    data && (
      data.salesCount.current > 0 ||
      data.pipelineValue > 0 ||
      data.activeCustomers > 0 ||
      data.lowStockProducts > 0 ||
      data.pendingReceivables > 0
    ),
  );
  const hasFinancialSeries = Boolean(data?.revenueExpenseByPeriod.some((point) => point.revenue !== 0 || point.expenses !== 0));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DataFreshnessIndicator updatedAt={updatedAt} onRefresh={onRetry} />
        <ExportButton onExport={onExport} disabled={!data} />
      </div>

      {!isLoading && !hasActivity && (
        <ReportEmptyState description="Não há movimentação suficiente neste período. Cadastre vendas, clientes, oportunidades ou lançamentos para acompanhar o pulso do negócio." />
      )}

      <DashboardSection
        title="Pulso do negócio"
        description="Os indicadores mais importantes para entender resultado, demanda, caixa e riscos operacionais."
        icon={<Gauge className="h-4 w-4" />}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <MetricCard
            title="Receita paga"
            value={formatCurrency(data?.revenue.current)}
            icon={<CircleDollarSign className="h-5 w-5" />}
            description="Soma do valor final das vendas com status pago no período."
            trend={data?.revenue.variance}
            trendTone={(data?.revenue.variance ?? 0) >= 0 ? 'positive' : 'negative'}
            href="/relatorios/vendas-pipeline"
            isLoading={isLoading}
          />
          <MetricCard
            title="Vendas válidas"
            value={data?.salesCount.current ?? 0}
            icon={<ShoppingBag className="h-5 w-5" />}
            description="Quantidade de vendas pagas ou pendentes; canceladas são excluídas."
            trend={data?.salesCount.variance}
            href="/relatorios/vendas-pipeline"
            isLoading={isLoading}
          />
          <MetricCard
            title="Ticket médio pago"
            value={formatCurrency(data?.averageTicket.current)}
            icon={<BadgeDollarSign className="h-5 w-5" />}
            description="Receita paga dividida pela quantidade de vendas pagas."
            trend={data?.averageTicket.variance}
            href="/relatorios/vendas-pipeline"
            accent="purple"
            isLoading={isLoading}
          />
          <MetricCard
            title="Pipeline aberto"
            value={formatCurrency(data?.pipelineValue)}
            icon={<Target className="h-5 w-5" />}
            description="Valor atual das oportunidades abertas criadas no período selecionado."
            href="/pipeline"
            actionLabel="Abrir pipeline"
            accent="blue"
            isLoading={isLoading}
          />
          <MetricCard
            title="Clientes ativos"
            value={data?.activeCustomers ?? 0}
            icon={<Users className="h-5 w-5" />}
            description="Clientes atualmente marcados como ativos; indicador de posição atual."
            href="/relatorios/clientes"
            accent="blue"
            isLoading={isLoading}
          />
          <MetricCard
            title="Contas a receber"
            value={formatCurrency(data?.pendingReceivables)}
            icon={<ReceiptText className="h-5 w-5" />}
            description="Títulos pendentes ou atrasados com vencimento dentro do período."
            href="/financial"
            accent="brand"
            isLoading={isLoading}
          />
          <MetricCard
            title="Recebíveis vencidos"
            value={formatCurrency(data?.overdueReceivables)}
            icon={<CircleAlert className="h-5 w-5" />}
            description="Títulos a receber atrasados ou pendentes após o vencimento no período."
            href="/financial"
            accent={(data?.overdueReceivables ?? 0) > 0 ? 'red' : 'slate'}
            isLoading={isLoading}
          />
          <MetricCard
            title="Estoque baixo"
            value={data?.lowStockProducts ?? 0}
            icon={<Boxes className="h-5 w-5" />}
            description="Produtos ativos com quantidade atual no ou abaixo do mínimo cadastrado."
            href="/inventory/recommendations"
            actionLabel="Revisar reposição"
            accent={(data?.lowStockProducts ?? 0) > 0 ? 'amber' : 'slate'}
            isLoading={isLoading}
          />
          <MetricCard
            title="Resultado direto"
            value={formatCurrency(data?.profit.current)}
            icon={<Gauge className="h-5 w-5" />}
            description="Receita paga menos compras pagas no período. Não equivale ao lucro contábil da DRE."
            trend={data?.profit.variance}
            trendTone={(data?.profit.current ?? 0) >= 0 ? 'positive' : 'negative'}
            href="/relatorios/financeiro?view=dre"
            actionLabel="Ver DRE gerencial"
            accent={(data?.profit.current ?? 0) >= 0 ? 'brand' : 'red'}
            isLoading={isLoading}
          />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Evolução do período"
        description="Receitas e compras pagas são agrupadas no mesmo calendário para que os números reconciliem com os cards."
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartCard
            title="Receita e compras pagas"
            subtitle={`${periodLabel} · valores em Real`}
            isLoading={isLoading}
            isEmpty={!hasFinancialSeries}
            testId="overview-revenue-expenses-chart"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.revenueExpenseByPeriod} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={compactCurrency} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} width={72} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} labelStyle={{ color: '#111827' }} />
                <Legend />
                <Area type="monotone" dataKey="revenue" name="Receita paga" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={2.5} />
                <Area type="monotone" dataKey="expenses" name="Compras pagas" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.03} strokeDasharray="5 4" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Resultado direto por intervalo"
            subtitle="Receita paga menos compras pagas; escala com linha de zero."
            isLoading={isLoading}
            isEmpty={!hasFinancialSeries}
            testId="overview-profit-chart"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.profitEvolution} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={compactCurrency} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} width={72} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <ReferenceLine y={0} stroke="#64748b" />
                <Bar dataKey="profit" name="Resultado direto" radius={[5, 5, 0, 0]}>
                  {(data?.profitEvolution || []).map((point) => (
                    <Cell key={point.key} fill={point.profit >= 0 ? '#10b981' : '#f43f5e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </DashboardSection>

      <DashboardSection
        title="Gestly Insights"
        description="Sinais determinísticos gerados somente quando os dados do período sustentam a recomendação."
      >
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/5" />)}
          </div>
        ) : data?.insights.length ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {data.insights.map((insight) => (
              <InsightCard
                key={insight.id}
                priority={insight.priority}
                title={insight.title}
                description={insight.description}
                periodLabel={periodLabel}
                href={insight.href}
                actionLabel={insight.actionLabel}
              />
            ))}
          </div>
        ) : (
          <ReportEmptyState
            compact
            minHeight={180}
            icon={<Gauge className="h-8 w-8" />}
            title="Nenhum alerta relevante"
            description="Os dados atuais não acionaram nenhuma das regras disponíveis para queda de receita, vencidos, estoque baixo ou oportunidades paradas."
          />
        )}
      </DashboardSection>
    </div>
  );
};
