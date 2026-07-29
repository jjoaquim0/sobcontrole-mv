import type {
  AIProvider,
  AIProviderRequest,
  AIProviderResult,
  AIProviderToolCall,
  AIProviderUsage,
} from '../types.ts';

interface FakeAIProviderResult {
  content?: string;
  toolCalls?: AIProviderToolCall[];
  usage?: AIProviderUsage;
}

interface FakeAIProviderOptions {
  name?: string;
  content?: string;
  toolCalls?: AIProviderToolCall[];
  usage?: AIProviderUsage;
  results?: FakeAIProviderResult[];
}

export class FakeAIProvider implements AIProvider {
  readonly name: string;
  private readonly content: string;
  private readonly usage: AIProviderUsage;
  private readonly toolCalls: AIProviderToolCall[];
  private readonly results: FakeAIProviderResult[];
  private resultIndex = 0;
  readonly requests: AIProviderRequest[] = [];

  constructor(options: FakeAIProviderOptions = {}) {
    this.name = options.name ?? 'fake';
    this.content = options.content ?? 'Resposta de teste.';
    this.usage = options.usage ?? { inputTokens: 10, outputTokens: 5, totalTokens: 15 };
    this.toolCalls = options.toolCalls ?? [];
    this.results = options.results ?? [];
  }

  async generate(request: AIProviderRequest): Promise<AIProviderResult> {
    this.requests.push(request);
    const queuedResult = this.results[this.resultIndex];
    if (queuedResult) this.resultIndex += 1;
    const toolCalls = queuedResult?.toolCalls ?? this.toolCalls;
    return {
      content: queuedResult ? queuedResult.content : this.content,
      provider: this.name,
      model: request.model,
      usage: queuedResult?.usage ?? this.usage,
      toolCalls,
      continuation:
        toolCalls.length > 0
          ? {
              provider: this.name,
              data: { turn: this.resultIndex, toolCalls },
            }
          : undefined,
    };
  }
}
