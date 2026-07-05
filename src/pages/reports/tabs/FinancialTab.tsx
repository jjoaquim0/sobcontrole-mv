import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { ArrowDownCircle, ArrowUpCircle, AlertTriangle } from 'lucide-react';
import { FinancialReport } from '../../../services/reportService';
import { ReportCard, ReportCardSkeleton } from '../components/ReportCard';
import { ReportChart, chartTooltipFormatter } from '../components/ReportChart';
import { ExportButton } from '../components/ExportButton';
import { DataTable, Column } from '../../../components/shared/DataTable';

interface FinancialTabProps {
  data?: FinancialReport;
  isLoading: boolean;
  isError: boolean;
  formatCurrency: (value?: number) => string;
  onExport: () => void;
}

export const FinancialTab: React.FC<FinancialTabProps> = ({ data, isLoading, isError, formatCurrency, onExport }) => {
  if (isError) {
    return <div className="text-center py-10 text-sm text-red-500">Erro ao carregar o relatório Financeiro. Tente novamente.</div>;
  }

  const receivablesColumns: Column<{ date: string; amount: number }>[] = [
    { key: 'date', label: 'Vencimento' },
    { key: 'amount', label: 'Valor', render: (row) => formatCurrency(row.amount) },
  ];

  const payablesColumns: Column<{ date: string; amount: number }>[] = [
    { key: 'date', label: 'Vencimento' },
    { key: 'amount', label: 'Valor', render: (row) => formatCurrency(row.amount) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Relatório Financeiro</h2>
        <ExportButton onExport={onExport} disabled={!data} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <ReportCardSkeleton key={i} />)
        ) : (
          <>
            <ReportCard title="A Receber" value={formatCurrency(data?.receivables.pending)} accentColor="green" icon={<ArrowDownCircle className="w-5 h-5" />} />
            <ReportCard title="A Pagar" value={formatCurrency(data?.payables.pending)} accentColor="blue" icon={<ArrowUpCircle className="w-5 h-5" />} />
            <ReportCard title="Vencidos a Receber" value={formatCurrency(data?.receivables.overdue)} accentColor="red" icon={<AlertTriangle className="w-5 h-5" />} />
            <ReportCard title="Vencidos a Pagar" value={formatCurrency(data?.payables.overdue)} accentColor="red" icon={<AlertTriangle className="w-5 h-5" />} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm transition-colors duration-300 overflow-hidden">
          <div className="px-5 pt-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 uppercase tracking-wider">Contas a Receber</h3>
          </div>
          <DataTable
            data={data?.receivables.byDueDate || []}
            columns={receivablesColumns}
            isLoading={isLoading}
            emptyIcon={<ArrowDownCircle className="w-10 h-10 text-[#10b981] mb-2" />}
            emptyTitle="Nenhuma conta a receber"
          />
        </div>

        <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm transition-colors duration-300 overflow-hidden">
          <div className="px-5 pt-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 uppercase tracking-wider">Contas a Pagar</h3>
          </div>
          <DataTable
            data={data?.payables.byDueDate || []}
            columns={payablesColumns}
            isLoading={isLoading}
            emptyIcon={<ArrowUpCircle className="w-10 h-10 text-blue-500 mb-2" />}
            emptyTitle="Nenhuma conta a pagar"
          />
        </div>
      </div>

      <ReportChart title="Fluxo de Caixa Projetado" isLoading={isLoading} isEmpty={!data?.cashFlow?.length}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data?.cashFlow}>
            <defs>
              <linearGradient id="inflowsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="outflowsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-white/5" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => chartTooltipFormatter(v)} />
            <Legend />
            <Area type="monotone" dataKey="inflows" name="Entradas" stroke="#10b981" fill="url(#inflowsGradient)" strokeWidth={2} />
            <Area type="monotone" dataKey="outflows" name="Saídas" stroke="#ef4444" fill="url(#outflowsGradient)" strokeWidth={2} />
            <Area type="monotone" dataKey="balance" name="Saldo" stroke="#3b82f6" fill="url(#balanceGradient)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ReportChart>

      <ReportChart title="Aging — Contas Vencidas por Faixa" isLoading={isLoading} isEmpty={!data?.aging?.length}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data?.aging}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-white/5" />
            <XAxis dataKey="range" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => chartTooltipFormatter(v)} />
            <Legend />
            <Bar dataKey="receivables" name="A Receber" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="payables" name="A Pagar" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ReportChart>
    </div>
  );
};
