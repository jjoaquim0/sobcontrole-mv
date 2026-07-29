import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260719130000_document_library_security.sql'),
  'utf8',
);

describe('document security migration contract', () => {
  it('creates versioning, explicit permissions and audit structures', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.document_versions');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.document_permissions');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.document_audit_events');
    expect(migration).toContain("UNIQUE (document_id, version_number)");
    expect(migration).toContain("UNIQUE (document_id, user_id)");
  });

  it('enforces tenant-aware RLS and private Storage access', () => {
    expect(migration).toContain("SET public = false");
    expect(migration).toContain('document_storage_path_is_accessible');
    expect(migration).toContain('can_access_document(p_document_id, \'download\')');
    expect(migration).toContain('Documentos visíveis conforme permissão');
  });

  it('preserves historical files on version changes and soft deletion', () => {
    expect(migration).toContain('add_document_version');
    expect(migration).toContain('restore_document_version');
    expect(migration).toContain("status = 'deleted', deleted_at = now()");
    expect(migration).toContain('document_restored');
    expect(migration).toContain('document_deleted');
  });
});
