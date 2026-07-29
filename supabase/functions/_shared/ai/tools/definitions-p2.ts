import { AIServiceError } from '../errors.ts';
import {
  ALL_ROLES,
  FINANCIAL_ROLES,
  PERIOD_INPUT_SCHEMA,
  PERIOD_OUTPUT_SCHEMA,
  assertFiniteNumber,
  assertNonNegativeInteger,
  assertOutputRecord,
  assertPeriodOutput,
  assertString,
  hasExactKeys,
  isRecord,
  metadata,
  parseBoundedLimit,
  parsePeriodInput,
  periodOutput,
  shortDateLabel,
} from './definitions.ts';
import { resolveAgendaWindow, resolvePeriod } from './period.ts';
import type { PeriodInput } from './period.ts';
import type {
  AgendaItemData,
  DocumentCategoryData,
  PipelineStageData,
  ProductStockData,
  ReadOnlyToolDefinition,
  SupplierData,
} from './types.ts';

interface LimitInput {
  limit: number;
}

type EmptyInput = Record<string, never>;

const MAX_PRODUCT_LIST = 50;
const MAX_SUPPLIER_LIST = 30;
const MAX_AGENDA_ITEMS = 15;

const EMPTY_INPUT_SCHEMA = {
  type: 'object',
  properties: {},
  required: [],
  additionalProperties: false,
} as const;

const limitSchema = (max: number) =>
  ({
    type: 'object',
    properties: {
      limit: { type: 'integer', minimum: 1, maximum: max },
    },
    required: ['limit'],
    additionalProperties: false,
  }) as const;

const parseEmptyInput = (value: unknown): EmptyInput => {
  if (value !== null && value !== undefined && !isRecord(value)) {
    throw new AIServiceError('invalid_tool_arguments');
  }
  if (isRecord(value) && Object.keys(value).length > 0) {
    throw new AIServiceError('invalid_tool_arguments');
  }
  return {} as EmptyInput;
};

const parseLimitInput = (value: unknown, max: number): LimitInput => {
  if (!isRecord(value) || !hasExactKeys(value, ['limit'])) {
    throw new AIServiceError('invalid_tool_arguments');
  }
  return { limit: parseBoundedLimit(value.limit, max) };
};

const positionLabel = (timestamp: Date, timezone: string): string =>
  `Posição em ${shortDateLabel(timestamp, timezone)}`;

// ---------------------------------------------------------------------------
// Estoque — listagem ampla
// ---------------------------------------------------------------------------

const validateProductListItem = (value: unknown): void => {
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

export const createListInventoryProductsTool = (
  now: () => Date,
): ReadOnlyToolDefinition<LimitInput> => ({
  name: 'list_inventory_products',
  domain: 'inventory',
  sensitivity: 'internal',
  description:
    'Lista os produtos ativos da empresa com estoque atual, para perguntas amplas como "quais produtos eu tenho?" ou "me mostre meu estoque". Não exige nome nem SKU. Máximo de 50 produtos.',
  mode: 'read_only',
  allowedRoles: ALL_ROLES,
  maxResults: MAX_PRODUCT_LIST,
  source: 'Cadastro e saldos atuais de produtos do SobControle.',
  criteria: 'products.is_active = true, ordenados por nome.',
  inputSchema: limitSchema(MAX_PRODUCT_LIST),
  outputSchema: {
    type: 'object',
    properties: {
      as_of: { type: 'string' },
      items: { type: 'array', maxItems: MAX_PRODUCT_LIST },
      total_matches: { type: 'integer' },
      truncated: { type: 'boolean' },
      source: { type: 'string' },
      criteria: { type: 'string' },
    },
    required: ['as_of', 'items', 'total_matches', 'truncated', 'source', 'criteria'],
    additionalProperties: false,
  },
  parseInput(value) {
    return parseLimitInput(value, this.maxResults);
  },
  validateOutput(value) {
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
    output.items.forEach(validateProductListItem);
    assertNonNegativeInteger(output.total_matches);
    if (typeof output.truncated !== 'boolean') throw new AIServiceError('tool_query_failed');
    assertString(output.source);
    assertString(output.criteria);
    return output;
  },
  async execute({ securityContext, dataSource }, input) {
    const effectiveLimit = Math.min(input.limit, this.maxResults);
    const result = await dataSource.listInventoryProducts(effectiveLimit);
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
    return {
      output: this.validateOutput({
        as_of: timestamp.toISOString(),
        items,
        total_matches: result.totalMatches,
        truncated,
        source: this.source,
        criteria: this.criteria,
      }),
      metadata: metadata({
        toolName: this.name,
        periodLabel: positionLabel(timestamp, securityContext.timezone),
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

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export const createPipelineSummaryTool = (
  now: () => Date,
): ReadOnlyToolDefinition<EmptyInput> => ({
  name: 'get_pipeline_summary',
  domain: 'pipeline',
  sensitivity: 'internal',
  description:
    'Resumo do funil de vendas: oportunidades abertas, valor total em aberto, ganhas, perdidas e distribuição por etapa. Use para "quantas oportunidades tenho", "quanto tenho no pipeline" ou "qual etapa tem mais negócios".',
  mode: 'read_only',
  allowedRoles: ALL_ROLES,
  maxResults: 1,
  source: 'Pipeline de vendas (negócios e etapas) do SobControle.',
  criteria:
    "deals.status = 'open' para aberto, 'won' para ganho e 'lost' para perdido; etapas ativas do funil.",
  inputSchema: EMPTY_INPUT_SCHEMA,
  outputSchema: {
    type: 'object',
    properties: {
      as_of: { type: 'string' },
      open_deals: { type: 'integer' },
      open_value: { type: 'number' },
      won_deals: { type: 'integer' },
      won_value: { type: 'number' },
      lost_deals: { type: 'integer' },
      stages: { type: 'array' },
      currency: { type: 'string' },
      source: { type: 'string' },
      criteria: { type: 'string' },
    },
    required: [
      'as_of',
      'open_deals',
      'open_value',
      'won_deals',
      'won_value',
      'lost_deals',
      'stages',
      'currency',
      'source',
      'criteria',
    ],
    additionalProperties: false,
  },
  parseInput: parseEmptyInput,
  validateOutput(value) {
    const output = assertOutputRecord(value, [
      'as_of',
      'open_deals',
      'open_value',
      'won_deals',
      'won_value',
      'lost_deals',
      'stages',
      'currency',
      'source',
      'criteria',
    ]);
    assertString(output.as_of);
    assertNonNegativeInteger(output.open_deals);
    assertFiniteNumber(output.open_value);
    assertNonNegativeInteger(output.won_deals);
    assertFiniteNumber(output.won_value);
    assertNonNegativeInteger(output.lost_deals);
    if (!Array.isArray(output.stages)) throw new AIServiceError('tool_query_failed');
    output.stages.forEach((stage) => {
      const entry = assertOutputRecord(stage, ['stage', 'open_deals', 'open_value']);
      assertString(entry.stage);
      assertNonNegativeInteger(entry.open_deals);
      assertFiniteNumber(entry.open_value);
    });
    assertString(output.currency);
    assertString(output.source);
    assertString(output.criteria);
    return output;
  },
  async execute({ securityContext, dataSource }) {
    const result = await dataSource.getPipelineSummary();
    const timestamp = now();
    return {
      output: this.validateOutput({
        as_of: timestamp.toISOString(),
        open_deals: result.openCount,
        open_value: result.openValue,
        won_deals: result.wonCount,
        won_value: result.wonValue,
        lost_deals: result.lostCount,
        stages: result.stages.map((stage: PipelineStageData) => ({
          stage: stage.stage,
          open_deals: stage.openDeals,
          open_value: stage.openValue,
        })),
        currency: securityContext.currency,
        source: this.source,
        criteria: this.criteria,
      }),
      metadata: metadata({
        toolName: this.name,
        periodLabel: positionLabel(timestamp, securityContext.timezone),
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

// ---------------------------------------------------------------------------
// Agenda e tarefas
// ---------------------------------------------------------------------------

export const createAgendaSummaryTool = (
  now: () => Date,
): ReadOnlyToolDefinition<EmptyInput> => ({
  name: 'get_agenda_summary',
  domain: 'agenda',
  sensitivity: 'internal',
  description:
    'Compromissos e tarefas pendentes: quantos são hoje, quantos nos próximos 7 dias, quantos estão atrasados e a lista dos mais próximos. Use para "o que tenho hoje", "minhas tarefas" ou "compromissos atrasados".',
  mode: 'read_only',
  allowedRoles: ALL_ROLES,
  maxResults: MAX_AGENDA_ITEMS,
  source: 'Agenda e tarefas do SobControle.',
  criteria:
    "appointments com status em ('agendado', 'confirmado', 'pendente'); atrasado é start_at anterior a agora.",
  inputSchema: EMPTY_INPUT_SCHEMA,
  outputSchema: {
    type: 'object',
    properties: {
      reference_day: { type: 'string' },
      today_count: { type: 'integer' },
      next_7_days_count: { type: 'integer' },
      overdue_count: { type: 'integer' },
      items: { type: 'array', maxItems: MAX_AGENDA_ITEMS },
      truncated: { type: 'boolean' },
      source: { type: 'string' },
      criteria: { type: 'string' },
    },
    required: [
      'reference_day',
      'today_count',
      'next_7_days_count',
      'overdue_count',
      'items',
      'truncated',
      'source',
      'criteria',
    ],
    additionalProperties: false,
  },
  parseInput: parseEmptyInput,
  validateOutput(value) {
    const output = assertOutputRecord(value, [
      'reference_day',
      'today_count',
      'next_7_days_count',
      'overdue_count',
      'items',
      'truncated',
      'source',
      'criteria',
    ]);
    assertString(output.reference_day);
    assertNonNegativeInteger(output.today_count);
    assertNonNegativeInteger(output.next_7_days_count);
    assertNonNegativeInteger(output.overdue_count);
    if (!Array.isArray(output.items)) throw new AIServiceError('tool_query_failed');
    output.items.forEach((item) => {
      const entry = assertOutputRecord(item, ['title', 'type', 'status', 'start_at', 'overdue']);
      assertString(entry.title);
      assertString(entry.type);
      assertString(entry.status);
      assertString(entry.start_at);
      if (typeof entry.overdue !== 'boolean') throw new AIServiceError('tool_query_failed');
    });
    if (typeof output.truncated !== 'boolean') throw new AIServiceError('tool_query_failed');
    assertString(output.source);
    assertString(output.criteria);
    return output;
  },
  async execute({ securityContext, dataSource }) {
    const window = resolveAgendaWindow(securityContext.timezone, now());
    const result = await dataSource.getAgendaSummary(
      window.referenceIso,
      window.dayStartIso,
      window.dayEndIso,
      window.weekEndIso,
      this.maxResults,
    );
    const items = result.items.map((item: AgendaItemData) => ({
      title: item.title,
      type: item.type,
      status: item.status,
      start_at: item.startAt,
      overdue: item.overdue,
    }));
    const truncated = result.weekCount > items.length;
    return {
      output: this.validateOutput({
        reference_day: window.dayLabel,
        today_count: result.todayCount,
        next_7_days_count: result.weekCount,
        overdue_count: result.overdueCount,
        items,
        truncated,
        source: this.source,
        criteria: this.criteria,
      }),
      metadata: metadata({
        toolName: this.name,
        periodLabel: `Agenda de ${window.dayLabel} e próximos 7 dias`,
        periodStart: window.dayStartIso,
        periodEnd: window.weekEndIso,
        source: this.source,
        criteria: this.criteria,
        recordCount: items.length,
        truncated,
      }),
    };
  },
});

// ---------------------------------------------------------------------------
// Fornecedores
// ---------------------------------------------------------------------------

export const createListSuppliersTool = (
  now: () => Date,
): ReadOnlyToolDefinition<LimitInput> => ({
  name: 'list_suppliers',
  domain: 'suppliers',
  sensitivity: 'internal',
  description:
    'Lista os fornecedores cadastrados e quantos estão ativos. Use para "quais fornecedores eu tenho" ou "meus fornecedores ativos". Não retorna e-mail, telefone ou documento.',
  mode: 'read_only',
  allowedRoles: ALL_ROLES,
  maxResults: MAX_SUPPLIER_LIST,
  source: 'Cadastro de fornecedores do SobControle.',
  criteria: "Fornecedores da empresa, ativos primeiro (suppliers.status = 'active').",
  inputSchema: limitSchema(MAX_SUPPLIER_LIST),
  outputSchema: {
    type: 'object',
    properties: {
      as_of: { type: 'string' },
      items: { type: 'array', maxItems: MAX_SUPPLIER_LIST },
      active_count: { type: 'integer' },
      total_matches: { type: 'integer' },
      truncated: { type: 'boolean' },
      source: { type: 'string' },
      criteria: { type: 'string' },
    },
    required: [
      'as_of',
      'items',
      'active_count',
      'total_matches',
      'truncated',
      'source',
      'criteria',
    ],
    additionalProperties: false,
  },
  parseInput(value) {
    return parseLimitInput(value, this.maxResults);
  },
  validateOutput(value) {
    const output = assertOutputRecord(value, [
      'as_of',
      'items',
      'active_count',
      'total_matches',
      'truncated',
      'source',
      'criteria',
    ]);
    assertString(output.as_of);
    if (!Array.isArray(output.items)) throw new AIServiceError('tool_query_failed');
    output.items.forEach((item) => {
      const entry = assertOutputRecord(item, ['supplier', 'status']);
      assertString(entry.supplier);
      assertString(entry.status);
    });
    assertNonNegativeInteger(output.active_count);
    assertNonNegativeInteger(output.total_matches);
    if (typeof output.truncated !== 'boolean') throw new AIServiceError('tool_query_failed');
    assertString(output.source);
    assertString(output.criteria);
    return output;
  },
  async execute({ securityContext, dataSource }, input) {
    const effectiveLimit = Math.min(input.limit, this.maxResults);
    const result = await dataSource.listSuppliers(effectiveLimit);
    const timestamp = now();
    const items = result.items.map((item: SupplierData) => ({
      supplier: item.name,
      status: item.status,
    }));
    const truncated = result.totalMatches > items.length;
    return {
      output: this.validateOutput({
        as_of: timestamp.toISOString(),
        items,
        active_count: result.activeCount,
        total_matches: result.totalMatches,
        truncated,
        source: this.source,
        criteria: this.criteria,
      }),
      metadata: metadata({
        toolName: this.name,
        periodLabel: positionLabel(timestamp, securityContext.timezone),
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

// ---------------------------------------------------------------------------
// Compras
// ---------------------------------------------------------------------------

export const createPurchasesSummaryTool = (
  now: () => Date,
): ReadOnlyToolDefinition<PeriodInput> => ({
  name: 'get_purchases_summary',
  domain: 'purchases',
  sensitivity: 'internal',
  description:
    'Total comprado e compras pendentes em um período. Use para "quanto comprei este mês" ou "quais compras estão pendentes".',
  mode: 'read_only',
  allowedRoles: ALL_ROLES,
  maxResults: 1,
  source: 'Compras registradas no SobControle.',
  criteria:
    "purchases.status = 'paid' para comprado e 'pending' para pendente; purchases.created_at dentro do período.",
  inputSchema: PERIOD_INPUT_SCHEMA,
  outputSchema: {
    type: 'object',
    properties: {
      paid_total: { type: 'number' },
      paid_count: { type: 'integer' },
      pending_total: { type: 'number' },
      pending_count: { type: 'integer' },
      currency: { type: 'string' },
      period: PERIOD_OUTPUT_SCHEMA,
      source: { type: 'string' },
      criteria: { type: 'string' },
    },
    required: [
      'paid_total',
      'paid_count',
      'pending_total',
      'pending_count',
      'currency',
      'period',
      'source',
      'criteria',
    ],
    additionalProperties: false,
  },
  parseInput: parsePeriodInput,
  validateOutput(value) {
    const output = assertOutputRecord(value, [
      'paid_total',
      'paid_count',
      'pending_total',
      'pending_count',
      'currency',
      'period',
      'source',
      'criteria',
    ]);
    assertFiniteNumber(output.paid_total);
    assertNonNegativeInteger(output.paid_count);
    assertFiniteNumber(output.pending_total);
    assertNonNegativeInteger(output.pending_count);
    assertString(output.currency);
    assertPeriodOutput(output.period);
    assertString(output.source);
    assertString(output.criteria);
    return output;
  },
  async execute({ securityContext, dataSource }, input) {
    const period = resolvePeriod(
      input,
      securityContext.timezone,
      securityContext.limits.maxCustomPeriodDays,
      now(),
    );
    const result = await dataSource.getPurchasesSummary(period.startIso, period.endExclusiveIso);
    return {
      output: this.validateOutput({
        paid_total: result.paidTotal,
        paid_count: result.paidCount,
        pending_total: result.pendingTotal,
        pending_count: result.pendingCount,
        currency: securityContext.currency,
        period: periodOutput(period.startDate, period.endDate, period.label),
        source: this.source,
        criteria: this.criteria,
      }),
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

// ---------------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------------

export const createDocumentsSummaryTool = (
  now: () => Date,
): ReadOnlyToolDefinition<PeriodInput> => ({
  name: 'get_documents_summary',
  domain: 'documents',
  sensitivity: 'internal',
  description:
    'Quantidade de documentos ativos da empresa, quantos foram enviados no período e a distribuição por categoria. Não retorna nome de arquivo, conteúdo, link nem a quem o documento pertence.',
  mode: 'read_only',
  allowedRoles: ALL_ROLES,
  maxResults: 1,
  source: 'Biblioteca de documentos do SobControle.',
  criteria: "documents.status = 'active'; novo é created_at dentro do período.",
  inputSchema: PERIOD_INPUT_SCHEMA,
  outputSchema: {
    type: 'object',
    properties: {
      active_total: { type: 'integer' },
      new_in_period: { type: 'integer' },
      categories: { type: 'array' },
      period: PERIOD_OUTPUT_SCHEMA,
      source: { type: 'string' },
      criteria: { type: 'string' },
    },
    required: [
      'active_total',
      'new_in_period',
      'categories',
      'period',
      'source',
      'criteria',
    ],
    additionalProperties: false,
  },
  parseInput: parsePeriodInput,
  validateOutput(value) {
    const output = assertOutputRecord(value, [
      'active_total',
      'new_in_period',
      'categories',
      'period',
      'source',
      'criteria',
    ]);
    assertNonNegativeInteger(output.active_total);
    assertNonNegativeInteger(output.new_in_period);
    if (!Array.isArray(output.categories)) throw new AIServiceError('tool_query_failed');
    output.categories.forEach((entry) => {
      const category = assertOutputRecord(entry, ['category', 'documents']);
      assertString(category.category);
      assertNonNegativeInteger(category.documents);
    });
    assertPeriodOutput(output.period);
    assertString(output.source);
    assertString(output.criteria);
    return output;
  },
  async execute({ securityContext, dataSource }, input) {
    const period = resolvePeriod(
      input,
      securityContext.timezone,
      securityContext.limits.maxCustomPeriodDays,
      now(),
    );
    const result = await dataSource.getDocumentsSummary(period.startIso, period.endExclusiveIso);
    return {
      output: this.validateOutput({
        active_total: result.activeTotal,
        new_in_period: result.newInPeriod,
        categories: result.categories.map((entry: DocumentCategoryData) => ({
          category: entry.category,
          documents: entry.documents,
        })),
        period: periodOutput(period.startDate, period.endDate, period.label),
        source: this.source,
        criteria: this.criteria,
      }),
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

// ---------------------------------------------------------------------------
// Visão geral. Sem dado financeiro, para continuar liberada a todos os papéis.
// ---------------------------------------------------------------------------

export const createBusinessOverviewTool = (
  now: () => Date,
): ReadOnlyToolDefinition<PeriodInput> => ({
  name: 'get_business_overview',
  domain: 'overview',
  sensitivity: 'internal',
  description:
    'Panorama operacional da empresa no período: vendas pagas, funil aberto, compromissos atrasados, situação do estoque e clientes ativos. Use para "como está minha empresa", "resumo do dia" ou "o que precisa de atenção". Não inclui contas a pagar ou receber.',
  mode: 'read_only',
  allowedRoles: ALL_ROLES,
  maxResults: 1,
  source: 'Vendas, pipeline, agenda, estoque e clientes do SobControle.',
  criteria:
    "Vendas pagas no período; deals.status = 'open'; compromissos pendentes vencidos; produtos ativos; clientes com is_active = true.",
  inputSchema: PERIOD_INPUT_SCHEMA,
  outputSchema: {
    type: 'object',
    properties: {
      sales_total: { type: 'number' },
      sales_count: { type: 'integer' },
      open_deals: { type: 'integer' },
      open_deals_value: { type: 'number' },
      overdue_appointments: { type: 'integer' },
      active_products: { type: 'integer' },
      low_stock_products: { type: 'integer' },
      out_of_stock_products: { type: 'integer' },
      active_customers: { type: 'integer' },
      currency: { type: 'string' },
      period: PERIOD_OUTPUT_SCHEMA,
      source: { type: 'string' },
      criteria: { type: 'string' },
    },
    required: [
      'sales_total',
      'sales_count',
      'open_deals',
      'open_deals_value',
      'overdue_appointments',
      'active_products',
      'low_stock_products',
      'out_of_stock_products',
      'active_customers',
      'currency',
      'period',
      'source',
      'criteria',
    ],
    additionalProperties: false,
  },
  parseInput: parsePeriodInput,
  validateOutput(value) {
    const output = assertOutputRecord(value, [
      'sales_total',
      'sales_count',
      'open_deals',
      'open_deals_value',
      'overdue_appointments',
      'active_products',
      'low_stock_products',
      'out_of_stock_products',
      'active_customers',
      'currency',
      'period',
      'source',
      'criteria',
    ]);
    assertFiniteNumber(output.sales_total);
    assertNonNegativeInteger(output.sales_count);
    assertNonNegativeInteger(output.open_deals);
    assertFiniteNumber(output.open_deals_value);
    assertNonNegativeInteger(output.overdue_appointments);
    assertNonNegativeInteger(output.active_products);
    assertNonNegativeInteger(output.low_stock_products);
    assertNonNegativeInteger(output.out_of_stock_products);
    assertNonNegativeInteger(output.active_customers);
    assertString(output.currency);
    assertPeriodOutput(output.period);
    assertString(output.source);
    assertString(output.criteria);
    return output;
  },
  async execute({ securityContext, dataSource }, input) {
    const period = resolvePeriod(
      input,
      securityContext.timezone,
      securityContext.limits.maxCustomPeriodDays,
      now(),
    );
    const result = await dataSource.getBusinessOverview(
      period.startIso,
      period.endExclusiveIso,
      now().toISOString(),
    );
    return {
      output: this.validateOutput({
        sales_total: result.salesTotal,
        sales_count: result.salesCount,
        open_deals: result.openDeals,
        open_deals_value: result.openDealsValue,
        overdue_appointments: result.overdueAppointments,
        active_products: result.activeProducts,
        low_stock_products: result.lowStockProducts,
        out_of_stock_products: result.outOfStockProducts,
        active_customers: result.activeCustomers,
        currency: securityContext.currency,
        period: periodOutput(period.startDate, period.endDate, period.label),
        source: this.source,
        criteria: this.criteria,
      }),
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

// ---------------------------------------------------------------------------
// Financeiro consolidado
// ---------------------------------------------------------------------------

export const createFinancialOverviewTool = (
  now: () => Date,
): ReadOnlyToolDefinition<EmptyInput> => ({
  name: 'get_financial_overview',
  domain: 'financial',
  sensitivity: 'financial',
  description:
    'Totais a receber e a pagar, com o quanto já está vencido. Use para "quanto tenho a receber", "quanto tenho a pagar" ou "como está meu financeiro". Disponível somente para administradores e gerentes.',
  mode: 'read_only',
  allowedRoles: FINANCIAL_ROLES,
  maxResults: 1,
  source: 'Contas a receber e a pagar registradas no SobControle.',
  criteria:
    "status em ('pending', 'late'); vencido é due_date anterior ao instante da consulta.",
  inputSchema: EMPTY_INPUT_SCHEMA,
  outputSchema: {
    type: 'object',
    properties: {
      reference_at: { type: 'string' },
      receivable_pending_total: { type: 'number' },
      receivable_pending_count: { type: 'integer' },
      receivable_overdue_total: { type: 'number' },
      receivable_overdue_count: { type: 'integer' },
      payable_pending_total: { type: 'number' },
      payable_pending_count: { type: 'integer' },
      payable_overdue_total: { type: 'number' },
      payable_overdue_count: { type: 'integer' },
      currency: { type: 'string' },
      source: { type: 'string' },
      criteria: { type: 'string' },
    },
    required: [
      'reference_at',
      'receivable_pending_total',
      'receivable_pending_count',
      'receivable_overdue_total',
      'receivable_overdue_count',
      'payable_pending_total',
      'payable_pending_count',
      'payable_overdue_total',
      'payable_overdue_count',
      'currency',
      'source',
      'criteria',
    ],
    additionalProperties: false,
  },
  parseInput: parseEmptyInput,
  validateOutput(value) {
    const output = assertOutputRecord(value, [
      'reference_at',
      'receivable_pending_total',
      'receivable_pending_count',
      'receivable_overdue_total',
      'receivable_overdue_count',
      'payable_pending_total',
      'payable_pending_count',
      'payable_overdue_total',
      'payable_overdue_count',
      'currency',
      'source',
      'criteria',
    ]);
    assertString(output.reference_at);
    assertFiniteNumber(output.receivable_pending_total);
    assertNonNegativeInteger(output.receivable_pending_count);
    assertFiniteNumber(output.receivable_overdue_total);
    assertNonNegativeInteger(output.receivable_overdue_count);
    assertFiniteNumber(output.payable_pending_total);
    assertNonNegativeInteger(output.payable_pending_count);
    assertFiniteNumber(output.payable_overdue_total);
    assertNonNegativeInteger(output.payable_overdue_count);
    assertString(output.currency);
    assertString(output.source);
    assertString(output.criteria);
    return output;
  },
  async execute({ securityContext, dataSource }) {
    if (!this.allowedRoles.includes(securityContext.role)) {
      throw new AIServiceError('financial_permission_denied');
    }
    const timestamp = now();
    const result = await dataSource.getFinancialOverview(timestamp.toISOString());
    return {
      output: this.validateOutput({
        reference_at: timestamp.toISOString(),
        receivable_pending_total: result.receivablePendingTotal,
        receivable_pending_count: result.receivablePendingCount,
        receivable_overdue_total: result.receivableOverdueTotal,
        receivable_overdue_count: result.receivableOverdueCount,
        payable_pending_total: result.payablePendingTotal,
        payable_pending_count: result.payablePendingCount,
        payable_overdue_total: result.payableOverdueTotal,
        payable_overdue_count: result.payableOverdueCount,
        currency: securityContext.currency,
        source: this.source,
        criteria: this.criteria,
      }),
      metadata: metadata({
        toolName: this.name,
        periodLabel: positionLabel(timestamp, securityContext.timezone),
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

// ---------------------------------------------------------------------------
// Ajuda sobre o sistema. Conteúdo estático aprovado, sem tocar no banco.
// ---------------------------------------------------------------------------

const HELP_TOPICS: Record<string, string> = {
  vendas:
    'Para registrar uma venda, abra Vendas no menu lateral e use o botão de nova venda. Você escolhe o cliente, adiciona os produtos e define a forma e o status de pagamento.',
  clientes:
    'Clientes ficam no menu Clientes. O botão de novo cliente abre o cadastro com nome, documento, contato e endereço.',
  estoque:
    'Produtos e saldos ficam em Estoque. Cada produto tem quantidade atual, mínima e máxima; a lista de recomendações fica em Estoque e depois Recomendações.',
  fornecedores:
    'Fornecedores ficam no menu Fornecedores, com cadastro de nome, contato e situação.',
  compras:
    'Compras ficam no menu Compras e são restritas a administradores e gerentes. Cada pedido pode gerar uma conta a pagar.',
  financeiro:
    'O módulo Financeiro reúne contas a pagar e a receber e é restrito a administradores e gerentes.',
  relatorios:
    'Os relatórios ficam em Relatórios, divididos por visão geral, vendas, clientes, financeiro e estoque, conforme os módulos contratados.',
  agenda:
    'Compromissos e tarefas ficam na Agenda, com tipos como reunião, tarefa, ligação, visita e lembrete.',
  documentos:
    'A biblioteca de documentos fica em Documentos, onde é possível enviar arquivos e organizá-los por categoria.',
  empresa:
    'Dados da empresa ficam em Empresa e as preferências em Configurações. Ambos são restritos a administradores e gerentes.',
};

export const createSystemHelpTool = (
  now: () => Date,
): ReadOnlyToolDefinition<{ topic: string }> => ({
  name: 'get_system_help',
  domain: 'help',
  sensitivity: 'public',
  description:
    'Explica como usar uma área do SobControle (onde fica, para que serve, quem tem acesso). Use para perguntas do tipo "como cadastro uma venda" ou "onde vejo o relatório financeiro". Não consulta dados da empresa.',
  mode: 'read_only',
  allowedRoles: ALL_ROLES,
  maxResults: 1,
  source: 'Documentação interna do SobControle.',
  criteria: 'Conteúdo de ajuda aprovado, sem consulta a dados da empresa.',
  inputSchema: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        enum: Object.keys(HELP_TOPICS),
        description: 'Área do sistema sobre a qual o usuário pediu ajuda.',
      },
    },
    required: ['topic'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      topic: { type: 'string' },
      guidance: { type: 'string' },
      source: { type: 'string' },
      criteria: { type: 'string' },
    },
    required: ['topic', 'guidance', 'source', 'criteria'],
    additionalProperties: false,
  },
  parseInput(value) {
    if (!isRecord(value) || !hasExactKeys(value, ['topic'])) {
      throw new AIServiceError('invalid_tool_arguments');
    }
    if (typeof value.topic !== 'string' || !(value.topic in HELP_TOPICS)) {
      throw new AIServiceError('invalid_tool_arguments');
    }
    return { topic: value.topic };
  },
  validateOutput(value) {
    const output = assertOutputRecord(value, ['topic', 'guidance', 'source', 'criteria']);
    assertString(output.topic);
    assertString(output.guidance);
    assertString(output.source);
    assertString(output.criteria);
    return output;
  },
  execute({ securityContext }, input) {
    const timestamp = now();
    return Promise.resolve({
      output: this.validateOutput({
        topic: input.topic,
        guidance: HELP_TOPICS[input.topic],
        source: this.source,
        criteria: this.criteria,
      }),
      metadata: metadata({
        toolName: this.name,
        periodLabel: positionLabel(timestamp, securityContext.timezone),
        periodStart: timestamp.toISOString(),
        periodEnd: timestamp.toISOString(),
        source: this.source,
        criteria: this.criteria,
        recordCount: 1,
        truncated: false,
      }),
    });
  },
});

export const createDomainToolDefinitions = (now: () => Date = () => new Date()) =>
  [
    createListInventoryProductsTool(now),
    createPipelineSummaryTool(now),
    createAgendaSummaryTool(now),
    createListSuppliersTool(now),
    createPurchasesSummaryTool(now),
    createDocumentsSummaryTool(now),
    createBusinessOverviewTool(now),
    createFinancialOverviewTool(now),
    createSystemHelpTool(now),
  ] as const;
