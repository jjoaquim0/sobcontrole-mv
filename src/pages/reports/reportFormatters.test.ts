import { describe, expect, it } from 'vitest';
import { formatCurrency, formatPercentage } from './reportFormatters';

describe('formatadores de relatórios', () => {
  it('formata valores monetários em Real brasileiro', () => {
    const formatted = formatCurrency(1234.56);
    expect(formatted).toContain('R$');
    expect(formatted).toContain('1.234,56');
  });

  it('formata percentuais com vírgula decimal', () => {
    expect(formatPercentage(12.34)).toBe('12,3%');
  });
});
