import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Loader2 } from 'lucide-react';
import { useNotifications, useNotificationMutations, useUnreadCount } from '../../hooks/useNotifications';
import { NotificationItem } from '../../pages/notifications/components/NotificationItem';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { data: notifications, isLoading } = useNotifications({ limit: 8 });
  const { data: unreadCount } = useUnreadCount();
  const { markAllAsRead } = useNotificationMutations();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 z-50 w-[380px] max-w-[90vw] bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Notificações</h3>
              {!!unreadCount && unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllAsRead()}
                  className="text-xs font-medium text-[#00a8d8] hover:underline"
                >
                  Marcar todas como lidas
                </button>
              )}
            </div>

            <div className="max-h-[420px] overflow-y-auto p-3 space-y-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-10 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : !notifications || notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-10">
                  <Bell className="w-8 h-8 text-gray-300 dark:text-white/15 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-white/50">Nenhuma notificação por aqui.</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <NotificationItem key={notification.id} notification={notification} compact onNavigate={onClose} />
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                navigate('/notifications');
              }}
              className="w-full text-center text-xs font-semibold text-[#00a8d8] hover:bg-black/5 dark:hover:bg-white/5 py-3 border-t border-gray-100 dark:border-white/5 transition-colors"
            >
              Ver todas as notificações
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default NotificationDropdown;
