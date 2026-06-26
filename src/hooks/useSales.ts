import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSales,
  getSaleById,
  getSalesStats,
  createSale,
  updateSaleStatus,
  cancelSale,
  SaleFilters
} from '../services/salesService';
import { toast } from 'sonner';

/**
 * Hook to retrieve sales list with reactive query keys
 */
export const useSales = (filters?: SaleFilters) => {
  const listQuery = useQuery({
    queryKey: ['sales', filters],
    queryFn: () => getSales(filters),
  });

  return {
    sales: listQuery.data || [],
    isLoading: listQuery.isLoading,
    isError: listQuery.isError,
    refetch: listQuery.refetch,
  };
};

/**
 * Hook to retrieve sales consolidated stats
 */
export const useSalesStats = () => {
  const statsQuery = useQuery({
    queryKey: ['sales-stats'],
    queryFn: getSalesStats,
  });

  return {
    stats: statsQuery.data,
    isLoading: statsQuery.isLoading,
    isError: statsQuery.isError,
    refetch: statsQuery.refetch,
  };
};

/**
 * Hook to retrieve full sale items and header detail profile
 */
export const useSaleDetails = (id: string) => {
  const detailsQuery = useQuery({
    queryKey: ['sale', id],
    queryFn: () => getSaleById(id),
    enabled: !!id,
  });

  return {
    data: detailsQuery.data,
    isLoading: detailsQuery.isLoading,
    isError: detailsQuery.isError,
    refetch: detailsQuery.refetch,
  };
};

/**
 * Hook to manage mutating sale mutations
 */
export const useSaleMutations = () => {
  const queryClient = useQueryClient();

  // Invalidates caching queries to force refresh UI stats and lists
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['sales'] });
    queryClient.invalidateQueries({ queryKey: ['sales-stats'] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  // Mutation: Create Sale
  const createMutation = useMutation({
    mutationFn: createSale,
    onSuccess: (data) => {
      invalidateAll();
      toast.success(`Venda registrada com sucesso! Código: #${data.id.slice(0, 8).toUpperCase()}`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao registrar venda.');
    }
  });

  // Mutation: Update payment status
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, paymentStatus }: { id: string; paymentStatus: 'paid' | 'pending' | 'cancelled' }) =>
      updateSaleStatus(id, paymentStatus),
    onSuccess: (data) => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['sale', data.id] });
      toast.success(`Status da venda #${data.id.slice(0, 8).toUpperCase()} alterado para "${
        data.paymentStatus === 'paid' ? 'Pago' : 'Pendente'
      }"!`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao alterar status de pagamento da venda.');
    }
  });

  // Mutation: Cancel sale
  const cancelMutation = useMutation({
    mutationFn: cancelSale,
    onSuccess: (data) => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['sale', data.id] });
      toast.success(`Venda #${data.id.slice(0, 8).toUpperCase()} cancelada com sucesso! Estoque estornado.`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao cancelar a venda.');
    }
  });

  return {
    createSale: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    updateSaleStatus: updateStatusMutation.mutateAsync,
    isUpdatingStatus: updateStatusMutation.isPending,

    cancelSale: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,
  };
};
