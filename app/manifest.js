// La app se puede instalar en el teléfono o la computadora (en Android, Chrome la instala como una app con su ícono).
export default function manifest() {
  return {
    name: 'ADCONTIS — Módulo Contable',
    short_name: 'ADCONTIS',
    description: 'Contabilidad, impuestos, planillas y contratos para empresas guatemaltecas.',
    lang: 'es-GT',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#2B2E83',
    theme_color: '#2B2E83',
    icons: [
      { src: '/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
