-- Story 1.7: rotas canonicas do accordion de Relatorios.
-- Mantem o catalogo como fonte de verdade para plano, add-on e coming soon.

UPDATE public.analytics_modules
SET route_path = CASE key
  WHEN 'dashboard_executivo' THEN '/relatorios/visao-geral'
  WHEN 'gestly_insights' THEN '/relatorios/central-inteligencia'
  WHEN 'sales_analytics' THEN '/relatorios/vendas-pipeline'
  WHEN 'customer_analytics' THEN '/relatorios/clientes'
  WHEN 'financial_analytics' THEN '/relatorios/financeiro'
  WHEN 'inventory_analytics' THEN '/relatorios/estoque-compras'
  ELSE route_path
END,
updated_at = now()
WHERE key IN (
  'dashboard_executivo',
  'gestly_insights',
  'sales_analytics',
  'customer_analytics',
  'financial_analytics',
  'inventory_analytics'
);

INSERT INTO public.analytics_modules (
  id,
  key,
  name,
  category,
  min_plan,
  is_addon,
  is_coming_soon,
  is_active,
  route_path,
  display_order
)
VALUES (
  gen_random_uuid(),
  'custom_reports',
  'Relatórios Personalizados',
  'geral',
  'enterprise',
  true,
  true,
  true,
  '/relatorios/personalizados',
  6
)
ON CONFLICT (key) DO UPDATE
SET route_path = EXCLUDED.route_path,
    is_coming_soon = EXCLUDED.is_coming_soon,
    display_order = EXCLUDED.display_order,
    updated_at = now();
