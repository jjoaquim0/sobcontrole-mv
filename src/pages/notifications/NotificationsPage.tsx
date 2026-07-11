import React, { useState } from 'react';
import { Bell, Loader2, Settings2 } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { useNotifications, useNotificationMutations } from '../../hooks/useNotifications';
import { NotificationCategory, NotificationChannel, NotificationPriority, NotificationStatus } from '../../types';
import { NotificationItem } from './components/NotificationItem';
import { PreferencesPanel } from './PreferencesPanel';
import { CATEGORY_LABELS, CHANNEL_LABELS, PRIORITY_LABELS } from './utils';

type PanelTab = 'central' | 'preferences';

export const NotificationsPage: React.FC = () => {
  const [tab, setTab] = useState<PanelTab>('central');
  const [status, setStatus] = useState<NotificationStatus | 'all'>('all');
  const [priority, setPriority] = useState<NotificationPriority | 'all'>('all');
  const [category, setCategory] = useState<NotificationCategory | 'all'>('all');
  const [channel, setChannel] = useState<NotificationChannel | 'all'>('all');

  const { data: notifications, isLoading } = useNotifications({ status, priority, category, channel });
  const { markAllAsRead } = useNotificationMutations();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notificações"
        subtitle="Central de notificações inteligentes e preferências"
        action={
          tab === 'central' ? (
            <button
              type="button"
              onClick={() => markAllAsRead()}
              className="text-sm font-medium text-gray-600 dark:text-white/60 hover:text-[#00a8d8] px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              Marcar todas como lidas
            </button>
          ) : undefined
        }
      />

      <div className="flex items-center gap-2 border-b border-gray-100 dark:border-white/5">
        <button
          type="button"
          onClick={() => setTab('central')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'central'
              ? 'border-brand text-gray-900 dark:text-white'
              : 'border-transparent text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80'
          }`}
        >
          <Bell className="w-4 h-4" /> Central
        </button>
        <button
          type="button"
          onClick={() => setTab('preferences')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'preferences'
              ? 'border-brand text-gray-900 dark:text-white'
              : 'border-transparent text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80'
          }`}
        >
          <Settings2 className="w-4 h-4" /> Preferências
        </button>
      </div>

      {tab === 'central' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as NotificationStatus | 'all')}
              className="text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1d27] px-3 py-2 text-gray-700 dark:text-white"
            >
              <option value="all">Todos os status</option>
              <option value="unread">Não lidas</option>
              <option value="read">Lidas</option>
              <option value="resolved">Resolvidas</option>
              <option value="archived">Arquivadas</option>
            </select>

            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as NotificationPriority | 'all')}
              className="text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1d27] px-3 py-2 text-gray-700 dark:text-white"
            >
              <option value="all">Todas as prioridades</option>
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as NotificationCategory | 'all')}
              className="text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1d27] px-3 py-2 text-gray-700 dark:text-white"
            >
              <option value="all">Todas as categorias</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as NotificationChannel | 'all')}
              className="text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1d27] px-3 py-2 text-gray-700 dark:text-white"
            >
              <option value="all">Todos os canais</option>
              {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : !notifications || notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl">
              <Bell className="w-10 h-10 text-gray-300 dark:text-white/15 mb-3" />
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">Nenhuma notificação encontrada</h4>
              <p className="text-xs text-gray-500 dark:text-white/50 mt-1">Ajuste os filtros ou aguarde novos alertas.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <PreferencesPanel />
      )}
    </div>
  );
};

export default NotificationsPage;
