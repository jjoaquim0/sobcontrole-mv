import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ResendEmailProvider } from '../../supabase/functions/_shared/email/providers/resend';
import { GoogleEmailProvider } from '../../supabase/functions/_shared/email/providers/google';
import { MicrosoftEmailProvider } from '../../supabase/functions/_shared/email/providers/microsoft';
import { EmailProviderError } from '../../supabase/functions/_shared/email/types';
import { canAccessEmailTenant, canPerformEmailAction } from '../../supabase/functions/_shared/email/authorization';
import { validateOAuthCallbackParams, verifyProviderIdToken } from '../../supabase/functions/_shared/email/oauth';
import {
  base64Url,
  createPkceChallenge,
  digestSha256,
  emailBelongsToDomain,
  maskEmail,
  normalizeDisplayName,
  normalizeDomain,
  normalizeEmail,
  normalizeIdempotencyKey,
} from '../../supabase/functions/_shared/email/validation';
import {
  parseResendWebhook,
  verifySvixSignature,
  webhookDeliveryResponseStatus,
  webhookExceptionResponseStatus,
} from '../../supabase/functions/_shared/email/webhook';

const projectFile = (...parts: string[]) => join(process.cwd(), ...parts);
const migration = readFileSync(projectFile('supabase', 'migrations', '20260805232055_email_transactional_multi_tenant.sql'), 'utf8');
const apiSource = readFileSync(projectFile('supabase', 'functions', 'email-sender-api', 'index.ts'), 'utf8');
const callbackSource = readFileSync(projectFile('supabase', 'functions', 'email-oauth-callback', 'index.ts'), 'utf8');
const clientSource = readFileSync(projectFile('src', 'services', 'emailSenderService.ts'), 'utf8');

describe('email sender input boundaries', () => {
  it('normalizes valid addresses and rejects header injection', () => {
    expect(normalizeEmail(' Admin@Empresa.COM ')).toBe('admin@empresa.com');
    expect(normalizeEmail('admin@empresa.com\r\nBcc: attacker@example.com')).toBeNull();
    expect(normalizeDisplayName('Empresa <script>')).toBeNull();
  });

  it('accepts only a plain DNS domain and enforces the sender domain', () => {
    expect(normalizeDomain('EMPRESA.COM.BR.')).toBe('empresa.com.br');
    expect(normalizeDomain('https://empresa.com.br')).toBeNull();
    expect(emailBelongsToDomain('financeiro@empresa.com.br', 'empresa.com.br')).toBe(true);
    expect(emailBelongsToDomain('financeiro@evil.com', 'empresa.com.br')).toBe(false);
  });

  it('masks recipients and constrains idempotency keys', () => {
    expect(maskEmail('pessoa@empresa.com')).toBe('p***@empresa.com');
    expect(normalizeIdempotencyKey('test:12345678')).toBe('test:12345678');
    expect(normalizeIdempotencyKey('short')).toBeNull();
  });
});

describe('provider and webhook hardening', () => {
  it('passes an idempotency header and never includes the API key in the payload', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'email_1' }), { status: 200 })) as unknown as typeof fetch;
    const provider = new ResendEmailProvider(fetcher);
    await provider.sendTransactionalEmail({ apiKey: 'secret-key' }, {
      fromEmail: 'no-reply@empresa.com', fromName: 'Empresa', to: 'pessoa@example.com',
      subject: 'Teste', text: 'Conteúdo fixo', html: '<p>Conteúdo fixo</p>', idempotencyKey: 'test:12345678',
    });
    const [, options] = vi.mocked(fetcher).mock.calls[0];
    expect(new Headers(options?.headers).get('Idempotency-Key')).toBe('test:12345678');
    expect(String(options?.body)).not.toContain('secret-key');
  });

  it('maps provider failures to a stable safe error code', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('raw provider secret', { status: 500 })) as unknown as typeof fetch;
    const provider = new ResendEmailProvider(fetcher);
    await expect(provider.sendTransactionalEmail({ apiKey: 'secret-key' }, {
      fromEmail: 'no-reply@empresa.com', fromName: 'Empresa', to: 'pessoa@example.com',
      subject: 'Teste', text: 'Fixo', html: '<p>Fixo</p>', idempotencyKey: 'test:12345678',
    })).rejects.toEqual(new EmailProviderError('provider_unavailable'));
  });

  it('propagates the stable intent into Google and Microsoft message metadata', async () => {
    const googleFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'gmail-1' }), { status: 200 })) as unknown as typeof fetch;
    const microsoftFetch = vi.fn().mockResolvedValue(new Response(null, { status: 202 })) as unknown as typeof fetch;
    const message = {
      fromEmail: 'no-reply@empresa.com', fromName: 'Empresa', to: 'pessoa@example.com',
      subject: 'Teste', text: 'Fixo', html: '<p>Fixo</p>', idempotencyKey: 'test:stable-intent',
    };
    await new GoogleEmailProvider(googleFetch).sendTransactionalEmail({ accessToken: 'access' }, message);
    await new MicrosoftEmailProvider(microsoftFetch).sendTransactionalEmail({ accessToken: 'access' }, message);
    const googleBody = JSON.parse(String(vi.mocked(googleFetch).mock.calls[0][1]?.body)) as { raw: string };
    const mime = new TextDecoder().decode(Uint8Array.from(atob(googleBody.raw.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0)));
    expect(mime).toContain('Message-ID: <test-stable-intent@sobcontrole.app>');
    const [, microsoftOptions] = vi.mocked(microsoftFetch).mock.calls[0];
    expect(new Headers(microsoftOptions?.headers).get('client-request-id')).toBe('test:stable-intent');
    expect(String(microsoftOptions?.body)).toContain('x-sobcontrole-idempotency-key');
  });

  it('accepts an authentic fresh Svix signature and rejects tampering or replay', async () => {
    const rawBody = JSON.stringify({ type: 'email.delivered', created_at: '2026-08-05T12:00:00Z', data: { email_id: 'email_1' } });
    const id = 'evt_1';
    const timestamp = '1785931200';
    const secretBytes = new TextEncoder().encode('webhook-secret-value');
    const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signed = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`)));
    const signature = `v1,${btoa(String.fromCharCode(...signed))}`;
    const secret = `whsec_${btoa(String.fromCharCode(...secretBytes))}`;
    expect(await verifySvixSignature({ rawBody, id, timestamp, signature, secret, now: Number(timestamp) * 1000 })).toBe(true);
    expect(await verifySvixSignature({ rawBody: `${rawBody} `, id, timestamp, signature, secret, now: Number(timestamp) * 1000 })).toBe(false);
    expect(await verifySvixSignature({ rawBody, id, timestamp, signature, secret, now: (Number(timestamp) + 301) * 1000 })).toBe(false);
    expect(parseResendWebhook(rawBody, id)).toMatchObject({ type: 'delivered', providerMessageId: 'email_1' });
    expect(webhookDeliveryResponseStatus(false, false)).toBe(503);
    expect(webhookDeliveryResponseStatus(true, false)).toBe(200);
    expect(webhookExceptionResponseStatus('parse')).toBe(200);
    expect(webhookExceptionResponseStatus('persistence')).toBe(503);
  });
});

describe('multi-tenant and OAuth contracts', () => {
  it('enforces the role matrix behavior independently of the UI', () => {
    expect(canPerformEmailAction('admin', 'configure')).toBe(true);
    expect(canPerformEmailAction('manager', 'view')).toBe(true);
    expect(canPerformEmailAction('manager', 'test')).toBe(true);
    expect(canPerformEmailAction('manager', 'configure')).toBe(false);
    expect(canPerformEmailAction('employee', 'view')).toBe(false);
    expect(canPerformEmailAction('employee', 'test')).toBe(false);
    expect(canAccessEmailTenant('company-a', 'company-a')).toBe(true);
    expect(canAccessEmailTenant('company-a', 'company-b')).toBe(false);
  });

  it('rejects malformed OAuth callback state/code and proves PKCE binding', async () => {
    const state = 'state_value_with_more_than_32_chars_123456';
    expect(validateOAuthCallbackParams(state, 'authorization-code')).toEqual({
      state,
      code: 'authorization-code',
    });
    expect(() => validateOAuthCallbackParams('short', 'authorization-code')).toThrow('invalid_oauth_state');
    expect(() => validateOAuthCallbackParams(state, 'bad\ncode')).toThrow('invalid_oauth_code');
    const validChallenge = await createPkceChallenge('v'.repeat(64));
    const attackerChallenge = await createPkceChallenge('a'.repeat(64));
    expect(validChallenge).not.toBe(attackerChallenge);
  });

  it('cryptographically rejects an OAuth ID token with a mismatched nonce', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify'],
    ) as CryptoKeyPair;
    const publicJwk = {
      ...await crypto.subtle.exportKey('jwk', keyPair.publicKey),
      kid: 'test-key',
    } as JsonWebKey & { kid: string };
    const nonce = 'oauth-nonce';
    const header = base64Url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', kid: 'test-key' })));
    const claims = base64Url(new TextEncoder().encode(JSON.stringify({
      aud: 'client-id', iss: 'https://accounts.google.com', sub: 'subject-1',
      email: 'admin@empresa.com', nonce, exp: Math.floor(Date.now() / 1000) + 300,
    })));
    const signingInput = `${header}.${claims}`;
    const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyPair.privateKey, new TextEncoder().encode(signingInput)));
    const token = `${signingInput}.${base64Url(signature)}`;
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 })) as unknown as typeof fetch;
    await expect(verifyProviderIdToken({ token, provider: 'google', clientId: 'client-id', nonceDigest: await digestSha256(nonce), fetcher })).resolves.toEqual({ subject: 'subject-1', email: 'admin@empresa.com' });
    await expect(verifyProviderIdToken({ token, provider: 'google', clientId: 'client-id', nonceDigest: await digestSha256('attacker-nonce'), fetcher })).rejects.toThrow('invalid_id_token');
  });
  it('enables RLS on every public email table and limits reads to the current admin or manager tenant', () => {
    expect(migration.match(/ENABLE ROW LEVEL SECURITY/g)).toHaveLength(8);
    expect(migration.match(/company_id = \(SELECT public\.get_user_company_id\(\)\)/g)?.length).toBeGreaterThanOrEqual(6);
    expect(migration.match(/get_user_role\(\)\) IN \('admin', 'manager'\)/g)?.length).toBeGreaterThanOrEqual(6);
    expect(migration).toContain('REVOKE ALL ON ALL TABLES IN SCHEMA private');
    expect(migration).toContain('REVOKE ALL ON TABLE vault.secrets, vault.decrypted_secrets');
    expect(migration).toContain('CREATE TRIGGER cleanup_email_credentials_vault');
    expect(migration).toContain('CREATE TRIGGER cleanup_email_oauth_vault');
  });

  it('derives tenant and actor from the authenticated profile, never from the client payload', () => {
    expect(apiSource).toContain("select('id, company_id, role, name')");
    expect(apiSource).toContain('companyId: profile.company_id');
    expect(clientSource).not.toMatch(/companyId|company_id/);
    expect(clientSource).not.toMatch(/accessToken|refreshToken|clientSecret|SERVICE_ROLE/);
  });

  it('uses one-time expiring OAuth state, PKCE, nonce, signed ID tokens and minimum scopes', async () => {
    expect(await createPkceChallenge('a'.repeat(64))).toHaveLength(43);
    expect(migration).toContain('consumed_at IS NULL AND s.expires_at > now()');
    expect(callbackSource).toContain('verifyProviderIdToken');
    expect(migration).toContain('DELETE FROM private.email_oauth_sessions');
    expect(migration).toContain('DELETE FROM vault.secrets WHERE id IN (v_old.refresh_token_secret_id');
    expect(apiSource).toContain('code_challenge_method: \'S256\'');
    expect(apiSource).toContain('https://www.googleapis.com/auth/gmail.send');
    expect(apiSource).toContain('https://graph.microsoft.com/Mail.Send');
    expect(apiSource).not.toMatch(/gmail\.readonly|Mail\.Read/);
  });

  it('implements tenant idempotency plus global, company, user and recipient limits', () => {
    expect(migration).toContain('UNIQUE (company_id, idempotency_key)');
    expect(migration).toContain("RAISE EXCEPTION 'idempotency_conflict'");
    for (const limit of ['global_rate_limit', 'company_rate_limit', 'user_rate_limit', 'recipient_rate_limit']) {
      expect(migration).toContain(limit);
    }
    expect(migration).toContain("pg_advisory_xact_lock(hashtextextended('email-global-test-rate'");
    expect(migration).toContain('v_settings.test_rate_limit_per_hour');
    expect(migration).toContain("created_at >= now() - interval '5 minutes'");
  });

  it('blocks unverified domains and persists no body or raw recipient column', () => {
    expect(apiSource).toContain("domain.status !== 'verified'");
    expect(apiSource).toContain("subject: 'Teste de envio");
    expect(migration).not.toMatch(/recipient_email|message_body|html_body|text_body/);
    expect(migration).toContain('recipient_masked');
    expect(migration).toContain('recipient_hash BYTEA');
  });
});
