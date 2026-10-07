/* ============ CONCILIACIÓN: DÓNDE ESTÁ LA DIFERENCIA ============ */
/* Cuando un libro auxiliar no cuadra con su cuenta, se revisa partida por partida qué movimiento lo causa.
   Para cada partida que toca la cuenta se compara lo que tiene contra lo que deberían sumar los documentos
   que registra (facturas, pagos, cobros, constancias): la diferencia de cada partida explica una parte del
   descuadre. Además se señalan documentos cuya partida ya no existe y casos típicos (una factura al crédito
   registrada como cobrada, una de contado contra Clientes, etc.). */
function claveConciliacion(nombre){
  return /^Partidas que no cuadran/.test(nombre)?'partidas':/^Libro de Ventas/.test(nombre)?'ivaVentas':/^Libro de Compras/.test(nombre)?'ivaCompras'
    :/^Clientes/.test(nombre)?'clientes':/^Proveedores/.test(nombre)?'proveedores':/costo registrado/.test(nombre)?'afCosto':/depreciación registrada/.test(nombre)?'afDep':'';
}
/* Movimiento natural de una cuenta dentro de una partida (positivo = en su sentido normal). */
function netoEnPartida(e,p,cta){
  const c=e.cuentas.find(x=>x.c===cta), deudora=c?NATURAL_DEUDORA(c.t):true;
  return r2(p.lineas.filter(l=>l.cta===cta).reduce((s,l)=>s+(deudora?(+l.debe||0)-(+l.haber||0):(+l.haber||0)-(+l.debe||0)),0));
}
const refDoc=d=>`${d.tipoDte||'FACT'} ${d.serie?d.serie+'-':''}${d.dte||''}`.trim();
const nombreCta=(e,cta)=>{ const c=e.cuentas.find(x=>x.c===cta); return `${cta} ${c?c.n:''}`.trim(); };
/* Compara, partida por partida, lo que tiene la cuenta contra lo esperado según los documentos.
   esperado: Map partidaId → {monto, docs:[texto]}; partidas: las que entran en la revisión. */
function compararPorPartida(e,cta,partidas,esperado,queEs){
  const hall=[], vistas=new Set();
  partidas.forEach(p=>{
    const real=netoEnPartida(e,p,cta), esp=esperado.get(p.id);
    if(esp) vistas.add(p.id);
    const m=esp?esp.monto:0, dif=r2(real-m);
    if(Math.abs(dif)<0.005) return;
    hall.push({partidaId:p.id,dif,texto:esp
      ?`Partida No. ${p.numero} (${fFecha(p.fecha)}): en ${nombreCta(e,cta)} tiene Q${Q(real)}, pero ${esp.docs.length===1?esp.docs[0]:`sus ${esp.docs.length} documentos`} suman Q${Q(m)}: hay Q${Q(Math.abs(dif))} de ${dif>0?'más':'menos'} en la cuenta. Probablemente se editó a mano.`
      :`Partida No. ${p.numero} (${fFecha(p.fecha)}, «${p.concepto||'sin concepto'}») mueve Q${Q(real)} en ${nombreCta(e,cta)} y no corresponde a ${queEs}. Si es correcta, el registro tiene que hacerse desde su pantalla para que entre al libro.`});
  });
  esperado.forEach((esp,id)=>{
    if(vistas.has(id)) return;
    if(e.partidas.some(p=>p.id===id)) return;   // existe pero está fuera de la revisión (otra fecha)
    const quien=esp.docs.join(', ');
    hall.push({dif:r2(-esp.monto),texto:`${quien.charAt(0).toUpperCase()+quien.slice(1)} ${esp.docs.length===1?'está':'están'} registrado en el libro por Q${Q(Math.abs(esp.monto))}, pero su partida ya no existe (se borró). Volvé a registrarlo o quitalo del libro.`});
  });
  return hall;
}
function agregarEsperado(mapa,partidaId,monto,texto){
  if(!partidaId||Math.abs(monto)<0.005) return;
  const x=mapa.get(partidaId)||{monto:0,docs:[]}; x.monto=r2(x.monto+monto); x.docs.push(texto); mapa.set(partidaId,x);
}

function diagnosticoConciliacion(e,desde,hasta,clave){
  const hall=[];
  const enRango=p=>(!desde||p.fecha>=desde)&&(!hasta||p.fecha<=hasta);
  const operativas=e.partidas.filter(p=>enRango(p)&&!(p.concepto||'').startsWith(PREFIJO_CIERRE_LIBROS)&&!esLiquidacionIVA(p)&&!esLiquidacionISR(p));
  const hastaFecha=e.partidas.filter(p=>!hasta||p.fecha<=hasta);
  const docEnRango=d=>(!desde||d.fecha>=desde)&&(!hasta||d.fecha<=hasta)&&['general','simplificado'].includes(regimenEn(e,d.fecha));

  if(clave==='partidas'){
    e.partidas.filter(p=>Math.abs(r2(p.lineas.reduce((s,l)=>s+(+l.debe||0)-(+l.haber||0),0)))>=0.01).forEach(p=>{
      const d=r2(p.lineas.reduce((s,l)=>s+(+l.debe||0),0)), h=r2(p.lineas.reduce((s,l)=>s+(+l.haber||0),0));
      hall.push({partidaId:p.id,texto:`Partida No. ${p.numero} (${fFecha(p.fecha)}, «${p.concepto||'sin concepto'}»): debe Q${Q(d)} y haber Q${Q(h)}, le faltan Q${Q(Math.abs(d-h))} en el ${d>h?'haber':'debe'}.`});
    });
    return {hallazgos:hall};
  }
  if(clave==='ivaVentas'||clave==='ivaCompras'){
    const venta=clave==='ivaVentas', cta=venta?'2.1.04':'1.1.09', esp=new Map();
    (e.documentos||[]).filter(d=>d.tipo===(venta?'venta':'compra')&&(venta||d.cta!=='6.2.14')&&docEnRango(d))
      .forEach(d=>agregarEsperado(esp,d.partidaId,r2((d.signo||1)*(d.iva||0)),`la ${venta?'venta':'compra'} ${refDoc(d)}`));
    /* Una partida de compras puede llevar también ventas (agrupadas por día): las dos cuentas se revisan aparte. */
    hall.push(...compararPorPartida(e,cta,operativas.filter(p=>p.lineas.some(l=>l.cta===cta)),esp,`ninguna factura de ${venta?'venta':'compra'} cargada`));
    const sinVinculo=(e.documentos||[]).filter(d=>d.tipo===(venta?'venta':'compra')&&docEnRango(d)&&!d.partidaId&&(d.iva||0));
    if(sinVinculo.length) hall.push({texto:`${sinVinculo.length} documento(s) con IVA cargados antes de que el sistema guardara su partida (${sinVinculo.slice(0,4).map(refDoc).join(', ')}${sinVinculo.length>4?'…':''}): no se pueden revisar uno por uno.`});
    return {hallazgos:hall};
  }
  if(clave==='clientes'||clave==='proveedores'){
    const cli=clave==='clientes', cta=cli?'1.1.04':'2.1.01', tipo=cli?'venta':'compra', esp=new Map();
    (e.documentos||[]).filter(d=>d.tipo===tipo&&(!hasta||d.fecha<=hasta)).forEach(d=>{
      const neto=cli?r2(d.total-(d.retencionISR||0)-(d.retencionIVA||0)):r2(d.total-(d.retIvaFesp||0)-(d.retIsrFesp||0));
      if(d.alCredito&&d.ctaPago===cta) agregarEsperado(esp,d.partidaId,r2((d.signo||1)*neto),`la factura ${refDoc(d)}`);
      else if(d.alCredito&&d.ctaPago!==cta) hall.push({partidaId:d.partidaId,dif:r2(-(d.signo||1)*neto),texto:`La factura ${refDoc(d)} de ${d.nombre||d.nit} (${fFecha(d.fecha)}) es al crédito y aparece en el estado de cuenta por Q${Q(neto)}, pero se contabilizó contra ${nombreCta(e,d.ctaPago)} en vez de ${nombreCta(e,cta)}.`});
      else if(!d.alCredito&&d.ctaPago===cta) hall.push({partidaId:d.partidaId,dif:r2((d.signo||1)*neto),texto:`La factura ${refDoc(d)} de ${d.nombre||d.nit} (${fFecha(d.fecha)}) es de contado, pero se contabilizó contra ${nombreCta(e,cta)}: suma a la cuenta y no al estado de cuenta.`});
    });
    (cli?(e.cobros||[]):(e.pagos||[])).filter(x=>!hasta||x.fecha<=hasta)
      .forEach(x=>agregarEsperado(esp,x.partidaId,r2(-x.monto),`${cli?(x.forma==='retencion'?'la constancia de retención':'el cobro'):'el pago'} a ${x.nombre||x.nit} del ${fFecha(x.fecha)}`));
    const yaSenaladas=new Set(hall.map(h=>h.partidaId).filter(Boolean));
    hall.push(...compararPorPartida(e,cta,hastaFecha.filter(p=>p.lineas.some(l=>l.cta===cta)&&!yaSenaladas.has(p.id)),esp,
      cli?'ninguna factura al crédito, cobro ni constancia registrados':'ninguna factura al crédito ni pago registrados'));
    /* Saldos al revés en el estado de cuenta. */
    (cli?carteraClientes(e,hasta):carteraProveedores(e,hasta)).filter(x=>x.saldo<-0.005).forEach(x=>
      hall.push({texto:`A ${x.nombre||x.nit} se le ${cli?'cobraron':'pagaron'} Q${Q(-x.saldo)} más de lo que ${cli?'se le vendió':'se le compró'} al crédito: revisá si falta cargar una factura o si un ${cli?'cobro':'pago'} quedó repetido.`}));
    return {hallazgos:hall};
  }
  if(clave==='afCosto'||clave==='afDep'){
    const mov=movimientos(null,null), af=(e.activosFijos||[]).filter(a=>!a.baja);
    Object.entries(CATEGORIAS_DEPRECIACION).forEach(([k,c])=>{
      const deCat=af.filter(a=>a.categoria===k);
      if(clave==='afCosto'){
        const reg=r2(deCat.reduce((s,a)=>s+a.costo,0)), cuenta=r2(saldoNatural(c.act,mov)), dif=r2(cuenta-reg);
        if(Math.abs(dif)<0.005) return;
        const facturas=(e.documentos||[]).filter(d=>d.tipo==='compra'&&d.cta===c.act);
        hall.push({dif,texto:dif>0
          ?`${c.nAct} (${c.act}): la cuenta tiene Q${Q(cuenta)} y los activos registrados suman Q${Q(reg)}. Faltan Q${Q(dif)} por registrar en "Activos fijos"${facturas.length?` (facturas cargadas a esa cuenta: ${facturas.slice(0,4).map(d=>`${refDoc(d)} Q${Q(d.base)}`).join(', ')})`:''}.`
          :`${c.nAct} (${c.act}): los activos registrados suman Q${Q(reg)} pero la cuenta solo tiene Q${Q(cuenta)}. ${deCat.map(a=>`«${a.descripcion}» (Q${Q(a.costo)})`).join(', ')}: falta cargar su factura con la cuenta ${c.act}, o el costo registrado no es el de la factura.`});
      }else{
        const reg=r2(deCat.reduce((s,a)=>s+(a.acumulada||0),0)), cuenta=r2(-saldoNatural(c.dep,mov)), dif=r2(cuenta-reg);
        if(Math.abs(dif)<0.005) return;
        const deSistema=new Set([...e.partidas.filter(p=>p.depDetalle).map(p=>p.id),...(e.activosFijos||[]).filter(a=>a.baja&&a.baja.partidaId).map(a=>a.baja.partidaId)]);
        const manuales=e.partidas.filter(p=>p.lineas.some(l=>l.cta===c.dep)&&!deSistema.has(p.id));
        if(manuales.length) manuales.forEach(p=>hall.push({partidaId:p.id,dif:r2(-netoEnPartida(e,p,c.dep)),texto:`Partida No. ${p.numero} (${fFecha(p.fecha)}, «${p.concepto||'sin concepto'}») registra depreciación en ${c.dep} por Q${Q(Math.abs(netoEnPartida(e,p,c.dep)))} fuera de "Generar depreciación": el registro de cada activo no se enteró.`}));
        else hall.push({dif,texto:`${c.nDep} (${c.dep}): la cuenta tiene Q${Q(cuenta)} y el registro de activos Q${Q(reg)}. Revisá si se borró a mano una partida de depreciación.`});
      }
    });
    return {hallazgos:hall};
  }
  return {hallazgos:hall};
}
function htmlDiagnostico(e,desde,hasta,f){
  const clave=claveConciliacion(f.nombre); if(!clave) return '';
  const {hallazgos}=diagnosticoConciliacion(e,desde,hasta,clave);
  if(!hallazgos.length) return `<div class="diag-conc"><p>No se encontró un movimiento puntual que explique la diferencia. Revisá las partidas manuales del período.</p></div>`;
  const explicado=r2(hallazgos.reduce((s,h)=>s+(h.dif||0),0));
  const conMonto=!f.cantidad&&hallazgos.some(h=>h.dif!==undefined);
  return `<div class="diag-conc"><p class="diag-tit">Lo que encontró el sistema</p><ul>${hallazgos.slice(0,30).map(h=>`<li><span>${esc(h.texto)}</span>${h.partidaId&&e.partidas.some(p=>p.id===h.partidaId)?` <button class="btn mini sec" data-accion="verPartida" data-id="${h.partidaId}">Ver partida</button>`:''}</li>`).join('')}</ul>
    ${hallazgos.length>30?`<p>…y ${hallazgos.length-30} más.</p>`:''}
    ${conMonto?`<p class="diag-pie">${Math.abs(Math.abs(explicado)-Math.abs(f.dif))<0.01?'Estos movimientos explican toda la diferencia.':`Estos movimientos explican Q${Q(Math.abs(explicado))} de los Q${Q(Math.abs(f.dif))} de diferencia.`}</p>`:''}</div>`;
}
