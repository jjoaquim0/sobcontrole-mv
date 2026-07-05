import React from 'react';
import { ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react';

export interface StatCardProps {
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  trend?: number;
  accentColor?: 'green' | 'blue' | 'yellow' | 'red' | 'purple';
}

const colorMap = {
  green: {
    gradient: 'from-emerald-500 to-green-600',
    light: 'bg-emerald-50 dark:bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    glow: 'shadow-emerald-500/20',
    ring: 'ring-emerald-500/20',
  },
  blue: {
    gradient: 'from-blue-500 to-indigo-600',
    light: 'bg-blue-50 dark:bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
    glow: 'shadow-blue-500/20',
    ring: 'ring-blue-500/20',
  },
  yellow: {
    gradient: 'from-amber-500 to-orange-600',
    light: 'bg-amber-50 dark:bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    glow: 'shadow-amber-500/20',
    ring: 'ring-amber-500/20',
  },
  red: {
    gradient: 'from-red-500 to-rose-600',
    light: 'bg-red-50 dark:bg-red-500/10',
    text: 'text-red-600 dark:text-red-400',
    glow: 'shadow-red-500/20',
    ring: 'ring-red-500/20',
  },
  purple: {
    gradient: 'from-purple-500 to-violet-600',
    light: 'bg-purple-50 dark:bg-purple-500/10',
    text: 'text-purple-600 dark:text-purple-400',
    glow: 'shadow-purple-500/20',
    ring: 'ring-purple-500/20',
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  trend,
  accentColor = 'green',
}) => {
  const theme = colorMap[accentColor] || colorMap.green;
  const isPositive = trend !== undefined && trend >= 0;

  return (
    <div
      className={`panel-glass group rounded-2xl p-5 transition-all duration-300 hover:shadow-xl ${theme.glow} hover:-translate-y-0.5`}
    >
      <div className="flex items-start justify-between relative z-10">
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
            {title}
          </span>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1.5 tracking-tight">
            {value}
          </div>

          {trend !== undefined && (
            <div className="flex items-center gap-1.5 mt-3">
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  isPositive
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                    : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                }`}
              >
                {isPositive ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {Math.abs(trend).toFixed(1)}%
              </span>
              <span className="text-[11px] text-gray-400 dark:text-gray-500">vs. mês anterior</span>
            </div>
          )}
        </div>

        <div className={`relative flex-shrink-0 p-3 rounded-xl ${theme.light} ${theme.text} transition-all duration-300 group-hover:scale-110 group-hover:rotate-3`}>
          {icon}
        </div>
      </div>
    </div>
  );
};
