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

/* Grupos del menú plegables, para que la barra lateral no crezca sin fin.
   Se recuerda qué grupos quedaron cerrados, por computadora. */
function plegarGrupo(id,plegar){
  const cab=document.querySelector(`.grupo-cab[data-grupo="${id}"]`);
  const cuerpo=document.querySelector(`.grupo-cuerpo[data-cuerpo="${id}"]`);
  if(!cab||!cuerpo) return;
  cab.classList.toggle('plegado',plegar);
  cab.setAttribute('aria-expanded',String(!plegar));
  cuerpo.classList.toggle('plegado',plegar);
}
document.querySelectorAll('.grupo-cab:not(.admin-cab)').forEach(cab=>{
  /* Acordeón: abrir un grupo cierra los demás, así el menú no crece sin fin. */
  cab.onclick=()=>{
    const id=cab.dataset.grupo, plegar=!cab.classList.contains('plegado');
    if(!plegar) gruposMenu().forEach(otro=>{ if(otro!==id) plegarGrupo(otro,true); });
    plegarGrupo(id,plegar);
    guardarGruposMenu();
  };
});
function gruposMenu(){ return [...document.querySelectorAll('.grupo-cab:not(.admin-cab)')].map(c=>c.dataset.grupo); }
function guardarGruposMenu(){
  const g={};
  gruposMenu().forEach(id=>{ const c=document.querySelector(`.grupo-cab[data-grupo="${id}"]`); g[id]=c.classList.contains('plegado'); });
  try{ localStorage.setItem('contagt_grupos',JSON.stringify(g)); }catch(err){}
}
/* Al arrancar queda abierto un solo grupo: el último que se dejó abierto (o ninguno). */
(()=>{
  let g={};
  try{ g=JSON.parse(localStorage.getItem('contagt_grupos')||'{}'); }catch(err){}
  /* Sin nada guardado todavía, arranca abierto "Operación diaria". */
  const abierto=Object.keys(g).length?gruposMenu().find(id=>g[id]===false):'operacion';
  gruposMenu().forEach(id=>plegarGrupo(id,id!==abierto));
})();
document.addEventListener('keydown',ev=>{
  if(ev.key==='Escape'){ const abierto=document.querySelector('details.mas[open]'); if(abierto){ abierto.open=false; abierto.querySelector('summary').focus(); return; } }
  if(ev.key==='Escape' && !recuadroAdmin.hidden){ cerrarRecuadroAdmin(); adminCab.focus(); return; }
  if(ev.key==='Escape' && innerWidth<=820 && document.body.classList.contains('panel-abierto'))
    alternarPanel(false);
});
