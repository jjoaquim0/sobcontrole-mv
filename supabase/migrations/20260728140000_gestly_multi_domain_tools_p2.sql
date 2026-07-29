-- Story 1.22 — Gestly como camada de consulta multi-domínio (P2).
--
-- Amplia as consultas read-only para pipeline, agenda, fornecedores, compras,
-- documentos, visão geral e listagem ampla de estoque.
--
-- Mesmas garantias da P1, sem exceção:
--   * SECURITY INVOKER (a query roda como o usuário, sob RLS);
--   * auth.uid() obrigatório;
--   * company_id derivado do profile, nunca recebido por parâmetro;
--   * filtro explícito por company_id além da RLS;
--   * limites fixos de linhas;
--   * nenhuma escrita.
--
-- Os vocabulários de status abaixo vêm de src/types/index.ts (não são inventados):
--   deals.status        open | won | lost
--   purchases.status    paid | pending | canceled
--   documents.status    active | archived | deleted
--   suppliers.status    active | inactive
--   appointments.status agendado | confirmado | concluido | cancelado | nao_compareceu | pendente

BEGIN;

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
      'list_inventory_products',
      'get_pipeline_summary',
      'get_agenda_summary',
      'list_suppliers',
      'get_purchases_summary',
      'get_documents_summary',
      'get_business_overview',
      'get_financial_overview',
      'get_overdue_financial_items',
      'get_system_help',
      'unknown'
    )
  );

CREATE INDEX IF NOT EXISTS idx_deals_company_status
  ON public.deals(company_id, status);
CREATE INDEX IF NOT EXISTS idx_appointments_company_start
  ON public.appointments(company_id, start_at);
CREATE INDEX IF NOT EXISTS idx_purchases_company_status_created
  ON public.purchases(company_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_documents_company_status_created
  ON public.documents(company_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_suppliers_company_status
  ON public.suppliers(company_id, status);

-- ---------------------------------------------------------------------------
-- Estoque: listagem ampla ("quais produtos eu tenho?")
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gestly_list_inventory_products(
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'authentication required';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 50 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid limit';
  END IF;

  SELECT profile.company_id INTO v_company_id
  FROM public.profiles AS profile WHERE profile.id = v_user_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'company context unavailable';
  END IF;

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
  ORDER BY product.name ASC
  LIMIT p_limit;
END;
$$;

-- ---------------------------------------------------------------------------
-- Pipeline de vendas
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gestly_pipeline_summary()
RETURNS TABLE (
  open_count BIGINT,
  open_value NUMERIC,
  won_count BIGINT,
  won_value NUMERIC,
  lost_count BIGINT,
  stages JSONB
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

  SELECT profile.company_id INTO v_company_id
  FROM public.profiles AS profile WHERE profile.id = v_user_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'company context unavailable';
  END IF;

  RETURN QUERY
  WITH company_deals AS (
    SELECT deal.status, deal.value, deal.stage_id
    FROM public.deals AS deal
    WHERE deal.company_id = v_company_id
  ),
  totals AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'open')::BIGINT AS open_count,
      COALESCE(SUM(value) FILTER (WHERE status = 'open'), 0)::NUMERIC AS open_value,
      COUNT(*) FILTER (WHERE status = 'won')::BIGINT AS won_count,
      COALESCE(SUM(value) FILTER (WHERE status = 'won'), 0)::NUMERIC AS won_value,
      COUNT(*) FILTER (WHERE status = 'lost')::BIGINT AS lost_count
    FROM company_deals
  ),
  by_stage AS (
    SELECT
      stage.name AS stage_name,
      stage.position AS stage_position,
      COUNT(deal.stage_id)::BIGINT AS deal_count,
      COALESCE(SUM(deal.value), 0)::NUMERIC AS deal_value
    FROM public.pipeline_stages AS stage
    LEFT JOIN company_deals AS deal
      ON deal.stage_id = stage.id AND deal.status = 'open'
    WHERE stage.company_id = v_company_id
      AND stage.is_active
    GROUP BY stage.name, stage.position
  )
  SELECT
    totals.open_count,
    totals.open_value,
    totals.won_count,
    totals.won_value,
    totals.lost_count,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'stage', by_stage.stage_name,
            'open_deals', by_stage.deal_count,
            'open_value', by_stage.deal_value
          )
          ORDER BY by_stage.stage_position ASC
        )
        FROM by_stage
      ),
      '[]'::JSONB
    )
  FROM totals;
END;
$$;

-- ---------------------------------------------------------------------------
-- Agenda e tarefas. Os limites de dia/semana chegam prontos do backend, que os
-- calcula no fuso da empresa com o mesmo código já testado da P1.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gestly_agenda_summary(
  p_reference TIMESTAMPTZ,
  p_day_start TIMESTAMPTZ,
  p_day_end TIMESTAMPTZ,
  p_week_end TIMESTAMPTZ,
  p_limit INTEGER
)
RETURNS TABLE (
  today_count BIGINT,
  week_count BIGINT,
  overdue_count BIGINT,
  items JSONB
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
  IF p_reference IS NULL OR p_day_start IS NULL OR p_day_end IS NULL
     OR p_week_end IS NULL OR p_day_end <= p_day_start OR p_week_end < p_day_end THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid window';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 15 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid limit';
  END IF;

  SELECT profile.company_id INTO v_company_id
  FROM public.profiles AS profile WHERE profile.id = v_user_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'company context unavailable';
  END IF;

  RETURN QUERY
  WITH pending AS (
    SELECT appointment.title, appointment.type, appointment.status, appointment.start_at
    FROM public.appointments AS appointment
    WHERE appointment.company_id = v_company_id
      AND appointment.status IN ('agendado', 'confirmado', 'pendente')
  ),
  counters AS (
    SELECT
      COUNT(*) FILTER (WHERE start_at >= p_day_start AND start_at < p_day_end)::BIGINT AS today_count,
      COUNT(*) FILTER (WHERE start_at >= p_day_start AND start_at < p_week_end)::BIGINT AS week_count,
      COUNT(*) FILTER (WHERE start_at < p_reference)::BIGINT AS overdue_count
    FROM pending
  ),
  limited AS (
    SELECT title, type, status, start_at
    FROM pending
    WHERE start_at < p_week_end
    ORDER BY start_at ASC
    LIMIT p_limit
  )
  SELECT
    counters.today_count,
    counters.week_count,
    counters.overdue_count,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'title', limited.title,
            'type', limited.type,
            'status', limited.status,
            'start_at', limited.start_at,
            'overdue', limited.start_at < p_reference
          )
          ORDER BY limited.start_at ASC
        )
        FROM limited
      ),
      '[]'::JSONB
    )
  FROM counters;
END;
$$;

-- ---------------------------------------------------------------------------
-- Fornecedores. Sem e-mail, telefone ou documento: o provider recebe apenas
-- nome e situação, seguindo a minimização já adotada para clientes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gestly_list_suppliers(
  p_limit INTEGER
)
RETURNS TABLE (
  supplier_name TEXT,
  supplier_status TEXT,
  active_count BIGINT,
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
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 30 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid limit';
  END IF;

  SELECT profile.company_id INTO v_company_id
  FROM public.profiles AS profile WHERE profile.id = v_user_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'company context unavailable';
  END IF;

  RETURN QUERY
  SELECT
    supplier.name,
    supplier.status,
    COUNT(*) FILTER (WHERE supplier.status = 'active') OVER()::BIGINT,
    COUNT(*) OVER()::BIGINT
  FROM public.suppliers AS supplier
  WHERE supplier.company_id = v_company_id
  ORDER BY
    CASE WHEN supplier.status = 'active' THEN 0 ELSE 1 END,
    supplier.name ASC
  LIMIT p_limit;
END;
$$;

-- ---------------------------------------------------------------------------
-- Compras
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gestly_purchases_summary(
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ
)
RETURNS TABLE (
  paid_total NUMERIC,
  paid_count BIGINT,
  pending_total NUMERIC,
  pending_count BIGINT
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
  IF p_period_start IS NULL OR p_period_end IS NULL
     OR p_period_end <= p_period_start
     OR p_period_end - p_period_start > INTERVAL '366 days' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid period';
  END IF;

  SELECT profile.company_id INTO v_company_id
  FROM public.profiles AS profile WHERE profile.id = v_user_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'company context unavailable';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(purchase.final_value) FILTER (WHERE purchase.status = 'paid'), 0)::NUMERIC,
    COUNT(*) FILTER (WHERE purchase.status = 'paid')::BIGINT,
    COALESCE(SUM(purchase.final_value) FILTER (WHERE purchase.status = 'pending'), 0)::NUMERIC,
    COUNT(*) FILTER (WHERE purchase.status = 'pending')::BIGINT
  FROM public.purchases AS purchase
  WHERE purchase.company_id = v_company_id
    AND purchase.created_at >= p_period_start
    AND purchase.created_at < p_period_end;
END;
$$;

-- ---------------------------------------------------------------------------
-- Documentos. Somente contagens por categoria: nenhum nome de arquivo, URL,
-- storage_path ou vínculo é enviado ao provider.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gestly_documents_summary(
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ
)
RETURNS TABLE (
  active_total BIGINT,
  new_in_period BIGINT,
  categories JSONB
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
  IF p_period_start IS NULL OR p_period_end IS NULL
     OR p_period_end <= p_period_start
     OR p_period_end - p_period_start > INTERVAL '366 days' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid period';
  END IF;

  SELECT profile.company_id INTO v_company_id
  FROM public.profiles AS profile WHERE profile.id = v_user_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'company context unavailable';
  END IF;

  RETURN QUERY
  WITH active_documents AS (
    SELECT document.category, document.created_at
    FROM public.documents AS document
    WHERE document.company_id = v_company_id
      AND document.status = 'active'
  )
  SELECT
    (SELECT COUNT(*)::BIGINT FROM active_documents),
    (
      SELECT COUNT(*)::BIGINT FROM active_documents
      WHERE created_at >= p_period_start AND created_at < p_period_end
    ),
    COALESCE(
      (
        SELECT jsonb_agg(entry ORDER BY entry->>'category')
        FROM (
          SELECT jsonb_build_object(
            'category', COALESCE(category, 'sem_categoria'),
            'documents', COUNT(*)
          ) AS entry
          FROM active_documents
          GROUP BY COALESCE(category, 'sem_categoria')
        ) AS grouped
      ),
      '[]'::JSONB
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- Visão geral. Sem nenhum dado financeiro, para que continue disponível a
-- todos os papéis sem abrir exceção na regra financeira.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gestly_business_overview(
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ,
  p_reference TIMESTAMPTZ
)
RETURNS TABLE (
  sales_total NUMERIC,
  sales_count BIGINT,
  open_deals BIGINT,
  open_deals_value NUMERIC,
  overdue_appointments BIGINT,
  active_products BIGINT,
  low_stock_products BIGINT,
  out_of_stock_products BIGINT,
  active_customers BIGINT
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
  IF p_period_start IS NULL OR p_period_end IS NULL OR p_reference IS NULL
     OR p_period_end <= p_period_start
     OR p_period_end - p_period_start > INTERVAL '366 days' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid period';
  END IF;

  SELECT profile.company_id INTO v_company_id
  FROM public.profiles AS profile WHERE profile.id = v_user_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'company context unavailable';
  END IF;

  RETURN QUERY
  SELECT
    (
      SELECT COALESCE(SUM(sale.final_value), 0)::NUMERIC
      FROM public.sales AS sale
      WHERE sale.company_id = v_company_id AND sale.payment_status = 'paid'
        AND sale.created_at >= p_period_start AND sale.created_at < p_period_end
    ),
    (
      SELECT COUNT(*)::BIGINT
      FROM public.sales AS sale
      WHERE sale.company_id = v_company_id AND sale.payment_status = 'paid'
        AND sale.created_at >= p_period_start AND sale.created_at < p_period_end
    ),
    (
      SELECT COUNT(*)::BIGINT FROM public.deals AS deal
      WHERE deal.company_id = v_company_id AND deal.status = 'open'
    ),
    (
      SELECT COALESCE(SUM(deal.value), 0)::NUMERIC FROM public.deals AS deal
      WHERE deal.company_id = v_company_id AND deal.status = 'open'
    ),
    (
      SELECT COUNT(*)::BIGINT FROM public.appointments AS appointment
      WHERE appointment.company_id = v_company_id
        AND appointment.status IN ('agendado', 'confirmado', 'pendente')
        AND appointment.start_at < p_reference
    ),
    (
      SELECT COUNT(*)::BIGINT FROM public.products AS product
      WHERE product.company_id = v_company_id AND product.is_active
    ),
    (
      SELECT COUNT(*)::BIGINT FROM public.products AS product
      WHERE product.company_id = v_company_id AND product.is_active
        AND product.current_quantity > 0
        AND product.current_quantity <= product.min_quantity
    ),
    (
      SELECT COUNT(*)::BIGINT FROM public.products AS product
      WHERE product.company_id = v_company_id AND product.is_active
        AND product.current_quantity <= 0
    ),
    (
      SELECT COUNT(*)::BIGINT FROM public.customers AS customer
      WHERE customer.company_id = v_company_id AND customer.is_active
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- Financeiro consolidado. Restrito a admin/manager, como o restante do domínio.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gestly_financial_overview(
  p_reference TIMESTAMPTZ
)
RETURNS TABLE (
  receivable_pending_total NUMERIC,
  receivable_pending_count BIGINT,
  receivable_overdue_total NUMERIC,
  receivable_overdue_count BIGINT,
  payable_pending_total NUMERIC,
  payable_pending_count BIGINT,
  payable_overdue_total NUMERIC,
  payable_overdue_count BIGINT
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
  IF p_reference IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid reference';
  END IF;

  SELECT profile.company_id, profile.role INTO v_company_id, v_role
  FROM public.profiles AS profile WHERE profile.id = v_user_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'company context unavailable';
  END IF;
  IF v_role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'financial permission denied';
  END IF;

  RETURN QUERY
  SELECT
    (
      SELECT COALESCE(SUM(item.amount), 0)::NUMERIC FROM public.account_receivables AS item
      WHERE item.company_id = v_company_id AND item.status IN ('pending', 'late')
    ),
    (
      SELECT COUNT(*)::BIGINT FROM public.account_receivables AS item
      WHERE item.company_id = v_company_id AND item.status IN ('pending', 'late')
    ),
    (
      SELECT COALESCE(SUM(item.amount), 0)::NUMERIC FROM public.account_receivables AS item
      WHERE item.company_id = v_company_id AND item.status IN ('pending', 'late')
        AND item.due_date < p_reference
    ),
    (
      SELECT COUNT(*)::BIGINT FROM public.account_receivables AS item
      WHERE item.company_id = v_company_id AND item.status IN ('pending', 'late')
        AND item.due_date < p_reference
    ),
    (
      SELECT COALESCE(SUM(item.amount), 0)::NUMERIC FROM public.account_payables AS item
      WHERE item.company_id = v_company_id AND item.status IN ('pending', 'late')
    ),
    (
      SELECT COUNT(*)::BIGINT FROM public.account_payables AS item
      WHERE item.company_id = v_company_id AND item.status IN ('pending', 'late')
    ),
    (
      SELECT COALESCE(SUM(item.amount), 0)::NUMERIC FROM public.account_payables AS item
      WHERE item.company_id = v_company_id AND item.status IN ('pending', 'late')
        AND item.due_date < p_reference
    ),
    (
      SELECT COUNT(*)::BIGINT FROM public.account_payables AS item
      WHERE item.company_id = v_company_id AND item.status IN ('pending', 'late')
        AND item.due_date < p_reference
    );
END;
$$;

REVOKE ALL ON FUNCTION public.gestly_list_inventory_products(INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gestly_pipeline_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gestly_agenda_summary(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gestly_list_suppliers(INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gestly_purchases_summary(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gestly_documents_summary(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gestly_business_overview(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gestly_financial_overview(TIMESTAMPTZ) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.gestly_list_inventory_products(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gestly_pipeline_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gestly_agenda_summary(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gestly_list_suppliers(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gestly_purchases_summary(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gestly_documents_summary(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gestly_business_overview(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gestly_financial_overview(TIMESTAMPTZ) TO authenticated;

COMMIT;
