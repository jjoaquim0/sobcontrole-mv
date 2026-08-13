import { createElement, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import type { PipelineStage } from '../types';

const mocks = vi.hoisted(() => ({
  updatePipelineStagePosition: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../services/dealsService', () => ({
  getPipelineStages: vi.fn(),
  getArchivedPipelineStages: vi.fn(),
  createPipelineStage: vi.fn(),
  updatePipelineStage: vi.fn(),
  archivePipelineStage: vi.fn(),
  restorePipelineStage: vi.fn(),
  updatePipelineStagePosition: mocks.updatePipelineStagePosition,
  getDeals: vi.fn(),
  createDeal: vi.fn(),
  updateDeal: vi.fn(),
  moveDealStage: vi.fn(),
  closeDeal: vi.fn(),
  deleteDeal: vi.fn(),
  getDealHistory: vi.fn(),
}));

import { usePipelineStageMutations } from './usePipeline';

const activeKey = ['pipeline-stages', 'active'];
const archivedKey = ['pipeline-stages', 'archived'];

const stage = (id: string, position: number): PipelineStage => ({
  id,
  companyId: 'company-1',
  name: `Etapa ${id}`,
  color: '#10b981',
  position,
  isActive: true,
  createdAt: '',
  updatedAt: '',
});

const archivedStage: PipelineStage = { ...stage('archived-1', 9), isActive: false };

describe('usePipelineStageMutations — reordenação (Story 1.36, AC3/AC4)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    mocks.updatePipelineStagePosition.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  it('atualiza o cache de ativas otimisticamente (ordenado por position ASC) antes da mutation resolver, sem tocar a query de arquivadas', async () => {
    queryClient.setQueryData(activeKey, [stage('a', 0), stage('b', 1), stage('c', 2)]);
    queryClient.setQueryData(archivedKey, [archivedStage]);

    let resolveMutation: (value: PipelineStage) => void = () => {};
    mocks.updatePipelineStagePosition.mockImplementation(
      () => new Promise<PipelineStage>((resolve) => { resolveMutation = resolve; })
    );

    const { result } = renderHook(() => usePipelineStageMutations(), { wrapper });

    let mutationPromise!: Promise<PipelineStage>;
    await act(async () => {
      mutationPromise = result.current.updatePipelineStagePosition({ stageId: 'a', position: 2.5 });
      // Deixa os microtasks de onMutate (await cancelQueries) resolverem
      // antes de inspecionar o cache, sem esperar a mutation em si (que só
      // resolve quando chamarmos resolveMutation abaixo).
      await Promise.resolve();
      await Promise.resolve();
    });

    const optimistic = queryClient.getQueryData<PipelineStage[]>(activeKey);
    expect(optimistic?.map((s) => s.id)).toEqual(['b', 'c', 'a']); // reordenado por position ASC (1, 2, 2.5)
    expect(optimistic?.find((s) => s.id === 'a')?.position).toBe(2.5);
    expect(queryClient.getQueryData(archivedKey)).toEqual([archivedStage]); // arquivadas intacta

    await act(async () => {
      resolveMutation(stage('a', 2.5));
      await mutationPromise;
    });

    // Sucesso: invalida ['pipeline-stages','active'] sem apagar/duplicar -
    // como não há observer ativo da query, invalidate apenas marca stale;
    // os dados otimistas continuam presentes (nem sumiram, nem duplicaram).
    const afterSuccess = queryClient.getQueryData<PipelineStage[]>(activeKey);
    expect(afterSuccess).toHaveLength(3);
    expect(queryClient.getQueryData(archivedKey)).toEqual([archivedStage]);
  });

  it('em erro, reverte o cache de ativas para a ordem anterior e emite toast - arquivadas continua intacta', async () => {
    const original = [stage('a', 0), stage('b', 1)];
    queryClient.setQueryData(activeKey, original);
    queryClient.setQueryData(archivedKey, [archivedStage]);
    mocks.updatePipelineStagePosition.mockRejectedValue(new Error('Falha de rede'));

    const { result } = renderHook(() => usePipelineStageMutations(), { wrapper });

    await act(async () => {
      await expect(
        result.current.updatePipelineStagePosition({ stageId: 'a', position: 5 })
      ).rejects.toThrow('Falha de rede');
    });

    expect(queryClient.getQueryData(activeKey)).toEqual(original);
    expect(queryClient.getQueryData(archivedKey)).toEqual([archivedStage]);
    expect(toast.error).toHaveBeenCalledWith('Falha de rede');
  });
});
