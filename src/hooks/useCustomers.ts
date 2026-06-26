import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getCustomers, 
  getCustomerById, 
  createCustomer, 
  updateCustomer, 
  toggleCustomerStatus 
} from '../services/customerService';
import { Customer } from '../types';
import { toast } from 'sonner';

interface Filters {
  search?: string;
  status?: 'active' | 'inactive' | 'all';
}

export const useCustomers = (filters?: Filters) => {
  const queryClient = useQueryClient();

  // Query: Carregar lista filtrada
  const listQuery = useQuery({
    queryKey: ['customers', filters],
    queryFn: () => getCustomers(filters),
  });

  // Mutation: Cadastrar Cliente
  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      // Mensagem de sucesso é disparada no modal para maior controle de fluxo
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao cadastrar cliente.');
    }
  });

  // Mutation: Editar Cliente
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<Customer, 'id' | 'companyId' | 'createdAt'>> }) => 
      updateCustomer(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', data.id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao atualizar dados do cliente.');
    }
  });

  // Mutation: Ativar/Desativar Status
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => 
      toggleCustomerStatus(id, isActive),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', data.id] });
      toast.success(
        data.isActive 
          ? `Cliente "${data.fullName}" ativado com sucesso!` 
          : `Cliente "${data.fullName}" desativado com sucesso!`
      );
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao alterar status do cliente.');
    }
  });

  return {
    customers: listQuery.data || [],
    isLoading: listQuery.isLoading,
    isError: listQuery.isError,
    refetch: listQuery.refetch,

    // Métodos mutadores e estados
    createCustomer: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    updateCustomer: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,

    toggleStatus: toggleStatusMutation.mutateAsync,
    isToggling: toggleStatusMutation.isPending,
  };
};

/**
 * Hook para carregar detalhes e históricos agregados de um cliente
 */
export const useCustomerDetails = (id: string) => {
  const detailsQuery = useQuery({
    queryKey: ['customer', id],
    queryFn: () => getCustomerById(id),
    enabled: !!id,
  });

  return {
    data: detailsQuery.data,
    isLoading: detailsQuery.isLoading,
    isError: detailsQuery.isError,
    refetch: detailsQuery.refetch,
  };
};
