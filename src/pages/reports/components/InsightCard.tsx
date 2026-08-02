import React from 'react';
import { AlertTriangle, ArrowRight, Info, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export type InsightPriority = 'critical' | 'high' | 'medium' | 'info';

export interface InsightCardProps {
  priority: InsightPriority;
  title: string;
  description: string;
  periodLabel: string;
  href: string;
  actionLabel: string;
}

const PRIORITY_CONFIG: Record<InsightPriority, { label: string; classes: string; icon: React.ReactNode }> = {
  critical: { label: 'Crítica', classes: 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300', icon: <AlertTriangle className="h-4 w-4" /> },
  high: { label: 'Alta', classes: 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300', icon: <AlertTriangle className="h-4 w-4" /> },
  medium: { label: 'Média', classes: 'bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300', icon: <Sparkles className="h-4 w-4" /> },
  info: { label: 'Informativa', classes: 'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300', icon: <Info className="h-4 w-4" /> },
};

export const InsightCard: React.FC<InsightCardProps> = ({
  priority,
  title,
  description,
  periodLabel,
  href,
  actionLabel,
}) => {
  const config = PRIORITY_CONFIG[priority];
  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/5 dark:bg-[#1a1d27]">
      <div className="flex items-start gap-3">
        <div className={`rounded-xl p-2 ${config.classes}`}>{config.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-gray-950 dark:text-white">{title}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${config.classes}`}>{config.label}</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-gray-400">{periodLabel}</span>
            <Link
              to={href}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0089b0] hover:text-[#006e8d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a8d8] dark:text-[#53dcff]"
            >
              {actionLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
};
