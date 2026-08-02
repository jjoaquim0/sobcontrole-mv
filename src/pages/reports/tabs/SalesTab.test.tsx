import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SalesReport } from '../../../services/reportService';
import { SalesTab } from './SalesTab';

vi.mock('recharts', () => {
  const Container = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="responsive-chart">{children}</div>
  );
  const Chart = ({
    children,
    data,
  }: {
    children?: React.ReactNode;
    data?: unknown;
  }) => (
    <div data-testid="recharts-chart" data-series={JSON.stringify(data)}>
      {children}
    </div>
  );
  const Part = ({ children }: { children?: React.ReactNode }) => <span>{children}</span>;

  return {
    ResponsiveContainer: Container,
    AreaChart: Chart,
    BarChart: Chart,
    FunnelChart: Chart,
    Area: Part,
    Bar: Part,
    CartesianGrid: Part,
    Cell: Part,
    Funnel: Part,
    LabelList: Part,
    Tooltip: Part,
    XAxis: Part,
    YAxis: Part,
  };
});

const data: SalesReport = {
  summary: {
    totalSales: 1,
    totalRevenue: 1250,
    averageTicket: 1250,
    totalDiscount: 0,
    pipelineValue: 3000,
    closedConversion: 50,
    stalledDeals: 1,
  },
  comparison: {
    totalSales: { current: 1, previous: 1, variance: 0 },
    totalRevenue: { current: 1250, previous: 1000, variance: 25 },
    averageTicket: { current: 1250, previous: 1000, variance: 25 },
  },
  byDay: [{ key: '2026-07-29', label: '29 jul.', count: 1, revenue: 1250 }],
  byProduct: [{ productId: 'product-1', productName: 'Café', quantity: 2, revenue: 1250 }],
  byPaymentMethod: [{ method: 'pix', count: 1, total: 1250 }],
  topCustomers: [{ customerId: 'customer-1', customerName: 'Cliente A', totalSpent: 1250, saleCount: 1 }],
  bySeller: [{ sellerId: 'seller-1', sellerName: 'Vendedora A', revenue: 1250, saleCount: 1 }],
  pipelineStages: [{ stageId: 'stage-1', stageName: 'Proposta', color: '#00a8d8', position: 1, count: 1, value: 3000 }],
  lostReasons: [{ reason: 'Preço', count: 1, value: 500 }],
  stalledOpportunities: [{
    id: 'deal-1',
    title: 'Renovação',
    customerName: 'Cliente A',
    ownerName: 'Vendedora A',
    stageName: 'Proposta',
    value: 3000,
    daysWithoutUpdate: 18,
  }],
  recentSales: [{
    id: 'sale-1',
    customerName: 'Cliente A',
    sellerName: 'Vendedora A',
    value: 1250,
    status: 'paid',
    createdAt: '2026-07-29T12:00:00.000Z',
  }],
};

const formatCurrency = (value = 0) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

describe('SalesTab', () => {
  it('renderiza Recharts de modo responsivo e reconcilia card, série e tabela', () => {
    render(
      <MemoryRouter>
        <SalesTab
          data={data}
          isLoading={false}
          isError={false}
          formatCurrency={formatCurrency}
          onExport={vi.fn()}
          onRetry={vi.fn()}
          updatedAt={Date.now()}
          periodLabel="01 jul. – 29 jul."
        />
      </MemoryRouter>
    );

    expect(screen.getAllByTestId('responsive-chart')).toHaveLength(4);
    expect(screen.getByTestId('sales-revenue-chart')).toBeInTheDocument();
    expect(
      screen.getAllByTestId('recharts-chart').some((chart) =>
        chart.getAttribute('data-series')?.includes('"revenue":1250')
      )
    ).toBe(true);
    expect(screen.getAllByText(/1\.250,00/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Cliente A').length).toBeGreaterThanOrEqual(2);
  });
});
