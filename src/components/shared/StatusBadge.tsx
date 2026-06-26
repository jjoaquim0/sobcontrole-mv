import React from 'react';

export type BadgeStatus = 
  | 'pago' | 'paid' 
  | 'pendente' | 'pending' 
  | 'atrasado' | 'late' 
  | 'cancelado' | 'canceled' 
  | 'ativo' | 'active' 
  | 'inativo' | 'inactive';

export interface StatusBadgeProps {
  status: BadgeStatus;
}

const statusConfig: Record<BadgeStatus, { text: string; classes: string }> = {
  pago: {
    text: 'Pago',
    classes: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  paid: {
    text: 'Pago',
    classes: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  pendente: {
    text: 'Pendente',
    classes: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400',
  },
  pending: {
    text: 'Pendente',
    classes: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400',
  },
  atrasado: {
    text: 'Atrasado',
    classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  late: {
    text: 'Atrasado',
    classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  cancelado: {
    text: 'Cancelado',
    classes: 'bg-orange-100 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400',
  },
  canceled: {
    text: 'Cancelado',
    classes: 'bg-orange-100 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400',
  },
  ativo: {
    text: 'Ativo',
    classes: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  active: {
    text: 'Ativo',
    classes: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  inativo: {
    text: 'Inativo',
    classes: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400',
  },
  inactive: {
    text: 'Inativo',
    classes: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const normStatus = status.toLowerCase() as BadgeStatus;
  const config = statusConfig[normStatus] || {
    text: status,
    classes: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide ${config.classes}`}
    >
      {config.text}
    </span>
  );
};
