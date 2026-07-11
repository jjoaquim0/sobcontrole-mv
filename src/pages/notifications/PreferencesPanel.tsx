import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2, Mail, MessageSquare, Sparkles, Smartphone } from 'lucide-react';
import { useNotificationPreferences } from '../../hooks/useNotifications';
import { useWebPush } from '../../hooks/useWebPush';
import { NotificationCategory, NotificationPriority, DigestFrequency } from '../../types';
import { CATEGORY_LABELS, PRIORITY_LABELS } from './utils';

interface ToggleRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ icon, title, description, checked, disabled, onChange }) => (
  <div
    className={`flex items-center justify-between gap-4 p-4 rounded-2xl border border-gray-100 dark:border-white/5 bg-gray-50/60 dark:bg-white/[0.02] ${
      disabled ? 'opacity-60' : ''
    }`}
  >
    <div className="flex items-center gap-3">
      <span className="p-2 rounded-xl bg-white dark:bg-white/5 text-gray-500 dark:text-gray-300 border border-gray-100 dark:border-white/5">
        {icon}
      </span>
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
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

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as NotificationCategory[];
const ALL_PRIORITIES = Object.keys(PRIORITY_LABELS) as NotificationPriority[];

export const PreferencesPanel: React.FC = () => {
  const { preferences, isLoading, update, isSaving } = useNotificationPreferences();
  const webPush = useWebPush();

  const [categories, setCategories] = useState<NotificationCategory[]>(ALL_CATEGORIES);
  const [minPriorityPush, setMinPriorityPush] = useState<NotificationPriority>('baixa');
  const [minPriorityEmail, setMinPriorityEmail] = useState<NotificationPriority>('media');
  const [minPrioritySms, setMinPrioritySms] = useState<NotificationPriority>('critica');
  const [quietStart, setQuietStart] = useState('');
  const [quietEnd, setQuietEnd] = useState('');
  const [digestFrequency, setDigestFrequency] = useState<DigestFrequency>('immediate');
  const [phone, setPhone] = useState('');
  const [notificationEmail, setNotificationEmail] = useState('');

  useEffect(() => {
    if (!preferences) return;
    setCategories(preferences.categoriesEnabled);
    setMinPriorityPush(preferences.minPriorityPush);
    setMinPriorityEmail(preferences.minPriorityEmail);
    setMinPrioritySms(preferences.minPrioritySms);
    setQuietStart(preferences.quietHoursStart?.slice(0, 5) || '');
    setQuietEnd(preferences.quietHoursEnd?.slice(0, 5) || '');
    setDigestFrequency(preferences.digestFrequency);
    setPhone(preferences.phone || '');
    setNotificationEmail(preferences.notificationEmail || '');
  }, [preferences]);

  if (isLoading || !preferences) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const toggleCategory = async (cat: NotificationCategory) => {
    const next = categories.includes(cat) ? categories.filter((c) => c !== cat) : [...categories, cat];
    setCategories(next);
    await update({ categoriesEnabled: next });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-6 space-y-3">
        <div className="flex items-center gap-3 pb-2">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Canais e consentimento</h2>
          {isSaving && <Loader2 className="w-4 h-4 animate-spin text-gray-400 ml-auto" />}
        </div>

        <ToggleRow
          icon={webPush.isSubscribed ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          title="Notificações Push"
          description={
            webPush.supported
              ? 'Alertas em tempo real diretamente no navegador. Requer sua autorização.'
              : 'Este navegador não suporta notificações push.'
          }
          checked={webPush.isSubscribed}
          disabled={!webPush.supported || webPush.isLoading}
          onChange={(value) => (value ? webPush.subscribe() : webPush.unsubscribe())}
        />

        <ToggleRow
          icon={<Mail className="w-4 h-4" />}
          title="Notificações por E-mail"
          description="Receba alertas e resumos no seu e-mail."
          checked={preferences.emailEnabled}
          onChange={(value) => update({ emailEnabled: value, consentEmail: value })}
        />

        <ToggleRow
          icon={<MessageSquare className="w-4 h-4" />}
          title="Notificações por SMS"
          description="Apenas para alertas de alta prioridade. Requer telefone cadastrado e autorização da empresa."
          checked={preferences.smsEnabled}
          onChange={(value) => update({ smsEnabled: value, consentSms: value })}
        />

        <ToggleRow
          icon={<Sparkles className="w-4 h-4" />}
          title="Recomendações da Gestly"
          description="Resumo, prioridade e próxima ação sugerida em cada notificação."
          checked={preferences.gestlyRecommendationsEnabled}
          onChange={(value) => update({ gestlyRecommendationsEnabled: value })}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <label className="text-sm">
            <span className="block text-gray-600 dark:text-white/60 mb-1">Telefone para SMS</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => update({ phone })}
              placeholder="(11) 91234-5678"
              className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-gray-900 dark:text-white"
            />
          </label>
          <label className="text-sm">
            <span className="block text-gray-600 dark:text-white/60 mb-1">E-mail de destino (opcional)</span>
            <input
              type="email"
              value={notificationEmail}
              onChange={(e) => setNotificationEmail(e.target.value)}
              onBlur={() => update({ notificationEmail })}
              placeholder="Deixe em branco para usar o e-mail da conta"
              className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-gray-900 dark:text-white"
            />
          </label>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-6 space-y-4">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">Categorias desejadas</h2>
        <div className="flex flex-wrap gap-2">
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => toggleCategory(cat)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                categories.includes(cat)
                  ? 'bg-brand/10 border-brand/30 text-brand'
                  : 'border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/50'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-6 space-y-4">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">Prioridade mínima por canal</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="text-sm">
            <span className="flex items-center gap-1.5 text-gray-600 dark:text-white/60 mb-1">
              <Smartphone className="w-3.5 h-3.5" /> Push
            </span>
            <select
              value={minPriorityPush}
              onChange={async (e) => {
                const value = e.target.value as NotificationPriority;
                setMinPriorityPush(value);
                await update({ minPriorityPush: value });
              }}
              className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-gray-900 dark:text-white"
            >
              {ALL_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="flex items-center gap-1.5 text-gray-600 dark:text-white/60 mb-1">
              <Mail className="w-3.5 h-3.5" /> E-mail
            </span>
            <select
              value={minPriorityEmail}
              onChange={async (e) => {
                const value = e.target.value as NotificationPriority;
                setMinPriorityEmail(value);
                await update({ minPriorityEmail: value });
              }}
              className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-gray-900 dark:text-white"
            >
              {ALL_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="flex items-center gap-1.5 text-gray-600 dark:text-white/60 mb-1">
              <MessageSquare className="w-3.5 h-3.5" /> SMS
            </span>
            <select
              value={minPrioritySms}
              onChange={async (e) => {
                const value = e.target.value as NotificationPriority;
                setMinPrioritySms(value);
                await update({ minPrioritySms: value });
              }}
              className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-gray-900 dark:text-white"
            >
              {ALL_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-6 space-y-4">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">Horário de silêncio e resumo</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="text-sm">
            <span className="block text-gray-600 dark:text-white/60 mb-1">Silêncio a partir de</span>
            <input
              type="time"
              value={quietStart}
              onChange={(e) => setQuietStart(e.target.value)}
              onBlur={() => update({ quietHoursStart: quietStart || undefined, quietHoursEnd: quietEnd || undefined })}
              className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-gray-900 dark:text-white"
            />
          </label>
          <label className="text-sm">
            <span className="block text-gray-600 dark:text-white/60 mb-1">Silêncio até</span>
            <input
              type="time"
              value={quietEnd}
              onChange={(e) => setQuietEnd(e.target.value)}
              onBlur={() => update({ quietHoursStart: quietStart || undefined, quietHoursEnd: quietEnd || undefined })}
              className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-gray-900 dark:text-white"
            />
          </label>
          <label className="text-sm">
            <span className="block text-gray-600 dark:text-white/60 mb-1">Frequência do resumo por e-mail</span>
            <select
              value={digestFrequency}
              onChange={async (e) => {
                const value = e.target.value as DigestFrequency;
                setDigestFrequency(value);
                await update({ digestFrequency: value });
              }}
              className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-gray-900 dark:text-white"
            >
              <option value="immediate">Imediato</option>
              <option value="daily">Resumo diário</option>
              <option value="weekly">Resumo semanal</option>
              <option value="none">Nenhum</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
};

export default PreferencesPanel;
