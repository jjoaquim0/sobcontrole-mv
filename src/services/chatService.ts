import { supabase } from '@/lib/supabase';

export type ChatMessageRole = 'assistant' | 'user';

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

export interface ChatDataContext {
  toolName: GestlyToolName;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  source: string;
  criteria: string;
  recordCount: number;
  truncated: boolean;
}

export interface ChatMessage {
  role: ChatMessageRole;
  content: string;
  dataContexts?: ChatDataContext[];
}

interface ChatFunctionResponseDataContext {
  tool_name?: unknown;
  period_label?: unknown;
  period_start?: unknown;
  period_end?: unknown;
  source?: unknown;
  criteria?: unknown;
  record_count?: unknown;
  truncated?: unknown;
}

interface ChatFunctionResponse {
  message?: {
    role?: unknown;
    content?: unknown;
  };
  data_contexts?: ChatFunctionResponseDataContext[];
  error?: {
    code?: string;
    message?: string;
  };
  request_id?: string;
}

const SAFE_ERROR_MESSAGES: Record<string, string> = {
  unauthorized: 'Autenticação necessária.',
  company_not_found: 'Não foi possível validar sua empresa.',
  permission_denied: 'Você não tem permissão para usar a assistente de IA.',
  global_disabled: 'A assistente de IA está temporariamente indisponível.',
  company_disabled: 'O uso da assistente de IA está desativado para esta empresa.',
  usage_limit_exceeded:
    'O limite de uso da IA foi atingido. Tente novamente mais tarde ou fale com o administrador da empresa.',
  invalid_request: 'Envie uma mensagem válida.',
  rate_limited: 'A assistente está temporariamente ocupada. Tente novamente em instantes.',
  configuration_error: 'Não foi possível conversar com a Gestly agora. Tente novamente.',
  financial_permission_denied:
    'Somente administradores e gerentes podem consultar informações financeiras.',
  invalid_tool_arguments: 'Não foi possível interpretar os filtros da consulta.',
  tool_unavailable:
    'Essa consulta ainda não está disponível. Posso consultar vendas, clientes, estoque baixo ou contas vencidas.',
  tool_query_failed: 'Não foi possível consultar os dados agora. Tente novamente.',
  internal_error: 'Não foi possível conversar com a Gestly agora. Tente novamente.',
};

const DEFAULT_ERROR_MESSAGE = 'Não foi possível conversar com a Gestly agora. Tente novamente.';

const safeMessageForCode = (code: unknown): string | null =>
  typeof code === 'string' ? SAFE_ERROR_MESSAGES[code] ?? null : null;

const TOOL_NAMES = new Set<GestlyToolName>([
  'get_sales_summary',
  'get_customers_summary',
  'get_low_stock_products',
  'get_inventory_summary',
  'get_product_stock',
  'list_inventory_products',
  'get_pipeline_summary',
  'get_agenda_summary',
  'list_suppliers',
  'get_purchases_summary',
  'get_documents_summary',
  'get_business_overview',
  'get_financial_overview',
  'get_overdue_financial_items',
  'get_system_help',
]);

const parseDataContext = (
  value: ChatFunctionResponseDataContext,
): ChatDataContext | undefined => {
  if (
    typeof value.tool_name !== 'string' ||
    !TOOL_NAMES.has(value.tool_name as GestlyToolName) ||
    typeof value.period_label !== 'string' ||
    typeof value.period_start !== 'string' ||
    typeof value.period_end !== 'string' ||
    typeof value.source !== 'string' ||
    typeof value.criteria !== 'string' ||
    typeof value.record_count !== 'number' ||
    !Number.isInteger(value.record_count) ||
    value.record_count < 0 ||
    typeof value.truncated !== 'boolean'
  ) {
    return undefined;
  }
  return {
    toolName: value.tool_name as GestlyToolName,
    periodLabel: value.period_label,
    periodStart: value.period_start,
    periodEnd: value.period_end,
    source: value.source,
    criteria: value.criteria,
    recordCount: value.record_count,
    truncated: value.truncated,
  };
};

const parseDataContexts = (
  value: ChatFunctionResponse['data_contexts'],
): ChatDataContext[] | undefined => {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const parsed = value
    .map(parseDataContext)
    .filter((entry): entry is ChatDataContext => Boolean(entry));
  return parsed.length > 0 ? parsed : undefined;
};

const readFunctionErrorCode = async (error: unknown): Promise<string | null> => {
  if (!error || typeof error !== 'object' || !('context' in error)) return null;

  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) return null;

  try {
    const payload = (await context.clone().json()) as ChatFunctionResponse;
    return typeof payload.error?.code === 'string' ? payload.error.code : null;
  } catch {
    return null;
  }
};

export const sendChatMessage = async (messages: ChatMessage[]): Promise<ChatMessage> => {
  const { data, error } = await supabase.functions.invoke<ChatFunctionResponse>('ai-gateway', {
    body: {
      messages: messages.map(({ role, content }) => ({ role, content })),
    },
  });

  if (error) {
    const safeMessage = safeMessageForCode(await readFunctionErrorCode(error));
    throw new Error(safeMessage ?? DEFAULT_ERROR_MESSAGE);
  }

  if (data?.error) {
    throw new Error(safeMessageForCode(data.error.code) ?? DEFAULT_ERROR_MESSAGE);
  }

  if (
    !data?.message ||
    data.message.role !== 'assistant' ||
    typeof data.message.content !== 'string' ||
    !data.message.content.trim()
  ) {
    throw new Error('A Gestly retornou uma resposta inválida. Tente novamente.');
  }

  const dataContexts = parseDataContexts(data.data_contexts);
  return {
    role: 'assistant',
    content: data.message.content,
    ...(dataContexts ? { dataContexts } : {}),
  };
};
