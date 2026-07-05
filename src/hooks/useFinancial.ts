import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getReceivables,
  getPayables,
  updateReceivableStatus,
  updatePayableStatus,
  createManualReceivable,
  createManualPayable,
  getCashFlow,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  FinancialFilters,
  CashFlowRange,
  ManualReceivableInput,
  ManualPayableInput,
  CategoryInput,
} from '../services/financialService';
import { TransactionStatus, PaymentMethod } from '../types';

interface UseFinancialParams {
  receivableFilters?: FinancialFilters;
  payableFilters?: FinancialFilters;
  cashFlowRange?: CashFlowRange;
  enableReceivables?: boolean;
  enablePayables?: boolean;
  enableCashFlow?: boolean;
  enableCategories?: boolean;
}

export const useFinancial = (params?: UseFinancialParams) => {
  const queryClient = useQueryClient();

  const receivableFilters = params?.receivableFilters;
  const payableFilters = params?.payableFilters;
  const cashFlowRange = params?.cashFlowRange ?? { days: 7 };
  const enableReceivables = params?.enableReceivables ?? true;
  const enablePayables = params?.enablePayables ?? true;
  const enableCashFlow = params?.enableCashFlow ?? true;
  const enableCategories = params?.enableCategories ?? true;

  const invalidateDashboard = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'financialSummary'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'financialHealth'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'recentActivity'] });
  };

  const receivablesQuery = useQuery({
    queryKey: ['financial', 'receivables', receivableFilters],
    queryFn: () => getReceivables(receivableFilters),
    enabled: enableReceivables,
  });

  const payablesQuery = useQuery({
    queryKey: ['financial', 'payables', payableFilters],
    queryFn: () => getPayables(payableFilters),
    enabled: enablePayables,
  });

  const cashFlowQuery = useQuery({
    queryKey: ['financial', 'cashFlow', cashFlowRange],
    queryFn: () => getCashFlow(cashFlowRange),
    enabled: enableCashFlow,
  });

  const categoriesQuery = useQuery({
    queryKey: ['financial', 'categories'],
    queryFn: getCategories,
    enabled: enableCategories,
  });

  const updateReceivableStatusMutation = useMutation({
    mutationFn: ({ id, status, paymentMethod }: { id: string; status: TransactionStatus; paymentMethod?: PaymentMethod }) =>
      updateReceivableStatus(id, status, paymentMethod),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial', 'receivables'] });
      queryClient.invalidateQueries({ queryKey: ['financial', 'cashFlow'] });
      invalidateDashboard();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao atualizar conta a receber.');
    },
  });

  const updatePayableStatusMutation = useMutation({
    mutationFn: ({ id, status, paymentMethod }: { id: string; status: TransactionStatus; paymentMethod?: PaymentMethod }) =>
      updatePayableStatus(id, status, paymentMethod),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial', 'payables'] });
      queryClient.invalidateQueries({ queryKey: ['financial', 'cashFlow'] });
      invalidateDashboard();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao atualizar conta a pagar.');
    },
  });

  const createReceivableMutation = useMutation({
    mutationFn: (data: ManualReceivableInput) => createManualReceivable(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial', 'receivables'] });
      invalidateDashboard();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao criar conta a receber.');
    },
  });

  const createPayableMutation = useMutation({
    mutationFn: (data: ManualPayableInput) => createManualPayable(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial', 'payables'] });
      invalidateDashboard();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao criar conta a pagar.');
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data: CategoryInput) => createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial', 'categories'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao criar categoria.');
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CategoryInput> }) => updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial', 'categories'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao atualizar categoria.');
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial', 'categories'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao excluir categoria.');
    },
  });

  return {
    receivables: receivablesQuery.data || [],
    isReceivablesLoading: receivablesQuery.isLoading,
    isReceivablesError: receivablesQuery.isError,
    refetchReceivables: receivablesQuery.refetch,

    payables: payablesQuery.data || [],
    isPayablesLoading: payablesQuery.isLoading,
    isPayablesError: payablesQuery.isError,
    refetchPayables: payablesQuery.refetch,

    cashFlow: cashFlowQuery.data || [],
    isCashFlowLoading: cashFlowQuery.isLoading,
    isCashFlowError: cashFlowQuery.isError,

    categories: categoriesQuery.data || [],
    isCategoriesLoading: categoriesQuery.isLoading,
    isCategoriesError: categoriesQuery.isError,

    updateReceivableStatus: updateReceivableStatusMutation.mutateAsync,
    isUpdatingReceivable: updateReceivableStatusMutation.isPending,

    updatePayableStatus: updatePayableStatusMutation.mutateAsync,
    isUpdatingPayable: updatePayableStatusMutation.isPending,

    createManualReceivable: createReceivableMutation.mutateAsync,
    isCreatingReceivable: createReceivableMutation.isPending,

    createManualPayable: createPayableMutation.mutateAsync,
    isCreatingPayable: createPayableMutation.isPending,

    createCategory: createCategoryMutation.mutateAsync,
    isCreatingCategory: createCategoryMutation.isPending,

    updateCategory: updateCategoryMutation.mutateAsync,
    isUpdatingCategory: updateCategoryMutation.isPending,

    deleteCategory: deleteCategoryMutation.mutateAsync,
    isDeletingCategory: deleteCategoryMutation.isPending,
  };
};
