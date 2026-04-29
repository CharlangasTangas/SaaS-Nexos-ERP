/**
 * @nexos/types
 *
 * Tipos compartidos entre frontend (apps/web) y backend (apps/api).
 * Este paquete es el contrato central del monorepo.
 * No debe tener dependencias de runtime externas.
 */

// ─── Tenant ──────────────────────────────────────────────────────────────────

export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export type BusinessType = 'GREENHOUSE' | 'MEAT_PROCESSING' | 'DISTRIBUTOR' | 'OTHER';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  businessType: BusinessType;
  status: TenantStatus;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export type UserRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER';

export interface User {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  roleId: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;
  tenantId: string;
  tenantSlug: string;
  roles: UserRole[];
  permissions: string[];
  isSuperadmin: boolean;
  iat: number;
  exp: number;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
}

export interface SignupRequest {
  slug: string;
  companyName: string;
  businessType: BusinessType;
  email: string;
  password: string;
  fullName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
}

// ─── Roles & Permissions ──────────────────────────────────────────────────────

export interface RoleResponse {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: PermissionResponse[];
}

export interface PermissionResponse {
  id: string;
  code: string;
  description: string | null;
}

// ─── User Management ─────────────────────────────────────────────────────────

export interface UserInviteRequest {
  email: string;
  fullName: string;
  roleId: string;
}

export interface UserListItem {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  role: { id: string; name: string };
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface AdminTenantResponse extends Tenant {
  userCount?: number;
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  diff: Record<string, unknown>;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

export interface PresignedUrlRequest {
  bucket: string;
  key: string;
  expiresIn?: number; // seconds, default 3600
}

export interface PresignedUrlResponse {
  url: string;
  key: string;
  expiresAt: string;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  version: string;
}
