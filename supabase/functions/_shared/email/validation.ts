const EMAIL_PATTERN = /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/;
const DOMAIN_PATTERN = /^(?=.{4,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export const normalizeEmail = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length <= 254 && EMAIL_PATTERN.test(normalized) ? normalized : null;
};

export const normalizeDomain = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/\.$/, '');
  if (normalized.includes('://') || normalized.includes('@') || normalized.includes(':')) return null;
  return DOMAIN_PATTERN.test(normalized) ? normalized : null;
};

export const emailBelongsToDomain = (email: string, domain: string): boolean => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedDomain = normalizeDomain(domain);
  return !!normalizedEmail && !!normalizedDomain && normalizedEmail.endsWith(`@${normalizedDomain}`);
};

export const maskEmail = (email: string): string => {
  const normalized = normalizeEmail(email);
  if (!normalized) return '***';
  const [local, domain] = normalized.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
};

export const normalizeDisplayName = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized && normalized.length <= 100 && !/[\r\n<>]/.test(normalized) ? normalized : null;
};

export const normalizeIdempotencyKey = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  return /^[A-Za-z0-9:_./-]{8,200}$/.test(value) ? value : null;
};

export const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

export const digestSha256 = async (value: string): Promise<Uint8Array> =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));

export const hmacSha256 = async (value: string, secret: string): Promise<Uint8Array> => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
};

export const toPostgresBytea = (bytes: Uint8Array): string => `\\x${bytesToHex(bytes)}`;

export const base64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

export const randomUrlSafe = (size = 32): string => {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
};

export const createPkceChallenge = async (verifier: string): Promise<string> =>
  base64Url(await digestSha256(verifier));

export const safeProviderCode = (status: number): string => {
  if (status === 401 || status === 403) return 'auth_expired';
  if (status === 429) return 'provider_rate_limited';
  if (status >= 500) return 'provider_unavailable';
  return 'provider_rejected';
};
