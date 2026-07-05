import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPipelineStages,
  getDeals,
  createDeal,
  updateDeal,
  moveDealStage,
  closeDeal,
  getDealHistory,
  DealFilters,
  UpdateDealInput,
} from '../services/dealsService';
import { Deal } from '../types';
import { toast } from 'sonner';

export const usePipelineStages = () => {
  const stagesQuery = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: getPipelineStages,
  });

  return {
    stages: stagesQuery.data || [],
    isLoading: stagesQuery.isLoading,
    isError: stagesQuery.isError,
    refetch: stagesQuery.refetch,
  };
};

export const useDeals = (filters?: DealFilters) => {
  const dealsQuery = useQuery({
    queryKey: ['deals', filters],
    queryFn: () => getDeals(filters),
  });

  return {
    deals: dealsQuery.data || [],
    isLoading: dealsQuery.isLoading,
    isError: dealsQuery.isError,
    refetch: dealsQuery.refetch,
  };
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

  return {
    createDeal: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    updateDeal: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,

    moveDeal: moveMutation.mutateAsync,

    closeDeal: closeMutation.mutateAsync,
    isClosing: closeMutation.isPending,
  };
};
