import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  createCnpjLookupHandler,
  type CnpjCacheEntry,
  type CnpjRegistrySnapshot,
} from '../_shared/tax/cnpj-lookup.ts';
import {
  createRegistryProvider,
  DEFAULT_REGISTRY_ENDPOINT,
} from '../_shared/tax/registry-provider.ts';

const parseAllowedOrigins = (value: string | undefined): string[] => {
  const origins = value
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins && origins.length > 0 ? origins : ['*'];
};

/** 30 dias: dado cadastral da Receita muda devagar e a API tem rate limit. */
const DEFAULT_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const parseTtl = (value: string | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CACHE_TTL_MS;
};

const unavailableResponse = (request: Request): Response =>
  new Response(
    JSON.stringify({
      error: {
        code: 'configuration_error',
        message: 'A consulta de CNPJ não está configurada neste ambiente.',
      },
    }),
    {
      status: 503,
      headers: {
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Origin': request.headers.get('Origin') ?? '*',
        'Content-Type': 'application/json',
        Vary: 'Origin',
      },
    },
  );

let handler: ((request: Request) => Promise<Response>) | undefined;

Deno.serve(async (request: Request): Promise<Response> => {
  if (!handler) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return unavailableResponse(request);
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // service_role é usado APENAS para o cache global de CNPJ, que não tem
    // company_id. Todo dado de negócio (profile, company) é lido com o JWT do
    // usuário, com RLS ativa.
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    handler = createCnpjLookupHandler({
      allowedOrigins: parseAllowedOrigins(Deno.env.get('AI_ALLOWED_ORIGINS')),
      cacheTtlMs: parseTtl(Deno.env.get('CNPJ_CACHE_TTL_MS')),
      now: () => new Date(),
      logger: (event) => console.log(JSON.stringify(event)),

      authenticate: async (authorization) => {
        const match = /^Bearer\s+(.+)$/i.exec(authorization);
        if (!match) return null;
        const {
          data: { user },
          error,
        } = await authClient.auth.getUser(match[1]);
        return error || !user ? null : { userId: user.id, accessToken: match[1] };
      },

      resolveCompany: async (identity) => {
        // Cliente por request com o JWT do usuário: a RLS decide o que ele vê.
        const scoped = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${identity.accessToken}` } },
        });

        const { data: profile, error: profileError } = await scoped
          .from('profiles')
          .select('company_id, role')
          .eq('id', identity.userId)
          .maybeSingle();

        if (profileError || !profile?.company_id) return null;

        const { data: company, error: companyError } = await scoped
          .from('companies')
          .select('id, cnpj')
          .eq('id', profile.company_id)
          .maybeSingle();

        if (companyError || !company) return null;

        return {
          companyId: String(company.id),
          cnpj: String(company.cnpj ?? ''),
          role: String(profile.role ?? ''),
        };
      },

      readCache: async (cnpj): Promise<CnpjCacheEntry | null> => {
        const { data, error } = await serviceClient
          .from('cnpj_registry_cache')
          .select('payload, source, fetched_at, expires_at')
          .eq('cnpj', cnpj)
          .maybeSingle();

        if (error || !data) return null;
        return {
          payload: data.payload as CnpjRegistrySnapshot,
          source: String(data.source),
          fetchedAt: String(data.fetched_at),
          expiresAt: String(data.expires_at),
        };
      },

      writeCache: async (entry) => {
        const { error } = await serviceClient.from('cnpj_registry_cache').upsert(
          {
            cnpj: entry.cnpj,
            payload: entry.payload,
            source: entry.source,
            fetched_at: entry.fetchedAt,
            expires_at: entry.expiresAt,
          },
          { onConflict: 'cnpj' },
        );
        if (error) throw new Error(error.message);
      },

      fetchRegistry: createRegistryProvider({
        endpoint: Deno.env.get('CNPJ_REGISTRY_ENDPOINT') ?? DEFAULT_REGISTRY_ENDPOINT,
      }),
    });
  }

  return handler(request);
});
