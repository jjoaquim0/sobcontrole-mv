import React from 'react';
import { ArrowDownCircle, ArrowUpCircle, ChevronDown, ChevronRight, Inbox } from 'lucide-react';
import {
  ForecastBucket,
  ForecastBucketStatus,
  ForecastEntry,
  ForecastEntryStatus,
} from '../../../services/cashFlowForecastService';

const formatMoney = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const bucketStatusConfig: Record<ForecastBucketStatus, { text: string; classes: string }> = {
  healthy: { text: 'Saudável', classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  attention: { text: 'Atenção', classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  negative: { text: 'Saldo negativo', classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const entryStatusConfig: Record<ForecastEntryStatus, { text: string; classes: string }> = {
  previsto: { text: 'Previsto', classes: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400' },
  vencido: { text: 'Vencido', classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  pago: { text: 'Pago', classes: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  recebido: { text: 'Recebido', classes: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
};

const EntryRow: React.FC<{ entry: ForecastEntry }> = ({ entry }) => (
  <div className="flex items-center justify-between gap-3 text-xs border-b border-gray-100 dark:border-white/5 py-2.5 last:border-0">
    <div className="flex items-center gap-2 min-w-0">
      {entry.type === 'in' ? (
        <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
      ) : (
        <ArrowUpCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
      )}
      <div className="min-w-0">
        <p className="font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[220px]" title={entry.description}>
          {entry.description}
        </p>
        <p className="text-[11px] text-gray-400 truncate">
          {entry.relatedName || 'Sem cliente/fornecedor vinculado'} · Não categorizado · Vence em{' '}
          {new Date(entry.dueDate).toLocaleDateString('pt-BR')}
        </p>
      </div>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${entryStatusConfig[entry.status].classes}`}>
        {entryStatusConfig[entry.status].text}
      </span>
      <span className={`font-bold ${entry.type === 'in' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
        {formatMoney(entry.amount)}
      </span>
    </div>
  </div>
);

export interface ForecastTableProps {
  buckets: ForecastBucket[];
  expandedKey: string | null;
  onToggle: (key: string) => void;
}

export const ForecastTable = React.forwardRef<HTMLDivElement, ForecastTableProps>(
  ({ buckets, expandedKey, onToggle }, ref) => {
    if (buckets.length === 0) {
      return (
        <div
          ref={ref}
          className="bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 p-10 flex flex-col items-center justify-center text-center shadow-sm"
        >
          <Inbox className="w-10 h-10 text-gray-300 dark:text-white/15 mb-3" />
          <h4 className="text-sm font-bold text-gray-900 dark:text-white">Nenhum período para exibir</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ajuste o período selecionado.</p>
        </div>
      );
    }

    return (
      <div ref={ref} className="bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/5 bg-gray-50/75 dark:bg-white/[0.02]">
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Período</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Saldo Inicial</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Entradas</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Saídas</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Saldo Final</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {buckets.map((bucket) => {
                const isExpanded = expandedKey === bucket.key;
                return (
                  <React.Fragment key={bucket.key}>
                    <tr
                      onClick={() => onToggle(bucket.key)}
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors duration-150"
                    >
                      <td className="px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                        <span className="flex items-center gap-1.5">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                          )}
                          {bucket.label}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-300">{formatMoney(bucket.openingBalance)}</td>
                      <td className="px-6 py-3 text-sm text-emerald-600 dark:text-emerald-400 font-semibold">{formatMoney(bucket.inflows)}</td>
                      <td className="px-6 py-3 text-sm text-red-500 dark:text-red-400 font-semibold">{formatMoney(bucket.outflows)}</td>
                      <td className={`px-6 py-3 text-sm font-bold ${bucket.closingBalance < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                        {formatMoney(bucket.closingBalance)}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${bucketStatusConfig[bucket.status].classes}`}>
                          {bucketStatusConfig[bucket.status].text}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="bg-gray-50/60 dark:bg-white/[0.02] px-6 py-4">
                          {bucket.entries.length === 0 ? (
                            <p className="text-xs text-gray-400">Nenhum lançamento previsto para este período.</p>
                          ) : (
                            <div>
                              {bucket.entries.map((entry) => (
                                <EntryRow key={entry.id} entry={entry} />
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  },
);

ForecastTable.displayName = 'ForecastTable';

export default ForecastTable;
