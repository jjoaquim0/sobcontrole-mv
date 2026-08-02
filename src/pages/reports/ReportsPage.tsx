import React, { useMemo, useState } from 'react';
import { Bell, Clock3, FileSpreadsheet, Flame, Inbox, SlidersHorizontal, Wallet } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/shared/PageHeader';
import { useNotifications } from '../../hooks/useNotifications';
import { ReportQueryKey, useReports } from '../../hooks/useReports';
import { ReportPeriod } from '../../types';
import { NotificationItem } from '../notifications/components/NotificationItem';
import { DashboardSection } from './components/DashboardSection';
import { DataFreshnessIndicator } from './components/DataFreshnessIndicator';
import { MetricCard } from './components/MetricCard';
import { PeriodSelector } from './components/PeriodSelector';
import { ReportEmptyState } from './components/ReportEmptyState';
import { ReportErrorState } from './components/ReportErrorState';
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

const isFinancialAccessDenied = (error: unknown) =>
  error instanceof Error && error.name === 'FinancialPermissionError';

const NOTIFICATION_PRIORITY_ORDER = {
  critica: 0,
  alta: 1,
  media: 2,
  baixa: 3,
  informativa: 4,
} as const;

const ReportDomainPage: React.FC<ReportDomainPageProps> = ({ domain, title, subtitle }) => {
  const [period, setPeriod] = useState<ReportPeriod>({ type: 'current_month' });
  const [searchParams, setSearchParams] = useSearchParams();
  const reports = useReports(period, DOMAIN_QUERIES[domain]);
  const financialView = searchParams.get('view') === 'dre' ? 'dre' : 'cashflow';
  const todayStamp = new Date().toISOString().slice(0, 10);

  const handleExport = () => {
    if (domain === 'overview' && reports.overview.data) {
      const data = reports.overview.data;
      reports.exportCSV(
        [
          { indicador: 'Receita paga', valor: data.revenue.current },
          { indicador: 'Custos e despesas identificados', valor: data.expenses.current },
          { indicador: 'Resultado direto', valor: data.profit.current },
          { indicador: 'Vendas válidas', valor: data.salesCount.current },
          { indicador: 'Ticket médio pago', valor: data.averageTicket.current },
          { indicador: 'Clientes ativos', valor: data.activeCustomers },
        ],
        `relatorio-visao-geral-${todayStamp}`
      );
    }

    if (domain === 'sales' && reports.sales.data) {
      reports.exportCSV(
        reports.sales.data.byProduct.map((item) => ({
          produto: item.productName,
          quantidade: item.quantity,
          receita: item.revenue,
        })),
        `relatorio-vendas-${todayStamp}`
      );
    }

    if (domain === 'customers' && reports.customer.data) {
      reports.exportCSV(
        reports.customer.data.topBuyers.map((customer) => ({
          cliente: customer.customerName,
          receitaPaga: customer.totalSpent,
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
          ...reports.financial.data.receivables.byDueDate.map((item) => ({
            tipo: 'A receber',
            data: item.date,
            valor: item.amount,
          })),
          ...reports.financial.data.payables.byDueDate.map((item) => ({
            tipo: 'A pagar',
            data: item.date,
            valor: item.amount,
          })),
        ],
        `relatorio-financeiro-${todayStamp}`
      );
    }

    if (domain === 'inventory' && reports.inventory.data) {
      reports.exportCSV(
        reports.inventory.data.movements.map((movement) => ({
          data: reports.formatDate(movement.date),
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
      <PageHeader title={title} subtitle={subtitle} />

      <PeriodSelector period={period} onChange={setPeriod} appliedLabel={reports.dates.label} />

      {domain === 'financial' && (
        <div className="inline-flex rounded-lg bg-gray-100 p-1 dark:bg-white/5" aria-label="Visão financeira">
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a8d8] ${
              financialView === 'cashflow'
                ? 'bg-white text-gray-900 shadow-sm dark:bg-[#1a1d27] dark:text-white'
                : 'text-gray-500 dark:text-white/50'
            }`}
          >
            <Wallet className="h-4 w-4" /> Financeiro
          </button>
          <button
            type="button"
            onClick={() => setSearchParams({ view: 'dre' })}
            className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a8d8] ${
              financialView === 'dre'
                ? 'bg-white text-gray-900 shadow-sm dark:bg-[#1a1d27] dark:text-white'
                : 'text-gray-500 dark:text-white/50'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" /> DRE
          </button>
        </div>
      )}

      {domain === 'overview' && (
        <OverviewTab
          data={reports.overview.data}
          isLoading={reports.overview.isLoading}
          isError={reports.overview.isError}
          isAccessDenied={isFinancialAccessDenied(reports.overview.error)}
          formatCurrency={reports.formatCurrency}
          onExport={handleExport}
          onRetry={() => void reports.overview.refetch()}
          updatedAt={reports.overview.dataUpdatedAt}
          periodLabel={reports.dates.label}
        />
      )}
      {domain === 'sales' && (
        <SalesTab
          data={reports.sales.data}
          isLoading={reports.sales.isLoading}
          isError={reports.sales.isError}
          formatCurrency={reports.formatCurrency}
          onExport={handleExport}
          onRetry={() => void reports.sales.refetch()}
          updatedAt={reports.sales.dataUpdatedAt}
          periodLabel={reports.dates.label}
        />
      )}
      {domain === 'customers' && (
        <CustomersTab
          data={reports.customer.data}
          isLoading={reports.customer.isLoading}
          isError={reports.customer.isError}
          formatCurrency={reports.formatCurrency}
          formatDate={reports.formatDate}
          onExport={handleExport}
          onRetry={() => void reports.customer.refetch()}
          updatedAt={reports.customer.dataUpdatedAt}
          periodLabel={reports.dates.label}
        />
      )}
      {domain === 'financial' && financialView === 'cashflow' && (
        <FinancialTab
          data={reports.financial.data}
          isLoading={reports.financial.isLoading}
          isError={reports.financial.isError}
          isAccessDenied={isFinancialAccessDenied(reports.financial.error)}
          formatCurrency={reports.formatCurrency}
          onExport={handleExport}
          onRetry={() => void reports.financial.refetch()}
          updatedAt={reports.financial.dataUpdatedAt}
          periodLabel={reports.dates.label}
        />
      )}
      {domain === 'financial' && financialView === 'dre' && (
        <DRETab
          data={reports.dre.data}
          isLoading={reports.dre.isLoading}
          isError={reports.dre.isError}
          isAccessDenied={isFinancialAccessDenied(reports.dre.error)}
          formatCurrency={reports.formatCurrency}
          formatDate={reports.formatDate}
          onExport={handleExport}
          onRetry={() => void reports.dre.refetch()}
          updatedAt={reports.dre.dataUpdatedAt}
        />
      )}
      {domain === 'inventory' && (
        <InventoryTab
          data={reports.inventory.data}
          isLoading={reports.inventory.isLoading}
          isError={reports.inventory.isError}
          formatCurrency={reports.formatCurrency}
          onExport={handleExport}
          onRetry={() => void reports.inventory.refetch()}
          updatedAt={reports.inventory.dataUpdatedAt}
          periodLabel={reports.dates.label}
        />
      )}
    </div>
  );
};

export const ReportsOverviewPage = () => (
  <ReportDomainPage
    domain="overview"
    title="Visão Geral"
    subtitle="Principais indicadores da sua empresa em um único painel"
  />
);

export const ReportsSalesPage = () => (
  <ReportDomainPage
    domain="sales"
    title="Vendas e Pipeline"
    subtitle="Receita, conversão e desempenho comercial com dados realizados"
  />
);

export const ReportsCustomersPage = () => (
  <ReportDomainPage
    domain="customers"
    title="Clientes"
    subtitle="Atividade, receita e comportamento observável da sua base"
  />
);

export const ReportsFinancialPage = () => (
  <ReportDomainPage
    domain="financial"
    title="Financeiro"
    subtitle="Contas, inadimplência, agenda financeira e DRE gerencial"
  />
);

export const ReportsInventoryPage = () => (
  <ReportDomainPage
    domain="inventory"
    title="Estoque e Compras"
    subtitle="Rupturas, saídas, movimentações e desempenho de compras"
  />
);

export const ReportsIntelligencePage: React.FC = () => {
  const {
    data: notifications,
    isLoading,
    isError,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useNotifications({ limit: 50 });
  const intelligence = useMemo(() => {
    const items = notifications ?? [];
    return {
      critical: items.filter((item) => item.priority === 'critica').length,
      high: items.filter((item) => item.priority === 'alta').length,
      unread: items.filter((item) => item.status === 'unread').length,
      total: items.length,
      ordered: [...items].sort(
        (first, second) =>
          NOTIFICATION_PRIORITY_ORDER[first.priority] -
            NOTIFICATION_PRIORITY_ORDER[second.priority] ||
          new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
      ),
    };
  }, [notifications]);

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Central de Inteligência"
        subtitle="Insights e ações baseados nos eventos reais registrados pela Gestly"
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <MetricCard
              key={index}
              title="Carregando"
              value=""
              icon={<Bell className="h-5 w-5" />}
              description="Carregando indicadores"
              isLoading
            />
          ))}
        </div>
      ) : isError ? (
        <ReportErrorState
          title="Não foi possível carregar a Central de Inteligência"
          description="Os alertas existentes foram preservados. Tente atualizar a consulta."
          onRetry={() => void refetch()}
        />
      ) : !notifications?.length ? (
        <ReportEmptyState
          title="Nenhum insight no momento"
          description="A Gestly exibirá alertas baseados nos eventos reais da sua empresa assim que houver sinais relevantes."
          icon={<Bell className="h-9 w-9" />}
          minHeight={360}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Críticos"
              value={intelligence.critical}
              icon={<Flame className="h-5 w-5" />}
              description="Alertas classificados como críticos."
              accent="red"
            />
            <MetricCard
              title="Alta prioridade"
              value={intelligence.high}
              icon={<Bell className="h-5 w-5" />}
              description="Alertas classificados com prioridade alta."
              accent="amber"
            />
            <MetricCard
              title="Não lidos"
              value={intelligence.unread}
              icon={<Inbox className="h-5 w-5" />}
              description="Alertas que ainda não foram abertos."
              accent="blue"
            />
            <MetricCard
              title="Sinais ativos"
              value={intelligence.total}
              icon={<Clock3 className="h-5 w-5" />}
              description="Total de alertas retornados na consulta atual."
              accent="purple"
            />
          </div>

          <DashboardSection
            title="Fila priorizada"
            description="Eventos reais ordenados pela regra de prioridade da central, com ações vinculadas quando disponíveis."
            icon={<Bell className="h-5 w-5" />}
            action={
              <DataFreshnessIndicator
                updatedAt={dataUpdatedAt}
                onRefresh={() => void refetch()}
                isRefreshing={isFetching}
              />
            }
          >
            <div className="space-y-3">
              {intelligence.ordered.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} />
              ))}
            </div>
          </DashboardSection>
        </>
      )}
    </div>
  );
};

export const ReportsCustomPage: React.FC = () => (
  <div className="space-y-5 animate-fade-in">
    <PageHeader
      title="Relatórios Personalizados"
      subtitle="Construtor de relatórios em planejamento"
    />
    <ReportEmptyState
      title="Recurso em breve"
      description="O construtor, o salvamento e o agendamento de relatórios ainda não estão disponíveis. Nenhuma configuração será simulada nesta tela."
      icon={<SlidersHorizontal className="h-9 w-9" />}
      minHeight={360}
    />
  </div>
);
