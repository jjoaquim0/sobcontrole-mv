import { describe, expect, it } from 'vitest';

/**
 * As rotas são carregadas com React.lazy + import() dinâmico. Um nome de export
 * trocado não quebra o build nem o typecheck do router: quebra só quando o
 * usuário abre aquela rota, em produção.
 *
 * Este teste importa cada módulo de página e confirma que o export usado em
 * `src/routes/index.tsx` existe e é renderizável. A lista precisa espelhar os
 * lazy() do router — ao adicionar uma rota, adicione a entrada aqui.
 */
const lazyRouteModules: Array<[string, () => Promise<Record<string, unknown>>, string[]]> = [
  ['components/layout/AppLayout', () => import('../components/layout/AppLayout'), ['AppLayout']],
  ['pages/landing', () => import('../pages/landing'), ['Landing']],
  ['pages/auth/Login', () => import('../pages/auth/Login'), ['Login']],
  ['pages/auth/Register', () => import('../pages/auth/Register'), ['Register']],
  [
    'pages/auth/SubscriptionInactive',
    () => import('../pages/auth/SubscriptionInactive'),
    ['SubscriptionInactive'],
  ],
  ['pages/dashboard', () => import('../pages/dashboard'), ['Dashboard']],
  ['pages/gestly', () => import('../pages/gestly'), ['Gestly']],
  ['pages/sales', () => import('../pages/sales'), ['Sales', 'SaleDetailPage']],
  ['pages/pipeline', () => import('../pages/pipeline'), ['Pipeline']],
  ['pages/agenda', () => import('../pages/agenda'), ['Agenda']],
  ['pages/notifications', () => import('../pages/notifications'), ['Notifications']],
  [
    'pages/inventory',
    () => import('../pages/inventory'),
    ['Inventory', 'ProductDetailPage', 'StockRecommendationsPage'],
  ],
  ['pages/customers', () => import('../pages/customers'), ['Customers', 'CustomerDetailPage']],
  ['pages/suppliers', () => import('../pages/suppliers'), ['Suppliers', 'SupplierDetailPage']],
  ['pages/purchases', () => import('../pages/purchases'), ['Purchases', 'PurchaseDetailPage']],
  ['pages/financial', () => import('../pages/financial'), ['Financial']],
  [
    'pages/people',
    () => import('../pages/people'),
    [
      'EmployeesPage',
      'EmployeeDetailPage',
      'CommissionsPage',
      'TeamsPage',
      'TeamDetailPage',
      'SalesGoalsPage',
      'PaymentsComingSoonPage',
    ],
  ],
  ['pages/tax', () => import('../pages/tax'), ['Tax', 'TaxSetupPage', 'TaxClassificationPage']],
  [
    'pages/reports',
    () => import('../pages/reports'),
    [
      'ReportsOverviewPage',
      'ReportsIntelligencePage',
      'ReportsSalesPage',
      'ReportsCustomersPage',
      'ReportsFinancialPage',
      'ReportsInventoryPage',
      'ReportsCustomPage',
    ],
  ],
  ['pages/documents', () => import('../pages/documents'), ['Documents']],
  ['pages/company', () => import('../pages/company'), ['Company']],
  ['pages/settings', () => import('../pages/settings'), ['Settings']],
  ['pages/profile', () => import('../pages/profile'), ['Profile']],
  ['pages/admin', () => import('../pages/admin'), ['Admin']],
];

describe('carregamento sob demanda das rotas', () => {
  it.each(lazyRouteModules)('%s expõe os componentes usados pelo router', async (_name, load, exports) => {
    const mod = await load();

    for (const exportName of exports) {
      const component = mod[exportName];
      expect(component, `export "${exportName}" não encontrado`).toBeDefined();
      // Componentes React são função ou objeto (memo/forwardRef).
      expect(['function', 'object']).toContain(typeof component);
    }
  });

  it('o router monta sem lançar', async () => {
    const { router } = await import('./index');
    expect(router.routes.length).toBeGreaterThan(0);
  });
});
