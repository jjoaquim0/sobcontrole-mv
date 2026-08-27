import { supabase } from '../lib/supabase';
import {
  Document,
  DocumentAccessLevel,
  DocumentAuditEvent,
  DocumentCategory,
  DocumentPermission,
  DocumentRelatedEntity,
  DocumentRelatedType,
  DocumentStatus,
  DocumentVersion,
  DocumentVisibility,
  Profile,
} from '../types';
import { useAuthStore } from '../store/authStore';
import {
  createImmutableDocumentPath,
  DOCUMENT_RELATION_TYPES,
  DOCUMENT_STORAGE_CONFIG,
  validateDocumentFile,
} from './documentDomain';

const DOCUMENT_BUCKET = 'documents';
const SIGNED_URL_TTL_SECONDS = 60;

type DbProfile = { name?: string | null; email?: string | null } | null;
type DbDocumentRow = {
  id: string;
  company_id: string;
  name: string;
  original_name: string;
  description?: string | null;
  category: DocumentCategory;
  mime_type?: string | null;
  size?: number | string | null;
  storage_path: string;
  related_type?: DocumentRelatedType | null;
  related_id?: string | null;
  status: DocumentStatus;
  visibility?: DocumentVisibility | null;
  owner_id?: string | null;
  uploaded_by?: string | null;
  owner?: DbProfile;
  uploader?: DbProfile;
  profiles?: DbProfile;
  current_version_id?: string | null;
  document_versions?: { count?: number | null }[];
  version_count?: number | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  created_at: string;
  updated_at: string;
};
type DbVersionRow = {
  id: string; document_id: string; company_id: string; version_number: number | string; original_name: string;
  storage_path: string; mime_type?: string | null; size?: number | string | null; change_comment?: string | null;
  created_by?: string | null; profiles?: DbProfile; created_at: string;
};
type DbPermissionRow = {
  id: string; document_id: string; company_id: string; user_id: string; access_level: Exclude<DocumentAccessLevel, 'none'>;
  granted_by?: string | null; user?: DbProfile; profiles?: DbProfile; granted_by_profile?: DbProfile; created_at: string; updated_at: string;
};
type DbAuditEventRow = {
  id: string; document_id: string; company_id: string; event_type: string; summary: string; previous_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null; performed_by?: string | null; profiles?: DbProfile; created_at: string;
};
type RelatedEntityRow = { id: string; full_name?: string; name?: string; sku?: string; title?: string; final_value?: number | string | null };

const getCompanyId = (): string => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');
  return companyId;
};

const getCurrentUserId = (): string => {
  const userId = useAuthStore.getState().profile?.id;
  if (!userId) throw new Error('Usuário não identificado.');
  return userId;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const mapDbDocument = (db: DbDocumentRow, currentUserPermission?: DocumentAccessLevel): Document => ({
  id: db.id,
  companyId: db.company_id,
  name: db.name,
  originalName: db.original_name,
  description: db.description || undefined,
  category: db.category,
  mimeType: db.mime_type || '',
  size: Number(db.size || 0),
  storagePath: db.storage_path,
  relatedType: db.related_type || undefined,
  relatedId: db.related_id || undefined,
  status: db.status,
  visibility: db.visibility || 'company',
  ownerId: db.owner_id || db.uploaded_by || undefined,
  ownerName: db.owner?.name || db.profiles?.name || undefined,
  uploadedBy: db.uploaded_by || undefined,
  uploadedByName: db.uploader?.name || db.profiles?.name || undefined,
  currentVersionId: db.current_version_id || undefined,
  versionCount: Number(db.document_versions?.[0]?.count ?? db.version_count ?? 1),
  currentUserPermission,
  deletedAt: db.deleted_at || undefined,
  deletedBy: db.deleted_by || undefined,
  createdAt: db.created_at,
  updatedAt: db.updated_at,
});

const mapDbVersion = (db: DbVersionRow): DocumentVersion => ({
  id: db.id,
  documentId: db.document_id,
  companyId: db.company_id,
  versionNumber: Number(db.version_number),
  originalName: db.original_name,
  storagePath: db.storage_path,
  mimeType: db.mime_type || '',
  size: Number(db.size || 0),
  changeComment: db.change_comment || undefined,
  createdBy: db.created_by || undefined,
  createdByName: db.profiles?.name || undefined,
  createdAt: db.created_at,
});

const mapDbPermission = (db: DbPermissionRow): DocumentPermission => ({
  id: db.id,
  documentId: db.document_id,
  companyId: db.company_id,
  userId: db.user_id,
  userName: db.user?.name || db.profiles?.name || undefined,
  userEmail: db.user?.email || db.profiles?.email || undefined,
  accessLevel: db.access_level,
  grantedBy: db.granted_by || undefined,
  grantedByName: db.granted_by_profile?.name || undefined,
  createdAt: db.created_at,
  updatedAt: db.updated_at,
});

const mapDbAuditEvent = (db: DbAuditEventRow): DocumentAuditEvent => ({
  id: db.id,
  documentId: db.document_id,
  companyId: db.company_id,
  eventType: db.event_type,
  summary: db.summary,
  previousData: db.previous_data || undefined,
  newData: db.new_data || undefined,
  performedBy: db.performed_by || undefined,
  performedByName: db.profiles?.name || undefined,
  createdAt: db.created_at,
});

export interface DocumentFilters {
  search?: string;
  category?: DocumentCategory | 'all';
  status?: DocumentStatus | 'all';
  mimeType?: string | 'all';
  visibility?: DocumentVisibility | 'all';
  uploadedBy?: string | 'all';
  relatedType?: DocumentRelatedType | 'all';
  relatedId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'recent' | 'name' | 'size' | 'updated';
}

export interface DocumentUploadInput {
  name?: string;
  category: DocumentCategory;
  visibility: DocumentVisibility;
  description?: string;
  related?: { relatedType: DocumentRelatedType; relatedId: string };
}

export interface SyntheticDocumentInput {
  name: string;
  category: DocumentCategory;
  content: string;
  mimeType: 'text/xml' | 'application/xml';
}

export interface DocumentUpdateInput {
  name?: string;
  description?: string | null;
  category?: DocumentCategory;
  visibility?: DocumentVisibility;
  related?: { relatedType: DocumentRelatedType; relatedId: string } | null;
}

export const DOCUMENT_CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: 'nota_fiscal', label: 'Notas Fiscais' },
  { value: 'contrato', label: 'Contratos' },
  { value: 'boleto', label: 'Boletos' },
  { value: 'recibo', label: 'Recibos' },
  { value: 'empresa', label: 'Documentos da Empresa' },
  { value: 'cliente', label: 'Clientes' },
  { value: 'fornecedor', label: 'Fornecedores' },
  { value: 'outros', label: 'Outros' },
];

export const DOCUMENT_FILE_TYPES = [
  { value: 'application/pdf', label: 'PDF' },
  { value: 'image/', label: 'Imagem' },
  { value: 'spreadsheet', label: 'Planilha' },
  { value: 'document', label: 'Documento do Word' },
  { value: 'xml', label: 'XML' },
] as const;

export const getCategories = () => DOCUMENT_CATEGORIES;

const getCurrentUserPermissions = async (): Promise<Map<string, DocumentAccessLevel>> => {
  const companyId = getCompanyId();
  const userId = getCurrentUserId();
  const { data, error } = await supabase
    .from('document_permissions')
    .select('document_id, access_level')
    .eq('company_id', companyId)
    .eq('user_id', userId);

  if (error) throw error;
  return new Map((data || []).map((permission: { document_id: string; access_level: DocumentAccessLevel }) => [permission.document_id, permission.access_level]));
};

export const getDocuments = async (filters: DocumentFilters = {}): Promise<Document[]> => {
  const companyId = getCompanyId();
  let query = supabase
    .from('documents')
    .select('*, owner:profiles!documents_owner_id_fkey(name), uploader:profiles!documents_uploaded_by_fkey(name), document_versions!document_versions_document_id_fkey(count)')
    .eq('company_id', companyId);

  if (filters.category && filters.category !== 'all') query = query.eq('category', filters.category);
  if (filters.visibility && filters.visibility !== 'all') query = query.eq('visibility', filters.visibility);
  if (filters.uploadedBy && filters.uploadedBy !== 'all') query = query.eq('uploaded_by', filters.uploadedBy);
  if (filters.relatedType && filters.relatedType !== 'all') query = query.eq('related_type', filters.relatedType);
  if (filters.relatedId) query = query.eq('related_id', filters.relatedId);
  if (filters.dateFrom) query = query.gte('created_at', `${filters.dateFrom}T00:00:00.000Z`);
  if (filters.dateTo) query = query.lte('created_at', `${filters.dateTo}T23:59:59.999Z`);
  if (filters.search) {
    const searchValue = `%${filters.search.replace(/[%_,()]/g, '')}%`;
    query = query.or(`name.ilike.${searchValue},original_name.ilike.${searchValue}`);
  }

  if (filters.mimeType && filters.mimeType !== 'all') {
    if (filters.mimeType === 'image/') query = query.like('mime_type', 'image/%');
    else if (filters.mimeType === 'spreadsheet') query = query.in('mime_type', ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']);
    else if (filters.mimeType === 'document') query = query.in('mime_type', ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
    else if (filters.mimeType === 'xml') query = query.in('mime_type', ['text/xml', 'application/xml']);
    else query = query.eq('mime_type', filters.mimeType);
  }

  if (filters.status === 'deleted') {
    query = query.not('deleted_at', 'is', null);
  } else {
    query = query.is('deleted_at', null);
    if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
  }

  if (filters.sortBy === 'name') query = query.order('name', { ascending: true });
  else if (filters.sortBy === 'size') query = query.order('size', { ascending: false });
  else if (filters.sortBy === 'updated') query = query.order('updated_at', { ascending: false });
  else query = query.order('created_at', { ascending: false });

  const [{ data, error }, permissions] = await Promise.all([query, getCurrentUserPermissions()]);
  if (error) throw error;
  return (data || []).map((document) => {
    const row = document as DbDocumentRow;
    return mapDbDocument(row, permissions.get(row.id));
  });
};

export const getDocumentById = async (id: string): Promise<Document> => {
  const companyId = getCompanyId();
  const [{ data, error }, permissions] = await Promise.all([
    supabase
      .from('documents')
      .select('*, owner:profiles!documents_owner_id_fkey(name), uploader:profiles!documents_uploaded_by_fkey(name), document_versions!document_versions_document_id_fkey(count)')
      .eq('id', id)
      .eq('company_id', companyId)
      .single(),
    getCurrentUserPermissions(),
  ]);

  if (error) throw error;
  return mapDbDocument(data as DbDocumentRow, permissions.get(id));
};

export interface DocumentStats {
  totalDocuments: number;
  totalSize: number;
  documentsByCategory: { category: string; count: number }[];
  recentUploads: number;
}

export const getDocumentStats = async (): Promise<DocumentStats> => {
  const documents = await getDocuments({ status: 'all', sortBy: 'recent' });
  const totalSize = documents.reduce((sum, document) => sum + document.size, 0);
  const categoryMap = new Map<string, number>();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  documents.forEach((document) => categoryMap.set(document.category, (categoryMap.get(document.category) || 0) + 1));

  return {
    totalDocuments: documents.length,
    totalSize,
    documentsByCategory: Array.from(categoryMap.entries()).map(([category, count]) => ({ category, count })),
    recentUploads: documents.filter((document) => new Date(document.createdAt) >= thirtyDaysAgo).length,
  };
};

export const uploadDocument = async (file: File, input: DocumentUploadInput): Promise<Document> => {
  const validationError = validateDocumentFile(file);
  if (validationError) throw new Error(validationError);

  const companyId = getCompanyId();
  const userId = getCurrentUserId();
  const documentId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const storagePath = createImmutableDocumentPath(companyId, documentId, versionId, file.name);

  const { error: uploadError } = await supabase.storage.from(DOCUMENT_BUCKET).upload(storagePath, file, {
    upsert: false,
    contentType: file.type,
  });
  if (uploadError) throw uploadError;

  const { error: createError } = await supabase.rpc('create_document_with_initial_version', {
    p_document_id: documentId,
    p_version_id: versionId,
    p_name: input.name?.trim() || file.name,
    p_original_name: file.name,
    p_category: input.category,
    p_visibility: input.visibility,
    p_description: input.description?.trim() || null,
    p_related_type: input.related?.relatedType || null,
    p_related_id: input.related?.relatedId || null,
    p_storage_path: storagePath,
    p_mime_type: file.type,
    p_size: file.size,
    p_created_by: userId,
  });

  if (createError) {
    await supabase.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
    throw createError;
  }

  return getDocumentById(documentId);
};

export const createSyntheticDocument = async (input: SyntheticDocumentInput): Promise<Document> => {
  const name = input.name.trim();
  if (!name || !input.content.trim()) throw new Error('Documento sintético inválido.');

  const companyId = getCompanyId();
  const userId = getCurrentUserId();
  const documentId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const blob = new Blob([input.content], { type: input.mimeType });
  const storagePath = createImmutableDocumentPath(companyId, documentId, versionId, name);

  const { error: uploadError } = await supabase.storage.from(DOCUMENT_BUCKET).upload(storagePath, blob, {
    upsert: false,
    contentType: input.mimeType,
  });
  if (uploadError) throw uploadError;

  const { error: createError } = await supabase.rpc('create_document_with_initial_version', {
    p_document_id: documentId,
    p_version_id: versionId,
    p_name: name,
    p_original_name: name,
    p_category: input.category,
    p_visibility: 'private',
    p_description: null,
    p_related_type: null,
    p_related_id: null,
    p_storage_path: storagePath,
    p_mime_type: input.mimeType,
    p_size: blob.size,
    p_created_by: userId,
  });

  if (createError) {
    await supabase.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
    throw createError;
  }

  return getDocumentById(documentId);
};

export const updateDocument = async (id: string, updates: DocumentUpdateInput): Promise<Document> => {
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.category !== undefined) payload.category = updates.category;
  if (updates.visibility !== undefined) payload.visibility = updates.visibility;
  if (updates.related !== undefined) {
    payload.related_type = updates.related?.relatedType || null;
    payload.related_id = updates.related?.relatedId || null;
  }

  const { error } = await supabase.rpc('update_document_metadata', {
    p_document_id: id,
    p_updates: payload,
  });
  if (error) throw error;
  return getDocumentById(id);
};

export const setDocumentStatus = async (id: string, status: Extract<DocumentStatus, 'active' | 'archived'>): Promise<Document> => {
  const { error } = await supabase.rpc('set_document_status', { p_document_id: id, p_status: status });
  if (error) throw error;
  return getDocumentById(id);
};

export const archiveDocument = (id: string): Promise<Document> => setDocumentStatus(id, 'archived');
export const unarchiveDocument = (id: string): Promise<Document> => setDocumentStatus(id, 'active');

export const deleteDocument = async (id: string): Promise<void> => {
  const { error } = await supabase.rpc('soft_delete_document', { p_document_id: id });
  if (error) throw error;
};

export const restoreDocument = async (id: string): Promise<Document> => {
  const { error } = await supabase.rpc('restore_document', { p_document_id: id });
  if (error) throw error;
  return getDocumentById(id);
};

export const getDocumentVersions = async (documentId: string): Promise<DocumentVersion[]> => {
  const companyId = getCompanyId();
  const { data, error } = await supabase
    .from('document_versions')
    .select('*, profiles!document_versions_created_by_fkey(name)')
    .eq('document_id', documentId)
    .eq('company_id', companyId)
    .order('version_number', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapDbVersion);
};

export const uploadDocumentVersion = async (documentId: string, file: File, changeComment?: string): Promise<Document> => {
  const validationError = validateDocumentFile(file);
  if (validationError) throw new Error(validationError);

  const companyId = getCompanyId();
  const versionId = crypto.randomUUID();
  const storagePath = createImmutableDocumentPath(companyId, documentId, versionId, file.name);
  const { error: uploadError } = await supabase.storage.from(DOCUMENT_BUCKET).upload(storagePath, file, {
    upsert: false,
    contentType: file.type,
  });
  if (uploadError) throw uploadError;

  const { error: versionError } = await supabase.rpc('add_document_version', {
    p_document_id: documentId,
    p_version_id: versionId,
    p_original_name: file.name,
    p_storage_path: storagePath,
    p_mime_type: file.type,
    p_size: file.size,
    p_change_comment: changeComment?.trim() || null,
  });
  if (versionError) {
    await supabase.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
    throw versionError;
  }
  return getDocumentById(documentId);
};

export const restoreDocumentVersion = async (documentId: string, versionId: string): Promise<Document> => {
  const { error } = await supabase.rpc('restore_document_version', {
    p_document_id: documentId,
    p_version_id: versionId,
  });
  if (error) throw error;
  return getDocumentById(documentId);
};

export const getDocumentPermissions = async (documentId: string): Promise<DocumentPermission[]> => {
  const companyId = getCompanyId();
  const { data, error } = await supabase
    .from('document_permissions')
    .select('*, user:profiles!document_permissions_user_id_fkey(name, email), granted_by_profile:profiles!document_permissions_granted_by_fkey(name)')
    .eq('document_id', documentId)
    .eq('company_id', companyId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapDbPermission);
};

export const grantDocumentPermission = async (
  documentId: string,
  userId: string,
  accessLevel: Exclude<DocumentAccessLevel, 'none'>,
): Promise<void> => {
  const { error } = await supabase.rpc('upsert_document_permission', {
    p_document_id: documentId,
    p_user_id: userId,
    p_access_level: accessLevel,
  });
  if (error) throw error;
};

export const revokeDocumentPermission = async (documentId: string, userId: string): Promise<void> => {
  const { error } = await supabase.rpc('remove_document_permission', {
    p_document_id: documentId,
    p_user_id: userId,
  });
  if (error) throw error;
};

export const getDocumentAuditEvents = async (documentId: string): Promise<DocumentAuditEvent[]> => {
  const companyId = getCompanyId();
  const { data, error } = await supabase
    .from('document_audit_events')
    .select('*, profiles!document_audit_events_performed_by_fkey(name)')
    .eq('document_id', documentId)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapDbAuditEvent);
};

const createSignedUrl = async (storagePath: string): Promise<string> => {
  const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) throw error || new Error('Não foi possível criar uma URL temporária para o documento.');
  return data.signedUrl;
};

export const getDocumentPreviewUrl = (document: Pick<Document, 'storagePath'>): Promise<string> => createSignedUrl(document.storagePath);

export const getDocumentDownloadUrl = async (document: Pick<Document, 'id' | 'storagePath'>): Promise<string> => {
  const { error } = await supabase.rpc('record_document_download', { p_document_id: document.id });
  if (error) throw error;
  return createSignedUrl(document.storagePath);
};

export const getDocumentVersionPreviewUrl = (version: Pick<DocumentVersion, 'storagePath'>): Promise<string> => createSignedUrl(version.storagePath);

export const getDocumentVersionDownloadUrl = async (
  documentId: string,
  version: Pick<DocumentVersion, 'storagePath'>,
): Promise<string> => {
  const { error } = await supabase.rpc('record_document_download', { p_document_id: documentId });
  if (error) throw error;
  return createSignedUrl(version.storagePath);
};

export const getCompanyUsers = async (): Promise<Pick<Profile, 'id' | 'name' | 'email' | 'role'>[]> => {
  const companyId = getCompanyId();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, role')
    .eq('company_id', companyId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const getRelatedEntities = async (relatedType?: DocumentRelatedType): Promise<DocumentRelatedEntity[]> => {
  if (!relatedType) return [];
  const companyId = getCompanyId();

  if (relatedType === 'company') {
    const company = useAuthStore.getState().company;
    return company ? [{ id: company.id, label: company.name }] : [];
  }

  const configurations: Record<Exclude<DocumentRelatedType, 'company'>, { table: string; select: string; label: (row: RelatedEntityRow) => string }> = {
    customer: { table: 'customers', select: 'id, full_name', label: (row) => row.full_name || 'Cliente sem nome' },
    supplier: { table: 'suppliers', select: 'id, name', label: (row) => row.name || 'Fornecedor sem nome' },
    sale: { table: 'sales', select: 'id, final_value, created_at', label: (row) => `Venda ${row.id} — R$ ${Number(row.final_value || 0).toFixed(2)}` },
    purchase: { table: 'purchases', select: 'id, final_value, created_at', label: (row) => `Compra ${row.id} — R$ ${Number(row.final_value || 0).toFixed(2)}` },
    product: { table: 'products', select: 'id, name, sku', label: (row) => row.sku ? `${row.name || 'Produto'} (${row.sku})` : row.name || 'Produto sem nome' },
    deal: { table: 'deals', select: 'id, title', label: (row) => row.title || 'Oportunidade sem título' },
  };
  const configuration = configurations[relatedType];
  const { data, error } = await supabase
    .from(configuration.table)
    .select(configuration.select)
    .eq('company_id', companyId)
    .limit(100);
  if (error) throw error;
  return (data || []).map((row) => {
    const entity = row as unknown as RelatedEntityRow;
    return { id: String(entity.id), label: configuration.label(entity) };
  });
};

export const getDocumentStorageConfig = () => DOCUMENT_STORAGE_CONFIG;
export const getDocumentRelationTypes = () => DOCUMENT_RELATION_TYPES;
