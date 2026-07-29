import React, { useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarClock,
  PiggyBank,
  Plus,
  RefreshCcw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { StatCard } from '../../../components/shared/StatCard';
import { useCashFlowForecast, ForecastPeriodPreset } from '../../../hooks/useCashFlowForecast';
import { useFinancial } from '../../../hooks/useFinancial';
import { ForecastTable } from './ForecastTable';
import { ForecastAlerts } from './ForecastAlerts';
import { ManualEntryModal } from './ManualEntryModal';

const formatMoney = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const formatLongDate = (dateKey: string) =>
  new Date(`${dateKey}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

const PERIOD_OPTIONS: { value: ForecastPeriodPreset; label: string }[] = [
  { value: '7', label: 'Próximos 7 dias' },
  { value: '30', label: 'Próximos 30 dias' },
  { value: '60', label: 'Próximos 60 dias' },
  { value: '90', label: 'Próximos 90 dias' },
  { value: 'custom', label: 'Período personalizado' },
];

interface ForecastTooltipPayloadItem {
  payload: { label: string; closingBalance: number; inflows: number; outflows: number };
}

const ForecastTooltip: React.FC<{ active?: boolean; payload?: ForecastTooltipPayloadItem[] }> = ({
  active,
  payload,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/10 rounded-xl shadow-lg p-3 text-xs space-y-1 min-w-[180px]">
      <p className="font-bold text-gray-900 dark:text-white">{point.label}</p>
      <p className="text-blue-500 dark:text-blue-400">Saldo projetado: {formatMoney(point.closingBalance)}</p>
      <p className="text-emerald-600 dark:text-emerald-400">Entradas previstas: {formatMoney(point.inflows)}</p>
      <p className="text-red-500 dark:text-red-400">Saídas previstas: {formatMoney(point.outflows)}</p>
    </div>
  );
};

const ForecastDot: React.FC<{ cx?: number; cy?: number; payload?: { closingBalance: number }; index?: number }> = ({
  cx,
  cy,
  payload,
  index,
}) => {
  if (cx === undefined || cy === undefined) return <React.Fragment key={index} />;
  const isNegative = (payload?.closingBalance ?? 0) < 0;
  return (
    <circle
      key={index}
      cx={cx}
      cy={cy}
      r={isNegative ? 4 : 2.5}
      fill={isNegative ? '#ef4444' : '#3b82f6'}
      stroke={isNegative ? '#ef4444' : '#3b82f6'}
    />
  );
};

const CardSkeleton: React.FC = () => (
  <div className="panel-glass rounded-2xl p-5 animate-pulse">
    <div className="h-3 w-20 bg-gray-200 dark:bg-white/10 rounded mb-3" />
    <div className="h-6 w-28 bg-gray-200 dark:bg-white/10 rounded" />
  </div>
);

export interface CashFlowForecastTabProps {
  onViewReceivables?: () => void;
  onViewPayables?: () => void;
}

export const CashFlowForecastTab: React.FC<CashFlowForecastTabProps> = ({ onViewReceivables, onViewPayables }) => {
  const [preset, setPreset] = useState<ForecastPeriodPreset>('30');
  const [customEndDate, setCustomEndDate] = useState('');
  const [expandedBucketKey, setExpandedBucketKey] = useState<string | null>(null);
  const [entryModal, setEntryModal] = useState<'receivable' | 'payable' | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const { forecast, isLoading, isError, refetch, dataUpdatedAt } = useCashFlowForecast({ preset, customEndDate });
  const { createManualReceivable, isCreatingReceivable, createManualPayable, isCreatingPayable } = useFinancial({
    enableReceivables: false,
    enablePayables: false,
    enableCashFlow: false,
    enableCategories: false,
  });

  const chartData = useMemo(() => {
    if (!forecast) return [];
    const startingPoint = {
      key: '__start__',
      label: 'Saldo atual',
      closingBalance: forecast.currentBalance,
      inflows: 0,
      outflows: 0,
    };
    return [
      startingPoint,
      ...forecast.buckets.map((b) => ({
        key: b.key,
        label: b.label,
        closingBalance: b.closingBalance,
        inflows: b.inflows,
        outflows: b.outflows,
      })),
    ];
  }, [forecast]);

  const isEmpty =
    !!forecast &&
    forecast.currentBalance === 0 &&
    forecast.overdueReceivablesTotal === 0 &&
    forecast.overduePayablesTotal === 0 &&
    forecast.buckets.every((b) => b.entries.length === 0);

  const handleViewBucket = (bucketKey: string) => {
    setExpandedBucketKey(bucketKey);
    requestAnimationFrame(() => {
      tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleToggleBucket = (key: string) => {
    setExpandedBucketKey((current) => (current === key ? null : key));
  };

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <AlertTriangle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-red-500">Erro ao carregar a previsão de fluxo de caixa.</p>
        <button type="button" onClick={() => refetch()} className="text-sm font-semibold text-[#10b981] hover:underline">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Previsão de Fluxo de Caixa</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Acompanhe entradas, saídas e o saldo projetado do seu negócio.
          </p>
          <p className="text-[11px] text-gray-400 dark:text-white/40 mt-1">
            Saldo consolidado da empresa — o sistema ainda não possui contas bancárias/caixa cadastradas
            separadamente.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as ForecastPeriodPreset)}
            className="px-4 py-2.5 pr-8 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#1a1d27] text-xs font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] appearance-none cursor-pointer"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {preset === 'custom' && (
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="px-3 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#1a1d27] text-xs font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] dark:[color-scheme:dark]"
            />
          )}

          <button
            type="button"
            onClick={() => refetch()}
            title="Atualizar previsão"
            className="p-2.5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-500 hover:text-[#10b981] hover:border-[#10b981]/40 transition-colors"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-gray-400 dark:text-white/40 flex items-center gap-1.5">
          <CalendarClock className="w-3.5 h-3.5" />
          {dataUpdatedAt
            ? `Última atualização às ${new Date(dataUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
            : 'Carregando...'}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEntryModal('receivable')}
            className="bg-white dark:bg-[#1a1d27] border border-gray-200 dark:border-white/10 hover:border-[#10b981]/50 text-gray-700 dark:text-gray-200 rounded-xl px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors duration-200"
          >
            <Plus className="w-3.5 h-3.5 text-[#10b981]" />
            Recebimento Previsto
          </button>
          <button
            type="button"
            onClick={() => setEntryModal('payable')}
            className="bg-white dark:bg-[#1a1d27] border border-gray-200 dark:border-white/10 hover:border-red-400/50 text-gray-700 dark:text-gray-200 rounded-xl px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors duration-200"
          >
            <Plus className="w-3.5 h-3.5 text-red-500" />
            Pagamento Previsto
          </button>
        </div>
      </div>

      {isLoading || !forecast ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-2 border border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
          <PiggyBank className="w-10 h-10 text-gray-300 dark:text-white/15 mb-1" />
          <h4 className="text-sm font-bold text-gray-900 dark:text-white">Sem dados suficientes para projetar</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
            Registre contas a pagar, contas a receber ou lançamentos previstos para visualizar a projeção do seu
            caixa.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <StatCard title="Saldo Atual" value={formatMoney(forecast.currentBalance)} icon={<Wallet className="w-5 h-5" />} accentColor="blue" />

            <div title="Soma das contas a receber em aberto (pendentes ou vencidas) dentro do período selecionado.">
              <StatCard
                title="Entradas Previstas"
                value={formatMoney(forecast.totalInflows)}
                icon={<ArrowDownCircle className="w-5 h-5" />}
                accentColor="green"
              />
            </div>

            <div title="Soma das contas a pagar em aberto (pendentes ou vencidas) dentro do período selecionado.">
              <StatCard
                title="Saídas Previstas"
                value={formatMoney(forecast.totalOutflows)}
                icon={<ArrowUpCircle className="w-5 h-5" />}
                accentColor="red"
              />
            </div>

            <div title="Saldo atual mais entradas previstas menos saídas previstas, acumulado até o fim do período.">
              <StatCard
                title="Saldo Projetado"
                value={formatMoney(forecast.projectedEndBalance)}
                icon={forecast.projectedEndBalance >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                accentColor={forecast.projectedEndBalance >= 0 ? 'green' : 'red'}
              />
            </div>

            <StatCard
              title="Menor Saldo Previsto"
              value={
                <div>
                  <div>{formatMoney(forecast.lowestBalance.amount)}</div>
                  <div className="text-[10px] font-normal text-gray-400 mt-0.5">
                    em {formatLongDate(forecast.lowestBalance.date)}
                  </div>
                </div>
              }
              icon={<TrendingDown className="w-5 h-5" />}
              accentColor={forecast.lowestBalance.amount < 0 ? 'red' : 'yellow'}
            />

            <StatCard
              title="Possível Saldo Negativo"
              value={forecast.negativeDate ? formatLongDate(forecast.negativeDate) : 'Nenhuma data prevista'}
              icon={<AlertTriangle className="w-5 h-5" />}
              accentColor={forecast.negativeDate ? 'red' : 'green'}
            />
          </div>

          <div className="bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-[#10b981]" />
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">Evolução do Saldo Projetado</h4>
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, bottom: 5, left: 5, right: 5 }}>
                  <defs>
                    <linearGradient id="forecastBalanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    width={80}
                    tickFormatter={(v) => formatMoney(Number(v))}
                  />
                  <Tooltip content={<ForecastTooltip />} />
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                  <Area
                    type="monotone"
                    dataKey="closingBalance"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#forecastBalanceGradient)"
                    dot={<ForecastDot />}
                    activeDot={{ r: 5 }}
                    name="Saldo projetado"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <ForecastTable
            ref={tableRef}
            buckets={forecast.buckets}
            expandedKey={expandedBucketKey}
            onToggle={handleToggleBucket}
          />

          <ForecastAlerts
            alerts={forecast.alerts}
            onViewBucket={handleViewBucket}
            onViewReceivables={() => onViewReceivables?.()}
            onViewPayables={() => onViewPayables?.()}
          />
        </>
      )}

      <ManualEntryModal
        isOpen={entryModal !== null}
        onClose={() => setEntryModal(null)}
        type={entryModal ?? 'receivable'}
        onSaveReceivable={async (data) => {
          await createManualReceivable(data);
        }}
        onSavePayable={async (data) => {
          await createManualPayable(data);
        }}
        isLoading={entryModal === 'receivable' ? isCreatingReceivable : isCreatingPayable}
      />
    </div>
  );
};

export default CashFlowForecastTab;
