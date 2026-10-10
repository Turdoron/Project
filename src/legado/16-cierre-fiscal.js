/* ============ CIERRE FISCAL DEL ISR (25 %) EN UNA SOLA PANTALLA ============ */
/* Para el régimen General. Todo lo que hay que revisar y registrar para el cierre parcial de un trimestre
   o para la liquidación anual, en orden y con el botón de cada paso: facturas, planillas, depreciación,
   producción, IVA, retenciones, ISO, conciliación, inventario final y costo de ventas, el ISR y, al final
   del año, el cierre de libros. Cada botón abre la misma ventana que en su pantalla de siempre. */
const CORTES_CF=[
  {id:'t1',t:1,nombre:'Primer trimestre (enero a marzo)'},
  {id:'t2',t:2,nombre:'Segundo trimestre (abril a junio)'},
  {id:'t3',t:3,nombre:'Tercer trimestre (julio a septiembre)'},
  {id:'anual',t:4,nombre:'Liquidación anual (enero a diciembre)'}];
function rangoCorteCF(e,c){
  const a=e.ejercicio, t=c.t;
  return {anual:t===4, t, desde:t===4?`${a}-01-01`:`${a}-${String(t*3-2).padStart(2,'0')}-01`,
    hasta:t===4?`${a}-12-31`:`${a}-${['03-31','06-30','09-30'][t-1]}`, desdeAno:`${a}-01-01`};
}
/* Primer corte que falta: el trimestre siguiente al último cerrado, o la liquidación anual. */
function corteSugeridoCF(e){
  const hechos=new Set((e.cierresParciales||[]).filter(c=>c.ejercicio===e.ejercicio).map(c=>c.trimestre));
  return (CORTES_CF.find(c=>c.t<4&&!hechos.has(c.t))||CORTES_CF[3]).id;
}
/* Existencias según el kardex a una fecha (sin lo que entró o salió después). */
function valorKardexAl(e,hasta){
  const copia={...e,documentos:(e.documentos||[]).filter(d=>(d.fecha||'')<=hasta),
    ordenesProduccion:(e.ordenesProduccion||[]).map(o=>o.estado==='cerrada'&&(o.fechaCierre||'')>hasta?{...o,estado:'abierta'}:o),
    salidasInventario:(e.salidasInventario||[]).filter(s=>(s.fecha||'')<=hasta),
    entradasInventario:(e.entradasInventario||[]).filter(s=>(s.fecha||'')<=hasta)};
  const d=inventarioDetalle(copia);
  return r2(d.lista.reduce((s,p)=>s+p.total,0)+d.sinDetalleValor);
}
const mesesDelRango=(desde,hasta)=>{ const out=[]; let [a,m]=desde.split('-').map(Number); const [a2,m2]=hasta.split('-').map(Number);
  while(a<a2||(a===a2&&m<=m2)){ const mm=String(m).padStart(2,'0'); out.push({desde:`${a}-${mm}-01`,hasta:`${a}-${mm}-${String(new Date(a,m,0).getDate()).padStart(2,'0')}`,nombre:MESES_NOM[m-1]}); m++; if(m>12){m=1;a++;} }
  return out; };
const listaNombres=xs=>xs.length<=1?xs.join(''):xs.slice(0,-1).join(', ')+' y '+xs[xs.length-1];

function pasosCierreFiscal(e,c){
  const R=rangoCorteCF(e,c), pasos=[], movH=movimientos(null,R.hasta), meses=mesesDelRango(R.desde,R.hasta);
  const paso=(titulo,estado,detalle,botones='')=>pasos.push({titulo,estado,detalle,botones});
  const btn=(accion,texto,extra='',sec=true)=>`<button class="btn mini${sec?' sec':''}" data-accion="${accion}"${extra}>${texto}</button>`;

  /* 1. Facturas */
  const sinDocs=meses.filter(m=>!(e.documentos||[]).some(d=>d.fecha>=m.desde&&d.fecha<=m.hasta)).map(m=>m.nombre);
  paso('Facturas de compras y ventas cargadas',sinDocs.length?'aviso':'ok',
    sinDocs.length?`No hay ninguna factura cargada en ${listaNombres(sinDocs)}. Revisá que no falte ninguna antes de cerrar.`
      :`Hay facturas en todos los meses del período (${(e.documentos||[]).filter(d=>d.fecha>=R.desde&&d.fecha<=R.hasta).length} documentos).`,
    btn('irFacturas','Cargar facturas'));

  /* 2. Planillas: solo si la empresa tiene personal. Que un mes no tenga planilla no bloquea el cierre
     (puede no haber habido empleados); sí queda pendiente una planilla generada sin su partida. */
  const activos=(e.empleados||[]).filter(x=>x.activo!==false);
  const sinPartida=(e.planillas||[]).filter(p=>!p.partidaId&&p.fechaPago>=R.desde&&p.fechaPago<=R.hasta);
  if(activos.length||sinPartida.length){
    const sinPlanilla=meses.filter(m=>!(e.planillas||[]).some(p=>p.fechaPago>=m.desde&&p.fechaPago<=m.hasta)).map(m=>m.nombre);
    paso('Planillas registradas en libros',sinPartida.length?'pend':sinPlanilla.length?'opcional':'ok',
      sinPartida.length?`${sinPartida.length} planilla(s) del período todavía no tienen partida: entrá a la planilla y usá "Generar partida".`
        :sinPlanilla.length?`No hay planilla pagada en ${listaNombres(sinPlanilla)}. Si en esos meses hubo personal trabajando, registrala; si no, podés seguir.`
        :'Todas las planillas del período tienen su partida.',
      btn('irPlanillas','Ir a planillas'));
  }

  /* 3. Depreciación */
  if((e.activosFijos||[]).some(a=>!a.baja)){
    const mesCorte=R.hasta.slice(0,7), pend=r2(calcularDepreciacionPendiente(e,mesCorte).reduce((s,f)=>s+f.monto,0));
    paso('Depreciación de activos fijos',pend>0?'pend':'ok',
      pend>0?`Falta registrar Q${Q(pend)} de depreciación hasta ${fFecha(R.hasta)}.`:`Registrada hasta ${fFecha(R.hasta)}.`,
      pend>0?btn('generarDepreciacion','Generar depreciación',` data-hastames="${mesCorte}"`,false):'');
  }

  /* 4. Producción */
  if(esProductora(e)&&(e.ordenesProduccion||[]).length){
    const cifSinCerrar=r2(saldoNatural('5.1.10',movH)), abiertas=(e.ordenesProduccion||[]).filter(o=>o.estado==='abierta'&&o.fechaInicio<=R.hasta);
    const det=[];
    if(Math.abs(cifSinCerrar)>0.004) det.push(`Hay Q${Q(Math.abs(cifSinCerrar))} de CIF aplicados sin cerrar contra los CIF reales: hacé el cierre de CIF del período.`);
    if(abiertas.length) det.push(`${abiertas.length} orden(es) o corrida(s) siguen abiertas: su costo queda en Productos en proceso (Q${Q(saldoNatural('1.1.18',movH))}). Cerrá las que ya terminaron.`);
    paso('Producción: cierre de CIF y órdenes',Math.abs(cifSinCerrar)>0.004?'pend':abiertas.length?'aviso':'ok',
      det.join(' ')||'Los CIF del período están cerrados y no quedan órdenes abiertas.',
      (Math.abs(cifSinCerrar)>0.004&&cfgCostos(e).cif.modo==='tasa'?btn('cierreCIF','Cierre de CIF',' ',false):'')+btn('irProduccion','Ir a producción'));
  }

  /* 5. IVA mensual */
  const conDebito=meses.filter(m=>{ const iva=movimientosOperativos(e,m.desde,m.hasta), deb=saldoNatural('2.1.04',iva);
    return deb>0.004&&!(e.partidas||[]).some(p=>p.liqIVA&&p.liqIVA.desde<=m.hasta&&p.liqIVA.hasta>=m.desde); });
  paso('IVA de cada mes liquidado',conDebito.length?'pend':'ok',
    conDebito.length?`Falta liquidar el IVA de ${listaNombres(conDebito.map(m=>m.nombre))}.`:'No queda IVA del período sin liquidar.',
    conDebito.length?btn('pagarIVA','Pagar IVA',` data-desde="${conDebito[0].desde}" data-hasta="${conDebito[0].hasta}"`,false):'');

  /* 6. Retenciones */
  const rIsr=r2(saldoNatural('2.1.06',movH)), rIva=r2(saldoNatural('2.1.19',movH)), rCap=r2(saldoNatural('2.1.18',movH));
  paso('Retenciones por pagar a la SAT',(rIsr>0.004||rIva>0.004)?'pend':rCap>0.004?'aviso':'ok',
    [rIsr>0.004?`ISR retenido (planillas y facturas especiales) Q${Q(rIsr)}`:'',rIva>0.004?`IVA retenido en facturas especiales Q${Q(rIva)}`:'',
     rCap>0.004?`ISR sobre ganancias de capital Q${Q(rCap)} (se paga con una partida manual)`:''].filter(Boolean).join(' · ')||'No hay retenciones pendientes de pagar.',
    (rIsr>0.004?btn('pagarRetenciones','Pagar ISR retenido',' data-tipo="isr"',false):'')+(rIva>0.004?btn('pagarRetenciones','Pagar IVA retenido',' data-tipo="iva"',false):''));

  /* 7. ISO */
  const iso=calcularISO(e);
  if(iso.aplica){
    const trims=R.anual?[1,2,3,4]:[R.t];
    const exentos=trims.filter(t=>isoExentoTrimestre(e,e.ejercicio,t));
    const falta=trims.filter(t=>!exentos.includes(t)&&!(e.pagosISO||[]).some(p=>p.anio===e.ejercicio&&p.trimestre===t));
    paso('Impuesto de Solidaridad (ISO)',falta.length?'pend':'ok',
      (falta.length?`Falta pagar el ISO del trimestre ${listaNombres(falta.map(String))} (Q${Q(iso.isoTrimestral)} por trimestre).`:exentos.length===trims.length?'Exento: primeros cuatro trimestres de operación (Art. 4).':'ISO del período pagado.')
        +(exentos.length&&exentos.length<trims.length?` El trimestre ${listaNombres(exentos.map(String))} está exento por inicio de operaciones.`:''),
      falta.length?btn('pagarISO','Pagar ISO','',false):'');
  }

  /* 8. Conciliación */
  const prob=conciliacionLibros(e,R.desdeAno,R.hasta).filter(f=>!f.ok&&!f.informativo);
  paso('Conciliación de libros',prob.length?'pend':'ok',
    prob.length?`No cuadran: ${prob.map(f=>esc(f.nombre.split(' — ')[0])).join(', ')}.`:'Libros de compras y ventas, cartera y activos fijos cuadran con la contabilidad.',
    btn('irConciliacion','Ver conciliación'));

  /* 9. Inventario final y costo de ventas */
  const kardex=valorKardexAl(e,R.hasta), cuenta=r2(saldoNatural('1.1.08',movH));
  const guardado=Object.prototype.hasOwnProperty.call(e.inventarioFinal||{},R.hasta)?r2(e.inventarioFinal[R.hasta]):null;
  const costoCerrado=guardado!==null&&cuenta===guardado;
  const yaParcial=!R.anual&&(e.cierresParciales||[]).some(x=>x.ejercicio===e.ejercicio&&x.trimestre===R.t);
  paso('Inventario final y costo de ventas',costoCerrado||yaParcial?'ok':'pend',
    costoCerrado||yaParcial?`Costo de ventas cerrado: inventario final al ${fFecha(R.hasta)} de Q${Q(guardado!==null?guardado:cuenta)}.`
      :`<label for="cfInv" style="display:block;margin-bottom:6px">Inventario final al ${fFecha(R.hasta)} (conteo físico). Según el kardex hay <strong>Q${Q(kardex)}</strong>; si el conteo da otra cifra, cambiala.</label>
        <input id="cfInv" type="number" step="0.01" min="0" value="${guardado!==null?guardado:kardex}" style="max-width:200px">
        <span style="display:block;margin-top:6px;font-size:12.5px;color:var(--tinta-suave)">Saldo de Inventarios en la contabilidad: Q${Q(cuenta)}. La diferencia pasa a costo de ventas${R.anual?'.':', junto con el ISR del trimestre (paso siguiente).'}</span>`,
    !costoCerrado&&!yaParcial&&R.anual?btn('cfCerrarCosto','Cerrar costo de ventas',` data-hasta="${R.hasta}"`,false):'');

  /* 10. ISR */
  if(!R.anual){
    const hecho=(e.cierresParciales||[]).find(x=>x.ejercicio===e.ejercicio&&x.trimestre===R.t);
    let x;
    if(!hecho){ const antes=e.inventarioFinal&&e.inventarioFinal[R.hasta]; e.inventarioFinal=e.inventarioFinal||{};
      if(antes===undefined) e.inventarioFinal[R.hasta]=kardex;
      x=trimestresGeneral(e).find(y=>y.t===R.t);
      if(antes===undefined) delete e.inventarioFinal[R.hasta]; }
    paso(`ISR del trimestre ${R.t} (cierre contable parcial)`,hecho?'ok':'pend',
      hecho?`Registrado: Q${Q(hecho.monto)} (${hecho.metodo==='cierre'?'cierre contable parcial':'renta imponible estimada'}).`
        :`<p style="margin:0 0 8px">Con el inventario de arriba: renta imponible acumulada Q${Q(x.rentaImponibleAcum)} × 25 % = Q${Q(x.impuestoAcum)}, menos lo pagado en trimestres anteriores (Q${Q(x.impuestoTrimAnterior)}) → <strong>ISR a pagar Q${Q(x.cierre)}</strong>. Por renta estimada sería Q${Q(x.estimada)}.</p>
          <details><summary style="cursor:pointer;font-size:13px">Renglones para el formulario SAT-1361</summary><table style="font-size:13px;margin-top:8px">${filaSAT(x)}</table></details>`,
      hecho?'':btn('cfParcial','Registrar cierre del trimestre',` data-t="${R.t}"`,false));
  }else{
    const a=e.ejercicio;
    const hecho=(e.partidas||[]).some(p=>(p.concepto||'').startsWith(`Cierre fiscal total ${a}`)||(p.concepto||'').startsWith(`Pago de ISR de la liquidación final ${a}`));
    e.cierresParciales=e.cierresParciales||[]; const ca=calcularCierreAnual(e);
    paso(`Liquidación anual del ISR ${a}`,hecho?'ok':'pend',
      hecho?'Cierre fiscal total registrado.'
        :`Renta imponible del año Q${Q(ca.baseImponibleAnual)} × 25 % = Q${Q(ca.isrAnual)}; pagado en los trimestres Q${Q(ca.reconocidoEnParciales)} → <strong>${ca.diferencia>=0?`falta pagar Q${Q(ca.diferencia)}`:`pagado de más Q${Q(-ca.diferencia)} (se reclama a la SAT)`}</strong>.${costoCerrado?'':' Primero cerrá el costo de ventas (paso anterior).'}`,
      hecho?'':btn('cierreFiscalTotal','Registrar cierre fiscal total',costoCerrado?'':' disabled',false));
    /* 11. Cierre de libros */
    const cerrado=anioCerrado(e,a);
    paso('Cierre de libros',cerrado?'ok':'pend',
      cerrado?`El ejercicio ${a} está cerrado: ingresos, costos y gastos pasaron a Patrimonio.`
        :'Al final, después del cierre fiscal total: lleva el resultado del año a Patrimonio y deja el año cerrado para nuevas partidas.',
      cerrado?'':btn('cierreDeLibros','Cierre de libros',hecho?'':' disabled',false));
  }
  return {R,pasos};
}

VISTAS.cierreFiscal=()=>{
  const e=emp();
  if(regimenEn(e,`${e.ejercicio}-12-31`)!=='general') return cab('Cierre fiscal','Solo para el régimen General (ISR sobre utilidades del 25 %).')+
    '<div class="vacio">Esta empresa no está en el régimen General en este ejercicio. Sus impuestos se pagan en el Tablero fiscal.</div>';
  const id=CORTES_CF.some(c=>c.id===filtros.corteCF)?filtros.corteCF:(filtros.corteCF=corteSugeridoCF(e));
  const c=CORTES_CF.find(x=>x.id===id), {R,pasos}=pasosCierreFiscal(e,c);
  const listos=pasos.filter(p=>p.estado==='ok'||p.estado==='opcional').length;
  const icono={ok:'✓',pend:'',aviso:'!',opcional:'–'};
  return cab('Cierre fiscal (ISR 25 %)',`${esc(e.nombre)} · ejercicio ${e.ejercicio} · del ${fFecha(R.desde)} al ${fFecha(R.hasta)}. Todo lo del cierre en un solo lugar, en orden: cada paso tiene su botón.`,`<button class="btn sec" data-accion="irTablero">Tablero fiscal</button>`)
    +`<div class="barra"><div class="campo ancho"><label for="selCorteCF">Cierre de</label>
        <select id="selCorteCF" data-filtro="corteCF">${CORTES_CF.map(x=>`<option value="${x.id}"${x.id===id?' selected':''}>${x.nombre}</option>`).join('')}</select></div>
      <div class="progreso-cf" aria-live="polite"><strong>${listos} de ${pasos.length}</strong> pasos listos
        <span class="barra-cf"><span style="width:${Math.round(listos/pasos.length*100)}%"></span></span></div></div>
    <ol class="pasos-cf">${pasos.map((p,i)=>`<li class="paso-cf cf-${p.estado}">
        <span class="num-cf" aria-hidden="true">${icono[p.estado]||i+1}</span>
        <div class="cuerpo-cf"><h3>${p.titulo} <span class="estado-cf">${p.estado==='ok'?'Listo':p.estado==='aviso'?'Revisar':p.estado==='opcional'?'Opcional':'Pendiente'}</span></h3>
          <div class="det-cf">${p.detalle}</div>${p.botones?`<div class="acc-cf">${p.botones}</div>`:''}</div></li>`).join('')}</ol>`;
};
ACCIONES.irProduccion=()=>{VISTA='produccion';filtros={};pintar()};
ACCIONES.irResumen=()=>{VISTA='resumen';filtros={};pintar()};
ACCIONES.irCierreFiscal=()=>{VISTA='cierreFiscal';filtros={};pintar()};
ACCIONES.cfParcial=d=>{ const v=document.getElementById('cfInv'); ACCIONES.cierreFiscalParcial({trimestre:d.t,inv:v?v.value:''}); };
ACCIONES.cfCerrarCosto=d=>{
  const e=emp(), v=document.getElementById('cfInv'), monto=+(v&&v.value);
  if(!v||v.value===''||isNaN(monto)||monto<0){avisar('Escribí el inventario final del conteo físico.');return}
  e.inventarioFinal=e.inventarioFinal||{}; e.inventarioFinal[d.hasta]=r2(monto); guardar();
  ACCIONES.cerrarCostoVentas({hasta:d.hasta});
};
