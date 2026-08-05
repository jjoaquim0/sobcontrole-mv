/**
 * Story 1.31 — Hooks do módulo tributário.
 *
 * Toda chave de React Query inclui `company_id`, impedindo que o cache de uma
 * empresa vaze para outra na troca de sessão — mesmo padrão já adotado no
 * módulo de relatórios.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import {
  computeTaxAssessment,
  confirmTaxAssessment,
  getTaxProfile,
  getVarianceSummary,
  listTaxObligations,
  listUpcomingRegimeWindows,
  saveTaxAssessment,
  settleTaxObligation,
} from '../services/taxAssessmentService';

const useCompanyId = (): string | undefined => useAuthStore((state) => state.company?.id);

/**
 * Um hook só, devolvendo os dois valores. Separar em `useCompanyId()` e
 * `useIsTaxManager()` combinados com `&&` fazia o segundo ser chamado
 * condicionalmente — violação da regra dos Hooks, porque o curto-circuito muda
 * a ordem de chamada entre renders.
 */
const useTaxAccess = (): { companyId: string | undefined; enabled: boolean } => {
  const companyId = useAuthStore((state) => state.company?.id);
  const role = useAuthStore((state) => state.profile?.role);
  return {
    companyId,
    enabled: Boolean(companyId) && (role === 'admin' || role === 'manager'),
  };
};

export const useTaxProfile = () => {
  const { companyId, enabled } = useTaxAccess();

  return useQuery({
    queryKey: ['tax', 'profile', companyId],
    queryFn: getTaxProfile,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
};

export const useTaxAssessment = (referenceMonth: string) => {
  const { companyId, enabled } = useTaxAccess();

  return useQuery({
    queryKey: ['tax', 'assessment', companyId, referenceMonth],
    queryFn: () => computeTaxAssessment(referenceMonth),
    enabled: enabled && Boolean(referenceMonth),
    staleTime: 60 * 1000,
  });
};

export const useTaxObligations = (fromMonth: string, toMonth: string) => {
  const { companyId, enabled } = useTaxAccess();

  return useQuery({
    queryKey: ['tax', 'obligations', companyId, fromMonth, toMonth],
    queryFn: () => listTaxObligations(fromMonth, toMonth),
    enabled,
  });
};

export const useTaxVariance = () => {
  const { companyId, enabled } = useTaxAccess();

  return useQuery({
    queryKey: ['tax', 'variance', companyId],
    queryFn: () => getVarianceSummary(),
    enabled,
    staleTime: 10 * 60 * 1000,
  });
};

export const useRegimeOptionWindows = () => {
  const companyId = useCompanyId();
  const today = new Date().toISOString().slice(0, 10);

  return useQuery({
    queryKey: ['tax', 'regime-windows', companyId, today],
    queryFn: () => listUpcomingRegimeWindows(today),
    enabled: Boolean(companyId),
    staleTime: 60 * 60 * 1000,
  });
};

/** Invalida tudo do módulo, mais fluxo de caixa e DRE, que passam a refletir o imposto. */
const useInvalidateTax = () => {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['tax'] });
    queryClient.invalidateQueries({ queryKey: ['cash-flow-forecast'] });
    queryClient.invalidateQueries({ queryKey: ['reports'] });
    queryClient.invalidateQueries({ queryKey: ['financial'] });
  };
};

export const useSaveTaxAssessment = () => {
  const invalidate = useInvalidateTax();
  return useMutation({
    mutationFn: (referenceMonth: string) => saveTaxAssessment(referenceMonth),
    onSuccess: invalidate,
  });
};

export const useConfirmTaxAssessment = () => {
  const invalidate = useInvalidateTax();
  return useMutation({
    mutationFn: ({ referenceMonth, amount }: { referenceMonth: string; amount: number }) =>
      confirmTaxAssessment(referenceMonth, amount),
    onSuccess: invalidate,
  });
};

export const useSettleTaxObligation = () => {
  const invalidate = useInvalidateTax();
  return useMutation({
    mutationFn: ({
      obligationId,
      paidAt,
      documentId,
    }: {
      obligationId: string;
      paidAt: string;
      documentId?: string | null;
    }) => settleTaxObligation(obligationId, paidAt, documentId),
    onSuccess: invalidate,
  });
};
