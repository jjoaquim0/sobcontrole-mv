-- Physical rollback for Story 1.34. Prefer the operational kill switch first.
DROP FUNCTION IF EXISTS public.backend_record_email_webhook(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, BYTEA, TEXT);
DROP FUNCTION IF EXISTS public.backend_finalize_test_email(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.backend_reserve_test_email(UUID, TEXT, BYTEA, TEXT, BYTEA, TEXT, TEXT, TEXT, TEXT, UUID, UUID);
DROP FUNCTION IF EXISTS public.backend_get_email_oauth_credentials(UUID, UUID);
DROP FUNCTION IF EXISTS public.backend_update_email_oauth_tokens(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.backend_disconnect_email_connection(UUID, UUID);
DROP FUNCTION IF EXISTS public.backend_store_email_oauth_connection(UUID, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.backend_consume_email_oauth_session(BYTEA);
DROP FUNCTION IF EXISTS public.backend_create_email_oauth_session(UUID, TEXT, BYTEA, TEXT, BYTEA, TEXT);

DO $$ DECLARE secret_id UUID; BEGIN
  FOR secret_id IN
    SELECT refresh_token_secret_id FROM private.email_sender_credentials
    UNION SELECT access_token_secret_id FROM private.email_sender_credentials WHERE access_token_secret_id IS NOT NULL
    UNION SELECT pkce_verifier_secret_id FROM private.email_oauth_sessions
  LOOP
    DELETE FROM vault.secrets WHERE id = secret_id;
  END LOOP;
END $$;

DROP TABLE IF EXISTS public.outbound_email_events;
DROP TABLE IF EXISTS public.outbound_email_logs;
DROP TABLE IF EXISTS public.email_sender_settings;
DROP TABLE IF EXISTS public.email_sender_domain_dns_records;
DROP TABLE IF EXISTS private.email_oauth_sessions;
DROP TABLE IF EXISTS private.email_sender_credentials;
DROP TABLE IF EXISTS public.email_sender_domains;
DROP TABLE IF EXISTS public.email_sender_connections;
DROP FUNCTION IF EXISTS private.cleanup_email_vault_secrets();

-- Deliberately keep the shared private schema and Supabase Vault extension.
