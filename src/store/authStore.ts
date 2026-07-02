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
  signUp: (email: string, password: string, name: string, companyName: string, cnpj: string) => Promise<{ needsEmailConfirmation: boolean }>;
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

// Conclui o cadastro (empresa + perfil + assinatura) via função segura no
// banco, chamada apenas quando existe uma sessão autenticada.
const completeCompanySignup = async (name: string, companyName: string, cnpj: string, email: string) => {
  const { error } = await supabase.rpc('complete_company_signup', {
    p_company_name: companyName,
    p_cnpj: cnpj,
    p_user_name: name,
    p_user_email: email,
  });
  if (error) throw error;
};

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
      // 0. Limpar qualquer sessão anterior ativa
      await supabase.auth.signOut().catch(() => {});

      // 1. Criar usuário no Supabase Auth. Os dados da empresa ficam nos
      // metadados do usuário para serem usados após a confirmação do e-mail,
      // quando a sessão autenticada existir e o cadastro puder ser concluído
      // com segurança (RPC valida auth.uid() no banco).
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, companyName, cnpj },
        },
      });

      if (error) throw error;
      if (!data?.user) throw new Error('Não foi possível registrar o usuário.');

      // Se a confirmação de e-mail estiver habilitada, não haverá sessão
      // ainda: o cadastro da empresa será concluído automaticamente no
      // primeiro login (ver loadSession).
      if (!data.session) {
        set({ user: null, isLoading: false, error: null });
        return { needsEmailConfirmation: true };
      }

      await completeCompanySignup(name, companyName, cnpj, email);
      await get().loadSession();
      return { needsEmailConfirmation: false };

    } catch (err: any) {
      console.error('Erro ao cadastrar:', err);
      set({
        error: err.message || 'Ocorreu um erro ao realizar o cadastro de sua empresa.',
        isLoading: false
      });
      return { needsEmailConfirmation: false };
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
      let { data: dbProfile, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profErr) throw profErr;

      // Se o e-mail acabou de ser confirmado e o cadastro da empresa ainda
      // não foi concluído (dados ficaram salvos nos metadados do usuário no
      // signUp), concluímos agora que já existe uma sessão autenticada.
      if (!dbProfile) {
        const meta = user.user_metadata as { name?: string; companyName?: string; cnpj?: string } | null;
        if (meta?.name && meta?.companyName && meta?.cnpj && user.email) {
          await completeCompanySignup(meta.name, meta.companyName, meta.cnpj, user.email);
          const retry = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
          if (retry.error) throw retry.error;
          dbProfile = retry.data;
        }
      }

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
