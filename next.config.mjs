const seguridad = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
]

/** @type {import('next').NextConfig} */
export default {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      { source: '/:ruta*', headers: seguridad },
      // El programa lleva en el nombre un resumen de su contenido: cada versión nueva es otro archivo.
      { source: '/app/:archivo*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    ]
  },
}
