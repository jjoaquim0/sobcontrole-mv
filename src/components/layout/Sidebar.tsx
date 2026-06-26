import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Users, 
  Package, 
  Truck, 
  ShoppingCart, 
  CreditCard, 
  BarChart3, 
  FileText, 
  Building2, 
  Settings, 
  Shield, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
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
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const { profile, subscription, hasRole } = useAuth();

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
        { name: 'Relatórios', path: '/reports', icon: BarChart3, roles: ['admin', 'manager'] },
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
      className={`h-screen bg-[#1a1d27] text-white/70 flex flex-col justify-between border-r border-white/10 z-40 transition-all duration-300 relative ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Header / Logo */}
      <div className="p-5 flex items-center justify-between border-b border-white/10 h-16">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="bg-[#10b981] p-1.5 rounded-lg text-white">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg text-white tracking-wider">Gestly</span>
          </div>
        )}
        {isCollapsed && (
          <div className="bg-[#10b981] p-1.5 rounded-lg text-white mx-auto">
            <TrendingUp className="w-5 h-5" />
          </div>
        )}

        {/* Collapse button floating on border */}
        <button
          onClick={onToggle}
          className="absolute -right-3 top-4 bg-[#10b981] hover:bg-[#059669] text-white rounded-full p-1 border border-[#1a1d27] shadow-lg transition-transform duration-200"
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {menuSections.map((section, idx) => {
          // Filtrar itens visíveis para o papel (role) do usuário
          const visibleItems = section.items.filter(
            (item) => !item.roles || hasRole(item.roles)
          );

          if (visibleItems.length === 0) return null;

          return (
            <div key={idx} className="space-y-1">
              {!isCollapsed && (
                <h4 className="px-3 mb-2 text-xs font-semibold uppercase tracking-widest text-white/30">
                  {section.title}
                </h4>
              )}
              {isCollapsed && <div className="border-t border-white/5 my-2" />}
              
              <div className="space-y-1">
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 text-sm font-medium transition-all-custom group ${
                        isActive
                          ? 'bg-white/10 text-white rounded-xl'
                          : 'hover:bg-white/5 text-white/70 hover:text-white rounded-xl'
                      }`
                    }
                  >
                    <item.icon className="w-5 h-5 shrink-0 text-white/60 group-hover:text-white transition-colors duration-200" />
                    {!isCollapsed && <span>{item.name}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer / Subscription Usage */}
      <div className="p-4 border-t border-white/10 bg-black/15">
        {!isCollapsed ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white uppercase tracking-wider">
                Plano {subscription?.plan || 'Free'}
              </span>
              <span className="text-white/50">{usagePercent}%</span>
            </div>
            
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-[#10b981] h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            
            <p className="text-[10px] text-white/40 text-center">
              {subscription?.usageCurrent ?? 0} / {subscription?.usageLimit ?? 100} Operações
            </p>

            {subscription?.plan !== 'enterprise' && (
              <button
                type="button"
                className="w-full bg-[#10b981] hover:bg-[#059669] text-white text-xs font-semibold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors duration-200 shadow-md"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Upgrade
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-[#10b981]">{subscription?.plan[0] || 'F'}</span>
            <div className="w-2 h-2 rounded-full bg-[#10b981]" title={`${usagePercent}% de uso`} />
          </div>
        )}
      </div>
    </aside>
  );
};
