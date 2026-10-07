/* ============ ACCIONES DE PARTIDAS ============ */
function renumerarPartidas(e){
  /* El correlativo reinicia en 1 cada ejercicio. */
  const porAno={};
  [...e.partidas].sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.numero-b.numero)
    .forEach(p=>{
      const ano=(p.fecha||'').slice(0,4)||String(e.ejercicio);
      porAno[ano]=(porAno[ano]||0)+1;
      p.numero=porAno[ano];
    });
  e.correlativo=(porAno[String(e.ejercicio)]||0)+1;
}
ACCIONES.renumerar=()=>{
  const e=emp();
  confirmar(`Se reasignarán los números de las ${e.partidas.length} partidas siguiendo el orden de las fechas.\n\nEl correlativo reinicia en 1 cada ejercicio. Las fechas, cuentas y montos no se tocan.`,()=>{
    renumerarPartidas(e); guardar(); pintar();
    avisar('Las partidas quedaron numeradas en orden cronológico.','Listo');
  },'Renumerar');
};

ACCIONES.nuevaPartida=()=>{
  const e=emp();
  borrador={numero:e.correlativo,fecha:hoy(),concepto:'',docTipo:'',docSerie:'',docNum:'',
    nit:'',contraparte:'',lineas:[lineaVacia(),lineaVacia()],editando:null};
  pintar();
};
ACCIONES.editarPartida=d=>{
  if(!puedeEliminar()){avisar('Tu rol no tiene permiso para editar partidas. Pedile a tu gerente que lo haga.');return}
  const e=emp(), p=e.partidas.find(x=>x.id===d.id);
  if(!p){avisar('No se encontró esa partida.');return}
  const autoGenerada = p.origen==='dia' || !!p.docTipo || /^Planilla /.test(p.concepto||'');
  const abrirFormulario=()=>{
    borrador={numero:p.numero,fecha:p.fecha,concepto:p.concepto,
      docTipo:p.docTipo||'',docSerie:p.docSerie||'',docNum:p.docNum||'',
      nit:p.nit||'',contraparte:p.contraparte||'',
      lineas:p.lineas.map(l=>({cta:l.cta,desc:l.desc||'',debe:l.debe||0,haber:l.haber||0})),
      editando:p.id};
    VISTA='partidas'; filtros={}; pintar();
  };
  if(autoGenerada){
    avisar('Esta partida se generó sola —de una factura cargada, un pago, un cobro o una planilla—.\n\nSi la editás a mano, el detalle que alimenta la cartera, el inventario o el ISR de esos módulos no se entera del cambio, porque vive guardado aparte. Para esos casos suele ser más seguro eliminarla y volver a generarla desde donde salió.\n\nVas a poder seguir editándola igual — esto es solo una advertencia.','Ojo con esta partida');
  }
  abrirFormulario();
};
const lineaVacia=()=>({cta:'',desc:'',debe:0,haber:0});
/* Una partida manual con factura (o nota) y movimiento de IVA alimenta los
   libros de compras y ventas, y la cartera si es al crédito: se crea —o se
   actualiza al editarla— un documento vinculado a la partida. Así los libros
   quedan al día con cada movimiento y la conciliación cuadra. */
const TIPO_DTE_MANUAL={'Factura':'FACT','Factura pequeño contribuyente':'FPEQ','Nota de crédito':'NCRE','Nota de débito':'NDEB'};
function sincronizarDocumentoManual(e,p){
  e.documentos=e.documentos||[];
  const previo=e.documentos.findIndex(d=>d.partidaId===p.id&&d.origenManual);
  const autoGenerado=e.documentos.some(d=>d.partidaId===p.id&&!d.origenManual);
  if(autoGenerado) return;   // viene de "Cargar facturas": su documento ya existe
  const tipoDte=TIPO_DTE_MANUAL[p.docTipo];
  const net=c=>r2(p.lineas.filter(l=>l.cta===c).reduce((s,l)=>s+(+l.debe||0)-(+l.haber||0),0));
  const ivaV=net('2.1.04'), ivaC=net('1.1.09');
  let tipo=null;
  if(tipoDte&&ivaV) tipo='venta';
  else if(tipoDte&&(ivaC||tipoDte==='FPEQ')) tipo='compra';
  if(!tipo){ if(previo>=0) e.documentos.splice(previo,1); return; }
  const signo=tipoDte==='NCRE'?-1:1;
  const sumD=r2(p.lineas.reduce((s,l)=>s+(+l.debe||0),0));
  const iva=Math.abs(tipo==='venta'?ivaV:ivaC);
  const total=sumD;   // cada partida cuadra: el total del documento es la suma de un lado
  const lado=(tipo==='compra')===(signo===1)?'debe':'haber';
  const ctaOp=(p.lineas.find(l=>(+l[lado]||0)>0&&!['1.1.09','2.1.04'].includes(l.cta))||{}).cta||'';
  const ladoPago=lado==='debe'?'haber':'debe';
  const ctaPago=(p.lineas.find(l=>(+l[ladoPago]||0)>0&&!['1.1.09','2.1.04'].includes(l.cta))||{}).cta||'';
  const doc={id:previo>=0?e.documentos[previo].id:uid(),origenManual:true,partidaId:p.id,tipo,tipoDte,signo,fecha:p.fecha,
    serie:p.docSerie||'',dte:p.docNum||'',categoria:'',nit:p.nit||'CF',nombre:p.contraparte||'',bs:'B',
    base:r2(total-iva),idp:0,iva:r2(iva),total:r2(total),pequeno:tipoDte==='FPEQ',
    alCredito:ctaPago===(tipo==='compra'?'2.1.01':'1.1.04'),cta:ctaOp,ctaPago,items:[],retencionISR:0,retencionIVA:0};
  if(previo>=0) e.documentos[previo]=doc; else e.documentos.push(doc);
}
ACCIONES.agregarLinea=()=>{borrador.lineas.push(lineaVacia());pintar()};
ACCIONES.quitarLinea=d=>{
  if(borrador.lineas.length<=2){avisar('Una partida necesita al menos dos líneas.');return}
  borrador.lineas.splice(+d.i,1);pintar();
};
ACCIONES.cancelarPartida=()=>{
  confirmar('Se perderá lo que llevás capturado en esta partida.',()=>{borrador=null;pintar()},'Descartar');
};
ACCIONES.guardarPartida=()=>{
  const e=emp(), b=borrador;
  const lineas=b.lineas.filter(l=>l.cta&&((+l.debe||0)||(+l.haber||0)))
    .map(l=>({cta:l.cta,desc:l.desc||'',debe:r2(+l.debe||0),haber:r2(+l.haber||0)}));
  if(!b.concepto.trim()){avisar('Escribí el concepto de la partida.');return}
  if(lineas.length<2){avisar('Necesitás al menos dos líneas con cuenta y monto.');return}
  const mixta=lineas.find(l=>l.debe&&l.haber);
  if(mixta){avisar(`La línea de la cuenta ${mixta.cta} tiene monto en el debe y en el haber. Dejá solo uno.`);return}
  const td=r2(lineas.reduce((s,l)=>s+l.debe,0)), th=r2(lineas.reduce((s,l)=>s+l.haber,0));
  if(td!==th){avisar(`La partida no cuadra.\n\nDebe:  Q${Q(td)}\nHaber: Q${Q(th)}\nDiferencia: Q${Q(Math.abs(td-th))}`);return}
  /* El número de partida se puede escribir a mano en el formulario, así que
     hay que revisar que no choque con el de otra — si no, dos partidas
     distintas terminan compartiendo el mismo número en el Diario. */
  /* El correlativo reinicia cada ejercicio (ver Renumerar), así que el número
     solo puede chocar con otra partida del MISMO año. */
  const anioB=(b.fecha||'').slice(0,4);
  if(!b.fecha){avisar('Escribí la fecha de la partida.');return}
  if(anioCerrado(e,anioB) && !(b.concepto||'').startsWith(PREFIJO_CIERRE_LIBROS)){avisar(`El ejercicio ${anioB} ya tiene Cierre de libros: no se le pueden agregar ni modificar partidas.`);return}
  const chocaCon=e.partidas.find(x=>x.numero===+b.numero && x.id!==b.editando && (x.fecha||'').slice(0,4)===anioB);
  if(chocaCon){avisar(`Ya existe la partida No. ${b.numero} (${chocaCon.concepto}, del ${fFecha(chocaCon.fecha)}). Elegí otro número.`);return}
  if(b.editando){
    const p=e.partidas.find(x=>x.id===b.editando);
    if(!p){avisar('Esa partida ya no existe.');return}
    /* Si cambia la fecha de una partida generada desde facturas, pagos, cobros o
       constancias, esos registros cambian de fecha con ella — así los libros
       de IVA y la cartera siguen coincidiendo con el Diario. */
    if(p.fecha!==b.fecha){
      ['documentos','pagos','cobros','retenciones'].forEach(k=>(e[k]||[]).forEach(x=>{ if(x.partidaId===p.id) x.fecha=b.fecha; }));
    }
    Object.assign(p,{numero:+b.numero,fecha:b.fecha,concepto:b.concepto.trim(),
      docTipo:b.docTipo,docSerie:b.docSerie.trim(),docNum:b.docNum.trim(),
      nit:b.nit.trim(),contraparte:b.contraparte.trim(),lineas});
    sincronizarDocumentoManual(e,p);
    registrarLog('Editó una partida',`No. ${p.numero} — ${p.concepto}`);
  }else{
    const nueva={id:uid(),numero:+b.numero,fecha:b.fecha,concepto:b.concepto.trim(),
      docTipo:b.docTipo,docSerie:b.docSerie.trim(),docNum:b.docNum.trim(),
      nit:b.nit.trim(),contraparte:b.contraparte.trim(),lineas};
    e.partidas.push(nueva);
    sincronizarDocumentoManual(e,nueva);
    registrarLog('Creó una partida',`No. ${b.numero} — ${b.concepto.trim()}`);
  }
  e.correlativo=Math.max(e.correlativo,+b.numero+1);
  borrador=null; guardar(); pintar();
};
ACCIONES.sugerirIA=async()=>{
  const e=emp();
  if(!iaPermitidaSesion()){avisar('El asistente de IA no está habilitado para tu despacho. Lo habilita el Superadministrador.');return}
  const texto=(document.getElementById('iaTexto').value||'').trim();
  const estado=document.getElementById('iaEstado'), nota=document.getElementById('iaNota');
  if(!texto){avisar('Escribí primero qué operación querés registrar.');return}
  estado.textContent='Analizando la operación...'; nota.innerHTML='';
  const catalogo=e.cuentas.filter(c=>c.d).map(c=>`${c.c} = ${c.n}`).join('\n');
  const instruccion=`Sos un contador guatemalteco. Convertí la operación descrita en una partida de doble entrada.

Empresa: ${e.nombre}
Régimen: ${REGIMENES[e.regimen]||e.regimen}

Catálogo de cuentas disponible (usá SOLO estos códigos, exactos):
${catalogo}

Reglas:
- La suma del debe debe ser exactamente igual a la del haber.
- IVA general 12%: en una factura de Q112 con IVA incluido, la base es 100 y el IVA 12.
- Si el régimen es Pequeño Contribuyente, Primario o Pecuario, NO hay crédito fiscal de IVA: el impuesto forma parte del costo o gasto.
- Si el monto descrito no aclara si incluye IVA, asumí que sí lo incluye y decilo en la nota.
- Si falta información esencial, hacé el supuesto más razonable y explicalo en la nota.

Operación: ${texto}

Respondé ÚNICAMENTE con este JSON, sin texto adicional ni marcas de código:
{"concepto":"...","docTipo":"","docSerie":"","docNum":"","nit":"","contraparte":"","lineas":[{"cta":"1.1.03","desc":"...","debe":0,"haber":0}],"nota":"supuestos y advertencias"}`;

  try{
    /* Con clave de API guardada (Configuración) se llama directo a la API de
       Anthropic desde el navegador, así funciona en el archivo descargado. Sin
       clave, solo funciona dentro de la vista previa de la conversación. */
    const clave=claveIA();
    const headers={'Content-Type':'application/json'};
    /* Claude Sonnet 5.5: elegido por costo-beneficio para proponer partidas. */
    const cuerpo={model:'claude-sonnet-5-5',max_tokens:16000,output_config:{effort:'low'},
      messages:[{role:'user',content:instruccion}]};
    if(clave){
      headers['x-api-key']=clave;
      headers['anthropic-version']='2023-06-01';
      headers['anthropic-dangerous-direct-browser-access']='true';
      headers['anthropic-beta']='server-side-fallback-2026-07-01';
      cuerpo.fallbacks='default';   // si el modelo declina, el servidor reintenta con otro modelo
    }
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers,body:JSON.stringify(cuerpo)});
    if(!r.ok){
      let detalle=''; try{ const j=await r.json(); detalle=(j.error&&j.error.message)||''; }catch(err){}
      if(r.status===401) throw new Error('la clave de API no es válida — revisala en Configuración');
      if(r.status===429) throw new Error('se alcanzó el límite de uso de la API, intentá en un momento');
      throw new Error('respuesta '+r.status+(detalle?' — '+detalle:''));
    }
    const data=await r.json();
    if(data.stop_reason==='refusal') throw new Error('el modelo no quiso responder esta consulta');
    /* La respuesta puede traer bloques de razonamiento (thinking): solo se usa el texto. */
    const txt=(data.content||[]).map(x=>x.type==='text'?x.text:'').join('').replace(/```json|```/g,'').trim();
    const p=JSON.parse(txt);
    const validas=new Set(e.cuentas.filter(c=>c.d).map(c=>c.c));
    const lineas=(p.lineas||[]).filter(l=>validas.has(l.cta))
      .map(l=>({cta:l.cta,desc:l.desc||'',debe:r2(+l.debe||0),haber:r2(+l.haber||0)}));
    if(lineas.length<2) throw new Error('no se pudieron identificar las cuentas');
    Object.assign(borrador,{
      concepto:p.concepto||borrador.concepto,
      docTipo:p.docTipo||borrador.docTipo, docSerie:p.docSerie||borrador.docSerie,
      docNum:p.docNum||borrador.docNum, nit:p.nit||borrador.nit,
      contraparte:p.contraparte||borrador.contraparte, lineas
    });
    borrador.nota=p.nota||'';
    pintar();
    const n=document.getElementById('iaNota');
    if(n) n.innerHTML=`<div class="aviso" style="margin:12px 0 0">
      <strong>Propuesta, no registro.</strong> ${esc(borrador.nota||'Revisá las cuentas y los montos antes de guardar.')}</div>`;
  }catch(err){
    estado.textContent='';
    avisar(`El asistente no pudo responder (${err.message}).\n\n${claveIA()?'Revisá tu conexión a internet y la clave de API en Configuración.':'Para usarlo en el archivo descargado, guardá tu clave de API de Anthropic en Configuración → Asistente de IA.'} Mientras tanto podés registrar la partida a mano.`,'Asistente no disponible');
  }
};
ACCIONES.verPartida=d=>{
  const e=emp(), p=e.partidas.find(x=>x.id===d.id);
  const filas=p.lineas.map(l=>{
    const c=e.cuentas.find(x=>x.c===l.cta);
    return `<tr><td>${l.cta} — ${esc(c?c.n:'?')}${l.desc?`<br><span style="color:var(--tinta-suave);font-size:13px">${esc(l.desc)}</span>`:''}</td>
      <td class="num d">${l.debe?Q(l.debe):''}</td><td class="num h">${l.haber?Q(l.haber):''}</td></tr>`}).join('');
  const t=p.lineas.reduce((s,l)=>s+l.debe,0);
  abrirModal(`Partida No. ${p.numero}`,
    `<p style="margin:0 0 12px;color:var(--tinta-suave)">${fFecha(p.fecha)} · ${esc(p.concepto)}</p>
     <table style="font-size:14px"><tbody>${filas}</tbody>
     <tfoot><tr class="total"><td>Sumas iguales</td><td class="num d">${Q(t)}</td><td class="num h">${Q(t)}</td></tr></tfoot></table>`,
    ()=>{},'Cerrar');
};
/* Al eliminar una partida, todo lo que se guardó aparte a partir de ella
   (documentos de facturas, pagos, cobros, planillas, cierres, ISO, activos,
   consignaciones, producción…) tiene que deshacerse también — si no, la
   planilla queda bloqueada para siempre, el trimestre sigue "pagado", el
   activo sigue depreciado, etc. Devuelve la lista de lo que se deshizo. */
function limpiarDependenciasPartida(e,p){
  const id=p.id, num=p.numero, conc=p.concepto||'', notas=[];
  const mismaPartida=x=>x&&(x.partidaId===id);

  /* Documentos de "Cargar facturas" y su efecto en órdenes de compra e inventario */
  const docs=(e.documentos||[]).filter(mismaPartida);
  if(docs.length){
    docs.forEach(d=>{
      if(!d.ocId) return;
      const oc=buscarOC(e,d.ocId); if(!oc) return;
      oc.facturas=(oc.facturas||[]).filter(f=>!(f.serie===d.serie&&f.dte===d.dte&&f.fecha===d.fecha));
      oc.facturado=r2(oc.facturas.reduce((s,f)=>s+f.signo*f.total,0));
      if(oc.estado==='facturada'&&porFacturarOC(oc)>toleranciaOC(oc.total)) oc.estado='aprobada';
      historialOC(oc,'Factura desvinculada',`${d.serie||''}${d.dte?'-'+d.dte:''} — se eliminó su partida`);
    });
    const ids=new Set(docs.map(d=>d.id));
    e.documentos=e.documentos.filter(d=>!mismaPartida(d));
    e.salidasInventario=(e.salidasInventario||[]).filter(s=>!(s.documentoId&&ids.has(s.documentoId)));
    notas.push(`${docs.length} documento(s) cargado(s) desde facturas (libros de IVA, cartera e inventario)`);
  }
  const np=(e.pagos||[]).filter(mismaPartida).length, nc=(e.cobros||[]).filter(mismaPartida).length;
  if(np){ e.pagos=e.pagos.filter(x=>!mismaPartida(x)); notas.push(`${np} pago(s) a proveedores`); }
  if(nc){ e.cobros=e.cobros.filter(x=>!mismaPartida(x)); notas.push(`${nc} cobro(s) a clientes`); }
  if(p.origen==='dia'&&!docs.length&&!np&&!nc)
    notas.push(`OJO: esta partida del día es de antes de esta versión y no tiene vínculo con sus documentos, pagos o cobros. Revisá a mano la cartera y los libros de IVA del ${fFecha(p.fecha)}`);

  /* Planillas */
  (e.planillas||[]).forEach(pl=>{
    if(pl.partidaId===id||(!pl.partidaId&&pl.partidaNumero===num&&/^Planilla /.test(conc))){
      pl.partidaId=null; pl.partidaNumero=null;
      notas.push('la planilla vuelve a quedar sin partida (se puede editar o eliminar)');
    }
  });
  /* Pagos de prestaciones */
  const esPagoPrest=x=>x.partidaId===id||(!x.partidaId&&x.partidaNumero===num&&/^Pago de /.test(conc));
  if((e.pagosPrestaciones||[]).some(esPagoPrest)){
    e.pagosPrestaciones=e.pagosPrestaciones.filter(x=>!esPagoPrest(x));
    notas.push('el registro del pago de prestaciones');
  }
  /* Liquidaciones: el empleado vuelve a quedar activo */
  const esLiq=l=>l.partidaId===id||(!l.partidaId&&l.partidaNumero===num&&/^Liquidación final/.test(conc));
  (e.liquidaciones||[]).filter(esLiq).forEach(l=>{
    const x=(e.empleados||[]).find(y=>y.id===l.empleadoId);
    if(x){ x.activo=true; delete x.fechaRetiro; delete x.motivoRetiro; }
    notas.push(`la liquidación de ${l.nombre} (vuelve a quedar activo)`);
  });
  if(e.liquidaciones) e.liquidaciones=e.liquidaciones.filter(l=>!esLiq(l));

  /* Cierres fiscales parciales */
  const nCierres=(e.cierresParciales||[]).filter(c=>c.partidaId===id).length;
  if(nCierres){ e.cierresParciales=e.cierresParciales.filter(c=>c.partidaId!==id); notas.push('el registro del cierre fiscal parcial (el trimestre vuelve a quedar pendiente)'); }

  /* ISO: créditos, pagos, usos y vencimientos */
  (e.creditosISO||[]).forEach(c=>{
    c.usos=(c.usos||[]).filter(u=>{ if(u.partidaId===id){ c.usado=r2((c.usado||0)-u.monto); notas.push('el uso de crédito de ISO'); return false; } return true; });
    if(c.vencidoPartidaId===id){ c.vencido=0; delete c.vencidoPartidaId; notas.push('el ISO vencido vuelve a estar disponible'); }
  });
  if((e.creditosISO||[]).some(mismaPartida)){ e.creditosISO=e.creditosISO.filter(c=>!mismaPartida(c)); notas.push('el crédito de ISO por acreditar'); }
  if((e.pagosISO||[]).some(mismaPartida)){ e.pagosISO=e.pagosISO.filter(c=>!mismaPartida(c)); notas.push('el registro del pago de ISO'); }

  /* Activos fijos: depreciación y bajas */
  (p.depDetalle||[]).forEach(x=>{
    const a=(e.activosFijos||[]).find(y=>y.id===x.activoId); if(!a) return;
    a.acumulada=r2(Math.max(0,(a.acumulada||0)-x.monto)); a.depreciadoHasta=x.prevHasta||'';
  });
  if(p.depDetalle&&p.depDetalle.length) notas.push('la depreciación registrada en los activos fijos');
  else if(/^Depreciación de activos fijos/.test(conc)) notas.push('OJO: esta depreciación es de antes de esta versión; corregí a mano la depreciación acumulada de cada activo');
  (e.activosFijos||[]).forEach(a=>{
    if(a.baja&&a.baja.partidaId===id){
      if(a.baja.prevAcumulada!==undefined){ a.acumulada=a.baja.prevAcumulada; a.depreciadoHasta=a.baja.prevDepreciadoHasta||''; }
      a.baja=null; notas.push(`la baja de ${a.descripcion} (vuelve a estar en uso)`);
    }
  });

  /* Consignaciones */
  (e.consignaciones||[]).forEach(c=>{
    if(c.partidaVentaId===id){ c.estado='en_consignacion'; delete c.fechaVenta; delete c.comisionMonto; delete c.partidaVentaId; notas.push('la venta de la consignación (vuelve a estar en consignación)'); }
  });
  if((e.consignaciones||[]).some(c=>c.partidaConsignacionId===id)){
    e.consignaciones=e.consignaciones.filter(c=>c.partidaConsignacionId!==id);
    e.salidasInventario=(e.salidasInventario||[]).filter(s=>s.referenciaId!==id);
    notas.push('la consignación y su salida de inventario');
  }
  /* Devoluciones de IVA */
  (e.devolucionesIVA||[]).forEach(s=>{
    if(s.partidaRecibidaId===id){ s.estado='solicitada'; delete s.fechaRecibida; delete s.montoRecibido; delete s.partidaRecibidaId; notas.push('la devolución de IVA vuelve a quedar en trámite'); }
  });
  if((e.devolucionesIVA||[]).some(s=>s.partidaSolicitudId===id)){
    e.devolucionesIVA=e.devolucionesIVA.filter(s=>s.partidaSolicitudId!==id); notas.push('la solicitud de devolución de IVA');
  }
  /* Constancias de retención registradas a mano */
  if((e.retenciones||[]).some(mismaPartida)){ e.retenciones=e.retenciones.filter(r=>!mismaPartida(r)); notas.push('la constancia de retención'); }
  /* Aumentos de capital */
  if((e.aumentosCapital||[]).some(mismaPartida)){ e.aumentosCapital=e.aumentosCapital.filter(a=>!mismaPartida(a)); notas.push('el registro del aumento de capital'); }

  /* Producción */
  (e.ordenesProduccion||[]).forEach(o=>{
    ['materiales','manoObra','cif'].forEach(k=>{
      const quitar=(o[k]||[]).filter(mismaPartida);
      if(!quitar.length) return;
      const sal=new Set(quitar.map(x=>x.salidaId).filter(Boolean));
      e.salidasInventario=(e.salidasInventario||[]).filter(s=>!sal.has(s.id));
      o[k]=o[k].filter(x=>!mismaPartida(x));
      notas.push(`un costo de la orden de producción ${o.numero}`);
    });
    if(o.partidaCierreId===id){
      o.estado='abierta';
      ['fechaCierre','cantidadTerminada','costoTerminado','costoUnitario','partidaCierreId','partidaCierreNumero','wipFinal','variaciones'].forEach(k=>delete o[k]);
      notas.push(`la orden de producción ${o.numero} vuelve a quedar abierta`);
    }
  });
  return notas;
}
ACCIONES.borrarPartida=d=>{
  if(!puedeEliminar()){avisar('Tu rol no tiene permiso para eliminar partidas. Pedile a tu gerente que lo haga.');return}
  const e=emp(), p=e.partidas.find(x=>x.id===d.id);
  if(!p){avisar('No se encontró esa partida.');return}
  confirmar(`Se eliminará la partida No. ${p.numero} del ${fFecha(p.fecha)}.\n${p.concepto}\n\nTambién se deshace lo que dependa de ella en otros módulos (documentos, cartera, planillas, cierres, activos, ISO, etc.).`,()=>{
    e.partidas=e.partidas.filter(x=>x.id!==d.id);
    const notas=limpiarDependenciasPartida(e,p);
    registrarLog('Eliminó una partida',`No. ${p.numero} — ${p.concepto}`);
    guardar();pintar();
    if(notas.length) avisar(`Partida eliminada. También se deshizo:\n• ${[...new Set(notas)].join('\n• ')}`,'Listo');
  },'Eliminar partida');
};

ACCIONES.exportar=()=>{
  /* Solo lo que le pertenece a este Administrador — nunca el BD completo,
     porque eso se llevaría también los datos de otros despachos que usen
     el mismo archivo. */
  const admin=administradorDeSesion();
  const paquete={
    version:2, exportadoPor:admin,
    empresas:empresasVisibles(),
    usuarios:(BD.usuarios||[]).filter(u=>u.administradorId===admin),
  };
  const b=new Blob([JSON.stringify(paquete,null,1)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(b);
  a.download=`respaldo-contabilidad-${hoy()}.json`;
  a.click();
};
ACCIONES.importar=()=>{
  const f=document.getElementById('archivoImp').files[0];
  if(!f){avisar('Elegí primero el archivo de respaldo.');return}
  const r=new FileReader();
  r.onload=()=>{
    try{
      const d=JSON.parse(r.result);
      if(!d.empresas)throw new Error('El archivo no tiene el formato esperado.');
      const admin=administradorDeSesion();
      const n=d.empresas.length;
      confirmar(`El respaldo trae ${n} empresa${n===1?'':'s'}.\n\nSe reemplazará TU información actual (tus empresas) por lo que trae este archivo. No toca los datos de ningún otro Administrador que use este mismo sistema.`,()=>{
        /* Se re-marcan como propias, por si el archivo se exportó desde otra
           sesión o quedó con un id de administrador distinto. */
        BD.empresas=BD.empresas.filter(e=>e.administradorId!==admin)
          .concat(d.empresas.map(e=>({...e,id:crypto.randomUUID(),administradorId:admin})));
        /* Las cuentas de personal no se importan: ahora viven en el servidor y se crean desde Usuarios. */
        if(!BD.empresas.some(e=>e.id===BD.activa)) BD.activa=empresasVisibles()[0]?empresasVisibles()[0].id:null;
        guardar();VISTA='empresas';pintar();
      },'Restaurar');
    }catch(err){avisar('No se pudo leer el archivo: '+err.message)}
  };
  r.readAsText(f);
};
ACCIONES.borrarTodo=()=>{
  const propias=empresasVisibles();
  const n=propias.length;
  const totalPartidas=propias.reduce((s,e)=>s+e.partidas.length,0);
  confirmar(`Se borrará TODO lo registrado de TUS ${n} empresa${n===1?'':'s'} (${totalPartidas} partidas en total):
    partidas, documentos cargados, pagos y cobros, ventas y consignaciones, inventario, aumentos de capital,
    cierres fiscales, devoluciones de IVA, empleados y planillas, activos fijos, liquidaciones, ISO por acreditar, cotizaciones y órdenes de compra.\n\nSolo va a quedar la empresa con su catálogo
    de cuentas, y la partida original de capital inicial (o de constitución, si es sociedad) — como si la
    empresa recién se hubiera creado.\n\nNo afecta a otros Administradores que usen este mismo sistema.`,()=>{
    confirmar('Última confirmación. ¿Ya exportaste un respaldo?',()=>{
      /* La partida de capital inicial se identifica por cómo empieza su
         concepto — es el mismo texto fijo que le pone formCapitalIndividual
         y confirmarCapitalSocial, así que no hay riesgo de reconocer la
         partida equivocada. */
      const prefijosCapital=['Capital inicial de ','Capital autorizado y suscrito de ','Pago del capital suscrito de '];
      propias.forEach(e=>{
        const partidasCapital=e.partidas.filter(p=>prefijosCapital.some(pre=>(p.concepto||'').startsWith(pre)))
          .sort((a,b)=>a.numero-b.numero);
        partidasCapital.forEach((p,i)=>p.numero=i+1);
        e.partidas=partidasCapital;
        e.documentos=[]; e.pagos=[]; e.cobros=[];
        e.consignaciones=[]; e.salidasInventario=[];
        e.aumentosCapital=[]; e.cierresParciales=[]; e.devolucionesIVA=[];
        e.empleados=[]; e.planillas=[]; e.pagosPrestaciones=[];
        e.inventarioFinal={};
        e.activosFijos=[]; e.creditosISO=[]; e.pagosISO=[]; e.liquidaciones=[];
        e.cotizaciones=[]; e.ordenesCompra=[]; e.correlativoCot=0; e.correlativoOC=0;
        e.ordenesProduccion=[]; e.correlativoProd=0;
        e.correlativo=partidasCapital.length+1;
      });
      guardar(); lote=[]; borrador=null; VISTA='empresas'; pintar();
      avisar('Se borró todo lo registrado de tus empresas. Solo quedaron la empresa, su catálogo de cuentas, y la partida de capital inicial.','Listo');
    },'Sí, borrar los registros');
  },'Continuar');
};

