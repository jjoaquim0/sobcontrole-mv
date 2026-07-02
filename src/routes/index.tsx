import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { PublicRoute } from './PublicRoute';
import { PrivateRoute } from './PrivateRoute';
import { RoleRoute } from './RoleRoute';
import { AppLayout } from '../components/layout/AppLayout';

// Componentes das Páginas
import { Landing } from '../pages/landing';
import { Login } from '../pages/auth/Login';
import { Register } from '../pages/auth/Register';
import { SubscriptionInactive } from '../pages/auth/SubscriptionInactive';
import { Dashboard } from '../pages/dashboard';
import { Sales, SaleDetailPage } from '../pages/sales';
import { Inventory, ProductDetailPage } from '../pages/inventory';
import { Customers, CustomerDetailPage } from '../pages/customers';
import { Suppliers } from '../pages/suppliers';
import { Purchases, PurchaseDetailPage } from '../pages/purchases';
import { Financial } from '../pages/financial';
import { Reports } from '../pages/reports';
import { Documents } from '../pages/documents';
import { Company } from '../pages/company';
import { Settings } from '../pages/settings';
import { Profile } from '../pages/profile';
import { Admin } from '../pages/admin';

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
        path: 'sales',
        element: <Sales />,
      },
      {
        path: 'sales/:id',
        element: <SaleDetailPage />,
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
        path: 'inventory/:id',
        element: <ProductDetailPage />,
      },
      {
        path: 'suppliers',
        element: <Suppliers />,
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
        path: 'reports',
        element: (
          <RoleRoute allowedRoles={['admin', 'manager']}>
            <Reports />
          </RoleRoute>
        ),
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
