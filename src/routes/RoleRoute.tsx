import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '../types';
import { Loader2 } from 'lucide-react';

interface RoleRouteProps {
  children: React.ReactElement;
  allowedRoles: UserRole[];
}

export const RoleRoute: React.FC<RoleRouteProps> = ({ children, allowedRoles }) => {
  const { hasRole, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center text-white/50 gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-[#10b981]" />
        <span className="text-xs font-medium tracking-widest uppercase text-gray-500">Verificando Permissões...</span>
      </div>
    );
  }

  if (!hasRole(allowedRoles)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
