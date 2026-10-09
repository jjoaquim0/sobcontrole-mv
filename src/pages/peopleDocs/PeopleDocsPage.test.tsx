import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PeopleDocsOverview } from '@/services/peopleDocsService';
import { PeopleDocsPage } from './PeopleDocsPage';
import { todayIso } from './peopleDocsDomain';

const state = vi.hoisted(() => ({
  data: undefined as unknown,
  reviewDocument: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

vi.mock('@/hooks/usePeopleDocs', () => ({
  usePeopleDocs: () => ({
    overview: { data: state.data, isLoading: false, isError: false, refetch: vi.fn() },
    saveRequirement: vi.fn(), isSavingRequirement: false,
    submitDocument: vi.fn(), isSubmittingDocument: false,
    reviewDocument: state.reviewDocument, isReviewingDocument: false,
    registerAbsence: vi.fn(), isRegisteringAbsence: false,
    cancelAbsence: vi.fn(), isCancelingAbsence: false,
    registerDelivery: vi.fn(), isRegisteringDelivery: false,
    returnDelivery: vi.fn(), isReturningDelivery: false,
  }),
}));

const today = todayIso();
const shift = (days: number) => {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const overview = (): PeopleDocsOverview => ({
  contracts: [{ id: 'c1', title: 'Prefeitura', clientName: 'Município', status: 'active' }],
  posts: [{ id: 'p1', contractId: 'c1', name: 'Portaria', jobFunction: 'Porteiro', status: 'active' }],
  allocations: [
    { id: 'a1', postId: 'p1', employeeId: 'e1', allocationRole: 'holder', startDate: shift(-60) },
    { id: 'a2', postId: 'p1', employeeId: 'e2', allocationRole: 'substitute', startDate: shift(-60) },
  ],
  employees: [
    { id: 'e1', fullName: 'Ana Souza', jobTitle: 'Porteira', status: 'active' },
    { id: 'e2', fullName: 'Bruno Lima', jobTitle: 'Porteiro', status: 'active' },
  ],
  requirements: [{ id: 'aso', name: 'ASO', target: 'employee', validityMonths: 12, isActive: true }],
  records: [{
    id: 'r1', requirementId: 'aso', employeeId: 'e2', status: 'submitted', issuedOn: shift(-1), expiresOn: shift(360),
    documentUrl: 'https://docs.exemplo.com/aso.pdf', submittedByName: 'Gestor', createdAt: `${today}T10:00:00Z`,
  }],
  absences: [{ id: 'f1', employeeId: 'e1', employeeName: 'Ana Souza', kind: 'vacation', startDate: shift(-2), endDate: shift(10), createdAt: `${today}T09:00:00Z` }],
  deliveries: [],
  events: [],
});

const renderPage = (path = '/documentacao') => render(<MemoryRouter initialEntries={[path]}><PeopleDocsPage /></MemoryRouter>);

beforeEach(() => {
  state.data = overview();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('PeopleDocsPage', () => {
  it('lista quem não entregou e permite conferir o que chegou', () => {
    renderPage();
    const list = screen.getByRole('list', { name: 'Pendências de documentos' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Ana Souza');
    expect(items[0]).toHaveTextContent('Não entregue');
    expect(items[1]).toHaveTextContent('Bruno Lima');
    expect(items[1]).toHaveTextContent('Aguardando conferência');

    fireEvent.click(within(items[1]).getByRole('button', { name: 'Conferir' }));
    expect(state.reviewDocument).toHaveBeenCalledWith({ recordId: 'r1', approve: true });
  });

  it('filtra pelo funcionário vindo da tela do contrato', () => {
    renderPage('/documentacao?funcionario=e1');
    const items = within(screen.getByRole('list', { name: 'Pendências de documentos' })).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('Ana Souza');
  });

  it('mostra as férias em curso com o posto do titular', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Férias e afastamentos' }));
    const item = within(screen.getByRole('list', { name: 'Férias e afastamentos' })).getByRole('listitem');
    expect(item).toHaveTextContent('Ana Souza');
    expect(item).toHaveTextContent('Férias');
    expect(item).toHaveTextContent('Titular em: Portaria (Prefeitura)');
  });
});
