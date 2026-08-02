import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260729171032_reports_financial_access_guard.sql'),
  'utf8'
);

describe('reports financial access migration contract', () => {
  it('cria uma autorização invoker vinculada à empresa e à função do usuário', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.assert_report_financial_access()');
    expect(migration).toContain('SECURITY INVOKER');
    expect(migration).toContain('WHERE profile.id = auth.uid()');
    expect(migration).toContain("v_role NOT IN ('admin', 'manager')");
    expect(migration).toContain('v_company_id IS NULL');
  });

  it('não expõe a função a sessões anônimas', () => {
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.assert_report_financial_access() FROM PUBLIC, anon');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.assert_report_financial_access() TO authenticated');
  });
});
