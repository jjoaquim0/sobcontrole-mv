import React, { useState } from 'react';
import { AlertTriangle, Bell, FileSpreadsheet, SlidersHorizontal, Wallet } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/shared/PageHeader';
import { useNotifications } from '../../hooks/useNotifications';
import { ReportQueryKey, useReports } from '../../hooks/useReports';
import { ReportPeriod } from '../../types';
import { NotificationItem } from '../notifications/components/NotificationItem';
import { PeriodSelector } from './components/PeriodSelector';
import { CustomersTab } from './tabs/CustomersTab';
import { DRETab } from './tabs/DRETab';
import { FinancialTab } from './tabs/FinancialTab';
import { InventoryTab } from './tabs/InventoryTab';
import { OverviewTab } from './tabs/OverviewTab';
import { SalesTab } from './tabs/SalesTab';

type ReportDomain = 'overview' | 'sales' | 'customers' | 'financial' | 'inventory';

interface ReportDomainPageProps {
  domain: ReportDomain;
  title: string;
  subtitle: string;
}

const DOMAIN_QUERIES: Record<ReportDomain, readonly ReportQueryKey[]> = {
  overview: ['overview'],
  sales: ['sales'],
  customers: ['customer'],
  financial: ['financial', 'dre'],
  inventory: ['inventory'],
};

const ReportDomainPage: React.FC<ReportDomainPageProps> = ({ domain, title, subtitle }) => {
  const [period, setPeriod] = useState<ReportPeriod>({ type: '30d' });
  const [searchParams, setSearchParams] = useSearchParams();
  const reports = useReports(period, DOMAIN_QUERIES[domain]);
  const financialView = searchParams.get('view') === 'dre' ? 'dre' : 'cashflow';
  const todayStamp = new Date().toISOString().slice(0, 10);

  const handleExport = () => {
    if (domain === 'overview' && reports.overview.data) {
      const data = reports.overview.data;
      reports.exportCSV(
        [
          { indicador: 'Receita', valor: data.revenue.current },
          { indicador: 'Despesas', valor: data.expenses.current },
          { indicador: 'Lucro', valor: data.profit.current },
          { indicador: 'Vendas', valor: data.salesCount.current },
          { indicador: 'Ticket Médio', valor: data.averageTicket.current },
          { indicador: 'Clientes Ativos', valor: data.activeCustomers },
        ],
        `relatorio-visao-geral-${todayStamp}`
      );
    }

    if (domain === 'sales' && reports.sales.data) {
      reports.exportCSV(
        reports.sales.data.byProduct.map((item) => ({ produto: item.productName, quantidade: item.quantity, receita: item.revenue })),
        `relatorio-vendas-${todayStamp}`
      );
    }

    if (domain === 'customers' && reports.customer.data) {
      reports.exportCSV(
        reports.customer.data.topBuyers.map((customer) => ({
          cliente: customer.customerName,
          totalGasto: customer.totalSpent,
          compras: customer.saleCount,
          ticketMedio: customer.averageTicket,
          ultimaCompra: reports.formatDate(customer.lastPurchase),
        })),
        `relatorio-clientes-${todayStamp}`
      );
    }

    if (domain === 'financial' && financialView === 'dre' && reports.dre.data) {
      reports.exportCSV(
        reports.dre.data.entries.map((entry) => ({ categoria: entry.category, valor: entry.value })),
        `relatorio-dre-${todayStamp}`
      );
    }

    if (domain === 'financial' && financialView === 'cashflow' && reports.financial.data) {
      reports.exportCSV(
        [
          ...reports.financial.data.receivables.byDueDate.map((item) => ({ tipo: 'A Receber', data: item.date, valor: item.amount })),
          ...reports.financial.data.payables.byDueDate.map((item) => ({ tipo: 'A Pagar', data: item.date, valor: item.amount })),
        ],
        `relatorio-financeiro-${todayStamp}`
      );
    }

    if (domain === 'inventory' && reports.inventory.data) {
      reports.exportCSV(
        reports.inventory.data.movements.map((movement) => ({
          data: movement.date,
          produto: movement.productName,
          tipo: movement.type === 'in' ? 'Entrada' : 'Saída',
          quantidade: movement.quantity,
        })),
        `relatorio-estoque-${todayStamp}`
      );
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          domain === 'financial' && financialView === 'dre' ? (
            <button
              type="button"
              onClick={() => window.print()}
              className="border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 transition-colors flex items-center gap-1.5 print:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a8d8]"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Imprimir DRE
            </button>
          ) : undefined
        }
      />

      <PeriodSelector period={period} onChange={setPeriod} />

      {domain === 'financial' && (
        <div className="inline-flex rounded-lg bg-gray-100 dark:bg-white/5 p-1" aria-label="Visão financeira">
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a8d8] ${financialView === 'cashflow' ? 'bg-white dark:bg-[#1a1d27] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-white/50'}`}
          >
            <Wallet className="w-4 h-4" /> Financeiro
          </button>
          <button
            type="button"
            onClick={() => setSearchParams({ view: 'dre' })}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a8d8] ${financialView === 'dre' ? 'bg-white dark:bg-[#1a1d27] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-white/50'}`}
          >
            <FileSpreadsheet className="w-4 h-4" /> DRE
          </button>
        </div>
      )}

      {domain === 'overview' && <OverviewTab data={reports.overview.data} isLoading={reports.overview.isLoading} isError={reports.overview.isError} formatCurrency={reports.formatCurrency} onExport={handleExport} />}
      {domain === 'sales' && <SalesTab data={reports.sales.data} isLoading={reports.sales.isLoading} isError={reports.sales.isError} formatCurrency={reports.formatCurrency} onExport={handleExport} />}
      {domain === 'customers' && <CustomersTab data={reports.customer.data} isLoading={reports.customer.isLoading} isError={reports.customer.isError} formatCurrency={reports.formatCurrency} formatDate={reports.formatDate} onExport={handleExport} />}
      {domain === 'financial' && financialView === 'cashflow' && <FinancialTab data={reports.financial.data} isLoading={reports.financial.isLoading} isError={reports.financial.isError} formatCurrency={reports.formatCurrency} onExport={handleExport} />}
      {domain === 'financial' && financialView === 'dre' && <DRETab data={reports.dre.data} isLoading={reports.dre.isLoading} isError={reports.dre.isError} formatCurrency={reports.formatCurrency} formatDate={reports.formatDate} onExport={handleExport} />}
      {domain === 'inventory' && <InventoryTab data={reports.inventory.data} isLoading={reports.inventory.isLoading} isError={reports.inventory.isError} formatCurrency={reports.formatCurrency} onExport={handleExport} />}
    </div>
  );
};

export const ReportsOverviewPage = () => <ReportDomainPage domain="overview" title="Visão Geral" subtitle="Principais indicadores da sua empresa em um único painel" />;

export const ReportsSalesPage = () => <ReportDomainPage domain="sales" title="Vendas e Pipeline" subtitle="Acompanhe receita, ticket médio e desempenho comercial" />;

export const ReportsCustomersPage = () => <ReportDomainPage domain="customers" title="Clientes" subtitle="Entenda atividade, rentabilidade e comportamento da sua base" />;

export const ReportsFinancialPage = () => <ReportDomainPage domain="financial" title="Financeiro" subtitle="Receitas, contas, inadimplência, fluxo de caixa e DRE" />;

export const ReportsInventoryPage = () => <ReportDomainPage domain="inventory" title="Estoque e Compras" subtitle="Giro, rupturas, movimentações e desempenho dos produtos" />;

export const ReportsIntelligencePage: React.FC = () => {
  const { data: notifications, isLoading, isError, refetch } = useNotifications({ limit: 50 });

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Central de Inteligência" subtitle="Insights, alertas, oportunidades e ações sugeridas pela Gestly" />

      {isLoading ? (
        <div className="space-y-3" role="status" aria-label="Carregando inteligencia">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 rounded-2xl bg-gray-100 dark:bg-white/5 animate-pulse" />)}
        </div>
      ) : isError ? (
        <div className="min-h-[360px] flex flex-col items-center justify-center text-center gap-3">
          <AlertTriangle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-red-500">Erro ao carregar os insights da Gestly.</p>
          <button type="button" onClick={() => refetch()} className="text-sm font-semibold text-[#00a8d8] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a8d8] rounded">Tentar novamente</button>
        </div>
      ) : !notifications?.length ? (
        <div className="min-h-[360px] flex flex-col items-center justify-center text-center border border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
          <Bell className="w-9 h-9 text-gray-300 dark:text-white/20 mb-3" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Nenhum insight no momento</h2>
          <p className="text-xs text-gray-500 dark:text-white/50 mt-1">A Gestly exibirá oportunidades e alertas assim que identificar sinais relevantes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => <NotificationItem key={notification.id} notification={notification} />)}
        </div>
      )}
    </div>
  );
};

export const ReportsCustomPage: React.FC = () => (
  <div className="animate-fade-in">
    <PageHeader title="Relatórios Personalizados" subtitle="Crie, salve, exporte e agende relatórios sob medida" />
    <div className="min-h-[360px] flex flex-col items-center justify-center text-center border border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
      <SlidersHorizontal className="w-9 h-9 text-gray-300 dark:text-white/20 mb-3" />
      <h2 className="text-sm font-bold text-gray-900 dark:text-white">Nenhum relatório personalizado</h2>
      <p className="text-xs text-gray-500 dark:text-white/50 mt-1">Seus modelos salvos aparecerão aqui quando o construtor estiver disponível.</p>
    </div>
  </div>
);
