// Arma el programa que corre en el navegador a partir de los módulos de src/legado/ (se ejecuta antes de "next build").
//
// Los módulos de src/legado/ son la app de siempre, partida en archivos por tema. Comparten variables y funciones
// globales (los botones las llaman con onclick="..."), así que se unen en orden numérico en un solo script clásico:
// el resultado se comporta exactamente igual que cuando todo estaba en un único index.html.
// Delante va la conexión con Supabase (src/supabase.js), empaquetada aparte para no mezclar sus nombres internos.
//
// Resultado: public/app/app.<hash>.js (minificado, con nombre según el contenido para guardarlo en caché un año)
// y src/legado/manifiesto.json, que le dice a la página qué archivo cargar.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { build, transform } from 'esbuild'
import nextEnv from '@next/env'

// Lee .env y .env.local igual que Next.js (este paso corre antes que next build / next dev).
nextEnv.loadEnvConfig(process.cwd(), process.argv.includes('--sin-minificar'))

const minificar = !process.argv.includes('--sin-minificar')
const dir = 'src/legado'
const modulos = fs.readdirSync(dir).filter(f => /^\d+-.+\.js$/.test(f)).sort()

const publica = v => JSON.stringify(process.env['NEXT_PUBLIC_' + v] || process.env['VITE_' + v] || '')
const conexion = await build({
  entryPoints: ['src/supabase.js'], bundle: true, write: false, format: 'iife', platform: 'browser',
  target: 'es2020', minify: minificar, legalComments: 'none',
  define: {
    'process.env.NEXT_PUBLIC_SUPABASE_URL': publica('SUPABASE_URL'),
    'process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY': publica('SUPABASE_PUBLISHABLE_KEY'),
  },
})

// Cada módulo se marca con su nombre para ubicar errores; sin renombrar nada global (lo usan los onclick).
const legado = modulos.map(f => `/* ${f} */\n` + fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
const app = await transform(legado, { loader: 'js', minify: minificar, target: 'es2020', legalComments: 'none' })

const codigo = conexion.outputFiles[0].text + '\n' + app.code
const hash = crypto.createHash('sha256').update(codigo).digest('hex').slice(0, 10)
const salida = 'public/app'
fs.rmSync(salida, { recursive: true, force: true })
fs.mkdirSync(salida, { recursive: true })
fs.writeFileSync(`${salida}/app.${hash}.js`, codigo)
fs.writeFileSync(path.join(dir, 'manifiesto.json'), JSON.stringify({ archivo: `/app/app.${hash}.js` }) + '\n')
console.log(`armar-app: ${modulos.length} módulos → /app/app.${hash}.js (${(Buffer.byteLength(codigo) / 1024).toFixed(0)} KB)`)
