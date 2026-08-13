import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { exchangeOAuthCode, validateOAuthCallbackParams, verifyProviderIdToken } from '../_shared/email/oauth.ts';
import { digestSha256, toPostgresBytea } from '../_shared/email/validation.ts';

const redirectWithResult = (returnPath: string, result: 'success' | 'error'): Response => {
  const appOrigin = Deno.env.get('EMAIL_APP_ORIGIN') || 'http://localhost:5174';
  const target = new URL(returnPath, appOrigin);
  target.searchParams.set('emailOauth', result);
  return Response.redirect(target.toString(), 303);
};

Deno.serve(async (request: Request) => {
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  const requestUrl = new URL(request.url);
  let state: string;
  let code: string;
  try {
    ({ state, code } = validateOAuthCallbackParams(
      requestUrl.searchParams.get('state'),
      requestUrl.searchParams.get('code'),
    ));
  } catch {
    return redirectWithResult('/settings?tab=email-sending', 'error');
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return redirectWithResult('/settings?tab=email-sending', 'error');
  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let returnPath = '/settings?tab=email-sending';
  try {
    const { data, error } = await service.rpc('backend_consume_email_oauth_session', {
      p_state_digest: toPostgresBytea(await digestSha256(state)),
    });
    const session = data?.[0];
    if (error || !session) throw new Error('invalid_oauth_state');
    returnPath = session.return_path;
    const prefix = session.provider === 'google' ? 'GOOGLE' : 'MICROSOFT';
    const clientId = Deno.env.get(`${prefix}_EMAIL_CLIENT_ID`);
    const clientSecret = Deno.env.get(`${prefix}_EMAIL_CLIENT_SECRET`);
    const redirectUri = Deno.env.get(`${prefix}_EMAIL_REDIRECT_URI`);
    if (!clientId || !clientSecret || !redirectUri) throw new Error('configuration_error');
    const tokens = await exchangeOAuthCode({
      provider: session.provider, code, verifier: session.pkce_verifier,
      redirectUri, clientId, clientSecret,
    });
    const identity = await verifyProviderIdToken({
      token: tokens.id_token, provider: session.provider, clientId,
      nonceDigest: Uint8Array.from((session.nonce_digest as string).replace(/^\\x/, '').match(/.{2}/g) || [], (hex) => Number.parseInt(hex, 16)),
    });
    if (!tokens.refresh_token) throw new Error('refresh_token_missing');
    const expectedScope = session.provider === 'google'
      ? 'https://www.googleapis.com/auth/gmail.send'
      : 'https://graph.microsoft.com/Mail.Send';
    const scopes = (tokens.scope || expectedScope).split(' ').filter(Boolean);
    if (!scopes.includes(expectedScope)) throw new Error('invalid_scope');
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const { error: storeError } = await service.rpc('backend_store_email_oauth_connection', {
      p_actor_user_id: session.actor_user_id,
      p_provider: session.provider,
      p_provider_subject: identity.subject,
      p_account_email: identity.email,
      p_granted_scopes: scopes,
      p_access_token: tokens.access_token,
      p_refresh_token: tokens.refresh_token,
      p_token_expires_at: expiresAt,
    });
    if (storeError) throw storeError;
    return redirectWithResult(returnPath, 'success');
  } catch {
    return redirectWithResult(returnPath, 'error');
  }
});
