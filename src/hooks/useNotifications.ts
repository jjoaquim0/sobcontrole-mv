import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  markAsResolved,
  archiveNotification,
  snoozeNotification,
  executeQuickAction,
  getNotificationPreferences,
  updateNotificationPreferences,
  getDeliveryHistory,
  getNotificationActions,
  NotificationFilters,
  ExecuteQuickActionInput,
  UpdatableNotificationPreferences,
} from '../services/notificationService';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

const NOTIFICATIONS_KEY = 'notifications';
const UNREAD_COUNT_KEY = 'notifications-unread-count';

export const useNotifications = (filters?: NotificationFilters) => {
  return useQuery({
    queryKey: [NOTIFICATIONS_KEY, filters],
    queryFn: () => getNotifications(filters),
  });
};

export const useUnreadCount = () => {
  return useQuery({
    queryKey: [UNREAD_COUNT_KEY],
    queryFn: getUnreadCount,
    refetchInterval: 60_000,
  });
};

// Assinatura Realtime única (mantida pelo NotificationBell, sempre montado no
// AppLayout) — invalida as queries e mostra um toast quando uma nova
// notificação chega para o usuário logado, sem exigir polling manual.
export const useNotificationsRealtime = () => {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.profile?.id);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_user_id=eq.${userId}` },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
          queryClient.invalidateQueries({ queryKey: [UNREAD_COUNT_KEY] });
          const title = (payload.new as { title?: string }).title;
          if (title) toast.info(title, { description: 'Nova notificação recebida' });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `recipient_user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
          queryClient.invalidateQueries({ queryKey: [UNREAD_COUNT_KEY] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
};

export const useNotificationMutations = () => {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
    queryClient.invalidateQueries({ queryKey: [UNREAD_COUNT_KEY] });
  };

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => markAsRead(id),
    onSuccess: invalidateAll,
    onError: (err: Error) => toast.error(err.message || 'Erro ao marcar como lida.'),
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      invalidateAll();
      toast.success('Todas as notificações foram marcadas como lidas.');
    },
    onError: (err: Error) => toast.error(err.message || 'Erro ao marcar notificações como lidas.'),
  });

  const markAsResolvedMutation = useMutation({
    mutationFn: (id: string) => markAsResolved(id),
    onSuccess: () => {
      invalidateAll();
      toast.success('Notificação marcada como resolvida.');
    },
    onError: (err: Error) => toast.error(err.message || 'Erro ao resolver notificação.'),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveNotification(id),
    onSuccess: invalidateAll,
    onError: (err: Error) => toast.error(err.message || 'Erro ao arquivar notificação.'),
  });

  const snoozeMutation = useMutation({
    mutationFn: ({ id, until }: { id: string; until: string }) => snoozeNotification(id, until),
    onSuccess: () => {
      invalidateAll();
      toast.success('Lembrete adiado.');
    },
    onError: (err: Error) => toast.error(err.message || 'Erro ao adiar lembrete.'),
  });

  const executeActionMutation = useMutation({
    mutationFn: (input: ExecuteQuickActionInput) => executeQuickAction(input),
    onSuccess: () => {
      invalidateAll();
      toast.success('Ação executada com sucesso.');
    },
    onError: (err: Error) => toast.error(err.message || 'Erro ao executar ação.'),
  });

  return {
    markAsRead: markAsReadMutation.mutateAsync,
    markAllAsRead: markAllAsReadMutation.mutateAsync,
    markAsResolved: markAsResolvedMutation.mutateAsync,
    archive: archiveMutation.mutateAsync,
    snooze: (id: string, until: string) => snoozeMutation.mutateAsync({ id, until }),
    executeQuickAction: executeActionMutation.mutateAsync,
    isExecutingAction: executeActionMutation.isPending,
  };
};

export const useNotificationPreferences = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: getNotificationPreferences,
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdatableNotificationPreferences) => updateNotificationPreferences(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      toast.success('Preferências de notificação salvas.');
    },
    onError: (err: Error) => toast.error(err.message || 'Erro ao salvar preferências.'),
  });

  return {
    preferences: query.data,
    isLoading: query.isLoading,
    update: updateMutation.mutateAsync,
    isSaving: updateMutation.isPending,
  };
};

export const useDeliveryHistory = (notificationId: string | undefined) => {
  return useQuery({
    queryKey: ['notification-deliveries', notificationId],
    queryFn: () => getDeliveryHistory(notificationId as string),
    enabled: !!notificationId,
  });
};

export const useNotificationActions = (notificationId: string | undefined) => {
  return useQuery({
    queryKey: ['notification-actions', notificationId],
    queryFn: () => getNotificationActions(notificationId as string),
    enabled: !!notificationId,
  });
};
