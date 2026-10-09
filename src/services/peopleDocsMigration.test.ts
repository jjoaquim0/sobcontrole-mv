import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// A migração fica fora de supabase/migrations para nunca ser aplicada no banco principal.
const migration = readFileSync(
  resolve(process.cwd(), 'docs/clientes/mv-ambiental/migracoes-pendentes/20261009120000_service_people_documents.sql'),
  'utf8',
);

const tables = ['service_document_requirements', 'service_document_records', 'service_employee_absences', 'service_equipment_deliveries', 'service_people_events'];
const rpcs = ['save_document_requirement', 'submit_document_record', 'review_document_record', 'register_employee_absence', 'cancel_employee_absence', 'register_equipment_delivery', 'return_equipment_delivery', 'transfer_post_allocation'];

describe('people and documents security migration contract', () => {
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
    ['service_people_write_event()', 'service_people_assert_employee(UUID, UUID, BOOLEAN)'].forEach((fn) => {
      expect(migration).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC, anon, authenticated`);
    });
    rpcs.forEach((rpc) => expect(migration).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${rpc}\\([^)]*\\) TO authenticated;`)));
    expect(migration).not.toMatch(/GRANT EXECUTE[^;]*TO (anon|PUBLIC)/);
    expect(migration.match(/SECURITY DEFINER\nSET search_path = ''/g)?.length).toBeGreaterThanOrEqual(rpcs.length + 2);
    expect(migration).not.toMatch(/SECURITY DEFINER\n(?!SET search_path = '')/);
  });

  it('mantém as regras de documentos, ausências e EPIs no banco', () => {
    expect(migration).toContain('CHECK (num_nonnulls(employee_id, contract_id) = 1)');
    expect(migration).toContain("CHECK (document_url ~* '^https://')");
    expect(migration).toContain("CHECK (status <> 'rejected' OR review_note IS NOT NULL)");
    expect(migration).toContain("CHECK (category <> 'ppe' OR ca_number IS NOT NULL)");
    expect(migration).toContain('end_date - start_date <= 730');
    expect(migration).toContain('O funcionário não está alocado no contrato ou posto deste documento.');
    expect(migration).toContain('Já existe férias ou afastamento registrado neste período.');
    expect(migration).toContain('Este funcionário já possui alocação aberta no posto de destino.');
    expect(migration).toContain('Alvo e abrangência não mudam depois de criados.');
  });

  it('não usa DROP nem DELETE (aplicação incremental pelo MCP)', () => {
    expect(migration).not.toMatch(/\bDROP\b/i);
    expect(migration).not.toMatch(/\bDELETE FROM\b/i);
  });
});
