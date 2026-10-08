import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock, fromMock } = vi.hoisted(() => ({ rpcMock: vi.fn(), fromMock: vi.fn() }));

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: rpcMock, from: fromMock } }));

import { useAuthStore } from '@/store/authStore';
import type { Company } from '@/types';
import { addDemandEvidence, createDemand, getDemands, moveDemand } from './demandsService';

/** Builder encadeável que resolve com os dados configurados para cada tabela. */
const tableData: Record<string, unknown[]> = {};
const orCalls: string[] = [];
const chain = (table: string) => {
  const builder: Record<string, unknown> = {};
  ['select', 'eq', 'is', 'order', 'limit', 'maybeSingle'].forEach((method) => { builder[method] = () => builder; });
  builder.or = (filter: string) => { orCalls.push(filter); return builder; };
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
  orCalls.length = 0;
  Object.keys(tableData).forEach((key) => delete tableData[key]);
  useAuthStore.setState({ company: null });
});

describe('createDemand', () => {
  it('envia somente parâmetros da RPC, sem company_id, e normaliza vínculos vazios', async () => {
    rpcMock.mockResolvedValue({ data: 'demand-1', error: null });
    await expect(createDemand({ typeId: 't1', title: 'Repor porteiro', priority: 'high', postId: 'p1', description: '  ', contractId: '' }))
      .resolves.toBe('demand-1');
    const [name, params] = rpcMock.mock.calls[0];
    expect(name).toBe('create_service_demand');
    expect(params).not.toHaveProperty('p_company_id');
    expect(params).toMatchObject({ p_post_id: 'p1', p_contract_id: null, p_description: null, p_due_date: null, p_responsible_id: null });
  });

  it('exige empresa identificada antes de chamar o banco', async () => {
    useAuthStore.setState({ company: null });
    await expect(createDemand({ typeId: 't1', title: 'X', priority: 'normal' })).rejects.toThrow('Empresa não identificada');
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe('moveDemand', () => {
  it('repassa a regra de transição recusada pelo banco', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: '22023', message: 'Somente o aprovador definido pode concluir a conferência e encerrar a demanda.' } });
    await expect(moveDemand('d1', 's5')).rejects.toThrow('Somente o aprovador definido');
    expect(rpcMock.mock.calls[0][1]).toEqual({ p_demand_id: 'd1', p_to_stage_id: 's5', p_note: null });
  });

  it('esconde erros internos e traduz falta de permissão', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: 'XX000', message: 'relation secret does not exist' } });
    await expect(moveDemand('d1', 's2', 'motivo')).rejects.toThrow('Não foi possível mover a demanda.');
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'Acesso não autorizado.' } });
    await expect(addDemandEvidence('d1', 'ASO', 'https://x.com')).rejects.toThrow('Você não tem permissão');
  });
});

describe('getDemands', () => {
  it('resolve nomes dos vínculos e filtra pela busca', async () => {
    tableData.service_demands = [
      { id: 'd1', demand_number: 7, type_id: 't1', stage_id: 's1', title: 'Repor porteiro', priority: 'high', status: 'open', post_id: 'p1', contract_id: 'c1', responsible_id: 'u1', approver_id: 'u2', created_at: '', updated_at: '' },
      { id: 'd2', demand_number: 8, type_id: 't1', stage_id: 's1', title: 'Falta no plantão', priority: 'normal', status: 'open', employee_id: 'e1', created_at: '', updated_at: '' },
    ];
    tableData.profiles = [{ id: 'u1', name: 'Yuri' }, { id: 'u2', name: 'Direção' }];
    tableData.employees = [{ id: 'e1', full_name: 'Ana Souza' }];
    tableData.service_contracts = [{ id: 'c1', title: 'Lab Astrofísica' }];
    tableData.service_posts = [{ id: 'p1', name: 'Portaria' }];

    const all = await getDemands();
    expect(all[0]).toMatchObject({ demandNumber: 7, postName: 'Portaria', contractTitle: 'Lab Astrofísica', responsibleName: 'Yuri', approverName: 'Direção' });
    expect(orCalls[0]).toMatch(/^status\.eq\.open,closed_at\.gte\.\d{4}-\d{2}-\d{2}$/);

    expect((await getDemands({ search: 'ana' })).map((demand) => demand.id)).toEqual(['d2']);
    expect((await getDemands({ search: '#7' })).map((demand) => demand.id)).toEqual(['d1']);
  });
});
