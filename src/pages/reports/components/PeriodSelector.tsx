import React from 'react';
import { ReportPeriod } from '../../../types';
import { CalendarDays } from 'lucide-react';

interface PeriodSelectorProps {
  period: ReportPeriod;
  onChange: (period: ReportPeriod) => void;
}

const OPTIONS: { type: ReportPeriod['type']; label: string }[] = [
  { type: '7d', label: '7 dias' },
  { type: '30d', label: '30 dias' },
  { type: '90d', label: '90 dias' },
  { type: '12m', label: '12 meses' },
  { type: 'custom', label: 'Personalizado' },
];

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({ period, onChange }) => {
  return (
    <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center gap-4 transition-colors duration-300">
      <div className="flex flex-wrap items-center gap-2">
        {OPTIONS.map((opt) => {
          const isActive = period.type === opt.type;
          return (
            <button
              key={opt.type}
              type="button"
              onClick={() => onChange({ type: opt.type, dateFrom: period.dateFrom, dateTo: period.dateTo })}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors duration-200 ${
                isActive
                  ? 'bg-[#10b981] text-white'
                  : 'bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {period.type === 'custom' && (
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-1 text-xs">
          <span className="text-gray-400 flex items-center gap-1 px-1 font-semibold">
            <CalendarDays className="w-3.5 h-3.5" /> Período:
          </span>
          <input
            type="date"
            value={period.dateFrom ? period.dateFrom.slice(0, 10) : ''}
            onChange={(e) => onChange({ ...period, dateFrom: new Date(e.target.value).toISOString() })}
            className="bg-transparent text-gray-700 dark:text-gray-300 outline-none p-1 font-semibold cursor-pointer dark:[color-scheme:dark]"
          />
          <span className="text-gray-300 dark:text-white/10 px-0.5">/</span>
          <input
            type="date"
            value={period.dateTo ? period.dateTo.slice(0, 10) : ''}
            onChange={(e) => onChange({ ...period, dateTo: new Date(e.target.value).toISOString() })}
            className="bg-transparent text-gray-700 dark:text-gray-300 outline-none p-1 font-semibold cursor-pointer dark:[color-scheme:dark]"
          />
        </div>
      )}
    </div>
  );
};
