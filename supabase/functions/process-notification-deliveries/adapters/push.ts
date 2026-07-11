import webpush from 'npm:web-push@3.6.7';

interface DeliveryOutcome {
  provider: string;
  providerMessageId?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendPush(supabase: any, delivery: any, notification: any): Promise<DeliveryOutcome> {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT') || 'mailto:contato@sobcontrole.com';

  if (!publicKey || !privateKey) {
    throw new Error('VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY não configurados nos secrets da Edge Function.');
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const { data: subscriptions } = await supabase
    .from('notification_push_subscriptions')
    .select('*')
    .eq('user_id', delivery.recipient_user_id);

  if (!subscriptions || subscriptions.length === 0) {
    throw new Error('Nenhuma assinatura de push registrada para este usuário.');
  }

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.message,
    url: '/notifications',
  });

  let lastError: unknown;
  let sentToAny = false;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        payload
      );
      sentToAny = true;
    } catch (err) {
      lastError = err;
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        // Endpoint expirado/inválido — remove a assinatura obsoleta.
        await supabase.from('notification_push_subscriptions').delete().eq('id', sub.id);
      }
    }
  }

  if (!sentToAny) {
    throw lastError instanceof Error ? lastError : new Error('Falha ao enviar notificação push.');
  }

  return { provider: 'web-push' };
}
