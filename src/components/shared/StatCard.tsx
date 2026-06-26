import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export interface StatCardProps {
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  trend?: number; // Valor percentual (ex: 12.5 ou -3.2)
  accentColor?: 'green' | 'blue' | 'yellow' | 'red';
}

const colorMap = {
  green: {
    border: 'border-t-[#10b981]',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  blue: {
    border: 'border-t-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-600 dark:text-blue-400',
  },
  yellow: {
    border: 'border-t-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-600 dark:text-amber-400',
  },
  red: {
    border: 'border-t-red-500',
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-600 dark:text-red-400',
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  trend,
  accentColor = 'green',
}) => {
  const themeClasses = colorMap[accentColor] || colorMap.green;
  const isPositive = trend !== undefined && trend >= 0;

  return (
    <div
      className={`bg-white dark:bg-[#1a1d27] rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 p-5 border-t-[3px] ${themeClasses.border} transition-all duration-300 hover:shadow-md`}
    >
      <div className="flex justify-between items-start">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            {title}
          </span>
          <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {value}
          </h3>
        </div>
        <div className={`p-3 rounded-full ${themeClasses.bg} ${themeClasses.text}`}>
          {icon}
        </div>
      </div>

      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-4">
          <span
            className={`flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${
              isPositive
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
            }`}
          >
            {isPositive ? (
              <ArrowUpRight className="w-3.5 h-3.5" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5" />
            )}
            {Math.abs(trend).toFixed(1)}%
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            vs. mês anterior
          </span>
        </div>
      )}
    </div>
  );
};
