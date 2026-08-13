import type {
  EmailConnectionStatus,
  EmailProvider,
  EmailProviderContext,
  EmailSendReceipt,
  SenderVerification,
  TransactionalEmailMessage,
} from '../types.ts';
import { EmailProviderError } from '../types.ts';
import { safeProviderCode } from '../validation.ts';

export interface ResendDomainRecord {
  record: string;
  name: string;
  type: 'TXT' | 'CNAME' | 'MX';
  value: string;
  status: string;
  priority?: number;
}

export interface ResendDomain {
  id: string;
  name: string;
  status: string;
  records: ResendDomainRecord[];
}

export class ResendEmailProvider implements EmailProvider {
  readonly kind = 'resend' as const;

  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async connect(context: EmailProviderContext): Promise<EmailConnectionStatus> {
    if (!context.apiKey) throw new EmailProviderError('configuration_error');
    return 'active';
  }

  async disconnect(): Promise<void> {}

  async verifySender(context: EmailProviderContext): Promise<SenderVerification> {
    return { verified: !!context.apiKey, status: context.apiKey ? 'active' : 'error' };
  }

  async getConnectionStatus(context: EmailProviderContext): Promise<EmailConnectionStatus> {
    return context.apiKey ? 'active' : 'error';
  }

  async refreshCredentials(context: EmailProviderContext): Promise<EmailProviderContext> {
    return context;
  }

  async sendTransactionalEmail(
    context: EmailProviderContext,
    message: TransactionalEmailMessage,
  ): Promise<EmailSendReceipt> {
    if (!context.apiKey) throw new EmailProviderError('configuration_error');
    const response = await this.fetcher('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${context.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': message.idempotencyKey,
      },
      body: JSON.stringify({
        from: `${message.fromName} <${message.fromEmail}>`,
        to: [message.to],
        reply_to: message.replyTo,
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
    if (!response.ok) throw new EmailProviderError(safeProviderCode(response.status) as EmailProviderError['code']);
    const result = await response.json() as { id?: string };
    return { provider: 'resend', providerMessageId: result.id, status: 'sent' };
  }

  async createDomain(apiKey: string, domain: string): Promise<ResendDomain> {
    const response = await this.fetcher('https://api.resend.com/domains', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: domain, capabilities: { sending: 'enabled', receiving: 'disabled' } }),
    });
    if (!response.ok) throw new EmailProviderError(safeProviderCode(response.status) as EmailProviderError['code']);
    return response.json() as Promise<ResendDomain>;
  }

  async getDomain(apiKey: string, domainId: string, verify = false): Promise<ResendDomain> {
    if (verify) {
      const verification = await this.fetcher(`https://api.resend.com/domains/${encodeURIComponent(domainId)}/verify`, {
        method: 'POST', headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!verification.ok) throw new EmailProviderError(safeProviderCode(verification.status) as EmailProviderError['code']);
    }
    const response = await this.fetcher(`https://api.resend.com/domains/${encodeURIComponent(domainId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) throw new EmailProviderError(safeProviderCode(response.status) as EmailProviderError['code']);
    return response.json() as Promise<ResendDomain>;
  }
}
