import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getSettings,
  updateSettings,
  updateCompanyName,
  updateCompanyLogo,
  changePassword,
  getTeamMembers,
  inviteTeamMember,
  removeTeamMember,
  updateMemberRole,
  exportAllData,
  getApiKeys,
  createApiKey,
  revokeApiKey,
  UpdatableSettings,
} from '../services/settingsService';
import { useAuthStore } from '../store/authStore';
import { UserRole } from '../types';

export const useSettings = () => {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['company-settings'],
    queryFn: getSettings,
  });

  const teamQuery = useQuery({
    queryKey: ['team-members'],
    queryFn: getTeamMembers,
  });

  const apiKeysQuery = useQuery({
    queryKey: ['api-keys'],
    queryFn: getApiKeys,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: UpdatableSettings) => updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-settings'] });
      toast.success('Configurações salvas com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao salvar as configurações.');
    },
  });

  const updateCompanyNameMutation = useMutation({
    mutationFn: (name: string) => updateCompanyName(name),
    onSuccess: (company) => {
      useAuthStore.setState({ company });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao atualizar o nome da empresa.');
    },
  });

  const uploadLogoMutation = useMutation({
    mutationFn: (file: File) => updateCompanyLogo(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-settings'] });
      toast.success('Logomarca atualizada com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao enviar a logomarca.');
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      changePassword(currentPassword, newPassword),
    onSuccess: () => {
      toast.success('Senha alterada com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao alterar a senha.');
    },
  });

  const inviteMemberMutation = useMutation({
    mutationFn: ({ email, role }: { email: string; role: UserRole }) => inviteTeamMember(email, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Convite enviado com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao enviar o convite.');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => removeTeamMember(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Membro removido da equipe.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao remover o membro.');
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) => updateMemberRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Função do membro atualizada.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao atualizar a função.');
    },
  });

  const exportDataMutation = useMutation({
    mutationFn: exportAllData,
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sobcontrole-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Exportação concluída! O download foi iniciado.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao exportar os dados.');
    },
  });

  const createApiKeyMutation = useMutation({
    mutationFn: (name: string) => createApiKey(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('Chave de API criada com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao criar a chave de API.');
    },
  });

  const revokeApiKeyMutation = useMutation({
    mutationFn: (keyId: string) => revokeApiKey(keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('Chave de API revogada.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao revogar a chave de API.');
    },
  });

  return {
    settings: settingsQuery.data,
    teamMembers: teamQuery.data || [],
    apiKeys: apiKeysQuery.data || [],
    isLoading: settingsQuery.isLoading,
    isTeamLoading: teamQuery.isLoading,
    isApiKeysLoading: apiKeysQuery.isLoading,

    updateSettings: updateSettingsMutation.mutateAsync,
    isSavingSettings: updateSettingsMutation.isPending,

    updateCompanyName: updateCompanyNameMutation.mutateAsync,
    isSavingCompanyName: updateCompanyNameMutation.isPending,

    uploadLogo: uploadLogoMutation.mutateAsync,
    isUploadingLogo: uploadLogoMutation.isPending,

    changePassword: changePasswordMutation.mutateAsync,
    isChangingPassword: changePasswordMutation.isPending,

    inviteMember: inviteMemberMutation.mutateAsync,
    isInviting: inviteMemberMutation.isPending,

    removeMember: removeMemberMutation.mutateAsync,
    isRemoving: removeMemberMutation.isPending,

    updateRole: updateRoleMutation.mutateAsync,
    isUpdatingRole: updateRoleMutation.isPending,

    exportData: exportDataMutation.mutateAsync,
    isExporting: exportDataMutation.isPending,

    createApiKey: createApiKeyMutation.mutateAsync,
    isCreatingApiKey: createApiKeyMutation.isPending,

    revokeApiKey: revokeApiKeyMutation.mutateAsync,
    isRevokingApiKey: revokeApiKeyMutation.isPending,
  };
};
