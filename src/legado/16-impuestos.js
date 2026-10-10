/* ============ PAGO DE IMPUESTOS Y CIERRES FISCALES ============ */
/* ============ CONCILIACIÓN DE LIBROS ============ */
/* El Diario, el Mayor, la Balanza y los estados financieros se recalculan
   siempre desde las partidas, así que se actualizan solos con cada
   movimiento. Lo que puede quedar desalineado son los registros que viven
   APARTE de las partidas —libros de compras y ventas, cartera, activos fijos—
   cuando alguien edita una partida a mano. Esta revisión compara cada uno
   contra su cuenta contable y dice dónde está la diferencia. */
function conciliacionLibros(e,desde,hasta){
  const filas=[];
  const add=(nombre,libro,contable,ayuda,informativo)=>{
    const dif=r2(libro-contable);
    filas.push({nombre,libro:r2(libro),contable:r2(contable),dif,ok:Math.abs(dif)<0.01,ayuda,informativo:!!informativo});
  };
  /* 1. Toda partida debe cuadrar */
  const malas=(e.partidas||[]).filter(p=>Math.abs(r2(p.lineas.reduce((s,l)=>s+(+l.debe||0)-(+l.haber||0),0)))>=0.01);
  filas.push({nombre:'Partidas que no cuadran (debe ≠ haber)',libro:malas.length,contable:0,dif:malas.length,ok:!malas.length,
    ayuda:malas.length?`Revisá las partidas No. ${malas.slice(0,8).map(p=>p.numero).join(', ')}${malas.length>8?'…':''}.`:'',cantidad:true});
  /* 2. Libros de IVA contra sus cuentas (solo operaciones, sin pagos ni compensaciones) */
  const enRango=d=>(!desde||d.fecha>=desde)&&(!hasta||d.fecha<=hasta)&&['general','simplificado'].includes(regimenEn(e,d.fecha));
  const ops=movimientosOperativos(e,desde,hasta);
  const m=(c,lado)=>(ops[c]||{debe:0,haber:0})[lado]||0;
  const ventas=(e.documentos||[]).filter(d=>d.tipo==='venta'&&enRango(d));
  const compras=(e.documentos||[]).filter(d=>d.tipo==='compra'&&enRango(d)&&d.cta!=='6.2.14');
  add('Libro de Ventas — débito fiscal vs. cuenta 2.1.04',ventas.reduce((s,d)=>s+(d.signo||1)*(d.iva||0),0),m('2.1.04','haber')-m('2.1.04','debe'),
    'Si no cuadra: una venta se editó a mano en Partidas, o se registró IVA en una partida manual sin cargar la factura.');
  add('Libro de Compras — crédito fiscal vs. cuenta 1.1.09',compras.reduce((s,d)=>s+(d.signo||1)*(d.iva||0),0),m('1.1.09','debe')-m('1.1.09','haber'),
    'Si no cuadra: una compra se editó a mano en Partidas, o hay crédito fiscal en una partida manual sin factura cargada.');
  /* 3. Cartera contra cuentas (todo el historial) */
  const movTodo=movimientos(null,hasta||null);
  add('Clientes — estado de cuenta vs. cuenta 1.1.04',carteraClientes(e,hasta).reduce((s,x)=>s+x.saldo,0),saldoNatural('1.1.04',movTodo),
    'Si no cuadra: hay ventas al crédito o cobros registrados en partidas manuales, fuera de "Cargar facturas" y "Registrar cobro".');
  add('Proveedores — estado de cuenta vs. cuenta 2.1.01',carteraProveedores(e,hasta).reduce((s,x)=>s+x.saldo,0),saldoNatural('2.1.01',movTodo),
    'Si no cuadra: hay compras al crédito o pagos registrados en partidas manuales, fuera de "Cargar facturas" y "Registrar pago".');
  /* 4. Activos fijos contra el mayor. El registro de activos guarda el estado de hoy (depreciación y
     bajas), así que se compara con las cuentas de hoy, no a la fecha de corte. */
  const cats=Object.values(CATEGORIAS_DEPRECIACION), af=(e.activosFijos||[]).filter(a=>!a.baja), movAF=movimientos(null,null);
  if(af.length||cats.some(c=>saldoNatural(c.act,movAF))){
    add('Activos fijos — costo registrado vs. cuentas de activo',af.reduce((s,a)=>s+a.costo,0),cats.reduce((s,c)=>s+saldoNatural(c.act,movAF),0),
      'El costo de cada activo tiene que estar cargado en su cuenta (con la factura de compra) y registrado en "Activos fijos".');
    add('Activos fijos — depreciación registrada vs. cuentas de depreciación',af.reduce((s,a)=>s+(a.acumulada||0),0),-cats.reduce((s,c)=>s+saldoNatural(c.dep,movAF),0),
      'Si no cuadra: se registró depreciación en una partida manual en vez de "Generar depreciación".');
  }
  /* 5. Inventario: informativo (el sistema es periódico — la cuenta solo baja al cerrar el costo de ventas) */
  const kardex=inventarioDetalle(e);
  add('Inventario — kardex vs. cuenta 1.1.08 (informativo)',kardex.lista.reduce((s,p)=>s+p.total,0)+kardex.sinDetalleValor,saldoNatural('1.1.08',movTodo),
    'Es normal que difieran entre cierres: la cuenta 1.1.08 se ajusta al conteo físico con "Cerrar costo de ventas".',true);
  return filas;
}
VISTAS.conciliacion=()=>{
  const e=emp();
  const d=filtros.desde||`${e.ejercicio}-01-01`, h=filtros.hasta||`${e.ejercicio}-12-31`;
  const filas=conciliacionLibros(e,d,h);
  const problemas=filas.filter(f=>!f.ok&&!f.informativo);
  return cab('Conciliación de libros','Compara los libros auxiliares con la contabilidad. Diario, Mayor, Balanza y estados financieros se recalculan solos con cada movimiento.')
  + rangoFechas(d,h)
  + `<div class="aviso ${problemas.length?'malo':'bien'}">${problemas.length
      ?`${problemas.length} revisión(es) no cuadran. Abajo está dónde buscar.`
      :'Todo cuadra: los libros auxiliares coinciden con la contabilidad.'}</div>
    <table><thead><tr><th>Revisión</th><th class="num">Libro / registro</th><th class="num">Contabilidad</th><th class="num">Diferencia</th><th>Estado</th></tr></thead><tbody>
    ${filas.map(f=>`<tr><td>${esc(f.nombre)}${!f.ok&&f.ayuda?`<br><span style="font-size:12.5px;color:var(--tinta-suave)">${esc(f.ayuda)}</span>`:''}${!f.ok&&!f.informativo?htmlDiagnostico(e,d,h,f):''}</td>
      <td class="num">${f.cantidad?f.libro:Q(f.libro)}</td><td class="num">${f.cantidad?'—':Q(f.contable)}</td>
      <td class="num">${f.cantidad?f.dif:Q(f.dif)}</td>
      <td>${f.ok?'<span style="color:var(--ok)">✔ cuadra</span>':f.informativo?'<span style="color:var(--tinta-suave)">ⓘ informativo</span>':'<span style="color:var(--alerta)">✖ revisar</span>'}</td></tr>`).join('')}
    </tbody></table>`;
};

/* ============ RETENCIONES ============ */
/* Sufridas: lo que tus clientes te retienen al pagarte (constancias de
   retención). Son un crédito a tu favor que se resta del impuesto al pagar:
   · ISR (1.1.10) — se aplica en "Pagar ISR" del régimen Simplificado.
   · IVA (1.1.19) — se aplica en "Pagar IVA".
   · 5% de Pequeño Contribuyente (1.1.17) — se aplica en el pago del 5%.
   Se anotan en la factura de venta al cargarla, o después con "Registrar
   constancia" si la retención llegó al cobrar.
   Practicadas: lo que la empresa retiene a otros y debe enterar a la SAT:
   ISR de planillas y facturas especiales (2.1.06) e IVA de facturas especiales (2.1.19). */
const TIPOS_RETENCION={
  isr:{nombre:'ISR',cta:'1.1.10',nCta:'ISR pagado por anticipado / retenido por clientes'},
  iva:{nombre:'IVA',cta:'1.1.19',nCta:'IVA retenido por clientes (constancias por aplicar)'},
  peq:{nombre:'5% Pequeño Contribuyente',cta:'1.1.17',nCta:'Retenciones del 5% sufridas (Pequeño Contribuyente)'}};
const RETENCIONES_POR_PAGAR={
  isr:{nombre:'ISR retenido (planillas y facturas especiales)',cta:'2.1.06'},
  iva:{nombre:'IVA retenido (facturas especiales)',cta:'2.1.19',nCta:'IVA retenido por pagar (facturas especiales)'}};
function retencionesSufridas(e){
  const filas=[];
  (e.documentos||[]).filter(d=>d.tipo==='venta').forEach(d=>{
    const s=d.signo||1, doc=`${d.tipoDte||'FACT'} ${d.serie||''}${d.dte?'-'+d.dte:''}`;
    if(d.retencionISR) filas.push({fecha:d.fecha,tipo:regimenEn(e,d.fecha)==='pequeno'?'peq':'isr',nit:d.nit,nombre:d.nombre,doc,monto:r2(s*d.retencionISR),constancia:'',origen:'Factura'});
    if(d.retencionIVA) filas.push({fecha:d.fecha,tipo:'iva',nit:d.nit,nombre:d.nombre,doc,monto:r2(s*d.retencionIVA),constancia:'',origen:'Factura'});
  });
  (e.retenciones||[]).forEach(r=>filas.push({...r,origen:'Constancia'}));
  return filas.sort((a,b)=>(a.fecha||'').localeCompare(b.fecha||''));
}
VISTAS.retenciones=()=>{
  const e=emp(), ej=String(e.ejercicio);
  const sufr=retencionesSufridas(e).filter(r=>(r.fecha||'').slice(0,4)===ej);
  const movTodo=movimientos(null,null), movAnio=movimientos(`${ej}-01-01`,`${ej}-12-31`);
  const resumenSufr=Object.entries(TIPOS_RETENCION).map(([k,t])=>{
    const retenido=r2(sufr.filter(r=>r.tipo===k).reduce((s,r)=>s+r.monto,0));
    const disponible=r2(saldoNatural(t.cta,movTodo));
    return `<tr><td>${t.nombre}</td><td class="num">${Q(retenido)}</td><td class="num"><strong>${Q(disponible)}</strong></td></tr>`;
  }).join('');
  const resumenPrac=Object.entries(RETENCIONES_POR_PAGAR).map(([k,t])=>{
    const m=movAnio[t.cta]||{haber:0}, retenido=r2(m.haber||0), saldo=r2(saldoNatural(t.cta,movTodo));
    return `<tr><td>${t.nombre}</td><td class="num">${Q(retenido)}</td><td class="num"><strong>${Q(saldo)}</strong></td>
      <td class="num">${saldo>0.004?`<button class="btn mini" data-accion="pagarRetenciones" data-tipo="${k}">Pagar</button>`:''}</td></tr>`;
  }).join('');
  const detalle=sufr.map(r=>`<tr><td>${fFecha(r.fecha)}</td><td>${esc(TIPOS_RETENCION[r.tipo].nombre)}</td>
    <td>${esc(r.nombre||'—')}<br><span style="font-size:12px;color:var(--tinta-suave)">NIT ${esc(r.nit||'—')}</span></td>
    <td>${esc(r.doc||'—')}${r.constancia?`<br><span style="font-size:12px;color:var(--tinta-suave)">Constancia ${esc(r.constancia)}</span>`:''}</td>
    <td>${r.origen}</td><td class="num">${Q(r.monto)}</td></tr>`).join('');
  return cab('Retenciones',`Ejercicio ${ej} · las sufridas se restan solas al pagar el impuesto; las practicadas se pagan aquí`,
    `<button class="btn" data-accion="registrarConstancia">Registrar constancia de retención</button>`)
  + `<h3 style="color:var(--verde);margin:0 0 8px">Retenciones que te hicieron (a tu favor)</h3>
    <table><thead><tr><th>Tipo</th><th class="num">Retenido en ${ej}</th><th class="num">Disponible para aplicar</th></tr></thead><tbody>${resumenSufr}</tbody></table>
    <p style="font-size:13px;color:var(--tinta-suave);margin:6px 0 18px">"Disponible" es el saldo de la cuenta: lo retenido menos lo ya aplicado en pagos de impuestos.</p>
    <h3 style="color:var(--verde);margin:0 0 8px">Retenciones que vos hiciste (por enterar a la SAT)</h3>
    <table><thead><tr><th>Tipo</th><th class="num">Retenido en ${ej}</th><th class="num">Pendiente de pagar</th><th></th></tr></thead><tbody>${resumenPrac}</tbody></table>
    <h3 style="color:var(--verde);margin:22px 0 8px">Detalle de retenciones sufridas en ${ej}</h3>
    ${sufr.length?`<table style="font-size:13px"><thead><tr><th>Fecha</th><th>Tipo</th><th>Cliente</th><th>Documento</th><th>Origen</th><th class="num">Monto</th></tr></thead><tbody>${detalle}</tbody></table>`
      :`<div class="vacio">Todavía no hay retenciones sufridas en ${ej}. Se anotan al cargar las facturas de venta, o con "Registrar constancia".</div>`}`;
};
ACCIONES.registrarConstancia=()=>{
  const e=emp();
  const cajaBanco=cuentasCajaBanco(e);
  const clientes=carteraClientes(e);
  const regPeq=regimenEn(e,hoy())==='pequeno';
  abrirModal('Registrar constancia de retención',
    `<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">Para retenciones que te hicieron al cobrar y que no se anotaron en la factura de venta.</p>
    <datalist id="dlClientesRet">${clientes.map(c=>`<option value="${esc(c.nit)}">${esc(c.nombre||'')}</option>`).join('')}</datalist>
    <div class="rej">
      <div class="campo"><label>Tipo</label><select name="tipo">${Object.entries(TIPOS_RETENCION).map(([k,t])=>`<option value="${k}"${(regPeq?k==='peq':k==='isr')?' selected':''}>${t.nombre}</option>`).join('')}</select></div>
      <div class="campo"><label>Fecha</label><input name="fecha" type="date" value="${hoy()}"></div>
      <div class="campo"><label>NIT del cliente (agente de retención)</label><input name="nit" list="dlClientesRet"></div>
      <div class="campo"><label>Nombre</label><input name="nombre"></div>
      <div class="campo"><label>Factura a la que corresponde</label><input name="doc" placeholder="Serie y número"></div>
      <div class="campo"><label>No. de constancia</label><input name="constancia"></div>
      <div class="campo"><label>Monto retenido</label><input name="monto" type="number" step="0.01" min="0"></div>
      <div class="campo"><label>Se descuenta de</label><select name="contra">
        <option value="1.1.04">1.1.04 — Clientes (lo que te debía)</option>
        ${cajaBanco.map(c=>`<option value="${c.c}">${c.c} — ${esc(c.n)} (corrige un cobro ya registrado completo)</option>`).join('')}</select></div>
    </div>`,
    d=>{
      const monto=r2(+d.monto);
      if(!(monto>0)){avisar('Escribí el monto retenido.');return false}
      if(!d.fecha){avisar('Escribí la fecha.');return false}
      if(anioCerrado(e,d.fecha.slice(0,4))){avisar('Ese ejercicio ya tiene Cierre de libros.');return false}
      const t=TIPOS_RETENCION[d.tipo];
      asegurarCuenta(e,t.cta,t.nCta,'activo');
      const nit=(d.nit||'').trim()||'CF', nombre=(d.nombre||'').trim()||((clientes.find(c=>c.nit===nit)||{}).nombre||'');
      const p={id:uid(),numero:e.correlativo++,fecha:d.fecha,
        concepto:`Constancia de retención de ${t.nombre}${d.constancia?' No. '+d.constancia.trim():''} — ${nombre||nit}`,
        docTipo:'Constancia de retención',docSerie:'',docNum:(d.constancia||'').trim(),nit,contraparte:nombre,
        lineas:[{cta:t.cta,desc:(d.doc||'').trim(),debe:monto,haber:0},{cta:d.contra,desc:'',debe:0,haber:monto}]};
      e.partidas.push(p);
      e.retenciones=e.retenciones||[];
      e.retenciones.push({id:uid(),fecha:d.fecha,tipo:d.tipo,nit,nombre,doc:(d.doc||'').trim(),constancia:(d.constancia||'').trim(),monto,partidaId:p.id});
      if(d.contra==='1.1.04'){
        e.cobros=e.cobros||[];
        e.cobros.push({id:uid(),fecha:d.fecha,nit,nombre,forma:'retencion',numeroCheque:(d.constancia||'').trim(),cuenta:t.cta,monto,partidaId:p.id});
      }
      registrarLog('Registró una constancia de retención',`${t.nombre} — ${nombre||nit} — Q${Q(monto)}`);
      guardar(); pintar();
      avisar(`Retención registrada en la partida No. ${p.numero}. Se va a restar sola al pagar el impuesto.`,'Listo');
    },'Registrar');
  const n=mForm.querySelector('[name="nit"]'), nom=mForm.querySelector('[name="nombre"]');
  n.onchange=()=>{ const c=clientes.find(x=>x.nit===n.value.trim()); if(c&&!nom.value) nom.value=c.nombre||''; };
  /* El tipo sugerido sigue el régimen de la fecha de la constancia (una de junio, en Pequeño, es del 5%). */
  const tipo=mForm.querySelector('[name="tipo"]'), fecha=mForm.querySelector('[name="fecha"]');
  tipo.addEventListener('change',()=>{ tipo.dataset.tocado='1'; });
  fecha.addEventListener('change',()=>{ if(!tipo.dataset.tocado&&fecha.value) tipo.value=regimenEn(e,fecha.value)==='pequeno'?'peq':'isr'; });
};
ACCIONES.pagarRetenciones=d0=>{
  const e=emp(), tipo=d0.tipo==='iva'?'iva':'isr', t=RETENCIONES_POR_PAGAR[tipo];
  const cajaBanco=cuentasCajaBanco(e);
  if(!cajaBanco.length){avisar('El catálogo no tiene ninguna cuenta de Caja o Bancos.');return}
  const {desde:dDef,hasta:hDef}=mesAnteriorRango();
  const calc=(desde,hasta)=>{
    const m=movimientos(desde,hasta)[t.cta]||{haber:0};
    const saldo=r2(saldoNatural(t.cta,movimientos(null,null)));
    return {retenido:r2(m.haber||0),saldo,sugerido:r2(Math.min(m.haber||0,saldo))};
  };
  const c0=calc(dDef,hDef);
  abrirModal(`Pagar retenciones — ${t.nombre}`,
    `<div class="rej">
      <div class="campo"><label>Retenido desde</label><input name="desde" type="date" value="${dDef}"></div>
      <div class="campo"><label>hasta</label><input name="hasta" type="date" value="${hDef}"></div>
      <div class="campo"><label>Monto a pagar</label><input name="monto" type="number" step="0.01" min="0" value="${c0.sugerido}"></div>
      <div class="campo"><label>Fecha de pago</label><input name="fechaPago" type="date" value="${hoy()}"></div>
      <div class="campo full"><label>Se paga desde</label><select name="cuenta">${cajaBanco.map(c=>`<option value="${c.c}">${c.c} — ${esc(c.n)}</option>`).join('')}</select></div>
    </div><p id="prevRet" style="margin:8px 0 0;font-size:13px;color:var(--tinta-suave)"></p>`,
    d=>{
      const monto=r2(+d.monto), c=calc(d.desde,d.hasta);
      if(!(monto>0)){avisar('Escribí el monto a pagar.');return false}
      if(monto>c.saldo+0.005){avisar(`El saldo pendiente de esta retención es Q${Q(c.saldo)}.`);return false}
      const ya=(e.partidas||[]).find(p=>p.liqRet&&p.liqRet.tipo===tipo&&p.liqRet.desde<=d.hasta&&p.liqRet.hasta>=d.desde);
      if(ya){avisar(`Ese período ya tiene un pago de esta retención (partida No. ${ya.numero}).`);return false}
      const p={id:uid(),numero:e.correlativo++,fecha:d.fechaPago,
        concepto:`Pago de retenciones de ${tipo==='iva'?'IVA':'ISR'} del ${fFecha(d.desde)} al ${fFecha(d.hasta)}`,
        docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'SAT',
        lineas:[{cta:t.cta,desc:'',debe:monto,haber:0},{cta:d.cuenta,desc:'',debe:0,haber:monto}],
        liqRet:{tipo,desde:d.desde,hasta:d.hasta}};
      e.partidas.push(p);
      registrarLog('Pagó retenciones',`${t.nombre} — Q${Q(monto)}`);
      guardar(); pintar();
      avisar(`Retenciones pagadas por Q${Q(monto)}. Partida No. ${p.numero}.`,'Listo');
    },'Registrar pago');
  const q=n=>mForm.querySelector(`[name="${n}"]`);
  const act=()=>{ const c=calc(q('desde').value,q('hasta').value); q('monto').value=c.sugerido;
    document.getElementById('prevRet').textContent=`Retenido en el período: Q${Q(c.retenido)} · saldo pendiente total: Q${Q(c.saldo)}`; };
  q('desde').onchange=act; q('hasta').onchange=act; act();
};

/* ============ DEVOLUCIÓN DE CRÉDITO FISCAL DE IVA ============ */
/* Solo para exportadores o quienes venden a entidades exentas (Art. 23 y 24,
   Ley del IVA) — el trámite real se presenta con el Formulario SAT-212 y su
   documentación de respaldo, ante el Banco de Guatemala. El sistema no hace
   ese trámite por vos: lo que sí lleva es el registro contable completo,
   desde que se solicita hasta que de verdad entra el dinero. */
VISTAS.devolucionIVA=()=>{
  const e=emp();
  e.devolucionesIVA=e.devolucionesIVA||[];
  const lista=[...e.devolucionesIVA].sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const creditoActual=saldoNatural('1.1.09',movimientos(null,hoy()));
  const fila=s=>`<tr><td>${fFecha(s.fecha)}</td><td>${fFecha(s.desde)} — ${fFecha(s.hasta)}</td>
    <td>${esc(s.regimenSolicitud)}</td><td class="num">${Q(s.monto)}</td>
    <td>${s.estado==='recibida'?`<span class="ok">Recibida el ${fFecha(s.fechaRecibida)}</span>`:'<span style="color:var(--alerta)">En trámite</span>'}</td>
    <td class="num">${s.estado!=='recibida'?`<button class="btn mini" data-accion="registrarDevolucionRecibida" data-id="${s.id}">Ya llegó</button>`:`<button class="btn mini sec" data-accion="verPartida" data-id="${s.partidaRecibidaId}">Ver partida</button>`}</td></tr>`;
  return cab('Devolución de crédito fiscal de IVA',
    'Para exportadores o ventas a entidades exentas — el trámite se presenta aparte ante el Banco de Guatemala, esto solo lleva el registro contable.',
    `<button class="btn" data-accion="solicitarDevolucionIVA">Nueva solicitud</button>`)
  + `<div class="cifras"><div class="cifra"><span>Crédito fiscal acumulado hoy</span><strong>${Q(creditoActual)}</strong></div></div>`
  + (lista.length? `<table><thead><tr><th>Solicitada el</th><th>Período que cubre</th><th>Régimen</th>
      <th class="num">Monto</th><th>Estado</th><th class="num"></th></tr></thead>
      <tbody>${lista.map(fila).join('')}</tbody></table>`
     : `<div class="vacio">Todavía no se ha solicitado ninguna devolución.</div>`)
  + `<div class="aviso">Solo califican exportadores, o quienes venden o prestan servicios a personas exentas,
      siempre que no agoten su crédito fiscal con débitos de sus otras ventas (Art. 23 y 24, Ley del IVA).
      Hay cuatro modalidades reales del trámite —General, Especial, Optativo y Electrónico—, cada una con su
      propio porcentaje y periodicidad; esto solo es informativo, la calificación y el trámite se hacen en la
      Agencia Virtual y ante el Banco de Guatemala con el Formulario SAT-212.</div>`;
};

ACCIONES.solicitarDevolucionIVA=()=>{
  const e=emp();
  const creditoActual=saldoNatural('1.1.09',movimientos(null,hoy()));
  if(creditoActual<=0){avisar('No hay crédito fiscal de IVA acumulado para solicitar en devolución.');return}
  abrirModal('Solicitar devolución de crédito fiscal',
    `<p style="margin:0 0 14px;font-size:13px;color:var(--tinta-suave)">Crédito fiscal acumulado hoy:
      <strong>Q${Q(creditoActual)}</strong>. No hace falta solicitar todo — podés pedir solo una parte y dejar
      el resto compensando normal contra tu débito fiscal futuro.</p>
    <div class="rej">
      <div class="campo full"><label>Monto a solicitar</label><input name="monto" type="number" step="0.01" min="0" max="${creditoActual}" value="${creditoActual}"></div>
      <div class="campo"><label>Período — desde</label><input name="desde" type="date"></div>
      <div class="campo"><label>hasta</label><input name="hasta" type="date" value="${hoy()}"></div>
      <div class="campo full"><label>Modalidad del trámite</label><select name="regimenSolicitud">
        <option value="General">Régimen General (trimestral/semestral)</option>
        <option value="Especial">Régimen Especial (mensual, con dictamen de Contador)</option>
        <option value="Optativo">Régimen Optativo (mensual, 75% o 60%)</option>
        <option value="Electrónico">Régimen Electrónico (mensual, 100%, requiere FEL)</option>
      </select></div>
    </div>`,
    d=>{
      const monto=r2(+d.monto);
      if(!monto||monto<=0){avisar('Escribí el monto a solicitar.');return false}
      if(monto>creditoActual){avisar(`No podés solicitar más del crédito fiscal acumulado (Q${Q(creditoActual)}).`);return false}
      if(!d.desde||!d.hasta){avisar('Elegí el período que cubre la solicitud.');return false}
      asegurarCuenta(e,'1.1.15','IVA por cobrar en devolución (SAT)','activo');
      const p={id:uid(),numero:e.correlativo++,fecha:hoy(),
        concepto:`Solicitud de devolución de crédito fiscal IVA — ${d.regimenSolicitud} — del ${fFecha(d.desde)} al ${fFecha(d.hasta)}`,
        docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',
        lineas:[{cta:'1.1.15',desc:'',debe:monto,haber:0},{cta:'1.1.09',desc:'',debe:0,haber:monto}]};
      e.partidas.push(p);
      e.devolucionesIVA=e.devolucionesIVA||[];
      e.devolucionesIVA.push({id:uid(),fecha:hoy(),desde:d.desde,hasta:d.hasta,monto,
        regimenSolicitud:d.regimenSolicitud,estado:'solicitada',partidaSolicitudId:p.id});
      registrarLog('Solicitó devolución de crédito fiscal IVA',`${e.nombre} — Q${Q(monto)} (${d.regimenSolicitud})`);
      guardar();
      avisar(`Solicitud registrada en la partida No. ${p.numero}. Recordá presentar el trámite real en la Agencia Virtual.`,'Listo');
    },'Registrar solicitud');
};

ACCIONES.registrarDevolucionRecibida=d0=>{
  const e=emp();
  const s=(e.devolucionesIVA||[]).find(x=>x.id===d0.id);
  if(!s){avisar('No se encontró esa solicitud.');return}
  const cajaBanco=cuentasCajaBanco(e);
  if(!cajaBanco.length){avisar('El catálogo no tiene ninguna cuenta de Caja o Bancos.');return}
  abrirModal('Registrar devolución recibida',
    `<p style="margin:0 0 14px;font-size:13px;color:var(--tinta-suave)">Solicitud del ${fFecha(s.fecha)} por
      Q${Q(s.monto)}. Si el Banco de Guatemala depositó un monto distinto —a veces ajustan la cantidad—,
      escribí lo que de verdad entró.</p>
    <div class="rej">
      <div class="campo"><label>Monto recibido</label><input name="montoRecibido" type="number" step="0.01" min="0" value="${s.monto}"></div>
      <div class="campo"><label>Fecha</label><input name="fechaRecibida" type="date" value="${hoy()}"></div>
      <div class="campo full"><label>Entra a</label><select name="cuenta">
        ${cajaBanco.map(c=>`<option value="${c.c}">${c.c} — ${esc(c.n)}</option>`).join('')}
      </select></div>
    </div>`,
    d=>{
      const montoRecibido=r2(+d.montoRecibido);
      if(!montoRecibido||montoRecibido<=0){avisar('Escribí el monto recibido.');return false}
      const lineas=[{cta:d.cuenta,desc:'',debe:montoRecibido,haber:0}];
      if(montoRecibido>=s.monto){
        lineas.push({cta:'1.1.15',desc:'',debe:0,haber:s.monto});
        if(montoRecibido>s.monto) lineas.push({cta:'1.1.09',desc:'',debe:0,haber:r2(montoRecibido-s.monto)});
      }else{
        lineas.push({cta:'1.1.15',desc:'',debe:0,haber:montoRecibido});
      }
      const p={id:uid(),numero:e.correlativo++,fecha:d.fechaRecibida,
        concepto:`Devolución de crédito fiscal IVA recibida — solicitud del ${fFecha(s.fecha)}`,
        docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',lineas};
      e.partidas.push(p);
      Object.assign(s,{estado:'recibida',fechaRecibida:d.fechaRecibida,montoRecibido,partidaRecibidaId:p.id});
      registrarLog('Registró devolución de IVA recibida',`${e.nombre} — Q${Q(montoRecibido)}`);
      guardar();
      avisar(`Devolución registrada en la partida No. ${p.numero}.`,'Listo');
    },'Registrar');
};

ACCIONES.pagarIVA=(d0={})=>{
  const e=emp();
  const cajaBanco=cuentasCajaBanco(e);
  if(!cajaBanco.length){avisar('El catálogo no tiene ninguna cuenta de Caja o Bancos.');return}
  const rangoAnt=mesAnteriorRango(), desdeDefault=d0.desde||rangoAnt.desde, hastaDefault=d0.hasta||rangoAnt.hasta;
  const ivaIni=ivaDelPeriodo(e,desdeDefault,hastaDefault);

  abrirModal('Pagar IVA',
    `<div class="rej">
      <div class="campo"><label>Desde</label><input name="desde" type="date" value="${desdeDefault}"></div>
      <div class="campo"><label>Hasta</label><input name="hasta" type="date" value="${hastaDefault}"></div>
      <div class="campo full"><label>Remanente de crédito fiscal de períodos anteriores</label>
        <input name="remanente" type="number" step="0.01" min="0" value="${ivaIni.remanente}">
        <span style="font-size:12.5px;color:var(--tinta-suave)">Se calcula solo con el saldo de Crédito Fiscal que quedó a favor (Art. 17, Ley del IVA). Ajustalo si tu declaración anterior dice otra cosa.</span></div>
      <div class="campo full"><label>Se paga desde</label><select name="cuenta">
        ${cajaBanco.map(c=>`<option value="${c.c}">${c.c} — ${esc(c.n)}</option>`).join('')}
      </select></div>
      <div class="campo full"><label>Fecha de pago</label><input name="fechaPago" type="date" value="${fechaPagoDefault(e)}"></div>
    </div>
    <p id="previewIVA" style="margin:10px 0 0;font-size:13px;color:var(--tinta-suave)"></p>`,
    d=>{
      if(!d.desde||!d.hasta||d.desde>d.hasta){avisar('Revisá el rango de fechas.');return false}
      if(!d.fechaPago){avisar('Escribí la fecha de pago.');return false}
      const ya=(e.partidas||[]).find(p=>p.liqIVA&&p.liqIVA.desde<=d.hasta&&p.liqIVA.hasta>=d.desde);
      if(ya){avisar(`Ese período ya tiene una liquidación de IVA (partida No. ${ya.numero}). Si hay que rehacerla, eliminá primero esa partida.`);return false}
      const iva=ivaDelPeriodo(e,d.desde,d.hasta);
      const remanente=d.remanente===''?iva.remanente:r2(Math.max(0,+d.remanente||0));
      const {debito,credito}=iva;
      const neto=r2(debito-credito-remanente);
      let aplicarRet=0;
      /* Mes sin débito fiscal (sin ventas, o solo con compras): la declaración igual se presenta, en cero o con el
         crédito como remanente. No lleva partida, pero queda registrada para que el mes no figure como pendiente. */
      if(!debito){
        if((e.ivaDeclarado||[]).some(x=>x.desde<=d.hasta&&x.hasta>=d.desde)){avisar('Ese período ya tiene la declaración registrada.');return false}
        (e.ivaDeclarado=e.ivaDeclarado||[]).push({id:uid(),desde:d.desde,hasta:d.hasta,fecha:d.fechaPago,credito,remanente});
        registrarLog('Registró una declaración de IVA sin pago',`${fFecha(d.desde)} al ${fFecha(d.hasta)} — crédito Q${Q(credito)}`);
        guardar(); pintar();
        avisar(credito||remanente?`Declaración registrada sin pago: no hubo débito fiscal; el crédito (Q${Q(r2(credito+remanente))}) queda como remanente para el mes siguiente.`:'Declaración en cero registrada: no hubo movimiento de IVA en ese período.','Listo');
        return;
      }
      const lineas=[];
      if(neto>0){
        /* Débito mayor: se cancelan el débito del período, el crédito del
           período y el remanente que venía de antes; la diferencia se paga. */
        if(debito) lineas.push({cta:'2.1.04',desc:'',debe:debito,haber:0});
        if(r2(credito+remanente)) lineas.push({cta:'1.1.09',desc:'',debe:0,haber:r2(credito+remanente)});
        /* Las retenciones de IVA sufridas pagan parte del impuesto; lo que sobre queda para el mes siguiente. */
        aplicarRet=r2(Math.min(iva.retencionesIVA,neto));
        if(aplicarRet>0) lineas.push({cta:'1.1.19',desc:'Retenciones de IVA aplicadas',debe:0,haber:aplicarRet});
        if(r2(neto-aplicarRet)>0) lineas.push({cta:d.cuenta,desc:'',debe:0,haber:r2(neto-aplicarRet)});
      }else if(debito){
        /* Crédito (más remanente) mayor o igual: el débito se cancela contra el
           crédito y lo que sobra queda como remanente para el período siguiente. */
        lineas.push({cta:'2.1.04',desc:'',debe:debito,haber:0});
        lineas.push({cta:'1.1.09',desc:'',debe:0,haber:debito});
      }
      if(!lineas.length){avisar('No hay débito fiscal que compensar en ese rango — el crédito se traslada solo como remanente, no hace falta ninguna partida.');return false}
      const p={id:uid(),numero:e.correlativo++,fecha:d.fechaPago,
        concepto: neto>0
          ? `Pago de IVA del ${fFecha(d.desde)} al ${fFecha(d.hasta)}`
          : `Compensación de IVA del ${fFecha(d.desde)} al ${fFecha(d.hasta)} — sin pago, queda remanente a favor de Q${Q(Math.abs(neto))}`,
        docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',lineas,
        liqIVA:{desde:d.desde,hasta:d.hasta,debito,credito,remanente,neto,retenciones:aplicarRet}};
      e.partidas.push(p);
      registrarLog(neto>0?'Pagó IVA':'Compensó IVA',`${e.nombre} — Q${Q(Math.abs(neto))} del ${fFecha(d.desde)} al ${fFecha(d.hasta)}${neto<=0?' (remanente a favor)':''}`);
      guardar();
      avisar(neto>0
        ? `IVA del período: Q${Q(neto)}${aplicarRet?`, de los que Q${Q(aplicarRet)} se cubren con retenciones`:''}. Pagado: Q${Q(r2(neto-aplicarRet))}. Partida No. ${p.numero}.`
        : `Débito compensado. Queda un remanente a favor de Q${Q(Math.abs(neto))} en Crédito Fiscal, que se aplica en el período siguiente. Partida No. ${p.numero}.`,'Listo');
    },'Ver y compensar');
  const actualizarPreview=(recalcularRemanente)=>{
    const desde=mForm.querySelector('[name="desde"]').value, hasta=mForm.querySelector('[name="hasta"]').value;
    if(!desde||!hasta) return;
    const iva=ivaDelPeriodo(e,desde,hasta);
    const inpRem=mForm.querySelector('[name="remanente"]');
    if(recalcularRemanente) inpRem.value=iva.remanente;
    const rem=r2(Math.max(0,+inpRem.value||0));
    const neto=r2(iva.debito-iva.credito-rem);
    const ret=neto>0?r2(Math.min(iva.retencionesIVA,neto)):0;
    document.getElementById('previewIVA').innerHTML=
      `Débito fiscal: Q${Q(iva.debito)} · Crédito fiscal: Q${Q(iva.credito)} · Remanente anterior: Q${Q(rem)} · ${neto>0?`Impuesto: Q${Q(neto)}${ret?` · (−) Retenciones de IVA: Q${Q(ret)}`:''} · <strong>A pagar: Q${Q(r2(neto-ret))}</strong>`:`Remanente que pasa al siguiente período: Q${Q(Math.abs(neto))}`}`
      +(iva.retencionesIVA>0.005&&ret<iva.retencionesIVA?`<br>Retenciones de IVA disponibles: Q${Q(iva.retencionesIVA)} — lo que no se use queda para el mes siguiente.`:'')
      +(iva.debitoAtrasado>0.005?`<br><span style="color:var(--alerta)">Hay Q${Q(iva.debitoAtrasado)} de débito fiscal de períodos anteriores que todavía no se liquidaron. Liquidá primero esos meses, en orden.</span>`:'');
  };
  mForm.querySelector('[name="desde"]').onchange=()=>actualizarPreview(true);
  mForm.querySelector('[name="hasta"]').onchange=()=>actualizarPreview(true);
  mForm.querySelector('[name="remanente"]').oninput=()=>actualizarPreview(false);
  actualizarPreview(false);
};

/* El mes de impuesto mensual que toca pagar: el anterior si es de un régimen mensual; si no (la empresa ya pasó a
   General), el último mes de régimen mensual que quedó sin pagar —p. ej. el 5% de junio, que vence en julio—. */
function mesImpuestoMensualPendiente(e){
  const ant=mesAnteriorRango();
  if(regimenEn(e,ant.hasta)!=='general') return ant;
  let [a,m]=ant.desde.split('-').map(Number);
  for(let i=0;i<12;i++){
    m--; if(m<1){m=12;a--;}
    const desde=`${a}-${String(m).padStart(2,'0')}-01`, hasta=finDeMes(a,m), r=regimenEn(e,hasta);
    if(r==='general') continue;
    if(!(e.partidas||[]).some(p=>p.liqISR&&p.liqISR.desde<=hasta&&p.liqISR.hasta>=desde)) return {desde,hasta};
    break;
  }
  return null;
}
ACCIONES.pagarISR=()=>{
  const e=emp();
  /* El régimen que manda es el del mes que se paga, no el de hoy: el 5% de junio se paga en julio aunque desde
     julio la empresa ya esté en régimen General. */
  const mesPago=mesImpuestoMensualPendiente(e)||mesAnteriorRango();
  const regimenPago=regimenEn(e,mesPago.hasta);
  if(regimenPago==='general'){
    avisar('El régimen General paga ISR trimestral, no mensual — usá "Cierre fiscal parcial" o "Cierre fiscal total" en el Tablero fiscal, no esta opción.');
    return;
  }
  const cajaBanco=cuentasCajaBanco(e);
  if(!cajaBanco.length){avisar('El catálogo no tiene ninguna cuenta de Caja o Bancos.');return}
  const {desde:desdeDefault,hasta:hastaDefault}=mesPago;
  const yaPagado=(desde,hasta)=>(e.partidas||[]).find(p=>p.liqISR&&p.liqISR.desde<=hasta&&p.liqISR.hasta>=desde);

  if(regimenPago==='simplificado'){
    /* El ISR se contabilizó como pasivo en cada venta. Al pagarlo se acreditan
       las retenciones que te hicieron tus clientes en ese mismo período
       (cuenta 1.1.10): esa parte ya la enteró el agente de retención. */
    const calc=(desde,hasta)=>{
      const mov=movimientosOperativos(e,desde,hasta);
      const acumulado=saldoNatural('2.1.05',mov);
      /* Retenciones disponibles: el saldo de la cuenta hasta el final del período —
         incluye las de meses anteriores que no alcanzaron a usarse. */
      const retenciones=r2(Math.max(0,saldoNatural('1.1.10',movimientos(null,hasta))));
      const aplicar=r2(Math.min(retenciones,Math.max(0,acumulado)));
      return {acumulado,retenciones,aplicar,efectivo:r2(acumulado-aplicar)};
    };
    abrirModal('Pagar ISR — Régimen Opcional Simplificado',
      `<div class="rej">
        <div class="campo"><label>Desde</label><input name="desde" type="date" value="${desdeDefault}"></div>
        <div class="campo"><label>Hasta</label><input name="hasta" type="date" value="${hastaDefault}"></div>
        <div class="campo full"><label>Se paga desde</label><select name="cuenta">
          ${cajaBanco.map(c=>`<option value="${c.c}">${c.c} — ${esc(c.n)}</option>`).join('')}
        </select></div>
        <div class="campo full"><label>Fecha de pago</label><input name="fechaPago" type="date" value="${fechaPagoDefault(e)}"></div>
      </div>
      <p id="previewISR" style="margin:10px 0 0;font-size:13px;color:var(--tinta-suave)"></p>`,
      d=>{
        if(!d.desde||!d.hasta||d.desde>d.hasta){avisar('Revisá el rango de fechas.');return false}
        const ya=yaPagado(d.desde,d.hasta);
        if(ya){avisar(`Ese período ya tiene un pago de ISR (partida No. ${ya.numero}).`);return false}
        const c=calc(d.desde,d.hasta);
        if(!c.acumulado||c.acumulado<=0){avisar('No hay ISR Simplificado acumulado por pagar en ese rango de fechas.');return false}
        const lineas=[{cta:'2.1.05',desc:'',debe:c.acumulado,haber:0}];
        if(c.aplicar>0) lineas.push({cta:'1.1.10',desc:'Retenciones de ISR sufridas',debe:0,haber:c.aplicar});
        if(c.efectivo>0) lineas.push({cta:d.cuenta,desc:'',debe:0,haber:c.efectivo});
        const p={id:uid(),numero:e.correlativo++,fecha:d.fechaPago,
          concepto:`Pago de ISR Simplificado del ${fFecha(d.desde)} al ${fFecha(d.hasta)}`,
          docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',lineas,liqISR:{desde:d.desde,hasta:d.hasta}};
        e.partidas.push(p);
        registrarLog('Pagó ISR Simplificado',`${e.nombre} — Q${Q(c.acumulado)} (retenciones Q${Q(c.aplicar)}) del ${fFecha(d.desde)} al ${fFecha(d.hasta)}`);
        guardar();
        avisar(`ISR del período: Q${Q(c.acumulado)}. Se acreditaron Q${Q(c.aplicar)} de retenciones y se pagan Q${Q(c.efectivo)}. Partida No. ${p.numero}.`,'Listo');
      },'Ver y pagar');
    const actualizarPreview=()=>{
      const desde=mForm.querySelector('[name="desde"]').value, hasta=mForm.querySelector('[name="hasta"]').value;
      if(!desde||!hasta) return;
      const c=calc(desde,hasta);
      document.getElementById('previewISR').innerHTML=`ISR del período: Q${Q(c.acumulado)} · (−) Retenciones sufridas: Q${Q(c.aplicar)} · <strong>A pagar: Q${Q(c.efectivo)}</strong>`;
    };
    mForm.querySelector('[name="desde"]').onchange=actualizarPreview;
    mForm.querySelector('[name="hasta"]').onchange=actualizarPreview;
    actualizarPreview();
    return;
  }

  /* Pequeño Contribuyente (IVA del 5%, formulario SAT-2046 — no es ISR) y los
     regímenes del Decreto 31-2024 (impuesto único del 1.5%) son impuestos
     definitivos mensuales: se reconoce el gasto y se paga en el mismo momento.
     La tasa se decide por el régimen vigente en el período elegido. En
     Pequeño Contribuyente se acreditan las retenciones del 5% que te hicieron
     los agentes de retención (cuenta 1.1.17). */
  const tasaPara=hasta=>{ const r=regimenEn(e,hasta); return r==='pequeno'?0.05:0.015; };
  const esPeq=hasta=>regimenEn(e,hasta)==='pequeno';
  const nombreImpuestoPara=hasta=>{ const r=regimenEn(e,hasta); return r==='pequeno'?'IVA — Régimen de Pequeño Contribuyente (5%, SAT-2046)':`impuesto único — ${REGIMENES[r]||r} (1.5%)`; };
  const calc=(desde,hasta)=>{
    const mov=movimientosOperativos(e,desde,hasta);
    const ingresos=totalTipo(['ingreso'],mov);
    const impuesto=r2(ingresos*tasaPara(hasta));
    const retenciones=esPeq(hasta)?r2(Math.max(0,saldoNatural('1.1.17',movimientos(null,hasta)))):0;
    const aplicar=r2(Math.min(retenciones,Math.max(0,impuesto)));
    return {ingresos,impuesto,aplicar,efectivo:r2(impuesto-aplicar)};
  };
  abrirModal(`Pagar ${esc(nombreImpuestoPara(hastaDefault))}`,
    `<div class="rej">
      <div class="campo"><label>Desde</label><input name="desde" type="date" value="${desdeDefault}"></div>
      <div class="campo"><label>Hasta</label><input name="hasta" type="date" value="${hastaDefault}"></div>
      <div class="campo full"><label>Se paga desde</label><select name="cuenta">
        ${cajaBanco.map(c=>`<option value="${c.c}">${c.c} — ${esc(c.n)}</option>`).join('')}
      </select></div>
      <div class="campo full"><label>Fecha de pago</label><input name="fechaPago" type="date" value="${fechaPagoDefault(e)}"></div>
    </div>
    <p id="previewISR" style="margin:10px 0 0;font-size:13px;color:var(--tinta-suave)"></p>`,
    d=>{
      if(!d.desde||!d.hasta||d.desde>d.hasta){avisar('Revisá el rango de fechas.');return false}
      const ya=yaPagado(d.desde,d.hasta);
      if(ya){avisar(`Ese período ya tiene un pago registrado (partida No. ${ya.numero}).`);return false}
      const c=calc(d.desde,d.hasta);
      if(!c.impuesto||c.impuesto<=0){avisar('No hay ingresos registrados en ese rango de fechas.');return false}
      if(regimenEn(e,d.hasta)==='general'||regimenEn(e,d.desde)!==regimenEn(e,d.hasta)){avisar('Ese rango toma meses de otro régimen. Elegí solo meses en los que la empresa estaba en este régimen.');return false}
      if(!d.fechaPago){avisar('Escribí la fecha de pago.');return false}
      asegurarCuenta(e,'6.2.22','Impuesto definitivo mensual','gasto');
      /* Devengo (NIIF para PYMES 2.36): el impuesto es gasto del mes al que corresponde, aunque se pague en el
         siguiente. Si se paga después del cierre del período, el gasto queda al último día del período contra un
         pasivo, y el pago lo cancela en su fecha. */
      let devengo=null;
      if(d.fechaPago>d.hasta){
        asegurarCuenta(e,'2.1.20','Impuesto definitivo mensual por pagar','pasivo');
        devengo={id:uid(),numero:e.correlativo++,fecha:d.hasta,
          concepto:`${esPeq(d.hasta)?'Impuesto del período — Régimen de Pequeño Contribuyente (5%)':`Impuesto único del período — ${REGIMENES[regimenEn(e,d.hasta)]||''} (1.5%)`} — del ${fFecha(d.desde)} al ${fFecha(d.hasta)}`,
          docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',lineas:[{cta:'6.2.22',desc:'',debe:c.impuesto,haber:0},{cta:'2.1.20',desc:'',debe:0,haber:c.impuesto}]};
        e.partidas.push(devengo);
      }
      const lineas=[{cta:devengo?'2.1.20':'6.2.22',desc:'',debe:c.impuesto,haber:0}];
      if(c.aplicar>0) lineas.push({cta:'1.1.17',desc:'Retenciones sufridas',debe:0,haber:c.aplicar});
      if(c.efectivo>0) lineas.push({cta:d.cuenta,desc:'',debe:0,haber:c.efectivo});
      const p={id:uid(),numero:e.correlativo++,fecha:d.fechaPago,devengoId:devengo?devengo.id:undefined,
        concepto:`${esPeq(d.hasta)?'Pago de IVA — Régimen de Pequeño Contribuyente (5%, SAT-2046)':`Pago del impuesto único — ${REGIMENES[regimenEn(e,d.hasta)]||''} (1.5%)`} — del ${fFecha(d.desde)} al ${fFecha(d.hasta)}`,
        docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',lineas,liqISR:{desde:d.desde,hasta:d.hasta}};
      e.partidas.push(p);
      registrarLog('Pagó impuesto del régimen',`${e.nombre} — ${nombreImpuestoPara(d.hasta)} — Q${Q(c.impuesto)}`);
      guardar();
      avisar(`Impuesto del período: Q${Q(c.impuesto)}${c.aplicar?` (retenciones acreditadas Q${Q(c.aplicar)})`:''}. Pagado en efectivo: Q${Q(c.efectivo)}. Partida No. ${p.numero}.`,'Listo');
    },'Ver y pagar');
  const actualizarPreview=()=>{
    const desde=mForm.querySelector('[name="desde"]').value, hasta=mForm.querySelector('[name="hasta"]').value;
    if(!desde||!hasta) return;
    const c=calc(desde,hasta);
    document.getElementById('previewISR').innerHTML=`${esc(nombreImpuestoPara(hasta))} · Ingresos del período: Q${Q(c.ingresos)} · Impuesto: Q${Q(c.impuesto)}${c.aplicar?` · (−) Retenciones: Q${Q(c.aplicar)}`:''} · <strong>A pagar: Q${Q(c.efectivo)}</strong>`;
  };
  mForm.querySelector('[name="desde"]').onchange=actualizarPreview;
  mForm.querySelector('[name="hasta"]').onchange=actualizarPreview;
  actualizarPreview();
};

/* Los trimestres del año, con ambos métodos ya calculados — la misma cuenta
   que ya se muestra en el Tablero fiscal, para no calcularla dos veces
   distinto. El costo de ventas se calcula sobre el TRIMESTRE COMPLETO de una
   sola vez (inventario inicial del trimestre + compras del trimestre −
   inventario final si existe), nunca sumando meses ya estimados por
   separado — sumar meses individuales cuenta el inventario que se va
   arrastrando de uno a otro más de una vez. */
function trimestresGeneral(e){
  const meses=mesesDelEjercicio();
  /* El ISR trimestral se acumula desde que la empresa está en régimen General: si pasó a General a mitad de año,
     los trimestres anteriores no llevan ISR sobre utilidades (ya pagaron su propio impuesto). */
  const desdeAno=inicioRegimenEn(e,`${e.ejercicio}-01-01`,`${e.ejercicio}-12-31`);
  return [1,2,3,4].map(t=>{
    const ms=meses.slice((t-1)*3,t*3);
    const hasta=ms[ms.length-1].hasta;
    if(hasta<desdeAno||regimenEn(e,hasta)!=='general') return {t,desde:ms[0].desde,hasta,noAplica:true,regimen:regimenEn(e,hasta),rentas:0,util:0,cierre:0,estimada:0,rentasOtrasAcum:0,costoVentas:0,gastosDeducibles:0,noDeducible:0,
      rentaBrutaAcum:0,costosGastosAcum:0,noDeduciblesAcum:0,rentaImponibleAcum:0,impuestoAcum:0,impuestoTrimAnterior:0,impuestoEsteTrimestre:0};
    const desde=ms[0].desde>desdeAno?ms[0].desde:desdeAno;
    /* Dos métodos, y la ley los trata distinto (Art. 38, Dto. 10-2012):
       "Renta imponible estimada" es el 8% de la renta bruta de ESE
       trimestre solo, aislado — por eso Rtrimestre alcanza para calcularla.
       "Cierre contable parcial" en cambio exige la renta imponible
       ACUMULADA desde el 1 de enero hasta el corte de este trimestre, con
       el 25% aplicado sobre esa acumulada, y acreditando lo que ya se pagó
       en los trimestres anteriores del mismo año — no es "este trimestre
       aislado". Antes esto trataba los dos métodos igual, aislados cada
       uno, lo cual está bien para la estimada pero mal para el cierre
       parcial: una empresa con una ganancia grande en un trimestre y una
       pérdida en otro terminaba pagando de más, en vez de que la pérdida
       se compensara contra la ganancia acumulada, como exige la ley. */
    const Rtrimestre=calcularResultados(e,desde,hasta);
    const Racum=calcularResultados(e,desdeAno,hasta);
    /* calcularResultados() siempre saca 6.2.22 (el ISR ya posteado en cierres
       parciales) de "gastos" en régimen General, porque el ISR nunca es un
       gasto deducible para calcular más ISR. Por eso Racum.antesISR ya es la
       utilidad ANTES de todo ISR: no hay nada que sumar de vuelta. (Antes
       había una compensación aparte para esto; después de que el ISR se
       empezó a excluir siempre, esa compensación contaba el impuesto dos
       veces — la renta imponible del formulario salía más alta que la del
       Estado de Resultados por exactamente el ISR ya pagado.) */
    const baseImponibleAcum=Racum.baseImponibleISR;
    const impuestoAcum=r2(Math.max(0,baseImponibleAcum)*0.25);
    /* Con la opción b) del ISO, parte de lo que se pagó de ISR en un trimestre
       se usó para pagar el ISO de ese trimestre: ya no cuenta como ISR pagado,
       así que el ISR del trimestre siguiente tiene que volver a cubrirlo. */
    const pagadoTrimAnteriores=r2(Math.max(0,(e.cierresParciales||[]).filter(c=>c.ejercicio===e.ejercicio&&c.trimestre<t).reduce((s,c)=>s+c.monto,0)-isrConsumidoPorISO(e,e.ejercicio,t)));
    const cierre=r2(Math.max(0,impuestoAcum-pagadoTrimAnteriores));
    return {t,desde,hasta,rentas:Rtrimestre.ingresos,util:Rtrimestre.antesISR,cierre,estimada:r2(Math.max(0,Rtrimestre.ingresos-Rtrimestre.rentasOtrasCategorias)*0.08*0.25),rentasOtrasAcum:Racum.rentasOtrasCategorias,
      costoVentas:Rtrimestre.costoVentas,gastosDeducibles:r2(Rtrimestre.otrosCostos+Rtrimestre.gastos-Rtrimestre.noDeducible-Rtrimestre.ivaNoDeducible),noDeducible:r2(Rtrimestre.noDeducible+Rtrimestre.ivaNoDeducible),
      /* Estos son los que de verdad va a pedir el formulario de la SAT —
         todos acumulados desde el 1 de enero, no solo de este trimestre. */
      rentaBrutaAcum:Racum.ingresos,
      /* El formulario de la SAT pide el total COMPLETO de costos y gastos
         acá —incluyendo los no deducibles—, y recién en el renglón de abajo
         los vuelve a sumar aparte para llegar a la renta imponible. Restar
         los no deducibles acá Y sumarlos de nuevo abajo los contaba dos
         veces sobre el total mostrado, aunque el cálculo interno de la
         renta imponible seguía dando el número correcto — la inconsistencia
         estaba entre lo que se veía renglón por renglón y lo que daba el
         total, no en el resultado final. El ISR ya posteado tampoco entra
         acá: calcularResultados() ya lo dejó fuera de "gastos". */
      costosGastosAcum:r2(Racum.costoTotal+Racum.gastos),
      noDeduciblesAcum:r2(Racum.noDeducible+Racum.ivaNoDeducible+Racum.excesoNoDeducible+Racum.gastosRentasCapital),
      rentaImponibleAcum:baseImponibleAcum,impuestoAcum,impuestoTrimAnterior:pagadoTrimAnteriores,impuestoEsteTrimestre:cierre};
  });
}
/* El desglose cuenta por cuenta de lo que entra en "Costos y gastos
   acumulados" — la tabla del formulario de la SAT solo da el total, esto
   es para revisar de dónde sale antes de confirmar el cierre. El costo de
   ventas va aparte, como una sola línea calculada, porque no es el saldo
   de una cuenta simple sino el resultado de inventario inicial + compras −
   inventario final; el resto son cuentas de gasto tal cual están en el
   catálogo. */
function itemizadoCostosGastos(e,desdeAno,hasta){
  const mov=movimientos(desdeAno,hasta);
  const R=calcularResultados(e,desdeAno,hasta);
  const filas=[];
  if(R.costoVentas) filas.push({cuenta:'',nombre:'Costo de ventas (inventario inicial + compras − inventario final)',monto:R.costoVentas,deducible:true});
  e.cuentas.filter(c=>c.d&&c.t==='gasto'&&c.c!=='6.2.22').forEach(c=>{
    const v=saldoNatural(c.c,mov);
    if(!v) return;
    filas.push({cuenta:c.c,nombre:c.n,monto:v,deducible:c.c!=='6.2.14'&&c.c!=='6.2.27'&&c.c!=='6.2.28'});
  });
  return filas;
}

/* Las tres piezas de abajo son las que antes vivían mezcladas, todas juntas,
   adentro de ACCIONES.cierreFiscalParcial — un solo bloque de 170 líneas que
   armaba el modal, calculaba la vista previa, Y posteaba la partida real,
   todo a la vez. Separarlas en piezas con un solo trabajo cada una no
   cambia ni un número de cómo se calcula nada; es más fácil de leer y de
   tocar la próxima vez que haga falta un ajuste acá. */
function filaSAT(x){
  return `<tbody>
    <tr><td>Renta bruta acumulada</td><td class="num">${Q(x.rentaBrutaAcum)}</td></tr>
    <tr><td>(−) Costos y gastos acumulados localmente</td><td class="num">${Q(x.costosGastosAcum)}</td></tr>
    <tr><td>(+) Costos y gastos no deducibles</td><td class="num">${Q(x.noDeduciblesAcum)}</td></tr>
    ${x.rentasOtrasAcum?`<tr><td>(−) Rentas exentas y de otras categorías (rentas de capital)</td><td class="num">${Q(x.rentasOtrasAcum)}</td></tr>`:''}
    <tr class="total"><td>${x.rentaImponibleAcum<0?'Pérdida fiscal acumulada':'Renta imponible acumulada'}</td><td class="num">${Q(x.rentaImponibleAcum)}</td></tr>
    <tr><td>Impuesto Sobre la Renta</td><td class="num">${Q(x.impuestoAcum)}</td></tr>
    <tr><td>(−) ISR acumulado del trimestre inmediato anterior</td><td class="num">${Q(x.impuestoTrimAnterior)}</td></tr>
    <tr class="total"><td>Impuesto determinado en este trimestre</td><td class="num">${Q(x.impuestoEsteTrimestre)}</td></tr>
    </tbody>`;
}
function filaItemizado(itemizado){
  return `<thead><tr><th>Cuenta</th><th class="num">Monto</th><th>¿Deducible?</th></tr></thead><tbody>
    ${itemizado.map(f=>`<tr><td${f.deducible?'':' style="color:var(--haber)"'}>${f.cuenta?f.cuenta+' — ':''}${esc(f.nombre)}</td>
      <td class="num"${f.deducible?'':' style="color:var(--haber)"'}>${Q(f.monto)}</td>
      <td${f.deducible?'':' style="color:var(--haber)"'}>${f.deducible?'Sí':'No'}</td></tr>`).join('')}
    </tbody>`;
}
/* La partida real del cierre parcial: valida, arma el costo de ventas y el
   ISR (con su cuenta puente si el pago cae en otra fecha), los postea, y
   deja registro en e.cierresParciales. Devuelve false si algo no pasa la
   validación —abrirModal() lo interpreta como "no cerrar el modal todavía"—. */
function postearCierreFiscalParcial(e,t,x,d){
  if(t===4){avisar('El cuarto trimestre se liquida con el Cierre fiscal total, no aparte.');return false}
  const yaPagados=(e.cierresParciales||[]).filter(c=>c.ejercicio===e.ejercicio).map(c=>c.trimestre);
  if(yaPagados.includes(t)){avisar('Ese trimestre ya tiene un cierre parcial registrado este ejercicio.');return false}
  if(d.invFinal===''){avisar('Escribí el inventario final del conteo físico a esa fecha de corte, aunque sea igual al del trimestre anterior.');return false}
  /* Art. 38, Dto. 10-2012: la opción de pago trimestral (cierre parcial o
     renta estimada) no puede variarse durante el año sin autorización de la SAT. */
  const usado=(e.cierresParciales||[]).find(c=>c.ejercicio===e.ejercicio);
  if(usado&&usado.metodo!==d.metodo){avisar(`En ${e.ejercicio} los pagos trimestrales ya se hicieron por ${usado.metodo==='cierre'?'cierre contable parcial':'renta imponible estimada'}. La ley no permite cambiar de opción durante el año sin autorización de la SAT.`);return false}
  const invFinal=r2(+d.invFinal);
  if(isNaN(invFinal)||invFinal<0){avisar('Escribí un inventario final válido.');return false}
  /* Validar ANTES de tocar nada: si el inventario final es mayor que el saldo, no se guarda. */
  if(r2(saldoNatural('1.1.08',movimientos(null,x.hasta))-invFinal)<0){
    avisar('El inventario final que escribiste es mayor que el saldo actual de Inventarios — revisá el monto, no puede quedar más de lo que hay.');
    return false;
  }
  e.inventarioFinal=e.inventarioFinal||{};
  const invAntes=Object.prototype.hasOwnProperty.call(e.inventarioFinal,x.hasta)?e.inventarioFinal[x.hasta]:undefined;
  e.inventarioFinal[x.hasta]=invFinal;
  /* Recalcular el trimestre YA con el inventario final que se acaba de
     guardar, para que el ISR se pague sobre el costo de ventas real de
     ese corte, no sobre la estimación de "todo lo comprado se vendió". */
  const trimActualizado=trimestresGeneral(e).find(y=>y.t===t);
  const monto = d.metodo==='cierre' ? trimActualizado.cierre : trimActualizado.estimada;
  /* El cierre de inventario tiene que quedar fechado EXACTO al corte del
     trimestre (x.hasta) — no a la fecha en que de verdad se paga el ISR,
     que puede ser semanas después. Si las dos cosas comparten la misma
     fecha, el inventario queda "cerrado" en un día que no es su corte
     real, y cualquier reporte que se consulte justo en el corte del
     trimestre (que es lo que la SAT pediría) no lo va a reconocer como
     cerrado — por eso van en dos partidas separadas, cada una con su
     propia fecha correcta. */
  const partidasNuevas=[];
  const saldoInvActual=saldoNatural('1.1.08',movimientos(null,x.hasta));
  const costoACerrar=r2(saldoInvActual-invFinal);
  if(costoACerrar>0){
    asegurarCuenta(e,'5.1.01','Costo de ventas','costo');
    partidasNuevas.push({id:uid(),numero:e.correlativo++,fecha:x.hasta,
      concepto:`Cierre de costo de ventas al ${fFecha(x.hasta)} — trimestre ${t} de ${e.ejercicio}, inventario final Q${Q(invFinal)}`,
      docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',
      lineas:[{cta:'5.1.01',desc:'',debe:costoACerrar,haber:0},{cta:'1.1.08',desc:'',debe:0,haber:costoACerrar}]});
  }else if(costoACerrar<0){
    avisar('El inventario final que escribiste es mayor que el saldo actual de Inventarios — revisá el monto, no puede quedar más de lo que hay.');
    return false;
  }
  let credISO=0;
  if(monto>0){
    /* El ISR del cierre parcial se reconoce como gasto real del período
       en Estado de Resultados desde la fecha de CORTE del trimestre —
       no desde la fecha en que de verdad se paga, que casi siempre es
       unos días o semanas después—. Por eso son dos partidas, no una:
       el reconocimiento del gasto queda fechado exacto al corte
       (x.hasta), y el pago en efectivo queda fechado el día real que se
       paga (d.fechaPago), con la cuenta de "ISR por pagar" (2.1.05) de
       puente entre las dos — la misma que ya usa el régimen Simplificado
       para su propio ISR mensual acumulado. */
    asegurarCuenta(e,'6.2.22','ISR sobre Utilidades del ejercicio','gasto');
    asegurarCuenta(e,'2.1.05','ISR por pagar','pasivo');
    /* Opción a) del ISO: el crédito disponible paga parte del ISR, empezando por el más viejo. */
    credISO=r2(Math.min(totalCreditoISOUsable(e,e.ejercicio),monto));
    partidasNuevas.push({id:uid(),numero:e.correlativo++,fecha:x.hasta,
      concepto:`Cierre fiscal parcial — trimestre ${t} de ${e.ejercicio} (${d.metodo==='cierre'?'cierre contable parcial':'renta imponible estimada'})`,
      docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',
      lineas:[{cta:'6.2.22',desc:'',debe:monto,haber:0},{cta:'2.1.05',desc:'',debe:0,haber:monto}]});
    if(d.fechaPago!==x.hasta){
      partidasNuevas.push({id:uid(),numero:e.correlativo++,fecha:d.fechaPago,
        concepto:`Pago de ISR del cierre fiscal parcial — trimestre ${t} de ${e.ejercicio}`,
        docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',
        lineas:lineasPagoISR('2.1.05',monto,credISO,d.cuenta)});
    }else{
      /* Si por casualidad la fecha de pago es la misma que el corte, no
         hace falta la partida puente — se paga directo desde la cuenta
         bancaria en la misma partida que reconoce el gasto. */
      partidasNuevas[partidasNuevas.length-1].lineas=lineasPagoISR('6.2.22',monto,credISO,d.cuenta);
    }
  }
  /* Sin costo que cerrar ni ISR (pérdida, o el inventario ya estaba al día): la
     declaración igual se presenta en cero, así que el trimestre queda registrado. */
  if(!partidasNuevas.length){
    e.cierresParciales=e.cierresParciales||[];
    e.cierresParciales.push({trimestre:t,ejercicio:e.ejercicio,metodo:d.metodo,monto:0,partidaId:null});
    registrarLog('Hizo el cierre fiscal parcial',`${e.nombre} — trimestre ${t}/${e.ejercicio} — ISR Q0.00 (sin partidas)`);
    guardar();
    avisar(`Trimestre ${t} registrado con ISR de Q0.00 — no hubo costo de ventas por cerrar ni impuesto por pagar. La declaración trimestral igual se presenta, en cero.`,'Listo');
    return;
  }
  partidasNuevas.forEach(p=>e.partidas.push(p));
  const pIsr=partidasNuevas.find(p=>p.concepto.startsWith('Cierre fiscal parcial'));
  e.cierresParciales=e.cierresParciales||[];
  /* Se registra siempre —aunque el ISR del trimestre sea cero por pérdida—, para que
     el trimestre quede cerrado y el método del año quede fijado. */
  e.cierresParciales.push({trimestre:t,ejercicio:e.ejercicio,metodo:d.metodo,monto,partidaId:(pIsr||partidasNuevas[0]).id,
    partidasIds:partidasNuevas.map(p=>p.id),hasta:x.hasta});
  if(credISO>0){
    const pCred=partidasNuevas.find(p=>p.lineas.some(l=>l.cta==='1.1.16'));
    aplicarCreditosISO(e,credISO,d.fechaPago,`ISR del trimestre ${t} de ${e.ejercicio}`,pCred?pCred.id:'');
  }
  registrarLog('Hizo el cierre fiscal parcial',`${e.nombre} — trimestre ${t}/${e.ejercicio} — ISR Q${Q(monto)}${costoACerrar>0?` · costo de ventas Q${Q(costoACerrar)}`:''}`);
  guardar();
  avisar(`Cierre parcial del trimestre ${t} registrado${partidasNuevas.length>1?` en las partidas No. ${partidasNuevas.map(p=>p.numero).join(' y ')}`:` en la partida No. ${partidasNuevas[0].numero}`}.`,'Listo');
}

ACCIONES.cierreFiscalParcial=(d0={})=>{
  const e=emp();
  if(e.regimen!=='general'){avisar('El cierre fiscal parcial es solo para el régimen General.');return}
  const cajaBanco=cuentasCajaBanco(e);
  if(!cajaBanco.length){avisar('El catálogo no tiene ninguna cuenta de Caja o Bancos.');return}
  e.cierresParciales=e.cierresParciales||[];
  e.inventarioFinal=e.inventarioFinal||{};
  let trim=trimestresGeneral(e);
  const yaPagados=e.cierresParciales.filter(c=>c.ejercicio===e.ejercicio).map(c=>c.trimestre);
  const metodoFijo=(e.cierresParciales.find(c=>c.ejercicio===e.ejercicio)||{}).metodo||'';
  const opsTrim=trim.map(x=>`<option value="${x.t}"${yaPagados.includes(x.t)||x.noAplica?' disabled':(+d0.trimestre===x.t?' selected':'')}>
    ${['Ene–Mar','Abr–Jun','Jul–Sep','Oct–Dic'][x.t-1]}${yaPagados.includes(x.t)?' (ya pagado)':''}</option>`).join('');

  abrirModal('Cierre fiscal parcial (trimestral)',
    `<p style="margin:0 0 14px;font-size:13px;color:var(--tinta-suave)">Pago a cuenta del ISR anual, régimen General.
      El cuarto trimestre no se paga aparte — se liquida junto con el Cierre fiscal total. Este cierre también
      deja el costo de ventas del trimestre al día, con el inventario físico de ese corte — así el Balance
      General queda cuadrado en cada trimestre, no solo al final del año, por si la SAT pide estados financieros
      a mitad de camino.</p>
    <div class="rej">
      <div class="campo full"><label>Trimestre</label><select name="trimestre">${opsTrim}</select></div>
      <div class="campo full"><label>Método para el ISR</label><select name="metodo">
        <option value="cierre"${metodoFijo==='estimada'?' disabled':metodoFijo==='cierre'?' selected':''}>Cierre contable parcial (25% de la renta imponible acumulada)</option>
        <option value="estimada"${metodoFijo==='cierre'?' disabled':metodoFijo==='estimada'?' selected':''}>Renta imponible estimada (8% de la renta bruta × 25%)</option>
      </select>${metodoFijo?`<span style="font-size:12.5px;color:var(--tinta-suave)">Fijado para ${e.ejercicio}: la opción no se cambia durante el año (Art. 38, Dto. 10-2012).</span>`:''}</div>
      <div class="campo full"><label id="lblInvFinal">Inventario final al corte del trimestre</label>
        <input name="invFinal" type="number" step="0.01" min="0" placeholder="Del conteo físico" value="${d0.inv!==undefined&&d0.inv!==''?esc(String(d0.inv)):''}"></div>
      <div class="campo"><label>Se paga desde</label><select name="cuenta">
        ${cajaBanco.map(c=>`<option value="${c.c}">${c.c} — ${esc(c.n)}</option>`).join('')}
      </select></div>
      <div class="campo"><label>Fecha de pago</label><input name="fechaPago" type="date" value="${fechaPagoDefault(e)}"></div>
    </div>
    <p id="previewCierre" style="margin:10px 0 0;font-size:13px;color:var(--tinta-suave)"></p>
    <h3 style="color:var(--verde);margin:18px 0 6px;font-size:15px">Para el formulario de la SAT (Declaraguate)</h3>
    <p style="margin:0 0 8px;font-size:12.5px;color:var(--tinta-suave)">Solo aplica al método de cierre contable
      parcial — son los mismos renglones del formulario, ya acumulados desde el 1 de enero.</p>
    <table id="tablaSAT" style="font-size:13px"></table>
    <h3 style="color:var(--verde);margin:18px 0 6px;font-size:15px">Desglose, cuenta por cuenta</h3>
    <p style="margin:0 0 8px;font-size:12.5px;color:var(--tinta-suave)">De dónde sale el total de arriba — revisá
      esto antes de confirmar, por si algo quedó mal clasificado.</p>
    <table id="tablaItemizado" style="font-size:13px"></table>
    <button type="button" class="btn sec" id="btnDescargarItemizado" style="margin-top:10px">Descargar este listado</button>`,
    d=>{
      const t=+d.trimestre;
      const x=trim.find(y=>y.t===t);
      return postearCierreFiscalParcial(e,t,x,d);
    },'Registrar cierre');
  const actualizarPreview=()=>{
    const t=+mForm.querySelector('[name="trimestre"]').value, metodo=mForm.querySelector('[name="metodo"]').value;
    const invInput=mForm.querySelector('[name="invFinal"]');
    let x=trim.find(y=>y.t===t); if(!x) return;
    document.getElementById('lblInvFinal').textContent=`Inventario final al ${fFecha(x.hasta)}`;
    if(invInput.value==='' && e.inventarioFinal[x.hasta]!==undefined) invInput.value=e.inventarioFinal[x.hasta];
    /* Si lo que está escrito en el campo es distinto de lo que ya está
       guardado (o todavía no hay nada guardado para ese corte), se
       recalcula EN VIVO con ese número tentativo — se guarda un momento en
       e.inventarioFinal para que trimestresGeneral() lo use, y se revierte
       enseguida a como estaba, porque esto es solo la vista previa: lo que
       de verdad se guarda pasa al confirmar el modal, no acá. Sin esto, la
       tabla se quedaba mostrando la estimación vieja aunque el campo ya
       tuviera otro número escrito. */
    if(invInput.value!==''){
      const tentativo=r2(+invInput.value);
      const guardadoAntes=e.inventarioFinal[x.hasta];
      if(tentativo!==guardadoAntes && !isNaN(tentativo)){
        e.inventarioFinal[x.hasta]=tentativo;
        x=trimestresGeneral(e).find(y=>y.t===t);
        if(guardadoAntes===undefined) delete e.inventarioFinal[x.hasta];
        else e.inventarioFinal[x.hasta]=guardadoAntes;
      }
    }
    document.getElementById('previewCierre').innerHTML=
      `Utilidad del trimestre: Q${Q(x.util)} · Renta bruta: Q${Q(x.rentas)} · <strong>ISR a pagar: Q${Q(metodo==='cierre'?x.cierre:x.estimada)}</strong>${(()=>{const m=metodo==='cierre'?x.cierre:x.estimada, c=r2(Math.min(totalCreditoISOUsable(e,e.ejercicio),m)); return c>0?` · Se cubre con crédito de ISO: Q${Q(c)} (en efectivo Q${Q(r2(m-c))})`:''})()}`;
    /* Los mismos renglones que trae el formulario de Declaraguate para el
       cierre contable parcial, con los números ya calculados — para copiar
       directo, sin tener que rearmar la cuenta a mano. */
    document.getElementById('tablaSAT').innerHTML=filaSAT(x);
    const desdeAno=`${e.ejercicio}-01-01`;
    document.getElementById('tablaItemizado').innerHTML=filaItemizado(itemizadoCostosGastos(e,desdeAno,x.hasta));
    document.getElementById('btnDescargarItemizado').onclick=()=>
      ACCIONES.pdfCostosGastosPeriodo({desde:desdeAno,hasta:x.hasta,trimestre:t});
  };
  mForm.querySelector('[name="trimestre"]').onchange=actualizarPreview;
  mForm.querySelector('[name="metodo"]').onchange=actualizarPreview;
  mForm.querySelector('[name="invFinal"]').oninput=actualizarPreview;
  actualizarPreview();
};

/* Sección 5 del SAT-1411 ("Información Financiera") pide un Balance General
   condensado, en sus propias casillas — no es el mismo cálculo de renta
   imponible que el trimestral (SAT-1361), es aparte. Mapea cada casilla del
   formulario real a las cuentas del catálogo; "Otros activos" y "Otros
   pasivos" son bolsas que atrapan cualquier cuenta que no encaje en una
   casilla específica, para no perder nada aunque el catálogo de la empresa
   tenga cuentas fuera de las que ya conocemos. */
function informacionFinancieraSAT(e,hasta){
  const mov=movimientos(null,hasta);
  const s=cta=>saldoNatural(cta,mov);
  const usadasActivo=new Set(['1.1.01','1.1.02','1.1.03','1.1.04','1.1.06','1.1.05','1.1.07','1.1.10','1.1.11','1.1.12','1.1.13','1.1.09',
    '1.1.08','1.1.14','1.1.15','1.1.16','1.2.01','1.2.02','1.2.04','1.2.06','1.2.08','1.2.03','1.2.05','1.2.07','1.2.09',
    '1.2.10','1.2.11','1.2.12','1.2.13','1.2.14','1.2.15','1.2.16','1.2.17','1.2.18','1.2.19']);
  const usadasPasivo=new Set(['2.1.01','2.1.02','2.1.03','2.1.17','2.2.01','2.1.14','2.2.02','3.1.02','3.1.03','3.1.04','3.1.01','3.1.05','3.1.06','3.1.07']);
  const otrosActivos=r2(e.cuentas.filter(c=>c.d&&c.t==='activo'&&!usadasActivo.has(c.c)).reduce((sum,c)=>sum+s(c.c),0));
  const otrosPasivos=r2(e.cuentas.filter(c=>c.d&&c.t==='pasivo'&&!usadasPasivo.has(c.c)).reduce((sum,c)=>sum+s(c.c),0));
  const utilPeriodo=utilidadPatrimonioSinDuplicar(e,hasta);
  const utilAcumRaw=s('3.1.03'), perdAcumRaw=s('3.1.04');
  const capital=r2(s('3.1.01')+s('3.1.05')+s('3.1.06')+s('3.1.07'));

  const activo=[
    ['Efectivo (caja y bancos)', r2(s('1.1.01')+s('1.1.02')+s('1.1.03'))],
    ['Cuentas y documentos por cobrar del giro normal', r2(s('1.1.04')+s('1.1.06'))],
    ['(−) Reserva para cuentas incobrables', s('1.1.05')],   // saldo acreedor: ya es negativo dentro del activo
    ['Otras cuentas y documentos por cobrar', r2(s('1.1.07')+s('1.1.10')+s('1.1.11')+s('1.1.12')+s('1.1.13')+s('1.1.09')+s('1.1.16'))],
    ['Inventario final', r2(s('1.1.08')+s('1.1.14'))],
    ['Créditos líquidos y exigibles pendientes de reintegro', s('1.1.15')],
    ['Inmuebles', r2(s('1.2.01')+s('1.2.02'))],
    ['Mobiliario y equipo', s('1.2.04')],
    ['Maquinaria', s('1.2.10')],
    ['Vehículos', s('1.2.06')],
    ['Equipo de cómputo', s('1.2.08')],
    ['Otros activos depreciables', r2(s('1.2.12')+s('1.2.14')+s('1.2.16')+s('1.2.18'))],
    ['Activos amortizables', 0],
    ['Inversiones', 0],
    ['(−) Depreciaciones acumuladas', r2(s('1.2.03')+s('1.2.05')+s('1.2.07')+s('1.2.09')+s('1.2.11')+s('1.2.13')+s('1.2.15')+s('1.2.17')+s('1.2.19'))],
    ['(−) Amortizaciones acumuladas', 0],
    ['Otros activos', otrosActivos],
  ];
  const pasivo=[
    ['Cuentas y documentos por pagar', r2(s('2.1.01')+s('2.1.02')+s('2.1.03'))],
    ['Préstamos bancarios o financieros', r2(s('2.1.17')+s('2.2.01'))],
    ['Otros pasivos', otrosPasivos],
    ['Reserva para indemnizaciones', r2(s('2.1.14')+s('2.2.02'))],
    ['Reserva legal acumulada', s('3.1.02')],
    ['Otras reservas acumuladas', 0],
    /* 3.1.04 es de naturaleza acreedora: una pérdida registrada ahí da saldo
       negativo. Se netea con 3.1.03 para no perderla. */
    ['Utilidad acumulada', r2(Math.max(0,utilAcumRaw+perdAcumRaw))],
    ['(−) Pérdida acumulada', -r2(Math.max(0,-(utilAcumRaw+perdAcumRaw)))],
    ['Utilidad del período', r2(Math.max(0,utilPeriodo))],
    ['(−) Pérdida del período', -r2(Math.max(0,-utilPeriodo))],
    ['Superávit por revaluación acumulado', 0],
    ['Capital', capital],
  ];
  const totalActivo=r2(activo.reduce((sum,[,v])=>sum+v,0));
  const totalPasivoPatrimonio=r2(pasivo.reduce((sum,[,v])=>sum+v,0));
  return {activo,pasivo,totalActivo,totalPasivoPatrimonio};
}

/* Mismo criterio que con el cierre parcial: separar "postear el ISR" y
   "postear el IVA" del resto de la función —que arma el modal y sus tres
   tablas— deja cada pieza con un solo trabajo. */
function postearISRAnual(e,cierre,hastaAno,d){
  const {diferencia,ajusteGasto,creditoISO}=cierre;
  /* Caso normal: el gasto que falta reconocer y lo que falta pagar son lo mismo. */
  if(Math.abs(ajusteGasto-diferencia)<0.005){
    if(diferencia===0) return;
    asegurarCuenta(e,'6.2.22','ISR sobre Utilidades del ejercicio','gasto');
    if(diferencia>0){
      /* Mismo criterio que en el cierre parcial: el gasto se reconoce a
         la fecha de corte del ejercicio (31/12), y el pago real —que
         normalmente es varias semanas después, hasta el 31 de marzo del
         año siguiente— queda en su propia partida, fechada el día que
         de verdad se paga, con "ISR por pagar" de puente. Si hay crédito
         de ISO (opción a), paga parte del ISR en lugar del efectivo. */
      asegurarCuenta(e,'2.1.05','ISR por pagar','pasivo');
      const cred=creditoISO||0;
      e.partidas.push({id:uid(),numero:e.correlativo++,fecha:hastaAno,
        concepto:`Cierre fiscal total ${e.ejercicio} — liquidación final de ISR sobre Utilidades`,
        docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',
        lineas:[{cta:'6.2.22',desc:'',debe:diferencia,haber:0},{cta:'2.1.05',desc:'',debe:0,haber:diferencia}]});
      if(d.fechaPago!==hastaAno){
        e.partidas.push({id:uid(),numero:e.correlativo++,fecha:d.fechaPago,
          concepto:`Pago de ISR de la liquidación final ${e.ejercicio}`,
          docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',
          lineas:lineasPagoISR('2.1.05',diferencia,cred,d.cuenta)});
      }else{
        e.partidas[e.partidas.length-1].lineas=lineasPagoISR('6.2.22',diferencia,cred,d.cuenta);
      }
      if(cred>0) aplicarCreditosISO(e,cred,d.fechaPago||hastaAno,`ISR anual ${e.ejercicio}`,e.partidas[e.partidas.length-1].id);
    }else{
      /* El exceso no se acredita a pagos futuros — se reclama aparte con el
         SAT-2350. Mientras se resuelve (puede tardar años), queda como una
         cuenta por cobrar a la SAT, y se reduce el gasto de ISR ya
         reconocido en los cierres parciales a lo que en realidad
         correspondía por el año completo. */
      asegurarCuenta(e,'1.1.13','ISR pagado en exceso, por recuperar (SAT-2350)','activo');
      const exceso=r2(-diferencia);
      e.partidas.push({id:uid(),numero:e.correlativo++,fecha:hastaAno,
        concepto:`Cierre fiscal total ${e.ejercicio} — ISR pagado en exceso, por reclamar a la SAT`,
        docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',
        lineas:[{cta:'1.1.13',desc:'',debe:exceso,haber:0},{cta:'6.2.22',desc:'',debe:0,haber:exceso}]});
    }
    return;
  }
  /* Opción b) del ISO: parte del ISR pagado en los trimestres se usó para pagar ISO, así que lo
     reconocido como gasto y lo pagado dejaron de coincidir. Primero se ajusta el gasto al impuesto
     del ejercicio; después se salda lo que quedó en "ISR por pagar" —que ya incluye lo que se
     reabrió al acreditar al ISO—, en efectivo o, si se pagó de más, como cuenta por cobrar a la SAT. */
  asegurarCuenta(e,'6.2.22','ISR sobre Utilidades del ejercicio','gasto');
  asegurarCuenta(e,'2.1.05','ISR por pagar','pasivo');
  if(Math.abs(ajusteGasto)>0.004){
    e.partidas.push({id:uid(),numero:e.correlativo++,fecha:hastaAno,
      concepto:`Cierre fiscal total ${e.ejercicio} — ajuste del gasto de ISR al impuesto del ejercicio`,
      docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',
      lineas:ajusteGasto>0
        ?[{cta:'6.2.22',desc:'',debe:ajusteGasto,haber:0},{cta:'2.1.05',desc:'',debe:0,haber:ajusteGasto}]
        :[{cta:'2.1.05',desc:'',debe:-ajusteGasto,haber:0},{cta:'6.2.22',desc:'',debe:0,haber:-ajusteGasto}]});
  }
  if(diferencia>0.004){
    e.partidas.push({id:uid(),numero:e.correlativo++,fecha:d.fechaPago||hastaAno,
      concepto:`Pago de ISR de la liquidación final ${e.ejercicio}`,
      docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',
      lineas:[{cta:'2.1.05',desc:'',debe:diferencia,haber:0},{cta:d.cuenta,desc:'',debe:0,haber:diferencia}]});
  }else if(diferencia<-0.004){
    asegurarCuenta(e,'1.1.13','ISR pagado en exceso, por recuperar (SAT-2350)','activo');
    e.partidas.push({id:uid(),numero:e.correlativo++,fecha:hastaAno,
      concepto:`Cierre fiscal total ${e.ejercicio} — ISR pagado en exceso, por reclamar a la SAT`,
      docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',
      lineas:[{cta:'1.1.13',desc:'',debe:-diferencia,haber:0},{cta:'2.1.05',desc:'',debe:0,haber:-diferencia}]});
  }
}
function postearIVAAnual(e,debitoIVA,creditoIVA,netoIVA,hastaAno,d){
  /* Mismo criterio que el ISR: la compensación del débito contra el crédito
     es del ejercicio y se fecha en su corte (31/12); el pago del saldo, si
     sobra débito, es otro movimiento, fechado el día que de verdad se paga.
     Hasta que se paga, el débito que sobra sigue en 2.1.04 como lo que es:
     una deuda con la SAT. Si no hay cuenta elegida (no hubo diferencia de
     ISR), no se puede pagar, y solo se compensa lo que se pueda. */
  if(!debitoIVA && !creditoIVA) return;
  const compensado=r2(Math.min(debitoIVA,creditoIVA));
  if(compensado>0){
    e.partidas.push({id:uid(),numero:e.correlativo++,fecha:hastaAno,
      concepto:netoIVA>0
        ? `Cierre fiscal total ${e.ejercicio} — compensación de IVA del ejercicio`
        : `Cierre fiscal total ${e.ejercicio} — compensación de IVA, queda saldo a favor de Q${Q(Math.abs(netoIVA))}`,
      docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',
      lineas:[{cta:'2.1.04',desc:'',debe:compensado,haber:0},{cta:'1.1.09',desc:'',debe:0,haber:compensado}]});
  }
  if(netoIVA>0 && d.cuenta){
    e.partidas.push({id:uid(),numero:e.correlativo++,fecha:d.fechaPago||hoy(),
      concepto:`Cierre fiscal total ${e.ejercicio} — pago de IVA del ejercicio`,
      docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',
      lineas:[{cta:'2.1.04',desc:'',debe:netoIVA,haber:0},{cta:d.cuenta,desc:'',debe:0,haber:netoIVA}]});
  }
}
/* Todas las cifras del cierre fiscal total, sin dibujar nada ni postear nada:
   sirve igual para mostrar el modal que para probar el cálculo por separado. */
function calcularCierreAnual(e){
  const hastaAno=`${e.ejercicio}-12-31`, desdeAno=inicioRegimenEn(e,`${e.ejercicio}-01-01`,hastaAno);
  /* Usa el mismo cálculo central que el Estado de Resultados (con todos sus
     ajustes: gastos no deducibles, IVA no deducible, exceso de viáticos y
     donaciones), para que las dos fórmulas no se desincronicen con el
     tiempo. */
  const R=calcularResultados(e,desdeAno,hastaAno);
  const utilidadAnual=R.antesISR;
  /* R.antesISR ya viene sin el ISR de los cierres parciales (6.2.22):
     calcularResultados() lo excluye siempre de "gastos" en régimen General. */
  const base0=R.baseImponibleISR;
  /* "Reconocido" es el gasto de ISR que ya está en los libros por los cierres parciales; "pagado"
     es lo que de verdad cuenta como ISR pagado. Casi siempre son lo mismo, salvo con la opción b)
     del ISO: ahí parte de lo pagado se usó para pagar ISO y hay que volver a cubrirlo. */
  const reconocidoEnParciales=r2(e.cierresParciales.filter(c=>c.ejercicio===e.ejercicio).reduce((s,c)=>s+c.monto,0));
  const consumidoISO=isrConsumidoPorISO(e,e.ejercicio);
  const pagadoEnParciales=r2(Math.max(0,reconocidoEnParciales-consumidoISO));
  /* Con la opción a): crédito de ISO que se aplica, y el que se vence y pasa a gasto deducible. */
  const plan=planificarISOAnual(e,base0,pagadoEnParciales);
  const baseImponibleAnual=plan.base, isrAnual=plan.isr, diferencia=plan.dif;   // positivo: falta pagar · negativo: se pagó de más
  const creditoISO=plan.aplicado, isoVencido=plan.vencido;
  const ajusteGasto=r2(isrAnual-reconocidoEnParciales);   // lo que falta reconocer como gasto de ISR

  /* El IVA no se "liquida" una vez al año como el ISR — legalmente se sigue
     compensando mes a mes. Pero al cerrar el año conviene dejar limpia la
     cuenta: que no queden débito y crédito acumulados cada uno por su lado,
     para que el año que empieza abra solo con el remanente neto real. */
  /* Saldos de IVA del ejercicio, contando las liquidaciones de sus meses aunque estén fechadas después del 31/12 (el
     IVA de diciembre se paga en enero): si no, el cierre volvía a compensar y pagar lo que ya se pagó. */
  const movIVA={'2.1.04':{debe:0,haber:0},'1.1.09':{debe:0,haber:0}};
  (e.partidas||[]).forEach(p=>{
    const delAnio=p.fecha<=hastaAno&&p.fecha>=`${e.ejercicio}-01-01`, liqDelAnio=p.fecha>hastaAno&&p.liqIVA&&p.liqIVA.hasta<=hastaAno;
    if(!delAnio&&!liqDelAnio) return;
    p.lineas.forEach(l=>{ if(movIVA[l.cta]){ movIVA[l.cta].debe+=+l.debe||0; movIVA[l.cta].haber+=+l.haber||0; } });
  });
  const debitoIVA=r2(movIVA['2.1.04'].haber-movIVA['2.1.04'].debe), creditoIVA=r2(movIVA['1.1.09'].debe-movIVA['1.1.09'].haber);
  const netoIVA=r2(debitoIVA-creditoIVA);

  /* El costo de ventas es el paso que más se pasa por alto, porque vive en
     una pantalla aparte y nada obliga a hacerlo antes de este cierre. Sin él
     el Balance descuadra por ese monto exacto. */
  const tieneInvFinal=Object.prototype.hasOwnProperty.call(e.inventarioFinal||{},hastaAno);
  const costoVentasCerrado=(e.partidas||[]).some(p=>p.fecha===hastaAno&&(p.concepto||'').startsWith('Cierre de costo de ventas al '));
  return {desdeAno,hastaAno,R,baseImponibleAnual,isrAnual,pagadoEnParciales,reconocidoEnParciales,consumidoISO,
    creditoISO,isoVencido,ajusteGasto,diferencia,debitoIVA,creditoIVA,netoIVA,tieneInvFinal,costoVentasCerrado};
}
/* Las dos tablas de la Sección 5 del SAT-1411 (Activo / Pasivo, Patrimonio y Capital). */
function htmlInformacionFinancieraSAT(e,hasta){
  const inf=informacionFinancieraSAT(e,hasta);
  const fila=([label,val])=>`<tr><td>${label}</td><td class="num">${Q(Math.abs(val))}</td></tr>`;
  return `<div class="rej">
    <div class="campo full"><table style="font-size:12.5px"><thead><tr><th>Activo</th><th class="num"></th></tr></thead>
      <tbody>${inf.activo.map(fila).join('')}
      <tr class="total"><td>Total de Activos</td><td class="num">${Q(inf.totalActivo)}</td></tr></tbody></table></div>
    <div class="campo full"><table style="font-size:12.5px"><thead><tr><th>Pasivo, Patrimonio y Capital</th><th class="num"></th></tr></thead>
      <tbody>${inf.pasivo.map(fila).join('')}
      <tr class="total"><td>Total Pasivos, Patrimonio y Capital</td><td class="num">${Q(inf.totalPasivoPatrimonio)}</td></tr></tbody></table></div>
  </div>`;
}

ACCIONES.cierreFiscalTotal=()=>{
  const e=emp();
  if(e.regimen!=='general'){avisar('El cierre fiscal total es solo para el régimen General.');return}
  const cajaBanco=cuentasCajaBanco(e);
  if(!cajaBanco.length){avisar('El catálogo no tiene ninguna cuenta de Caja o Bancos.');return}
  e.cierresParciales=e.cierresParciales||[];
  const cierre=calcularCierreAnual(e);
  const {hastaAno,R,baseImponibleAnual,isrAnual,reconocidoEnParciales,consumidoISO,creditoISO,isoVencido,diferencia,
    debitoIVA,creditoIVA,netoIVA,tieneInvFinal,costoVentasCerrado}=cierre;

  abrirModal('Cierre fiscal total (anual)',
    `${costoVentasCerrado?'':`<div class="aviso malo" style="margin-bottom:14px">
      <strong>⬜ Antes de esto, cerrá también el costo de ventas</strong><br>
      ${tieneInvFinal
        ? 'Ya tenés el inventario final cargado — solo falta ir a Estado de Resultados y darle clic a "Cerrar costo de ventas". Sin eso, el Balance General va a quedar descuadrado por ese monto, aunque este cierre de ISR e IVA salga perfecto.'
        : 'Todavía no cargaste el inventario final del 31/12 en Estado de Resultados. Sin eso, ni el costo de ventas ni el Balance van a cuadrar, sin importar lo que hagas acá.'}
    </div>`}
    <p style="margin:0 0 14px;font-size:13px;color:var(--tinta-suave)">Liquidación anual del ISR sobre utilidades,
      ejercicio ${e.ejercicio}. Formulario SAT-1411, a más tardar el 31 de marzo del año siguiente.</p>
    <table style="font-size:13px"><tbody>
      <tr><td>Renta bruta del ejercicio</td><td class="num">Q${Q(R.ingresos)}</td></tr>
      <tr><td>(−) Costos y gastos acumulados del ejercicio</td><td class="num">Q${Q(r2(R.costoTotal+R.gastos))}</td></tr>
      <tr><td>(+) Gastos no deducibles</td><td class="num">Q${Q(R.noDeducible)}</td></tr>
      ${R.ivaNoDeducible?`<tr><td>(+) IVA no deducible</td><td class="num">Q${Q(R.ivaNoDeducible)}</td></tr>`:''}
      ${R.excesoNoDeducible?`<tr><td>(+) Exceso de viáticos y donaciones no deducible</td><td class="num">Q${Q(R.excesoNoDeducible)}</td></tr>`:''}
      ${R.gastosRentasCapital?`<tr><td>(+) Costos y gastos vinculados a rentas de capital</td><td class="num">Q${Q(R.gastosRentasCapital)}</td></tr>`:''}
      ${R.rentasOtrasCategorias?`<tr><td>(−) Rentas de capital (intereses y ganancias de capital, tributan aparte)</td><td class="num">Q${Q(R.rentasOtrasCategorias)}</td></tr>`:''}
      ${isoVencido>0?`<tr><td>(−) ISO no acreditado en 3 años (gasto deducible)</td><td class="num">Q${Q(isoVencido)}</td></tr>`:''}
      <tr class="total"><td>${baseImponibleAnual<0?'Pérdida fiscal del ejercicio':'Renta imponible del ejercicio'}</td><td class="num">Q${Q(baseImponibleAnual)}</td></tr>
      <tr><td>Impuesto Sobre la Renta (25%)</td><td class="num">Q${Q(isrAnual)}</td></tr>
      <tr><td>(−) ISR acumulado en los cierres parciales de ${e.ejercicio}</td><td class="num">Q${Q(reconocidoEnParciales)}</td></tr>
      ${consumidoISO>0?`<tr><td>(+) Pagos de ISR que se usaron para pagar el ISO (opción b)</td><td class="num">Q${Q(consumidoISO)}</td></tr>`:''}
      <tr class="total"><td>${diferencia>=0?'Impuesto determinado en la liquidación anual':'Pagado en exceso'}</td><td class="num">Q${Q(Math.abs(diferencia))}</td></tr>
      ${creditoISO>0?`<tr><td>Se cubre con crédito de ISO</td><td class="num">Q${Q(creditoISO)}</td></tr>
      <tr><td>A pagar en efectivo</td><td class="num">Q${Q(r2(Math.max(0,diferencia-creditoISO)))}</td></tr>`:''}
    </tbody></table>
    <div class="aviso">Este desglose sigue la misma estructura que el formulario trimestral (SAT-1361), verificada
      línea por línea contra el modelo real. Son cifras de apoyo para llenar la declaración anual en Declaraguate.</div>
    ${diferencia>0? `<div class="rej">
      <div class="campo"><label>Se paga desde</label><select name="cuenta">
        ${cajaBanco.map(c=>`<option value="${c.c}">${c.c} — ${esc(c.n)}</option>`).join('')}
      </select></div>
      <div class="campo"><label>Fecha de pago</label><input name="fechaPago" type="date" value="${fechaPagoDefault(e)}"></div>
    </div>`
     : diferencia<0? `<div class="aviso malo">Pagaste de más en los cierres parciales. Ese exceso no se
        descuenta solo de los pagos trimestrales del año siguiente: hay que solicitar a la SAT su
        <strong>compensación</strong> con otras obligaciones tributarias o su <strong>devolución</strong>
        (Código Tributario, Arts. 43 y 92). Mientras se resuelve, se registra como una cuenta por cobrar a la SAT,
        para no perderle el rastro.</div>`
     : `<div class="aviso">No hay diferencia — lo ya pagado en los cierres parciales cubre exacto el ISR anual.</div>`}
    <h3 style="color:var(--verde);margin:20px 0 8px">Información financiera (Sección 5 del SAT-1411)</h3>
    <p style="margin:0 0 8px;font-size:12.5px;color:var(--tinta-suave)">El balance condensado que pide el formulario,
      en sus propias casillas — verificado línea por línea contra el modelo real que compartiste.</p>
    ${htmlInformacionFinancieraSAT(e,hastaAno)}
    <h3 style="color:var(--verde);margin:20px 0 8px">IVA del ejercicio</h3>
    <table style="font-size:13px"><tbody>
      <tr><td>Débito fiscal acumulado del año</td><td class="num">Q${Q(debitoIVA)}</td></tr>
      <tr><td>Crédito fiscal acumulado del año</td><td class="num">Q${Q(creditoIVA)}</td></tr>
      <tr class="total"><td>${netoIVA>0?'Queda pendiente de pago':'Queda como saldo a favor'}</td><td class="num">Q${Q(Math.abs(netoIVA))}</td></tr>
    </tbody></table>
    <div class="aviso">${netoIVA>0
      ? 'El pago se cierra con la misma cuenta que elijas arriba para el ISR, en la misma fecha.'
      : 'No es un pago — solo se compensan las dos cuentas entre sí, y el remanente a favor se traslada al siguiente ejercicio, que es como la ley permite usar el crédito de IVA.'}</div>`,
    d=>{
      postearISRAnual(e,cierre,hastaAno,d);
      postearISOVencido(e,hastaAno);
      postearIVAAnual(e,debitoIVA,creditoIVA,netoIVA,hastaAno,d);
      registrarLog('Hizo el cierre fiscal total',`${e.nombre} — ejercicio ${e.ejercicio} — ISR Q${Q(Math.abs(diferencia))}${diferencia<0?' (pagado en exceso)':''} · IVA ${netoIVA>0?'pagado':'compensado'} Q${Q(Math.abs(netoIVA))}`);
      guardar();
      avisar(`Cierre fiscal total registrado.`,'Listo');
    },diferencia>0?'Registrar pago':diferencia<0?'Registrar el exceso por cobrar':'Cerrar');
};

