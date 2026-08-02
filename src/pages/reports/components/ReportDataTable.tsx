import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Column, DataTable } from '../../../components/shared/DataTable';

interface ReportDataTableProps<T> {
  title: string;
  subtitle?: string;
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptySubtitle?: string;
  emptyIcon?: React.ReactNode;
  action?: React.ReactNode;
  onRowClick?: (row: T) => void;
}

export function ReportDataTable<T>({
  title,
  subtitle,
  columns,
  data,
  isLoading = false,
  emptyTitle,
  emptySubtitle,
  emptyIcon,
  action,
  onRowClick,
}: ReportDataTableProps<T>) {
  const enhancedColumns: Column<T>[] = onRowClick
    ? [
        ...columns,
        {
          key: 'report-action',
          label: '',
          render: (row) => (
            <button
              type="button"
              onClick={() => onRowClick(row)}
              className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-[#0089b0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a8d8] dark:hover:bg-white/5 dark:hover:text-[#53dcff]"
              aria-label="Ver detalhes"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          ),
        },
      ]
    : columns;

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-white/5 dark:bg-[#1a1d27]">
      <div className="flex items-start justify-between gap-4 px-5 pt-5">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h3>
          {subtitle && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="mt-3 [&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none">
        <DataTable
          data={data}
          columns={enhancedColumns}
          isLoading={isLoading}
          emptyIcon={emptyIcon}
          emptyTitle={emptyTitle}
          emptySubtitle={emptySubtitle}
        />
      </div>
    </section>
  );
}
