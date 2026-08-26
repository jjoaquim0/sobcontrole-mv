import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { Document } from '../../../types';
import {
  ATOMIC_APPLY_ERROR_MESSAGE,
  createNfeProposalForm,
  getNfeProposalFormWithNotes,
  isNfeProposalItemReady,
  NFE_ITEM_REVIEW_LIMIT,
  NfeProposalFormValues,
  validateNfeProposalForm,
} from '../../../services/documentImportService';
import { useDocumentImport } from '../../../hooks/useDocumentImport';
import { NfeItemReviewTable } from './NfeItemReviewTable';

const VOLUME_NOTICE = (count: number): string => `Esta nota tem ${count} itens — acima dos ${NFE_ITEM_REVIEW_LIMIT} que revisamos automaticamente aqui. Fornecedor e contas a pagar foram lançados; os produtos não foram adicionados ao estoque — lance-os manualmente.`;

export interface DocumentImportReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document;
}

const initialForm: NfeProposalFormValues = {
  supplierDocument: '',
  supplierName: '',
  totalAmount: '',
  discount: '',
  fee: '',
  finalValue: '',
  installments: [],
};

const formatCurrency = (value: number): string =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusText = (state: ReturnType<typeof useDocumentImport>['state']): string => {
  if (state === 'queued') return 'Extração enfileirada.';
  if (state === 'running') return 'Extração em andamento.';
  if (state === 'failed') return 'A extração falhou. É necessário tentar novamente explicitamente.';
  if (state === 'review') return 'Proposta carregada para revisão.';
  if (state === 'summary') return 'Resumo pronto para confirmação.';
  if (state === 'confirming') return 'Salvando revisão e confirmando a aplicação.';
  if (state === 'success') return 'Importação concluída.';
  return '';
};

const ErrorMessage: React.FC<{ message: string; id?: string }> = ({ message, id }) => (
  <p id={id} role="alert" className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{message}</p>
);

export const DocumentImportReviewModal: React.FC<DocumentImportReviewModalProps> = ({ isOpen, onClose, document }) => {
  const importFlow = useDocumentImport(document, isOpen);
  const refreshSupplierMatch = importFlow.refreshSupplierMatch;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [form, setForm] = useState<NfeProposalFormValues>(initialForm);
  const [formProposalId, setFormProposalId] = useState<string>();
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const timer = window.setTimeout(() => headingRef.current?.focus(), 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (!importFlow.proposal || importFlow.proposal.id === formProposalId) return;
    setForm(createNfeProposalForm(importFlow.proposal.payload));
    setFormProposalId(importFlow.proposal.id);
    setShowErrors(false);
  }, [formProposalId, importFlow.proposal]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && importFlow.state !== 'confirming') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [importFlow.state, isOpen, onClose]);

  const validation = useMemo(() => validateNfeProposalForm(form), [form]);
  const supplierMatch = importFlow.supplierMatch;
  const hasSupplierConflict = supplierMatch?.status === 'conflict';
  const itemCount = importFlow.itemCount;
  const isOverItemLimit = itemCount > NFE_ITEM_REVIEW_LIMIT;
  const areItemsReady = isOverItemLimit || importFlow.items.every(isNfeProposalItemReady);
  const canConfirm = Boolean(
    importFlow.proposal?.status === 'pending' &&
    Object.keys(validation.errors).length === 0 &&
    !importFlow.isSupplierMatchLoading &&
    supplierMatch &&
    supplierMatch.status !== 'invalid' &&
    !hasSupplierConflict &&
    areItemsReady,
  );

  const updateForm = <K extends keyof NfeProposalFormValues>(field: K, value: NfeProposalFormValues[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === 'supplierDocument') void refreshSupplierMatch(String(value));
  };

  const updateInstallment = (index: number, field: 'amount' | 'dueDate', value: string) => {
    setForm((current) => ({
      ...current,
      installments: current.installments.map((installment, installmentIndex) => installmentIndex === index ? { ...installment, [field]: value } : installment),
    }));
  };

  const addInstallment = () => {
    setForm((current) => ({ ...current, installments: [...current.installments, { amount: '', dueDate: '' }] }));
  };

  const removeInstallment = (index: number) => {
    setForm((current) => ({ ...current, installments: current.installments.filter((_, installmentIndex) => installmentIndex !== index) }));
  };

  const handleSummary = () => {
    setShowErrors(true);
    if (canConfirm) importFlow.goToSummary();
  };

  const handleConfirm = () => {
    if (!importFlow.proposal || !canConfirm) {
      setShowErrors(true);
      return;
    }
    const storedDocument = supplierMatch?.status === 'existing' ? supplierMatch.supplier.document : form.supplierDocument.replace(/\D/g, '');
    const payload = getNfeProposalFormWithNotes(importFlow.proposal.payload, form, storedDocument);
    void importFlow.confirm(payload);
  };

  if (!isOpen) return null;

  const isConfirming = importFlow.state === 'confirming';
  const safeClose = isConfirming ? undefined : onClose;
  const summaryPayload = validation.payload;
  const supplierLabel = supplierMatch?.status === 'existing'
    ? `Vinculado a ${supplierMatch.supplier.name || 'fornecedor existente'}`
    : supplierMatch?.status === 'conflict'
      ? 'Conflito: mais de um fornecedor possui este CNPJ'
      : 'Novo — será criado';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="document-import-title">
      <button type="button" aria-label="Fechar revisão" onClick={safeClose} disabled={isConfirming} className="fixed inset-0 cursor-default bg-black/60 backdrop-blur-sm disabled:cursor-not-allowed" />
      <section className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#1a1d27]">
        <header className="flex items-start justify-between gap-4 border-b border-gray-200 p-5 dark:border-white/10">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0B2551] to-[#00d2ff] text-white"><Sparkles className="h-5 w-5" /></span>
            <div>
              <h2 id="document-import-title" ref={headingRef} tabIndex={-1} className="text-lg font-bold text-gray-900 outline-none dark:text-white">Revisar importação — Nota Fiscal</h2>
              <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">{document.originalName || document.name} · XML original preservado</p>
            </div>
          </div>
          <button type="button" onClick={safeClose} disabled={isConfirming} className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Fechar revisão"><X className="h-5 w-5" /></button>
        </header>

        <div className="border-b border-gray-200 px-5 py-3 text-sm text-gray-600 dark:border-white/10 dark:text-gray-300" aria-live="polite">{statusText(importFlow.state)}</div>

        <div className="min-h-0 overflow-y-auto p-5">
          {(importFlow.state === 'idle' || importFlow.state === 'queued' || importFlow.state === 'running' || importFlow.state === 'failed' || (importFlow.state === 'error' && !importFlow.proposal)) && (
            <ExtractionState state={importFlow.state} error={importFlow.error?.message} onRetry={() => void importFlow.retry()} />
          )}

          {importFlow.state === 'review' && (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
              <DocumentImportContext document={document} />
              <div className="space-y-5">
                {isOverItemLimit
                  ? <VolumeNotice count={itemCount} />
                  : <NfeItemReviewTable items={importFlow.items} onSaveItem={importFlow.saveItem} onSearchProducts={importFlow.searchProducts} loadCategories={importFlow.loadCategories} createCategory={importFlow.createCategory} />}
                {importFlow.error && <ErrorMessage message={importFlow.error.message} />}
                <form onSubmit={(event) => { event.preventDefault(); handleSummary(); }} noValidate className="space-y-5">
                  <section aria-labelledby="supplier-section-title" className="space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-white/10">
                    <div className="flex flex-wrap items-center justify-between gap-2"><h3 id="supplier-section-title" className="font-bold text-gray-900 dark:text-white">Fornecedor</h3><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${supplierMatch?.status === 'existing' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200' : supplierMatch?.status === 'conflict' ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-200' : 'bg-cyan-50 text-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-200'}`}>{supplierLabel}</span></div>
                    <label htmlFor="document-import-supplier-document" className="block text-sm font-semibold text-gray-700 dark:text-gray-200">CNPJ</label>
                    <input id="document-import-supplier-document" value={form.supplierDocument} onChange={(event) => updateForm('supplierDocument', event.target.value)} aria-invalid={Boolean(showErrors && validation.errors.supplierDocument)} aria-describedby={showErrors && validation.errors.supplierDocument ? 'supplier-document-error' : undefined} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 font-mono text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-white/10 dark:bg-white/5 dark:text-white" />
                    {showErrors && validation.errors.supplierDocument && <ErrorMessage id="supplier-document-error" message={validation.errors.supplierDocument} />}
                    <label htmlFor="document-import-supplier-name" className="block text-sm font-semibold text-gray-700 dark:text-gray-200">Nome do fornecedor</label>
                    <input id="document-import-supplier-name" value={form.supplierName} onChange={(event) => updateForm('supplierName', event.target.value)} aria-invalid={Boolean(showErrors && validation.errors.supplierName)} aria-describedby={showErrors && validation.errors.supplierName ? 'supplier-name-error' : undefined} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-white/10 dark:bg-white/5 dark:text-white" />
                    {showErrors && validation.errors.supplierName && <ErrorMessage id="supplier-name-error" message={validation.errors.supplierName} />}
                    {supplierMatch?.status === 'conflict' && <ErrorMessage message="Não é possível confirmar enquanto houver fornecedores duplicados com este CNPJ." />}
                  </section>

                  <section aria-labelledby="purchase-section-title" className="space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-white/10">
                    <div className="flex items-center justify-between gap-2"><h3 id="purchase-section-title" className="font-bold text-gray-900 dark:text-white">Compra</h3><span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Pagamento: outro</span></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <MoneyField id="total-amount" label="Valor dos produtos" value={form.totalAmount} error={showErrors ? validation.errors.totalAmount : undefined} onChange={(value) => updateForm('totalAmount', value)} />
                      <MoneyField id="discount" label="Desconto" value={form.discount} error={showErrors ? validation.errors.discount : undefined} onChange={(value) => updateForm('discount', value)} />
                      <MoneyField id="fee" label="Frete e acréscimos" value={form.fee} error={showErrors ? validation.errors.fee : undefined} onChange={(value) => updateForm('fee', value)} />
                      <MoneyField id="final-value" label="Valor final" value={form.finalValue} error={showErrors ? validation.errors.finalValue : undefined} onChange={(value) => updateForm('finalValue', value)} />
                    </div>
                  </section>

                  <section aria-labelledby="installments-section-title" className="space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-white/10">
                    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 id="installments-section-title" className="font-bold text-gray-900 dark:text-white">Parcelas</h3><p className="text-xs text-gray-500 dark:text-gray-400">O XML não inventa vencimentos. Preencha manualmente quando necessário.</p></div><button type="button" onClick={addInstallment} className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 px-2.5 py-1.5 text-xs font-semibold text-cyan-800 hover:bg-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-cyan-400/30 dark:text-cyan-200 dark:hover:bg-cyan-950/30"><Plus className="h-3.5 w-3.5" />Adicionar parcela</button></div>
                    {form.installments.length === 0 && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-200">Nenhuma parcela foi extraída. Adicione pelo menos uma antes de confirmar.</p>}
                    {showErrors && validation.errors.installments && <ErrorMessage message={validation.errors.installments} />}
                    <div className="space-y-3">
                      {form.installments.map((installment, index) => <div key={`installment-${index}`} className="grid gap-3 rounded-xl border border-gray-100 p-3 sm:grid-cols-[1fr_1fr_auto] dark:border-white/10">
                        <MoneyField id={`installment-${index}-amount`} label={`Valor da parcela ${index + 1}`} value={installment.amount} error={showErrors ? validation.errors[`installments[${index}].amount`] : undefined} onChange={(value) => updateInstallment(index, 'amount', value)} />
                        <div><label htmlFor={`installment-${index}-due-date`} className="block text-xs font-semibold text-gray-600 dark:text-gray-300">Vencimento</label><input id={`installment-${index}-due-date`} type="date" value={installment.dueDate} onChange={(event) => updateInstallment(index, 'dueDate', event.target.value)} aria-invalid={Boolean(showErrors && validation.errors[`installments[${index}].dueDate`])} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-white/10 dark:bg-white/5 dark:text-white" />{showErrors && validation.errors[`installments[${index}].dueDate`] && <ErrorMessage message={validation.errors[`installments[${index}].dueDate`]} />}</div>
                        <button type="button" onClick={() => removeInstallment(index)} aria-label={`Remover parcela ${index + 1}`} className="self-end rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 dark:hover:bg-red-950/20"><Trash2 className="h-4 w-4" /></button>
                      </div>)}
                    </div>
                  </section>

                  <div className="flex justify-end"><button type="submit" disabled={!canConfirm || importFlow.isBusy} className="rounded-xl bg-[#0B2551] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-cyan-900/10 hover:bg-[#12366f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-50">Ver resumo e confirmar</button></div>
                </form>
              </div>
            </div>
          )}

          {(importFlow.state === 'summary' || isConfirming) && summaryPayload && (
            <SummaryState payload={summaryPayload} supplierLabel={supplierLabel} itemCount={itemCount} items={importFlow.items} isConfirming={isConfirming} onBack={() => importFlow.backToReview()} onConfirm={handleConfirm} />
          )}

          {importFlow.state === 'success' && <SuccessState itemCount={itemCount} />}
          {importFlow.state === 'error' && importFlow.proposal && <div className="space-y-4">{isOverItemLimit && <VolumeNotice count={itemCount} />}<ErrorMessage message={importFlow.error?.message || ATOMIC_APPLY_ERROR_MESSAGE} /><button type="button" onClick={() => importFlow.backToReview()} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5">Voltar à revisão</button></div>}
        </div>
      </section>
    </div>
  );
};

const ExtractionState: React.FC<{ state: ReturnType<typeof useDocumentImport>['state']; error?: string; onRetry: () => void }> = ({ state, error, onRetry }) => {
  const running = state === 'queued' || state === 'running';
  return <section className="mx-auto max-w-xl space-y-4 rounded-2xl border border-gray-200 p-6 text-center dark:border-white/10">
    {running ? <Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-500" aria-label="Extraindo" /> : state === 'failed' || state === 'error' ? <AlertCircle className="mx-auto h-8 w-8 text-red-500" /> : <Sparkles className="mx-auto h-8 w-8 text-cyan-500" />}
    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{running ? 'Acompanhando a extração' : state === 'failed' || state === 'error' ? 'Não foi possível concluir a extração' : 'Preparando importação'}</h3>
    <p className="text-sm text-gray-500 dark:text-gray-400">{error || (running ? 'Aguarde enquanto o XML é validado. Esta tela será atualizada automaticamente.' : 'A proposta será carregada sob a sessão da sua empresa.')}</p>
    {state === 'failed' || state === 'error' ? <button type="button" onClick={onRetry} className="rounded-xl bg-[#0B2551] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#12366f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">Tentar novamente</button> : null}
  </section>;
};

const DocumentImportContext: React.FC<{ document: Document }> = ({ document }) => <aside className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.03]"><h3 className="font-bold text-gray-900 dark:text-white">Documento original</h3><dl className="space-y-3 text-sm"><div><dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Arquivo</dt><dd className="mt-1 break-words font-medium text-gray-800 dark:text-gray-200">{document.originalName || document.name}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Formato</dt><dd className="mt-1 text-gray-700 dark:text-gray-300">XML · {document.mimeType}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Versão usada</dt><dd className="mt-1 break-all font-mono text-xs text-gray-700 dark:text-gray-300">{document.currentVersionId}</dd></div></dl><p className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-900 dark:border-cyan-400/20 dark:bg-cyan-950/20 dark:text-cyan-100">A revisão altera somente a proposta. O arquivo e a versão originais continuam preservados.</p></aside>;

const VolumeNotice: React.FC<{ count: number }> = ({ count }) => <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium leading-5 text-amber-900 dark:border-amber-400/20 dark:bg-amber-950/20 dark:text-amber-100">{VOLUME_NOTICE(count)}</p>;

const MoneyField: React.FC<{ id: string; label: string; value: string; error?: string; onChange: (value: string) => void }> = ({ id, label, value, error, onChange }) => <div><label htmlFor={`document-import-${id}`} className="block text-xs font-semibold text-gray-600 dark:text-gray-300">{label}</label><input id={`document-import-${id}`} type="text" inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `document-import-${id}-error` : undefined} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-white/10 dark:bg-white/5 dark:text-white" />{error && <ErrorMessage id={`document-import-${id}-error`} message={error} />}</div>;

const SummaryState: React.FC<{ payload: NonNullable<ReturnType<typeof validateNfeProposalForm>['payload']>; supplierLabel: string; itemCount: number; items: ReturnType<typeof useDocumentImport>['items']; isConfirming: boolean; onBack: () => void; onConfirm: () => void }> = ({ payload, supplierLabel, itemCount, items, isConfirming, onBack, onConfirm }) => <div className="mx-auto max-w-2xl space-y-5">{itemCount > NFE_ITEM_REVIEW_LIMIT ? <VolumeNotice count={itemCount} /> : <p className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm font-medium text-cyan-900 dark:border-cyan-400/20 dark:bg-cyan-950/20 dark:text-cyan-100">{items.length > 0 ? `${items.length} item(ns) revisado(s); produtos e estoque serão atualizados na confirmação.` : 'Não foi possível identificar itens nesta nota. Eles poderão ser lançados manualmente depois.'}</p>}<section className="rounded-2xl border border-gray-200 p-5 dark:border-white/10"><h3 className="text-xl font-bold text-gray-900 dark:text-white">Confirmar importação</h3><dl className="mt-5 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Fornecedor</dt><dd className="mt-1 font-semibold text-gray-800 dark:text-gray-200">{payload.supplier.name}</dd><dd className="text-sm text-gray-500 dark:text-gray-400">{supplierLabel}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Compra</dt><dd className="mt-1 font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(payload.purchase.final_value)}</dd><dd className="text-sm text-gray-500 dark:text-gray-400">Pagamento: outro</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Contas a pagar</dt><dd className="mt-1 font-semibold text-gray-800 dark:text-gray-200">{payload.purchase.installments.length} parcela(s)</dd><dd className="text-sm text-gray-500 dark:text-gray-400">Total: {formatCurrency(payload.purchase.installments.reduce((total, installment) => total + installment.amount, 0))}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Itens, produtos e estoque</dt><dd className="mt-1 font-semibold text-gray-800 dark:text-gray-200">{itemCount > NFE_ITEM_REVIEW_LIMIT ? 'Acima do limite de revisão' : items.length > 0 ? 'Prontos para aplicação' : 'Sem itens identificados'}</dd><dd className="text-sm text-gray-500 dark:text-gray-400">{itemCount > NFE_ITEM_REVIEW_LIMIT ? 'Os itens ficam para lançamento manual.' : 'A aplicação usa as decisões revisadas.'}</dd></div></dl></section><div className="flex flex-wrap justify-end gap-3"><button type="button" onClick={onBack} disabled={isConfirming} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5">Voltar e revisar</button><button type="button" onClick={onConfirm} disabled={isConfirming} className="inline-flex items-center gap-2 rounded-xl bg-[#0B2551] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#12366f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-50">{isConfirming && <Loader2 className="h-4 w-4 animate-spin" />}Confirmar e gravar</button></div></div>;

const SuccessState: React.FC<{ itemCount: number }> = ({ itemCount }) => <section className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-400/20 dark:bg-emerald-950/20"><CheckCircle2 className="h-9 w-9 text-emerald-600 dark:text-emerald-300" /><h3 className="text-xl font-bold text-emerald-950 dark:text-emerald-100">Importação concluída</h3>{itemCount > NFE_ITEM_REVIEW_LIMIT ? <VolumeNotice count={itemCount} /> : <p className="text-sm leading-6 text-emerald-900 dark:text-emerald-100">Fornecedor, compra, itens, produtos e estoque foram aplicados pela confirmação.</p>}</section>;
