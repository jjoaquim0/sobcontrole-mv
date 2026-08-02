import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ReportErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  denied?: boolean;
}

export const ReportErrorState: React.FC<ReportErrorStateProps> = ({
  title = 'Não foi possível carregar esta análise',
  description = 'Os dados não foram alterados. Tente novamente em instantes.',
  onRetry,
  denied = false,
}) => (
  <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white p-8 text-center dark:border-white/5 dark:bg-[#1a1d27]">
    <div className={`rounded-full p-3 ${denied ? 'bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300' : 'bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300'}`}>
      <AlertTriangle className="h-7 w-7" />
    </div>
    <h2 className="mt-4 text-base font-bold text-gray-950 dark:text-white">{denied ? 'Acesso financeiro não autorizado' : title}</h2>
    <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
      {denied ? 'Somente administradores e gerentes podem visualizar dados financeiros.' : description}
    </p>
    {onRetry && !denied && (
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a8d8] dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
      >
        <RefreshCw className="h-4 w-4" />
        Tentar novamente
      </button>
    )}
  </div>
);
