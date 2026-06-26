import { useQuery } from '@tanstack/react-query';
import {
  getSalesStats,
  getInventoryStats,
  getCustomerStats,
  getFinancialSummary,
  getRecentActivity,
  getWeeklySales,
  getTopProducts,
  getFinancialHealth,
} from '../services/dashboardService';

export const useDashboard = () => {
  const queryOptions = {
    staleTime: 300000, // 5 minutos (evita requests repetidos à toa)
    refetchInterval: 300000, // Revalida em background a cada 5 minutos
  };

  const salesStats = useQuery({
    queryKey: ['dashboard', 'salesStats'],
    queryFn: getSalesStats,
    ...queryOptions,
  });

  const inventoryStats = useQuery({
    queryKey: ['dashboard', 'inventoryStats'],
    queryFn: getInventoryStats,
    ...queryOptions,
  });

  const customerStats = useQuery({
    queryKey: ['dashboard', 'customerStats'],
    queryFn: getCustomerStats,
    ...queryOptions,
  });

  const financialSummary = useQuery({
    queryKey: ['dashboard', 'financialSummary'],
    queryFn: getFinancialSummary,
    ...queryOptions,
  });

  const recentActivity = useQuery({
    queryKey: ['dashboard', 'recentActivity'],
    queryFn: () => getRecentActivity(5),
    ...queryOptions,
  });

  const weeklySales = useQuery({
    queryKey: ['dashboard', 'weeklySales'],
    queryFn: getWeeklySales,
    ...queryOptions,
  });

  const topProducts = useQuery({
    queryKey: ['dashboard', 'topProducts'],
    queryFn: () => getTopProducts(3),
    ...queryOptions,
  });

  const financialHealth = useQuery({
    queryKey: ['dashboard', 'financialHealth'],
    queryFn: getFinancialHealth,
    ...queryOptions,
  });

  return {
    sales: {
      data: salesStats.data,
      isLoading: salesStats.isLoading,
      isError: salesStats.isError,
      refetch: salesStats.refetch,
    },
    inventory: {
      data: inventoryStats.data,
      isLoading: inventoryStats.isLoading,
      isError: inventoryStats.isError,
      refetch: inventoryStats.refetch,
    },
    customer: {
      data: customerStats.data,
      isLoading: customerStats.isLoading,
      isError: customerStats.isError,
      refetch: customerStats.refetch,
    },
    financial: {
      data: financialSummary.data,
      isLoading: financialSummary.isLoading,
      isError: financialSummary.isError,
      refetch: financialSummary.refetch,
    },
    activity: {
      data: recentActivity.data,
      isLoading: recentActivity.isLoading,
      isError: recentActivity.isError,
      refetch: recentActivity.refetch,
    },
    weeklySales: {
      data: weeklySales.data,
      isLoading: weeklySales.isLoading,
      isError: weeklySales.isError,
      refetch: weeklySales.refetch,
    },
    topProducts: {
      data: topProducts.data,
      isLoading: topProducts.isLoading,
      isError: topProducts.isError,
      refetch: topProducts.refetch,
    },
    financialHealth: {
      data: financialHealth.data,
      isLoading: financialHealth.isLoading,
      isError: financialHealth.isError,
      refetch: financialHealth.refetch,
    },
  };
};
