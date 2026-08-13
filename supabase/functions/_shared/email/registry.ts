import type { EmailProvider, EmailProviderKind } from './types.ts';
import { EmailProviderError } from './types.ts';

export class EmailProviderRegistry {
  private readonly providers = new Map<EmailProviderKind, EmailProvider>();

  register(provider: EmailProvider): this {
    this.providers.set(provider.kind, provider);
    return this;
  }

  resolve(kind: EmailProviderKind): EmailProvider {
    const provider = this.providers.get(kind);
    if (!provider) throw new EmailProviderError('configuration_error');
    return provider;
  }
}
