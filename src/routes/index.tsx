import { createBrowserRouter, Navigate } from 'react-router-dom';
import { PublicRoute } from './PublicRoute';
import { PrivateRoute } from './PrivateRoute';
import { RoleRoute } from './RoleRoute';
import { AnalyticsModuleRoute } from './AnalyticsModuleRoute';
import { LegacyReportsRedirect, ReportsRoleOutlet } from './ReportsRoutes';
import { AppLayout } from '../components/layout/AppLayout';

// Componentes das Páginas
import { Landing } from '../pages/landing';
import { Login } from '../pages/auth/Login';
import { Register } from '../pages/auth/Register';
import { SubscriptionInactive } from '../pages/auth/SubscriptionInactive';
import { Dashboard } from '../pages/dashboard';
import { Gestly } from '../pages/gestly';
import { Sales, SaleDetailPage } from '../pages/sales';
import { Pipeline } from '../pages/pipeline';
import { Agenda } from '../pages/agenda';
import { Notifications } from '../pages/notifications';
import { Inventory, ProductDetailPage, StockRecommendationsPage } from '../pages/inventory';
import { Customers, CustomerDetailPage } from '../pages/customers';
import { Suppliers, SupplierDetailPage } from '../pages/suppliers';
import { Purchases, PurchaseDetailPage } from '../pages/purchases';
import { Financial } from '../pages/financial';
import { CommissionsPage, EmployeeDetailPage, EmployeesPage, PaymentsComingSoonPage, SalesGoalsPage, TeamDetailPage, TeamsPage } from '../pages/people';
import { Tax, TaxSetupPage, TaxClassificationPage } from '../pages/tax';
import {
  ReportsCustomPage,
  ReportsCustomersPage,
  ReportsFinancialPage,
  ReportsIntelligencePage,
  ReportsInventoryPage,
  ReportsOverviewPage,
  ReportsSalesPage,
} from '../pages/reports';
import { Documents } from '../pages/documents';
import { Company } from '../pages/company';
import { Settings } from '../pages/settings';
import { Profile } from '../pages/profile';
import { Admin } from '../pages/admin';
import { MvAmbientalRoadmapPage } from '../pages/roadmap';
import { ContractDetailPage, ContractsPage } from '../pages/contracts';
import { DemandDetailPage, DemandsPage } from '../pages/demands';
import { PeopleDocsPage } from '../pages/peopleDocs';
import { ObligationsPage } from '../pages/obligations';
import { OperationalPanelPage } from '../pages/operationalPanel';
import { InitialImportPage } from '../pages/initialImport';
import { isContractsModuleEnabled } from '../lib/features';

export const router = createBrowserRouter([
  // Página inicial pública de marketing/landing
  {
    path: '/',
    element: <Landing />,
  },
  // Rotas de Autenticação Públicas (bloqueadas para quem já está logado)
  {
    path: '/login',
    element: (
      <PublicRoute>
        <Login />
      </PublicRoute>
    ),
  },
  {
    path: '/register',
    element: (
      <PublicRoute>
        <Register />
      </PublicRoute>
    ),
  },
  // Bloqueio de assinatura inativa (requer login, mas ignora o bloqueio de assinatura ativa)
  {
    path: '/subscription-inactive',
    element: (
      <PrivateRoute allowInactiveSubscription={true}>
        <SubscriptionInactive />
      </PrivateRoute>
    ),
  },
  // Rotas da Aplicação Privadas e Multi-tenant
  {
    path: '/',
    element: (
      <PrivateRoute>
        <AppLayout />
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
      // Contratos (Story 1.62): só no deploy ligado ao banco sobcontrole-mv.
      ...(isContractsModuleEnabled() ? [
        {
          path: 'contratos',
          element: (
            <RoleRoute allowedRoles={['admin', 'manager']}>
              <ContractsPage />
            </RoleRoute>
          ),
        },
        {
          path: 'contratos/:id',
          element: (
            <RoleRoute allowedRoles={['admin', 'manager']}>
              <ContractDetailPage />
            </RoleRoute>
          ),
        },
        {
          path: 'demandas',
          element: (
            <RoleRoute allowedRoles={['admin', 'manager']}>
              <DemandsPage />
            </RoleRoute>
          ),
        },
        {
          path: 'demandas/:id',
          element: (
            <RoleRoute allowedRoles={['admin', 'manager']}>
              <DemandDetailPage />
            </RoleRoute>
          ),
        },
        {
          path: 'documentacao',
          element: (
            <RoleRoute allowedRoles={['admin', 'manager']}>
              <PeopleDocsPage />
            </RoleRoute>
          ),
        },
        {
          path: 'obrigacoes',
          element: (
            <RoleRoute allowedRoles={['admin', 'manager']}>
              <ObligationsPage />
            </RoleRoute>
          ),
        },
        {
          path: 'painel-operacional',
          element: (
            <RoleRoute allowedRoles={['admin', 'manager']}>
              <OperationalPanelPage />
            </RoleRoute>
          ),
        },
        {
          path: 'importacao',
          element: (
            <RoleRoute allowedRoles={['admin', 'manager']}>
              <InitialImportPage />
            </RoleRoute>
          ),
        },
      ] : []),
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
        // Apresentação de projeto para cliente: visível só para quem conduz a reunião.
        path: 'projetos/mv-ambiental/roadmap',
        element: (
          <RoleRoute allowedRoles={['admin', 'manager']}>
            <MvAmbientalRoadmapPage />
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
