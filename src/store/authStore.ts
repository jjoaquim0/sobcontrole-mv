import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Profile, Company, Subscription, UserRole } from '../types';
import { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  company: Company | null;
  subscription: Subscription | null;
  isLoading: boolean;
  error: string | null;

  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, companyName: string, cnpj: string) => Promise<void>;
  signOut: () => Promise<void>;
  loadSession: () => Promise<void>;
  clearError: () => void;
}

// Helper maps to bridge DB snake_case to Frontend camelCase
const mapProfile = (db: any): Profile => ({
  id: db.id,
  email: db.email,
  name: db.name,
  role: db.role as UserRole,
  companyId: db.company_id || db.companyId,
  createdAt: db.created_at || db.createdAt,
  updatedAt: db.updated_at || db.updatedAt,
});

const mapCompany = (db: any): Company => ({
  id: db.id,
  name: db.name,
  cnpj: db.cnpj,
  createdAt: db.created_at || db.createdAt,
  updatedAt: db.updated_at || db.updatedAt,
});

const mapSubscription = (db: any): Subscription => ({
  id: db.id,
  companyId: db.company_id || db.companyId,
  plan: db.plan || 'free',
  status: db.status || 'inactive',
  currentPeriodEnd: db.current_period_end || db.currentPeriodEnd || new Date().toISOString(),
  usageLimit: db.usage_limit || db.usageLimit || 100,
  usageCurrent: db.usage_current || db.usageCurrent || 0,
  createdAt: db.created_at || db.createdAt || new Date().toISOString(),
});

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  profile: null,
  company: null,
  subscription: null,
  isLoading: true,
  error: null,

  clearError: () => set({ error: null }),

  signIn: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      // 1. Autenticar no Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data?.user) {
        set({ user: data.user });
        // 2. Carregar perfil, empresa e assinatura
        await get().loadSession();
      }
    } catch (err: any) {
      console.error('Erro ao fazer login:', err);
      set({ 
        error: err.message || 'Ocorreu um erro ao realizar o login. Verifique suas credenciais.', 
        isLoading: false 
      });
    }
  },

  signUp: async (email, password, name, companyName, cnpj) => {
    set({ isLoading: true, error: null });
    try {
      // 1. Criar usuário no Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      if (!data?.user) throw new Error('Não foi possível registrar o usuário.');

      const userId = data.user.id;

      // 2. Criar a empresa (Companies)
      const newCompanyId = crypto.randomUUID();
      
      const { data: dbCompany, error: compErr } = await supabase
        .from('companies')
        .insert({
          id: newCompanyId,
          name: companyName,
          cnpj,
        })
        .select()
        .maybeSingle();

      if (compErr) throw compErr;
      if (!dbCompany) {
        throw new Error('Erro ao salvar os dados da empresa. Verifique se o RLS (Row Level Security) está desativado no seu Supabase.');
      }

      // 3. Criar o Perfil do usuário com a role 'manager'
      const { data: dbProfile, error: profErr } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email,
          name,
          role: 'manager',
          company_id: newCompanyId,
        })
        .select()
        .maybeSingle();

      if (profErr) throw profErr;
      if (!dbProfile) {
        throw new Error('Erro ao criar o perfil do usuário. Verifique se o RLS (Row Level Security) está desativado no seu Supabase.');
      }

      // 4. Criar Assinatura Inicial (Trial Pro de 14 dias)
      const { data: dbSub, error: subErr } = await supabase
        .from('subscriptions')
        .insert({
          id: crypto.randomUUID(),
          company_id: newCompanyId,
          plan: 'pro',
          status: 'active',
          current_period_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          usage_limit: 200,
          usage_current: 0,
        })
        .select()
        .maybeSingle();

      if (subErr) throw subErr;
      if (!dbSub) {
        throw new Error('Erro ao criar a assinatura da empresa. Verifique se o RLS (Row Level Security) está desativado no seu Supabase.');
      }

      set({
        user: data.user,
        company: mapCompany(dbCompany),
        profile: mapProfile(dbProfile),
        subscription: mapSubscription(dbSub),
        isLoading: false,
        error: null,
      });

    } catch (err: any) {
      console.error('Erro ao cadastrar:', err);
      set({ 
        error: err.message || 'Ocorreu um erro ao realizar o cadastro de sua empresa.', 
        isLoading: false 
      });
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Erro ao deslogar do Supabase:', err);
    } finally {
      set({
        user: null,
        profile: null,
        company: null,
        subscription: null,
        isLoading: false,
        error: null,
      });
    }
  },

  loadSession: async () => {
    set({ isLoading: true });
    try {
      // 1. Obter usuário autenticado
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;

      if (!session?.user) {
        set({ user: null, profile: null, company: null, subscription: null, isLoading: false });
        return;
      }

      const user = session.user;
      set({ user });

      // 2. Carregar perfil do banco
      const { data: dbProfile, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profErr) throw profErr;
      if (!dbProfile) {
        throw new Error('Perfil de usuário não encontrado. Certifique-se de que o cadastro da empresa foi concluído.');
      }

      const profile = mapProfile(dbProfile);
      set({ profile });

      // 3. Carregar empresa
      const { data: dbCompany, error: compErr } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.companyId)
        .maybeSingle();

      if (compErr) throw compErr;
      if (!dbCompany) {
        throw new Error('Empresa do usuário não encontrada no banco de dados.');
      }
      
      const company = mapCompany(dbCompany);
      set({ company });

      // 4. Carregar assinatura da empresa
      const { data: dbSub, error: subErr } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('company_id', company.id)
        .maybeSingle();

      if (subErr) throw subErr;
      if (!dbSub) {
        throw new Error('Assinatura da empresa não encontrada no banco de dados.');
      }
      
      set({ subscription: mapSubscription(dbSub) });

    } catch (err: any) {
      console.error('Erro ao carregar sessão:', err);
      set({ 
        user: null, 
        profile: null, 
        company: null, 
        subscription: null, 
        error: err.message || 'Sua sessão expirou ou não pôde ser recuperada.' 
      });
    } finally {
      set({ isLoading: false });
    }
  },
}));
