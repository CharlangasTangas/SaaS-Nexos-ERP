import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nexos ERP — Inicio',
};

/**
 * Página de inicio de Nexos ERP
 *
 * Esta es una página placeholder de infraestructura.
 * Las páginas finales serán implementadas por el track Frontend (P4):
 * - Login: NX-P4-006
 * - Dashboard: NX-P4-015
 * - Productos: NX-P4-008
 * etc.
 */
export default function HomePage() {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'system-ui, sans-serif',
        background: '#0f172a',
        color: '#f1f5f9',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 480, padding: '2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚡</div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Nexos ERP
        </h1>
        <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>
          Infraestructura lista. Los módulos de negocio están en desarrollo.
        </p>
        <div
          style={{
            background: '#1e293b',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            textAlign: 'left',
            fontSize: '0.875rem',
            color: '#7dd3fc',
            fontFamily: 'monospace',
          }}
        >
          <div>✅ Monorepo Turborepo</div>
          <div>✅ Docker Compose</div>
          <div>✅ PostgreSQL 16</div>
          <div>✅ Redis 7</div>
          <div>✅ MinIO</div>
          <div>✅ Mailhog</div>
          <div>🔨 Módulos de negocio en construcción...</div>
        </div>
        <p style={{ marginTop: '1.5rem', color: '#64748b', fontSize: '0.75rem' }}>
          API: <a href="http://api.lvh.me:4000/health" style={{ color: '#38bdf8' }}>api.lvh.me:4000/health</a>
          {' · '}
          Docs: <a href="http://api.lvh.me:4000/api/docs" style={{ color: '#38bdf8' }}>api.lvh.me:4000/api/docs</a>
        </p>
      </div>
    </main>
  );
}
