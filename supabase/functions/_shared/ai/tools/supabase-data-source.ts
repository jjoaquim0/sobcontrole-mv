import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { AIServiceError } from '../errors.ts';
import type {
  AgendaItemData,
  AgendaSummaryData,
  BusinessOverviewData,
  CustomersSummaryData,
  DocumentCategoryData,
  DocumentsSummaryData,
  FinancialOverviewData,
  GestlyToolDataSource,
  InventorySummaryData,
  PipelineStageData,
  PipelineSummaryData,
  PurchasesSummaryData,
  SupplierData,
  SuppliersResultData,
  LowStockProductData,
  LowStockResultData,
  OverdueFinancialItemData,
  OverdueFinancialResultData,
  ProductStockData,
  ProductStockResultData,
  SalesSummaryData,
} from './types.ts';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const finiteNumber = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) throw new AIServiceError('tool_query_failed');
  return parsed;
};

const nonNegativeInteger = (value: unknown): number => {
  const parsed = finiteNumber(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new AIServiceError('tool_query_failed');
  return parsed;
};

const nullableFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  return finiteNumber(value);
};

const nonEmptyString = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) throw new AIServiceError('tool_query_failed');
  return value;
};

const firstRow = (value: unknown): Record<string, unknown> => {
  if (!Array.isArray(value) || value.length !== 1 || !isRecord(value[0])) {
    throw new AIServiceError('tool_query_failed');
  }
  return value[0];
};

const parseLowStockItem = (value: unknown): LowStockProductData => {
  if (!isRecord(value)) throw new AIServiceError('tool_query_failed');
  const stockStatus = value.stock_status;
  if (stockStatus !== 'out_of_stock' && stockStatus !== 'low_stock') {
    throw new AIServiceError('tool_query_failed');
  }
  return {
    productName: nonEmptyString(value.product_name),
    sku: nonEmptyString(value.sku),
    currentStock: finiteNumber(value.current_stock),
    minimumStock: finiteNumber(value.minimum_stock),
    shortage: finiteNumber(value.shortage),
    stockStatus,
  };
};

const parseProductStockItem = (value: unknown): ProductStockData => {
  if (!isRecord(value)) throw new AIServiceError('tool_query_failed');
  const stockStatus = value.stock_status;
  if (
    stockStatus !== 'out_of_stock' &&
    stockStatus !== 'low_stock' &&
    stockStatus !== 'in_stock'
  ) {
    throw new AIServiceError('tool_query_failed');
  }
  return {
    productName: nonEmptyString(value.product_name),
    sku: nonEmptyString(value.sku),
    unit: nonEmptyString(value.unit),
    currentStock: finiteNumber(value.current_stock),
    minimumStock: finiteNumber(value.minimum_stock),
    stockStatus,
  };
};

const parseFinancialItem = (value: unknown): OverdueFinancialItemData => {
  if (!isRecord(value)) throw new AIServiceError('tool_query_failed');
  const itemType = value.item_type;
  if (itemType !== 'receivable' && itemType !== 'payable') {
    throw new AIServiceError('tool_query_failed');
  }
  return {
    itemType,
    amount: finiteNumber(value.amount),
    dueDate: nonEmptyString(value.due_date),
    daysOverdue: nonNegativeInteger(value.days_overdue),
  };
};

export class SupabaseGestlyToolDataSource implements GestlyToolDataSource {
  constructor(private readonly client: SupabaseClient) {}

  async getSalesSummary(periodStart: string, periodEnd: string): Promise<SalesSummaryData> {
    const { data, error } = await this.client.rpc('gestly_sales_summary', {
      p_period_start: periodStart,
      p_period_end: periodEnd,
    });
    if (error) throw new AIServiceError('tool_query_failed');
    const row = firstRow(data);
    return {
      totalSold: finiteNumber(row.total_sold),
      salesCount: nonNegativeInteger(row.sales_count),
      averageTicket: nullableFiniteNumber(row.average_ticket),
    };
  }

  async getCustomersSummary(
    periodStart: string,
    periodEnd: string,
  ): Promise<CustomersSummaryData> {
    const { data, error } = await this.client.rpc('gestly_customers_summary', {
      p_period_start: periodStart,
      p_period_end: periodEnd,
    });
    if (error) throw new AIServiceError('tool_query_failed');
    const row = firstRow(data);
    return {
      activeCustomers: nonNegativeInteger(row.active_customers),
      newCustomers: nonNegativeInteger(row.new_customers),
    };
  }

  async getLowStockProducts(limit: number): Promise<LowStockResultData> {
    const { data, error } = await this.client.rpc('gestly_low_stock_products', {
      p_limit: limit,
    });
    if (error || !Array.isArray(data)) throw new AIServiceError('tool_query_failed');
    const rows = data.filter(isRecord);
    if (rows.length !== data.length) throw new AIServiceError('tool_query_failed');
    return {
      items: rows.map(parseLowStockItem),
      totalMatches: rows.length === 0 ? 0 : nonNegativeInteger(rows[0].total_matches),
    };
  }

  async getInventorySummary(): Promise<InventorySummaryData> {
    const { data, error } = await this.client.rpc('gestly_inventory_summary', {});
    if (error) throw new AIServiceError('tool_query_failed');
    const row = firstRow(data);
    return {
      activeProducts: nonNegativeInteger(row.active_products),
      totalUnits: finiteNumber(row.total_units),
      outOfStockCount: nonNegativeInteger(row.out_of_stock_count),
      lowStockCount: nonNegativeInteger(row.low_stock_count),
      healthyCount: nonNegativeInteger(row.healthy_count),
    };
  }

  async getProductStock(query: string, limit: number): Promise<ProductStockResultData> {
    const { data, error } = await this.client.rpc('gestly_product_stock', {
      p_search: query,
      p_limit: limit,
    });
    if (error || !Array.isArray(data)) throw new AIServiceError('tool_query_failed');
    const rows = data.filter(isRecord);
    if (rows.length !== data.length) throw new AIServiceError('tool_query_failed');
    return {
      items: rows.map(parseProductStockItem),
      totalMatches: rows.length === 0 ? 0 : nonNegativeInteger(rows[0].total_matches),
    };
  }

  async listInventoryProducts(limit: number): Promise<ProductStockResultData> {
    const { data, error } = await this.client.rpc('gestly_list_inventory_products', {
      p_limit: limit,
    });
    if (error || !Array.isArray(data)) throw new AIServiceError('tool_query_failed');
    const rows = data.filter(isRecord);
    if (rows.length !== data.length) throw new AIServiceError('tool_query_failed');
    return {
      items: rows.map(parseProductStockItem),
      totalMatches: rows.length === 0 ? 0 : nonNegativeInteger(rows[0].total_matches),
    };
  }

  async getPipelineSummary(): Promise<PipelineSummaryData> {
    const { data, error } = await this.client.rpc('gestly_pipeline_summary', {});
    if (error) throw new AIServiceError('tool_query_failed');
    const row = firstRow(data);
    if (!Array.isArray(row.stages)) throw new AIServiceError('tool_query_failed');
    return {
      openCount: nonNegativeInteger(row.open_count),
      openValue: finiteNumber(row.open_value),
      wonCount: nonNegativeInteger(row.won_count),
      wonValue: finiteNumber(row.won_value),
      lostCount: nonNegativeInteger(row.lost_count),
      stages: row.stages.map((stage): PipelineStageData => {
        if (!isRecord(stage)) throw new AIServiceError('tool_query_failed');
        return {
          stage: nonEmptyString(stage.stage),
          openDeals: nonNegativeInteger(stage.open_deals),
          openValue: finiteNumber(stage.open_value),
        };
      }),
    };
  }

  async getAgendaSummary(
    reference: string,
    dayStart: string,
    dayEnd: string,
    weekEnd: string,
    limit: number,
  ): Promise<AgendaSummaryData> {
    const { data, error } = await this.client.rpc('gestly_agenda_summary', {
      p_reference: reference,
      p_day_start: dayStart,
      p_day_end: dayEnd,
      p_week_end: weekEnd,
      p_limit: limit,
    });
    if (error) throw new AIServiceError('tool_query_failed');
    const row = firstRow(data);
    if (!Array.isArray(row.items)) throw new AIServiceError('tool_query_failed');
    return {
      todayCount: nonNegativeInteger(row.today_count),
      weekCount: nonNegativeInteger(row.week_count),
      overdueCount: nonNegativeInteger(row.overdue_count),
      items: row.items.map((item): AgendaItemData => {
        if (!isRecord(item)) throw new AIServiceError('tool_query_failed');
        if (typeof item.overdue !== 'boolean') throw new AIServiceError('tool_query_failed');
        return {
          title: nonEmptyString(item.title),
          type: nonEmptyString(item.type),
          status: nonEmptyString(item.status),
          startAt: nonEmptyString(item.start_at),
          overdue: item.overdue,
        };
      }),
    };
  }

  async listSuppliers(limit: number): Promise<SuppliersResultData> {
    const { data, error } = await this.client.rpc('gestly_list_suppliers', {
      p_limit: limit,
    });
    if (error || !Array.isArray(data)) throw new AIServiceError('tool_query_failed');
    const rows = data.filter(isRecord);
    if (rows.length !== data.length) throw new AIServiceError('tool_query_failed');
    return {
      items: rows.map((row): SupplierData => ({
        name: nonEmptyString(row.supplier_name),
        status: nonEmptyString(row.supplier_status),
      })),
      activeCount: rows.length === 0 ? 0 : nonNegativeInteger(rows[0].active_count),
      totalMatches: rows.length === 0 ? 0 : nonNegativeInteger(rows[0].total_matches),
    };
  }

  async getPurchasesSummary(
    periodStart: string,
    periodEnd: string,
  ): Promise<PurchasesSummaryData> {
    const { data, error } = await this.client.rpc('gestly_purchases_summary', {
      p_period_start: periodStart,
      p_period_end: periodEnd,
    });
    if (error) throw new AIServiceError('tool_query_failed');
    const row = firstRow(data);
    return {
      paidTotal: finiteNumber(row.paid_total),
      paidCount: nonNegativeInteger(row.paid_count),
      pendingTotal: finiteNumber(row.pending_total),
      pendingCount: nonNegativeInteger(row.pending_count),
    };
  }

  async getDocumentsSummary(
    periodStart: string,
    periodEnd: string,
  ): Promise<DocumentsSummaryData> {
    const { data, error } = await this.client.rpc('gestly_documents_summary', {
      p_period_start: periodStart,
      p_period_end: periodEnd,
    });
    if (error) throw new AIServiceError('tool_query_failed');
    const row = firstRow(data);
    if (!Array.isArray(row.categories)) throw new AIServiceError('tool_query_failed');
    return {
      activeTotal: nonNegativeInteger(row.active_total),
      newInPeriod: nonNegativeInteger(row.new_in_period),
      categories: row.categories.map((entry): DocumentCategoryData => {
        if (!isRecord(entry)) throw new AIServiceError('tool_query_failed');
        return {
          category: nonEmptyString(entry.category),
          documents: nonNegativeInteger(entry.documents),
        };
      }),
    };
  }

  async getBusinessOverview(
    periodStart: string,
    periodEnd: string,
    reference: string,
  ): Promise<BusinessOverviewData> {
    const { data, error } = await this.client.rpc('gestly_business_overview', {
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_reference: reference,
    });
    if (error) throw new AIServiceError('tool_query_failed');
    const row = firstRow(data);
    return {
      salesTotal: finiteNumber(row.sales_total),
      salesCount: nonNegativeInteger(row.sales_count),
      openDeals: nonNegativeInteger(row.open_deals),
      openDealsValue: finiteNumber(row.open_deals_value),
      overdueAppointments: nonNegativeInteger(row.overdue_appointments),
      activeProducts: nonNegativeInteger(row.active_products),
      lowStockProducts: nonNegativeInteger(row.low_stock_products),
      outOfStockProducts: nonNegativeInteger(row.out_of_stock_products),
      activeCustomers: nonNegativeInteger(row.active_customers),
    };
  }

  async getFinancialOverview(reference: string): Promise<FinancialOverviewData> {
    const { data, error } = await this.client.rpc('gestly_financial_overview', {
      p_reference: reference,
    });
    if (error) throw new AIServiceError('tool_query_failed');
    const row = firstRow(data);
    return {
      receivablePendingTotal: finiteNumber(row.receivable_pending_total),
      receivablePendingCount: nonNegativeInteger(row.receivable_pending_count),
      receivableOverdueTotal: finiteNumber(row.receivable_overdue_total),
      receivableOverdueCount: nonNegativeInteger(row.receivable_overdue_count),
      payablePendingTotal: finiteNumber(row.payable_pending_total),
      payablePendingCount: nonNegativeInteger(row.payable_pending_count),
      payableOverdueTotal: finiteNumber(row.payable_overdue_total),
      payableOverdueCount: nonNegativeInteger(row.payable_overdue_count),
    };
  }

  async getOverdueFinancialItems(
    itemType: 'receivable' | 'payable' | 'both',
    limit: number,
    referenceAt: string,
  ): Promise<OverdueFinancialResultData> {
    const { data, error } = await this.client.rpc('gestly_overdue_financial_items', {
      p_item_type: itemType,
      p_limit: limit,
      p_reference_at: referenceAt,
    });
    if (error) throw new AIServiceError('tool_query_failed');
    const row = firstRow(data);
    if (!Array.isArray(row.items)) throw new AIServiceError('tool_query_failed');
    return {
      referenceAt: nonEmptyString(row.reference_at),
      receivableTotal: finiteNumber(row.receivable_total),
      receivableCount: nonNegativeInteger(row.receivable_count),
      payableTotal: finiteNumber(row.payable_total),
      payableCount: nonNegativeInteger(row.payable_count),
      combinedTotal: finiteNumber(row.combined_total),
      combinedCount: nonNegativeInteger(row.combined_count),
      totalMatches: nonNegativeInteger(row.total_matches),
      items: row.items.map(parseFinancialItem),
    };
  }
}

