/**
 * Shape of the authenticated user attached to the request
 * after JWT validation by Passport.
 */
export interface AuthenticatedUser {
  sub: string;
  tenantId: string;
  tenantSlug: string;
  roles: string[];
  permissions: string[];
  isSuperadmin: boolean;
}

/**
 * Tenant info resolved by TenantMiddleware.
 */
export interface ResolvedTenant {
  id: string;
  slug: string;
  status: string;
}
