import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createEmailDomain,
  disconnectEmailSender,
  getEmailSenderState,
  saveDomainSender,
  savePlatformSender,
  sendTestEmail,
  startEmailOAuth,
  verifyEmailDomain,
} from '../services/emailSenderService';

const QUERY_KEY = ['email-sender'];

export const useEmailSender = () => {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: getEmailSenderState });
  const refresh = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  const mutationOptions = (message: string) => ({
    onSuccess: () => { refresh(); toast.success(message); },
    onError: (error: Error) => toast.error(error.message),
  });

  const platform = useMutation({ mutationFn: savePlatformSender, ...mutationOptions('Remetente padrão ativado.') });
  const domainSender = useMutation({ mutationFn: saveDomainSender, ...mutationOptions('Remetente corporativo ativado.') });
  const createDomain = useMutation({ mutationFn: createEmailDomain, ...mutationOptions('Domínio adicionado. Configure os registros DNS.') });
  const verifyDomain = useMutation({ mutationFn: verifyEmailDomain, ...mutationOptions('Verificação de domínio atualizada.') });
  const disconnect = useMutation({ mutationFn: disconnectEmailSender, ...mutationOptions('Conexão removida com segurança.') });
  const test = useMutation({
    mutationFn: ({ recipient, idempotencyKey }: { recipient: string; idempotencyKey: string }) => sendTestEmail(recipient, idempotencyKey),
    onSuccess: (result) => {
      refresh();
      if (result.status === 'sent' || result.status === 'delivered') toast.success('E-mail de teste enviado.');
      else if (result.status === 'queued' || result.status === 'sending') toast.info('Este teste já está em processamento.');
      else toast.error('O teste anterior falhou. Aguarde ou altere o destinatário antes de tentar novamente.');
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const oauth = useMutation({
    mutationFn: startEmailOAuth,
    onSuccess: (url) => window.location.assign(url),
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    state: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    savePlatform: platform.mutateAsync,
    saveDomainSender: domainSender.mutateAsync,
    createDomain: createDomain.mutateAsync,
    verifyDomain: verifyDomain.mutateAsync,
    disconnect: disconnect.mutateAsync,
    sendTest: test.mutateAsync,
    startOAuth: oauth.mutateAsync,
    isSaving: platform.isPending || domainSender.isPending || createDomain.isPending || verifyDomain.isPending || disconnect.isPending || oauth.isPending,
    isTesting: test.isPending,
  };
};
