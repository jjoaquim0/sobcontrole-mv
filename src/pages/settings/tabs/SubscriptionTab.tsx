import React from 'react';
import { Sparkles, Zap, Receipt, CreditCard } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';

const cardClass = 'bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm p-6';

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito',
  pro: 'Profissional',
  enterprise: 'Empresarial',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativa',
  trialing: 'Período de Teste',
  past_due: 'Pagamento Pendente',
  canceled: 'Cancelada',
  inactive: 'Inativa',
};

export const SubscriptionTab: React.FC = () => {
  const { subscription } = useAuth();

  const plan = subscription?.plan || 'free';
  const status = subscription?.status || 'inactive';
  const usageCurrent = subscription?.usageCurrent ?? 0;
  const usageLimit = subscription?.usageLimit ?? 100;
  const usagePercent = usageLimit > 0 ? Math.min(100, Math.round((usageCurrent / usageLimit) * 100)) : 0;
  const renewDate = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString('pt-BR')
    : '—';

  const barColor = usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-amber-500' : 'bg-[#10b981]';

  return (
    <div className="space-y-6">
      <div className={cardClass}>
        <div className="flex items-center gap-3 border-b border-gray-100 dark:border-white/5 pb-4 mb-6">
          <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
            <Sparkles className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Assinatura</h2>
            <p className="text-sm text-gray-500 dark:text-white/50">Gerencie o plano e a cobrança da sua empresa</p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 dark:border-white/5 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-transparent p-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#10b981]" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Plano {PLAN_LABELS[plan] || plan}</h3>
              </div>
              <p className="text-sm text-gray-500 dark:text-white/50 mt-1">
                Status:{' '}
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {STATUS_LABELS[status] || status}
                </span>
              </p>
              <p className="text-xs text-gray-400 dark:text-white/40 mt-1">Próxima renovação em {renewDate}</p>
            </div>
            <button
              type="button"
              disabled
              className="bg-[#10b981] text-white rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-1.5 opacity-60 cursor-not-allowed"
              title="Disponível em breve"
            >
              <CreditCard className="w-4 h-4" />
              Gerenciar Assinatura
            </button>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Uso do Plano
              </span>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {usageCurrent} / {usageLimit}
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${usagePercent}%` }} />
            </div>
            <p className="text-[11px] text-gray-400 dark:text-white/40 mt-1.5">{usagePercent}% da capacidade utilizada</p>
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <div className="flex items-center gap-3 mb-4">
          <span className="p-2 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-300">
            <Receipt className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Histórico de Faturas</h3>
            <p className="text-xs text-gray-500 dark:text-white/50 mt-0.5">Consulte suas faturas anteriores.</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
          <Receipt className="w-8 h-8 text-gray-300 dark:text-white/20 mb-2" />
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Nenhuma fatura disponível</p>
          <p className="text-xs text-gray-500 dark:text-white/50 mt-1 max-w-xs">
            O histórico de faturas estará disponível em breve.
          </p>
        </div>
      </div>
    </div>
  );
};
