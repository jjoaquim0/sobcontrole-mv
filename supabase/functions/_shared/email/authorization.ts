export type EmailActorRole = 'admin' | 'manager' | 'employee';
export type EmailPermission = 'view' | 'test' | 'configure';

export const canPerformEmailAction = (role: EmailActorRole, permission: EmailPermission): boolean =>
  role === 'admin' || (role === 'manager' && permission !== 'configure');

export const canAccessEmailTenant = (actorCompanyId: string, resourceCompanyId: string): boolean =>
  actorCompanyId.length > 0 && actorCompanyId === resourceCompanyId;
