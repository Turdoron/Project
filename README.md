# ADCONTIS — Módulo Contable

Sistema contable multi-cliente hecho con Next.js. Los datos y el login viven en Supabase y el sitio se despliega en Vercel.

## Jerarquía
Superadministrador → Administrador (cliente con licencia) → empresas → personal.

## Estructura
- `app/layout.js`, `app/page.js` son la página de Next.js. Entregan la estructura de la pantalla ya armada y cargan el programa.
- `app/estilos.css` tiene los colores, la tipografía y el diseño (ver `docs/diseno.md`).
- `app/api/usuarios/route.js` es la función de servidor para el alta, edición, bloqueo y baja de usuarios y licencias. Usa la llave secreta.
- `src/marcado.html` es la estructura fija de la pantalla: menú, esqueleto de carga y modales.
- `src/legado/` es el programa, un archivo por módulo. Se unen en orden numérico y comparten funciones globales.
- `src/supabase.js` es la conexión con Supabase (llaves públicas).
- `scripts/armar-app.mjs` une `src/supabase.js` y `src/legado/` en `public/app/app.<hash>.js`. Corre solo antes de `dev` y `build`.
- `supabase/migrations/` es el esquema de la base de datos. Se ejecuta en orden en el SQL Editor de Supabase.

### Módulos (`src/legado/`)
| Archivo | Contenido |
|---|---|
| 01–05 | Almacenamiento en Supabase, deshacer, utilidades, catálogo base, cálculo contable |
| 06–08 | Usuarios y permisos, navegación, interfaz (esqueleto, accesibilidad, atajos, tema, avisos, modal) |
| 09–10 | Vistas generales, estados financieros y tablero fiscal |
| 11–15 | Planillas, cartera y empleados, compras, ventas, planilla rápida (Excel, pegar, aplicar a varios), prestaciones y finiquito |
| 16–18 | Impuestos (conciliación, retenciones, devolución de IVA), activos fijos, ISO |
| 19–23 | Empresas y capital, carga de facturas, producción (con reparto de costos comunes y productos conjuntos), libros en PDF, partidas |
| 24 | Arranque: decide entre el login y la app |

Un módulo nuevo se agrega con su número para indicar el orden. Las pantallas nuevas pueden hacerse como componentes de React en `app/`.

## Variables en Vercel
- `SUPABASE_SECRET_KEY`: llave secreta de Supabase. Va solo en Vercel, nunca en el repositorio.
- Opcionales: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (también se aceptan los nombres anteriores `VITE_…`). Si faltan, se usan las del proyecto.

## Desarrollo local
```
npm install
npm run dev
```
