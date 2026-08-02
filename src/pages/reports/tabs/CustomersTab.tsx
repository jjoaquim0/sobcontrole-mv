import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BadgeDollarSign, CircleDollarSign, UserCheck, UserMinus, UserPlus, Users } from 'lucide-react';
import { Column } from '../../../components/shared/DataTable';
import { CustomerReport } from '../../../services/reportService';
import { ChartCard } from '../components/ChartCard';
import { DashboardSection } from '../components/DashboardSection';
import { DataFreshnessIndicator } from '../components/DataFreshnessIndicator';
import { ExportButton } from '../components/ExportButton';
import { MetricCard } from '../components/MetricCard';
import { ReportDataTable } from '../components/ReportDataTable';
import { ReportErrorState } from '../components/ReportErrorState';

interface CustomersTabProps {
  data?: CustomerReport;
  isLoading: boolean;
  isError: boolean;
  formatCurrency: (value?: number) => string;
  formatDate: (dateStr?: string) => string;
  onExport: () => void;
  onRetry: () => void;
  updatedAt?: number;
  periodLabel: string;
}

const compactCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(value);

export const CustomersTab: React.FC<CustomersTabProps> = ({
  data,
  isLoading,
  isError,
  formatCurrency,
  formatDate,
  onExport,
  onRetry,
  updatedAt,
  periodLabel,
}) => {
  const navigate = useNavigate();
  if (isError) return <ReportErrorState onRetry={onRetry} />;

  const rankingColumns: Column<CustomerReport['topBuyers'][number]>[] = [
    { key: 'customerName', label: 'Cliente' },
    { key: 'totalSpent', label: 'Receita paga', render: (row) => formatCurrency(row.totalSpent) },
    { key: 'saleCount', label: 'Compras' },
    { key: 'averageTicket', label: 'Ticket médio', render: (row) => formatCurrency(row.averageTicket) },
    { key: 'lastPurchase', label: 'Última compra', render: (row) => formatDate(row.lastPurchase) },
  ];

  const attentionColumns: Column<CustomerReport['attentionCustomers'][number]>[] = [
    { key: 'customerName', label: 'Cliente' },
    { key: 'createdAt', label: 'Cliente desde', render: (row) => formatDate(row.createdAt) },
    {
      key: 'reason',
      label: 'Sinal',
      render: (row) => <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">{row.reason}</span>,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DataFreshnessIndicator updatedAt={updatedAt} onRefresh={onRetry} />
        <ExportButton onExport={onExport} disabled={!data} />
      </div>

      <DashboardSection
        title="Saúde da base"
        description="Aquisição, atividade e valor gerado pela base de clientes no período selecionado."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            title="Clientes ativos"
            value={data?.summary.active ?? 0}
            icon={<UserCheck className="h-5 w-5" />}
            description="Clientes atualmente marcados como ativos; posição atual."
            href="/customers"
            actionLabel="Abrir clientes"
            accent="brand"
            isLoading={isLoading}
          />
          <MetricCard
            title="Novos clientes"
            value={data?.summary.newThisPeriod ?? 0}
            icon={<UserPlus className="h-5 w-5" />}
            description="Clientes cadastrados dentro do período."
            trend={data?.comparison.newCustomers.variance}
            accent="blue"
            isLoading={isLoading}
          />
          <MetricCard
            title="Sem compra no período"
            value={data?.summary.withoutPurchaseInPeriod ?? 0}
            icon={<UserMinus className="h-5 w-5" />}
            description="Clientes ativos sem nenhuma venda válida no período; não representa churn."
            href="/customers"
            actionLabel="Revisar clientes"
            accent={(data?.summary.withoutPurchaseInPeriod ?? 0) > 0 ? 'amber' : 'slate'}
            isLoading={isLoading}
          />
          <MetricCard
            title="Receita da base"
            value={formatCurrency(data?.summary.totalRevenue)}
            icon={<CircleDollarSign className="h-5 w-5" />}
            description="Receita paga associada a clientes no período."
            trend={data?.comparison.revenue.variance}
            accent="brand"
            isLoading={isLoading}
          />
          <MetricCard
            title="Ticket médio"
            value={formatCurrency(data?.summary.averageTicket)}
            icon={<BadgeDollarSign className="h-5 w-5" />}
            description="Receita paga dividida pela quantidade de vendas pagas."
            accent="purple"
            isLoading={isLoading}
          />
          <MetricCard
            title="Base cadastrada"
            value={data?.summary.total ?? 0}
            icon={<Users className="h-5 w-5" />}
            description="Total de clientes ativos e inativos da empresa."
            href="/customers"
            accent="slate"
            isLoading={isLoading}
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Evolução e concentração" description="Como a base cresceu e quais clientes mais contribuíram para a receita paga.">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartCard
            title="Novos clientes ao longo do período"
            subtitle={`${periodLabel} · cadastros agrupados por intervalo`}
            isLoading={isLoading}
            isEmpty={!data?.byMonth.some((point) => point.newCustomers > 0)}
            testId="customers-growth-chart"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.byMonth} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value: number) => [`${value} cliente(s)`, 'Novos clientes']} />
                <Line type="monotone" dataKey="newCustomers" name="Novos clientes" stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 3, fill: '#ffffff', strokeWidth: 2 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Clientes com maior receita"
            subtitle="Top clientes por vendas pagas; use a tabela para os valores exatos."
            isLoading={isLoading}
            isEmpty={!data?.topBuyers.length}
            testId="customers-ranking-chart"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.topBuyers.slice(0, 8)} layout="vertical" margin={{ left: 16, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" tickFormatter={compactCurrency} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="customerName" width={130} tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="totalSpent" name="Receita paga" fill="#10b981" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </DashboardSection>

      <DashboardSection title="Relacionamento e oportunidade" description="Listas operacionais para priorizar contato e aprofundar o comportamento da base.">
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          <ReportDataTable
            title="Clientes que precisam de atenção"
            subtitle="Ativos, mas sem venda válida no período. Este sinal não é churn."
            data={data?.attentionCustomers || []}
            columns={attentionColumns}
            isLoading={isLoading}
            emptyTitle="Todos os clientes ativos compraram no período"
            emptySubtitle="Nenhum cliente ativo entrou nesta regra de atenção."
            onRowClick={(row) => navigate(`/customers/${row.customerId}`)}
          />
          <ReportDataTable
            title="Ranking detalhado de clientes"
            subtitle="Receita paga, frequência observada e ticket médio no período."
            data={data?.topBuyers || []}
            columns={rankingColumns}
            isLoading={isLoading}
            emptyTitle="Nenhuma compra paga encontrada"
            emptySubtitle="O ranking será exibido quando houver vendas pagas."
            onRowClick={(row) => navigate(`/customers/${row.customerId}`)}
          />
        </div>
      </DashboardSection>
    </div>
  );
};
