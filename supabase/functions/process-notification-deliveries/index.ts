// Edge Function de entrega multi-canal do módulo de Notificações Inteligentes
// (Story 1.5). Processa notification_deliveries com status='queued' e
// next_retry_at vencido, reivindicando cada linha atomicamente
// (UPDATE ... WHERE status='queued') antes de tentar o envio — seguro contra
// invocações concorrentes/repetidas (ver Dev Notes da story sobre verify_jwt).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendPush } from './adapters/push.ts';
import { sendEmail, sendEmailDigest } from './adapters/email.ts';
import { sendSms } from './adapters/sms.ts';

const BATCH_SIZE = 50;
const MAX_BACKOFF_MINUTES = 60;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Supabase credentials not configured' }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const nowIso = new Date().toISOString();
  const results = { processed: 0, sent: 0, failed: 0, retried: 0 };

  // 1. Entregas individuais (push/email/sms)
  const { data: individualRows, error: individualError } = await supabase
    .from('notification_deliveries')
    .select('*')
    .in('channel', ['push', 'email', 'sms'])
    .eq('status', 'queued')
    .lte('next_retry_at', nowIso)
    .order('queued_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (individualError) {
    return new Response(JSON.stringify({ error: individualError.message }), { status: 500 });
  }

  for (const delivery of individualRows || []) {
    const { data: claimed } = await supabase
      .from('notification_deliveries')
      .update({ status: 'sending' })
      .eq('id', delivery.id)
      .eq('status', 'queued')
      .select()
      .maybeSingle();

    if (!claimed) continue;
    results.processed++;

    const { data: notification } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', delivery.notification_id)
      .maybeSingle();

    if (!notification) {
      await supabase
        .from('notification_deliveries')
        .update({ status: 'failed', last_error: 'notification not found', failed_at: nowIso })
        .eq('id', delivery.id);
      results.failed++;
      continue;
    }

    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', delivery.recipient_user_id)
      .maybeSingle();

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', delivery.recipient_user_id)
      .maybeSingle();

    try {
      let outcome: { provider: string; providerMessageId?: string };

      if (delivery.channel === 'push') {
        outcome = await sendPush(supabase, delivery, notification);
      } else if (delivery.channel === 'email') {
        outcome = await sendEmail(supabase, delivery, notification, prefs, profile);
      } else {
        outcome = await sendSms(delivery, notification, prefs);
      }

      await supabase
        .from('notification_deliveries')
        .update({
          status: 'sent',
          provider: outcome.provider,
          provider_message_id: outcome.providerMessageId || null,
          sent_at: new Date().toISOString(),
          attempt_count: delivery.attempt_count + 1,
        })
        .eq('id', delivery.id);
      results.sent++;
    } catch (err) {
      const attemptCount = delivery.attempt_count + 1;
      const isFinal = attemptCount >= delivery.max_attempts;
      const backoffMinutes = Math.min(MAX_BACKOFF_MINUTES, 2 ** attemptCount);

      await supabase
        .from('notification_deliveries')
        .update({
          status: isFinal ? 'failed' : 'queued',
          attempt_count: attemptCount,
          last_error: err instanceof Error ? err.message : String(err),
          failed_at: isFinal ? new Date().toISOString() : null,
          next_retry_at: isFinal ? null : new Date(Date.now() + backoffMinutes * 60_000).toISOString(),
        })
        .eq('id', delivery.id);

      if (isFinal) results.failed++;
      else results.retried++;
    }
  }

  // 2. Resumos de e-mail (email_digest) — agrupados por destinatário
  const { data: digestRows } = await supabase
    .from('notification_deliveries')
    .select('*, notifications(*)')
    .eq('channel', 'email_digest')
    .eq('status', 'queued')
    .lte('next_retry_at', nowIso)
    .limit(200);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byRecipient = new Map<string, any[]>();
  for (const row of digestRows || []) {
    const list = byRecipient.get(row.recipient_user_id) || [];
    list.push(row);
    byRecipient.set(row.recipient_user_id, list);
  }

  for (const [recipientId, rows] of byRecipient) {
    const ids = rows.map((r) => r.id);
    const { data: claimedRows } = await supabase
      .from('notification_deliveries')
      .update({ status: 'sending' })
      .in('id', ids)
      .eq('status', 'queued')
      .select();

    if (!claimedRows || claimedRows.length === 0) continue;

    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', recipientId)
      .maybeSingle();
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', recipientId)
      .maybeSingle();

    try {
      const outcome = await sendEmailDigest(supabase, rows, prefs, profile);
      await supabase
        .from('notification_deliveries')
        .update({ status: 'sent', provider: outcome.provider, sent_at: new Date().toISOString() })
        .in(
          'id',
          claimedRows.map((r: { id: string }) => r.id)
        );
      results.sent += claimedRows.length;
    } catch (err) {
      await supabase
        .from('notification_deliveries')
        .update({
          status: 'failed',
          last_error: err instanceof Error ? err.message : String(err),
          failed_at: new Date().toISOString(),
        })
        .in(
          'id',
          claimedRows.map((r: { id: string }) => r.id)
        );
      results.failed += claimedRows.length;
    }
  }

  return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
});
