import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { AlertCircle, CalendarClock, MapPin, UserRound } from 'lucide-react';
import { CSSProperties } from 'react';
import { ServiceDemand } from '@/types';
import { describeDue, getDueState } from '../demandsDomain';
import { PriorityBadge } from './DemandPrimitives';
import { dueTextClass } from './demandStyles';

const dueBorder = {
  overdue: 'border-red-300 dark:border-red-500/40',
  due_today: 'border-amber-300 dark:border-amber-500/40',
  upcoming: 'border-gray-100 dark:border-white/5',
  none: 'border-gray-100 dark:border-white/5',
  finished: 'border-gray-100 dark:border-white/5',
};

const DemandCardContent = ({ demand, today }: { demand: ServiceDemand; today?: string }) => {
  const dueState = getDueState(demand, today);
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-bold text-gray-400">#{demand.demandNumber}</span>
        <PriorityBadge priority={demand.priority} />
      </div>
      <h4 className="text-sm font-bold leading-snug text-gray-900 line-clamp-2 dark:text-white">{demand.title}</h4>
      {(demand.postName || demand.contractTitle) && (
        <p className="flex items-center gap-1 truncate text-xs text-gray-500 dark:text-gray-400"><MapPin className="h-3 w-3 shrink-0" />{demand.postName || demand.contractTitle}</p>
      )}
      <p className="flex items-center gap-1 truncate text-xs text-gray-500 dark:text-gray-400"><UserRound className="h-3 w-3 shrink-0" />{demand.responsibleName || 'Sem responsável'}</p>
      <div className={`flex items-center gap-1 border-t border-gray-100 pt-2 text-[11px] font-semibold dark:border-white/5 ${dueTextClass[dueState]}`}>
        {dueState === 'overdue' || dueState === 'due_today' ? <AlertCircle className="h-3 w-3" /> : <CalendarClock className="h-3 w-3" />}
        <span>{describeDue(demand, today)}</span>
      </div>
    </>
  );
};

export interface DemandCardProps {
  demand: ServiceDemand;
  today?: string;
  onOpen: () => void;
}

export const DemandCard = ({ demand, today, onOpen }: DemandCardProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: demand.id, disabled: demand.status !== 'open' });
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 };
  const dueState = getDueState(demand, today);
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="button"
      aria-label={`Demanda #${demand.demandNumber}: ${demand.title}`}
      data-due-state={dueState}
      onClick={onOpen}
      onKeyDown={(event) => { if (event.key === 'Enter') onOpen(); }}
      className={`space-y-2 rounded-xl border bg-white p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:bg-[#1a1d27] ${dueBorder[dueState]} ${demand.status === 'open' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer opacity-80'}`}
    >
      <DemandCardContent demand={demand} today={today} />
    </div>
  );
};

export const DemandCardOverlay = ({ demand, today }: { demand: ServiceDemand; today?: string }) => (
  <div className="w-[276px] rotate-2 cursor-grabbing space-y-2 rounded-xl border border-gray-100 bg-white p-3.5 shadow-2xl dark:border-white/5 dark:bg-[#1a1d27]">
    <DemandCardContent demand={demand} today={today} />
  </div>
);
