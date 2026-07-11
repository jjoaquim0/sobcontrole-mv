import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotificationsRealtime, useUnreadCount } from '../../hooks/useNotifications';
import { NotificationDropdown } from './NotificationDropdown';

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { data: unreadCount } = useUnreadCount();
  useNotificationsRealtime();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-xl text-gray-500 hover:text-[#00a8d8] dark:text-gray-400 dark:hover:text-[#00d2ff] hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200"
        title="Notificações"
      >
        <Bell className="w-5 h-5" />
        {!!unreadCount && unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <NotificationDropdown isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
};

export default NotificationBell;
