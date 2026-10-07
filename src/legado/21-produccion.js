/* ============ PRODUCCIÓN: COSTO DE LO QUE SE FABRICA ============ */
/* Hay varias formas válidas de costear lo que se fabrica, y cada empresa usa la suya; la ley (Art. 41,
   Dto. 10-2012) pide valuar al "costo de producción" y que el método se mantenga. Por eso el
   administrador ELIGE, y el sistema aplica esa y no otra:
   · Por órdenes: cada trabajo o lote lleva su propia hoja de costos (materiales, mano de obra y costos
     indirectos reales); el costo unitario es el costo de la orden entre las unidades terminadas.
   · Proceso continuo: se produce en serie y se costea por período, en unidades equivalentes con promedio
     ponderado — lo que queda a medio hacer se valúa según su % de avance, y pasa al período siguiente.
   · Costo estándar: se fija de antemano un costo por unidad; lo terminado entra al inventario a ese
     costo y la diferencia contra lo realmente gastado queda como variación (materiales, mano de obra e
     indirectos), a resultados.
   Contabilidad (sistema periódico, como el resto del inventario):
   · materiales a la orden:  Productos en proceso (1.1.18) contra Inventarios (1.1.08)
   · mano de obra y CIF:     Productos en proceso contra el gasto donde ya estaban (sueldos, energía…)
   · orden terminada:        Inventarios (1.1.08, producto terminado) contra Productos en proceso
   Así el costo de lo fabricado entra a la fórmula del costo de ventas (inventario inicial + compras y
   producción − inventario final) sin duplicar nada, y el kardex ya ve el producto terminado. */
const METODOS_PRODUCCION={
  ordenes:{nombre:'Por órdenes de producción',corto:'Por órdenes',
    texto:'Cada trabajo, pedido o lote tiene su hoja de costos. Ideal si fabricás sobre pedido o por lotes distintos entre sí.'},
  continuo:{nombre:'Proceso continuo (unidades equivalentes)',corto:'Proceso continuo',
    texto:'Producción en serie de productos iguales. Se costea por período; lo que queda a medio hacer se valúa según su avance. Promedio ponderado.'},
  estandar:{nombre:'Costo estándar',corto:'Costo estándar',
    texto:'Fijás un costo por unidad. Lo terminado entra a ese costo y las diferencias contra lo real se muestran como variaciones.'}};
const VARIACIONES_ESTANDAR=[['mat','5.1.05','Variación de materiales (costo estándar)'],['mod','5.1.06','Variación de mano de obra (costo estándar)'],['cif','5.1.07','Variación de costos indirectos (costo estándar)']];
let ordenProdActual=null;
const anioCerradoLibros=(e,fecha)=>(e.partidas||[]).some(p=>(p.concepto||'').startsWith(PREFIJO_CIERRE_LIBROS+fecha.slice(0,4)));
const metodoProduccion=e=>(e&&METODOS_PRODUCCION[e.metodoProduccion])?e.metodoProduccion:'';
const sumaOrden=(o,k)=>r2((o[k]||[]).reduce((s,x)=>s+(x.monto!==undefined?x.monto:x.costoTotal||0),0));
function totalesOrden(o){
  const mat=sumaOrden(o,'materiales'), mod=sumaOrden(o,'manoObra'), cif=sumaOrden(o,'cif');
  return {mat,mod,cif,total:r2(mat+mod+cif)};
}
function inicialProcesoContinuo(e,producto){
  const prev=(e.ordenesProduccion||[]).filter(o=>o.tipo==='continuo'&&o.producto===producto&&o.estado==='cerrada'&&o.wipFinal)
    .sort((a,b)=>(a.fechaCierre||'').localeCompare(b.fechaCierre||'')||a.numero-b.numero).pop();
  return prev?prev.wipFinal:{unidades:0,mat:0,conv:0,avMat:0,avConv:0};
}
/* Unidades equivalentes, promedio ponderado. Lo que no se transfiere queda en proceso, de modo que
   (inicial + costos del período) = (transferido + en proceso al final), siempre. */
function costeoContinuo(o,T,W,pm,pc){
  const t=totalesOrden(o), ini=o.inicial||{mat:0,conv:0};
  const matTot=r2(ini.mat+t.mat), convTot=r2(ini.conv+t.mod+t.cif);
  const euM=T+W*pm/100, euC=T+W*pc/100;
  const cuM=euM>0?matTot/euM:0, cuC=euC>0?convTot/euC:0;
  const transferido=r2(T*(cuM+cuC));
  const enProceso=r2(matTot+convTot-transferido);
  const wipMat=r2(Math.min(enProceso,W*pm/100*cuM));
  return {euM,euC,cuM,cuC,transferido,enProceso,wipMat,wipConv:r2(enProceso-wipMat),costoUnitario:T>0?transferido/T:0,matTot,convTot};
}
function varianzasEstandar(e,o,T){
  const std=(e.costosEstandar||{})[o.producto]||{mat:0,mod:0,cif:0}, t=totalesOrden(o);
  const est={mat:r2(T*std.mat),mod:r2(T*std.mod),cif:r2(T*std.cif)};
  return {est,estTotal:r2(est.mat+est.mod+est.cif),
    var:{mat:r2(t.mat-est.mat),mod:r2(t.mod-est.mod),cif:r2(t.cif-est.cif)}};
}
function productosConocidos(e){
  const s=new Set(inventarioDetalle(e).lista.map(p=>p.producto));
  (e.ordenesProduccion||[]).forEach(o=>s.add(o.producto));
  return [...s].sort();
}

function vistaProduccion(){
  const e=emp(); e.ordenesProduccion=e.ordenesProduccion||[];
  const m=metodoProduccion(e);
  if(!m){
    return cab('Producción','Costo de lo que fabricás: elegí cómo lo vas a calcular.')
    + `<div class="tarjeta"><h3>¿Cómo se costea la producción de ${esc(e.nombre)}?</h3>
        <p style="font-size:13px;color:var(--tinta-suave)">Hay varias formas válidas. Elegí la que usa la empresa: una vez que se empieza a producir, el método se mantiene (cambiarlo requiere que no haya órdenes abiertas y queda en la bitácora).</p>
        ${Object.entries(METODOS_PRODUCCION).map(([k,v])=>`<div style="margin:10px 0;padding:10px 12px;border:1px solid var(--linea);border-radius:6px">
          <strong>${v.nombre}</strong><div style="font-size:13px;color:var(--tinta-suave);margin:4px 0 8px">${v.texto}</div>
          <button class="btn mini" data-accion="elegirMetodoProduccion" data-metodo="${k}">Usar este método</button></div>`).join('')}
      </div>`;
  }
  if(ordenProdActual){ const o=e.ordenesProduccion.find(x=>x.id===ordenProdActual); if(o) return vistaOrdenProduccion(e,o); ordenProdActual=null; }
  const mov=movimientos(null,null);
  const wip=saldoNatural('1.1.18',mov);
  const lista=[...e.ordenesProduccion].sort((a,b)=>b.numero-a.numero);
  const etiqueta=m==='continuo'?'Corrida':'Orden';
  const filas=lista.map(o=>{const t=totalesOrden(o); return `<tr><td>${etiqueta} ${o.numero}</td><td>${esc(o.producto)}</td><td>${fFecha(o.fechaInicio)}</td>
    <td>${o.estado==='cerrada'?`Cerrada ${fFecha(o.fechaCierre)}`:'<span style="color:var(--alerta)">Abierta</span>'}</td>
    <td class="num">${Q(t.mat)}</td><td class="num">${Q(t.mod+t.cif)}</td><td class="num">${Q(t.total)}</td>
    <td class="num">${o.estado==='cerrada'&&o.cantidadTerminada?`${Q(o.cantidadTerminada)} u. a Q${Q(o.costoUnitario)}`:'—'}</td>
    <td class="num"><button class="btn mini" data-accion="abrirOrdenProduccion" data-id="${o.id}">Abrir</button></td></tr>`;}).join('');
  return cab('Producción',`Método de costeo: ${METODOS_PRODUCCION[m].nombre}`,
    `${m==='estandar'?'<button class="btn sec" data-accion="costosEstandar">Costos estándar</button>':''}
     <button class="btn sec" data-accion="cambiarMetodoProduccion">Cambiar método</button>
     <button class="btn" data-accion="nuevaOrdenProduccion">${m==='continuo'?'Nueva corrida (período)':'Nueva orden'}</button>`)
  + `<div class="cifras">
      <div class="cifra"><span>Productos en proceso (en libros)</span><strong>${Q(wip)}</strong></div>
      <div class="cifra"><span>${etiqueta}s abiertas</span><strong>${lista.filter(o=>o.estado==='abierta').length}</strong></div>
      <div class="cifra"><span>${etiqueta}s cerradas</span><strong>${lista.filter(o=>o.estado==='cerrada').length}</strong></div>
    </div>`
  + (lista.length?`<table><thead><tr><th></th><th>Producto</th><th>Inicio</th><th>Estado</th><th class="num">Materiales</th><th class="num">Mano de obra y CIF</th><th class="num">Costo total</th><th class="num">Terminado</th><th></th></tr></thead><tbody>${filas}</tbody></table>`
    :`<div class="vacio">Todavía no hay ${etiqueta.toLowerCase()}s. Creá la primera con el botón de arriba.</div>`)
  + `<div class="aviso">El producto terminado entra al inventario (cuenta 1.1.08) y al kardex a su costo de producción; lo que está a medio hacer se muestra en "Productos en proceso". Los materiales salen del inventario al costo del método que tiene la empresa (promedio o PEPS). La mano de obra y los costos indirectos que se aplican acá se pasan desde los gastos donde ya estaban registrados, sin duplicarlos.</div>`;
}
VISTAS.produccion=vistaProduccion;

function vistaOrdenProduccion(e,o){
  const m=o.tipo, t=totalesOrden(o), abierta=o.estado==='abierta', etiqueta=m==='continuo'?'Corrida':'Orden';
  const tabla=(titulo,lista,cols,filaFn)=>`<h3 style="color:var(--verde);margin:18px 0 6px;font-size:15px">${titulo}</h3>`
    +(lista.length?`<table style="font-size:13px"><thead><tr>${cols.map((c,i)=>`<th${i===cols.length-1?' class="num"':''}>${c}</th>`).join('')}</tr></thead><tbody>${lista.map(filaFn).join('')}</tbody></table>`
      :`<div class="vacio" style="padding:10px">Sin registros todavía.</div>`);
  const ini=o.inicial&&(o.inicial.unidades>0||o.inicial.mat>0||o.inicial.conv>0)?o.inicial:null;
  return cab(`${etiqueta} ${o.numero} — ${esc(o.producto)}`,`${METODOS_PRODUCCION[m].nombre} · inicio ${fFecha(o.fechaInicio)}${o.nota?' · '+esc(o.nota):''}`,
    `<button class="btn sec" data-accion="volverProduccion">Volver</button>
     <button class="btn sec" data-accion="pdfOrdenProduccion" data-id="${o.id}">Hoja de costos PDF</button>
     ${abierta?`<button class="btn peligro" data-accion="anularOrdenProduccion" data-id="${o.id}">Anular</button>
       <button class="btn" data-accion="cerrarOrdenProduccion" data-id="${o.id}">Cerrar y pasar a inventario</button>`:''}`)
  + `<div class="cifras">
      <div class="cifra"><span>Materiales</span><strong>${Q(t.mat)}</strong></div>
      <div class="cifra"><span>Mano de obra</span><strong>${Q(t.mod)}</strong></div>
      <div class="cifra"><span>Costos indirectos</span><strong>${Q(t.cif)}</strong></div>
      <div class="cifra"><span>Total del período</span><strong>${Q(t.total)}</strong></div>
    </div>`
  + (ini?`<div class="aviso">Viene con producción en proceso del período anterior: ${ini.unidades} u., materiales Q${Q(ini.mat)} y conversión Q${Q(ini.conv)}.</div>`:'')
  + (abierta?`<p style="margin:12px 0"><button class="btn mini" data-accion="materialOrdenProduccion" data-id="${o.id}">Agregar materiales</button>
      <button class="btn mini" data-accion="costoOrdenProduccion" data-id="${o.id}" data-clase="manoObra">Agregar mano de obra</button>
      <button class="btn mini" data-accion="costoOrdenProduccion" data-id="${o.id}" data-clase="cif">Agregar costos indirectos</button></p>`:'')
  + tabla('Materiales usados',o.materiales||[],['Fecha','Material','Cantidad','Costo unitario','Costo'],x=>`<tr><td>${fFecha(x.fecha)}</td><td>${esc(x.producto)}</td><td class="num">${x.cantidad}</td><td class="num">${Q(x.costoUnitario)}</td><td class="num">${Q(x.costoTotal)}</td></tr>`)
  + tabla('Mano de obra directa',o.manoObra||[],['Fecha','Detalle','Pasada desde','Monto'],x=>`<tr><td>${fFecha(x.fecha)}</td><td>${esc(x.descripcion||'')}</td><td>${esc(x.origen||'')}</td><td class="num">${Q(x.monto)}</td></tr>`)
  + tabla('Costos indirectos de fabricación',o.cif||[],['Fecha','Detalle','Pasada desde','Monto'],x=>`<tr><td>${fFecha(x.fecha)}</td><td>${esc(x.descripcion||'')}</td><td>${esc(x.origen||'')}</td><td class="num">${Q(x.monto)}</td></tr>`)
  + (o.estado==='cerrada'?`<div class="aviso" style="margin-top:16px"><strong>Cerrada el ${fFecha(o.fechaCierre)}.</strong>
      ${o.cantidadTerminada} u. terminadas, ${m==='estandar'?`al costo estándar de Q${Q(o.costoUnitario)} c/u (costo real de la orden Q${Q(t.total)})`:`Q${Q(o.costoTerminado)} a Q${Q(o.costoUnitario)} c/u`}.
      ${o.wipFinal&&o.wipFinal.unidades>0?` En proceso: ${o.wipFinal.unidades} u. (Q${Q(r2(o.wipFinal.mat+o.wipFinal.conv))}).`:''}
      ${o.variaciones?` Variaciones: materiales Q${Q(o.variaciones.mat)}, mano de obra Q${Q(o.variaciones.mod)}, indirectos Q${Q(o.variaciones.cif)} (positivo = gastó más que el estándar).`:''}
      Partida No. ${o.partidaCierreNumero}.</div>`:'');
}

ACCIONES.elegirMetodoProduccion=d=>{
  const e=emp(); if(!METODOS_PRODUCCION[d.metodo]) return;
  e.metodoProduccion=d.metodo;
  registrarLog('Eligió el método de costeo de producción',`${e.nombre} — ${METODOS_PRODUCCION[d.metodo].nombre}`);
  guardar(); pintar();
};
ACCIONES.cambiarMetodoProduccion=()=>{
  const e=emp();
  if((e.ordenesProduccion||[]).some(o=>o.estado==='abierta')){avisar('Hay órdenes abiertas: cerrá o anulá todas antes de cambiar el método de costeo.');return}
  abrirModal('Cambiar el método de costeo',
    `<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">Método actual: <strong>${METODOS_PRODUCCION[metodoProduccion(e)].nombre}</strong>. Cambiarlo mezcla criterios dentro del mismo ejercicio: lo ya cerrado no se recalcula. Si la empresa ya declaró un método ante la SAT, el cambio puede requerir autorización.</p>
    <div class="campo full"><label>Nuevo método</label><select name="metodo">${Object.entries(METODOS_PRODUCCION).map(([k,v])=>`<option value="${k}"${k===metodoProduccion(e)?' selected':''}>${v.nombre}</option>`).join('')}</select></div>`,
    d=>{
      if(d.metodo===metodoProduccion(e)){avisar('Ese ya es el método actual.');return false}
      e.metodoProduccion=d.metodo; ordenProdActual=null;
      registrarLog('Cambió el método de costeo de producción',`${e.nombre} — ahora ${METODOS_PRODUCCION[d.metodo].nombre}`);
      guardar(); pintar();
    },'Cambiar método');
};
ACCIONES.volverProduccion=()=>{ordenProdActual=null;pintar()};
ACCIONES.abrirOrdenProduccion=d=>{ordenProdActual=d.id;pintar()};

ACCIONES.costosEstandar=()=>{
  const e=emp(); e.costosEstandar=e.costosEstandar||{};
  const filas=Object.entries(e.costosEstandar).map(([p,c])=>`<tr><td>${esc(p)}</td><td class="num">${Q(c.mat)}</td><td class="num">${Q(c.mod)}</td><td class="num">${Q(c.cif)}</td><td class="num">${Q(r2(c.mat+c.mod+c.cif))}</td></tr>`).join('');
  abrirModal('Costos estándar por unidad',
    `<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">Fijá cuánto debería costar fabricar UNA unidad. Si el producto ya tiene estándar, se reemplaza para lo que se cierre de aquí en adelante.</p>
    ${filas?`<table style="font-size:13px;margin-bottom:12px"><thead><tr><th>Producto</th><th class="num">Materiales</th><th class="num">Mano de obra</th><th class="num">Indirectos</th><th class="num">Total</th></tr></thead><tbody>${filas}</tbody></table>`:''}
    <div class="rej">
      <div class="campo full"><label>Producto terminado</label><input name="producto" list="dlProd" placeholder="Nombre exacto del producto"><datalist id="dlProd">${productosConocidos(e).map(p=>`<option value="${esc(p)}">`).join('')}</datalist></div>
      <div class="campo"><label>Materiales por unidad</label><input name="mat" type="number" step="0.0001" min="0" value="0"></div>
      <div class="campo"><label>Mano de obra por unidad</label><input name="mod" type="number" step="0.0001" min="0" value="0"></div>
      <div class="campo"><label>Indirectos por unidad</label><input name="cif" type="number" step="0.0001" min="0" value="0"></div>
    </div>`,
    d=>{
      const p=(d.producto||'').trim(); if(!p){avisar('Escribí el producto.');return false}
      const c={mat:+d.mat||0,mod:+d.mod||0,cif:+d.cif||0};
      if(c.mat+c.mod+c.cif<=0){avisar('El costo estándar tiene que ser mayor que cero.');return false}
      e.costosEstandar[p]=c; registrarLog('Fijó un costo estándar',`${p} — Q${Q(r2(c.mat+c.mod+c.cif))} por unidad`);
      guardar(); pintar();
    },'Guardar estándar');
};

ACCIONES.nuevaOrdenProduccion=()=>{
  const e=emp(), m=metodoProduccion(e); if(!m) return;
  const etiqueta=m==='continuo'?'corrida':'orden';
  abrirModal(`Nueva ${etiqueta} de producción`,
    `<div class="rej">
      <div class="campo full"><label>Producto que se fabrica</label><input name="producto" list="dlProd2" placeholder="Nombre del producto terminado"><datalist id="dlProd2">${productosConocidos(e).map(p=>`<option value="${esc(p)}">`).join('')}</datalist></div>
      <div class="campo"><label>${m==='continuo'?'Inicio del período':'Fecha de inicio'}</label><input name="fecha" type="date" value="${hoy()}"></div>
      <div class="campo full"><label>Nota (cliente, lote, pedido…)</label><input name="nota" placeholder="Opcional"></div>
    </div>
    ${m==='estandar'?'<div class="aviso">Con costo estándar, el producto tiene que tener su estándar fijado (botón "Costos estándar").</div>':''}`,
    d=>{
      const p=(d.producto||'').trim(); if(!p){avisar('Escribí el producto que se fabrica.');return false}
      if(!d.fecha){avisar('Escribí la fecha de inicio.');return false}
      if(m==='estandar'&&!(e.costosEstandar||{})[p]){avisar('Ese producto no tiene costo estándar. Fijalo primero en "Costos estándar".');return false}
      if(m==='continuo'&&e.ordenesProduccion.some(o=>o.producto===p&&o.estado==='abierta')){avisar('Ese producto ya tiene una corrida abierta: cerrala antes de abrir otra.');return false}
      e.correlativoProd=(e.correlativoProd||0)+1;
      const o={id:uid(),numero:e.correlativoProd,tipo:m,producto:p,fechaInicio:d.fecha,nota:(d.nota||'').trim(),estado:'abierta',
        materiales:[],manoObra:[],cif:[]};
      if(m==='continuo') o.inicial=inicialProcesoContinuo(e,p);
      e.ordenesProduccion.push(o); ordenProdActual=o.id;
      registrarLog('Abrió una orden de producción',`${etiqueta} ${o.numero} — ${p}`);
      guardar(); pintar();
    },`Crear ${etiqueta}`);
};
const ordenAbierta=(e,id)=>{ const o=(e.ordenesProduccion||[]).find(x=>x.id===id); if(!o){avisar('No se encontró esa orden.');return null} if(o.estado!=='abierta'){avisar('Esa orden ya está cerrada.');return null} return o; };

ACCIONES.materialOrdenProduccion=d=>{
  const e=emp(), o=ordenAbierta(e,d.id); if(!o) return;
  const {lista}=inventarioDetalle(e);
  abrirModal('Agregar materiales a la orden',
    `<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">Salen del inventario al costo del método de la empresa (${METODOS_COSTEO[metodoCosteo(e)]}) y pasan a Productos en proceso.</p>
    <div class="rej">
      <div class="campo full"><label>Material</label><select name="material">${lista.filter(p=>p.cantidad>0).map(p=>`<option value="${esc(p.producto)}" data-disp="${p.cantidad}">${esc(p.producto)} — disponible ${p.cantidad}</option>`).join('')}</select></div>
      <div class="campo"><label>Cantidad</label><input name="cantidad" type="number" step="0.01" min="0"></div>
      <div class="campo"><label>Fecha</label><input name="fecha" type="date" value="${hoy()}"></div>
    </div><p id="prevMat" style="margin:8px 0 0;font-size:13px"></p>`,
    async f=>{
      const cantidad=r2(+f.cantidad), prod=f.material;
      if(!prod){avisar('No hay materiales en existencia.');return false}
      if(!(cantidad>0)){avisar('Escribí la cantidad.');return false}
      if(!f.fecha){avisar('Escribí la fecha.');return false}
      if(anioCerradoLibros(e,f.fecha)){avisar('Ese ejercicio ya tiene Cierre de libros.');return false}
      const item=lista.find(x=>x.producto===prod), disp=item?item.cantidad:0;
      if(cantidad>disp){
        const seguir=await preguntar(`Solo hay ${disp} en existencia de ${prod}. ¿Registrar de todos modos?`,'Registrar');
        if(!seguir) return false;
      }
      const {costoUnitario,costoTotal}=costoSalidaInventario(e,prod,cantidad);
      asegurarCuenta(e,'1.1.18','Productos en proceso','activo');
      const p={id:uid(),numero:e.correlativo++,fecha:f.fecha,concepto:`Producción — ${o.tipo==='continuo'?'corrida':'orden'} ${o.numero} — materiales: ${prod}`,
        docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',
        lineas:[{cta:'1.1.18',desc:prod,debe:costoTotal,haber:0},{cta:'1.1.08',desc:prod,debe:0,haber:costoTotal}]};
      e.partidas.push(p);
      e.salidasInventario=e.salidasInventario||[];
      const sid=uid();
      e.salidasInventario.push({id:sid,fecha:f.fecha,producto:prod,cantidad,costoUnitario,costoTotal,motivo:'produccion',ordenId:o.id});
      o.materiales.push({id:uid(),fecha:f.fecha,producto:prod,cantidad,costoUnitario,costoTotal,salidaId:sid,partidaId:p.id,partidaNumero:p.numero});
      registrarLog('Aplicó materiales a producción',`${o.producto} — ${prod} × ${cantidad} — Q${Q(costoTotal)}`);
      guardar(); pintar();
    },'Agregar');
  const act=()=>{const sel=mForm.querySelector('[name="material"]'); const c=+mForm.querySelector('[name="cantidad"]').value||0;
    document.getElementById('prevMat').textContent=sel.value?`Costo que sale del inventario: Q${Q(costoSalidaInventario(e,sel.value,c).costoTotal)}`:'';};
  mForm.querySelector('[name="material"]').onchange=act; mForm.querySelector('[name="cantidad"]').oninput=act; act();
};

ACCIONES.costoOrdenProduccion=d=>{
  const e=emp(), o=ordenAbierta(e,d.id); if(!o) return;
  const clase=d.clase==='cif'?'cif':'manoObra';
  const nombre=clase==='cif'?'costos indirectos de fabricación':'mano de obra directa';
  const gastos=e.cuentas.filter(c=>c.d&&c.t==='gasto');
  const defecto=clase==='manoObra'?(gastos.find(c=>c.c==='6.2.01')||gastos[0]):(gastos.find(c=>c.c==='6.2.07')||gastos.find(c=>c.c!=='6.2.01')||gastos[0]);
  abrirModal(`Agregar ${nombre}`,
    `<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">Esto NO es un gasto nuevo: pasa a Productos en proceso un monto que ya está registrado como gasto (por ejemplo, el sueldo del operario en la planilla). Elegí de cuál cuenta de gasto se traslada, para que no se cuente dos veces.</p>
    <div class="rej">
      <div class="campo full"><label>Se traslada desde la cuenta de gasto</label><select name="origen">${gastos.map(c=>`<option value="${c.c}"${defecto&&c.c===defecto.c?' selected':''}>${c.c} — ${esc(c.n)}</option>`).join('')}</select></div>
      <div class="campo"><label>Monto</label><input name="monto" type="number" step="0.01" min="0"></div>
      <div class="campo"><label>Fecha</label><input name="fecha" type="date" value="${hoy()}"></div>
      <div class="campo full"><label>Detalle</label><input name="descripcion" placeholder="Ej.: operarios de la semana 3"></div>
    </div>`,
    async f=>{
      const monto=r2(+f.monto); if(!(monto>0)){avisar('Escribí el monto.');return false}
      if(!f.fecha){avisar('Escribí la fecha.');return false}
      if(anioCerradoLibros(e,f.fecha)){avisar('Ese ejercicio ya tiene Cierre de libros.');return false}
      const saldo=saldoNatural(f.origen,movimientos(null,f.fecha));
      if(monto>saldo+0.004&&!(await preguntar(`La cuenta ${f.origen} tiene Q${Q(saldo)} a esa fecha; vas a trasladar Q${Q(monto)}. ¿Continuar?`))) return false;
      asegurarCuenta(e,'1.1.18','Productos en proceso','activo');
      const cta=e.cuentas.find(c=>c.c===f.origen);
      const p={id:uid(),numero:e.correlativo++,fecha:f.fecha,concepto:`Producción — ${o.tipo==='continuo'?'corrida':'orden'} ${o.numero} — ${nombre}`,
        docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',
        lineas:[{cta:'1.1.18',desc:(f.descripcion||'').trim(),debe:monto,haber:0},{cta:f.origen,desc:'Traslado a producción',debe:0,haber:monto}]};
      e.partidas.push(p);
      o[clase].push({id:uid(),fecha:f.fecha,descripcion:(f.descripcion||'').trim(),monto,origen:`${f.origen} ${cta?cta.n:''}`.trim(),partidaId:p.id,partidaNumero:p.numero});
      registrarLog(`Aplicó ${nombre} a producción`,`${o.producto} — Q${Q(monto)}`);
      guardar(); pintar();
    },'Agregar');
};

ACCIONES.cerrarOrdenProduccion=d=>{
  const e=emp(), o=ordenAbierta(e,d.id); if(!o) return;
  const t=totalesOrden(o), m=o.tipo;
  if(t.total<=0&&!(o.inicial&&(o.inicial.mat+o.inicial.conv)>0)){avisar('La orden no tiene ningún costo todavía: agregá materiales, mano de obra o costos indirectos antes de cerrarla.');return}
  abrirModal(`Cerrar ${m==='continuo'?'la corrida':'la orden'} ${o.numero} — ${esc(o.producto)}`,
    `<div class="rej">
      <div class="campo"><label>Fecha de cierre</label><input name="fecha" type="date" value="${hoy()}"></div>
      <div class="campo"><label>Unidades terminadas</label><input name="terminadas" type="number" step="0.01" min="0"></div>
      ${m==='continuo'?`<div class="campo"><label>Unidades que quedan en proceso</label><input name="proceso" type="number" step="0.01" min="0" value="0"></div>
      <div class="campo"><label>% de avance de materiales</label><input name="avMat" type="number" step="1" min="0" max="100" value="100"></div>
      <div class="campo"><label>% de avance de mano de obra e indirectos</label><input name="avConv" type="number" step="1" min="0" max="100" value="50"></div>`:''}
    </div>
    <table id="tablaCierre" style="font-size:13px;margin-top:10px"></table>
    <div class="aviso">${m==='ordenes'?'Todo el costo de la orden pasa al producto terminado; el costo unitario es el total entre las unidades terminadas.'
      :m==='continuo'?'Se calculan unidades equivalentes con promedio ponderado. Lo que queda en proceso sigue en Productos en proceso y la próxima corrida del producto arranca con ello.'
      :'El producto entra al inventario al costo estándar; la diferencia contra el costo real queda como variación en resultados.'}</div>`,
    f=>{
      const T=r2(+f.terminadas||0), W=m==='continuo'?r2(+f.proceso||0):0;
      if(!(T>0)){avisar('Escribí las unidades terminadas.');return false}
      if(!f.fecha||f.fecha<o.fechaInicio){avisar('La fecha de cierre no puede ser anterior al inicio.');return false}
      if(anioCerradoLibros(e,f.fecha)){avisar('Ese ejercicio ya tiene Cierre de libros.');return false}
      asegurarCuenta(e,'1.1.18','Productos en proceso','activo');
      const lineas=[]; let costoTerm, cu, extra={};
      if(m==='ordenes'){
        costoTerm=t.total; cu=costoTerm/T;
        lineas.push({cta:'1.1.08',desc:o.producto,debe:costoTerm,haber:0},{cta:'1.1.18',desc:`${o.producto} — orden ${o.numero}`,debe:0,haber:costoTerm});
      }else if(m==='continuo'){
        const pm=+f.avMat||0, pc=+f.avConv||0;
        if(W>0&&(pm<0||pm>100||pc<0||pc>100)){avisar('Los porcentajes de avance van de 0 a 100.');return false}
        const c=costeoContinuo(o,T,W,pm,pc);
        costoTerm=c.transferido; cu=c.costoUnitario;
        if(costoTerm<=0){avisar('El costo transferido es cero: revisá los costos y las unidades.');return false}
        extra={wipFinal:{unidades:W,mat:c.wipMat,conv:c.wipConv,avMat:pm,avConv:pc}};
        lineas.push({cta:'1.1.08',desc:o.producto,debe:costoTerm,haber:0},{cta:'1.1.18',desc:`${o.producto} — corrida ${o.numero}`,debe:0,haber:costoTerm});
      }else{
        const v=varianzasEstandar(e,o,T);
        costoTerm=v.estTotal; cu=costoTerm/T;
        lineas.push({cta:'1.1.08',desc:o.producto,debe:costoTerm,haber:0});
        const real=t.total;
        lineas.push({cta:'1.1.18',desc:`${o.producto} — orden ${o.numero}`,debe:0,haber:real});
        VARIACIONES_ESTANDAR.forEach(([k,cta,nom])=>{
          const x=v.var[k]; if(Math.abs(x)<0.005) return;
          asegurarCuenta(e,cta,nom,'costo');
          lineas.push(x>0?{cta,desc:'Gastó más que el estándar',debe:x,haber:0}:{cta,desc:'Gastó menos que el estándar',debe:0,haber:-x});
        });
        extra={variaciones:v.var};
      }
      costoTerm=r2(costoTerm);
      const p={id:uid(),numero:e.correlativo++,fecha:f.fecha,
        concepto:`Producción terminada — ${m==='continuo'?'corrida':'orden'} ${o.numero} — ${o.producto} × ${T}`,
        docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',lineas};
      const dif=r2(lineas.reduce((s,l)=>s+l.debe-l.haber,0));
      if(Math.abs(dif)>0.004){ avisar('La partida no cuadra por Q'+Q(dif)+'. Revisá los costos de la orden.'); e.correlativo--; return false; }
      e.partidas.push(p);
      Object.assign(o,{estado:'cerrada',fechaCierre:f.fecha,cantidadTerminada:T,costoTerminado:costoTerm,costoUnitario:cu,
        partidaCierreId:p.id,partidaCierreNumero:p.numero},extra);
      registrarLog('Cerró una orden de producción',`${o.producto} × ${T} — Q${Q(costoTerm)}`);
      guardar(); pintar();
      avisar(`${m==='continuo'?'Corrida':'Orden'} cerrada: ${T} u. de ${o.producto} entran al inventario a Q${Q(cu)} c/u. Partida No. ${p.numero}.`,'Listo');
    },'Cerrar y pasar a inventario');
  const act=()=>{
    const g=n=>mForm.querySelector(`[name="${n}"]`), T=+g('terminadas').value||0;
    let html='';
    if(m==='ordenes'){
      html=`<tbody><tr><td>Costo total de la orden</td><td class="num">${Q(t.total)}</td></tr><tr class="total"><td>Costo unitario</td><td class="num">${T>0?Q(t.total/T):'—'}</td></tr></tbody>`;
    }else if(m==='continuo'){
      const W=+g('proceso').value||0, c=costeoContinuo(o,T,W,+g('avMat').value||0,+g('avConv').value||0);
      html=`<tbody><tr><td>Costo de materiales (con lo que venía en proceso)</td><td class="num">${Q(c.matTot)}</td></tr>
        <tr><td>Costo de conversión (con lo que venía en proceso)</td><td class="num">${Q(c.convTot)}</td></tr>
        <tr><td>Unidades equivalentes: materiales / conversión</td><td class="num">${c.euM.toFixed(2)} / ${c.euC.toFixed(2)}</td></tr>
        <tr><td>Costo unitario: materiales + conversión</td><td class="num">${Q(c.cuM)} + ${Q(c.cuC)}</td></tr>
        <tr class="total"><td>Pasa a producto terminado (${T} u. a Q${Q(c.costoUnitario)})</td><td class="num">${Q(c.transferido)}</td></tr>
        <tr><td>Queda en proceso (${W} u.)</td><td class="num">${Q(c.enProceso)}</td></tr></tbody>`;
    }else{
      const v=varianzasEstandar(e,o,T);
      html=`<tbody><tr><td>Costo estándar de ${T} u.</td><td class="num">${Q(v.estTotal)}</td></tr><tr><td>Costo real de la orden</td><td class="num">${Q(t.total)}</td></tr>
        <tr><td>Variación de materiales</td><td class="num">${Q(v.var.mat)}</td></tr><tr><td>Variación de mano de obra</td><td class="num">${Q(v.var.mod)}</td></tr>
        <tr><td>Variación de indirectos</td><td class="num">${Q(v.var.cif)}</td></tr>
        <tr class="total"><td>Variación total (positivo = gastó más)</td><td class="num">${Q(r2(t.total-v.estTotal))}</td></tr></tbody>`;
    }
    document.getElementById('tablaCierre').innerHTML=html;
  };
  mForm.querySelectorAll('input').forEach(i=>{i.oninput=act;});
  act();
};

ACCIONES.anularOrdenProduccion=d=>{
  const e=emp(), o=ordenAbierta(e,d.id); if(!o) return;
  confirmar(`Se anulará ${o.tipo==='continuo'?'la corrida':'la orden'} ${o.numero} de ${o.producto}: los materiales vuelven al inventario y el mano de obra y los indirectos vuelven a su cuenta de gasto (se borran las partidas que se hicieron para esta orden).`,()=>{
    const ids=new Set([...o.materiales,...o.manoObra,...o.cif].map(x=>x.partidaId));
    e.partidas=e.partidas.filter(p=>!ids.has(p.id));
    const sal=new Set(o.materiales.map(x=>x.salidaId));
    e.salidasInventario=(e.salidasInventario||[]).filter(s=>!sal.has(s.id));
    e.ordenesProduccion=e.ordenesProduccion.filter(x=>x.id!==o.id);
    ordenProdActual=null;
    registrarLog('Anuló una orden de producción',`${o.producto} — ${o.tipo==='continuo'?'corrida':'orden'} ${o.numero}`);
    guardar(); pintar();
  },'Anular');
};

ACCIONES.pdfOrdenProduccion=async d=>{
  const e=emp(), o=(e.ordenesProduccion||[]).find(x=>x.id===d.id);
  if(!o){avisar('No se encontró esa orden.');return}
  const t=totalesOrden(o), etiqueta=o.tipo==='continuo'?'Corrida':'Orden';
  const alto=altoEncabezado();
  try{
    const jsPDF=await cargarJsPDF();
    const doc=new jsPDF({unit:'pt',format:'letter'});
    const sec=(titulo,head,body)=>{
      doc.autoTable({head:[[{content:titulo,colSpan:head.length,styles:{halign:'left',fillColor:VERDE}}],head],body:body.length?body:[[{content:'Sin registros',colSpan:head.length,styles:{textColor:[150,150,150]}}]],
        startY:doc.lastAutoTable?doc.lastAutoTable.finalY+14:alto,margin:{top:alto,left:40,right:40,bottom:42},
        styles:{fontSize:8.5,cellPadding:3.5,lineColor:[225,222,212],lineWidth:.3},headStyles:{fillColor:CREMA,textColor:VERDE,fontSize:8},
        columnStyles:{[head.length-1]:{halign:'right'}},
        didDrawPage:()=>encabezadoPDF(doc,`Hoja de costos — ${etiqueta} ${o.numero}: ${o.producto}`,
          `${METODOS_PRODUCCION[o.tipo].nombre} · inicio ${fFecha(o.fechaInicio)}${o.fechaCierre?' · cierre '+fFecha(o.fechaCierre):' · abierta'} · cifras en quetzales`)});
    };
    sec('Materiales usados',['Fecha','Material','Cantidad','Costo unitario','Costo'],(o.materiales||[]).map(x=>[fFecha(x.fecha),x.producto,String(x.cantidad),Q(x.costoUnitario),Q(x.costoTotal)]));
    sec('Mano de obra directa',['Fecha','Detalle','Pasada desde','Monto'],(o.manoObra||[]).map(x=>[fFecha(x.fecha),x.descripcion||'',x.origen||'',Q(x.monto)]));
    sec('Costos indirectos de fabricación',['Fecha','Detalle','Pasada desde','Monto'],(o.cif||[]).map(x=>[fFecha(x.fecha),x.descripcion||'',x.origen||'',Q(x.monto)]));
    const resumen=[['Materiales',Q(t.mat)],['Mano de obra directa',Q(t.mod)],['Costos indirectos',Q(t.cif)],[{content:'Costo total del período',styles:{fontStyle:'bold',textColor:VERDE}},{content:Q(t.total),styles:{fontStyle:'bold',halign:'right',textColor:VERDE}}]];
    if(o.estado==='cerrada') resumen.push([`Producto terminado: ${o.cantidadTerminada} u. a Q${Q(o.costoUnitario)} c/u`,Q(o.costoTerminado)]);
    if(o.wipFinal&&o.wipFinal.unidades>0) resumen.push([`En proceso al cierre: ${o.wipFinal.unidades} u.`,Q(r2(o.wipFinal.mat+o.wipFinal.conv))]);
    if(o.variaciones) resumen.push(['Variaciones vs. estándar (mat. / M.O. / indirectos)',`${Q(o.variaciones.mat)} / ${Q(o.variaciones.mod)} / ${Q(o.variaciones.cif)}`]);
    sec('Resumen',['Concepto','Monto'],resumen);
    const n=doc.internal.getNumberOfPages(), al=doc.internal.pageSize.getHeight(), an=doc.internal.pageSize.getWidth();
    for(let i=1;i<=n;i++){ doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(130,130,130); doc.text(`Generado el ${fFecha(hoy())}`,40,al-22); doc.text(`Página ${i} de ${n}`,an-40,al-22,{align:'right'}); }
    doc.save(`Hoja-Costos-${etiqueta}-${o.numero}-${archivoSeguro(o.producto)}.pdf`);
    avisarDatosIncompletos();
  }catch(err){
    avisar('No se pudo generar el PDF: '+err.message+'\n\nEl generador se descarga de internet la primera vez, así que necesitás conexión.');
  }
};

