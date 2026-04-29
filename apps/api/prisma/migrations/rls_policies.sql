-- ─────────────────────────────────────────────────────────────────────────────
-- Nexos ERP — Row-Level Security Policies
-- Applied AFTER Prisma schema migration.
--
-- This migration enables RLS on all tables with tenant_id.
-- Tables WITHOUT tenant_id (tenants, permissions) are excluded.
--
-- Policy pattern:
--   USING (tenant_id = current_setting('app.tenant_id')::uuid)
--   WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid)
--
-- If app.tenant_id is not set, queries return 0 rows (fail-safe).
-- ─────────────────────────────────────────────────────────────────────────────

-- Ensure the GUC variable exists with a safe default
DO $$
BEGIN
  PERFORM set_config('app.tenant_id', '00000000-0000-0000-0000-000000000000', true);
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- ─── users ───────────────────────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_users ON users;
CREATE POLICY tenant_isolation_users ON users
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ─── roles ───────────────────────────────────────────────────────────────────
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_roles ON roles;
CREATE POLICY tenant_isolation_roles ON roles
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ─── role_permissions ────────────────────────────────────────────────────────
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_role_permissions ON role_permissions;
CREATE POLICY tenant_isolation_role_permissions ON role_permissions
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ─── audit_logs ──────────────────────────────────────────────────────────────
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_audit_logs ON audit_logs;
CREATE POLICY tenant_isolation_audit_logs ON audit_logs
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ─── Verification ────────────────────────────────────────────────────────────
-- Run this to verify RLS is enabled:
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public' AND tablename IN ('users', 'roles', 'role_permissions', 'audit_logs');

-- ─── categories ──────────────────────────────────────────────────────────────
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_categories ON categories;
CREATE POLICY tenant_isolation_categories ON categories
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ─── products ────────────────────────────────────────────────────────────────
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_products ON products;
CREATE POLICY tenant_isolation_products ON products
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ─── warehouses ──────────────────────────────────────────────────────────────
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_warehouses ON warehouses;
CREATE POLICY tenant_isolation_warehouses ON warehouses
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ─── inventory ───────────────────────────────────────────────────────────────
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_inventory ON inventory;
CREATE POLICY tenant_isolation_inventory ON inventory
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ─── stock_movements ─────────────────────────────────────────────────────────
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_stock_movements ON stock_movements;
CREATE POLICY tenant_isolation_stock_movements ON stock_movements
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ─── customers ───────────────────────────────────────────────────────────────
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_customers ON customers;
CREATE POLICY tenant_isolation_customers ON customers
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ─── sales ───────────────────────────────────────────────────────────────────
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_sales ON sales;
CREATE POLICY tenant_isolation_sales ON sales
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ─── sale_items ──────────────────────────────────────────────────────────────
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_sale_items ON sale_items;
CREATE POLICY tenant_isolation_sale_items ON sale_items
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ─── invoices ────────────────────────────────────────────────────────────────
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_invoices ON invoices;
CREATE POLICY tenant_isolation_invoices ON invoices
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
