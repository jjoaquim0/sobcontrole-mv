import { base64Url, digestSha256 } from './validation.ts';

interface JwtHeader { alg?: string; kid?: string }
type ProviderJwk = JsonWebKey & { kid?: string };
interface JwtClaims {
  aud?: string;
  iss?: string;
  sub?: string;
  email?: string;
  preferred_username?: string;
  nonce?: string;
  exp?: number;
}

const decodeBase64Url = (value: string): Uint8Array => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

const parseJsonPart = <T>(value: string): T =>
  JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;

const asArrayBuffer = (value: Uint8Array): ArrayBuffer =>
  value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;

export const validateOAuthCallbackParams = (
  state: string | null,
  code: string | null,
): { state: string; code: string } => {
  if (!state || !/^[A-Za-z0-9_-]{32,128}$/.test(state)) throw new Error('invalid_oauth_state');
  const hasControlCharacter = code
    ? Array.from(code).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
    : false;
  if (!code || code.length > 4096 || hasControlCharacter) throw new Error('invalid_oauth_code');
  return { state, code };
};

export const verifyProviderIdToken = async (input: {
  token: string;
  provider: 'google' | 'microsoft';
  clientId: string;
  nonceDigest: Uint8Array;
  fetcher?: typeof fetch;
}): Promise<{ subject: string; email: string }> => {
  const parts = input.token.split('.');
  if (parts.length !== 3) throw new Error('invalid_id_token');
  const header = parseJsonPart<JwtHeader>(parts[0]);
  const claims = parseJsonPart<JwtClaims>(parts[1]);
  if (header.alg !== 'RS256' || !header.kid || !claims.sub || !claims.exp || claims.exp * 1000 <= Date.now()) {
    throw new Error('invalid_id_token');
  }
  if (claims.aud !== input.clientId || typeof claims.nonce !== 'string') throw new Error('invalid_id_token');
  const nonceDigest = await digestSha256(claims.nonce);
  if (base64Url(nonceDigest) !== base64Url(input.nonceDigest)) throw new Error('invalid_id_token');

  const isGoogleIssuer = claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com';
  const isMicrosoftIssuer = typeof claims.iss === 'string' && /^https:\/\/login\.microsoftonline\.com\/[0-9a-f-]+\/v2\.0$/i.test(claims.iss);
  if ((input.provider === 'google' && !isGoogleIssuer) || (input.provider === 'microsoft' && !isMicrosoftIssuer)) {
    throw new Error('invalid_id_token');
  }

  const jwksUrl = input.provider === 'google'
    ? 'https://www.googleapis.com/oauth2/v3/certs'
    : `${claims.iss!.replace(/\/v2\.0$/, '')}/discovery/v2.0/keys`;
  const response = await (input.fetcher ?? fetch)(jwksUrl);
  if (!response.ok) throw new Error('idp_unavailable');
  const jwks = await response.json() as { keys?: ProviderJwk[] };
  const jwk = jwks.keys?.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error('invalid_id_token');
  const key = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'],
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    asArrayBuffer(decodeBase64Url(parts[2])),
    asArrayBuffer(new TextEncoder().encode(`${parts[0]}.${parts[1]}`)),
  );
  if (!valid) throw new Error('invalid_id_token');
  const email = claims.email || claims.preferred_username;
  if (!email) throw new Error('email_claim_missing');
  return { subject: claims.sub, email: email.toLowerCase() };
};

export interface OAuthTokenResult {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token: string;
  scope?: string;
}

export const exchangeOAuthCode = async (input: {
  provider: 'google' | 'microsoft';
  code: string;
  verifier: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
  fetcher?: typeof fetch;
}): Promise<OAuthTokenResult> => {
  const endpoint = input.provider === 'google'
    ? 'https://oauth2.googleapis.com/token'
    : 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  const body = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    code: input.code,
    code_verifier: input.verifier,
    redirect_uri: input.redirectUri,
    grant_type: 'authorization_code',
  });
  const response = await (input.fetcher ?? fetch)(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) throw new Error('oauth_exchange_failed');
  const result = await response.json() as Partial<OAuthTokenResult>;
  if (!result.access_token || !result.id_token || typeof result.expires_in !== 'number') {
    throw new Error('oauth_exchange_failed');
  }
  return result as OAuthTokenResult;
};

export const refreshOAuthToken = async (input: {
  provider: 'google' | 'microsoft';
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  fetcher?: typeof fetch;
}): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> => {
  const endpoint = input.provider === 'google'
    ? 'https://oauth2.googleapis.com/token'
    : 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  const scope = input.provider === 'microsoft'
    ? 'openid email offline_access https://graph.microsoft.com/Mail.Send'
    : undefined;
  const body = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    refresh_token: input.refreshToken,
    grant_type: 'refresh_token',
  });
  if (scope) body.set('scope', scope);
  const response = await (input.fetcher ?? fetch)(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  if (!response.ok) throw new Error('auth_expired');
  const result = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!result.access_token || typeof result.expires_in !== 'number') throw new Error('auth_expired');
  return { accessToken: result.access_token, refreshToken: result.refresh_token, expiresIn: result.expires_in };
};
