/* ============ VENTAS — Consignación ============ */
/* Primera pieza de esta sección: mercadería que sale a consignación se
   registra por su COSTO, no por precio — todavía no es una venta, la
   mercadería sigue siendo del negocio, solo cambió de lugar. Cuando el
   consignatario de verdad la vende, ahí sí se carga el precio, ligado a una
   factura, y recién ahí se reconoce el ingreso, el costo y la comisión. */
function cuerpoVentasDirectas(){
  const e=emp();
  e.consignaciones=e.consignaciones||[];
  e.salidasInventario=e.salidasInventario||[];
  const enConsig=e.consignaciones.filter(c=>c.estado==='en_consignacion');
  const vendidas=[...e.consignaciones.filter(c=>c.estado==='vendido')].sort((a,b)=>(b.fechaVenta||'').localeCompare(a.fechaVenta||''));
  const ventasDirectas=[...e.salidasInventario.filter(s=>s.motivo==='venta'&&!s.ajuste&&!s.pedidoId)].sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const filaEnConsig=c=>`<tr><td>${fFecha(c.fecha)}</td><td>${esc(c.producto)}</td>
    <td>${esc(c.nombreConsignatario||'—')}${c.nitConsignatario?`<br><span style="font-size:12px;color:var(--tinta-suave)">NIT ${esc(c.nitConsignatario)}</span>`:''}</td>
    <td class="num">${c.cantidad||'—'}</td><td class="num">${Q(c.costoTotal)}</td>
    <td class="num"><button class="btn mini" data-accion="registrarVentaConsignacion" data-id="${c.id}">Registrar venta</button></td></tr>`;
  const filaVendida=c=>`<tr><td>${fFecha(c.fechaVenta)}</td><td>${esc(c.producto)}</td>
    <td>${esc(c.nombreConsignatario||'—')}</td>
    <td class="num">${Q(c.costoTotal)}</td><td class="num">${c.comisionMonto?Q(c.comisionMonto):'—'}</td>
    <td class="num"><button class="btn mini" data-accion="verPartida" data-id="${c.partidaVentaId}">Ver partida</button></td></tr>`;
  const filaVentaDirecta=s=>`<tr><td>${fFecha(s.fecha)}</td><td>${esc(s.producto)}</td>
    <td class="num">${s.cantidad}</td><td class="num">${Q(s.costoUnitario)}</td><td class="num">${Q(s.costoTotal)}</td>
    <td class="num"><button class="btn mini sec" data-accion="editarVentaDirecta" data-id="${s.id}">Editar</button></td></tr>`;
  return `<h3 style="color:var(--verde);margin:0 0 8px">Ventas directas</h3>
    <div class="aviso">Para descontar del inventario una venta rápida sin pedido. El ingreso, el IVA y el costo de
      cada venta se registran, como siempre, en "Cargar facturas".</div>
    ${ventasDirectas.length? `<table><thead><tr><th>Fecha</th><th>Producto</th><th class="num">Cantidad</th>
      <th class="num">Costo unitario</th><th class="num">Costo total</th><th></th></tr></thead>
      <tbody>${ventasDirectas.map(filaVentaDirecta).join('')}</tbody></table>`
     : `<div class="vacio">Todavía no se ha registrado ninguna venta directa.</div>`}
    <h3 style="color:var(--verde);margin:22px 0 8px">En consignación</h3>
    ${enConsig.length? `<table><thead><tr><th>Fecha</th><th>Producto</th><th>Consignatario</th><th class="num">Cantidad</th>
      <th class="num">Costo</th><th class="num"></th></tr></thead>
      <tbody>${enConsig.map(filaEnConsig).join('')}</tbody></table>`
     : `<div class="vacio">No hay mercadería en consignación pendiente de vender.</div>`}
    <h3 style="color:var(--verde);margin:22px 0 8px">Consignaciones ya vendidas</h3>
    ${vendidas.length? `<table><thead><tr><th>Fecha de venta</th><th>Producto</th><th>Consignatario</th><th class="num">Costo</th>
      <th class="num">Comisión</th><th class="num"></th></tr></thead>
      <tbody>${vendidas.map(filaVendida).join('')}</tbody></table>`
     : `<div class="vacio">Todavía no se ha vendido nada de consignación.</div>`}`;
};

/* El desplegable de producto es el mismo para venta directa y consignación:
   sale del inventario que realmente hay en existencia (entradas menos lo que
   ya salió antes), nunca de texto libre. */
function opsProductoInventario(e,seleccionado){
  const {lista}=inventarioDetalle(e);
  const disponibles=lista.filter(p=>p.cantidad>0.0001);
  if(!disponibles.length) return '';
  const peps=metodoCosteo(e)==='peps';
  return disponibles.map(p=>{
    /* En PEPS la próxima unidad que sale es la de la capa más vieja, no el promedio. */
    const cu=peps?costoSalidaInventario(e,p.producto,1).costoUnitario:p.costoUnitario;
    return `<option value="${esc(p.producto)}" data-costo="${cu}"
    data-disponible="${p.cantidad}"${p.producto===seleccionado?' selected':''}>
    ${esc(p.producto)} — ${p.cantidad} disp. · ${peps?'próxima unidad':'costo prom.'} Q${Q(cu)}/u</option>`;}).join('');
}

/* Venta directa: uno o varios productos, a mano o con el lector de código de barras. Solo descuenta el
   inventario (una salida por producto); la contabilidad sale de la factura. */
ACCIONES.nuevaVentaDirecta=()=>{
  const e=emp();
  const {lista}=inventarioDetalle(e), disp=lista.filter(p=>p.cantidad>0.0001);
  if(!disp.length){avisar('No hay productos con existencia en el inventario todavía. Cargá compras de bienes primero.');return}
  const opciones=sel=>`<option value="">Elegí el producto</option>`+disp.map(p=>`<option value="${esc(p.producto)}"${p.producto===sel?' selected':''}>${esc(p.producto)} — ${Q(p.cantidad).replace(/\.00$/,'')} disp.</option>`).join('');
  const fila=(prod='',cant='')=>`<tr data-vd><td><select data-c="prod" aria-label="Producto" style="width:100%;min-width:160px">${opciones(prod)}</select></td>
    <td><input data-c="cant" type="number" step="0.01" min="0" value="${cant}" style="width:80px;text-align:right" aria-label="Cantidad vendida"></td>
    <td class="num" data-costo></td><td><button type="button" class="btn mini peligro" data-quitar aria-label="Quitar renglón">×</button></td></tr>`;
  abrirModal('Nueva venta directa',
    `<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">Descuenta del inventario lo vendido, uno o varios productos. No genera partida: el ingreso, el IVA y el costo se registran, como siempre, al cargar la factura.</p>
    ${htmlEscaner()}
    <table style="font-size:13px;margin-top:10px" id="tbVentaDirecta"><thead><tr><th>Producto</th><th class="num">Cantidad</th><th class="num">Costo que sale</th><th></th></tr></thead>
      <tbody id="tbVD">${fila()}</tbody></table>
    <button type="button" class="btn mini sec" id="btnAddVD" style="margin-top:6px">+ Agregar producto</button>
    <div class="rej" style="margin-top:12px"><div class="campo"><label>Fecha</label><input name="fecha" type="date" value="${hoy()}"></div></div>
    <p id="previewVenta" style="margin:8px 0 0;font-size:13px;color:var(--tinta-suave)" aria-live="polite"></p>`,
    d=>{
      const filas=[...mForm.querySelectorAll('[data-vd]')].map(tr=>({producto:tr.querySelector('[data-c="prod"]').value,cantidad:r2(+tr.querySelector('[data-c="cant"]').value||0)}))
        .filter(x=>x.producto||x.cantidad);
      if(!filas.length){avisar('Agregá al menos un producto.');return false}
      if(filas.some(x=>!x.producto)){avisar('Hay un renglón sin producto.');return false}
      if(filas.some(x=>!(x.cantidad>0))){avisar('Escribí cuánto se vendió de cada producto.');return false}
      if(!d.fecha){avisar('Elegí la fecha.');return false}
      if(anioCerrado(e,d.fecha.slice(0,4))){avisar(`El ejercicio ${d.fecha.slice(0,4)} ya tiene cierre de libros.`);return false}
      /* El mismo producto escaneado en dos renglones se junta en una sola salida. */
      const total={}; filas.forEach(x=>total[x.producto]=r2((total[x.producto]||0)+x.cantidad));
      const falta=Object.entries(total).find(([p,c])=>c>(disp.find(y=>y.producto===p)||{cantidad:0}).cantidad+1e-9);
      if(falta){avisar(`Solo hay ${Q(disp.find(y=>y.producto===falta[0]).cantidad).replace(/\.00$/,'')} de ${falta[0]} en existencia.`);return false}
      e.salidasInventario=e.salidasInventario||[];
      let costo=0;
      Object.entries(total).forEach(([producto,cantidad])=>{
        const c=costoSalidaInventario(e,producto,cantidad,d.fecha); costo=r2(costo+c.costoTotal);
        e.salidasInventario.push({id:uid(),fecha:d.fecha,producto,cantidad,costoUnitario:c.costoUnitario,costoTotal:c.costoTotal,motivo:'venta'});
      });
      const n=Object.keys(total).length;
      registrarLog('Registró salida de inventario por venta',Object.entries(total).map(([p,c])=>`${p} — ${c} u.`).join('; '));
      guardar(); pintar();
      avisar(n===1?`Inventario actualizado: salieron ${Object.values(total)[0]} u. de ${Object.keys(total)[0]}.`:`Inventario actualizado: salieron ${n} productos (costo Q${Q(costo)}).`,'Listo');
    },'Registrar venta');
  const tb=mForm.querySelector('#tbVD');
  const recalcular=()=>{
    const total={};
    tb.querySelectorAll('[data-vd]').forEach(tr=>{
      const p=tr.querySelector('[data-c="prod"]').value, c=+tr.querySelector('[data-c="cant"]').value||0;
      const k=disp.find(y=>y.producto===p), antes=total[p]||0; total[p]=antes+c;
      /* El costo de este renglón: lo que cuesta sacar lo acumulado menos lo que ya salió en renglones anteriores. */
      tr.querySelector('[data-costo]').textContent=k&&c?Q(r2(costoSalidaInventario(e,p,antes+c).costoTotal-costoSalidaInventario(e,p,antes).costoTotal)):'';
    });
    const exceso=Object.entries(total).filter(([p,c])=>{ const k=disp.find(y=>y.producto===p); return k&&c>k.cantidad+1e-9; }).map(([p])=>p);
    const costo=Object.entries(total).reduce((s,[p,c])=>s+(p&&c?costoSalidaInventario(e,p,c).costoTotal:0),0);
    document.getElementById('previewVenta').innerHTML=`Costo total que sale del inventario (${METODOS_COSTEO[metodoCosteo(e)]}): <strong>Q${Q(costo)}</strong>`
      +(exceso.length?`<br><span style="color:var(--alerta)">Más de lo que hay en existencia: ${exceso.map(esc).join(', ')}.</span>`:'');
  };
  /* El escáner suma 1 al renglón de ese producto, o lo agrega. */
  const agregar=prod=>{
    if(!disp.some(y=>y.producto===prod)) return `${prod} no tiene existencia en el inventario.`;
    const tr=[...tb.querySelectorAll('[data-vd]')].find(x=>x.querySelector('[data-c="prod"]').value===prod);
    if(tr){ const c=tr.querySelector('[data-c="cant"]'); c.value=r2((+c.value||0)+1); }
    else{ const vacia=[...tb.querySelectorAll('[data-vd]')].find(x=>!x.querySelector('[data-c="prod"]').value);
      if(vacia){ vacia.querySelector('[data-c="prod"]').value=prod; vacia.querySelector('[data-c="cant"]').value=1; }
      else tb.insertAdjacentHTML('beforeend',fila(prod,1)); }
    recalcular();
    const t=[...tb.querySelectorAll('[data-vd]')].find(x=>x.querySelector('[data-c="prod"]').value===prod);
    return `Agregado: ${prod} (${t.querySelector('[data-c="cant"]').value})`;
  };
  enlazarEscaner(e,agregar,disp.map(p=>p.producto));
  tb.addEventListener('input',recalcular); tb.addEventListener('change',recalcular);
  tb.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();ev.stopPropagation();}});
  tb.addEventListener('click',ev=>{ if(!ev.target.matches('[data-quitar]')) return; ev.target.closest('[data-vd]').remove(); if(!tb.querySelector('[data-vd]')) tb.insertAdjacentHTML('beforeend',fila()); recalcular(); });
  mForm.querySelector('#btnAddVD').onclick=()=>{ tb.insertAdjacentHTML('beforeend',fila()); recalcular(); };
  recalcular(); mForm.querySelector('#escCodigo').focus();
};

ACCIONES.editarVentaDirecta=d=>{
  const e=emp();
  const s=(e.salidasInventario||[]).find(x=>x.id===d.id);
  if(!s){avisar('No se encontró esa venta.');return}
  /* La disponible para validar tiene que sumarle de vuelta la cantidad que
     esta misma venta ya restó — si no, editarla sin cambiar nada daría
     "no hay suficiente" porque se estaría descontando dos veces. */
  const {lista}=inventarioDetalle(e);
  const item=lista.find(p=>p.producto===s.producto);
  const disponibleSinEsta=r2((item?item.cantidad:0)+s.cantidad);
  abrirModal('Editar venta',
    `<p style="margin:0 0 14px;font-size:13px;color:var(--tinta-suave)">Solo cambia el control de inventario de
      esta salida — no toca ninguna partida ni la factura ya cargada. El costo unitario se mantiene igual al que
      tenía cuando se registró, para no mezclarlo con el costo promedio de hoy.</p>
    <div class="rej">
      <div class="campo full"><label>Producto</label><input value="${esc(s.producto)}" disabled></div>
      <div class="campo"><label>Cantidad vendida</label><input name="cantidad" type="number" step="0.01" min="0" value="${s.cantidad}"></div>
      <div class="campo"><label>Fecha</label><input name="fecha" type="date" value="${s.fecha}"></div>
    </div>
    <p style="margin:10px 0 0;font-size:13px;color:var(--tinta-suave)">Disponible sin contar esta venta: ${disponibleSinEsta} u.
      · Costo unitario: Q${Q(s.costoUnitario)}</p>`,
    dd=>{
      const cantidad=r2(+dd.cantidad);
      if(!cantidad||cantidad<=0){avisar('Escribí cuánto se vendió.');return false}
      if(cantidad>disponibleSinEsta){avisar(`Solo hay ${disponibleSinEsta} en existencia de ese producto, contando lo que esta misma venta ya tenía descontado.`);return false}
      if(!dd.fecha){avisar('Escribí la fecha de la venta.');return false}
      s.cantidad=cantidad; s.fecha=dd.fecha; s.costoTotal=r2(cantidad*s.costoUnitario);
      registrarLog('Editó una venta directa',`${s.producto} — ahora ${cantidad} u. al ${fFecha(dd.fecha)}`);
      guardar(); pintar();
      avisar('Venta actualizada.','Listo');
    },'Guardar cambios');
};

ACCIONES.nuevaConsignacion=()=>{
  const e=emp();
  const ops=opsProductoInventario(e);
  if(!ops){avisar('No hay productos con existencia en el inventario todavía. Cargá compras de bienes primero.');return}
  const cuentasActivo=e.cuentas.filter(c=>c.d&&c.t==='activo'&&c.c!=='1.1.14');
  abrirModal('Nueva consignación',
    `<div class="rej">
      <div class="campo full"><label>Producto</label><select name="producto">${ops}</select></div>
      <div class="campo"><label>Cantidad</label><input name="cantidad" type="number" step="0.01" min="0"></div>
      <div class="campo"><label>Costo total</label><input name="costoTotal" type="number" step="0.01" min="0" readonly style="background:var(--fondo-suave)"></div>
      <div class="campo full"><label>Nombre del consignatario</label><input name="nombreConsignatario" placeholder="A quién le entregás la mercadería"></div>
      <div class="campo"><label>NIT del consignatario</label><input name="nitConsignatario" placeholder="CF si no tiene"></div>
      <div class="campo"><label>Fecha</label><input name="fecha" type="date" value="${hoy()}"></div>
      <div class="campo full"><label>¿De qué cuenta sale?</label><select name="cuentaOrigen">
        ${cuentasActivo.map(c=>`<option value="${c.c}"${c.c==='1.1.08'?' selected':''}>${c.c} — ${esc(c.n)}</option>`).join('')}
      </select></div>
    </div>`,
    d=>{
      const cantidad=r2(+d.cantidad);
      const sel=mForm.querySelector('[name="producto"]');
      const opt=sel.options[sel.selectedIndex];
      const disponible=+opt.dataset.disponible;
      const {costoUnitario,costoTotal}=costoSalidaInventario(e,d.producto,cantidad,d.fecha||hoy());
      if(!cantidad||cantidad<=0){avisar('Escribí cuánto sale a consignación.');return false}
      if(cantidad>disponible){avisar(`Solo hay ${disponible} en existencia de ese producto.`);return false}
      if(!d.nombreConsignatario.trim()){avisar('Escribí a nombre de quién sale la mercadería en consignación.');return false}
      asegurarCuenta(e,'1.1.14','Mercadería en consignación','activo');
      const p={id:uid(),numero:e.correlativo++,fecha:d.fecha||hoy(),
        concepto:`Mercadería en consignación — ${d.producto} — ${d.nombreConsignatario.trim()}`,
        docTipo:'',docSerie:'',docNum:'',nit:(d.nitConsignatario||'CF').trim(),contraparte:d.nombreConsignatario.trim(),
        lineas:[{cta:'1.1.14',desc:'',debe:costoTotal,haber:0},{cta:d.cuentaOrigen,desc:'',debe:0,haber:costoTotal}]};
      e.partidas.push(p);
      e.consignaciones=e.consignaciones||[];
      e.consignaciones.push({id:uid(),fecha:d.fecha||hoy(),producto:d.producto,
        nombreConsignatario:d.nombreConsignatario.trim(),nitConsignatario:(d.nitConsignatario||'CF').trim(),
        cantidad,costoTotal,cuentaOrigen:d.cuentaOrigen,estado:'en_consignacion',partidaConsignacionId:p.id});
      e.salidasInventario=e.salidasInventario||[];
      e.salidasInventario.push({id:uid(),fecha:d.fecha||hoy(),producto:d.producto,cantidad,
        costoUnitario,costoTotal,motivo:'consignacion',referenciaId:p.id});
      registrarLog('Registró mercadería en consignación',`${d.producto} — Q${Q(costoTotal)}`);
      guardar();
      avisar(`Consignación registrada en la partida No. ${p.numero}.`,'Listo');
    },'Registrar consignación');
  const actualizarCosto=()=>{
    const sel=mForm.querySelector('[name="producto"]'), opt=sel.options[sel.selectedIndex];
    const cantidad=+mForm.querySelector('[name="cantidad"]').value||0;
    mForm.querySelector('[name="costoTotal"]').value=costoSalidaInventario(e,sel.value,cantidad).costoTotal;
  };
  mForm.querySelector('[name="producto"]').onchange=actualizarCosto;
  mForm.querySelector('[name="cantidad"]').oninput=actualizarCosto;
  actualizarCosto();
};

ACCIONES.registrarVentaConsignacion=d0=>{
  const e=emp();
  const c=(e.consignaciones||[]).find(x=>x.id===d0.id);
  if(!c){avisar('No se encontró esa consignación.');return}

  abrirModal(`Terminar consignación — ${esc(c.producto)}`,
    `<p style="margin:0 0 14px;font-size:13px;color:var(--tinta-suave)">Salió a consignación el ${fFecha(c.fecha)}
      por un costo de Q${Q(c.costoTotal)}. Esto solo saca ese costo de "Mercadería en consignación" — el
      ingreso, el IVA y los datos del cliente se registran aparte, cuando cargués la factura real de esta venta
      en "Cargar facturas".</p>
    <div class="rej">
      <div class="campo"><label>Fecha de venta</label><input name="fechaVenta" type="date" value="${hoy()}"></div>
      <div class="campo"><label>Comisión al consignatario (opcional)</label><input name="comisionMonto" type="number" step="0.01" min="0" value="0"></div>
    </div>`,
    d=>{
      const comisionMonto=r2(+d.comisionMonto||0);
      asegurarCuenta(e,'6.1.08','Comisiones sobre ventas','gasto');
      asegurarCuenta(e,'2.1.16','Comisiones por pagar','pasivo');
      const lineas=[{cta:'5.1.01',desc:'',debe:c.costoTotal,haber:0},{cta:'1.1.14',desc:'',debe:0,haber:c.costoTotal}];
      if(comisionMonto) lineas.push({cta:'6.1.08',desc:'',debe:comisionMonto,haber:0},{cta:'2.1.16',desc:'',debe:0,haber:comisionMonto});

      const p={id:uid(),numero:e.correlativo++,fecha:d.fechaVenta||hoy(),
        concepto:`Salida de consignación por venta — ${c.producto}`,
        docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:c.nombreConsignatario||'',lineas};
      e.partidas.push(p);

      Object.assign(c,{estado:'vendido',fechaVenta:d.fechaVenta||hoy(),comisionMonto,partidaVentaId:p.id});
      registrarLog('Terminó una consignación',`${c.producto} — costo Q${Q(c.costoTotal)}`);
      guardar();
      avisar(`Inventario de consignación cerrado en la partida No. ${p.numero}. No olvidés cargar la factura real de esta venta en "Cargar facturas".`,'Listo');
    },'Terminar consignación');
};


VISTAS.empleados=()=>{
  const e=emp();
  e.empleados=e.empleados||[];
  const activos=e.empleados.filter(x=>x.activo!==false);
  const inactivos=e.empleados.filter(x=>x.activo===false);
  const fila=x=>`<tr${x.activo===false?' style="opacity:.55"':''}>
    <td>${esc(x.nombre)}${x.activo===false?' <span style="color:var(--alerta);font-size:12px">(baja)</span>':''}</td>
    <td>${esc(x.puesto||'—')}</td>
    <td>${x.fechaIngreso?fFecha(x.fechaIngreso):'<span style="color:var(--alerta)">sin definir</span>'}</td>
    <td class="num">${Q(x.salarioBase)}</td>
    <td class="num">
      <button class="btn mini sec" data-accion="editarEmpleado" data-id="${x.id}">Editar</button>
      ${x.activo===false?'':`<button class="btn mini" data-accion="liquidarEmpleado" data-id="${x.id}">Liquidar</button>`}
      ${(()=>{const l=(e.liquidaciones||[]).filter(z=>z.empleadoId===x.id).sort((a,b)=>b.fechaRetiro.localeCompare(a.fechaRetiro))[0];
        return l?`<button class="btn mini sec" data-accion="pdfFiniquito" data-id="${l.id}">Imprimir finiquito</button>`:'';})()}
      <button class="btn mini ${x.activo===false?'':'peligro'}" data-accion="alternarEmpleado" data-id="${x.id}">${x.activo===false?'Reactivar':'Dar de baja'}</button>
    </td></tr>`;
  return cab('Empleados','Salario base mensual completo, sin la bonificación incentivo — esa se calcula sola.',
    `<button class="btn" data-accion="nuevoEmpleado">Agregar empleado</button>`)
  + (e.empleados.length? `<table><thead><tr><th>Nombre</th><th>Puesto</th><th>Fecha de ingreso</th>
      <th class="num">Salario base mensual</th><th class="num"></th></tr></thead>
      <tbody>${activos.map(fila).join('')}${inactivos.map(fila).join('')}</tbody></table>`
     : `<div class="vacio">Todavía no hay empleados registrados.</div>`)
  + ((e.liquidaciones||[]).length?`<h3 style="color:var(--verde);margin:24px 0 8px">Liquidaciones</h3>
    <table style="font-size:13px"><thead><tr><th>Retiro</th><th>Empleado</th><th>Motivo</th><th class="num">Días laborados</th><th class="num">Total pagado</th><th class="num">Partida</th><th class="num"></th></tr></thead>
    <tbody>${[...e.liquidaciones].sort((a,b)=>b.fechaRetiro.localeCompare(a.fechaRetiro)).map(l=>`<tr><td>${fFecha(l.fechaRetiro)}</td><td>${esc(l.nombre)}</td>
      <td>${esc(MOTIVOS_RETIRO[l.motivo]?MOTIVOS_RETIRO[l.motivo].nombre.split(' — ')[0]:l.motivo)}</td><td class="num">${l.diasLaborados}</td>
      <td class="num">${Q(l.total)}</td><td class="num">${l.partidaNumero?'No. '+l.partidaNumero:'—'}</td>
      <td class="num"><button class="btn mini sec" data-accion="pdfFiniquito" data-id="${l.id}">Imprimir finiquito</button></td></tr>`).join('')}</tbody></table>`:'');
};

ACCIONES.nuevoEmpleado=()=>formEmpleado(null);
ACCIONES.editarEmpleado=d=>{
  const e=emp(); formEmpleado(e.empleados.find(x=>x.id===d.id));
};
function formEmpleado(existente){
  const x=existente||{}, e0=emp();
  const ec=Object.entries(ESTADOS_CIVILES).map(([k,v])=>`<option value="${k}"${x.estadoCivil===k?' selected':''}>${v[0]} / ${v[1]}</option>`).join('');
  abrirModal(existente?'Editar empleado':'Agregar empleado',
    `<div class="rej">
      <div class="campo full"><label>Nombre completo</label><input name="nombre" value="${esc(x.nombre||'')}"></div>
      <div class="campo"><label>Puesto</label><input name="puesto" list="dlPuestosEmp" value="${esc(x.puesto||'')}" placeholder="Escribí o elegí de la lista"><datalist id="dlPuestosEmp">${opcionesPuestos(e0)}</datalist></div>
      <div class="campo"><label>Salario base mensual</label><input name="salarioBase" type="number" step="0.01" min="0" value="${x.salarioBase||''}" placeholder="Sin la bonificación de Q250"></div>
      <div class="campo"><label>Fecha de ingreso</label><input name="fechaIngreso" type="date" value="${x.fechaIngreso||''}"></div>
      <div class="campo"><label>Correo (para avisarle de sus pagos)</label><input name="email" type="email" value="${esc(x.email||'')}" placeholder="nombre@correo.com"></div>
    </div>
    <div id="funcionesPuesto" class="funciones-puesto" hidden></div>
    <p style="margin:6px 0 0;font-size:13px;color:var(--tinta-suave)">La fecha de ingreso se usa para calcular el
      aguinaldo y el Bono 14 proporcional si entró a mitad del período legal — no hace falta tocar nada más,
      el sistema lo prorratea solo.</p>
    <details class="datos-personales"${x.dpi||x.fechaNac||x.igss?' open':''}><summary>Datos personales (para el contrato y el Libro de Salarios)</summary>
      <div class="rej" style="margin-top:10px">
        <div class="campo"><label>DPI (CUI)</label><input name="dpi" value="${esc(x.dpi||'')}" placeholder="0000 00000 0000" inputmode="numeric"></div>
        <div class="campo"><label>No. de afiliación al IGSS</label><input name="igss" value="${esc(x.igss||'')}" inputmode="numeric"></div>
        <div class="campo"><label>Fecha de nacimiento</label><input name="fechaNac" type="date" value="${esc(x.fechaNac||'')}"></div>
        <div class="campo"><label>Sexo</label><select name="sexo"><option value="M"${x.sexo!=='F'?' selected':''}>Masculino</option><option value="F"${x.sexo==='F'?' selected':''}>Femenino</option></select></div>
        <div class="campo"><label>Estado civil</label><select name="estadoCivil"><option value="">—</option>${ec}</select></div>
        <div class="campo"><label>Profesión u oficio</label><input name="profesion" value="${esc(x.profesion||'')}"></div>
        <div class="campo"><label>Nacionalidad</label><input name="nacionalidad" value="${esc(x.nacionalidad||'guatemalteco')}"></div>
        <div class="campo"><label>Vecino del municipio de</label><input name="municipio" value="${esc(x.municipio||'')}"></div>
        <div class="campo"><label>Departamento</label><input name="departamento" value="${esc(x.departamento||'')}"></div>
      </div></details>`,
    d=>{
      const e=emp();
      if(!d.nombre.trim()){avisar('Escribí el nombre del empleado.');return false}
      const salario=+d.salarioBase;
      if(!salario||salario<=0){avisar('Escribí el salario base mensual.');return false}
      const dpiLimpio=(d.dpi||'').replace(/\D/g,'');
      if(dpiLimpio&&dpiLimpio.length!==13){avisar('El DPI tiene 13 dígitos (por ejemplo 2695 40784 0801).');return false}
      const personales={dpi:dpiLimpio?dpiFormato(dpiLimpio):'',igss:(d.igss||'').trim(),fechaNac:d.fechaNac||'',sexo:d.sexo||'M',estadoCivil:d.estadoCivil||'',profesion:(d.profesion||'').trim(),
        nacionalidad:(d.nacionalidad||'').trim()||'guatemalteco',municipio:(d.municipio||'').trim(),departamento:(d.departamento||'').trim()};
      /* El empleado queda ligado al puesto del catálogo (si viene de la base de puestos, se agrega solo). */
      const pu=asegurarPuesto(e,d.puesto);
      personales.puestoId=pu?pu.id:''; if(pu) d.puesto=pu.nombre;
      if(existente){
        existente.nombre=d.nombre.trim(); existente.puesto=d.puesto.trim(); existente.salarioBase=r2(salario);
        existente.fechaIngreso=d.fechaIngreso||existente.fechaIngreso||''; existente.email=(d.email||'').trim();
        Object.assign(existente,personales);
      }else{
        e.empleados=e.empleados||[];
        e.empleados.push({id:uid(),nombre:d.nombre.trim(),puesto:d.puesto.trim(),salarioBase:r2(salario),
          fechaIngreso:d.fechaIngreso||'',email:(d.email||'').trim(),activo:true,...personales});
      }
      guardar();
    },existente?'Guardar cambios':'Agregar empleado');
  /* Al elegir un puesto del catálogo con salario sugerido, se propone ese salario si todavía no hay uno. */
  const pu=mForm.querySelector('[name="puesto"]'), sal=mForm.querySelector('[name="salarioBase"]');
  const verFunciones=()=>{
    const n=pu.value.trim().toLowerCase(), p=(e0.puestos||[]).find(y=>y.nombre.toLowerCase()===n)||PUESTOS_BASE.find(y=>y.nombre.toLowerCase()===n);
    const caja=document.getElementById('funcionesPuesto'); if(!caja) return;
    caja.hidden=!p;
    if(p) caja.innerHTML=`<strong>${esc(p.nombre)}</strong>${(e0.puestos||[]).includes(p)?'':' <span class="etiqueta">de la base de puestos: se agrega al guardar</span>'}<ul>${funcionesDe(p).map(f=>`<li>${esc(f)}</li>`).join('')}</ul>`;
    if(p&&p.salario&&!sal.value) sal.value=p.salario;
  };
  pu.addEventListener('change',verFunciones); pu.addEventListener('input',verFunciones); verFunciones();
}
ACCIONES.alternarEmpleado=d=>{
  if(!puedeEliminar()){avisar('Tu rol no tiene permiso para dar de baja empleados. Pedile a tu gerente que lo haga.');return}
  const e=emp(), x=e.empleados.find(y=>y.id===d.id);
  x.activo = x.activo===false;
  guardar(); pintar();
};

