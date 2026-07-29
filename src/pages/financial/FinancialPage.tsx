import React, { useState } from 'react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatCard } from '../../components/shared/StatCard';
import { useDashboard } from '../../hooks/useDashboard';
import { ReceivablesTab } from './components/ReceivablesTab';
import { PayablesTab } from './components/PayablesTab';
import { CashFlowTab } from './components/CashFlowTab';
import { CashFlowForecastTab } from './components/CashFlowForecastTab';
import { CategoriesTab } from './components/CategoriesTab';
import { ArrowDownCircle, ArrowUpCircle, AlertTriangle, Loader2, Tag, TrendingUp, Wallet } from 'lucide-react';

type FinancialTab = 'receivables' | 'payables' | 'cashflow' | 'forecast' | 'categories';

const formatMoney = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const TABS: { key: FinancialTab; label: string }[] = [
  { key: 'receivables', label: 'Contas a Receber' },
  { key: 'payables', label: 'Contas a Pagar' },
  { key: 'cashflow', label: 'Fluxo de Caixa' },
  { key: 'forecast', label: 'Previsão de Caixa' },
  { key: 'categories', label: 'Categorias' },
];

export const FinancialPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<FinancialTab>('receivables');
  const { financial } = useDashboard();
  const summary = financial.data;
  const isSummaryLoading = financial.isLoading;

  const renderStat = (value: number) =>
    isSummaryLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : formatMoney(value);

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Financeiro"
        subtitle="Contas a receber, a pagar, fluxo de caixa e categorias"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="A Receber"
          value={renderStat(summary?.toReceive || 0)}
          icon={<ArrowDownCircle className="w-5 h-5" />}
          accentColor="green"
        />
        <StatCard
          title="A Pagar"
          value={renderStat(summary?.toPay || 0)}
          icon={<ArrowUpCircle className="w-5 h-5" />}
          accentColor="blue"
        />
        <StatCard
          title="Vencidas a Receber"
          value={renderStat(summary?.overdueReceive || 0)}
          icon={<AlertTriangle className="w-5 h-5" />}
          accentColor="yellow"
        />
        <StatCard
          title="Vencidas a Pagar"
          value={renderStat(summary?.overduePay || 0)}
          icon={<AlertTriangle className="w-5 h-5" />}
          accentColor="red"
        />
      </div>

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
                {tab.key === 'receivables' && <ArrowDownCircle className="w-4 h-4" />}
                {tab.key === 'payables' && <ArrowUpCircle className="w-4 h-4" />}
                {tab.key === 'cashflow' && <Wallet className="w-4 h-4" />}
                {tab.key === 'forecast' && <TrendingUp className="w-4 h-4" />}
                {tab.key === 'categories' && <Tag className="w-4 h-4" />}
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      <div>
        {activeTab === 'receivables' && <ReceivablesTab />}
        {activeTab === 'payables' && <PayablesTab />}
        {activeTab === 'cashflow' && <CashFlowTab />}
        {activeTab === 'forecast' && (
          <CashFlowForecastTab
            onViewReceivables={() => setActiveTab('receivables')}
            onViewPayables={() => setActiveTab('payables')}
          />
        )}
        {activeTab === 'categories' && <CategoriesTab />}
      </div>
    </div>
  );
};

export default FinancialPage;
