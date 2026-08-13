import React from 'react';
import {
  Settings2,
  Palette,
  Bell,
  Shield,
  Puzzle,
  Users,
  Sparkles,
  Database,
  Mail,
  LucideIcon,
} from 'lucide-react';

export type SettingsTabId =
  | 'general'
  | 'appearance'
  | 'notifications'
  | 'security'
  | 'integrations'
  | 'email-sending'
  | 'team'
  | 'subscription'
  | 'data';

interface TabDefinition {
  id: SettingsTabId;
  label: string;
  description: string;
  icon: LucideIcon;
}

const TABS: TabDefinition[] = [
  { id: 'general', label: 'Geral', description: 'Preferências da empresa', icon: Settings2 },
  { id: 'appearance', label: 'Aparência', description: 'Tema e identidade visual', icon: Palette },
  { id: 'notifications', label: 'Notificações', description: 'Alertas e avisos', icon: Bell },
  { id: 'security', label: 'Segurança', description: 'Senha e acessos', icon: Shield },
  { id: 'integrations', label: 'Integrações', description: 'Chaves de API', icon: Puzzle },
  { id: 'email-sending', label: 'Envio de e-mails', description: 'Remetentes e histórico', icon: Mail },
  { id: 'team', label: 'Equipe', description: 'Membros e permissões', icon: Users },
  { id: 'subscription', label: 'Assinatura', description: 'Plano e cobrança', icon: Sparkles },
  { id: 'data', label: 'Dados', description: 'Exportar e limpar', icon: Database },
];

interface SettingsSidebarProps {
  active: SettingsTabId;
  onSelect: (id: SettingsTabId) => void;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({ active, onSelect }) => {
  return (
    <nav className="bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 p-4 shadow-sm md:sticky md:top-6 h-fit">
      <ul className="space-y-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === active;
          return (
            <li key={tab.id}>
              <button
                type="button"
                onClick={() => onSelect(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors duration-200 ${
                  isActive
                    ? 'bg-[#10b981] text-white shadow-sm shadow-emerald-500/20'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                <span
                  className={`p-1.5 rounded-lg ${
                    isActive ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">{tab.label}</span>
                  <span className={`text-[11px] ${isActive ? 'text-white/70' : 'text-gray-400 dark:text-white/40'}`}>
                    {tab.description}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
