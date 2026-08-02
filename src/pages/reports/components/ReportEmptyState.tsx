import React from 'react';
import { Database } from 'lucide-react';

interface ReportEmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
  minHeight?: number;
}

export const ReportEmptyState: React.FC<ReportEmptyStateProps> = ({
  title = 'Nenhum dado no período',
  description = 'Não há dados suficientes neste período. Registre vendas, compras ou lançamentos para acompanhar esta análise.',
  icon = <Database className="h-9 w-9" />,
  action,
  compact = false,
  minHeight = 260,
}) => (
  <div
    className={`flex flex-col items-center justify-center rounded-xl text-center text-gray-300 dark:text-white/20 ${compact ? '' : 'border border-dashed border-gray-200 bg-gray-50/50 p-8 dark:border-white/10 dark:bg-white/[0.02]'}`}
    style={{ minHeight }}
  >
    {icon}
    <h3 className="mt-3 text-sm font-bold text-gray-900 dark:text-white">{title}</h3>
    <p className="mt-1 max-w-md text-xs leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);
