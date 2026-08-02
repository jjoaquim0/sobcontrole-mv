import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BadgeDollarSign, CircleDollarSign, Clock3, Percent, ShoppingBag, Target } from 'lucide-react';
import { Column } from '../../../components/shared/DataTable';
import { SalesReport } from '../../../services/reportService';
import { formatDate } from '../reportFormatters';
import { ChartCard } from '../components/ChartCard';
import { DashboardSection } from '../components/DashboardSection';
import { DataFreshnessIndicator } from '../components/DataFreshnessIndicator';
import { ExportButton } from '../components/ExportButton';
import { MetricCard } from '../components/MetricCard';
import { ReportDataTable } from '../components/ReportDataTable';
import { ReportErrorState } from '../components/ReportErrorState';

interface SalesTabProps {
  data?: SalesReport;
  isLoading: boolean;
  isError: boolean;
  formatCurrency: (value?: number) => string;
  onExport: () => void;
  onRetry: () => void;
  updatedAt?: number;
  periodLabel: string;
}

const compactCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(value);

const SALE_STATUS_LABELS: Record<string, string> = {
  paid: 'Pago',
  pending: 'Pendente',
};

export const SalesTab: React.FC<SalesTabProps> = ({
  data,
  isLoading,
  isError,
  formatCurrency,
  onExport,
  onRetry,
  updatedAt,
  periodLabel,
}) => {
  const navigate = useNavigate();
  if (isError) return <ReportErrorState onRetry={onRetry} />;

  const pipelineData = (data?.pipelineStages || []).filter((stage) => stage.count > 0);
  const hasSalesSeries = Boolean(data?.byDay.some((point) => point.count > 0 || point.revenue > 0));

  const stalledColumns: Column<SalesReport['stalledOpportunities'][number]>[] = [
    { key: 'title', label: 'Oportunidade' },
    { key: 'customerName', label: 'Cliente' },
    { key: 'ownerName', label: 'Responsável' },
    { key: 'stageName', label: 'Etapa' },
    { key: 'value', label: 'Valor', render: (row) => formatCurrency(row.value) },
    {
      key: 'daysWithoutUpdate',
      label: 'Sem atualização',
      render: (row) => <span className="font-semibold text-amber-600 dark:text-amber-300">{row.daysWithoutUpdate} dias</span>,
    },
  ];

  const recentColumns: Column<SalesReport['recentSales'][number]>[] = [
    { key: 'customerName', label: 'Cliente' },
    { key: 'sellerName', label: 'Vendedor' },
    { key: 'createdAt', label: 'Data', render: (row) => formatDate(row.createdAt) },
    { key: 'value', label: 'Valor', render: (row) => formatCurrency(row.value) },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.status === 'paid' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300'}`}>
          {SALE_STATUS_LABELS[row.status] || row.status}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DataFreshnessIndicator updatedAt={updatedAt} onRefresh={onRetry} />
        <ExportButton onExport={onExport} disabled={!data} />
      </div>

      <DashboardSection
        title="Desempenho comercial"
        description="Receita considera somente vendas pagas; volume exclui vendas canceladas."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            title="Receita paga"
            value={formatCurrency(data?.summary.totalRevenue)}
            icon={<CircleDollarSign className="h-5 w-5" />}
            description="Soma do valor final de vendas pagas no período."
            trend={data?.comparison.totalRevenue.variance}
            href="/sales"
            actionLabel="Ver vendas"
            isLoading={isLoading}
          />
          <MetricCard
            title="Vendas válidas"
            value={data?.summary.totalSales ?? 0}
            icon={<ShoppingBag className="h-5 w-5" />}
            description="Vendas pagas e pendentes; canceladas não entram."
            trend={data?.comparison.totalSales.variance}
            href="/sales"
            accent="blue"
            isLoading={isLoading}
          />
          <MetricCard
            title="Ticket médio pago"
            value={formatCurrency(data?.summary.averageTicket)}
            icon={<BadgeDollarSign className="h-5 w-5" />}
            description="Receita paga dividida pela quantidade de vendas pagas."
            trend={data?.comparison.averageTicket.variance}
            accent="purple"
            isLoading={isLoading}
          />
          <MetricCard
            title="Pipeline aberto"
            value={formatCurrency(data?.summary.pipelineValue)}
            icon={<Target className="h-5 w-5" />}
            description="Valor das oportunidades abertas criadas no período."
            href="/pipeline"
            actionLabel="Abrir pipeline"
            accent="blue"
            isLoading={isLoading}
          />
          <MetricCard
            title="Conversão fechada"
            value={data?.summary.closedConversion == null ? '—' : `${data.summary.closedConversion.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
            icon={<Percent className="h-5 w-5" />}
            description="Negócios ganhos divididos por negócios ganhos + perdidos no período."
            insufficientLabel={data?.summary.closedConversion == null ? 'Sem negócios fechados no período' : undefined}
            accent="brand"
            isLoading={isLoading}
          />
          <MetricCard
            title="Oportunidades paradas"
            value={data?.summary.stalledDeals ?? 0}
            icon={<Clock3 className="h-5 w-5" />}
            description="Oportunidades abertas sem atualização há 14 dias ou mais."
            href="/pipeline"
            actionLabel="Revisar oportunidades"
            accent={(data?.summary.stalledDeals ?? 0) > 0 ? 'amber' : 'slate'}
            isLoading={isLoading}
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Tendência e execução" description="Quando a receita mudou e quais vendedores sustentaram o resultado.">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartCard
            title="Evolução da receita paga"
            subtitle={`${periodLabel} · vendas canceladas e pendentes não compõem a receita`}
            isLoading={isLoading}
            isEmpty={!hasSalesSeries}
            testId="sales-revenue-chart"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.byDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={compactCurrency} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} width={72} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Area type="monotone" dataKey="revenue" name="Receita paga" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Receita por vendedor"
            subtitle="Ranking de vendas pagas; responsáveis sem receita no período não aparecem."
            isLoading={isLoading}
            isEmpty={!data?.bySeller.length}
            testId="sales-seller-chart"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.bySeller.slice(0, 8)} layout="vertical" margin={{ left: 16, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" tickFormatter={compactCurrency} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="sellerName" width={120} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="revenue" name="Receita paga" fill="#0ea5e9" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </DashboardSection>

      <DashboardSection title="Pipeline" description="Distribuição atual das oportunidades abertas criadas no período, respeitando a ordem configurada das etapas.">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartCard
            title="Oportunidades por etapa"
            subtitle="Quantidade de oportunidades abertas; não representa conversão histórica entre etapas."
            isLoading={isLoading}
            isEmpty={!pipelineData.length}
            testId="sales-pipeline-funnel"
          >
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip formatter={(value: number) => [`${value} oportunidade(s)`, 'Quantidade']} />
                <Funnel data={pipelineData} dataKey="count" nameKey="stageName" stroke="#ffffff">
                  {pipelineData.map((stage, index) => (
                    <Cell key={stage.stageId} fill={stage.color || ['#0B2551', '#0ea5e9', '#10b981', '#8b5cf6'][index % 4]} />
                  ))}
                  <LabelList dataKey="stageName" position="right" fill="#475569" stroke="none" fontSize={11} />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Principais motivos de perda"
            subtitle="Motivos registrados nos negócios perdidos e fechados no período."
            isLoading={isLoading}
            isEmpty={!data?.lostReasons.length}
            emptyMessage="Nenhum negócio perdido com motivo registrado neste período."
            testId="sales-lost-reasons-chart"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.lostReasons.slice(0, 8)} layout="vertical" margin={{ left: 20, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="reason" width={140} tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value: number) => [`${value} oportunidade(s)`, 'Perdas']} />
                <Bar dataKey="count" name="Perdas" fill="#f59e0b" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </DashboardSection>

      <DashboardSection title="Ações comerciais" description="Registros que ajudam a sair do resumo e chegar ao trabalho operacional.">
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          <ReportDataTable
            title="Oportunidades que precisam de atenção"
            subtitle="Abertas há 14 dias ou mais sem atualização."
            data={data?.stalledOpportunities || []}
            columns={stalledColumns}
            isLoading={isLoading}
            emptyTitle="Nenhuma oportunidade parada"
            emptySubtitle="As oportunidades abertas do período foram atualizadas recentemente."
            onRowClick={() => navigate('/pipeline')}
          />
          <ReportDataTable
            title="Vendas recentes"
            subtitle="Últimas vendas válidas registradas no período."
            data={data?.recentSales || []}
            columns={recentColumns}
            isLoading={isLoading}
            emptyTitle="Nenhuma venda válida"
            emptySubtitle="Vendas canceladas não são exibidas."
            onRowClick={(row) => navigate(`/sales/${row.id}`)}
          />
        </div>
      </DashboardSection>
    </div>
  );
};
