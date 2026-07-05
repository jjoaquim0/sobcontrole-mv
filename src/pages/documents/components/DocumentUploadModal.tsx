import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { DocumentCategory } from '../../../types';
import { DOCUMENT_CATEGORIES, formatFileSize } from '../../../services/documentService';
import { CategoryIcon } from './CategoryIcon';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/xml',
  'application/xml',
];
const ACCEPT_ATTR = '.pdf,.png,.jpg,.jpeg,.csv,.xlsx,.xls,.doc,.docx,.xml';

export interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File, category: DocumentCategory, name?: string) => Promise<void>;
  isLoading?: boolean;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({ isOpen, onClose, onUpload, isLoading = false }) => {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [documentName, setDocumentName] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('outros');
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFiles([]);
      setDocumentName('');
      setCategory('outros');
      setProgress(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (files.length === 1) {
      setDocumentName(files[0].name);
    }
  }, [files]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isLoading) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress((prev) => (prev >= 95 ? 95 : prev + Math.floor(Math.random() * 12) + 5));
      }, 150);
    } else if (!isLoading && progress > 0) {
      setProgress(100);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const validateAndAddFiles = (incoming: FileList | File[]) => {
    const incomingArray = Array.from(incoming);
    const combined = [...files];

    for (const file of incomingArray) {
      if (combined.length >= MAX_FILES) {
        toast.error(`Você pode enviar no máximo ${MAX_FILES} arquivos por vez.`);
        break;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`"${file.name}" excede o limite de 10MB.`);
        continue;
      }
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        toast.error(`"${file.name}" possui um tipo de arquivo não suportado.`);
        continue;
      }
      combined.push(file);
    }

    setFiles(combined);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(e.target.files);
    }
    e.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadClick = async () => {
    if (files.length === 0) return;
    try {
      if (files.length === 1) {
        await onUpload(files[0], category, documentName || files[0].name);
      } else {
        for (const file of files) {
          await onUpload(file, category, file.name);
        }
      }
      toast.success(files.length > 1 ? `${files.length} documentos enviados com sucesso!` : 'Documento enviado com sucesso!');
      onClose();
    } catch (e) {
      // erro já tratado via toast na mutation
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isLoading ? undefined : onClose}
            className="fixed inset-0 bg-black/55 backdrop-blur-sm"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 shadow-2xl p-6 w-full max-w-2xl z-10 max-h-[90vh] overflow-y-auto transition-colors duration-300"
          >
            <div className="flex justify-between items-center mb-5 border-b border-gray-100 dark:border-white/5 pb-3">
              <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                <Upload className="w-5 h-5 text-[#10b981]" />
                <h3 className="text-lg font-bold">Enviar Documento</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
                  dragActive
                    ? 'border-[#10b981] bg-[#10b981]/5'
                    : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept={ACCEPT_ATTR}
                  multiple
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 text-[#10b981]">
                  <Upload className="w-6 h-6 animate-pulse" />
                </div>
                <h5 className="text-sm font-bold text-gray-800 dark:text-gray-200">Arraste arquivos aqui ou clique para selecionar</h5>
                <p className="text-xs text-gray-400 mt-1">PDF, PNG, JPG, CSV, XLSX, DOC, DOCX, XML · até 10MB · máx. {MAX_FILES} arquivos</p>
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200/50 dark:border-white/5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CategoryIcon mimeType={file.type} size="sm" />
                        <div className="min-w-0">
                          <h5 className="text-sm font-bold text-gray-900 dark:text-white truncate">{file.name}</h5>
                          <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      {!isLoading && (
                        <button
                          onClick={() => handleRemoveFile(index)}
                          className="text-gray-400 hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded-xl transition-all duration-200 shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {files.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {files.length === 1 && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Nome do Documento</label>
                      <input
                        type="text"
                        value={documentName}
                        onChange={(e) => setDocumentName(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200"
                      />
                    </div>
                  )}

                  <div className={`space-y-1.5 ${files.length === 1 ? '' : 'sm:col-span-2'}`}>
                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Categoria</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as DocumentCategory)}
                      className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200 appearance-none cursor-pointer"
                    >
                      {DOCUMENT_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value} className="dark:bg-[#1a1d27]">{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {isLoading && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 text-[#10b981] animate-spin" /> Enviando documento(s)...
                    </span>
                    <span className="font-bold text-[#10b981]">{progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <motion.div className="h-full bg-[#10b981]" animate={{ width: `${progress}%` }} transition={{ duration: 0.1 }} />
                  </div>
                </div>
              )}

              {files.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Selecione ao menos um arquivo para continuar.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-100 dark:border-white/5 pt-4 mt-5">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors duration-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleUploadClick}
                disabled={isLoading || files.length === 0}
                className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 shadow-md shadow-emerald-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isLoading ? 'Enviando...' : 'Enviar Documento'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
