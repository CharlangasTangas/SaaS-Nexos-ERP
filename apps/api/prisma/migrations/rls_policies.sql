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
