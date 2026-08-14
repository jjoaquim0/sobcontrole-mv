-- Rollback — dimensão `feature` em ai_usage_windows / ai_usage_logs
-- (20260814101500_ai_usage_feature_dimension.sql).
--
-- ATENÇÃO: depois deste rollback, reserve_ai_usage volta a ter 3 parâmetros
-- (sem p_feature) e chat/import voltam a compartilhar a mesma janela de
-- quota — exatamente o problema que a migration existia para resolver. Só
-- reverta isto se também estiver revertendo (ou nunca tiver implantado) o
-- caminho de importação que passa p_feature='document_import'.
--
-- Restaura reserve_ai_usage e finalize_ai_usage ao estado literal anterior
-- (equivalente ao produzido por 20260725123000_fix_ai_usage_conflict.sql +
-- 20260725130000_gestly_read_only_tools_p1.sql), reproduzido aqui por texto
-- — não por pg_get_functiondef/EXECUTE.

BEGIN;

DROP FUNCTION IF EXISTS public.reserve_ai_usage(UUID, UUID, INTEGER, TEXT);

CREATE FUNCTION public.reserve_ai_usage(
  p_user_id UUID,
  p_request_id UUID,
  p_estimated_input_tokens INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  decision_code TEXT,
  company_id UUID,
  user_id UUID,
  provider TEXT,
  model TEXT,
  max_output_tokens INTEGER,
  timeout_ms INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_global public.ai_global_settings%ROWTYPE;
  v_company_settings public.ai_company_settings%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_company_exists BOOLEAN;
  v_provider TEXT;
  v_model TEXT;
  v_allowed_roles TEXT[];
  v_window_seconds INTEGER;
  v_user_request_limit INTEGER;
  v_company_request_limit INTEGER;
  v_company_token_limit BIGINT;
  v_company_cost_limit BIGINT;
  v_window_start TIMESTAMPTZ;
  v_reserved_tokens BIGINT;
  v_reserved_cost BIGINT := 0;
  v_input_rate BIGINT;
  v_output_rate BIGINT;
  v_company_window public.ai_usage_windows%ROWTYPE;
  v_user_window public.ai_usage_windows%ROWTYPE;
  v_limit_code TEXT;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL
     OR p_estimated_input_tokens IS NULL
     OR p_estimated_input_tokens < 1
     OR p_estimated_input_tokens > 100000 THEN
    RETURN QUERY SELECT false, 'invalid_request', NULL::UUID, p_user_id,
      NULL::TEXT, NULL::TEXT, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  SELECT * INTO v_global
  FROM public.ai_global_settings
  WHERE id = 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'configuration_error', NULL::UUID, p_user_id,
      NULL::TEXT, NULL::TEXT, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND OR v_profile.company_id IS NULL THEN
    RETURN QUERY SELECT false, 'company_not_found', NULL::UUID, p_user_id,
      NULL::TEXT, NULL::TEXT, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.companies c WHERE c.id = v_profile.company_id
  ) INTO v_company_exists;

  IF NOT v_company_exists THEN
    RETURN QUERY SELECT false, 'company_not_found', NULL::UUID, p_user_id,
      NULL::TEXT, NULL::TEXT, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  IF NOT v_global.enabled THEN
    INSERT INTO public.ai_usage_logs (
      request_id, company_id, user_id, status, error_code, completed_at, latency_ms
    ) VALUES (
      p_request_id, v_profile.company_id, p_user_id, 'blocked', 'global_disabled', now(), 0
    );
    RETURN QUERY SELECT false, 'global_disabled', v_profile.company_id, p_user_id,
      NULL::TEXT, NULL::TEXT, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  SELECT * INTO v_company_settings
  FROM public.ai_company_settings
  WHERE ai_company_settings.company_id = v_profile.company_id;

  IF FOUND AND NOT v_company_settings.enabled THEN
    INSERT INTO public.ai_usage_logs (
      request_id, company_id, user_id, status, error_code, completed_at, latency_ms
    ) VALUES (
      p_request_id, v_profile.company_id, p_user_id, 'blocked', 'company_disabled', now(), 0
    );
    RETURN QUERY SELECT false, 'company_disabled', v_profile.company_id, p_user_id,
      NULL::TEXT, NULL::TEXT, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  v_allowed_roles := COALESCE(v_company_settings.allowed_roles, v_global.allowed_roles);
  IF v_profile.role IS NULL OR NOT (v_profile.role = ANY(v_allowed_roles)) THEN
    INSERT INTO public.ai_usage_logs (
      request_id, company_id, user_id, status, error_code, completed_at, latency_ms
    ) VALUES (
      p_request_id, v_profile.company_id, p_user_id, 'blocked', 'permission_denied', now(), 0
    );
    RETURN QUERY SELECT false, 'permission_denied', v_profile.company_id, p_user_id,
      NULL::TEXT, NULL::TEXT, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  v_provider := COALESCE(v_company_settings.provider_override, v_global.default_provider);
  v_model := COALESCE(v_company_settings.model_override, v_global.default_model);

  IF NOT (v_global.allowed_models ? v_provider)
     OR jsonb_typeof(v_global.allowed_models -> v_provider) <> 'array'
     OR NOT EXISTS (
       SELECT 1
       FROM jsonb_array_elements_text(
         CASE
           WHEN jsonb_typeof(v_global.allowed_models -> v_provider) = 'array'
             THEN v_global.allowed_models -> v_provider
           ELSE '[]'::jsonb
         END
       ) AS allowed_model(value)
       WHERE allowed_model.value = v_model
     ) THEN
    INSERT INTO public.ai_usage_logs (
      request_id, company_id, user_id, provider, model, status, error_code,
      completed_at, latency_ms
    ) VALUES (
      p_request_id, v_profile.company_id, p_user_id, v_provider, v_model,
      'blocked', 'configuration_error', now(), 0
    );
    RETURN QUERY SELECT false, 'configuration_error', v_profile.company_id, p_user_id,
      NULL::TEXT, NULL::TEXT, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  v_window_seconds := COALESCE(v_company_settings.window_seconds, v_global.window_seconds);
  v_user_request_limit := COALESCE(
    v_company_settings.user_request_limit,
    v_global.user_request_limit
  );
  v_company_request_limit := COALESCE(
    v_company_settings.company_request_limit,
    v_global.company_request_limit
  );
  v_company_token_limit := COALESCE(
    v_company_settings.company_token_limit,
    v_global.company_token_limit
  );
  v_company_cost_limit := COALESCE(
    v_company_settings.company_cost_limit_micros,
    v_global.company_cost_limit_micros
  );
  v_window_start := to_timestamp(
    floor(extract(epoch FROM clock_timestamp()) / v_window_seconds) * v_window_seconds
  );
  v_reserved_tokens := p_estimated_input_tokens::BIGINT + v_global.max_output_tokens::BIGINT;

  SELECT
    pricing.input_cost_micros_per_million,
    pricing.output_cost_micros_per_million
  INTO v_input_rate, v_output_rate
  FROM public.ai_model_pricing pricing
  WHERE pricing.provider = v_provider
    AND pricing.model = v_model
    AND pricing.active;

  IF FOUND THEN
    v_reserved_cost := ceil(
      (
        p_estimated_input_tokens::NUMERIC * v_input_rate::NUMERIC
        + v_global.max_output_tokens::NUMERIC * v_output_rate::NUMERIC
      ) / 1000000
    )::BIGINT;
  END IF;

  INSERT INTO public.ai_usage_windows (
    company_id, scope, subject_id, window_start, window_seconds
  ) VALUES (
    v_profile.company_id, 'company', v_profile.company_id, v_window_start, v_window_seconds
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO public.ai_usage_windows (
    company_id, scope, subject_id, window_start, window_seconds
  ) VALUES (
    v_profile.company_id, 'user', p_user_id, v_window_start, v_window_seconds
  )
  ON CONFLICT DO NOTHING;

  SELECT * INTO v_company_window
  FROM public.ai_usage_windows usage_window
  WHERE usage_window.company_id = v_profile.company_id
    AND usage_window.scope = 'company'
    AND usage_window.subject_id = v_profile.company_id
    AND usage_window.window_start = v_window_start
    AND usage_window.window_seconds = v_window_seconds
  FOR UPDATE;

  SELECT * INTO v_user_window
  FROM public.ai_usage_windows usage_window
  WHERE usage_window.company_id = v_profile.company_id
    AND usage_window.scope = 'user'
    AND usage_window.subject_id = p_user_id
    AND usage_window.window_start = v_window_start
    AND usage_window.window_seconds = v_window_seconds
  FOR UPDATE;

  v_limit_code := CASE
    WHEN v_user_window.request_count + 1 > v_user_request_limit
      THEN 'user_request_limit'
    WHEN v_company_window.request_count + 1 > v_company_request_limit
      THEN 'company_request_limit'
    WHEN v_company_window.token_count + v_reserved_tokens > v_company_token_limit
      THEN 'company_token_limit'
    WHEN v_company_cost_limit IS NOT NULL
      AND v_company_window.cost_micros + v_reserved_cost > v_company_cost_limit
      THEN 'company_cost_limit'
    ELSE NULL
  END;

  IF v_limit_code IS NOT NULL THEN
    INSERT INTO public.ai_usage_logs (
      request_id, company_id, user_id, provider, model, status, error_code,
      window_start, window_seconds, completed_at, latency_ms
    ) VALUES (
      p_request_id, v_profile.company_id, p_user_id, v_provider, v_model,
      'blocked', v_limit_code, v_window_start, v_window_seconds, now(), 0
    );
    RETURN QUERY SELECT false, v_limit_code, v_profile.company_id, p_user_id,
      v_provider, v_model, v_global.max_output_tokens, v_global.provider_timeout_ms;
    RETURN;
  END IF;

  INSERT INTO public.ai_usage_logs (
    request_id, company_id, user_id, provider, model, status,
    window_start, window_seconds, reserved_tokens, reserved_cost_micros
  ) VALUES (
    p_request_id, v_profile.company_id, p_user_id, v_provider, v_model, 'started',
    v_window_start, v_window_seconds, v_reserved_tokens, v_reserved_cost
  );

  UPDATE public.ai_usage_windows
  SET request_count = request_count + 1,
      token_count = token_count + v_reserved_tokens,
      cost_micros = cost_micros + v_reserved_cost,
      updated_at = now()
  WHERE ai_usage_windows.company_id = v_profile.company_id
    AND ai_usage_windows.scope = 'company'
    AND ai_usage_windows.subject_id = v_profile.company_id
    AND ai_usage_windows.window_start = v_window_start
    AND ai_usage_windows.window_seconds = v_window_seconds;

  UPDATE public.ai_usage_windows
  SET request_count = request_count + 1,
      token_count = token_count + v_reserved_tokens,
      cost_micros = cost_micros + v_reserved_cost,
      updated_at = now()
  WHERE ai_usage_windows.company_id = v_profile.company_id
    AND ai_usage_windows.scope = 'user'
    AND ai_usage_windows.subject_id = p_user_id
    AND ai_usage_windows.window_start = v_window_start
    AND ai_usage_windows.window_seconds = v_window_seconds;

  RETURN QUERY SELECT true, 'allowed', v_profile.company_id, p_user_id,
    v_provider, v_model, v_global.max_output_tokens, v_global.provider_timeout_ms;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_usage(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_usage(UUID, UUID, INTEGER) TO service_role;

COMMENT ON FUNCTION public.reserve_ai_usage(UUID, UUID, INTEGER) IS
  'Valida tenant/permissão/configuração e reserva quotas atomicamente; somente service_role.';

CREATE OR REPLACE FUNCTION public.finalize_ai_usage(
  p_request_id UUID,
  p_status TEXT,
  p_input_tokens INTEGER,
  p_output_tokens INTEGER,
  p_latency_ms INTEGER,
  p_error_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_log public.ai_usage_logs%ROWTYPE;
  v_input_rate BIGINT;
  v_output_rate BIGINT;
  v_final_tokens BIGINT;
  v_final_cost BIGINT;
  v_token_delta BIGINT;
  v_cost_delta BIGINT;
  v_safe_error_code TEXT;
  v_has_usage BOOLEAN;
  v_input_tokens INTEGER;
  v_output_tokens INTEGER;
BEGIN
  IF p_status NOT IN ('succeeded', 'failed') THEN
    RAISE EXCEPTION 'invalid final status';
  END IF;

  SELECT * INTO v_log
  FROM public.ai_usage_logs AS usage_log
  WHERE usage_log.request_id = p_request_id
    AND usage_log.status = 'started'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_input_tokens := CASE
    WHEN p_input_tokens IS NULL THEN NULL
    ELSE GREATEST(0, p_input_tokens)
  END;
  v_output_tokens := CASE
    WHEN p_output_tokens IS NULL THEN NULL
    ELSE GREATEST(0, p_output_tokens)
  END;
  v_has_usage := v_input_tokens IS NOT NULL OR v_output_tokens IS NOT NULL;

  IF p_status = 'succeeded' THEN
    v_final_tokens := CASE
      WHEN v_has_usage
        THEN COALESCE(v_input_tokens, 0)::BIGINT + COALESCE(v_output_tokens, 0)::BIGINT
      ELSE v_log.reserved_tokens
    END;
  ELSE
    v_final_tokens := 0;
  END IF;

  SELECT
    pricing.input_cost_micros_per_million,
    pricing.output_cost_micros_per_million
  INTO v_input_rate, v_output_rate
  FROM public.ai_model_pricing AS pricing
  WHERE pricing.provider = v_log.provider
    AND pricing.model = v_log.model
    AND pricing.active;

  IF p_status = 'failed' THEN
    v_final_cost := 0;
  ELSIF FOUND AND v_has_usage THEN
    v_final_cost := CEIL(
      (
        COALESCE(v_input_tokens, 0)::NUMERIC * v_input_rate::NUMERIC
        + COALESCE(v_output_tokens, 0)::NUMERIC * v_output_rate::NUMERIC
      ) / 1000000
    )::BIGINT;
  ELSE
    v_final_cost := v_log.reserved_cost_micros;
  END IF;

  v_token_delta := v_final_tokens - v_log.reserved_tokens;
  v_cost_delta := v_final_cost - v_log.reserved_cost_micros;

  UPDATE public.ai_usage_windows
  SET token_count = GREATEST(0, token_count + v_token_delta),
      cost_micros = GREATEST(0, cost_micros + v_cost_delta),
      updated_at = now()
  WHERE ai_usage_windows.company_id = v_log.company_id
    AND ai_usage_windows.scope = 'company'
    AND ai_usage_windows.subject_id = v_log.company_id
    AND ai_usage_windows.window_start = v_log.window_start
    AND ai_usage_windows.window_seconds = v_log.window_seconds;

  UPDATE public.ai_usage_windows
  SET token_count = GREATEST(0, token_count + v_token_delta),
      cost_micros = GREATEST(0, cost_micros + v_cost_delta),
      updated_at = now()
  WHERE ai_usage_windows.company_id = v_log.company_id
    AND ai_usage_windows.scope = 'user'
    AND ai_usage_windows.subject_id = v_log.user_id
    AND ai_usage_windows.window_start = v_log.window_start
    AND ai_usage_windows.window_seconds = v_log.window_seconds;

  v_safe_error_code := CASE
    WHEN p_status = 'succeeded' THEN NULL
    WHEN p_error_code IN (
      'company_not_found',
      'permission_denied',
      'configuration_error',
      'provider_unavailable',
      'rate_limited',
      'timeout',
      'invalid_request',
      'financial_permission_denied',
      'invalid_tool_arguments',
      'tool_unavailable',
      'tool_query_failed',
      'internal_error'
    ) THEN p_error_code
    ELSE 'internal_error'
  END;

  UPDATE public.ai_usage_logs
  SET status = p_status,
      error_code = v_safe_error_code,
      input_tokens = v_input_tokens,
      output_tokens = v_output_tokens,
      total_tokens = CASE
        WHEN v_has_usage THEN LEAST(v_final_tokens, 2147483647)::INTEGER
        ELSE NULL
      END,
      estimated_cost_micros = v_final_cost,
      latency_ms = GREATEST(0, COALESCE(p_latency_ms, 0)),
      completed_at = now()
  WHERE request_id = p_request_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_ai_usage(
  UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_ai_usage(
  UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT
) TO service_role;

COMMENT ON TABLE public.ai_usage_logs IS
  'Metadados operacionais de IA e ferramentas. Prompts, respostas, resultados, mensagens e payloads são proibidos.';

-- Restaura a UNIQUE de 5 colunas (nome novo — o autogerado original não é
-- recuperável, mas a semântica é idêntica) e remove a dimensão feature.
DO $$
DECLARE
  v_conname TEXT;
BEGIN
  SELECT c.conname INTO v_conname
  FROM pg_constraint c
  WHERE c.conrelid = 'public.ai_usage_windows'::regclass
    AND c.contype = 'u'
    AND c.conname = 'ai_usage_windows_company_scope_subject_window_feature_key';

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.ai_usage_windows DROP CONSTRAINT %I', v_conname);
  END IF;
END;
$$;

ALTER TABLE public.ai_usage_windows
  ADD CONSTRAINT ai_usage_windows_company_scope_subject_window_key
  UNIQUE (company_id, scope, subject_id, window_start, window_seconds);

ALTER TABLE public.ai_usage_windows DROP CONSTRAINT IF EXISTS ai_usage_windows_feature_check;
ALTER TABLE public.ai_usage_logs DROP CONSTRAINT IF EXISTS ai_usage_logs_feature_check;

ALTER TABLE public.ai_usage_windows DROP COLUMN IF EXISTS feature;
ALTER TABLE public.ai_usage_logs DROP COLUMN IF EXISTS feature;

COMMENT ON TABLE public.ai_usage_windows IS NULL;

COMMIT;
