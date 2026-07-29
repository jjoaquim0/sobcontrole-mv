import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CashFlowForecastTab } from './CashFlowForecastTab';
import { CashFlowForecastResult } from '../../../services/cashFlowForecastService';

const useCashFlowForecastMock = vi.fn();
const useFinancialMock = vi.fn();

vi.mock('../../../hooks/useCashFlowForecast', () => ({
  useCashFlowForecast: (...args: unknown[]) => useCashFlowForecastMock(...args),
}));

vi.mock('../../../hooks/useFinancial', () => ({
  useFinancial: (...args: unknown[]) => useFinancialMock(...args),
}));

vi.mock('./ManualEntryModal', () => ({
  ManualEntryModal: () => null,
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AreaChart: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Area: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  CartesianGrid: () => <div />,
  ReferenceLine: () => <div />,
}));

const baseFinancialState = {
  createManualReceivable: vi.fn(),
  isCreatingReceivable: false,
  createManualPayable: vi.fn(),
  isCreatingPayable: false,
};

const buildForecast = (overrides: Partial<CashFlowForecastResult> = {}): CashFlowForecastResult => ({
  scenario: 'base',
  startDate: '2026-07-19',
  endDate: '2026-07-21',
  granularity: 'day',
  currentBalance: 1000,
  totalInflows: 500,
  totalOutflows: 200,
  projectedEndBalance: 1300,
  lowestBalance: { amount: 900, date: '2026-07-19' },
  negativeDate: null,
  overdueReceivablesTotal: 0,
  overduePayablesTotal: 0,
  buckets: [
    {
      key: '2026-07-19',
      label: '19/07',
      periodStart: '2026-07-19',
      periodEnd: '2026-07-19',
      openingBalance: 1000,
      inflows: 0,
      outflows: 0,
      closingBalance: 1000,
      status: 'healthy',
      entries: [],
    },
    {
      key: '2026-07-20',
      label: '20/07',
      periodStart: '2026-07-20',
      periodEnd: '2026-07-20',
      openingBalance: 1000,
      inflows: 500,
      outflows: 0,
      closingBalance: 1500,
      status: 'healthy',
      entries: [
        {
          id: 'r1',
          type: 'in',
          amount: 500,
          dueDate: '2026-07-20T12:00:00.000Z',
          description: 'Recebimento Teste',
          status: 'previsto',
        },
      ],
    },
    {
      key: '2026-07-21',
      label: '21/07',
      periodStart: '2026-07-21',
      periodEnd: '2026-07-21',
      openingBalance: 1500,
      inflows: 0,
      outflows: 200,
      closingBalance: 1300,
      status: 'healthy',
      entries: [
        {
          id: 'p1',
          type: 'out',
          amount: 200,
          dueDate: '2026-07-21T12:00:00.000Z',
          description: 'Pagamento Teste',
          status: 'previsto',
        },
      ],
    },
  ],
  alerts: [],
  ...overrides,
});

describe('CashFlowForecastTab', () => {
  beforeEach(() => {
    useFinancialMock.mockReturnValue(baseFinancialState);
  });

  it('renderiza o cabeçalho mesmo durante o carregamento, sem quebrar', () => {
    useCashFlowForecastMock.mockReturnValue({
      forecast: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
      dataUpdatedAt: undefined,
    });

    render(<CashFlowForecastTab />);

    expect(screen.getByText('Previsão de Fluxo de Caixa')).toBeInTheDocument();
  });

  it('mostra estado de erro com opção de tentar novamente', () => {
    const refetch = vi.fn();
    useCashFlowForecastMock.mockReturnValue({
      forecast: undefined,
      isLoading: false,
      isError: true,
      refetch,
      dataUpdatedAt: undefined,
    });

    render(<CashFlowForecastTab />);

    expect(screen.getByText('Erro ao carregar a previsão de fluxo de caixa.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Tentar novamente'));
    expect(refetch).toHaveBeenCalled();
  });

  it('mostra o estado vazio honesto quando não há lançamentos nem saldo', () => {
    useCashFlowForecastMock.mockReturnValue({
      forecast: buildForecast({
        currentBalance: 0,
        totalInflows: 0,
        totalOutflows: 0,
        projectedEndBalance: 0,
        lowestBalance: { amount: 0, date: '2026-07-19' },
        buckets: [
          {
            key: '2026-07-19',
            label: '19/07',
            periodStart: '2026-07-19',
            periodEnd: '2026-07-19',
            openingBalance: 0,
            inflows: 0,
            outflows: 0,
            closingBalance: 0,
            status: 'healthy',
            entries: [],
          },
        ],
      }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      dataUpdatedAt: Date.now(),
    });

    render(<CashFlowForecastTab />);

    expect(
      screen.getByText(/Registre contas a pagar, contas a receber ou lançamentos previstos/),
    ).toBeInTheDocument();
  });

  it('mostra cards, tabela e a ausência de alertas quando o período está saudável', () => {
    useCashFlowForecastMock.mockReturnValue({
      forecast: buildForecast(),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      dataUpdatedAt: Date.now(),
    });

    render(<CashFlowForecastTab />);

    expect(screen.getAllByText(/R\$\s*1\.000,00/).length).toBeGreaterThan(0);
    expect(screen.getByText('20/07')).toBeInTheDocument();
    expect(screen.getByText('21/07')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma atenção identificada no período selecionado.')).toBeInTheDocument();
  });

  it('exibe o alerta de saldo negativo quando o service reporta uma data negativa', () => {
    useCashFlowForecastMock.mockReturnValue({
      forecast: buildForecast({
        negativeDate: '2026-07-20',
        alerts: [
          {
            id: 'negative-balance-2026-07-20',
            type: 'negative_balance',
            severity: 'critical',
            title: 'Possível saldo negativo em breve',
            description: 'O saldo projetado pode ficar negativo em 20/07.',
            bucketKey: '2026-07-20',
            amount: -100,
          },
        ],
      }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      dataUpdatedAt: Date.now(),
    });

    render(<CashFlowForecastTab />);

    expect(screen.getByText('Possível saldo negativo em breve')).toBeInTheDocument();
  });

  it('aciona onViewReceivables ao clicar na ação do alerta de contas vencidas', () => {
    const onViewReceivables = vi.fn();
    useCashFlowForecastMock.mockReturnValue({
      forecast: buildForecast({
        overdueReceivablesTotal: 100,
        alerts: [
          {
            id: 'overdue-receivables',
            type: 'overdue_receivables',
            severity: 'warning',
            title: 'Contas a receber vencidas',
            description: 'Existem recebimentos vencidos e ainda em aberto.',
            amount: 100,
          },
        ],
      }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      dataUpdatedAt: Date.now(),
    });

    render(<CashFlowForecastTab onViewReceivables={onViewReceivables} />);

    fireEvent.click(screen.getByText('Ver contas a receber'));
    expect(onViewReceivables).toHaveBeenCalledTimes(1);
  });

  it('expande uma linha da tabela para mostrar os lançamentos que a compõem', () => {
    useCashFlowForecastMock.mockReturnValue({
      forecast: buildForecast(),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      dataUpdatedAt: Date.now(),
    });

    render(<CashFlowForecastTab />);

    expect(screen.queryByText('Recebimento Teste')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('20/07'));
    expect(screen.getByText('Recebimento Teste')).toBeInTheDocument();
  });
});
