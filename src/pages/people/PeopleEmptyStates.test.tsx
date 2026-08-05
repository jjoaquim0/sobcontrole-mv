import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SalesGoalsPage } from './SalesGoalsPage';
import { TeamsPage } from './TeamsPage';

vi.mock('@/hooks/usePeople', () => ({
  useEmployees: () => ({ employees: [] }),
  useTeams: () => ({ teams: [], isLoading: false, isError: false, refetch: vi.fn(), saveTeam: vi.fn(), updateStatus: vi.fn() }),
  useTeamPerformance: () => ({ data: [] }),
  useSalesGoals: () => ({ goals: [], isLoading: false, isError: false, refetch: vi.fn(), saveGoal: vi.fn(), updateResult: vi.fn(), updateStatus: vi.fn() }),
}));

describe('people empty states', () => {
  it('shows a useful empty teams state without mock records', () => {
    render(<MemoryRouter><TeamsPage /></MemoryRouter>);
    expect(screen.getByText('Nenhuma equipe cadastrada.')).toBeVisible();
    expect(screen.queryByText('Comercial')).not.toBeInTheDocument();
  });

  it('shows an empty goals state without invented progress', () => {
    render(<MemoryRouter><SalesGoalsPage /></MemoryRouter>);
    expect(screen.getByText('Nenhuma meta encontrada.')).toBeVisible();
    expect(screen.queryByText(/100% de progresso/i)).not.toBeInTheDocument();
  });
});
