import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAnalyticsModules, getCompanyAnalyticsModules, resolveModuleAccess } from '../services/analyticsModulesService';
import { useAuth } from './useAuth';
import { AnalyticsModule, AnalyticsModuleAccessStatus } from '../types';

const ANALYTICS_MODULES_KEY = 'analytics-modules';
const COMPANY_ANALYTICS_MODULES_KEY = 'company-analytics-modules';

export interface AnalyticsModuleWithAccess extends AnalyticsModule {
  accessStatus: AnalyticsModuleAccessStatus;
}

export const useAnalyticsModules = (enabled = true) => {
  const { subscription } = useAuth();

  const modulesQuery = useQuery({
    queryKey: [ANALYTICS_MODULES_KEY],
    queryFn: getAnalyticsModules,
    enabled,
  });

  const contractedQuery = useQuery({
    queryKey: [COMPANY_ANALYTICS_MODULES_KEY],
    queryFn: getCompanyAnalyticsModules,
    enabled,
  });

  const contractedKeys = useMemo(
    () => new Set((contractedQuery.data || []).map((m) => m.moduleKey)),
    [contractedQuery.data]
  );

  const modules: AnalyticsModuleWithAccess[] = useMemo(
    () =>
      (modulesQuery.data || []).map((module) => ({
        ...module,
        accessStatus: resolveModuleAccess(module, subscription?.plan ?? null, contractedKeys),
      })),
    [modulesQuery.data, subscription?.plan, contractedKeys]
  );

  return {
    modules,
    isLoading: enabled && (modulesQuery.isLoading || contractedQuery.isLoading),
    isError: modulesQuery.isError || contractedQuery.isError,
    refetch: () => {
      modulesQuery.refetch();
      contractedQuery.refetch();
    },
  };
};
