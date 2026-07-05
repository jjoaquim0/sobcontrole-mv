import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { ShoppingCart, DollarSign, TrendingUp, Percent } from 'lucide-react';
import { SalesReport } from '../../../services/reportService';
import { ReportCard, ReportCardSkeleton } from '../components/ReportCard';
import { ReportChart, chartTooltipFormatter, CHART_COLORS } from '../components/ReportChart';
import { ExportButton } from '../components/ExportButton';
import { DataTable, Column } from '../../../components/shared/DataTable';

interface SalesTabProps {
  data?: SalesReport;
  isLoading: boolean;
  isError: boolean;
  formatCurrency: (value?: number) => string;
  onExport: () => void;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Dinheiro',
  money: 'Dinheiro',
  credit_card: 'Cartão Crédito',
  debit_card: 'Cartão Débito',
  pix: 'PIX',
  bank_slip: 'Boleto',
  bank_transfer: 'Transferência',
  other: 'Outro',
};

export const SalesTab: React.FC<SalesTabProps> = ({ data, isLoading, isError, formatCurrency, onExport }) => {
  if (isError) {
    return <div className="text-center py-10 text-sm text-red-500">Erro ao carregar o relatório de Vendas. Tente novamente.</div>;
  }

  const columns: Column<SalesReport['byProduct'][number]>[] = [
    { key: 'productName', label: 'Produto' },
    { key: 'quantity', label: 'Quantidade' },
    { key: 'revenue', label: 'Receita', render: (row) => formatCurrency(row.revenue) },
    {
      key: 'percent',
      label: '% do Total',
      render: (row) => {
        const total = data?.summary.totalRevenue || 0;
        const pct = total > 0 ? (row.revenue / total) * 100 : 0;
        return `${pct.toFixed(1)}%`;
      },
    },
  ];

  const paymentMethodData = (data?.byPaymentMethod || []).map((m) => ({ ...m, label: PAYMENT_METHOD_LABELS[m.method] || m.method }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Relatório de Vendas</h2>
        <ExportButton onExport={onExport} disabled={!data} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <ReportCardSkeleton key={i} />)
        ) : (
          <>
            <ReportCard title="Total de Vendas" value={data?.summary.totalSales ?? 0} accentColor="blue" icon={<ShoppingCart className="w-5 h-5" />} />
            <ReportCard title="Receita Total" value={formatCurrency(data?.summary.totalRevenue)} accentColor="green" icon={<DollarSign className="w-5 h-5" />} />
            <ReportCard title="Ticket Médio" value={formatCurrency(data?.summary.averageTicket)} accentColor="purple" icon={<TrendingUp className="w-5 h-5" />} />
            <ReportCard title="Descontos" value={formatCurrency(data?.summary.totalDiscount)} accentColor="yellow" icon={<Percent className="w-5 h-5" />} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportChart title="Vendas por Dia" isLoading={isLoading} isEmpty={!data?.byDay?.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.byDay}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-white/5" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => chartTooltipFormatter(v)} />
              <Bar dataKey="revenue" name="Receita" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ReportChart>

        <ReportChart title="Por Método de Pagamento" isLoading={isLoading} isEmpty={!paymentMethodData.length}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={paymentMethodData} dataKey="total" nameKey="label" cx="50%" cy="50%" outerRadius={90} label>
                {paymentMethodData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => chartTooltipFormatter(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ReportChart>

        <ReportChart title="Top 10 Produtos Mais Vendidos" isLoading={isLoading} isEmpty={!data?.byProduct?.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.byProduct.slice(0, 10)} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-white/5" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="productName" tick={{ fontSize: 10 }} width={120} />
              <Tooltip formatter={(v: number) => chartTooltipFormatter(v)} />
              <Bar dataKey="revenue" name="Receita" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ReportChart>

        <ReportChart title="Top 5 Clientes por Receita" isLoading={isLoading} isEmpty={!data?.topCustomers?.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.topCustomers.slice(0, 5)}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-white/5" />
              <XAxis dataKey="customerName" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => chartTooltipFormatter(v)} />
              <Bar dataKey="totalSpent" name="Total Gasto" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ReportChart>
      </div>

      <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm transition-colors duration-300 overflow-hidden">
        <DataTable
          data={data?.byProduct || []}
          columns={columns}
          isLoading={isLoading}
          emptyIcon={<ShoppingCart className="w-12 h-12 text-[#10b981] mb-3" />}
          emptyTitle="Nenhum dado de vendas encontrado"
        />
      </div>
    </div>
  );
};
