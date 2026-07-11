import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsModuleRoute } from './AnalyticsModuleRoute';

const mocks = vi.hoisted(() => ({
  accessStatus: 'available' as 'available' | 'contracted' | 'locked' | 'coming_soon',
  isLoading: false,
  isError: false,
}));

vi.mock('../hooks/useAnalyticsModules', () => ({
  useAnalyticsModules: () => ({
    modules: [{ key: 'sales_analytics', name: 'Analytics de Vendas', accessStatus: mocks.accessStatus }],
    isLoading: mocks.isLoading,
    isError: mocks.isError,
    refetch: vi.fn(),
  }),
}));

const renderGuard = () =>
  render(
    <MemoryRouter>
      <AnalyticsModuleRoute moduleKey="sales_analytics">
        <div data-testid="protected-report">Dados premium</div>
      </AnalyticsModuleRoute>
    </MemoryRouter>
  );

describe('AnalyticsModuleRoute', () => {
  beforeEach(() => {
    mocks.accessStatus = 'available';
    mocks.isLoading = false;
    mocks.isError = false;
  });

  it('renderiza o relatorio quando o modulo esta liberado', () => {
    renderGuard();
    expect(screen.getByTestId('protected-report')).toBeInTheDocument();
  });

  it('nao monta dados premium quando o modulo esta bloqueado', () => {
    mocks.accessStatus = 'locked';
    renderGuard();
    expect(screen.queryByTestId('protected-report')).not.toBeInTheDocument();
    expect(screen.getByText('Recurso premium')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver planos e benefícios' })).toBeInTheDocument();
  });

  it('nao monta o relatorio marcado como em breve', () => {
    mocks.accessStatus = 'coming_soon';
    renderGuard();
    expect(screen.queryByTestId('protected-report')).not.toBeInTheDocument();
    expect(screen.getByText('Em breve')).toBeInTheDocument();
  });
});
