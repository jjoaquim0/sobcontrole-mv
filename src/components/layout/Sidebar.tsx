import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useAnalyticsModules } from '../../hooks/useAnalyticsModules';
import { UserRole } from '../../types';
import { REPORT_NAVIGATION_ITEMS, ReportsMenuIcon, type ReportNavigationItem } from '../../pages/reports/reportNavigation';
import { LogoMark } from '../shared/brand';
import {
  LayoutDashboard,
  ShoppingBag,
  Users,
  Package,
  Truck,
  ShoppingCart,
  KanbanSquare,
  CalendarDays,
  Bell,
  CreditCard,
  FileText,
  Building2,
  Settings,
  Shield,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock3,
  Lock,
  Sparkles
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

interface MenuItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
  children?: readonly ReportNavigationItem[];
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const { subscription, hasRole } = useAuth();
  const location = useLocation();
  const canViewReports = hasRole(['admin', 'manager']);
  const { modules: analyticsModules, isLoading: isLoadingAnalyticsModules } = useAnalyticsModules(canViewReports);
  const isReportsRoute = location.pathname.startsWith('/relatorios') || location.pathname.startsWith('/reports');
  const [isReportsOpen, setIsReportsOpen] = useState(isReportsRoute);

  useEffect(() => {
    if (isReportsRoute) setIsReportsOpen(true);
  }, [isReportsRoute]);

  const menuSections: MenuSection[] = [
    {
      title: 'Principal',
      items: [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      title: 'Operacional',
      items: [
        { name: 'Vendas', path: '/sales', icon: ShoppingBag },
        { name: 'Pipeline', path: '/pipeline', icon: KanbanSquare },
        { name: 'Agenda', path: '/agenda', icon: CalendarDays },
        { name: 'Notificações', path: '/notifications', icon: Bell },
        { name: 'Clientes', path: '/customers', icon: Users },
        { name: 'Estoque', path: '/inventory', icon: Package },
        { name: 'Fornecedores', path: '/suppliers', icon: Truck },
        { name: 'Compras', path: '/purchases', icon: ShoppingCart, roles: ['admin', 'manager'] },
      ],
    },
    {
      title: 'Gestão',
      items: [
        { name: 'Financeiro', path: '/financial', icon: CreditCard, roles: ['admin', 'manager'] },
        { name: 'Relatórios', path: '/relatorios', icon: ReportsMenuIcon, roles: ['admin', 'manager'], children: REPORT_NAVIGATION_ITEMS },
        { name: 'Documentos', path: '/documents', icon: FileText },
      ],
    },
    {
      title: 'Configuração',
      items: [
        { name: 'Minha Empresa', path: '/company', icon: Building2, roles: ['admin', 'manager'] },
        { name: 'Configurações', path: '/settings', icon: Settings, roles: ['admin', 'manager'] },
        { name: 'Painel Admin', path: '/admin', icon: Shield, roles: ['admin'] },
      ],
    },
  ];

  const usagePercent = subscription
    ? Math.min(100, Math.round((subscription.usageCurrent / subscription.usageLimit) * 100))
    : 0;

  return (
    <aside
      className={`relative h-screen flex flex-col justify-between z-20 shrink-0 transition-all duration-300 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="panel-glass absolute inset-0 border-r border-black/5 dark:border-white/10" />

      {/* Header / Logo */}
      <div className="relative p-5 flex items-center justify-between border-b border-black/5 dark:border-white/10 h-16 shrink-0">
        {!isCollapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-[#0B2551] to-[#00d2ff] flex items-center justify-center text-white p-2 shadow-lg shadow-[#00d2ff]/10">
              <LogoMark className="w-full h-full" />
            </div>
            <span className="font-bold text-lg text-gray-900 dark:text-white tracking-wide">Gestly</span>
          </div>
        )}
        {isCollapsed && (
          <div className="w-9 h-9 mx-auto rounded-xl bg-gradient-to-br from-[#0B2551] to-[#00d2ff] flex items-center justify-center text-white p-2 shadow-lg shadow-[#00d2ff]/10">
            <LogoMark className="w-full h-full" />
          </div>
        )}

        {/* Collapse button floating on border */}
        <button
          onClick={onToggle}
          className="absolute -right-3 top-4 bg-gradient-to-br from-[#0B2551] to-[#00d2ff] hover:brightness-110 text-white rounded-full p-1 border-2 border-[#f8fafc] dark:border-[#0a0b0e] shadow-lg transition-all duration-200"
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="relative flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {menuSections.map((section, idx) => {
          // Filtrar itens visíveis para o papel (role) do usuário
          const visibleItems = section.items.filter(
            (item) => !item.roles || hasRole(item.roles)
          );

          if (visibleItems.length === 0) return null;

          return (
            <div key={idx} className="space-y-1">
              {!isCollapsed && (
                <h4 className="px-3 mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-white/30">
                  {section.title}
                </h4>
              )}
              {isCollapsed && <div className="border-t border-black/5 dark:border-white/5 my-2" />}

              <div className="space-y-1">
                {visibleItems.map((item) => {
                  if (item.children) {
                    return (
                      <div key={item.path}>
                        <button
                          type="button"
                          aria-expanded={isReportsOpen}
                          aria-controls="reports-sidebar-submenu"
                          onClick={() => {
                            if (isCollapsed) {
                              onToggle();
                              setIsReportsOpen(true);
                              return;
                            }
                            setIsReportsOpen((current) => !current);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium transition-all-custom group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a8d8] ${
                            isReportsRoute
                              ? 'bg-gradient-to-r from-[#0B2551] to-[#00a8d8] text-white shadow-md shadow-[#00d2ff]/10'
                              : 'hover:bg-black/[0.03] dark:hover:bg-white/5 text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white'
                          }`}
                        >
                          <item.icon className={`w-5 h-5 shrink-0 ${isReportsRoute ? 'text-white' : 'text-gray-400 dark:text-white/60 group-hover:text-gray-900 dark:group-hover:text-white'}`} />
                          {!isCollapsed && (
                            <>
                              <span className="flex-1 text-left">{item.name}</span>
                              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isReportsOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                            </>
                          )}
                        </button>

                        {!isCollapsed && isReportsOpen && (
                          <div id="reports-sidebar-submenu" className="ml-5 mt-1 pl-3 border-l border-gray-200 dark:border-white/10 space-y-1">
                            {item.children.map((child) => {
                              const module = analyticsModules.find((candidate) => candidate.key === child.moduleKey);
                              const accessStatus = module?.accessStatus || child.defaultAccessStatus || (isLoadingAnalyticsModules ? undefined : 'locked');
                              const isLocked = accessStatus === 'locked';
                              const isComingSoon = accessStatus === 'coming_soon';

                              return (
                                <NavLink
                                  key={child.path}
                                  to={child.path}
                                  className={({ isActive }) =>
                                    `flex items-center gap-2.5 min-h-9 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a8d8] ${
                                      isActive
                                        ? 'bg-[#00a8d8]/10 text-[#007fa3] dark:text-[#53dcff]'
                                        : 'text-gray-500 dark:text-white/50 hover:bg-black/[0.03] dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                                    }`
                                  }
                                >
                                  <child.icon className="w-4 h-4 shrink-0 opacity-80" aria-hidden="true" />
                                  <span className="flex-1 text-left leading-tight">{child.name}</span>
                                  {isLocked && <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-label="Módulo bloqueado" />}
                                  {isComingSoon && <Clock3 className="w-3.5 h-3.5 text-blue-400 shrink-0" aria-label="Em breve" />}
                                </NavLink>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 text-sm font-medium transition-all-custom group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a8d8] ${
                          isActive
                            ? 'bg-gradient-to-r from-[#0B2551] to-[#00a8d8] text-white shadow-md shadow-[#00d2ff]/10'
                            : 'hover:bg-black/[0.03] dark:hover:bg-white/5 text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon className={`w-5 h-5 shrink-0 transition-colors duration-200 ${isActive ? 'text-white' : 'text-gray-400 dark:text-white/60 group-hover:text-gray-900 dark:group-hover:text-white'}`} />
                          {!isCollapsed && <span>{item.name}</span>}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer / Subscription Usage */}
      <div className="relative p-4 border-t border-black/5 dark:border-white/10 shrink-0">
        {!isCollapsed ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                Plano {subscription?.plan || 'Free'}
              </span>
              <span className="text-gray-400 dark:text-white/50">{usagePercent}%</span>
            </div>

            <div className="w-full bg-black/5 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-[#0B2551] to-[#00d2ff] h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${usagePercent}%` }}
              />
            </div>

            <p className="text-[10px] text-gray-400 dark:text-white/40 text-center">
              {subscription?.usageCurrent ?? 0} / {subscription?.usageLimit ?? 100} Operações
            </p>

            {subscription?.plan !== 'enterprise' && (
              <button
                type="button"
                className="w-full bg-gradient-to-r from-[#0B2551] to-[#00d2ff] hover:brightness-110 text-white text-xs font-semibold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all duration-200 shadow-md"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Upgrade
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-[#00a8d8]">{subscription?.plan[0] || 'F'}</span>
            <div className="w-2 h-2 rounded-full bg-gradient-to-br from-[#0B2551] to-[#00d2ff]" title={`${usagePercent}% de uso`} />
          </div>
        )}
      </div>
    </aside>
  );
};
