import { supabase } from '../lib/supabase';
import { Company, CompanySettings, Profile, UserRole } from '../types';
import { useAuthStore } from '../store/authStore';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'invited';
  createdAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  maskedKey: string;
  createdAt: string;
}

const LOGO_BUCKET = 'company-logos';

const requireCompanyId = (): string => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');
  return companyId;
};

export const mapDbSettings = (db: any): CompanySettings => ({
  id: db.id,
  companyId: db.company_id || db.companyId,
  timezone: db.timezone || 'America/Sao_Paulo',
  currency: db.currency || 'BRL',
  language: db.language || 'pt-BR',
  dateFormat: db.date_format || db.dateFormat || 'DD/MM/YYYY',
  logoUrl: db.logo_url ?? db.logoUrl ?? '',
  primaryColor: db.primary_color || db.primaryColor || '#10b981',
  emailNotifications: db.email_notifications ?? db.emailNotifications ?? true,
  pushNotifications: db.push_notifications ?? db.pushNotifications ?? true,
  whatsappNotifications: db.whatsapp_notifications ?? db.whatsappNotifications ?? false,
  smsNotifications: db.sms_notifications ?? db.smsNotifications ?? false,
  createdAt: db.created_at || db.createdAt,
  updatedAt: db.updated_at || db.updatedAt,
});

const mapProfileToMember = (db: any): TeamMember => ({
  id: db.id,
  name: db.name,
  email: db.email,
  role: db.role as UserRole,
  status: 'active',
  createdAt: db.created_at || db.createdAt,
});

export const getSettings = async (): Promise<CompanySettings> => {
  const companyId = requireCompanyId();

  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();

  if (error) throw error;
  if (data) return mapDbSettings(data);

  const defaults = {
    id: crypto.randomUUID(),
    company_id: companyId,
    timezone: 'America/Sao_Paulo',
    currency: 'BRL',
    language: 'pt-BR',
    date_format: 'DD/MM/YYYY',
    logo_url: '',
    primary_color: '#10b981',
    email_notifications: true,
    push_notifications: true,
    whatsapp_notifications: false,
    sms_notifications: false,
  };

  const { data: created, error: insertError } = await supabase
    .from('company_settings')
    .insert(defaults)
    .select()
    .maybeSingle();

  if (insertError) throw insertError;
  return mapDbSettings(created ?? defaults);
};

export type UpdatableSettings = Partial<
  Pick<
    CompanySettings,
    | 'timezone'
    | 'currency'
    | 'language'
    | 'dateFormat'
    | 'logoUrl'
    | 'primaryColor'
    | 'emailNotifications'
    | 'pushNotifications'
    | 'whatsappNotifications'
    | 'smsNotifications'
  >
>;

export const updateSettings = async (data: UpdatableSettings): Promise<CompanySettings> => {
  const companyId = requireCompanyId();

  const dbPayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.timezone !== undefined) dbPayload.timezone = data.timezone;
  if (data.currency !== undefined) dbPayload.currency = data.currency;
  if (data.language !== undefined) dbPayload.language = data.language;
  if (data.dateFormat !== undefined) dbPayload.date_format = data.dateFormat;
  if (data.logoUrl !== undefined) dbPayload.logo_url = data.logoUrl;
  if (data.primaryColor !== undefined) dbPayload.primary_color = data.primaryColor;
  if (data.emailNotifications !== undefined) dbPayload.email_notifications = data.emailNotifications;
  if (data.pushNotifications !== undefined) dbPayload.push_notifications = data.pushNotifications;
  if (data.whatsappNotifications !== undefined) dbPayload.whatsapp_notifications = data.whatsappNotifications;
  if (data.smsNotifications !== undefined) dbPayload.sms_notifications = data.smsNotifications;

  await getSettings();

  const { data: updated, error } = await supabase
    .from('company_settings')
    .update(dbPayload)
    .eq('company_id', companyId)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!updated) throw new Error('Não foi possível atualizar as configurações.');
  return mapDbSettings(updated);
};

export const updateCompanyName = async (name: string): Promise<Company> => {
  const companyId = requireCompanyId();

  const { data, error } = await supabase
    .from('companies')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', companyId)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Empresa não encontrada.');

  return {
    id: data.id,
    name: data.name,
    cnpj: data.cnpj,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
};

export const updateCompanyLogo = async (file: File): Promise<string> => {
  const companyId = requireCompanyId();

  const extension = file.name.split('.').pop() || 'png';
  const path = `${companyId}/logo-${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: true });

  if (uploadError) {
    throw new Error(
      'Não foi possível enviar a logomarca. Verifique se o armazenamento está configurado e tente novamente.'
    );
  }

  const { data: publicData } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  const publicUrl = publicData.publicUrl;

  await updateSettings({ logoUrl: publicUrl });
  return publicUrl;
};

export const changePassword = async (
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  const email = useAuthStore.getState().user?.email;
  if (!email) throw new Error('Usuário não autenticado.');

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (signInError) throw new Error('A senha atual está incorreta.');

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
};

export const getTeamMembers = async (): Promise<TeamMember[]> => {
  const companyId = requireCompanyId();

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapProfileToMember);
};

export const inviteTeamMember = async (email: string, role: UserRole): Promise<void> => {
  const companyId = requireCompanyId();

  const { error } = await supabase.functions.invoke('invite-team-member', {
    body: { email, role, companyId },
  });

  if (error) {
    throw new Error(
      'O envio de convites ainda não está disponível neste ambiente. Configure a função de convites para habilitar.'
    );
  }
};

export const removeTeamMember = async (userId: string): Promise<void> => {
  const companyId = requireCompanyId();

  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId)
    .eq('company_id', companyId);

  if (error) throw error;
};

export const updateMemberRole = async (userId: string, role: UserRole): Promise<Profile> => {
  const companyId = requireCompanyId();

  const { data, error } = await supabase
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .eq('company_id', companyId)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Membro não encontrado.');

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    role: data.role as UserRole,
    companyId: data.company_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
};

const EXPORT_TABLES = [
  'customers',
  'suppliers',
  'categories',
  'products',
  'sales',
  'purchases',
  'account_receivables',
  'account_payables',
] as const;

export const exportAllData = async (): Promise<Blob> => {
  const companyId = requireCompanyId();
  const dump: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    companyId,
  };

  for (const table of EXPORT_TABLES) {
    const { data, error } = await supabase.from(table).select('*').eq('company_id', companyId);
    if (error) throw error;
    dump[table] = data || [];
  }

  const saleIds = ((dump.sales as { id: string }[]) || []).map((sale) => sale.id);
  if (saleIds.length > 0) {
    const { data, error } = await supabase.from('sale_items').select('*').in('sale_id', saleIds);
    if (error) throw error;
    dump.sale_items = data || [];
  } else {
    dump.sale_items = [];
  }

  const purchaseIds = ((dump.purchases as { id: string }[]) || []).map((purchase) => purchase.id);
  if (purchaseIds.length > 0) {
    const { data, error } = await supabase
      .from('purchase_items')
      .select('*')
      .in('purchase_id', purchaseIds);
    if (error) throw error;
    dump.purchase_items = data || [];
  } else {
    dump.purchase_items = [];
  }

  return new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
};

const apiKeysStorageKey = (companyId: string) => `sobcontrole_api_keys_${companyId}`;

const readApiKeys = (companyId: string): ApiKey[] => {
  try {
    const raw = localStorage.getItem(apiKeysStorageKey(companyId));
    if (!raw) return [];
    return JSON.parse(raw) as ApiKey[];
  } catch {
    return [];
  }
};

const writeApiKeys = (companyId: string, keys: ApiKey[]): void => {
  localStorage.setItem(apiKeysStorageKey(companyId), JSON.stringify(keys));
};

const generateSecret = (): string => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sk_live_${hex}`;
};

export const getApiKeys = async (): Promise<ApiKey[]> => {
  const companyId = requireCompanyId();
  return readApiKeys(companyId);
};

export const createApiKey = async (name: string): Promise<ApiKey> => {
  const companyId = requireCompanyId();
  const secret = generateSecret();
  const newKey: ApiKey = {
    id: crypto.randomUUID(),
    name,
    key: secret,
    maskedKey: `${secret.slice(0, 12)}${'•'.repeat(12)}${secret.slice(-4)}`,
    createdAt: new Date().toISOString(),
  };
  const keys = readApiKeys(companyId);
  writeApiKeys(companyId, [newKey, ...keys]);
  return newKey;
};

export const revokeApiKey = async (keyId: string): Promise<void> => {
  const companyId = requireCompanyId();
  const keys = readApiKeys(companyId).filter((k) => k.id !== keyId);
  writeApiKeys(companyId, keys);
};
