import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { digestSha256, toPostgresBytea } from '../_shared/email/validation.ts';
import {
  parseResendWebhook,
  verifySvixSignature,
  webhookDeliveryResponseStatus,
  webhookExceptionResponseStatus,
} from '../_shared/email/webhook.ts';

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = Deno.env.get('RESEND_WEBHOOK_SECRET');
  const id = request.headers.get('svix-id');
  const timestamp = request.headers.get('svix-timestamp');
  const signature = request.headers.get('svix-signature');
  const rawBody = await request.text();
  if (!secret || !id || !timestamp || !signature || !(await verifySvixSignature({ rawBody, id, timestamp, signature, secret }))) {
    return new Response('Invalid webhook', { status: 400 });
  }
  let event;
  try {
    event = parseResendWebhook(rawBody, id);
  } catch {
    return new Response('Unsupported webhook', { status: webhookExceptionResponseStatus('parse') });
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return new Response('Unavailable', { status: 503 });
  try {
    const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: recorded, error } = await service.rpc('backend_record_email_webhook', {
      p_provider: event.provider,
      p_provider_message_id: event.providerMessageId,
      p_provider_event_id: event.providerEventId,
      p_event_type: event.type,
      p_occurred_at: event.occurredAt,
      p_payload_digest: toPostgresBytea(await digestSha256(rawBody)),
      p_safe_code: event.safeCode || null,
    });
    const responseStatus = webhookDeliveryResponseStatus(recorded === true, Boolean(error));
    if (responseStatus === 503) return new Response('Retry later', { status: responseStatus });
    return new Response('ok', { status: 200 });
  } catch {
    return new Response('Retry later', { status: webhookExceptionResponseStatus('persistence') });
  }
});
