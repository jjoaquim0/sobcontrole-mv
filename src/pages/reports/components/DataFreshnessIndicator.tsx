import React from 'react';
import { RefreshCw } from 'lucide-react';

interface DataFreshnessIndicatorProps {
  updatedAt?: number | string | Date;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const formatFreshness = (updatedAt?: number | string | Date) => {
  if (!updatedAt) return 'Aguardando atualização';
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return 'Atualização indisponível';
  return `Atualizado em ${new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)}`;
};

export const DataFreshnessIndicator: React.FC<DataFreshnessIndicatorProps> = ({
  updatedAt,
  onRefresh,
  isRefreshing = false,
}) => (
  <div className="inline-flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
    <span>{formatFreshness(updatedAt)}</span>
    {onRefresh && (
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="rounded-md p-1 transition hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a8d8] disabled:cursor-wait dark:hover:bg-white/5 dark:hover:text-gray-300"
        aria-label="Atualizar dados"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
      </button>
    )}
  </div>
);
