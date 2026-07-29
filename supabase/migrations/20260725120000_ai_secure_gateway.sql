-- Story 1.20 — P0: camada segura, multiempresa e governável de IA.
-- Esta migration não armazena prompts, respostas ou mensagens do chat.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_global_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT true,
  default_provider TEXT NOT NULL DEFAULT 'openai' CHECK (length(btrim(default_provider)) > 0),
  default_model TEXT NOT NULL DEFAULT 'gpt-5.4-mini' CHECK (length(btrim(default_model)) > 0),
  allowed_models JSONB NOT NULL DEFAULT '{"openai":["gpt-5.4-mini"]}'::jsonb
    CHECK (jsonb_typeof(allowed_models) = 'object'),
  allowed_roles TEXT[] NOT NULL DEFAULT ARRAY['admin', 'manager', 'employee']::TEXT[]
    CHECK (cardinality(allowed_roles) > 0),
  max_output_tokens INTEGER NOT NULL DEFAULT 500 CHECK (max_output_tokens BETWEEN 1 AND 4000),
  provider_timeout_ms INTEGER NOT NULL DEFAULT 20000 CHECK (provider_timeout_ms BETWEEN 1000 AND 120000),
  window_seconds INTEGER NOT NULL DEFAULT 3600 CHECK (window_seconds BETWEEN 60 AND 86400),
  user_request_limit INTEGER NOT NULL DEFAULT 30 CHECK (user_request_limit > 0),
  company_request_limit INTEGER NOT NULL DEFAULT 300 CHECK (company_request_limit > 0),
  company_token_limit BIGINT NOT NULL DEFAULT 250000 CHECK (company_token_limit > 0),
  company_cost_limit_micros BIGINT CHECK (company_cost_limit_micros IS NULL OR company_cost_limit_micros > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.ai_global_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.ai_company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  provider_override TEXT CHECK (provider_override IS NULL OR length(btrim(provider_override)) > 0),
  model_override TEXT CHECK (model_override IS NULL OR length(btrim(model_override)) > 0),
  allowed_roles TEXT[] CHECK (allowed_roles IS NULL OR cardinality(allowed_roles) > 0),
  window_seconds INTEGER CHECK (window_seconds IS NULL OR window_seconds BETWEEN 60 AND 86400),
  user_request_limit INTEGER CHECK (user_request_limit IS NULL OR user_request_limit > 0),
  company_request_limit INTEGER CHECK (company_request_limit IS NULL OR company_request_limit > 0),
  company_token_limit BIGINT CHECK (company_token_limit IS NULL OR company_token_limit > 0),
  company_cost_limit_micros BIGINT CHECK (
    company_cost_limit_micros IS NULL OR company_cost_limit_micros > 0
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pricing é deliberadamente vazio na P0. Custo só é calculado e limitado
-- quando um operador backend cadastra uma tarifa vigente e revisada.
CREATE TABLE IF NOT EXISTS public.ai_model_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (length(btrim(provider)) > 0),
  model TEXT NOT NULL CHECK (length(btrim(model)) > 0),
  input_cost_micros_per_million BIGINT NOT NULL CHECK (input_cost_micros_per_million >= 0),
  output_cost_micros_per_million BIGINT NOT NULL CHECK (output_cost_micros_per_million >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, model)
);

CREATE TABLE IF NOT EXISTS public.ai_usage_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('company', 'user')),
  subject_id UUID NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_seconds INTEGER NOT NULL CHECK (window_seconds BETWEEN 60 AND 86400),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  token_count BIGINT NOT NULL DEFAULT 0 CHECK (token_count >= 0),
  cost_micros BIGINT NOT NULL DEFAULT 0 CHECK (cost_micros >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, scope, subject_id, window_start, window_seconds),
  CHECK (scope <> 'company' OR subject_id = company_id)
);

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  provider TEXT,
  model TEXT,
  status TEXT NOT NULL CHECK (status IN ('started', 'succeeded', 'failed', 'blocked')),
  error_code TEXT CHECK (
    error_code IS NULL OR error_code IN (
      'unauthorized',
      'company_not_found',
      'permission_denied',
      'global_disabled',
      'company_disabled',
      'configuration_error',
      'user_request_limit',
      'company_request_limit',
      'company_token_limit',
      'company_cost_limit',
      'provider_unavailable',
      'rate_limited',
      'timeout',
      'invalid_request',
      'usage_limit_exceeded',
      'internal_error'
    )
  ),
  window_start TIMESTAMPTZ,
  window_seconds INTEGER CHECK (window_seconds IS NULL OR window_seconds BETWEEN 60 AND 86400),
  reserved_tokens BIGINT NOT NULL DEFAULT 0 CHECK (reserved_tokens >= 0),
  reserved_cost_micros BIGINT NOT NULL DEFAULT 0 CHECK (reserved_cost_micros >= 0),
  input_tokens INTEGER CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
  total_tokens INTEGER CHECK (total_tokens IS NULL OR total_tokens >= 0),
  estimated_cost_micros BIGINT CHECK (estimated_cost_micros IS NULL OR estimated_cost_micros >= 0),
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status = 'blocked' OR (provider IS NOT NULL AND model IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_ai_company_settings_enabled
  ON public.ai_company_settings(company_id, enabled);
CREATE INDEX IF NOT EXISTS idx_ai_usage_windows_company_period
  ON public.ai_usage_windows(company_id, window_start DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_windows_user_period
  ON public.ai_usage_windows(company_id, subject_id, window_start DESC)
  WHERE scope = 'user';
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_company_period
  ON public.ai_usage_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_period
  ON public.ai_usage_logs(company_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_status_period
  ON public.ai_usage_logs(company_id, status, created_at DESC);

ALTER TABLE public.ai_global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_model_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Nenhuma tabela de governança/uso é consultável ou mutável pelo frontend.
REVOKE ALL ON TABLE public.ai_global_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ai_company_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ai_model_pricing FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ai_usage_windows FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ai_usage_logs FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reserve_ai_usage(
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
  ON CONFLICT (company_id, scope, subject_id, window_start, window_seconds) DO NOTHING;

  INSERT INTO public.ai_usage_windows (
    company_id, scope, subject_id, window_start, window_seconds
  ) VALUES (
    v_profile.company_id, 'user', p_user_id, v_window_start, v_window_seconds
  )
  ON CONFLICT (company_id, scope, subject_id, window_start, window_seconds) DO NOTHING;

  -- Ordem fixa: empresa primeiro, usuário depois. O lock impede duas reservas
  -- concorrentes de observarem o mesmo saldo disponível.
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
  FROM public.ai_usage_logs usage_log
  WHERE usage_log.request_id = p_request_id
    AND usage_log.status = 'started'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_input_tokens := CASE
    WHEN p_input_tokens IS NULL THEN NULL
    ELSE greatest(0, p_input_tokens)
  END;
  v_output_tokens := CASE
    WHEN p_output_tokens IS NULL THEN NULL
    ELSE greatest(0, p_output_tokens)
  END;
  v_has_usage := v_input_tokens IS NOT NULL OR v_output_tokens IS NOT NULL;

  IF p_status = 'succeeded' THEN
    v_final_tokens := CASE
      WHEN v_has_usage THEN COALESCE(v_input_tokens, 0)::BIGINT + COALESCE(v_output_tokens, 0)::BIGINT
      ELSE v_log.reserved_tokens
    END;
  ELSE
    v_final_tokens := 0;
  END IF;

  SELECT
    pricing.input_cost_micros_per_million,
    pricing.output_cost_micros_per_million
  INTO v_input_rate, v_output_rate
  FROM public.ai_model_pricing pricing
  WHERE pricing.provider = v_log.provider
    AND pricing.model = v_log.model
    AND pricing.active;

  IF p_status = 'failed' THEN
    v_final_cost := 0;
  ELSIF FOUND AND v_has_usage THEN
    v_final_cost := ceil(
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
  SET token_count = greatest(0, token_count + v_token_delta),
      cost_micros = greatest(0, cost_micros + v_cost_delta),
      updated_at = now()
  WHERE ai_usage_windows.company_id = v_log.company_id
    AND ai_usage_windows.scope = 'company'
    AND ai_usage_windows.subject_id = v_log.company_id
    AND ai_usage_windows.window_start = v_log.window_start
    AND ai_usage_windows.window_seconds = v_log.window_seconds;

  UPDATE public.ai_usage_windows
  SET token_count = greatest(0, token_count + v_token_delta),
      cost_micros = greatest(0, cost_micros + v_cost_delta),
      updated_at = now()
  WHERE ai_usage_windows.company_id = v_log.company_id
    AND ai_usage_windows.scope = 'user'
    AND ai_usage_windows.subject_id = v_log.user_id
    AND ai_usage_windows.window_start = v_log.window_start
    AND ai_usage_windows.window_seconds = v_log.window_seconds;

  v_safe_error_code := CASE
    WHEN p_status = 'succeeded' THEN NULL
    WHEN p_error_code IN (
      'provider_unavailable',
      'rate_limited',
      'timeout',
      'invalid_request',
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
        WHEN v_has_usage THEN least(v_final_tokens, 2147483647)::INTEGER
        ELSE NULL
      END,
      estimated_cost_micros = v_final_cost,
      latency_ms = greatest(0, COALESCE(p_latency_ms, 0)),
      completed_at = now()
  WHERE request_id = p_request_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_usage(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_ai_usage(UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_usage(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_ai_usage(UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT)
  TO service_role;

COMMENT ON TABLE public.ai_usage_logs IS
  'Metadados operacionais de IA. Prompts, respostas, mensagens e payloads são proibidos.';
COMMENT ON FUNCTION public.reserve_ai_usage(UUID, UUID, INTEGER) IS
  'Valida tenant/permissão/configuração e reserva quotas atomicamente; somente service_role.';
COMMENT ON FUNCTION public.finalize_ai_usage(UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT) IS
  'Finaliza uso sem conteúdo e reconcilia tokens/custo reservados; somente service_role.';

COMMIT;
