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

const renderSidebar = (route = '/dashboard', isCollapsed = false) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <Sidebar isCollapsed={isCollapsed} onToggle={vi.fn()} />
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

describe('Sidebar people accordion', () => {
  beforeEach(() => {
    mocks.role = 'admin';
  });

  it('exibe Funcionários, Comissões e Pagamentos com badge Em breve', () => {
    renderSidebar();
    const trigger = screen.getByRole('button', { name: 'Pessoas' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(screen.getByRole('link', { name: 'Funcionários' })).toHaveAttribute('href', '/pessoas/funcionarios');
    expect(screen.getByRole('link', { name: 'Comissões' })).toHaveAttribute('href', '/pessoas/comissoes');
    expect(screen.getByRole('link', { name: /Pagamentos.*Em breve/ })).toHaveAttribute('href', '/pessoas/pagamentos');
  });

  it('abre na rota de Pessoas e fica oculto para employee', () => {
    const { unmount } = renderSidebar('/pessoas/comissoes');
    expect(screen.getByRole('button', { name: 'Pessoas' })).toHaveAttribute('aria-expanded', 'true');
    unmount();
    mocks.role = 'employee';
    renderSidebar();
    expect(screen.queryByRole('button', { name: 'Pessoas' })).not.toBeInTheDocument();
  });
});

describe('Sidebar surface', () => {
  it('exibe a Gestly como navegação principal e destaca a rota ativa', () => {
    renderSidebar('/gestly');

    expect(screen.getByRole('link', { name: 'Gestly' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('exibe o lockup da marca quando expandida e só o símbolo quando recolhida', () => {
    const { unmount } = renderSidebar();

    const lockup = screen.getByRole('img', { name: 'SobControle' });
    expect(lockup).toHaveTextContent('sobcontrole');
    // Wordmark em Archivo 600, minúsculo e com tracking -3% (manual de marca).
    expect(lockup.querySelector('span')).toHaveClass(
      'font-brand',
      'font-semibold',
      'lowercase',
      'tracking-[-0.03em]'
    );

    unmount();
    renderSidebar('/dashboard', true);

    // Recolhida, o lockup não cabe nos 120px mínimos: sobra só o ícone de app.
    expect(screen.queryByRole('img', { name: 'SobControle' })).not.toBeInTheDocument();
    expect(screen.getByRole('complementary').querySelector('.rounded-\\[22\\%\\]')).toBeInTheDocument();
  });

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
