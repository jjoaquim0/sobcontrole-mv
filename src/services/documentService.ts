import { supabase } from '../lib/supabase';
import { Document, DocumentCategory } from '../types';
import { useAuthStore } from '../store/authStore';

const getCompanyId = () => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');
  return companyId;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const mapDbDocument = (db: any): Document => ({
  id: db.id,
  companyId: db.company_id,
  name: db.name,
  originalName: db.original_name,
  url: db.url,
  category: db.category,
  mimeType: db.mime_type || '',
  size: db.size || 0,
  storagePath: db.storage_path,
  relatedType: db.related_type || undefined,
  relatedId: db.related_id || undefined,
  status: db.status,
  uploadedBy: db.uploaded_by,
  uploadedByName: db.profiles?.name,
  createdAt: db.created_at,
  updatedAt: db.updated_at,
});

export interface DocumentFilters {
  search?: string;
  category?: DocumentCategory | 'all';
  status?: 'active' | 'archived' | 'all';
  relatedType?: string;
  relatedId?: string;
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

export const getCategories = () => DOCUMENT_CATEGORIES;

export const getDocuments = async (filters?: DocumentFilters): Promise<Document[]> => {
  const companyId = getCompanyId();

  let query = supabase
    .from('documents')
    .select('*, profiles(name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (filters?.category && filters.category !== 'all') {
    query = query.eq('category', filters.category);
  }

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters?.relatedType) {
    query = query.eq('related_type', filters.relatedType);
  }

  if (filters?.relatedId) {
    query = query.eq('related_id', filters.relatedId);
  }

  if (filters?.search) {
    const searchVal = `%${filters.search}%`;
    query = query.or(`name.ilike.${searchVal},original_name.ilike.${searchVal}`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(mapDbDocument);
};

export const getDocumentById = async (id: string): Promise<Document> => {
  const companyId = getCompanyId();

  const { data, error } = await supabase
    .from('documents')
    .select('*, profiles(name)')
    .eq('id', id)
    .eq('company_id', companyId)
    .single();

  if (error) throw error;
  return mapDbDocument(data);
};

export interface DocumentStats {
  totalDocuments: number;
  totalSize: number;
  documentsByCategory: { category: string; count: number }[];
  recentUploads: number;
}

export const getDocumentStats = async (): Promise<DocumentStats> => {
  const companyId = getCompanyId();

  const { data, error } = await supabase
    .from('documents')
    .select('category, size, created_at')
    .eq('company_id', companyId)
    .eq('status', 'active');

  if (error) throw error;

  const documents = data || [];
  const totalDocuments = documents.length;
  const totalSize = documents.reduce((sum, d) => sum + Number(d.size || 0), 0);

  const categoryMap = new Map<string, number>();
  documents.forEach((d) => {
    categoryMap.set(d.category, (categoryMap.get(d.category) || 0) + 1);
  });
  const documentsByCategory = Array.from(categoryMap.entries()).map(([category, count]) => ({ category, count }));

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentUploads = documents.filter((d) => new Date(d.created_at) >= thirtyDaysAgo).length;

  return { totalDocuments, totalSize, documentsByCategory, recentUploads };
};

const sanitizeFileName = (fileName: string) => {
  const lastDot = fileName.lastIndexOf('.');
  const base = lastDot > -1 ? fileName.slice(0, lastDot) : fileName;
  const ext = lastDot > -1 ? fileName.slice(lastDot) : '';
  const sanitizedBase = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .slice(0, 80);
  return `${sanitizedBase}${ext}`;
};

export const uploadDocument = async (
  file: File,
  category: DocumentCategory,
  name?: string,
  related?: { relatedType: string; relatedId: string }
): Promise<Document> => {
  const companyId = getCompanyId();
  const userId = useAuthStore.getState().profile?.id;
  const newId = crypto.randomUUID();
  const storagePath = `${companyId}/${newId}-${sanitizeFileName(file.name)}`;

  const { error: uploadErr } = await supabase.storage.from('documents').upload(storagePath, file);
  if (uploadErr) throw uploadErr;

  const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(storagePath);

  const dbInsert = {
    id: newId,
    company_id: companyId,
    name: name || file.name,
    original_name: file.name,
    url: publicUrlData.publicUrl,
    category,
    mime_type: file.type,
    size: file.size,
    storage_path: storagePath,
    related_type: related?.relatedType,
    related_id: related?.relatedId,
    status: 'active',
    uploaded_by: userId,
  };

  const { data: dbDoc, error: insertErr } = await supabase
    .from('documents')
    .insert(dbInsert)
    .select('*, profiles(name)')
    .single();

  if (insertErr) {
    await supabase.storage.from('documents').remove([storagePath]);
    throw insertErr;
  }

  return mapDbDocument(dbDoc);
};

export const updateDocument = async (
  id: string,
  data: Partial<{ name: string; category: DocumentCategory; status: 'active' | 'archived'; relatedType: string; relatedId: string }>
): Promise<Document> => {
  const companyId = getCompanyId();

  const dbPayload: any = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) dbPayload.name = data.name;
  if (data.category !== undefined) dbPayload.category = data.category;
  if (data.status !== undefined) dbPayload.status = data.status;
  if (data.relatedType !== undefined) dbPayload.related_type = data.relatedType;
  if (data.relatedId !== undefined) dbPayload.related_id = data.relatedId;

  const { data: dbDoc, error } = await supabase
    .from('documents')
    .update(dbPayload)
    .eq('id', id)
    .eq('company_id', companyId)
    .select('*, profiles(name)')
    .single();

  if (error) throw error;
  return mapDbDocument(dbDoc);
};

export const archiveDocument = async (id: string): Promise<Document> => updateDocument(id, { status: 'archived' });

export const unarchiveDocument = async (id: string): Promise<Document> => updateDocument(id, { status: 'active' });

export const deleteDocument = async (id: string): Promise<void> => {
  const companyId = getCompanyId();

  const { data: dbDoc, error: fetchErr } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('id', id)
    .eq('company_id', companyId)
    .single();

  if (fetchErr) throw fetchErr;

  const { error: removeErr } = await supabase.storage.from('documents').remove([dbDoc.storage_path]);
  if (removeErr) throw removeErr;

  const { error: deleteErr } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId);

  if (deleteErr) throw deleteErr;
};

export const getDocumentUrl = (storagePath: string): string => {
  const { data } = supabase.storage.from('documents').getPublicUrl(storagePath);
  return data.publicUrl;
};
