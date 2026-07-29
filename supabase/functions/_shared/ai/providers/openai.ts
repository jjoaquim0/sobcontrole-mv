import { AIProviderError } from '../errors.ts';
import type {
  AIProvider,
  AIProviderRequest,
  AIProviderResult,
  AIProviderToolCall,
  AIProviderUsage,
} from '../types.ts';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface OpenAIProviderOptions {
  apiKey: string;
  fetcher?: FetchLike;
}

interface OpenAIOutputItem {
  type?: unknown;
  id?: unknown;
  call_id?: unknown;
  name?: unknown;
  arguments?: unknown;
  content?: Array<{ type?: unknown; text?: unknown }>;
  [key: string]: unknown;
}

interface OpenAIResponsePayload {
  output_text?: unknown;
  output?: OpenAIOutputItem[];
  usage?: {
    input_tokens?: unknown;
    output_tokens?: unknown;
    total_tokens?: unknown;
  };
}

const asNonNegativeInteger = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;

const extractOutputText = (payload: OpenAIResponsePayload): string | null => {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const text = payload.output
    ?.filter((item) => item.type === 'message')
    .flatMap((item) => item.content ?? [])
    .find((content) => content.type === 'output_text' && typeof content.text === 'string')?.text;

  return typeof text === 'string' && text.trim() ? text.trim() : null;
};

const extractUsage = (payload: OpenAIResponsePayload): AIProviderUsage => ({
  inputTokens: asNonNegativeInteger(payload.usage?.input_tokens),
  outputTokens: asNonNegativeInteger(payload.usage?.output_tokens),
  totalTokens: asNonNegativeInteger(payload.usage?.total_tokens),
});

const extractToolCalls = (payload: OpenAIResponsePayload): AIProviderToolCall[] =>
  (payload.output ?? [])
    .filter((item) => item.type === 'function_call')
    .map((item) => {
      if (
        typeof item.call_id !== 'string' ||
        !item.call_id ||
        typeof item.name !== 'string' ||
        !item.name ||
        typeof item.arguments !== 'string'
      ) {
        throw new AIProviderError('provider_unavailable');
      }
      return {
        callId: item.call_id,
        name: item.name,
        arguments: item.arguments,
      };
    });

const continuationItems = (request: AIProviderRequest): OpenAIOutputItem[] => {
  if (!request.continuation) return [];
  if (
    request.continuation.provider !== 'openai' ||
    !Array.isArray(request.continuation.data) ||
    !request.continuation.data.every(
      (item) => typeof item === 'object' && item !== null && !Array.isArray(item),
    )
  ) {
    throw new AIProviderError('invalid_request');
  }
  return request.continuation.data as OpenAIOutputItem[];
};

const errorCodeForStatus = (status: number): AIProviderError['code'] => {
  if (status === 429) return 'rate_limited';
  if (status === 408 || status === 504) return 'timeout';
  return 'provider_unavailable';
};

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  private readonly apiKey: string;
  private readonly fetcher: FetchLike;

  constructor(options: OpenAIProviderOptions) {
    this.apiKey = options.apiKey;
    this.fetcher = options.fetcher ?? fetch;
  }

  async generate(request: AIProviderRequest): Promise<AIProviderResult> {
    if (!this.apiKey) throw new AIProviderError('provider_unavailable');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), request.timeoutMs);

    try {
      const previousOutput = continuationItems(request);
      const input =
        previousOutput.length > 0
          ? [
              ...request.messages,
              ...previousOutput,
              ...(request.toolOutputs ?? []).map((toolOutput) => ({
                type: 'function_call_output',
                call_id: toolOutput.callId,
                output: toolOutput.output,
              })),
            ]
          : request.messages;

      const response = await this.fetcher('https://api.openai.com/v1/responses', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          instructions: request.instructions,
          input,
          max_output_tokens: request.maxOutputTokens,
          reasoning: { effort: 'low' },
          safety_identifier: request.safetyIdentifier,
          store: false,
          text: { verbosity: 'low' },
          ...(request.tools && request.tools.length > 0 ? { tools: request.tools } : {}),
          ...(request.toolChoice ? { tool_choice: request.toolChoice } : {}),
          ...(request.parallelToolCalls === false ? { parallel_tool_calls: false } : {}),
        }),
      });

      if (!response.ok) {
        throw new AIProviderError(errorCodeForStatus(response.status));
      }

      let payload: OpenAIResponsePayload;
      try {
        payload = (await response.json()) as OpenAIResponsePayload;
      } catch {
        throw new AIProviderError('provider_unavailable');
      }

      const content = extractOutputText(payload);
      const toolCalls = extractToolCalls(payload);
      if (!content && toolCalls.length === 0) throw new AIProviderError('provider_unavailable');

      return {
        content: content ?? undefined,
        provider: this.name,
        model: request.model,
        usage: extractUsage(payload),
        toolCalls,
        continuation: Array.isArray(payload.output)
          ? { provider: this.name, data: payload.output }
          : undefined,
      };
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      if (controller.signal.aborted) throw new AIProviderError('timeout');
      throw new AIProviderError('provider_unavailable');
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
