-- Story 1.21 — Gestly read-only tools.
-- Business queries run as the authenticated user (SECURITY INVOKER + RLS).
-- service_role remains limited to P0 quota/governance and metadata-only audit.

BEGIN;

ALTER TABLE public.ai_usage_logs
  ADD COLUMN IF NOT EXISTS tool_name TEXT,
  ADD COLUMN IF NOT EXISTS tool_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tool_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tool_record_count INTEGER,
  ADD COLUMN IF NOT EXISTS tool_results_truncated BOOLEAN;

ALTER TABLE public.ai_usage_logs
  DROP CONSTRAINT IF EXISTS ai_usage_logs_tool_name_check,
  DROP CONSTRAINT IF EXISTS ai_usage_logs_tool_record_count_check,
  DROP CONSTRAINT IF EXISTS ai_usage_logs_tool_period_check,
  DROP CONSTRAINT IF EXISTS ai_usage_logs_error_code_check;

ALTER TABLE public.ai_usage_logs
  ADD CONSTRAINT ai_usage_logs_tool_name_check CHECK (
    tool_name IS NULL OR tool_name IN (
      'get_sales_summary',
      'get_customers_summary',
      'get_low_stock_products',
      'get_overdue_financial_items',
      'unknown'
    )
  ),
  ADD CONSTRAINT ai_usage_logs_tool_record_count_check CHECK (
    tool_record_count IS NULL OR tool_record_count >= 0
  ),
  ADD CONSTRAINT ai_usage_logs_tool_period_check CHECK (
    tool_period_start IS NULL
    OR tool_period_end IS NULL
    OR tool_period_end >= tool_period_start
  ),
  ADD CONSTRAINT ai_usage_logs_error_code_check CHECK (
    error_code IS NULL OR error_code IN (
      'unauthorized',
      'company_not_found',
      'permission_denied',
      'financial_permission_denied',
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
      'invalid_tool_arguments',
      'tool_unavailable',
      'tool_query_failed',
      'usage_limit_exceeded',
      'internal_error'
    )
  );

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_tool_period
  ON public.ai_usage_logs(company_id, tool_name, created_at DESC)
  WHERE tool_name IS NOT NULL;

-- PostgREST UPDATE predicates require SELECT on the columns used by WHERE.
-- The Edge Function only updates the five metadata columns below.
REVOKE ALL ON TABLE public.ai_usage_logs FROM service_role;
GRANT SELECT (request_id, company_id, user_id)
  ON public.ai_usage_logs TO service_role;
GRANT UPDATE (
  tool_name,
  tool_period_start,
  tool_period_end,
  tool_record_count,
  tool_results_truncated
) ON public.ai_usage_logs TO service_role;

-- Existing route authorization already restricts Finance to admin/manager.
-- Restrictive policies make the database enforce the same rule even when
-- another permissive tenant policy also matches.
DROP POLICY IF EXISTS "gestly_financial_roles_receivables" ON public.account_receivables;
CREATE POLICY "gestly_financial_roles_receivables"
  ON public.account_receivables
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    company_id = (SELECT public.get_user_company_id())
    AND (SELECT public.get_user_role()) IN ('admin', 'manager')
  );

DROP POLICY IF EXISTS "gestly_financial_roles_payables" ON public.account_payables;
CREATE POLICY "gestly_financial_roles_payables"
  ON public.account_payables
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    company_id = (SELECT public.get_user_company_id())
    AND (SELECT public.get_user_role()) IN ('admin', 'manager')
  );

CREATE INDEX IF NOT EXISTS idx_sales_company_payment_created
  ON public.sales(company_id, payment_status, created_at)
  INCLUDE (final_value);

CREATE INDEX IF NOT EXISTS idx_customers_company_active_created
  ON public.customers(company_id, is_active, created_at);

CREATE INDEX IF NOT EXISTS idx_products_low_stock_scan
  ON public.products(company_id)
  WHERE is_active AND current_quantity <= min_quantity;

CREATE OR REPLACE FUNCTION public.gestly_sales_summary(
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ
)
RETURNS TABLE (
  total_sold NUMERIC,
  sales_count BIGINT,
  average_ticket NUMERIC
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_company_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'authentication required';
  END IF;

  IF p_period_start IS NULL
     OR p_period_end IS NULL
     OR p_period_end <= p_period_start
     OR p_period_end - p_period_start > INTERVAL '366 days' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid period';
  END IF;

  SELECT profile.company_id
  INTO v_company_id
  FROM public.profiles AS profile
  WHERE profile.id = v_user_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'company context unavailable';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(sale.final_value), 0)::NUMERIC,
    COUNT(*)::BIGINT,
    CASE
      WHEN COUNT(*) = 0 THEN NULL
      ELSE (SUM(sale.final_value) / COUNT(*))::NUMERIC
    END
  FROM public.sales AS sale
  WHERE sale.company_id = v_company_id
    AND sale.payment_status = 'paid'
    AND sale.created_at >= p_period_start
    AND sale.created_at < p_period_end;
END;
$$;

CREATE OR REPLACE FUNCTION public.gestly_customers_summary(
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ
)
RETURNS TABLE (
  active_customers BIGINT,
  new_customers BIGINT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_company_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'authentication required';
  END IF;

  IF p_period_start IS NULL
     OR p_period_end IS NULL
     OR p_period_end <= p_period_start
     OR p_period_end - p_period_start > INTERVAL '366 days' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid period';
  END IF;

  SELECT profile.company_id
  INTO v_company_id
  FROM public.profiles AS profile
  WHERE profile.id = v_user_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'company context unavailable';
  END IF;

  RETURN QUERY
  SELECT
    (
      SELECT COUNT(*)::BIGINT
      FROM public.customers AS customer
      WHERE customer.company_id = v_company_id
        AND customer.is_active
    ),
    (
      SELECT COUNT(*)::BIGINT
      FROM public.customers AS customer
      WHERE customer.company_id = v_company_id
        AND customer.created_at >= p_period_start
        AND customer.created_at < p_period_end
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.gestly_low_stock_products(
  p_limit INTEGER
)
RETURNS TABLE (
  product_name TEXT,
  sku TEXT,
  current_stock NUMERIC,
  minimum_stock NUMERIC,
  shortage NUMERIC,
  stock_status TEXT,
  total_matches BIGINT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_company_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'authentication required';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 25 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid limit';
  END IF;

  SELECT profile.company_id
  INTO v_company_id
  FROM public.profiles AS profile
  WHERE profile.id = v_user_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'company context unavailable';
  END IF;

  RETURN QUERY
  SELECT
    product.name,
    product.sku,
    product.current_quantity,
    product.min_quantity,
    GREATEST(product.min_quantity - product.current_quantity, 0),
    CASE
      WHEN product.current_quantity <= 0 THEN 'out_of_stock'
      ELSE 'low_stock'
    END,
    COUNT(*) OVER()::BIGINT
  FROM public.products AS product
  WHERE product.company_id = v_company_id
    AND product.is_active
    AND product.current_quantity <= product.min_quantity
  ORDER BY
    CASE WHEN product.current_quantity <= 0 THEN 0 ELSE 1 END,
    (product.min_quantity - product.current_quantity) DESC,
    product.name ASC
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.gestly_overdue_financial_items(
  p_item_type TEXT,
  p_limit INTEGER,
  p_reference_at TIMESTAMPTZ
)
RETURNS TABLE (
  reference_at TIMESTAMPTZ,
  receivable_total NUMERIC,
  receivable_count BIGINT,
  payable_total NUMERIC,
  payable_count BIGINT,
  combined_total NUMERIC,
  combined_count BIGINT,
  total_matches BIGINT,
  items JSONB
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_company_id UUID;
  v_role TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'authentication required';
  END IF;

  IF p_item_type NOT IN ('receivable', 'payable', 'both') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid item type';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 20 OR p_reference_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid limit or reference';
  END IF;

  SELECT profile.company_id, profile.role
  INTO v_company_id, v_role
  FROM public.profiles AS profile
  WHERE profile.id = v_user_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'company context unavailable';
  END IF;

  IF v_role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'financial permission denied';
  END IF;

  RETURN QUERY
  WITH overdue AS (
    SELECT
      'receivable'::TEXT AS item_kind,
      receivable.amount,
      receivable.due_date
    FROM public.account_receivables AS receivable
    WHERE receivable.company_id = v_company_id
      AND p_item_type IN ('receivable', 'both')
      AND receivable.status IN ('pending', 'late')
      AND receivable.due_date < p_reference_at

    UNION ALL

    SELECT
      'payable'::TEXT AS item_kind,
      payable.amount,
      payable.due_date
    FROM public.account_payables AS payable
    WHERE payable.company_id = v_company_id
      AND p_item_type IN ('payable', 'both')
      AND payable.status IN ('pending', 'late')
      AND payable.due_date < p_reference_at
  ),
  summary AS (
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE item_kind = 'receivable'), 0)::NUMERIC
        AS receivable_total,
      COUNT(*) FILTER (WHERE item_kind = 'receivable')::BIGINT
        AS receivable_count,
      COALESCE(SUM(amount) FILTER (WHERE item_kind = 'payable'), 0)::NUMERIC
        AS payable_total,
      COUNT(*) FILTER (WHERE item_kind = 'payable')::BIGINT
        AS payable_count,
      COALESCE(SUM(amount), 0)::NUMERIC AS combined_total,
      COUNT(*)::BIGINT AS combined_count
    FROM overdue
  ),
  limited AS (
    SELECT item_kind, amount, due_date
    FROM overdue
    ORDER BY due_date ASC, amount DESC
    LIMIT p_limit
  )
  SELECT
    p_reference_at,
    summary.receivable_total,
    summary.receivable_count,
    summary.payable_total,
    summary.payable_count,
    summary.combined_total,
    summary.combined_count,
    summary.combined_count,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'item_type', limited.item_kind,
            'amount', limited.amount,
            'due_date', limited.due_date,
            'days_overdue', GREATEST(
              0,
              FLOOR(EXTRACT(EPOCH FROM (p_reference_at - limited.due_date)) / 86400)::INTEGER
            )
          )
          ORDER BY limited.due_date ASC, limited.amount DESC
        )
        FROM limited
      ),
      '[]'::JSONB
    )
  FROM summary;
END;
$$;

REVOKE ALL ON FUNCTION public.gestly_sales_summary(TIMESTAMPTZ, TIMESTAMPTZ)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gestly_customers_summary(TIMESTAMPTZ, TIMESTAMPTZ)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gestly_low_stock_products(INTEGER)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gestly_overdue_financial_items(TEXT, INTEGER, TIMESTAMPTZ)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.gestly_sales_summary(TIMESTAMPTZ, TIMESTAMPTZ)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.gestly_customers_summary(TIMESTAMPTZ, TIMESTAMPTZ)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.gestly_low_stock_products(INTEGER)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.gestly_overdue_financial_items(TEXT, INTEGER, TIMESTAMPTZ)
  TO authenticated;

COMMENT ON FUNCTION public.gestly_sales_summary(TIMESTAMPTZ, TIMESTAMPTZ) IS
  'Read-only tenant-scoped aggregate of paid sales for Gestly. SECURITY INVOKER + RLS.';
COMMENT ON FUNCTION public.gestly_customers_summary(TIMESTAMPTZ, TIMESTAMPTZ) IS
  'Read-only tenant-scoped customer counts for Gestly. SECURITY INVOKER + RLS.';
COMMENT ON FUNCTION public.gestly_low_stock_products(INTEGER) IS
  'Read-only tenant-scoped minimized low-stock list for Gestly. SECURITY INVOKER + RLS.';
COMMENT ON FUNCTION public.gestly_overdue_financial_items(TEXT, INTEGER, TIMESTAMPTZ) IS
  'Read-only tenant-scoped minimized overdue summary for admin/manager. SECURITY INVOKER + RLS.';

-- Replace the P0 finalizer without changing its public signature. P1 adds only
-- normalized error codes; prompts, tool outputs and responses remain absent.
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

COMMIT;
