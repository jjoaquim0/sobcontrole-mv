import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';

const mocks = vi.hoisted(() => ({
  role: 'admin' as 'admin' | 'manager' | 'employee',
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    profile: { role: mocks.role },
    subscription: { plan: 'pro', usageCurrent: 10, usageLimit: 100 },
    hasRole: (roles: string[]) => roles.includes(mocks.role),
  }),
}));

vi.mock('../../hooks/useAnalyticsModules', () => ({
  useAnalyticsModules: () => ({
    modules: [
      { key: 'dashboard_executivo', accessStatus: 'available' },
      { key: 'gestly_insights', accessStatus: 'locked' },
      { key: 'sales_analytics', accessStatus: 'contracted' },
      { key: 'customer_analytics', accessStatus: 'locked' },
      { key: 'financial_analytics', accessStatus: 'available' },
      { key: 'inventory_analytics', accessStatus: 'coming_soon' },
      { key: 'custom_reports', accessStatus: 'coming_soon' },
    ],
    isLoading: false,
  }),
}));

const renderSidebar = (route = '/dashboard') =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <Sidebar isCollapsed={false} onToggle={vi.fn()} />
    </MemoryRouter>
  );

describe('Sidebar reports accordion', () => {
  beforeEach(() => {
    mocks.role = 'admin';
  });

  it('abre e fecha os sete itens pelo botao Relatorios', () => {
    renderSidebar();
    const trigger = screen.getByRole('button', { name: 'Relatórios' });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('link').filter((link) => link.getAttribute('href')?.startsWith('/relatorios/'))).toHaveLength(7);

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('permanece aberto e destaca o filho da rota atual', () => {
    renderSidebar('/relatorios/clientes');
    expect(screen.getByRole('button', { name: 'Relatórios' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: /Clientes.*Módulo bloqueado/ })).toHaveAttribute('aria-current', 'page');
  });

  it('exibe cadeado em modulos bloqueados', () => {
    renderSidebar('/relatorios/clientes');
    expect(screen.getAllByLabelText('Módulo bloqueado')).toHaveLength(2);
  });

  it('oculta Relatorios para employee', () => {
    mocks.role = 'employee';
    renderSidebar();
    expect(screen.queryByRole('button', { name: 'Relatórios' })).not.toBeInTheDocument();
  });
});

describe('Sidebar surface', () => {
  it('aplica o token de superfície nos temas claro e escuro', () => {
    renderSidebar();

    const sidebar = screen.getByRole('complementary');

    expect(sidebar).toHaveClass(
      'bg-themeSidebar-light',
      'dark:bg-themeSidebar-dark'
    );
    expect(sidebar.querySelector('.sidebar-divider')).toHaveClass(
      'w-px',
      'bg-themeSidebar-dividerLight',
      'dark:bg-themeSidebar-dividerDark'
    );
  });
});
