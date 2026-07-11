import React from 'react';
import { Lock, CheckCircle2, Clock, ShieldCheck } from 'lucide-react';
import { AnalyticsModuleAccessStatus } from '../../../types';

export interface BiModuleStatusBadgeProps {
  status: AnalyticsModuleAccessStatus;
}

const STATUS_CONFIG: Record<AnalyticsModuleAccessStatus, { text: string; classes: string; icon: React.ReactNode }> = {
  available: {
    text: 'Disponível',
    classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  contracted: {
    text: 'Contratado',
    classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: <ShieldCheck className="w-3.5 h-3.5" />,
  },
  coming_soon: {
    text: 'Em breve',
    classes: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  locked: {
    text: 'Bloqueado',
    classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    icon: <Lock className="w-3.5 h-3.5" />,
  },
};

export const BiModuleStatusBadge: React.FC<BiModuleStatusBadgeProps> = ({ status }) => {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide ${config.classes}`}>
      {config.icon}
      {config.text}
    </span>
  );
};
