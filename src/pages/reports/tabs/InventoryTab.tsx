import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, Boxes, Package, PackageCheck, ShoppingCart, TimerOff, XCircle } from 'lucide-react';
import { Column } from '../../../components/shared/DataTable';
import { InventoryReport } from '../../../services/reportService';
import { formatDate } from '../reportFormatters';
import { ChartCard } from '../components/ChartCard';
import { DashboardSection } from '../components/DashboardSection';
import { DataFreshnessIndicator } from '../components/DataFreshnessIndicator';
import { ExportButton } from '../components/ExportButton';
import { MetricCard } from '../components/MetricCard';
import { ReportDataTable } from '../components/ReportDataTable';
import { ReportErrorState } from '../components/ReportErrorState';

interface InventoryTabProps {
  data?: InventoryReport;
  isLoading: boolean;
  isError: boolean;
  formatCurrency: (value?: number) => string;
  onExport: () => void;
  onRetry: () => void;
  updatedAt?: number;
  periodLabel: string;
}

const compactCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(value);

export const InventoryTab: React.FC<InventoryTabProps> = ({
  data,
  isLoading,
  isError,
  formatCurrency,
  onExport,
  onRetry,
  updatedAt,
  periodLabel,
}) => {
  const navigate = useNavigate();
  if (isError) return <ReportErrorState onRetry={onRetry} />;

  const noExitColumns: Column<InventoryReport['withoutExitProducts'][number]>[] = [
    { key: 'productName', label: 'Produto' },
    { key: 'sku', label: 'SKU' },
    { key: 'currentQuantity', label: 'Estoque atual' },
    {
      key: 'knownCostValue',
      label: 'Valor a custo',
      render: (row) => row.knownCostValue == null
        ? <span className="text-xs font-semibold text-amber-600 dark:text-amber-300">Custo não informado</span>
        : formatCurrency(row.knownCostValue),
    },
  ];

  const movementColumns: Column<InventoryReport['movements'][number]>[] = [
    { key: 'date', label: 'Data', render: (row) => formatDate(row.date) },
    { key: 'productName', label: 'Produto' },
    {
      key: 'type',
      label: 'Tipo',
      render: (row) => (
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.type === 'in' ? 'bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300'}`}>
          {row.type === 'in' ? 'Entrada' : 'Saída'}
        </span>
      ),
    },
    { key: 'quantity', label: 'Quantidade' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DataFreshnessIndicator updatedAt={updatedAt} onRefresh={onRetry} />
        <ExportButton onExport={onExport} disabled={!data} />
      </div>

      <DashboardSection
        title="Saúde operacional"
        description="Posição atual do estoque combinada com saídas e compras registradas no período."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Produtos ativos"
            value={data?.summary.activeProducts ?? 0}
            icon={<Package className="h-5 w-5" />}
            description="Produtos atualmente ativos no cadastro."
            href="/inventory"
            accent="blue"
            isLoading={isLoading}
          />
          <MetricCard
            title="Valor do estoque"
            value={data?.summary.totalValue == null ? '—' : formatCurrency(data.summary.totalValue)}
            icon={<Boxes className="h-5 w-5" />}
            description="Quantidade atual multiplicada pelo custo cadastrado; nunca usa preço de venda."
            insufficientLabel={data?.summary.totalValue == null ? `Dados insuficientes · ${Math.round(data?.summary.costCoveragePercent ?? 0)}% dos itens com custo` : undefined}
            accent="brand"
            isLoading={isLoading}
          />
          <MetricCard
            title="Estoque baixo"
            value={data?.summary.lowStock ?? 0}
            icon={<AlertTriangle className="h-5 w-5" />}
            description="Produtos com saldo positivo no ou abaixo do mínimo cadastrado."
            href="/inventory/recommendations"
            actionLabel="Revisar reposição"
            accent={(data?.summary.lowStock ?? 0) > 0 ? 'amber' : 'slate'}
            isLoading={isLoading}
          />
          <MetricCard
            title="Sem estoque"
            value={data?.summary.outOfStock ?? 0}
            icon={<XCircle className="h-5 w-5" />}
            description="Produtos ativos com quantidade atual igual ou inferior a zero."
            href="/inventory/recommendations"
            actionLabel="Ver risco de ruptura"
            accent={(data?.summary.outOfStock ?? 0) > 0 ? 'red' : 'slate'}
            isLoading={isLoading}
          />
          <MetricCard
            title="Sem saída no período"
            value={data?.summary.withoutExit ?? 0}
            icon={<TimerOff className="h-5 w-5" />}
            description="Produtos ativos com estoque positivo e nenhuma saída válida no período; não equivale a giro contábil."
            accent="purple"
            isLoading={isLoading}
          />
          <MetricCard
            title="Compras pendentes"
            value={data?.summary.pendingPurchases ?? 0}
            icon={<ShoppingCart className="h-5 w-5" />}
            description="Compras com status pendente registradas no período."
            href="/purchases"
            actionLabel="Abrir compras"
            accent={(data?.summary.pendingPurchases ?? 0) > 0 ? 'amber' : 'slate'}
            isLoading={isLoading}
          />
          <MetricCard
            title="Valor pendente"
            value={formatCurrency(data?.summary.pendingPurchaseValue)}
            icon={<PackageCheck className="h-5 w-5" />}
            description="Valor final das compras pendentes registradas no período."
            href="/purchases"
            accent="blue"
            isLoading={isLoading}
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Movimento e concentração" description="Quais categorias compõem o cadastro e quais produtos tiveram maior saída válida.">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartCard
            title="Produtos ativos por categoria"
            subtitle="Quantidade cadastrada; valor financeiro não é usado quando faltam custos."
            isLoading={isLoading}
            isEmpty={!data?.byCategory.length}
            testId="inventory-category-chart"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.byCategory.slice(0, 10)} layout="vertical" margin={{ left: 12, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="categoryName" width={125} tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value: number) => [`${value} produto(s)`, 'Produtos ativos']} />
                <Bar dataKey="count" name="Produtos ativos" fill="#0ea5e9" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Produtos com maior saída"
            subtitle={`${periodLabel} · vendas canceladas são excluídas`}
            isLoading={isLoading}
            isEmpty={!data?.topSellers.length}
            testId="inventory-top-products-chart"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.topSellers.slice(0, 8)} layout="vertical" margin={{ left: 12, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="productName" width={130} tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value: number, name: string) => name === 'Receita' ? formatCurrency(value) : value} />
                <Bar dataKey="quantitySold" name="Quantidade vendida" fill="#10b981" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Fornecedores mais utilizados"
            subtitle="Valor das compras não canceladas registradas no período."
            isLoading={isLoading}
            isEmpty={!data?.topSuppliers.length}
            testId="inventory-suppliers-chart"
            className="xl:col-span-2"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.topSuppliers.slice(0, 8)} margin={{ top: 8, right: 12, left: 0, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="supplierName" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={compactCurrency} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} width={72} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="total" name="Valor comprado" fill="#7c3aed" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </DashboardSection>

      <DashboardSection title="Detalhamento operacional" description="Listas para investigar produtos sem saída e auditar as últimas movimentações.">
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          <ReportDataTable
            title="Produtos sem saída no período"
            subtitle="Com estoque positivo; sinal de atenção, não classificação definitiva de produto parado."
            data={data?.withoutExitProducts || []}
            columns={noExitColumns}
            isLoading={isLoading}
            emptyTitle="Nenhum produto com estoque ficou sem saída"
            emptySubtitle="Todos os produtos ativos com estoque positivo tiveram saída válida."
            onRowClick={(row) => navigate(`/inventory/${row.productId}`)}
          />
          <ReportDataTable
            title="Últimas movimentações"
            subtitle="Entradas por compras e saídas por vendas válidas."
            data={data?.movements || []}
            columns={movementColumns}
            isLoading={isLoading}
            emptyTitle="Nenhuma movimentação no período"
            emptySubtitle="Compras canceladas e vendas canceladas não são exibidas."
          />
        </div>
      </DashboardSection>
    </div>
  );
};
