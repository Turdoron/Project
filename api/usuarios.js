// Función de servidor (Vercel): crea, edita, bloquea y elimina usuarios.
// Usa la llave secreta, que NUNCA sale de aquí. Cada llamada valida quién la hace.
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://dvhymhamlyjljpyskmmj.supabase.co'
const KEY = process.env.SUPABASE_SECRET_KEY
const ROLES_PERSONAL = ['cont_gerente', 'cont_auxiliar', 'rrhh_gerente', 'rrhh_auxiliar', 'prod_gerente', 'prod_auxiliar',
  'ventas_gerente', 'ventas_auxiliar', 'ventas_vendedor', 'compras_gerente', 'compras_auxiliar']
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

class Err extends Error { constructor(m, c = 400) { super(m); this.c = c } }

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') throw new Err('Método no permitido', 405)
    if (!KEY) throw new Err('Falta SUPABASE_SECRET_KEY en el servidor.', 500)
    const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })

    const token = (req.headers.authorization || '').replace(/^Bearer /, '')
    const { data: { user }, error: eAuth } = await db.auth.getUser(token)
    if (eAuth || !user) throw new Err('Sesión no válida.', 401)
    const { data: yo } = await db.from('perfiles').select('*').eq('id', user.id).single()
    if (!yo || !yo.activo) throw new Err('Cuenta no autorizada.', 403)
    if (yo.rol !== 'superadmin' && yo.rol !== 'administrador') throw new Err('No tenés permiso para gestionar usuarios.', 403)

    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const esSuper = yo.rol === 'superadmin'

    // El usuario sobre el que se actúa debe estar dentro del alcance de quien llama.
    const objetivo = async (id) => {
      const { data: t } = await db.from('perfiles').select('*').eq('id', id).single()
      const ok = t && (esSuper ? t.rol === 'administrador' : t.admin_id === yo.id)
      if (!ok) throw new Err('Esa cuenta no está a tu alcance.', 403)
      return t
    }
    const empresasPropias = async (ids) => {
      const lista = Array.isArray(ids) ? ids : []
      if (!lista.length) return []
      const { data } = await db.from('empresas').select('id').eq('admin_id', yo.id).in('id', lista)
      return (data || []).map(e => e.id)
    }
    const asignar = async (userId, ids) => {
      await db.from('miembros').delete().eq('user_id', userId)
        .in('empresa_id', (await db.from('empresas').select('id').eq('admin_id', yo.id)).data.map(e => e.id))
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
        const { data: lic } = await db.from('licencias').select('*').eq('admin_id', yo.id).single()
        if (!lic || lic.estado !== 'activa' || (lic.vence && lic.vence < new Date().toISOString().slice(0, 10)))
          throw new Err('Tu licencia no está vigente.', 403)
        const { count } = await db.from('perfiles').select('id', { count: 'exact', head: true }).eq('admin_id', yo.id)
        if (count >= lic.max_usuarios) throw new Err(`Llegaste al límite de ${lic.max_usuarios} usuarios de tu licencia.`, 403)
        if (!ROLES_PERSONAL.includes(b.rol)) throw new Err('Rol no válido.')
        perfil = { rol: 'empleado', rol_app: b.rol, admin_id: yo.id, ia_permitida: false }
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
      return res.status(200).json({ ok: true, id })
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
        await asignar(t.id, b.empresas)
      }
      return res.status(200).json({ ok: true })
    }

    if (b.accion === 'alternar') {
      const t = await objetivo(b.id)
      if (t.id === yo.id) throw new Err('No podés bloquear tu propia cuenta.')
      const { error } = await db.from('perfiles').update({ activo: !t.activo }).eq('id', t.id)
      if (error) throw new Err(error.message)
      return res.status(200).json({ ok: true, activo: !t.activo })
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
      return res.status(200).json({ ok: true })
    }

    throw new Err('Acción desconocida.')
  } catch (e) {
    return res.status(e.c || 500).json({ error: e.message || 'Error del servidor' })
  }
}
