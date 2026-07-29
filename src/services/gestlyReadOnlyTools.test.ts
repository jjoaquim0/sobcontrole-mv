import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIServiceError } from '../../supabase/functions/_shared/ai/errors.ts';
import {
  createCustomersSummaryTool,
  createInventorySummaryTool,
  createLowStockProductsTool,
  createOverdueFinancialItemsTool,
  createProductStockTool,
  createSalesSummaryTool,
} from '../../supabase/functions/_shared/ai/tools/definitions.ts';
import { resolvePeriod } from '../../supabase/functions/_shared/ai/tools/period.ts';
import { ReadOnlyToolRegistry } from '../../supabase/functions/_shared/ai/tools/registry.ts';
import type {
  GestlyToolDataSource,
  ResolvedSecurityContext,
} from '../../supabase/functions/_shared/ai/tools/types.ts';
import type {
  SecurityContext,
  SecurityRole,
} from '../../supabase/functions/_shared/ai/types.ts';

const NOW = new Date('2026-07-25T15:00:00.000Z');
const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260725130000_gestly_read_only_tools_p1.sql'),
  'utf8',
);
const inventoryMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260728120000_gestly_inventory_tools_p1.sql'),
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

const createRegistry = (): ReadOnlyToolRegistry =>
  new ReadOnlyToolRegistry()
    .register(createSalesSummaryTool(() => NOW))
    .register(createCustomersSummaryTool(() => NOW))
    .register(createLowStockProductsTool(() => NOW))
    .register(createInventorySummaryTool(() => NOW))
    .register(createProductStockTool(() => NOW))
    .register(createOverdueFinancialItemsTool(() => NOW));

const createContext = (
  role: SecurityRole = 'admin',
  companyId = 'company-a',
): SecurityContext => ({
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
});

const environment = (
  role: SecurityRole = 'admin',
  companyId = 'company-a',
): ResolvedSecurityContext => ({
  securityContext: createContext(role, companyId),
  dataSource,
});

describe('Gestly typed read-only tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('expõe somente os contratos fechados, estritos e sem seletor de tenant ou SQL', () => {
    const tools = createRegistry().toProviderTools();
    expect(tools.map((tool) => tool.name)).toEqual([
      'get_sales_summary',
      'get_customers_summary',
      'get_low_stock_products',
      'get_inventory_summary',
      'get_product_stock',
      'get_overdue_financial_items',
    ]);
    expect(tools.every((tool) => tool.strict)).toBe(true);
    expect(tools.every((tool) => tool.parameters.additionalProperties === false)).toBe(true);
    expect(JSON.stringify(tools.map((tool) => tool.parameters))).not.toMatch(
      /company_?id|user_?id|tenant|sql|table_name|column_name/i,
    );
  });

  it('resolve mês atual até hoje no fuso da empresa e limita custom a 366 dias', () => {
    expect(
      resolvePeriod(
        { period: 'current_month', dateFrom: null, dateTo: null },
        'America/Sao_Paulo',
        366,
        NOW,
      ),
    ).toEqual({
      startDate: '2026-07-01',
      endDate: '2026-07-25',
      startIso: '2026-07-01T03:00:00.000Z',
      endExclusiveIso: '2026-07-26T03:00:00.000Z',
      label: '01/07/2026 a 25/07/2026',
    });

    expect(() =>
      resolvePeriod(
        { period: 'custom', dateFrom: '2025-07-24', dateTo: '2026-07-25' },
        'America/Sao_Paulo',
        366,
        NOW,
      ),
    ).toThrowError(AIServiceError);

    expect(
      resolvePeriod(
        { period: 'custom', dateFrom: '2026-07-01', dateTo: '2026-07-10' },
        'America/Sao_Paulo',
        366,
        NOW,
      ),
    ).toMatchObject({
      startDate: '2026-07-01',
      endDate: '2026-07-10',
      startIso: '2026-07-01T03:00:00.000Z',
      endExclusiveIso: '2026-07-11T03:00:00.000Z',
    });
  });

  it('rejeita parâmetros livres, empresa escolhida pelo modelo e ferramenta desconhecida', async () => {
    const registry = createRegistry();
    await expect(
      registry.execute(
        'get_sales_summary',
        JSON.stringify({
          period: 'current_month',
          date_from: null,
          date_to: null,
          company_id: 'company-b',
        }),
        environment(),
      ),
    ).rejects.toMatchObject({ code: 'invalid_tool_arguments' });
    await expect(
      registry.execute('run_sql', JSON.stringify({ sql: 'select * from profiles' }), environment()),
    ).rejects.toMatchObject({ code: 'tool_unavailable' });
    expect(dataSource.getSalesSummary).not.toHaveBeenCalled();
  });

  it('calcula vendas pagas e clientes em agregados sem dados pessoais', async () => {
    vi.mocked(dataSource.getSalesSummary).mockResolvedValue({
      totalSold: 1250.5,
      salesCount: 5,
      averageTicket: 250.1,
    });
    vi.mocked(dataSource.getCustomersSummary).mockResolvedValue({
      activeCustomers: 42,
      newCustomers: 3,
    });
    const registry = createRegistry();
    const periodArguments = JSON.stringify({
      period: 'last_7_days',
      date_from: null,
      date_to: null,
    });

    const sales = await registry.execute(
      'get_sales_summary',
      periodArguments,
      environment(),
    );
    const customers = await registry.execute(
      'get_customers_summary',
      periodArguments,
      environment(),
    );

    expect(sales.output).toMatchObject({
      total_sold: 1250.5,
      sales_count: 5,
      average_ticket: 250.1,
      currency: 'BRL',
    });
    expect(customers.output).toMatchObject({
      active_customers: 42,
      new_customers: 3,
    });
    expect(JSON.stringify({ sales, customers })).not.toMatch(
      /company-a|user-a|full_name|document|email|phone/i,
    );
  });

  it('prioriza ruptura, aplica limite e marca resultado de estoque truncado', async () => {
    vi.mocked(dataSource.getLowStockProducts).mockResolvedValue({
      totalMatches: 2,
      items: [
        {
          productName: 'Produto A',
          sku: 'SKU-A',
          currentStock: 0,
          minimumStock: 4,
          shortage: 4,
          stockStatus: 'out_of_stock',
        },
      ],
    });

    const result = await createRegistry().execute(
      'get_low_stock_products',
      JSON.stringify({ limit: 1 }),
      environment(),
    );

    expect(dataSource.getLowStockProducts).toHaveBeenCalledWith(1);
    expect(result.output).toMatchObject({
      total_matches: 2,
      truncated: true,
      items: [{ product: 'Produto A', status: 'out_of_stock' }],
    });
    expect(result.metadata).toMatchObject({ recordCount: 1, truncated: true });
  });

  it('retorna lista vazia de estoque como estado válido e não truncado', async () => {
    vi.mocked(dataSource.getLowStockProducts).mockResolvedValue({
      totalMatches: 0,
      items: [],
    });

    const result = await createRegistry().execute(
      'get_low_stock_products',
      JSON.stringify({ limit: 25 }),
      environment(),
    );

    expect(result.output).toMatchObject({
      items: [],
      total_matches: 0,
      truncated: false,
    });
    expect(result.metadata).toMatchObject({ recordCount: 0, truncated: false });
  });

  it('resume o estoque total sem exigir argumentos e sem expor preços', async () => {
    vi.mocked(dataSource.getInventorySummary).mockResolvedValue({
      activeProducts: 9,
      totalUnits: 143.5,
      outOfStockCount: 0,
      lowStockCount: 0,
      healthyCount: 9,
    });

    const result = await createRegistry().execute(
      'get_inventory_summary',
      JSON.stringify({}),
      environment('employee'),
    );

    expect(result.output).toMatchObject({
      active_products: 9,
      total_units: 143.5,
      out_of_stock_count: 0,
      low_stock_count: 0,
      healthy_count: 9,
    });
    expect(result.metadata).toMatchObject({ recordCount: 1, truncated: false });
    expect(JSON.stringify(result.output)).not.toMatch(
      /cost_price|sale_price|preço|valor|company-a/i,
    );
  });

  it('consulta o estoque de um produto específico e limita os resultados', async () => {
    vi.mocked(dataSource.getProductStock).mockResolvedValue({
      totalMatches: 3,
      items: [
        {
          productName: 'Casadinho',
          sku: 'CAS-01',
          unit: 'un',
          currentStock: 12,
          minimumStock: 5,
          stockStatus: 'in_stock',
        },
      ],
    });

    const result = await createRegistry().execute(
      'get_product_stock',
      JSON.stringify({ product_name: '  casadinho  ', limit: 1 }),
      environment('employee'),
    );

    expect(dataSource.getProductStock).toHaveBeenCalledWith('casadinho', 1);
    expect(result.output).toMatchObject({
      searched_for: 'casadinho',
      total_matches: 3,
      truncated: true,
      items: [
        {
          product: 'Casadinho',
          sku: 'CAS-01',
          unit: 'un',
          current_stock: 12,
          minimum_stock: 5,
          status: 'in_stock',
        },
      ],
    });
    expect(result.metadata).toMatchObject({ recordCount: 1, truncated: true });
  });

  it('rejeita busca de produto curta, longa, sem termo ou com chave extra', async () => {
    const registry = createRegistry();
    const invalidArguments = [
      { product_name: 'a', limit: 5 },
      { product_name: 'x'.repeat(61), limit: 5 },
      { product_name: '   ', limit: 5 },
      { product_name: 'casadinho', limit: 99 },
      { product_name: 'casadinho', limit: 5, company_id: 'company-b' },
      { limit: 5 },
    ];

    for (const argumentSet of invalidArguments) {
      await expect(
        registry.execute('get_product_stock', JSON.stringify(argumentSet), environment()),
      ).rejects.toMatchObject({ code: 'invalid_tool_arguments' });
    }
    expect(dataSource.getProductStock).not.toHaveBeenCalled();
  });

  it('retorna produto não encontrado como resultado vazio válido', async () => {
    vi.mocked(dataSource.getProductStock).mockResolvedValue({
      totalMatches: 0,
      items: [],
    });

    const result = await createRegistry().execute(
      'get_product_stock',
      JSON.stringify({ product_name: 'inexistente', limit: 10 }),
      environment(),
    );

    expect(result.output).toMatchObject({
      items: [],
      total_matches: 0,
      truncated: false,
    });
    expect(result.metadata).toMatchObject({ recordCount: 0, truncated: false });
  });

  it('nega financeiro a employee antes de consultar a fonte e permite admin/manager', async () => {
    const registry = createRegistry();
    const argumentsJson = JSON.stringify({ item_type: 'both', limit: 10 });

    await expect(
      registry.execute(
        'get_overdue_financial_items',
        argumentsJson,
        environment('employee'),
      ),
    ).rejects.toMatchObject({ code: 'financial_permission_denied' });
    expect(dataSource.getOverdueFinancialItems).not.toHaveBeenCalled();

    vi.mocked(dataSource.getOverdueFinancialItems).mockResolvedValue({
      referenceAt: NOW.toISOString(),
      receivableTotal: 300,
      receivableCount: 2,
      payableTotal: 100,
      payableCount: 1,
      combinedTotal: 400,
      combinedCount: 3,
      totalMatches: 3,
      items: [],
    });
    for (const role of ['manager', 'admin'] as const) {
      await expect(
        registry.execute(
          'get_overdue_financial_items',
          argumentsJson,
          environment(role),
        ),
      ).resolves.toMatchObject({
        output: {
          combined_total: 400,
          combined_count: 3,
        },
      });
    }
  });

  it('mantém resultados vazios válidos e isolados por contexto derivado', async () => {
    vi.mocked(dataSource.getSalesSummary).mockResolvedValue({
      totalSold: 0,
      salesCount: 0,
      averageTicket: null,
    });
    const registry = createRegistry();
    const resultA = await registry.execute(
      'get_sales_summary',
      JSON.stringify({ period: 'current_month', date_from: null, date_to: null }),
      environment('admin', 'company-a'),
    );
    const resultB = await registry.execute(
      'get_sales_summary',
      JSON.stringify({ period: 'current_month', date_from: null, date_to: null }),
      environment('admin', 'company-b'),
    );

    expect(resultA.output).toEqual(resultB.output);
    expect(resultA.output).toMatchObject({
      total_sold: 0,
      sales_count: 0,
      average_ticket: null,
    });
    expect(JSON.stringify([resultA, resultB])).not.toMatch(/company-[ab]/);
  });
});

describe('Gestly database isolation contract', () => {
  it('usa SECURITY INVOKER, auth.uid, RLS e filtros explícitos em todas as RPCs', () => {
    const toolFunctions = migration.slice(
      migration.indexOf('CREATE OR REPLACE FUNCTION public.gestly_sales_summary'),
      migration.indexOf('REVOKE ALL ON FUNCTION public.gestly_sales_summary'),
    );
    expect(toolFunctions.match(/SECURITY INVOKER/g)).toHaveLength(4);
    expect(toolFunctions.match(/auth\.uid\(\)/g)).toHaveLength(4);
    expect(toolFunctions.match(/company_id = v_company_id/g)?.length).toBeGreaterThanOrEqual(6);
    expect(toolFunctions).not.toContain('SECURITY DEFINER');
    expect(toolFunctions).not.toMatch(/\b(INSERT|UPDATE|DELETE|MERGE|TRUNCATE)\b/i);
    expect(toolFunctions).not.toContain('p_company_id');
  });

  it('restringe leitura financeira por papel e minimiza o service role à auditoria', () => {
    expect(migration.match(/AS RESTRICTIVE/g)).toHaveLength(2);
    expect(migration.match(/FOR SELECT/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migration).toContain("get_user_role()) IN ('admin', 'manager')");
    expect(migration).toContain(
      'REVOKE ALL ON TABLE public.ai_usage_logs FROM service_role',
    );
    expect(migration).toContain(
      'GRANT SELECT (request_id, company_id, user_id)',
    );
    expect(migration).not.toMatch(/GRANT\s+(INSERT|DELETE)\b[\s\S]*ai_usage_logs/i);
  });

  it('mantém as RPCs de estoque isoladas, somente leitura e com curinga escapado', () => {
    const inventoryFunctions = inventoryMigration.slice(
      inventoryMigration.indexOf('CREATE OR REPLACE FUNCTION public.gestly_inventory_summary'),
      inventoryMigration.indexOf('REVOKE ALL ON FUNCTION public.gestly_inventory_summary'),
    );
    expect(inventoryFunctions.match(/SECURITY INVOKER/g)).toHaveLength(2);
    expect(inventoryFunctions.match(/auth\.uid\(\)/g)).toHaveLength(2);
    expect(inventoryFunctions.match(/company_id = v_company_id/g)).toHaveLength(2);
    expect(inventoryFunctions).not.toContain('SECURITY DEFINER');
    expect(inventoryFunctions).not.toMatch(
      /\b(INSERT INTO|UPDATE public|DELETE FROM|MERGE|TRUNCATE)\b/i,
    );
    expect(inventoryMigration).not.toContain('p_company_id');
    // Sem o escape, um termo como "%" transformaria a busca em dump de catálogo.
    expect(inventoryMigration).toContain("ESCAPE '\\'");
    expect(inventoryMigration).toContain("replace(replace(replace(v_term");
    expect(inventoryMigration).toMatch(/length\(v_term\) < 2/);
    expect(inventoryMigration).toMatch(/p_limit > 10/);
    expect(inventoryMigration.match(/FROM PUBLIC, anon;/g)).toHaveLength(2);
    expect(inventoryMigration.match(/TO authenticated;/g)).toHaveLength(2);
    // As novas ferramentas precisam ser aceitas pela constraint de auditoria.
    expect(inventoryMigration).toContain("'get_inventory_summary'");
    expect(inventoryMigration).toContain("'get_product_stock'");
    // Preços continuam fora de qualquer saída.
    expect(inventoryMigration).not.toMatch(/cost_price|sale_price/);
  });

  it('não concede as RPCs ao público ou anon e não persiste conteúdo conversacional', () => {
    expect(migration.match(/FROM PUBLIC, anon;/g)).toHaveLength(4);
    expect(migration.match(/TO authenticated;/g)?.length).toBeGreaterThanOrEqual(4);
    const auditColumns = migration.slice(
      migration.indexOf('ALTER TABLE public.ai_usage_logs'),
      migration.indexOf('CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_tool_period'),
    );
    expect(auditColumns).not.toMatch(/\b(prompt|response|message|content|payload|tool_output)\b/i);
  });
});
