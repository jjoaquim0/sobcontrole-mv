import { describe, expect, it } from 'vitest';
import { isContractsModuleEnabled } from './features';

describe('isContractsModuleEnabled', () => {
  it('fica desligado por padrão e só liga com "true" explícito', () => {
    expect(isContractsModuleEnabled({})).toBe(false);
    expect(isContractsModuleEnabled({ VITE_ENABLE_CONTRACTS_MODULE: 'false' })).toBe(false);
    expect(isContractsModuleEnabled({ VITE_ENABLE_CONTRACTS_MODULE: '1' })).toBe(false);
    expect(isContractsModuleEnabled({ VITE_ENABLE_CONTRACTS_MODULE: 'true' })).toBe(true);
  });
});
