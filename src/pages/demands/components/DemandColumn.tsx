import { useDroppable } from '@dnd-kit/core';
import { Inbox, Plus } from 'lucide-react';
import { DemandStage, ServiceDemand } from '@/types';
import { getDueState, STAGE_CATEGORY_LABELS } from '../demandsDomain';
import { DemandCard } from './DemandCard';

const categoryColor: Record<DemandStage['category'], string> = {
  intake: '#64748b',
  triage: '#0ea5e9',
  execution: '#6366f1',
  review: '#f59e0b',
  done: '#10b981',
};

export interface DemandColumnProps {
  stage: DemandStage;
  demands: ServiceDemand[];
  today?: string;
  onOpen: (demand: ServiceDemand) => void;
  onAdd?: () => void;
}

export const DemandColumn = ({ stage, demands, today, onOpen, onAdd }: DemandColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const overdue = demands.filter((demand) => getDueState(demand, today) === 'overdue').length;
  return (
    <section aria-label={`Etapa ${stage.name}`} className="flex max-h-full w-[300px] shrink-0 flex-col rounded-2xl border border-gray-100 bg-gray-50/60 dark:border-white/5 dark:bg-white/[0.02]">
      <div className="shrink-0 border-b border-gray-100 p-3.5 dark:border-white/5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: categoryColor[stage.category] }} />
            <h3 className="truncate text-sm font-bold text-gray-900 dark:text-white">{stage.name}</h3>
          </div>
          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-500 dark:bg-white/5 dark:text-gray-400">{demands.length}</span>
          {onAdd && <button type="button" onClick={onAdd} className="shrink-0 rounded-lg p-1 text-gray-400 transition-colors hover:bg-cyan-500/10 hover:text-cyan-700" title="Nova demanda" aria-label="Nova demanda"><Plus className="h-4 w-4" /></button>}
        </div>
        <p className="mt-1 text-xs font-semibold text-gray-400 dark:text-gray-500">
          {STAGE_CATEGORY_LABELS[stage.category]}{overdue ? <span className="text-red-600 dark:text-red-400"> · {overdue} atrasada(s)</span> : null}
        </p>
      </div>
      <div ref={setNodeRef} className={`min-h-[120px] flex-1 space-y-2.5 overflow-y-auto rounded-b-2xl p-2.5 transition-colors duration-150 ${isOver ? 'bg-cyan-500/5' : ''}`}>
        {demands.map((demand) => <DemandCard key={demand.id} demand={demand} today={today} onOpen={() => onOpen(demand)} />)}
        {demands.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center text-gray-300 dark:text-white/10">
            <Inbox className="mb-1.5 h-7 w-7" />
            <span className="text-[11px] font-semibold text-gray-400 dark:text-white/20">Nenhuma demanda</span>
          </div>
        )}
      </div>
    </section>
  );
};
