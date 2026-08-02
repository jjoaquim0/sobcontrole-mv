import React from 'react';
import { CalendarDays, GitCompareArrows } from 'lucide-react';
import { ReportPeriod } from '../../../types';
import { REPORT_PERIOD_OPTIONS } from '../reportPeriod';

interface ReportFilterBarProps {
  period: ReportPeriod;
  onChange: (period: ReportPeriod) => void;
  appliedLabel: string;
  compareEnabled?: boolean;
}

export const ReportFilterBar: React.FC<ReportFilterBarProps> = ({
  period,
  onChange,
  appliedLabel,
  compareEnabled = true,
}) => (
  <div className="sticky top-0 z-10 rounded-2xl border border-gray-100 bg-white/95 p-3 shadow-sm backdrop-blur dark:border-white/5 dark:bg-[#1a1d27]/95">
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex items-center gap-2 overflow-x-auto pb-1 xl:pb-0" aria-label="Filtro global de período">
        {REPORT_PERIOD_OPTIONS.map((option) => {
          const active = period.type === option.type;
          return (
            <button
              key={option.type}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ type: option.type, dateFrom: period.dateFrom, dateTo: period.dateTo })}
              className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a8d8] ${
                active
                  ? 'bg-[#0B2551] text-white shadow-sm dark:bg-[#00a8d8]'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10'
              }`}
            >
              {option.shortLabel}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {period.type === 'custom' && (
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-2 py-1.5 dark:border-white/10 dark:bg-white/5">
            <input
              type="date"
              aria-label="Data inicial"
              value={period.dateFrom?.slice(0, 10) ?? ''}
              onChange={(event) => onChange({ ...period, dateFrom: event.target.value })}
              className="min-w-0 bg-transparent text-xs font-semibold text-gray-700 outline-none dark:text-gray-200 dark:[color-scheme:dark]"
            />
            <span className="text-xs text-gray-400">até</span>
            <input
              type="date"
              aria-label="Data final"
              value={period.dateTo?.slice(0, 10) ?? ''}
              onChange={(event) => onChange({ ...period, dateTo: event.target.value })}
              className="min-w-0 bg-transparent text-xs font-semibold text-gray-700 outline-none dark:text-gray-200 dark:[color-scheme:dark]"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-2 dark:bg-white/5">
            <CalendarDays className="h-3.5 w-3.5" />
            {appliedLabel}
          </span>
          {compareEnabled && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-2.5 py-2 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300">
              <GitCompareArrows className="h-3.5 w-3.5" />
              Comparado ao período anterior
            </span>
          )}
        </div>
      </div>
    </div>
  </div>
);
