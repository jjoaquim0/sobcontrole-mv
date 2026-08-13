import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Plus, Archive, ArchiveRestore, ChevronDown, ChevronUp, Layers, Lock } from 'lucide-react';
import { PipelineStage } from '../../../types';
import {
  usePipelineStages,
  useArchivedPipelineStages,
  usePipelineStageMutations,
  useOpenDealCountsByStage,
} from '../../../hooks/usePipeline';
import { STAGE_COLOR_PALETTE, DEFAULT_NEW_STAGE_COLOR } from './stageColorPalette';

export interface StageManagerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  canManage: boolean;
  startInCreateFlow?: boolean;
}

interface ColorSwatchPopoverProps {
  stage: PipelineStage;
  onSelect: (color: string) => void;
  onClose: () => void;
}

const ColorSwatchPopover: React.FC<ColorSwatchPopoverProps> = ({ stage, onSelect, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Escolher cor para ${stage.name}`}
      className="absolute z-20 top-full left-0 mt-1.5 grid grid-cols-5 gap-1.5 p-2.5 bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/10 rounded-xl shadow-xl"
    >
      {STAGE_COLOR_PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onSelect(color)}
          aria-label={`Cor ${color}${stage.color === color ? ' (selecionada)' : ''}`}
          aria-pressed={stage.color === color}
          className="w-6 h-6 rounded-full border-2 transition-transform duration-150 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#10b981] dark:ring-offset-[#1a1d27]"
          style={{
            backgroundColor: color,
            borderColor: stage.color === color ? '#10b981' : 'transparent',
          }}
        />
      ))}
    </div>
  );
};

interface StageRowProps {
  stage: PipelineStage;
  dealCount: number;
  archived?: boolean;
  onRename: (id: string, name: string) => Promise<void>;
  onRecolor: (id: string, color: string) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onRestore: (id: string) => Promise<void>;
  isMutating: boolean;
}

const StageRow: React.FC<StageRowProps> = ({
  stage,
  dealCount,
  archived = false,
  onRename,
  onRecolor,
  onArchive,
  onRestore,
  isMutating,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(stage.name);
  const [isColorOpen, setIsColorOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName) inputRef.current?.focus();
  }, [isEditingName]);

  const startEditing = () => {
    if (archived) return;
    setDraftName(stage.name);
    setIsEditingName(true);
  };

  const commitRename = async () => {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === stage.name) {
      setIsEditingName(false);
      setDraftName(stage.name);
      return;
    }
    try {
      await onRename(stage.id, trimmed);
      setIsEditingName(false);
    } catch {
      // Erro já é comunicado via toast (usePipelineStageMutations); a linha
      // permanece em edição para nova tentativa, sem perder o valor digitado.
    }
  };

  const cancelRename = () => {
    setDraftName(stage.name);
    setIsEditingName(false);
  };

  const canArchive = !archived && dealCount === 0;

  return (
    <div className="relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors duration-150">
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => !archived && setIsColorOpen((v) => !v)}
          disabled={archived}
          aria-label={`Cor da etapa ${stage.name}${archived ? '' : ', alterar cor'}`}
          className="w-4 h-4 rounded-full border border-black/5 disabled:cursor-default"
          style={{ backgroundColor: stage.color }}
        />
        {isColorOpen && (
          <ColorSwatchPopover
            stage={stage}
            onClose={() => setIsColorOpen(false)}
            onSelect={async (color) => {
              setIsColorOpen(false);
              try {
                await onRecolor(stage.id, color);
              } catch {
                // toast já comunica o erro
              }
            }}
          />
        )}
      </div>

      {isEditingName ? (
        <input
          ref={inputRef}
          type="text"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitRename();
            } else if (e.key === 'Escape') {
              e.stopPropagation();
              cancelRename();
            }
          }}
          aria-label={`Nome da etapa ${stage.name}`}
          className="flex-1 min-w-0 px-2 py-1 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981]"
        />
      ) : (
        <button
          type="button"
          onClick={startEditing}
          disabled={archived}
          className={`flex-1 min-w-0 text-left text-sm font-semibold truncate rounded-lg px-1 -mx-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-[#10b981] ${
            archived
              ? 'text-gray-400 dark:text-gray-500 cursor-default'
              : 'text-gray-900 dark:text-white hover:text-[#10b981]'
          }`}
        >
          {stage.name}
        </button>
      )}

      <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 shrink-0 whitespace-nowrap">
        {dealCount} {dealCount === 1 ? 'negócio' : 'negócios'}
      </span>

      {archived ? (
        <button
          type="button"
          onClick={() => onRestore(stage.id)}
          disabled={isMutating}
          aria-label={`Reativar etapa ${stage.name}`}
          title="Reativar etapa"
          className="p-1.5 rounded-lg text-gray-400 hover:text-[#10b981] hover:bg-emerald-500/10 transition-colors shrink-0 disabled:opacity-50"
        >
          <ArchiveRestore className="w-4 h-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => canArchive && onArchive(stage.id)}
          disabled={!canArchive || isMutating}
          aria-label={`Arquivar etapa ${stage.name}`}
          title={
            canArchive
              ? 'Arquivar etapa'
              : `Mova os ${dealCount} negócios abertos desta etapa antes de arquivá-la.`
          }
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0 disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:bg-transparent"
        >
          <Archive className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

const StageRowSkeleton: React.FC = () => (
  <div className="flex items-center gap-2.5 px-3 py-2.5 animate-pulse">
    <div className="w-4 h-4 rounded-full bg-gray-200 dark:bg-white/10 shrink-0" />
    <div className="h-4 bg-gray-200 dark:bg-white/10 rounded flex-1" />
    <div className="h-3 w-14 bg-gray-200 dark:bg-white/10 rounded shrink-0" />
  </div>
);

const NewStageRow: React.FC<{
  onCreate: (name: string) => Promise<void>;
  onCancel: () => void;
}> = ({ onCreate, onCancel }) => {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const commit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      onCancel();
      return;
    }
    try {
      await onCreate(trimmed);
    } catch {
      // Erro já é comunicado via toast; a linha permanece para nova tentativa.
    }
  };

  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-500/5">
      <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: DEFAULT_NEW_STAGE_COLOR }} />
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.stopPropagation();
            onCancel();
          }
        }}
        placeholder="Nome da nova etapa"
        aria-label="Nome da nova etapa"
        className="flex-1 min-w-0 px-2 py-1 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981]"
      />
    </div>
  );
};

export const StageManagerDrawer: React.FC<StageManagerDrawerProps> = ({
  isOpen,
  onClose,
  canManage,
  startInCreateFlow = false,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const stagesEnabled = isOpen && canManage;
  const { stages, isLoading: isStagesLoading, isError: isStagesError, refetch } = usePipelineStages();
  const { stages: archivedStages, isLoading: isArchivedLoading } = useArchivedPipelineStages(
    stagesEnabled && isArchivedOpen
  );
  const { counts: dealCounts } = useOpenDealCountsByStage(stagesEnabled);
  const { createStage, updateStage, archiveStage, restoreStage, isCreatingStage, isUpdatingStage, isArchivingStage, isRestoringStage } =
    usePipelineStageMutations();

  const isMutatingAnyStage = isUpdatingStage || isArchivingStage || isRestoringStage;

  useEffect(() => {
    if (!isOpen) {
      setIsCreating(false);
      setIsArchivedOpen(false);
      return;
    }
    closeButtonRef.current?.focus();
    if (startInCreateFlow && canManage) setIsCreating(true);
  }, [isOpen, startInCreateFlow, canManage]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCreate = async (name: string) => {
    await createStage({ name, color: DEFAULT_NEW_STAGE_COLOR });
    setIsCreating(false);
  };

  const handleRename = async (id: string, name: string) => {
    await updateStage({ id, patch: { name } });
  };

  const handleRecolor = async (id: string, color: string) => {
    await updateStage({ id, patch: { color } });
  };

  const handleArchive = async (id: string) => {
    await archiveStage(id);
  };

  const handleRestore = async (id: string) => {
    await restoreStage(id);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/55 backdrop-blur-sm"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="stage-manager-title"
            className="relative w-full max-w-md h-full bg-white dark:bg-[#1a1d27] border-l border-gray-100 dark:border-white/5 shadow-2xl z-10 flex flex-col transition-colors duration-300"
          >
            <div className="flex justify-between items-start gap-4 p-5 border-b border-gray-100 dark:border-white/5 shrink-0">
              <div>
                <h2 id="stage-manager-title" className="text-lg font-bold text-gray-900 dark:text-white">
                  Gerenciar Etapas do Pipeline
                </h2>
                <p className="text-xs text-gray-400 mt-1">Etapas ativas aparecem como colunas no kanban</p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label="Fechar painel de etapas"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors duration-200 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!canManage ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <Lock className="w-10 h-10 text-gray-300 dark:text-white/15 mb-3" />
                <h4 className="text-base font-bold text-gray-900 dark:text-white">Acesso negado</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mt-1">
                  Apenas administradores e gerentes podem configurar as etapas do pipeline.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-3">
                {isStagesError ? (
                  <div className="flex flex-col items-center justify-center text-center p-8">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      Não foi possível carregar as etapas do pipeline.
                    </p>
                    <button
                      type="button"
                      onClick={() => refetch()}
                      className="bg-red-500 hover:bg-red-600 text-white rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-200"
                    >
                      Tentar novamente
                    </button>
                  </div>
                ) : isStagesLoading ? (
                  <div className="space-y-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <StageRowSkeleton key={i} />
                    ))}
                  </div>
                ) : stages.length === 0 && !isCreating ? (
                  <div className="flex flex-col items-center justify-center text-center p-8">
                    <Layers className="w-10 h-10 text-[#10b981] mb-3" />
                    <h4 className="text-base font-bold text-gray-900 dark:text-white">Nenhuma etapa ativa</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mt-1 mb-4">
                      Crie a primeira etapa para começar a organizar seu funil de vendas.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsCreating(true)}
                      className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200"
                    >
                      <Plus className="w-4 h-4" />
                      Nova Etapa
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {stages.map((stage) => (
                      <StageRow
                        key={stage.id}
                        stage={stage}
                        dealCount={dealCounts[stage.id] || 0}
                        onRename={handleRename}
                        onRecolor={handleRecolor}
                        onArchive={handleArchive}
                        onRestore={handleRestore}
                        isMutating={isMutatingAnyStage}
                      />
                    ))}

                    {isCreating && (
                      <NewStageRow onCreate={handleCreate} onCancel={() => setIsCreating(false)} />
                    )}

                    <div className="border-t border-gray-100 dark:border-white/5 mt-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsArchivedOpen((v) => !v)}
                        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors duration-150"
                        aria-expanded={isArchivedOpen}
                      >
                        <span>Ver etapas arquivadas ({archivedStages.length})</span>
                        {isArchivedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {isArchivedOpen && (
                        <div className="space-y-1 mt-1">
                          {isArchivedLoading ? (
                            Array.from({ length: 2 }).map((_, i) => <StageRowSkeleton key={i} />)
                          ) : archivedStages.length === 0 ? (
                            <p className="text-xs text-gray-400 dark:text-gray-500 px-3 py-2">
                              Nenhuma etapa arquivada.
                            </p>
                          ) : (
                            archivedStages.map((stage) => (
                              <StageRow
                                key={stage.id}
                                stage={stage}
                                dealCount={0}
                                archived
                                onRename={handleRename}
                                onRecolor={handleRecolor}
                                onArchive={handleArchive}
                                onRestore={handleRestore}
                                isMutating={isMutatingAnyStage}
                              />
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {canManage && !isStagesLoading && !isStagesError && stages.length > 0 && (
              <div className="p-4 border-t border-gray-100 dark:border-white/5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreating(true)}
                  disabled={isCreating || isCreatingStage}
                  className="w-full bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors duration-200 disabled:opacity-50"
                >
                  {isCreatingStage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Nova Etapa
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
