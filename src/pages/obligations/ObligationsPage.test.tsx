import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ObligationsOverview } from '@/services/obligationsService';
import { ObligationsPage } from './ObligationsPage';
import { todayIso } from './obligationsDomain';

const state = vi.hoisted(() => ({
  data: undefined as unknown,
  openPeriod: vi.fn(() => Promise.resolve('per1')),
  reviewItem: vi.fn(() => Promise.resolve()),
  markReady: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

vi.mock('@/hooks/useObligations', () => ({
  useObligations: () => ({
    overview: { data: state.data, isLoading: false, isError: false, refetch: vi.fn() },
    saveTemplate: vi.fn(), isSavingTemplate: false,
    openPeriod: state.openPeriod, isOpeningPeriod: false,
    addItem: vi.fn(), isAddingItem: false,
    updateItem: vi.fn(), isUpdatingItem: false,
    submitItem: vi.fn(), isSubmittingItem: false,
    reviewItem: state.reviewItem, isReviewingItem: false,
    waiveItem: vi.fn(), isWaivingItem: false,
    markReady: state.markReady, isMarkingReady: false,
    reopenPeriod: vi.fn(), isReopening: false,
    markSent: vi.fn(), isMarkingSent: false,
  }),
}));

const today = todayIso();
const shift = (days: number) => {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const base = (): ObligationsOverview => ({
  contracts: [{ id: 'c1', title: 'Lab Astrofísica', clientName: 'Universidade', status: 'active' }, { id: 'c2', title: 'Rascunho', clientName: 'X', status: 'draft' }],
  people: [{ id: 'u1', name: 'Yuri', role: 'employee' }],
  templates: [
    { id: 't1', name: 'Folha de ponto', recurrence: 'monthly', dueDay: 5, dueMonthOffset: 1, requiresEvidence: true, isActive: true },
    { id: 't2', name: 'Certidão anual', contractId: 'c1', recurrence: 'yearly', referenceMonth: 7, dueDay: 15, dueMonthOffset: 0, requiresEvidence: true, isActive: true },
  ],
  periods: [],
  items: [],
  events: [],
});

const renderPage = (path: string) => render(<MemoryRouter initialEntries={[path]}><ObligationsPage /></MemoryRouter>);

beforeEach(() => {
  state.data = base();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ObligationsPage', () => {
  it('mostra o que entra na competência antes de abrir', () => {
    renderPage('/obrigacoes?competencia=2026-08');
    expect(screen.getByText('agosto/2026 ainda não foi aberta')).toBeVisible();
    expect(screen.getByText(/Folha de ponto/)).toBeVisible();
    expect(screen.queryByText(/Certidão anual/)).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Rascunho/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir competência' }));
    expect(state.openPeriod).toHaveBeenCalledWith({ contractId: 'c1', competence: '2026-08-01' });
  });

  it('confere itens e só fecha o pacote com tudo concluído', () => {
    const data = base();
    data.periods = [{ id: 'per1', contractId: 'c1', contractTitle: 'Lab Astrofísica', competence: '2026-08-01', status: 'open' }];
    data.items = [
      { id: 'i1', periodId: 'per1', templateId: 't1', name: 'Folha de ponto', dueDate: shift(-2), requiresEvidence: true, status: 'submitted', evidenceUrl: 'https://drive/ponto', responsibleName: 'Yuri' },
      { id: 'i2', periodId: 'per1', name: 'Ofício', dueDate: shift(5), requiresEvidence: false, status: 'verified' },
    ];
    state.data = data;
    renderPage('/obrigacoes?competencia=2026-08');

    expect(screen.getByLabelText('Progresso da competência')).toHaveTextContent('1 de 2 item(ns) conferido(s) ou dispensado(s) · 1 aguardando conferência · 1 atrasado(s)');
    expect(screen.getByRole('button', { name: 'Fechar pacote' })).toBeDisabled();
    const item = within(screen.getByRole('list', { name: 'Itens da competência' })).getAllByRole('listitem')[0];
    expect(item).toHaveTextContent('Atrasado há 2 dia(s)');
    fireEvent.click(within(item).getByRole('button', { name: 'Conferir' }));
    expect(state.reviewItem).toHaveBeenCalledWith({ itemId: 'i1', approve: true });
  });

  it('lista pendências de todas as competências abertas na agenda', () => {
    const data = base();
    data.periods = [
      { id: 'per1', contractId: 'c1', contractTitle: 'Lab Astrofísica', competence: '2026-08-01', status: 'open' },
      { id: 'per2', contractId: 'c1', contractTitle: 'Lab Astrofísica', competence: '2026-07-01', status: 'sent', readyAt: 'x', sentOn: '2026-08-10', sentTo: 'Fiscal', sentProofUrl: 'https://x' },
    ];
    data.items = [
      { id: 'i1', periodId: 'per1', name: 'Folha de ponto', dueDate: shift(3), requiresEvidence: true, status: 'pending' },
      { id: 'i2', periodId: 'per2', name: 'Item antigo', dueDate: shift(-30), requiresEvidence: true, status: 'pending' },
    ];
    state.data = data;
    renderPage('/obrigacoes?aba=agenda');
    const agenda = within(screen.getByRole('list', { name: 'Agenda de obrigações' })).getAllByRole('listitem');
    expect(agenda).toHaveLength(1);
    expect(agenda[0]).toHaveTextContent('Folha de ponto');
    expect(agenda[0]).toHaveTextContent('Sem responsável');
  });
});
