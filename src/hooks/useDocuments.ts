import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  archiveDocument,
  deleteDocument,
  DocumentFilters,
  DocumentUpdateInput,
  getCompanyUsers,
  getDocumentAuditEvents,
  getDocumentById,
  getDocumentPermissions,
  getDocumentStats,
  getDocumentVersions,
  getDocuments,
  getRelatedEntities,
  grantDocumentPermission,
  restoreDocument,
  restoreDocumentVersion,
  revokeDocumentPermission,
  unarchiveDocument,
  updateDocument,
  uploadDocument,
  uploadDocumentVersion,
  DocumentUploadInput,
} from '../services/documentService';
import { DocumentAccessLevel, DocumentRelatedType } from '../types';

const notifyError = (error: unknown, fallback: string) => {
  toast.error(error instanceof Error ? error.message : fallback);
};

export const useDocuments = (filters?: DocumentFilters) => {
  const listQuery = useQuery({
    queryKey: ['documents', filters],
    queryFn: () => getDocuments(filters),
  });

  return {
    documents: listQuery.data || [],
    isLoading: listQuery.isLoading,
    isError: listQuery.isError,
    error: listQuery.error,
    refetch: listQuery.refetch,
  };
};

export const useDocumentDetails = (id?: string) => {
  const detailsQuery = useQuery({
    queryKey: ['document', id],
    queryFn: () => getDocumentById(id!),
    enabled: Boolean(id),
  });

  return {
    data: detailsQuery.data,
    isLoading: detailsQuery.isLoading,
    isError: detailsQuery.isError,
    error: detailsQuery.error,
    refetch: detailsQuery.refetch,
  };
};

export const useDocumentVersions = (documentId?: string) => useQuery({
  queryKey: ['document-versions', documentId],
  queryFn: () => getDocumentVersions(documentId!),
  enabled: Boolean(documentId),
});

export const useDocumentPermissions = (documentId?: string, enabled = true) => useQuery({
  queryKey: ['document-permissions', documentId],
  queryFn: () => getDocumentPermissions(documentId!),
  enabled: Boolean(documentId) && enabled,
});

export const useDocumentAuditEvents = (documentId?: string) => useQuery({
  queryKey: ['document-audit-events', documentId],
  queryFn: () => getDocumentAuditEvents(documentId!),
  enabled: Boolean(documentId),
});

export const useDocumentStats = () => {
  const statsQuery = useQuery({ queryKey: ['document-stats'], queryFn: getDocumentStats });
  return {
    stats: statsQuery.data,
    isLoading: statsQuery.isLoading,
    isError: statsQuery.isError,
    refetch: statsQuery.refetch,
  };
};

export const useDocumentCompanyUsers = () => useQuery({
  queryKey: ['document-company-users'],
  queryFn: getCompanyUsers,
});

export const useDocumentRelatedEntities = (relatedType?: DocumentRelatedType) => useQuery({
  queryKey: ['document-related-entities', relatedType],
  queryFn: () => getRelatedEntities(relatedType),
  enabled: Boolean(relatedType),
});

export const useDocumentMutations = () => {
  const queryClient = useQueryClient();
  const invalidateDocument = (documentId?: string) => {
    queryClient.invalidateQueries({ queryKey: ['documents'] });
    queryClient.invalidateQueries({ queryKey: ['document-stats'] });
    if (documentId) {
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
      queryClient.invalidateQueries({ queryKey: ['document-versions', documentId] });
      queryClient.invalidateQueries({ queryKey: ['document-permissions', documentId] });
      queryClient.invalidateQueries({ queryKey: ['document-audit-events', documentId] });
    }
  };

  const uploadMutation = useMutation({
    mutationFn: ({ file, input }: { file: File; input: DocumentUploadInput }) => uploadDocument(file, input),
    onSuccess: (document) => invalidateDocument(document.id),
    onError: (error) => notifyError(error, 'Erro ao enviar documento.'),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: DocumentUpdateInput }) => updateDocument(id, data),
    onSuccess: (document) => invalidateDocument(document.id),
    onError: (error) => notifyError(error, 'Erro ao atualizar documento.'),
  });
  const archiveMutation = useMutation({
    mutationFn: archiveDocument,
    onSuccess: (document) => {
      invalidateDocument(document.id);
      toast.success(`Documento "${document.name}" arquivado.`);
    },
    onError: (error) => notifyError(error, 'Erro ao arquivar documento.'),
  });
  const unarchiveMutation = useMutation({
    mutationFn: unarchiveDocument,
    onSuccess: (document) => {
      invalidateDocument(document.id);
      toast.success(`Documento "${document.name}" desarquivado.`);
    },
    onError: (error) => notifyError(error, 'Erro ao desarquivar documento.'),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: (_, documentId) => {
      invalidateDocument(documentId);
      toast.success('Documento movido para excluídos. O arquivo e o histórico foram preservados.');
    },
    onError: (error) => notifyError(error, 'Erro ao excluir documento.'),
  });
  const restoreMutation = useMutation({
    mutationFn: restoreDocument,
    onSuccess: (document) => {
      invalidateDocument(document.id);
      toast.success(`Documento "${document.name}" restaurado.`);
    },
    onError: (error) => notifyError(error, 'Erro ao restaurar documento.'),
  });
  const addVersionMutation = useMutation({
    mutationFn: ({ documentId, file, comment }: { documentId: string; file: File; comment?: string }) => uploadDocumentVersion(documentId, file, comment),
    onSuccess: (document) => {
      invalidateDocument(document.id);
      toast.success('Nova versão adicionada. A versão anterior foi preservada.');
    },
    onError: (error) => notifyError(error, 'Erro ao adicionar versão.'),
  });
  const restoreVersionMutation = useMutation({
    mutationFn: ({ documentId, versionId }: { documentId: string; versionId: string }) => restoreDocumentVersion(documentId, versionId),
    onSuccess: (document) => {
      invalidateDocument(document.id);
      toast.success('Versão restaurada como atual.');
    },
    onError: (error) => notifyError(error, 'Erro ao restaurar versão.'),
  });
  const grantPermissionMutation = useMutation({
    mutationFn: ({ documentId, userId, accessLevel }: { documentId: string; userId: string; accessLevel: Exclude<DocumentAccessLevel, 'none'> }) =>
      grantDocumentPermission(documentId, userId, accessLevel),
    onSuccess: (_, variables) => {
      invalidateDocument(variables.documentId);
      toast.success('Permissão atualizada.');
    },
    onError: (error) => notifyError(error, 'Erro ao atualizar permissão.'),
  });
  const revokePermissionMutation = useMutation({
    mutationFn: ({ documentId, userId }: { documentId: string; userId: string }) => revokeDocumentPermission(documentId, userId),
    onSuccess: (_, variables) => {
      invalidateDocument(variables.documentId);
      toast.success('Permissão removida.');
    },
    onError: (error) => notifyError(error, 'Erro ao remover permissão.'),
  });

  return {
    uploadDocument: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    updateDocument: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    archiveDocument: archiveMutation.mutateAsync,
    isArchiving: archiveMutation.isPending,
    unarchiveDocument: unarchiveMutation.mutateAsync,
    isUnarchiving: unarchiveMutation.isPending,
    deleteDocument: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    restoreDocument: restoreMutation.mutateAsync,
    isRestoring: restoreMutation.isPending,
    uploadDocumentVersion: addVersionMutation.mutateAsync,
    isAddingVersion: addVersionMutation.isPending,
    restoreDocumentVersion: restoreVersionMutation.mutateAsync,
    isRestoringVersion: restoreVersionMutation.isPending,
    grantDocumentPermission: grantPermissionMutation.mutateAsync,
    revokeDocumentPermission: revokePermissionMutation.mutateAsync,
    isUpdatingPermission: grantPermissionMutation.isPending || revokePermissionMutation.isPending,
  };
};
