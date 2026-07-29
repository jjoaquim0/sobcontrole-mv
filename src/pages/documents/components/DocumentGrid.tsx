import React from 'react';
import { FolderOpen } from 'lucide-react';
import { Document } from '../../../types';
import { DocumentCard } from './DocumentCard';

interface DocumentGridProps {
  documents: Document[];
  isLoading: boolean;
  onView: (document: Document) => void;
  isFiltered: boolean;
}

export const DocumentGrid: React.FC<DocumentGridProps> = ({ documents, isLoading, onView, isFiltered }) => {
  if (isLoading) return <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-[184px] animate-pulse rounded-2xl border border-gray-100 bg-white p-4 dark:border-white/5 dark:bg-[#1a1d27]"><div className="h-12 w-12 rounded-xl bg-gray-100 dark:bg-white/5" /><div className="mt-4 h-3.5 w-3/4 rounded bg-gray-100 dark:bg-white/5" /><div className="mt-2 h-2.5 w-1/2 rounded bg-gray-100 dark:bg-white/5" /></div>)}</div>;
  if (documents.length === 0) return <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white p-12 text-center shadow-sm dark:border-white/5 dark:bg-[#1a1d27]"><div className="mb-4 rounded-full bg-emerald-50 p-3 text-[#10b981] dark:bg-emerald-950/20"><FolderOpen className="h-8 w-8" /></div><h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Nenhum documento encontrado</h3><p className="mt-1 max-w-xs text-sm text-gray-500 dark:text-gray-400">{isFiltered ? 'Tente ajustar os termos da busca ou os filtros selecionados.' : 'Envie o primeiro documento da sua empresa.'}</p></div>;
  return <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{documents.map((document) => <DocumentCard key={document.id} document={document} onView={onView} />)}</div>;
};
