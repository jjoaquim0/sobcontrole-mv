import type {
  AIProviderToolDefinition,
  AuthenticatedUser,
  SecurityContext,
  SecurityRole,
  ToolResponseMetadata,
} from '../types.ts';

export type GestlyToolName =
  | 'get_sales_summary'
  | 'get_customers_summary'
  | 'get_low_stock_products'
  | 'get_inventory_summary'
  | 'get_product_stock'
  | 'list_inventory_products'
  | 'get_pipeline_summary'
  | 'get_agenda_summary'
  | 'list_suppliers'
  | 'get_purchases_summary'
  | 'get_documents_summary'
  | 'get_business_overview'
  | 'get_financial_overview'
  | 'get_overdue_financial_items'
  | 'get_system_help';

/** Domínio funcional do SobControle ao qual a ferramenta pertence. */
export type GestlyToolDomain =
  | 'overview'
  | 'sales'
  | 'pipeline'
  | 'customers'
  | 'agenda'
  | 'inventory'
  | 'suppliers'
  | 'purchases'
  | 'financial'
  | 'documents'
  | 'help';

/**
 * Sensibilidade do dado retornado. `financial` exige papel autorizado;
 * `internal` são números operacionais da própria empresa; `public` não toca
 * em dados da empresa (ajuda sobre o sistema).
 */
export type GestlyToolSensitivity = 'public' | 'internal' | 'financial';

export interface SalesSummaryData {
  totalSold: number;
  salesCount: number;
  averageTicket: number | null;
}

export interface CustomersSummaryData {
  activeCustomers: number;
  newCustomers: number;
}

export interface LowStockProductData {
  productName: string;
  sku: string;
  currentStock: number;
  minimumStock: number;
  shortage: number;
  stockStatus: 'out_of_stock' | 'low_stock';
}

export interface LowStockResultData {
  items: LowStockProductData[];
  totalMatches: number;
}

export interface InventorySummaryData {
  activeProducts: number;
  totalUnits: number;
  outOfStockCount: number;
  lowStockCount: number;
  healthyCount: number;
}

export interface ProductStockData {
  productName: string;
  sku: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  stockStatus: 'out_of_stock' | 'low_stock' | 'in_stock';
}

export interface ProductStockResultData {
  items: ProductStockData[];
  totalMatches: number;
}

export interface OverdueFinancialItemData {
  itemType: 'receivable' | 'payable';
  amount: number;
  dueDate: string;
  daysOverdue: number;
}

export interface OverdueFinancialResultData {
  referenceAt: string;
  receivableTotal: number;
  receivableCount: number;
  payableTotal: number;
  payableCount: number;
  combinedTotal: number;
  combinedCount: number;
  totalMatches: number;
  items: OverdueFinancialItemData[];
}

export interface PipelineStageData {
  stage: string;
  openDeals: number;
  openValue: number;
}

export interface PipelineSummaryData {
  openCount: number;
  openValue: number;
  wonCount: number;
  wonValue: number;
  lostCount: number;
  stages: PipelineStageData[];
}

export interface AgendaItemData {
  title: string;
  type: string;
  status: string;
  startAt: string;
  overdue: boolean;
}

export interface AgendaSummaryData {
  todayCount: number;
  weekCount: number;
  overdueCount: number;
  items: AgendaItemData[];
}

export interface SupplierData {
  name: string;
  status: string;
}

export interface SuppliersResultData {
  items: SupplierData[];
  activeCount: number;
  totalMatches: number;
}

export interface PurchasesSummaryData {
  paidTotal: number;
  paidCount: number;
  pendingTotal: number;
  pendingCount: number;
}

export interface DocumentCategoryData {
  category: string;
  documents: number;
}

export interface DocumentsSummaryData {
  activeTotal: number;
  newInPeriod: number;
  categories: DocumentCategoryData[];
}

export interface BusinessOverviewData {
  salesTotal: number;
  salesCount: number;
  openDeals: number;
  openDealsValue: number;
  overdueAppointments: number;
  activeProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  activeCustomers: number;
}

export interface FinancialOverviewData {
  receivablePendingTotal: number;
  receivablePendingCount: number;
  receivableOverdueTotal: number;
  receivableOverdueCount: number;
  payablePendingTotal: number;
  payablePendingCount: number;
  payableOverdueTotal: number;
  payableOverdueCount: number;
}

export interface GestlyToolDataSource {
  getSalesSummary(periodStart: string, periodEnd: string): Promise<SalesSummaryData>;
  getCustomersSummary(periodStart: string, periodEnd: string): Promise<CustomersSummaryData>;
  getLowStockProducts(limit: number): Promise<LowStockResultData>;
  getInventorySummary(): Promise<InventorySummaryData>;
  getProductStock(query: string, limit: number): Promise<ProductStockResultData>;
  listInventoryProducts(limit: number): Promise<ProductStockResultData>;
  getPipelineSummary(): Promise<PipelineSummaryData>;
  getAgendaSummary(
    reference: string,
    dayStart: string,
    dayEnd: string,
    weekEnd: string,
    limit: number,
  ): Promise<AgendaSummaryData>;
  listSuppliers(limit: number): Promise<SuppliersResultData>;
  getPurchasesSummary(periodStart: string, periodEnd: string): Promise<PurchasesSummaryData>;
  getDocumentsSummary(periodStart: string, periodEnd: string): Promise<DocumentsSummaryData>;
  getBusinessOverview(
    periodStart: string,
    periodEnd: string,
    reference: string,
  ): Promise<BusinessOverviewData>;
  getFinancialOverview(reference: string): Promise<FinancialOverviewData>;
  getOverdueFinancialItems(
    itemType: 'receivable' | 'payable' | 'both',
    limit: number,
    referenceAt: string,
  ): Promise<OverdueFinancialResultData>;
}

export interface ToolExecutionEnvironment {
  securityContext: SecurityContext;
  dataSource: GestlyToolDataSource;
}

export interface ToolExecutionResult {
  output: Record<string, unknown>;
  metadata: ToolResponseMetadata;
}

export interface ReadOnlyToolDefinition<Input> {
  name: GestlyToolName;
  domain: GestlyToolDomain;
  sensitivity: GestlyToolSensitivity;
  description: string;
  mode: 'read_only';
  allowedRoles: readonly SecurityRole[];
  maxResults: number;
  source: string;
  criteria: string;
  inputSchema: AIProviderToolDefinition['parameters'];
  outputSchema: Record<string, unknown>;
  parseInput(value: unknown): Input;
  validateOutput(value: unknown): Record<string, unknown>;
  execute(environment: ToolExecutionEnvironment, input: Input): Promise<ToolExecutionResult>;
}

export interface AnyReadOnlyToolDefinition {
  name: GestlyToolName;
  domain: GestlyToolDomain;
  sensitivity: GestlyToolSensitivity;
  description: string;
  mode: 'read_only';
  allowedRoles: readonly SecurityRole[];
  maxResults: number;
  source: string;
  criteria: string;
  inputSchema: AIProviderToolDefinition['parameters'];
  outputSchema: Record<string, unknown>;
  parseInput(value: unknown): unknown;
  validateOutput(value: unknown): Record<string, unknown>;
  execute(environment: ToolExecutionEnvironment, input: unknown): Promise<ToolExecutionResult>;
}

export interface ResolvedSecurityContext {
  securityContext: SecurityContext;
  dataSource: GestlyToolDataSource;
}

export type SecurityContextResolver = (
  user: AuthenticatedUser,
  requestId: string,
) => Promise<ResolvedSecurityContext>;
