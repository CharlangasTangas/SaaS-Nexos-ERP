/**
 * @nexos/ui
 *
 * Componentes UI compartidos del monorepo Nexos ERP.
 * Basado en shadcn/ui + Tailwind CSS + Radix UI.
 *
 * Los componentes finales serán implementados por el track Frontend (P4).
 * Este archivo sirve como punto de entrada del paquete.
 */

// ─── Re-exports de componentes base ──────────────────────────────────────────
// Los componentes se agregarán aquí a medida que se construyan:
// export { Button } from './components/button';
// export { Input } from './components/input';
// export { Card } from './components/card';
// etc.

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type { ComponentProps } from 'react';

// ─── Utilidades de clase ──────────────────────────────────────────────────────

/**
 * Utilidad simple para combinar clases CSS.
 * Será reemplazada por `cn` de shadcn/ui cuando se instale.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
