import React from 'react';
import { BarChart3 } from 'lucide-react';
import { ReportEmptyState } from './ReportEmptyState';

export interface ChartCardProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  height?: number;
  action?: React.ReactNode;
  className?: string;
  testId?: string;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  children,
  isLoading = false,
  isEmpty = false,
  emptyMessage = 'Não há dados suficientes neste período para montar este gráfico.',
  height = 300,
  action,
  className = '',
  testId,
}) => (
  <article
    className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/5 dark:bg-[#1a1d27] ${className}`}
    data-testid={testId}
  >
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{subtitle}</p>
      </div>
      {action}
    </div>
    {isLoading ? (
      <div className="w-full animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" style={{ height }} role="status" aria-label={`Carregando ${title}`} />
    ) : isEmpty ? (
      <ReportEmptyState
        compact
        icon={<BarChart3 className="h-8 w-8" />}
        title="Dados insuficientes"
        description={emptyMessage}
        minHeight={height}
      />
    ) : (
      <div style={{ width: '100%', height }}>{children}</div>
    )}
  </article>
);
