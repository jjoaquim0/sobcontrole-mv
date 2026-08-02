BEGIN;

-- Defesa em profundidade para a superfície de Relatórios. A rota React já é
-- restrita, mas a consulta também exige o papel financeiro no banco antes de
-- ler títulos ou montar a DRE.
CREATE OR REPLACE FUNCTION public.assert_report_financial_access()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id UUID;
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'authentication required';
  END IF;

  SELECT profile.company_id, profile.role
    INTO v_company_id, v_role
  FROM public.profiles AS profile
  WHERE profile.id = auth.uid();

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'company context unavailable';
  END IF;

  IF v_role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'financial permission denied';
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_report_financial_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_report_financial_access() TO authenticated;

COMMENT ON FUNCTION public.assert_report_financial_access() IS
  'Role guard for financial report reads. SECURITY INVOKER; admin/manager only.';

COMMIT;
