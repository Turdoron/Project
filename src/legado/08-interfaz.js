/* ============ ESQUELETO DE CARGA ============ */
/* Está en el HTML desde el primer pintado. Se oculta cuando aparece el login o la aplicación,
   y reaparece mientras se cargan los datos justo después de iniciar sesión. */
let _tEsq=null;
function mostrarEsqueleto(){
  const e=document.getElementById('esqueleto'); if(!e) return;
  document.getElementById('esqError').hidden=true;
  document.getElementById('loginScreen').style.display='none';   // el esqueleto reemplaza al login mientras cargan los datos
  e.hidden=false; document.body.setAttribute('aria-busy','true');
  clearTimeout(_tEsq); _tEsq=setTimeout(()=>{ if(!e.hidden) document.getElementById('esqError').hidden=false; },15000);
}
function ocultarEsqueleto(){
  clearTimeout(_tEsq);
  const e=document.getElementById('esqueleto'); if(e) e.hidden=true;
  document.body.removeAttribute('aria-busy');
}

/* ============ CAMPOS DE FECHA ESCRITOS A MANO ============ */
/* Al escribir una fecha, el navegador avisa un cambio por cada parte: con el mes ya hay fecha
   (con el año viejo) y con el primer dígito del año queda "0002". Las pantallas que se redibujan
   al cambiar la fecha (filtros Desde/Hasta de libros y reportes) sacaban el cursor del campo y
   nunca se podía terminar de escribir el año. Aquí, mientras se escribe, esos avisos se retienen,
   y se entregan una sola vez al terminar: al salir del campo, con Enter, o al elegir del calendario
   (eso llega sin teclas y pasa directo). Una fecha con año menor a 1900 se toma como incompleta:
   si se sale del campo así, vuelve a mostrar la fecha que tenía (para no dejar a la vista un "0002" que no se aplicó). */
(()=>{
  const esFecha=el=>el&&el.tagName==='INPUT'&&el.type==='date';
  const tecleando=new WeakSet(), retenido=new WeakSet(), previo=new WeakMap();
  const incompleta=el=>!!el.value&&+el.value.slice(0,4)<1900;
  const entregar=el=>{
    retenido.delete(el);
    if(incompleta(el)) return;
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  };
  document.addEventListener('focusin',ev=>{ if(esFecha(ev.target)) previo.set(ev.target,ev.target.value); },true);
  document.addEventListener('keydown',ev=>{
    const el=ev.target; if(!esFecha(el)) return;
    if(ev.key==='Enter'){ if(retenido.has(el)){ ev.preventDefault(); entregar(el); } return; }
    if(ev.key!=='Tab'&&ev.key!=='Shift'&&ev.key!=='Escape') tecleando.add(el);
  },true);
  ['input','change'].forEach(tipo=>document.addEventListener(tipo,ev=>{
    const el=ev.target;
    if(!esFecha(el)||!ev.isTrusted) return;          // los que entrega este mismo código pasan
    if(tecleando.has(el)||incompleta(el)){ ev.stopImmediatePropagation(); retenido.add(el); }
  },true));
  /* Si se sale del campo tocando otra cosa (un botón de acción u otro campo) y al entregar la fecha la
     pantalla se redibuja, lo tocado ya no existe cuando se suelta el clic: se busca su equivalente
     nuevo y se pulsa (botón) o se enfoca (campo). */
  let tocado=null;
  document.addEventListener('pointerdown',ev=>{
    const el=ev.target.closest&&ev.target.closest('[data-accion],input,select,textarea,button');
    tocado=el?{el,accion:el.dataset.accion||'',id:el.dataset.id||'',domId:el.id||'',t:Date.now()}:null;
  },true);
  const equivalente=t=>t.accion
    ? [...document.querySelectorAll(`[data-accion="${CSS.escape(t.accion)}"]`)].find(b=>(b.dataset.id||'')===t.id)
    : (t.domId?document.getElementById(t.domId):null);
  document.addEventListener('focusout',ev=>{
    const el=ev.target; if(!esFecha(el)) return;
    tecleando.delete(el);
    if(incompleta(el)){ el.value=previo.has(el)?previo.get(el):''; retenido.delete(el); return; }
    if(!retenido.has(el)) return;
    const t=tocado&&Date.now()-tocado.t<1000?tocado:null;
    entregar(el);
    if(t&&!t.el.isConnected){
      document.addEventListener('pointerup',()=>setTimeout(()=>{
        const nuevo=equivalente(t); if(!nuevo) return;
        if(t.accion) nuevo.click(); else nuevo.focus();
      },0),{once:true,capture:true});
    }
  },true);
})();

/* ============ ACCESIBILIDAD ============ */
/* El contenido de las pantallas se arma con plantillas; en vez de corregir cada formulario, esta pasada
   les da nombre a los controles, encabezados a las tablas y estado al menú, cada vez que se dibuja algo. */
let _nAcc=0;
const textoLimpio=el=>(el.textContent||'').replace(/\s+/g,' ').trim();
const SIN_NOMBRE=['hidden','button','submit','reset','image'];
function etiquetarControles(raiz){
  raiz.querySelectorAll('input,select,textarea').forEach(c=>{
    if(SIN_NOMBRE.includes(c.type)) return;
    if(c.getAttribute('aria-label')||c.getAttribute('aria-labelledby')||c.title) return;
    if(c.labels&&c.labels.length) return;
    /* 1) una <label> suelta dentro de la misma caja de campo */
    const caja=c.closest('.campo,.campo-login');
    if(caja){
      const controles=[...caja.querySelectorAll('input,select,textarea')].filter(x=>!SIN_NOMBRE.includes(x.type));
      const lab=[...caja.querySelectorAll('label')].find(l=>!l.htmlFor&&!l.querySelector('input,select,textarea'));
      if(lab&&controles[0]===c){ if(!c.id) c.id='acc'+(++_nAcc); lab.htmlFor=c.id; return; }
      if(lab){ c.setAttribute('aria-label',textoLimpio(lab)+' '+(controles.indexOf(c)+1)); return; }
    }
    /* 2) un control dentro de una celda: columna + persona de la fila */
    const td=c.closest('td');
    if(td){
      const tr=td.parentElement, tabla=td.closest('table');
      const th=tabla&&tabla.tHead&&tabla.tHead.rows[0]&&tabla.tHead.rows[0].cells[[...tr.children].indexOf(td)];
      const enc=th?textoLimpio(th):'';
      const quien=[...tr.children].filter(x=>x!==td&&!x.querySelector('input,select,textarea')).map(textoLimpio).find(t=>/[A-Za-zÁ-ú]{3}/.test(t))||'';
      const base=c.dataset.incluir!==undefined?'Incluir en la planilla':(enc||'Valor');
      c.setAttribute('aria-label',quien?`${base}: ${quien}`:base); return;
    }
    /* 3) texto inmediatamente anterior, o el nombre técnico como último recurso */
    const prev=c.previousElementSibling;
    if(prev&&!prev.matches('input,select,textarea,button')){ const t=textoLimpio(prev); if(t&&t.length<50){ c.setAttribute('aria-label',t); return; } }
    const alt=c.getAttribute('placeholder')||c.dataset.filtro||c.name;
    if(alt) c.setAttribute('aria-label',alt.replace(/([a-z])([A-Z])/g,'$1 $2'));
  });
}
function etiquetarEncabezados(raiz){
  raiz.querySelectorAll('thead th').forEach(th=>{
    th.scope='col';
    if(textoLimpio(th)) return;
    const tabla=th.closest('table'), col=th.cellIndex;
    const filas=[...tabla.tBodies].flatMap(b=>[...b.rows]);
    const en=sel=>filas.some(r=>r.cells[col]&&r.cells[col].querySelector(sel));
    th.insertAdjacentHTML('beforeend',`<span class="solo-lector">${en('button,a')?'Acciones':en('input[type=checkbox]')?'Incluir':'Detalle'}</span>`);
  });
}
function mejorarAccesibilidad(raiz){
  etiquetarControles(raiz); etiquetarEncabezados(raiz);
  /* Jerarquía de títulos: cada pantalla tiene un h1; sus secciones son nivel 2 (y sus partes, nivel 3) sin cambiar el aspecto. */
  if(raiz.id==='vista'){
    raiz.querySelectorAll('h3').forEach(h=>h.setAttribute('aria-level','2'));
    raiz.querySelectorAll('h4').forEach(h=>h.setAttribute('aria-level','3'));
  }
}
/* Texto visible de un botón del menú, sin el ícono ni la etiqueta del atajo. */
const textoBoton=b=>[...b.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();
/* Pantalla actual: título de la pestaña y "página actual" para lectores de pantalla. */
function marcarNavegacion(){
  const sel='nav [data-v], #recuadroAdmin [data-v]';
  let actual=null;
  document.querySelectorAll(sel).forEach(x=>{
    if(x.dataset.v===VISTA||x.dataset.v===VISTA_PADRE[VISTA]){ x.setAttribute('aria-current','page'); actual=actual||x; } else x.removeAttribute('aria-current');
  });
  const nombre=actual?textoBoton(actual):'';
  const app=APP_ACTUAL&&VISTA!=='home'?APPS.find(a=>a.id===APP_ACTUAL):null;
  const sub=actual&&actual.closest('.sub-menu');
  const nombreSub=sub?textoBoton(sub.querySelector('.sub-cab')):'';
  document.title=(nombre?nombre+' — ':'')+(nombreSub&&nombreSub!==app?.nombre?nombreSub+' — ':'')+(app?app.nombre+' — ':'')+'Módulo Contable ADCONTIS';
}
/* Cada ventana (formulario o aviso) se nombra con su título, y sus campos se etiquetan al abrirse. */
['modalForm','avisoCuerpo'].forEach(id=>{
  const el=document.getElementById(id), dlg=el.closest('dialog');
  new MutationObserver(()=>{
    const h=el.querySelector('h3');
    if(h){ if(!h.id) h.id=id+'Titulo'; dlg.setAttribute('aria-labelledby',h.id); }
    mejorarAccesibilidad(el);
  }).observe(el,{childList:true});
});

/* ============ ATAJOS DE TECLADO (Alt + número) ============ */
/* Usan los mismos botones del menú: si el cargo de la persona no ve una pantalla, el atajo tampoco la abre.
   Se usa Alt (y no Ctrl) para no pisar atajos del navegador como Ctrl+P (imprimir) o Ctrl+S.
   Cada persona puede cambiar qué pantalla abre cada número en Configuración; se guarda en esta computadora.
   Alt+0 siempre vuelve al inicio y Alt+H muestra la lista. */
const ATAJOS_DEFECTO={'1':'facturas','2':'tablero','3':'diario','4':'mayor','5':'planillas','6':'contratos',
  '7':'balanza','8':'resultados','9':'balance'};
const TECLAS_ATAJO=['1','2','3','4','5','6','7','8','9'];
const claveAtajos=()=>'contagt_atajos_'+((typeof usuarioActual==='function'&&usuarioActual()&&usuarioActual().id)||'');
/* Pantallas que se pueden poner en un atajo: las del menú lateral (sin el inicio). */
const pantallasAtajo=()=>[...document.querySelectorAll('nav .app-menu [data-v]')].map(b=>b.dataset.v);
function atajosVista(){
  let g=null; try{ g=JSON.parse(localStorage.getItem(claveAtajos())||'null'); }catch(err){}
  const validas=new Set(pantallasAtajo()), m={};
  TECLAS_ATAJO.forEach(t=>{ const v=g&&Object.prototype.hasOwnProperty.call(g,t)?g[t]:ATAJOS_DEFECTO[t];
    if(v&&validas.has(v)) m[t]=v; });
  m['0']='home';
  return m;
}
function guardarAtajosVista(m){
  try{ if(m) localStorage.setItem(claveAtajos(),JSON.stringify(m)); else localStorage.removeItem(claveAtajos()); }catch(err){}
  etiquetarAtajos();
}
/* Etiqueta «Alt+N» en los botones del menú lateral. */
function etiquetarAtajos(){
  document.querySelectorAll('nav [data-v] .atajo').forEach(x=>x.remove());
  document.querySelectorAll('nav [data-v][title^="Atajo:"]').forEach(b=>b.removeAttribute('title'));
  Object.entries(atajosVista()).forEach(([tecla,v])=>{
    const b=document.querySelector(`nav [data-v="${v}"]`);
    if(!b) return;
    b.insertAdjacentHTML('beforeend',`<span class="atajo">Alt+${tecla}</span>`);
    b.title=`Atajo: Alt+${tecla}`;
  });
}
etiquetarAtajos();
/* Alt+V: abre una venta directa desde cualquier pantalla (lleva a Ventas y abre el formulario). */
const puedeVentaDirecta=()=>{ const b=document.querySelector('nav [data-v="ventas"]'); return !!(emp()&&b&&b.style.display!=='none'&&puedeVer('ventas')); };
function abrirVentaDirecta(){
  if(!puedeVentaDirecta()) return false;
  document.querySelector('nav [data-v="ventas"]').click();
  ventasTab='directas'; pintar();
  conSnapshot('Nueva venta directa',()=>ACCIONES.nuevaVentaDirecta());
  return true;
}
function ayudaAtajos(){
  const nombre=v=>{ const b=document.querySelector(`nav [data-v="${v}"]`); return b?textoBoton(b):v; };
  const m=atajosVista();
  avisar(TECLAS_ATAJO.concat('0').filter(t=>m[t]).map(t=>`Alt+${t}  —  ${nombre(m[t])}`).join('\n')+(puedeVentaDirecta()?'\nAlt+V  —  Nueva venta directa':'')+'\nAlt+H  —  Esta ayuda\n\nSe cambian en Administración → Configuración.','Atajos de teclado');
}
document.addEventListener('keydown',ev=>{
  if(!ev.altKey||ev.ctrlKey||ev.metaKey||ev.shiftKey) return;
  if(!BD.sesion || document.getElementById('app').style.display==='none') return;
  if(modal.open || document.getElementById('aviso').open) return;   // con una ventana abierta no se navega
  const tecla=(ev.code||'').replace(/^(Digit|Numpad)/,'');
  if(tecla==='KeyH'){ ev.preventDefault(); ayudaAtajos(); return; }
  if(tecla==='KeyV'){ if(puedeVentaDirecta()){ ev.preventDefault(); abrirVentaDirecta(); } return; }
  const v=atajosVista()[tecla];
  if(!v) return;
  const b=document.querySelector(`nav [data-v="${v}"]`);
  if(!b||b.style.display==='none') return;   // pantalla no disponible para este cargo o esta empresa
  ev.preventDefault();
  b.click();
  document.getElementById('vista').focus({preventScroll:true});
});
/* ============ TEMA CLARO / OSCURO ============ */
function temaGuardado(){
  let t='sistema'; try{ t=localStorage.getItem('contagt_tema')||'sistema'; }catch(err){}
  return ['claro','oscuro','sistema'].includes(t)?t:'sistema';
}
function aplicarTema(t){
  const osc = t==='oscuro' || (t==='sistema' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', osc?'dark':'light');
  document.querySelectorAll('#segTema [data-tema]').forEach(b=>{
    b.classList.toggle('on',b.dataset.tema===t); b.setAttribute('aria-pressed',b.dataset.tema===t?'true':'false');
  });
}
function elegirTema(t){ try{ localStorage.setItem('contagt_tema',t); }catch(err){} aplicarTema(t); }
if(window.matchMedia){
  const mq=matchMedia('(prefers-color-scheme: dark)');
  const alCambiar=()=>{ if(temaGuardado()==='sistema') aplicarTema('sistema'); };
  if(mq.addEventListener) mq.addEventListener('change',alCambiar); else if(mq.addListener) mq.addListener(alCambiar);
}
document.querySelectorAll('#segTema [data-tema]').forEach(b=>b.onclick=()=>elegirTema(b.dataset.tema));
aplicarTema(temaGuardado());

/* ============ RECUADRO DE ADMINISTRACIÓN ============ */
/* Al tocar "Administración" se abre un recuadro flotante con Usuarios,
   Bitácora, Configuración, el tema y Cerrar sesión. Se cierra al elegir algo,
   al tocar fuera o con Escape. */
const adminCab=document.getElementById('adminCab'), recuadroAdmin=document.getElementById('recuadroAdmin');
function posicionarRecuadroAdmin(){
  if(innerWidth<=820){ recuadroAdmin.style.left=''; recuadroAdmin.style.top=''; return; }   // hoja inferior: lo acomoda el CSS
  const r=adminCab.getBoundingClientRect(), w=recuadroAdmin.offsetWidth, h=recuadroAdmin.offsetHeight;
  let left, top;
  if(innerWidth<=820){ left=12; top=r.bottom+6; }
  else{ left=document.getElementById('panel').getBoundingClientRect().right+8; top=r.top; }
  left=Math.max(12,Math.min(left,innerWidth-w-12));
  top=Math.max(12,Math.min(top,innerHeight-h-12));
  recuadroAdmin.style.left=left+'px'; recuadroAdmin.style.top=top+'px';
}
function abrirRecuadroAdmin(){
  cerrarRecuadroEmpresa();
  recuadroAdmin.hidden=false; document.getElementById('veloAdmin').hidden=false;
  adminCab.classList.add('abierto'); adminCab.setAttribute('aria-expanded','true');
  posicionarRecuadroAdmin();
  const primero=[...recuadroAdmin.querySelectorAll('button:not(.cerrar-recuadro)')].find(b=>b.style.display!=='none');
  if(primero) primero.focus();
}
function cerrarRecuadroAdmin(){
  if(recuadroAdmin.hidden) return;
  recuadroAdmin.hidden=true; document.getElementById('veloAdmin').hidden=true;
  adminCab.classList.remove('abierto'); adminCab.setAttribute('aria-expanded','false');
}
adminCab.onclick=ev=>{ ev.stopPropagation(); recuadroAdmin.hidden?abrirRecuadroAdmin():cerrarRecuadroAdmin(); };
document.addEventListener('click',ev=>{
  if(!recuadroAdmin.hidden && !recuadroAdmin.contains(ev.target) && !adminCab.contains(ev.target)) cerrarRecuadroAdmin();
});
addEventListener('resize',()=>{ if(!recuadroAdmin.hidden) posicionarRecuadroAdmin(); });
document.getElementById('panel').addEventListener('scroll',()=>{ if(!recuadroAdmin.hidden) posicionarRecuadroAdmin(); });
document.getElementById('btnCerrarSesion').onclick=()=>{ cerrarRecuadroAdmin(); cerrarSesion(); };
document.getElementById('cerrarRecuadro').onclick=()=>{ cerrarRecuadroAdmin(); adminCab.focus(); };

document.querySelectorAll('nav [data-v], #recuadroAdmin [data-v]').forEach(a=>{
  a.onclick=ev=>{
    cerrarRecuadroAdmin();
    ev.preventDefault(); VISTA=a.dataset.v; filtros={};
    if(innerWidth<=820) alternarPanel(false);   // en pantalla chica el panel tapa el contenido
    pintar();
  };
});
/* Acciones secundarias de una fila, plegadas. Se despliegan en el mismo lugar (no flotan), así que
   funcionan dentro de tablas con desplazamiento y con el teclado sin código adicional. */
function masAcciones(nombre,botonesHtml){
  return `<details class="mas"><summary class="btn mini sec" aria-label="${esc(nombre)}">Más</summary><div class="mas-lista">${botonesHtml}</div></details>`;
}
function envolverTablas(raiz){
  raiz.querySelectorAll('table').forEach(t=>{
    const padre=t.parentElement;
    if(!padre||padre.classList.contains('tabla-scroll')) return;
    if(getComputedStyle(padre).overflowX!=='visible') return;   // ya está dentro de una caja con desplazamiento
    const caja=document.createElement('div'); caja.className='tabla-scroll';
    padre.insertBefore(caja,t); caja.appendChild(t);
  });
}
/* ============ EMPRESA Y EJERCICIO (línea compacta + recuadro) ============ */
/* La empresa en uso se ve siempre arriba del menú, en una sola línea; al tocarla se abre un recuadro para
   cambiar de empresa o de ejercicio. Así no ocupa media barra lateral, pero nunca se pierde de vista en
   qué empresa se está registrando. */
const empChip=document.getElementById('empChip'), recuadroEmpresa=document.getElementById('recuadroEmpresa');
function pintarChipEmpresa(e,visibles){
  empChip.innerHTML=e
    ?`<span class="emp-chip-nombre">${esc(e.nombre)}</span><span class="emp-chip-sub">Ejercicio ${e.ejercicio} · NIT ${esc(e.nit||'—')}</span><span class="emp-chip-flecha" aria-hidden="true"></span>`
    :`<span class="emp-chip-nombre">${visibles.length?'Elegí una empresa':'Sin empresas todavía'}</span><span class="emp-chip-flecha" aria-hidden="true"></span>`;
  empChip.title='Cambiar de empresa o de ejercicio';
}
function abrirRecuadroEmpresa(){
  cerrarRecuadroAdmin();
  recuadroEmpresa.hidden=false; document.getElementById('veloAdmin').hidden=false;
  empChip.setAttribute('aria-expanded','true'); empChip.classList.add('abierto');
  if(innerWidth>820){
    const r=empChip.getBoundingClientRect(), w=recuadroEmpresa.offsetWidth, h=recuadroEmpresa.offsetHeight;
    recuadroEmpresa.style.left=Math.max(12,Math.min(document.getElementById('panel').getBoundingClientRect().right+8,innerWidth-w-12))+'px';
    recuadroEmpresa.style.top=Math.max(12,Math.min(r.top,innerHeight-h-12))+'px';
  }else{ recuadroEmpresa.style.left=''; recuadroEmpresa.style.top=''; }
  const s=recuadroEmpresa.querySelector('select,input'); if(s) s.focus();
}
function cerrarRecuadroEmpresa(){
  if(recuadroEmpresa.hidden) return;
  recuadroEmpresa.hidden=true; if(recuadroAdmin.hidden) document.getElementById('veloAdmin').hidden=true;
  empChip.setAttribute('aria-expanded','false'); empChip.classList.remove('abierto');
}
empChip.onclick=ev=>{ ev.stopPropagation(); recuadroEmpresa.hidden?abrirRecuadroEmpresa():cerrarRecuadroEmpresa(); };
document.getElementById('cerrarEmpresa').onclick=()=>{ cerrarRecuadroEmpresa(); empChip.focus(); };
document.addEventListener('click',ev=>{ if(!recuadroEmpresa.hidden&&!recuadroEmpresa.contains(ev.target)&&!empChip.contains(ev.target)) cerrarRecuadroEmpresa(); });
document.addEventListener('keydown',ev=>{ if(ev.key==='Escape'&&!recuadroEmpresa.hidden&&!modal.open&&!document.getElementById('aviso').open){ cerrarRecuadroEmpresa(); empChip.focus(); } });

/* ============ DESHACER (aviso flotante) ============ */
/* Justo después de una acción aparece abajo a la derecha, unos segundos. Mientras siga disponible, también
   está en el recuadro de Administración. */
const SEG_DESHACER=25;
let deshacerOcultado=null, tDeshacer=null;
function pintarDeshacer(e){
  const caja=document.getElementById('deshacerFlotante'), adm=document.getElementById('adminDeshacer');
  const disp=!!(snapshotDeshacer&&e&&snapshotDeshacer.empId===e.id);
  adm.hidden=!disp;
  if(disp){ adm.textContent=`↩ Deshacer «${etiquetaDeshacer}»`; adm.onclick=()=>{ cerrarRecuadroAdmin(); ACCIONES.deshacer(); }; }
  const reciente=disp&&deshacerOcultado!==snapshotDeshacer&&Date.now()-(snapshotDeshacer.t||0)<SEG_DESHACER*1000;
  caja.hidden=!reciente;
  clearTimeout(tDeshacer);
  if(!reciente){ caja.innerHTML=''; return; }
  caja.innerHTML=`<span class="deshacer-txt">Listo: ${esc(etiquetaDeshacer)}</span>
    <button type="button" class="btn mini" id="btnDeshacerFlot">↩ Deshacer</button>
    <button type="button" class="deshacer-cerrar" id="btnDeshacerCerrar" aria-label="Cerrar el aviso de deshacer">✕</button>`;
  document.getElementById('btnDeshacerFlot').onclick=()=>ACCIONES.deshacer();
  document.getElementById('btnDeshacerCerrar').onclick=()=>{ deshacerOcultado=snapshotDeshacer; pintarDeshacer(emp()); };
  tDeshacer=setTimeout(()=>pintarDeshacer(emp()),Math.max(500,SEG_DESHACER*1000-(Date.now()-snapshotDeshacer.t)));
}

/* Menú por aplicaciones: en Inicio, la lista de aplicaciones; dentro de una, solo sus pantallas. */
function pintarMenuApps(){
  const enInicio=VISTA==='home';
  if(!enInicio){
    const deVista=appDeVista(VISTA);
    /* Si la pantalla está en la aplicación abierta se queda ahí; si no, se abre la suya. */
    if(deVista&&deVista!==APP_ACTUAL) APP_ACTUAL=deVista;
    if(!deVista) APP_ACTUAL=null;   // pantallas de Administración: no cambian la aplicación
  }
  const visibles=appsVisibles();
  document.querySelectorAll('nav .app-menu').forEach(m=>{
    const activa=!enInicio&&m.dataset.app===APP_ACTUAL;
    m.hidden=!activa;
    if(!activa) return;
    const app=APPS.find(a=>a.id===m.dataset.app);
    let cab=m.querySelector('.app-cab');
    if(!cab){ m.insertAdjacentHTML('afterbegin',`<p class="app-cab" data-app="${app.id}">${iconoApp(app.id)}<span>${esc(app.nombre)}</span></p>`); }
    /* Submenús: se esconde el que no tiene pantallas visibles; se despliega el de la pantalla abierta. */
    m.querySelectorAll('.sub-menu').forEach(sm=>{
      const id=sm.dataset.sub, tiene=[...sm.querySelectorAll('[data-v]')].some(b=>b.style.display!=='none');
      sm.hidden=!tiene;
      if(sm.querySelector(`[data-v="${VISTA}"]`)) SUBS_ABIERTOS.add(id);
      const abierto=SUBS_ABIERTOS.has(id);
      sm.classList.toggle('abierto',abierto);
      sm.querySelector('.sub-cab').setAttribute('aria-expanded',String(abierto));
      sm.querySelector('.sub-cuerpo').hidden=!abierto;
    });
    /* Rótulos de sección sin ninguna pantalla visible debajo: se esconden. */
    m.querySelectorAll('.app-sec').forEach(sec=>{
      let n=sec.nextElementSibling, alguno=false;
      while(n&&!n.classList.contains('app-sec')){ if(n.matches('[data-v]')&&n.style.display!=='none') alguno=true; n=n.nextElementSibling; }
      sec.hidden=!alguno;
    });
  });
  const lista=document.getElementById('listaApps');
  lista.hidden=!enInicio;
  if(enInicio){
    lista.innerHTML=visibles.map(a=>`<button type="button" data-app="${a.id}">${iconoApp(a.id,'ico-chico')}<span>${esc(a.nombre)}</span></button>`).join('');
    lista.querySelectorAll('[data-app]').forEach(b=>b.onclick=()=>abrirApp(b.dataset.app));
  }
  const ini=document.querySelector('nav [data-v="home"]');
  ini.classList.toggle('volver',!enInicio);
}
function pintar(){
  const u=usuarioActual();
  if(!u){ pantallaLogin(); return; }
  etiquetarAtajos();   // los atajos son de cada usuario
  const permitidas=vistasPermitidas();
  const e0=emp();
  document.querySelectorAll('nav [data-v], #recuadroAdmin [data-v]').forEach(a=>{
    let oculto = permitidas!==null && !permitidas.includes(a.dataset.v);
    if(!oculto && a.dataset.v==='libroPequeno') oculto = !e0 || !tuvoRegimen(e0,['pequeno']);
    if(!oculto && a.dataset.v==='produccion') oculto = !esProductora(e0);
    if(!oculto && a.dataset.v==='cierreFiscal') oculto = !e0 || !tuvoRegimen(e0,['general']);
    if(!oculto && (a.dataset.v==='libroVentas'||a.dataset.v==='libroCompras')) oculto = !e0 || !tuvoRegimen(e0,['general','simplificado']);
    a.style.display = oculto ? 'none' : '';
    a.classList.toggle('on',a.dataset.v===VISTA||a.dataset.v===VISTA_PADRE[VISTA]);
  });
  if(!puedeVer(VISTA)){ VISTA = permitidas ? (permitidas[0]||'home') : 'home'; }
  const r=ROLES[u.rol];
  /* Nombre y cargo de la sesión: viven en el recuadro de Administración. */
  document.getElementById('recuadroUsuario').textContent=`Sesión: ${u.nombre||u.usuario} · ${r?r.nombre:u.rol}`;
  const e=emp();
  const caja=document.getElementById('empBox');
  const visibles=empresasVisibles();
  caja.innerHTML = visibles.length
    ? `<label for="selEmpresa">Empresa en uso</label>
       <select id="selEmpresa">${visibles
         .map(x=>`<option value="${x.id}"${x.id===BD.activa?' selected':''}>${esc(x.nombre)}</option>`)
         .join('')}</select>
       ${e?`<div class="emp-datos">NIT ${esc(e.nit||'—')}</div>
       <label for="selEjercicio" style="margin-top:8px" title="${AYUDA_EJERCICIO}">Ejercicio de trabajo
         <span class="ayuda" tabindex="0" aria-label="${AYUDA_EJERCICIO}" title="${AYUDA_EJERCICIO}">ⓘ</span></label>
       <input id="selEjercicio" type="number" value="${e.ejercicio}" style="width:100%" title="${AYUDA_EJERCICIO}">`:''}`
    : `<span class="emp-datos">Todavía no hay empresas registradas</span>`;
  const sel=document.getElementById('selEmpresa');
  if(sel) sel.onchange=()=>{ cerrarRecuadroEmpresa(); cambiarEmpresa(sel.value); };
  pintarChipEmpresa(e,visibles); pintarDeshacer(e);
  const selEj=document.getElementById('selEjercicio');
  if(selEj) selEj.onchange=()=>{
    const nuevo=+selEj.value;
    if(!nuevo||nuevo<2000||nuevo>2100){avisar('Escribí un año válido.');selEj.value=e.ejercicio;return}
    e.ejercicio=nuevo;
    /* El correlativo de partidas es por ejercicio: sigue desde la última partida de ese año (o empieza en 1). */
    e.correlativo=e.partidas.filter(p=>(p.fecha||'').slice(0,4)===String(nuevo)).reduce((m,p)=>Math.max(m,p.numero||0),0)+1;
    guardar(); pintar();
  };
  if(!e && VISTA!=='empresas' && VISTA!=='config' && VISTA!=='usuarios' && VISTA!=='capitalSocial' && VISTA!=='bitacora'){ VISTA='empresas'; }
  pintarMenuApps();
  document.getElementById('vista').innerHTML = VISTAS[VISTA]();
  envolverTablas(document.getElementById('vista'));
  mejorarAccesibilidad(document.getElementById('vista'));
  marcarNavegacion();
  const nodo=document.getElementById('vista');
  nodo.querySelectorAll('[data-accion]').forEach(b=>b.onclick=()=>{
    const acc=ACCIONES[b.dataset.accion]; if(!acc) return;
    if(b.dataset.accion==='deshacer'){ acc(b.dataset); return; }
    /* Las que solo consultan (ver, ir a otra pantalla, PDF) no cambian nada: no hace falta copiar la empresa
       para «Deshacer», y con muchos datos esa copia era lo que más demoraba la respuesta del botón. */
    if(/^(ver[A-Z]|ir[A-Z]|pdf|abrir[A-Z]|calendarioICS$|descargar)/.test(b.dataset.accion)){ acc(b.dataset); return; }
    conSnapshot(b.textContent.trim()||b.dataset.accion,()=>acc(b.dataset));
  });
  nodo.querySelectorAll('[data-app]').forEach(b=>b.onclick=()=>abrirApp(b.dataset.app));
  nodo.querySelectorAll('[data-mas]').forEach(b=>b.onclick=()=>{ const k=b.dataset.mas; const base=k==='limDiario'?150:200; filtros[k]=(+filtros[k]||base)+(+b.dataset.paso||0); pintar(); });
  nodo.querySelectorAll('[data-atajo]').forEach(b=>b.onclick=()=>{ if(b.dataset.atajo==='ventaDirecta'){ abrirVentaDirecta(); return; } const n=document.querySelector(`nav [data-v="${b.dataset.atajo}"]`); if(n) n.click(); });
  nodo.querySelectorAll('[data-filtro]').forEach(i=>{
    i.oninput=i.onchange=()=>{filtros[i.dataset.filtro]=i.value;pintar()};
  });
  if(VISTA==='partidas' && borrador) enlazarFormulario();
  if(VISTA==='planillas' && borradorPlanilla) enlazarFormularioPlanilla();
  if(VISTA==='contratoEditar') enlazarEditorContrato();
  if(VISTA==='pagoPrestaciones' && borradorPago) enlazarFormularioPago();
  if(VISTA==='capitalSocial' && borradorCapital) enlazarCapitalSocial();
  if(VISTA==='facturas'){
    const inputArch=document.getElementById('reporte');
    if(inputArch) inputArch.onchange=function(){
      const archivos=[...this.files];
      const nombre=archivos.map(f=>f.name).join(' + ');
      const zona=document.getElementById('dropzoneLabel'), texto=document.getElementById('dropzoneTexto');
      if(zona&&texto){
        texto.textContent = nombre || 'Excel (.xls, .xlsx) o XML/ZIP de la SAT (.xml, .zip) — podés elegir los dos juntos';
        zona.classList.toggle('elegido',!!nombre);
      }
    };
  }
  if(VISTA==='facturas' && lote.length){
    nodo.querySelectorAll('[data-sel]').forEach(ch=>{
      ch.onchange=()=>{
        const d=lote[+ch.dataset.sel];
        d.sel=ch.checked;
        ch.closest('tr').style.background = d.sel ? 'var(--activo)' : '';
        const n=lote.filter(x=>x.sel).length;
        document.getElementById('contadorSel').textContent =
          n ? `${n} de ${lote.length} seleccionados` : 'Ninguno seleccionado';
      };
    });
    nodo.querySelectorAll('[data-anular]').forEach(ch=>{
      ch.onchange=()=>{
        lote[+ch.dataset.anular].anuladaManual=ch.checked;
        pintar();   // cambia totales, avisos y el tachado de la fila
      };
    });
    nodo.querySelectorAll('[data-retencion]').forEach(inp=>{
      inp.onchange=()=>{
        const d=lote[+inp.dataset.retencion];
        const monto=+inp.value||0;
        if(monto+(d.retencionIVA||0)>d.total){avisar('Las retenciones no pueden sumar más que el total del documento.');inp.value=d.retencionISR||'';return}
        d.retencionISR=monto;
      };
    });
    nodo.querySelectorAll('[data-retencioniva]').forEach(inp=>{
      inp.onchange=()=>{
        const d=lote[+inp.dataset.retencioniva];
        const monto=+inp.value||0;
        if(monto>(d.iva||0)+0.005){avisar('La retención de IVA no puede ser mayor que el IVA del documento.');inp.value=d.retencionIVA||'';return}
        d.retencionIVA=monto;
      };
    });
    nodo.querySelectorAll('[data-oc]').forEach(s=>{
      s.onchange=()=>{ lote[+s.dataset.oc].ocId=s.value; pintar(); };
    });
    nodo.querySelectorAll('[data-f]').forEach(s=>{
      s.onchange=()=>{
        const d=lote[+s.dataset.f];
        d[s.dataset.campo]=s.value;
        if(s.dataset.campo==='bs'){
          const e2=emp(); e2.mapeoBS=e2.mapeoBS||{};
          const n=d.tipo==='compra'?d.nitEmisor:d.nitReceptor;
          if(n) e2.mapeoBS[n]=d.bs;
          guardar();
        }
        if(s.dataset.campo==='cta'){
          const e2=emp();
          if(d.cta==='6.2.14'){
            /* Gastos no deducibles: el IVA de esta compra tampoco es
               acreditable —no tendría sentido que el gasto no genere
               derecho a deducir en ISR pero su IVA sí generara crédito
               fiscal—, así que se separa igual que cualquier otra factura
               y en generarPartidas() va a su propia cuenta (6.2.27, "IVA no
               deducible"), no a la de crédito fiscal ni fundido con el
               gasto. Antes esto ponía la factura completa como si fuera
               puro gasto, sin distinguir cuánto era producto y cuánto IVA. */
            if(!d.ivaReportado) d.iva=r2(d.total-d.total/1.12);
            d.base=r2(d.total-d.iva-(d.noAcred||0));
          }else{
            const regimenDoc=regimenEn(e2,d.fecha);
            const generaCredito = (regimenDoc==='general'||regimenDoc==='simplificado')
              && !d.pequeno && !(d.categoria&&/no genera cr[ée]dito/i.test(d.categoria));
            if(generaCredito){
              if(!d.ivaReportado) d.iva=r2(d.total-d.total/1.12);
              d.base=r2(d.total-d.iva-(d.noAcred||0));
            }else{
              d.iva=0; d.base=d.total;
            }
          }
          recordarCuenta(d);
          /* "Gastos no deducibles" es una decisión que se toma factura por
             factura, no por proveedor — el mismo Claro puede mandar una
             factura de servicio normal (deducible) y otra que no lo es. Para
             cualquier OTRA cuenta sí tiene sentido copiarla a las demás
             facturas del mismo proveedor en esta carga (ahorra reclasificar
             una por una cuando de verdad es la misma situación), pero no
             para esta cuenta específica. */
          if(d.cta!=='6.2.14'){
            const iguales=lote.filter(o=>o!==d && o.tipo===d.tipo && o.cta!=='6.2.14' &&
              (o.tipo==='compra'?o.nitEmisor:o.nitReceptor)===(d.tipo==='compra'?d.nitEmisor:d.nitReceptor));
            if(iguales.length) iguales.forEach(o=>o.cta=d.cta);
          }
          /* Sin esto, elegir "Gastos no deducibles" cambiaba la cuenta y
             separaba base/IVA por dentro, pero la fila seguía mostrando los
             montos viejos en pantalla hasta que algo más disparara un
             repintado — como si no hubiera pasado nada. */
          pintar();
        }
      };
    });
  }
  if(modo==='vista'){
    nodo.insertAdjacentHTML('afterbegin',
      `<div class="aviso"><strong>Estás en la vista previa.</strong> Lo que registrés aquí se guarda y sigue estando si volvés a esta conversación, así que podés probar con confianza. Para el trabajo de verdad descargá el archivo y abrilo en Chrome.</div>`);
  } else if(modo==='memoria'){
    nodo.insertAdjacentHTML('afterbegin',
      `<div class="aviso malo"><strong>Sin guardado.</strong> Esta ventana no puede conservar datos. Descargá el archivo y abrilo directamente en Chrome.</div>`);
  }
}
/* Antes era un párrafo fijo debajo del campo; ahora es una ayuda al pasar el ratón por encima. */
const AYUDA_EJERCICIO='Para ponerte al día con un año anterior, cambiá este año: el Tablero fiscal y los cierres usan el ejercicio que esté acá, no el de hoy.';
function cab(t,sub,extra=''){
  return `<div class="tit"><div><h1>${t}</h1>${sub?`<p>${sub}</p>`:''}</div><div>${extra}</div></div>`;
}

/* ============ AVISOS Y CONFIRMACIONES ============ */
/* Reemplazan las ventanas nativas del navegador, que no funcionan en vistas restringidas. */
const dlgAviso=document.getElementById('aviso'), avisoCuerpo=document.getElementById('avisoCuerpo');
function avisar(mensaje,titulo='Revisá esto'){
  avisoCuerpo.innerHTML=`<div class="modal-cuerpo"><h3>${esc(titulo)}</h3>
    <p style="margin:0;white-space:pre-line">${esc(mensaje)}</p></div>
    <div class="pie-modal"><button class="btn" type="button" id="aOk">Entendido</button></div>`;
  avisoCuerpo.querySelector('#aOk').onclick=()=>dlgAviso.close();
  dlgAviso.showModal();
  avisoCuerpo.querySelector('#aOk').focus();
}
function confirmar(mensaje,alConfirmar,textoBoton='Eliminar'){
  avisoCuerpo.innerHTML=`<div class="modal-cuerpo"><h3>Confirmá la acción</h3>
    <p style="margin:0;white-space:pre-line">${esc(mensaje)}</p></div>
    <div class="pie-modal"><button class="btn sec" type="button" id="aNo">Cancelar</button>
    <button class="btn peligro" type="button" id="aSi">${esc(textoBoton)}</button></div>`;
  avisoCuerpo.querySelector('#aNo').onclick=()=>dlgAviso.close();
  avisoCuerpo.querySelector('#aSi').onclick=()=>{dlgAviso.close();conSnapshot(textoBoton,alConfirmar)};
  dlgAviso.showModal();
}

/* Pregunta Sí/No que devuelve una promesa — reemplaza a window.confirm, que
   no funciona en vistas restringidas. Se puede usar con un modal abierto. */
function preguntar(mensaje,textoSi='Continuar'){
  return new Promise(ok=>{
    avisoCuerpo.innerHTML=`<div class="modal-cuerpo"><h3>Confirmá la acción</h3>
      <p style="margin:0;white-space:pre-line">${esc(mensaje)}</p></div>
      <div class="pie-modal"><button class="btn sec" type="button" id="aNo">Cancelar</button>
      <button class="btn" type="button" id="aSi">${esc(textoSi)}</button></div>`;
    let listo=false; const fin=v=>{ if(listo) return; listo=true; try{dlgAviso.close()}catch(err){} ok(v); };
    avisoCuerpo.querySelector('#aNo').onclick=()=>fin(false);
    avisoCuerpo.querySelector('#aSi').onclick=()=>fin(true);
    dlgAviso.addEventListener('close',()=>fin(false),{once:true});
    dlgAviso.showModal();
  });
}

/* ============ MODAL ============ */
const modal=document.getElementById('modal'), mForm=document.getElementById('modalForm');
function cerrarModal(){ try{modal.close()}catch(e){} mForm.innerHTML=''; pintar(); }
modal.addEventListener('cancel',ev=>{ev.preventDefault();cerrarModal()});

function abrirModal(titulo,cuerpo,alGuardar,textoBtn='Guardar'){
  mForm.innerHTML=`<div class="modal-cuerpo"><h3>${titulo}</h3>${cuerpo}</div>
    <div class="pie-modal"><button class="btn sec" type="button" id="mCancelar">Cancelar</button>
    <button class="btn" type="button" id="mAceptar">${textoBtn}</button></div>`;
  const aceptar=async()=>{
    const datos={};
    mForm.querySelectorAll('[name]').forEach(i=>{
      datos[i.name] = i.type==='checkbox' ? (i.checked?'on':'') : i.value;
    });
    const resultado=await conSnapshot(String(titulo).replace(/<[^>]+>/g,''),()=>alGuardar(datos));
    if(resultado===false) return;
    cerrarModal();
  };
  mForm.querySelector('#mCancelar').onclick=cerrarModal;
  mForm.querySelector('#mAceptar').onclick=aceptar;
  mForm.onkeydown=ev=>{
    if(ev.key==='Enter' && ev.target.tagName==='INPUT' && ev.target.type!=='file'){ ev.preventDefault(); aceptar(); }
  };
  if(!modal.open) modal.showModal();   // si ya estaba abierta (se cambia de opción dentro del mismo formulario), solo se reemplaza el contenido
  const primero=mForm.querySelector('input,select');
  if(primero) primero.focus();
}

