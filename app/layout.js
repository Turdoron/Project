import { Inter, Fraunces } from 'next/font/google'
import './estilos.css'

// Las fuentes se descargan al construir y se sirven desde el mismo sitio (sin pedirlas a Google en cada visita).
// Inter: letra de todo el sistema. Sus números tienen ancho fijo (las columnas de montos alinean dígito con dígito)
// y distingue bien 1/7, 3/8, 0/O en tamaños chicos.
const inter = Inter({ subsets: ['latin'], axes: ['opsz'], display: 'swap', variable: '--fuente-inter' })
// Fraunces: solo los títulos de pantalla (sin cifras). No se precarga: así no le quita velocidad al programa en la primera visita.
const fraunces = Fraunces({ subsets: ['latin'], axes: ['opsz'], display: 'swap', variable: '--fuente-fraunces', preload: false })

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#2B2E83' }

// Tema guardado (claro, oscuro o el del sistema): se aplica antes de dibujar nada, para que no parpadee.
const TEMA = `(function(){var t='sistema';try{t=localStorage.getItem('contagt_tema')||'sistema'}catch(e){}
var osc=t==='oscuro'||(t==='sistema'&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.setAttribute('data-theme',osc?'dark':'light');})();`

// El programa espera a que la conexión con Supabase esté lista (window.sbListo).
// El enlace del correo de recuperación trae "type=recovery" en la dirección. Supabase lo lee y lo borra enseguida,
// y su aviso llega después de que la app ya eligió pantalla: por eso se lee aquí, al instante, antes de todo.
// El título de la pestaña lo maneja el programa (cambia por pantalla); si lo diera Next.js, React lo volvería a poner al hidratar.
const PREVIO = `document.title='Módulo Contable ADCONTIS';
window.sbListo=new Promise(function(r){window.__sbResolve=r});
window.__recuperando=/[#&]type=recovery(&|$)/.test(location.hash);
if('serviceWorker' in navigator){addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}
addEventListener('beforeinstallprompt',function(ev){ev.preventDefault();window.__instalar=ev});`

export default function RaizLayout({ children }) {
  // suppressHydrationWarning: el tema y la visibilidad (zoom) los ajusta el programa en <html> y <body>.
  return (
    <html lang="es" className={`${inter.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA }} />
        <script dangerouslySetInnerHTML={{ __html: PREVIO }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
