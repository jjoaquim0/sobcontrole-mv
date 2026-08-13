import type { EmailProvider, EmailProviderContext, EmailSendReceipt, TransactionalEmailMessage } from '../types.ts';
import { EmailProviderError } from '../types.ts';
import { safeProviderCode } from '../validation.ts';

export class MicrosoftEmailProvider implements EmailProvider {
  readonly kind = 'microsoft' as const;
  constructor(private readonly fetcher: typeof fetch = fetch) {}
  async connect(context: EmailProviderContext) { return context.accessToken ? 'active' as const : 'error' as const; }
  async disconnect(): Promise<void> {}
  async verifySender(context: EmailProviderContext) { return { verified: !!context.accessToken, status: context.accessToken ? 'active' as const : 'expired' as const }; }
  async getConnectionStatus(context: EmailProviderContext) { return context.accessToken ? 'active' as const : 'expired' as const; }
  async refreshCredentials(context: EmailProviderContext) { return context; }
  async sendTransactionalEmail(context: EmailProviderContext, message: TransactionalEmailMessage): Promise<EmailSendReceipt> {
    if (!context.accessToken) throw new EmailProviderError('auth_expired');
    const response = await this.fetcher('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: { Authorization: `Bearer ${context.accessToken}`, 'Content-Type': 'application/json', 'client-request-id': message.idempotencyKey },
      body: JSON.stringify({
        message: {
          subject: message.subject,
          body: { contentType: 'Text', content: message.text },
          toRecipients: [{ emailAddress: { address: message.to } }],
          replyTo: message.replyTo ? [{ emailAddress: { address: message.replyTo } }] : [],
          internetMessageHeaders: [{ name: 'x-sobcontrole-idempotency-key', value: message.idempotencyKey }],
        },
        saveToSentItems: true,
      }),
    });
    if (!response.ok) throw new EmailProviderError(safeProviderCode(response.status) as EmailProviderError['code']);
    return { provider: 'microsoft', status: 'sent' };
  }
}
