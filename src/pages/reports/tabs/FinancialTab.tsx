import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, CalendarClock } from 'lucide-react';
import { Column } from '../../../components/shared/DataTable';
import { FinancialReport, FinancialReportItem } from '../../../services/reportService';
import { formatDate } from '../reportFormatters';
import { ChartCard } from '../components/ChartCard';
import { DashboardSection } from '../components/DashboardSection';
import { DataFreshnessIndicator } from '../components/DataFreshnessIndicator';
import { ExportButton } from '../components/ExportButton';
import { MetricCard } from '../components/MetricCard';
import { ReportDataTable } from '../components/ReportDataTable';
import { ReportErrorState } from '../components/ReportErrorState';

interface FinancialTabProps {
  data?: FinancialReport;
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

const TYPE_LABELS: Record<FinancialReportItem['type'], string> = {
  receivable: 'A receber',
  payable: 'A pagar',
};

export const FinancialTab: React.FC<FinancialTabProps> = ({
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
  const navigate = useNavigate();
  if (isError) return <ReportErrorState onRetry={onRetry} denied={isAccessDenied} />;

  const columns: Column<FinancialReportItem>[] = [
    {
      key: 'type',
      label: 'Tipo',
      render: (row) => (
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.type === 'receivable' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300' : 'bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300'}`}>
          {TYPE_LABELS[row.type]}
        </span>
      ),
    },
    { key: 'description', label: 'Descrição' },
    { key: 'counterparty', label: 'Cliente/Fornecedor' },
    { key: 'dueDate', label: 'Vencimento', render: (row) => formatDate(row.dueDate) },
    { key: 'amount', label: 'Valor', render: (row) => formatCurrency(row.amount) },
  ];

  const hasCashFlow = Boolean(data?.cashFlow.some((point) => point.inflows !== 0 || point.outflows !== 0));
  const hasAging = Boolean(data?.aging.some((point) => point.receivables !== 0 || point.payables !== 0));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DataFreshnessIndicator updatedAt={updatedAt} onRefresh={onRetry} />
        <ExportButton onExport={onExport} disabled={!data} />
      </div>

      <DashboardSection
        title="Posição financeira"
        description="Títulos com vencimento no período. O acesso é validado para admin/gerente na rota e no banco."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="A receber em aberto"
            value={formatCurrency(data?.receivables.pending)}
            icon={<ArrowDownCircle className="h-5 w-5" />}
            description="Recebíveis pendentes ou atrasados com vencimento no período."
            href="/financial"
            actionLabel="Abrir contas a receber"
            accent="brand"
            isLoading={isLoading}
          />
          <MetricCard
            title="A pagar em aberto"
            value={formatCurrency(data?.payables.pending)}
            icon={<ArrowUpCircle className="h-5 w-5" />}
            description="Pagáveis pendentes ou atrasados com vencimento no período."
            href="/financial"
            actionLabel="Abrir contas a pagar"
            accent="blue"
            isLoading={isLoading}
          />
          <MetricCard
            title="Recebíveis vencidos"
            value={formatCurrency(data?.receivables.overdue)}
            icon={<AlertTriangle className="h-5 w-5" />}
            description="Contas a receber atrasadas ou pendentes após o vencimento."
            href="/financial"
            accent={(data?.receivables.overdue ?? 0) > 0 ? 'red' : 'slate'}
            isLoading={isLoading}
          />
          <MetricCard
            title="Pagáveis vencidos"
            value={formatCurrency(data?.payables.overdue)}
            icon={<CalendarClock className="h-5 w-5" />}
            description="Contas a pagar atrasadas ou pendentes após o vencimento."
            href="/financial"
            accent={(data?.payables.overdue ?? 0) > 0 ? 'amber' : 'slate'}
            isLoading={isLoading}
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Agenda e inadimplência" description="Movimentações por vencimento e concentração de títulos vencidos.">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartCard
            title="Agenda financeira por vencimento"
            subtitle={`${periodLabel} · saldo líquido acumulado começa em zero; não representa saldo bancário`}
            isLoading={isLoading}
            isEmpty={!hasCashFlow}
            testId="financial-cashflow-chart"
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data?.cashFlow} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={compactCurrency} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} width={72} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <ReferenceLine y={0} stroke="#64748b" />
                <Bar dataKey="inflows" name="Entradas por vencimento" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outflows" name="Saídas por vencimento" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="balance" name="Líquido acumulado (base zero)" stroke="#7c3aed" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Aging de títulos vencidos"
            subtitle="Valor vencido por quantidade de dias desde o vencimento."
            isLoading={isLoading}
            isEmpty={!hasAging}
            testId="financial-aging-chart"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.aging} layout="vertical" margin={{ left: 8, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" tickFormatter={compactCurrency} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="range" width={88} tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="receivables" name="A receber" fill="#f43f5e" radius={[0, 4, 4, 0]} />
                <Bar dataKey="payables" name="A pagar" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </DashboardSection>

      <DashboardSection title="Títulos para ação" description="Detalhes exatos para cobrança, pagamento e auditoria do número consolidado.">
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          <ReportDataTable
            title="Títulos vencidos"
            subtitle="Ordenados pelo vencimento mais antigo."
            data={data?.overdueItems || []}
            columns={columns}
            isLoading={isLoading}
            emptyTitle="Nenhum título vencido no período"
            emptySubtitle="Não há recebíveis ou pagáveis em atraso dentro do filtro."
            onRowClick={() => navigate('/financial')}
          />
          <ReportDataTable
            title="Próximos vencimentos"
            subtitle="Até 12 títulos abertos e ainda não vencidos."
            data={data?.upcomingItems || []}
            columns={columns}
            isLoading={isLoading}
            emptyTitle="Nenhum próximo vencimento"
            emptySubtitle="Não há títulos abertos futuros dentro do período."
            onRowClick={() => navigate('/financial')}
          />
        </div>
      </DashboardSection>
    </div>
  );
};
