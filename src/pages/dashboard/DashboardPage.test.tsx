import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardPage } from './DashboardPage';

const useAuthMock = vi.fn();
const useDashboardMock = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../../hooks/useDashboard', () => ({
  useDashboard: () => useDashboardMock(),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AreaChart: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Area: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
}));

const queryState = <T,>(data: T) => ({
  data,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
});
const baseDashboardState = {
  sales: queryState({
    totalSales: 12,
    monthlyRevenue: 24000,
    averageTicket: 2000,
    salesVariance: 8,
    revenueVariance: 12,
    ticketVariance: 3,
  }),
  inventory: queryState({ lowStockCount: 2, totalInventoryValue: 50000 }),
  customer: queryState({ activeCustomers: 34, newCustomersThisMonth: 4 }),
  financial: queryState({ toReceive: 9000, toPay: 3500, overdueReceive: 1200, overduePay: 800 }),
  activity: queryState([]),
  weeklySales: queryState([
    { day: 'Seg', value: 1000 },
    { day: 'Ter', value: 2000 },
  ]),
  topProducts: queryState([]),
  financialHealth: queryState(82),
  purchases: queryState({ totalPurchasesThisMonth: 5, totalSpentThisMonth: 2800 }),
};

describe('DashboardPage next actions', () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({
      company: { name: 'Empresa Exemplo' },
      profile: { name: 'Ana Souza' },
    });
    useDashboardMock.mockReturnValue(baseDashboardState);
  });

  it('shows only recommendations supported by existing dashboard data', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Próximas Ações' })).toBeInTheDocument();
    expect(screen.getByText('Revise o estoque baixo')).toBeInTheDocument();
    expect(screen.getByText('Acompanhe os recebimentos vencidos')).toBeInTheDocument();
    expect(screen.getByText('Regularize os pagamentos vencidos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Abrir estoque/ })).toHaveAttribute('href', '/inventory');
    expect(screen.getByRole('link', { name: /Ver contas/ })).toHaveAttribute('href', '/financial');
  });

  it('renders the honest no-action state when monitored values are zero', () => {
    useDashboardMock.mockReturnValue({
      ...baseDashboardState,
      inventory: queryState({ lowStockCount: 0, totalInventoryValue: 50000 }),
      financial: queryState({ toReceive: 9000, toPay: 3500, overdueReceive: 0, overduePay: 0 }),
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Nenhuma ação crítica entre os sinais monitorados')).toBeInTheDocument();
  });

  it('keeps quick-action destinations and uses the neutral button style', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    const newSaleButton = screen.getByRole('button', { name: 'Nova Venda' });
    expect(newSaleButton).toHaveClass('bg-black/[0.015]');
    expect(newSaleButton.className).not.toContain('bg-gradient');
    expect(screen.getByRole('button', { name: 'Novo Produto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novo Cliente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver Relatórios' })).toBeInTheDocument();
  });
});
