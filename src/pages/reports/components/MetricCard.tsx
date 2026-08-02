import React from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronRight, Info } from 'lucide-react';
import { Link } from 'react-router-dom';

type Accent = 'brand' | 'blue' | 'amber' | 'red' | 'purple' | 'slate';
type TrendTone = 'positive' | 'negative' | 'neutral';

export interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  description: string;
  trend?: number;
  trendLabel?: string;
  trendTone?: TrendTone;
  accent?: Accent;
  href?: string;
  actionLabel?: string;
  isLoading?: boolean;
  insufficientLabel?: string;
}

const ACCENTS: Record<Accent, { icon: string; line: string }> = {
  brand: { icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300', line: 'bg-emerald-500' },
  blue: { icon: 'bg-sky-50 text-sky-600 dark:bg-sky-400/10 dark:text-sky-300', line: 'bg-sky-500' },
  amber: { icon: 'bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300', line: 'bg-amber-500' },
  red: { icon: 'bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300', line: 'bg-rose-500' },
  purple: { icon: 'bg-violet-50 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300', line: 'bg-violet-500' },
  slate: { icon: 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300', line: 'bg-slate-400' },
};

const getTrendClasses = (tone: TrendTone) => {
  if (tone === 'positive') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300';
  if (tone === 'negative') return 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300';
  return 'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300';
};

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  description,
  trend,
  trendLabel = 'vs. período anterior',
  trendTone,
  accent = 'brand',
  href,
  actionLabel = 'Ver detalhes',
  isLoading = false,
  insufficientLabel,
}) => {
  const colors = ACCENTS[accent];
  const resolvedTrendTone = trendTone ?? (trend !== undefined && trend < 0 ? 'negative' : 'positive');

  if (isLoading) {
    return (
      <div className="min-h-44 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm animate-pulse dark:border-white/5 dark:bg-[#1a1d27]" role="status" aria-label={`Carregando ${title}`}>
        <div className="h-3 w-24 rounded bg-gray-100 dark:bg-white/10" />
        <div className="mt-5 h-8 w-36 rounded bg-gray-100 dark:bg-white/10" />
        <div className="mt-5 h-4 w-28 rounded bg-gray-100 dark:bg-white/10" />
      </div>
    );
  }

  return (
    <article className="group relative min-h-44 overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-white/5 dark:bg-[#1a1d27]">
      <div className={`absolute inset-x-0 top-0 h-0.5 ${colors.line}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">{title}</h3>
            <span className="inline-flex cursor-help text-gray-300 hover:text-gray-500 dark:text-white/20 dark:hover:text-white/50" title={description} aria-label={`Definição: ${description}`}>
              <Info className="h-3.5 w-3.5" />
            </span>
          </div>
          {insufficientLabel ? (
            <p className="mt-3 text-sm font-semibold leading-snug text-gray-500 dark:text-gray-300">{insufficientLabel}</p>
          ) : (
            <p className="mt-2 truncate text-2xl font-bold tracking-tight text-gray-950 dark:text-white">{value}</p>
          )}
        </div>
        <div className={`shrink-0 rounded-xl p-2.5 ${colors.icon}`}>{icon}</div>
      </div>

      <div className="mt-4 min-h-6">
        {trend !== undefined ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-bold tabular-nums ${getTrendClasses(resolvedTrendTone)}`}>
              {trend >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {Math.abs(trend).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">{trendLabel}</span>
          </div>
        ) : (
          <p className="line-clamp-2 text-xs leading-relaxed text-gray-400 dark:text-gray-500">{description}</p>
        )}
      </div>

      {href && (
        <Link
          to={href}
          className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#0089b0] transition-colors hover:text-[#006e8d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a8d8] dark:text-[#53dcff]"
        >
          {actionLabel}
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </article>
  );
};
