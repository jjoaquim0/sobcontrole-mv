import React from 'react';
import { Loader2 } from 'lucide-react';
import { DREReport } from '../../../services/reportService';
import { ExportButton } from '../components/ExportButton';

interface DRETabProps {
  data?: DREReport;
  isLoading: boolean;
  isError: boolean;
  formatCurrency: (value?: number) => string;
  formatDate: (dateStr?: string) => string;
  onExport: () => void;
}

export const DRETab: React.FC<DRETabProps> = ({ data, isLoading, isError, formatCurrency, formatDate, onExport }) => {
  if (isError) {
    return <div className="text-center py-10 text-sm text-red-500">Erro ao carregar o DRE. Tente novamente.</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Demonstrativo de Resultados (DRE)</h2>
        <ExportButton onExport={onExport} disabled={!data} />
      </div>

      <div className="dre-printable bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-6 shadow-sm transition-colors duration-300">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h3 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-wider">Demonstrativo de Resultados</h3>
              <p className="text-xs text-gray-400 mt-1">
                Período: {formatDate(data?.period.dateFrom)} a {formatDate(data?.period.dateTo)}
              </p>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {data?.entries.map((entry, i) => {
                const isTotal = entry.type === 'total';
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between py-3 ${isTotal ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}
                  >
                    <span className={isTotal ? '' : 'text-sm'}>{entry.category}</span>
                    <span
                      className={
                        entry.type === 'expense' || entry.type === 'deduction'
                          ? 'text-red-500'
                          : entry.type === 'total'
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-700 dark:text-gray-300'
                      }
                    >
                      {(entry.type === 'expense' || entry.type === 'deduction') && entry.value > 0 ? '- ' : ''}
                      {formatCurrency(entry.value)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-gray-100 dark:border-white/5 mt-4 pt-4 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900 dark:text-white">MARGEM LÍQUIDA</span>
              <span className={`text-sm font-bold ${(data?.summary.profitMargin ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {(data?.summary.profitMargin ?? 0).toFixed(2)}%
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
