import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileDigit, Loader2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useBoletoImport } from '../../../hooks/useBoletoImport';
import {
  BoletoSupplierFormValues,
  normalizeBoletoLine,
  validateBoletoSupplierForm,
} from '../../../services/boletoImportService';

export interface BoletoImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMPTY_FORM: BoletoSupplierFormValues = {
  supplierDocument: '',
  supplierName: '',
};

const DERIVED_FIELDS_DESCRIPTION = 'Valor e vencimento são calculados a partir dos dígitos validados e não podem ser editados nesta tela.';

const formatCurrency = (value: number): string =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const BoletoImportModal: React.FC<BoletoImportModalProps> = ({ isOpen, onClose }) => {
  const flow = useBoletoImport(isOpen);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [line, setLine] = useState('');
  const [form, setForm] = useState<BoletoSupplierFormValues>(EMPTY_FORM);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = window.setTimeout(() => headingRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!flow.proposal) return;
    setForm({
      supplierDocument: flow.proposal.payload.supplier.document,
      supplierName: flow.proposal.payload.supplier.name,
    });
    setShowErrors(false);
  }, [flow.proposal]);

  useEffect(() => {
    if (flow.supplierMatch?.status !== 'existing') return;
    setForm((current) => ({
      supplierDocument: flow.supplierMatch?.status === 'existing' ? flow.supplierMatch.supplier.document : current.supplierDocument,
      supplierName: flow.supplierMatch?.status === 'existing' ? flow.supplierMatch.supplier.name : current.supplierName,
    }));
  }, [flow.supplierMatch]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !flow.isBusy) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flow.isBusy, isOpen, onClose]);

  const canonicalLine = useMemo(() => normalizeBoletoLine(line), [line]);
  const lineHasExpectedLength = canonicalLine.length === 47;
  const supplierValidation = useMemo(() => validateBoletoSupplierForm(form), [form]);
  const hasSupplierConflict = flow.supplierMatch?.status === 'conflict';
  const canReview = Boolean(
    flow.proposal?.status === 'pending' &&
    supplierValidation.supplier &&
    flow.supplierMatch &&
    flow.supplierMatch.status !== 'invalid' &&
    !hasSupplierConflict &&
    !flow.isSupplierMatchLoading,
  );

  const updateSupplier = (field: keyof BoletoSupplierFormValues, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === 'supplierDocument') void flow.refreshSupplierMatch(value);
  };

  const saveSupplierOnBlur = () => {
    if (flow.state !== 'review' || !supplierValidation.supplier) return;
    void flow.saveSupplier(form).catch(() => undefined);
  };

  const start = () => {
    setShowErrors(false);
    if (!lineHasExpectedLength) {
      setShowErrors(true);
      return;
    }
    void flow.start(canonicalLine);
  };

  const goToSummary = () => {
    setShowErrors(true);
    if (canReview) flow.goToSummary();
  };

  const confirm = () => {
    setShowErrors(true);
    if (canReview) void flow.confirm(form);
  };

  if (!isOpen) return null;

  const isReview = flow.state === 'review';
  const isSummary = flow.state === 'summary' || flow.state === 'confirming';
  const isConfirming = flow.state === 'confirming';
  const lineError = !lineHasExpectedLength && showErrors ? 'Informe exatamente 47 dígitos após a normalização.' : undefined;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="boleto-import-title">
      <button type="button" aria-label="Fechar importação de boleto" onClick={isConfirming ? undefined : onClose} disabled={isConfirming} className="fixed inset-0 cursor-default bg-black/60 backdrop-blur-sm disabled:cursor-not-allowed" />
      <section className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#1a1d27]">
        <header className="flex items-start justify-between gap-4 border-b border-gray-200 p-5 dark:border-white/10">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0B2551] to-[#00d2ff] text-white"><FileDigit className="h-5 w-5" /></span>
            <div>
              <h2 id="boleto-import-title" ref={headingRef} tabIndex={-1} className="text-lg font-bold text-gray-900 outline-none dark:text-white">Importar boleto por linha digitável</h2>
              <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">Somente boleto bancário de cobrança com 47 dígitos.</p>
            </div>
          </div>
          <button type="button" onClick={isConfirming ? undefined : onClose} disabled={isConfirming} className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Fechar importação de boleto"><X className="h-5 w-5" /></button>
        </header>

        <div className="border-b border-gray-200 px-5 py-3 text-sm text-gray-600 dark:border-white/10 dark:text-gray-300" aria-live="polite">
          {flow.state === 'starting' ? 'Validando a linha e preparando a proposta.' : flow.isResumed && isReview ? 'Encontramos uma importação pendente deste boleto. Retomando a revisão.' : flow.state === 'applied' ? 'Este boleto já foi importado e não pode ser enviado novamente.' : flow.state === 'success' ? 'Boleto importado; a conta a pagar está pendente.' : isSummary ? 'Resumo pronto para gravar o boleto.' : isReview ? 'Proposta carregada para revisão.' : ''}
        </div>

        <div className="min-h-0 overflow-y-auto p-5">
          {(flow.state === 'idle' || flow.state === 'starting' || flow.state === 'error') && (
            <section className="mx-auto max-w-xl space-y-4 rounded-2xl border border-gray-200 p-6 dark:border-white/10">
              <label htmlFor="boleto-digitable-line" className="block text-sm font-bold text-gray-900 dark:text-white">Linha digitável</label>
              <textarea id="boleto-digitable-line" value={line} onChange={(event) => setLine(event.target.value)} disabled={flow.isBusy} rows={4} inputMode="numeric" aria-describedby="boleto-line-help" aria-invalid={Boolean(lineError)} className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 font-mono text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white" placeholder="Digite ou cole os 47 dígitos" />
              <p id="boleto-line-help" className="text-xs text-gray-500 dark:text-gray-400">Espaços, pontos, hífens e quebras de linha são apenas separadores. A linha não é corrigida automaticamente.</p>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{canonicalLine.length}/47 dígitos após a normalização.</p>
              {lineError && <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">{lineError}</p>}
              {flow.error && <p role="alert" className="flex gap-2 text-sm font-medium text-red-600 dark:text-red-400"><AlertCircle className="h-4 w-4 shrink-0" />{flow.error.message}</p>}
              <button type="button" onClick={start} disabled={!lineHasExpectedLength || flow.isBusy} className="inline-flex items-center gap-2 rounded-xl bg-[#0B2551] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#12366f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-50">{flow.state === 'starting' && <Loader2 className="h-4 w-4 animate-spin" />}Validar boleto</button>
            </section>
          )}

          {flow.state === 'applied' && <AppliedState />}
          {flow.state === 'success' && <SuccessState />}

          {isReview && flow.proposal && (
            <div className="mx-auto max-w-2xl space-y-5">
              <section className="space-y-4 rounded-2xl border border-gray-200 p-5 dark:border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-bold text-gray-900 dark:text-white">Revisar boleto</h3><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">Verificado pela linha digitável</span></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Linha canônica</dt><dd className="mt-1 break-all rounded-xl bg-gray-50 p-3 font-mono text-sm text-gray-800 dark:bg-white/[0.04] dark:text-gray-200">{flow.proposal.idempotencyKey}</dd></div>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div><dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Valor</dt><dd aria-describedby="boleto-derived-fields-description" className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(flow.proposal.payload.payable.amount)}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Vencimento</dt><dd aria-describedby="boleto-derived-fields-description" className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{new Date(flow.proposal.payload.payable.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</dd></div>
                </dl>
                <p id="boleto-derived-fields-description" className="text-xs text-gray-500 dark:text-gray-400">{DERIVED_FIELDS_DESCRIPTION}</p>
              </section>

              <section aria-labelledby="boleto-supplier-title" className="space-y-3 rounded-2xl border border-gray-200 p-5 dark:border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2"><h3 id="boleto-supplier-title" className="font-bold text-gray-900 dark:text-white">Fornecedor</h3><span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{flow.supplierMatch?.status === 'existing' ? 'Fornecedor resolvido no tenant' : flow.supplierMatch?.status === 'conflict' ? 'Conflito de cadastro' : 'Informe os dados manuais'}</span></div>
                <label htmlFor="boleto-supplier-document" className="block text-sm font-semibold text-gray-700 dark:text-gray-200">CNPJ</label>
                <input id="boleto-supplier-document" value={form.supplierDocument} onChange={(event) => updateSupplier('supplierDocument', event.target.value)} onBlur={saveSupplierOnBlur} aria-invalid={Boolean(showErrors && supplierValidation.errors.supplierDocument)} aria-describedby={showErrors && supplierValidation.errors.supplierDocument ? 'boleto-supplier-document-error' : undefined} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 font-mono text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-white/10 dark:bg-white/5 dark:text-white" />
                {showErrors && supplierValidation.errors.supplierDocument && <p id="boleto-supplier-document-error" role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">{supplierValidation.errors.supplierDocument}</p>}
                <label htmlFor="boleto-supplier-name" className="block text-sm font-semibold text-gray-700 dark:text-gray-200">Nome do fornecedor</label>
                <input id="boleto-supplier-name" value={form.supplierName} onChange={(event) => updateSupplier('supplierName', event.target.value)} onBlur={saveSupplierOnBlur} aria-invalid={Boolean(showErrors && supplierValidation.errors.supplierName)} aria-describedby={showErrors && supplierValidation.errors.supplierName ? 'boleto-supplier-name-error' : undefined} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-white/10 dark:bg-white/5 dark:text-white" />
                {showErrors && supplierValidation.errors.supplierName && <p id="boleto-supplier-name-error" role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">{supplierValidation.errors.supplierName}</p>}
                {flow.supplierMatch?.status === 'conflict' && <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">Não é possível gravar enquanto houver mais de um fornecedor com este CNPJ.</p>}
                {flow.isSupplierMatchLoading && <p className="text-xs text-gray-500 dark:text-gray-400">Consultando fornecedor na empresa atual...</p>}
              </section>

              {flow.error && <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">{flow.error.message}</p>}
              <div className="flex justify-end"><button type="button" onClick={goToSummary} disabled={!canReview || flow.isBusy} className="rounded-xl bg-[#0B2551] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#12366f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-50">Ver resumo e gravar</button></div>
            </div>
          )}

          {isSummary && flow.proposal && <SummaryState proposal={flow.proposal} form={form} isConfirming={isConfirming} onBack={flow.backToReview} onConfirm={confirm} />}
        </div>
      </section>
    </div>
  );
};

const SummaryState: React.FC<{ proposal: NonNullable<ReturnType<typeof useBoletoImport>['proposal']>; form: BoletoSupplierFormValues; isConfirming: boolean; onBack: () => void; onConfirm: () => void }> = ({ proposal, form, isConfirming, onBack, onConfirm }) => (
  <section className="mx-auto max-w-2xl space-y-5">
    <div className="rounded-2xl border border-gray-200 p-5 dark:border-white/10"><h3 className="text-xl font-bold text-gray-900 dark:text-white">Resumo do boleto</h3><dl className="mt-5 grid gap-4 sm:grid-cols-3"><div><dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Fornecedor</dt><dd className="mt-1 font-semibold text-gray-900 dark:text-white">{form.supplierName}</dd><dd className="text-sm text-gray-500 dark:text-gray-400">{form.supplierDocument}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Valor</dt><dd className="mt-1 font-semibold text-gray-900 dark:text-white">{formatCurrency(proposal.payload.payable.amount)}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Vencimento</dt><dd className="mt-1 font-semibold text-gray-900 dark:text-white">{new Date(proposal.payload.payable.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</dd></div></dl><p className="mt-4 text-xs text-gray-500 dark:text-gray-400">Valor e vencimento permanecem somente leitura e serão revalidados pela RPC.</p></div>
    <div className="flex flex-wrap justify-end gap-3"><button type="button" onClick={onBack} disabled={isConfirming} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-50 dark:border-white/10 dark:text-gray-200">Voltar à revisão</button><button type="button" onClick={onConfirm} disabled={isConfirming} className="inline-flex items-center gap-2 rounded-xl bg-[#0B2551] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#12366f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-50">{isConfirming && <Loader2 className="h-4 w-4 animate-spin" />}Gravar boleto</button></div>
  </section>
);

const AppliedState: React.FC = () => <section className="mx-auto max-w-xl space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-400/20 dark:bg-amber-950/20"><AlertCircle className="h-9 w-9 text-amber-600 dark:text-amber-300" /><h3 className="text-xl font-bold text-amber-950 dark:text-amber-100">Boleto já importado</h3><p className="text-sm leading-6 text-amber-900 dark:text-amber-100">Este boleto já foi aplicado e não pode ser enviado novamente.</p><Link to="/financial" className="inline-flex rounded-xl bg-[#0B2551] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#12366f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">Ver conta a pagar</Link></section>;

const SuccessState: React.FC = () => <section className="mx-auto max-w-xl space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-400/20 dark:bg-emerald-950/20"><CheckCircle2 className="h-9 w-9 text-emerald-600 dark:text-emerald-300" /><h3 className="text-xl font-bold text-emerald-950 dark:text-emerald-100">Boleto importado com sucesso</h3><p className="text-sm leading-6 text-emerald-900 dark:text-emerald-100">A conta a pagar foi criada com status pendente.</p><Link to="/financial" className="inline-flex rounded-xl bg-[#0B2551] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#12366f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">Ver conta a pagar</Link></section>;
