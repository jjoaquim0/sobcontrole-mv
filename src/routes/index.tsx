import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { PublicRoute } from './PublicRoute';
import { PrivateRoute } from './PrivateRoute';
import { RoleRoute } from './RoleRoute';
import { AnalyticsModuleRoute } from './AnalyticsModuleRoute';
import { LegacyReportsRedirect, ReportsRoleOutlet } from './ReportsRoutes';
import { RouteFallback } from './RouteFallback';

// O shell autenticado (sidebar, header, chat) também carrega sob demanda: quem
// só visita a landing ou o login nunca baixa esse código.
const AppLayout = lazy(() => import('../components/layout/AppLayout').then((m) => ({ default: m.AppLayout })));

// Componentes das Páginas — carregados sob demanda para que cada rota vire um
// chunk próprio. Páginas que compartilham o mesmo módulo (ex.: Sales e
// SaleDetailPage) compartilham o mesmo chunk, o que é intencional.
// O `.then` normaliza a exportação nomeada para default, exigido pelo lazy().
const Landing = lazy(() => import('../pages/landing').then((m) => ({ default: m.Landing })));
const Login = lazy(() => import('../pages/auth/Login').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('../pages/auth/Register').then((m) => ({ default: m.Register })));
const SubscriptionInactive = lazy(() =>
  import('../pages/auth/SubscriptionInactive').then((m) => ({ default: m.SubscriptionInactive })),
);
const Dashboard = lazy(() => import('../pages/dashboard').then((m) => ({ default: m.Dashboard })));
const Gestly = lazy(() => import('../pages/gestly').then((m) => ({ default: m.Gestly })));
const Sales = lazy(() => import('../pages/sales').then((m) => ({ default: m.Sales })));
const SaleDetailPage = lazy(() => import('../pages/sales').then((m) => ({ default: m.SaleDetailPage })));
const Pipeline = lazy(() => import('../pages/pipeline').then((m) => ({ default: m.Pipeline })));
const Agenda = lazy(() => import('../pages/agenda').then((m) => ({ default: m.Agenda })));
const Notifications = lazy(() =>
  import('../pages/notifications').then((m) => ({ default: m.Notifications })),
);
const Inventory = lazy(() => import('../pages/inventory').then((m) => ({ default: m.Inventory })));
const ProductDetailPage = lazy(() =>
  import('../pages/inventory').then((m) => ({ default: m.ProductDetailPage })),
);
const StockRecommendationsPage = lazy(() =>
  import('../pages/inventory').then((m) => ({ default: m.StockRecommendationsPage })),
);
const Customers = lazy(() => import('../pages/customers').then((m) => ({ default: m.Customers })));
const CustomerDetailPage = lazy(() =>
  import('../pages/customers').then((m) => ({ default: m.CustomerDetailPage })),
);
const Suppliers = lazy(() => import('../pages/suppliers').then((m) => ({ default: m.Suppliers })));
const SupplierDetailPage = lazy(() =>
  import('../pages/suppliers').then((m) => ({ default: m.SupplierDetailPage })),
);
const Purchases = lazy(() => import('../pages/purchases').then((m) => ({ default: m.Purchases })));
const PurchaseDetailPage = lazy(() =>
  import('../pages/purchases').then((m) => ({ default: m.PurchaseDetailPage })),
);
const Financial = lazy(() => import('../pages/financial').then((m) => ({ default: m.Financial })));
const EmployeesPage = lazy(() => import('../pages/people').then((m) => ({ default: m.EmployeesPage })));
const EmployeeDetailPage = lazy(() =>
  import('../pages/people').then((m) => ({ default: m.EmployeeDetailPage })),
);
const CommissionsPage = lazy(() =>
  import('../pages/people').then((m) => ({ default: m.CommissionsPage })),
);
const TeamsPage = lazy(() => import('../pages/people').then((m) => ({ default: m.TeamsPage })));
const TeamDetailPage = lazy(() => import('../pages/people').then((m) => ({ default: m.TeamDetailPage })));
const SalesGoalsPage = lazy(() => import('../pages/people').then((m) => ({ default: m.SalesGoalsPage })));
const PaymentsComingSoonPage = lazy(() =>
  import('../pages/people').then((m) => ({ default: m.PaymentsComingSoonPage })),
);
const Tax = lazy(() => import('../pages/tax').then((m) => ({ default: m.Tax })));
const TaxSetupPage = lazy(() => import('../pages/tax').then((m) => ({ default: m.TaxSetupPage })));
const TaxClassificationPage = lazy(() =>
  import('../pages/tax').then((m) => ({ default: m.TaxClassificationPage })),
);
const ReportsOverviewPage = lazy(() =>
  import('../pages/reports').then((m) => ({ default: m.ReportsOverviewPage })),
);
const ReportsIntelligencePage = lazy(() =>
  import('../pages/reports').then((m) => ({ default: m.ReportsIntelligencePage })),
);
const ReportsSalesPage = lazy(() =>
  import('../pages/reports').then((m) => ({ default: m.ReportsSalesPage })),
);
const ReportsCustomersPage = lazy(() =>
  import('../pages/reports').then((m) => ({ default: m.ReportsCustomersPage })),
);
const ReportsFinancialPage = lazy(() =>
  import('../pages/reports').then((m) => ({ default: m.ReportsFinancialPage })),
);
const ReportsInventoryPage = lazy(() =>
  import('../pages/reports').then((m) => ({ default: m.ReportsInventoryPage })),
);
const ReportsCustomPage = lazy(() =>
  import('../pages/reports').then((m) => ({ default: m.ReportsCustomPage })),
);
const Documents = lazy(() => import('../pages/documents').then((m) => ({ default: m.Documents })));
const Company = lazy(() => import('../pages/company').then((m) => ({ default: m.Company })));
const Settings = lazy(() => import('../pages/settings').then((m) => ({ default: m.Settings })));
const Profile = lazy(() => import('../pages/profile').then((m) => ({ default: m.Profile })));
const Admin = lazy(() => import('../pages/admin').then((m) => ({ default: m.Admin })));

/**
 * As rotas privadas herdam o Suspense do AppLayout. As públicas ficam fora dele,
 * então precisam do próprio limite de Suspense.
 */
const publicSuspense = (element: ReactNode) => (
  <Suspense fallback={<RouteFallback fullScreen />}>{element}</Suspense>
);

export const router = createBrowserRouter([
  // Página inicial pública de marketing/landing
  {
    path: '/',
    element: publicSuspense(<Landing />),
  },
  // Rotas de Autenticação Públicas (bloqueadas para quem já está logado)
  {
    path: '/login',
    element: publicSuspense(
      <PublicRoute>
        <Login />
      </PublicRoute>,
    ),
  },
  {
    path: '/register',
    element: publicSuspense(
      <PublicRoute>
        <Register />
      </PublicRoute>,
    ),
  },
  // Bloqueio de assinatura inativa (requer login, mas ignora o bloqueio de assinatura ativa)
  {
    path: '/subscription-inactive',
    element: publicSuspense(
      <PrivateRoute allowInactiveSubscription={true}>
        <SubscriptionInactive />
      </PrivateRoute>,
    ),
  },
  // Rotas da Aplicação Privadas e Multi-tenant
  {
    path: '/',
    element: (
      <PrivateRoute>
        <Suspense fallback={<RouteFallback fullScreen />}>
          <AppLayout />
        </Suspense>
      </PrivateRoute>
    ),
    children: [
      {
        path: 'dashboard',
        element: <Dashboard />,
      },
      {
        path: 'gestly',
        element: <Gestly />,
      },
      {
        path: 'sales',
        element: <Sales />,
      },
      {
        path: 'sales/:id',
        element: <SaleDetailPage />,
      },
      {
        path: 'pipeline',
        element: <Pipeline />,
      },
      {
        path: 'agenda',
        element: <Agenda />,
      },
      {
        path: 'notifications',
        element: <Notifications />,
      },
      {
        path: 'customers',
        element: <Customers />,
      },
      {
        path: 'customers/:id',
        element: <CustomerDetailPage />,
      },
      {
        path: 'inventory',
        element: <Inventory />,
      },
      {
        path: 'inventory/recommendations',
        element: <StockRecommendationsPage />,
      },
      {
        path: 'inventory/:id',
        element: <ProductDetailPage />,
      },
      {
        path: 'suppliers',
        element: <Suppliers />,
      },
      {
        path: 'suppliers/:id',
        element: <SupplierDetailPage />,
      },
      {
        path: 'purchases',
        element: (
          <RoleRoute allowedRoles={['admin', 'manager']}>
            <Purchases />
          </RoleRoute>
        ),
      },
      {
        path: 'purchases/:id',
        element: (
          <RoleRoute allowedRoles={['admin', 'manager']}>
            <PurchaseDetailPage />
          </RoleRoute>
        ),
      },
      {
        path: 'financial',
        element: (
          <RoleRoute allowedRoles={['admin', 'manager']}>
            <Financial />
          </RoleRoute>
        ),
      },
      {
        path: 'pessoas/funcionarios',
        element: (
          <RoleRoute allowedRoles={['admin', 'manager']}>
            <EmployeesPage />
          </RoleRoute>
        ),
      },
      {
        path: 'pessoas/funcionarios/:id',
        element: (
          <RoleRoute allowedRoles={['admin', 'manager']}>
            <EmployeeDetailPage />
          </RoleRoute>
        ),
      },
      {
        path: 'pessoas/comissoes',
        element: (
          <RoleRoute allowedRoles={['admin', 'manager']}>
            <CommissionsPage />
          </RoleRoute>
        ),
      },
      {
        path: 'pessoas/equipes',
        element: (
          <RoleRoute allowedRoles={['admin', 'manager']}>
            <TeamsPage />
          </RoleRoute>
        ),
      },
      {
        path: 'pessoas/equipes/:id',
        element: (
          <RoleRoute allowedRoles={['admin', 'manager']}>
            <TeamDetailPage />
          </RoleRoute>
        ),
      },
      {
        path: 'pessoas/metas',
        element: (
          <RoleRoute allowedRoles={['admin', 'manager']}>
            <SalesGoalsPage />
          </RoleRoute>
        ),
      },
      {
        path: 'pessoas/pagamentos',
        element: (
          <RoleRoute allowedRoles={['admin', 'manager']}>
            <PaymentsComingSoonPage />
          </RoleRoute>
        ),
      },
      {
        // Dado tributário é dado financeiro: mesmo controle de papel de
        // /financial, reforçado no banco pelas políticas de is_tax_manager().
        path: 'contabil',
        element: (
          <RoleRoute allowedRoles={['admin', 'manager']}>
            <Tax />
          </RoleRoute>
        ),
      },
      {
        path: 'contabil/configuracao',
        element: (
          <RoleRoute allowedRoles={['admin', 'manager']}>
            <TaxSetupPage />
          </RoleRoute>
        ),
      },
      {
        path: 'contabil/classificacao',
        element: (
          <RoleRoute allowedRoles={['admin', 'manager']}>
            <TaxClassificationPage />
          </RoleRoute>
        ),
      },
      {
        path: 'reports',
        element: <LegacyReportsRedirect />,
      },
      {
        path: 'relatorios',
        element: <ReportsRoleOutlet />,
        children: [
          { index: true, element: <Navigate to="visao-geral" replace /> },
          {
            path: 'visao-geral',
            element: <AnalyticsModuleRoute moduleKey="dashboard_executivo"><ReportsOverviewPage /></AnalyticsModuleRoute>,
          },
          {
            path: 'central-inteligencia',
            element: <AnalyticsModuleRoute moduleKey="gestly_insights"><ReportsIntelligencePage /></AnalyticsModuleRoute>,
          },
          {
            path: 'vendas-pipeline',
            element: <AnalyticsModuleRoute moduleKey="sales_analytics"><ReportsSalesPage /></AnalyticsModuleRoute>,
          },
          {
            path: 'clientes',
            element: <AnalyticsModuleRoute moduleKey="customer_analytics"><ReportsCustomersPage /></AnalyticsModuleRoute>,
          },
          {
            path: 'financeiro',
            element: <AnalyticsModuleRoute moduleKey="financial_analytics"><ReportsFinancialPage /></AnalyticsModuleRoute>,
          },
          {
            path: 'estoque-compras',
            element: <AnalyticsModuleRoute moduleKey="inventory_analytics"><ReportsInventoryPage /></AnalyticsModuleRoute>,
          },
          {
            path: 'personalizados',
            element: <AnalyticsModuleRoute moduleKey="custom_reports"><ReportsCustomPage /></AnalyticsModuleRoute>,
          },
        ],
      },
      {
        path: 'documents',
        element: <Documents />,
      },
      {
        path: 'company',
        element: (
          <RoleRoute allowedRoles={['admin', 'manager']}>
            <Company />
          </RoleRoute>
        ),
      },
      {
        path: 'settings',
        element: (
          <RoleRoute allowedRoles={['admin', 'manager']}>
            <Settings />
          </RoleRoute>
        ),
      },
      {
        path: 'profile',
        element: <Profile />,
      },
      {
        path: 'admin',
        element: (
          <RoleRoute allowedRoles={['admin']}>
            <Admin />
          </RoleRoute>
        ),
      },
    ],
  },
  // Rota fall-back (redireciona para o dashboard se não encontrar)
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);
