# Reglas de diseño — TINBREW Contable

Estas reglas se aplican a toda pantalla nueva. El programa está en `src/legado/` (un archivo por módulo) y la estructura de la pantalla en `src/marcado.html`; los estilos, en `app/estilos.css`.

## 1. Color (roles, nunca un color suelto)
Los componentes usan solo variables de rol. Para cambiar la marca o un tema se edita el bloque `:root` del principio del CSS.

| Rol | Variables |
|---|---|
| Superficies | `--papel` (fondo), `--panel` (tarjetas, tablas, campos), `--activo` (selección, hover) |
| Texto | `--tinta` (principal), `--tinta-suave` (secundario) |
| Bordes | `--linea` (decorativo), `--linea-fuerte` (divisor), `--borde-campo` (contorno de controles) |
| Marca | `--verde`, `--boton`, `--boton-hover`, `--boton-texto` |
| Acento | `--dorado` (solo decorativo), `--acento-texto` (si va como texto) |
| Contabilidad | `--debe`, `--haber` |
| Estados | `--exito`, `--advertencia`, `--peligro`, `--info`, cada uno con `-bg` y `-borde` |

Contraste (WCAG 2.2 AA, verificado en claro y oscuro):
- Texto normal ≥ 4.5:1 sobre `--papel`, `--panel` y `--activo`.
- Bordes de campos y controles ≥ 3:1 → `--borde-campo`.
- El dorado nunca es texto (2.4:1 en claro).
- Un estado nunca se comunica solo con color: va con texto o con signo (+/−).

## 2. Jerarquía y ley de Hick (menos opciones a la vez)
- **Un solo botón principal** (relleno) por pantalla. Los demás son `sec`; lo destructivo es `peligro`.
- **Máximo 3 controles por fila de tabla.** El siguiente paso lógico va como botón principal, "Ver" como secundario, y el resto dentro de `masAcciones()` ("Más").
- Menú lateral: grupos plegables en acordeón (se abre uno a la vez), máximo 7–9 opciones por grupo.
- Los atajos `Alt+número` llevan a las pantallas más usadas (`ATAJOS_VISTA`).

## 3. Accesibilidad (WCAG 2.2 AA)
- Documento con `lang="es"`, enlace "Saltar al contenido", un `h1` por pantalla, título de pestaña por pantalla.
- Los controles se etiquetan solos (`mejorarAccesibilidad`): usa `<label>` dentro de `.campo`; en tablas, el encabezado y la persona de la fila.
- Menú con `aria-current` y `aria-expanded`; ventanas con `aria-labelledby`.
- `prefers-reduced-motion` desactiva animaciones y brillos de carga.
- Controles de al menos 24 px; el foco siempre es visible.

## 4. Estados de carga
Los esqueletos (`#esqueleto`) se ven desde el primer pintado y al iniciar sesión mientras llegan los datos. Si pasan 15 s sin cargar aparece "Reintentar".

## 5. Cómo verificar
Antes de publicar cambios visuales: revisar claro y oscuro, anchos de 1280 y 1440 px, y correr una auditoría con axe (extensión *axe DevTools* o `axe-core`). El resultado esperado es 0 problemas.

## 6. Rendimiento (carga)
- `npm run build` hace dos pasos: `scripts/armar-app.mjs` une los módulos de `src/legado/` con la conexión de Supabase en un solo archivo minificado, `public/app/app.<hash>.js`, y después `next build` arma el sitio.
- La página carga ese archivo con `defer` y prioridad alta, porque sin él no aparece ni el inicio de sesión. El código de Next.js/React llega en paralelo.
- Todo lo de `/app/` y `/_next/static/` se guarda en caché por un año, porque el nombre cambia solo cuando cambia el contenido.
- Las fuentes (Lexend y Fraunces) se sirven desde el propio sitio con `next/font`. Solo se precarga Lexend.
- La conexión con Supabase (`src/supabase.js`) usa solo autenticación y base de datos, sin tiempo real ni archivos.
- Las librerías pesadas (Excel, PDF, ZIP) se cargan solo al usarlas, no al abrir el sistema.
- Costo de Next.js (React, ~124 KB): medido con 3G rápido y procesador 4× más lento, la primera visita tarda ~0.9 s más que con Vite (2.7 s contra 1.8 s). En laptop con 4G, y en las visitas siguientes desde el celular, el tiempo es el mismo.
