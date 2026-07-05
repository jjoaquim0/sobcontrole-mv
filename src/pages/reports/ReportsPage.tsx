import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader } from '../../components/shared/PageHeader';
import { PeriodSelector } from './components/PeriodSelector';
import { OverviewTab } from './tabs/OverviewTab';
import { DRETab } from './tabs/DRETab';
import { SalesTab } from './tabs/SalesTab';
import { FinancialTab } from './tabs/FinancialTab';
import { InventoryTab } from './tabs/InventoryTab';
import { CustomersTab } from './tabs/CustomersTab';
import { useReports } from '../../hooks/useReports';
import { ReportPeriod } from '../../types';
import { LayoutGrid, FileSpreadsheet, ShoppingCart, Wallet, Package, Users, Printer } from 'lucide-react';

type ReportTab = 'overview' | 'dre' | 'sales' | 'financial' | 'inventory' | 'customers';

const TABS: { key: ReportTab; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Visão Geral', icon: <LayoutGrid className="w-4 h-4" /> },
  { key: 'dre', label: 'DRE', icon: <FileSpreadsheet className="w-4 h-4" /> },
  { key: 'sales', label: 'Vendas', icon: <ShoppingCart className="w-4 h-4" /> },
  { key: 'financial', label: 'Financeiro', icon: <Wallet className="w-4 h-4" /> },
  { key: 'inventory', label: 'Estoque', icon: <Package className="w-4 h-4" /> },
  { key: 'customers', label: 'Clientes', icon: <Users className="w-4 h-4" /> },
];

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [period, setPeriod] = useState<ReportPeriod>({ type: '30d' });

  const { overview, dre, sales, financial, inventory, customer, exportCSV, formatCurrency, formatDate } = useReports(period);

  const todayStamp = new Date().toISOString().slice(0, 10);

  const handleExport = () => {
    switch (activeTab) {
      case 'overview':
        if (overview.data) {
          exportCSV(
            [
              { indicador: 'Receita', valor: overview.data.revenue.current },
              { indicador: 'Despesas', valor: overview.data.expenses.current },
              { indicador: 'Lucro', valor: overview.data.profit.current },
              { indicador: 'Vendas', valor: overview.data.salesCount.current },
              { indicador: 'Ticket Médio', valor: overview.data.averageTicket.current },
              { indicador: 'Clientes Ativos', valor: overview.data.activeCustomers },
              { indicador: 'Estoque Baixo', valor: overview.data.lowStockProducts },
              { indicador: 'Saúde Financeira (%)', valor: overview.data.financialHealth },
            ],
            `relatorio-visao-geral-${todayStamp}`
          );
        }
        break;
      case 'dre':
        if (dre.data) {
          exportCSV(
            dre.data.entries.map((e) => ({ categoria: e.category, valor: e.value })),
            `relatorio-dre-${todayStamp}`
          );
        }
        break;
      case 'sales':
        if (sales.data) {
          exportCSV(
            sales.data.byProduct.map((p) => ({ produto: p.productName, quantidade: p.quantity, receita: p.revenue })),
            `relatorio-vendas-${todayStamp}`
          );
        }
        break;
      case 'financial':
        if (financial.data) {
          exportCSV(
            [
              ...financial.data.receivables.byDueDate.map((r) => ({ tipo: 'A Receber', data: r.date, valor: r.amount })),
              ...financial.data.payables.byDueDate.map((p) => ({ tipo: 'A Pagar', data: p.date, valor: p.amount })),
            ],
            `relatorio-financeiro-${todayStamp}`
          );
        }
        break;
      case 'inventory':
        if (inventory.data) {
          exportCSV(
            inventory.data.movements.map((m) => ({ data: m.date, produto: m.productName, tipo: m.type === 'in' ? 'Entrada' : 'Saída', quantidade: m.quantity })),
            `relatorio-estoque-${todayStamp}`
          );
        }
        break;
      case 'customers':
        if (customer.data) {
          exportCSV(
            customer.data.topBuyers.map((c) => ({
              cliente: c.customerName,
              totalGasto: c.totalSpent,
              compras: c.saleCount,
              ticketMedio: c.averageTicket,
              ultimaCompra: formatDate(c.lastPurchase),
            })),
            `relatorio-clientes-${todayStamp}`
          );
        }
        break;
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Relatórios"
        subtitle="Analise os dados da sua empresa com gráficos e indicadores"
        action={
          activeTab === 'dre' ? (
            <button
              type="button"
              onClick={() => window.print()}
              className="border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 transition-colors duration-200 flex items-center gap-1.5 print:hidden"
            >
              <Printer className="w-4 h-4" />
              Imprimir DRE
            </button>
          ) : undefined
        }
      />

      <PeriodSelector period={period} onChange={setPeriod} />

      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-white/10 overflow-x-auto">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors duration-200 ${
                isActive
                  ? 'border-[#10b981] text-[#10b981]'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-1.5">
                {tab.icon}
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {activeTab === 'overview' && (
            <OverviewTab data={overview.data} isLoading={overview.isLoading} isError={overview.isError} formatCurrency={formatCurrency} onExport={handleExport} />
          )}
          {activeTab === 'dre' && (
            <DRETab data={dre.data} isLoading={dre.isLoading} isError={dre.isError} formatCurrency={formatCurrency} formatDate={formatDate} onExport={handleExport} />
          )}
          {activeTab === 'sales' && (
            <SalesTab data={sales.data} isLoading={sales.isLoading} isError={sales.isError} formatCurrency={formatCurrency} onExport={handleExport} />
          )}
          {activeTab === 'financial' && (
            <FinancialTab data={financial.data} isLoading={financial.isLoading} isError={financial.isError} formatCurrency={formatCurrency} onExport={handleExport} />
          )}
          {activeTab === 'inventory' && (
            <InventoryTab data={inventory.data} isLoading={inventory.isLoading} isError={inventory.isError} formatCurrency={formatCurrency} onExport={handleExport} />
          )}
          {activeTab === 'customers' && (
            <CustomersTab data={customer.data} isLoading={customer.isLoading} isError={customer.isError} formatCurrency={formatCurrency} formatDate={formatDate} onExport={handleExport} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default ReportsPage;
