import { describe, expect, it } from 'vitest';
import { getLegacyReportPath, REPORT_NAVIGATION_ITEMS } from './reportNavigation';

describe('reportNavigation', () => {
  it('define exatamente os sete destinos do submenu', () => {
    expect(REPORT_NAVIGATION_ITEMS.map((item) => item.path)).toEqual([
      '/relatorios/visao-geral',
      '/relatorios/central-inteligencia',
      '/relatorios/vendas-pipeline',
      '/relatorios/clientes',
      '/relatorios/financeiro',
      '/relatorios/estoque-compras',
      '/relatorios/personalizados',
    ]);
  });

  it('converte deep links antigos nas rotas canonicas', () => {
    expect(getLegacyReportPath('sales')).toBe('/relatorios/vendas-pipeline');
    expect(getLegacyReportPath('customers')).toBe('/relatorios/clientes');
    expect(getLegacyReportPath('dre')).toBe('/relatorios/financeiro?view=dre');
    expect(getLegacyReportPath(null)).toBe('/relatorios/visao-geral');
  });
});
