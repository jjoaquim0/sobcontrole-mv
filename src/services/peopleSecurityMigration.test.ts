import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260804120000_people_module.sql'),
  'utf8',
);
const hardening = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260804121000_people_module_hardening.sql'),
  'utf8',
);

describe('people module security migration contract', () => {
  it('isolates every readable table by authenticated company and manager role', () => {
    expect(migration).toContain('ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('ALTER TABLE public.people_audit_events ENABLE ROW LEVEL SECURITY');
    expect(migration.match(/company_id = \(SELECT public\.get_user_company_id\(\)\)/g)).toHaveLength(3);
    expect(migration.match(/\(SELECT public\.get_user_role\(\)\) IN \('admin', 'manager'\)/g)).toHaveLength(3);
  });

  it('derives tenant in write RPCs and blocks direct writes', () => {
    expect(migration).toContain('REVOKE INSERT, UPDATE, DELETE ON public.employees FROM anon, authenticated');
    expect(migration).toContain('REVOKE INSERT, UPDATE, DELETE ON public.commissions FROM anon, authenticated');
    expect(migration).toContain('v_company_id UUID := public.people_assert_manager()');
    const rpcSignatures = migration.match(/CREATE OR REPLACE FUNCTION public\.(save_employee|set_employee_status|save_commission|set_commission_status|remove_commission)\([\s\S]*?\)\nRETURNS/g) || [];
    expect(rpcSignatures).toHaveLength(5);
    rpcSignatures.forEach((signature) => expect(signature).not.toContain('p_company_id'));
  });

  it('never stores a complete CPF and scopes duplicate detection to one company', () => {
    expect(migration).not.toMatch(/\bcpf\s+TEXT/i);
    expect(migration).toContain('cpf_last_four TEXT');
    expect(migration).toContain('cpf_hash TEXT NOT NULL');
    expect(migration).toContain('UNIQUE (company_id, cpf_hash)');
    expect(migration).toContain("v_company_id::TEXT || ':' || v_cpf");
    expect(migration).toContain('REVOKE ALL ON public.employee_sensitive_data FROM PUBLIC, anon, authenticated');
    expect(hardening).toContain('ON public.employee_sensitive_data FOR SELECT TO authenticated');
    expect(hardening).toContain('USING (false)');
    expect(hardening).toContain('REVOKE ALL ON FUNCTION public.people_assert_manager() FROM authenticated');
  });

  it('enforces administrative status transitions without financial side effects', () => {
    expect(migration).toContain("v_current_status = 'pending' AND p_status IN ('approved', 'canceled')");
    expect(migration).toContain("v_current_status = 'approved' AND p_status IN ('paid', 'canceled')");
    expect(migration).toContain("paid_at = CASE WHEN p_status = 'paid' THEN now()");
    expect(migration).not.toMatch(/account_payables|bank|holerite|payroll/i);
  });

  it('audits lifecycle events without old or new sensitive payloads', () => {
    expect(migration).toContain("v_event_type := 'employee_created'");
    expect(migration).toContain("v_event_type := 'commission_created'");
    expect(migration).toContain("WHEN 'paid' THEN 'commission_paid'");
    expect(migration).toContain("WHEN 'canceled' THEN 'commission_canceled'");
    expect(migration).not.toMatch(/old_data|new_data|payload JSONB/i);
  });
});
