-- Dimensão `feature` em ai_usage_windows / ai_usage_logs (ADR P3, seção
-- "Tetos, quota e timeout": "Quota separada por feature. Sem isso, uma
-- importação consome a janela do chat da empresa.").
--
-- MIGRATION SEPARADA DA CRIAÇÃO DAS TABELAS DE PROPOSTA, DE PROPÓSITO.
-- As tabelas novas (20260814100000) têm risco de regressão zero — nada as
-- referencia ainda. Esta migration mexe no caminho de rate limit do chat em
-- produção, hoje em uso a cada mensagem. São riscos de naturezas diferentes
-- e o usuário pode autorizar uma sem autorizar a outra.
--
-- POR QUE NÃO É UM ALTER TABLE ... ADD COLUMN:
--
-- Fato 1 — a definição de reserve_ai_usage no repositório não é a que está
-- no banco. 20260725123000_fix_ai_usage_conflict.sql reescreve a função em
-- tempo de execução (pg_get_functiondef + replace + EXECUTE), trocando
--   ON CONFLICT (company_id, scope, subject_id, window_start, window_seconds) DO NOTHING
-- por
--   ON CONFLICT DO NOTHING
-- porque a forma nomeada colide com a coluna de retorno `company_id` de
-- RETURNS TABLE (ambiguidade de nome). Esta migration REESCREVE reserve_ai_usage
-- por inteiro com CREATE OR REPLACE — texto literal, sem pg_get_functiondef/
-- EXECUTE — preservando esse `ON CONFLICT DO NOTHING` genérico, para não
-- reintroduzir a mesma ambiguidade.
--
-- Fato 2 — o ON CONFLICT DO NOTHING genérico absorve qualquer conflito
-- calado. Acrescentar `feature` à UNIQUE sem tocar a função faria o INSERT
-- "funcionar" sem erro nenhum, mesmo lendo/gravando a janela errada.
--
-- Fato 3 — os SELECT ... FOR UPDATE e os UPDATE que seguem filtram por
-- (company_id, scope, subject_id, window_start, window_seconds), SEM
-- `feature` e SEM LIMIT. Com `feature` na UNIQUE e a função não reescrita,
-- passaria a existir mais de uma linha por filtro: SELECT INTO sem STRICT
-- pega a primeira em silêncio (rate limit lendo o contador errado) e UPDATE
-- sem `feature` no WHERE atualizaria TODAS as linhas que baterem no filtro —
-- ou seja, incrementaria o contador de chat E de importação juntos a cada
-- chamada. Por isso a reescrita cobre TODOS os pontos: os dois INSERT, os
-- dois SELECT ... FOR UPDATE e os dois UPDATE finais em reserve_ai_usage, e
-- os dois UPDATE em finalize_ai_usage (20260725130000:523-541).
--
-- ASSINATURA: reserve_ai_usage ganha p_feature TEXT DEFAULT 'chat' como 4º
-- parâmetro — não é ALTER de coluna, é DROP + CREATE de função (Postgres não
-- troca a lista de parâmetros via CREATE OR REPLACE; teria criado uma
-- segunda função em overload, deixando a antiga viva e sem feature). Chamada
-- via PostgREST/supabase-js usa notação nomeada (p_user_id => ...), então o
-- Edge Function existente — que hoje chama com 3 argumentos — continua
-- funcionando sem alteração, com p_feature resolvendo para o default 'chat'.
-- NÃO preciso tocar supabase/functions/ (fora da minha fronteira) para isso
-- continuar válido; mas o dev que criar a chamada de import PRECISA passar
-- p_feature='document_import' explicitamente quando essa Edge Function
-- existir — isso fica registrado como dependência para quem implementar o
-- passo 2+ do ADR.
--
-- LIMITES POR FEATURE: chat e document_import usam os MESMOS limites de
-- ai_global_settings/ai_company_settings (company_request_limit,
-- company_token_limit, etc.), cada um com sua própria janela isolada — ou
-- seja, cada feature tem direito ao teto INTEIRO, não uma fração dividida.
-- Isso resolve "importação não consome a janela do chat" (o pedido do ADR)
-- sem inventar um novo conjunto de colunas de limite por feature. Se no
-- futuro for necessário um teto MENOR para import do que para chat, isso
-- exige uma migration própria em ai_global_settings/ai_company_settings —
-- fora deste escopo.
--
-- VERIFICAÇÃO OBRIGATÓRIA ANTES DE APLICAR (eu não posso rodar isto — NFR-2):
--   1. SELECT pg_get_functiondef('public.reserve_ai_usage(uuid,uuid,integer)'::regprocedure);
--      Confirmar que a definição viva bate com o texto reproduzido abaixo
--      (a partir da base de 20260725120000 + Fato 1), antes de assumir que
--      este CREATE OR REPLACE está substituindo o que eu penso que está.
--   2. Depois de aplicar, em transação de teste (ROLLBACK ao final):
--      chamar reserve_ai_usage 1x com p_feature default ('chat') e 1x com
--      p_feature='document_import' para o MESMO usuário/empresa na mesma
--      janela; conferir que existem DUAS linhas em ai_usage_windows por
--      scope (company e user), uma por feature, cada uma com request_count=1
--      — não uma linha só com request_count=2.
--   3. Chamar finalize_ai_usage para as duas e conferir que cada UPDATE
--      mexeu em uma única linha (checar rowcount, não só ausência de erro —
--      "não deu erro" não é validação aqui, ver seção 9 do brief).

BEGIN;

-- =============================================================================
-- 1. Coluna + backfill + CHECK (governado, mesmo padrão de tool_name)
-- =============================================================================

ALTER TABLE public.ai_usage_windows
  ADD COLUMN IF NOT EXISTS feature TEXT NOT NULL DEFAULT 'chat';

ALTER TABLE public.ai_usage_logs
  ADD COLUMN IF NOT EXISTS feature TEXT NOT NULL DEFAULT 'chat';

ALTER TABLE public.ai_usage_windows
  DROP CONSTRAINT IF EXISTS ai_usage_windows_feature_check;
ALTER TABLE public.ai_usage_windows
  ADD CONSTRAINT ai_usage_windows_feature_check CHECK (feature IN ('chat', 'document_import'));

ALTER TABLE public.ai_usage_logs
  DROP CONSTRAINT IF EXISTS ai_usage_logs_feature_check;
ALTER TABLE public.ai_usage_logs
  ADD CONSTRAINT ai_usage_logs_feature_check CHECK (feature IN ('chat', 'document_import'));

-- =============================================================================
-- 2. UNIQUE de ai_usage_windows precisa incluir feature. O nome do constraint
--    original é autogerado (declarado inline na CREATE TABLE de
--    20260725120000) — não hardcodeio um nome adivinhado; procuro no
--    catálogo pela LISTA DE COLUNAS, na mesma ordem declarada originalmente,
--    e falho alto se não achar exatamente uma. Isto é inspeção pura de
--    catálogo (pg_constraint/pg_attribute), não EXECUTE de corpo de função —
--    não é o mesmo tipo de risco do Fato 1.
-- =============================================================================

DO $$
DECLARE
  v_conname TEXT;
  v_expected_conkey INT2[];
BEGIN
  SELECT ARRAY[
    (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.ai_usage_windows'::regclass AND attname = 'company_id'),
    (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.ai_usage_windows'::regclass AND attname = 'scope'),
    (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.ai_usage_windows'::regclass AND attname = 'subject_id'),
    (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.ai_usage_windows'::regclass AND attname = 'window_start'),
    (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.ai_usage_windows'::regclass AND attname = 'window_seconds')
  ]::INT2[] INTO v_expected_conkey;

  SELECT c.conname INTO v_conname
  FROM pg_constraint c
  WHERE c.conrelid = 'public.ai_usage_windows'::regclass
    AND c.contype = 'u'
    AND c.conkey = v_expected_conkey;

  IF v_conname IS NULL THEN
    RAISE EXCEPTION
      'ai_usage_windows não tem a UNIQUE (company_id, scope, subject_id, window_start, window_seconds) '
      'esperada — a premissa desta migration sobre o schema vivo está errada; pare e reverifique '
      'com pg_get_functiondef/\\d antes de prosseguir';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ai_usage_windows'::regclass
      AND conname = 'ai_usage_windows_company_scope_subject_window_feature_key'
  ) THEN
    EXECUTE format('ALTER TABLE public.ai_usage_windows DROP CONSTRAINT %I', v_conname);
    ALTER TABLE public.ai_usage_windows
      ADD CONSTRAINT ai_usage_windows_company_scope_subject_window_feature_key
      UNIQUE (company_id, scope, subject_id, window_start, window_seconds, feature);
  END IF;
END;
$$;

-- =============================================================================
-- 3. reserve_ai_usage — reescrita completa (Fatos 1-3). Mesma lógica de
--    20260725120000_ai_secure_gateway.sql após o patch de
--    20260725123000_fix_ai_usage_conflict.sql, com p_feature threadado em
--    todo ponto que toca ai_usage_windows/ai_usage_logs. Nada de negócio
--    (limites, roles, providers) muda além disso.
-- =============================================================================

DROP FUNCTION IF EXISTS public.reserve_ai_usage(UUID, UUID, INTEGER);

CREATE FUNCTION public.reserve_ai_usage(
  p_user_id UUID,
  p_request_id UUID,
  p_estimated_input_tokens INTEGER,
  p_feature TEXT DEFAULT 'chat'
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
     OR p_estimated_input_tokens > 100000
     OR p_feature IS NULL
     OR p_feature NOT IN ('chat', 'document_import') THEN
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
      request_id, company_id, user_id, status, error_code, completed_at, latency_ms, feature
    ) VALUES (
      p_request_id, v_profile.company_id, p_user_id, 'blocked', 'global_disabled', now(), 0, p_feature
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
      request_id, company_id, user_id, status, error_code, completed_at, latency_ms, feature
    ) VALUES (
      p_request_id, v_profile.company_id, p_user_id, 'blocked', 'company_disabled', now(), 0, p_feature
    );
    RETURN QUERY SELECT false, 'company_disabled', v_profile.company_id, p_user_id,
      NULL::TEXT, NULL::TEXT, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  v_allowed_roles := COALESCE(v_company_settings.allowed_roles, v_global.allowed_roles);
  IF v_profile.role IS NULL OR NOT (v_profile.role = ANY(v_allowed_roles)) THEN
    INSERT INTO public.ai_usage_logs (
      request_id, company_id, user_id, status, error_code, completed_at, latency_ms, feature
    ) VALUES (
      p_request_id, v_profile.company_id, p_user_id, 'blocked', 'permission_denied', now(), 0, p_feature
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
      completed_at, latency_ms, feature
    ) VALUES (
      p_request_id, v_profile.company_id, p_user_id, v_provider, v_model,
      'blocked', 'configuration_error', now(), 0, p_feature
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

  -- ON CONFLICT DO NOTHING genérico (sem lista de colunas) — preserva o
  -- comportamento vivo do Fato 1. Uma cláusula nomeada aqui colidiria com a
  -- coluna de retorno `company_id` de RETURNS TABLE outra vez.
  INSERT INTO public.ai_usage_windows (
    company_id, scope, subject_id, window_start, window_seconds, feature
  ) VALUES (
    v_profile.company_id, 'company', v_profile.company_id, v_window_start, v_window_seconds, p_feature
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO public.ai_usage_windows (
    company_id, scope, subject_id, window_start, window_seconds, feature
  ) VALUES (
    v_profile.company_id, 'user', p_user_id, v_window_start, v_window_seconds, p_feature
  )
  ON CONFLICT DO NOTHING;

  -- Ordem fixa: empresa primeiro, usuário depois. O lock impede duas reservas
  -- concorrentes de observarem o mesmo saldo disponível. `feature` no WHERE é
  -- o que evita que duas features compartilhem a mesma linha (Fato 3).
  SELECT * INTO v_company_window
  FROM public.ai_usage_windows usage_window
  WHERE usage_window.company_id = v_profile.company_id
    AND usage_window.scope = 'company'
    AND usage_window.subject_id = v_profile.company_id
    AND usage_window.window_start = v_window_start
    AND usage_window.window_seconds = v_window_seconds
    AND usage_window.feature = p_feature
  FOR UPDATE;

  SELECT * INTO v_user_window
  FROM public.ai_usage_windows usage_window
  WHERE usage_window.company_id = v_profile.company_id
    AND usage_window.scope = 'user'
    AND usage_window.subject_id = p_user_id
    AND usage_window.window_start = v_window_start
    AND usage_window.window_seconds = v_window_seconds
    AND usage_window.feature = p_feature
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
      window_start, window_seconds, completed_at, latency_ms, feature
    ) VALUES (
      p_request_id, v_profile.company_id, p_user_id, v_provider, v_model,
      'blocked', v_limit_code, v_window_start, v_window_seconds, now(), 0, p_feature
    );
    RETURN QUERY SELECT false, v_limit_code, v_profile.company_id, p_user_id,
      v_provider, v_model, v_global.max_output_tokens, v_global.provider_timeout_ms;
    RETURN;
  END IF;

  INSERT INTO public.ai_usage_logs (
    request_id, company_id, user_id, provider, model, status,
    window_start, window_seconds, reserved_tokens, reserved_cost_micros, feature
  ) VALUES (
    p_request_id, v_profile.company_id, p_user_id, v_provider, v_model, 'started',
    v_window_start, v_window_seconds, v_reserved_tokens, v_reserved_cost, p_feature
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
    AND ai_usage_windows.window_seconds = v_window_seconds
    AND ai_usage_windows.feature = p_feature;

  UPDATE public.ai_usage_windows
  SET request_count = request_count + 1,
      token_count = token_count + v_reserved_tokens,
      cost_micros = cost_micros + v_reserved_cost,
      updated_at = now()
  WHERE ai_usage_windows.company_id = v_profile.company_id
    AND ai_usage_windows.scope = 'user'
    AND ai_usage_windows.subject_id = p_user_id
    AND ai_usage_windows.window_start = v_window_start
    AND ai_usage_windows.window_seconds = v_window_seconds
    AND ai_usage_windows.feature = p_feature;

  RETURN QUERY SELECT true, 'allowed', v_profile.company_id, p_user_id,
    v_provider, v_model, v_global.max_output_tokens, v_global.provider_timeout_ms;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_usage(UUID, UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_usage(UUID, UUID, INTEGER, TEXT) TO service_role;

COMMENT ON FUNCTION public.reserve_ai_usage(UUID, UUID, INTEGER, TEXT) IS
  'Valida tenant/permissão/configuração e reserva quotas atomicamente, isolado por feature (chat|document_import); somente service_role.';

-- =============================================================================
-- 4. finalize_ai_usage — mesma assinatura pública (6 parâmetros, sem
--    p_feature: a feature já está na linha de ai_usage_logs localizada por
--    request_id, então v_log.feature resolve sozinho via %ROWTYPE). Só os
--    dois UPDATE em ai_usage_windows ganham o filtro de feature.
-- =============================================================================

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
    AND ai_usage_windows.window_seconds = v_log.window_seconds
    AND ai_usage_windows.feature = v_log.feature;

  UPDATE public.ai_usage_windows
  SET token_count = GREATEST(0, token_count + v_token_delta),
      cost_micros = GREATEST(0, cost_micros + v_cost_delta),
      updated_at = now()
  WHERE ai_usage_windows.company_id = v_log.company_id
    AND ai_usage_windows.scope = 'user'
    AND ai_usage_windows.subject_id = v_log.user_id
    AND ai_usage_windows.window_start = v_log.window_start
    AND ai_usage_windows.window_seconds = v_log.window_seconds
    AND ai_usage_windows.feature = v_log.feature;

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

COMMENT ON TABLE public.ai_usage_windows IS
  'Janelas de quota por company/user, isoladas por feature (chat|document_import) desde 20260814101500. Uma importação não consome a janela do chat.';
COMMENT ON TABLE public.ai_usage_logs IS
  'Metadados operacionais de IA e ferramentas, com dimensão feature. Prompts, respostas, resultados, mensagens e payloads são proibidos.';

COMMIT;
