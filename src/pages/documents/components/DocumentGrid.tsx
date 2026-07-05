import React from 'react';
import { FolderOpen } from 'lucide-react';
import { Document } from '../../../types';
import { DocumentCard } from './DocumentCard';

interface DocumentGridProps {
  documents: Document[];
  isLoading: boolean;
  onView: (doc: Document) => void;
  onDownload: (doc: Document) => void;
  onToggleArchive: (doc: Document) => void;
  onDelete: (doc: Document) => void;
  isFiltered: boolean;
}

export const DocumentGrid: React.FC<DocumentGridProps> = ({ documents, isLoading, onView, onDownload, onToggleArchive, onDelete, isFiltered }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-[168px] bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-4 animate-pulse space-y-3">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-white/5" />
            <div className="h-3.5 bg-gray-100 dark:bg-white/5 rounded w-3/4" />
            <div className="h-2.5 bg-gray-100 dark:bg-white/5 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-12 shadow-sm text-center">
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-full text-[#10b981] mb-4">
          <FolderOpen className="w-8 h-8" />
        </div>
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-lg mb-1">Nenhum documento encontrado</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
          {isFiltered ? 'Tente ajustar os termos de busca ou filtros selecionados.' : 'Faça upload do primeiro documento da sua empresa.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {documents.map((doc) => (
        <DocumentCard key={doc.id} document={doc} onView={onView} onDownload={onDownload} onToggleArchive={onToggleArchive} onDelete={onDelete} />
      ))}
    </div>
  );
};
