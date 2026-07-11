import { describe, it, expect } from 'vitest';
import { resolveModuleAccess } from './analyticsModulesService';

describe('resolveModuleAccess', () => {
  const enterpriseModule = { key: 'sales_analytics', isComingSoon: false, minPlan: 'enterprise' as const };

  it('retorna "coming_soon" quando o módulo ainda não foi lançado, mesmo com plano/contratação suficientes', () => {
    const module = { ...enterpriseModule, isComingSoon: true };
    expect(resolveModuleAccess(module, 'enterprise', new Set(['sales_analytics']))).toBe('coming_soon');
  });

  it('retorna "contracted" quando a empresa contratou o módulo como add-on, mesmo com plano insuficiente', () => {
    expect(resolveModuleAccess(enterpriseModule, 'pro', new Set(['sales_analytics']))).toBe('contracted');
  });

  it('retorna "available" quando min_plan é nulo (incluído em qualquer plano ativo)', () => {
    const module = { key: 'dashboard_executivo', isComingSoon: false, minPlan: null };
    expect(resolveModuleAccess(module, 'pro', new Set())).toBe('available');
  });

  it('retorna "available" quando o plano da empresa atende ao mínimo exigido', () => {
    expect(resolveModuleAccess(enterpriseModule, 'enterprise', new Set())).toBe('available');
  });

  it('retorna "locked" quando o plano da empresa não atende ao mínimo exigido e não há contratação', () => {
    expect(resolveModuleAccess(enterpriseModule, 'pro', new Set())).toBe('locked');
  });

  it('retorna "locked" quando ainda não há plano carregado', () => {
    expect(resolveModuleAccess(enterpriseModule, null, new Set())).toBe('locked');
  });
});
