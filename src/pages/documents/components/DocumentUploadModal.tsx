import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, FileWarning, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Document, DocumentCategory, DocumentRelatedType, DocumentVisibility } from '../../../types';
import { DOCUMENT_CATEGORIES, DocumentUploadInput, formatFileSize } from '../../../services/documentService';
import { DOCUMENT_RELATION_TYPES, DOCUMENT_STORAGE_CONFIG, DOCUMENT_VISIBILITIES, validateDocumentFile } from '../../../services/documentDomain';
import { useDocumentRelatedEntities } from '../../../hooks/useDocuments';
import { CategoryIcon } from './CategoryIcon';
import { AiSiteIntegrationAction } from './AiSiteIntegrationAction';
import { DocumentImportAction } from './DocumentImportAction';

const MAX_FILES_PER_BATCH = 5;

type UploadState = 'queued' | 'uploading' | 'success' | 'error';

interface PendingFile {
  file: File;
  state: UploadState;
  error?: string;
  document?: Document;
}

export interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File, input: DocumentUploadInput) => Promise<Document>;
  isLoading?: boolean;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({ isOpen, onClose, onUpload, isLoading = false }) => {
  const [dragActive, setDragActive] = useState(false);
  const [items, setItems] = useState<PendingFile[]>([]);
  const [documentName, setDocumentName] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('outros');
  const [visibility, setVisibility] = useState<DocumentVisibility>('company');
  const [description, setDescription] = useState('');
  const [relatedType, setRelatedType] = useState<DocumentRelatedType | ''>('');
  const [relatedId, setRelatedId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: relatedEntities = [], isLoading: isLoadingRelatedEntities } = useDocumentRelatedEntities(relatedType || undefined);

  const reset = () => {
    setItems([]);
    setDocumentName('');
    setCategory('outros');
    setVisibility('company');
    setDescription('');
    setRelatedType('');
    setRelatedId('');
  };

  useEffect(() => {
    if (isOpen) reset();
  }, [isOpen]);

  useEffect(() => {
    if (items.length === 1 && items[0].state === 'queued') setDocumentName(items[0].file.name);
    if (items.length !== 1) setDocumentName('');
  }, [items]);

  useEffect(() => setRelatedId(''), [relatedType]);

  const addFiles = (incoming: FileList | File[]) => {
    const next = [...items];
    for (const file of Array.from(incoming)) {
      if (next.length >= MAX_FILES_PER_BATCH) {
        toast.error(`Você pode enviar no máximo ${MAX_FILES_PER_BATCH} arquivos por vez.`);
        break;
      }
      const error = validateDocumentFile(file);
      if (error) {
        toast.error(error);
        continue;
      }
      next.push({ file, state: 'queued' });
    }
    setItems(next);
  };

  const handleDrag = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(event.type === 'dragenter' || event.type === 'dragover');
  };

  const updateItem = (index: number, patch: Partial<PendingFile>) => {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const handleUpload = async () => {
    const queuedIndexes = items.flatMap((item, index) => item.state === 'queued' || item.state === 'error' ? [index] : []);
    if (queuedIndexes.length === 0) return;

    const input: DocumentUploadInput = {
      name: items.length === 1 ? documentName.trim() || items[0].file.name : undefined,
      category,
      visibility,
      description: description.trim() || undefined,
      related: relatedType && relatedId ? { relatedType, relatedId } : undefined,
    };

    if (relatedType && !relatedId) {
      toast.error('Selecione a entidade relacionada ou remova o relacionamento.');
      return;
    }

    let successCount = 0;
    for (const index of queuedIndexes) {
      const item = items[index];
      updateItem(index, { state: 'uploading', error: undefined });
      try {
        const uploadedDocument = await onUpload(item.file, input);
        updateItem(index, { state: 'success', document: uploadedDocument });
        successCount += 1;
      } catch (error) {
        updateItem(index, { state: 'error', error: error instanceof Error ? error.message : 'Não foi possível enviar este arquivo.' });
      }
    }
    if (successCount > 0) toast.success(successCount === 1 ? 'Documento enviado com sucesso.' : `${successCount} documentos enviados com sucesso.`);
  };

  const canClose = !isLoading && !items.some((item) => item.state === 'uploading');

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="upload-document-title">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={canClose ? onClose : undefined} className="fixed inset-0 bg-black/55 backdrop-blur-sm" />
          <motion.div initial={{ scale: 0.96, opacity: 0, y: 15 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0, y: 15 }} className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-100 dark:border-white/5 bg-white dark:bg-[#1a1d27] p-6 shadow-2xl">
            <header className="flex items-center justify-between gap-4 border-b border-gray-100 dark:border-white/5 pb-4">
              <div className="flex items-center gap-2 text-gray-900 dark:text-white"><Upload className="w-5 h-5 text-[#10b981]" /><h3 id="upload-document-title" className="text-lg font-bold">Enviar documentos</h3></div>
              <button type="button" onClick={onClose} disabled={!canClose} className="rounded-xl p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:hover:bg-white/5 dark:hover:text-white" aria-label="Fechar upload"><X className="w-5 h-5" /></button>
            </header>

            <div className="mt-5 space-y-4">
              <div onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={(event) => { handleDrag(event); if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files); }} onClick={() => fileInputRef.current?.click()} className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${dragActive ? 'border-[#10b981] bg-emerald-50 dark:bg-emerald-950/20' : 'border-gray-200 bg-gray-50 hover:border-emerald-300 dark:border-white/10 dark:bg-white/[0.03]'}`}>
                <input ref={fileInputRef} type="file" accept={DOCUMENT_STORAGE_CONFIG.accept} multiple className="hidden" onChange={(event) => { if (event.target.files?.length) addFiles(event.target.files); event.target.value = ''; }} />
                <Upload className="mx-auto mb-2 w-6 h-6 text-[#10b981]" />
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Arraste os arquivos ou clique para selecionar</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">PDF, imagens, CSV, Excel, Word e XML · até 10 MB · máximo de {MAX_FILES_PER_BATCH} por envio</p>
              </div>

              {items.length > 0 && <div className="space-y-2" aria-live="polite">
                {items.map((item, index) => (
                  <div key={`${item.file.name}-${index}`} className="rounded-xl border border-gray-200/70 bg-gray-50 p-3 dark:border-white/5 dark:bg-white/[0.03]">
                    <div className="flex items-center gap-3">
                      <CategoryIcon mimeType={item.file.type} size="sm" />
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{item.file.name}</p><p className="text-xs text-gray-500">{formatFileSize(item.file.size)}</p></div>
                      {item.state === 'queued' && <button type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={!canClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-500/10 hover:text-red-500" aria-label={`Remover ${item.file.name}`}><X className="w-4 h-4" /></button>}
                      {item.state === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-[#10b981]" aria-label="Enviando" />}
                      {item.state === 'success' && <CheckCircle2 className="w-4 h-4 text-[#10b981]" aria-label="Enviado" />}
                      {item.state === 'error' && <FileWarning className="w-4 h-4 text-red-500" aria-label="Erro no envio" />}
                    </div>
                    {item.state === 'uploading' && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10"><div className="h-full w-3/4 animate-pulse rounded-full bg-[#10b981]" /></div>}
                    {item.error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{item.error}</p>}
                    {item.state === 'success' && item.document && <div className="mt-2 flex flex-wrap items-center gap-2"><AiSiteIntegrationAction compact /><DocumentImportAction document={item.document} compact /></div>}
                  </div>
                ))}
              </div>}

              {items.length > 0 && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {items.length === 1 && <label className="space-y-1.5"><span className="text-xs font-bold uppercase tracking-wide text-gray-500">Nome do documento</span><input value={documentName} onChange={(event) => setDocumentName(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#10b981] dark:border-white/10 dark:bg-white/5 dark:text-white" /></label>}
                <label className="space-y-1.5"><span className="text-xs font-bold uppercase tracking-wide text-gray-500">Categoria</span><select value={category} onChange={(event) => setCategory(event.target.value as DocumentCategory)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#10b981] dark:border-white/10 dark:bg-white/5 dark:text-white">{DOCUMENT_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                <label className="space-y-1.5"><span className="text-xs font-bold uppercase tracking-wide text-gray-500">Visibilidade</span><select value={visibility} onChange={(event) => setVisibility(event.target.value as DocumentVisibility)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#10b981] dark:border-white/10 dark:bg-white/5 dark:text-white">{DOCUMENT_VISIBILITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><span className="block text-xs text-gray-500">{DOCUMENT_VISIBILITIES.find((item) => item.value === visibility)?.description}</span></label>
                <label className="space-y-1.5"><span className="text-xs font-bold uppercase tracking-wide text-gray-500">Relacionar a</span><select value={relatedType} onChange={(event) => setRelatedType(event.target.value as DocumentRelatedType | '')} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#10b981] dark:border-white/10 dark:bg-white/5 dark:text-white"><option value="">Documento geral da empresa</option>{DOCUMENT_RELATION_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                {relatedType && <label className="space-y-1.5"><span className="text-xs font-bold uppercase tracking-wide text-gray-500">Entidade</span><select value={relatedId} onChange={(event) => setRelatedId(event.target.value)} disabled={isLoadingRelatedEntities} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#10b981] disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white"><option value="">{isLoadingRelatedEntities ? 'Carregando...' : 'Selecione uma entidade'}</option>{relatedEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.label}</option>)}</select></label>}
                <label className="space-y-1.5 sm:col-span-2"><span className="text-xs font-bold uppercase tracking-wide text-gray-500">Descrição (opcional)</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#10b981] dark:border-white/10 dark:bg-white/5 dark:text-white" /></label>
              </div>}
              {visibility === 'restricted' && <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-200"><AlertCircle className="h-4 w-4 shrink-0" />Após o envio, abra o detalhe do documento para selecionar as pessoas autorizadas.</p>}
            </div>

            <footer className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-white/5">
              <button type="button" onClick={onClose} disabled={!canClose} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 disabled:opacity-50 dark:border-white/10 dark:text-gray-300">Fechar</button>
              <button type="button" onClick={handleUpload} disabled={isLoading || items.length === 0 || items.every((item) => item.state === 'success')} className="flex items-center gap-1.5 rounded-xl bg-[#10b981] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/10 hover:bg-[#059669] disabled:cursor-not-allowed disabled:opacity-50"><Upload className="w-4 h-4" />Enviar arquivos</button>
            </footer>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
