import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  toggleSupplierStatus,
} from '../services/supplierService';
import { Supplier } from '../types';
import { toast } from 'sonner';

interface Filters {
  search?: string;
  status?: 'active' | 'inactive' | 'all';
}

export const useSuppliers = (filters?: Filters) => {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['suppliers', filters],
    queryFn: () => getSuppliers(filters),
  });

  const createMutation = useMutation({
    mutationFn: createSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao cadastrar fornecedor.');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<Supplier, 'id' | 'companyId' | 'createdAt'>> }) =>
      updateSupplier(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier', data.id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao atualizar dados do fornecedor.');
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleSupplierStatus(id, isActive),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier', data.id] });
      toast.success(
        data.status === 'active'
          ? `Fornecedor "${data.name}" ativado com sucesso!`
          : `Fornecedor "${data.name}" desativado com sucesso!`
      );
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao alterar status do fornecedor.');
    }
  });

  return {
    suppliers: listQuery.data || [],
    isLoading: listQuery.isLoading,
    isError: listQuery.isError,
    refetch: listQuery.refetch,

    createSupplier: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    updateSupplier: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,

    toggleStatus: toggleStatusMutation.mutateAsync,
    isToggling: toggleStatusMutation.isPending,
  };
};

/**
 * Hook para carregar detalhes e histórico de compras agregado de um fornecedor
 */
export const useSupplierDetails = (id: string) => {
  const detailsQuery = useQuery({
    queryKey: ['supplier', id],
    queryFn: () => getSupplierById(id),
    enabled: !!id,
  });

  return {
    data: detailsQuery.data,
    isLoading: detailsQuery.isLoading,
    isError: detailsQuery.isError,
    refetch: detailsQuery.refetch,
  };
};
