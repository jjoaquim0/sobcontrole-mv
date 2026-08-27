import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applyBoletoPayableProposal,
  BoletoImportError,
  BoletoImportProposal,
  BoletoImportErrorCode,
  BoletoSupplierFormValues,
  findBoletoSupplierMatch,
  getBoletoImportErrorMessage,
  saveBoletoSupplier,
  startBoletoDocumentExtraction,
} from '../services/boletoImportService';
import { SupplierMatchResult } from '../services/documentImportService';

export type BoletoImportViewState = 'idle' | 'starting' | 'review' | 'summary' | 'confirming' | 'success' | 'applied' | 'error';

const toSafeError = (error: unknown, fallbackCode: BoletoImportErrorCode = 'internal_error'): BoletoImportError => {
  if (error instanceof BoletoImportError) return error;
  return new BoletoImportError(fallbackCode);
};

export const useBoletoImport = (isOpen = false) => {
  const [state, setState] = useState<BoletoImportViewState>('idle');
  const [proposal, setProposal] = useState<BoletoImportProposal | null>(null);
  const [supplierMatch, setSupplierMatch] = useState<SupplierMatchResult | null>(null);
  const [isSupplierMatchLoading, setIsSupplierMatchLoading] = useState(false);
  const [error, setError] = useState<BoletoImportError | null>(null);
  const [isResumed, setIsResumed] = useState(false);
  const operationRef = useRef(false);

  const reset = useCallback(() => {
    operationRef.current = false;
    setState('idle');
    setProposal(null);
    setSupplierMatch(null);
    setIsSupplierMatchLoading(false);
    setError(null);
    setIsResumed(false);
  }, []);

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  const refreshSupplierMatch = useCallback(async (supplierDocument: string) => {
    if (supplierDocument.replace(/\D/g, '').length !== 14) {
      setSupplierMatch({ status: 'invalid', normalizedDocument: supplierDocument.replace(/\D/g, ''), supplier: null });
      setIsSupplierMatchLoading(false);
      return;
    }
    setIsSupplierMatchLoading(true);
    try {
      setSupplierMatch(await findBoletoSupplierMatch(supplierDocument));
    } catch (matchError) {
      setError(toSafeError(matchError));
    } finally {
      setIsSupplierMatchLoading(false);
    }
  }, []);

  const start = useCallback(async (line: string) => {
    if (operationRef.current) return;
    operationRef.current = true;
    setError(null);
    setState('starting');
    try {
      const result = await startBoletoDocumentExtraction(line);
      setProposal(result.proposal);
      setIsResumed(result.resumed);
      if (result.proposal.status === 'applied') {
        setState('applied');
        return;
      }
      setState('review');
      await refreshSupplierMatch(result.proposal.payload.supplier.document);
    } catch (startError) {
      setError(toSafeError(startError, 'boleto_line_invalid'));
      setState('error');
    } finally {
      operationRef.current = false;
    }
  }, [refreshSupplierMatch]);

  const saveSupplier = useCallback(async (form: BoletoSupplierFormValues) => {
    if (!proposal || proposal.status !== 'pending') throw new BoletoImportError('document_not_found');
    const saved = await saveBoletoSupplier(proposal.id, form);
    setProposal(saved);
    return saved;
  }, [proposal]);

  const goToSummary = useCallback(() => {
    if (state === 'review') setState('summary');
  }, [state]);

  const backToReview = useCallback(() => {
    if (state === 'summary') setState('review');
  }, [state]);

  const confirm = useCallback(async (form: BoletoSupplierFormValues) => {
    if (!proposal || proposal.status !== 'pending' || operationRef.current) return;
    operationRef.current = true;
    setError(null);
    setState('confirming');
    try {
      const saved = await saveBoletoSupplier(proposal.id, form);
      setProposal(saved);
      const applied = await applyBoletoPayableProposal(saved.id);
      setProposal(applied);
      setState('success');
    } catch (confirmError) {
      setError(toSafeError(confirmError, 'apply_failed'));
      setState('review');
    } finally {
      operationRef.current = false;
    }
  }, [proposal]);

  return {
    state,
    proposal,
    supplierMatch,
    isSupplierMatchLoading,
    error,
    isResumed,
    isBusy: operationRef.current || state === 'starting' || state === 'confirming',
    start,
    reset,
    refreshSupplierMatch,
    saveSupplier,
    goToSummary,
    backToReview,
    confirm,
    getErrorMessage: getBoletoImportErrorMessage,
  };
};
