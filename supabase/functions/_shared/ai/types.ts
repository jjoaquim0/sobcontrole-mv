export type AIChatRole = 'assistant' | 'user';

export interface AIChatMessage {
  role: AIChatRole;
  content: string;
}

export interface AIProviderUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface AIProviderRequest {
  messages: AIChatMessage[];
  model: string;
  maxOutputTokens: number;
  timeoutMs: number;
  instructions: string;
  safetyIdentifier: string;
  tools?: AIProviderToolDefinition[];
  toolChoice?: 'auto' | 'none';
  parallelToolCalls?: false;
  continuation?: AIProviderContinuation;
  toolOutputs?: AIProviderToolOutput[];
}

export interface AIProviderToolDefinition {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict: true;
}

export interface AIProviderToolCall {
  callId: string;
  name: string;
  arguments: string;
}

export interface AIProviderToolOutput {
  callId: string;
  output: string;
}

export interface AIProviderContinuation {
  provider: string;
  data: unknown;
}

export interface AIProviderResult {
  content?: string;
  provider: string;
  model: string;
  usage: AIProviderUsage;
  toolCalls: AIProviderToolCall[];
  continuation?: AIProviderContinuation;
}

export interface AIProvider {
  readonly name: string;
  generate(request: AIProviderRequest): Promise<AIProviderResult>;
}

export type SafeErrorCode =
  | 'unauthorized'
  | 'company_not_found'
  | 'permission_denied'
  | 'global_disabled'
  | 'company_disabled'
  | 'configuration_error'
  | 'user_request_limit'
  | 'company_request_limit'
  | 'company_token_limit'
  | 'company_cost_limit'
  | 'usage_limit_exceeded'
  | 'provider_unavailable'
  | 'rate_limited'
  | 'timeout'
  | 'invalid_request'
  | 'financial_permission_denied'
  | 'invalid_tool_arguments'
  | 'tool_unavailable'
  | 'tool_query_failed'
  | 'internal_error';

export interface UsageReservation {
  allowed: boolean;
  decisionCode: SafeErrorCode | 'allowed';
  companyId?: string;
  userId: string;
  provider?: string;
  model?: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

export interface ReserveUsageInput {
  requestId: string;
  userId: string;
  estimatedInputTokens: number;
}

export interface FinalizeUsageInput {
  requestId: string;
  status: 'succeeded' | 'failed';
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  errorCode?: SafeErrorCode;
}

export interface AIUsageRepository {
  reserve(input: ReserveUsageInput): Promise<UsageReservation>;
  finalize(input: FinalizeUsageInput): Promise<boolean>;
}

export interface AuthenticatedUser {
  userId: string;
  accessToken?: string;
}

export type AIAuthenticator = (authorization: string) => Promise<AuthenticatedUser | null>;

export type SecurityRole = 'admin' | 'manager' | 'employee';

export interface SecurityContext {
  userId: string;
  companyId: string;
  role: SecurityRole;
  requestId: string;
  timezone: string;
  currency: string;
  limits: {
    maxCustomPeriodDays: number;
    maxLowStockResults: number;
    maxFinancialResults: number;
    maxToolCalls: number;
  };
}

export interface ToolResponseMetadata {
  toolName:
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
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  source: string;
  criteria: string;
  recordCount: number;
  truncated: boolean;
}

export interface ToolAuditInput {
  requestId: string;
  companyId: string;
  userId: string;
  toolName: ToolResponseMetadata['toolName'] | 'unknown';
  periodStart?: string;
  periodEnd?: string;
  recordCount: number;
  truncated: boolean;
}

export interface ToolAuditRepository {
  record(input: ToolAuditInput): Promise<boolean>;
}

export type SafeLogEvent =
  | {
      event: 'request_started';
      requestId: string;
    }
  | {
      event: 'request_blocked';
      requestId: string;
      userId?: string;
      companyId?: string;
      code: SafeErrorCode;
      durationMs: number;
    }
  | {
      event: 'provider_selected';
      requestId: string;
      userId: string;
      companyId: string;
      provider: string;
      model: string;
    }
  | {
      event: 'request_succeeded';
      requestId: string;
      userId: string;
      companyId: string;
      provider: string;
      model: string;
      durationMs: number;
      inputTokens?: number;
      outputTokens?: number;
    }
  | {
      event: 'tool_executed';
      requestId: string;
      userId: string;
      companyId: string;
      toolName: ToolResponseMetadata['toolName'];
      periodStart: string;
      periodEnd: string;
      recordCount: number;
      truncated: boolean;
      durationMs: number;
    }
  | {
      event: 'request_failed';
      requestId: string;
      userId?: string;
      companyId?: string;
      code: SafeErrorCode;
      durationMs: number;
    };

export type SafeLogger = (event: SafeLogEvent) => void;
