import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getProducts,
  getProductById,
  getCategories,
  createCategory,
  getInventoryStats,
  createProduct,
  updateProduct,
  updateProductQuantity,
  toggleProductStatus,
  importProductsCSV,
  ProductFilters
} from '../services/inventoryService';
import { Product } from '../types';
import { toast } from 'sonner';

/**
 * Hook to manage products list query and filters
 */
export const useInventory = (filters?: ProductFilters) => {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['products', filters],
    queryFn: () => getProducts(filters),
  });

  return {
    products: listQuery.data || [],
    isLoading: listQuery.isLoading,
    isError: listQuery.isError,
    refetch: listQuery.refetch,
  };
};

/**
 * Hook to retrieve consolidated inventory level metrics
 */
export const useInventoryStats = () => {
  const statsQuery = useQuery({
    queryKey: ['inventory-stats'],
    queryFn: getInventoryStats,
  });

  return {
    stats: statsQuery.data,
    isLoading: statsQuery.isLoading,
    isError: statsQuery.isError,
    refetch: statsQuery.refetch,
  };
};

/**
 * Hook to manage product categories queries and creation
 */
export const useCategories = () => {
  const queryClient = useQueryClient();

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const createCategoryMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: (newCat) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success(`Categoria "${newCat.name}" criada com sucesso!`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao criar categoria.');
    }
  });

  return {
    categories: categoriesQuery.data || [],
    isLoading: categoriesQuery.isLoading,
    isError: categoriesQuery.isError,
    refetch: categoriesQuery.refetch,
    
    createCategory: createCategoryMutation.mutateAsync,
    isCreatingCategory: createCategoryMutation.isPending,
  };
};

/**
 * Hook to retrieve specific product profile details and movement history
 */
export const useProductDetails = (id: string) => {
  const detailsQuery = useQuery({
    queryKey: ['product', id],
    queryFn: () => getProductById(id),
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
 * Hook to manage all modifying product mutations
 */
export const useProductMutations = () => {
  const queryClient = useQueryClient();

  // Invalidate queries to refresh listing and stats
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
  };

  // Mutation: Create product
  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      invalidateAll();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao cadastrar produto.');
    }
  });

  // Mutation: Update product info
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<Product, 'id' | 'companyId' | 'createdAt' | 'category'>> }) =>
      updateProduct(id, data),
    onSuccess: (data) => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['product', data.id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao atualizar dados do produto.');
    }
  });

  // Mutation: Adjust stock manual quantity
  const updateQtyMutation = useMutation({
    mutationFn: ({ id, quantity, operation }: { id: string; quantity: number; operation: 'set' | 'add' | 'subtract' }) =>
      updateProductQuantity(id, quantity, operation),
    onSuccess: (data) => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['product', data.id] });
      toast.success(`Estoque do produto "${data.name}" ajustado para ${data.currentQuantity} unidades!`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao ajustar estoque do produto.');
    }
  });

  // Mutation: Toggle Product Status (active/inactive)
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleProductStatus(id, isActive),
    onSuccess: (data) => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['product', data.id] });
      toast.success(
        data.isActive
          ? `Produto "${data.name}" ativado com sucesso!`
          : `Produto "${data.name}" desativado com sucesso!`
      );
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao alterar status do produto.');
    }
  });

  // Mutation: CSV Import
  const importCSVMutation = useMutation({
    mutationFn: importProductsCSV,
    onSuccess: (result) => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      if (result.success > 0) {
        toast.success(`${result.success} produtos importados com sucesso!`);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao importar arquivo CSV.');
    }
  });

  return {
    createProduct: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    updateProduct: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,

    adjustStock: updateQtyMutation.mutateAsync,
    isAdjustingStock: updateQtyMutation.isPending,

    toggleStatus: toggleStatusMutation.mutateAsync,
    isToggling: toggleStatusMutation.isPending,

    importCSV: importCSVMutation.mutateAsync,
    isImportingCSV: importCSVMutation.isPending,
  };
};
