import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatCard } from '../../components/shared/StatCard';
import { DataTable, Column } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ConfirmModal } from '../../components/shared/ConfirmModal';
import { DocumentFilters, ViewMode } from './components/DocumentFilters';
import { DocumentGrid } from './components/DocumentGrid';
import { DocumentUploadModal } from './components/DocumentUploadModal';
import { DocumentPreviewModal } from './components/DocumentPreviewModal';
import { CategoryIcon } from './components/CategoryIcon';
import { useDocuments, useDocumentStats, useDocumentMutations } from '../../hooks/useDocuments';
import { Document, DocumentCategory } from '../../types';
import { DOCUMENT_CATEGORIES, formatFileSize } from '../../services/documentService';
import { Upload, FileStack, HardDrive, TrendingUp, AlertCircle, Eye, Download, Archive, ArchiveRestore, Trash2 } from 'lucide-react';

export const DocumentsPage: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [documentToArchive, setDocumentToArchive] = useState<Document | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const { documents, isLoading, isError, refetch } = useDocuments({
    search: debouncedSearch,
    category: categoryFilter,
    status: statusFilter,
  });

  const { stats, isLoading: isStatsLoading } = useDocumentStats();

  const {
    uploadDocument,
    isUploading,
    archiveDocument,
    isArchiving,
    unarchiveDocument,
    isUnarchiving,
    deleteDocument,
    isDeleting,
  } = useDocumentMutations();

  const isFiltered = searchInput !== '' || categoryFilter !== 'all' || statusFilter !== 'all';

  const handleClearFilters = () => {
    setSearchInput('');
    setCategoryFilter('all');
    setStatusFilter('all');
  };

  const handleUpload = async (file: File, category: DocumentCategory, name?: string) => {
    await uploadDocument({ file, category, name });
  };

  const handleView = (doc: Document) => setPreviewDocument(doc);

  const handleDownload = (doc: Document) => {
    const link = window.document.createElement('a');
    link.href = doc.url;
    link.download = doc.originalName;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  };

  const handleToggleArchiveClick = (doc: Document) => {
    if (doc.status === 'active') {
      setDocumentToArchive(doc);
    } else {
      unarchiveDocument(doc.id).catch(() => {});
    }
  };

  const handleConfirmArchive = async () => {
    if (!documentToArchive) return;
    try {
      await archiveDocument(documentToArchive.id);
      setDocumentToArchive(null);
      if (previewDocument?.id === documentToArchive.id) setPreviewDocument(null);
    } catch (e) {}
  };

  const handleDeleteClick = (doc: Document) => setDocumentToDelete(doc);

  const handleConfirmDelete = async () => {
    if (!documentToDelete) return;
    try {
      await deleteDocument(documentToDelete.id);
      setDocumentToDelete(null);
      if (previewDocument?.id === documentToDelete.id) setPreviewDocument(null);
    } catch (e) {}
  };

  const columns: Column<Document>[] = [
    {
      key: 'icon',
      label: '',
      render: (row) => <CategoryIcon mimeType={row.mimeType} size="sm" />,
    },
    {
      key: 'name',
      label: 'Nome',
      render: (row) => (
        <button
          onClick={() => handleView(row)}
          className="font-semibold text-gray-800 dark:text-gray-200 hover:text-[#10b981] dark:hover:text-[#10b981] text-left transition-colors duration-150 truncate max-w-[220px] block"
          title={row.name}
        >
          {row.name}
        </button>
      ),
    },
    {
      key: 'category',
      label: 'Categoria',
      render: (row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 border border-gray-200/40 dark:border-white/5">
          {DOCUMENT_CATEGORIES.find((c) => c.value === row.category)?.label || 'Outros'}
        </span>
      ),
    },
    {
      key: 'size',
      label: 'Tamanho',
      render: (row) => <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{formatFileSize(row.size)}</span>,
    },
    {
      key: 'createdAt',
      label: 'Data',
      render: (row) => (
        <span className="text-xs text-gray-400 font-medium whitespace-nowrap">{new Date(row.createdAt).toLocaleDateString('pt-BR')}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status === 'active' ? 'active' : 'inactive'} />,
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (row) => (
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={() => handleView(row)} className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors" title="Visualizar">
            <Eye className="w-4.5 h-4.5" />
          </button>
          <button type="button" onClick={() => handleDownload(row)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors" title="Baixar">
            <Download className="w-4.5 h-4.5" />
          </button>
          <button type="button" onClick={() => handleToggleArchiveClick(row)} className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors" title={row.status === 'active' ? 'Arquivar' : 'Desarquivar'}>
            {row.status === 'active' ? <Archive className="w-4.5 h-4.5" /> : <ArchiveRestore className="w-4.5 h-4.5" />}
          </button>
          <button type="button" onClick={() => handleDeleteClick(row)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors" title="Excluir">
            <Trash2 className="w-4.5 h-4.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Documentos"
        subtitle="Gerencie notas fiscais, contratos, boletos e outros arquivos"
        action={
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 shadow-md shadow-emerald-500/10"
          >
            <Upload className="w-4.5 h-4.5" />
            Enviar Documento
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          title="Total de Documentos"
          value={isStatsLoading ? '...' : stats?.totalDocuments ?? 0}
          icon={<FileStack className="w-5 h-5" />}
          accentColor="blue"
        />
        <StatCard
          title="Armazenamento Usado"
          value={isStatsLoading ? '...' : formatFileSize(stats?.totalSize ?? 0)}
          icon={<HardDrive className="w-5 h-5" />}
          accentColor="green"
        />
        <StatCard
          title="Enviados este Mês"
          value={isStatsLoading ? '...' : stats?.recentUploads ?? 0}
          icon={<TrendingUp className="w-5 h-5" />}
          accentColor="yellow"
        />
      </div>

      <DocumentFilters
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        isFiltered={isFiltered}
        onClearFilters={handleClearFilters}
      />

      {isError ? (
        <div className="flex flex-col items-center justify-center bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-10 shadow-sm text-center animate-fade-in">
          <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-full text-red-500 mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-lg mb-1">Não foi possível carregar os dados</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-6">
            Ocorreu um problema ao conectar com o banco de dados. Verifique sua conexão e tente novamente.
          </p>
          <button
            onClick={() => refetch()}
            className="bg-red-500 hover:bg-red-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium transition-colors duration-200 shadow-md shadow-red-500/10 active:scale-95"
          >
            Tentar novamente
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <DocumentGrid
          documents={documents}
          isLoading={isLoading}
          onView={handleView}
          onDownload={handleDownload}
          onToggleArchive={handleToggleArchiveClick}
          onDelete={handleDeleteClick}
          isFiltered={isFiltered}
        />
      ) : (
        <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
          <DataTable
            data={documents}
            columns={columns}
            isLoading={isLoading}
            emptyIcon={<FileStack className="w-12 h-12 text-[#10b981] mb-3" />}
            emptyTitle="Nenhum documento encontrado"
            emptySubtitle={isFiltered ? 'Tente ajustar os termos de busca ou filtros selecionados.' : 'Faça upload do primeiro documento da sua empresa.'}
          />
        </div>
      )}

      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={handleUpload}
        isLoading={isUploading}
      />

      <DocumentPreviewModal
        isOpen={!!previewDocument}
        onClose={() => setPreviewDocument(null)}
        document={previewDocument || undefined}
        onDownload={handleDownload}
        onToggleArchive={handleToggleArchiveClick}
        onDelete={handleDeleteClick}
        isArchiving={isArchiving || isUnarchiving}
        isDeleting={isDeleting}
      />

      <ConfirmModal
        isOpen={!!documentToArchive}
        onCancel={() => setDocumentToArchive(null)}
        onConfirm={handleConfirmArchive}
        title="Arquivar Documento"
        message={`Tem certeza que deseja arquivar "${documentToArchive?.name}"? O documento continuará acessível na aba de arquivados.`}
        confirmText="Arquivar"
        variant="danger"
        isLoading={isArchiving}
      />

      <ConfirmModal
        isOpen={!!documentToDelete}
        onCancel={() => setDocumentToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Documento"
        message={`Tem certeza que deseja excluir permanentemente "${documentToDelete?.name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default DocumentsPage;
