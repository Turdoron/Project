import fs from 'node:fs'
import path from 'node:path'
import { preload } from 'react-dom'
import manifiesto from '../src/legado/manifiesto.json'

// La estructura de la pantalla (menú, esqueleto de carga, modales) se lee al construir y se entrega ya armada.
// El programa (src/legado/, unido por scripts/armar-app.mjs) la llena y la maneja; React no la vuelve a dibujar.
const marcado = fs.readFileSync(path.join(process.cwd(), 'src/marcado.html'), 'utf8')

export const dynamic = 'force-static'

export default function Inicio() {
  // Prioridad alta: sin el programa no aparece ni el inicio de sesión; lo de Next.js puede llegar después.
  preload(manifiesto.archivo, { as: 'script', fetchPriority: 'high' })
  return (
    <>
      <div id="raiz" style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: marcado }} />
      <script defer src={manifiesto.archivo} />
    </>
  )
}
