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
  iat: number;
  exp: number;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
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
