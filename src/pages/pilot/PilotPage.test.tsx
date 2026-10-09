import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PilotMetrics } from '@/types';
import type { PilotOverview } from '@/services/pilotService';
import { PilotPage } from './PilotPage';

const metrics: PilotMetrics = {
  periodFrom: '2026-09-01', periodTo: '2026-09-30', computedAt: '',
  demandsClosed: 4, demandsClosedOnTime: 3, demandsOnTimePct: 75, demandsOpenWithoutResponsible: 0, demandsOpenOverdue: 0,
  replacementsClosed: 1, replacementAvgDays: 2, obligationItemsDue: 0, obligationItemsOnTime: 0, obligationItemsOnTimePct: null,
  packagesReady: 0, packagesSent: 1, usersTotal: 4, usersActive: 2, usersActivePct: 50,
  acceptance: { contractsConfirmed: 1, activePosts: 1, activeAllocations: 1, demandsFullFlow: 1, periodsControlled: 0, itemsOpenWithoutResponsible: 0 },
};

const state = vi.hoisted(() => ({
  overview: undefined as unknown,
  setCriterion: vi.fn(() => Promise.resolve()),
  captureSnapshot: vi.fn(() => Promise.resolve('s1')),
}));

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/hooks/usePilot', () => ({
  usePilot: () => ({
    indicators: { data: metrics, isLoading: false, isError: false },
    overview: { data: state.overview, isLoading: false, isError: false, refetch: vi.fn() },
    captureSnapshot: state.captureSnapshot, isCapturing: false,
    setCriterion: state.setCriterion, isSettingCriterion: false,
  }),
}));

const renderPage = () => render(<MemoryRouter><PilotPage /></MemoryRouter>);

describe('PilotPage', () => {
  beforeEach(() => {
    state.setCriterion.mockClear();
    const overview: PilotOverview = {
      snapshots: [{
        id: 'b1', label: 'Linha de base', kind: 'baseline', periodFrom: '2026-08-01', periodTo: '2026-08-31', offlineSteps: 6,
        metrics: { ...metrics, demandsOnTimePct: 50 }, createdAt: '2026-09-01T00:00:00Z',
      }],
      criteria: [],
    };
    state.overview = overview;
  });

  it('mostra os indicadores comparados com a linha de base', () => {
    renderPage();
    const card = screen.getByRole('article', { name: 'Demandas concluídas no prazo' });
    expect(within(card).getByText('75,0%')).toBeInTheDocument();
    expect(within(card).getByText('+25,0 p.p. em relação à linha de base')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Itens de comprovação conferidos até o prazo' })).getByText('—')).toBeInTheDocument();
  });

  it('lista os critérios de aceite e confirma um critério manual com observação', async () => {
    renderPage();
    const list = screen.getByRole('list', { name: 'Lista de critérios' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(7);
    expect(items[0]).toHaveAttribute('data-state', 'met');
    expect(items[2]).toHaveAttribute('data-state', 'pending');
    expect(screen.getByText('3 de 7 atendidos')).toBeInTheDocument();

    fireEvent.click(within(items[4]).getByRole('button', { name: 'Confirmar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Confirmar critério de aceite' });
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Treinamento em 10/10 com a equipe' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }));
    await vi.waitFor(() => expect(state.setCriterion).toHaveBeenCalledWith({ number: 5, confirmed: true, note: 'Treinamento em 10/10 com a equipe' }));
  });
});
