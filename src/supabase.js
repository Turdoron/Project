import { createClient } from '@supabase/supabase-js'

// Estas dos llaves son públicas por diseño: la seguridad real la aplica RLS en la base de datos.
const URL = import.meta.env.VITE_SUPABASE_URL || 'https://dvhymhamlyjljpyskmmj.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_pgqLHs_nnQrQvQhxzroPgA_T8rqynke'

const sb = createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
// Al entrar desde el enlace de "olvidé mi contraseña", la app tiene que pedir la clave nueva.
sb.auth.onAuthStateChange((evento) => { if (evento === 'PASSWORD_RECOVERY') window.__recuperando = true })

window.sb = sb
window.__sbResolve()
