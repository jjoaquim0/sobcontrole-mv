import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useThemeStore } from '../../store/themeStore';
import { Sun, Moon, Bell, LogOut, User as UserIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Header: React.FC = () => {
  const { profile, company, subscription, signOut } = useAuth();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'manager':
        return 'Gerente';
      case 'employee':
        return 'Colaborador';
      default:
        return 'Usuário';
    }
  };

  return (
    <header className="bg-white dark:bg-[#1a1d27] border-b border-gray-100 dark:border-white/5 h-16 px-6 flex items-center justify-between shadow-sm shrink-0 transition-colors duration-300">
      {/* Left: Company details */}
      <div className="flex items-center gap-3">
        {company ? (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              {company.name}
            </span>
            {subscription && (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-[#10b981] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                {subscription.plan}
              </span>
            )}
          </div>
        ) : (
          <span className="text-sm text-gray-400">Carregando empresa...</span>
        )}
      </div>

      {/* Right: Actions and User details */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button
          type="button"
          className="p-2 rounded-xl text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all duration-200"
          title="Notificações"
        >
          <Bell className="w-5 h-5" />
        </button>

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-xl text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all duration-200"
          title={theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}
        >
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>

        {/* Separator */}
        <div className="h-6 w-px bg-gray-100 dark:bg-white/10" />

        {/* User profile */}
        {profile && (
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-[#10b981] text-white flex items-center justify-center text-sm font-semibold tracking-wider shadow-sm">
              {profile.name ? getInitials(profile.name) : <UserIcon className="w-4 h-4" />}
            </div>

            {/* Profile Info */}
            <div className="hidden md:flex flex-col text-left">
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {profile.name}
              </span>
              <span className="text-[11px] text-themeText-secondaryLight dark:text-themeText-secondaryDark">
                {getRoleLabel(profile.role)}
              </span>
            </div>

            {/* Sign Out Button */}
            <button
              type="button"
              onClick={handleSignOut}
              className="p-2 rounded-xl text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all duration-200 ml-1"
              title="Sair do sistema"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
