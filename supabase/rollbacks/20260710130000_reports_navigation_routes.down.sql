-- Rollback nao destrutivo da Story 1.7.

UPDATE public.analytics_modules
SET route_path = CASE key
  WHEN 'dashboard_executivo' THEN '/dashboard'
  WHEN 'gestly_insights' THEN '/notifications'
  WHEN 'sales_analytics' THEN '/reports?tab=sales'
  WHEN 'customer_analytics' THEN '/reports?tab=customers'
  WHEN 'financial_analytics' THEN '/reports?tab=financial'
  WHEN 'inventory_analytics' THEN '/reports?tab=inventory'
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

UPDATE public.analytics_modules
SET is_active = false,
    updated_at = now()
WHERE key = 'custom_reports';
