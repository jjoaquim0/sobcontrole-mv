import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// A migração fica fora de supabase/migrations para nunca ser aplicada no banco principal.
const migration = readFileSync(
  resolve(process.cwd(), 'docs/clientes/mv-ambiental/migracoes-pendentes/20261011120000_service_pilot.sql'),
  'utf8',
);

const tables = ['service_pilot_snapshots', 'service_pilot_criteria'];
const rpcs = ['pilot_indicators', 'capture_pilot_snapshot', 'set_pilot_criterion'];
const helpers = ['service_pilot_pct(BIGINT, BIGINT)', 'service_pilot_compute(UUID, DATE, DATE)'];

describe('pilot security migration contract', () => {
  it('liga RLS e isola leitura por empresa e papel de gestor', () => {
    tables.forEach((table) => {
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`REVOKE INSERT, UPDATE, DELETE ON public.${table} FROM anon, authenticated`);
    });
    expect(migration.match(/company_id = \(SELECT public\.get_user_company_id\(\)\)/g)).toHaveLength(tables.length);
    expect(migration.match(/\(SELECT public\.get_user_role\(\)\) IN \('admin', 'manager'\)/g)).toHaveLength(tables.length);
    expect(migration).not.toMatch(/CREATE POLICY[^;]*FOR (INSERT|UPDATE|DELETE|ALL)/);
  });

  it('deriva a empresa dentro das RPCs, sem receber company_id do cliente', () => {
    const signatures = migration.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.(${rpcs.join('|')})\\([\\s\\S]*?\\)\\nRETURNS`, 'g')) || [];
    expect(signatures).toHaveLength(rpcs.length);
    signatures.forEach((signature) => expect(signature).not.toContain('p_company_id'));
    expect(migration.match(/v_company_id UUID := public\.service_contracts_assert_manager\(\)/g)).toHaveLength(rpcs.length);
  });

  it('não expõe o cálculo interno e só libera as RPCs para usuários autenticados', () => {
    helpers.forEach((fn) => expect(migration).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC, anon, authenticated`));
    rpcs.forEach((rpc) => expect(migration).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${rpc}\\([^)]*\\) TO authenticated;`)));
    expect(migration).not.toMatch(/GRANT EXECUTE[^;]*TO (anon|PUBLIC)/);
    expect(migration).not.toMatch(/SECURITY DEFINER\n(?!SET search_path = '')/);
  });

  it('exige decisão e motivos na medição final', () => {
    expect(migration).toContain("CHECK ((kind = 'final' AND decision IN ('expand', 'adjust', 'pause')) OR (kind <> 'final' AND decision IS NULL))");
    expect(migration).toContain('registre a decisão da direção');
    expect(migration).toContain('registre os motivos da decisão');
    expect(migration).toContain("CHECK (NOT is_confirmed OR note IS NOT NULL)");
  });

  it('não usa DROP nem DELETE (aplicação incremental pelo MCP)', () => {
    expect(migration).not.toMatch(/\bDROP\b/i);
    expect(migration).not.toMatch(/\bDELETE FROM\b/i);
  });
});
