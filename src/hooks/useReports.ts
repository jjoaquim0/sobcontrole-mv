import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ReportPeriod } from '../types';
import {
  getOverviewReport,
  getDREReport,
  getSalesReport,
  getFinancialReport,
  getInventoryReport,
  getCustomerReport,
} from '../services/reportService';

const getDateRange = (period: ReportPeriod) => {
  const now = new Date();
  let dateFrom: string;
  let dateTo: string = now.toISOString();

  switch (period.type) {
    case '7d': {
      const from = new Date();
      from.setDate(from.getDate() - 7);
      dateFrom = from.toISOString();
      break;
    }
    case '30d': {
      const from = new Date();
      from.setDate(from.getDate() - 30);
      dateFrom = from.toISOString();
      break;
    }
    case '90d': {
      const from = new Date();
      from.setDate(from.getDate() - 90);
      dateFrom = from.toISOString();
      break;
    }
    case '12m': {
      const from = new Date();
      from.setFullYear(from.getFullYear() - 1);
      dateFrom = from.toISOString();
      break;
    }
    case 'custom': {
      const from = new Date();
      from.setDate(from.getDate() - 30);
      dateFrom = period.dateFrom || from.toISOString();
      dateTo = period.dateTo || new Date().toISOString();
      break;
    }
    default: {
      const from = new Date();
      from.setDate(from.getDate() - 30);
      dateFrom = from.toISOString();
    }
  }

  return { dateFrom, dateTo };
};

export const formatCurrency = (value?: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

export const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('pt-BR');
};

const exportCSV = (data: Record<string, unknown>[], filename: string) => {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map((row) => Object.values(row).map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const useReports = (period: ReportPeriod) => {
  const dates = useMemo(() => getDateRange(period), [period.type, period.dateFrom, period.dateTo]);

  const overviewQuery = useQuery({
    queryKey: ['reports', 'overview', dates],
    queryFn: () => getOverviewReport(dates.dateFrom, dates.dateTo),
  });

  const dreQuery = useQuery({
    queryKey: ['reports', 'dre', dates],
    queryFn: () => getDREReport(dates.dateFrom, dates.dateTo),
  });

  const salesQuery = useQuery({
    queryKey: ['reports', 'sales', dates],
    queryFn: () => getSalesReport(dates.dateFrom, dates.dateTo),
  });

  const financialQuery = useQuery({
    queryKey: ['reports', 'financial', dates],
    queryFn: () => getFinancialReport(dates.dateFrom, dates.dateTo),
  });

  const inventoryQuery = useQuery({
    queryKey: ['reports', 'inventory', dates],
    queryFn: () => getInventoryReport(dates.dateFrom, dates.dateTo),
  });

  const customerQuery = useQuery({
    queryKey: ['reports', 'customer', dates],
    queryFn: () => getCustomerReport(dates.dateFrom, dates.dateTo),
  });

  return {
    dates,
    overview: { data: overviewQuery.data, isLoading: overviewQuery.isLoading, isError: overviewQuery.isError, refetch: overviewQuery.refetch },
    dre: { data: dreQuery.data, isLoading: dreQuery.isLoading, isError: dreQuery.isError, refetch: dreQuery.refetch },
    sales: { data: salesQuery.data, isLoading: salesQuery.isLoading, isError: salesQuery.isError, refetch: salesQuery.refetch },
    financial: { data: financialQuery.data, isLoading: financialQuery.isLoading, isError: financialQuery.isError, refetch: financialQuery.refetch },
    inventory: { data: inventoryQuery.data, isLoading: inventoryQuery.isLoading, isError: inventoryQuery.isError, refetch: inventoryQuery.refetch },
    customer: { data: customerQuery.data, isLoading: customerQuery.isLoading, isError: customerQuery.isError, refetch: customerQuery.refetch },
    exportCSV,
    formatCurrency,
    formatDate,
  };
};
