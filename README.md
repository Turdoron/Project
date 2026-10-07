# TINBREW Contable

Sistema contable multi-cliente. Frontend en Vite, datos y login en Supabase, despliegue en Vercel.

## Jerarquía
Superadministrador → Administrador (cliente con licencia) → empresas → personal.

## Estructura
- `index.html` — la aplicación.
- `src/supabase.js` — conexión con Supabase (llaves públicas).
- `api/usuarios.js` — función de servidor: alta, edición, bloqueo y baja de usuarios y licencias. Usa la llave secreta.
- `supabase/migrations/` — esquema de la base de datos. Se ejecuta en orden (0001, 0002, 0003) en el SQL Editor de Supabase.

## Variables en Vercel
- `SUPABASE_SECRET_KEY` — llave secreta de Supabase. Solo en Vercel, nunca en el repositorio.

## Desarrollo local
```
npm install
npm run dev
```
