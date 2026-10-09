// Función de servidor (ruta de Next.js en Vercel): crea, edita, bloquea y elimina usuarios.
// Usa la llave secreta, que NUNCA sale de aquí. Cada llamada valida quién la hace.
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://dvhymhamlyjljpyskmmj.supabase.co'
const KEY = process.env.SUPABASE_SECRET_KEY
const ROLES_PERSONAL = ['propietario', 'cont_gerente', 'cont_auxiliar', 'rrhh_gerente', 'rrhh_auxiliar', 'prod_gerente', 'prod_auxiliar',
  'ventas_gerente', 'ventas_auxiliar', 'ventas_vendedor', 'compras_gerente', 'compras_auxiliar']
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

class Err extends Error { constructor(m, c = 400) { super(m); this.c = c } }

export async function POST(req) {
  try {
    if (!KEY) throw new Err('Falta SUPABASE_SECRET_KEY en el servidor.', 500)
    const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })

    const token = (req.headers.get('authorization') || '').replace(/^Bearer /, '')
    const { data: { user }, error: eAuth } = await db.auth.getUser(token)
    if (eAuth || !user) throw new Err('Sesión no válida.', 401)
    const { data: yo, error: eYo } = await db.from('perfiles').select('*').eq('id', user.id).single()
    if (eYo) throw new Err('No se pudo leer tu perfil en la base de datos: ' + eYo.message, 500)
    if (!yo || !yo.activo) throw new Err('Cuenta no autorizada.', 403)
    // El Propietario (dueño de una empresa cliente) gestiona al personal de SUS empresas, dentro de la licencia de su Administrador.
    const esProp = yo.rol === 'empleado' && yo.rol_app === 'propietario'
    if (yo.rol !== 'superadmin' && yo.rol !== 'administrador' && !esProp) throw new Err('No tenés permiso para gestionar usuarios.', 403)

    const b = (await req.json().catch(() => null)) || {}
    const esSuper = yo.rol === 'superadmin'
    const jefe = esProp ? yo.admin_id : yo.id   // dueño de la licencia y de las empresas
    // Empresas sobre las que actúa quien llama: el Administrador, todas las suyas; el Propietario, solo las que tiene asignadas.
    const alcance = async () => {
      if (!esProp) return ((await db.from('empresas').select('id').eq('admin_id', jefe)).data || []).map(e => e.id)
      const { data: m } = await db.from('miembros').select('empresa_id').eq('user_id', yo.id)
      const ids = (m || []).map(x => x.empresa_id)
      if (!ids.length) return []
      return ((await db.from('empresas').select('id').eq('admin_id', jefe).in('id', ids)).data || []).map(e => e.id)
    }

    // El usuario sobre el que se actúa debe estar dentro del alcance de quien llama.
    const objetivo = async (id) => {
      const { data: t } = await db.from('perfiles').select('*').eq('id', id).single()
      let ok = t && (esSuper ? t.rol === 'administrador' : t.admin_id === jefe && t.rol !== 'administrador' && t.rol !== 'superadmin')
      if (ok && esProp) {   // solo personal que trabaja únicamente en empresas del propietario
        const mias = await alcance()
        const { data: m } = await db.from('miembros').select('empresa_id').eq('user_id', t.id)
        const suyas = (m || []).map(x => x.empresa_id)
        ok = suyas.length > 0 && suyas.every(e => mias.includes(e))
      }
      if (!ok) throw new Err('Esa cuenta no está a tu alcance.', 403)
      return t
    }
    const empresasPropias = async (ids) => {
      const lista = Array.isArray(ids) ? ids : []
      if (!lista.length) return []
      const mias = await alcance()
      return lista.filter(id => mias.includes(id))
    }
    const asignar = async (userId, ids) => {
      const mias = await alcance()
      if (mias.length) await db.from('miembros').delete().eq('user_id', userId).in('empresa_id', mias)
      const validas = await empresasPropias(ids)
      if (validas.length) {
        const { error } = await db.from('miembros').insert(validas.map(empresa_id => ({ empresa_id, user_id: userId })))
        if (error) throw new Err(error.message)
      }
    }
    const licencia = (v) => ({
      max_empresas: Math.min(Math.max(parseInt(v.limiteEmpresas, 10) || 10, 1), 100000),
      max_usuarios: Math.min(Math.max(parseInt(v.maxUsuarios, 10) || 25, 1), 100000),
      vence: v.vence || null,
    })

    if (b.accion === 'crear') {
      const email = String(b.email || '').trim().toLowerCase()
      if (!EMAIL.test(email)) throw new Err('Escribí un correo válido.')
      if (!String(b.nombre || '').trim()) throw new Err('Escribí el nombre.')
      if (String(b.clave || '').length < 8) throw new Err('La contraseña tiene que tener al menos 8 caracteres.')
      let perfil
      if (esSuper) {
        perfil = { rol: 'administrador', rol_app: 'administrador', admin_id: null, ia_permitida: !!b.iaPermitida }
      } else {
        const { data: lic } = await db.from('licencias').select('*').eq('admin_id', jefe).single()
        if (!lic || lic.estado !== 'activa' || (lic.vence && lic.vence < new Date().toISOString().slice(0, 10)))
          throw new Err('Tu licencia no está vigente.', 403)
        const { count } = await db.from('perfiles').select('id', { count: 'exact', head: true }).eq('admin_id', jefe)
        if (count >= lic.max_usuarios) throw new Err(`Llegaste al límite de ${lic.max_usuarios} usuarios de tu licencia.`, 403)
        if (!ROLES_PERSONAL.includes(b.rol)) throw new Err('Rol no válido.')
        // Un usuario del personal tiene que quedar en al menos una empresa de quien lo crea (el propietario no puede crear cuentas sueltas).
        if (esProp && !(await empresasPropias(b.empresas)).length) throw new Err('Elegí al menos una de tus empresas para este usuario.')
        perfil = { rol: 'empleado', rol_app: b.rol, admin_id: jefe, ia_permitida: false }
      }
      const { data: creado, error: eC } = await db.auth.admin.createUser({ email, password: b.clave, email_confirm: true })
      if (eC) throw new Err(/registered|exists/i.test(eC.message) ? 'Ya existe una cuenta con ese correo.' : eC.message)
      const id = creado.user.id
      try {
        const { error: eP } = await db.from('perfiles').insert({
          id, nombre: String(b.nombre).trim(), email, usuario: email, debe_cambiar_clave: true, ...perfil })
        if (eP) throw new Err(eP.message)
        if (esSuper) {
          const { error: eL } = await db.from('licencias').insert({ admin_id: id, estado: 'activa', ...licencia(b) })
          if (eL) throw new Err(eL.message)
        } else {
          await asignar(id, b.empresas)
        }
      } catch (e) {
        await db.auth.admin.deleteUser(id)   // sin dejar cuentas a medias
        throw e
      }
      return Response.json({ ok: true, id }, { status: 200 })
    }

    if (b.accion === 'editar') {
      const t = await objetivo(b.id)
      const cambios = {}
      if (String(b.nombre || '').trim()) cambios.nombre = String(b.nombre).trim()
      if (esSuper) cambios.ia_permitida = !!b.iaPermitida
      else if (ROLES_PERSONAL.includes(b.rol)) cambios.rol_app = b.rol
      const auth = {}
      const email = String(b.email || '').trim().toLowerCase()
      if (email && email !== t.email) {
        if (!EMAIL.test(email)) throw new Err('Escribí un correo válido.')
        auth.email = email; auth.email_confirm = true; cambios.email = email; cambios.usuario = email
      }
      if (b.clave) {
        if (String(b.clave).length < 8) throw new Err('La contraseña tiene que tener al menos 8 caracteres.')
        auth.password = b.clave; cambios.debe_cambiar_clave = true
      }
      if (Object.keys(auth).length) {
        const { error } = await db.auth.admin.updateUserById(t.id, auth)
        if (error) throw new Err(/registered|exists/i.test(error.message) ? 'Ya existe una cuenta con ese correo.' : error.message)
      }
      const { error: eU } = await db.from('perfiles').update(cambios).eq('id', t.id)
      if (eU) throw new Err(eU.message)
      if (esSuper) {
        const { error } = await db.from('licencias').update(licencia(b)).eq('admin_id', t.id)
        if (error) throw new Err(error.message)
      } else if (Array.isArray(b.empresas)) {
        if (esProp && !(await empresasPropias(b.empresas)).length) throw new Err('El usuario tiene que quedar en al menos una de tus empresas.')
        await asignar(t.id, b.empresas)
      }
      return Response.json({ ok: true }, { status: 200 })
    }

    if (b.accion === 'alternar') {
      const t = await objetivo(b.id)
      if (t.id === yo.id) throw new Err('No podés bloquear tu propia cuenta.')
      const { error } = await db.from('perfiles').update({ activo: !t.activo }).eq('id', t.id)
      if (error) throw new Err(error.message)
      return Response.json({ ok: true, activo: !t.activo }, { status: 200 })
    }

    if (b.accion === 'borrar') {
      const t = await objetivo(b.id)
      if (t.id === yo.id) throw new Err('No podés eliminar tu propia cuenta.')
      if (t.rol === 'administrador') {   // su personal depende de él: se elimina con él
        const { data: equipo } = await db.from('perfiles').select('id').eq('admin_id', t.id)
        for (const m of equipo || []) await db.auth.admin.deleteUser(m.id)
      }
      const { error } = await db.auth.admin.deleteUser(t.id)
      if (error) throw new Err(error.message)
      return Response.json({ ok: true }, { status: 200 })
    }

    throw new Err('Acción desconocida.')
  } catch (e) {
    return Response.json({ error: e.message || 'Error del servidor' }, { status: e.c || 500 })
  }
}

// Cualquier otro método responde como antes, con el mensaje en JSON.
export function GET() {
  return Response.json({ error: 'Método no permitido' }, { status: 405, headers: { Allow: 'POST' } })
}
