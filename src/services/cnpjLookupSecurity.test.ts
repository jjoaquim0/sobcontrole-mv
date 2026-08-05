import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  createCnpjLookupHandler,
  isValidCnpj,
  normalizeCnpjDigits,
  type CnpjLookupDependencies,
  type CnpjRegistrySnapshot,
} from '../../supabase/functions/_shared/tax/cnpj-lookup.ts';
import { minimizeRegistryPayload } from '../../supabase/functions/_shared/tax/registry-provider.ts';

/** CNPJ sintético válido pelos dígitos verificadores (Banco do Brasil). */
const VALID_CNPJ = '00000000000191';

const emptySnapshot = (): CnpjRegistrySnapshot => minimizeRegistryPayload({});

const createDeps = (
  overrides: Partial<CnpjLookupDependencies> = {},
): CnpjLookupDependencies => ({
  allowedOrigins: ['https://app.sobcontrole.com'],
  authenticate: vi.fn(async () => ({ userId: 'user-1', accessToken: 'token-1' })),
  resolveCompany: vi.fn(async () => ({
    companyId: 'company-1',
    cnpj: VALID_CNPJ,
    role: 'admin',
  })),
  readCache: vi.fn(async () => null),
  writeCache: vi.fn(async () => {}),
  fetchRegistry: vi.fn(async () => emptySnapshot()),
  cacheTtlMs: 1000,
  now: () => new Date('2026-08-02T12:00:00.000Z'),
  logger: vi.fn(),
  ...overrides,
});

const createRequest = (
  init: { method?: string; origin?: string | null; body?: unknown } = {},
): Request => {
  const headers = new Headers({ Authorization: 'Bearer token-1' });
  if (init.origin !== null) {
    headers.set('Origin', init.origin ?? 'https://app.sobcontrole.com');
  }
  return new Request('https://edge.local/cnpj-lookup', {
    method: init.method ?? 'POST',
    headers,
    body: init.method === 'GET' || init.method === 'OPTIONS' ? undefined : JSON.stringify(init.body ?? {}),
  });
};

describe('isValidCnpj', () => {
  it('aceita CNPJ com dígitos verificadores corretos', () => {
    expect(isValidCnpj(VALID_CNPJ)).toBe(true);
    expect(isValidCnpj('00.000.000/0001-91')).toBe(true);
  });

  it('rejeita dígito verificador incorreto', () => {
    expect(isValidCnpj('00000000000192')).toBe(false);
  });

  it('rejeita repetição e comprimento inválido', () => {
    expect(isValidCnpj('11111111111111')).toBe(false);
    expect(isValidCnpj('123')).toBe(false);
    expect(isValidCnpj('')).toBe(false);
    expect(isValidCnpj(null)).toBe(false);
  });

  it('normaliza máscara para dígitos', () => {
    expect(normalizeCnpjDigits('00.000.000/0001-91')).toBe(VALID_CNPJ);
  });
});

describe('createCnpjLookupHandler — controle de acesso', () => {
  it('recusa método diferente de POST', async () => {
    const response = await createCnpjLookupHandler(createDeps())(createRequest({ method: 'GET' }));
    expect(response.status).toBe(405);
  });

  it('responde preflight sem exigir autenticação', async () => {
    const response = await createCnpjLookupHandler(createDeps())(
      createRequest({ method: 'OPTIONS' }),
    );
    expect(response.status).toBe(204);
  });

  it('recusa origem não autorizada', async () => {
    const response = await createCnpjLookupHandler(createDeps())(
      createRequest({ origin: 'https://evil.example' }),
    );
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe('origin_not_allowed');
  });

  it('recusa requisição sem sessão válida', async () => {
    const deps = createDeps({ authenticate: vi.fn(async () => null) });
    const response = await createCnpjLookupHandler(deps)(createRequest());
    expect(response.status).toBe(401);
    // Nada de externo pode ser chamado antes da autenticação.
    expect(deps.fetchRegistry).not.toHaveBeenCalled();
  });

  it('recusa colaborador e não consulta o provedor', async () => {
    const deps = createDeps({
      resolveCompany: vi.fn(async () => ({
        companyId: 'company-1',
        cnpj: VALID_CNPJ,
        role: 'employee',
      })),
    });
    const response = await createCnpjLookupHandler(deps)(createRequest());

    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe('permission_denied');
    expect(deps.fetchRegistry).not.toHaveBeenCalled();
  });

  it('recusa quando a empresa do usuário não pôde ser resolvida', async () => {
    const deps = createDeps({ resolveCompany: vi.fn(async () => null) });
    const response = await createCnpjLookupHandler(deps)(createRequest());
    expect(response.status).toBe(409);
  });
});

describe('createCnpjLookupHandler — origem do CNPJ', () => {
  it('IGNORA o CNPJ enviado no corpo e usa o da empresa do usuário', async () => {
    // Aceitar CNPJ do corpo transformaria a função em proxy aberto de consulta
    // cadastral. Este teste é a trava contra essa regressão.
    const deps = createDeps();
    await createCnpjLookupHandler(deps)(
      createRequest({ body: { cnpj: '11222333000181' } }),
    );

    expect(deps.fetchRegistry).toHaveBeenCalledWith(VALID_CNPJ);
    expect(deps.fetchRegistry).not.toHaveBeenCalledWith('11222333000181');
  });

  it('recusa quando o CNPJ da empresa é inválido, sem chamar o provedor', async () => {
    const deps = createDeps({
      resolveCompany: vi.fn(async () => ({
        companyId: 'company-1',
        cnpj: '123',
        role: 'admin',
      })),
    });
    const response = await createCnpjLookupHandler(deps)(createRequest());

    expect(response.status).toBe(422);
    expect(deps.fetchRegistry).not.toHaveBeenCalled();
  });
});

describe('createCnpjLookupHandler — cache e indisponibilidade', () => {
  it('usa o cache vigente sem chamar o provedor', async () => {
    const deps = createDeps({
      readCache: vi.fn(async () => ({
        payload: emptySnapshot(),
        source: 'brasilapi',
        fetchedAt: '2026-08-01T12:00:00.000Z',
        expiresAt: '2026-09-01T12:00:00.000Z',
      })),
    });
    const response = await createCnpjLookupHandler(deps)(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.cached).toBe(true);
    expect(deps.fetchRegistry).not.toHaveBeenCalled();
  });

  it('consulta o provedor quando o cache está expirado', async () => {
    const deps = createDeps({
      readCache: vi.fn(async () => ({
        payload: emptySnapshot(),
        source: 'brasilapi',
        fetchedAt: '2026-06-01T12:00:00.000Z',
        expiresAt: '2026-07-01T12:00:00.000Z',
      })),
    });
    await createCnpjLookupHandler(deps)(createRequest());
    expect(deps.fetchRegistry).toHaveBeenCalledOnce();
  });

  it('devolve cache expirado marcado como stale quando o provedor falha', async () => {
    const deps = createDeps({
      readCache: vi.fn(async () => ({
        payload: emptySnapshot(),
        source: 'brasilapi',
        fetchedAt: '2026-06-01T12:00:00.000Z',
        expiresAt: '2026-07-01T12:00:00.000Z',
      })),
      fetchRegistry: vi.fn(async () => {
        throw new Error('timeout');
      }),
    });
    const response = await createCnpjLookupHandler(deps)(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stale).toBe(true);
  });

  it('devolve erro acionável quando o provedor falha e não há cache', async () => {
    const deps = createDeps({
      fetchRegistry: vi.fn(async () => {
        throw new Error('timeout');
      }),
    });
    const response = await createCnpjLookupHandler(deps)(createRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error.code).toBe('provider_unavailable');
    expect(body.error.message).toContain('manualmente');
  });

  it('não derruba a consulta quando a gravação do cache falha', async () => {
    const deps = createDeps({
      writeCache: vi.fn(async () => {
        throw new Error('cache indisponível');
      }),
    });
    const response = await createCnpjLookupHandler(deps)(createRequest());
    expect(response.status).toBe(200);
  });

  it('não registra payload cadastral no log', async () => {
    const logger = vi.fn();
    const deps = createDeps({ logger });
    await createCnpjLookupHandler(deps)(createRequest());

    const logged = JSON.stringify(logger.mock.calls);
    expect(logged).not.toContain('razao_social');
    expect(logged).not.toContain(VALID_CNPJ);
  });
});

describe('minimizeRegistryPayload', () => {
  it('preserva a distinção entre null e false nos indicadores de opção', () => {
    // O ponto mais crítico da minimização: null significa "a base não informou".
    expect(minimizeRegistryPayload({ opcao_pelo_simples: null }).opcao_pelo_simples).toBeNull();
    expect(minimizeRegistryPayload({ opcao_pelo_simples: false }).opcao_pelo_simples).toBe(false);
    expect(minimizeRegistryPayload({ opcao_pelo_simples: true }).opcao_pelo_simples).toBe(true);
    expect(minimizeRegistryPayload({}).opcao_pelo_simples).toBeNull();
  });

  it('descarta campos não utilizados pela derivação', () => {
    const snapshot = minimizeRegistryPayload({
      cnpj: VALID_CNPJ,
      qsa: [{ nome_socio: 'Fulano de Tal', cpf_cnpj_socio: '***123***' }],
      capital_social: 1000000,
      ddd_telefone_1: '1133334444',
      email: 'contato@example.com',
    });

    expect(snapshot.cnpj).toBe(VALID_CNPJ);
    expect(snapshot as unknown as Record<string, unknown>).not.toHaveProperty('qsa');
    expect(snapshot as unknown as Record<string, unknown>).not.toHaveProperty('email');
    expect(snapshot as unknown as Record<string, unknown>).not.toHaveProperty('capital_social');
  });

  it('normaliza estruturas de array ausentes para lista vazia', () => {
    const snapshot = minimizeRegistryPayload({ regime_tributario: null, cnaes_secundarios: 'x' });
    expect(snapshot.regime_tributario).toEqual([]);
    expect(snapshot.cnaes_secundarios).toEqual([]);
  });

  it('converte CNAE numérico para string sem perder informação', () => {
    expect(minimizeRegistryPayload({ cnae_fiscal: 4712100 }).cnae_fiscal).toBe('4712100');
  });
});

describe('migration do módulo tributário', () => {
  const catalog = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260802120000_tax_module_catalog.sql'),
    'utf8',
  );
  const profile = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260802121000_tax_module_company_profile.sql'),
    'utf8',
  );

  it('mantém o cache de CNPJ inacessível para o cliente autenticado', () => {
    expect(catalog).toContain('REVOKE ALL ON cnpj_registry_cache FROM authenticated');
  });

  it('exige papel de gestão para ler e escrever o perfil tributário', () => {
    expect(profile).toContain('USING (company_id = get_user_company_id() AND is_tax_manager())');
    expect(profile).toContain(
      'WITH CHECK (company_id = get_user_company_id() AND is_tax_manager())',
    );
  });

  it('semeia o catálogo exigindo validação humana', () => {
    expect(catalog).toContain('requires_validation BOOLEAN NOT NULL DEFAULT true');
  });

  it('impede perfil do Simples sem anexo e MEI sem tipo de atividade', () => {
    expect(profile).toContain('company_tax_profile_simples_requires_anexo');
    expect(profile).toContain('company_tax_profile_mei_requires_activity');
  });
});
