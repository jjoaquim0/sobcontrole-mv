import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Archive, ArchiveRestore, Trash2, Loader2, Calendar, User, Tag, FileType } from 'lucide-react';
import { Document } from '../../../types';
import { CategoryIcon } from './CategoryIcon';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { DOCUMENT_CATEGORIES, formatFileSize } from '../../../services/documentService';

export interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document?: Document;
  onDownload: (doc: Document) => void;
  onToggleArchive: (doc: Document) => void;
  onDelete: (doc: Document) => void;
  isArchiving?: boolean;
  isDeleting?: boolean;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  document,
  onDownload,
  onToggleArchive,
  onDelete,
  isArchiving = false,
  isDeleting = false,
}) => {
  if (!document) return null;

  const categoryLabel = DOCUMENT_CATEGORIES.find((c) => c.value === document.category)?.label || 'Outros';
  const isImage = document.mimeType.startsWith('image/');
  const isPdf = document.mimeType === 'application/pdf';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 shadow-2xl w-full max-w-4xl max-h-[90vh] z-10 overflow-hidden flex flex-col md:flex-row transition-colors duration-300"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-600 dark:hover:text-white p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 bg-white/80 dark:bg-black/30 transition-colors duration-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-full md:w-[320px] shrink-0 p-6 border-b md:border-b-0 md:border-r border-gray-100 dark:border-white/5 overflow-y-auto space-y-5">
              <div className="flex items-start gap-3">
                <CategoryIcon mimeType={document.mimeType} size="lg" />
                <div className="min-w-0 pt-1">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white break-words">{document.name}</h3>
                  <div className="mt-1.5">
                    <StatusBadge status={document.status === 'active' ? 'active' : 'inactive'} />
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2.5">
                  <Tag className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wide">Categoria</span>
                    <span className="text-gray-800 dark:text-gray-200 font-semibold">{categoryLabel}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <FileType className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wide">Tamanho</span>
                    <span className="text-gray-800 dark:text-gray-200 font-semibold">{formatFileSize(document.size)}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wide">Enviado em</span>
                    <span className="text-gray-800 dark:text-gray-200 font-semibold">
                      {new Date(document.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {document.uploadedByName && (
                  <div className="flex items-start gap-2.5">
                    <User className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wide">Enviado por</span>
                      <span className="text-gray-800 dark:text-gray-200 font-semibold">{document.uploadedByName}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 dark:border-white/5 pt-4 space-y-2">
                <button
                  onClick={() => onDownload(document)}
                  className="w-full flex items-center justify-center gap-1.5 bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-200"
                >
                  <Download className="w-4 h-4" />
                  Baixar
                </button>
                <button
                  onClick={() => onToggleArchive(document)}
                  disabled={isArchiving}
                  className="w-full flex items-center justify-center gap-1.5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-200 disabled:opacity-50"
                >
                  {isArchiving ? <Loader2 className="w-4 h-4 animate-spin" /> : document.status === 'active' ? <Archive className="w-4 h-4" /> : <ArchiveRestore className="w-4 h-4" />}
                  {document.status === 'active' ? 'Arquivar' : 'Desarquivar'}
                </button>
                <button
                  onClick={() => onDelete(document)}
                  disabled={isDeleting}
                  className="w-full flex items-center justify-center gap-1.5 border border-red-200 dark:border-red-500/20 text-red-500 hover:bg-red-500/10 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-200 disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Excluir
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-[320px] bg-gray-50 dark:bg-black/20 flex items-center justify-center p-4">
              {isImage ? (
                <img src={document.url} alt={document.name} className="max-w-full max-h-[70vh] object-contain rounded-lg" />
              ) : isPdf ? (
                <embed src={document.url} type="application/pdf" className="w-full h-[70vh] rounded-lg" />
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 text-center p-8">
                  <CategoryIcon mimeType={document.mimeType} size="lg" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">Visualização não disponível para este tipo de arquivo.</p>
                  <button
                    onClick={() => onDownload(document)}
                    className="inline-flex items-center gap-1.5 bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-4 py-2 text-sm font-semibold transition-colors duration-200"
                  >
                    <Download className="w-4 h-4" />
                    Baixar Arquivo
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
