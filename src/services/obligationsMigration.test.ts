import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// A migração fica fora de supabase/migrations para nunca ser aplicada no banco principal.
const migration = readFileSync(
  resolve(process.cwd(), 'docs/clientes/mv-ambiental/migracoes-pendentes/20261010120000_service_obligations.sql'),
  'utf8',
);

const tables = ['service_obligation_templates', 'service_obligation_periods', 'service_obligation_items', 'service_obligation_events'];
const rpcs = ['save_obligation_template', 'open_obligation_period', 'add_obligation_item', 'update_obligation_item', 'submit_obligation_item', 'review_obligation_item', 'waive_obligation_item', 'mark_obligation_period_ready', 'reopen_obligation_period', 'mark_obligation_period_sent'];
const helpers = ['service_obligations_write_event()', 'service_obligations_due_date(DATE, INTEGER, INTEGER)', 'service_obligations_applies(TEXT, INTEGER, DATE)', 'service_obligations_fill_period(UUID, UUID)', 'service_obligations_lock_item(UUID, UUID)'];

describe('obligations security migration contract', () => {
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
    helpers.forEach((fn) => expect(migration).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC, anon, authenticated`));
    rpcs.forEach((rpc) => expect(migration).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${rpc}\\([^)]*\\) TO authenticated;`)));
    expect(migration).not.toMatch(/GRANT EXECUTE[^;]*TO (anon|PUBLIC)/);
    expect(migration).not.toMatch(/SECURITY DEFINER\n(?!SET search_path = '')/);
  });

  it('mantém as regras do pacote mensal no banco', () => {
    expect(migration).toContain('CONSTRAINT service_obligation_periods_unique UNIQUE (company_id, contract_id, competence)');
    expect(migration).toContain("CHECK (status <> 'sent' OR (sent_on IS NOT NULL AND sent_to IS NOT NULL AND sent_proof_url IS NOT NULL))");
    expect(migration).toContain("CHECK (status NOT IN ('rejected', 'waived') OR review_note IS NOT NULL)");
    expect(migration).toContain('ON public.service_obligation_items(period_id, template_id) WHERE template_id IS NOT NULL');
    expect(migration).toContain('Confira ou dispense todos antes de fechar o pacote.');
    expect(migration).toContain('Somente contratos ativos têm competência.');
    expect(migration).toContain('A competência já foi fechada. Reabra-a para alterar os itens.');
  });

  it('não usa DROP nem DELETE (aplicação incremental pelo MCP)', () => {
    expect(migration).not.toMatch(/\bDROP\b/i);
    expect(migration).not.toMatch(/\bDELETE FROM\b/i);
  });
});
