import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDocuments,
  getDocumentById,
  getDocumentStats,
  uploadDocument,
  updateDocument,
  archiveDocument,
  unarchiveDocument,
  deleteDocument,
  DocumentFilters,
} from '../services/documentService';
import { DocumentCategory } from '../types';
import { toast } from 'sonner';

export const useDocuments = (filters?: DocumentFilters) => {
  const listQuery = useQuery({
    queryKey: ['documents', filters],
    queryFn: () => getDocuments(filters),
  });

  return {
    documents: listQuery.data || [],
    isLoading: listQuery.isLoading,
    isError: listQuery.isError,
    refetch: listQuery.refetch,
  };
};

export const useDocumentDetails = (id: string) => {
  const detailsQuery = useQuery({
    queryKey: ['document', id],
    queryFn: () => getDocumentById(id),
    enabled: !!id,
  });

  return {
    data: detailsQuery.data,
    isLoading: detailsQuery.isLoading,
    isError: detailsQuery.isError,
    refetch: detailsQuery.refetch,
  };
};

export const useDocumentStats = () => {
  const statsQuery = useQuery({
    queryKey: ['document-stats'],
    queryFn: getDocumentStats,
  });

  return {
    stats: statsQuery.data,
    isLoading: statsQuery.isLoading,
    isError: statsQuery.isError,
    refetch: statsQuery.refetch,
  };
};

export const useDocumentMutations = () => {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['documents'] });
    queryClient.invalidateQueries({ queryKey: ['document-stats'] });
  };

  const uploadMutation = useMutation({
    mutationFn: ({ file, category, name, related }: { file: File; category: DocumentCategory; name?: string; related?: { relatedType: string; relatedId: string } }) =>
      uploadDocument(file, category, name, related),
    onSuccess: () => {
      invalidateAll();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao enviar documento.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateDocument>[1] }) => updateDocument(id, data),
    onSuccess: (data) => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['document', data.id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao atualizar documento.');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: archiveDocument,
    onSuccess: (data) => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['document', data.id] });
      toast.success(`Documento "${data.name}" arquivado com sucesso!`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao arquivar documento.');
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: unarchiveDocument,
    onSuccess: (data) => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['document', data.id] });
      toast.success(`Documento "${data.name}" reativado com sucesso!`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao reativar documento.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      invalidateAll();
      toast.success('Documento excluído com sucesso!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao excluir documento.');
    },
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
  };
};
