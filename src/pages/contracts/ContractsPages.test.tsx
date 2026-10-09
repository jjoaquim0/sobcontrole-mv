import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContractDetails, ContractListItem } from '@/services/contractsService';
import { ContractDetailPage } from './ContractDetailPage';
import { ContractsPage } from './ContractsPage';
import { todayIso } from './contractsDomain';

const state = vi.hoisted(() => ({ contracts: [] as unknown[], details: undefined as unknown }));

vi.mock('@/hooks/useContracts', () => ({
  useContracts: () => ({ contracts: state.contracts, isLoading: false, isError: false, refetch: vi.fn(), saveContract: vi.fn(), isSaving: false }),
  useContractDetails: () => ({
    details: { data: state.details, isLoading: false, isError: false },
    saveContract: vi.fn(), saveVersion: vi.fn(), savePost: vi.fn(), allocateEmployee: vi.fn(), endAllocation: vi.fn(),
  }),
}));
vi.mock('@/hooks/usePeople', () => ({ useEmployees: () => ({ employees: [] }) }));
vi.mock('@/hooks/usePeopleDocs', () => ({ usePeopleDocs: () => ({ overview: { data: undefined } }) }));
vi.mock('@/hooks/useCustomers', () => ({ useCustomers: () => ({ customers: [] }) }));

const today = todayIso();
const contract = (overrides: Partial<ContractListItem> = {}): ContractListItem => ({
  id: 'c1', companyId: 'company-1', clientName: 'Prefeitura', title: 'Limpeza da sede',
  validationStatus: 'confirmed', status: 'active', startDate: '2026-01-01', createdAt: '', updatedAt: '',
  activePosts: 2, requiredHeadcount: 5, uncoveredPositions: 2, postsCoveredBySubstitute: 0, ...overrides,
});

beforeEach(() => {
  state.contracts = [];
  state.details = undefined;
});

describe('ContractsPage', () => {
  it('mostra estado vazio sem inventar contratos', () => {
    render(<MemoryRouter><ContractsPage /></MemoryRouter>);
    expect(screen.getByText('Nenhum contrato cadastrado.')).toBeVisible();
  });

  it('resume contratos ativos, vigência a confirmar e vagas descobertas', () => {
    state.contracts = [contract(), contract({ id: 'c2', title: 'Portaria hospital', status: 'draft', validationStatus: 'pending', activePosts: 0, requiredHeadcount: 0, uncoveredPositions: 0 })];
    render(<MemoryRouter><ContractsPage /></MemoryRouter>);
    const summary = screen.getByRole('region', { name: 'Resumo dos contratos' });
    expect(within(summary).getByText('Contratos ativos').previousSibling).toHaveTextContent('1');
    expect(within(summary).getByText('Vigência a confirmar').previousSibling).toHaveTextContent('1');
    expect(within(summary).getByText('Vagas descobertas hoje').previousSibling).toHaveTextContent('2');
    expect(screen.getAllByText('2 vaga(s) descoberta(s)').length).toBeGreaterThan(0);
  });
});

describe('ContractDetailPage', () => {
  const renderDetail = () => render(
    <MemoryRouter initialEntries={['/contratos/c1']}><Routes><Route path="/contratos/:id" element={<ContractDetailPage />} /></Routes></MemoryRouter>,
  );

  it('mostra cobertura dos postos e bloqueia alocação em posto inativo', () => {
    const details: ContractDetails = {
      contract: contract(),
      versions: [],
      posts: [
        { id: 'p1', contractId: 'c1', name: 'Portaria A', jobFunction: 'Porteiro', workSchedule: '12x36', requiredHeadcount: 2, status: 'active', createdAt: '' },
        { id: 'p2', contractId: 'c1', name: 'Jardinagem', jobFunction: 'Jardineiro', workSchedule: '44h', requiredHeadcount: 1, status: 'inactive', createdAt: '' },
      ],
      allocations: [
        { id: 'a1', postId: 'p1', employeeId: 'e1', employeeName: 'Ana Souza', allocationRole: 'holder', startDate: '2026-01-01', createdAt: '' },
        { id: 'a2', postId: 'p1', employeeId: 'e2', employeeName: 'Bruno Lima', allocationRole: 'holder', startDate: '2026-01-01', endDate: '2026-02-01', endReason: 'Remanejado', createdAt: '' },
      ],
      absences: [],
      audit: [],
    };
    state.details = details;
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: /Postos e alocações/ }));

    const portaria = screen.getByRole('article', { name: 'Posto Portaria A' });
    expect(within(portaria).getByText('Descoberto (1)')).toBeVisible();
    expect(within(portaria).getByText('Ana Souza')).toBeVisible();
    expect(within(portaria).queryByText('Bruno Lima')).not.toBeInTheDocument();
    fireEvent.click(within(portaria).getByText(/Ver alocações encerradas \(1\)/));
    expect(within(portaria).getByText(/Bruno Lima/)).toBeVisible();

    const jardinagem = screen.getByRole('article', { name: 'Posto Jardinagem' });
    expect(within(jardinagem).getByRole('button', { name: /Alocar funcionário/ })).toBeDisabled();
  });

  it('abre demanda de reposição a partir do posto ativo', () => {
    const LocationProbe = () => { const location = useLocation(); return <p data-testid="location">{location.pathname}{location.search}</p>; };
    state.details = {
      contract: contract(),
      versions: [],
      posts: [
        { id: 'p1', contractId: 'c1', name: 'Portaria A', jobFunction: 'Porteiro', workSchedule: '12x36', requiredHeadcount: 2, status: 'active', createdAt: '' },
        { id: 'p2', contractId: 'c1', name: 'Jardinagem', jobFunction: 'Jardineiro', workSchedule: '44h', requiredHeadcount: 1, status: 'inactive', createdAt: '' },
      ],
      allocations: [],
      absences: [],
      audit: [],
    } satisfies ContractDetails;
    render(
      <MemoryRouter initialEntries={['/contratos/c1']}><Routes><Route path="/contratos/:id" element={<ContractDetailPage />} /><Route path="/demandas" element={<LocationProbe />} /></Routes></MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Postos e alocações/ }));
    expect(within(screen.getByRole('article', { name: 'Posto Jardinagem' })).getByRole('button', { name: /Abrir demanda de reposição/ })).toBeDisabled();
    fireEvent.click(within(screen.getByRole('article', { name: 'Posto Portaria A' })).getByRole('button', { name: /Abrir demanda de reposição/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/demandas?nova=reposicao&posto=p1');
  });

  it('não renderiza links de documento fora de https', () => {
    state.details = {
      contract: contract({ sourceDocumentsUrl: 'javascript:alert(1)', endDate: today }),
      versions: [], posts: [], allocations: [], absences: [], audit: [],
    } satisfies ContractDetails;
    renderDetail();
    expect(screen.queryByText('Abrir pasta de documentos')).not.toBeInTheDocument();
    expect(screen.getByText('Vence hoje')).toBeVisible();
  });

  it('não conta titular em férias na cobertura e oferece transferência', () => {
    state.details = {
      contract: contract(),
      versions: [],
      posts: [
        { id: 'p1', contractId: 'c1', name: 'Portaria A', jobFunction: 'Porteiro', workSchedule: '12x36', requiredHeadcount: 1, status: 'active', createdAt: '' },
        { id: 'p3', contractId: 'c1', name: 'Guarita', jobFunction: 'Vigia', workSchedule: '12x36', requiredHeadcount: 1, status: 'active', createdAt: '' },
      ],
      allocations: [
        { id: 'a1', postId: 'p1', employeeId: 'e1', employeeName: 'Ana Souza', allocationRole: 'holder', startDate: '2026-01-01', createdAt: '' },
      ],
      absences: [{ id: 'ab1', employeeId: 'e1', employeeName: 'Ana Souza', kind: 'vacation', startDate: '2026-01-02', endDate: '2999-12-31', createdAt: '' }],
      audit: [],
    } satisfies ContractDetails;
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: /Postos e alocações/ }));
    const portaria = screen.getByRole('article', { name: 'Posto Portaria A' });
    expect(within(portaria).getByText('Descoberto (1)')).toBeVisible();
    expect(within(portaria).getByText(/0\/1 titular\(es\) em serviço · 1 em férias\/afastamento/)).toBeVisible();
    expect(within(portaria).getByText(/Férias até 31\/12\/2999/)).toBeVisible();

    fireEvent.click(within(portaria).getByRole('button', { name: /Transferir/ }));
    const dialog = screen.getByRole('dialog', { name: 'Transferir para outro posto' });
    const options = within(dialog).getAllByRole('option').map((option) => option.textContent);
    expect(options).toContain('Guarita · Vigia · Limpeza da sede');
    expect(options.some((option) => option?.startsWith('Portaria A'))).toBe(false);
  });
});
