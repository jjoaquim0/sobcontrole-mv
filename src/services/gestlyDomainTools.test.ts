import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDomainToolDefinitions } from '../../supabase/functions/_shared/ai/tools/definitions-p2.ts';
import { createDefaultToolDefinitions } from '../../supabase/functions/_shared/ai/tools/definitions.ts';
import { resolveAgendaWindow } from '../../supabase/functions/_shared/ai/tools/period.ts';
import { ReadOnlyToolRegistry } from '../../supabase/functions/_shared/ai/tools/registry.ts';
import type {
  GestlyToolDataSource,
  ResolvedSecurityContext,
} from '../../supabase/functions/_shared/ai/tools/types.ts';
import type {
  SecurityContext,
  SecurityRole,
} from '../../supabase/functions/_shared/ai/types.ts';

const NOW = new Date('2026-07-28T15:00:00.000Z');
const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260728140000_gestly_multi_domain_tools_p2.sql'),
  'utf8',
);

const dataSource: GestlyToolDataSource = {
  getSalesSummary: vi.fn(),
  getCustomersSummary: vi.fn(),
  getLowStockProducts: vi.fn(),
  getInventorySummary: vi.fn(),
  getProductStock: vi.fn(),
  listInventoryProducts: vi.fn(),
  getPipelineSummary: vi.fn(),
  getAgendaSummary: vi.fn(),
  listSuppliers: vi.fn(),
  getPurchasesSummary: vi.fn(),
  getDocumentsSummary: vi.fn(),
  getBusinessOverview: vi.fn(),
  getFinancialOverview: vi.fn(),
  getOverdueFinancialItems: vi.fn(),
};

const registry = (): ReadOnlyToolRegistry =>
  new ReadOnlyToolRegistry()
    .registerAll(createDefaultToolDefinitions(() => NOW))
    .registerAll(createDomainToolDefinitions(() => NOW));

const environment = (
  role: SecurityRole = 'admin',
  companyId = 'company-a',
): ResolvedSecurityContext => {
  const securityContext: SecurityContext = {
    userId: 'user-a',
    companyId,
    role,
    requestId: 'request-a',
    timezone: 'America/Sao_Paulo',
    currency: 'BRL',
    limits: {
      maxCustomPeriodDays: 366,
      maxLowStockResults: 25,
      maxFinancialResults: 20,
      maxToolCalls: 1,
    },
  };
  return { securityContext, dataSource };
};

const PERIOD_ARGS = JSON.stringify({
  period: 'current_month',
  date_from: null,
  date_to: null,
});

describe('Gestly multi-domain tool catalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cobre os domínios do SobControle com contratos estritos e somente leitura', () => {
    const catalog = [
      ...createDefaultToolDefinitions(() => NOW),
      ...createDomainToolDefinitions(() => NOW),
    ];

    expect(catalog.every((tool) => tool.mode === 'read_only')).toBe(true);
    expect(new Set(catalog.map((tool) => tool.domain))).toEqual(
      new Set([
        'overview',
        'sales',
        'pipeline',
        'customers',
        'agenda',
        'inventory',
        'suppliers',
        'purchases',
        'financial',
        'documents',
        'help',
      ]),
    );

    // Todo dado financeiro é marcado como tal e restrito a admin/manager.
    for (const tool of catalog) {
      if (tool.sensitivity === 'financial') {
        expect([...tool.allowedRoles].sort()).toEqual(['admin', 'manager']);
      }
    }

    const tools = registry().toProviderTools();
    expect(tools).toHaveLength(catalog.length);
    expect(tools.every((tool) => tool.strict)).toBe(true);
    expect(tools.every((tool) => tool.parameters.additionalProperties === false)).toBe(true);
    expect(JSON.stringify(tools.map((tool) => tool.parameters))).not.toMatch(
      /company_?id|user_?id|tenant|\bsql\b|table_name|column_name/i,
    );
  });

  it('lista produtos sem exigir nome ou SKU do usuário', async () => {
    vi.mocked(dataSource.listInventoryProducts).mockResolvedValue({
      totalMatches: 1,
      items: [
        {
          productName: 'Biscoito Casadinho',
          sku: 'SKU-1',
          unit: 'Caixa',
          currentStock: 9,
          minimumStock: 0,
          stockStatus: 'in_stock',
        },
      ],
    });

    const result = await registry().execute(
      'list_inventory_products',
      JSON.stringify({ limit: 50 }),
      environment('employee'),
    );

    expect(dataSource.listInventoryProducts).toHaveBeenCalledWith(50);
    expect(result.output).toMatchObject({
      total_matches: 1,
      truncated: false,
      items: [{ product: 'Biscoito Casadinho', unit: 'Caixa', current_stock: 9 }],
    });
  });

  it('resume o pipeline por etapa sem expor cliente, dono ou anotação', async () => {
    vi.mocked(dataSource.getPipelineSummary).mockResolvedValue({
      openCount: 3,
      openValue: 15000,
      wonCount: 1,
      wonValue: 5000,
      lostCount: 2,
      stages: [{ stage: 'Proposta', openDeals: 2, openValue: 12000 }],
    });

    const result = await registry().execute(
      'get_pipeline_summary',
      JSON.stringify({}),
      environment('employee'),
    );

    expect(result.output).toMatchObject({
      open_deals: 3,
      open_value: 15000,
      stages: [{ stage: 'Proposta', open_deals: 2 }],
    });
    expect(JSON.stringify(result.output)).not.toMatch(/owner|customer|notes|lost_reason/i);
  });

  it('calcula a janela da agenda no fuso da empresa e marca itens atrasados', async () => {
    const window = resolveAgendaWindow('America/Sao_Paulo', NOW);
    expect(window.dayStartIso).toBe('2026-07-28T03:00:00.000Z');
    expect(window.dayEndIso).toBe('2026-07-29T03:00:00.000Z');
    expect(window.weekEndIso).toBe('2026-08-04T03:00:00.000Z');

    vi.mocked(dataSource.getAgendaSummary).mockResolvedValue({
      todayCount: 2,
      weekCount: 5,
      overdueCount: 1,
      items: [
        {
          title: 'Reunião com fornecedor',
          type: 'reuniao',
          status: 'agendado',
          startAt: '2026-07-27T13:00:00.000Z',
          overdue: true,
        },
      ],
    });

    const result = await registry().execute(
      'get_agenda_summary',
      JSON.stringify({}),
      environment('employee'),
    );

    expect(dataSource.getAgendaSummary).toHaveBeenCalledWith(
      NOW.toISOString(),
      window.dayStartIso,
      window.dayEndIso,
      window.weekEndIso,
      15,
    );
    expect(result.output).toMatchObject({
      reference_day: '28/07/2026',
      today_count: 2,
      overdue_count: 1,
      items: [{ title: 'Reunião com fornecedor', overdue: true }],
    });
  });

  it('lista fornecedores sem e-mail, telefone ou documento', async () => {
    vi.mocked(dataSource.listSuppliers).mockResolvedValue({
      activeCount: 1,
      totalMatches: 1,
      items: [{ name: 'Distribuidora Central', status: 'active' }],
    });

    const result = await registry().execute(
      'list_suppliers',
      JSON.stringify({ limit: 30 }),
      environment('employee'),
    );

    expect(result.output).toMatchObject({
      active_count: 1,
      items: [{ supplier: 'Distribuidora Central', status: 'active' }],
    });
    expect(JSON.stringify(result.output)).not.toMatch(/email|phone|document|@/i);
  });

  it('resume documentos por categoria sem nome de arquivo, link ou vínculo', async () => {
    vi.mocked(dataSource.getDocumentsSummary).mockResolvedValue({
      activeTotal: 4,
      newInPeriod: 1,
      categories: [{ category: 'contratos', documents: 3 }],
    });

    const result = await registry().execute(
      'get_documents_summary',
      PERIOD_ARGS,
      environment('employee'),
    );

    expect(result.output).toMatchObject({
      active_total: 4,
      new_in_period: 1,
      categories: [{ category: 'contratos', documents: 3 }],
    });
    expect(JSON.stringify(result.output)).not.toMatch(
      /storage_path|url|original_name|related_id|mime/i,
    );
  });

  it('mantém a visão geral livre de dados financeiros para não furar a regra de papel', async () => {
    vi.mocked(dataSource.getBusinessOverview).mockResolvedValue({
      salesTotal: 12450,
      salesCount: 3,
      openDeals: 2,
      openDealsValue: 9000,
      overdueAppointments: 1,
      activeProducts: 1,
      lowStockProducts: 0,
      outOfStockProducts: 0,
      activeCustomers: 2,
    });

    const result = await registry().execute(
      'get_business_overview',
      PERIOD_ARGS,
      environment('employee'),
    );

    expect(result.output).toMatchObject({ sales_total: 12450, open_deals: 2 });
    expect(JSON.stringify(result.output)).not.toMatch(
      /receivable|payable|a_receber|a_pagar|overdue_total/i,
    );
  });

  it('nega o financeiro consolidado a employee antes de consultar a fonte', async () => {
    await expect(
      registry().execute('get_financial_overview', JSON.stringify({}), environment('employee')),
    ).rejects.toMatchObject({ code: 'financial_permission_denied' });
    expect(dataSource.getFinancialOverview).not.toHaveBeenCalled();

    vi.mocked(dataSource.getFinancialOverview).mockResolvedValue({
      receivablePendingTotal: 500,
      receivablePendingCount: 2,
      receivableOverdueTotal: 200,
      receivableOverdueCount: 1,
      payablePendingTotal: 300,
      payablePendingCount: 1,
      payableOverdueTotal: 0,
      payableOverdueCount: 0,
    });

    for (const role of ['admin', 'manager'] as const) {
      await expect(
        registry().execute('get_financial_overview', JSON.stringify({}), environment(role)),
      ).resolves.toMatchObject({ output: { receivable_pending_total: 500 } });
    }
  });

  it('responde ajuda do sistema sem tocar em nenhuma fonte de dados', async () => {
    const result = await registry().execute(
      'get_system_help',
      JSON.stringify({ topic: 'vendas' }),
      environment('employee'),
    );

    expect(result.output.topic).toBe('vendas');
    expect(String(result.output.guidance)).toContain('Vendas');
    for (const call of Object.values(dataSource)) {
      expect(call).not.toHaveBeenCalled();
    }

    await expect(
      registry().execute(
        'get_system_help',
        JSON.stringify({ topic: 'dados_de_outra_empresa' }),
        environment(),
      ),
    ).rejects.toMatchObject({ code: 'invalid_tool_arguments' });
  });

  it('rejeita empresa escolhida pelo modelo e argumentos extras em todos os domínios', async () => {
    const attempts: [string, unknown][] = [
      ['list_inventory_products', { limit: 10, company_id: 'company-b' }],
      ['get_pipeline_summary', { company_id: 'company-b' }],
      ['get_agenda_summary', { user_id: 'outro' }],
      ['list_suppliers', { limit: 10, filter: 'x' }],
      ['get_purchases_summary', { period: 'current_month', date_from: null, date_to: null, sql: 'x' }],
      ['get_business_overview', { period: 'current_month', date_from: null, date_to: null, table: 'sales' }],
      ['get_financial_overview', { company_id: 'company-b' }],
      ['get_system_help', { topic: 'vendas', company_id: 'company-b' }],
    ];

    for (const [tool, argumentSet] of attempts) {
      await expect(
        registry().execute(tool, JSON.stringify(argumentSet), environment()),
      ).rejects.toMatchObject({ code: 'invalid_tool_arguments' });
    }
  });

  it('trata resultado vazio como estado válido e igual entre empresas', async () => {
    vi.mocked(dataSource.listInventoryProducts).mockResolvedValue({ totalMatches: 0, items: [] });

    const first = await registry().execute(
      'list_inventory_products',
      JSON.stringify({ limit: 50 }),
      environment('admin', 'company-a'),
    );
    const second = await registry().execute(
      'list_inventory_products',
      JSON.stringify({ limit: 50 }),
      environment('admin', 'company-b'),
    );

    expect(first.output).toEqual(second.output);
    expect(first.output).toMatchObject({ items: [], total_matches: 0, truncated: false });
    expect(JSON.stringify([first, second])).not.toMatch(/company-[ab]|user-a/);
  });
});

describe('Gestly multi-domain database contract', () => {
  it('mantém todas as RPCs SECURITY INVOKER, com auth.uid e filtro explícito', () => {
    const functions = migration.slice(
      migration.indexOf('CREATE OR REPLACE FUNCTION public.gestly_list_inventory_products'),
      migration.indexOf('REVOKE ALL ON FUNCTION public.gestly_list_inventory_products'),
    );

    expect(functions.match(/SECURITY INVOKER/g)).toHaveLength(8);
    expect(functions.match(/auth\.uid\(\)/g)).toHaveLength(8);
    expect(functions).not.toContain('SECURITY DEFINER');
    expect(functions).not.toContain('p_company_id');
    expect(functions).not.toMatch(/\b(INSERT INTO|UPDATE public|DELETE FROM|MERGE|TRUNCATE)\b/i);
    // Cada função precisa restringir o tenant explicitamente, além da RLS.
    expect((functions.match(/company_id = v_company_id/g) ?? []).length).toBeGreaterThanOrEqual(8);
  });

  it('restringe o financeiro por papel e não concede nada a anon', () => {
    expect(migration).toContain("v_role NOT IN ('admin', 'manager')");
    expect(migration.match(/FROM PUBLIC, anon;/g)).toHaveLength(8);
    expect(migration.match(/TO authenticated;/g)).toHaveLength(8);
    expect(migration).not.toMatch(/TO anon\b/);
  });

  it('não persiste conteúdo conversacional junto da auditoria', () => {
    const auditBlock = migration.slice(0, migration.indexOf('CREATE INDEX'));
    expect(auditBlock).not.toMatch(/\b(prompt|response|message|content|payload)\b/i);
    expect(auditBlock).toContain("'get_business_overview'");
  });
});
