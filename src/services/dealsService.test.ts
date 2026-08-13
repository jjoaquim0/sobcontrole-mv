import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

// Alguns ambientes de teste não expõem crypto.randomUUID por padrão; os
// services de criação (createDeal/createPipelineStage) dependem dele.
if (!globalThis.crypto || typeof globalThis.crypto.randomUUID !== 'function') {
  // @ts-expect-error - polyfill mínimo só para os testes
  globalThis.crypto = { ...globalThis.crypto, randomUUID: () => 'generated-uuid' };
}

type Resolution = { data?: unknown; error?: unknown };

/**
 * Tipo explícito do mock, declarado à parte para quebrar a inferência
 * circular: os métodos abaixo retornam a própria `query` (auto-referência),
 * então sem uma anotação de tipo o TS não consegue inferir o tipo de
 * `query`/`buildQuery` sozinho (TS7022/TS7024). `update` anota a tupla de
 * argumento explicitamente (via generics de `vi.fn`, sem parâmetro nomeado
 * na implementação) para que `mock.calls[0][0]` enxergue um elemento em vez
 * de `[]` (TS2493) — os demais métodos não são inspecionados por índice de
 * argumento nos testes, então mantêm a tupla vazia inferida naturalmente.
 */
type QueryBuilderMock = {
  select: Mock<[], QueryBuilderMock>;
  insert: Mock<[], QueryBuilderMock>;
  update: Mock<[payload?: Record<string, unknown>], QueryBuilderMock>;
  delete: Mock<[], QueryBuilderMock>;
  eq: Mock<[], QueryBuilderMock>;
  order: Mock<[], QueryBuilderMock>;
  limit: Mock<[], QueryBuilderMock>;
  single: Mock<[], Promise<Resolution>>;
  then: <T>(onFulfilled?: (value: Resolution) => T, onRejected?: (reason: unknown) => T) => Promise<T>;
};

/**
 * Query builder genérico que imita a API encadeável do supabase-js
 * (select/insert/update/delete/eq/order/limit/single), sempre retornando a
 * si mesmo até o ponto terminal (.single() ou await direto via .then()).
 * Cada chamada a `supabase.from(...)` no service deve receber uma instância
 * nova, configurada com a resolução esperada para aquela chamada específica.
 */
const buildQuery = (resolution: Resolution): QueryBuilderMock => {
  const query: QueryBuilderMock = {
    select: vi.fn(() => query),
    insert: vi.fn(() => query),
    update: vi.fn<[payload?: Record<string, unknown>], QueryBuilderMock>(() => query),
    delete: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    single: vi.fn(() => Promise.resolve(resolution)),
    then: <T>(onFulfilled?: (value: Resolution) => T, onRejected?: (reason: unknown) => T) =>
      Promise.resolve(resolution).then(onFulfilled, onRejected),
  };
  return query;
};

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  companyId: 'company-1' as string | undefined,
  profileId: 'user-1' as string | undefined,
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: mocks.from },
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      company: mocks.companyId ? { id: mocks.companyId } : undefined,
      profile: mocks.profileId ? { id: mocks.profileId } : undefined,
    }),
  },
}));

import {
  deleteDeal,
  updateDeal,
  getPipelineStages,
  getArchivedPipelineStages,
  createPipelineStage,
  updatePipelineStage,
  archivePipelineStage,
  restorePipelineStage,
} from './dealsService';

const dbStage = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'stage-1',
  company_id: 'company-1',
  name: 'Novo Contato',
  color: '#10b981',
  position: 0,
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const dbDeal = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'deal-1',
  company_id: 'company-1',
  title: 'Negócio Alpha',
  customer_id: 'cust-1',
  customers: null,
  owner_id: 'user-1',
  profiles: null,
  stage_id: 'stage-1',
  value: 1000,
  status: 'open',
  expected_close_date: null,
  position: 0,
  notes: '',
  lost_reason: null,
  closed_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  mocks.companyId = 'company-1';
  mocks.profileId = 'user-1';
  mocks.from.mockReset();
});

describe('dealsService.deleteDeal', () => {
  it('exclui o negócio filtrando pelo id e pela empresa ativa, nessa ordem', async () => {
    const query = buildQuery({ error: null });
    mocks.from.mockReturnValueOnce(query);

    await deleteDeal('deal-1');

    expect(mocks.from).toHaveBeenCalledWith('deals');
    expect(query.delete).toHaveBeenCalledTimes(1);
    expect(query.eq).toHaveBeenNthCalledWith(1, 'id', 'deal-1');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'company_id', 'company-1');
  });

  it('propaga o erro do Supabase em vez de engolir a falha', async () => {
    mocks.from.mockReturnValueOnce(buildQuery({ error: { message: 'Falha ao excluir' } }));

    await expect(deleteDeal('deal-1')).rejects.toMatchObject({ message: 'Falha ao excluir' });
  });

  it('não chama o Supabase quando não há empresa ativa (protege contra exclusão sem contexto de empresa)', async () => {
    mocks.companyId = undefined;

    await expect(deleteDeal('deal-1')).rejects.toThrow('Empresa não identificada.');
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('nunca exclui usando apenas o id, sem escopo de empresa', async () => {
    mocks.companyId = 'company-2';
    const query = buildQuery({ error: null });
    mocks.from.mockReturnValueOnce(query);

    await deleteDeal('deal-1');

    // Regressão de segurança: a segunda chamada .eq() deve sempre existir e
    // usar company_id - se algum dia deleteDeal for alterado para excluir
    // só por id, este teste falha.
    expect(query.eq).toHaveBeenNthCalledWith(1, 'id', 'deal-1');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'company_id', 'company-2');
  });
});

describe('dealsService.getPipelineStages / getArchivedPipelineStages', () => {
  it('lista somente etapas ativas, escopadas pela empresa da sessão', async () => {
    const query = buildQuery({ data: [dbStage({ is_active: true })], error: null });
    mocks.from.mockReturnValueOnce(query);

    const stages = await getPipelineStages();

    expect(mocks.from).toHaveBeenCalledWith('pipeline_stages');
    expect(query.eq).toHaveBeenNthCalledWith(1, 'company_id', 'company-1');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'is_active', true);
    expect(stages).toEqual([
      expect.objectContaining({ id: 'stage-1', name: 'Novo Contato', isActive: true }),
    ]);
  });

  it('lista somente etapas arquivadas, escopadas pela empresa da sessão', async () => {
    const query = buildQuery({ data: [dbStage({ is_active: false })], error: null });
    mocks.from.mockReturnValueOnce(query);

    const stages = await getArchivedPipelineStages();

    expect(mocks.from).toHaveBeenCalledWith('pipeline_stages');
    expect(query.eq).toHaveBeenNthCalledWith(1, 'company_id', 'company-1');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'is_active', false);
    expect(stages).toEqual([expect.objectContaining({ id: 'stage-1', isActive: false })]);
  });
});

describe('dealsService.createPipelineStage', () => {
  it('cria a etapa em max(position) das ativas + 1', async () => {
    const listQuery = buildQuery({
      data: [dbStage({ id: 's1', position: 0 }), dbStage({ id: 's2', position: 3 })],
      error: null,
    });
    const insertQuery = buildQuery({ data: dbStage({ id: 'new-stage', position: 4, name: 'Fechamento' }), error: null });
    mocks.from.mockReturnValueOnce(listQuery).mockReturnValueOnce(insertQuery);

    const created = await createPipelineStage({ name: 'Fechamento', color: '#3b82f6' });

    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Fechamento', color: '#3b82f6', position: 4, is_active: true, company_id: 'company-1' })
    );
    expect(created.position).toBe(4);
  });

  it('usa posição 0 quando não há nenhuma etapa ativa', async () => {
    const listQuery = buildQuery({ data: [], error: null });
    const insertQuery = buildQuery({ data: dbStage({ id: 'new-stage', position: 0 }), error: null });
    mocks.from.mockReturnValueOnce(listQuery).mockReturnValueOnce(insertQuery);

    await createPipelineStage({ name: 'Novo Contato', color: '#10b981' });

    expect(insertQuery.insert).toHaveBeenCalledWith(expect.objectContaining({ position: 0 }));
  });
});

describe('dealsService.updatePipelineStage / archivePipelineStage / restorePipelineStage', () => {
  it('renomeia e recolore preservando o escopo de empresa', async () => {
    const query = buildQuery({ data: dbStage({ name: 'Renomeada', color: '#ef4444' }), error: null });
    mocks.from.mockReturnValueOnce(query);

    const updated = await updatePipelineStage('stage-1', { name: 'Renomeada', color: '#ef4444' });

    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ name: 'Renomeada', color: '#ef4444' }));
    expect(query.eq).toHaveBeenNthCalledWith(1, 'id', 'stage-1');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'company_id', 'company-1');
    expect(updated.name).toBe('Renomeada');
  });

  it('arquiva gravando is_active=false sem apagar a linha', async () => {
    const query = buildQuery({ data: dbStage({ is_active: false }), error: null });
    mocks.from.mockReturnValueOnce(query);

    const archived = await archivePipelineStage('stage-1');

    expect(query.delete).not.toHaveBeenCalled();
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ is_active: false }));
    expect(archived.isActive).toBe(false);
  });

  it('reativa gravando is_active=true', async () => {
    const query = buildQuery({ data: dbStage({ is_active: true }), error: null });
    mocks.from.mockReturnValueOnce(query);

    const restored = await restorePipelineStage('stage-1');

    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ is_active: true }));
    expect(restored.isActive).toBe(true);
  });

  it('propaga erro do Supabase nas mutations de etapa em vez de engolir a falha', async () => {
    mocks.from.mockReturnValueOnce(buildQuery({ error: { message: 'Falha ao salvar etapa' } }));

    await expect(updatePipelineStage('stage-1', { name: 'X' })).rejects.toMatchObject({ message: 'Falha ao salvar etapa' });
  });

  it('teste negativo cross-tenant: mesmo recebendo o id de uma etapa de outra empresa, a query permanece escopada pelo company_id da sessão ativa (RLS como autoridade final)', async () => {
    // Sessão autenticada é da empresa A ("company-a"); o id passado é de uma
    // etapa que, no cenário de ataque, pertenceria à empresa B. O service
    // nunca aceita companyId como parâmetro - o .eq('company_id', ...)
    // sempre vem de requireCompanyId()/useAuthStore, então mesmo um id
    // arbitrário de outra empresa só encontra linha se a RLS permitir
    // (o que não ocorre entre empresas distintas).
    mocks.companyId = 'company-a';
    const query = buildQuery({ error: { message: 'Linha não encontrada (RLS)' } });
    mocks.from.mockReturnValueOnce(query);

    await expect(updatePipelineStage('stage-of-company-b', { name: 'Hackeada' })).rejects.toMatchObject({
      message: 'Linha não encontrada (RLS)',
    });

    expect(query.eq).toHaveBeenCalledWith('company_id', 'company-a');
    expect(query.eq).not.toHaveBeenCalledWith('company_id', 'company-b');
  });

  it('archivePipelineStage e restorePipelineStage também escopam por company_id da sessão, nunca por parâmetro', async () => {
    mocks.companyId = 'company-a';
    const archiveQuery = buildQuery({ data: dbStage({ is_active: false }), error: null });
    const restoreQuery = buildQuery({ data: dbStage({ is_active: true }), error: null });
    mocks.from.mockReturnValueOnce(archiveQuery).mockReturnValueOnce(restoreQuery);

    await archivePipelineStage('stage-of-company-b');
    await restorePipelineStage('stage-of-company-b');

    expect(archiveQuery.eq).toHaveBeenCalledWith('company_id', 'company-a');
    expect(restoreQuery.eq).toHaveBeenCalledWith('company_id', 'company-a');
  });
});

describe('dealsService.updateDeal — consolidação de stage_id (FR-8)', () => {
  it('grava apenas os campos básicos quando stageId não é informado (sem tocar stage_id/position)', async () => {
    const query = buildQuery({ data: dbDeal({ stage_id: 'stage-1' }), error: null });
    mocks.from.mockReturnValueOnce(query);

    await updateDeal('deal-1', { title: 'Novo título', value: 2000 });

    expect(mocks.from).toHaveBeenCalledTimes(1);
    const payload = query.update.mock.calls[0][0];
    expect(payload).not.toHaveProperty('stage_id');
    expect(payload).not.toHaveProperty('position');
    expect(payload).toEqual(expect.objectContaining({ title: 'Novo título', value: 2000 }));
  });

  it('não dispara um segundo write quando o stageId enviado é igual à etapa atual', async () => {
    const query = buildQuery({ data: dbDeal({ stage_id: 'stage-1' }), error: null });
    mocks.from.mockReturnValueOnce(query);

    await updateDeal('deal-1', { title: 'Sem mudança de etapa', stageId: 'stage-1' });

    // Um único caminho de escrita: nenhuma segunda chamada a `from` (nem
    // a de posição, nem a de moveDealStage) quando a etapa não mudou.
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });

  it('quando stageId muda, encaminha para moveDealStage: grava position em max(position)+1 e registra deal_stage_history', async () => {
    const fieldsUpdate = buildQuery({ data: dbDeal({ stage_id: 'stage-1' }), error: null });
    const positionQuery = buildQuery({ data: [{ position: 2 }], error: null });
    const currentStageQuery = buildQuery({ data: { stage_id: 'stage-1' }, error: null });
    const moveUpdateQuery = buildQuery({
      data: dbDeal({ stage_id: 'stage-2', position: 3 }),
      error: null,
    });
    const historyInsertQuery = buildQuery({ error: null });

    mocks.from
      .mockReturnValueOnce(fieldsUpdate) // UPDATE campos básicos
      .mockReturnValueOnce(positionQuery) // SELECT max(position) das abertas na etapa destino
      .mockReturnValueOnce(currentStageQuery) // moveDealStage: SELECT stage_id atual
      .mockReturnValueOnce(moveUpdateQuery) // moveDealStage: UPDATE stage_id/position
      .mockReturnValueOnce(historyInsertQuery); // moveDealStage: INSERT deal_stage_history

    const result = await updateDeal('deal-1', { title: 'Negócio Alpha', stageId: 'stage-2' });

    expect(mocks.from).toHaveBeenCalledTimes(5);
    expect(moveUpdateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ stage_id: 'stage-2', position: 3 })
    );
    expect(historyInsertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({ deal_id: 'deal-1', from_stage_id: 'stage-1', to_stage_id: 'stage-2', changed_by: 'user-1' })
    );
    expect(result.stageId).toBe('stage-2');

    // Não é FR-7: nenhum dos payloads grava status/closed_at/lost_reason.
    for (const call of [fieldsUpdate.update, moveUpdateQuery.update]) {
      const payload = call.mock.calls[0][0];
      expect(payload).not.toHaveProperty('status');
      expect(payload).not.toHaveProperty('closed_at');
      expect(payload).not.toHaveProperty('lost_reason');
    }
  });

  it('usa 0 como posição quando a etapa destino não tem nenhum negócio aberto', async () => {
    const fieldsUpdate = buildQuery({ data: dbDeal({ stage_id: 'stage-1' }), error: null });
    const positionQuery = buildQuery({ data: [], error: null });
    const currentStageQuery = buildQuery({ data: { stage_id: 'stage-1' }, error: null });
    const moveUpdateQuery = buildQuery({ data: dbDeal({ stage_id: 'stage-2', position: 0 }), error: null });
    const historyInsertQuery = buildQuery({ error: null });

    mocks.from
      .mockReturnValueOnce(fieldsUpdate)
      .mockReturnValueOnce(positionQuery)
      .mockReturnValueOnce(currentStageQuery)
      .mockReturnValueOnce(moveUpdateQuery)
      .mockReturnValueOnce(historyInsertQuery);

    await updateDeal('deal-1', { stageId: 'stage-2' });

    expect(moveUpdateQuery.update).toHaveBeenCalledWith(expect.objectContaining({ position: 0 }));
  });

  it('nunca deriva company_id de outra fonte que não a sessão autenticada, mesmo trocando de etapa', async () => {
    mocks.companyId = 'company-2';
    const fieldsUpdate = buildQuery({ data: dbDeal({ company_id: 'company-2', stage_id: 'stage-1' }), error: null });
    const positionQuery = buildQuery({ data: [], error: null });
    const currentStageQuery = buildQuery({ data: { stage_id: 'stage-1' }, error: null });
    const moveUpdateQuery = buildQuery({ data: dbDeal({ company_id: 'company-2', stage_id: 'stage-2' }), error: null });
    const historyInsertQuery = buildQuery({ error: null });

    mocks.from
      .mockReturnValueOnce(fieldsUpdate)
      .mockReturnValueOnce(positionQuery)
      .mockReturnValueOnce(currentStageQuery)
      .mockReturnValueOnce(moveUpdateQuery)
      .mockReturnValueOnce(historyInsertQuery);

    await updateDeal('deal-1', { stageId: 'stage-2' });

    // Todas as chamadas .eq('company_id', ...) devem usar o company_id da
    // sessão ativa (requireCompanyId()) - nunca um valor vindo de `data`.
    for (const query of [fieldsUpdate, positionQuery, currentStageQuery, moveUpdateQuery]) {
      expect(query.eq).toHaveBeenCalledWith('company_id', 'company-2');
      expect(query.eq).not.toHaveBeenCalledWith('company_id', 'company-1');
    }
  });

  it('não executa nenhuma chamada ao Supabase quando não há empresa ativa na sessão', async () => {
    mocks.companyId = undefined;

    await expect(updateDeal('deal-1', { stageId: 'stage-2' })).rejects.toThrow('Empresa não identificada.');
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
