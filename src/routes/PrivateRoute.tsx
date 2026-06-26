import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface PrivateRouteProps {
  children: React.ReactElement;
  allowInactiveSubscription?: boolean;
}

export const PrivateRoute: React.FC<PrivateRouteProps> = ({ 
  children, 
  allowInactiveSubscription = false 
}) => {
  const { isAuthenticated, hasActiveSubscription, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center text-white/50 gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-[#10b981]" />
        <span className="text-xs font-medium tracking-widest uppercase text-gray-500">Autenticando...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!hasActiveSubscription && !allowInactiveSubscription) {
    return <Navigate to="/subscription-inactive" replace />;
  }

  return children;
};
