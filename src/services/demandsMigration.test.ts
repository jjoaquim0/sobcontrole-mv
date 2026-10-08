import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// A migração fica fora de supabase/migrations para nunca ser aplicada no banco principal.
const migration = readFileSync(
  resolve(process.cwd(), 'docs/clientes/mv-ambiental/migracoes-pendentes/20261008120000_service_demands.sql'),
  'utf8',
);

const tables = ['service_demand_types', 'service_demand_stages', 'service_demands', 'service_demand_comments', 'service_demand_evidences', 'service_demand_events'];
const rpcs = ['save_service_demand_type', 'ensure_default_service_demand_types', 'save_service_demand_stage', 'create_service_demand', 'update_service_demand', 'assign_service_demand', 'move_service_demand', 'cancel_service_demand', 'add_service_demand_comment', 'add_service_demand_evidence'];

describe('demands module security migration contract', () => {
  it('liga RLS e isola leitura por empresa e papel de gestor em todas as tabelas', () => {
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

  it('não expõe funções auxiliares e só libera as RPCs para usuários autenticados', () => {
    ['service_demands_write_event()', 'service_demands_assert_profile(UUID, UUID, BOOLEAN)', 'service_demands_create_default_stages(UUID, UUID)'].forEach((fn) => {
      expect(migration).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC, anon, authenticated`);
    });
    rpcs.forEach((rpc) => expect(migration).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${rpc}\\([^)]*\\) TO authenticated;`)));
    expect(migration).not.toMatch(/GRANT EXECUTE[^;]*TO (anon|PUBLIC)/);
    expect(migration.match(/SECURITY DEFINER\nSET search_path = ''/g)?.length).toBeGreaterThanOrEqual(rpcs.length + 3);
    expect(migration).not.toMatch(/SECURITY DEFINER\n(?!SET search_path = '')/);
  });

  it('mantém as regras do fluxo no banco', () => {
    expect(migration).toContain('CHECK (responsible_id IS NULL OR approver_id IS NULL OR responsible_id <> approver_id)');
    expect(migration).toContain("CHECK (url ~* '^https://')");
    expect(migration).toContain("WHERE category IN ('intake', 'review', 'done')");
    expect(migration).toContain('Avance uma etapa por vez');
    expect(migration).toContain('Informe o motivo para devolver a demanda a uma etapa anterior.');
    expect(migration).toContain('Defina o aprovador antes de enviar a demanda para conferência.');
    expect(migration).toContain('Somente o aprovador definido pode concluir a conferência e encerrar a demanda.');
    expect(migration).toContain("CHECK (status <> 'closed' OR (closed_at IS NOT NULL AND approved_by IS NOT NULL))");
  });

  it('não usa DROP nem DELETE (aplicação incremental pelo MCP)', () => {
    expect(migration).not.toMatch(/\bDROP\b/i);
    expect(migration).not.toMatch(/\bDELETE FROM\b/i);
  });
});
