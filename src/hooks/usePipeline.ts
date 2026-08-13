import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPipelineStages,
  getArchivedPipelineStages,
  createPipelineStage,
  updatePipelineStage,
  archivePipelineStage,
  restorePipelineStage,
  updatePipelineStagePosition,
  CreatePipelineStageInput,
  UpdatePipelineStageInput,
  getDeals,
  createDeal,
  updateDeal,
  moveDealStage,
  closeDeal,
  deleteDeal,
  getDealHistory,
  DealFilters,
  UpdateDealInput,
} from '../services/dealsService';
import { Deal, PipelineStage } from '../types';
import { toast } from 'sonner';

export const usePipelineStages = () => {
  const stagesQuery = useQuery({
    queryKey: ['pipeline-stages', 'active'],
    queryFn: getPipelineStages,
  });

  return {
    stages: stagesQuery.data || [],
    isLoading: stagesQuery.isLoading,
    isError: stagesQuery.isError,
    refetch: stagesQuery.refetch,
  };
};

export const useArchivedPipelineStages = (enabled = true) => {
  const stagesQuery = useQuery({
    queryKey: ['pipeline-stages', 'archived'],
    queryFn: getArchivedPipelineStages,
    enabled,
  });

  return {
    stages: stagesQuery.data || [],
    isLoading: stagesQuery.isLoading,
    isError: stagesQuery.isError,
    refetch: stagesQuery.refetch,
  };
};

export const usePipelineStageMutations = () => {
  const queryClient = useQueryClient();

  const invalidateStages = () => {
    // Prefixo ['pipeline-stages'] invalida tanto ['pipeline-stages','active']
    // quanto ['pipeline-stages','archived'] de uma vez (match parcial do
    // React Query). ['deals']/['dashboard'] também são invalidados porque o
    // nome/cor da etapa aparece nas colunas do kanban e nos cards.
    queryClient.invalidateQueries({ queryKey: ['pipeline-stages'] });
    queryClient.invalidateQueries({ queryKey: ['deals'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const createMutation = useMutation({
    mutationFn: (input: CreatePipelineStageInput) => createPipelineStage(input),
    onSuccess: () => {
      invalidateStages();
      toast.success('Etapa criada com sucesso!');
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar etapa.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdatePipelineStageInput }) => updatePipelineStage(id, patch),
    onSuccess: () => {
      invalidateStages();
      toast.success('Etapa atualizada com sucesso!');
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar etapa.');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archivePipelineStage(id),
    onSuccess: () => {
      invalidateStages();
      toast.success('Etapa arquivada.');
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Erro ao arquivar etapa.');
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restorePipelineStage(id),
    onSuccess: () => {
      invalidateStages();
      toast.success('Etapa reativada.');
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Erro ao reativar etapa.');
    },
  });

  const activeStagesKey = ['pipeline-stages', 'active'];

  // Reordenação (Story 1.36, AC3/AC4): otimista - a ordem escolhida aparece
  // de imediato tanto no drawer quanto no kanban, porque ambos consomem o
  // mesmo cache de ['pipeline-stages','active'] via usePipelineStages(). Em
  // erro, faz rollback do cache para a ordem anterior e emite toast; em
  // sucesso, invalida somente a query de ativas - a de arquivadas
  // ('pipeline-stages','archived') não é tocada.
  const reorderMutation = useMutation({
    mutationFn: ({ stageId, position }: { stageId: string; position: number }) =>
      updatePipelineStagePosition(stageId, position),
    onMutate: async ({ stageId, position }) => {
      await queryClient.cancelQueries({ queryKey: activeStagesKey });
      const previous = queryClient.getQueryData<PipelineStage[]>(activeStagesKey);

      if (previous) {
        const next = previous
          .map((s) => (s.id === stageId ? { ...s, position } : s))
          .sort((a, b) => a.position - b.position);
        queryClient.setQueryData<PipelineStage[]>(activeStagesKey, next);
      }

      return { previous };
    },
    onError: (err: unknown, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(activeStagesKey, context.previous);
      }
      toast.error(err instanceof Error ? err.message : 'Erro ao reordenar etapa. A alteração foi revertida.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activeStagesKey });
    },
  });

  return {
    createStage: createMutation.mutateAsync,
    isCreatingStage: createMutation.isPending,

    updateStage: updateMutation.mutateAsync,
    isUpdatingStage: updateMutation.isPending,

    archiveStage: archiveMutation.mutateAsync,
    isArchivingStage: archiveMutation.isPending,

    restoreStage: restoreMutation.mutateAsync,
    isRestoringStage: restoreMutation.isPending,

    updatePipelineStagePosition: reorderMutation.mutateAsync,
    isUpdatingStagePosition: reorderMutation.isPending,
  };
};

export const useDeals = (filters?: DealFilters, options?: { enabled?: boolean }) => {
  const dealsQuery = useQuery({
    queryKey: ['deals', filters],
    queryFn: () => getDeals(filters),
    enabled: options?.enabled ?? true,
  });

  return {
    deals: dealsQuery.data || [],
    isLoading: dealsQuery.isLoading,
    isError: dealsQuery.isError,
    refetch: dealsQuery.refetch,
  };
};

// Contagem de negócios abertos por etapa, sem os filtros de busca/responsável/
// etapa da tela do kanban - usado pelo Stage Manager para exibir "N
// negócios" por linha e bloquear o arquivamento de etapas com negócios
// abertos (AC4). `enabled` evita o fetch enquanto o drawer está fechado.
export const useOpenDealCountsByStage = (enabled: boolean) => {
  const dealsQuery = useQuery({
    queryKey: ['deals', undefined],
    queryFn: () => getDeals(),
    enabled,
  });

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    (dealsQuery.data || []).forEach((d) => {
      map[d.stageId] = (map[d.stageId] || 0) + 1;
    });
    return map;
  }, [dealsQuery.data]);

  return { counts, isLoading: dealsQuery.isLoading };
};

export const useDealHistory = (dealId?: string) => {
  const historyQuery = useQuery({
    queryKey: ['deal-history', dealId],
    queryFn: () => getDealHistory(dealId as string),
    enabled: !!dealId,
  });

  return {
    history: historyQuery.data || [],
    isLoading: historyQuery.isLoading,
  };
};

export const useDealMutations = (filters?: DealFilters) => {
  const queryClient = useQueryClient();
  const dealsKey = ['deals', filters];

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['deals'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const createMutation = useMutation({
    mutationFn: createDeal,
    onSuccess: () => {
      invalidateAll();
      toast.success('Negócio criado com sucesso!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao criar negócio.');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDealInput }) => updateDeal(id, data),
    onSuccess: () => {
      invalidateAll();
      toast.success('Negócio atualizado com sucesso!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao atualizar negócio.');
    }
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, toStageId, position }: { id: string; toStageId: string; position: number }) =>
      moveDealStage(id, toStageId, position),
    onMutate: async ({ id, toStageId, position }) => {
      await queryClient.cancelQueries({ queryKey: dealsKey });
      const previous = queryClient.getQueryData<Deal[]>(dealsKey);

      if (previous) {
        queryClient.setQueryData<Deal[]>(
          dealsKey,
          previous.map(d => (d.id === id ? { ...d, stageId: toStageId, position } : d))
        );
      }

      return { previous };
    },
    onError: (err: any, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(dealsKey, context.previous);
      }
      toast.error(err.message || 'Erro ao mover o negócio. A alteração foi revertida.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });

  const closeMutation = useMutation({
    mutationFn: ({ id, status, lostReason }: { id: string; status: 'won' | 'lost'; lostReason?: string }) =>
      closeDeal(id, status, lostReason),
    onSuccess: (data) => {
      invalidateAll();
      toast.success(data.status === 'won' ? 'Negócio marcado como Ganho!' : 'Negócio marcado como Perdido.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao encerrar o negócio.');
    }
  });

  // Exclusão é destrutiva e irreversível: diferente de moveMutation (reversível
  // por natureza), o card só sai da tela depois que o backend confirma - sem
  // atualização otimista aqui, mesmo padrão de useAgenda.deleteMutation.
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDeal(id),
    onSuccess: () => {
      invalidateAll();
      toast.success('Oportunidade excluída com sucesso!');
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir oportunidade.');
    }
  });

  return {
    createDeal: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    updateDeal: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,

    moveDeal: moveMutation.mutateAsync,

    closeDeal: closeMutation.mutateAsync,
    isClosing: closeMutation.isPending,

    deleteDeal: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
};
