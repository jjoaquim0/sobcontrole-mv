import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPurchases,
  getPurchaseById,
  getPurchaseStats,
  createPurchase,
  updatePurchaseStatus,
  cancelPurchase,
  PurchaseFilters
} from '../services/purchaseService';
import { toast } from 'sonner';

export const usePurchases = (filters?: PurchaseFilters) => {
  const listQuery = useQuery({
    queryKey: ['purchases', filters],
    queryFn: () => getPurchases(filters),
  });

  return {
    purchases: listQuery.data || [],
    isLoading: listQuery.isLoading,
    isError: listQuery.isError,
    refetch: listQuery.refetch,
  };
};

export const usePurchaseStats = () => {
  const statsQuery = useQuery({
    queryKey: ['purchase-stats'],
    queryFn: getPurchaseStats,
  });

  return {
    stats: statsQuery.data,
    isLoading: statsQuery.isLoading,
    isError: statsQuery.isError,
    refetch: statsQuery.refetch,
  };
};

export const usePurchaseDetails = (id: string) => {
  const detailsQuery = useQuery({
    queryKey: ['purchase', id],
    queryFn: () => getPurchaseById(id),
    enabled: !!id,
  });

  return {
    data: detailsQuery.data,
    isLoading: detailsQuery.isLoading,
    isError: detailsQuery.isError,
    refetch: detailsQuery.refetch,
  };
};

export const usePurchaseMutations = () => {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['purchases'] });
    queryClient.invalidateQueries({ queryKey: ['purchase-stats'] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const createMutation = useMutation({
    mutationFn: createPurchase,
    onSuccess: (data) => {
      invalidateAll();
      toast.success(`Compra registrada com sucesso! Código: #${data.id}`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao registrar compra.');
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'paid' | 'pending' | 'canceled' }) =>
      updatePurchaseStatus(id, status),
    onSuccess: (data) => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['purchase', data.id] });
      toast.success(`Status da compra #${data.id} alterado para "${
        data.status === 'paid' ? 'Pago' : data.status === 'canceled' ? 'Cancelado' : 'Pendente'
      }"!`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao alterar status de pagamento da compra.');
    }
  });

  const cancelMutation = useMutation({
    mutationFn: cancelPurchase,
    onSuccess: (data) => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['purchase', data.id] });
      toast.success('Compra cancelada e estoque estornado.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao cancelar a compra.');
    }
  });

  return {
    createPurchase: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    updatePurchaseStatus: updateStatusMutation.mutateAsync,
    isUpdatingStatus: updateStatusMutation.isPending,

    cancelPurchase: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,
  };
};
