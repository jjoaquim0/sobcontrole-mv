import React from 'react';
import { Eye, FileClock, LockKeyhole } from 'lucide-react';
import { Document } from '../../../types';
import { DOCUMENT_CATEGORIES, formatFileSize } from '../../../services/documentService';
import { getDocumentVisibilityLabel } from '../../../services/documentDomain';
import { CategoryIcon } from './CategoryIcon';

interface DocumentCardProps {
  document: Document;
  onView: (document: Document) => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({ document, onView }) => <article className="flex min-w-0 flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-white/5 dark:bg-[#1a1d27]"><div className="flex items-start justify-between"><CategoryIcon mimeType={document.mimeType} size="md" /><span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${document.deletedAt ? 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-300' : document.status === 'archived' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300'}`}>{document.deletedAt ? 'Excluído' : document.status === 'archived' ? 'Arquivado' : 'Ativo'}</span></div><button type="button" onClick={() => onView(document)} className="min-w-0 text-left"><h3 className="truncate text-sm font-bold text-gray-900 transition-colors hover:text-[#10b981] dark:text-white" title={document.name}>{document.name}</h3><p className="mt-0.5 truncate text-xs text-gray-500">{DOCUMENT_CATEGORIES.find((item) => item.value === document.category)?.label || document.category}</p></button><div className="space-y-1 text-xs text-gray-500"><p>{formatFileSize(document.size)} · {new Date(document.updatedAt).toLocaleDateString('pt-BR')}</p><p className="flex items-center gap-1 truncate"><LockKeyhole className="h-3 w-3" />{getDocumentVisibilityLabel(document.visibility)}</p><p className="flex items-center gap-1"><FileClock className="h-3 w-3" />{document.versionCount} versão(ões)</p></div><button type="button" onClick={() => onView(document)} className="mt-auto flex items-center justify-center gap-1.5 border-t border-gray-100 pt-2.5 text-sm font-semibold text-[#10b981] hover:text-[#059669] dark:border-white/5"><Eye className="h-4 w-4" />Abrir</button></article>;
