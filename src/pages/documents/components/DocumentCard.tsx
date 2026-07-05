import React from 'react';
import { Eye, Download, Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { Document } from '../../../types';
import { CategoryIcon } from './CategoryIcon';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { DOCUMENT_CATEGORIES, formatFileSize } from '../../../services/documentService';

interface DocumentCardProps {
  document: Document;
  onView: (doc: Document) => void;
  onDownload: (doc: Document) => void;
  onToggleArchive: (doc: Document) => void;
  onDelete: (doc: Document) => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({ document, onView, onDownload, onToggleArchive, onDelete }) => {
  const categoryLabel = DOCUMENT_CATEGORIES.find((c) => c.value === document.category)?.label || 'Outros';

  return (
    <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <CategoryIcon mimeType={document.mimeType} size="md" />
        <StatusBadge status={document.status === 'active' ? 'active' : 'inactive'} />
      </div>

      <div className="min-w-0">
        <h4
          className="text-sm font-bold text-gray-900 dark:text-white truncate cursor-pointer hover:text-[#10b981] transition-colors"
          title={document.name}
          onClick={() => onView(document)}
        >
          {document.name}
        </h4>
        <p className="text-xs text-gray-400 truncate mt-0.5">{categoryLabel}</p>
        <p className="text-xs text-gray-400 mt-1">
          {formatFileSize(document.size)} · {new Date(document.createdAt).toLocaleDateString('pt-BR')}
        </p>
      </div>

      <div className="flex items-center gap-0.5 border-t border-gray-100 dark:border-white/5 pt-2.5 mt-auto">
        <button
          type="button"
          onClick={() => onView(document)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
          title="Visualizar"
        >
          <Eye className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onDownload(document)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
          title="Baixar"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onToggleArchive(document)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
          title={document.status === 'active' ? 'Arquivar' : 'Desarquivar'}
        >
          {document.status === 'active' ? <Archive className="w-4 h-4" /> : <ArchiveRestore className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={() => onDelete(document)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors ml-auto"
          title="Excluir"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
