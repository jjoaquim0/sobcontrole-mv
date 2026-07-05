import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Users, UserCheck, UserPlus } from 'lucide-react';
import { CustomerReport } from '../../../services/reportService';
import { ReportCard, ReportCardSkeleton } from '../components/ReportCard';
import { ReportChart, chartTooltipFormatter } from '../components/ReportChart';
import { ExportButton } from '../components/ExportButton';
import { DataTable, Column } from '../../../components/shared/DataTable';

interface CustomersTabProps {
  data?: CustomerReport;
  isLoading: boolean;
  isError: boolean;
  formatCurrency: (value?: number) => string;
  formatDate: (dateStr?: string) => string;
  onExport: () => void;
}

export const CustomersTab: React.FC<CustomersTabProps> = ({ data, isLoading, isError, formatCurrency, formatDate, onExport }) => {
  if (isError) {
    return <div className="text-center py-10 text-sm text-red-500">Erro ao carregar o relatório de Clientes. Tente novamente.</div>;
  }

  const columns: Column<CustomerReport['topBuyers'][number]>[] = [
    { key: 'customerName', label: 'Cliente' },
    { key: 'totalSpent', label: 'Total Gasto', render: (row) => formatCurrency(row.totalSpent) },
    { key: 'saleCount', label: 'Compras' },
    { key: 'averageTicket', label: 'Ticket Médio', render: (row) => formatCurrency(row.averageTicket) },
    { key: 'lastPurchase', label: 'Última Compra', render: (row) => formatDate(row.lastPurchase) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Relatório de Clientes</h2>
        <ExportButton onExport={onExport} disabled={!data} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <ReportCardSkeleton key={i} />)
        ) : (
          <>
            <ReportCard title="Total de Clientes" value={data?.summary.total ?? 0} accentColor="blue" icon={<Users className="w-5 h-5" />} />
            <ReportCard title="Clientes Ativos" value={data?.summary.active ?? 0} accentColor="green" icon={<UserCheck className="w-5 h-5" />} />
            <ReportCard title="Novos no Período" value={data?.summary.newThisPeriod ?? 0} accentColor="purple" icon={<UserPlus className="w-5 h-5" />} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportChart title="Novos Clientes por Mês" isLoading={isLoading} isEmpty={!data?.byMonth?.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.byMonth}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-white/5" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="newCustomers" name="Novos Clientes" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ReportChart>

        <ReportChart title="Top 10 Clientes por Receita" isLoading={isLoading} isEmpty={!data?.topBuyers?.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.topBuyers} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-white/5" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="customerName" tick={{ fontSize: 10 }} width={120} />
              <Tooltip formatter={(v: number) => chartTooltipFormatter(v)} />
              <Bar dataKey="totalSpent" name="Total Gasto" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ReportChart>
      </div>

      <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm transition-colors duration-300 overflow-hidden">
        <DataTable
          data={data?.topBuyers || []}
          columns={columns}
          isLoading={isLoading}
          emptyIcon={<Users className="w-12 h-12 text-[#10b981] mb-3" />}
          emptyTitle="Nenhum cliente encontrado"
        />
      </div>
    </div>
  );
};
