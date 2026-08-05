import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260805004736_people_teams_goals.sql'),
  'utf8',
);
const hardeningMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260805012430_people_teams_goals_hardening.sql'),
  'utf8',
);

describe('people teams and goals migration contract', () => {
  it('isolates teams and goals by authenticated company and manager role', () => {
    expect(migration).toContain('ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('ALTER TABLE public.sales_goals ENABLE ROW LEVEL SECURITY');
    expect(migration.match(/company_id = \(SELECT public\.get_user_company_id\(\)\)/g)).toHaveLength(2);
    expect(migration.match(/\(SELECT public\.get_user_role\(\)\) IN \('admin', 'manager'\)/g)).toHaveLength(2);
    expect(migration).toContain('REVOKE INSERT, UPDATE, DELETE ON public.teams, public.sales_goals FROM anon, authenticated');
  });

  it('never accepts company_id in public write or progress RPCs', () => {
    const rpcNames = [
      'save_team', 'set_team_status', 'save_employee', 'save_commission', 'save_sales_goal',
      'update_sales_goal_result', 'set_sales_goal_status', 'get_sales_goal_progress', 'get_team_sales_totals',
    ];
    rpcNames.forEach((name) => {
      const signature = migration.match(new RegExp(`(?:CREATE(?: OR REPLACE)? FUNCTION) public\\.${name}\\([\\s\\S]*?\\)\\s+RETURNS`))?.[0];
      expect(signature, name).toBeTruthy();
      expect(signature).not.toContain('p_company_id');
    });
    expect(migration).toContain('v_company_id UUID := public.people_assert_manager()');
  });

  it('supports exactly one individual or team target per goal', () => {
    expect(migration).toContain("assignment_type = 'employee' AND employee_id IS NOT NULL AND team_id IS NULL");
    expect(migration).toContain("assignment_type = 'team' AND team_id IS NOT NULL AND employee_id IS NULL");
    expect(migration).toContain('sales_goals_employee_company_fk');
    expect(migration).toContain('sales_goals_team_company_fk');
  });

  it('uses paid real sales only when an explicit compatible seller exists', () => {
    expect(migration).toContain('employees(company_id, sales_profile_id)');
    expect(migration).toContain("s.payment_status = 'paid'");
    expect(migration).toContain('e.sales_profile_id = s.seller_id');
    expect(migration).toContain("v_goal.result_source = 'automatic' AND v_has");
    expect(migration).toContain('v_result := v_goal.manual_result');
  });

  it('keeps commissions manual and only snapshots a validated team', () => {
    expect(migration).toContain('p_gross_amount NUMERIC');
    expect(migration).toContain('p_team_id IS DISTINCT FROM v_employee_team');
    expect(migration).toContain('COALESCE(p_team_id, v_employee_team)');
    expect(migration).not.toMatch(/commission[^\n]*(percent|percentage|salary|automatic)/i);
    expect(migration).not.toMatch(/INSERT INTO public\.account_(payables|receivables)/i);
  });

  it('audits teams, goals and administrative result changes without sensitive payloads', () => {
    expect(migration).toContain("v_event := 'team_created'");
    expect(migration).toContain("v_event := 'goal_created'");
    expect(migration).toContain("v_event := 'goal_result_updated'");
    expect(migration).not.toMatch(/old_data|new_data|payload JSONB/i);
  });

  it('indexes every new tenant-safe foreign key used by the module', () => {
    expect(hardeningMigration).toContain('employees_team_company_fk_idx');
    expect(hardeningMigration).toContain('employees_manager_company_fk_idx');
    expect(hardeningMigration).toContain('employees_sales_profile_fk_idx');
    expect(hardeningMigration).toContain('teams_manager_company_fk_idx');
    expect(hardeningMigration).toContain('sales_goals_employee_company_fk_idx');
    expect(hardeningMigration).toContain('sales_goals_team_company_fk_idx');
    expect(hardeningMigration).toContain('commissions_team_company_fk_idx');
  });
});
