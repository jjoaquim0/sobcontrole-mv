import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createAiGatewayHandler } from './gateway.ts';
import { OpenAIProvider } from './providers/openai.ts';
import { AIProviderRegistry } from './providers/registry.ts';
import { createSupabaseSecurityContextResolver } from './security-context.ts';
import {
  createSupabaseUsageRepository,
} from './supabase-usage-repository.ts';
import type { SupabaseRpcClient } from './supabase-usage-repository.ts';
import { createToolAuditRepository } from './tool-audit-repository.ts';
import type { ToolAuditClient } from './tool-audit-repository.ts';
import { createDefaultToolDefinitions } from './tools/definitions.ts';
import { createDomainToolDefinitions } from './tools/definitions-p2.ts';
import { ReadOnlyToolRegistry } from './tools/registry.ts';
import type { SafeLogEvent } from './types.ts';

const parseAllowedOrigins = (value: string | undefined): string[] => {
  const origins = value
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins && origins.length > 0 ? origins : ['*'];
};

const unavailableResponse = (request: Request): Response => {
  const requestId = crypto.randomUUID();
  const origin = request.headers.get('Origin') ?? '*';
  return new Response(
    JSON.stringify({
      error: {
        code: 'configuration_error',
        message: 'Não foi possível conversar com a Gestly agora. Tente novamente.',
      },
      request_id: requestId,
    }),
    {
      status: 503,
      headers: {
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Origin': origin,
        'Content-Type': 'application/json',
        Vary: 'Origin',
      },
    },
  );
};

export const createEdgeGatewayHandler = () => {
  let handler: ((request: Request) => Promise<Response>) | undefined;

  return async (request: Request): Promise<Response> => {
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
      const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const usageRepository = createSupabaseUsageRepository(
        serviceClient as unknown as SupabaseRpcClient,
      );
      const providers = new AIProviderRegistry().register(
        'openai',
        () => new OpenAIProvider({ apiKey: Deno.env.get('OPENAI_API_KEY') ?? '' }),
      );
      const toolRegistry = new ReadOnlyToolRegistry()
        .registerAll(createDefaultToolDefinitions())
        .registerAll(createDomainToolDefinitions());

      handler = createAiGatewayHandler({
        authenticate: async (authorization) => {
          const match = /^Bearer\s+(.+)$/i.exec(authorization);
          if (!match) return null;

          const {
            data: { user },
            error,
          } = await authClient.auth.getUser(match[1]);
          return error || !user ? null : { userId: user.id, accessToken: match[1] };
        },
        usageRepository,
        providers,
        resolveSecurityContext: createSupabaseSecurityContextResolver(
          supabaseUrl,
          supabaseAnonKey,
        ),
        toolRegistry,
        toolAuditRepository: createToolAuditRepository(
          serviceClient as unknown as ToolAuditClient,
        ),
        allowedOrigins: parseAllowedOrigins(Deno.env.get('AI_ALLOWED_ORIGINS')),
        logger: (event: SafeLogEvent) => console.log(JSON.stringify(event)),
      });
    }

    return handler(request);
  };
};
