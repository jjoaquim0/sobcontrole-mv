import type { ProviderWebhookEvent } from './types.ts';

const decodeSecret = (secret: string): Uint8Array => {
  const value = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
};

const timingSafeEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
};

export const verifySvixSignature = async (input: {
  rawBody: string;
  id: string;
  timestamp: string;
  signature: string;
  secret: string;
  now?: number;
}): Promise<boolean> => {
  const timestamp = Number(input.timestamp);
  const nowSeconds = Math.floor((input.now ?? Date.now()) / 1000);
  if (!Number.isInteger(timestamp) || Math.abs(nowSeconds - timestamp) > 300) return false;
  const decodedSecret = decodeSecret(input.secret);
  const keyMaterial = new Uint8Array(decodedSecret.byteLength);
  keyMaterial.set(decodedSecret);
  const key = await crypto.subtle.importKey(
    'raw', keyMaterial.buffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const expected = new Uint8Array(await crypto.subtle.sign(
    'HMAC', key, new TextEncoder().encode(`${input.id}.${input.timestamp}.${input.rawBody}`),
  ));
  return input.signature.split(' ').some((candidate) => {
    const [version, encoded] = candidate.split(',');
    if (version !== 'v1' || !encoded) return false;
    try {
      return timingSafeEqual(expected, Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0)));
    } catch {
      return false;
    }
  });
};

export const parseResendWebhook = (rawBody: string, eventId: string): ProviderWebhookEvent => {
  const payload = JSON.parse(rawBody) as {
    type?: string;
    created_at?: string;
    data?: { email_id?: string };
  };
  const typeMap: Record<string, ProviderWebhookEvent['type']> = {
    'email.sent': 'sent',
    'email.delivered': 'delivered',
    'email.failed': 'failed',
    'email.bounced': 'bounced',
    'email.suppressed': 'blocked',
    'email.complained': 'complained',
  };
  const type = payload.type ? typeMap[payload.type] : undefined;
  if (!type || !payload.data?.email_id || !payload.created_at) throw new Error('unsupported_event');
  return {
    provider: 'resend', providerEventId: eventId, providerMessageId: payload.data.email_id,
    type, occurredAt: payload.created_at, safeCode: payload.type,
  };
};

export const webhookDeliveryResponseStatus = (recorded: boolean, hasDatabaseError: boolean): 200 | 503 =>
  !hasDatabaseError && recorded ? 200 : 503;

export const webhookExceptionResponseStatus = (stage: 'parse' | 'persistence'): 200 | 503 =>
  stage === 'parse' ? 200 : 503;
