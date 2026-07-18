import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationDropdown } from './NotificationDropdown';
import type { Notification } from '../../types';

const mocks = vi.hoisted(() => ({
  notifications: [] as Notification[],
  isLoading: false,
  isError: false,
  unreadCount: 0 as number | undefined,
  refetch: vi.fn(),
  markAllAsRead: vi.fn(),
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
  useNotifications: () => ({
    data: mocks.notifications,
    isLoading: mocks.isLoading,
    isError: mocks.isError,
    refetch: mocks.refetch,
  }),
  useUnreadCount: () => ({ data: mocks.unreadCount }),
  useNotificationMutations: () => ({
    markAsRead: vi.fn(),
    markAllAsRead: mocks.markAllAsRead,
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

const baseNotification: Notification = {
  id: 'n1',
  companyId: 'c1',
  recipientUserId: 'u1',
  category: 'pipeline',
  eventType: 'deal_stale',
  priority: 'alta',
  title: 'Negócio parado: Reforma Cozinha',
  message: 'Está há 7 dias sem movimentação.',
  channels: ['email'],
  status: 'unread',
  relatedEntityType: 'deal',
  relatedEntityId: 'deal-1',
  createdAt: '2026-07-10T12:00:00.000Z',
};

const renderDropdown = (onClose = vi.fn()) => {
  render(
    <MemoryRouter>
      <NotificationDropdown isOpen onClose={onClose} />
    </MemoryRouter>
  );
  return { onClose };
};

describe('NotificationDropdown', () => {
  beforeEach(() => {
    mocks.notifications = [];
    mocks.isLoading = false;
    mocks.isError = false;
    mocks.unreadCount = 0;
    mocks.refetch = vi.fn();
    mocks.markAllAsRead = vi.fn();
  });

  it('mostra carregamento enquanto busca as notificações', () => {
    mocks.isLoading = true;
    renderDropdown();
    expect(screen.getByRole('status', { name: 'Carregando notificações' })).toBeInTheDocument();
  });

  it('mostra erro com opção de tentar novamente, sem quebrar a interface', () => {
    mocks.isError = true;
    renderDropdown();
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar as notificações.');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });

  it('mostra estado vazio quando não há notificações', () => {
    renderDropdown();
    expect(screen.getByText('Nenhuma notificação por aqui.')).toBeInTheDocument();
  });

  it('lista as notificações do usuário com título, mensagem, categoria/prioridade e ação de abrir', () => {
    mocks.notifications = [baseNotification];
    renderDropdown();
    expect(screen.getByText('Negócio parado: Reforma Cozinha')).toBeInTheDocument();
    expect(screen.getByText('Está há 7 dias sem movimentação.')).toBeInTheDocument();
    expect(screen.getByText('Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Alta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir' })).toBeInTheDocument();
  });

  it('exibe "Marcar todas como lidas" apenas quando há não lidas, e aciona a mutação', () => {
    mocks.unreadCount = 3;
    renderDropdown();
    fireEvent.click(screen.getByRole('button', { name: 'Marcar todas como lidas' }));
    expect(mocks.markAllAsRead).toHaveBeenCalledTimes(1);
  });

  it('não exibe "Marcar todas como lidas" quando não há não lidas', () => {
    renderDropdown();
    expect(screen.queryByRole('button', { name: 'Marcar todas como lidas' })).not.toBeInTheDocument();
  });

  it('fecha ao clicar fora do painel', () => {
    const { onClose } = renderDropdown();
    fireEvent.click(screen.getByTestId('notification-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fecha e navega para a central de notificações ao clicar em "Ver todas"', () => {
    const { onClose } = renderDropdown();
    fireEvent.click(screen.getByRole('button', { name: 'Ver todas as notificações' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
