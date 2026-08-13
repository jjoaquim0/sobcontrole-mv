-- Story 1.34 - transactional email senders, tenant isolation and observability.
-- Tokens are stored in Supabase Vault. Public tables contain sanitized metadata only.

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE public.email_sender_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'error', 'disconnected')),
  provider_subject TEXT,
  account_email TEXT NOT NULL,
  granted_scopes TEXT[] NOT NULL DEFAULT '{}',
  token_expires_at TIMESTAMPTZ,
  last_refreshed_at TIMESTAMPTZ,
  safe_error_code TEXT,
  last_error_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  updated_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, company_id)
);

CREATE UNIQUE INDEX email_sender_connections_active_provider_uq
  ON public.email_sender_connections(company_id, provider)
  WHERE disconnected_at IS NULL;
CREATE INDEX email_sender_connections_company_status_idx
  ON public.email_sender_connections(company_id, status);

CREATE TABLE public.email_sender_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'resend' CHECK (provider = 'resend'),
  provider_domain_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed', 'revoked')),
  spf_status TEXT NOT NULL DEFAULT 'pending' CHECK (spf_status IN ('pending', 'verified', 'failed', 'not_configured')),
  dkim_status TEXT NOT NULL DEFAULT 'pending' CHECK (dkim_status IN ('pending', 'verified', 'failed', 'not_configured')),
  dmarc_status TEXT NOT NULL DEFAULT 'not_configured' CHECK (dmarc_status IN ('pending', 'verified', 'failed', 'not_configured')),
  safe_error_code TEXT,
  last_checked_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  updated_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, company_id),
  CHECK (domain = lower(domain)),
  CHECK (domain !~ '[\r\n]')
);

CREATE UNIQUE INDEX email_sender_domains_company_domain_uq
  ON public.email_sender_domains(company_id, lower(domain)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX email_sender_domains_verified_domain_uq
  ON public.email_sender_domains(lower(domain)) WHERE status = 'verified' AND deleted_at IS NULL;
CREATE INDEX email_sender_domains_company_status_idx
  ON public.email_sender_domains(company_id, status) WHERE deleted_at IS NULL;

CREATE TABLE public.email_sender_domain_dns_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('spf', 'dkim', 'return_path', 'dmarc')),
  record_type TEXT NOT NULL CHECK (record_type IN ('TXT', 'CNAME', 'MX')),
  host TEXT NOT NULL,
  value TEXT NOT NULL,
  priority INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, company_id),
  UNIQUE (domain_id, purpose, record_type, host),
  FOREIGN KEY (domain_id, company_id)
    REFERENCES public.email_sender_domains(id, company_id) ON DELETE CASCADE
);
CREATE INDEX email_sender_domain_dns_records_domain_status_idx
  ON public.email_sender_domain_dns_records(domain_id, status);

CREATE TABLE public.email_sender_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'platform' CHECK (mode IN ('platform', 'verified_domain', 'google_oauth', 'microsoft_oauth')),
  selected_connection_id UUID,
  selected_domain_id UUID,
  display_name TEXT NOT NULL DEFAULT 'SobControle' CHECK (length(display_name) BETWEEN 1 AND 100 AND display_name !~ '[\r\n]'),
  sender_email TEXT,
  reply_to_email TEXT,
  sending_enabled BOOLEAN NOT NULL DEFAULT true,
  test_sending_enabled BOOLEAN NOT NULL DEFAULT true,
  test_rate_limit_per_hour INTEGER NOT NULL DEFAULT 20 CHECK (test_rate_limit_per_hour BETWEEN 1 AND 100),
  last_sent_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  updated_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, company_id),
  FOREIGN KEY (selected_connection_id, company_id)
    REFERENCES public.email_sender_connections(id, company_id),
  FOREIGN KEY (selected_domain_id, company_id)
    REFERENCES public.email_sender_domains(id, company_id),
  CHECK (sender_email IS NULL OR sender_email !~ '[\r\n]'),
  CHECK (reply_to_email IS NULL OR reply_to_email !~ '[\r\n]'),
  CHECK (
    (mode = 'platform' AND selected_connection_id IS NULL AND selected_domain_id IS NULL) OR
    (mode = 'verified_domain' AND selected_connection_id IS NULL AND selected_domain_id IS NOT NULL) OR
    (mode IN ('google_oauth', 'microsoft_oauth') AND selected_connection_id IS NOT NULL AND selected_domain_id IS NULL)
  )
);

CREATE TABLE public.outbound_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 200),
  payload_fingerprint BYTEA NOT NULL,
  requested_by UUID NOT NULL REFERENCES public.profiles(id),
  origin TEXT NOT NULL CHECK (origin IN ('test', 'notification', 'manual', 'system')),
  source_type TEXT,
  source_id TEXT,
  connection_id UUID,
  domain_id UUID,
  provider TEXT NOT NULL CHECK (provider IN ('resend', 'google', 'microsoft')),
  mode TEXT NOT NULL CHECK (mode IN ('platform', 'verified_domain', 'google_oauth', 'microsoft_oauth')),
  sender_display_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  recipient_masked TEXT NOT NULL,
  recipient_hash BYTEA NOT NULL,
  template_key TEXT NOT NULL,
  subject_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'failed', 'bounced', 'blocked', 'complained')),
  provider_message_id TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 1 CHECK (max_attempts BETWEEN 1 AND 5),
  safe_error_code TEXT,
  safe_error_detail TEXT CHECK (safe_error_detail IS NULL OR length(safe_error_detail) <= 200),
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, idempotency_key),
  UNIQUE (id, company_id),
  FOREIGN KEY (connection_id, company_id)
    REFERENCES public.email_sender_connections(id, company_id),
  FOREIGN KEY (domain_id, company_id)
    REFERENCES public.email_sender_domains(id, company_id)
);
CREATE UNIQUE INDEX outbound_email_logs_provider_message_uq
  ON public.outbound_email_logs(provider, provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX outbound_email_logs_history_idx
  ON public.outbound_email_logs(company_id, created_at DESC, id DESC);
CREATE INDEX outbound_email_logs_rate_company_idx
  ON public.outbound_email_logs(company_id, created_at DESC);
CREATE INDEX outbound_email_logs_rate_user_idx
  ON public.outbound_email_logs(company_id, requested_by, created_at DESC);
CREATE INDEX outbound_email_logs_rate_recipient_idx
  ON public.outbound_email_logs(company_id, recipient_hash, created_at DESC);

CREATE TABLE public.outbound_email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  outbound_email_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('resend', 'google', 'microsoft')),
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('sent', 'delivered', 'failed', 'bounced', 'blocked', 'complained')),
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  signature_verified BOOLEAN NOT NULL CHECK (signature_verified),
  payload_digest BYTEA NOT NULL,
  safe_code TEXT,
  safe_metadata JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(safe_metadata) = 'object'),
  UNIQUE (provider, provider_event_id),
  FOREIGN KEY (outbound_email_id, company_id)
    REFERENCES public.outbound_email_logs(id, company_id) ON DELETE CASCADE
);
CREATE INDEX outbound_email_events_log_time_idx
  ON public.outbound_email_events(outbound_email_id, occurred_at DESC);

CREATE TABLE private.email_sender_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL,
  refresh_token_secret_id UUID NOT NULL,
  access_token_secret_id UUID,
  access_token_expires_at TIMESTAMPTZ,
  credential_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id),
  FOREIGN KEY (connection_id, company_id)
    REFERENCES public.email_sender_connections(id, company_id) ON DELETE CASCADE
);

CREATE TABLE private.email_oauth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft')),
  state_digest BYTEA NOT NULL UNIQUE,
  pkce_verifier_secret_id UUID NOT NULL,
  nonce_digest BYTEA NOT NULL,
  return_path TEXT NOT NULL CHECK (return_path ~ '^/settings([?].*)?$'),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expires_at <= created_at + interval '15 minutes')
);
CREATE INDEX email_oauth_sessions_pending_idx
  ON private.email_oauth_sessions(expires_at) WHERE consumed_at IS NULL;

CREATE OR REPLACE FUNCTION private.cleanup_email_vault_secrets()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_TABLE_NAME = 'email_sender_credentials' THEN
    DELETE FROM vault.secrets
      WHERE id IN (OLD.refresh_token_secret_id, OLD.access_token_secret_id);
  ELSE
    DELETE FROM vault.secrets WHERE id = OLD.pkce_verifier_secret_id;
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION private.cleanup_email_vault_secrets() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER cleanup_email_credentials_vault
  BEFORE DELETE ON private.email_sender_credentials
  FOR EACH ROW EXECUTE FUNCTION private.cleanup_email_vault_secrets();
CREATE TRIGGER cleanup_email_oauth_vault
  BEFORE DELETE ON private.email_oauth_sessions
  FOR EACH ROW EXECUTE FUNCTION private.cleanup_email_vault_secrets();

ALTER TABLE public.email_sender_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sender_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sender_domain_dns_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sender_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.email_sender_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.email_oauth_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.email_sender_connections,
  public.email_sender_domains,
  public.email_sender_domain_dns_records,
  public.email_sender_settings,
  public.outbound_email_logs,
  public.outbound_email_events
FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE
  public.email_sender_connections,
  public.email_sender_domains,
  public.email_sender_domain_dns_records,
  public.email_sender_settings,
  public.outbound_email_logs,
  public.outbound_email_events
TO authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE vault.secrets, vault.decrypted_secrets FROM PUBLIC, anon, authenticated;

CREATE POLICY email_connections_tenant_read ON public.email_sender_connections
  FOR SELECT TO authenticated
  USING (company_id = (SELECT public.get_user_company_id()) AND (SELECT public.get_user_role()) IN ('admin', 'manager'));
CREATE POLICY email_domains_tenant_read ON public.email_sender_domains
  FOR SELECT TO authenticated
  USING (company_id = (SELECT public.get_user_company_id()) AND (SELECT public.get_user_role()) IN ('admin', 'manager'));
CREATE POLICY email_dns_tenant_read ON public.email_sender_domain_dns_records
  FOR SELECT TO authenticated
  USING (company_id = (SELECT public.get_user_company_id()) AND (SELECT public.get_user_role()) IN ('admin', 'manager'));
CREATE POLICY email_settings_tenant_read ON public.email_sender_settings
  FOR SELECT TO authenticated
  USING (company_id = (SELECT public.get_user_company_id()) AND (SELECT public.get_user_role()) IN ('admin', 'manager'));
CREATE POLICY email_logs_tenant_read ON public.outbound_email_logs
  FOR SELECT TO authenticated
  USING (company_id = (SELECT public.get_user_company_id()) AND (SELECT public.get_user_role()) IN ('admin', 'manager'));
CREATE POLICY email_events_tenant_read ON public.outbound_email_events
  FOR SELECT TO authenticated
  USING (company_id = (SELECT public.get_user_company_id()) AND (SELECT public.get_user_role()) IN ('admin', 'manager'));

CREATE OR REPLACE FUNCTION public.backend_create_email_oauth_session(
  p_actor_user_id UUID,
  p_provider TEXT,
  p_state_digest BYTEA,
  p_pkce_verifier TEXT,
  p_nonce_digest BYTEA,
  p_return_path TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_secret_id UUID;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_actor_user_id;
  IF NOT FOUND OR v_profile.role <> 'admin' THEN RAISE EXCEPTION 'permission_denied'; END IF;
  IF p_provider NOT IN ('google', 'microsoft') THEN RAISE EXCEPTION 'invalid_provider'; END IF;
  IF p_return_path !~ '^/settings([?].*)?$' THEN RAISE EXCEPTION 'invalid_return_path'; END IF;
  DELETE FROM private.email_oauth_sessions
    WHERE expires_at <= now() OR (consumed_at IS NOT NULL AND consumed_at < now() - interval '1 hour');
  v_secret_id := vault.create_secret(p_pkce_verifier, 'email-pkce-' || gen_random_uuid()::TEXT, 'Ephemeral email OAuth PKCE verifier');
  INSERT INTO private.email_oauth_sessions (
    company_id, actor_user_id, provider, state_digest, pkce_verifier_secret_id,
    nonce_digest, return_path, expires_at
  ) VALUES (
    v_profile.company_id, p_actor_user_id, p_provider, p_state_digest, v_secret_id,
    p_nonce_digest, p_return_path, now() + interval '10 minutes'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.backend_consume_email_oauth_session(p_state_digest BYTEA)
RETURNS TABLE (
  company_id UUID, actor_user_id UUID, provider TEXT, pkce_verifier TEXT,
  nonce_digest BYTEA, return_path TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_session private.email_oauth_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session
  FROM private.email_oauth_sessions s
  WHERE s.state_digest = p_state_digest AND s.consumed_at IS NULL AND s.expires_at > now()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_oauth_state'; END IF;
  UPDATE private.email_oauth_sessions SET consumed_at = now() WHERE id = v_session.id;
  RETURN QUERY
    SELECT v_session.company_id, v_session.actor_user_id, v_session.provider,
      ds.decrypted_secret, v_session.nonce_digest, v_session.return_path
    FROM vault.decrypted_secrets ds WHERE ds.id = v_session.pkce_verifier_secret_id;
  DELETE FROM vault.secrets WHERE id = v_session.pkce_verifier_secret_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.backend_store_email_oauth_connection(
  p_actor_user_id UUID,
  p_provider TEXT,
  p_provider_subject TEXT,
  p_account_email TEXT,
  p_granted_scopes TEXT[],
  p_access_token TEXT,
  p_refresh_token TEXT,
  p_token_expires_at TIMESTAMPTZ
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_connection_id UUID;
  v_refresh_id UUID;
  v_access_id UUID;
  v_old private.email_sender_credentials%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_actor_user_id;
  IF NOT FOUND OR v_profile.role <> 'admin' THEN RAISE EXCEPTION 'permission_denied'; END IF;
  FOR v_old IN
    SELECT credentials.*
    FROM private.email_sender_credentials credentials
    JOIN public.email_sender_connections connection ON connection.id = credentials.connection_id
    WHERE connection.company_id = v_profile.company_id
      AND connection.provider = p_provider
      AND connection.disconnected_at IS NULL
  LOOP
    DELETE FROM private.email_sender_credentials WHERE id = v_old.id;
    DELETE FROM vault.secrets WHERE id IN (v_old.refresh_token_secret_id, v_old.access_token_secret_id);
  END LOOP;
  UPDATE public.email_sender_connections SET disconnected_at = now(), status = 'disconnected', updated_at = now(), updated_by = p_actor_user_id
    WHERE company_id = v_profile.company_id AND provider = p_provider AND disconnected_at IS NULL;
  INSERT INTO public.email_sender_connections (
    company_id, provider, status, provider_subject, account_email, granted_scopes,
    token_expires_at, last_refreshed_at, created_by, updated_by
  ) VALUES (
    v_profile.company_id, p_provider, 'active', p_provider_subject, lower(p_account_email),
    p_granted_scopes, p_token_expires_at, now(), p_actor_user_id, p_actor_user_id
  ) RETURNING id INTO v_connection_id;
  v_refresh_id := vault.create_secret(p_refresh_token, 'email-refresh-' || v_connection_id::TEXT, 'OAuth refresh token');
  v_access_id := vault.create_secret(p_access_token, 'email-access-' || v_connection_id::TEXT, 'OAuth access token');
  INSERT INTO private.email_sender_credentials (
    company_id, connection_id, refresh_token_secret_id, access_token_secret_id, access_token_expires_at
  ) VALUES (v_profile.company_id, v_connection_id, v_refresh_id, v_access_id, p_token_expires_at);
  INSERT INTO public.email_sender_settings (
    company_id, mode, selected_connection_id, display_name, sender_email,
    created_by, updated_by
  ) VALUES (
    v_profile.company_id,
    CASE WHEN p_provider = 'google' THEN 'google_oauth' ELSE 'microsoft_oauth' END,
    v_connection_id, coalesce(nullif(v_profile.name, ''), 'SobControle'), lower(p_account_email),
    p_actor_user_id, p_actor_user_id
  ) ON CONFLICT (company_id) DO UPDATE SET
    mode = EXCLUDED.mode, selected_connection_id = EXCLUDED.selected_connection_id,
    selected_domain_id = NULL, sender_email = EXCLUDED.sender_email,
    updated_by = p_actor_user_id, updated_at = now();
  RETURN v_connection_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.backend_get_email_oauth_credentials(
  p_actor_user_id UUID, p_connection_id UUID
) RETURNS TABLE (provider TEXT, access_token TEXT, refresh_token TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_profile public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_actor_user_id;
  IF NOT FOUND OR v_profile.role NOT IN ('admin', 'manager') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  RETURN QUERY SELECT c.provider, a.decrypted_secret, r.decrypted_secret, cr.access_token_expires_at
  FROM public.email_sender_connections c
  JOIN private.email_sender_credentials cr ON cr.connection_id = c.id AND cr.company_id = c.company_id
  JOIN vault.decrypted_secrets a ON a.id = cr.access_token_secret_id
  JOIN vault.decrypted_secrets r ON r.id = cr.refresh_token_secret_id
  WHERE c.id = p_connection_id AND c.company_id = v_profile.company_id AND c.status = 'active';
END;
$$;

CREATE OR REPLACE FUNCTION public.backend_update_email_oauth_tokens(
  p_actor_user_id UUID, p_connection_id UUID, p_access_token TEXT,
  p_refresh_token TEXT, p_token_expires_at TIMESTAMPTZ
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_profile public.profiles%ROWTYPE; v_credentials private.email_sender_credentials%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_actor_user_id;
  IF NOT FOUND OR v_profile.role NOT IN ('admin', 'manager') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  SELECT cr.* INTO v_credentials FROM private.email_sender_credentials cr
  JOIN public.email_sender_connections c ON c.id = cr.connection_id AND c.company_id = cr.company_id
  WHERE cr.connection_id = p_connection_id AND cr.company_id = v_profile.company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'connection_not_found'; END IF;
  PERFORM vault.update_secret(v_credentials.access_token_secret_id, p_access_token);
  IF p_refresh_token IS NOT NULL AND p_refresh_token <> '' THEN
    PERFORM vault.update_secret(v_credentials.refresh_token_secret_id, p_refresh_token);
  END IF;
  UPDATE private.email_sender_credentials SET access_token_expires_at = p_token_expires_at,
    credential_version = credential_version + 1, updated_at = now() WHERE id = v_credentials.id;
  UPDATE public.email_sender_connections SET token_expires_at = p_token_expires_at,
    last_refreshed_at = now(), status = 'active', safe_error_code = NULL,
    updated_at = now(), updated_by = p_actor_user_id WHERE id = p_connection_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.backend_disconnect_email_connection(
  p_actor_user_id UUID, p_connection_id UUID
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_profile public.profiles%ROWTYPE; v_credentials private.email_sender_credentials%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_actor_user_id;
  IF NOT FOUND OR v_profile.role <> 'admin' THEN RAISE EXCEPTION 'permission_denied'; END IF;
  SELECT cr.* INTO v_credentials FROM private.email_sender_credentials cr
  JOIN public.email_sender_connections c ON c.id = cr.connection_id AND c.company_id = cr.company_id
  WHERE cr.connection_id = p_connection_id AND cr.company_id = v_profile.company_id FOR UPDATE;
  IF FOUND THEN
    DELETE FROM private.email_sender_credentials WHERE id = v_credentials.id;
    DELETE FROM vault.secrets WHERE id IN (v_credentials.refresh_token_secret_id, v_credentials.access_token_secret_id);
  END IF;
  UPDATE public.email_sender_connections SET status = 'disconnected', disconnected_at = now(),
    updated_at = now(), updated_by = p_actor_user_id
    WHERE id = p_connection_id AND company_id = v_profile.company_id;
  UPDATE public.email_sender_settings SET mode = 'platform', selected_connection_id = NULL,
    selected_domain_id = NULL, sender_email = NULL, updated_at = now(), updated_by = p_actor_user_id
    WHERE company_id = v_profile.company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.backend_reserve_test_email(
  p_actor_user_id UUID,
  p_idempotency_key TEXT,
  p_payload_fingerprint BYTEA,
  p_recipient_masked TEXT,
  p_recipient_hash BYTEA,
  p_provider TEXT,
  p_mode TEXT,
  p_sender_display_name TEXT,
  p_sender_email TEXT,
  p_connection_id UUID,
  p_domain_id UUID
) RETURNS TABLE (log_id UUID, duplicate BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_settings public.email_sender_settings%ROWTYPE;
  v_existing public.outbound_email_logs%ROWTYPE;
  v_id UUID;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_actor_user_id;
  IF NOT FOUND OR v_profile.role NOT IN ('admin', 'manager') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  SELECT * INTO v_settings FROM public.email_sender_settings WHERE company_id = v_profile.company_id;
  IF NOT FOUND OR NOT v_settings.sending_enabled OR NOT v_settings.test_sending_enabled THEN RAISE EXCEPTION 'sending_disabled'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('email-global-test-rate', 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(v_profile.company_id::TEXT, 0));
  SELECT * INTO v_existing FROM public.outbound_email_logs
    WHERE company_id = v_profile.company_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.payload_fingerprint <> p_payload_fingerprint THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
    RETURN QUERY SELECT v_existing.id, true; RETURN;
  END IF;
  SELECT * INTO v_existing FROM public.outbound_email_logs
    WHERE company_id = v_profile.company_id
      AND requested_by = p_actor_user_id
      AND payload_fingerprint = p_payload_fingerprint
      AND created_at >= now() - interval '5 minutes'
    ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN RETURN QUERY SELECT v_existing.id, true; RETURN; END IF;
  IF (SELECT count(*) FROM public.outbound_email_logs WHERE created_at >= now() - interval '1 minute') >= 60 THEN RAISE EXCEPTION 'global_rate_limit'; END IF;
  IF (SELECT count(*) FROM public.outbound_email_logs WHERE company_id = v_profile.company_id AND created_at >= now() - interval '1 hour') >= v_settings.test_rate_limit_per_hour THEN RAISE EXCEPTION 'company_rate_limit'; END IF;
  IF (SELECT count(*) FROM public.outbound_email_logs WHERE company_id = v_profile.company_id AND requested_by = p_actor_user_id AND created_at >= now() - interval '1 hour') >= 5 THEN RAISE EXCEPTION 'user_rate_limit'; END IF;
  IF (SELECT count(*) FROM public.outbound_email_logs WHERE company_id = v_profile.company_id AND recipient_hash = p_recipient_hash AND created_at >= now() - interval '1 day') >= 3 THEN RAISE EXCEPTION 'recipient_rate_limit'; END IF;
  INSERT INTO public.outbound_email_logs (
    company_id, idempotency_key, payload_fingerprint, requested_by, origin,
    connection_id, domain_id, provider, mode, sender_display_name, sender_email,
    recipient_masked, recipient_hash, template_key, subject_label
  ) VALUES (
    v_profile.company_id, p_idempotency_key, p_payload_fingerprint, p_actor_user_id, 'test',
    p_connection_id, p_domain_id, p_provider, p_mode, p_sender_display_name, p_sender_email,
    p_recipient_masked, p_recipient_hash, 'sender_test_v1', 'Teste de envio — SobControle'
  ) RETURNING id INTO v_id;
  RETURN QUERY SELECT v_id, false;
END;
$$;

CREATE OR REPLACE FUNCTION public.backend_finalize_test_email(
  p_log_id UUID, p_status TEXT, p_provider_message_id TEXT, p_safe_error_code TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_status NOT IN ('sent', 'failed', 'blocked') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  UPDATE public.outbound_email_logs SET
    status = p_status, provider_message_id = p_provider_message_id,
    safe_error_code = p_safe_error_code, attempt_count = attempt_count + 1,
    sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE sent_at END,
    failed_at = CASE WHEN p_status IN ('failed', 'blocked') THEN now() ELSE failed_at END,
    updated_at = now()
  WHERE id = p_log_id AND status IN ('queued', 'sending');
END;
$$;

CREATE OR REPLACE FUNCTION public.backend_record_email_webhook(
  p_provider TEXT, p_provider_message_id TEXT, p_provider_event_id TEXT,
  p_event_type TEXT, p_occurred_at TIMESTAMPTZ, p_payload_digest BYTEA, p_safe_code TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_log public.outbound_email_logs%ROWTYPE; v_rank INTEGER; v_current_rank INTEGER;
BEGIN
  SELECT * INTO v_log FROM public.outbound_email_logs
    WHERE provider = p_provider AND provider_message_id = p_provider_message_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.outbound_email_events (
    company_id, outbound_email_id, provider, provider_event_id, event_type,
    occurred_at, signature_verified, payload_digest, safe_code
  ) VALUES (v_log.company_id, v_log.id, p_provider, p_provider_event_id, p_event_type,
    p_occurred_at, true, p_payload_digest, p_safe_code)
  ON CONFLICT (provider, provider_event_id) DO NOTHING;
  IF NOT FOUND THEN RETURN true; END IF;
  v_rank := CASE p_event_type WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 ELSE 3 END;
  v_current_rank := CASE v_log.status WHEN 'queued' THEN 0 WHEN 'sending' THEN 0 WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 ELSE 3 END;
  IF v_rank >= v_current_rank THEN
    UPDATE public.outbound_email_logs SET status = p_event_type,
      delivered_at = CASE WHEN p_event_type = 'delivered' THEN p_occurred_at ELSE delivered_at END,
      failed_at = CASE WHEN p_event_type = 'failed' THEN p_occurred_at ELSE failed_at END,
      bounced_at = CASE WHEN p_event_type = 'bounced' THEN p_occurred_at ELSE bounced_at END,
      safe_error_code = p_safe_code, updated_at = now() WHERE id = v_log.id;
  END IF;
  RETURN true;
END;
$$;

DO $$ DECLARE f RECORD; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'backend_%email%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.signature);
  END LOOP;
END $$;
