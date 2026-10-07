import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// A migração fica fora de supabase/migrations para nunca ser aplicada no banco principal.
const migration = readFileSync(
  resolve(process.cwd(), 'docs/clientes/mv-ambiental/migracoes-pendentes/20261007120000_service_contracts_foundation.sql'),
  'utf8',
);

const tables = ['service_contracts', 'service_contract_versions', 'service_posts', 'service_post_allocations', 'service_contract_audit_events'];

describe('contracts module security migration contract', () => {
  it('liga RLS e isola leitura por empresa e papel de gestor em todas as tabelas', () => {
    tables.forEach((table) => {
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`REVOKE INSERT, UPDATE, DELETE ON public.${table} FROM anon, authenticated`);
    });
    expect(migration.match(/company_id = \(SELECT public\.get_user_company_id\(\)\)/g)).toHaveLength(tables.length);
    expect(migration.match(/\(SELECT public\.get_user_role\(\)\) IN \('admin', 'manager'\)/g)).toHaveLength(tables.length);
  });

  it('deriva a empresa dentro das RPCs, sem receber company_id do cliente', () => {
    const signatures = migration.match(/CREATE OR REPLACE FUNCTION public\.(save_service_contract|save_service_contract_version|save_service_post|allocate_employee_to_post|end_post_allocation)\([\s\S]*?\)\nRETURNS/g) || [];
    expect(signatures).toHaveLength(5);
    signatures.forEach((signature) => expect(signature).not.toContain('p_company_id'));
    expect(migration.match(/v_company_id UUID := public\.service_contracts_assert_manager\(\)/g)).toHaveLength(5);
  });

  it('não expõe funções auxiliares e só libera as RPCs para usuários autenticados', () => {
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.service_contracts_assert_manager() FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.service_contracts_write_audit_event() FROM PUBLIC, anon, authenticated');
    expect(migration).not.toMatch(/GRANT EXECUTE[^;]*TO (anon|PUBLIC)/);
    expect(migration.match(/SECURITY DEFINER\nSET search_path = ''/g)?.length).toBeGreaterThanOrEqual(7);
  });

  it('mantém as regras de negócio no banco', () => {
    expect(migration).toContain("CHECK (status <> 'active' OR validation_status = 'confirmed')");
    expect(migration).toContain("CHECK (required_headcount BETWEEN 1 AND 500)");
    expect(migration).toContain('Encerre as alocações abertas antes de desativar o posto.');
    expect(migration).toContain("ON public.service_contract_versions(contract_id) WHERE kind = 'original'");
  });
});
