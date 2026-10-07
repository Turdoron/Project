/* ============ ACTIVOS FIJOS Y DEPRECIACIÓN — Arts. 27 y 28, Dto. 10-2012 ============ */
/* La ley fija porcentajes anuales MÁXIMOS, para el método de línea recta. Se
   puede usar uno menor. Para usar uno mayor, o un método distinto al de línea
   recta, hace falta autorización previa de la SAT, a solicitud del
   contribuyente, y una vez adoptado un método no se cambia sin autorización.
   Por eso el sistema nunca asume el porcentaje: lo propone y lo hace
   confirmar cada vez. El terreno no se deprecia. */
const CATEGORIAS_DEPRECIACION={
  edificios:{nombre:'Edificios, construcciones e instalaciones adheridas a los inmuebles, y sus mejoras',pct:5,act:'1.2.02',dep:'1.2.03',nAct:'Edificios',nDep:'Depreciación acumulada de edificios'},
  plantaciones:{nombre:'Árboles, arbustos, frutales y plantaciones que producen rentas gravadas',pct:15,act:'1.2.14',dep:'1.2.15',nAct:'Plantaciones y cultivos permanentes',nDep:'Depreciación acumulada de plantaciones'},
  mobiliario:{nombre:'Mobiliario y equipo de oficina; instalaciones no adheridas a los inmuebles',pct:20,act:'1.2.04',dep:'1.2.05',nAct:'Mobiliario y equipo',nDep:'Depreciación acumulada de mobiliario y equipo'},
  maquinaria:{nombre:'Maquinaria, grúas, remolques, contenedores y semovientes de carga o trabajo',pct:20,act:'1.2.10',dep:'1.2.11',nAct:'Maquinaria',nDep:'Depreciación acumulada de maquinaria'},
  vehiculos:{nombre:'Vehículos en general',pct:20,act:'1.2.06',dep:'1.2.07',nAct:'Vehículos',nDep:'Depreciación acumulada de vehículos'},
  computo:{nombre:'Equipo de computación',pct:33.33,act:'1.2.08',dep:'1.2.09',nAct:'Equipo de cómputo',nDep:'Depreciación acumulada de equipo de cómputo'},
  herramientas:{nombre:'Herramientas, porcelana, cristalería, mantelería, cubiertos y similares',pct:25,act:'1.2.12',dep:'1.2.13',nAct:'Herramientas',nDep:'Depreciación acumulada de herramientas'},
  reproductores:{nombre:'Reproductores de raza (sobre su costo menos su valor como ganado común)',pct:25,act:'1.2.16',dep:'1.2.17',nAct:'Reproductores de raza',nDep:'Depreciación acumulada de reproductores de raza'},
  otros:{nombre:'Otros bienes muebles no indicados en las categorías anteriores',pct:10,act:'1.2.18',dep:'1.2.19',nAct:'Otros bienes muebles depreciables',nDep:'Depreciación acumulada de otros bienes muebles'},
};
const mesSiguiente=m=>{const [a,b]=m.split('-').map(Number);return b===12?`${a+1}-01`:`${a}-${String(b+1).padStart(2,'0')}`};
const mesesEntre=(d,h)=>{const [a1,b1]=d.split('-').map(Number),[a2,b2]=h.split('-').map(Number);return (a2-a1)*12+(b2-b1)+1};
const ultimoDiaDelMes=m=>{const [a,b]=m.split('-').map(Number);return `${m}-${String(new Date(a,b,0).getDate()).padStart(2,'0')}`};

/* Cuánto falta depreciar de cada activo hasta el cierre de un mes: línea
   recta mensual (costo × % ÷ 12), desde el mes en que empieza a usarse y
   sin pasar nunca del costo. Un activo dado de baja deja de depreciarse
   en el mes de la baja. */
function calcularDepreciacionPendiente(e,hastaMes){
  const filas=[];
  (e.activosFijos||[]).forEach(a=>{
    /* Se empieza a depreciar el mes SIGUIENTE al de la compra — o el mes en que empieza a usarse,
       si es posterior (no se deprecia un bien que todavía no se usa). */
    const mesCompra=mesSiguiente((a.fechaAdquisicion||a.fechaInicioUso).slice(0,7));
    const mesUso=a.fechaInicioUso.slice(0,7);
    const inicio=mesCompra>mesUso?mesCompra:mesUso;
    const desde=a.depreciadoHasta?mesSiguiente(a.depreciadoHasta):inicio;
    const fin=a.baja&&a.baja.fecha.slice(0,7)<hastaMes?a.baja.fecha.slice(0,7):hastaMes;
    if(desde>fin) return;
    const meses=mesesEntre(desde,fin);
    const restante=r2(a.costo-(a.acumulada||0));
    const monto=r2(Math.min(restante,a.costo*a.pct/100/12*meses));
    if(monto>0) filas.push({activo:a,desde,hasta:fin,meses,monto});
  });
  return filas;
}
function totalesActivosFijos(e){
  const act=(e.activosFijos||[]);
  const costo=r2(act.filter(a=>!a.baja).reduce((s,a)=>s+a.costo,0));
  const acum=r2(act.filter(a=>!a.baja).reduce((s,a)=>s+(a.acumulada||0),0));
  const anual=r2(act.filter(a=>!a.baja&&a.costo-(a.acumulada||0)>0.005).reduce((s,a)=>s+a.costo*a.pct/100,0));
  return {costo,acum,enLibros:r2(costo-acum),anual};
}

VISTAS.activosFijos=()=>{
  const e=emp(); const lista=e.activosFijos||[];
  const t=totalesActivosFijos(e);
  const mov=movimientos(null,null);
  const cats=Object.values(CATEGORIAS_DEPRECIACION);
  const concil=cats.filter(c=>lista.some(a=>CATEGORIAS_DEPRECIACION[a.categoria]===c)||saldoNatural(c.act,mov)).map(c=>{
    const deLaCat=lista.filter(a=>CATEGORIAS_DEPRECIACION[a.categoria]===c&&!a.baja);
    const regCosto=r2(deLaCat.reduce((s,a)=>s+a.costo,0)), regAcum=r2(deLaCat.reduce((s,a)=>s+(a.acumulada||0),0));
    const libCosto=saldoNatural(c.act,mov), libAcum=saldoNatural(c.dep,mov);
    return {c,regCosto,libCosto,regAcum,libAcum,ok:Math.abs(regCosto-libCosto)<0.01&&Math.abs(regAcum-libAcum)<0.01};
  });
  const filas=lista.map(a=>{
    const c=CATEGORIAS_DEPRECIACION[a.categoria];
    const sobreMax=a.pct>c.pct+1e-9;
    return `<tr${a.baja?' style="opacity:.55"':''}><td>${esc(a.descripcion)}<br><span style="font-size:12px;color:var(--tinta-suave)">${esc(c.nAct)}</span></td>
      <td class="num">${Q(a.costo)}</td>
      <td class="num">${a.pct}%${sobreMax?`<br><span style="font-size:12px;color:var(--haber)">Autorizada SAT: ${esc(a.autorizacionSAT||'—')}</span>`:(a.pct<c.pct?`<br><span style="font-size:12px;color:var(--tinta-suave)">máx. ${c.pct}%</span>`:'')}</td>
      <td>${fFecha(a.fechaInicioUso)}</td>
      <td class="num">${Q(a.acumulada||0)}</td>
      <td class="num">${Q(r2(a.costo-(a.acumulada||0)))}</td>
      <td>${a.baja?`Baja ${fFecha(a.baja.fecha)}<br><span style="font-size:12px;color:var(--tinta-suave)">${esc(a.baja.motivo||'')}${a.baja.tipo==='venta'||a.baja.resultado?` · ${a.baja.resultado>0.004?'ganancia Q'+Q(a.baja.resultado):a.baja.resultado<-0.004?'pérdida Q'+Q(-a.baja.resultado):'sin ganancia ni pérdida'}`:''}${a.baja.partidaNumero?` · partida ${a.baja.partidaNumero}`:''}</span>`:(a.costo-(a.acumulada||0)<0.005?'Depreciado':'En uso')}</td>
      <td>${a.baja?'':`<button class="btn mini sec" data-accion="editarActivoFijo" data-id="${a.id}">Editar</button>
        <button class="btn mini peligro" data-accion="bajaActivoFijo" data-id="${a.id}">Dar de baja</button>`}</td></tr>`;
  }).join('');
  return cab('Activos fijos','Depreciación en línea recta con los porcentajes máximos del Art. 28 del Decreto 10-2012, desde el mes siguiente a la compra.',
    `<button class="btn sec" data-accion="pdfActivosFijos">Descargar cuadro PDF</button>
     <button class="btn sec" data-accion="generarDepreciacion">Generar depreciación</button>
     <button class="btn" data-accion="nuevoActivoFijo">Nuevo activo</button>`)
  + `<div class="barra"><div class="campo"><label>Corte del cuadro (mes)</label><input type="month" data-filtro="corteActivos" value="${filtros.corteActivos||(hoy().slice(0,4)===String(e.ejercicio)?hoy().slice(0,7):e.ejercicio+'-12')}"></div></div>`
  + `<div class="cifras">
      <div class="cifra"><span>Costo de activos en uso</span><strong>${Q(t.costo)}</strong></div>
      <div class="cifra"><span>Depreciación acumulada</span><strong>${Q(t.acum)}</strong></div>
      <div class="cifra"><span>Valor en libros</span><strong>${Q(t.enLibros)}</strong></div>
      <div class="cifra"><span>Depreciación de un año completo</span><strong>${Q(t.anual)}</strong></div>
    </div>`
  + (lista.length?`<table><thead><tr><th>Activo</th><th class="num">Costo</th><th class="num">% anual</th><th>En uso desde</th>
      <th class="num">Dep. acumulada</th><th class="num">Valor en libros</th><th>Estado</th><th></th></tr></thead><tbody>${filas}</tbody></table>`
    :`<div class="vacio">Todavía no hay activos fijos registrados. Registrá cada bien depreciable para que el sistema calcule su depreciación mes a mes.</div>`)
  + `<div class="aviso" style="margin-top:16px">El registro de acá solo sirve para depreciar: el <strong>costo</strong> del activo tiene que estar
      ya cargado en su cuenta contable (con la factura de compra). El terreno no se deprecia — de un inmueble, registrá solo la construcción.</div>`
  + (concil.length?`<h3 style="color:var(--verde);margin:22px 0 8px">Conciliación contra el libro mayor</h3>
    <table style="font-size:13px"><thead><tr><th>Cuenta</th><th class="num">Costo registrado</th><th class="num">Saldo en libros</th>
      <th class="num">Dep. registrada</th><th class="num">Dep. en libros</th><th></th></tr></thead><tbody>${concil.map(x=>`<tr>
      <td>${x.c.act} — ${esc(x.c.nAct)}</td><td class="num">${Q(x.regCosto)}</td><td class="num">${Q(x.libCosto)}</td>
      <td class="num">${Q(x.regAcum)}</td><td class="num">${Q(x.libAcum)}</td>
      <td>${x.ok?'✔ cuadra':'<span style="color:var(--alerta)">Revisar</span>'}</td></tr>`).join('')}</tbody></table>`:'');
};

function formActivoFijo(a){
  const e=emp(), nuevo=!a; a=a||{categoria:'computo'};
  const yaDep=(a.acumulada||0)>0;
  const ops=Object.entries(CATEGORIAS_DEPRECIACION).map(([k,c])=>
    `<option value="${k}"${a.categoria===k?' selected':''}>${esc(c.nombre)} — máx. ${c.pct}%</option>`).join('');
  const maxInicial=CATEGORIAS_DEPRECIACION[a.categoria].pct;
  abrirModal(nuevo?'Nuevo activo fijo':'Editar activo fijo',
    `<div class="rej">
      <div class="campo full"><label>Descripción</label><input name="descripcion" value="${esc(a.descripcion||'')}" placeholder="Ej.: Computadora portátil Dell"></div>
      <div class="campo full"><label>Categoría (Art. 28)</label><select name="categoria"${yaDep?' disabled':''}>${ops}</select></div>
      <div class="campo"><label>Costo de adquisición</label><input name="costo" type="number" step="0.01" min="0" value="${a.costo||''}"${yaDep?' readonly':''}></div>
      <div class="campo"><label>Fecha de adquisición</label><input name="fechaAdquisicion" type="date" value="${a.fechaAdquisicion||''}"${yaDep?' readonly':''}></div>
      <div class="campo"><label>En uso desde</label><input name="fechaInicioUso" type="date" value="${a.fechaInicioUso||''}"${yaDep?' readonly':''}></div>
      <div class="campo"><label>Porcentaje anual de depreciación</label><input name="pct" type="number" step="0.01" min="0" value="${a.pct||maxInicial}"></div>
    </div>
    <div class="aviso" id="avisoPct">La ley fija como <strong>máximo</strong> <strong id="maxLey">${maxInicial}%</strong> anual para esta categoría (línea recta).
      Podés usar un porcentaje <strong>menor</strong>. Para usar uno mayor, o un método distinto al de línea recta, necesitás
      <strong>autorización previa de la SAT</strong>, que se pide a solicitud tuya — y una vez adoptado, no se puede cambiar sin otra autorización.</div>
    <div class="campo full"><label>Resolución de la SAT (solo si el porcentaje supera el máximo)</label>
      <input name="autorizacionSAT" value="${esc(a.autorizacionSAT||'')}" placeholder="Número de resolución"></div>
    <label style="display:flex;gap:8px;align-items:flex-start;margin-top:12px;font-size:14px">
      <input type="checkbox" name="confirmaPct" style="width:auto;margin-top:4px">
      <span><strong>Confirmo que este es el porcentaje que voy a usar para depreciar este activo.</strong>
      ${yaDep?'El cambio aplica de aquí en adelante; lo ya depreciado no se recalcula.':''}</span></label>`,
    d=>{
      const cat=yaDep?a.categoria:d.categoria, c=CATEGORIAS_DEPRECIACION[cat];
      const costo=yaDep?a.costo:r2(+d.costo), pct=+d.pct;
      if(!d.descripcion.trim()){avisar('Escribí la descripción del activo.');return false}
      if(!(costo>0)){avisar('Escribí el costo de adquisición.');return false}
      const fAdq=yaDep?a.fechaAdquisicion:d.fechaAdquisicion, fUso=yaDep?a.fechaInicioUso:(d.fechaInicioUso||d.fechaAdquisicion);
      if(!fAdq||!fUso){avisar('Escribí la fecha de adquisición y la fecha desde la que se usa.');return false}
      if(fUso<fAdq){avisar('El activo no puede empezar a usarse antes de adquirirse.');return false}
      if(!(pct>0)){avisar('Escribí el porcentaje anual de depreciación.');return false}
      if(pct>c.pct+1e-9 && !(d.autorizacionSAT||'').trim()){
        avisar(`El máximo legal para esta categoría es ${c.pct}% (Art. 28). Para usar ${pct}% necesitás autorización previa de la SAT — escribí el número de resolución, o bajá el porcentaje.`);return false}
      if(d.confirmaPct!=='on'){avisar('Confirmá que ese es el porcentaje que vas a usar — marcá la casilla de confirmación.');return false}
      asegurarCuenta(e,c.act,c.nAct,'activo'); asegurarCuenta(e,c.dep,c.nDep,'activo');
      e.activosFijos=e.activosFijos||[];
      const datos={descripcion:d.descripcion.trim(),categoria:cat,costo,fechaAdquisicion:fAdq,fechaInicioUso:fUso,pct,
        autorizacionSAT:pct>c.pct+1e-9?d.autorizacionSAT.trim():'',cuentaActivo:c.act,cuentaDep:c.dep};
      if(nuevo){
        e.activosFijos.push({id:uid(),...datos,acumulada:0,depreciadoHasta:'',baja:null});
        registrarLog('Registró un activo fijo',`${datos.descripcion} — Q${Q(costo)} al ${pct}%`);
      }else{
        Object.assign(a,datos);
        registrarLog('Editó un activo fijo',`${datos.descripcion} — ${pct}%`);
      }
      guardar(); pintar();
    },nuevo?'Registrar activo':'Guardar cambios');
  const sel=mForm.querySelector('[name="categoria"]');
  sel.onchange=()=>{
    const c=CATEGORIAS_DEPRECIACION[sel.value];
    document.getElementById('maxLey').textContent=c.pct+'%';
    mForm.querySelector('[name="pct"]').value=c.pct;
  };
}
ACCIONES.nuevoActivoFijo=()=>formActivoFijo(null);
ACCIONES.editarActivoFijo=d=>{
  const a=(emp().activosFijos||[]).find(x=>x.id===d.id);
  if(!a){avisar('No se encontró ese activo.');return}
  formActivoFijo(a);
};
/* Baja de un activo: venta, pérdida, obsolescencia o donación. Se registra en UNA partida que
   (1) completa la depreciación que falte hasta el mes de la baja, (2) saca el activo y su
   depreciación acumulada de los libros, y (3) reconoce la ganancia o la pérdida de capital contra el valor
   en libros (costo − depreciación acumulada) en el Estado de Resultados. Si la venta ya se
   facturó y se cargó en "Cargar facturas", el precio se saca de la cuenta de ingreso donde
   quedó, para que no se cuente como venta del giro. */
const MOTIVOS_BAJA_ACTIVO={venta:'Venta',perdida:'Pérdida, robo o siniestro',obsolescencia:'Obsolescencia o desecho',donacion:'Donación'};
function calcularBajaActivo(e,a,fecha,precio){
  const copia={...a,baja:{fecha}};
  const pend=calcularDepreciacionPendiente({activosFijos:[copia]},fecha.slice(0,7));
  const depPend=r2(pend.reduce((s,f)=>s+f.monto,0));
  const acumFinal=r2((a.acumulada||0)+depPend);
  const valorLibros=r2(a.costo-acumFinal);
  const resultado=r2((+precio||0)-valorLibros);   // >0 ganancia, <0 pérdida
  return {depPend,acumFinal,valorLibros,resultado,hastaMes:fecha.slice(0,7)};
}
/* Corrección: la ganancia o pérdida en la baja de un activo fijo SÍ pasa por
   el Estado de Resultados (NIC 16 / NIIF para PYMES secc. 17) — como "Otros
   ingresos" (4.2.03) o como gasto (6.2.29). Para el ISR es una renta de
   capital (Dto. 10-2012): la ganancia tributa el 10% aparte y no entra en la
   renta imponible de actividades lucrativas; la pérdida tampoco se deduce
   ahí (solo se compensa contra ganancias de capital). */
const TASA_GANANCIA_CAPITAL=0.10;
ACCIONES.bajaActivoFijo=d=>{
  const e=emp(), a=(e.activosFijos||[]).find(x=>x.id===d.id);
  if(!a){avisar('No se encontró ese activo.');return}
  const cajaBanco=cuentasCajaBanco(e);
  if(!cajaBanco.length){avisar('El catálogo no tiene ninguna cuenta de Caja o Bancos.');return}
  const ctasIngreso=e.cuentas.filter(c=>c.d&&c.t==='ingreso');
  abrirModal(`Dar de baja: ${esc(a.descripcion)}`,
    `<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">Costo Q${Q(a.costo)} · depreciación registrada Q${Q(a.acumulada||0)}. La partida completa la depreciación que falte hasta el mes de la baja y reconoce la ganancia o la pérdida.</p>
    <div class="rej">
      <div class="campo"><label>Fecha de la baja</label><input name="fecha" type="date" value="${hoy()}"></div>
      <div class="campo"><label>Motivo</label><select name="tipo">${Object.entries(MOTIVOS_BAJA_ACTIVO).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="campo" id="cPrecio"><label>Precio de venta (sin IVA)</label><input name="precio" type="number" step="0.01" min="0" value="0"></div>
      <div class="campo" id="cCuenta"><label>Se cobra en</label><select name="cuenta">${cajaBanco.map(c=>`<option value="${c.c}">${c.c} — ${esc(c.n)}</option>`).join('')}<option value="1.1.04">1.1.04 — Clientes (a crédito)</option></select></div>
      <div class="campo full" id="cFactura"><label style="display:flex;gap:8px;align-items:flex-start;font-weight:400"><input type="checkbox" name="facturada" style="width:auto;margin-top:4px">
        <span>Ya cargué la factura de esta venta en "Cargar facturas" (el cobro y el IVA ya están registrados). Dejala sin marcar si no hay factura cargada: la partida registra el cobro.</span></label></div>
      <div class="campo full" id="cIngreso" style="display:none"><label>¿En qué cuenta de ingreso quedó esa factura?</label>
        <select name="ctaIngreso">${ctasIngreso.map(c=>`<option value="${c.c}"${c.c==='4.1.01'?' selected':''}>${c.c} — ${esc(c.n)}</option>`).join('')}</select>
        <span style="font-size:12.5px;color:var(--tinta-suave)">Se saca de ahí para que la venta del activo no se cuente como venta del giro normal.</span></div>
    </div>
    <table id="tablaBaja" style="font-size:13px;margin-top:10px"></table>
    <div class="aviso">La ganancia o pérdida va al Estado de Resultados. Para el ISR es renta de capital: la ganancia paga 10% aparte (se registra el pasivo) y no se suma a la renta imponible del régimen; la pérdida solo puede compensarse con ganancias de capital (de este año o de los dos siguientes). Si la venta lleva IVA, se declara con su factura.</div>`,
    f=>{
      if(!f.fecha){avisar('Escribí la fecha de la baja.');return false}
      if(f.fecha<a.fechaInicioUso){avisar('La baja no puede ser anterior a la fecha en que empezó a usarse.');return false}
      const anio=f.fecha.slice(0,4);
      if(anioCerrado(e,anio)){avisar(`El ejercicio ${anio} ya tiene Cierre de libros: no se le pueden agregar partidas.`);return false}
      const venta=f.tipo==='venta', precio=venta?r2(+f.precio||0):0;
      if(venta&&!(precio>0)){avisar('Escribí el precio de venta.');return false}
      const facturada=venta&&f.facturada==='on';
      const r=calcularBajaActivo(e,a,f.fecha,precio);
      asegurarCuenta(e,'6.2.11','Depreciaciones','gasto');
      const c=CATEGORIAS_DEPRECIACION[a.categoria];
      asegurarCuenta(e,c.act,c.nAct,'activo'); asegurarCuenta(e,c.dep,c.nDep,'activo');
      const L=[]; const desc=`Baja de ${a.descripcion}`;
      if(r.depPend>0.004){ L.push({cta:'6.2.11',desc:`${desc} — depreciación hasta ${r.hastaMes}`,debe:r.depPend,haber:0}); L.push({cta:a.cuentaDep,desc:`${desc} — depreciación hasta ${r.hastaMes}`,debe:0,haber:r.depPend}); }
      if(r.acumFinal>0.004) L.push({cta:a.cuentaDep,desc,debe:r.acumFinal,haber:0});
      L.push({cta:a.cuentaActivo,desc,debe:0,haber:a.costo});
      if(precio>0){
        if(facturada) L.push({cta:f.ctaIngreso||'4.1.01',desc:`${desc} — se reclasifica la factura de venta del activo`,debe:precio,haber:0});
        else L.push({cta:f.cuenta,desc:`${desc} — cobro de la venta`,debe:precio,haber:0});
      }
      let isrCapital=0;
      if(r.resultado>0.004){
        asegurarCuenta(e,'4.2.03','Ganancia en venta de activos fijos (renta de capital)','ingreso');
        L.push({cta:'4.2.03',desc:`${desc} — ganancia de capital`,debe:0,haber:r.resultado});
        isrCapital=r2(r.resultado*TASA_GANANCIA_CAPITAL);
        asegurarCuenta(e,'6.2.31','ISR sobre rentas de capital','gasto');
        asegurarCuenta(e,'2.1.18','ISR sobre rentas de capital por pagar','pasivo');
        L.push({cta:'6.2.31',desc:`${desc} — ISR 10% ganancia de capital`,debe:isrCapital,haber:0});
        L.push({cta:'2.1.18',desc:`${desc} — ISR 10% ganancia de capital`,debe:0,haber:isrCapital});
      }else if(r.resultado<-0.004){
        asegurarCuenta(e,'6.2.29','Pérdida en baja de activos fijos (pérdida de capital)','gasto');
        L.push({cta:'6.2.29',desc:`${desc} — pérdida de capital`,debe:-r.resultado,haber:0});
      }
      const resultadoTxt=r.resultado>0.004?`Ganancia de capital de Q${Q(r.resultado)} (ISR 10%: Q${Q(isrCapital)} por pagar).`:(r.resultado<-0.004?`Pérdida de capital de Q${Q(-r.resultado)}.`:'Sin ganancia ni pérdida.');
      const p={id:uid(),numero:e.correlativo++,fecha:f.fecha,
        concepto:`${MOTIVOS_BAJA_ACTIVO[f.tipo]} de activo fijo — ${a.descripcion}${facturada?' (venta facturada)':''}`,
        docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',lineas:L};
      e.partidas.push(p);
      const prevAcumulada=a.acumulada||0, prevDepreciadoHasta=a.depreciadoHasta||'';
      a.acumulada=r.acumFinal; a.depreciadoHasta=r.hastaMes;
      a.baja={fecha:f.fecha,motivo:MOTIVOS_BAJA_ACTIVO[f.tipo],tipo:f.tipo,precio,facturada,valorLibros:r.valorLibros,
        resultado:r.resultado,isrCapital,partidaNumero:p.numero,partidaId:p.id,prevAcumulada,prevDepreciadoHasta};
      registrarLog('Dio de baja un activo fijo',`${a.descripcion} — ${fFecha(f.fecha)} — ${MOTIVOS_BAJA_ACTIVO[f.tipo]} — ${resultadoTxt}`);
      guardar(); pintar();
      avisar(`Baja registrada en la partida No. ${p.numero}. ${resultadoTxt}`,'Listo');
    },'Registrar baja');
  const actualizar=()=>{
    const g=n=>mForm.querySelector(`[name="${n}"]`);
    const venta=g('tipo').value==='venta';
    ['cPrecio','cCuenta','cFactura'].forEach(id=>{document.getElementById(id).style.display=venta?'':'none'});
    const fact=venta&&g('facturada').checked;
    document.getElementById('cIngreso').style.display=fact?'':'none';
    document.getElementById('cCuenta').style.display=venta&&!fact?'':'none';
    const fecha=g('fecha').value; if(!fecha){document.getElementById('tablaBaja').innerHTML='';return}
    const precio=venta?r2(+g('precio').value||0):0;
    const r=calcularBajaActivo(e,a,fecha,precio);
    const res=r.resultado;
    document.getElementById('tablaBaja').innerHTML=`<tbody>
      <tr><td>Depreciación que falta registrar hasta ${r.hastaMes}</td><td class="num">${Q(r.depPend)}</td></tr>
      <tr><td>Depreciación acumulada al dar de baja</td><td class="num">${Q(r.acumFinal)}</td></tr>
      <tr class="total"><td>Valor en libros (costo − depreciación)</td><td class="num">${Q(r.valorLibros)}</td></tr>
      ${venta?`<tr><td>Precio de venta</td><td class="num">${Q(precio)}</td></tr>`:''}
      <tr class="total"><td>${res>0.004?'Ganancia de capital':res<-0.004?'Pérdida de capital':'Resultado'}</td><td class="num">${Q(Math.abs(res))}</td></tr>
      ${res>0.004?`<tr><td>ISR sobre ganancia de capital (10%)</td><td class="num">${Q(r2(res*TASA_GANANCIA_CAPITAL))}</td></tr>`:''}</tbody>`;
  };
  ['tipo','fecha','precio','facturada'].forEach(n=>{ const el=mForm.querySelector(`[name="${n}"]`); el.oninput=actualizar; el.onchange=actualizar; });
  actualizar();
};

/* Cuadro de depreciación: lo que corresponde según el % y la fecha de inicio de cada activo hasta el
   mes de corte, separado en lo acumulado al cierre del año anterior y lo del ejercicio. */
function depreciacionTeoricaHasta(a,mes){
  const mesCompra=mesSiguiente((a.fechaAdquisicion||a.fechaInicioUso).slice(0,7)), mesUso=a.fechaInicioUso.slice(0,7);
  const inicio=mesCompra>mesUso?mesCompra:mesUso;
  let fin=mes; if(a.baja&&a.baja.fecha.slice(0,7)<fin) fin=a.baja.fecha.slice(0,7);
  if(fin<inicio) return 0;
  return r2(Math.min(a.costo,a.costo*a.pct/100/12*mesesEntre(inicio,fin)));
}
ACCIONES.pdfActivosFijos=async()=>{
  const e=emp(), lista=e.activosFijos||[];
  if(!lista.length){avisar('No hay activos fijos registrados todavía.');return}
  const corte=filtros.corteActivos||(hoy().slice(0,4)===String(e.ejercicio)?hoy().slice(0,7):`${e.ejercicio}-12`);
  const anio=corte.slice(0,4), mesAnt=`${+anio-1}-12`;
  const alto=altoEncabezado();
  try{
    const jsPDF=await cargarJsPDF();
    const doc=new jsPDF({unit:'pt',format:'letter',orientation:'landscape'});
    const T={costo:0,ant:0,ej:0,acum:0,libros:0,pend:0};
    const body=lista.map(a=>{
      const c=CATEGORIAS_DEPRECIACION[a.categoria];
      const ant=depreciacionTeoricaHasta(a,mesAnt), acum=depreciacionTeoricaHasta(a,corte), ej=r2(acum-ant);
      const pend=r2(Math.max(0,acum-(a.acumulada||0)));
      const vivo=!a.baja||a.baja.fecha.slice(0,7)>corte;
      const libros=r2(a.costo-acum);
      if(vivo){T.costo=r2(T.costo+a.costo);T.libros=r2(T.libros+libros);}
      T.ant=r2(T.ant+ant);T.ej=r2(T.ej+ej);T.acum=r2(T.acum+acum);T.pend=r2(T.pend+pend);
      return [a.descripcion+'\n'+c.nAct,fFecha(a.fechaAdquisicion),a.pct+'%',Q(a.costo),Q(ant),Q(ej),Q(acum),vivo?Q(libros):'—',pend>0.004?Q(pend):'—',
        a.baja&&a.baja.fecha.slice(0,7)<=corte?`Baja ${fFecha(a.baja.fecha)}`:(libros<0.005?'Depreciado':'En uso')];
    });
    body.push([{content:'Totales',colSpan:3,styles:{fontStyle:'bold',textColor:VERDE}},
      ...[T.costo,T.ant,T.ej,T.acum,T.libros,T.pend].map(v=>({content:Q(v),styles:{fontStyle:'bold',halign:'right',textColor:VERDE}})),'']);
    doc.autoTable({
      head:[['Activo','Adquisición','% anual','Costo',`Dep. acum. al 31/12/${+anio-1}`,`Dep. del ejercicio ${anio}`,'Dep. acum. al corte','Valor en libros','Falta registrar','Estado']],
      body,startY:alto,margin:{top:alto,left:40,right:40,bottom:42},
      styles:{fontSize:8,cellPadding:4,lineColor:[225,222,212],lineWidth:.3},headStyles:{fillColor:VERDE,fontSize:7.5},
      columnStyles:{0:{cellWidth:150},3:{halign:'right'},4:{halign:'right'},5:{halign:'right'},6:{halign:'right'},7:{halign:'right'},8:{halign:'right'},2:{halign:'right'}},
      didDrawPage:()=>encabezadoPDF(doc,'Cuadro de depreciación de activos fijos',
        `Línea recta, desde el mes siguiente a la compra (Arts. 27 y 28, Dto. 10-2012) · corte: ${corte} · cifras en quetzales`)});
    pieDePagina(doc);
    doc.save(`Cuadro-Depreciacion-${archivoSeguro(e.nombre)}-${corte}.pdf`);
    avisarDatosIncompletos();
  }catch(err){
    avisar('No se pudo generar el PDF: '+err.message+'\n\nEl generador se descarga de internet la primera vez, así que necesitás conexión.');
  }
};
ACCIONES.generarDepreciacion=(d0={})=>{
  const e=emp();
  if(!(e.activosFijos||[]).some(a=>!a.baja)){avisar('No hay activos fijos registrados todavía.');return}
  const hoyMes=hoy().slice(0,7);
  const porDefecto=d0.hastames&&d0.hastames<=hoyMes?d0.hastames:hoyMes.slice(0,4)===String(e.ejercicio)
    ? (hoyMes.slice(5)==='01'?hoyMes:`${hoyMes.slice(0,5)}${String(+hoyMes.slice(5)-1).padStart(2,'0')}`)
    : `${e.ejercicio}-12`;
  abrirModal('Generar depreciación',
    `<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">Registra la depreciación de todos los activos que falte depreciar, hasta el cierre del mes
      que elijas — con el porcentaje que confirmaste en cada uno. Genera una sola partida: gasto de depreciación contra la depreciación acumulada de cada cuenta.</p>
    <div class="rej"><div class="campo full"><label>Depreciar hasta el cierre de</label><input name="hastaMes" type="month" value="${porDefecto}"></div></div>
    <table id="tablaDep" style="font-size:13px;margin-top:10px"></table>`,
    d=>{
      const hastaMes=d.hastaMes;
      if(!hastaMes){avisar('Elegí hasta qué mes se deprecia.');return false}
      if(hastaMes>hoyMes){avisar('No se puede depreciar un mes que todavía no termina.');return false}
      const filas=calcularDepreciacionPendiente(e,hastaMes);
      if(!filas.length){avisar('No hay nada pendiente de depreciar hasta ese mes.');return false}
      /* Años que toca esta depreciación, y si alguno ya tiene Cierre de libros. */
      const anosTocados=new Set();
      filas.forEach(f=>{for(let a=+f.desde.slice(0,4);a<=+f.hasta.slice(0,4);a++) anosTocados.add(String(a));});
      const cerrado=[...anosTocados].some(a=>(e.partidas||[]).some(p=>(p.concepto||'').startsWith(PREFIJO_CIERRE_LIBROS+a)));
      if(cerrado){avisar('Ese ejercicio ya tiene Cierre de libros: no se le pueden agregar partidas. Deshacé el cierre primero, o depreciá solo hasta el último mes abierto.');return false}
      asegurarCuenta(e,'6.2.11','Depreciaciones','gasto');
      const porCuenta={};
      filas.forEach(f=>{porCuenta[f.activo.cuentaDep]=r2((porCuenta[f.activo.cuentaDep]||0)+f.monto)});
      const total=r2(Object.values(porCuenta).reduce((s,x)=>s+x,0));
      const p={id:uid(),numero:e.correlativo++,fecha:ultimoDiaDelMes(hastaMes),
        concepto:`Depreciación de activos fijos — hasta ${hastaMes}`,docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',
        lineas:[{cta:'6.2.11',desc:'',debe:total,haber:0},...Object.entries(porCuenta).map(([cta,m])=>({cta,desc:'',debe:0,haber:m}))]};
      p.depDetalle=filas.map(f=>({activoId:f.activo.id,monto:f.monto,prevHasta:f.activo.depreciadoHasta||''}));
      e.partidas.push(p);
      filas.forEach(f=>{f.activo.acumulada=r2((f.activo.acumulada||0)+f.monto); f.activo.depreciadoHasta=f.hasta});
      registrarLog('Generó la depreciación de activos fijos',`hasta ${hastaMes} — Q${Q(total)}`);
      guardar(); pintar();
      avisar(`Depreciación registrada en la partida No. ${p.numero}, por Q${Q(total)}.`,'Listo');
    },'Registrar depreciación');
  const actualizar=()=>{
    const m=mForm.querySelector('[name="hastaMes"]').value;
    const filas=m?calcularDepreciacionPendiente(e,m):[];
    document.getElementById('tablaDep').innerHTML=filas.length
      ? `<thead><tr><th>Activo</th><th class="num">%</th><th class="num">Meses</th><th class="num">Depreciación</th></tr></thead><tbody>${filas.map(f=>
          `<tr><td>${esc(f.activo.descripcion)}</td><td class="num">${f.activo.pct}%</td><td class="num">${f.meses}</td><td class="num">${Q(f.monto)}</td></tr>`).join('')}</tbody>
         <tfoot><tr class="total"><td colspan="3">Total</td><td class="num">${Q(r2(filas.reduce((s,f)=>s+f.monto,0)))}</td></tr></tfoot>`
      : `<tbody><tr><td>No hay nada pendiente de depreciar hasta ese mes.</td></tr></tbody>`;
  };
  mForm.querySelector('[name="hastaMes"]').onchange=actualizar;
  actualizar();
};

