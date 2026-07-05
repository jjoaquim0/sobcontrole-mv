import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Inbox, Plus } from 'lucide-react';
import { Deal, PipelineStage } from '../../../types';
import { DealCard } from './DealCard';

export interface PipelineColumnProps {
  stage: PipelineStage;
  deals: Deal[];
  onCardClick: (deal: Deal) => void;
  onAddDeal: (stageId: string) => void;
}

const formatMoney = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: value >= 100000 ? 'compact' : 'standard',
  }).format(value);
};

export const PipelineColumn: React.FC<PipelineColumnProps> = ({ stage, deals, onCardClick, onAddDeal }) => {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  const totalValue = deals.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="w-[300px] shrink-0 flex flex-col bg-gray-50/60 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-2xl max-h-full">
      <div className="p-3.5 border-b border-gray-100 dark:border-white/5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{stage.name}</h3>
          </div>
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/5 rounded-full px-2 py-0.5 shrink-0">
            {deals.length}
          </span>
          <button
            type="button"
            onClick={() => onAddDeal(stage.id)}
            className="p-1 rounded-lg text-gray-400 hover:text-[#10b981] hover:bg-emerald-500/10 transition-colors shrink-0"
            title="Novo negócio nesta etapa"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 font-semibold mt-1">
          {formatMoney(totalValue)}
        </p>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto p-2.5 space-y-2.5 min-h-[120px] transition-colors duration-150 rounded-b-2xl ${
          isOver ? 'bg-emerald-500/5' : ''
        }`}
      >
        <SortableContext items={deals.map(d => d.id)} strategy={verticalListSortingStrategy}>
          {deals.map(deal => (
            <DealCard key={deal.id} deal={deal} onClick={() => onCardClick(deal)} />
          ))}
        </SortableContext>

        {deals.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-8 text-gray-300 dark:text-white/10">
            <Inbox className="w-7 h-7 mb-1.5" />
            <span className="text-[11px] font-semibold text-gray-400 dark:text-white/20">Nenhum negócio</span>
          </div>
        )}
      </div>
    </div>
  );
};
