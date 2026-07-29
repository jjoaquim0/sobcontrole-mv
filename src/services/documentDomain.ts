import {
  Document,
  DocumentAccessLevel,
  DocumentRelatedType,
  DocumentVisibility,
  Profile,
} from '../types';

export const DOCUMENT_STORAGE_CONFIG = {
  maxFileSize: 10 * 1024 * 1024,
  allowedMimeTypes: [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/xml',
    'application/xml',
  ],
  accept: '.pdf,.png,.jpg,.jpeg,.csv,.xlsx,.xls,.doc,.docx,.xml',
} as const;

const MIME_TYPES_BY_EXTENSION: Record<string, readonly string[]> = {
  pdf: ['application/pdf'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  csv: ['text/csv'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  xls: ['application/vnd.ms-excel'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xml: ['text/xml', 'application/xml'],
};

export const DOCUMENT_RELATION_TYPES: { value: DocumentRelatedType; label: string }[] = [
  { value: 'customer', label: 'Cliente' },
  { value: 'supplier', label: 'Fornecedor' },
  { value: 'sale', label: 'Venda' },
  { value: 'purchase', label: 'Compra' },
  { value: 'product', label: 'Produto' },
  { value: 'deal', label: 'Oportunidade' },
  { value: 'company', label: 'Empresa' },
];

export const DOCUMENT_VISIBILITIES: { value: DocumentVisibility; label: string; description: string }[] = [
  { value: 'private', label: 'Privado', description: 'Somente proprietário e administradores.' },
  { value: 'company', label: 'Compartilhado com a empresa', description: 'Disponível conforme o papel do usuário na empresa.' },
  { value: 'restricted', label: 'Restrito', description: 'Somente pessoas selecionadas e administradores.' },
];

export const DOCUMENT_ACCESS_LEVELS: { value: Exclude<DocumentAccessLevel, 'none'>; label: string; description: string }[] = [
  { value: 'view', label: 'Visualizar', description: 'Pode abrir o arquivo.' },
  { value: 'download', label: 'Baixar', description: 'Pode abrir e baixar o arquivo.' },
  { value: 'edit', label: 'Editar', description: 'Pode editar metadados e adicionar versões.' },
  { value: 'admin', label: 'Administrar', description: 'Pode gerenciar permissões, versões e exclusão.' },
];

const ACCESS_RANK: Record<DocumentAccessLevel, number> = {
  none: 0,
  view: 1,
  download: 2,
  edit: 3,
  admin: 4,
};

export const sanitizeDocumentFileName = (fileName: string): string => {
  const lastDot = fileName.lastIndexOf('.');
  const base = lastDot > -1 ? fileName.slice(0, lastDot) : fileName;
  const extension = lastDot > -1 ? fileName.slice(lastDot).toLowerCase() : '';
  const safeBase = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'documento';

  return `${safeBase}${extension}`;
};

export const getFileExtension = (fileName: string): string => {
  const extension = fileName.split('.').pop();
  return extension && extension !== fileName ? extension.toLowerCase() : '';
};

export const validateDocumentFile = (file: Pick<File, 'name' | 'type' | 'size'>): string | null => {
  const extension = getFileExtension(file.name);
  const validMimeTypesForExtension = MIME_TYPES_BY_EXTENSION[extension];

  if (!extension || !validMimeTypesForExtension) {
    return `"${file.name}" possui uma extensão não suportada.`;
  }

  if (!DOCUMENT_STORAGE_CONFIG.allowedMimeTypes.includes(file.type as typeof DOCUMENT_STORAGE_CONFIG.allowedMimeTypes[number])) {
    return `"${file.name}" possui um tipo de arquivo não suportado.`;
  }

  if (!validMimeTypesForExtension.includes(file.type)) {
    return `"${file.name}" não corresponde ao tipo MIME informado.`;
  }

  if (file.size <= 0) {
    return `"${file.name}" está vazio.`;
  }

  if (file.size > DOCUMENT_STORAGE_CONFIG.maxFileSize) {
    return `"${file.name}" excede o limite de 10 MB configurado para documentos.`;
  }

  return null;
};

export const createImmutableDocumentPath = (
  companyId: string,
  documentId: string,
  versionId: string,
  fileName: string,
): string => `${companyId}/${documentId}/${versionId}/${sanitizeDocumentFileName(fileName)}`;

export const getDocumentFileType = (mimeType: string): string => {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.includes('spreadsheet') || mimeType === 'application/vnd.ms-excel' || mimeType === 'text/csv') return 'spreadsheet';
  if (mimeType.includes('word')) return 'document';
  if (mimeType.includes('xml')) return 'xml';
  return 'other';
};

export const resolveDocumentAccess = (document: Document, profile: Pick<Profile, 'id' | 'companyId' | 'role'> | null): DocumentAccessLevel => {
  if (!profile || document.companyId !== profile.companyId) return 'none';
  if (profile.role === 'admin' || document.ownerId === profile.id) return 'admin';

  const directAccess = document.currentUserPermission || 'none';
  const baseAccess: DocumentAccessLevel = document.visibility === 'company'
    ? profile.role === 'manager' ? 'edit' : 'download'
    : 'none';

  return ACCESS_RANK[directAccess] >= ACCESS_RANK[baseAccess] ? directAccess : baseAccess;
};

export const hasDocumentAccess = (
  document: Document,
  profile: Pick<Profile, 'id' | 'companyId' | 'role'> | null,
  required: Exclude<DocumentAccessLevel, 'none'>,
): boolean => ACCESS_RANK[resolveDocumentAccess(document, profile)] >= ACCESS_RANK[required];

export const getDocumentVisibilityLabel = (visibility: DocumentVisibility): string =>
  DOCUMENT_VISIBILITIES.find((item) => item.value === visibility)?.label || visibility;

export const getDocumentRelationLabel = (relatedType?: DocumentRelatedType): string | undefined =>
  DOCUMENT_RELATION_TYPES.find((item) => item.value === relatedType)?.label;

export const getDocumentAuditEventLabel = (eventType: string): string => ({
  document_created: 'Documento criado',
  metadata_updated: 'Metadados atualizados',
  document_archived: 'Documento arquivado',
  document_unarchived: 'Documento desarquivado',
  version_added: 'Nova versão adicionada',
  version_restored: 'Versão restaurada',
  permission_granted: 'Permissão concedida',
  permission_updated: 'Permissão alterada',
  permission_removed: 'Permissão removida',
  document_downloaded: 'Download realizado',
  document_deleted: 'Documento excluído',
  document_restored: 'Documento restaurado',
}[eventType] || eventType);
