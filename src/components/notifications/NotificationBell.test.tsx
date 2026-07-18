import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationBell } from './NotificationBell';
import type { Notification } from '../../types';

const mocks = vi.hoisted(() => ({
  unreadCount: undefined as number | undefined,
  notifications: [] as Notification[],
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      className,
      role,
      'aria-label': ariaLabel,
      children,
    }: {
      className?: string;
      role?: string;
      'aria-label'?: string;
      children?: ReactNode;
    }) => (
      <div className={className} role={role} aria-label={ariaLabel}>
        {children}
      </div>
    ),
  },
}));

vi.mock('../../hooks/useNotifications', () => ({
  useUnreadCount: () => ({ data: mocks.unreadCount }),
  useNotifications: () => ({ data: mocks.notifications, isLoading: false, isError: false, refetch: vi.fn() }),
  useNotificationsRealtime: () => undefined,
  useNotificationMutations: () => ({
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    markAsResolved: vi.fn(),
    archive: vi.fn(),
    snooze: vi.fn(),
    executeQuickAction: vi.fn(),
    isExecutingAction: false,
  }),
}));

vi.mock('../../hooks/useSettings', () => ({
  useSettings: () => ({ teamMembers: [] }),
}));

const renderBell = () =>
  render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>
  );

describe('NotificationBell', () => {
  beforeEach(() => {
    mocks.unreadCount = undefined;
    mocks.notifications = [];
  });

  it('renderiza fechado, com rótulo acessível e aria-expanded=false', () => {
    renderBell();
    const button = screen.getByRole('button', { name: 'Notificações' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-haspopup', 'true');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('abre o painel de notificações ao clicar no sino', () => {
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }));
    expect(screen.getByRole('button', { name: 'Notificações' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu', { name: 'Notificações' })).toBeInTheDocument();
  });

  it('fecha o painel ao clicar novamente no sino', () => {
    renderBell();
    const button = screen.getByRole('button', { name: 'Notificações' });
    fireEvent.click(button);
    expect(screen.getByRole('menu', { name: 'Notificações' })).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('fecha o painel ao pressionar Esc', () => {
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }));
    expect(screen.getByRole('menu', { name: 'Notificações' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('exibe o contador de não lidas e reflete isso no rótulo acessível', () => {
    mocks.unreadCount = 5;
    renderBell();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notificações (5 não lidas)' })).toBeInTheDocument();
  });

  it('exibe "9+" quando o total de não lidas ultrapassa 9', () => {
    mocks.unreadCount = 12;
    renderBell();
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('exibe o estado vazio ao abrir sem notificações', () => {
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }));
    expect(screen.getByText('Nenhuma notificação por aqui.')).toBeInTheDocument();
  });
});
