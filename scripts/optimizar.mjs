// Optimiza la carga del sitio ya construido por Vite (dist/index.html):
//  1. Minifica el JavaScript y el CSS propios (quita comentarios y espacios; el comportamiento no cambia).
//  2. Saca el JavaScript grande a un archivo aparte con nombre por contenido (assets/app.<hash>.js) y lo carga con "defer":
//     el navegador pinta el esqueleto de carga mientras descarga y compila el programa en segundo plano.
// Uso: node scripts/optimizar.mjs [carpeta=dist] [--sin-extraer]
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { transform } from 'esbuild'

const dir = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'dist'
const extraer = !process.argv.includes('--sin-extraer')
const archivo = path.join(dir, 'index.html')
let html = fs.readFileSync(archivo, 'utf8')
const antes = Buffer.byteLength(html)

// CSS
html = await replaceAsync(html, /<style>([\s\S]*?)<\/style>/g, async (_, css) => {
  const r = await transform(css, { loader: 'css', minify: true })
  return `<style>${r.code}</style>`
})
// Scripts propios sin src ni type (clásicos): se minifican sin renombrar nada global
let grande = null
html = await replaceAsync(html, /<script>([\s\S]*?)<\/script>/g, async (_, js) => {
  const r = await transform(js, { minify: true, target: 'es2020', legalComments: 'none' })
  const code = r.code.replace(/<\/script/gi, '<\\/script')
  if (extraer && Buffer.byteLength(code) > 50_000) { grande = code; return '<!--APP-->' }
  return `<script>${code}</script>`
})
if (grande) {
  const hash = crypto.createHash('sha256').update(grande).digest('hex').slice(0, 10)
  const nombre = `assets/app.${hash}.js`
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true })
  fs.writeFileSync(path.join(dir, nombre), grande)
  // Va en el mismo lugar donde estaba, con defer: se ejecuta cuando el HTML ya está leído, en el mismo orden de antes
  html = html.replace('<!--APP-->', `<script defer src="/${nombre}"></script>`)
}
fs.writeFileSync(archivo, html)
const kb = n => (n / 1024).toFixed(0) + ' KB'
console.log(`optimizar: index.html ${kb(antes)} → ${kb(Buffer.byteLength(html))}` + (grande ? `; app.js ${kb(Buffer.byteLength(grande))} aparte` : ''))

async function replaceAsync(str, re, fn) {
  const partes = []; let ultimo = 0
  for (const m of str.matchAll(re)) { partes.push(str.slice(ultimo, m.index), fn(...m)); ultimo = m.index + m[0].length }
  partes.push(str.slice(ultimo))
  return (await Promise.all(partes)).join('')
}
