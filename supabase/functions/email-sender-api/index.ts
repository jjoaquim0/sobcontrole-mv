import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { EmailProviderRegistry } from '../_shared/email/registry.ts';
import { GoogleEmailProvider } from '../_shared/email/providers/google.ts';
import { MicrosoftEmailProvider } from '../_shared/email/providers/microsoft.ts';
import { ResendEmailProvider, type ResendDomainRecord } from '../_shared/email/providers/resend.ts';
import { EmailProviderError, type EmailProviderKind, type EmailSenderMode } from '../_shared/email/types.ts';
import {
  createPkceChallenge,
  digestSha256,
  emailBelongsToDomain,
  hmacSha256,
  maskEmail,
  normalizeDisplayName,
  normalizeDomain,
  normalizeEmail,
  normalizeIdempotencyKey,
  randomUrlSafe,
  toPostgresBytea,
} from '../_shared/email/validation.ts';
import { refreshOAuthToken } from '../_shared/email/oauth.ts';
import { canAccessEmailTenant, canPerformEmailAction, type EmailActorRole } from '../_shared/email/authorization.ts';

type ServiceClient = ReturnType<typeof createClient>;
interface Actor { userId: string; companyId: string; role: EmailActorRole; name: string }
interface RequestBody { action?: string; [key: string]: unknown }

const allowedOrigins = (Deno.env.get('EMAIL_ALLOWED_ORIGINS') || 'http://localhost:5174')
  .split(',').map((origin) => origin.trim()).filter(Boolean);

const corsHeaders = (origin: string | null): HeadersInit => ({
  'Access-Control-Allow-Origin': origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  Vary: 'Origin',
});

const respond = (origin: string | null, body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });

const safeError = (error: unknown): { code: string; status: number } => {
  const code = error instanceof EmailProviderError ? error.code : error instanceof Error ? error.message : 'internal_error';
  if (code === 'permission_denied') return { code, status: 403 };
  if (code.includes('rate_limit')) return { code: 'rate_limit_exceeded', status: 429 };
  if (code === 'idempotency_conflict') return { code, status: 409 };
  if (['invalid_request', 'invalid_domain', 'invalid_sender', 'domain_not_verified'].includes(code)) return { code, status: 422 };
  if (code === 'auth_expired') return { code, status: 409 };
  if (code === 'configuration_error') return { code, status: 503 };
  return { code: 'provider_unavailable', status: 503 };
};

const resolveActor = async (request: Request, service: ServiceClient): Promise<Actor | null> => {
  const token = /^Bearer\s+(.+)$/i.exec(request.headers.get('Authorization') || '')?.[1];
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!token || !supabaseUrl || !publishableKey) return null;
  const authClient = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await authClient.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await service.from('profiles').select('id, company_id, role, name').eq('id', user.id).maybeSingle();
  if (!profile || !['admin', 'manager', 'employee'].includes(profile.role)) return null;
  return { userId: profile.id, companyId: profile.company_id, role: profile.role as EmailActorRole, name: profile.name };
};

const requireManager = (actor: Actor): void => {
  if (!canPerformEmailAction(actor.role, 'view')) throw new Error('permission_denied');
};
const requireAdmin = (actor: Actor): void => {
  if (!canPerformEmailAction(actor.role, 'configure')) throw new Error('permission_denied');
};

const ensureSettings = async (service: ServiceClient, actor: Actor) => {
  const { data } = await service.from('email_sender_settings').select('*').eq('company_id', actor.companyId).maybeSingle();
  if (data) return data;
  const platformEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'notificacoes@sobcontrole.app';
  const { data: created, error } = await service.from('email_sender_settings').insert({
    company_id: actor.companyId,
    mode: 'platform',
    display_name: actor.name || 'SobControle',
    sender_email: platformEmail,
    created_by: actor.userId,
    updated_by: actor.userId,
  }).select().single();
  if (error) throw error;
  return created;
};

const statePayload = async (service: ServiceClient, actor: Actor) => {
  const settings = await ensureSettings(service, actor);
  const [{ data: connections }, { data: domains }, { data: dns }, { data: history }] = await Promise.all([
    service.from('email_sender_connections').select('id,provider,status,account_email,granted_scopes,token_expires_at,last_refreshed_at,safe_error_code,created_at').eq('company_id', actor.companyId).is('disconnected_at', null).order('created_at', { ascending: false }),
    service.from('email_sender_domains').select('*').eq('company_id', actor.companyId).is('deleted_at', null).order('created_at', { ascending: false }),
    service.from('email_sender_domain_dns_records').select('*').eq('company_id', actor.companyId).order('created_at'),
    service.from('outbound_email_logs').select('id,created_at,sender_display_name,sender_email,recipient_masked,subject_label,origin,provider,status,safe_error_code,provider_message_id').eq('company_id', actor.companyId).order('created_at', { ascending: false }).limit(50),
  ]);
  return {
    settings,
    connections: connections || [],
    domains: (domains || []).map((domain) => ({ ...domain, records: (dns || []).filter((record) => record.domain_id === domain.id) })),
    history: history || [],
    permissions: { canConfigure: actor.role === 'admin', canTest: true },
  };
};

const recordPurpose = (record: ResendDomainRecord): string => {
  const normalized = record.record.toLowerCase();
  if (normalized.includes('dkim')) return 'dkim';
  if (normalized.includes('spf')) return 'spf';
  if (normalized.includes('dmarc')) return 'dmarc';
  return 'return_path';
};

const providerRegistry = new EmailProviderRegistry()
  .register(new ResendEmailProvider())
  .register(new GoogleEmailProvider())
  .register(new MicrosoftEmailProvider());

const oauthConfig = (provider: 'google' | 'microsoft') => {
  const prefix = provider === 'google' ? 'GOOGLE' : 'MICROSOFT';
  const clientId = Deno.env.get(`${prefix}_EMAIL_CLIENT_ID`);
  const clientSecret = Deno.env.get(`${prefix}_EMAIL_CLIENT_SECRET`);
  const redirectUri = Deno.env.get(`${prefix}_EMAIL_REDIRECT_URI`);
  if (!clientId || !clientSecret || !redirectUri) throw new EmailProviderError('configuration_error');
  return { clientId, clientSecret, redirectUri };
};

const sendTest = async (service: ServiceClient, actor: Actor, body: RequestBody) => {
  if (Deno.env.get('EMAIL_SENDING_DISABLED') === 'true') throw new Error('sending_disabled');
  const recipient = normalizeEmail(body.recipient);
  const idempotencyKey = normalizeIdempotencyKey(body.idempotencyKey);
  if (!recipient || !idempotencyKey) throw new Error('invalid_request');
  const hmacSecret = Deno.env.get('EMAIL_RECIPIENT_HMAC_SECRET');
  if (!hmacSecret) throw new EmailProviderError('configuration_error');
  const settings = await ensureSettings(service, actor);
  let providerKind: EmailProviderKind = 'resend';
  let context: { apiKey?: string; accessToken?: string; refreshToken?: string } = {};
  let connectionId: string | null = null;
  const domainId = settings.selected_domain_id as string | null;
  const mode = settings.mode as EmailSenderMode;
  const senderEmail = settings.sender_email || Deno.env.get('RESEND_FROM_EMAIL');
  if (!senderEmail) throw new EmailProviderError('configuration_error');

  if (mode === 'verified_domain') {
    const { data: activeDomain } = await service.from('email_sender_domains')
      .select('id,company_id,domain,status').eq('id', domainId).eq('company_id', actor.companyId).maybeSingle();
    if (!activeDomain || !canAccessEmailTenant(actor.companyId, activeDomain.company_id) || activeDomain.status !== 'verified') {
      throw new Error('domain_not_verified');
    }
    if (!emailBelongsToDomain(senderEmail, activeDomain.domain)) throw new Error('invalid_sender');
  }

  if (mode === 'platform' || mode === 'verified_domain') {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) throw new EmailProviderError('configuration_error');
    context = { apiKey };
  } else {
    connectionId = settings.selected_connection_id;
    providerKind = mode === 'google_oauth' ? 'google' : 'microsoft';
    const { data, error } = await service.rpc('backend_get_email_oauth_credentials', {
      p_actor_user_id: actor.userId, p_connection_id: connectionId,
    });
    const credentials = data?.[0];
    if (error || !credentials) throw new EmailProviderError('auth_expired');
    let accessToken = credentials.access_token as string;
    const refreshToken = credentials.refresh_token as string;
    if (new Date(credentials.expires_at).getTime() <= Date.now() + 60_000) {
      const config = oauthConfig(providerKind);
      const refreshed = await refreshOAuthToken({ provider: providerKind, refreshToken, ...config }).catch(async () => {
        await service.from('email_sender_connections').update({
          status: 'expired', safe_error_code: 'auth_expired', last_error_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq('id', connectionId).eq('company_id', actor.companyId);
        throw new EmailProviderError('auth_expired');
      });
      accessToken = refreshed.accessToken;
      const expiresAt = new Date(Date.now() + refreshed.expiresIn * 1000).toISOString();
      await service.rpc('backend_update_email_oauth_tokens', {
        p_actor_user_id: actor.userId, p_connection_id: connectionId,
        p_access_token: accessToken, p_refresh_token: refreshed.refreshToken || '', p_token_expires_at: expiresAt,
      });
    }
    context = { accessToken, refreshToken };
  }

  const recipientHash = await hmacSha256(recipient, hmacSecret);
  const fingerprint = await digestSha256(`${recipient}|${senderEmail}|sender_test_v1`);
  const { data: reservation, error: reservationError } = await service.rpc('backend_reserve_test_email', {
    p_actor_user_id: actor.userId,
    p_idempotency_key: idempotencyKey,
    p_payload_fingerprint: toPostgresBytea(fingerprint),
    p_recipient_masked: maskEmail(recipient),
    p_recipient_hash: toPostgresBytea(recipientHash),
    p_provider: providerKind,
    p_mode: mode,
    p_sender_display_name: settings.display_name,
    p_sender_email: senderEmail,
    p_connection_id: connectionId,
    p_domain_id: domainId,
  });
  if (reservationError) throw new Error(reservationError.message);
  const reserved = reservation?.[0];
  if (!reserved) throw new Error('reservation_failed');
  if (reserved.duplicate) {
    const { data: existing } = await service.from('outbound_email_logs').select('id,status,safe_error_code').eq('id', reserved.log_id).single();
    return existing;
  }

  try {
    const receipt = await providerRegistry.resolve(providerKind).sendTransactionalEmail(context, {
      fromEmail: senderEmail,
      fromName: settings.display_name,
      replyTo: settings.reply_to_email || undefined,
      to: recipient,
      subject: 'Teste de envio — SobControle',
      text: 'Este é um e-mail de teste do SobControle. Nenhuma ação é necessária.',
      html: '<p>Este é um e-mail de teste do SobControle. Nenhuma ação é necessária.</p>',
      idempotencyKey: reserved.log_id,
    });
    await service.rpc('backend_finalize_test_email', {
      p_log_id: reserved.log_id, p_status: 'sent',
      p_provider_message_id: receipt.providerMessageId || null, p_safe_error_code: null,
    });
    await service.from('email_sender_settings').update({ last_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('company_id', actor.companyId);
    return { id: reserved.log_id, status: 'sent' };
  } catch (error) {
    const safe = safeError(error);
    if (connectionId && safe.code === 'auth_expired') {
      await service.from('email_sender_connections').update({
        status: 'expired', safe_error_code: 'auth_expired', last_error_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', connectionId).eq('company_id', actor.companyId);
    }
    await service.rpc('backend_finalize_test_email', {
      p_log_id: reserved.log_id, p_status: safe.code === 'sender_unverified' ? 'blocked' : 'failed',
      p_provider_message_id: null, p_safe_error_code: safe.code,
    });
    throw error;
  }
};

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('Origin');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST' || (origin && !allowedOrigins.includes(origin))) return respond(origin, { error: { code: 'invalid_request' } }, 403);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return respond(origin, { error: { code: 'configuration_error' } }, 503);
  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const actor = await resolveActor(request, service);
  if (!actor) return respond(origin, { error: { code: 'unauthorized' } }, 401);
  const requestId = crypto.randomUUID();
  let action = 'unknown';
  try {
    const body = await request.json() as RequestBody;
    action = typeof body.action === 'string' ? body.action : 'unknown';
    requireManager(actor);
    if (action === 'get_state') return respond(origin, { data: await statePayload(service, actor), requestId });
    if (action === 'send_test') return respond(origin, { data: await sendTest(service, actor, body), requestId });

    if (action === 'save_sender') {
      requireAdmin(actor);
      const mode = body.mode;
      const displayName = normalizeDisplayName(body.displayName);
      const replyTo = body.replyTo ? normalizeEmail(body.replyTo) : null;
      const testRateLimitPerHour = Number(body.testRateLimitPerHour);
      if (!displayName || (body.replyTo && !replyTo) || !Number.isInteger(testRateLimitPerHour) || testRateLimitPerHour < 1 || testRateLimitPerHour > 100) throw new Error('invalid_request');
      if (mode === 'platform') {
        const senderEmail = Deno.env.get('RESEND_FROM_EMAIL');
        if (!senderEmail) throw new EmailProviderError('configuration_error');
        await service.from('email_sender_settings').upsert({
          company_id: actor.companyId, mode, selected_connection_id: null, selected_domain_id: null,
          display_name: displayName, sender_email: senderEmail, reply_to_email: replyTo,
          test_rate_limit_per_hour: testRateLimitPerHour,
          created_by: actor.userId, updated_by: actor.userId, updated_at: new Date().toISOString(),
        }, { onConflict: 'company_id' });
      } else if (mode === 'verified_domain') {
        const domainId = typeof body.domainId === 'string' ? body.domainId : '';
        const senderEmail = normalizeEmail(body.senderEmail);
        const { data: domain } = await service.from('email_sender_domains').select('id,company_id,domain,status').eq('id', domainId).eq('company_id', actor.companyId).maybeSingle();
        if (!domain || !canAccessEmailTenant(actor.companyId, domain.company_id) || domain.status !== 'verified') throw new Error('domain_not_verified');
        if (!senderEmail || !emailBelongsToDomain(senderEmail, domain.domain)) throw new Error('invalid_sender');
        await service.from('email_sender_settings').upsert({
          company_id: actor.companyId, mode, selected_connection_id: null, selected_domain_id: domain.id,
          display_name: displayName, sender_email: senderEmail, reply_to_email: replyTo,
          test_rate_limit_per_hour: testRateLimitPerHour,
          created_by: actor.userId, updated_by: actor.userId, updated_at: new Date().toISOString(),
        }, { onConflict: 'company_id' });
      } else throw new Error('invalid_request');
      return respond(origin, { data: await statePayload(service, actor), requestId });
    }

    if (action === 'create_domain') {
      requireAdmin(actor);
      const domain = normalizeDomain(body.domain);
      const apiKey = Deno.env.get('RESEND_API_KEY');
      if (!domain || !apiKey) throw new Error(domain ? 'configuration_error' : 'invalid_domain');
      const providerDomain = await (providerRegistry.resolve('resend') as ResendEmailProvider).createDomain(apiKey, domain);
      const { data: created, error } = await service.from('email_sender_domains').insert({
        company_id: actor.companyId, domain, provider_domain_id: providerDomain.id, status: 'pending',
        created_by: actor.userId, updated_by: actor.userId,
      }).select().single();
      if (error) throw error;
      await service.from('email_sender_domain_dns_records').insert(providerDomain.records.map((record) => ({
        company_id: actor.companyId, domain_id: created.id, purpose: recordPurpose(record),
        record_type: record.type, host: record.name, value: record.value,
        priority: record.priority ?? null, status: record.status === 'verified' ? 'verified' : 'pending',
      })));
      return respond(origin, { data: await statePayload(service, actor), requestId });
    }

    if (action === 'verify_domain') {
      requireAdmin(actor);
      const domainId = typeof body.domainId === 'string' ? body.domainId : '';
      const { data: domain } = await service.from('email_sender_domains').select('*').eq('id', domainId).eq('company_id', actor.companyId).maybeSingle();
      const apiKey = Deno.env.get('RESEND_API_KEY');
      if (!domain || !canAccessEmailTenant(actor.companyId, domain.company_id) || !apiKey) throw new Error('invalid_domain');
      const result = await (providerRegistry.resolve('resend') as ResendEmailProvider).getDomain(apiKey, domain.provider_domain_id, true);
      const verified = result.status === 'verified';
      const statusFor = (purpose: string) => result.records.filter((record) => recordPurpose(record) === purpose).every((record) => record.status === 'verified') ? 'verified' : 'pending';
      await service.from('email_sender_domains').update({
        status: verified ? 'verified' : 'pending', spf_status: statusFor('spf'), dkim_status: statusFor('dkim'),
        last_checked_at: new Date().toISOString(), verified_at: verified ? new Date().toISOString() : null,
        updated_by: actor.userId, updated_at: new Date().toISOString(),
      }).eq('id', domain.id).eq('company_id', actor.companyId);
      for (const record of result.records) {
        await service.from('email_sender_domain_dns_records').update({
          status: record.status === 'verified' ? 'verified' : 'pending', last_checked_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq('domain_id', domain.id).eq('host', record.name).eq('company_id', actor.companyId);
      }
      return respond(origin, { data: await statePayload(service, actor), requestId });
    }

    if (action === 'start_oauth') {
      requireAdmin(actor);
      const provider = body.provider === 'google' || body.provider === 'microsoft' ? body.provider : null;
      if (!provider) throw new Error('invalid_request');
      const config = oauthConfig(provider);
      const state = randomUrlSafe(32);
      const verifier = randomUrlSafe(64);
      const nonce = randomUrlSafe(32);
      await service.rpc('backend_create_email_oauth_session', {
        p_actor_user_id: actor.userId, p_provider: provider,
        p_state_digest: toPostgresBytea(await digestSha256(state)), p_pkce_verifier: verifier,
        p_nonce_digest: toPostgresBytea(await digestSha256(nonce)), p_return_path: '/settings?tab=email-sending',
      });
      const authorize = provider === 'google'
        ? new URL('https://accounts.google.com/o/oauth2/v2/auth')
        : new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
      authorize.search = new URLSearchParams({
        client_id: config.clientId, response_type: 'code', redirect_uri: config.redirectUri,
        scope: provider === 'google'
          ? 'openid email https://www.googleapis.com/auth/gmail.send'
          : 'openid email offline_access https://graph.microsoft.com/Mail.Send',
        state, nonce, code_challenge: await createPkceChallenge(verifier), code_challenge_method: 'S256',
        ...(provider === 'google' ? { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'false' } : { response_mode: 'query' }),
      }).toString();
      return respond(origin, { data: { authorizationUrl: authorize.toString() }, requestId });
    }

    if (action === 'disconnect') {
      requireAdmin(actor);
      const connectionId = typeof body.connectionId === 'string' ? body.connectionId : '';
      const { data: credentials } = await service.rpc('backend_get_email_oauth_credentials', { p_actor_user_id: actor.userId, p_connection_id: connectionId });
      const credential = credentials?.[0];
      if (credential) await providerRegistry.resolve(credential.provider).disconnect({ accessToken: credential.access_token, refreshToken: credential.refresh_token }).catch(() => undefined);
      await service.rpc('backend_disconnect_email_connection', { p_actor_user_id: actor.userId, p_connection_id: connectionId });
      return respond(origin, { data: await statePayload(service, actor), requestId });
    }
    throw new Error('invalid_request');
  } catch (error) {
    const safe = safeError(error);
    console.log(JSON.stringify({ event: 'email_sender_request', requestId, action, code: safe.code }));
    return respond(origin, { error: { code: safe.code, message: 'Não foi possível concluir a operação de e-mail.' }, requestId }, safe.status);
  }
});
