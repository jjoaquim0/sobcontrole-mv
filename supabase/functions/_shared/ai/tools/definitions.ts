import { AIServiceError } from '../errors.ts';
import type { ToolResponseMetadata } from '../types.ts';
import { resolvePeriod } from './period.ts';
import type { PeriodInput, PeriodPreset } from './period.ts';
import type {
  LowStockProductData,
  OverdueFinancialItemData,
  ProductStockData,
  ReadOnlyToolDefinition,
} from './types.ts';

interface FinanceInput {
  itemType: 'receivable' | 'payable' | 'both';
  limit: number;
}

interface LowStockInput {
  limit: number;
}

interface ProductStockInput {
  productName: string;
  limit: number;
}

type EmptyInput = Record<string, never>;

const MAX_PRODUCT_STOCK_RESULTS = 10;
const MIN_PRODUCT_NAME_LENGTH = 2;
const MAX_PRODUCT_NAME_LENGTH = 60;

export const ALL_ROLES = ['admin', 'manager', 'employee'] as const;
export const FINANCIAL_ROLES = ['admin', 'manager'] as const;
const PERIOD_PRESETS = new Set<PeriodPreset>([
  'current_month',
  'previous_month',
  'last_7_days',
  'custom',
]);

export const PERIOD_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    period: {
      type: 'string',
      enum: ['current_month', 'previous_month', 'last_7_days', 'custom'],
      description: 'Período predefinido ou customizado.',
    },
    date_from: {
      type: ['string', 'null'],
      description: 'Data inicial YYYY-MM-DD; obrigatória somente para custom.',
    },
    date_to: {
      type: ['string', 'null'],
      description: 'Data final YYYY-MM-DD; obrigatória somente para custom.',
    },
  },
  required: ['period', 'date_from', 'date_to'],
  additionalProperties: false,
} as const;

export const PERIOD_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    start: { type: 'string' },
    end: { type: 'string' },
    label: { type: 'string' },
  },
  required: ['start', 'end', 'label'],
  additionalProperties: false,
} as const;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

export const assertOutputRecord = (
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> => {
  if (!isRecord(value) || !hasExactKeys(value, keys)) {
    throw new AIServiceError('tool_query_failed');
  }
  return value;
};

export const assertFiniteNumber = (value: unknown, nullable = false): void => {
  if (nullable && value === null) return;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new AIServiceError('tool_query_failed');
  }
};

export const assertNonNegativeInteger = (value: unknown): void => {
  assertFiniteNumber(value);
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new AIServiceError('tool_query_failed');
  }
};

export const assertString = (value: unknown): void => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AIServiceError('tool_query_failed');
  }
};

export const assertPeriodOutput = (value: unknown): void => {
  const period = assertOutputRecord(value, ['start', 'end', 'label']);
  assertString(period.start);
  assertString(period.end);
  assertString(period.label);
};

export const parsePeriodInput = (value: unknown): PeriodInput => {
  if (!isRecord(value) || !hasExactKeys(value, ['period', 'date_from', 'date_to'])) {
    throw new AIServiceError('invalid_tool_arguments');
  }
  if (typeof value.period !== 'string' || !PERIOD_PRESETS.has(value.period as PeriodPreset)) {
    throw new AIServiceError('invalid_tool_arguments');
  }
  const validNullableDate = (date: unknown) => date === null || typeof date === 'string';
  if (!validNullableDate(value.date_from) || !validNullableDate(value.date_to)) {
    throw new AIServiceError('invalid_tool_arguments');
  }
  return {
    period: value.period as PeriodPreset,
    dateFrom: value.date_from as string | null,
    dateTo: value.date_to as string | null,
  };
};

export const parseBoundedLimit = (value: unknown, max: number): number => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > max) {
    throw new AIServiceError('invalid_tool_arguments');
  }
  return value;
};

export const periodOutput = (start: string, end: string, label: string) => ({
  start,
  end,
  label,
});

export const metadata = (
  values: Omit<ToolResponseMetadata, 'recordCount' | 'truncated'> & {
    recordCount: number;
    truncated: boolean;
  },
): ToolResponseMetadata => values;

export const shortDateLabel = (date: Date, timezone: string): string =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);

const validateSalesOutput = (value: unknown): Record<string, unknown> => {
  const output = assertOutputRecord(value, [
    'total_sold',
    'sales_count',
    'average_ticket',
    'currency',
    'period',
    'source',
    'criteria',
  ]);
  assertFiniteNumber(output.total_sold);
  assertNonNegativeInteger(output.sales_count);
  assertFiniteNumber(output.average_ticket, true);
  assertString(output.currency);
  assertPeriodOutput(output.period);
  assertString(output.source);
  assertString(output.criteria);
  return output;
};

const validateCustomersOutput = (value: unknown): Record<string, unknown> => {
  const output = assertOutputRecord(value, [
    'active_customers',
    'new_customers',
    'period',
    'source',
    'criteria',
  ]);
  assertNonNegativeInteger(output.active_customers);
  assertNonNegativeInteger(output.new_customers);
  assertPeriodOutput(output.period);
  assertString(output.source);
  assertString(output.criteria);
  return output;
};

const validateLowStockItem = (value: unknown): void => {
  const item = assertOutputRecord(value, [
    'product',
    'sku',
    'current_stock',
    'minimum_stock',
    'shortage',
    'status',
  ]);
  assertString(item.product);
  assertString(item.sku);
  assertFiniteNumber(item.current_stock);
  assertFiniteNumber(item.minimum_stock);
  assertFiniteNumber(item.shortage);
  if (item.status !== 'out_of_stock' && item.status !== 'low_stock') {
    throw new AIServiceError('tool_query_failed');
  }
};

const validateLowStockOutput = (value: unknown): Record<string, unknown> => {
  const output = assertOutputRecord(value, [
    'as_of',
    'items',
    'total_matches',
    'truncated',
    'source',
    'criteria',
  ]);
  assertString(output.as_of);
  if (!Array.isArray(output.items)) throw new AIServiceError('tool_query_failed');
  output.items.forEach(validateLowStockItem);
  assertNonNegativeInteger(output.total_matches);
  if (typeof output.truncated !== 'boolean') throw new AIServiceError('tool_query_failed');
  assertString(output.source);
  assertString(output.criteria);
  return output;
};

const validateInventoryOutput = (value: unknown): Record<string, unknown> => {
  const output = assertOutputRecord(value, [
    'as_of',
    'active_products',
    'total_units',
    'out_of_stock_count',
    'low_stock_count',
    'healthy_count',
    'source',
    'criteria',
  ]);
  assertString(output.as_of);
  assertNonNegativeInteger(output.active_products);
  assertFiniteNumber(output.total_units);
  assertNonNegativeInteger(output.out_of_stock_count);
  assertNonNegativeInteger(output.low_stock_count);
  assertNonNegativeInteger(output.healthy_count);
  assertString(output.source);
  assertString(output.criteria);
  return output;
};

const validateProductStockItem = (value: unknown): void => {
  const item = assertOutputRecord(value, [
    'product',
    'sku',
    'unit',
    'current_stock',
    'minimum_stock',
    'status',
  ]);
  assertString(item.product);
  assertString(item.sku);
  assertString(item.unit);
  assertFiniteNumber(item.current_stock);
  assertFiniteNumber(item.minimum_stock);
  if (
    item.status !== 'out_of_stock' &&
    item.status !== 'low_stock' &&
    item.status !== 'in_stock'
  ) {
    throw new AIServiceError('tool_query_failed');
  }
};

const validateProductStockOutput = (value: unknown): Record<string, unknown> => {
  const output = assertOutputRecord(value, [
    'as_of',
    'searched_for',
    'items',
    'total_matches',
    'truncated',
    'source',
    'criteria',
  ]);
  assertString(output.as_of);
  assertString(output.searched_for);
  if (!Array.isArray(output.items)) throw new AIServiceError('tool_query_failed');
  output.items.forEach(validateProductStockItem);
  assertNonNegativeInteger(output.total_matches);
  if (typeof output.truncated !== 'boolean') throw new AIServiceError('tool_query_failed');
  assertString(output.source);
  assertString(output.criteria);
  return output;
};

const validateFinancialItem = (value: unknown): void => {
  const item = assertOutputRecord(value, ['item_type', 'amount', 'due_date', 'days_overdue']);
  if (item.item_type !== 'receivable' && item.item_type !== 'payable') {
    throw new AIServiceError('tool_query_failed');
  }
  assertFiniteNumber(item.amount);
  assertString(item.due_date);
  assertNonNegativeInteger(item.days_overdue);
};

const validateFinancialOutput = (value: unknown): Record<string, unknown> => {
  const output = assertOutputRecord(value, [
    'reference_at',
    'receivable_total',
    'receivable_count',
    'payable_total',
    'payable_count',
    'combined_total',
    'combined_count',
    'items',
    'total_matches',
    'truncated',
    'currency',
    'source',
    'criteria',
  ]);
  assertString(output.reference_at);
  assertFiniteNumber(output.receivable_total);
  assertNonNegativeInteger(output.receivable_count);
  assertFiniteNumber(output.payable_total);
  assertNonNegativeInteger(output.payable_count);
  assertFiniteNumber(output.combined_total);
  assertNonNegativeInteger(output.combined_count);
  if (!Array.isArray(output.items)) throw new AIServiceError('tool_query_failed');
  output.items.forEach(validateFinancialItem);
  assertNonNegativeInteger(output.total_matches);
  if (typeof output.truncated !== 'boolean') throw new AIServiceError('tool_query_failed');
  assertString(output.currency);
  assertString(output.source);
  assertString(output.criteria);
  return output;
};

export const createSalesSummaryTool = (
  now: () => Date,
): ReadOnlyToolDefinition<PeriodInput> => ({
  name: 'get_sales_summary',
  domain: 'sales',
  sensitivity: 'internal',
  description:
    'Consulta o total, quantidade e ticket médio de vendas pagas em um período permitido. Não aceita empresa, SQL ou filtros livres.',
  mode: 'read_only',
  allowedRoles: ALL_ROLES,
  maxResults: 1,
  source: 'Vendas pagas registradas no SobControle.',
  criteria: "sales.payment_status = 'paid' e sales.created_at dentro do período.",
  inputSchema: PERIOD_INPUT_SCHEMA,
  outputSchema: {
    type: 'object',
    properties: {
      total_sold: { type: 'number' },
      sales_count: { type: 'integer' },
      average_ticket: { type: ['number', 'null'] },
      currency: { type: 'string' },
      period: PERIOD_OUTPUT_SCHEMA,
      source: { type: 'string' },
      criteria: { type: 'string' },
    },
    required: [
      'total_sold',
      'sales_count',
      'average_ticket',
      'currency',
      'period',
      'source',
      'criteria',
    ],
    additionalProperties: false,
  },
  parseInput: parsePeriodInput,
  validateOutput: validateSalesOutput,
  async execute({ securityContext, dataSource }, input) {
    const period = resolvePeriod(
      input,
      securityContext.timezone,
      securityContext.limits.maxCustomPeriodDays,
      now(),
    );
    const result = await dataSource.getSalesSummary(period.startIso, period.endExclusiveIso);
    const output = {
      total_sold: result.totalSold,
      sales_count: result.salesCount,
      average_ticket: result.averageTicket,
      currency: securityContext.currency,
      period: periodOutput(period.startDate, period.endDate, period.label),
      source: this.source,
      criteria: this.criteria,
    };
    return {
      output: this.validateOutput(output),
      metadata: metadata({
        toolName: this.name,
        periodLabel: period.label,
        periodStart: period.startIso,
        periodEnd: period.endExclusiveIso,
        source: this.source,
        criteria: this.criteria,
        recordCount: 1,
        truncated: false,
      }),
    };
  },
});

export const createCustomersSummaryTool = (
  now: () => Date,
): ReadOnlyToolDefinition<PeriodInput> => ({
  name: 'get_customers_summary',
  domain: 'customers',
  sensitivity: 'internal',
  description:
    'Consulta a quantidade atual de clientes ativos e os novos clientes de um período permitido, sem retornar dados pessoais.',
  mode: 'read_only',
  allowedRoles: ALL_ROLES,
  maxResults: 1,
  source: 'Cadastro de clientes do SobControle.',
  criteria:
    'Ativo significa customers.is_active = true; novo significa customers.created_at dentro do período.',
  inputSchema: PERIOD_INPUT_SCHEMA,
  outputSchema: {
    type: 'object',
    properties: {
      active_customers: { type: 'integer' },
      new_customers: { type: 'integer' },
      period: PERIOD_OUTPUT_SCHEMA,
      source: { type: 'string' },
      criteria: { type: 'string' },
    },
    required: ['active_customers', 'new_customers', 'period', 'source', 'criteria'],
    additionalProperties: false,
  },
  parseInput: parsePeriodInput,
  validateOutput: validateCustomersOutput,
  async execute({ securityContext, dataSource }, input) {
    const period = resolvePeriod(
      input,
      securityContext.timezone,
      securityContext.limits.maxCustomPeriodDays,
      now(),
    );
    const result = await dataSource.getCustomersSummary(period.startIso, period.endExclusiveIso);
    const output = {
      active_customers: result.activeCustomers,
      new_customers: result.newCustomers,
      period: periodOutput(period.startDate, period.endDate, period.label),
      source: this.source,
      criteria: this.criteria,
    };
    return {
      output: this.validateOutput(output),
      metadata: metadata({
        toolName: this.name,
        periodLabel: period.label,
        periodStart: period.startIso,
        periodEnd: period.endExclusiveIso,
        source: this.source,
        criteria: this.criteria,
        recordCount: 1,
        truncated: false,
      }),
    };
  },
});

export const createLowStockProductsTool = (
  now: () => Date,
): ReadOnlyToolDefinition<LowStockInput> => ({
  name: 'get_low_stock_products',
  domain: 'inventory',
  sensitivity: 'internal',
  description:
    'Lista até 25 produtos ativos sem estoque ou abaixo/do mínimo, com nome, SKU e quantidades mínimas necessárias.',
  mode: 'read_only',
  allowedRoles: ALL_ROLES,
  maxResults: 25,
  source: 'Cadastro e saldos atuais de produtos do SobControle.',
  criteria: 'products.is_active = true e current_quantity <= min_quantity.',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'integer', minimum: 1, maximum: 25 },
    },
    required: ['limit'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      as_of: { type: 'string' },
      items: {
        type: 'array',
        maxItems: 25,
        items: {
          type: 'object',
          properties: {
            product: { type: 'string' },
            sku: { type: 'string' },
            current_stock: { type: 'number' },
            minimum_stock: { type: 'number' },
            shortage: { type: 'number' },
            status: { type: 'string', enum: ['out_of_stock', 'low_stock'] },
          },
          required: [
            'product',
            'sku',
            'current_stock',
            'minimum_stock',
            'shortage',
            'status',
          ],
          additionalProperties: false,
        },
      },
      total_matches: { type: 'integer' },
      truncated: { type: 'boolean' },
      source: { type: 'string' },
      criteria: { type: 'string' },
    },
    required: ['as_of', 'items', 'total_matches', 'truncated', 'source', 'criteria'],
    additionalProperties: false,
  },
  parseInput(value) {
    if (!isRecord(value) || !hasExactKeys(value, ['limit'])) {
      throw new AIServiceError('invalid_tool_arguments');
    }
    return { limit: parseBoundedLimit(value.limit, this.maxResults) };
  },
  validateOutput: validateLowStockOutput,
  async execute({ securityContext, dataSource }, input) {
    const effectiveLimit = Math.min(
      input.limit,
      this.maxResults,
      securityContext.limits.maxLowStockResults,
    );
    const result = await dataSource.getLowStockProducts(effectiveLimit);
    const timestamp = now();
    const items = result.items.map((item: LowStockProductData) => ({
      product: item.productName,
      sku: item.sku,
      current_stock: item.currentStock,
      minimum_stock: item.minimumStock,
      shortage: item.shortage,
      status: item.stockStatus,
    }));
    const truncated = result.totalMatches > items.length;
    const output = {
      as_of: timestamp.toISOString(),
      items,
      total_matches: result.totalMatches,
      truncated,
      source: this.source,
      criteria: this.criteria,
    };
    return {
      output: this.validateOutput(output),
      metadata: metadata({
        toolName: this.name,
        periodLabel: `Posição em ${shortDateLabel(timestamp, securityContext.timezone)}`,
        periodStart: timestamp.toISOString(),
        periodEnd: timestamp.toISOString(),
        source: this.source,
        criteria: this.criteria,
        recordCount: items.length,
        truncated,
      }),
    };
  },
});

export const createInventorySummaryTool = (
  now: () => Date,
): ReadOnlyToolDefinition<EmptyInput> => ({
  name: 'get_inventory_summary',
  domain: 'inventory',
  sensitivity: 'internal',
  description:
    'Retorna a visão geral do estoque atual: quantos produtos ativos existem, o total de unidades e quantos estão zerados, baixos ou saudáveis. Use para perguntas como "quanto tenho de estoque" ou "quantos produtos eu tenho". Não retorna preços.',
  mode: 'read_only',
  allowedRoles: ALL_ROLES,
  maxResults: 1,
  source: 'Cadastro e saldos atuais de produtos do SobControle.',
  criteria:
    'Somente produtos com products.is_active = true; zerado é current_quantity <= 0 e baixo é current_quantity <= min_quantity.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      as_of: { type: 'string' },
      active_products: { type: 'integer' },
      total_units: { type: 'number' },
      out_of_stock_count: { type: 'integer' },
      low_stock_count: { type: 'integer' },
      healthy_count: { type: 'integer' },
      source: { type: 'string' },
      criteria: { type: 'string' },
    },
    required: [
      'as_of',
      'active_products',
      'total_units',
      'out_of_stock_count',
      'low_stock_count',
      'healthy_count',
      'source',
      'criteria',
    ],
    additionalProperties: false,
  },
  parseInput(value) {
    if (value !== null && value !== undefined && !isRecord(value)) {
      throw new AIServiceError('invalid_tool_arguments');
    }
    if (isRecord(value) && Object.keys(value).length > 0) {
      throw new AIServiceError('invalid_tool_arguments');
    }
    return {} as EmptyInput;
  },
  validateOutput: validateInventoryOutput,
  async execute({ securityContext, dataSource }) {
    const result = await dataSource.getInventorySummary();
    const timestamp = now();
    const output = {
      as_of: timestamp.toISOString(),
      active_products: result.activeProducts,
      total_units: result.totalUnits,
      out_of_stock_count: result.outOfStockCount,
      low_stock_count: result.lowStockCount,
      healthy_count: result.healthyCount,
      source: this.source,
      criteria: this.criteria,
    };
    return {
      output: this.validateOutput(output),
      metadata: metadata({
        toolName: this.name,
        periodLabel: `Posição em ${shortDateLabel(timestamp, securityContext.timezone)}`,
        periodStart: timestamp.toISOString(),
        periodEnd: timestamp.toISOString(),
        source: this.source,
        criteria: this.criteria,
        recordCount: 1,
        truncated: false,
      }),
    };
  },
});

export const createProductStockTool = (
  now: () => Date,
): ReadOnlyToolDefinition<ProductStockInput> => ({
  name: 'get_product_stock',
  domain: 'inventory',
  sensitivity: 'internal',
  description:
    'Consulta o estoque atual de um produto específico pelo nome ou SKU. Use para perguntas como "quantos {produto} eu tenho em estoque". Retorna no máximo 10 produtos correspondentes e nunca o catálogo inteiro.',
  mode: 'read_only',
  allowedRoles: ALL_ROLES,
  maxResults: MAX_PRODUCT_STOCK_RESULTS,
  source: 'Cadastro e saldos atuais de produtos do SobControle.',
  criteria:
    'products.is_active = true e nome ou SKU contendo o termo informado, com no máximo 10 resultados.',
  inputSchema: {
    type: 'object',
    properties: {
      product_name: {
        type: 'string',
        minLength: MIN_PRODUCT_NAME_LENGTH,
        maxLength: MAX_PRODUCT_NAME_LENGTH,
        description: 'Nome ou SKU do produto procurado, conforme dito pelo usuário.',
      },
      limit: { type: 'integer', minimum: 1, maximum: MAX_PRODUCT_STOCK_RESULTS },
    },
    required: ['product_name', 'limit'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      as_of: { type: 'string' },
      searched_for: { type: 'string' },
      items: {
        type: 'array',
        maxItems: MAX_PRODUCT_STOCK_RESULTS,
        items: {
          type: 'object',
          properties: {
            product: { type: 'string' },
            sku: { type: 'string' },
            unit: { type: 'string' },
            current_stock: { type: 'number' },
            minimum_stock: { type: 'number' },
            status: {
              type: 'string',
              enum: ['out_of_stock', 'low_stock', 'in_stock'],
            },
          },
          required: [
            'product',
            'sku',
            'unit',
            'current_stock',
            'minimum_stock',
            'status',
          ],
          additionalProperties: false,
        },
      },
      total_matches: { type: 'integer' },
      truncated: { type: 'boolean' },
      source: { type: 'string' },
      criteria: { type: 'string' },
    },
    required: [
      'as_of',
      'searched_for',
      'items',
      'total_matches',
      'truncated',
      'source',
      'criteria',
    ],
    additionalProperties: false,
  },
  parseInput(value) {
    if (!isRecord(value) || !hasExactKeys(value, ['product_name', 'limit'])) {
      throw new AIServiceError('invalid_tool_arguments');
    }
    if (typeof value.product_name !== 'string') {
      throw new AIServiceError('invalid_tool_arguments');
    }
    const productName = value.product_name.trim();
    if (
      productName.length < MIN_PRODUCT_NAME_LENGTH ||
      productName.length > MAX_PRODUCT_NAME_LENGTH
    ) {
      throw new AIServiceError('invalid_tool_arguments');
    }
    return {
      productName,
      limit: parseBoundedLimit(value.limit, this.maxResults),
    };
  },
  validateOutput: validateProductStockOutput,
  async execute({ securityContext, dataSource }, input) {
    const effectiveLimit = Math.min(input.limit, this.maxResults);
    const result = await dataSource.getProductStock(input.productName, effectiveLimit);
    const timestamp = now();
    const items = result.items.map((item: ProductStockData) => ({
      product: item.productName,
      sku: item.sku,
      unit: item.unit,
      current_stock: item.currentStock,
      minimum_stock: item.minimumStock,
      status: item.stockStatus,
    }));
    const truncated = result.totalMatches > items.length;
    const output = {
      as_of: timestamp.toISOString(),
      searched_for: input.productName,
      items,
      total_matches: result.totalMatches,
      truncated,
      source: this.source,
      criteria: this.criteria,
    };
    return {
      output: this.validateOutput(output),
      metadata: metadata({
        toolName: this.name,
        periodLabel: `Posição em ${shortDateLabel(timestamp, securityContext.timezone)}`,
        periodStart: timestamp.toISOString(),
        periodEnd: timestamp.toISOString(),
        source: this.source,
        criteria: this.criteria,
        recordCount: items.length,
        truncated,
      }),
    };
  },
});

export const createOverdueFinancialItemsTool = (
  now: () => Date,
): ReadOnlyToolDefinition<FinanceInput> => ({
  name: 'get_overdue_financial_items',
  domain: 'financial',
  sensitivity: 'financial',
  description:
    'Consulta totais e até 20 contas vencidas a receber/pagar. Disponível somente para administradores e gerentes.',
  mode: 'read_only',
  allowedRoles: FINANCIAL_ROLES,
  maxResults: 20,
  source: 'Contas a receber e a pagar registradas no SobControle.',
  criteria:
    "status em ('pending', 'late') e due_date anterior ao instante de referência.",
  inputSchema: {
    type: 'object',
    properties: {
      item_type: {
        type: 'string',
        enum: ['receivable', 'payable', 'both'],
      },
      limit: { type: 'integer', minimum: 1, maximum: 20 },
    },
    required: ['item_type', 'limit'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      reference_at: { type: 'string' },
      receivable_total: { type: 'number' },
      receivable_count: { type: 'integer' },
      payable_total: { type: 'number' },
      payable_count: { type: 'integer' },
      combined_total: { type: 'number' },
      combined_count: { type: 'integer' },
      items: {
        type: 'array',
        maxItems: 20,
        items: {
          type: 'object',
          properties: {
            item_type: { type: 'string', enum: ['receivable', 'payable'] },
            amount: { type: 'number' },
            due_date: { type: 'string' },
            days_overdue: { type: 'integer' },
          },
          required: ['item_type', 'amount', 'due_date', 'days_overdue'],
          additionalProperties: false,
        },
      },
      total_matches: { type: 'integer' },
      truncated: { type: 'boolean' },
      currency: { type: 'string' },
      source: { type: 'string' },
      criteria: { type: 'string' },
    },
    required: [
      'reference_at',
      'receivable_total',
      'receivable_count',
      'payable_total',
      'payable_count',
      'combined_total',
      'combined_count',
      'items',
      'total_matches',
      'truncated',
      'currency',
      'source',
      'criteria',
    ],
    additionalProperties: false,
  },
  parseInput(value) {
    if (!isRecord(value) || !hasExactKeys(value, ['item_type', 'limit'])) {
      throw new AIServiceError('invalid_tool_arguments');
    }
    if (
      value.item_type !== 'receivable' &&
      value.item_type !== 'payable' &&
      value.item_type !== 'both'
    ) {
      throw new AIServiceError('invalid_tool_arguments');
    }
    return {
      itemType: value.item_type,
      limit: parseBoundedLimit(value.limit, this.maxResults),
    };
  },
  validateOutput: validateFinancialOutput,
  async execute({ securityContext, dataSource }, input) {
    if (!this.allowedRoles.includes(securityContext.role as 'admin' | 'manager')) {
      throw new AIServiceError('financial_permission_denied');
    }
    const effectiveLimit = Math.min(
      input.limit,
      this.maxResults,
      securityContext.limits.maxFinancialResults,
    );
    const timestamp = now();
    const result = await dataSource.getOverdueFinancialItems(
      input.itemType,
      effectiveLimit,
      timestamp.toISOString(),
    );
    const items = result.items.map((item: OverdueFinancialItemData) => ({
      item_type: item.itemType,
      amount: item.amount,
      due_date: item.dueDate,
      days_overdue: item.daysOverdue,
    }));
    const truncated = result.totalMatches > items.length;
    const output = {
      reference_at: result.referenceAt,
      receivable_total: result.receivableTotal,
      receivable_count: result.receivableCount,
      payable_total: result.payableTotal,
      payable_count: result.payableCount,
      combined_total: result.combinedTotal,
      combined_count: result.combinedCount,
      items,
      total_matches: result.totalMatches,
      truncated,
      currency: securityContext.currency,
      source: this.source,
      criteria: this.criteria,
    };
    return {
      output: this.validateOutput(output),
      metadata: metadata({
        toolName: this.name,
        periodLabel: `Vencidas até ${shortDateLabel(timestamp, securityContext.timezone)}`,
        periodStart: timestamp.toISOString(),
        periodEnd: timestamp.toISOString(),
        source: this.source,
        criteria: this.criteria,
        recordCount: items.length,
        truncated,
      }),
    };
  },
});

export const createDefaultToolDefinitions = (
  now: () => Date = () => new Date(),
) => [
  createSalesSummaryTool(now),
  createCustomersSummaryTool(now),
  createLowStockProductsTool(now),
  createInventorySummaryTool(now),
  createProductStockTool(now),
  createOverdueFinancialItemsTool(now),
] as const;

