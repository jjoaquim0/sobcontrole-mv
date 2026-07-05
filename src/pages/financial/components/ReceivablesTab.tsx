import React, { useState } from 'react';
import { DataTable } from '../../../components/shared/DataTable';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { useFinancial } from '../../../hooks/useFinancial';
import { AccountReceivable, TransactionStatus, PaymentMethod } from '../../../types';
import { ManualEntryModal } from './ManualEntryModal';
import { EditPaymentStatusModal, PaymentAccount } from './EditPaymentStatusModal';
import { ArrowDownCircle, CalendarDays, Pencil, Plus, X } from 'lucide-react';

const formatMoney = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export const ReceivablesTab: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | 'all'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const [selected, setSelected] = useState<PaymentAccount | undefined>(undefined);
  const [isStatusOpen, setIsStatusOpen] = useState(false);

  const {
    receivables,
    isReceivablesLoading,
    createManualReceivable,
    isCreatingReceivable,
    updateReceivableStatus,
    isUpdatingReceivable,
  } = useFinancial({
    receivableFilters: { status: statusFilter, startDate, endDate },
    enablePayables: false,
    enableCashFlow: false,
    enableCategories: false,
  });

  const isFiltered = statusFilter !== 'all' || startDate !== '' || endDate !== '';

  const handleClearFilters = () => {
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
  };

  const handleOpenStatus = (row: AccountReceivable) => {
    setSelected({ id: row.id, description: row.description || '', amount: row.amount, status: row.status });
    setIsStatusOpen(true);
  };

  const handleUpdateStatus = async (id: string, status: TransactionStatus, paymentMethod?: PaymentMethod) => {
    await updateReceivableStatus({ id, status, paymentMethod });
  };

  const columns = [
    {
      key: 'description',
      label: 'Descrição',
      render: (row: AccountReceivable) => (
        <span className="font-semibold text-gray-900 dark:text-white block truncate max-w-[220px]" title={row.description}>
          {row.description || 'Sem descrição'}
        </span>
      ),
    },
    {
      key: 'customer',
      label: 'Cliente',
      render: (row: AccountReceivable) => (
        <span className="text-gray-600 dark:text-gray-300">{row.customer?.fullName || '—'}</span>
      ),
    },
    {
      key: 'amount',
      label: 'Valor',
      render: (row: AccountReceivable) => (
        <span className="font-bold text-gray-900 dark:text-white">{formatMoney(row.amount)}</span>
      ),
    },
    {
      key: 'dueDate',
      label: 'Vencimento',
      render: (row: AccountReceivable) => (
        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {new Date(row.dueDate).toLocaleDateString('pt-BR')}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: AccountReceivable) => <StatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (row: AccountReceivable) => (
        <button
          type="button"
          onClick={() => handleOpenStatus(row)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
          title="Alterar Status"
        >
          <Pencil className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TransactionStatus | 'all')}
            className="px-4 py-2.5 pr-8 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#1a1d27] text-xs font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] appearance-none cursor-pointer"
          >
            <option value="all">Todos os Status</option>
            <option value="paid">Pago</option>
            <option value="pending">Pendente</option>
            <option value="late">Atrasado</option>
            <option value="canceled">Cancelado</option>
          </select>

          <div className="flex items-center gap-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-1 text-xs">
            <span className="text-gray-400 flex items-center gap-1 px-1 font-semibold">
              <CalendarDays className="w-3.5 h-3.5" /> Vencimento:
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-gray-700 dark:text-gray-300 outline-none p-1 font-semibold cursor-pointer dark:[color-scheme:dark]"
            />
            <span className="text-gray-300 dark:text-white/10 px-0.5">/</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-gray-700 dark:text-gray-300 outline-none p-1 font-semibold cursor-pointer dark:[color-scheme:dark]"
            />
          </div>

          {isFiltered && (
            <button
              onClick={handleClearFilters}
              className="text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white flex items-center gap-1 py-2 px-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all duration-200"
            >
              <X className="w-3.5 h-3.5" />
              Limpar Filtros
            </button>
          )}
        </div>

        <button
          onClick={() => setIsEntryOpen(true)}
          className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 shadow-md shadow-emerald-500/10 self-start"
        >
          <Plus className="w-4 h-4" />
          Nova Conta a Receber
        </button>
      </div>

      <DataTable
        data={receivables}
        columns={columns}
        isLoading={isReceivablesLoading}
        emptyIcon={<ArrowDownCircle className="w-12 h-12 text-[#10b981] mb-3" />}
        emptyTitle="Nenhuma conta a receber encontrada"
        emptySubtitle="As contas a receber geradas por vendas e lançamentos manuais aparecerão aqui"
      />

      <ManualEntryModal
        isOpen={isEntryOpen}
        onClose={() => setIsEntryOpen(false)}
        type="receivable"
        onSaveReceivable={async (data) => {
          await createManualReceivable(data);
        }}
        onSavePayable={async () => undefined}
        isLoading={isCreatingReceivable}
      />

      <EditPaymentStatusModal
        isOpen={isStatusOpen}
        onClose={() => setIsStatusOpen(false)}
        account={selected}
        onUpdateStatus={handleUpdateStatus}
        isLoading={isUpdatingReceivable}
      />
    </div>
  );
};

export default ReceivablesTab;
