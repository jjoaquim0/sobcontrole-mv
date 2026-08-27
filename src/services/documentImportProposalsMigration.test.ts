import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const INDEX_NAME = 'document_import_proposals_company_id_idempotency_key_key';

const normalizeSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim().toLowerCase();

const migration = normalizeSql(readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260827020502_document_import_proposals_partial_unique_index.sql'),
  'utf8',
));

const rollback = normalizeSql(readFileSync(
  resolve(process.cwd(), 'supabase/rollbacks/20260827020502_document_import_proposals_partial_unique_index.down.sql'),
  'utf8',
));

describe('document import proposals D18 migration contract', () => {
  it('mantém a unicidade composta e protege exatamente pending e applied', () => {
    const indexStatement = migration.match(new RegExp(
      `create unique index ${INDEX_NAME} on public\\.document_import_proposals \\(company_id, idempotency_key\\) where [^;]+;`,
      'i',
    ))?.[0] ?? '';
    const predicate = indexStatement.match(/where (.+);$/i)?.[1] ?? '';

    expect(indexStatement).toBeTruthy();
    expect(indexStatement).toContain(`create unique index ${INDEX_NAME}`);
    expect(indexStatement).toContain('on public.document_import_proposals (company_id, idempotency_key)');
    expect(predicate).toContain("status in ('pending', 'applied')");
    expect(predicate).toContain("'pending'");
    expect(predicate).toContain("'applied'");
    expect(predicate).not.toContain("'rejected'");
    expect(predicate).not.toContain("'expired'");
  });

  it('faz o rollback restaurar a unicidade incondicional da mesma chave composta', () => {
    const constraintStatement = rollback.match(new RegExp(
      `alter table public\\.document_import_proposals add constraint ${INDEX_NAME} unique \\(company_id, idempotency_key\\);`,
      'i',
    ))?.[0] ?? '';

    expect(rollback).toContain(`drop index public.${INDEX_NAME};`);
    expect(constraintStatement).toBeTruthy();
    expect(constraintStatement).toContain(`add constraint ${INDEX_NAME}`);
    expect(constraintStatement).toContain('unique (company_id, idempotency_key)');
    expect(constraintStatement).not.toContain('where');
  });
});
