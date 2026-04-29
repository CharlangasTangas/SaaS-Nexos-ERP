import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? 'lvh.me';

// Subdominios que NO son tenants (reservados)
const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'admin', '']);

/**
 * Middleware de Next.js para extracción de tenant desde subdominio.
 *
 * Convierte:
 *   empresa1.lvh.me:3000 → header x-tenant-slug: "empresa1"
 *   lvh.me:3000          → sin header (app pública)
 *
 * El backend (NestJS) lee el header X-Tenant-Slug para resolver el tenant.
 */
export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? '';
  // Remover el puerto si existe
  const host = hostname.split(':')[0];

  // Extraer subdominio (empresa1 de empresa1.lvh.me)
  const subdomain = host.replace(`.${ROOT_DOMAIN}`, '').split('.')[0];

  if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain) || host === ROOT_DOMAIN) {
    return NextResponse.next();
  }

  // Inyectar el tenant slug en headers para uso en Server Components
  const response = NextResponse.next();
  response.headers.set('x-tenant-slug', subdomain);
  return response;
}

export const config = {
  matcher: [
    // Excluir archivos estáticos y rutas de Next.js internos
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
