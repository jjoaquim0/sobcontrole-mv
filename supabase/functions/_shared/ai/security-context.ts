import { createClient } from 'jsr:@supabase/supabase-js@2';
import { AIServiceError } from './errors.ts';
import type { SecurityContext, SecurityRole } from './types.ts';
import { normalizeTimezone } from './tools/period.ts';
import { SupabaseGestlyToolDataSource } from './tools/supabase-data-source.ts';
import type { SecurityContextResolver } from './tools/types.ts';

interface ProfileRow {
  id: unknown;
  company_id: unknown;
  role: unknown;
}

interface CompanySettingsRow {
  timezone: unknown;
  currency: unknown;
}

const isSecurityRole = (value: unknown): value is SecurityRole =>
  value === 'admin' || value === 'manager' || value === 'employee';

const validSetting = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

export const createSupabaseSecurityContextResolver = (
  supabaseUrl: string,
  supabasePublishableKey: string,
): SecurityContextResolver => {
  return async (user, requestId) => {
    if (!user.accessToken) throw new AIServiceError('unauthorized');

    const userClient = createClient(supabaseUrl, supabasePublishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      },
    });

    const { data: rawProfile, error: profileError } = await userClient
      .from('profiles')
      .select('id, company_id, role')
      .eq('id', user.userId)
      .maybeSingle();

    const profile = rawProfile as ProfileRow | null;
    if (
      profileError ||
      !profile ||
      profile.id !== user.userId ||
      typeof profile.company_id !== 'string' ||
      !profile.company_id ||
      !isSecurityRole(profile.role)
    ) {
      throw new AIServiceError('company_not_found');
    }

    const { data: company, error: companyError } = await userClient
      .from('companies')
      .select('id')
      .eq('id', profile.company_id)
      .maybeSingle();

    if (companyError || !company || company.id !== profile.company_id) {
      throw new AIServiceError('company_not_found');
    }

    const { data: rawSettings, error: settingsError } = await userClient
      .from('company_settings')
      .select('timezone, currency')
      .eq('company_id', profile.company_id)
      .maybeSingle();

    if (settingsError) throw new AIServiceError('company_not_found');
    const settings = rawSettings as CompanySettingsRow | null;

    const securityContext: SecurityContext = {
      userId: user.userId,
      companyId: profile.company_id,
      role: profile.role,
      requestId,
      timezone: normalizeTimezone(validSetting(settings?.timezone, 'America/Sao_Paulo')),
      currency: validSetting(settings?.currency, 'BRL'),
      limits: {
        maxCustomPeriodDays: 366,
        maxLowStockResults: 25,
        maxFinancialResults: 20,
        maxToolCalls: 3,
      },
    };

    return {
      securityContext,
      dataSource: new SupabaseGestlyToolDataSource(userClient),
    };
  };
};
