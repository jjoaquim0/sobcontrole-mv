import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const eqSecond = vi.fn(async () => ({ error: null as { message: string } | null }));
  const eqFirst = vi.fn(() => ({ eq: eqSecond }));
  const deleteFn = vi.fn(() => ({ eq: eqFirst }));
  const from = vi.fn(() => ({ delete: deleteFn }));
  return {
    from,
    deleteFn,
    eqFirst,
    eqSecond,
    companyId: 'company-1' as string | undefined,
  };
});

vi.mock('../lib/supabase', () => ({
  supabase: { from: mocks.from },
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: {
    getState: () => ({ company: mocks.companyId ? { id: mocks.companyId } : undefined }),
  },
}));

import { deleteDeal } from './dealsService';

describe('dealsService.deleteDeal', () => {
  beforeEach(() => {
    mocks.companyId = 'company-1';
    mocks.from.mockClear();
    mocks.deleteFn.mockClear();
    mocks.eqFirst.mockClear();
    mocks.eqSecond.mockClear();
    mocks.eqSecond.mockResolvedValue({ error: null });
  });

  it('exclui o negócio filtrando pelo id e pela empresa ativa, nessa ordem', async () => {
    await deleteDeal('deal-1');

    expect(mocks.from).toHaveBeenCalledWith('deals');
    expect(mocks.deleteFn).toHaveBeenCalledTimes(1);
    expect(mocks.eqFirst).toHaveBeenCalledWith('id', 'deal-1');
    expect(mocks.eqSecond).toHaveBeenCalledWith('company_id', 'company-1');
  });

  it('propaga o erro do Supabase em vez de engolir a falha', async () => {
    mocks.eqSecond.mockResolvedValue({ error: { message: 'Falha ao excluir' } });

    await expect(deleteDeal('deal-1')).rejects.toMatchObject({ message: 'Falha ao excluir' });
  });

  it('não chama o Supabase quando não há empresa ativa (protege contra exclusão sem contexto de empresa)', async () => {
    mocks.companyId = undefined;

    await expect(deleteDeal('deal-1')).rejects.toThrow('Empresa não identificada.');
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('nunca exclui usando apenas o id, sem escopo de empresa', async () => {
    mocks.companyId = 'company-2';
    await deleteDeal('deal-1');

    // Regressão de segurança: a segunda chamada .eq() deve sempre existir e
    // usar company_id - se algum dia deleteDeal for alterado para excluir
    // só por id, este teste falha.
    expect(mocks.eqFirst).toHaveBeenCalledWith('id', 'deal-1');
    expect(mocks.eqSecond).toHaveBeenCalledWith('company_id', 'company-2');
  });
});
