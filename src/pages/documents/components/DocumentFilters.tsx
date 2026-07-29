import React from 'react';
import { Grid3x3, List, Search, SlidersHorizontal, X } from 'lucide-react';
import { DocumentCategory, DocumentRelatedType, DocumentStatus, DocumentVisibility, Profile } from '../../../types';
import { DOCUMENT_FILE_TYPES, DOCUMENT_CATEGORIES } from '../../../services/documentService';
import { DOCUMENT_RELATION_TYPES, DOCUMENT_VISIBILITIES } from '../../../services/documentDomain';

export type ViewMode = 'grid' | 'list';

interface DocumentFiltersProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  categoryFilter: DocumentCategory | 'all';
  onCategoryChange: (value: DocumentCategory | 'all') => void;
  statusFilter: DocumentStatus | 'all';
  onStatusChange: (value: DocumentStatus | 'all') => void;
  mimeTypeFilter: string | 'all';
  onMimeTypeChange: (value: string | 'all') => void;
  visibilityFilter: DocumentVisibility | 'all';
  onVisibilityChange: (value: DocumentVisibility | 'all') => void;
  uploadedByFilter: string | 'all';
  onUploadedByChange: (value: string | 'all') => void;
  relatedTypeFilter: DocumentRelatedType | 'all';
  onRelatedTypeChange: (value: DocumentRelatedType | 'all') => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  sortBy: 'recent' | 'name' | 'size' | 'updated';
  onSortByChange: (value: 'recent' | 'name' | 'size' | 'updated') => void;
  users: Pick<Profile, 'id' | 'name'>[];
  canViewDeleted: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  isFiltered: boolean;
  onClearFilters: () => void;
}

const selectClassName = 'min-w-0 px-3 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200 appearance-none cursor-pointer';

export const DocumentFilters: React.FC<DocumentFiltersProps> = ({
  searchInput,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  statusFilter,
  onStatusChange,
  mimeTypeFilter,
  onMimeTypeChange,
  visibilityFilter,
  onVisibilityChange,
  uploadedByFilter,
  onUploadedByChange,
  relatedTypeFilter,
  onRelatedTypeChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  sortBy,
  onSortByChange,
  users,
  canViewDeleted,
  viewMode,
  onViewModeChange,
  isFiltered,
  onClearFilters,
}) => (
  <section className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-4 shadow-sm space-y-3 transition-colors duration-300" aria-label="Filtros de documentos">
    <div className="flex flex-col xl:flex-row xl:items-center gap-3">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute inset-y-0 left-3.5 my-auto w-4 h-4 text-gray-400" aria-hidden="true" />
        <input
          type="search"
          placeholder="Pesquisar por nome do arquivo..."
          value={searchInput}
          onChange={(event) => onSearchChange(event.target.value)}
          className="w-full pl-10 pr-10 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981]"
          aria-label="Pesquisar documentos por nome"
        />
        {searchInput && (
          <button type="button" onClick={() => onSearchChange('')} className="absolute inset-y-0 right-3 my-auto text-gray-400 hover:text-gray-700 dark:hover:text-white" aria-label="Limpar busca">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 justify-between xl:justify-end">
        <label className="sr-only" htmlFor="document-sort">Ordenar documentos</label>
        <select id="document-sort" value={sortBy} onChange={(event) => onSortByChange(event.target.value as typeof sortBy)} className={selectClassName}>
          <option value="recent">Mais recente</option>
          <option value="name">Nome</option>
          <option value="size">Tamanho</option>
          <option value="updated">Última atualização</option>
        </select>
        <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl border border-gray-200/50 dark:border-white/5" aria-label="Modo de visualização">
          <button type="button" onClick={() => onViewModeChange('grid')} className={`p-1.5 rounded-lg ${viewMode === 'grid' ? 'bg-white dark:bg-[#1a1d27] text-[#10b981] shadow-sm' : 'text-gray-500'}`} aria-label="Visualização em grade" aria-pressed={viewMode === 'grid'}>
            <Grid3x3 className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => onViewModeChange('list')} className={`p-1.5 rounded-lg ${viewMode === 'list' ? 'bg-white dark:bg-[#1a1d27] text-[#10b981] shadow-sm' : 'text-gray-500'}`} aria-label="Visualização em lista" aria-pressed={viewMode === 'list'}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-400">
      <SlidersHorizontal className="w-3.5 h-3.5" /> Filtros
      {isFiltered && <button type="button" onClick={onClearFilters} className="normal-case ml-auto text-[#10b981] hover:text-[#059669] flex items-center gap-1"><X className="w-3.5 h-3.5" /> Limpar filtros</button>}
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      <select value={mimeTypeFilter} onChange={(event) => onMimeTypeChange(event.target.value)} className={selectClassName} aria-label="Filtrar por tipo de arquivo">
        <option value="all">Todos os tipos</option>
        {DOCUMENT_FILE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
      </select>
      <select value={categoryFilter} onChange={(event) => onCategoryChange(event.target.value as DocumentCategory | 'all')} className={selectClassName} aria-label="Filtrar por categoria">
        <option value="all">Todas as categorias</option>
        {DOCUMENT_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
      </select>
      <select value={visibilityFilter} onChange={(event) => onVisibilityChange(event.target.value as DocumentVisibility | 'all')} className={selectClassName} aria-label="Filtrar por visibilidade">
        <option value="all">Todas as visibilidades</option>
        {DOCUMENT_VISIBILITIES.map((visibility) => <option key={visibility.value} value={visibility.value}>{visibility.label}</option>)}
      </select>
      <select value={uploadedByFilter} onChange={(event) => onUploadedByChange(event.target.value)} className={selectClassName} aria-label="Filtrar por responsável pelo upload">
        <option value="all">Todos os responsáveis</option>
        {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
      </select>
      <select value={relatedTypeFilter} onChange={(event) => onRelatedTypeChange(event.target.value as DocumentRelatedType | 'all')} className={selectClassName} aria-label="Filtrar por entidade relacionada">
        <option value="all">Todas as entidades</option>
        {DOCUMENT_RELATION_TYPES.map((relation) => <option key={relation.value} value={relation.value}>{relation.label}</option>)}
      </select>
      <select value={statusFilter} onChange={(event) => onStatusChange(event.target.value as DocumentStatus | 'all')} className={selectClassName} aria-label="Filtrar por status">
        <option value="all">Todos os status</option>
        <option value="active">Ativos</option>
        <option value="archived">Arquivados</option>
        {canViewDeleted && <option value="deleted">Excluídos</option>}
      </select>
      <label className="text-xs text-gray-500 dark:text-gray-400"><span className="sr-only">Enviado a partir de</span><input type="date" value={dateFrom} onChange={(event) => onDateFromChange(event.target.value)} className={`${selectClassName} w-full`} aria-label="Enviado a partir de" /></label>
      <label className="text-xs text-gray-500 dark:text-gray-400"><span className="sr-only">Enviado até</span><input type="date" value={dateTo} onChange={(event) => onDateToChange(event.target.value)} className={`${selectClassName} w-full`} aria-label="Enviado até" /></label>
    </div>
  </section>
);
