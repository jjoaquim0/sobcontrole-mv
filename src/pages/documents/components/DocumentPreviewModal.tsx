import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Archive, ArchiveRestore, Check, Download, Edit3, FileClock, FileText, History, Loader2, LockKeyhole, RotateCcw, ShieldCheck, Trash2, Upload, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmModal } from '../../../components/shared/ConfirmModal';
import { useDocumentAuditEvents, useDocumentCompanyUsers, useDocumentDetails, useDocumentMutations, useDocumentPermissions, useDocumentRelatedEntities, useDocumentVersions } from '../../../hooks/useDocuments';
import { useAuthStore } from '../../../store/authStore';
import { Document, DocumentAccessLevel, DocumentCategory, DocumentRelatedType, DocumentVersion, DocumentVisibility } from '../../../types';
import { DOCUMENT_CATEGORIES, formatFileSize, getDocumentDownloadUrl, getDocumentPreviewUrl, getDocumentVersionDownloadUrl, getDocumentVersionPreviewUrl } from '../../../services/documentService';
import { DOCUMENT_ACCESS_LEVELS, DOCUMENT_RELATION_TYPES, DOCUMENT_VISIBILITIES, getDocumentAuditEventLabel, getDocumentRelationLabel, getDocumentVisibilityLabel, hasDocumentAccess, resolveDocumentAccess } from '../../../services/documentDomain';
import { CategoryIcon } from './CategoryIcon';
import { AiSiteIntegrationAction } from './AiSiteIntegrationAction';

type DetailTab = 'details' | 'versions' | 'permissions' | 'history';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document?: Document;
}

const openSignedUrl = (url: string): void => { window.open(url, '_blank', 'noopener,noreferrer'); };

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({ isOpen, onClose, document }) => {
  const profile = useAuthStore((state) => state.profile);
  const { data: loadedDocument, isLoading: isLoadingDocument, isError: isDocumentError } = useDocumentDetails(isOpen ? document?.id : undefined);
  const currentDocument = loadedDocument || document;
  const access = currentDocument ? resolveDocumentAccess(currentDocument, profile) : 'none';
  const { data: versions = [], isLoading: isLoadingVersions } = useDocumentVersions(isOpen ? document?.id : undefined);
  const { data: permissions = [], isLoading: isLoadingPermissions } = useDocumentPermissions(isOpen ? document?.id : undefined, access === 'admin');
  const { data: events = [], isLoading: isLoadingEvents } = useDocumentAuditEvents(isOpen ? document?.id : undefined);
  const { data: users = [] } = useDocumentCompanyUsers();
  const [tab, setTab] = useState<DetailTab>('details');
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [previewError, setPreviewError] = useState<string>();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('outros');
  const [visibility, setVisibility] = useState<DocumentVisibility>('company');
  const [relatedType, setRelatedType] = useState<DocumentRelatedType | ''>('');
  const [relatedId, setRelatedId] = useState('');
  const [newVersionFile, setNewVersionFile] = useState<File>();
  const [versionComment, setVersionComment] = useState('');
  const [permissionUserId, setPermissionUserId] = useState('');
  const [permissionLevel, setPermissionLevel] = useState<Exclude<DocumentAccessLevel, 'none'>>('view');
  const [versionToRestore, setVersionToRestore] = useState<DocumentVersion>();
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const relationQuery = useDocumentRelatedEntities(relatedType || undefined);
  const newVersionInputRef = useRef<HTMLInputElement>(null);
  const {
    updateDocument,
    isUpdating,
    archiveDocument,
    unarchiveDocument,
    isArchiving,
    isUnarchiving,
    deleteDocument,
    isDeleting,
    restoreDocument,
    isRestoring,
    uploadDocumentVersion,
    isAddingVersion,
    restoreDocumentVersion,
    isRestoringVersion,
    grantDocumentPermission,
    revokeDocumentPermission,
    isUpdatingPermission,
  } = useDocumentMutations();

  useEffect(() => {
    if (!currentDocument) return;
    setName(currentDocument.name);
    setDescription(currentDocument.description || '');
    setCategory(currentDocument.category);
    setVisibility(currentDocument.visibility);
    setRelatedType(currentDocument.relatedType || '');
    setRelatedId(currentDocument.relatedId || '');
    setIsEditing(false);
  }, [currentDocument]);

  useEffect(() => {
    if (!isOpen || !currentDocument || currentDocument.deletedAt || !hasDocumentAccess(currentDocument, profile, 'view')) {
      setPreviewUrl(undefined);
      return;
    }
    let active = true;
    setPreviewUrl(undefined);
    setPreviewError(undefined);
    getDocumentPreviewUrl(currentDocument)
      .then((url) => { if (active) setPreviewUrl(url); })
      .catch((error: unknown) => { if (active) setPreviewError(error instanceof Error ? error.message : 'Não foi possível carregar a prévia.'); });
    return () => { active = false; };
  }, [isOpen, currentDocument, profile]);

  if (!document) return null;
  if (isDocumentError || (loadedDocument === undefined && !isLoadingDocument && currentDocument === undefined)) {
    return <AccessDeniedModal isOpen={isOpen} onClose={onClose} />;
  }
  if (!currentDocument) return null;

  const canEdit = !currentDocument.deletedAt && hasDocumentAccess(currentDocument, profile, 'edit');
  const canAdmin = hasDocumentAccess(currentDocument, profile, 'admin');
  const canDownload = !currentDocument.deletedAt && hasDocumentAccess(currentDocument, profile, 'download');
  const currentVersionId = currentDocument.currentVersionId;
  const selectedRelation = relationQuery.data || [];
  const isImage = currentDocument.mimeType.startsWith('image/');
  const isPdf = currentDocument.mimeType === 'application/pdf';

  const handleDownload = async (version?: DocumentVersion) => {
    if (!canDownload) {
      toast.error('Você não possui permissão para baixar este documento.');
      return;
    }
    try {
      const url = version
        ? await getDocumentVersionDownloadUrl(currentDocument.id, version)
        : await getDocumentDownloadUrl(currentDocument);
      openSignedUrl(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível preparar o download.');
    }
  };

  const handlePreviewVersion = async (version: DocumentVersion) => {
    try {
      openSignedUrl(await getDocumentVersionPreviewUrl(version));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível abrir esta versão.');
    }
  };

  const handleSaveMetadata = async () => {
    if (relatedType && !relatedId) {
      toast.error('Selecione uma entidade relacionada ou remova o relacionamento.');
      return;
    }
    try {
      await updateDocument({
        id: currentDocument.id,
        data: { name, description: description || null, category, visibility, related: relatedType && relatedId ? { relatedType, relatedId } : null },
      });
      setIsEditing(false);
      toast.success('Metadados atualizados.');
    } catch {
      // The mutation already renders a descriptive toast.
    }
  };

  const handleAddVersion = async () => {
    if (!newVersionFile) {
      toast.error('Selecione o arquivo da nova versão.');
      return;
    }
    try {
      await uploadDocumentVersion({ documentId: currentDocument.id, file: newVersionFile, comment: versionComment });
      setNewVersionFile(undefined);
      setVersionComment('');
      if (newVersionInputRef.current) newVersionInputRef.current.value = '';
    } catch {
      // The mutation already renders a descriptive toast.
    }
  };

  const handleGrantPermission = async () => {
    if (!permissionUserId) {
      toast.error('Selecione uma pessoa da empresa.');
      return;
    }
    try {
      await grantDocumentPermission({ documentId: currentDocument.id, userId: permissionUserId, accessLevel: permissionLevel });
      setPermissionUserId('');
      setPermissionLevel('view');
    } catch {
      // The mutation already renders a descriptive toast.
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="document-detail-title">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.97, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 12 }} className="relative z-10 flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl dark:border-white/5 dark:bg-[#1a1d27]">
            <header className="flex items-start justify-between gap-4 border-b border-gray-100 p-5 dark:border-white/5">
              <div className="flex min-w-0 items-start gap-3"><CategoryIcon mimeType={currentDocument.mimeType} size="lg" /><div className="min-w-0"><h2 id="document-detail-title" className="break-words text-lg font-bold text-gray-900 dark:text-white">{currentDocument.name}</h2><p className="mt-1 text-xs text-gray-500">{currentDocument.deletedAt ? 'Documento excluído' : `${getDocumentVisibilityLabel(currentDocument.visibility)} · ${currentDocument.versionCount} versão(ões)`}</p></div></div>
              <button type="button" onClick={onClose} className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Fechar detalhes"><X className="w-5 h-5" /></button>
            </header>

            <div className="border-b border-gray-100 px-5 dark:border-white/5"><nav className="flex gap-1 overflow-x-auto" aria-label="Seções do documento">
              <DetailTabButton active={tab === 'details'} onClick={() => setTab('details')} icon={<FileText className="w-4 h-4" />}>Detalhes</DetailTabButton>
              <DetailTabButton active={tab === 'versions'} onClick={() => setTab('versions')} icon={<FileClock className="w-4 h-4" />}>Versões</DetailTabButton>
              <DetailTabButton active={tab === 'permissions'} onClick={() => setTab('permissions')} icon={<Users className="w-4 h-4" />}>Permissões</DetailTabButton>
              <DetailTabButton active={tab === 'history'} onClick={() => setTab('history')} icon={<History className="w-4 h-4" />}>Histórico</DetailTabButton>
            </nav></div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {isLoadingDocument ? <LoadingDetail /> : tab === 'details' ? (
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
                  <section className="flex min-h-[360px] items-center justify-center rounded-2xl bg-gray-50 p-4 dark:bg-black/20">
                    {currentDocument.deletedAt ? <EmptyPreview message="O documento está excluído. Restaure-o para acessar o arquivo." /> : previewError ? <EmptyPreview message={previewError} /> : !previewUrl ? <Loader2 className="h-7 w-7 animate-spin text-[#10b981]" /> : isImage ? <img src={previewUrl} alt={currentDocument.name} className="max-h-[60vh] max-w-full rounded-lg object-contain" /> : isPdf ? <embed src={previewUrl} type="application/pdf" className="h-[60vh] w-full rounded-lg" /> : <EmptyPreview message="Prévia indisponível para este tipo de arquivo. Use o download, se autorizado." />}
                  </section>
                  <section className="space-y-4">
                    {isEditing ? <MetadataForm name={name} description={description} category={category} visibility={visibility} relatedType={relatedType} relatedId={relatedId} relatedEntities={selectedRelation} isLoadingRelated={relationQuery.isLoading} onNameChange={setName} onDescriptionChange={setDescription} onCategoryChange={setCategory} onVisibilityChange={setVisibility} onRelatedTypeChange={(value) => { setRelatedType(value); setRelatedId(''); }} onRelatedIdChange={setRelatedId} /> : <MetadataSummary document={currentDocument} />}
                    <div className="space-y-2 border-t border-gray-100 pt-4 dark:border-white/5">
                      {canDownload && <ActionButton icon={<Download className="w-4 h-4" />} onClick={() => handleDownload()}>Baixar</ActionButton>}
                      {canEdit && (isEditing ? <><ActionButton icon={<Check className="w-4 h-4" />} onClick={handleSaveMetadata} loading={isUpdating}>Salvar alterações</ActionButton><ActionButton icon={<X className="w-4 h-4" />} onClick={() => setIsEditing(false)} secondary>Cancelar</ActionButton></> : <ActionButton icon={<Edit3 className="w-4 h-4" />} onClick={() => setIsEditing(true)} secondary>Editar metadados</ActionButton>)}
                      {canEdit && !isEditing && <ActionButton icon={currentDocument.status === 'active' ? <Archive className="w-4 h-4" /> : <ArchiveRestore className="w-4 h-4" />} onClick={async () => { await (currentDocument.status === 'active' ? archiveDocument(currentDocument.id) : unarchiveDocument(currentDocument.id)); }} loading={isArchiving || isUnarchiving} secondary>{currentDocument.status === 'active' ? 'Arquivar' : 'Desarquivar'}</ActionButton>}
                      {canAdmin && !currentDocument.deletedAt && <ActionButton icon={<Trash2 className="w-4 h-4" />} onClick={() => setIsDeleteConfirmOpen(true)} danger>Excluir documento</ActionButton>}
                      {canAdmin && currentDocument.deletedAt && <ActionButton icon={<RotateCcw className="w-4 h-4" />} onClick={async () => { await restoreDocument(currentDocument.id); }} loading={isRestoring}>Restaurar documento</ActionButton>}
                    </div>
                    {!currentDocument.deletedAt && <div className="border-t border-gray-100 pt-4 dark:border-white/5"><AiSiteIntegrationAction /></div>}
                  </section>
                </div>
              ) : tab === 'versions' ? <VersionsTab versions={versions} currentVersionId={currentVersionId} canEdit={canEdit} canDownload={canDownload} newVersionFile={newVersionFile} versionComment={versionComment} isLoading={isLoadingVersions} isAdding={isAddingVersion} isRestoring={isRestoringVersion} inputRef={newVersionInputRef} onNewFile={setNewVersionFile} onCommentChange={setVersionComment} onAdd={handleAddVersion} onPreview={handlePreviewVersion} onDownload={handleDownload} onRestore={setVersionToRestore} />
              : tab === 'permissions' ? <PermissionsTab canAdmin={canAdmin} permissions={permissions} users={users} selectedUser={permissionUserId} selectedLevel={permissionLevel} isLoading={isLoadingPermissions} isUpdating={isUpdatingPermission} onUserChange={setPermissionUserId} onLevelChange={setPermissionLevel} onGrant={handleGrantPermission} onRevoke={(userId) => revokeDocumentPermission({ documentId: currentDocument.id, userId })} />
              : <HistoryTab events={events} isLoading={isLoadingEvents} />}
            </div>
          </motion.div>
          <ConfirmModal isOpen={Boolean(versionToRestore)} onCancel={() => setVersionToRestore(undefined)} onConfirm={async () => { if (versionToRestore) await restoreDocumentVersion({ documentId: currentDocument.id, versionId: versionToRestore.id }); setVersionToRestore(undefined); }} title="Restaurar versão" message={`Definir a versão ${versionToRestore?.versionNumber} como a versão atual? Nenhum arquivo será apagado.`} confirmText="Restaurar versão" variant="danger" isLoading={isRestoringVersion} />
          <ConfirmModal isOpen={isDeleteConfirmOpen} onCancel={() => setIsDeleteConfirmOpen(false)} onConfirm={async () => { await deleteDocument(currentDocument.id); setIsDeleteConfirmOpen(false); onClose(); }} title="Excluir documento" message={`Excluir "${currentDocument.name}"? O arquivo e o histórico serão preservados para restauração.`} confirmText="Excluir" variant="danger" isLoading={isDeleting} />
        </div>
      )}
    </AnimatePresence>
  );
};

const DetailTabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }> = ({ active, onClick, icon, children }) => <button type="button" onClick={onClick} className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-semibold ${active ? 'border-[#10b981] text-[#10b981]' : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>{icon}{children}</button>;

const ActionButton: React.FC<{ icon: React.ReactNode; onClick: () => void | Promise<void>; children: React.ReactNode; secondary?: boolean; danger?: boolean; loading?: boolean }> = ({ icon, onClick, children, secondary, danger, loading }) => <button type="button" onClick={onClick} disabled={loading} className={`flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${danger ? 'border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-500/20 dark:hover:bg-red-950/20' : secondary ? 'border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5' : 'bg-[#10b981] text-white hover:bg-[#059669]'}`}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}{children}</button>;

const LoadingDetail = () => <div className="flex min-h-[360px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#10b981]" /></div>;
const EmptyPreview: React.FC<{ message: string }> = ({ message }) => <div className="max-w-sm text-center"><LockKeyhole className="mx-auto mb-3 h-8 w-8 text-gray-400" /><p className="text-sm text-gray-500 dark:text-gray-400">{message}</p></div>;
const AccessDeniedModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => <AnimatePresence>{isOpen && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60" onClick={onClose} /><motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="relative z-10 max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-[#1a1d27]"><LockKeyhole className="mx-auto mb-3 h-8 w-8 text-red-500" /><h2 className="font-bold text-gray-900 dark:text-white">Acesso negado</h2><p className="mt-2 text-sm text-gray-500">Você não possui permissão para abrir este documento.</p><button type="button" onClick={onClose} className="mt-5 rounded-xl bg-[#10b981] px-4 py-2 text-sm font-semibold text-white">Fechar</button></motion.div></div>}</AnimatePresence>;

const MetadataSummary: React.FC<{ document: Document }> = ({ document }) => <dl className="space-y-3 text-sm"><InfoItem label="Categoria" value={DOCUMENT_CATEGORIES.find((item) => item.value === document.category)?.label || document.category} /><InfoItem label="Visibilidade" value={getDocumentVisibilityLabel(document.visibility)} /><InfoItem label="Proprietário" value={document.ownerName || 'Não informado'} /><InfoItem label="Responsável pelo upload" value={document.uploadedByName || 'Não informado'} /><InfoItem label="Tamanho" value={formatFileSize(document.size)} /><InfoItem label="Atualizado em" value={new Date(document.updatedAt).toLocaleString('pt-BR')} />{document.relatedType && <InfoItem label="Relacionado a" value={getDocumentRelationLabel(document.relatedType) || document.relatedType} />}{document.description && <InfoItem label="Descrição" value={document.description} />}</dl>;
const InfoItem: React.FC<{ label: string; value: string }> = ({ label, value }) => <div><dt className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</dt><dd className="mt-0.5 font-medium text-gray-800 dark:text-gray-200">{value}</dd></div>;

const MetadataForm: React.FC<{ name: string; description: string; category: DocumentCategory; visibility: DocumentVisibility; relatedType: DocumentRelatedType | ''; relatedId: string; relatedEntities: { id: string; label: string }[]; isLoadingRelated: boolean; onNameChange: (value: string) => void; onDescriptionChange: (value: string) => void; onCategoryChange: (value: DocumentCategory) => void; onVisibilityChange: (value: DocumentVisibility) => void; onRelatedTypeChange: (value: DocumentRelatedType | '') => void; onRelatedIdChange: (value: string) => void }> = (props) => <div className="space-y-3"><label className="block text-xs font-bold uppercase tracking-wide text-gray-500">Nome<input value={props.name} onChange={(event) => props.onNameChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-normal text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white" /></label><label className="block text-xs font-bold uppercase tracking-wide text-gray-500">Categoria<select value={props.category} onChange={(event) => props.onCategoryChange(event.target.value as DocumentCategory)} className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-normal text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white">{DOCUMENT_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="block text-xs font-bold uppercase tracking-wide text-gray-500">Visibilidade<select value={props.visibility} onChange={(event) => props.onVisibilityChange(event.target.value as DocumentVisibility)} className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-normal text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white">{DOCUMENT_VISIBILITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="block text-xs font-bold uppercase tracking-wide text-gray-500">Relacionar a<select value={props.relatedType} onChange={(event) => props.onRelatedTypeChange(event.target.value as DocumentRelatedType | '')} className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-normal text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white"><option value="">Documento geral</option>{DOCUMENT_RELATION_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>{props.relatedType && <label className="block text-xs font-bold uppercase tracking-wide text-gray-500">Entidade<select value={props.relatedId} disabled={props.isLoadingRelated} onChange={(event) => props.onRelatedIdChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-normal text-gray-900 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white"><option value="">Selecione</option>{props.relatedEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.label}</option>)}</select></label>}<label className="block text-xs font-bold uppercase tracking-wide text-gray-500">Descrição<textarea value={props.description} onChange={(event) => props.onDescriptionChange(event.target.value)} rows={3} className="mt-1.5 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-normal text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white" /></label></div>;

const VersionsTab: React.FC<{ versions: DocumentVersion[]; currentVersionId?: string; canEdit: boolean; canDownload: boolean; newVersionFile?: File; versionComment: string; isLoading: boolean; isAdding: boolean; isRestoring: boolean; inputRef: React.RefObject<HTMLInputElement>; onNewFile: (file?: File) => void; onCommentChange: (value: string) => void; onAdd: () => void; onPreview: (version: DocumentVersion) => void; onDownload: (version: DocumentVersion) => void; onRestore: (version: DocumentVersion) => void }> = ({ versions, currentVersionId, canEdit, canDownload, newVersionFile, versionComment, isLoading, isAdding, isRestoring, inputRef, onNewFile, onCommentChange, onAdd, onPreview, onDownload, onRestore }) => <div className="space-y-4">{canEdit && <section className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/50 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/10"><h3 className="font-bold text-gray-900 dark:text-white">Adicionar nova versão</h3><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><input ref={inputRef} type="file" onChange={(event) => onNewFile(event.target.files?.[0])} className="block w-full text-sm text-gray-600 dark:text-gray-300" /><input value={versionComment} onChange={(event) => onCommentChange(event.target.value)} placeholder="Comentário da alteração (opcional)" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white" /><button type="button" onClick={onAdd} disabled={!newVersionFile || isAdding} className="flex items-center justify-center gap-1.5 rounded-xl bg-[#10b981] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}Enviar versão</button></div></section>}{isLoading ? <LoadingDetail /> : versions.length === 0 ? <p className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500 dark:bg-white/5">Nenhuma versão encontrada.</p> : <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 dark:divide-white/5 dark:border-white/5">{versions.map((version) => <div key={version.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="font-bold text-gray-900 dark:text-white">Versão {version.versionNumber}</span>{version.id === currentVersionId && <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Atual</span>}</div><p className="truncate text-sm text-gray-500">{version.originalName} · {formatFileSize(version.size)}</p><p className="mt-1 text-xs text-gray-400">{version.createdByName || 'Usuário removido'} · {new Date(version.createdAt).toLocaleString('pt-BR')}{version.changeComment ? ` · ${version.changeComment}` : ''}</p></div><div className="flex gap-2">{canDownload && <button type="button" onClick={() => onDownload(version)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-[#10b981] dark:hover:bg-white/5" title="Baixar versão"><Download className="w-4 h-4" /></button>}<button type="button" onClick={() => onPreview(version)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-[#10b981] dark:hover:bg-white/5" title="Abrir versão"><FileText className="w-4 h-4" /></button>{canEdit && version.id !== currentVersionId && <button type="button" onClick={() => onRestore(version)} disabled={isRestoring} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-[#10b981] disabled:opacity-50 dark:hover:bg-white/5" title="Restaurar como atual"><RotateCcw className="w-4 h-4" /></button>}</div></div>)}</div>}</div>;

const PermissionsTab: React.FC<{ canAdmin: boolean; permissions: { id: string; userId: string; userName?: string; userEmail?: string; accessLevel: Exclude<DocumentAccessLevel, 'none'> }[]; users: { id: string; name: string; email: string }[]; selectedUser: string; selectedLevel: Exclude<DocumentAccessLevel, 'none'>; isLoading: boolean; isUpdating: boolean; onUserChange: (value: string) => void; onLevelChange: (value: Exclude<DocumentAccessLevel, 'none'>) => void; onGrant: () => void; onRevoke: (userId: string) => void }> = ({ canAdmin, permissions, users, selectedUser, selectedLevel, isLoading, isUpdating, onUserChange, onLevelChange, onGrant, onRevoke }) => !canAdmin ? <div className="rounded-2xl bg-gray-50 p-6 text-center dark:bg-white/5"><ShieldCheck className="mx-auto mb-3 h-7 w-7 text-gray-400" /><h3 className="font-bold text-gray-900 dark:text-white">Permissões protegidas</h3><p className="mt-1 text-sm text-gray-500">Somente quem administra este documento pode visualizar ou alterar os compartilhamentos.</p></div> : <div className="space-y-4"><section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-500/20 dark:bg-emerald-950/10"><h3 className="font-bold text-gray-900 dark:text-white">Compartilhar com pessoa da empresa</h3><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_180px_auto]"><select value={selectedUser} onChange={(event) => onUserChange(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white"><option value="">Selecione uma pessoa</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}</select><select value={selectedLevel} onChange={(event) => onLevelChange(event.target.value as Exclude<DocumentAccessLevel, 'none'>)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white">{DOCUMENT_ACCESS_LEVELS.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}</select><button type="button" onClick={onGrant} disabled={isUpdating} className="rounded-xl bg-[#10b981] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Compartilhar</button></div></section>{isLoading ? <LoadingDetail /> : <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 dark:divide-white/5 dark:border-white/5">{permissions.length === 0 ? <p className="p-5 text-sm text-gray-500">Nenhuma permissão específica. A visibilidade base continua valendo.</p> : permissions.map((permission) => <div key={permission.id} className="flex items-center gap-3 p-4"><div className="min-w-0 flex-1"><p className="truncate font-semibold text-gray-900 dark:text-white">{permission.userName || 'Usuário'}</p><p className="truncate text-xs text-gray-500">{permission.userEmail || permission.accessLevel}</p></div><span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600 dark:bg-white/10 dark:text-gray-300">{DOCUMENT_ACCESS_LEVELS.find((level) => level.value === permission.accessLevel)?.label}</span><button type="button" onClick={() => onRevoke(permission.userId)} disabled={isUpdating} className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/20" title="Remover permissão"><X className="w-4 h-4" /></button></div>)}</div>}</div>;

const HistoryTab: React.FC<{ events: { id: string; eventType: string; summary: string; performedByName?: string; createdAt: string }[]; isLoading: boolean }> = ({ events, isLoading }) => isLoading ? <LoadingDetail /> : events.length === 0 ? <p className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500 dark:bg-white/5">Ainda não há eventos registrados.</p> : <ol className="space-y-3">{events.map((event) => <li key={event.id} className="flex gap-3 rounded-xl border border-gray-100 p-4 dark:border-white/5"><History className="mt-0.5 h-4 w-4 shrink-0 text-[#10b981]" /><div><p className="font-semibold text-gray-900 dark:text-white">{getDocumentAuditEventLabel(event.eventType)}</p><p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">{event.summary}</p><p className="mt-1 text-xs text-gray-400">{event.performedByName || 'Sistema'} · {new Date(event.createdAt).toLocaleString('pt-BR')}</p></div></li>)}</ol>;
