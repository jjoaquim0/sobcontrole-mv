import React from 'react';
import { BadgeDollarSign, CircleDollarSign, Info, Percent, ReceiptText } from 'lucide-react';
import { DREReport } from '../../../services/reportService';
import { DashboardSection } from '../components/DashboardSection';
import { DataFreshnessIndicator } from '../components/DataFreshnessIndicator';
import { ExportButton } from '../components/ExportButton';
import { MetricCard } from '../components/MetricCard';
import { ReportEmptyState } from '../components/ReportEmptyState';
import { ReportErrorState } from '../components/ReportErrorState';

interface DRETabProps {
  data?: DREReport;
  isLoading: boolean;
  isError: boolean;
  isAccessDenied?: boolean;
  formatCurrency: (value?: number) => string;
  formatDate: (dateStr?: string) => string;
  onExport: () => void;
  onRetry: () => void;
  updatedAt?: number;
}

export const DRETab: React.FC<DRETabProps> = ({
  data,
  isLoading,
  isError,
  isAccessDenied = false,
  formatCurrency,
  formatDate,
  onExport,
  onRetry,
  updatedAt,
}) => {
  if (isError) return <ReportErrorState onRetry={onRetry} denied={isAccessDenied} />;

  const hasData = Boolean(data?.entries.some((entry) => entry.value !== 0));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DataFreshnessIndicator updatedAt={updatedAt} onRefresh={onRetry} />
        <ExportButton onExport={onExport} disabled={!data} />
      </div>

      <DashboardSection
        title="Resumo gerencial"
        description="A composição usa valores NUMERIC do banco e evita a dupla dedução de descontos."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Receita líquida"
            value={formatCurrency(data?.summary.netRevenue)}
            icon={<CircleDollarSign className="h-5 w-5" />}
            description="Valor final das vendas pagas: receita bruta + taxas − descontos."
            accent="brand"
            isLoading={isLoading}
          />
          <MetricCard
            title="Custos e despesas"
            value={formatCurrency(data?.summary.totalExpenses)}
            icon={<ReceiptText className="h-5 w-5" />}
            description="Compras pagas mais contas a pagar manuais pagas, sem duplicar compras."
            accent="amber"
            isLoading={isLoading}
          />
          <MetricCard
            title="Resultado líquido"
            value={formatCurrency(data?.summary.netProfit)}
            icon={<BadgeDollarSign className="h-5 w-5" />}
            description="Resultado gerencial da receita líquida menos custos e despesas identificados."
            accent={(data?.summary.netProfit ?? 0) >= 0 ? 'brand' : 'red'}
            isLoading={isLoading}
          />
          <MetricCard
            title="Margem líquida"
            value={`${(data?.summary.profitMargin ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
            icon={<Percent className="h-5 w-5" />}
            description="Resultado líquido gerencial dividido pela receita líquida."
            accent={(data?.summary.profitMargin ?? 0) >= 0 ? 'blue' : 'red'}
            isLoading={isLoading}
          />
        </div>
      </DashboardSection>

      {!isLoading && !hasData ? (
        <ReportEmptyState description="Não há vendas, compras ou despesas pagas suficientes no período para compor a DRE gerencial." />
      ) : (
        <section className="dre-printable overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-white/5 dark:bg-[#1a1d27]">
          <div className="border-b border-gray-100 px-6 py-5 dark:border-white/5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-950 dark:text-white">Demonstrativo de Resultados Gerencial</h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Período: {formatDate(data?.period.dateFrom)} a {formatDate(data?.period.dateTo)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="print:hidden rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a8d8] dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
              >
                Imprimir DRE
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3 p-6" role="status" aria-label="Carregando DRE">
              {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-white/5" />)}
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {data?.entries.map((entry) => {
                const total = entry.type === 'total';
                const negative = entry.type === 'expense' || entry.type === 'deduction';
                return (
                  <div
                    key={entry.category}
                    className={`flex items-center justify-between gap-4 px-6 py-4 ${total ? 'bg-gray-50/70 dark:bg-white/[0.02]' : ''}`}
                  >
                    <span className={`${total ? 'text-sm font-extrabold text-gray-950 dark:text-white' : 'text-sm text-gray-600 dark:text-gray-300'}`}>
                      {entry.category}
                    </span>
                    <span className={`shrink-0 font-semibold tabular-nums ${negative ? 'text-rose-600 dark:text-rose-300' : total ? 'text-gray-950 dark:text-white' : 'text-emerald-700 dark:text-emerald-300'}`}>
                      {negative && entry.value > 0 ? '− ' : ''}
                      {formatCurrency(entry.value)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-start gap-2 border-t border-sky-100 bg-sky-50/70 px-6 py-4 text-xs leading-relaxed text-sky-800 dark:border-sky-400/10 dark:bg-sky-400/5 dark:text-sky-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{data?.basisNote}</span>
          </div>
        </section>
      )}
    </div>
  );
};
