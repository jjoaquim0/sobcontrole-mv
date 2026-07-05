import React from 'react';
import { BarChart3 } from 'lucide-react';

interface ReportChartProps {
  title: string;
  isLoading?: boolean;
  isEmpty?: boolean;
  height?: number;
  children: React.ReactNode;
}

export const ReportChart: React.FC<ReportChartProps> = ({ title, isLoading, isEmpty, height = 280, children }) => {
  return (
    <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm transition-colors duration-300">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4 uppercase tracking-wider">{title}</h3>
      {isLoading ? (
        <div className="w-full bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse" style={{ height }} />
      ) : isEmpty ? (
        <div className="w-full flex flex-col items-center justify-center gap-2 text-center" style={{ height }}>
          <BarChart3 className="w-10 h-10 text-gray-300 dark:text-white/15" />
          <p className="text-xs text-gray-400 max-w-xs">Nenhum dado disponível para o período selecionado.</p>
        </div>
      ) : (
        <div style={{ width: '100%', height }}>{children}</div>
      )}
    </div>
  );
};

export const chartTooltipFormatter = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
