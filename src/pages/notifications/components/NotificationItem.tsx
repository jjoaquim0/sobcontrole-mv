import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Archive,
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  ListPlus,
  Loader2,
  UserCog,
} from 'lucide-react';
import { Notification, NotificationActionType } from '../../../types';
import { useNotificationMutations } from '../../../hooks/useNotifications';
import { useSettings } from '../../../hooks/useSettings';
import { ACTION_LABELS, CATEGORY_LABELS, PRIORITY_CLASSES, PRIORITY_LABELS, formatDateTime, resolveEntityLink } from '../utils';

export interface NotificationItemProps {
  notification: Notification;
  compact?: boolean;
  onNavigate?: () => void;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({ notification, compact = false, onNavigate }) => {
  const navigate = useNavigate();
  const { markAsRead, markAsResolved, archive, snooze, executeQuickAction, isExecutingAction } = useNotificationMutations();
  const { teamMembers } = useSettings();
  const [showReassign, setShowReassign] = useState(false);

  const isUnread = notification.status === 'unread';
  const entityLink = resolveEntityLink(notification.relatedEntityType, notification.relatedEntityId);

  const handleOpen = async () => {
    if (isUnread) await markAsRead(notification.id).catch(() => undefined);
    if (entityLink) navigate(entityLink);
    onNavigate?.();
  };

  const handleCopyMessage = async () => {
    if (!notification.aiSuggestedMessage) return;
    await navigator.clipboard.writeText(notification.aiSuggestedMessage);
    toast.success('Texto sugerido copiado para a área de transferência.');
    await executeQuickAction({ notification, actionType: 'send_message' });
  };

  const handleQuickAction = async (actionType: NotificationActionType) => {
    if (actionType === 'send_message') return handleCopyMessage();
    if (actionType === 'resolve') return markAsResolved(notification.id);
    if (actionType === 'dismiss') return archive(notification.id);
    if (actionType === 'snooze') {
      const until = new Date();
      until.setDate(until.getDate() + 1);
      until.setHours(9, 0, 0, 0);
      return snooze(notification.id, until.toISOString());
    }
    if (actionType === 'reassign') {
      setShowReassign(true);
      return;
    }
    await executeQuickAction({ notification, actionType });
  };

  return (
    <div
      className={`p-4 rounded-2xl border transition-colors ${
        isUnread
          ? 'bg-emerald-50/40 border-emerald-100 dark:bg-emerald-500/[0.04] dark:border-emerald-500/10'
          : 'bg-white dark:bg-[#1a1d27] border-gray-100 dark:border-white/5'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${PRIORITY_CLASSES[notification.priority]}`}>
              {PRIORITY_LABELS[notification.priority]}
            </span>
            <span className="text-[11px] text-gray-400 dark:text-white/40">{CATEGORY_LABELS[notification.category]}</span>
          </div>
          <button type="button" onClick={handleOpen} className="text-left w-full mt-1.5 group">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-[#00a8d8] transition-colors">
              {notification.title}
            </h4>
            <p className="text-xs text-gray-500 dark:text-white/50 mt-0.5 line-clamp-2">{notification.message}</p>
          </button>

          {!compact && notification.aiSummary && (
            <div className="mt-2 flex items-start gap-2 rounded-xl bg-gray-50 dark:bg-white/[0.03] p-2.5">
              <Bot className="w-3.5 h-3.5 text-[#00a8d8] shrink-0 mt-0.5" />
              <p className="text-xs text-gray-600 dark:text-white/60">{notification.aiSummary}</p>
            </div>
          )}

          <p className="text-[11px] text-gray-400 dark:text-white/30 mt-2">{formatDateTime(notification.createdAt)}</p>
        </div>

        {entityLink && (
          <button
            type="button"
            onClick={handleOpen}
            title="Abrir"
            className="p-1.5 rounded-lg text-gray-400 hover:text-[#00a8d8] hover:bg-black/5 dark:hover:bg-white/5 shrink-0"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        )}
      </div>

      {!compact && (
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-white/5">
          {notification.aiSuggestedAction && notification.status !== 'resolved' && notification.status !== 'archived' && (
            <button
              type="button"
              disabled={isExecutingAction}
              onClick={() => handleQuickAction(notification.aiSuggestedAction as NotificationActionType)}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-brand/10 text-brand hover:bg-brand/20 transition-colors disabled:opacity-50"
            >
              {isExecutingAction ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
              {ACTION_LABELS[notification.aiSuggestedAction]}
            </button>
          )}

          {notification.aiSuggestedMessage && (
            <button
              type="button"
              onClick={handleCopyMessage}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-gray-600 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" /> Copiar texto sugerido
            </button>
          )}

          {notification.relatedEntityType === 'deal' && (
            <button
              type="button"
              onClick={() => handleQuickAction('reassign')}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-gray-600 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <UserCog className="w-3.5 h-3.5" /> Alterar responsável
            </button>
          )}

          <button
            type="button"
            onClick={() => handleQuickAction('create_task')}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-gray-600 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <ListPlus className="w-3.5 h-3.5" /> Criar tarefa
          </button>

          <button
            type="button"
            onClick={() => handleQuickAction('schedule_meeting')}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-gray-600 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <Calendar className="w-3.5 h-3.5" /> Agendar reunião
          </button>

          {notification.status !== 'resolved' && (
            <button
              type="button"
              onClick={() => handleQuickAction('snooze')}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-gray-600 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <Clock className="w-3.5 h-3.5" /> Adiar
            </button>
          )}

          {notification.status !== 'resolved' && (
            <button
              type="button"
              onClick={() => handleQuickAction('resolve')}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Resolver
            </button>
          )}

          {notification.status !== 'archived' && (
            <button
              type="button"
              onClick={() => handleQuickAction('dismiss')}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-gray-500 dark:text-white/40 hover:bg-black/5 dark:hover:bg-white/5 transition-colors ml-auto"
            >
              <Archive className="w-3.5 h-3.5" /> Arquivar
            </button>
          )}
        </div>
      )}

      {showReassign && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5 flex items-center gap-2">
          <select
            className="flex-1 text-xs rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1.5 text-gray-700 dark:text-white"
            defaultValue=""
            onChange={async (e) => {
              if (!e.target.value) return;
              await executeQuickAction({ notification, actionType: 'reassign', payload: { userId: e.target.value } });
              setShowReassign(false);
            }}
          >
            <option value="" disabled>
              Selecione um responsável
            </option>
            {teamMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowReassign(false)}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-white/70"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationItem;
