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

// ─── Categories ─────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  parentId: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryTree extends Category {
  children?: CategoryTree[];
}

export interface CreateCategoryRequest {
  name: string;
  parentId?: string | null;
  description?: string | null;
}

export interface UpdateCategoryRequest {
  name?: string;
  parentId?: string | null;
  description?: string | null;
}

// ─── Products ───────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  unit: string;
  price: number;
  cost: number;
  minStock: number;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductRequest {
  sku: string;
  name: string;
  description?: string | null;
  categoryId?: string | null;
  unit: string;
  price: number;
  cost?: number;
  minStock?: number;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateProductRequest extends Partial<CreateProductRequest> {}

// ─── Warehouses ─────────────────────────────────────────────────────────────

export interface Warehouse {
  id: string;
  tenantId: string;
  name: string;
  address: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWarehouseRequest {
  name: string;
  address?: string | null;
  isDefault?: boolean;
}

export interface UpdateWarehouseRequest extends Partial<CreateWarehouseRequest> {}

// ─── Inventory ──────────────────────────────────────────────────────────────

export interface Inventory {
  id: string;
  tenantId: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  reserved: number;
  createdAt: string;
  updatedAt: string;
}

export type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER';
export type ReferenceType = 'SALE' | 'PURCHASE' | 'MANUAL';

export interface StockMovement {
  id: string;
  tenantId: string;
  inventoryId: string;
  type: MovementType;
  quantity: number;
  referenceType: ReferenceType | null;
  referenceId: string | null;
  userId: string | null;
  notes: string | null;
  createdAt: string;
}

export interface AdjustInventoryRequest {
  productId: string;
  warehouseId: string;
  type: MovementType;
  quantity: number;
  notes?: string | null;
}

// ─── Customers ──────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  creditLimit: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerRequest {
  name: string;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  creditLimit?: number;
}

export interface UpdateCustomerRequest extends Partial<CreateCustomerRequest> {}

// ─── Sales ──────────────────────────────────────────────────────────────────

export type SaleStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';

export interface SaleItem {
  id: string;
  tenantId: string;
  saleId: string;
  productId: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  tenantId: string;
  number: string;
  customerId: string | null;
  userId: string;
  status: SaleStatus;
  subtotal: number;
  tax: number;
  total: number;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items?: SaleItem[];
}

export interface CreateSaleItemRequest {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
}

export interface CreateSaleRequest {
  customerId?: string | null;
  notes?: string | null;
  items: CreateSaleItemRequest[];
}

// ─── Invoices ───────────────────────────────────────────────────────────────

export interface Invoice {
  id: string;
  tenantId: string;
  saleId: string;
  number: string;
  issuedAt: string;
  pdfPath: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export interface DashboardMetrics {
  monthlySales: number;
  totalRevenue: number;
  salesCount: number;
  topProducts: { productId: string; name: string; soldQuantity: number }[];
  lowStockAlerts: { productId: string; name: string; quantity: number; minStock: number }[];
  recentSales: Sale[];
  recentMovements: StockMovement[];
}
