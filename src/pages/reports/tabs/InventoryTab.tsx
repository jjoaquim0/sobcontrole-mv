import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Package, AlertTriangle, XCircle, Boxes, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { InventoryReport } from '../../../services/reportService';
import { ReportCard, ReportCardSkeleton } from '../components/ReportCard';
import { ReportChart, CHART_COLORS } from '../components/ReportChart';
import { ExportButton } from '../components/ExportButton';
import { DataTable, Column } from '../../../components/shared/DataTable';

interface InventoryTabProps {
  data?: InventoryReport;
  isLoading: boolean;
  isError: boolean;
  formatCurrency: (value?: number) => string;
  onExport: () => void;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({ data, isLoading, isError, formatCurrency, onExport }) => {
  if (isError) {
    return <div className="text-center py-10 text-sm text-red-500">Erro ao carregar o relatório de Estoque. Tente novamente.</div>;
  }

  const movementColumns: Column<InventoryReport['movements'][number]>[] = [
    { key: 'date', label: 'Data' },
    { key: 'productName', label: 'Produto' },
    {
      key: 'type',
      label: 'Tipo',
      render: (row) =>
        row.type === 'in' ? (
          <span className="flex items-center gap-1 text-emerald-500 font-semibold text-xs">
            <ArrowDownCircle className="w-3.5 h-3.5" /> Entrada
          </span>
        ) : (
          <span className="flex items-center gap-1 text-red-500 font-semibold text-xs">
            <ArrowUpCircle className="w-3.5 h-3.5" /> Saída
          </span>
        ),
    },
    { key: 'quantity', label: 'Quantidade' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Relatório de Estoque</h2>
        <ExportButton onExport={onExport} disabled={!data} />
      </div>

      {!isLoading && (data?.summary.outOfStock ?? 0) > 0 && (
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl p-4 text-sm text-red-600 dark:text-red-400">
          <XCircle className="w-5 h-5 shrink-0" />
          <span>
            <strong>{data?.summary.outOfStock}</strong> produto(s) sem estoque disponível. Revise reposições urgentes.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <ReportCardSkeleton key={i} />)
        ) : (
          <>
            <ReportCard title="Produtos Ativos" value={data?.summary.activeProducts ?? 0} accentColor="blue" icon={<Package className="w-5 h-5" />} />
            <ReportCard title="Valor do Estoque" value={formatCurrency(data?.summary.totalValue)} accentColor="green" icon={<Boxes className="w-5 h-5" />} />
            <ReportCard title="Estoque Baixo" value={data?.summary.lowStock ?? 0} accentColor="yellow" icon={<AlertTriangle className="w-5 h-5" />} />
            <ReportCard title="Sem Estoque" value={data?.summary.outOfStock ?? 0} accentColor="red" icon={<XCircle className="w-5 h-5" />} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportChart title="Distribuição por Categoria" isLoading={isLoading} isEmpty={!data?.byCategory?.length}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data?.byCategory} dataKey="value" nameKey="categoryName" cx="50%" cy="50%" outerRadius={90} label>
                {(data?.byCategory || []).map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ReportChart>

        <ReportChart title="Top 10 Produtos Mais Vendidos" isLoading={isLoading} isEmpty={!data?.topSellers?.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.topSellers}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-white/5" />
              <XAxis dataKey="productName" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="quantitySold" name="Qtd. Vendida" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ReportChart>
      </div>

      <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm transition-colors duration-300 overflow-hidden">
        <div className="px-5 pt-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 uppercase tracking-wider">Últimas Movimentações</h3>
        </div>
        <DataTable
          data={data?.movements || []}
          columns={movementColumns}
          isLoading={isLoading}
          emptyIcon={<Boxes className="w-10 h-10 text-[#10b981] mb-2" />}
          emptyTitle="Nenhuma movimentação encontrada"
        />
      </div>
    </div>
  );
};
