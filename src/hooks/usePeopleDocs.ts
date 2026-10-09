import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AbsenceInput,
  cancelAbsence,
  DeliveryInput,
  DeliveryReturnInput,
  DocumentReviewInput,
  DocumentSubmissionInput,
  getPeopleDocsOverview,
  registerAbsence,
  registerDelivery,
  RequirementInput,
  returnDelivery,
  reviewDocument,
  saveRequirement,
  submitDocument,
} from '@/services/peopleDocsService';

const onError = (error: Error) => toast.error(error.message);

export const usePeopleDocs = () => {
  const queryClient = useQueryClient();
  const overview = useQuery({ queryKey: ['people-docs', 'overview'], queryFn: getPeopleDocsOverview });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['people-docs'] });
  // Férias e afastamentos mudam a cobertura exibida nos contratos.
  const invalidateWithContracts = () => {
    invalidate();
    queryClient.invalidateQueries({ queryKey: ['contracts'] });
  };

  const requirement = useMutation({
    mutationFn: ({ input, id }: { input: RequirementInput; id?: string }) => saveRequirement(input, id),
    onSuccess: (_, variables) => { invalidate(); toast.success(variables.id ? 'Documento do checklist atualizado.' : 'Documento incluído no checklist.'); },
    onError,
  });
  const submission = useMutation({
    mutationFn: (input: DocumentSubmissionInput) => submitDocument(input),
    onSuccess: () => { invalidate(); toast.success('Documento registrado. Falta a conferência.'); },
    onError,
  });
  const review = useMutation({
    mutationFn: (input: DocumentReviewInput) => reviewDocument(input),
    onSuccess: (_, variables) => { invalidate(); toast.success(variables.approve ? 'Documento conferido.' : 'Documento recusado.'); },
    onError,
  });
  const absence = useMutation({
    mutationFn: (input: AbsenceInput) => registerAbsence(input),
    onSuccess: () => { invalidateWithContracts(); toast.success('Férias/afastamento registrado.'); },
    onError,
  });
  const absenceCancel = useMutation({
    mutationFn: ({ absenceId, reason }: { absenceId: string; reason: string }) => cancelAbsence(absenceId, reason),
    onSuccess: () => { invalidateWithContracts(); toast.success('Férias/afastamento cancelado.'); },
    onError,
  });
  const delivery = useMutation({
    mutationFn: (input: DeliveryInput) => registerDelivery(input),
    onSuccess: () => { invalidate(); toast.success('Entrega registrada.'); },
    onError,
  });
  const deliveryReturn = useMutation({
    mutationFn: (input: DeliveryReturnInput) => returnDelivery(input),
    onSuccess: () => { invalidate(); toast.success('Devolução registrada.'); },
    onError,
  });

  return {
    overview,
    saveRequirement: requirement.mutateAsync,
    isSavingRequirement: requirement.isPending,
    submitDocument: submission.mutateAsync,
    isSubmittingDocument: submission.isPending,
    reviewDocument: review.mutateAsync,
    isReviewingDocument: review.isPending,
    registerAbsence: absence.mutateAsync,
    isRegisteringAbsence: absence.isPending,
    cancelAbsence: absenceCancel.mutateAsync,
    isCancelingAbsence: absenceCancel.isPending,
    registerDelivery: delivery.mutateAsync,
    isRegisteringDelivery: delivery.isPending,
    returnDelivery: deliveryReturn.mutateAsync,
    isReturningDelivery: deliveryReturn.isPending,
  };
};
