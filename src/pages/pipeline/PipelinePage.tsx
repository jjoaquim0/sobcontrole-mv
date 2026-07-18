import React, { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatCard } from '../../components/shared/StatCard';
import { ConfirmModal } from '../../components/shared/ConfirmModal';
import { PipelineColumn } from './components/PipelineColumn';
import { DealCardOverlay } from './components/DealCard';
import { DealModal, DealSavePayload } from './components/DealModal';
import { usePipelineStages, useDeals, useDealMutations } from '../../hooks/usePipeline';
import { useSettings } from '../../hooks/useSettings';
import { isDealOverdue } from '../../services/dealsService';
import { Deal } from '../../types';
import { Handshake, DollarSign, TrendingUp, AlertCircle, Search, X, Plus, Loader2 } from 'lucide-react';

export const PipelinePage: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');

  const [isDealModalOpen, setIsDealModalOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | undefined>(undefined);
  const [createStageId, setCreateStageId] = useState<string | undefined>(undefined);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Deal | undefined>(undefined);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const filters = {
    search: debouncedSearch,
    ownerId: ownerFilter || undefined,
    stageId: stageFilter || undefined,
  };

  const { stages, isLoading: isStagesLoading } = usePipelineStages();
  const { deals, isLoading: isDealsLoading, isError, refetch } = useDeals(filters);
  const { teamMembers } = useSettings();
  const { createDeal, isCreating, updateDeal, isUpdating, moveDeal, closeDeal, isClosing, deleteDeal, isDeleting } = useDealMutations(filters);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const dealsByStage = useMemo(() => {
    const map: Record<string, Deal[]> = {};
    stages.forEach((s) => {
      map[s.id] = deals.filter((d) => d.stageId === s.id).sort((a, b) => a.position - b.position);
    });
    return map;
  }, [stages, deals]);

  const summary = useMemo(() => {
    const totalValue = deals.reduce((sum, d) => sum + d.value, 0);
    const overdueCount = deals.filter(isDealOverdue).length;
    return {
      total: deals.length,
      totalValue,
      averageValue: deals.length > 0 ? totalValue / deals.length : 0,
      overdueCount,
    };
  }, [deals]);

  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleOpenCreate = (stageId?: string) => {
    setSelectedDeal(undefined);
    setCreateStageId(stageId);
    setIsDealModalOpen(true);
  };

  const handleCardClick = (deal: Deal) => {
    setSelectedDeal(deal);
    setCreateStageId(undefined);
    setIsDealModalOpen(true);
  };

  const handleSaveDeal = async (data: DealSavePayload) => {
    if (selectedDeal) {
      const { stageId, ...updateFields } = data;
      await updateDeal({ id: selectedDeal.id, data: updateFields });

      // O <select> de Etapa já usa o stageId real, mas updateDeal() nunca
      // gravou stage_id (ver Dev Notes da story 1.9) - por isso a troca de
      // etapa é feita por uma chamada separada a moveDeal, que reaproveita
      // 100% da lógica já existente de posição/histórico/rollback do
      // drag-and-drop, em vez de duplicá-la aqui.
      if (stageId !== selectedDeal.stageId) {
        const targetStageDeals = dealsByStage[stageId] || [];
        const maxPosition = targetStageDeals.reduce((max, d) => Math.max(max, d.position), -1);
        await moveDeal({ id: selectedDeal.id, toStageId: stageId, position: maxPosition + 1 });
      }
    } else {
      await createDeal(data);
    }
  };

  const handleMarkWon = async () => {
    if (!selectedDeal) return;
    await closeDeal({ id: selectedDeal.id, status: 'won' });
  };

  const handleMarkLost = async (reason?: string) => {
    if (!selectedDeal) return;
    await closeDeal({ id: selectedDeal.id, status: 'lost', lostReason: reason });
  };

  const handleRequestDelete = () => {
    if (!selectedDeal) return;
    setDeleteTarget(selectedDeal);
    setIsDealModalOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDeal(deleteTarget.id);
      setDeleteTarget(undefined);
    } catch {
      // Erro já é comunicado via toast pela mutation (usePipeline.deleteDeal);
      // deleteTarget permanece definido para manter o diálogo aberto e
      // permitir nova tentativa, sem deixar a rejeição sem tratamento.
    }
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setOwnerFilter('');
    setStageFilter('');
  };

  const isFiltered = searchInput !== '' || ownerFilter !== '' || stageFilter !== '';

  const handleDragStart = (event: DragStartEvent) => {
    const deal = deals.find((d) => d.id === event.active.id);
    setActiveDeal(deal || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDeal(null);
    if (!over) return;

    const draggedDeal = deals.find((d) => d.id === active.id);
    if (!draggedDeal) return;

    const overDeal = deals.find((d) => d.id === over.id);
    const toStageId = overDeal ? overDeal.stageId : stages.some((s) => s.id === over.id) ? (over.id as string) : draggedDeal.stageId;

    const columnDeals = dealsByStage[toStageId]?.filter((d) => d.id !== draggedDeal.id) || [];

    let targetIndex = columnDeals.length;
    if (overDeal && overDeal.id !== draggedDeal.id) {
      const idx = columnDeals.findIndex((d) => d.id === overDeal.id);
      if (idx !== -1) targetIndex = idx;
    }

    const before = columnDeals[targetIndex - 1];
    const after = columnDeals[targetIndex];

    let newPosition: number;
    if (before && after) newPosition = (before.position + after.position) / 2;
    else if (after) newPosition = after.position - 1;
    else if (before) newPosition = before.position + 1;
    else newPosition = 0;

    if (toStageId === draggedDeal.stageId && newPosition === draggedDeal.position) return;

    moveDeal({ id: draggedDeal.id, toStageId, position: newPosition });
  };

  return (
    <div className="flex flex-col h-full space-y-5 animate-fade-in">
      <PageHeader
        title="Pipeline de Vendas"
        subtitle={`${summary.total} oportunidades ativas no funil`}
        action={
          <button
            onClick={() => handleOpenCreate()}
            className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 shadow-md shadow-emerald-500/10"
          >
            <Plus className="w-4.5 h-4.5" />
            Novo Negócio
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 shrink-0">
        <StatCard
          title="Oportunidades"
          value={summary.total}
          icon={<Handshake className="w-5 h-5" />}
          accentColor="blue"
        />
        <StatCard
          title="Valor em Pipeline"
          value={formatMoney(summary.totalValue)}
          icon={<DollarSign className="w-5 h-5" />}
          accentColor="green"
        />
        <StatCard
          title="Ticket Médio"
          value={formatMoney(summary.averageValue)}
          icon={<TrendingUp className="w-5 h-5" />}
          accentColor="purple"
        />
        <StatCard
          title="Atrasadas"
          value={summary.overdueCount}
          icon={<AlertCircle className="w-5 h-5" />}
          accentColor="red"
        />
      </div>

      <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors duration-300 shrink-0">
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
            <Search className="w-4.5 h-4.5" />
          </span>
          <input
            type="text"
            placeholder="Pesquisar por negócio ou cliente..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="px-4 py-2.5 pr-8 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#1a1d27] text-xs font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] appearance-none cursor-pointer"
          >
            <option value="">Todos os Responsáveis</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>

          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-4 py-2.5 pr-8 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#1a1d27] text-xs font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] appearance-none cursor-pointer"
          >
            <option value="">Todas as Etapas</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {isFiltered && (
            <button
              onClick={handleClearFilters}
              className="text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white flex items-center gap-1 py-2 px-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all duration-200"
            >
              <X className="w-3.5 h-3.5" />
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {isError ? (
        <div className="flex flex-col items-center justify-center bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-10 shadow-sm transition-colors duration-300 text-center animate-fade-in">
          <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-full text-red-500 mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-lg mb-1">
            Não foi possível carregar o pipeline
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-6">
            Ocorreu um problema ao conectar com o banco de dados. Verifique sua conexão e tente novamente.
          </p>
          <button
            onClick={() => refetch()}
            className="bg-red-500 hover:bg-red-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium transition-colors duration-200 shadow-md shadow-red-500/10 active:scale-95"
          >
            Tentar novamente
          </button>
        </div>
      ) : isStagesLoading || isDealsLoading ? (
        <div className="flex-1 flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-[#10b981] animate-spin" />
        </div>
      ) : stages.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-10 shadow-sm text-center">
          <Handshake className="w-12 h-12 text-[#10b981] mb-3" />
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-lg mb-1">Nenhuma etapa de pipeline configurada</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
            Sua empresa ainda não possui etapas de funil cadastradas. Entre em contato com o suporte para configurá-las.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 flex gap-4 overflow-x-auto pb-2 min-h-0">
            {stages.map((stage) => (
              <PipelineColumn
                key={stage.id}
                stage={stage}
                deals={dealsByStage[stage.id] || []}
                onCardClick={handleCardClick}
                onAddDeal={handleOpenCreate}
              />
            ))}
          </div>

          <DragOverlay>
            {activeDeal ? <DealCardOverlay deal={activeDeal} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <DealModal
        isOpen={isDealModalOpen}
        onClose={() => setIsDealModalOpen(false)}
        deal={selectedDeal}
        defaultStageId={createStageId}
        stages={stages}
        onSave={handleSaveDeal}
        isSaving={isCreating || isUpdating}
        onMarkWon={handleMarkWon}
        onMarkLost={handleMarkLost}
        isClosing={isClosing}
        onDelete={selectedDeal ? handleRequestDelete : undefined}
        isDeleting={isDeleting}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Excluir oportunidade"
        message={`Tem certeza que deseja excluir "${deleteTarget?.title}"? Esta ação removerá definitivamente esta oportunidade do pipeline e não pode ser desfeita.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(undefined)}
        isLoading={isDeleting}
        confirmText="Excluir oportunidade"
        variant="danger"
      />
    </div>
  );
};
