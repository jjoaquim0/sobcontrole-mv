import { AIServiceError } from './errors.ts';
import type {
  AIUsageRepository,
  FinalizeUsageInput,
  ReserveUsageInput,
  UsageReservation,
} from './types.ts';

interface RpcResult<T> {
  data: T | null;
  error: unknown;
}

export interface SupabaseRpcClient {
  rpc<T>(functionName: string, args: Record<string, unknown>): PromiseLike<RpcResult<T>>;
}

interface ReservationRow {
  allowed: unknown;
  decision_code: unknown;
  company_id: unknown;
  user_id: unknown;
  provider: unknown;
  model: unknown;
  max_output_tokens: unknown;
  timeout_ms: unknown;
}

const SAFE_DECISIONS = new Set<string>([
  'allowed',
  'unauthorized',
  'company_not_found',
  'permission_denied',
  'global_disabled',
  'company_disabled',
  'configuration_error',
  'user_request_limit',
  'company_request_limit',
  'company_token_limit',
  'company_cost_limit',
  'usage_limit_exceeded',
  'invalid_request',
  'internal_error',
]);

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined;

const optionalPositiveInteger = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;

const parseReservation = (row: ReservationRow): UsageReservation => {
  if (
    typeof row.allowed !== 'boolean' ||
    typeof row.user_id !== 'string' ||
    typeof row.decision_code !== 'string' ||
    !SAFE_DECISIONS.has(row.decision_code)
  ) {
    throw new AIServiceError('internal_error');
  }

  const reservation: UsageReservation = {
    allowed: row.allowed,
    decisionCode: row.decision_code as UsageReservation['decisionCode'],
    companyId: optionalString(row.company_id),
    userId: row.user_id,
    provider: optionalString(row.provider),
    model: optionalString(row.model),
    maxOutputTokens: optionalPositiveInteger(row.max_output_tokens),
    timeoutMs: optionalPositiveInteger(row.timeout_ms),
  };

  if (
    reservation.allowed &&
    (!reservation.companyId ||
      !reservation.provider ||
      !reservation.model ||
      !reservation.maxOutputTokens ||
      !reservation.timeoutMs)
  ) {
    throw new AIServiceError('internal_error');
  }

  return reservation;
};

export const createSupabaseUsageRepository = (
  client: SupabaseRpcClient,
): AIUsageRepository => ({
  async reserve(input: ReserveUsageInput): Promise<UsageReservation> {
    const { data, error } = await client.rpc<ReservationRow[]>('reserve_ai_usage', {
      p_user_id: input.userId,
      p_request_id: input.requestId,
      p_estimated_input_tokens: input.estimatedInputTokens,
    });

    if (error || !Array.isArray(data) || data.length !== 1) {
      throw new AIServiceError('internal_error');
    }

    return parseReservation(data[0]);
  },

  async finalize(input: FinalizeUsageInput): Promise<boolean> {
    const { data, error } = await client.rpc<boolean>('finalize_ai_usage', {
      p_request_id: input.requestId,
      p_status: input.status,
      p_input_tokens: input.inputTokens ?? null,
      p_output_tokens: input.outputTokens ?? null,
      p_latency_ms: Math.max(0, Math.round(input.latencyMs)),
      p_error_code: input.errorCode ?? null,
    });

    if (error || typeof data !== 'boolean') {
      throw new AIServiceError('internal_error');
    }

    return data;
  },
});
