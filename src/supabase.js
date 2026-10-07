// Se empaqueta junto con el programa (scripts/armar-app.mjs); las dos variables se fijan al construir.
// Conexión liviana con Supabase: solo autenticación y base de datos (lo que usa la app).
// La librería completa "@supabase/supabase-js" trae además tiempo real, archivos y funciones, que no se usan:
// pesaban ~53 KB comprimidos en cada carga. Esta versión usa las mismas piezas internas y la misma clave de sesión,
// así que quien ya inició sesión sigue con su sesión.
import { AuthClient } from '@supabase/auth-js'
import { PostgrestClient } from '@supabase/postgrest-js'

// Estas dos llaves son públicas por diseño: la seguridad real la aplica RLS en la base de datos.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dvhymhamlyjljpyskmmj.supabase.co'
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_pgqLHs_nnQrQvQhxzroPgA_T8rqynke'

const auth = new AuthClient({
  url: `${URL}/auth/v1`,
  headers: { Authorization: `Bearer ${KEY}`, apikey: KEY },
  storageKey: `sb-${new globalThis.URL(URL).hostname.split('.')[0]}-auth-token`,   // la misma que usaba supabase-js
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  flowType: 'implicit',
})

// Cada consulta a la base lleva la clave pública y, si hay sesión, el token de la persona.
const conSesion = async (input, init) => {
  const { data } = await auth.getSession()
  const headers = new Headers(init && init.headers)
  if (!headers.has('apikey')) headers.set('apikey', KEY)
  if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${(data.session && data.session.access_token) || KEY}`)
  return fetch(input, { ...init, headers })
}
const rest = new PostgrestClient(`${URL}/rest/v1`, { headers: { apikey: KEY }, fetch: conSesion })

const sb = { auth, from: (tabla) => rest.from(tabla), rpc: (nombre, args, opciones) => rest.rpc(nombre, args, opciones) }

// Al entrar desde el enlace de "olvidé mi contraseña", la app tiene que pedir la clave nueva.
auth.onAuthStateChange((evento) => { if (evento === 'PASSWORD_RECOVERY') window.__recuperando = true })

window.sb = sb
window.__sbResolve()
