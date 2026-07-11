import { renderTemplate } from '../render.ts';

interface DeliveryOutcome {
  provider: string;
  providerMessageId?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadTemplate(supabase: any, companyId: string, channel: string) {
  const { data } = await supabase
    .from('notification_templates')
    .select('*')
    .or(`company_id.eq.${companyId},company_id.is.null`)
    .eq('channel', channel)
    .eq('is_active', true)
    .order('company_id', { ascending: false, nullsFirst: false })
    .limit(1);

  return data?.[0] || null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendEmail(supabase: any, _delivery: any, notification: any, prefs: any, profile: any): Promise<DeliveryOutcome> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'notificacoes@sobcontrole.app';

  if (!apiKey) {
    throw new Error('RESEND_API_KEY não configurada nos secrets da Edge Function.');
  }

  const to = prefs?.notification_email || profile?.email;
  if (!to) throw new Error('Nenhum e-mail de destino disponível para este usuário.');

  const template = await loadTemplate(supabase, notification.company_id, 'email');
  const variables: Record<string, string> = {
    title: notification.title,
    message: notification.message,
    summary: notification.ai_summary || '',
    link: 'https://app.sobcontrole.com/notifications',
    companyName: 'SobControle',
    categoryLabel: notification.category,
    priorityLabel: notification.priority,
  };

  const subject = template?.subject_template ? renderTemplate(template.subject_template, variables) : notification.title;
  const html = template?.body_template ? renderTemplate(template.body_template, variables) : `<p>${notification.message}</p>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromEmail, to, subject, html }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend retornou ${response.status}: ${body}`);
  }

  const result = await response.json();
  return { provider: 'resend', providerMessageId: result.id };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendEmailDigest(_supabase: any, deliveries: any[], prefs: any, profile: any): Promise<DeliveryOutcome> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'notificacoes@sobcontrole.app';
  if (!apiKey) throw new Error('RESEND_API_KEY não configurada nos secrets da Edge Function.');

  const to = prefs?.notification_email || profile?.email;
  if (!to) throw new Error('Nenhum e-mail de destino disponível para este usuário.');

  const items = deliveries
    .map((d) => `<li><strong>${d.notifications?.title || ''}</strong> — ${d.notifications?.message || ''}</li>`)
    .join('');
  const html = `<h2>Resumo de notificações — SobControle</h2><ul>${items}</ul>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromEmail, to, subject: `Resumo de notificações (${deliveries.length})`, html }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend retornou ${response.status}: ${body}`);
  }

  return { provider: 'resend' };
}
