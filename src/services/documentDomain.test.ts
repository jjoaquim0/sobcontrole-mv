import { describe, expect, it } from 'vitest';
import { Document, Profile } from '../types';
import { createImmutableDocumentPath, hasDocumentAccess, resolveDocumentAccess, sanitizeDocumentFileName, validateDocumentFile } from './documentDomain';

const companyA = '11111111-1111-4111-8111-111111111111';
const companyB = '22222222-2222-4222-8222-222222222222';
const ownerId = '33333333-3333-4333-8333-333333333333';

const documentFixture = (overrides: Partial<Document> = {}): Document => ({
  id: '44444444-4444-4444-8444-444444444444',
  companyId: companyA,
  name: 'Contrato',
  originalName: 'contrato.pdf',
  category: 'contrato',
  mimeType: 'application/pdf',
  size: 1024,
  storagePath: `${companyA}/44444444-4444-4444-8444-444444444444/55555555-5555-4555-8555-555555555555/contrato.pdf`,
  status: 'active',
  visibility: 'private',
  ownerId,
  versionCount: 1,
  createdAt: '2026-07-19T12:00:00.000Z',
  updatedAt: '2026-07-19T12:00:00.000Z',
  ...overrides,
});

const profileFixture = (overrides: Partial<Profile> = {}): Profile => ({
  id: '66666666-6666-4666-8666-666666666666',
  name: 'Pessoa da equipe',
  email: 'team@example.com',
  role: 'employee',
  companyId: companyA,
  createdAt: '2026-07-19T12:00:00.000Z',
  updatedAt: '2026-07-19T12:00:00.000Z',
  ...overrides,
});

describe('documentDomain — validação e caminhos imutáveis', () => {
  it('aceita somente MIME type e extensão compatíveis', () => {
    expect(validateDocumentFile({ name: 'contrato.pdf', type: 'application/pdf', size: 10 })).toBeNull();
    expect(validateDocumentFile({ name: 'contrato.pdf', type: 'image/jpeg', size: 10 })).toContain('não corresponde');
    expect(validateDocumentFile({ name: 'script.exe', type: 'application/pdf', size: 10 })).toContain('extensão não suportada');
  });

  it('rejeita arquivos vazios ou acima do limite já configurado', () => {
    expect(validateDocumentFile({ name: 'vazio.pdf', type: 'application/pdf', size: 0 })).toContain('está vazio');
    expect(validateDocumentFile({ name: 'grande.pdf', type: 'application/pdf', size: 10 * 1024 * 1024 + 1 })).toContain('excede o limite');
  });

  it('normaliza o nome e cria um caminho diferente para cada versão', () => {
    const documentId = '44444444-4444-4444-8444-444444444444';
    const firstVersion = createImmutableDocumentPath(companyA, documentId, '55555555-5555-4555-8555-555555555555', 'Proposta João.pdf');
    const secondVersion = createImmutableDocumentPath(companyA, documentId, '77777777-7777-4777-8777-777777777777', 'Proposta João.pdf');

    expect(sanitizeDocumentFileName('Proposta João.pdf')).toBe('Proposta-Joao.pdf');
    expect(firstVersion).toBe(`${companyA}/${documentId}/55555555-5555-4555-8555-555555555555/Proposta-Joao.pdf`);
    expect(secondVersion).not.toBe(firstVersion);
  });
});

describe('documentDomain — permissões e isolamento por empresa', () => {
  it('mantém documento privado acessível apenas ao proprietário e administradores', () => {
    const document = documentFixture();
    expect(resolveDocumentAccess(document, profileFixture({ id: ownerId }))).toBe('admin');
    expect(resolveDocumentAccess(document, profileFixture())).toBe('none');
    expect(resolveDocumentAccess(document, profileFixture({ role: 'admin' }))).toBe('admin');
  });

  it('aplica a visibilidade compartilhada por papel e a permissão explícita mais alta', () => {
    expect(resolveDocumentAccess(documentFixture({ visibility: 'company' }), profileFixture())).toBe('download');
    expect(resolveDocumentAccess(documentFixture({ visibility: 'company' }), profileFixture({ role: 'manager' }))).toBe('edit');
    expect(resolveDocumentAccess(documentFixture({ visibility: 'restricted', currentUserPermission: 'edit' }), profileFixture())).toBe('edit');
  });

  it('nunca concede acesso entre empresas, mesmo com permissão explícita no registro recebido', () => {
    const foreignProfile = profileFixture({ companyId: companyB, role: 'admin' });
    const restrictedDocument = documentFixture({ visibility: 'restricted', currentUserPermission: 'admin' });
    expect(resolveDocumentAccess(restrictedDocument, foreignProfile)).toBe('none');
    expect(hasDocumentAccess(restrictedDocument, foreignProfile, 'view')).toBe(false);
  });
});
