import type { EmailProvider, EmailProviderContext, EmailSendReceipt, TransactionalEmailMessage } from '../types.ts';
import { EmailProviderError } from '../types.ts';
import { base64Url, safeProviderCode } from '../validation.ts';

const encodeMime = (message: TransactionalEmailMessage): string => {
  const messageId = message.idempotencyKey.replace(/[^A-Za-z0-9._-]/g, '-');
  const lines = [
    `From: ${message.fromName} <${message.fromEmail}>`,
    `To: ${message.to}`,
    `Message-ID: <${messageId}@sobcontrole.app>`,
    `Subject: =?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(message.subject)))}?=`,
    ...(message.replyTo ? [`Reply-To: ${message.replyTo}`] : []),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    message.text,
  ];
  return base64Url(new TextEncoder().encode(lines.join('\r\n')));
};

export class GoogleEmailProvider implements EmailProvider {
  readonly kind = 'google' as const;
  constructor(private readonly fetcher: typeof fetch = fetch) {}
  async connect(context: EmailProviderContext) { return context.accessToken ? 'active' as const : 'error' as const; }
  async disconnect(context: EmailProviderContext): Promise<void> {
    if (context.refreshToken || context.accessToken) {
      await this.fetcher(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(context.refreshToken || context.accessToken || '')}`, { method: 'POST' });
    }
  }
  async verifySender(context: EmailProviderContext) { return { verified: !!context.accessToken, status: context.accessToken ? 'active' as const : 'expired' as const }; }
  async getConnectionStatus(context: EmailProviderContext) { return context.accessToken ? 'active' as const : 'expired' as const; }
  async refreshCredentials(context: EmailProviderContext) { return context; }
  async sendTransactionalEmail(context: EmailProviderContext, message: TransactionalEmailMessage): Promise<EmailSendReceipt> {
    if (!context.accessToken) throw new EmailProviderError('auth_expired');
    const response = await this.fetcher('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${context.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: encodeMime(message) }),
    });
    if (!response.ok) throw new EmailProviderError(safeProviderCode(response.status) as EmailProviderError['code']);
    const result = await response.json() as { id?: string };
    return { provider: 'google', providerMessageId: result.id, status: 'sent' };
  }
}
