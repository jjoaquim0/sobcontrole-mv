import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { toast } from 'sonner';
import { AlertCircle, CalendarClock, ClipboardCheck, Inbox, Loader2, Plus, Search, Settings2, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useDemandLinkOptions, useDemands, useDemandTypes } from '@/hooks/useDemands';
import { useAuthStore } from '@/store/authStore';
import { DemandStage, ServiceDemand } from '@/types';
import { activeStages, checkTransition, getDueState, REPLACEMENT_TYPE_NAME, sortDemandsForBoard, todayIso } from './demandsDomain';
import { DemandCardOverlay } from './components/DemandCard';
import { DemandColumn } from './components/DemandColumn';
import { ReasonModal } from './components/DemandFormModals';
import { DemandModal, DemandModalDefaults } from './components/DemandModal';
import { cardClass, inputClass, primaryButtonClass, secondaryButtonClass } from '@/pages/contracts/components/ContractPrimitives';
import { TypeSettingsModal } from './components/TypeSettingsModal';

export const DemandsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const profileId = useAuthStore((state) => state.profile?.id);
  const today = todayIso();

  const [selectedTypeId, setSelectedTypeId] = useState(searchParams.get('tipo') || '');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [responsibleId, setResponsibleId] = useState('');
  const [includeFinished, setIncludeFinished] = useState(false);
  const [createState, setCreateState] = useState<{ open: boolean; defaults?: DemandModalDefaults }>({ open: false });
  const [settingsState, setSettingsState] = useState<{ open: boolean; typeId?: string }>({ open: false });
  const [pendingBack, setPendingBack] = useState<{ demand: ServiceDemand; stage: DemandStage }>();
  const [activeDemand, setActiveDemand] = useState<ServiceDemand | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const { types, isLoading: isLoadingTypes, isError: isTypesError, refetch: refetchTypes, ensureDefaults, isEnsuringDefaults, saveType, isSavingType, saveStage, isSavingStage } = useDemandTypes();
  const { options } = useDemandLinkOptions();
  const activeTypes = types.filter((type) => type.isActive);
  const selectedType = types.find((type) => type.id === selectedTypeId) || activeTypes[0] || types[0];

  const { demands, isLoading, isError, refetch, createDemand, isCreating, moveDemand, isMoving } = useDemands({
    typeId: selectedType?.id,
    search,
    responsibleId: responsibleId || undefined,
    includeFinished,
  });

  // Atalho vindo do contrato: /demandas?nova=reposicao&posto=<id>
  useEffect(() => {
    if (searchParams.get('nova') !== 'reposicao' || isLoadingTypes || !options) return;
    const candidates = types.filter((type) => type.isActive);
    const replacement = candidates.find((type) => type.name.toLocaleLowerCase('pt-BR') === REPLACEMENT_TYPE_NAME.toLocaleLowerCase('pt-BR')) || candidates[0];
    const post = options.posts.find((item) => item.id === searchParams.get('posto'));
    if (replacement) {
      setSelectedTypeId(replacement.id);
      setCreateState({
        open: true,
        defaults: {
          typeId: replacement.id,
          postId: post?.id,
          contractId: post?.contractId || searchParams.get('contrato') || undefined,
          title: post ? `Reposição — ${post.name}` : undefined,
        },
      });
    } else {
      toast.error('Crie os tipos de demanda antes de abrir uma reposição.');
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, isLoadingTypes, options, types]);

  const stages = useMemo(() => (selectedType ? activeStages(selectedType.stages) : []), [selectedType]);
  const boardDemands = useMemo(
    () => demands.filter((demand) => demand.typeId === selectedType?.id && (includeFinished || demand.status !== 'canceled')),
    [demands, selectedType, includeFinished],
  );
  const demandsByStage = useMemo(() => {
    const map = new Map<string, ServiceDemand[]>();
    stages.forEach((stage) => map.set(stage.id, sortDemandsForBoard(boardDemands.filter((demand) => demand.stageId === stage.id), today)));
    return map;
  }, [stages, boardDemands, today]);

  const open = boardDemands.filter((demand) => demand.status === 'open');
  const reviewIds = new Set(stages.filter((stage) => stage.category === 'review').map((stage) => stage.id));
  const summaryCards = [
    { label: 'Demandas abertas', value: open.length, icon: Inbox, tone: 'text-cyan-700 dark:text-cyan-300' },
    { label: 'Atrasadas', value: open.filter((demand) => getDueState(demand, today) === 'overdue').length, icon: AlertCircle, tone: 'text-red-600 dark:text-red-400' },
    { label: 'Vencem hoje', value: open.filter((demand) => getDueState(demand, today) === 'due_today').length, icon: CalendarClock, tone: 'text-amber-600 dark:text-amber-300' },
    { label: 'Em conferência', value: open.filter((demand) => reviewIds.has(demand.stageId)).length, icon: ClipboardCheck, tone: 'text-indigo-600 dark:text-indigo-300' },
  ];

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor));

  const handleDragStart = (event: DragStartEvent) => setActiveDemand(boardDemands.find((demand) => demand.id === event.active.id) || null);

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDemand(null);
    const demand = boardDemands.find((item) => item.id === event.active.id);
    const stage = stages.find((item) => item.id === event.over?.id);
    if (!demand || !stage || !selectedType || demand.stageId === stage.id) return;
    const check = checkTransition(demand, selectedType.stages, stage.id, profileId);
    if (!check.allowed) {
      toast.error(check.reason);
      return;
    }
    if (check.requiresNote) {
      setPendingBack({ demand, stage });
      return;
    }
    moveDemand({ id: demand.id, toStageId: stage.id }).catch(() => undefined);
  };

  const people = options?.people || [];

  return (
    <div className="flex h-full flex-col space-y-5 animate-fade-in">
      <PageHeader
        title="Demandas"
        subtitle="Reposições, ausências e ocorrências do contrato, da abertura ao encerramento."
        action={
          <div className="flex items-center gap-2">
            {selectedType && <button type="button" onClick={() => setSettingsState({ open: true, typeId: selectedType.id })} className={secondaryButtonClass}><Settings2 className="h-4 w-4" />Etapas</button>}
            <button type="button" disabled={activeTypes.length === 0} onClick={() => setCreateState({ open: true, defaults: { typeId: selectedType?.isActive ? selectedType.id : undefined } })} className={primaryButtonClass}><Plus className="h-4 w-4" />Nova demanda</button>
          </div>
        }
      />

      {isTypesError ? (
        <div role="alert" className={`${cardClass} text-center`}>
          <p className="font-semibold text-gray-900 dark:text-white">Não foi possível carregar os tipos de demanda.</p>
          <button type="button" onClick={() => refetchTypes()} className={`${secondaryButtonClass} mt-4`}>Tentar novamente</button>
        </div>
      ) : isLoadingTypes ? (
        <div className="flex flex-1 items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-cyan-700" /></div>
      ) : types.length === 0 ? (
        <div className={`${cardClass} flex flex-col items-center py-12 text-center`}>
          <Sparkles className="mb-3 h-10 w-10 text-cyan-700" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Nenhum tipo de demanda cadastrado</h2>
          <p className="mt-1 max-w-md text-sm text-gray-500">Comece com os tipos dos fluxos prioritários do piloto, reposição de posto e ausência/ocorrência, ou crie um tipo próprio.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" disabled={isEnsuringDefaults} onClick={() => ensureDefaults().catch(() => undefined)} className={primaryButtonClass}>{isEnsuringDefaults && <Loader2 className="h-4 w-4 animate-spin" />}Criar tipos padrão</button>
            <button type="button" onClick={() => setSettingsState({ open: true })} className={secondaryButtonClass}>Novo tipo</button>
          </div>
        </div>
      ) : (
        <>
          <nav aria-label="Tipos de demanda" className="flex shrink-0 flex-wrap items-center gap-2">
            {types.map((type) => (
              <button key={type.id} type="button" onClick={() => setSelectedTypeId(type.id)} aria-current={selectedType?.id === type.id ? 'page' : undefined} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${selectedType?.id === type.id ? 'bg-cyan-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-white/5 dark:text-gray-300'} ${type.isActive ? '' : 'opacity-60'}`}>{type.name}</button>
            ))}
            <button type="button" onClick={() => setSettingsState({ open: true })} className="rounded-full border border-dashed border-gray-300 px-4 py-2 text-sm font-semibold text-gray-500 hover:text-cyan-700 dark:border-white/10"><Plus className="mr-1 inline h-3.5 w-3.5" />Tipo</button>
          </nav>

          {!isError && (
            <section aria-label="Resumo das demandas" className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
              {summaryCards.map((card) => (
                <div key={card.label} className={`${cardClass} !p-4`}>
                  <card.icon className={`h-5 w-5 ${card.tone}`} />
                  <p className={`mt-2 text-2xl font-bold ${card.tone}`}>{isLoading ? '—' : card.value}</p>
                  <p className="text-xs text-gray-500">{card.label}</p>
                </div>
              ))}
            </section>
          )}

          <section aria-label="Filtros de demandas" className={`${cardClass} shrink-0 !p-4`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <label className="relative flex-1">
                <span className="sr-only">Pesquisar demandas</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Número, título, posto, funcionário ou responsável" className={`${inputClass} pl-9`} />
              </label>
              <select aria-label="Filtrar por responsável" value={responsibleId} onChange={(event) => setResponsibleId(event.target.value)} className={`${inputClass} md:w-56`}>
                <option value="">Todos os responsáveis</option>
                {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
              <label className="flex items-center gap-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300"><input type="checkbox" checked={includeFinished} onChange={(event) => setIncludeFinished(event.target.checked)} />Mostrar encerradas e canceladas antigas</label>
            </div>
          </section>

          {isError ? (
            <div role="alert" className={`${cardClass} text-center`}>
              <p className="font-semibold text-gray-900 dark:text-white">Não foi possível carregar as demandas.</p>
              <button type="button" onClick={() => refetch()} className={`${secondaryButtonClass} mt-4`}>Tentar novamente</button>
            </div>
          ) : isLoading ? (
            <div className="flex flex-1 items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-cyan-700" /></div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDemand(null)}>
              <div className={`flex min-h-0 flex-1 gap-4 overflow-x-auto pb-2 ${isMoving ? 'pointer-events-none opacity-70' : ''}`}>
                {stages.map((stage) => (
                  <DemandColumn
                    key={stage.id}
                    stage={stage}
                    demands={demandsByStage.get(stage.id) || []}
                    today={today}
                    onOpen={(demand) => navigate(`/demandas/${demand.id}`)}
                    onAdd={stage.category === 'intake' && selectedType?.isActive ? () => setCreateState({ open: true, defaults: { typeId: selectedType.id } }) : undefined}
                  />
                ))}
              </div>
              <DragOverlay>{activeDemand ? <DemandCardOverlay demand={activeDemand} today={today} /> : null}</DragOverlay>
            </DndContext>
          )}
        </>
      )}

      <DemandModal
        isOpen={createState.open && Boolean(options)}
        types={types}
        options={options}
        defaults={createState.defaults}
        isLoading={isCreating}
        onClose={() => setCreateState({ open: false })}
        onSave={async (input) => { await createDemand(input); setSelectedTypeId(input.typeId); setCreateState({ open: false }); }}
      />

      <TypeSettingsModal
        isOpen={settingsState.open}
        type={types.find((type) => type.id === settingsState.typeId)}
        isSavingType={isSavingType}
        isSavingStage={isSavingStage}
        onClose={() => setSettingsState({ open: false })}
        onSaveType={async (input) => {
          const id = await saveType({ input, id: settingsState.typeId });
          if (settingsState.typeId) setSettingsState({ open: false });
          else { setSelectedTypeId(id); setSettingsState({ open: true, typeId: id }); }
        }}
        onSaveStage={async (input, id) => { await saveStage({ input, id }); }}
      />

      <ReasonModal
        isOpen={Boolean(pendingBack)}
        title="Devolver demanda"
        subtitle={pendingBack ? `#${pendingBack.demand.demandNumber} volta para "${pendingBack.stage.name}".` : undefined}
        label="Motivo da devolução"
        submitLabel="Devolver"
        isLoading={isMoving}
        onClose={() => setPendingBack(undefined)}
        onSave={async (reason) => {
          if (!pendingBack) return;
          await moveDemand({ id: pendingBack.demand.id, toStageId: pendingBack.stage.id, note: reason });
          setPendingBack(undefined);
        }}
      />
    </div>
  );
};
