import { AIProviderError } from '../errors.ts';
import type { AIProvider } from '../types.ts';

export type AIProviderFactory = () => AIProvider;

export class AIProviderRegistry {
  private readonly factories = new Map<string, AIProviderFactory>();

  register(name: string, factory: AIProviderFactory): this {
    this.factories.set(name, factory);
    return this;
  }

  resolve(name: string): AIProvider {
    const factory = this.factories.get(name);
    if (!factory) throw new AIProviderError('provider_unavailable');
    return factory();
  }

  supports(name: string): boolean {
    return this.factories.has(name);
  }
}
