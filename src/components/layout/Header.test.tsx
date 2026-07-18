import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Header } from './Header';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    profile: null,
    company: null,
    subscription: null,
    signOut: vi.fn(),
  }),
}));

vi.mock('../../store/themeStore', () => ({
  useThemeStore: () => ({
    theme: 'light',
    toggleTheme: vi.fn(),
  }),
}));

vi.mock('../notifications/NotificationBell', () => ({
  NotificationBell: () => <button type="button">Notificações</button>,
}));

describe('Header notifications layer', () => {
  it('permite que o dropdown ultrapasse o cabeçalho sem ser recortado', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    const header = screen.getByRole('banner');
    expect(header).toHaveClass('panel-glass', '!overflow-visible', 'z-30');
  });
});
