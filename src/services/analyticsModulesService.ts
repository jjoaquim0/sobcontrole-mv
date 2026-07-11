import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import {
  AnalyticsModule,
  AnalyticsModuleAccessStatus,
  AnalyticsModulePlanRequirement,
  CompanyAnalyticsModule,
} from '../types';

interface AnalyticsModuleRow {
  id: string;
  key: string;
  name: string;
  category: string;
  min_plan: AnalyticsModulePlanRequirement | null;
  is_addon: boolean;
  is_coming_soon: boolean;
  is_active: boolean;
  route_path: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface CompanyAnalyticsModuleRow {
  id: string;
  company_id: string;
  module_key: string;
  status: string;
  activated_at: string;
  deactivated_at: string | null;
  activated_by: string | null;
  created_at: string;
  updated_at: string;
}

const requireCompanyId = (): string => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');
  return companyId;
};

const mapModule = (db: AnalyticsModuleRow): AnalyticsModule => ({
  id: db.id,
  key: db.key,
  name: db.name,
  category: db.category as AnalyticsModule['category'],
  minPlan: db.min_plan ?? null,
  isAddon: db.is_addon ?? false,
  isComingSoon: db.is_coming_soon ?? false,
  isActive: db.is_active ?? true,
  routePath: db.route_path,
  displayOrder: db.display_order ?? 0,
  createdAt: db.created_at,
  updatedAt: db.updated_at,
});

const mapCompanyModule = (db: CompanyAnalyticsModuleRow): CompanyAnalyticsModule => ({
  id: db.id,
  companyId: db.company_id,
  moduleKey: db.module_key,
  status: db.status as CompanyAnalyticsModule['status'],
  activatedAt: db.activated_at,
  deactivatedAt: db.deactivated_at ?? undefined,
  activatedBy: db.activated_by ?? undefined,
  createdAt: db.created_at,
  updatedAt: db.updated_at,
});

export const getAnalyticsModules = async (): Promise<AnalyticsModule[]> => {
  const { data, error } = await supabase
    .from('analytics_modules')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapModule);
};

export const getCompanyAnalyticsModules = async (): Promise<CompanyAnalyticsModule[]> => {
  const companyId = requireCompanyId();

  const { data, error } = await supabase
    .from('company_analytics_modules')
    .select('*')
    .eq('company_id', companyId)
    .eq('status', 'active');

  if (error) throw error;
  return (data || []).map(mapCompanyModule);
};

const PLAN_RANK: Record<AnalyticsModulePlanRequirement, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
};

/**
 * Ponto único e centralizado de cálculo de acesso a um módulo analítico.
 * Precedência: em breve > contratado (add-on) > incluído pelo plano > bloqueado.
 */
export const resolveModuleAccess = (
  module: Pick<AnalyticsModule, 'isComingSoon' | 'minPlan' | 'key'>,
  plan: AnalyticsModulePlanRequirement | null | undefined,
  contractedModuleKeys: ReadonlySet<string>
): AnalyticsModuleAccessStatus => {
  if (module.isComingSoon) return 'coming_soon';
  if (contractedModuleKeys.has(module.key)) return 'contracted';
  if (module.minPlan === null || module.minPlan === undefined) return 'available';
  if (!plan) return 'locked';
  return PLAN_RANK[plan] >= PLAN_RANK[module.minPlan] ? 'available' : 'locked';
};
