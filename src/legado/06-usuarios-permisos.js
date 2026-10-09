/* ============ USUARIOS, ROLES Y PERMISOS ============ */
/* Cuentas y permisos. La identidad, las contraseñas, las licencias y el acceso a los datos de cada
   empresa los controla el servidor (Supabase con reglas por fila + la función app/api/usuarios/route.js, que es la
   única que usa la llave secreta). Lo que se decide aquí es qué módulos ve cada cargo: eso se aplica en
   esta aplicación, por lo que ordena el trabajo del equipo pero no sustituye al servidor.
   Jerarquía: Superadministrador > Administrador (cliente con licencia) > empresas > personal. */
const ROLES={
  superadmin:{nombre:'Superadministrador', grupo:'Dirección'},
  administrador:{nombre:'Administrador', grupo:'Dirección'},
  cont_gerente:{nombre:'Gerente de Contabilidad', grupo:'Contabilidad', depto:'contabilidad', eliminar:true},
  cont_auxiliar:{nombre:'Auxiliar Contable', grupo:'Contabilidad', depto:'contabilidad', eliminar:false},
  rrhh_gerente:{nombre:'Gerente de Recursos Humanos', grupo:'Recursos Humanos', depto:'rrhh', eliminar:true},
  rrhh_auxiliar:{nombre:'Auxiliar de Recursos Humanos', grupo:'Recursos Humanos', depto:'rrhh', eliminar:false},
  prod_gerente:{nombre:'Gerente de Producción', grupo:'Producción', depto:'produccion', pendiente:true},
  prod_auxiliar:{nombre:'Auxiliar de Producción', grupo:'Producción', depto:'produccion', pendiente:true},
  ventas_gerente:{nombre:'Gerente de Ventas', grupo:'Ventas', depto:'ventas', pendiente:true},
  ventas_auxiliar:{nombre:'Auxiliar de Ventas', grupo:'Ventas', depto:'ventas', pendiente:true},
  ventas_vendedor:{nombre:'Vendedor', grupo:'Ventas', depto:'ventas', pendiente:true},
  compras_gerente:{nombre:'Gerente de Compras', grupo:'Compras', depto:'compras'},
  compras_auxiliar:{nombre:'Auxiliar de Compras', grupo:'Compras', depto:'compras'},
};
/* Agrupados para el selector de "nuevo usuario", en el orden del organigrama. */
const ROLES_ASIGNABLES=['administrador','cont_gerente','cont_auxiliar','rrhh_gerente','rrhh_auxiliar',
  'prod_gerente','prod_auxiliar','ventas_gerente','ventas_auxiliar','ventas_vendedor',
  'compras_gerente','compras_auxiliar'];

/* Bitácora: solo la ve el Administrador dueño del espacio (y de rebote el
   superadmin no, porque no administra empresas). Guarda quién hizo qué,
   cuándo, y en qué empresa, para poder revisar después sin tener que
   preguntarle a cada persona. */
function registrarLog(accion,detalle){
  const u=usuarioActual(); if(!u) return;
  const admin=administradorDeSesion(); if(!admin) return;
  BD.bitacora=BD.bitacora||[];
  BD.bitacora.push({id:uid(),fecha:new Date().toISOString(),administradorId:admin,
    usuarioId:u.id,usuarioNombre:u.nombre||u.usuario,rol:(ROLES[u.rol]||{}).nombre||u.rol,
    empresaNombre:(emp()&&emp().nombre)||'',accion,detalle:detalle||''});
  const ult=BD.bitacora[BD.bitacora.length-1];
  if(window.sb) window.sb.from('bitacora').insert({user_id:u.id,empresa_id:(cacheEmpresas[BD.activa]?BD.activa:null),accion,
    detalle:{texto:detalle||'',usuarioNombre:ult.usuarioNombre,rol:ult.rol,empresaNombre:ult.empresaNombre}}).then(()=>{},()=>{});
}

function usuarioActual(){
  if(!BD.sesion) return null;
  return (BD.usuarios||[]).find(u=>u.id===BD.sesion) || null;
}
function rolActual(){
  const u=usuarioActual();
  return u ? ROLES[u.rol] : null;
}
function puedeEliminar(){
  const u=usuarioActual();
  if(!u) return false;
  if(u.rol==='administrador'||u.rol==='superadmin') return true;
  const r=ROLES[u.rol];
  return !!(r&&r.eliminar);
}
/* Asistente de IA: lo habilita el Superadministrador, Administrador por
   Administrador. Todo el personal de un Administrador habilitado lo hereda;
   si el Administrador no está habilitado, nadie de su equipo puede usarlo. */
function iaPermitidaSesion(){
  const admin=administradorDeSesion(); if(!admin) return false;
  const a=(BD.usuarios||[]).find(x=>x.id===admin);
  return !!(a&&a.iaPermitida&&a.activo!==false);
}
/* Qué pantallas puede ver cada rol. null = todas (Administrador). */
function vistasPermitidas(){
  const u=usuarioActual();
  if(!u) return [];
  if(u.rol==='superadmin') return ['usuarios'];
  if(u.rol==='administrador') return null;
  const r=ROLES[u.rol];
  if(!r) return ['home'];
  if(r.depto==='contabilidad') return ['home','resumen','cierreFiscal','catalogo','partidas','facturas','proveedores','clientes',
    'diario','mayor','inventario','libroInventarios','activosFijos','libroPequeno','libroVentas','libroCompras','devolucionIVA','retenciones','conciliacion','balanza','resultados','balance','flujoEfectivo','estadosFinancieros','tablero','vencimientos','aumentosCapital'];
  if(r.depto==='rrhh') return ['home','vencimientos','empleados','planillas','pagoPrestaciones','libroSalarios','contratos','contratoEditar','documentosLaborales','puestos'];
  if(r.depto==='produccion') return ['home','produccion'];
  if(r.depto==='ventas') return ['home','ventas'];
  if(r.depto==='compras') return ['home','compras'];
  return ['home'];
}
function puedeVer(vista){
  /* Producción solo existe para una industria productora — para nadie más, ni el Administrador. */
  if(vista==='produccion'&&!esProductora(emp())) return false;
  const permitidas=vistasPermitidas();
  return permitidas===null || permitidas.includes(vista);
}

/* Cada Administrador es dueño de su propio conjunto de empresas y de su propio
   personal (Gerentes, Auxiliares) — un Administrador no ve las empresas ni el
   personal de otro, aunque los dos usen el mismo archivo en la misma
   computadora. Esto es lo que separa a un despacho "A" de un despacho "B"
   dentro de este mismo sistema. Devuelve el id del Administrador dueño del
   espacio que le corresponde ver a quien tiene la sesión abierta. */
function administradorDeSesion(){
  const u=usuarioActual();
  if(!u) return null;
  if(u.rol==='administrador') return u.id;
  if(u.rol==='superadmin') return null;   // el superadmin no administra empresas
  return u.administradorId||null;          // gerentes, auxiliares y el resto del personal
}
/* Las empresas que puede ver la sesión actual — nunca BD.empresas directo.
   El Administrador ve siempre todas las suyas; su personal solo ve las que
   ese Administrador le asignó puntualmente ("belongs to"). Si a una cuenta
   de personal nunca se le asignó ninguna (campo sin definir, cuentas viejas
   de antes de este cambio), ve todas por compatibilidad. */
function empresasVisibles(){
  const u=usuarioActual();
  const admin=administradorDeSesion();
  if(!admin) return [];
  const propias=BD.empresas.filter(e=>e.administradorId===admin);
  if(!u||u.rol==='administrador') return propias;
  if(Array.isArray(u.empresasAsignadas)){
    if(!u.empresasAsignadas.length) return [];   // asignado explícitamente a ninguna
    return propias.filter(e=>u.empresasAsignadas.includes(e.id));
  }
  return propias;   // sin el campo definido: compatibilidad con cuentas viejas
}

/* Motivo por el que una cuenta no puede entrar (o null si puede). La fuerza real la pone
   el servidor: sin licencia vigente, las empresas simplemente no se entregan. */
function motivoBloqueo(u){
  if(!u) return 'Tu cuenta no está configurada en el sistema. Consultá con tu administrador.';
  if(u.activo===false) return 'Este usuario está bloqueado. Consultá con tu administrador.';
  if(u.rol==='superadmin') return null;
  const jefeId=u.rol==='administrador'?u.id:u.administradorId;
  const jefe=(BD.usuarios||[]).find(x=>x.id===jefeId);
  if(jefe && jefe.activo===false) return 'El Administrador del que depende esta cuenta está bloqueado, así que esta cuenta tampoco puede entrar.';
  const lic=jefe&&jefe.licencia;
  if(!lic) return 'Esta cuenta no tiene una licencia asignada. Consultá con tu proveedor.';
  if(lic.estado!=='activa') return 'La licencia está suspendida. Consultá con tu proveedor.';
  if(lic.vence && lic.vence<new Date().toISOString().slice(0,10)) return 'La licencia venció el '+lic.vence+'. Consultá con tu proveedor para renovarla.';
  return null;
}

async function apiUsuarios(payload){
  const {data:{session}}=await window.sb.auth.getSession();
  if(!session) throw new Error('Tu sesión terminó. Iniciá sesión de nuevo.');
  let r;
  try{
    r=await fetch('/api/usuarios',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify(payload)});
  }catch(e){ throw new Error('No hay conexión con el servidor.'); }
  const j=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(j.error||('Error '+r.status));
  return j;
}

function entrarConSesion(u){
  BD.sesion=u.id; guardar();
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('app').style.display='';
  VISTA = u.rol==='superadmin' ? 'usuarios' : 'home';
  filtros={};
  pintar();
  ocultarEsqueleto();
}

const traduceAuth=m=>/invalid login|credentials/i.test(m)?'Correo o contraseña incorrectos.':/rate limit|too many/i.test(m)?'Demasiados intentos. Esperá unos minutos.':m;

async function iniciarSesionApp(){
  mostrarEsqueleto();
  try{ BD=await cargar(); }
  catch(err){ try{ await window.sb.auth.signOut(); }catch(e){} BD=VACIO(); pantallaLogin('No se pudo cargar tu información: '+err.message); return; }
  const u=usuarioActual();
  const motivo=motivoBloqueo(u);
  if(motivo){ try{ await window.sb.auth.signOut(); }catch(e){} BD=VACIO(); pantallaLogin(motivo); return; }
  if(u.debeCambiarClave){ pantallaCambioClave(u); return; }
  const eA=emp(); if(eA) asegurarCatalogoMinimo(eA);
  entrarConSesion(u);
}

function pantallaLogin(mensajeError){
  ocultarEsqueleto();
  document.title='Iniciar sesión — Módulo Contable ADCONTIS';
  const cont=document.getElementById('loginScreen');
  cont.innerHTML=`<div class="login-caja">
    <img class="login-logo logo-claro" alt="ADCONTIS" src="/logo-azul.png" width="378" height="363"><img class="login-logo logo-oscuro" alt="ADCONTIS" src="/logo-blanco.png" width="378" height="363">
    <h1>Módulo Contable</h1>
    <p class="sub">Iniciá sesión para continuar</p>
    ${mensajeError?`<div class="login-error" role="alert">${esc(mensajeError)}</div>`:''}
    <div class="campo-login"><label>Correo electrónico</label><input id="loginUsuario" type="email" autocomplete="username"></div>
    <div class="campo-login"><label>Contraseña</label><input id="loginClave" type="password" autocomplete="current-password"></div>
    <button class="btn" id="btnLogin" type="button">Ingresar</button>
    <p style="text-align:center;margin-top:14px">
      <a href="#" id="linkRestablecer" style="font-size:12.5px;color:var(--tinta-suave)">¿Olvidaste tu contraseña?</a></p>
  </div>`;
  cont.style.display='flex';
  document.getElementById('app').style.display='none';
  const intentar=async()=>{
    const correo=document.getElementById('loginUsuario').value.trim().toLowerCase();
    const clave=document.getElementById('loginClave').value;
    if(!correo||!clave){ pantallaLogin('Escribí el correo y la contraseña.'); return; }
    const btn=document.getElementById('btnLogin'); btn.disabled=true; btn.textContent='Entrando…';
    const {error}=await window.sb.auth.signInWithPassword({email:correo,password:clave});
    if(error){ pantallaLogin(traduceAuth(error.message)); return; }
    await iniciarSesionApp();
  };
  document.getElementById('linkRestablecer').onclick=ev=>{ ev.preventDefault(); pantallaRecuperar(); };
  document.getElementById('btnLogin').onclick=intentar;
  cont.querySelectorAll('input').forEach(i=>i.onkeydown=ev=>{ if(ev.key==='Enter') intentar(); });
  setTimeout(()=>{ const x=document.getElementById('loginUsuario'); if(x) x.focus(); },0);
}

/* Cambio obligatorio de clave (primer ingreso, o tras pedir un enlace de recuperación). */
function pantallaCambioClave(u,mensajeError){
  ocultarEsqueleto();
  const cont=document.getElementById('loginScreen');
  cont.innerHTML=`<div class="login-caja">
    <h1>Definí tu contraseña</h1>
    <p class="sub">${esc(u.nombre||u.usuario||'Tu cuenta')}: por seguridad tenés que elegir una contraseña nueva antes de seguir.</p>
    ${mensajeError?`<div class="login-error">${esc(mensajeError)}</div>`:''}
    <div class="campo-login"><label>Nueva contraseña (mínimo 8 caracteres)</label><input id="nuevaClave" type="password" autocomplete="new-password"></div>
    <div class="campo-login"><label>Repetila</label><input id="nuevaClave2" type="password" autocomplete="new-password"></div>
    <button class="btn" id="btnGuardarClave" type="button">Guardar y entrar</button>
  </div>`;
  cont.style.display='flex';
  document.getElementById('app').style.display='none';
  const guardarClave=async()=>{
    const c1=document.getElementById('nuevaClave').value, c2=document.getElementById('nuevaClave2').value;
    if(c1.length<8){ pantallaCambioClave(u,'La contraseña tiene que tener al menos 8 caracteres.'); return; }
    if(c1!==c2){ pantallaCambioClave(u,'Las dos contraseñas no coinciden.'); return; }
    const {error}=await window.sb.auth.updateUser({password:c1});
    if(error){ pantallaCambioClave(u,traduceAuth(error.message)); return; }
    await window.sb.rpc('clave_cambiada');
    window.__recuperando=false;
    await iniciarSesionApp();
  };
  document.getElementById('btnGuardarClave').onclick=guardarClave;
  cont.querySelectorAll('input').forEach(i=>i.onkeydown=ev=>{ if(ev.key==='Enter') guardarClave(); });
  setTimeout(()=>{ const x=document.getElementById('nuevaClave'); if(x) x.focus(); },0);
}

function pantallaRecuperar(mensaje){
  ocultarEsqueleto();
  const cont=document.getElementById('loginScreen');
  cont.innerHTML=`<div class="login-caja">
    <h1>Recuperar contraseña</h1>
    <p class="sub">Escribí tu correo y te enviamos un enlace para elegir una contraseña nueva.</p>
    ${mensaje?`<div class="login-error">${esc(mensaje)}</div>`:''}
    <div class="campo-login"><label>Correo electrónico</label><input id="correoRec" type="email" autocomplete="email"></div>
    <button class="btn" id="btnRecuperar" type="button">Enviar enlace</button>
    <p style="text-align:center;margin-top:14px"><a href="#" id="linkVolver" style="font-size:12.5px;color:var(--tinta-suave)">Volver</a></p>
  </div>`;
  const enviar=async()=>{
    const correo=document.getElementById('correoRec').value.trim().toLowerCase();
    if(!correo){ pantallaRecuperar('Escribí tu correo.'); return; }
    await window.sb.auth.resetPasswordForEmail(correo,{redirectTo:location.origin});
    pantallaRecuperar('Si el correo está registrado, te enviamos un enlace. Revisá también la carpeta de spam.');
  };
  document.getElementById('btnRecuperar').onclick=enviar;
  document.getElementById('linkVolver').onclick=ev=>{ ev.preventDefault(); pantallaLogin(); };
  setTimeout(()=>{ const x=document.getElementById('correoRec'); if(x) x.focus(); },0);
}
function cerrarSesion(){
  confirmar('Se cerrará la sesión actual.',async()=>{
    tGuardar&&clearTimeout(tGuardar); await sincronizar();
    BD=VACIO();
    try{ await window.sb.auth.signOut(); }catch(e){}
    VISTA='home'; borrador=null; borradorPlanilla=null; lote=[];
    pantallaLogin();
  },'Cerrar sesión');
}

