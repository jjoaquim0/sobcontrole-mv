-- Story 1.21 — Gestly inventory tools (complemento da P1).
-- Adiciona duas consultas read-only que faltavam para responder
-- "quanto tenho de estoque?" e "quantos {produto} eu tenho?".
-- Mesmas garantias da P1: SECURITY INVOKER, auth.uid(), RLS e filtro
-- explícito por company_id. Nenhuma escrita, SQL livre ou escolha de tenant.

BEGIN;

-- As novas ferramentas precisam ser aceitas pela auditoria de metadados.
ALTER TABLE public.ai_usage_logs
  DROP CONSTRAINT IF EXISTS ai_usage_logs_tool_name_check;

ALTER TABLE public.ai_usage_logs
  ADD CONSTRAINT ai_usage_logs_tool_name_check CHECK (
    tool_name IS NULL OR tool_name IN (
      'get_sales_summary',
      'get_customers_summary',
      'get_low_stock_products',
      'get_inventory_summary',
      'get_product_stock',
      'get_overdue_financial_items',
      'unknown'
    )
  );

CREATE INDEX IF NOT EXISTS idx_products_company_active
  ON public.products(company_id, is_active);

-- Visão agregada do estoque. Não retorna preço de custo/venda nem valuation
-- monetária: a P1 mantém preços fora de qualquer saída enviada ao provider.
CREATE OR REPLACE FUNCTION public.gestly_inventory_summary()
RETURNS TABLE (
  active_products BIGINT,
  total_units NUMERIC,
  out_of_stock_count BIGINT,
  low_stock_count BIGINT,
  healthy_count BIGINT
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

  SELECT profile.company_id
  INTO v_company_id
  FROM public.profiles AS profile
  WHERE profile.id = v_user_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'company context unavailable';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    COALESCE(SUM(product.current_quantity), 0)::NUMERIC,
    COUNT(*) FILTER (WHERE product.current_quantity <= 0)::BIGINT,
    COUNT(*) FILTER (
      WHERE product.current_quantity > 0
        AND product.current_quantity <= product.min_quantity
    )::BIGINT,
    COUNT(*) FILTER (WHERE product.current_quantity > product.min_quantity)::BIGINT
  FROM public.products AS product
  WHERE product.company_id = v_company_id
    AND product.is_active;
END;
$$;

-- Busca pontual de produto por nome ou SKU. Os curingas do LIKE são escapados
-- para que o termo nunca vire um dump de catálogo, e o limite é fixo em 10.
CREATE OR REPLACE FUNCTION public.gestly_product_stock(
  p_search TEXT,
  p_limit INTEGER
)
RETURNS TABLE (
  product_name TEXT,
  sku TEXT,
  unit TEXT,
  current_stock NUMERIC,
  minimum_stock NUMERIC,
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
  v_term TEXT;
  v_pattern TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'authentication required';
  END IF;

  v_term := btrim(COALESCE(p_search, ''));

  IF length(v_term) < 2 OR length(v_term) > 60 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid query';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 10 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid limit';
  END IF;

  SELECT profile.company_id
  INTO v_company_id
  FROM public.profiles AS profile
  WHERE profile.id = v_user_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'company context unavailable';
  END IF;

  v_pattern := '%' || replace(replace(replace(v_term, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  RETURN QUERY
  SELECT
    product.name,
    product.sku,
    product.unit,
    product.current_quantity,
    product.min_quantity,
    CASE
      WHEN product.current_quantity <= 0 THEN 'out_of_stock'
      WHEN product.current_quantity <= product.min_quantity THEN 'low_stock'
      ELSE 'in_stock'
    END,
    COUNT(*) OVER()::BIGINT
  FROM public.products AS product
  WHERE product.company_id = v_company_id
    AND product.is_active
    AND (
      product.name ILIKE v_pattern ESCAPE '\'
      OR product.sku ILIKE v_pattern ESCAPE '\'
    )
  ORDER BY
    CASE WHEN lower(product.name) = lower(v_term) THEN 0 ELSE 1 END,
    product.name ASC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.gestly_inventory_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gestly_product_stock(TEXT, INTEGER) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.gestly_inventory_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gestly_product_stock(TEXT, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.gestly_inventory_summary() IS
  'Read-only tenant-scoped inventory totals for Gestly. SECURITY INVOKER + RLS. No pricing.';
COMMENT ON FUNCTION public.gestly_product_stock(TEXT, INTEGER) IS
  'Read-only tenant-scoped product stock lookup for Gestly. SECURITY INVOKER + RLS. Escaped LIKE, max 10 rows.';

COMMIT;
