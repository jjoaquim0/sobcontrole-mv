import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  addDemandComment,
  addDemandEvidence,
  assignDemand,
  cancelDemand,
  createDemand,
  DemandFilters,
  DemandInput,
  DemandStageInput,
  DemandTypeInput,
  DemandUpdateInput,
  ensureDefaultDemandTypes,
  getDemandDetails,
  getDemandLinkOptions,
  getDemands,
  getDemandTypes,
  moveDemand,
  saveDemandStage,
  saveDemandType,
  updateDemand,
} from '@/services/demandsService';

const onError = (error: Error) => toast.error(error.message);

export const useDemandTypes = () => {
  const queryClient = useQueryClient();
  const types = useQuery({ queryKey: ['demands', 'types'], queryFn: getDemandTypes });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['demands'] });

  const ensureDefaults = useMutation({
    mutationFn: ensureDefaultDemandTypes,
    onSuccess: (created) => { invalidate(); toast.success(created ? 'Tipos padrão criados.' : 'Os tipos de demanda já existem.'); },
    onError,
  });
  const saveType = useMutation({
    mutationFn: ({ input, id }: { input: DemandTypeInput; id?: string }) => saveDemandType(input, id),
    onSuccess: (_, variables) => { invalidate(); toast.success(variables.id ? 'Tipo de demanda atualizado.' : 'Tipo de demanda criado com as etapas padrão.'); },
    onError,
  });
  const saveStage = useMutation({
    mutationFn: ({ input, id }: { input: DemandStageInput; id?: string }) => saveDemandStage(input, id),
    onSuccess: (_, variables) => { invalidate(); toast.success(variables.id ? 'Etapa atualizada.' : 'Etapa adicionada antes da conferência.'); },
    onError,
  });

  return {
    types: types.data || [],
    isLoading: types.isLoading,
    isError: types.isError,
    refetch: types.refetch,
    ensureDefaults: ensureDefaults.mutateAsync,
    isEnsuringDefaults: ensureDefaults.isPending,
    saveType: saveType.mutateAsync,
    isSavingType: saveType.isPending,
    saveStage: saveStage.mutateAsync,
    isSavingStage: saveStage.isPending,
  };
};

export const useDemandLinkOptions = (enabled = true) => {
  const options = useQuery({ queryKey: ['demands', 'link-options'], queryFn: getDemandLinkOptions, enabled });
  return { options: options.data, isLoading: options.isLoading };
};

export const useDemands = (filters: DemandFilters = {}) => {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['demands', 'list', filters], queryFn: () => getDemands(filters) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['demands'] });

  const create = useMutation({
    mutationFn: (input: DemandInput) => createDemand(input),
    onSuccess: () => { invalidate(); toast.success('Demanda aberta.'); },
    onError,
  });
  const move = useMutation({
    mutationFn: ({ id, toStageId, note }: { id: string; toStageId: string; note?: string }) => moveDemand(id, toStageId, note),
    onSuccess: () => { invalidate(); toast.success('Demanda movida.'); },
    onError: (error: Error) => { invalidate(); onError(error); },
  });

  return {
    demands: list.data || [],
    isLoading: list.isLoading,
    isError: list.isError,
    refetch: list.refetch,
    createDemand: create.mutateAsync,
    isCreating: create.isPending,
    moveDemand: move.mutateAsync,
    isMoving: move.isPending,
  };
};

export const useDemandDetails = (id: string) => {
  const queryClient = useQueryClient();
  const details = useQuery({ queryKey: ['demands', 'detail', id], queryFn: () => getDemandDetails(id), enabled: Boolean(id) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['demands'] });

  const update = useMutation({
    mutationFn: (input: DemandUpdateInput) => updateDemand(id, input),
    onSuccess: () => { invalidate(); toast.success('Demanda atualizada.'); },
    onError,
  });
  const assign = useMutation({
    mutationFn: ({ responsibleId, approverId }: { responsibleId?: string; approverId?: string }) => assignDemand(id, responsibleId, approverId),
    onSuccess: () => { invalidate(); toast.success('Responsáveis atualizados.'); },
    onError,
  });
  const move = useMutation({
    mutationFn: ({ toStageId, note }: { toStageId: string; note?: string }) => moveDemand(id, toStageId, note),
    onSuccess: () => { invalidate(); toast.success('Etapa atualizada.'); },
    onError,
  });
  const cancel = useMutation({
    mutationFn: (reason: string) => cancelDemand(id, reason),
    onSuccess: () => { invalidate(); toast.success('Demanda cancelada.'); },
    onError,
  });
  const comment = useMutation({
    mutationFn: (body: string) => addDemandComment(id, body),
    onSuccess: () => { invalidate(); toast.success('Comentário registrado.'); },
    onError,
  });
  const evidence = useMutation({
    mutationFn: ({ label, url }: { label: string; url: string }) => addDemandEvidence(id, label, url),
    onSuccess: () => { invalidate(); toast.success('Evidência anexada.'); },
    onError,
  });

  return {
    details,
    updateDemand: update.mutateAsync,
    isUpdating: update.isPending,
    assignDemand: assign.mutateAsync,
    isAssigning: assign.isPending,
    moveDemand: move.mutateAsync,
    isMoving: move.isPending,
    cancelDemand: cancel.mutateAsync,
    isCanceling: cancel.isPending,
    addComment: comment.mutateAsync,
    isCommenting: comment.isPending,
    addEvidence: evidence.mutateAsync,
    isAddingEvidence: evidence.isPending,
  };
};
