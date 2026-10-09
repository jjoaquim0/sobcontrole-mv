import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  addObligationItem,
  getObligationsOverview,
  markPeriodReady,
  markPeriodSent,
  ObligationItemInput,
  ObligationSendInput,
  ObligationTemplateInput,
  openObligationPeriod,
  reopenPeriod,
  reviewObligationItem,
  saveObligationTemplate,
  submitObligationItem,
  updateObligationItem,
  waiveObligationItem,
} from '@/services/obligationsService';

const onError = (error: Error) => toast.error(error.message);

export const useObligations = () => {
  const queryClient = useQueryClient();
  const overview = useQuery({ queryKey: ['obligations', 'overview'], queryFn: getObligationsOverview });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['obligations'] });

  const template = useMutation({
    mutationFn: ({ input, id }: { input: ObligationTemplateInput; id?: string }) => saveObligationTemplate(input, id),
    onSuccess: (_, variables) => { invalidate(); toast.success(variables.id ? 'Obrigação atualizada.' : 'Obrigação cadastrada.'); },
    onError,
  });
  const openPeriod = useMutation({
    mutationFn: ({ contractId, competence }: { contractId: string; competence: string }) => openObligationPeriod(contractId, competence),
    onSuccess: () => { invalidate(); toast.success('Competência pronta para preparar.'); },
    onError,
  });
  const addItem = useMutation({
    mutationFn: (input: ObligationItemInput) => addObligationItem(input),
    onSuccess: () => { invalidate(); toast.success('Item incluído na competência.'); },
    onError,
  });
  const updateItem = useMutation({
    mutationFn: ({ itemId, dueDate, responsibleId }: { itemId: string; dueDate: string; responsibleId?: string }) => updateObligationItem(itemId, dueDate, responsibleId),
    onSuccess: () => { invalidate(); toast.success('Item atualizado.'); },
    onError,
  });
  const submitItem = useMutation({
    mutationFn: ({ itemId, evidenceUrl, note }: { itemId: string; evidenceUrl?: string; note?: string }) => submitObligationItem(itemId, evidenceUrl, note),
    onSuccess: () => { invalidate(); toast.success('Evidência registrada. Falta a conferência.'); },
    onError,
  });
  const reviewItem = useMutation({
    mutationFn: ({ itemId, approve, note }: { itemId: string; approve: boolean; note?: string }) => reviewObligationItem(itemId, approve, note),
    onSuccess: (_, variables) => { invalidate(); toast.success(variables.approve ? 'Item conferido.' : 'Item recusado.'); },
    onError,
  });
  const waiveItem = useMutation({
    mutationFn: ({ itemId, reason }: { itemId: string; reason: string }) => waiveObligationItem(itemId, reason),
    onSuccess: () => { invalidate(); toast.success('Item dispensado nesta competência.'); },
    onError,
  });
  const ready = useMutation({
    mutationFn: ({ periodId, note }: { periodId: string; note?: string }) => markPeriodReady(periodId, note),
    onSuccess: () => { invalidate(); toast.success('Pacote pronto para envio.'); },
    onError,
  });
  const reopen = useMutation({
    mutationFn: ({ periodId, reason }: { periodId: string; reason: string }) => reopenPeriod(periodId, reason),
    onSuccess: () => { invalidate(); toast.success('Competência reaberta.'); },
    onError,
  });
  const sent = useMutation({
    mutationFn: (input: ObligationSendInput) => markPeriodSent(input),
    onSuccess: () => { invalidate(); toast.success('Envio registrado.'); },
    onError,
  });

  return {
    overview,
    saveTemplate: template.mutateAsync,
    isSavingTemplate: template.isPending,
    openPeriod: openPeriod.mutateAsync,
    isOpeningPeriod: openPeriod.isPending,
    addItem: addItem.mutateAsync,
    isAddingItem: addItem.isPending,
    updateItem: updateItem.mutateAsync,
    isUpdatingItem: updateItem.isPending,
    submitItem: submitItem.mutateAsync,
    isSubmittingItem: submitItem.isPending,
    reviewItem: reviewItem.mutateAsync,
    isReviewingItem: reviewItem.isPending,
    waiveItem: waiveItem.mutateAsync,
    isWaivingItem: waiveItem.isPending,
    markReady: ready.mutateAsync,
    isMarkingReady: ready.isPending,
    reopenPeriod: reopen.mutateAsync,
    isReopening: reopen.isPending,
    markSent: sent.mutateAsync,
    isMarkingSent: sent.isPending,
  };
};
