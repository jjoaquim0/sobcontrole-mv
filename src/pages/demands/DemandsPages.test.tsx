import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DemandDetails, DemandLinkOptions } from '@/services/demandsService';
import { useAuthStore } from '@/store/authStore';
import type { DemandStage, DemandType, Profile, ServiceDemand } from '@/types';
import { DemandDetailPage } from './DemandDetailPage';
import { DemandsPage } from './DemandsPage';
import { todayIso } from './demandsDomain';

const state = vi.hoisted(() => ({
  types: [] as unknown[],
  demands: [] as unknown[],
  details: undefined as unknown,
  options: undefined as unknown,
  ensureDefaults: vi.fn(() => Promise.resolve(2)),
  moveDetail: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

vi.mock('@/hooks/useDemands', () => ({
  useDemandTypes: () => ({
    types: state.types, isLoading: false, isError: false, refetch: vi.fn(),
    ensureDefaults: state.ensureDefaults, isEnsuringDefaults: false, saveType: vi.fn(), isSavingType: false, saveStage: vi.fn(), isSavingStage: false,
  }),
  useDemandLinkOptions: () => ({ options: state.options, isLoading: false }),
  useDemands: () => ({ demands: state.demands, isLoading: false, isError: false, refetch: vi.fn(), createDemand: vi.fn(), isCreating: false, moveDemand: vi.fn(), isMoving: false }),
  useDemandDetails: () => ({
    details: { data: state.details, isLoading: false, isError: false },
    updateDemand: vi.fn(), assignDemand: vi.fn(), moveDemand: state.moveDetail, cancelDemand: vi.fn(), addComment: vi.fn(), addEvidence: vi.fn(),
  }),
}));

const today = todayIso();
const shift = (days: number) => {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const stage = (id: string, name: string, category: DemandStage['category'], position: number, isActive = true): DemandStage => ({ id, typeId: 't1', name, category, position, isActive });
const replacementType: DemandType = {
  id: 't1', name: 'Reposição de posto', defaultDueDays: 15, isActive: true,
  stages: [
    stage('s1', 'Abertura', 'intake', 1), stage('s2', 'Triagem', 'triage', 2), stage('s3', 'Execução', 'execution', 3),
    stage('s9', 'Etapa antiga', 'execution', 4, false), stage('s4', 'Conferência', 'review', 5), stage('s5', 'Encerramento', 'done', 6),
  ],
};
const demand = (overrides: Partial<ServiceDemand> = {}): ServiceDemand => ({
  id: 'd1', demandNumber: 1, typeId: 't1', stageId: 's1', title: 'Repor porteiro', priority: 'normal', status: 'open', createdAt: '2026-10-01T10:00:00Z', updatedAt: '', ...overrides,
});
const options: DemandLinkOptions = {
  people: [{ id: 'u1', name: 'Yuri', role: 'employee' }, { id: 'u2', name: 'Direção', role: 'manager' }],
  contracts: [{ id: 'c1', title: 'Lab Astrofísica', clientName: 'Universidade' }],
  posts: [{ id: 'p1', contractId: 'c1', name: 'Portaria A', jobFunction: 'Porteiro' }],
  allocations: [],
  employees: [],
};

beforeEach(() => {
  state.types = [];
  state.demands = [];
  state.details = undefined;
  state.options = options;
  useAuthStore.setState({ profile: { id: 'u2', role: 'manager' } as Profile });
});

afterEach(() => {
  useAuthStore.setState({ profile: null });
  vi.clearAllMocks();
});

describe('DemandsPage', () => {
  it('oferece os tipos padrão quando a empresa ainda não tem tipos', () => {
    render(<MemoryRouter><DemandsPage /></MemoryRouter>);
    expect(screen.getByText('Nenhum tipo de demanda cadastrado')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Criar tipos padrão' }));
    expect(state.ensureDefaults).toHaveBeenCalled();
  });

  it('monta uma coluna por etapa ativa e destaca atraso em vermelho e "vence hoje" em âmbar', () => {
    state.types = [replacementType];
    state.demands = [
      demand({ id: 'd1', demandNumber: 1, title: 'Atrasada', dueDate: shift(-2) }),
      demand({ id: 'd2', demandNumber: 2, title: 'Para hoje', dueDate: today, stageId: 's3' }),
      demand({ id: 'd3', demandNumber: 3, title: 'Futura', dueDate: shift(5), stageId: 's4' }),
    ];
    render(<MemoryRouter><DemandsPage /></MemoryRouter>);

    expect(screen.getAllByRole('region', { name: /^Etapa / }).map((column) => column.getAttribute('aria-label')))
      .toEqual(['Etapa Abertura', 'Etapa Triagem', 'Etapa Execução', 'Etapa Conferência', 'Etapa Encerramento']);

    const overdue = screen.getByRole('button', { name: 'Demanda #1: Atrasada' });
    expect(overdue).toHaveAttribute('data-due-state', 'overdue');
    expect(within(overdue).getByText('Atrasada há 2 dia(s)').parentElement).toHaveClass('text-red-600');
    const dueToday = screen.getByRole('button', { name: 'Demanda #2: Para hoje' });
    expect(within(dueToday).getByText('Vence hoje').parentElement).toHaveClass('text-amber-700');

    const summary = screen.getByRole('region', { name: 'Resumo das demandas' });
    expect(within(summary).getByText('Demandas abertas').previousSibling).toHaveTextContent('3');
    expect(within(summary).getByText('Atrasadas').previousSibling).toHaveTextContent('1');
    expect(within(summary).getByText('Vencem hoje').previousSibling).toHaveTextContent('1');
    expect(within(summary).getByText('Em conferência').previousSibling).toHaveTextContent('1');
  });

  it('abre a demanda de reposição já vinculada ao posto vindo do contrato', async () => {
    state.types = [{ ...replacementType, id: 't0', name: 'Ausência / ocorrência de campo' }, replacementType];
    render(<MemoryRouter initialEntries={['/demandas?nova=reposicao&posto=p1']}><Routes><Route path="/demandas" element={<DemandsPage />} /></Routes></MemoryRouter>);
    const dialog = await screen.findByRole('dialog', { name: 'Abrir demanda' });
    await waitFor(() => expect(within(dialog).getByPlaceholderText(/Repor porteiro noturno/)).toHaveValue('Reposição — Portaria A'));
    expect(within(dialog).getByRole('combobox', { name: /Tipo/ })).toHaveValue('t1');
    expect(within(dialog).getByRole('combobox', { name: 'Posto' })).toHaveValue('p1');
    expect(within(dialog).getByRole('combobox', { name: 'Contrato' })).toHaveValue('c1');
  });
});

describe('DemandDetailPage', () => {
  const details = (overrides: Partial<ServiceDemand> = {}, extra: Partial<DemandDetails> = {}): DemandDetails => ({
    demand: demand({ stageId: 's4', responsibleId: 'u1', responsibleName: 'Yuri', approverId: 'u3', approverName: 'Direção', ...overrides }),
    type: replacementType,
    comments: [{ id: 'cm1', body: 'Candidato aprovado', authorName: 'Yuri', createdAt: '2026-10-02T10:00:00Z' }],
    evidences: [
      { id: 'ev1', label: 'Admissão no DP', url: 'https://drive.google.com/x', stageName: 'Execução', addedByName: 'Yuri', createdAt: '2026-10-02T10:00:00Z' },
      { id: 'ev2', label: 'Link inseguro', url: 'javascript:alert(1)', addedByName: 'Yuri', createdAt: '2026-10-02T10:00:00Z' },
    ],
    events: [
      { id: 'e2', eventType: 'stage_changed', fromStageName: 'Triagem', toStageName: 'Execução', changedFields: ['stage_id'], note: 'Direção autorizou', actorName: 'Direção', createdAt: '2026-10-02T09:00:00Z' },
      { id: 'e1', eventType: 'demand_created', toStageName: 'Abertura', changedFields: [], actorName: 'Yuri', createdAt: '2026-10-01T10:00:00Z' },
    ],
    ...extra,
  });
  const renderDetail = () => render(
    <MemoryRouter initialEntries={['/demandas/d1']}><Routes><Route path="/demandas/:id" element={<DemandDetailPage />} /></Routes></MemoryRouter>,
  );

  it('mostra histórico, comentários e evidências, sem link fora de https', () => {
    state.details = details();
    renderDetail();
    expect(screen.getByRole('heading', { name: 'Etapa alterada' })).toBeVisible();
    expect(screen.getByText('Triagem → Execução')).toBeVisible();
    expect(screen.getByText('“Direção autorizou”')).toBeVisible();
    expect(screen.getByText('Candidato aprovado')).toBeVisible();
    expect(screen.getByRole('link', { name: /Admissão no DP/ })).toHaveAttribute('href', 'https://drive.google.com/x');
    expect(screen.queryByRole('link', { name: /Link inseguro/ })).not.toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Etapas do fluxo' })).getAllByRole('listitem')).toHaveLength(5);
  });

  it('na conferência, só o aprovador definido consegue encerrar', () => {
    state.details = details();
    const { unmount } = renderDetail();
    const approve = screen.getByRole('button', { name: /Aprovar conferência e encerrar/ });
    expect(approve).toBeDisabled();
    expect(screen.getByText('Somente o aprovador definido pode concluir a conferência e encerrar a demanda.')).toBeVisible();
    unmount();

    state.details = details({ approverId: 'u2' });
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: /Aprovar conferência e encerrar/ }));
    expect(state.moveDetail).toHaveBeenCalledWith({ toStageId: 's5' });
  });

  it('demanda encerrada mostra quem conferiu e não oferece ações de fluxo', () => {
    state.details = details({ status: 'closed', stageId: 's5', approvedByName: 'Direção', approvedAt: '2026-10-03T10:00:00Z', dueDate: shift(-10) });
    renderDetail();
    expect(screen.getByText(/Conferida por Direção/)).toBeVisible();
    expect(screen.queryByRole('button', { name: /Avançar|Aprovar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancelar demanda/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Atrasada/)).not.toBeInTheDocument();
  });
});
