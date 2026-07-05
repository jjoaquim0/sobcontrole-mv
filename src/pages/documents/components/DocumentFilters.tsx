import React from 'react';
import { Search, X, Grid3x3, List } from 'lucide-react';
import { DocumentCategory } from '../../../types';
import { DOCUMENT_CATEGORIES } from '../../../services/documentService';

export type ViewMode = 'grid' | 'list';

interface DocumentFiltersProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  categoryFilter: DocumentCategory | 'all';
  onCategoryChange: (value: DocumentCategory | 'all') => void;
  statusFilter: 'active' | 'archived' | 'all';
  onStatusChange: (value: 'active' | 'archived' | 'all') => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  isFiltered: boolean;
  onClearFilters: () => void;
}

export const DocumentFilters: React.FC<DocumentFiltersProps> = ({
  searchInput,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  statusFilter,
  onStatusChange,
  viewMode,
  onViewModeChange,
  isFiltered,
  onClearFilters,
}) => {
  return (
    <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors duration-300">
      <div className="relative flex-1 max-w-md">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
          <Search className="w-4.5 h-4.5" />
        </span>
        <input
          type="text"
          placeholder="Pesquisar por nome do arquivo..."
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200"
        />
        {searchInput && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={categoryFilter}
          onChange={(e) => onCategoryChange(e.target.value as DocumentCategory | 'all')}
          className="px-4 py-2.5 pr-8 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200 appearance-none cursor-pointer"
        >
          <option value="all" className="dark:bg-[#1a1d27]">Todas as Categorias</option>
          {DOCUMENT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value} className="dark:bg-[#1a1d27]">{c.label}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value as 'active' | 'archived' | 'all')}
          className="px-4 py-2.5 pr-8 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200 appearance-none cursor-pointer"
        >
          <option value="all" className="dark:bg-[#1a1d27]">Todos os Status</option>
          <option value="active" className="dark:bg-[#1a1d27]">Ativos</option>
          <option value="archived" className="dark:bg-[#1a1d27]">Arquivados</option>
        </select>

        <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl border border-gray-200/50 dark:border-white/5">
          <button
            type="button"
            onClick={() => onViewModeChange('grid')}
            className={`p-1.5 rounded-lg transition-all duration-200 ${
              viewMode === 'grid' ? 'bg-white dark:bg-[#1a1d27] text-[#10b981] shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
            title="Visualização em Grade"
          >
            <Grid3x3 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('list')}
            className={`p-1.5 rounded-lg transition-all duration-200 ${
              viewMode === 'list' ? 'bg-white dark:bg-[#1a1d27] text-[#10b981] shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
            title="Visualização em Lista"
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        {isFiltered && (
          <button
            onClick={onClearFilters}
            className="text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white flex items-center gap-1 py-2 px-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all duration-200"
          >
            <X className="w-3.5 h-3.5" />
            Limpar Filtros
          </button>
        )}
      </div>
    </div>
  );
};
