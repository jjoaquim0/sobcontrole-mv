import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { Logo } from '../components/shared/brand';

interface PublicRouteProps {
  children: React.ReactElement;
}

export const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="auth-theme flex min-h-screen flex-col items-center justify-center gap-5 bg-landing-bg text-landing-text-secondary">
        <Logo variant="cor" symbolClassName="h-11 w-11" wordmarkClassName="text-2xl" />
        <div role="status" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]">
          <Loader2 className="h-4 w-4 animate-spin text-landing-brand" aria-hidden="true" />
          Preparando seu acesso...
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
