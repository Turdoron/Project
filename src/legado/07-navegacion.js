/* ============ NAVEGACIÓN ============ */
/* Al cambiar de empresa se descarta lo que estuviera a medias: una carga o una
   partida en borrador pertenecen a la empresa donde se empezaron. */
function cambiarEmpresa(id){
  if(id===BD.activa) return;
  if(!empresasVisibles().some(e=>e.id===id)) return;   // fuera del alcance del usuario actual
  BD.activa=id; lote=[]; borrador=null; filtros={}; VISTA='home';
  const e=emp(); if(e) asegurarCatalogoMinimo(e);
  guardar(); pintar();
}
/* Cuentas que se agregaron al sistema después de que ya existían empresas
   creadas. nuevoCatalogo() las incluye para las empresas nuevas desde el
   primer día, pero una empresa vieja no las tiene en su propio catálogo
   hasta que algo se las agregue — sin esto, una partida podía terminar
   apuntando a un código que no existe ahí, mostrando "?" en vez del nombre
   de la cuenta. Se corre cada vez que se entra a una empresa, así que basta
   con abrir el sistema una vez para que quede al día. */
function asegurarCatalogoMinimo(e){
  asegurarCuenta(e,'6.2.27','IVA no deducible','gasto');
}
function alternarPanel(abrir){
  const abierto = abrir!==undefined ? abrir : !document.body.classList.contains('panel-abierto');
  document.body.classList.toggle('panel-abierto',abierto);
  try{ localStorage.setItem('contagt_panel',abierto?'1':'0'); }catch(err){}
}

/* Visibilidad: agranda o achica todo el sistema proporcionalmente (texto, botones,
   tablas), no solo la letra. Usa "zoom" en vez de font-size a propósito: el sistema
   está pensado para Chrome, y zoom es la única forma de escalar TODO parejo sin
   tener que reescribir cada medida en px del sistema a una unidad relativa. */
/* Tamaño predeterminado: 90 %. Solo se recuerda lo que la persona elige con los botones (clave nueva,
   para que todos partan del predeterminado). El contenido llena siempre el ancho y el alto de la ventana. */
const ESCALA_BASE=0.9;
function escalaActual(){
  let v=ESCALA_BASE;
  try{ const g=parseFloat(localStorage.getItem('contagt_escala2')); if(g>=0.8&&g<=1.6) v=g; }catch(err){}
  return v;
}
function aplicarEscala(v,recordar=true){
  v=Math.max(0.8,Math.min(1.6,Math.round(v*10)/10));
  document.body.style.zoom=(v*100)+'%';
  /* Con zoom, "100vh" también se encoge: se compensa para que la barra lateral siempre llegue hasta abajo. */
  document.documentElement.style.setProperty('--alto',(100/v)+'vh');
  if(recordar){ try{ localStorage.setItem('contagt_escala2',v); }catch(err){} }
  const t=document.getElementById('escalaTexto');
  if(t) t.textContent=Math.round(v*100)+'%';
}

let VISTA='empresas', filtros={}, borrador=null, borradorPlanilla=null, borradorPago=null, borradorCapital=null;
document.getElementById('menuBtn').onclick=()=>alternarPanel(true);
document.getElementById('cerrarPanel').onclick=()=>alternarPanel(false);
document.getElementById('velo').onclick=()=>alternarPanel(false);

/* ============ APLICACIONES ============ */
/* El sistema se ordena en "aplicaciones", como el menú de un teléfono: en Inicio se elige con qué se va a
   trabajar y el menú lateral muestra solo las pantallas de esa aplicación. Cada persona ve las aplicaciones
   que su cargo permite (las mismas reglas de vistasPermitidas); el Administrador las ve todas. Las pantallas
   de cada aplicación están en el marcado (src/marcado.html, bloques .app-menu). */
const APPS=[
  {id:'contabilidad',nombre:'Contabilidad',desc:'Libros, impuestos, estados financieros, inventario y activos fijos'},
  {id:'rrhh',nombre:'Recursos Humanos',desc:'Empleados, planillas y prestaciones'},
  {id:'compras',nombre:'Compras',desc:'Cotizaciones, órdenes de compra y proveedores'},
  {id:'ventas',nombre:'Ventas',desc:'Ventas, consignaciones y clientes'},
  {id:'produccion',nombre:'Producción',desc:'Órdenes, recetas y costos de producción'},
  {id:'empresa',nombre:'Empresa',desc:'Datos de las empresas y aumentos de capital'},
];
/* Submenús de Contabilidad: se despliega solo el de la pantalla abierta (y los que la persona abra). */
const SUBS_ABIERTOS=new Set();
/* Íconos de línea (24×24, trazo con el color del texto). */
const ICONOS_APP={
  contabilidad:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5Z"/><path d="M9 7.5h7M9 11h5"/>',
  impuestos:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="m9 14 6-6"/><circle cx="9.5" cy="8.5" r="1"/><circle cx="14.5" cy="13.5" r="1"/>',
  estados:'<path d="M4 20h16"/><path d="M7 16v-5M12 16V6M17 16v-8"/>',
  rrhh:'<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.6c2.3.2 3.9 1.8 4.5 4.4"/>',
  compras:'<path d="M3 4h2.2l2.3 11h10.8l2-8H6.3"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
  ventas:'<path d="M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1l8 8a1 1 0 0 1 0 1.4l-7.1 7.1a1 1 0 0 1-1.4 0l-8-8Z"/><circle cx="8.5" cy="8.5" r="1.6"/>',
  inventario:'<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
  produccion:'<path d="M3 21V10l5 3V10l5 3V10l5 3V4h3v17H3Z"/><path d="M7 17h2M12 17h2"/>',
  empresa:'<path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16"/><path d="M15 9h4a1 1 0 0 1 1 1v11"/><path d="M3 21h18M8 8h3M8 12h3M8 16h3"/>',
  todas:'<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
};
const iconoApp=(id,clase='')=>`<svg class="ico-app ${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS_APP[id]||''}</svg>`;
let APP_ACTUAL=null;
/* Botones de pantalla de una aplicación que la persona puede ver ahora (los esconde pintar()). */
const pantallasDeApp=id=>[...document.querySelectorAll(`nav .app-menu[data-app="${id}"] [data-v]`)];
const pantallasVisiblesDeApp=id=>pantallasDeApp(id).filter(b=>b.style.display!=='none');
const appDeVista=v=>{ const b=document.querySelector(`nav .app-menu [data-v="${v}"]`); return b?b.closest('.app-menu').dataset.app:null; };
const appsVisibles=()=>APPS.filter(a=>pantallasVisiblesDeApp(a.id).length);
function abrirApp(id){
  const b=pantallasVisiblesDeApp(id)[0]; if(!b) return;
  APP_ACTUAL=id; VISTA=b.dataset.v; filtros={}; SUBS_ABIERTOS.clear();
  if(innerWidth<=820) alternarPanel(false);
  pintar();
  document.getElementById('vista').focus({preventScroll:true});
}
document.querySelectorAll('nav .sub-cab').forEach(c=>c.onclick=()=>{
  const id=c.dataset.sub; SUBS_ABIERTOS.has(id)?SUBS_ABIERTOS.delete(id):SUBS_ABIERTOS.add(id); pintarMenuApps();
});
document.querySelector('nav [data-v="home"]').insertAdjacentHTML('afterbegin',iconoApp('todas','ico-chico'));
document.addEventListener('keydown',ev=>{
  if(ev.key==='Escape'){ const abierto=document.querySelector('details.mas[open]'); if(abierto){ abierto.open=false; abierto.querySelector('summary').focus(); return; } }
  if(ev.key==='Escape' && !recuadroAdmin.hidden){ cerrarRecuadroAdmin(); adminCab.focus(); return; }
  if(ev.key==='Escape' && innerWidth<=820 && document.body.classList.contains('panel-abierto'))
    alternarPanel(false);
});
