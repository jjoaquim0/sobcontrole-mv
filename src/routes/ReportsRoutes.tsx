import React from 'react';
import { Navigate, Outlet, useSearchParams } from 'react-router-dom';
import { getLegacyReportPath } from '../pages/reports/reportNavigation';
import { RoleRoute } from './RoleRoute';

export const ReportsRoleOutlet: React.FC = () => (
  <RoleRoute allowedRoles={['admin', 'manager']}>
    <Outlet />
  </RoleRoute>
);

export const LegacyReportsRedirect: React.FC = () => {
  const [searchParams] = useSearchParams();
  return <Navigate to={getLegacyReportPath(searchParams.get('tab'))} replace />;
};
