import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ReportPeriod } from '../types';
import { useAuth } from './useAuth';
import { getReportDateRange } from '../pages/reports/reportPeriod';
import { formatCurrency, formatDate } from '../pages/reports/reportFormatters';
import {
  getOverviewReport,
  getDREReport,
  getSalesReport,
  getFinancialReport,
  getInventoryReport,
  getCustomerReport,
} from '../services/reportService';

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

export type ReportQueryKey = 'overview' | 'dre' | 'sales' | 'financial' | 'inventory' | 'customer';

const ALL_REPORT_QUERY_KEYS: readonly ReportQueryKey[] = ['overview', 'dre', 'sales', 'financial', 'inventory', 'customer'];

export const createReportQueryKey = (
  companyId: string | undefined,
  report: ReportQueryKey,
  dateFrom: string,
  dateTo: string
) => ['reports', companyId, report, dateFrom, dateTo] as const;

export const useReports = (period: ReportPeriod, enabledReports: readonly ReportQueryKey[] = ALL_REPORT_QUERY_KEYS) => {
  const { company } = useAuth();
  const companyId = company?.id;
  const dates = useMemo(() => getReportDateRange(period), [period]);
  const isEnabled = (key: ReportQueryKey) => enabledReports.includes(key);
  const canQuery = (key: ReportQueryKey) => Boolean(companyId && isEnabled(key));

  const overviewQuery = useQuery({
    queryKey: createReportQueryKey(companyId, 'overview', dates.dateFrom, dates.dateTo),
    queryFn: () => getOverviewReport(dates.dateFrom, dates.dateTo),
    enabled: canQuery('overview'),
  });

  const dreQuery = useQuery({
    queryKey: createReportQueryKey(companyId, 'dre', dates.dateFrom, dates.dateTo),
    queryFn: () => getDREReport(dates.dateFrom, dates.dateTo),
    enabled: canQuery('dre'),
  });

  const salesQuery = useQuery({
    queryKey: createReportQueryKey(companyId, 'sales', dates.dateFrom, dates.dateTo),
    queryFn: () => getSalesReport(dates.dateFrom, dates.dateTo),
    enabled: canQuery('sales'),
  });

  const financialQuery = useQuery({
    queryKey: createReportQueryKey(companyId, 'financial', dates.dateFrom, dates.dateTo),
    queryFn: () => getFinancialReport(dates.dateFrom, dates.dateTo),
    enabled: canQuery('financial'),
  });

  const inventoryQuery = useQuery({
    queryKey: createReportQueryKey(companyId, 'inventory', dates.dateFrom, dates.dateTo),
    queryFn: () => getInventoryReport(dates.dateFrom, dates.dateTo),
    enabled: canQuery('inventory'),
  });

  const customerQuery = useQuery({
    queryKey: createReportQueryKey(companyId, 'customer', dates.dateFrom, dates.dateTo),
    queryFn: () => getCustomerReport(dates.dateFrom, dates.dateTo),
    enabled: canQuery('customer'),
  });

  return {
    dates,
    overview: { data: overviewQuery.data, isLoading: overviewQuery.isLoading, isError: overviewQuery.isError, error: overviewQuery.error, refetch: overviewQuery.refetch, dataUpdatedAt: overviewQuery.dataUpdatedAt },
    dre: { data: dreQuery.data, isLoading: dreQuery.isLoading, isError: dreQuery.isError, error: dreQuery.error, refetch: dreQuery.refetch, dataUpdatedAt: dreQuery.dataUpdatedAt },
    sales: { data: salesQuery.data, isLoading: salesQuery.isLoading, isError: salesQuery.isError, error: salesQuery.error, refetch: salesQuery.refetch, dataUpdatedAt: salesQuery.dataUpdatedAt },
    financial: { data: financialQuery.data, isLoading: financialQuery.isLoading, isError: financialQuery.isError, error: financialQuery.error, refetch: financialQuery.refetch, dataUpdatedAt: financialQuery.dataUpdatedAt },
    inventory: { data: inventoryQuery.data, isLoading: inventoryQuery.isLoading, isError: inventoryQuery.isError, error: inventoryQuery.error, refetch: inventoryQuery.refetch, dataUpdatedAt: inventoryQuery.dataUpdatedAt },
    customer: { data: customerQuery.data, isLoading: customerQuery.isLoading, isError: customerQuery.isError, error: customerQuery.error, refetch: customerQuery.refetch, dataUpdatedAt: customerQuery.dataUpdatedAt },
    exportCSV,
    formatCurrency,
    formatDate,
  };
};
