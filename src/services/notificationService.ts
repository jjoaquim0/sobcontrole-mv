import { supabase } from '../lib/supabase';
import {
  Notification,
  NotificationAction,
  NotificationActionType,
  NotificationCategory,
  NotificationChannel,
  NotificationDelivery,
  NotificationPreferences,
  NotificationPriority,
  NotificationStatus,
  PushSubscriptionRecord,
} from '../types';
import { useAuthStore } from '../store/authStore';
import { createAppointment } from './agendaService';
import { updateDeal } from './dealsService';

const requireCompanyId = (): string => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');
  return companyId;
};

const requireUserId = (): string => {
  const userId = useAuthStore.getState().profile?.id;
  if (!userId) throw new Error('Usuário não identificado.');
  return userId;
};

const mapDbNotification = (db: any): Notification => ({
  id: db.id,
  companyId: db.company_id,
  eventId: db.event_id || undefined,
  recipientUserId: db.recipient_user_id,
  category: db.category as NotificationCategory,
  eventType: db.event_type,
  priority: db.priority as NotificationPriority,
  title: db.title,
  message: db.message || '',
  aiSummary: db.ai_summary || undefined,
  aiPriorityReason: db.ai_priority_reason || undefined,
  aiSuggestedAction: db.ai_suggested_action || undefined,
  aiSuggestedDeadline: db.ai_suggested_deadline || undefined,
  aiSuggestedMessage: db.ai_suggested_message || undefined,
  relatedEntityType: db.related_entity_type || undefined,
  relatedEntityId: db.related_entity_id || undefined,
  channels: (db.channels || []) as NotificationChannel[],
  status: db.status as NotificationStatus,
  snoozedUntil: db.snoozed_until || undefined,
  actionTaken: db.action_taken || undefined,
  actionTakenAt: db.action_taken_at || undefined,
  readAt: db.read_at || undefined,
  resolvedAt: db.resolved_at || undefined,
  createdAt: db.created_at,
});

const mapDbDelivery = (db: any): NotificationDelivery => ({
  id: db.id,
  notificationId: db.notification_id,
  channel: db.channel as NotificationChannel,
  status: db.status,
  provider: db.provider || undefined,
  providerMessageId: db.provider_message_id || undefined,
  attemptCount: Number(db.attempt_count || 0),
  maxAttempts: Number(db.max_attempts || 0),
  lastError: db.last_error || undefined,
  nextRetryAt: db.next_retry_at || undefined,
  queuedAt: db.queued_at,
  sentAt: db.sent_at || undefined,
  deliveredAt: db.delivered_at || undefined,
  openedAt: db.opened_at || undefined,
  failedAt: db.failed_at || undefined,
  createdAt: db.created_at,
});

const mapDbPreferences = (db: any): NotificationPreferences => ({
  id: db.id,
  companyId: db.company_id,
  userId: db.user_id,
  pushEnabled: db.push_enabled,
  emailEnabled: db.email_enabled,
  smsEnabled: db.sms_enabled,
  categoriesEnabled: db.categories_enabled || [],
  minPriorityPush: db.min_priority_push,
  minPriorityEmail: db.min_priority_email,
  minPrioritySms: db.min_priority_sms,
  quietHoursStart: db.quiet_hours_start || undefined,
  quietHoursEnd: db.quiet_hours_end || undefined,
  digestFrequency: db.digest_frequency,
  phone: db.phone || '',
  notificationEmail: db.notification_email || '',
  consentPush: db.consent_push,
  consentPushAt: db.consent_push_at || undefined,
  consentEmail: db.consent_email,
  consentEmailAt: db.consent_email_at || undefined,
  consentSms: db.consent_sms,
  consentSmsAt: db.consent_sms_at || undefined,
  gestlyRecommendationsEnabled: db.gestly_recommendations_enabled,
  createdAt: db.created_at,
  updatedAt: db.updated_at,
});

export interface NotificationFilters {
  status?: NotificationStatus | 'all';
  priority?: NotificationPriority | 'all';
  category?: NotificationCategory | 'all';
  channel?: NotificationChannel | 'all';
  limit?: number;
}

export const getNotifications = async (filters?: NotificationFilters): Promise<Notification[]> => {
  const companyId = requireCompanyId();
  const userId = requireUserId();

  let query = supabase
    .from('notifications')
    .select('*')
    .eq('company_id', companyId)
    .eq('recipient_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(filters?.limit ?? 100);

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters?.priority && filters.priority !== 'all') {
    query = query.eq('priority', filters.priority);
  }
  if (filters?.category && filters.category !== 'all') {
    query = query.eq('category', filters.category);
  }

  const { data, error } = await query;
  if (error) throw error;

  let result = (data || []).map(mapDbNotification);

  if (filters?.channel && filters.channel !== 'all') {
    result = result.filter((n) => n.channels.includes(filters.channel as NotificationChannel));
  }

  return result;
};

export const getUnreadCount = async (): Promise<number> => {
  const companyId = requireCompanyId();
  const userId = requireUserId();

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('recipient_user_id', userId)
    .eq('status', 'unread');

  if (error) throw error;
  return count || 0;
};

export const markAsRead = async (id: string): Promise<Notification> => {
  const companyId = requireCompanyId();
  const userId = requireUserId();

  const { data, error } = await supabase
    .from('notifications')
    .update({ status: 'read', read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', companyId)
    .eq('recipient_user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return mapDbNotification(data);
};

export const markAllAsRead = async (): Promise<void> => {
  const companyId = requireCompanyId();
  const userId = requireUserId();

  const { error } = await supabase
    .from('notifications')
    .update({ status: 'read', read_at: new Date().toISOString() })
    .eq('company_id', companyId)
    .eq('recipient_user_id', userId)
    .eq('status', 'unread');

  if (error) throw error;
};

export const markAsResolved = async (id: string): Promise<Notification> => {
  const companyId = requireCompanyId();
  const userId = requireUserId();

  const { data, error } = await supabase
    .from('notifications')
    .update({ status: 'resolved', resolved_at: new Date().toISOString(), read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', companyId)
    .eq('recipient_user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return mapDbNotification(data);
};

export const archiveNotification = async (id: string): Promise<Notification> => {
  const companyId = requireCompanyId();
  const userId = requireUserId();

  const { data, error } = await supabase
    .from('notifications')
    .update({ status: 'archived', read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', companyId)
    .eq('recipient_user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return mapDbNotification(data);
};

export const snoozeNotification = async (id: string, until: string): Promise<Notification> => {
  const companyId = requireCompanyId();
  const userId = requireUserId();

  const { data, error } = await supabase
    .from('notifications')
    .update({ snoozed_until: until })
    .eq('id', id)
    .eq('company_id', companyId)
    .eq('recipient_user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return mapDbNotification(data);
};

export const getDeliveryHistory = async (notificationId: string): Promise<NotificationDelivery[]> => {
  const companyId = requireCompanyId();

  const { data, error } = await supabase
    .from('notification_deliveries')
    .select('*')
    .eq('notification_id', notificationId)
    .eq('company_id', companyId)
    .order('queued_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapDbDelivery);
};

const logAction = async (
  notificationId: string,
  actionType: NotificationActionType,
  payload: Record<string, unknown> = {}
): Promise<void> => {
  const companyId = requireCompanyId();
  const userId = requireUserId();

  const { error } = await supabase.from('notification_actions').insert({
    id: crypto.randomUUID(),
    company_id: companyId,
    notification_id: notificationId,
    action_type: actionType,
    performed_by: userId,
    payload,
  });

  if (error) throw error;

  await supabase
    .from('notifications')
    .update({ action_taken: actionType, action_taken_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('company_id', companyId)
    .eq('recipient_user_id', userId);
};

export interface ExecuteQuickActionInput {
  notification: Notification;
  actionType: NotificationActionType;
  payload?: Record<string, unknown>;
}

// Reaproveita serviços já existentes (agendaService/dealsService) em vez de
// duplicar lógica de criação de compromisso/atualização de negócio.
// send_message não dispara nenhum envio automático a clientes — apenas
// registra que o usuário confirmou/copiou o texto sugerido (ver Dev Notes da
// story: não existe integração de mensageria com o cliente final no projeto).
export const executeQuickAction = async ({ notification, actionType, payload }: ExecuteQuickActionInput): Promise<void> => {
  switch (actionType) {
    case 'create_task': {
      const userId = requireUserId();
      await createAppointment({
        title: `Tarefa: ${notification.title}`,
        customerId: notification.relatedEntityType === 'customer' ? notification.relatedEntityId : undefined,
        dealId: notification.relatedEntityType === 'deal' ? notification.relatedEntityId : undefined,
        assignedUserId: userId,
        type: 'tarefa',
        status: 'pendente',
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        allDay: false,
        notes: notification.aiSummary || '',
      });
      break;
    }
    case 'schedule_meeting': {
      const userId = requireUserId();
      const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
      start.setHours(9, 0, 0, 0);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      await createAppointment({
        title: `Reunião: ${notification.title}`,
        customerId: notification.relatedEntityType === 'customer' ? notification.relatedEntityId : undefined,
        dealId: notification.relatedEntityType === 'deal' ? notification.relatedEntityId : undefined,
        assignedUserId: userId,
        type: 'reuniao',
        status: 'agendado',
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        allDay: false,
      });
      break;
    }
    case 'reassign': {
      const newOwnerId = payload?.userId as string | undefined;
      if (!newOwnerId) throw new Error('Selecione um responsável.');
      if (notification.relatedEntityType === 'deal' && notification.relatedEntityId) {
        await updateDeal(notification.relatedEntityId, { ownerId: newOwnerId });
      }
      break;
    }
    case 'snooze': {
      const until = (payload?.until as string) || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await snoozeNotification(notification.id, until);
      break;
    }
    case 'resolve': {
      await markAsResolved(notification.id);
      break;
    }
    case 'dismiss': {
      await archiveNotification(notification.id);
      break;
    }
    case 'send_message':
    case 'open_customer':
    case 'open_deal':
      // Sem chamada de rede: "abrir" é navegação pura (resolvida no componente)
      // e "enviar mensagem" apenas copia o texto sugerido (também no componente).
      break;
  }

  await logAction(notification.id, actionType, payload || {});
};

export const getNotificationPreferences = async (): Promise<NotificationPreferences> => {
  const companyId = requireCompanyId();
  const userId = requireUserId();

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (data) return mapDbPreferences(data);

  const defaults = {
    id: crypto.randomUUID(),
    company_id: companyId,
    user_id: userId,
  };

  const { data: created, error: insertError } = await supabase
    .from('notification_preferences')
    .insert(defaults)
    .select()
    .single();

  if (insertError) throw insertError;
  return mapDbPreferences(created);
};

export type UpdatableNotificationPreferences = Partial<
  Pick<
    NotificationPreferences,
    | 'pushEnabled'
    | 'emailEnabled'
    | 'smsEnabled'
    | 'categoriesEnabled'
    | 'minPriorityPush'
    | 'minPriorityEmail'
    | 'minPrioritySms'
    | 'quietHoursStart'
    | 'quietHoursEnd'
    | 'digestFrequency'
    | 'phone'
    | 'notificationEmail'
    | 'consentPush'
    | 'consentEmail'
    | 'consentSms'
    | 'gestlyRecommendationsEnabled'
  >
>;

export const updateNotificationPreferences = async (
  data: UpdatableNotificationPreferences
): Promise<NotificationPreferences> => {
  const userId = requireUserId();
  await getNotificationPreferences();

  const dbPayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.pushEnabled !== undefined) dbPayload.push_enabled = data.pushEnabled;
  if (data.emailEnabled !== undefined) dbPayload.email_enabled = data.emailEnabled;
  if (data.smsEnabled !== undefined) dbPayload.sms_enabled = data.smsEnabled;
  if (data.categoriesEnabled !== undefined) dbPayload.categories_enabled = data.categoriesEnabled;
  if (data.minPriorityPush !== undefined) dbPayload.min_priority_push = data.minPriorityPush;
  if (data.minPriorityEmail !== undefined) dbPayload.min_priority_email = data.minPriorityEmail;
  if (data.minPrioritySms !== undefined) dbPayload.min_priority_sms = data.minPrioritySms;
  if (data.quietHoursStart !== undefined) dbPayload.quiet_hours_start = data.quietHoursStart || null;
  if (data.quietHoursEnd !== undefined) dbPayload.quiet_hours_end = data.quietHoursEnd || null;
  if (data.digestFrequency !== undefined) dbPayload.digest_frequency = data.digestFrequency;
  if (data.phone !== undefined) dbPayload.phone = data.phone;
  if (data.notificationEmail !== undefined) dbPayload.notification_email = data.notificationEmail;
  if (data.consentPush !== undefined) {
    dbPayload.consent_push = data.consentPush;
    dbPayload.consent_push_at = data.consentPush ? new Date().toISOString() : null;
  }
  if (data.consentEmail !== undefined) {
    dbPayload.consent_email = data.consentEmail;
    dbPayload.consent_email_at = data.consentEmail ? new Date().toISOString() : null;
  }
  if (data.consentSms !== undefined) {
    dbPayload.consent_sms = data.consentSms;
    dbPayload.consent_sms_at = data.consentSms ? new Date().toISOString() : null;
  }
  if (data.gestlyRecommendationsEnabled !== undefined) {
    dbPayload.gestly_recommendations_enabled = data.gestlyRecommendationsEnabled;
  }

  const { data: updated, error } = await supabase
    .from('notification_preferences')
    .update(dbPayload)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return mapDbPreferences(updated);
};

export const registerPushSubscription = async (subscription: PushSubscription): Promise<void> => {
  const companyId = requireCompanyId();
  const userId = requireUserId();
  const json = subscription.toJSON();

  const { error } = await supabase.from('notification_push_subscriptions').upsert(
    {
      id: crypto.randomUUID(),
      company_id: companyId,
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh || '',
      auth_key: json.keys?.auth || '',
      user_agent: navigator.userAgent,
    },
    { onConflict: 'endpoint' }
  );

  if (error) throw error;
  await updateNotificationPreferences({ consentPush: true, pushEnabled: true });
};

export const unregisterPushSubscription = async (endpoint: string): Promise<void> => {
  const userId = requireUserId();

  const { error } = await supabase
    .from('notification_push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('user_id', userId);

  if (error) throw error;
};

export const getMyPushSubscriptions = async (): Promise<PushSubscriptionRecord[]> => {
  const userId = requireUserId();

  const { data, error } = await supabase
    .from('notification_push_subscriptions')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;

  return (data || []).map((db: any) => ({
    id: db.id,
    userId: db.user_id,
    endpoint: db.endpoint,
    p256dh: db.p256dh,
    authKey: db.auth_key,
    userAgent: db.user_agent || undefined,
    createdAt: db.created_at,
  }));
};

export const getNotificationActions = async (notificationId: string): Promise<NotificationAction[]> => {
  const companyId = requireCompanyId();

  const { data, error } = await supabase
    .from('notification_actions')
    .select('*')
    .eq('notification_id', notificationId)
    .eq('company_id', companyId)
    .order('performed_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((db: any) => ({
    id: db.id,
    notificationId: db.notification_id,
    actionType: db.action_type,
    performedBy: db.performed_by || undefined,
    payload: db.payload || {},
    performedAt: db.performed_at,
  }));
};
