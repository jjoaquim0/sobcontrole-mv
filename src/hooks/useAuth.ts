import { useAuthStore } from '../store/authStore';
import { UserRole } from '../types';

export const useAuth = () => {
  const { 
    user, 
    profile, 
    company, 
    subscription, 
    isLoading, 
    error,
    signIn, 
    signUp, 
    signOut, 
    loadSession,
    clearError
  } = useAuthStore();

  const isAuthenticated = !!user;

  // Verifica se o usuário tem algum dos papéis fornecidos
  const hasRole = (allowedRoles: UserRole[]): boolean => {
    if (!profile) return false;
    return allowedRoles.includes(profile.role);
  };

  // Verifica se a empresa possui assinatura ativa (active ou trialing)
  const hasActiveSubscription = 
    subscription?.status === 'active' || 
    subscription?.status === 'trialing';

  return {
    user,
    profile,
    company,
    subscription,
    isLoading,
    error,
    isAuthenticated,
    hasActiveSubscription,
    hasRole,
    signIn,
    signUp,
    signOut,
    loadSession,
    clearError
  };
};
