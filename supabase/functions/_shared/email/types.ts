export type EmailProviderKind = 'resend' | 'google' | 'microsoft';
export type EmailSenderMode = 'platform' | 'verified_domain' | 'google_oauth' | 'microsoft_oauth';
export type EmailConnectionStatus = 'active' | 'pending' | 'expired' | 'error' | 'disconnected';

export interface TransactionalEmailMessage {
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
}

export interface EmailProviderContext {
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
}

export interface EmailSendReceipt {
  provider: EmailProviderKind;
  providerMessageId?: string;
  status: 'sent';
}

export interface SenderVerification {
  verified: boolean;
  status: EmailConnectionStatus;
}

export interface ProviderWebhookEvent {
  provider: EmailProviderKind;
  providerEventId: string;
  providerMessageId: string;
  type: 'sent' | 'delivered' | 'failed' | 'bounced' | 'blocked' | 'complained';
  occurredAt: string;
  safeCode?: string;
}

export interface EmailProvider {
  readonly kind: EmailProviderKind;
  connect(context: EmailProviderContext): Promise<EmailConnectionStatus>;
  disconnect(context: EmailProviderContext): Promise<void>;
  verifySender(context: EmailProviderContext): Promise<SenderVerification>;
  sendTransactionalEmail(context: EmailProviderContext, message: TransactionalEmailMessage): Promise<EmailSendReceipt>;
  getConnectionStatus(context: EmailProviderContext): Promise<EmailConnectionStatus>;
  refreshCredentials(context: EmailProviderContext): Promise<EmailProviderContext>;
  handleWebhookEvent?(rawBody: string, headers: Headers): Promise<ProviderWebhookEvent>;
}

export class EmailProviderError extends Error {
  constructor(
    public readonly code:
      | 'configuration_error'
      | 'auth_expired'
      | 'sender_unverified'
      | 'provider_rate_limited'
      | 'provider_unavailable'
      | 'invalid_request',
  ) {
    super(code);
    this.name = 'EmailProviderError';
  }
}
