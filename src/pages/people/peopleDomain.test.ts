import { describe, expect, it } from 'vitest';
import { formatCpfInput, isValidCpf, normalizeCpf } from './peopleDomain';

describe('people domain CPF protection', () => {
  it('validates CPF check digits only when a value is provided', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('529.982.247-24')).toBe(false);
  });

  it('normalizes and masks input without logging or returning extra digits', () => {
    expect(normalizeCpf('529.982.247-25 extra 999')).toBe('52998224725');
    expect(formatCpfInput('52998224725')).toBe('529.982.247-25');
  });
});
