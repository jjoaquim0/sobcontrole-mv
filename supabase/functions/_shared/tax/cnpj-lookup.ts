/**
 * Story 1.28 — Handler de consulta de CNPJ para derivação do regime tributário.
 *
 * Dependências injetadas: nenhum acesso a `Deno`, a variável de ambiente ou a
 * rede acontece aqui. O bootstrap (index.ts) monta as dependências reais; os
 * testes montam falsas. Mesmo desenho de `_shared/ai/gateway.ts`.
 *
 * DECISÃO DE SEGURANÇA — o CNPJ não vem do corpo da requisição.
 * Ele é lido da empresa do próprio usuário autenticado. Aceitar CNPJ arbitrário
 * transformaria esta função em um proxy aberto de consulta cadastral,
 * utilizável por qualquer pessoa com uma conta de teste, e ainda queimaria o
 * rate limit compartilhado do provedor. O corpo da requisição é ignorado.
 */

export type CnpjLookupErrorCode =
  | 'method_not_allowed'
  | 'origin_not_allowed'
  | 'unauthorized'
  | 'permission_denied'
  | 'company_unavailable'
  | 'invalid_cnpj'
  | 'provider_unavailable'
  | 'internal_error';

export interface CnpjLookupIdentity {
  userId: string;
  accessToken: string;
}

export interface CnpjLookupCompany {
  companyId: string;
  cnpj: string;
  role: string;
}

/** Subconjunto do retorno do provedor efetivamente usado pela derivação. */
export interface CnpjRegistrySnapshot {
  cnpj: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  opcao_pelo_mei: boolean | null;
  data_opcao_pelo_mei: string | null;
  data_exclusao_do_mei: string | null;
  opcao_pelo_simples: boolean | null;
  data_opcao_pelo_simples: string | null;
  data_exclusao_do_simples: string | null;
  regime_tributario: Array<{ ano: number | null; forma_de_tributacao: string | null }>;
  cnae_fiscal: string | null;
  cnae_fiscal_descricao: string | null;
  cnaes_secundarios: Array<{ codigo: string | null; descricao: string | null }>;
  uf: string | null;
  municipio: string | null;
  codigo_municipio_ibge: string | null;
  porte: string | null;
  situacao_cadastral: string | null;
  descricao_situacao_cadastral: string | null;
}

export interface CnpjCacheEntry {
  payload: CnpjRegistrySnapshot;
  source: string;
  fetchedAt: string;
  expiresAt: string;
}

export interface CnpjLookupDependencies {
  allowedOrigins: string[];
  authenticate: (authorization: string) => Promise<CnpjLookupIdentity | null>;
  /** Resolve a empresa do chamador usando o JWT dele — RLS ativa, sem service_role. */
  resolveCompany: (identity: CnpjLookupIdentity) => Promise<CnpjLookupCompany | null>;
  readCache: (cnpj: string) => Promise<CnpjCacheEntry | null>;
  writeCache: (entry: CnpjCacheEntry & { cnpj: string }) => Promise<void>;
  fetchRegistry: (cnpj: string) => Promise<CnpjRegistrySnapshot>;
  cacheTtlMs: number;
  now: () => Date;
  logger: (event: Record<string, unknown>) => void;
}

const ALLOWED_ROLES = new Set(['admin', 'manager']);

const PUBLIC_MESSAGES: Record<CnpjLookupErrorCode, { status: number; message: string }> = {
  method_not_allowed: { status: 405, message: 'Método não suportado.' },
  origin_not_allowed: { status: 403, message: 'Origem não autorizada.' },
  unauthorized: { status: 401, message: 'Sessão inválida ou expirada.' },
  permission_denied: {
    status: 403,
    message: 'Apenas administradores e gerentes podem configurar o perfil tributário.',
  },
  company_unavailable: {
    status: 409,
    message: 'Não foi possível identificar a empresa do seu usuário.',
  },
  invalid_cnpj: {
    status: 422,
    message:
      'O CNPJ cadastrado na empresa não é válido. Corrija o cadastro em Minha Empresa antes de configurar o perfil tributário.',
  },
  provider_unavailable: {
    status: 503,
    message:
      'A consulta pública da Receita não respondeu. Você pode preencher o regime manualmente e tentar a consulta depois.',
  },
  internal_error: { status: 500, message: 'Não foi possível concluir a consulta.' },
};

export const normalizeCnpjDigits = (value: unknown): string =>
  String(value ?? '').replace(/\D/g, '');

/**
 * Validação de CNPJ pelos dois dígitos verificadores. Consultar a Receita com
 * CNPJ inválido gasta rate limit e devolve erro genérico; barrar aqui produz
 * mensagem acionável ("corrija o cadastro").
 */
export const isValidCnpj = (value: unknown): boolean => {
  const digits = normalizeCnpjDigits(value);
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const checkDigit = (length: number): number => {
    let weight = length - 7;
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * weight;
      weight -= 1;
      if (weight < 2) weight = 9;
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return checkDigit(12) === Number(digits[12]) && checkDigit(13) === Number(digits[13]);
};

const corsHeaders = (origin: string): Record<string, string> => ({
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': origin,
  'Content-Type': 'application/json',
  Vary: 'Origin',
});

const isOriginAllowed = (origin: string | null, allowed: string[]): boolean => {
  if (allowed.includes('*')) return true;
  if (!origin) return false;
  return allowed.includes(origin);
};

export const createCnpjLookupHandler = (deps: CnpjLookupDependencies) => {
  const respondError = (
    code: CnpjLookupErrorCode,
    origin: string,
    requestId: string,
  ): Response => {
    const { status, message } = PUBLIC_MESSAGES[code];
    return new Response(JSON.stringify({ error: { code, message }, request_id: requestId }), {
      status,
      headers: corsHeaders(origin),
    });
  };

  return async (request: Request): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const requestOrigin = request.headers.get('Origin');
    const responseOrigin = requestOrigin ?? '*';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(responseOrigin) });
    }

    if (request.method !== 'POST') {
      return respondError('method_not_allowed', responseOrigin, requestId);
    }

    if (!isOriginAllowed(requestOrigin, deps.allowedOrigins)) {
      return respondError('origin_not_allowed', responseOrigin, requestId);
    }

    try {
      const identity = await deps.authenticate(request.headers.get('Authorization') ?? '');
      if (!identity) {
        return respondError('unauthorized', responseOrigin, requestId);
      }

      const company = await deps.resolveCompany(identity);
      if (!company) {
        return respondError('company_unavailable', responseOrigin, requestId);
      }

      // Papel validado no backend, além da rota React e da RLS. Defesa em
      // profundidade: a consulta externa não acontece para colaborador.
      if (!ALLOWED_ROLES.has(company.role)) {
        deps.logger({
          event: 'cnpj_lookup_denied',
          request_id: requestId,
          reason: 'role',
        });
        return respondError('permission_denied', responseOrigin, requestId);
      }

      const cnpj = normalizeCnpjDigits(company.cnpj);
      if (!isValidCnpj(cnpj)) {
        return respondError('invalid_cnpj', responseOrigin, requestId);
      }

      const now = deps.now();

      const cached = await deps.readCache(cnpj);
      if (cached && new Date(cached.expiresAt).getTime() > now.getTime()) {
        deps.logger({
          event: 'cnpj_lookup_cache_hit',
          request_id: requestId,
          company_id: company.companyId,
        });
        return new Response(
          JSON.stringify({
            payload: cached.payload,
            source: cached.source,
            fetched_at: cached.fetchedAt,
            cached: true,
            request_id: requestId,
          }),
          { status: 200, headers: corsHeaders(responseOrigin) },
        );
      }

      let snapshot: CnpjRegistrySnapshot;
      try {
        snapshot = await deps.fetchRegistry(cnpj);
      } catch (error) {
        deps.logger({
          event: 'cnpj_lookup_provider_error',
          request_id: requestId,
          company_id: company.companyId,
          // Mensagem do erro, nunca o payload: log não carrega dado cadastral.
          detail: error instanceof Error ? error.message : 'unknown',
        });

        // Cache expirado ainda é melhor que nada: dado cadastral muda devagar e
        // a alternativa é bloquear o onboarding do cliente.
        if (cached) {
          return new Response(
            JSON.stringify({
              payload: cached.payload,
              source: cached.source,
              fetched_at: cached.fetchedAt,
              cached: true,
              stale: true,
              request_id: requestId,
            }),
            { status: 200, headers: corsHeaders(responseOrigin) },
          );
        }
        return respondError('provider_unavailable', responseOrigin, requestId);
      }

      const fetchedAt = now.toISOString();
      const expiresAt = new Date(now.getTime() + deps.cacheTtlMs).toISOString();

      try {
        await deps.writeCache({
          cnpj,
          payload: snapshot,
          source: 'brasilapi',
          fetchedAt,
          expiresAt,
        });
      } catch (error) {
        // Falha de cache não pode derrubar a consulta que já deu certo.
        deps.logger({
          event: 'cnpj_lookup_cache_write_failed',
          request_id: requestId,
          detail: error instanceof Error ? error.message : 'unknown',
        });
      }

      deps.logger({
        event: 'cnpj_lookup_ok',
        request_id: requestId,
        company_id: company.companyId,
      });

      return new Response(
        JSON.stringify({
          payload: snapshot,
          source: 'brasilapi',
          fetched_at: fetchedAt,
          cached: false,
          request_id: requestId,
        }),
        { status: 200, headers: corsHeaders(responseOrigin) },
      );
    } catch (error) {
      deps.logger({
        event: 'cnpj_lookup_failed',
        request_id: requestId,
        detail: error instanceof Error ? error.message : 'unknown',
      });
      return respondError('internal_error', responseOrigin, requestId);
    }
  };
};
