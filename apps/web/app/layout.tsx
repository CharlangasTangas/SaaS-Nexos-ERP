import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: {
    default: 'Nexos ERP',
    template: '%s — Nexos ERP',
  },
  description:
    'Plataforma ERP multi-tenant local para gestión de catálogo, inventario, ventas y clientes.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
