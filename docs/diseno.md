# Reglas de diseño — TINBREW Contable

Estas reglas se aplican a toda pantalla nueva. El programa está en `src/legado/` (un archivo por módulo) y la estructura de la pantalla en `src/marcado.html`; los estilos, en `app/estilos.css`.

## 1. Estilo: minimalismo editorial
- **Neutros cálidos** (tiza y grises cálidos) para todo y **un solo acento** bermellón (`--acento`), usado de forma quirúrgica: elemento activo del menú, foco del teclado, selección y casillas. Nunca en fondos grandes ni en el botón principal.
- **Botón principal en tinta** (casi negro), porque aparece muchas veces por pantalla. Secundario: blanco con filete; destructivo: `peligro`.
- **Tipografía con jerarquía estricta**:
  - Títulos de pantalla y cifras grandes en Fraunces **ligera** (300, 30–36 px, tracking negativo).
  - Rótulos (encabezados de tabla, etiquetas de cifras, grupos del menú) en Lexend **semibold**, 11 px, MAYÚSCULAS, tracking +0.07–0.1em.
  - Texto en Lexend 400, de 14 a 15.5 px.
- **Aire**: márgenes de pantalla de 56/36/16 px según el ancho, 32 px bajo el título y 24 px entre bloques.
- **Profundidad**:
  - Bordes de un pelo (`--linea`) y radios de 8/12/18 px (`--radio-chico`, `--radio`, `--radio-grande`).
  - Sombras difusas en dos capas (`--sombra`, `--sombra-hover`, `--sombra-flot`).
  - Cada tabla de la pantalla es una hoja blanca con sombra.
- **Microinteracciones** de 160 ms con `--suave`:
  - Botones y cifras se elevan 1 px al pasar el mouse.
  - Los campos muestran un halo de acento al enfocarlos.
  - Menús, «Más» y ventanas aparecen con un leve desplazamiento.
  - Todo se desactiva con «reducir movimiento».

## 1b. Color (roles, nunca un color suelto)
Los componentes usan solo variables de rol. Para cambiar la marca o un tema se edita el bloque `:root` del principio del CSS.

| Rol | Variables |
|---|---|
| Superficies | `--papel` (fondo tiza), `--panel` (tarjetas, tablas, campos), `--activo` (selección, hover) |
| Texto | `--tinta` (principal), `--tinta-suave` (secundario) |
| Bordes | `--linea` (filete), `--linea-fuerte` (divisor), `--borde-campo` (contorno de campos) |
| Énfasis y acción | `--verde` (énfasis; hoy igual a la tinta), `--boton`, `--boton-hover`, `--boton-texto` |
| Acento | `--acento` (indicadores y foco; nunca texto), `--acento-texto` (si va como texto), `--anillo` (halo de foco); `--dorado` es un alias |
| Contabilidad | `--debe`, `--haber` |
| Estados | `--exito`, `--advertencia`, `--peligro`, `--info`, cada uno con `-bg` y `-borde` |

Contraste (WCAG 2.2 AA, verificado en claro y oscuro):
- Texto normal ≥ 4.5:1 sobre `--papel`, `--panel` y `--activo`.
- Contorno de campos ≥ 3:1 → `--borde-campo`. El acento puro ≥ 3:1 (indicadores), nunca texto.
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
