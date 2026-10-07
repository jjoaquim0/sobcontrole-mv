import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock, fromMock } = vi.hoisted(() => ({ rpcMock: vi.fn(), fromMock: vi.fn() }));

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: rpcMock, from: fromMock } }));

import { useAuthStore } from '@/store/authStore';
import type { Company } from '@/types';
import { allocateEmployee, contractErrorMessage, getContracts, saveContract } from './contractsService';

/** Builder encadeável que resolve com os dados configurados para cada tabela. */
const tableData: Record<string, unknown[]> = {};
const chain = (table: string) => {
  const builder: Record<string, unknown> = {};
  ['select', 'eq', 'is', 'or', 'order', 'limit', 'single'].forEach((method) => { builder[method] = () => builder; });
  builder.then = (resolve: (value: unknown) => unknown) => resolve({ data: tableData[table] ?? [], error: null });
  return builder;
};

beforeEach(() => {
  useAuthStore.setState({ company: { id: 'company-1' } as Company });
  fromMock.mockImplementation(chain);
});

afterEach(() => {
  rpcMock.mockReset();
  fromMock.mockReset();
  Object.keys(tableData).forEach((key) => delete tableData[key]);
  useAuthStore.setState({ company: null });
});

describe('saveContract', () => {
  it('envia somente parâmetros da RPC, sem company_id, e normaliza campos vazios', async () => {
    rpcMock.mockResolvedValue({ data: 'contract-1', error: null });
    await expect(saveContract({
      clientName: 'Prefeitura', title: 'Limpeza', contractNumber: '  ', validationStatus: 'pending', status: 'draft',
      sourceDocumentsUrl: ' https://docs.example.com ',
    })).resolves.toBe('contract-1');

    const [name, params] = rpcMock.mock.calls[0];
    expect(name).toBe('save_service_contract');
    expect(params).not.toHaveProperty('p_company_id');
    expect(params).toMatchObject({ p_contract_id: null, p_contract_number: null, p_source_documents_url: 'https://docs.example.com', p_start_date: null });
  });

  it('exige empresa identificada antes de chamar o banco', async () => {
    useAuthStore.setState({ company: null });
    await expect(saveContract({ clientName: 'A', title: 'B', validationStatus: 'pending', status: 'draft' })).rejects.toThrow('Empresa não identificada');
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe('contractErrorMessage', () => {
  it('repassa mensagens de validação das RPCs e esconde erros internos', () => {
    expect(contractErrorMessage({ code: '23505', message: 'Este funcionário já possui alocação aberta neste posto.' }, 'falhou'))
      .toBe('Este funcionário já possui alocação aberta neste posto.');
    expect(contractErrorMessage({ code: '42501', message: 'Acesso não autorizado.' }, 'falhou')).toBe('Você não tem permissão para realizar esta ação.');
    expect(contractErrorMessage({ code: 'XX000', message: 'relation secret does not exist' }, 'falhou')).toBe('falhou');
  });

  it('mostra a mensagem amigável quando a alocação é recusada', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: 'P0002', message: 'Posto não encontrado ou inativo.' } });
    await expect(allocateEmployee({ postId: 'p1', employeeId: 'e1', allocationRole: 'holder', startDate: '2026-10-07' }))
      .rejects.toThrow('Posto não encontrado ou inativo.');
  });
});

describe('getContracts', () => {
  it('resume postos e vagas descobertas por contrato e filtra pela busca', async () => {
    tableData.service_contracts = [
      { id: 'c1', company_id: 'company-1', client_name: 'Prefeitura', title: 'Limpeza sede', validation_status: 'confirmed', status: 'active', created_at: '', updated_at: '' },
      { id: 'c2', company_id: 'company-1', client_name: 'Hospital', title: 'Portaria', validation_status: 'pending', status: 'draft', created_at: '', updated_at: '' },
    ];
    tableData.service_posts = [
      { id: 'p1', contract_id: 'c1', required_headcount: 3, status: 'active' },
      { id: 'p2', contract_id: 'c1', required_headcount: 1, status: 'inactive' },
    ];
    tableData.service_post_allocations = [{ post_id: 'p1', allocation_role: 'holder', start_date: '2020-01-01', end_date: null }];

    const all = await getContracts();
    expect(all.find((contract) => contract.id === 'c1')).toMatchObject({ activePosts: 1, requiredHeadcount: 3, uncoveredPositions: 2 });
    expect(all.find((contract) => contract.id === 'c2')).toMatchObject({ activePosts: 0, uncoveredPositions: 0 });

    const filtered = await getContracts({ search: 'hospital' });
    expect(filtered.map((contract) => contract.id)).toEqual(['c2']);
  });
});
