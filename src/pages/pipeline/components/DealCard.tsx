import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarClock, AlertCircle } from 'lucide-react';
import { Deal } from '../../../types';
import { isDealOverdue } from '../../../services/dealsService';

export interface DealCardProps {
  deal: Deal;
  onClick: () => void;
}

const formatMoney = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const getInitials = (name?: string) => {
  if (!name) return '??';
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

const DealCardContent: React.FC<{ deal: Deal }> = ({ deal }) => {
  const isOverdue = isDealOverdue(deal);

  return (
    <>
      <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-snug line-clamp-2">
        {deal.title}
      </h4>

      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate">
        {deal.customer?.fullName || 'Cliente não informado'}
      </p>

      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-[#10b981]">
          {formatMoney(deal.value)}
        </span>
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0 border border-black/5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
          title={deal.ownerName}
        >
          {getInitials(deal.ownerName)}
        </div>
      </div>

      {deal.expectedCloseDate && (
        <div
          className={`flex items-center gap-1 text-[10px] font-semibold pt-2 border-t border-gray-100 dark:border-white/5 ${
            isOverdue ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'
          }`}
        >
          {isOverdue ? <AlertCircle className="w-3 h-3" /> : <CalendarClock className="w-3 h-3" />}
          <span>
            {isOverdue ? 'Atrasado — ' : 'Previsão: '}
            {new Date(deal.expectedCloseDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
          </span>
        </div>
      )}
    </>
  );
};

export const DealCard: React.FC<DealCardProps> = ({ deal, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-xl p-3.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-grab active:cursor-grabbing space-y-2.5"
    >
      <DealCardContent deal={deal} />
    </div>
  );
};

export const DealCardOverlay: React.FC<{ deal: Deal }> = ({ deal }) => (
  <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-xl p-3.5 shadow-2xl cursor-grabbing space-y-2.5 rotate-2 w-[276px]">
    <DealCardContent deal={deal} />
  </div>
);
