import React from 'react';
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, CalendarClock, ShieldCheck } from 'lucide-react';
import { ForecastAlert } from '../../../services/cashFlowForecastService';

const formatMoney = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const severityStyles: Record<ForecastAlert['severity'], { icon: React.ReactNode; classes: string }> = {
  critical: {
    icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
    classes: 'border-red-100 dark:border-red-900/30 bg-red-50/60 dark:bg-red-950/10',
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
    classes: 'border-amber-100 dark:border-amber-900/30 bg-amber-50/60 dark:bg-amber-950/10',
  },
  info: {
    icon: <CalendarClock className="w-4 h-4 text-blue-500" />,
    classes: 'border-blue-100 dark:border-blue-900/30 bg-blue-50/60 dark:bg-blue-950/10',
  },
};

export interface ForecastAlertsProps {
  alerts: ForecastAlert[];
  onViewBucket: (bucketKey: string) => void;
  onViewReceivables: () => void;
  onViewPayables: () => void;
}

export const ForecastAlerts: React.FC<ForecastAlertsProps> = ({
  alerts,
  onViewBucket,
  onViewReceivables,
  onViewPayables,
}) => {
  const handleAction = (alert: ForecastAlert) => {
    if (alert.type === 'overdue_receivables') return onViewReceivables();
    if (alert.type === 'overdue_payables') return onViewPayables();
    if (alert.bucketKey) return onViewBucket(alert.bucketKey);
  };

  const actionLabel = (alert: ForecastAlert): string => {
    if (alert.type === 'overdue_receivables') return 'Ver contas a receber';
    if (alert.type === 'overdue_payables') return 'Ver contas a pagar';
    return 'Ver lançamentos';
  };

  return (
    <div className="bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        {alerts.length > 0 ? (
          <AlertTriangle className="w-4 h-4 text-amber-500" />
        ) : (
          <ShieldCheck className="w-4 h-4 text-[#10b981]" />
        )}
        <h4 className="text-sm font-bold text-gray-900 dark:text-white">Atenções no Caixa</h4>
      </div>

      {alerts.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Nenhuma atenção identificada no período selecionado.
        </p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border p-3 ${severityStyles[alert.severity].classes}`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="mt-0.5 shrink-0">{severityStyles[alert.severity].icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{alert.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {alert.description}
                    {alert.amount !== undefined && (
                      <>
                        {' '}
                        <span className="font-semibold text-gray-700 dark:text-gray-300">
                          ({formatMoney(alert.amount)})
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleAction(alert)}
                className="shrink-0 text-xs font-semibold text-[#10b981] hover:underline self-start sm:self-auto flex items-center gap-1"
              >
                {alert.type === 'overdue_receivables' ? (
                  <ArrowDownCircle className="w-3.5 h-3.5" />
                ) : alert.type === 'overdue_payables' ? (
                  <ArrowUpCircle className="w-3.5 h-3.5" />
                ) : null}
                {actionLabel(alert)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ForecastAlerts;
