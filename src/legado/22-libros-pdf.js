/* ============ LIBROS EN PDF ============ */
async function cargarScript(src){
  await new Promise((ok,mal)=>{
    const s=document.createElement('script'); s.src=src; s.onload=ok;
    s.onerror=()=>mal(new Error('no se pudo descargar el generador de PDF'));
    document.head.appendChild(s);
  });
}
async function cargarJsPDF(){
  if(!window.jspdf) await cargarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  if(!window.jspdf.jsPDF.API.autoTable) await cargarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
  return window.jspdf.jsPDF;
}
const VERDE=[31,68,47], CREMA=[244,239,227];
const archivoSeguro=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^A-Za-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,28);

/* Datos que debe llevar cada hoja de un libro habilitado. */
function encabezadoPDF(doc,titulo,sub){
  const y=bloqueEmpresaPDF(doc);
  const an=doc.internal.pageSize.getWidth();
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...VERDE);
  doc.text(titulo,40,y+9);
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(90,90,90);
  doc.text(sub,40,y+21);
  doc.setDrawColor(...VERDE); doc.setLineWidth(1);
  doc.line(40,y+28,an-40,y+28);
  return y+38;   // dónde puede empezar la tabla
}
/* Solo el bloque con los datos de la empresa —nombre, propietario, NIT,
   dirección, ejercicio—, sin título ni línea debajo. Para un documento como
   el Libro de Estados Financieros, donde varios "estados" distintos pueden
   compartir la misma hoja física: este bloque va una sola vez al principio
   de cada hoja, y cada estado agrega su propio título aparte, más chico,
   sin repetir los datos de la empresa cada vez. */
function bloqueEmpresaPDF(doc){
  const e=emp();
  doc.setFont('helvetica','bold'); doc.setFontSize(12.5); doc.setTextColor(...VERDE);
  doc.text(e.nombre,40,40);

  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(70,70,70);
  let y=53;
  const an=doc.internal.pageSize.getWidth();
  const dato=(etiqueta,valor)=>{
    const texto=`${etiqueta}: ${valor||'—'}`;
    doc.splitTextToSize(texto,an-160).forEach(linea=>{ doc.text(linea,40,y); y+=10; });
  };
  dato('Propietario',e.representante);
  dato('NIT',e.nit);
  dato('Dirección fiscal',e.direccion);
  dato('Ejercicio contable',e.ejercicio);
  return y+6;
}
function pieDePagina(doc,folioInicial=1){
  const n=doc.internal.getNumberOfPages(), an=doc.internal.pageSize.getWidth(), al=doc.internal.pageSize.getHeight();
  for(let i=1;i<=n;i++){
    doc.setPage(i);
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...VERDE);
    doc.text(`Folio No. ${folioInicial+i-1}`,an-40,44,{align:'right'});
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(130,130,130);
    doc.text(`Generado el ${fFecha(hoy())}`,40,al-22);
    doc.text(`Página ${i} de ${n}`,an-40,al-22,{align:'right'});
  }
  return n;   // cuántas hojas ocupó esta descarga, para acumular el siguiente folio
}
/* Folio legal corrido (Art. 368 Código de Comercio). Un libro es una
   acumulación: el folio de una hoja depende de QUÉ período imprime y de
   cuántas hojas ocuparon los períodos anteriores — nunca de cuántas veces se
   descargó el PDF. Por eso se guarda, por libro, cuántas hojas ocupó cada
   período impreso ({desde,hasta,hojas}); volver a descargar el mismo período
   reemplaza su registro, no lo suma. Un período nuevo (el mes siguiente, el
   ejercicio siguiente) empieza donde terminó el anterior.
   Los libros que se imprimen completos desde el origen (ventas, compras,
   pequeño contribuyente, inventario) siempre arrancan en el folio 1: su
   numeración es estable porque lo ya impreso nunca cambia de lugar. */
function entradasFolio(e,libro){
  e.folios=e.folios||{};
  if(!Array.isArray(e.folios[libro])) e.folios[libro]=[];   // el contador viejo (un número que crecía con cada descarga) se descarta
  return e.folios[libro];
}
function siguienteFolio(e,libro,desde){
  if(!desde) return 1;
  const previos=entradasFolio(e,libro).filter(x=>x.hasta<desde);
  /* Si un período más amplio ya cubre a otro (el año completo vs. un mes de ese año),
     cuenta solo el amplio — si no, las mismas hojas se sumarían dos veces. */
  const vigentes=previos.filter(x=>!previos.some(y=>y!==x&&y.desde<=x.desde&&y.hasta>=x.hasta&&(y.desde<x.desde||y.hasta>x.hasta)));
  return vigentes.reduce((s,x)=>s+x.hojas,0)+1;
}
function registrarFolio(e,libro,desde,hasta,hojas){
  const lista=entradasFolio(e,libro), reg={desde,hasta,hojas};
  const i=lista.findIndex(x=>x.desde===desde&&x.hasta===hasta);
  if(i>=0) lista[i]=reg; else lista.push(reg);
  guardar();
}
/* La altura del encabezado varía si la dirección ocupa más de un renglón. */
function altoEncabezado(){
  const e=emp();
  const texto=`Dirección fiscal: ${e.direccion||'—'}`;
  const renglonesExtra=Math.max(0,Math.ceil(texto.length/100)-1);
  return 131 + renglonesExtra*10;
}
function avisarDatosIncompletos(){
  const e=emp(), faltan=[];
  if(!e.nit) faltan.push('el NIT');
  if(!e.direccion) faltan.push('la dirección fiscal');
  if(!e.representante) faltan.push('el propietario');
  if(faltan.length){
    avisar(`A la empresa le falta ${faltan.join(', ')}.\n\nEsos datos deben aparecer en cada hoja del libro. Corregilos en la pantalla de Empresas antes de imprimir el libro definitivo.`,'Datos incompletos');
  }
}
const rango=()=>{
  const e=emp();
  return [filtros.desde||`${e.ejercicio}-01-01`, filtros.hasta||`${e.ejercicio}-12-31`];
};

ACCIONES.pdfDiario=async()=>{
  const e=emp(), [d,h]=rango();
  const lista=e.partidas.filter(p=>p.fecha>=d&&p.fecha<=h)
    .sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.numero-b.numero);
  if(!lista.length){avisar('No hay partidas en el rango seleccionado.');return}
  const alto=altoEncabezado();
  try{
    const jsPDF=await cargarJsPDF();
    const doc=new jsPDF({unit:'pt',format:'letter'});
    const body=[]; let td=0,th=0;
    lista.forEach(p=>{
      body.push([{content:`Partida No. ${p.numero}   ·   ${fFecha(p.fecha)}   ·   ${p.concepto}`,
        colSpan:4,styles:{fillColor:CREMA,textColor:VERDE,fontStyle:'bold'}}]);
      p.lineas.forEach(l=>{
        td+=+l.debe||0; th+=+l.haber||0;
        const c=e.cuentas.find(x=>x.c===l.cta);
        body.push([l.cta,(c?c.n:'?')+(l.desc?' — '+l.desc:''),
          l.debe?Q(l.debe):'', l.haber?Q(l.haber):'']);
      });
    });
    body.push([{content:'Sumas iguales',colSpan:2,styles:{fontStyle:'bold',textColor:VERDE}},
      {content:Q(td),styles:{fontStyle:'bold',halign:'right',textColor:VERDE}},
      {content:Q(th),styles:{fontStyle:'bold',halign:'right',textColor:VERDE}}]);
    doc.autoTable({
      head:[['Cuenta','Descripción','Debe','Haber']], body, startY:alto,
      margin:{top:alto,left:40,right:40,bottom:42},
      styles:{fontSize:8,cellPadding:3.5,lineColor:[225,222,212],lineWidth:.3},
      headStyles:{fillColor:VERDE,fontSize:8},
      columnStyles:{0:{cellWidth:58},2:{halign:'right',cellWidth:70},3:{halign:'right',cellWidth:70}},
      didDrawPage:()=>encabezadoPDF(doc,'Libro Diario',
        `Del ${fFecha(d)} al ${fFecha(h)}   ·   ${lista.length} partidas   ·   cifras en quetzales`)
    });
    const folioInicial=siguienteFolio(e,'diario',d);
    const hojas=pieDePagina(doc,folioInicial);
    registrarFolio(e,'diario',d,h,hojas);
    doc.save(`Libro-Diario-${archivoSeguro(e.nombre)}-${d}-al-${h}.pdf`);
    avisarDatosIncompletos();
  }catch(err){
    avisar('No se pudo generar el PDF: '+err.message+'\n\nEl generador se descarga de internet la primera vez, así que necesitás conexión.');
  }
};

ACCIONES.pdfMayor=async()=>{
  const e=emp(), [d,h]=rango();
  const alto=altoEncabezado();
  try{
    const jsPDF=await cargarJsPDF();
    const doc=new jsPDF({unit:'pt',format:'letter'});
    const body=[]; let cuentasIncluidas=0;
    /* Todas las cuentas de detalle, en orden de código, no solo la que está en pantalla. */
    e.cuentas.filter(c=>c.d).forEach(c=>{
      let ant=0;
      e.partidas.filter(p=>p.fecha<d).forEach(p=>p.lineas.filter(l=>l.cta===c.c)
        .forEach(l=>ant+=(+l.debe||0)-(+l.haber||0)));
      const movs=[];
      e.partidas.filter(p=>p.fecha>=d&&p.fecha<=h)
        .sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.numero-b.numero)
        .forEach(p=>p.lineas.filter(l=>l.cta===c.c).forEach(l=>movs.push({p,l})));
      if(!movs.length && r2(ant)===0) return;   // cuentas sin uso no ensucian el libro
      cuentasIncluidas++;
      const signo=v=>NATURAL_DEUDORA(c.t)?v:-v;
      body.push([{content:`${c.c}   ${c.n}   ·   naturaleza ${NATURAL_DEUDORA(c.t)?'deudora':'acreedora'}`,
        colSpan:6,styles:{fillColor:VERDE,textColor:[255,255,255],fontStyle:'bold'}}]);
      body.push([{content:`Saldo al ${fFecha(d)}`,colSpan:5,styles:{fillColor:CREMA,textColor:VERDE}},
        {content:Q(signo(ant)),styles:{fillColor:CREMA,textColor:VERDE,halign:'right'}}]);
      let corr=ant, sd=0, sh=0;
      movs.forEach(({p,l})=>{
        corr+=(+l.debe||0)-(+l.haber||0); sd+=(+l.debe||0); sh+=(+l.haber||0);
        body.push([fFecha(p.fecha),String(p.numero),(l.desc||p.concepto).slice(0,58),
          l.debe?Q(l.debe):'', l.haber?Q(l.haber):'', Q(signo(corr))]);
      });
      body.push([{content:'Movimientos del período',colSpan:3,styles:{fontStyle:'bold',textColor:VERDE}},
        {content:Q(sd),styles:{fontStyle:'bold',halign:'right',textColor:VERDE}},
        {content:Q(sh),styles:{fontStyle:'bold',halign:'right',textColor:VERDE}},
        {content:Q(signo(ant+sd-sh)),styles:{fontStyle:'bold',halign:'right',textColor:VERDE}}]);
      body.push([{content:'',colSpan:6,styles:{minCellHeight:8,fillColor:[255,255,255],lineWidth:0}}]);
    });
    if(!cuentasIncluidas){avisar('No hay cuentas con movimiento ni saldo en el rango seleccionado.');return}
    doc.autoTable({
      head:[['Fecha','Partida','Descripción','Debe','Haber','Saldo']], body, startY:alto,
      margin:{top:alto,left:40,right:40,bottom:42},
      styles:{fontSize:7.5,cellPadding:3,lineColor:[225,222,212],lineWidth:.3},
      headStyles:{fillColor:VERDE,fontSize:7.5},
      columnStyles:{0:{cellWidth:52},1:{cellWidth:40},
        3:{halign:'right',cellWidth:62},4:{halign:'right',cellWidth:62},5:{halign:'right',cellWidth:66}},
      didDrawPage:()=>encabezadoPDF(doc,'Libro Mayor',
        `Del ${fFecha(d)} al ${fFecha(h)}   ·   ${cuentasIncluidas} cuentas   ·   cifras en quetzales`)
    });
    const folioInicial=siguienteFolio(e,'mayor',d);
    const hojas=pieDePagina(doc,folioInicial);
    registrarFolio(e,'mayor',d,h,hojas);
    doc.save(`Libro-Mayor-${archivoSeguro(e.nombre)}-${d}-al-${h}.pdf`);
    avisarDatosIncompletos();
  }catch(err){
    avisar('No se pudo generar el PDF: '+err.message+'\n\nEl generador se descarga de internet la primera vez, así que necesitás conexión.');
  }
};

/* Cada renglón de una factura XML trae su propio "Bien" o "Servicio" puesto
   por el proveedor en su propia factura electrónica — el sistema confía en
   eso. Cuando un proveedor marca mal un cobro (flete, servicio logístico, un
   descuento) como si fuera mercadería, se cuela al inventario sin que haya
   ninguna cuenta nueva ni partida de por medio: es el mismo renglón, solo
   hay que corregir su marca. Esto lista todo lo que hoy cuenta como "Bien"
   para poder excluir lo que no corresponda. */
ACCIONES.revisarItemsInventario=()=>{
  const e=emp();
  const items=[];
  (e.documentos||[]).forEach((d,di)=>{
    if(d.tipo!=='compra'||!d.items||!d.items.length) return;
    d.items.forEach((it,ii)=>{
      if(it.bs==='B') items.push({di,ii,fecha:d.fecha,nombre:d.nombre,descripcion:it.descripcion,cantidad:it.cantidad,total:it.total});
    });
  });
  if(!items.length){avisar('No hay ningún ítem marcado como "Bien" para revisar.');return}
  items.sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const filas=items.map(x=>`<tr data-fila="${x.di}-${x.ii}">
    <td>${fFecha(x.fecha)}</td><td>${esc(x.nombre||'—')}</td><td>${esc(x.descripcion)}</td>
    <td class="num">${x.cantidad?Q(x.cantidad).replace(/\.00$/,''):'—'}</td>
    <td class="num">${Q(x.total)}</td>
    <td class="num"><button class="btn mini sec" data-accion="excluirItemInventario" data-di="${x.di}" data-ii="${x.ii}">No es mercadería</button></td></tr>`).join('');
  abrirModal('Revisar ítems del inventario',
    `<p style="margin:0 0 14px;font-size:13px;color:var(--tinta-suave)">Estos son todos los renglones que hoy
      cuentan como mercadería, tal como vinieron marcados en la factura del proveedor. Si alguno en realidad es
      un cobro de flete, servicio, o un descuento — no un producto —, sacalo de acá; no se borra el renglón, solo
      deja de contar como inventario.</p>
    <div style="max-height:60vh;overflow:auto">
    <table><thead><tr><th>Fecha</th><th>Proveedor</th><th>Descripción</th>
      <th class="num">Cantidad</th><th class="num">Valor</th><th class="num"></th></tr></thead>
      <tbody>${filas}</tbody></table></div>`,
    ()=>{}, 'Cerrar');
  mForm.querySelectorAll('[data-accion="excluirItemInventario"]').forEach(b=>{
    b.onclick=()=>ACCIONES.excluirItemInventario(b.dataset);
  });
};
ACCIONES.excluirItemInventario=d0=>{
  const e=emp();
  const doc=e.documentos[+d0.di];
  if(!doc||!doc.items||!doc.items[+d0.ii]){avisar('No se encontró ese ítem.');return}
  const it=doc.items[+d0.ii];
  it.bs='S';
  guardar();
  const fila=document.querySelector(`[data-fila="${d0.di}-${d0.ii}"]`);
  if(fila) fila.style.opacity='.35', fila.querySelector('button').replaceWith(document.createTextNode('Excluido ✓'));
};

ACCIONES.pdfInventario=async()=>{
  const e=emp();
  const {lista, sinDetalle, sinDetalleValor}=inventarioDetalle(e);
  if(!lista.length && !sinDetalle){avisar('No hay compras de bienes registradas todavía.');return}
  const alto=altoEncabezado();
  try{
    const jsPDF=await cargarJsPDF();
    const doc=new jsPDF({unit:'pt',format:'letter'});
    const body=lista.map(p=>[p.producto, p.cantidad?Q(p.cantidad):'—', Q(p.costoUnitario), Q(p.total)]);
    if(sinDetalle) body.push([{content:`${sinDetalle} compra(s) sin detalle de producto (cargadas desde Excel)`,colSpan:3,
      styles:{textColor:[130,130,130],fontStyle:'italic'}},
      {content:Q(sinDetalleValor),styles:{halign:'right',textColor:[130,130,130]}}]);
    const totalGeneral=r2(lista.reduce((s,p)=>s+p.total,0)+sinDetalleValor);
    body.push([{content:'Total',colSpan:3,styles:{fontStyle:'bold',textColor:VERDE}},
      {content:Q(totalGeneral),styles:{fontStyle:'bold',halign:'right',textColor:VERDE}}]);
    doc.autoTable({
      head:[['Producto','Existencia','Costo unitario','Valor']], body, startY:alto,
      margin:{top:alto,left:40,right:40,bottom:42},
      styles:{fontSize:8.5,cellPadding:4,lineColor:[225,222,212],lineWidth:.3},
      headStyles:{fillColor:VERDE,fontSize:8.5},
      columnStyles:{1:{halign:'right',cellWidth:110},2:{halign:'right',cellWidth:100},3:{halign:'right',cellWidth:100}},
      didDrawPage:()=>encabezadoPDF(doc,'Inventario — detalle de productos',
        'Existencia por producto (entradas menos salidas) — cifras en quetzales')
    });
    const folioInicial=1;
    const hojas=pieDePagina(doc,folioInicial);
    doc.save(`Inventario-${archivoSeguro(e.nombre)}.pdf`);
    avisarDatosIncompletos();
  }catch(err){
    avisar('No se pudo generar el PDF: '+err.message+'\n\nEl generador se descarga de internet la primera vez, así que necesitás conexión.');
  }
};

ACCIONES.pdfLibroInventarios=async()=>{
  const e=emp();
  const h=filtros.corteInventario||`${e.ejercicio}-12-31`;
  const mov=movimientos(null,h);
  const siguienteDia=(()=>{ const d=new Date(h+'T00:00:00'); d.setDate(d.getDate()+1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
  const detalleCuenta=cta=>{
    if(cta==='1.1.08'){ const {lista}=inventarioDetalle(e); return lista.map(p=>({nombre:p.producto+(p.cantidad?` (${p.cantidad} u.)`:''),monto:p.total})); }
    if(cta==='1.1.04') return carteraClientes(e).filter(x=>x.saldo).map(x=>({nombre:x.nombre||x.nit,monto:x.saldo}));
    if(cta==='2.1.01') return carteraProveedores(e).filter(x=>x.saldo).map(x=>({nombre:x.nombre||x.nit,monto:x.saldo}));
    return null;
  };
  const filas=[];
  ['activo','pasivo','patrimonio'].forEach(tipo=>{
    let hayAlguna=false;
    e.cuentas.filter(c=>c.d&&c.t===tipo).forEach(c=>{
      const v=saldoCuentaAntesDe(e,c.c,siguienteDia); if(!v) return; hayAlguna=true;
      filas.push([{content:`${c.c} — ${c.n}`,colSpan:2,styles:{fontStyle:'bold',fillColor:[242,239,231]}},'']);
      const detalle=detalleCuenta(c.c);
      if(detalle&&detalle.length){
        detalle.forEach(x=>filas.push([x.nombre,Q(x.monto)]));
        filas.push([{content:`Subtotal ${c.n}`,styles:{fontStyle:'italic'}},{content:Q(v),styles:{fontStyle:'italic',halign:'right'}}]);
      }else{
        filas.push(['',Q(v)]);
      }
    });
    if(tipo==='patrimonio'){
      const u=utilidadPatrimonioDetalle(e,h);
      if(u.anteriores) filas.push([(u.anteriores<0?'Pérdidas':'Utilidades')+' de ejercicios anteriores sin cierre de libros',Q(u.anteriores)]);
      filas.push([(u.actual<0?'Pérdida':'Utilidad')+' del ejercicio en curso',Q(u.actual)]);
      hayAlguna=true;
    }
    if(!hayAlguna) filas.push([{content:`Sin saldos en ${tipo}`,colSpan:2,styles:{textColor:[150,150,150]}}]);
  });
  if(!filas.length){avisar('No hay saldos registrados a esa fecha.');return}
  const alto=altoEncabezado();
  try{
    const jsPDF=await cargarJsPDF();
    const doc=new jsPDF({unit:'pt',format:'letter'});
    doc.autoTable({
      head:[['Cuenta / detalle','Monto']], body:filas, startY:alto,
      margin:{top:alto,left:40,right:40,bottom:42},
      styles:{fontSize:8.5,cellPadding:4,lineColor:[225,222,212],lineWidth:.3},
      headStyles:{fillColor:VERDE,fontSize:8.5},
      columnStyles:{1:{halign:'right',cellWidth:110}},
      didDrawPage:()=>encabezadoPDF(doc,'Libro de Inventarios',`Al ${fFecha(h)} — cifras en quetzales`)
    });
    const folioInicial=siguienteFolio(e,'libroInventarios',h.slice(0,4)+'-01-01');
    const hojas=pieDePagina(doc,folioInicial);
    registrarFolio(e,'libroInventarios',h.slice(0,4)+'-01-01',h,hojas);
    doc.save(`Libro-Inventarios-${archivoSeguro(e.nombre)}-${h}.pdf`);
    avisarDatosIncompletos();
  }catch(err){
    avisar('No se pudo generar el PDF: '+err.message+'\n\nEl generador se descarga de internet la primera vez, así que necesitás conexión.');
  }
};

ACCIONES.pdfFlujoEfectivo=async()=>{
  const e=emp();
  const d=filtros.desdeFlujo||`${e.ejercicio}-01-01`, h=filtros.hastaFlujo||`${e.ejercicio}-12-31`;
  const f=flujoEfectivo(e,d,h);
  const alto=altoEncabezado();
  const filas=[];
  const seccion=(titulo,clave)=>{
    filas.push([{content:titulo,colSpan:2,styles:{fontStyle:'bold',fillColor:[242,239,231]}},'']);
    if(!f.detalle[clave].length) filas.push([{content:'Sin movimiento',styles:{textColor:[150,150,150]}},'']);
    else{
      f.detalle[clave].forEach(x=>filas.push([x.nombre,Q(x.monto)]));
      filas.push([{content:`Efectivo neto de ${titulo.toLowerCase()}`,styles:{fontStyle:'italic'}},{content:Q(f.buckets[clave]),styles:{fontStyle:'italic',halign:'right'}}]);
    }
  };
  seccion('Actividades de operación','operacion');
  seccion('Actividades de inversión','inversion');
  seccion('Actividades de financiamiento','financiamiento');
  filas.push([{content:'Aumento (disminución) neto de efectivo',styles:{fontStyle:'bold',textColor:VERDE}},{content:Q(f.cambioNeto),styles:{fontStyle:'bold',halign:'right',textColor:VERDE}}]);
  filas.push(['Efectivo al inicio del período',Q(f.saldoInicial)]);
  filas.push([{content:'Efectivo al final del período',styles:{fontStyle:'bold',textColor:VERDE}},{content:Q(f.saldoFinal),styles:{fontStyle:'bold',halign:'right',textColor:VERDE}}]);
  try{
    const jsPDF=await cargarJsPDF();
    const doc=new jsPDF({unit:'pt',format:'letter'});
    doc.autoTable({
      head:[['Concepto','Monto']], body:filas, startY:alto,
      margin:{top:alto,left:40,right:40,bottom:42},
      styles:{fontSize:9,cellPadding:4,lineColor:[225,222,212],lineWidth:.3},
      headStyles:{fillColor:VERDE,fontSize:9},
      columnStyles:{1:{halign:'right',cellWidth:110}},
      didDrawPage:()=>encabezadoPDF(doc,'Estado de Flujo de Efectivo',`Del ${fFecha(d)} al ${fFecha(h)} — método indirecto (variación de saldos) — cifras en quetzales`)
    });
    pieDePagina(doc);
    doc.save(`Flujo-Efectivo-${archivoSeguro(e.nombre)}.pdf`);
    avisarDatosIncompletos();
  }catch(err){
    avisar('No se pudo generar el PDF: '+err.message+'\n\nEl generador se descarga de internet la primera vez, así que necesitás conexión.');
  }
};

/* Sin parámetro: el libro completo — los ejercicios anteriores cerrados, el período pedido y las
   notas — siempre con folio desde 1. Con `solo` ('resultados','balance','flujo','patrimonio'):
   únicamente ese estado del período pedido, como copia suelta. */
const ESTADOS_SOLO={resultados:'Estado-de-Resultados',balance:'Balance-General',flujo:'Flujo-de-Efectivo',patrimonio:'Cambios-en-el-Patrimonio'};
function datosEstadosFinancieros(e,d,h){
  const R=calcularResultados(e,d,h);
  const movBal=movimientos(null,h);
  const bloqueB=tipo=>{
    let s=0,f=[];
    e.cuentas.filter(c=>c.d&&c.t===tipo).forEach(c=>{
      const v=saldoNatural(c.c,movBal); if(!v) return; s+=v;
      f.push([c.n,Q(v)]);
    });
    return {filas:f,total:r2(s)};
  };
  const act=bloqueB('activo'), pas=bloqueB('pasivo'), patr=bloqueB('patrimonio');
  const utilAcum=utilidadPatrimonioSinDuplicar(e,h);
  const f=flujoEfectivo(e,d,h);
  const patrInicial=r2(e.cuentas.filter(c=>c.d&&c.t==='patrimonio').reduce((s,c)=>s+saldoCuentaAntesDe(e,c.c,d),0));
  const aumentosPeriodo=r2(e.cuentas.filter(c=>c.d&&c.t==='patrimonio')
    .reduce((s,c)=>{const m=R.mov[c.c]||{debe:0,haber:0};return s+((m.haber||0)-(m.debe||0));},0));
  const patrFinal=r2(patrInicial+aumentosPeriodo+R.netaReal);
  return {d,h,R,act,pas,patr,utilAcum,f,patrInicial,aumentosPeriodo,patrFinal};
}
ACCIONES.pdfEstadosFinancieros=async(arg)=>{
  const solo=arg&&ESTADOS_SOLO[arg.solo]?arg.solo:'';
  const e=emp();
  const d=filtros.desdeEF||`${e.ejercicio}-01-01`, h=filtros.hastaEF||`${e.ejercicio}-12-31`;
  const alto=altoEncabezado();
  try{
    const jsPDF=await cargarJsPDF();
    /* Tamaño Oficio (8.5 × 13 pulgadas) en vez de Carta — 612×936 puntos,
       ya que 1 pulgada = 72pt. */
    const doc=new jsPDF({unit:'pt',format:[612,936]});
    /* La ley pide un encabezado por cada estado financiero —su propio
       título y período—, no uno genérico de "Libro de Estados Financieros"
       repetido en cada hoja. Pero eso no significa que cada estado necesite
       su propia hoja entera: si el Estado de Resultados y el Balance
       General caben juntos en un folio, van juntos — dejar una hoja casi en
       blanco después de una tabla corta no tiene sentido. La regla es
       simple: el bloque completo con los datos de la empresa (nombre, NIT,
       dirección) se dibuja una vez por hoja física, al principio; cada
       estado, dentro de esa hoja o de la siguiente, lleva su propio título
       y período en una franja más chica, sin repetir el bloque de la
       empresa — y solo se salta de hoja cuando de verdad no alcanza el
       espacio para el título más un mínimo de contenido debajo. */
    const anchoPag=doc.internal.pageSize.getWidth(), altoPag=doc.internal.pageSize.getHeight();
    const subtituloEstado=(numeroYTitulo,periodo,y)=>{
      doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...VERDE);
      doc.text(numeroYTitulo,40,y);
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(90,90,90);
      doc.text(periodo,40,y+12);
      doc.setDrawColor(...VERDE); doc.setLineWidth(.6);
      doc.line(40,y+19,anchoPag-40,y+19);
      return y+30;
    };
    let yActual=bloqueEmpresaPDF(doc);   // dibuja el bloque de la empresa en la primera hoja física
    let impresos=0;
    const estado=(clave,numeroYTitulo,periodo,filas)=>{
      if(solo&&solo!==clave) return;
      const esPrimero=!impresos++;
      if(!esPrimero){
        const espacioRestante=altoPag-42-yActual;
        if(espacioRestante<130){ doc.addPage(); yActual=bloqueEmpresaPDF(doc); }
        else yActual+=18;   // un respiro entre dos estados que comparten la misma hoja
      }
      const startY=subtituloEstado(numeroYTitulo,periodo,yActual);
      doc.autoTable({body:filas, startY, margin:{top:alto,left:40,right:40,bottom:42},
        styles:{fontSize:9,cellPadding:3,lineColor:[225,222,212],lineWidth:.3},
        columnStyles:{1:{halign:'right',cellWidth:110}}, theme:'plain',
        didDrawPage:(data)=>{
          /* Esto es distinto al salto de hoja de arriba: acá la tabla de
             ESTE MISMO estado ya no cupo en una sola hoja y jsPDF armó una
             nueva por su cuenta — ahí sí hay que repetir el encabezado
             completo de la empresa, más el título de este mismo estado,
             porque la hoja nueva empieza en blanco. */
          if(data.pageNumber>1){ const y2=bloqueEmpresaPDF(doc); subtituloEstado(numeroYTitulo,periodo,y2); }
        }});
      yActual=doc.lastAutoTable.finalY;
    };
    /* El libro es una acumulación: además del período pedido, arrastra los ejercicios anteriores que ya
       tienen Cierre de libros, cada uno con sus cuatro estados, y por eso siempre arranca en el folio 1.
       Una copia suelta de un solo estado imprime solo el período pedido. */
    const anioD=+d.slice(0,4);
    const anosPrevios=solo?[]:[...new Set((e.partidas||[]).map(x=>x.concepto||'').filter(c=>c.startsWith(PREFIJO_CIERRE_LIBROS))
      .map(c=>+c.slice(PREFIJO_CIERRE_LIBROS.length,PREFIJO_CIERRE_LIBROS.length+4)).filter(a=>a&&a<anioD))].sort();
    const periodos=[...anosPrevios.map(a=>datosEstadosFinancieros(e,`${a}-01-01`,`${a}-12-31`)),datosEstadosFinancieros(e,d,h)];
    const dibujarEstados=(X,nuevoBloque)=>{
      const {d,h,R,act,pas,patr,utilAcum,f,patrInicial,aumentosPeriodo,patrFinal}=X;
      if(nuevoBloque&&impresos>0){ doc.addPage(); yActual=bloqueEmpresaPDF(doc); }
    estado('resultados','1. Estado de Resultados',`Del ${fFecha(d)} al ${fFecha(h)} · cifras en quetzales`,[
      ['Ingresos',Q(R.ingresos)],
      ...filasAPdf(filasCostoVentas(R)),
      ...(R.otrosCostos?[['Otros costos (fletes, compras de servicios)',Q(R.otrosCostos)]]:[]),
      [{content:R.bruta<0?'Pérdida bruta':'Utilidad bruta',styles:{fontStyle:'bold'}},{content:Q(R.bruta),styles:{fontStyle:'bold'}}],
      ['Gastos de operación',Q(R.gastos)],
      ...(R.regimenPeriodo==='general'?[
        ...(filasConciliacionISR(R).length?filasAPdf(filasConciliacionISR(R))
          :[[{content:(R.antesISR<0?'Pérdida':'Utilidad')+' antes de ISR',styles:{fontStyle:'bold'}},{content:Q(R.antesISR),styles:{fontStyle:'bold'}}]]),
        [filaISRTexto(R),Q(R.isr)],
      ]:[]),
      [{content:(R.neta<0?'Pérdida':'Utilidad')+' del período',styles:{fontStyle:'bold',textColor:VERDE}},{content:Q(R.neta),styles:{fontStyle:'bold',textColor:VERDE}}],
    ]);
    /* El Balance es una foto a una fecha, no un período — "Al", no "Del...al". */
    estado('balance','2. Balance General',`Al ${fFecha(h)} · cifras en quetzales`,[
      [{content:'Activo',styles:{fontStyle:'bold'}},''],...act.filas,
      [{content:'Total activo',styles:{fontStyle:'bold'}},{content:Q(act.total),styles:{fontStyle:'bold'}}],
      [{content:'Pasivo',styles:{fontStyle:'bold'}},''],...pas.filas,
      [{content:'Total pasivo',styles:{fontStyle:'bold'}},{content:Q(pas.total),styles:{fontStyle:'bold'}}],
      [{content:'Patrimonio',styles:{fontStyle:'bold'}},''],...patr.filas,
      ...(()=>{const u=utilidadPatrimonioDetalle(e,h); return [...(u.anteriores?[[(u.anteriores<0?'Pérdidas':'Utilidades')+' de ejercicios anteriores sin cierre de libros',Q(u.anteriores)]]:[]),[(u.actual<0?'Pérdida':'Utilidad')+' del ejercicio en curso',Q(u.actual)]];})(),
      [{content:'Total patrimonio',styles:{fontStyle:'bold',textColor:VERDE}},{content:Q(r2(patr.total+utilAcum)),styles:{fontStyle:'bold',textColor:VERDE}}],
      [{content:'Total pasivo + patrimonio',styles:{fontStyle:'bold',textColor:VERDE}},{content:Q(r2(pas.total+patr.total+utilAcum)),styles:{fontStyle:'bold',textColor:VERDE}}],
    ]);
    estado('flujo','3. Estado de Flujo de Efectivo',`Del ${fFecha(d)} al ${fFecha(h)} · cifras en quetzales`,[
      ['Actividades de operación',Q(f.buckets.operacion)],
      ['Actividades de inversión',Q(f.buckets.inversion)],
      ['Actividades de financiamiento',Q(f.buckets.financiamiento)],
      [{content:'Aumento (disminución) neto de efectivo',styles:{fontStyle:'bold'}},{content:Q(f.cambioNeto),styles:{fontStyle:'bold'}}],
      ['Efectivo al inicio del período',Q(f.saldoInicial)],
      [{content:'Efectivo al final del período',styles:{fontStyle:'bold',textColor:VERDE}},{content:Q(f.saldoFinal),styles:{fontStyle:'bold',textColor:VERDE}}],
    ]);
    estado('patrimonio','4. Estado de Cambios en el Patrimonio',`Del ${fFecha(d)} al ${fFecha(h)} · cifras en quetzales`,[
      ['Patrimonio al inicio del período',Q(patrInicial)],
      ['Aportaciones y aumentos de capital del período',Q(aumentosPeriodo)],
      [(R.neta<0?'Pérdida':'Utilidad')+' del período',Q(R.neta)],
      [{content:'Patrimonio al final del período',styles:{fontStyle:'bold',textColor:VERDE}},{content:Q(patrFinal),styles:{fontStyle:'bold',textColor:VERDE}}],
    ]);
    };
    periodos.forEach((X,i)=>dibujarEstados(X,i>0));
    if(!solo&&(e.notaEstadosFinancieros||'').trim()){
      /* Texto libre, no una tabla — se escribe directo con doc.text() y su
         propio ajuste de línea, en vez de forzarlo adentro de autoTable.
         Mismo criterio que los cuatro estados: si alcanza el espacio en la
         hoja donde quedó el Estado de Cambios en el Patrimonio, las notas
         van ahí mismo, no en una hoja aparte. */
      const ancho=doc.internal.pageSize.getWidth()-80;
      const lineas=doc.splitTextToSize(e.notaEstadosFinancieros.trim(),ancho);
      const espacioNecesario=30+lineas.length*13;
      const espacioRestante=altoPag-42-yActual;
      let y0;
      if(espacioRestante<Math.min(espacioNecesario,130)){ doc.addPage(); y0=bloqueEmpresaPDF(doc); }
      else y0=yActual+18;
      y0=subtituloEstado('Notas a los Estados Financieros','',y0);
      doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(40,40,40);
      doc.text(lineas,40,y0);
    }
    pieDePagina(doc,1);
    doc.save(solo?`${ESTADOS_SOLO[solo]}-${archivoSeguro(e.nombre)}-${h}.pdf`:`Libro-EstadosFinancieros-${archivoSeguro(e.nombre)}.pdf`);
    avisarDatosIncompletos();
  }catch(err){
    avisar('No se pudo generar el PDF: '+err.message+'\n\nEl generador se descarga de internet la primera vez, así que necesitás conexión.');
  }
};

ACCIONES.pdfLibroPequeno=async()=>{
  const e=emp();
  const docs=(e.documentos||[]).filter(d=>regimenEn(e,d.fecha)==='pequeno').sort((a,b)=>a.fecha.localeCompare(b.fecha));
  if(!docs.length){avisar('No hay documentos registrados en este régimen todavía.');return}

  /* Formato oficial del folio (verificado contra el instructivo de la SAT):
     compras y ventas van lado a lado, un folio por mes — Día, Número de
     Documento, Serie, NIT, Nombre y Monto en cada lado. */
  const meses={};
  docs.forEach(d=>{ const clave=d.fecha.slice(0,7); (meses[clave]=meses[clave]||[]).push(d); });
  const clavesMeses=Object.keys(meses).sort();

  try{
    const jsPDF=await cargarJsPDF();
    const doc=new jsPDF({unit:'pt',format:'letter',orientation:'landscape'});
    const an=doc.internal.pageSize.getWidth();
    const mitad=(an-100)/2, xCompras=40, xVentas=40+mitad+20;

    clavesMeses.forEach((clave,idx)=>{
      if(idx>0) doc.addPage();
      const [anio,mesNum]=clave.split('-');
      const nombreMes=MESES_NOM[+mesNum-1];
      const ventas=meses[clave].filter(d=>d.tipo==='venta');
      const compras=meses[clave].filter(d=>d.tipo==='compra');
      const totalVentas=r2(ventas.reduce((s,d)=>s+d.signo*d.total,0));
      const totalCompras=r2(compras.reduce((s,d)=>s+d.signo*d.total,0));
      const impuesto=r2(totalVentas*0.05);

      const alto=encabezadoPDF(doc,'Libro de Compras y Ventas del Pequeño Contribuyente',
        `Mes de ${nombreMes}, ${anio}`);
      const dia=f=>String(new Date(f+'T00:00:00').getDate());
      const filaCompra=d=>[dia(d.fecha),d.dte||'',d.serie||'',d.nit||'CF',d.nombre||'—',Q(d.signo*d.total)];
      const filaVenta=d=>[dia(d.fecha),d.dte||'',d.serie||'',d.nit||'CF',d.nombre||'—',Q(d.signo*d.total)];
      const colStyles={0:{cellWidth:20},1:{cellWidth:mitad*0.16},2:{cellWidth:mitad*0.12},5:{halign:'right'}};

      doc.autoTable({
        head:[[{content:`COMPRAS — Mes: ${nombreMes}`,colSpan:6,styles:{halign:'center',fillColor:VERDE}}],
          ['Día','No. Doc.','Serie','NIT','Proveedor','Monto']],
        body: compras.length ? compras.map(filaCompra).concat([[{content:'Total',colSpan:5,styles:{fontStyle:'bold',textColor:VERDE}},
          {content:Q(totalCompras),styles:{fontStyle:'bold',halign:'right',textColor:VERDE}}]])
          : [[{content:'Sin compras este mes',colSpan:6,styles:{halign:'center',textColor:[150,150,150]}}]],
        startY:alto, margin:{left:xCompras,bottom:42}, tableWidth:mitad,
        styles:{fontSize:7,cellPadding:3,lineColor:[200,200,200],lineWidth:.3}, headStyles:{fillColor:VERDE,fontSize:7},
        columnStyles:colStyles});
      const finCompras=doc.lastAutoTable.finalY;

      doc.autoTable({
        head:[[{content:`VENTAS — Mes: ${nombreMes}`,colSpan:6,styles:{halign:'center',fillColor:VERDE}}],
          ['Día','No. Factura','Serie','NIT','Comprador','Monto']],
        body: ventas.length ? ventas.map(filaVenta).concat([[{content:'Total',colSpan:5,styles:{fontStyle:'bold',textColor:VERDE}},
          {content:Q(totalVentas),styles:{fontStyle:'bold',halign:'right',textColor:VERDE}}]])
          : [[{content:'Sin ventas este mes',colSpan:6,styles:{halign:'center',textColor:[150,150,150]}}]],
        startY:alto, margin:{left:xVentas,bottom:42}, tableWidth:mitad,
        styles:{fontSize:7,cellPadding:3,lineColor:[200,200,200],lineWidth:.3}, headStyles:{fillColor:VERDE,fontSize:7},
        columnStyles:colStyles});
      const finVentas=doc.lastAutoTable.finalY;

      let y=Math.max(finCompras,finVentas)+28;
      if(y>doc.internal.pageSize.getHeight()-60) y=doc.internal.pageSize.getHeight()-60;
      doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...VERDE);
      doc.text('Determinación del Impuesto',40,y);
      doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(60,60,60);
      doc.text(`Total de Ventas: Q${Q(totalVentas)}     ·     Impuesto (5%): Q${Q(impuesto)}`,40,y+16);
    });

    const folioInicial=1;
    const hojas=pieDePagina(doc,folioInicial);
    doc.save(`Libro-PequenoContribuyente-${archivoSeguro(e.nombre)}.pdf`);
    avisarDatosIncompletos();
  }catch(err){
    avisar('No se pudo generar el PDF: '+err.message+'\n\nEl generador se descarga de internet la primera vez, así que necesitás conexión.');
  }
};

/* Cuerpo de la tabla PDF de un libro de compras o ventas, por mes, con subtotales. */
function cuerpoPdfLibroCV(docs,cols){
  const L=libroPorMes(docs,cols), body=[];
  const n=4+cols.length;
  L.meses.forEach(M=>{
    body.push([{content:nombreMes(M.mes),colSpan:n,styles:{fillColor:CREMA,textColor:VERDE,fontStyle:'bold'}}]);
    M.docs.forEach(({d,x})=>body.push([fFecha(d.fecha),`${d.tipoDte||'FACT'} ${d.serie||''}${d.dte?'-'+d.dte:''}`,d.nit||'CF',d.nombre||'—',...cols.map(([k])=>x[k]?Q(x[k]):'—')]));
    body.push([{content:`Total ${nombreMes(M.mes)}`,colSpan:4,styles:{fontStyle:'italic'}},...cols.map(([k])=>({content:Q(M.tot[k]),styles:{fontStyle:'italic',halign:'right'}}))]);
  });
  body.push([{content:'Totales',colSpan:4,styles:{fontStyle:'bold',textColor:VERDE}},...cols.map(([k])=>({content:Q(L.gen[k]),styles:{fontStyle:'bold',halign:'right',textColor:VERDE}}))]);
  const columnStyles={}; cols.forEach((_,i)=>columnStyles[4+i]={halign:'right'});
  return {body,columnStyles};
}

ACCIONES.pdfLibroVentas=async()=>{
  const e=emp();
  const ventas=(e.documentos||[]).filter(d=>d.tipo==='venta'&&{general:1,simplificado:1}[regimenEn(e,d.fecha)]).sort((a,b)=>a.fecha.localeCompare(b.fecha));
  if(!ventas.length){avisar('No hay ventas registradas en este régimen todavía.');return}
  const alto=altoEncabezado();
  try{
    const jsPDF=await cargarJsPDF();
    const doc=new jsPDF({unit:'pt',format:'letter',orientation:'landscape'});
    const {body,columnStyles}=cuerpoPdfLibroCV(ventas,COLS_VENTAS);
    doc.autoTable({head:[['Fecha','Documento','NIT','Cliente',...COLS_VENTAS.map(([,t])=>t)]],body,
      startY:alto, margin:{top:alto,left:40,right:40,bottom:42},
      styles:{fontSize:7.5,cellPadding:3.5,lineColor:[225,222,212],lineWidth:.3}, headStyles:{fillColor:VERDE,fontSize:7.5},
      columnStyles,
      didDrawPage:()=>encabezadoPDF(doc,'Libro de Ventas','Ventas y servicios prestados — por mes · cifras en quetzales')});
    pieDePagina(doc,1);
    doc.save(`Libro-Ventas-${archivoSeguro(e.nombre)}.pdf`);
    avisarDatosIncompletos();
  }catch(err){
    avisar('No se pudo generar el PDF: '+err.message+'\n\nEl generador se descarga de internet la primera vez, así que necesitás conexión.');
  }
};

ACCIONES.pdfLibroCompras=async()=>{
  const e=emp();
  const compras=(e.documentos||[]).filter(d=>d.tipo==='compra'&&{general:1,simplificado:1}[regimenEn(e,d.fecha)]).sort((a,b)=>a.fecha.localeCompare(b.fecha));
  if(!compras.length){avisar('No hay compras registradas en este régimen todavía.');return}
  const alto=altoEncabezado();
  try{
    const jsPDF=await cargarJsPDF();
    const doc=new jsPDF({unit:'pt',format:'letter',orientation:'landscape'});
    const {body,columnStyles}=cuerpoPdfLibroCV(compras,COLS_COMPRAS);
    doc.autoTable({head:[['Fecha','Documento','NIT','Proveedor',...COLS_COMPRAS.map(([,t])=>t)]],body,
      startY:alto, margin:{top:alto,left:40,right:40,bottom:42},
      styles:{fontSize:6.8,cellPadding:3,lineColor:[225,222,212],lineWidth:.3}, headStyles:{fillColor:VERDE,fontSize:6.8},
      columnStyles,
      didDrawPage:()=>encabezadoPDF(doc,'Libro de Compras','Compras y servicios recibidos — por mes · cifras en quetzales')});
    pieDePagina(doc,1);
    doc.save(`Libro-Compras-${archivoSeguro(e.nombre)}.pdf`);
    avisarDatosIncompletos();
  }catch(err){
    avisar('No se pudo generar el PDF: '+err.message+'\n\nEl generador se descarga de internet la primera vez, así que necesitás conexión.');
  }
};

ACCIONES.pdfGastosNoDeducibles=async d=>{
  const e=emp();
  const desde=d.desde, hasta=d.hasta;
  /* Documentos reales de "Cargar Facturas" clasificados como gasto no
     deducible — cada uno ya trae su base y su IVA separados (ver la
     clasificación en cargarFacturas), así que no hace falta recalcular
     nada acá, solo listarlos. */
  const docs=(e.documentos||[]).filter(x=>x.cta==='6.2.14'&&(!desde||x.fecha>=desde)&&(!hasta||x.fecha<=hasta))
    .sort((a,b)=>a.fecha.localeCompare(b.fecha));
  if(!docs.length){avisar('No hay facturas marcadas como gasto no deducible en este período.');return}
  const alto=altoEncabezado();
  try{
    const jsPDF=await cargarJsPDF();
    const doc=new jsPDF({unit:'pt',format:'letter',orientation:'landscape'});
    const tb=r2(docs.reduce((s,x)=>s+x.base,0)), ti=r2(docs.reduce((s,x)=>s+x.iva,0)), tt=r2(docs.reduce((s,x)=>s+x.total,0));
    const fila=x=>[fFecha(x.fecha),`${x.tipoDte||'FACT'} ${x.serie||''}${x.dte?'-'+x.dte:''}`,x.nit||'—',x.nombre||'—',
      Q(x.base),Q(x.iva),Q(x.total)];
    doc.autoTable({head:[['Fecha','Documento','NIT','Proveedor','Gasto no deducible (6.2.14)','IVA no deducible (6.2.27)','Total de la factura']],
      body:docs.map(fila).concat([[{content:'Totales',colSpan:4,styles:{fontStyle:'bold',textColor:VERDE}},
        {content:Q(tb),styles:{fontStyle:'bold',halign:'right',textColor:VERDE}},
        {content:Q(ti),styles:{fontStyle:'bold',halign:'right',textColor:VERDE}},
        {content:Q(tt),styles:{fontStyle:'bold',halign:'right',textColor:VERDE}}]]),
      startY:alto, margin:{top:alto,left:40,right:40,bottom:42},
      styles:{fontSize:8,cellPadding:4,lineColor:[225,222,212],lineWidth:.3}, headStyles:{fillColor:VERDE,fontSize:8},
      columnStyles:{4:{halign:'right'},5:{halign:'right'},6:{halign:'right'}},
      didDrawPage:()=>encabezadoPDF(doc,'Gastos no deducibles',
        `Facturas marcadas como gasto no deducible para ISR, con su IVA no acreditable · ${fFecha(desde)} al ${fFecha(hasta)} · cifras en quetzales`)});
    const folioInicial=1;
    const hojas=pieDePagina(doc,folioInicial);
    doc.save(`Gastos-no-deducibles-${archivoSeguro(e.nombre)}.pdf`);
  }catch(err){
    avisar('No se pudo generar el PDF: '+err.message+'\n\nEl generador se descarga de internet la primera vez, así que necesitás conexión.');
  }
};

ACCIONES.pdfCostosGastosPeriodo=async d=>{
  const e=emp();
  const itemizado=itemizadoCostosGastos(e,d.desde,d.hasta);
  if(!itemizado.length){avisar('No hay costos ni gastos registrados en este período.');return}
  const alto=altoEncabezado();
  try{
    const jsPDF=await cargarJsPDF();
    const doc=new jsPDF({unit:'pt',format:'letter'});
    const totalDeducible=r2(itemizado.filter(f=>f.deducible).reduce((s,f)=>s+f.monto,0));
    const totalNoDeducible=r2(itemizado.filter(f=>!f.deducible).reduce((s,f)=>s+f.monto,0));
    const fila=f=>[f.cuenta?`${f.cuenta} — ${f.nombre}`:f.nombre,Q(f.monto),f.deducible?'Sí':'No'];
    doc.autoTable({head:[['Cuenta','Monto','¿Deducible?']],
      body:itemizado.map(fila).concat([
        [{content:'Total deducible',colSpan:2,styles:{fontStyle:'bold'}},{content:'Sí',styles:{fontStyle:'bold'}}],
        [{content:Q(totalDeducible),colSpan:3,styles:{fontStyle:'bold',halign:'right'}}],
        [{content:'Total no deducible',colSpan:2,styles:{fontStyle:'bold',textColor:[176,58,46]}},{content:'No',styles:{fontStyle:'bold',textColor:[176,58,46]}}],
        [{content:Q(totalNoDeducible),colSpan:3,styles:{fontStyle:'bold',halign:'right',textColor:[176,58,46]}}],
        [{content:'Total de costos y gastos',colSpan:3,styles:{fontStyle:'bold',textColor:VERDE}}],
        [{content:Q(r2(totalDeducible+totalNoDeducible)),colSpan:3,styles:{fontStyle:'bold',halign:'right',textColor:VERDE}}],
      ]),
      startY:alto, margin:{top:alto,left:40,right:40,bottom:42},
      styles:{fontSize:9,cellPadding:5,lineColor:[225,222,212],lineWidth:.3}, headStyles:{fillColor:VERDE,fontSize:9},
      columnStyles:{1:{halign:'right'}},
      didDrawPage:()=>encabezadoPDF(doc,'Costos y gastos, deducibles y no deducibles',
        `Del ${fFecha(d.desde)} al ${fFecha(d.hasta)}${d.trimestre?` · para el cierre fiscal parcial del trimestre ${d.trimestre}`:''} · cifras en quetzales`)});
    const folioInicial=1;
    const hojas=pieDePagina(doc,folioInicial);
    doc.save(`Costos-y-gastos-${archivoSeguro(e.nombre)}-al-${d.hasta}.pdf`);
  }catch(err){
    avisar('No se pudo generar el PDF: '+err.message+'\n\nEl generador se descarga de internet la primera vez, así que necesitás conexión.');
  }
};

ACCIONES.pdfPlanilla=async d=>{
  const e=emp(), p=e.planillas.find(x=>x.id===d.id);
  if(!p){avisar('No se encontró esa planilla.');return}
  const alto=altoEncabezado();
  try{
    const jsPDF=await cargarJsPDF();
    const doc=new jsPDF({unit:'pt',format:'letter',orientation:'landscape'});
    const body=p.detalle.map(f=>{
      const descuentos=r2((f.descuentoFaltas||0)+(f.descuentoHorasMenos||0)+(f.descuentoBonif||0));
      const horasExtraTotal=r2((f.montoHorasExtra||0)+(f.montoHorasExtraDomingo||0));
      return [f.nombre, Q(f.salarioPeriodo), Q(f.bonifPeriodo),
        horasExtraTotal?Q(horasExtraTotal):'—', f.bonoAdicional?Q(f.bonoAdicional):'—',
        descuentos?'−'+Q(descuentos):'—', Q(f.igssLaboral), f.isr?Q(f.isr):'—',
        {content:Q(f.liquido),styles:{fontStyle:'bold'}}, ''];
    });
    body.push([{content:'Totales',colSpan:8,styles:{fontStyle:'bold',textColor:VERDE}},
      {content:Q(p.totales.liquido),styles:{fontStyle:'bold',halign:'right',textColor:VERDE}},
      '']);
    doc.autoTable({
      head:[['Empleado','Salario','Bonif. Q250','Horas extra','Bono adic.','Descuentos',
        'IGSS laboral','ISR','Líquido a pagar','Firma de recibido']],
      body, startY:alto,
      margin:{top:alto,left:40,right:40,bottom:42},
      styles:{fontSize:9,cellPadding:8,lineColor:[225,222,212],lineWidth:.3,minCellHeight:40,valign:'middle'},
      headStyles:{fillColor:VERDE,fontSize:8.5,minCellHeight:22},
      columnStyles:{
        0:{cellWidth:118},
        1:{halign:'right'},2:{halign:'right'},3:{halign:'right'},4:{halign:'right'},
        5:{halign:'right'},6:{halign:'right'},7:{halign:'right'},8:{halign:'right'},
        9:{cellWidth:160}
      },
      didDrawPage:()=>encabezadoPDF(doc,'Planilla de sueldos',
        `${p.periodo[0].toUpperCase()+p.periodo.slice(1)}   ·   del ${fFecha(p.desde)} al ${fFecha(p.hasta)}   ·   pago el ${fFecha(p.fechaPago)}`)
    });
    pieDePagina(doc);
    doc.save(`Planilla-${p.periodo}-${archivoSeguro(e.nombre)}-${p.fechaPago}.pdf`);
    avisarDatosIncompletos();
  }catch(err){
    avisar('No se pudo generar el PDF: '+err.message+'\n\nEl generador se descarga de internet la primera vez, así que necesitás conexión.');
  }
};

ACCIONES.pdfPagoPrestacion=async d=>{
  const e=emp(), p=e.pagosPrestaciones.find(x=>x.id===d.id);
  if(!p){avisar('No se encontró ese pago.');return}
  const info=PRESTACION_INFO[p.tipo];
  const alto=altoEncabezado();
  try{
    const jsPDF=await cargarJsPDF();
    const doc=new jsPDF({unit:'pt',format:'letter',orientation:'landscape'});
    const body=p.detalle.map(f=>[f.nombre, Q(f.monto), '']);
    body.push([{content:'Total',styles:{fontStyle:'bold',textColor:VERDE}},
      {content:Q(p.total),styles:{fontStyle:'bold',halign:'right',textColor:VERDE}}, '']);
    doc.autoTable({
      head:[['Empleado', `${info.nombre} a pagar`, 'Firma de recibido']],
      body, startY:alto,
      margin:{top:alto,left:40,right:40,bottom:42},
      styles:{fontSize:10,cellPadding:10,lineColor:[225,222,212],lineWidth:.3,minCellHeight:44,valign:'middle'},
      headStyles:{fillColor:VERDE,fontSize:9,minCellHeight:22},
      columnStyles:{0:{cellWidth:220},1:{halign:'right',cellWidth:160},2:{cellWidth:220}},
      didDrawPage:()=>encabezadoPDF(doc,`Pago de ${info.nombre}`,
        `Provisionado del ${fFecha(p.desde)} al ${fFecha(p.hasta)}   ·   pagado el ${fFecha(p.fechaPago)}`)
    });
    pieDePagina(doc);
    doc.save(`Pago-${p.tipo}-${archivoSeguro(e.nombre)}-${p.fechaPago}.pdf`);
    avisarDatosIncompletos();
  }catch(err){
    avisar('No se pudo generar el PDF: '+err.message+'\n\nEl generador se descarga de internet la primera vez, así que necesitás conexión.');
  }
};

ACCIONES.pdfEstadoCuenta=async d=>{
  const e=emp(), tipo=d.tipoCuenta;
  const cartera = tipo==='proveedor' ? carteraProveedores(e) : carteraClientes(e);
  const x=cartera.find(c=>c.nit===d.nit);
  if(!x){avisar('No se encontró información de esta cuenta.');return}
  const movs=movimientosCuenta(e,d.nit,tipo);
  if(!movs.length){avisar('No hay movimientos para imprimir.');return}
  const alto=altoEncabezado();
  try{
    const jsPDF=await cargarJsPDF();
    const doc=new jsPDF({unit:'pt',format:'letter'});
    let saldo=0;
    const body=movs.map(m=>{
      saldo=r2(saldo+m.monto);
      return [fFecha(m.fecha),m.concepto,
        m.monto>0?Q(m.monto):'', m.monto<0?Q(-m.monto):'', Q(saldo)];
    });
    doc.autoTable({
      head:[['Fecha','Concepto','Cargo','Abono','Saldo']], body, startY:alto,
      margin:{top:alto,left:40,right:40,bottom:42},
      styles:{fontSize:8,cellPadding:3.5,lineColor:[225,222,212],lineWidth:.3},
      headStyles:{fillColor:VERDE,fontSize:8},
      columnStyles:{2:{halign:'right',cellWidth:80},3:{halign:'right',cellWidth:80},4:{halign:'right',cellWidth:80}},
      didDrawPage:()=>encabezadoPDF(doc,`Estado de cuenta — ${tipo==='proveedor'?'Proveedor':'Cliente'}`,
        `${x.nombre||d.nit}   ·   NIT ${d.nit}   ·   Saldo pendiente Q${Q(x.saldo)}`)
    });
    pieDePagina(doc);
    doc.save(`Estado-de-cuenta-${archivoSeguro(x.nombre||d.nit)}.pdf`);
  }catch(err){
    avisar('No se pudo generar el PDF: '+err.message+'\n\nEl generador se descarga de internet la primera vez, así que necesitás conexión.');
  }
};

