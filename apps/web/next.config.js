/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'standalone', // Descomentar para build de producción en Linux/Docker

  // Identifica el tenant desde el subdominio (lvh.me)
  // El middleware.ts lo gestiona en runtime
  
  experimental: {
    // Habilitar cuando sea necesario:
    // serverComponentsExternalPackages: [],
  },

  // Headers de seguridad base
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },

  // Variables de entorno expuestas al cliente (prefijo NEXT_PUBLIC_)
  env: {
    NEXT_PUBLIC_API_URL: process.env.API_URL ?? 'http://api.lvh.me:4000',
    NEXT_PUBLIC_ROOT_DOMAIN: process.env.ROOT_DOMAIN ?? 'lvh.me',
  },
};

export default nextConfig;
