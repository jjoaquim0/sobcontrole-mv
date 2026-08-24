import { useCallback, useEffect, useRef, useState } from 'react';
import { Document } from '../types';
import {
  applyNfePurchaseProposal,
  DocumentExtractionJob,
  DocumentImportError,
  DocumentImportErrorCode,
  findLatestNfeExtraction,
  findSupplierMatchByDocument,
  getDocumentImportErrorMessage,
  getNfeImportProposalByJobId,
  isNfeDocumentImportEligible,
  NfeHeaderProposalPayload,
  NfeImportProposal,
  startNfeDocumentExtraction,
  SupplierMatchResult,
  saveNfeProposalPayload,
} from '../services/documentImportService';

export type DocumentImportViewState =
  | 'idle'
  | 'queued'
  | 'running'
  | 'failed'
  | 'review'
  | 'summary'
  | 'confirming'
  | 'success'
  | 'error';

const toSafeError = (error: unknown, fallbackCode: DocumentImportErrorCode = 'internal_error'): DocumentImportError => {
  if (error instanceof DocumentImportError) return error;
  return new DocumentImportError(fallbackCode);
};

export const useDocumentImport = (document?: Document, isOpen = false) => {
  const versionId = document?.currentVersionId;
  const eligible = Boolean(document && isNfeDocumentImportEligible(document));
  const [state, setState] = useState<DocumentImportViewState>('idle');
  const [job, setJob] = useState<DocumentExtractionJob | null>(null);
  const [proposal, setProposal] = useState<NfeImportProposal | null>(null);
  const [supplierMatch, setSupplierMatch] = useState<SupplierMatchResult | null>(null);
  const [isSupplierMatchLoading, setIsSupplierMatchLoading] = useState(false);
  const [error, setError] = useState<DocumentImportError | null>(null);
  const operationRef = useRef(false);
  const generationRef = useRef(0);

  const refreshSupplierMatch = useCallback(async (supplierDocument: string) => {
    if (supplierDocument.replace(/\D/g, '').length !== 14) {
      setSupplierMatch({ status: 'invalid', normalizedDocument: supplierDocument.replace(/\D/g, ''), supplier: null });
      setIsSupplierMatchLoading(false);
      return;
    }
    setIsSupplierMatchLoading(true);
    setSupplierMatch(null);
    try {
      setSupplierMatch(await findSupplierMatchByDocument(supplierDocument));
    } catch (matchError) {
      setError(toSafeError(matchError));
    } finally {
      setIsSupplierMatchLoading(false);
    }
  }, []);

  const loadCompletedJob = useCallback(async (nextJob: DocumentExtractionJob, generation: number) => {
    const nextProposal = await getNfeImportProposalByJobId(nextJob.id);
    if (generation !== generationRef.current) return;
    if (!nextProposal) {
      setError(new DocumentImportError('internal_error'));
      setState('error');
      return;
    }
    setProposal(nextProposal);
    if (nextProposal.status === 'applied') {
      setState('success');
      return;
    }
    if (nextProposal.status !== 'pending') {
      setError(new DocumentImportError('apply_failed'));
      setState('error');
      return;
    }
    setError(null);
    setState('review');
    await refreshSupplierMatch(nextProposal.payload.supplier.document);
  }, [refreshSupplierMatch]);

  const hydrateJob = useCallback(async (nextJob: DocumentExtractionJob, generation: number) => {
    if (generation !== generationRef.current) return;
    setJob(nextJob);
    if (nextJob.status === 'queued' || nextJob.status === 'running') {
      setError(null);
      setState(nextJob.status);
      return;
    }
    if (nextJob.status === 'failed') {
      const code = nextJob.error || 'internal_error';
      setError(new DocumentImportError(
        code === 'duplicate_nfe' ? 'duplicate_nfe' : 'internal_error',
        getDocumentImportErrorMessage(code),
      ));
      setState('failed');
      return;
    }
    await loadCompletedJob(nextJob, generation);
  }, [loadCompletedJob]);

  const reconcile = useCallback(async (startIfMissing: boolean, retryFailed: boolean) => {
    if (!eligible || !versionId || operationRef.current) return;
    operationRef.current = true;
    const generation = generationRef.current;
    try {
      const latest = await findLatestNfeExtraction(versionId);
      if (latest && !(latest.status === 'failed' && retryFailed)) {
        await hydrateJob(latest, generation);
        return;
      }
      if (!startIfMissing && !retryFailed) {
        if (latest) await hydrateJob(latest, generation);
        return;
      }
      setError(null);
      setState('queued');
      await startNfeDocumentExtraction(versionId);
    } catch (reconcileError) {
      const safeError = toSafeError(reconcileError);
      setError(safeError);
      setState('error');
    } finally {
      operationRef.current = false;
    }
  }, [eligible, hydrateJob, versionId]);

  useEffect(() => {
    generationRef.current += 1;
    setState('idle');
    setJob(null);
    setProposal(null);
    setSupplierMatch(null);
    setError(null);
  }, [document?.id, versionId]);

  useEffect(() => {
    if (!isOpen || !eligible || !versionId) return;
    void reconcile(true, false);
  }, [eligible, isOpen, reconcile, versionId]);

  useEffect(() => {
    if (!isOpen || !versionId || (state !== 'queued' && state !== 'running')) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const latest = await findLatestNfeExtraction(versionId);
        if (!cancelled && latest) await hydrateJob(latest, generationRef.current);
      } catch (pollError) {
        if (!cancelled) {
          setError(toSafeError(pollError));
          setState('error');
        }
      }
    }, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [hydrateJob, isOpen, state, versionId]);

  const start = useCallback(() => reconcile(true, false), [reconcile]);
  const retry = useCallback(() => {
    if (state !== 'failed' && state !== 'error') return Promise.resolve();
    return reconcile(true, true);
  }, [reconcile, state]);

  const refresh = useCallback(async () => {
    if (!versionId || !eligible) return;
    const latest = await findLatestNfeExtraction(versionId);
    if (latest) await hydrateJob(latest, generationRef.current);
  }, [eligible, hydrateJob, versionId]);

  const goToSummary = useCallback(() => {
    if (state === 'review') setState('summary');
  }, [state]);

  const backToReview = useCallback(() => {
    if (proposal?.status === 'pending') setState('review');
  }, [proposal?.status]);

  const confirm = useCallback(async (payload: NfeHeaderProposalPayload) => {
    if (!proposal || proposal.status !== 'pending' || operationRef.current) return;
    operationRef.current = true;
    setError(null);
    setState('confirming');
    try {
      const saved = await saveNfeProposalPayload(proposal.id, payload);
      setProposal(saved);
      const applied = await applyNfePurchaseProposal(saved.id);
      setProposal(applied);
      setState('success');
    } catch (confirmError) {
      const safeError = toSafeError(confirmError, 'apply_failed');
      setError(safeError.code === 'apply_failed' ? safeError : new DocumentImportError('apply_failed'));
      setState('review');
    } finally {
      operationRef.current = false;
    }
  }, [proposal]);

  return {
    eligible,
    state,
    job,
    proposal,
    supplierMatch,
    isSupplierMatchLoading,
    error,
    isBusy: operationRef.current || state === 'confirming',
    start,
    retry,
    refresh,
    refreshSupplierMatch,
    goToSummary,
    backToReview,
    confirm,
  };
};
