-- =============================================================================
-- Rodar UMA vez no SQL Editor do projeto NOVO: sobcontrole-mv (auljcdljjkplupgebewy)
-- NÃO rodar no projeto SobControle (original).
--
-- Estas funções foram copiadas do banco original, mas a ferramenta do Supabase
-- usada pelo assistente exige confirmação manual para SQL com comandos de
-- exclusão no corpo da função, e essa confirmação não aparece na sessão.
-- O conteúdo é idêntico ao do banco original (lido via pg_get_functiondef).
-- =============================================================================

SET check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.backend_consume_email_oauth_session(p_state_digest bytea)
 RETURNS TABLE(company_id uuid, actor_user_id uuid, provider text, pkce_verifier text, nonce_digest bytea, return_path text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.backend_create_email_oauth_session(p_actor_user_id uuid, p_provider text, p_state_digest bytea, p_pkce_verifier text, p_nonce_digest bytea, p_return_path text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.backend_disconnect_email_connection(p_actor_user_id uuid, p_connection_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.backend_store_email_oauth_connection(p_actor_user_id uuid, p_provider text, p_provider_subject text, p_account_email text, p_granted_scopes text[], p_access_token text, p_refresh_token text, p_token_expires_at timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.remove_document_permission(p_document_id uuid, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_document public.documents%ROWTYPE;
  v_previous_access TEXT;
BEGIN
  SELECT * INTO v_document FROM public.documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND OR v_document.company_id <> public.get_user_company_id() OR public.document_access_level(p_document_id) <> 'admin' OR v_document.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Usuário não autorizado a administrar permissões.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.document_permissions WHERE document_id = p_document_id AND user_id = p_user_id RETURNING access_level INTO v_previous_access;
  IF v_previous_access IS NOT NULL THEN
    PERFORM public.log_document_audit_event(p_document_id, v_document.company_id, 'permission_removed', 'Permissão removida.',
      jsonb_build_object('user_id', p_user_id, 'access_level', v_previous_access), NULL);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_employee(p_employee_id uuid, p_full_name text, p_email text, p_phone text, p_cpf text, p_clear_cpf boolean, p_birth_date date, p_job_title text, p_department text, p_employment_type text, p_admission_date date, p_status text, p_internal_notes text, p_commission_enabled boolean, p_commission_rule_notes text, p_team_id uuid, p_manager_employee_id uuid, p_sales_profile_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_company_id UUID := public.people_assert_manager();
  v_employee_id UUID := COALESCE(p_employee_id, gen_random_uuid());
  v_cpf TEXT; v_cpf_hash TEXT;
BEGIN
  IF NULLIF(trim(p_full_name), '') IS NULL OR NULLIF(trim(p_job_title), '') IS NULL THEN
    RAISE EXCEPTION 'Nome e cargo são obrigatórios.' USING ERRCODE = '22023';
  END IF;
  IF p_employment_type NOT IN ('clt', 'pj', 'internship', 'temporary', 'self_employed', 'other') THEN RAISE EXCEPTION 'Tipo de vínculo inválido.' USING ERRCODE = '22023'; END IF;
  IF p_status NOT IN ('active', 'on_leave', 'terminated') THEN RAISE EXCEPTION 'Status inválido.' USING ERRCODE = '22023'; END IF;
  IF p_manager_employee_id = v_employee_id THEN RAISE EXCEPTION 'O funcionário não pode ser seu próprio gestor.' USING ERRCODE = '22023'; END IF;
  IF p_team_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.teams WHERE id = p_team_id AND company_id = v_company_id) THEN RAISE EXCEPTION 'Equipe não encontrada.' USING ERRCODE = 'P0002'; END IF;
  IF p_manager_employee_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_manager_employee_id AND company_id = v_company_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Gestor não encontrado.' USING ERRCODE = 'P0002'; END IF;
  IF p_sales_profile_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_sales_profile_id AND company_id = v_company_id) THEN RAISE EXCEPTION 'Usuário vendedor não encontrado.' USING ERRCODE = 'P0002'; END IF;

  IF p_employee_id IS NULL THEN
    INSERT INTO public.employees(id, company_id, full_name, email, phone, birth_date, job_title, department,
      employment_type, admission_date, status, internal_notes, commission_enabled, commission_rule_notes,
      team_id, manager_employee_id, sales_profile_id, created_by, updated_by)
    VALUES (v_employee_id, v_company_id, trim(p_full_name), NULLIF(trim(p_email), ''), NULLIF(trim(p_phone), ''),
      p_birth_date, trim(p_job_title), NULLIF(trim(p_department), ''), p_employment_type, p_admission_date,
      p_status, NULLIF(trim(p_internal_notes), ''), COALESCE(p_commission_enabled, false),
      NULLIF(trim(p_commission_rule_notes), ''), p_team_id, p_manager_employee_id, p_sales_profile_id, auth.uid(), auth.uid());
  ELSE
    UPDATE public.employees SET full_name = trim(p_full_name), email = NULLIF(trim(p_email), ''),
      phone = NULLIF(trim(p_phone), ''), birth_date = p_birth_date, job_title = trim(p_job_title),
      department = NULLIF(trim(p_department), ''), employment_type = p_employment_type,
      admission_date = p_admission_date, status = p_status, internal_notes = NULLIF(trim(p_internal_notes), ''),
      commission_enabled = COALESCE(p_commission_enabled, false), commission_rule_notes = NULLIF(trim(p_commission_rule_notes), ''),
      team_id = p_team_id, manager_employee_id = p_manager_employee_id, sales_profile_id = p_sales_profile_id,
      updated_by = auth.uid()
    WHERE id = p_employee_id AND company_id = v_company_id AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Funcionário não encontrado.' USING ERRCODE = 'P0002'; END IF;
  END IF;

  IF COALESCE(p_clear_cpf, false) THEN
    DELETE FROM public.employee_sensitive_data WHERE employee_id = v_employee_id AND company_id = v_company_id;
    UPDATE public.employees SET cpf_last_four = NULL WHERE id = v_employee_id AND company_id = v_company_id;
  ELSIF NULLIF(trim(p_cpf), '') IS NOT NULL THEN
    v_cpf := regexp_replace(p_cpf, '\D', '', 'g');
    IF NOT public.is_valid_cpf(v_cpf) THEN RAISE EXCEPTION 'CPF inválido.' USING ERRCODE = '22023'; END IF;
    v_cpf_hash := encode(extensions.digest(v_company_id::TEXT || ':' || v_cpf, 'sha256'), 'hex');
    BEGIN
      INSERT INTO public.employee_sensitive_data(employee_id, company_id, cpf_hash) VALUES (v_employee_id, v_company_id, v_cpf_hash)
      ON CONFLICT (employee_id) DO UPDATE SET cpf_hash = EXCLUDED.cpf_hash, updated_at = now();
    EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'Já existe um funcionário com este CPF nesta empresa.' USING ERRCODE = '23505'; END;
    UPDATE public.employees SET cpf_last_four = right(v_cpf, 4), updated_by = auth.uid()
    WHERE id = v_employee_id AND company_id = v_company_id;
  END IF;
  RETURN v_employee_id;
END; $function$;

-- Permissões idênticas às do banco original para as funções acima.
REVOKE ALL ON FUNCTION public.backend_consume_email_oauth_session, public.backend_create_email_oauth_session,
  public.backend_disconnect_email_connection, public.backend_store_email_oauth_connection,
  public.remove_document_permission, public.save_employee
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.backend_consume_email_oauth_session, public.backend_create_email_oauth_session,
  public.backend_disconnect_email_connection, public.backend_store_email_oauth_connection
TO service_role;

GRANT EXECUTE ON FUNCTION public.remove_document_permission TO PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.save_employee TO authenticated, service_role;
