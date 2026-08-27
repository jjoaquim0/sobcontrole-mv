import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Eye, FileDigit, FileStack, HardDrive, LockKeyhole, TrendingUp, Upload } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatCard } from '../../components/shared/StatCard';
import { DataTable, Column } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { useDocumentCompanyUsers, useDocumentMutations, useDocuments, useDocumentStats } from '../../hooks/useDocuments';
import { useAuthStore } from '../../store/authStore';
import { Document, DocumentCategory, DocumentRelatedType, DocumentStatus, DocumentVisibility } from '../../types';
import { DOCUMENT_CATEGORIES, DocumentUploadInput, formatFileSize } from '../../services/documentService';
import { getDocumentVisibilityLabel } from '../../services/documentDomain';
import { DocumentFilters, ViewMode } from './components/DocumentFilters';
import { DocumentGrid } from './components/DocumentGrid';
import { DocumentPreviewModal } from './components/DocumentPreviewModal';
import { DocumentUploadModal } from './components/DocumentUploadModal';
import { CategoryIcon } from './components/CategoryIcon';
import { BoletoImportModal } from './components/BoletoImportModal';

export const DocumentsPage: React.FC = () => {
  const profile = useAuthStore((state) => state.profile);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'all'>('all');
  const [mimeTypeFilter, setMimeTypeFilter] = useState<string | 'all'>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<DocumentVisibility | 'all'>('all');
  const [uploadedByFilter, setUploadedByFilter] = useState<string | 'all'>('all');
  const [relatedTypeFilter, setRelatedTypeFilter] = useState<DocumentRelatedType | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'size' | 'updated'>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isBoletoModalOpen, setIsBoletoModalOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document>();
  const { data: users = [] } = useDocumentCompanyUsers();

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const filters = useMemo(() => ({
    search: debouncedSearch,
    category: categoryFilter,
    status: statusFilter,
    mimeType: mimeTypeFilter,
    visibility: visibilityFilter,
    uploadedBy: uploadedByFilter,
    relatedType: relatedTypeFilter,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sortBy,
  }), [debouncedSearch, categoryFilter, statusFilter, mimeTypeFilter, visibilityFilter, uploadedByFilter, relatedTypeFilter, dateFrom, dateTo, sortBy]);
  const { documents, isLoading, isError, refetch } = useDocuments(filters);
  const { stats, isLoading: isStatsLoading } = useDocumentStats();
  const { uploadDocument, isUploading } = useDocumentMutations();

  const isFiltered = Boolean(searchInput || categoryFilter !== 'all' || statusFilter !== 'all' || mimeTypeFilter !== 'all' || visibilityFilter !== 'all' || uploadedByFilter !== 'all' || relatedTypeFilter !== 'all' || dateFrom || dateTo);
  const canViewDeleted = profile?.role === 'admin';

  const clearFilters = () => {
    setSearchInput('');
    setCategoryFilter('all');
    setStatusFilter('all');
    setMimeTypeFilter('all');
    setVisibilityFilter('all');
    setUploadedByFilter('all');
    setRelatedTypeFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const handleUpload = (file: File, input: DocumentUploadInput) => uploadDocument({ file, input });

  const columns: Column<Document>[] = [
    { key: 'file', label: '', render: (row) => <CategoryIcon mimeType={row.mimeType} size="sm" /> },
    { key: 'name', label: 'Nome', render: (row) => <button type="button" onClick={() => setSelectedDocument(row)} className="max-w-[220px] truncate text-left font-semibold text-gray-800 transition-colors hover:text-[#10b981] dark:text-gray-200">{row.name}</button> },
    { key: 'type', label: 'Tipo', render: (row) => <span className="text-xs font-medium text-gray-500">{row.mimeType || 'Desconhecido'}</span> },
    { key: 'category', label: 'Categoria', render: (row) => <span className="rounded-md border border-gray-200/40 bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:border-white/5 dark:bg-white/5 dark:text-gray-300">{DOCUMENT_CATEGORIES.find((category) => category.value === row.category)?.label || row.category}</span> },
    { key: 'owner', label: 'Responsável', render: (row) => <span className="text-xs text-gray-500">{row.uploadedByName || row.ownerName || 'Não informado'}</span> },
    { key: 'visibility', label: 'Visibilidade', render: (row) => <span className="inline-flex items-center gap-1 text-xs text-gray-500"><LockKeyhole className="w-3.5 h-3.5" />{getDocumentVisibilityLabel(row.visibility)}</span> },
    { key: 'versions', label: 'Versões', render: (row) => <span className="text-xs font-medium text-gray-500">{row.versionCount}</span> },
    { key: 'updated', label: 'Atualizado', render: (row) => <span className="whitespace-nowrap text-xs text-gray-500">{new Date(row.updatedAt).toLocaleDateString('pt-BR')}</span> },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status === 'active' ? 'active' : 'inactive'} /> },
    { key: 'actions', label: 'Ações', render: (row) => <button type="button" onClick={() => setSelectedDocument(row)} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-emerald-500/10 hover:text-emerald-500" title="Abrir documento" aria-label={`Abrir ${row.name}`}><Eye className="w-4 h-4" /></button> },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Documentos"
        subtitle="Biblioteca privada, versionada e organizada da sua empresa"
        action={<><button type="button" onClick={() => setIsBoletoModalOpen(true)} className="flex items-center gap-1.5 rounded-xl border border-[#0B2551] px-4 py-2 text-sm font-semibold text-[#0B2551] transition-colors hover:bg-blue-50 dark:border-cyan-300 dark:text-cyan-200 dark:hover:bg-cyan-950/30"><FileDigit className="h-4 w-4" />Importar boleto</button><button type="button" onClick={() => setIsUploadModalOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-[#10b981] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-500/10 transition-colors hover:bg-[#059669]"><Upload className="w-4.5 h-4.5" />Enviar documentos</button></>}
      />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatCard title="Documentos acessíveis" value={isStatsLoading ? '...' : stats?.totalDocuments ?? 0} icon={<FileStack className="w-5 h-5" />} accentColor="blue" />
        <StatCard title="Armazenamento acessível" value={isStatsLoading ? '...' : formatFileSize(stats?.totalSize ?? 0)} icon={<HardDrive className="w-5 h-5" />} accentColor="green" />
        <StatCard title="Enviados nos últimos 30 dias" value={isStatsLoading ? '...' : stats?.recentUploads ?? 0} icon={<TrendingUp className="w-5 h-5" />} accentColor="yellow" />
      </div>
      <DocumentFilters searchInput={searchInput} onSearchChange={setSearchInput} categoryFilter={categoryFilter} onCategoryChange={setCategoryFilter} statusFilter={statusFilter} onStatusChange={setStatusFilter} mimeTypeFilter={mimeTypeFilter} onMimeTypeChange={setMimeTypeFilter} visibilityFilter={visibilityFilter} onVisibilityChange={setVisibilityFilter} uploadedByFilter={uploadedByFilter} onUploadedByChange={setUploadedByFilter} relatedTypeFilter={relatedTypeFilter} onRelatedTypeChange={setRelatedTypeFilter} dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo} sortBy={sortBy} onSortByChange={setSortBy} users={users} canViewDeleted={canViewDeleted} viewMode={viewMode} onViewModeChange={setViewMode} isFiltered={isFiltered} onClearFilters={clearFilters} />
      {isError ? <section className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-sm dark:border-white/5 dark:bg-[#1a1d27]"><AlertCircle className="mb-4 h-8 w-8 text-red-500" /><h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Não foi possível carregar os documentos</h2><p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">Sua sessão pode não ter acesso a esta biblioteca ou ocorreu uma falha de conexão.</p><button type="button" onClick={() => refetch()} className="mt-5 rounded-xl bg-red-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-600">Tentar novamente</button></section> : viewMode === 'grid' ? <DocumentGrid documents={documents} isLoading={isLoading} onView={setSelectedDocument} isFiltered={isFiltered} /> : <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-white/5 dark:bg-[#1a1d27]"><DataTable data={documents} columns={columns} isLoading={isLoading} emptyIcon={<FileStack className="mb-3 h-12 w-12 text-[#10b981]" />} emptyTitle="Nenhum documento encontrado" emptySubtitle={isFiltered ? 'Ajuste os filtros para ampliar a busca.' : 'Envie o primeiro documento da sua empresa.'} /></div>}
      <DocumentUploadModal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} onUpload={handleUpload} isLoading={isUploading} />
      <BoletoImportModal isOpen={isBoletoModalOpen} onClose={() => setIsBoletoModalOpen(false)} />
      <DocumentPreviewModal isOpen={Boolean(selectedDocument)} onClose={() => setSelectedDocument(undefined)} document={selectedDocument} />
    </div>
  );
};

export default DocumentsPage;
