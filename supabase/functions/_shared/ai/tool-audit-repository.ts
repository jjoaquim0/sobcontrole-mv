import { AIServiceError } from './errors.ts';
import type { ToolAuditInput, ToolAuditRepository } from './types.ts';

interface AuditUpdateQuery extends PromiseLike<{ error: unknown }> {
  eq(column: string, value: string): AuditUpdateQuery;
}

export interface ToolAuditClient {
  from(table: string): {
    update(values: Record<string, unknown>): AuditUpdateQuery;
  };
}

export const createToolAuditRepository = (
  client: ToolAuditClient,
): ToolAuditRepository => ({
  async record(input: ToolAuditInput): Promise<boolean> {
    const result = await client
      .from('ai_usage_logs')
      .update({
        tool_name: input.toolName,
        tool_period_start: input.periodStart ?? null,
        tool_period_end: input.periodEnd ?? null,
        tool_record_count: Math.max(0, Math.round(input.recordCount)),
        tool_results_truncated: input.truncated,
      })
      .eq('request_id', input.requestId)
      .eq('company_id', input.companyId)
      .eq('user_id', input.userId);

    if (!result || typeof result !== 'object' || !('error' in result)) {
      throw new AIServiceError('internal_error');
    }
    if (result.error) throw new AIServiceError('internal_error');
    return true;
  },
});
