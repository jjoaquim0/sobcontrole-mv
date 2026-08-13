import { supabase } from '../lib/supabase';

export type EmailSenderMode = 'platform' | 'verified_domain' | 'google_oauth' | 'microsoft_oauth';
export type EmailSenderStatus = 'active' | 'pending' | 'expired' | 'error' | 'disconnected';

export interface EmailSenderSettings {
  id: string;
  mode: EmailSenderMode;
  displayName: string;
  senderEmail?: string;
  replyToEmail?: string;
  sendingEnabled: boolean;
  testSendingEnabled: boolean;
  testRateLimitPerHour: number;
  selectedConnectionId?: string;
  selectedDomainId?: string;
  lastSentAt?: string;
}

export interface EmailConnection {
  id: string;
  provider: 'google' | 'microsoft';
  status: EmailSenderStatus;
  accountEmail: string;
  grantedScopes: string[];
  tokenExpiresAt?: string;
  safeErrorCode?: string;
}

export interface EmailDnsRecord {
  id: string;
  purpose: 'spf' | 'dkim' | 'return_path' | 'dmarc';
  recordType: 'TXT' | 'CNAME' | 'MX';
  host: string;
  value: string;
  priority?: number;
  status: 'pending' | 'verified' | 'failed';
}

export interface EmailDomain {
  id: string;
  domain: string;
  status: 'pending' | 'verified' | 'failed' | 'revoked';
  spfStatus: string;
  dkimStatus: string;
  dmarcStatus: string;
  lastCheckedAt?: string;
  records: EmailDnsRecord[];
}

export interface OutboundEmailLog {
  id: string;
  createdAt: string;
  senderDisplayName: string;
  senderEmail: string;
  recipientMasked: string;
  subjectLabel: string;
  origin: 'test' | 'notification' | 'manual' | 'system';
  provider: 'resend' | 'google' | 'microsoft';
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'blocked' | 'complained';
  safeErrorCode?: string;
  providerMessageId?: string;
}

export interface EmailSenderState {
  settings: EmailSenderSettings;
  connections: EmailConnection[];
  domains: EmailDomain[];
  history: OutboundEmailLog[];
  permissions: { canConfigure: boolean; canTest: boolean };
}

type DbRecord = Record<string, unknown>;

const EMAIL_ERROR_MESSAGES: Record<string, string> = {
  auth_expired: 'A conexão expirou ou foi revogada. Reconecte a conta para continuar.',
  domain_not_verified: 'O domínio ainda aguarda verificação DNS.',
  idempotency_conflict: 'Este envio já foi processado com dados diferentes.',
  invalid_domain: 'Informe um domínio válido, sem protocolo ou caminho.',
  invalid_sender: 'O remetente deve pertencer ao domínio verificado.',
  permission_denied: 'Seu perfil não tem permissão para esta operação.',
  provider_unavailable: 'O provedor de e-mail está temporariamente indisponível.',
  rate_limit_exceeded: 'Limite de testes atingido. Aguarde antes de tentar novamente.',
};

const safeEmailError = (code?: string): Error =>
  new Error((code && EMAIL_ERROR_MESSAGES[code]) || 'Não foi possível concluir a operação de e-mail.');

const mapSettings = (row: DbRecord): EmailSenderSettings => ({
  id: String(row.id),
  mode: row.mode as EmailSenderMode,
  displayName: String(row.display_name),
  senderEmail: row.sender_email ? String(row.sender_email) : undefined,
  replyToEmail: row.reply_to_email ? String(row.reply_to_email) : undefined,
  sendingEnabled: Boolean(row.sending_enabled),
  testSendingEnabled: Boolean(row.test_sending_enabled),
  testRateLimitPerHour: Number(row.test_rate_limit_per_hour),
  selectedConnectionId: row.selected_connection_id ? String(row.selected_connection_id) : undefined,
  selectedDomainId: row.selected_domain_id ? String(row.selected_domain_id) : undefined,
  lastSentAt: row.last_sent_at ? String(row.last_sent_at) : undefined,
});

const mapConnection = (row: DbRecord): EmailConnection => ({
  id: String(row.id),
  provider: row.provider as EmailConnection['provider'],
  status: row.status as EmailSenderStatus,
  accountEmail: String(row.account_email),
  grantedScopes: Array.isArray(row.granted_scopes) ? row.granted_scopes.map(String) : [],
  tokenExpiresAt: row.token_expires_at ? String(row.token_expires_at) : undefined,
  safeErrorCode: row.safe_error_code ? String(row.safe_error_code) : undefined,
});

const mapRecord = (row: DbRecord): EmailDnsRecord => ({
  id: String(row.id),
  purpose: row.purpose as EmailDnsRecord['purpose'],
  recordType: row.record_type as EmailDnsRecord['recordType'],
  host: String(row.host),
  value: String(row.value),
  priority: typeof row.priority === 'number' ? row.priority : undefined,
  status: row.status as EmailDnsRecord['status'],
});

const mapDomain = (row: DbRecord): EmailDomain => ({
  id: String(row.id),
  domain: String(row.domain),
  status: row.status as EmailDomain['status'],
  spfStatus: String(row.spf_status),
  dkimStatus: String(row.dkim_status),
  dmarcStatus: String(row.dmarc_status),
  lastCheckedAt: row.last_checked_at ? String(row.last_checked_at) : undefined,
  records: Array.isArray(row.records) ? row.records.map((record) => mapRecord(record as DbRecord)) : [],
});

const mapLog = (row: DbRecord): OutboundEmailLog => ({
  id: String(row.id),
  createdAt: String(row.created_at),
  senderDisplayName: String(row.sender_display_name),
  senderEmail: String(row.sender_email),
  recipientMasked: String(row.recipient_masked),
  subjectLabel: String(row.subject_label),
  origin: row.origin as OutboundEmailLog['origin'],
  provider: row.provider as OutboundEmailLog['provider'],
  status: row.status as OutboundEmailLog['status'],
  safeErrorCode: row.safe_error_code ? String(row.safe_error_code) : undefined,
  providerMessageId: row.provider_message_id ? String(row.provider_message_id) : undefined,
});

const mapState = (value: unknown): EmailSenderState => {
  const data = value as {
    settings: DbRecord;
    connections?: DbRecord[];
    domains?: DbRecord[];
    history?: DbRecord[];
    permissions: EmailSenderState['permissions'];
  };
  return {
    settings: mapSettings(data.settings),
    connections: (data.connections || []).map(mapConnection),
    domains: (data.domains || []).map(mapDomain),
    history: (data.history || []).map(mapLog),
    permissions: data.permissions,
  };
};

const invoke = async <T>(body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke('email-sender-api', { body });
  if (error) {
    const response = (error as { context?: unknown }).context;
    if (response instanceof Response) {
      const payload = await response.clone().json().catch(() => null) as { error?: { code?: string } } | null;
      throw safeEmailError(payload?.error?.code);
    }
    throw safeEmailError();
  }
  if (data?.error) {
    throw safeEmailError(data.error.code);
  }
  return data.data as T;
};

export const getEmailSenderState = async (): Promise<EmailSenderState> =>
  mapState(await invoke<unknown>({ action: 'get_state' }));

export const savePlatformSender = async (input: { displayName: string; replyTo?: string; testRateLimitPerHour: number }): Promise<EmailSenderState> =>
  mapState(await invoke<unknown>({ action: 'save_sender', mode: 'platform', ...input }));

export const saveDomainSender = async (input: { domainId: string; displayName: string; senderEmail: string; replyTo?: string; testRateLimitPerHour: number }): Promise<EmailSenderState> =>
  mapState(await invoke<unknown>({ action: 'save_sender', mode: 'verified_domain', ...input }));

export const createEmailDomain = async (domain: string): Promise<EmailSenderState> =>
  mapState(await invoke<unknown>({ action: 'create_domain', domain }));

export const verifyEmailDomain = async (domainId: string): Promise<EmailSenderState> =>
  mapState(await invoke<unknown>({ action: 'verify_domain', domainId }));

export const startEmailOAuth = async (provider: 'google' | 'microsoft'): Promise<string> => {
  const data = await invoke<{ authorizationUrl: string }>({ action: 'start_oauth', provider });
  return data.authorizationUrl;
};

export const disconnectEmailSender = async (connectionId: string): Promise<EmailSenderState> =>
  mapState(await invoke<unknown>({ action: 'disconnect', connectionId }));

export const sendTestEmail = async (recipient: string, idempotencyKey: string): Promise<{ id: string; status: 'queued' | 'sending' | 'sent' | 'delivered' | 'failed' | 'blocked' }> =>
  invoke({ action: 'send_test', recipient, idempotencyKey });
