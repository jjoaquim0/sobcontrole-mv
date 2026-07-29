import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getStockRecommendations,
  getProductSupplierSuggestion,
  getRecommendationActionHistory,
  dismissRecommendation,
  postponeRecommendation,
  resolveRecommendation,
  AnalysisPeriodDays,
  TargetCoverageDays,
} from '../services/stockRecommendationsService';

export interface UseStockRecommendationsParams {
  analysisPeriodDays: AnalysisPeriodDays;
  targetCoverageDays: TargetCoverageDays;
}

const getErrorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback;

export const useStockRecommendations = (params: UseStockRecommendationsParams) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['stock-recommendations', params.analysisPeriodDays, params.targetCoverageDays],
    queryFn: () => getStockRecommendations(params),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['stock-recommendations'] });
    queryClient.invalidateQueries({ queryKey: ['stock-recommendation-history'] });
  };

  const dismissMutation = useMutation({
    mutationFn: dismissRecommendation,
    onSuccess: () => {
      invalidate();
      toast.success('Recomendação dispensada.');
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, 'Erro ao dispensar recomendação.'));
    },
  });

  const postponeMutation = useMutation({
    mutationFn: postponeRecommendation,
    onSuccess: () => {
      invalidate();
      toast.success('Recomendação adiada por 7 dias.');
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, 'Erro ao adiar recomendação.'));
    },
  });

  const resolveMutation = useMutation({
    mutationFn: resolveRecommendation,
    onSuccess: () => {
      invalidate();
      toast.success('Recomendação marcada como resolvida.');
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, 'Erro ao marcar recomendação como resolvida.'));
    },
  });

  return {
    result: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    dataUpdatedAt: query.dataUpdatedAt,

    dismiss: dismissMutation.mutateAsync,
    isDismissing: dismissMutation.isPending,

    postpone: postponeMutation.mutateAsync,
    isPostponing: postponeMutation.isPending,

    resolve: resolveMutation.mutateAsync,
    isResolving: resolveMutation.isPending,
  };
};

export const useProductSupplierSuggestion = (productId: string | null) => {
  const query = useQuery({
    queryKey: ['stock-recommendation-supplier-suggestion', productId],
    queryFn: () => getProductSupplierSuggestion(productId as string),
    enabled: !!productId,
  });

  return {
    suggestion: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
};

export const useRecommendationActionHistory = (productId: string | null) => {
  const query = useQuery({
    queryKey: ['stock-recommendation-history', productId],
    queryFn: () => getRecommendationActionHistory(productId as string),
    enabled: !!productId,
  });

  return {
    history: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
