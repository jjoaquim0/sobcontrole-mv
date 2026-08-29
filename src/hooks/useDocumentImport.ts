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
  NfeImportProposalItem,
  NfeProposalItemPatch,
  NfeImportProposal,
  startNfeDocumentExtraction,
  startPdfDocumentExtraction,
  SupplierMatchResult,
  saveNfeProposalPayload,
  getNfeProposalItems,
  saveNfeProposalItem,
  searchNfeProducts,
  NfeProductSuggestion,
  getNfeProductCategories,
  createNfeProductCategory,
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

const PDF_IMPORT_ERROR_CODES = new Set<string>([
  'pdf_text_empty',
  'pdf_scanned',
  'pdf_text_extraction_failed',
  'pdf_access_key_missing',
  'pdf_access_key_invalid',
  'pdf_access_key_ambiguous',
  'pdf_required_field_missing',
  'pdf_money_invalid',
  'pdf_installment_invalid',
]);

export const useDocumentImport = (document?: Document, isOpen = false) => {
  const versionId = document?.currentVersionId;
  const eligible = Boolean(document && isNfeDocumentImportEligible(document));
  const isPdf = document?.mimeType === 'application/pdf';
  const [state, setState] = useState<DocumentImportViewState>('idle');
  const [job, setJob] = useState<DocumentExtractionJob | null>(null);
  const [proposal, setProposal] = useState<NfeImportProposal | null>(null);
  const [items, setItems] = useState<NfeImportProposalItem[]>([]);
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
    const nextItems = await getNfeProposalItems(nextProposal.id);
    if (generation !== generationRef.current) return;
    setItems(nextItems);
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
      const safeCode: DocumentImportErrorCode = code === 'duplicate_nfe'
        ? 'duplicate_nfe'
        : PDF_IMPORT_ERROR_CODES.has(code)
          ? code as DocumentImportErrorCode
          : 'internal_error';
      setError(new DocumentImportError(
        safeCode,
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
      setState(isPdf ? 'running' : 'queued');
      if (isPdf && document) {
        await startPdfDocumentExtraction(versionId, document.storagePath);
      } else {
        await startNfeDocumentExtraction(versionId);
      }
    } catch (reconcileError) {
      const safeError = toSafeError(reconcileError);
      setError(safeError);
      setState('error');
    } finally {
      operationRef.current = false;
    }
  }, [document, eligible, hydrateJob, isPdf, versionId]);

  useEffect(() => {
    generationRef.current += 1;
    setState('idle');
    setJob(null);
    setProposal(null);
    setItems([]);
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

  const saveItem = useCallback(async (itemId: string, patch: NfeProposalItemPatch): Promise<NfeImportProposalItem> => {
    if (!proposal || proposal.status !== 'pending') throw new DocumentImportError('document_not_found');
    const saved = await saveNfeProposalItem(proposal.id, itemId, patch);
    setItems((current) => current.map((item) => item.id === itemId
      ? { ...saved, suggestedProduct: patch.suggestedProduct === undefined ? item.suggestedProduct : (patch.suggestedProduct ?? undefined) }
      : item));
    return { ...saved, suggestedProduct: patch.suggestedProduct === undefined ? items.find((item) => item.id === itemId)?.suggestedProduct : (patch.suggestedProduct ?? undefined) };
  }, [items, proposal]);

  const searchProducts = useCallback(async (query: string): Promise<NfeProductSuggestion[]> => searchNfeProducts(query), []);
  const loadCategories = useCallback(() => getNfeProductCategories(), []);
  const createCategory = useCallback((name: string) => createNfeProductCategory(name), []);

  return {
    eligible,
    state,
    job,
    proposal,
    items,
    itemCount: proposal?.payload.item_count ?? items.length,
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
    saveItem,
    searchProducts,
    loadCategories,
    createCategory,
  };
};
