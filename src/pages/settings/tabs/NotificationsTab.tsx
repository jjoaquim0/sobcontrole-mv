import React, { useEffect, useState } from 'react';
import { Loader2, Bell, Mail, Smartphone, MessageCircle } from 'lucide-react';
import { useSettings } from '../../../hooks/useSettings';

interface ToggleRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  badge?: string;
  onChange: (value: boolean) => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ icon, title, description, checked, disabled, badge, onChange }) => (
  <div
    className={`flex items-center justify-between gap-4 p-4 rounded-2xl border border-gray-100 dark:border-white/5 bg-gray-50/60 dark:bg-white/[0.02] ${
      disabled ? 'opacity-70' : ''
    }`}
  >
    <div className="flex items-center gap-3">
      <span className="p-2 rounded-xl bg-white dark:bg-white/5 text-gray-500 dark:text-gray-300 border border-gray-100 dark:border-white/5">
        {icon}
      </span>
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
          {badge && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-white/50 mt-0.5">{description}</p>
      </div>
    </div>

    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-7 rounded-full transition-colors duration-200 shrink-0 ${
        checked ? 'bg-[#10b981]' : 'bg-gray-300 dark:bg-white/15'
      } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
);

export const NotificationsTab: React.FC = () => {
  const { settings, isLoading, updateSettings, isSavingSettings } = useSettings();

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);

  useEffect(() => {
    if (settings) {
      setEmailNotifications(settings.emailNotifications);
      setPushNotifications(settings.pushNotifications);
    }
  }, [settings]);

  const handleToggle = async (field: 'emailNotifications' | 'pushNotifications', value: boolean) => {
    if (field === 'emailNotifications') setEmailNotifications(value);
    if (field === 'pushNotifications') setPushNotifications(value);
    await updateSettings({ [field]: value }).catch(() => {
      if (field === 'emailNotifications') setEmailNotifications(!value);
      if (field === 'pushNotifications') setPushNotifications(!value);
    });
  };

  return (
    <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm p-6">
      <div className="flex items-center gap-3 border-b border-gray-100 dark:border-white/5 pb-4 mb-6">
        <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
          <Bell className="w-5 h-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Notificações</h2>
          <p className="text-sm text-gray-500 dark:text-white/50">Escolha como deseja ser avisado</p>
        </div>
        {isSavingSettings && <Loader2 className="w-4 h-4 animate-spin text-gray-400 ml-auto" />}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          <ToggleRow
            icon={<Mail className="w-5 h-5" />}
            title="Notificações por E-mail"
            description="Receba resumos e alertas importantes no seu e-mail."
            checked={emailNotifications}
            onChange={(value) => handleToggle('emailNotifications', value)}
          />
          <ToggleRow
            icon={<Smartphone className="w-5 h-5" />}
            title="Notificações Push"
            description="Alertas em tempo real diretamente no navegador."
            checked={pushNotifications}
            onChange={(value) => handleToggle('pushNotifications', value)}
          />
          <ToggleRow
            icon={<MessageCircle className="w-5 h-5" />}
            title="Notificações por WhatsApp"
            description="Avisos e lembretes enviados via WhatsApp."
            checked={false}
            disabled
            badge="Em breve"
            onChange={() => undefined}
          />
        </div>
      )}
    </div>
  );
};
