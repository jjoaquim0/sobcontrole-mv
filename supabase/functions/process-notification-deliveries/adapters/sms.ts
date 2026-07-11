interface DeliveryOutcome {
  provider: string;
  providerMessageId?: string;
}

// Referência genérica via Twilio (documentado no README). A interface
// (delivery, notification, prefs) -> DeliveryOutcome é a mesma para
// push/email, então trocar por um provedor BR (Zenvia, Total Voice etc.)
// exige apenas substituir o corpo desta função.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendSms(_delivery: any, notification: any, prefs: any): Promise<DeliveryOutcome> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_FROM_NUMBER');

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM_NUMBER não configurados nos secrets da Edge Function.');
  }

  const to = prefs?.phone;
  if (!to) throw new Error('Nenhum telefone de destino configurado para este usuário.');

  const body = `${notification.title} - ${notification.message}`.slice(0, 300);
  const credentials = btoa(`${accountSid}:${authToken}`);

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: fromNumber, To: to, Body: body }).toString(),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Twilio retornou ${response.status}: ${errBody}`);
  }

  const result = await response.json();
  return { provider: 'twilio', providerMessageId: result.sid };
}
