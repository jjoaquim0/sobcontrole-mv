import React from 'react';
import { Database } from 'lucide-react';

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  emptyTitle?: string;
  emptySubtitle?: string;
}

export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'Nenhum dado encontrado.',
  emptyIcon,
  emptyTitle,
  emptySubtitle,
}: DataTableProps<T>) {
  return (
    <div className="w-full bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 dark:border-white/5 bg-gray-50/75 dark:bg-white/[0.02]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {isLoading ? (
              // Skeleton Loading State (5 rows)
              Array.from({ length: 5 }).map((_, rowIndex) => (
                <tr key={rowIndex} className="animate-pulse">
                  {columns.map((col) => (
                    <td key={col.key} className="px-6 py-4">
                      <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-3/4"></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={columns.length} className="px-6 py-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    {emptyIcon || <Database className="w-12 h-12 text-gray-300 dark:text-white/15 mb-3" />}
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                      {emptyTitle || emptyMessage}
                    </h4>
                    {emptySubtitle && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
                        {emptySubtitle}
                      </p>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              // Data Rows
              data.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors duration-150"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300"
                    >
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
