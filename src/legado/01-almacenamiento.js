/* ============ ALMACENAMIENTO (Supabase) ============ */
/* Los datos viven en la nube: cada persona recibe SOLO lo que el servidor le permite ver
   (reglas RLS por administrador, empresa y rol). Aquí se arma, en memoria, el mismo objeto
   BD que usaba la app, y guardar() sincroniza al servidor lo que cambió. */
const VACIO=()=>({empresas:[],activa:null,usuarios:[],sesion:null,bitacora:[]});
const modo='nube';
let tGuardar=null, sincronizando=false, pendiente=false, cacheEmpresas={};
const sbOk=r=>{ if(r.error) throw new Error(r.error.message); return r.data||[]; };
const msgError=m=>/row-level security|violates/i.test(m)?'El servidor no permitió la operación ('+m+'). Puede que la licencia no esté vigente o que hayas llegado al límite de tu plan.':m;

async function cargar(){
  const sb=window.sb;
  const {data:{session}}=await sb.auth.getSession();
  if(!session) return VACIO();
  const uid0=session.user.id;
  const per=sbOk(await sb.from('perfiles').select('*'));
  const yo=per.find(p=>p.id===uid0);
  if(!yo) return VACIO();
  const esSuper=yo.rol==='superadmin';
  const [lic,emps,mie,bit]=await Promise.all([
    sb.from('licencias').select('*').then(sbOk),
    esSuper?Promise.resolve([]):sb.from('empresas').select('id,admin_id,nombre,datos,version').then(sbOk),
    sb.from('miembros').select('empresa_id,user_id').then(sbOk),
    sb.from('bitacora').select('*').order('fecha',{ascending:false}).limit(500).then(sbOk)
  ]);
  const aRol=p=>p.rol==='superadmin'?'superadmin':p.rol==='administrador'?'administrador':(p.rol_app||'cont_auxiliar');
  const bd=VACIO();
  bd.sesion=uid0;
  bd.usuarios=per.map(p=>({id:p.id,usuario:p.email||p.usuario||'',nombre:p.nombre,rol:aRol(p),
    administradorId:p.admin_id||null,activo:p.activo,iaPermitida:p.ia_permitida,debeCambiarClave:p.debe_cambiar_clave,
    empresasAsignadas:p.rol==='empleado'?mie.filter(m=>m.user_id===p.id).map(m=>m.empresa_id):undefined,
    licencia:lic.find(l=>l.admin_id===p.id)||null}));
  cacheEmpresas={};
  bd.empresas=emps.map(e=>{
    const datos=e.datos||{};
    cacheEmpresas[e.id]={json:JSON.stringify(datos),version:e.version};
    return {...datos,id:e.id,nombre:e.nombre,administradorId:e.admin_id};
  });
  const admin=yo.rol==='administrador'?yo.id:yo.admin_id;
  bd.bitacora=bit.map(b=>({id:String(b.id),fecha:b.fecha,administradorId:admin,usuarioId:b.user_id,
    usuarioNombre:(b.detalle||{}).usuarioNombre||'',rol:(b.detalle||{}).rol||'',
    empresaNombre:(b.detalle||{}).empresaNombre||'',accion:b.accion,detalle:(b.detalle||{}).texto||''}));
  let activa=null; try{ activa=localStorage.getItem('contagt_activa_'+uid0); }catch(e){}
  bd.activa=bd.empresas.some(e=>e.id===activa)?activa:(bd.empresas[0]?bd.empresas[0].id:null);
  return bd;
}
async function recargarDatos(){
  const activa=BD.activa;
  BD=await cargar();
  if(BD.empresas.some(e=>e.id===activa)) BD.activa=activa;
}
function guardar(){
  if(!window.sb||!BD.sesion) return;
  try{ localStorage.setItem('contagt_activa_'+BD.sesion,BD.activa||''); }catch(e){}
  clearTimeout(tGuardar);
  tGuardar=setTimeout(sincronizar,700);
}
async function sincronizar(){
  tGuardar=null;
  if(sincronizando){ pendiente=true; return; }
  const u=usuarioActual();
  if(!u||u.rol==='superadmin') return;
  sincronizando=true;
  const sb=window.sb;
  try{
    const vivos=new Set();
    for(const e of [...BD.empresas]){
      vivos.add(e.id);
      const {id,administradorId,...datos}=e;
      const json=JSON.stringify(datos);
      const c=cacheEmpresas[e.id];
      if(!c){
        const r=await sb.from('empresas').insert({id:e.id,admin_id:u.id,nombre:e.nombre||'',datos}).select('version').single();
        if(r.error){
          BD.empresas=BD.empresas.filter(x=>x.id!==e.id);
          if(BD.activa===e.id) BD.activa=BD.empresas[0]?BD.empresas[0].id:null;
          cerrarModal(); VISTA='empresas'; pintar(); avisar('No se pudo crear la empresa: '+msgError(r.error.message),'Atención');
          continue;
        }
        cacheEmpresas[e.id]={json,version:r.data.version};
      }else if(c.json!==json){
        const r=await sb.from('empresas').update({nombre:e.nombre||'',datos}).eq('id',e.id).eq('version',c.version).select('version');
        if(r.error) throw new Error(r.error.message);
        if(!r.data.length){
          await recargarDatos(); pintar();
          avisar('Otra persona modificó esta empresa al mismo tiempo. Se cargó la versión más reciente; repetí tu último cambio.','Atención');
          return;
        }
        cacheEmpresas[e.id]={json,version:r.data[0].version};
      }
    }
    for(const id of Object.keys(cacheEmpresas)){
      if(vivos.has(id)) continue;
      const r=await sb.from('empresas').delete().eq('id',id);
      if(r.error) throw new Error(r.error.message);
      delete cacheEmpresas[id];
    }
  }catch(err){
    avisar('No se pudo guardar en la nube: '+msgError(err.message)+'\nTus cambios siguen en pantalla; se reintentará en el próximo guardado.','Sin conexión');
  }finally{
    sincronizando=false;
    if(pendiente){ pendiente=false; guardar(); }
  }
}
addEventListener('beforeunload',ev=>{ if(tGuardar||sincronizando){ ev.preventDefault(); ev.returnValue=''; } });
let BD=VACIO();
const emp=()=>{
  const e=BD.empresas.find(x=>x.id===BD.activa);
  if(!e) return null;
  const admin=administradorDeSesion();
  return (admin && e.administradorId===admin) ? e : null;
};

