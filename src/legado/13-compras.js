/* ============ COMPRAS: cotizaciones, órdenes de compra y aprobación de gastos ============ */
/* Nada de esto genera partidas: es el trabajo que ocurre ANTES de que llegue la
   factura. La contabilidad sigue entrando por "Cargar facturas"; lo único que une
   las dos cosas es que, al cargar una factura de compra, se puede decir a qué
   orden aprobada corresponde, y el sistema compara lo ordenado contra lo facturado. */
const IVA_COMPRAS=0.12;
const ESTADOS_OC={borrador:'Borrador',pendiente:'Pendiente de aprobación',aprobada:'Aprobada',rechazada:'Rechazada',facturada:'Facturada',anulada:'Anulada'};
const COLOR_ESTADO_OC={borrador:'var(--tinta-suave)',pendiente:'var(--haber)',aprobada:'var(--verde)',rechazada:'var(--alerta)',facturada:'var(--verde)',anulada:'var(--tinta-suave)'};
let comprasTab='ordenes';

const normNIT=n=>String(n||'').toUpperCase().replace(/[^0-9A-Z]/g,'');
/* Aprueban el Administrador y el Gerente de Compras. El Auxiliar prepara, no aprueba. */
function puedeAprobarCompras(){const u=usuarioActual();return !!u&&(u.rol==='administrador'||u.rol==='compras_gerente');}
function totalesCompra(items,aplicaIVA){
  const subtotal=r2(items.reduce((s,i)=>s+r2((+i.cantidad||0)*(+i.precio||0)),0));
  const iva=aplicaIVA?r2(subtotal*IVA_COMPRAS):0;
  return {subtotal,iva,total:r2(subtotal+iva)};
}
/* Cuánto puede diferir una factura de lo que falta por facturar antes de avisar: el mayor entre Q1 y el 1%. */
const toleranciaOC=total=>Math.max(1,r2(total*0.01));
const porFacturarOC=oc=>r2(oc.total-(oc.facturado||0));
const buscarOC=(e,id)=>(e.ordenesCompra||[]).find(o=>o.id===id);
const buscarCot=(e,id)=>(e.cotizaciones||[]).find(c=>c.id===id);
function proximoNumeroCompras(e,prefijo,campo){e[campo]=(e[campo]||0)+1;return `${prefijo}-${String(e[campo]).padStart(4,'0')}`;}
function historialOC(oc,accion,detalle){
  const u=usuarioActual();
  (oc.historial=oc.historial||[]).push({fecha:new Date().toISOString(),usuario:u?(u.nombre||u.usuario):'',accion,detalle:detalle||''});
}
const quienSoy=()=>{const u=usuarioActual();return u?{id:u.id,nombre:u.nombre||u.usuario}:{id:'',nombre:''};};
function proveedoresConocidos(e){
  const m=new Map();
  (e.documentos||[]).filter(d=>d.tipo==='compra'&&d.nit).forEach(d=>{if(!m.has(normNIT(d.nit))) m.set(normNIT(d.nit),{nit:d.nit,nombre:d.nombre||''});});
  [...(e.ordenesCompra||[]),...(e.cotizaciones||[])].forEach(x=>{
    if(x.proveedorNit&&!m.has(normNIT(x.proveedorNit))) m.set(normNIT(x.proveedorNit),{nit:x.proveedorNit,nombre:x.proveedorNombre||''});});
  return [...m.values()];
}

/* ---- piezas de formulario compartidas por cotización y orden ---- */
function htmlProveedorCampos(e,nit,nombre){
  return `<datalist id="dlProv">${proveedoresConocidos(e).map(p=>`<option value="${esc(p.nit)}">${esc(p.nombre)}</option>`).join('')}</datalist>
    <div class="campo"><label>NIT del proveedor</label><input name="proveedorNit" list="dlProv" value="${esc(nit||'')}" placeholder="NIT"></div>
    <div class="campo"><label>Nombre del proveedor</label><input name="proveedorNombre" value="${esc(nombre||'')}"></div>`;
}
function enlazarProveedor(e){
  const n=mForm.querySelector('[name="proveedorNit"]'), nom=mForm.querySelector('[name="proveedorNombre"]');
  n.onchange=()=>{const p=proveedoresConocidos(e).find(x=>normNIT(x.nit)===normNIT(n.value)); if(p&&!nom.value) nom.value=p.nombre;};
}
const filaItemCompra=it=>`<tr data-it><td><input data-c="desc" value="${esc(it.descripcion||'')}" placeholder="Producto o servicio" style="width:100%"></td>
  <td><input data-c="cant" type="number" min="0" step="0.01" value="${it.cantidad===undefined?1:it.cantidad}" style="width:80px;text-align:right"></td>
  <td><input data-c="precio" type="number" min="0" step="0.01" value="${it.precio===undefined?'':it.precio}" style="width:100px;text-align:right"></td>
  <td class="num" data-sub></td><td><button type="button" class="btn mini peligro" data-quitar aria-label="Quitar renglón">×</button></td></tr>`;
function htmlEditorItems(items){
  return `<table style="font-size:13px;margin-top:10px"><thead><tr><th>Descripción</th><th class="num">Cantidad</th>
    <th class="num">Precio unitario</th><th class="num">Subtotal</th><th></th></tr></thead>
    <tbody id="tbItems">${(items&&items.length?items:[{}]).map(filaItemCompra).join('')}</tbody></table>
    <button type="button" class="btn mini sec" id="btnAddItem" style="margin-top:6px">+ Agregar renglón</button>`;
}
/* Solo los renglones completos: con descripción, cantidad y precio. */
function leerItemsEditor(){
  return [...mForm.querySelectorAll('[data-it]')].map(tr=>({
    descripcion:tr.querySelector('[data-c="desc"]').value.trim(),
    cantidad:+tr.querySelector('[data-c="cant"]').value||0,
    precio:+tr.querySelector('[data-c="precio"]').value||0})).filter(i=>i.descripcion&&i.cantidad>0&&i.precio>0);
}
function enlazarEditorItems(){
  const tb=mForm.querySelector('#tbItems'), tot=mForm.querySelector('#totCompra'), iva=mForm.querySelector('[name="aplicaIVA"]');
  const recalcular=()=>{
    tb.querySelectorAll('[data-it]').forEach(tr=>{
      const c=+tr.querySelector('[data-c="cant"]').value||0, p=+tr.querySelector('[data-c="precio"]').value||0;
      tr.querySelector('[data-sub]').textContent=c&&p?Q(r2(c*p)):'';});
    const t=totalesCompra(leerItemsEditor(),iva.checked);
    tot.innerHTML=`Subtotal Q${Q(t.subtotal)} · IVA Q${Q(t.iva)} · <strong>Total Q${Q(t.total)}</strong>`;
  };
  tb.addEventListener('input',recalcular);
  /* Enter dentro del detalle no debe guardar el formulario por accidente. */
  tb.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();ev.stopPropagation();}});
  tb.addEventListener('click',ev=>{
    if(ev.target.matches('[data-quitar]')){
      ev.target.closest('[data-it]').remove();
      if(!tb.querySelector('[data-it]')) tb.insertAdjacentHTML('beforeend',filaItemCompra({}));
      recalcular();}
  });
  mForm.querySelector('#btnAddItem').onclick=()=>{tb.insertAdjacentHTML('beforeend',filaItemCompra({}));recalcular();};
  iva.onchange=recalcular; recalcular();
}
const htmlCheckIVA=aplica=>`<label style="display:flex;gap:8px;align-items:center;margin:10px 0 4px;font-size:14px">
  <input type="checkbox" name="aplicaIVA"${aplica!==false?' checked':''} style="width:auto"> Los precios no incluyen IVA: se suma el 12%</label>
  <p id="totCompra" style="margin:4px 0 10px;font-size:14px"></p>`;

/* ---- cotizaciones ---- */
function formCotizacion(c){
  const e=emp(), nuevo=!c; c=c||{items:[],aplicaIVA:true};
  const reqs=[...new Set((e.cotizaciones||[]).map(x=>x.requerimiento).filter(Boolean))];
  abrirModal(nuevo?'Nueva cotización':`Editar cotización ${esc(c.numero)}`,
    `<datalist id="dlReq">${reqs.map(r=>`<option value="${esc(r)}">`).join('')}</datalist>
    <div class="rej">
      <div class="campo full"><label>¿Qué se necesita comprar? (requerimiento)</label>
        <input name="requerimiento" list="dlReq" value="${esc(c.requerimiento||'')}" placeholder="Ej.: Cajas para el pedido de octubre">
        <span style="font-size:12.5px;color:var(--tinta-suave)">Las cotizaciones con el mismo requerimiento se comparan juntas.</span></div>
      ${htmlProveedorCampos(e,c.proveedorNit,c.proveedorNombre)}
      <div class="campo"><label>Fecha de la cotización</label><input name="fecha" type="date" value="${c.fecha||hoy()}"></div>
      <div class="campo"><label>Vigente hasta</label><input name="vigenteHasta" type="date" value="${c.vigenteHasta||''}"></div>
    </div>
    ${htmlEditorItems(c.items)}${htmlCheckIVA(c.aplicaIVA)}
    <div class="campo full"><label>Notas</label><input name="notas" value="${esc(c.notas||'')}" placeholder="Tiempo de entrega, forma de pago…"></div>`,
    d=>{
      if(!d.requerimiento.trim()){avisar('Escribí qué se necesita comprar: así se agrupan las cotizaciones para compararlas.');return false}
      if(!d.proveedorNombre.trim()){avisar('Escribí el nombre del proveedor.');return false}
      const items=leerItemsEditor();
      if(!items.length){avisar('Agregá al menos un renglón completo: descripción, cantidad y precio.');return false}
      const aplicaIVA=d.aplicaIVA==='on', t=totalesCompra(items,aplicaIVA);
      const datos={requerimiento:d.requerimiento.trim(),proveedorNit:d.proveedorNit.trim(),proveedorNombre:d.proveedorNombre.trim(),
        fecha:d.fecha||hoy(),vigenteHasta:d.vigenteHasta||'',items,aplicaIVA,...t,notas:d.notas.trim()};
      if(nuevo){
        (e.cotizaciones=e.cotizaciones||[]).push({id:uid(),numero:proximoNumeroCompras(e,'COT','correlativoCot'),estado:'vigente',creadoPor:quienSoy(),...datos});
        registrarLog('Registró una cotización',`${datos.proveedorNombre} — ${datos.requerimiento} — Q${Q(t.total)}`);
      }else{ Object.assign(c,datos); registrarLog('Editó una cotización',`${c.numero} — ${datos.proveedorNombre}`); }
      guardar(); pintar();
    },nuevo?'Guardar cotización':'Guardar cambios');
  enlazarProveedor(e); enlazarEditorItems();
}
ACCIONES.nuevaCotizacion=()=>formCotizacion(null);
ACCIONES.editarCotizacion=d=>{
  const c=buscarCot(emp(),d.id);
  if(!c){avisar('No se encontró esa cotización.');return}
  if(c.ocId){avisar(`Esta cotización ya originó la orden de compra ${buscarOC(emp(),c.ocId)?buscarOC(emp(),c.ocId).numero:''}: ya no se edita.`);return}
  formCotizacion(c);
};
ACCIONES.eliminarCotizacion=d=>{
  const e=emp(), c=buscarCot(e,d.id);
  if(!c) return;
  if(c.ocId){avisar('Esta cotización ya originó una orden de compra: no se puede eliminar.');return}
  confirmar(`Se eliminará la cotización ${c.numero} de ${c.proveedorNombre}.`,()=>{
    e.cotizaciones=e.cotizaciones.filter(x=>x.id!==c.id); guardar(); pintar();},'Eliminar');
};
/* Elegir una cotización descarta las otras del mismo requerimiento que todavía no tienen orden. */
ACCIONES.elegirCotizacion=d=>{
  const e=emp(), c=buscarCot(e,d.id);
  if(!c) return;
  confirmar(`Elegir la cotización de ${c.proveedorNombre} (Q${Q(c.total)}) para "${c.requerimiento}". Las demás cotizaciones de este requerimiento quedan descartadas.`,()=>{
    e.cotizaciones.filter(x=>x.requerimiento===c.requerimiento&&x.id!==c.id&&!x.ocId).forEach(x=>x.estado='descartada');
    c.estado='elegida'; registrarLog('Eligió una cotización',`${c.numero} — ${c.proveedorNombre} — Q${Q(c.total)}`);
    guardar(); pintar();},'Elegir');
};
ACCIONES.reabrirCotizacion=d=>{
  const e=emp(), c=buscarCot(e,d.id);
  if(!c||c.ocId) return;
  c.estado='vigente'; guardar(); pintar();
};
ACCIONES.ordenDesdeCotizacion=d=>{
  const c=buscarCot(emp(),d.id);
  if(!c){avisar('No se encontró esa cotización.');return}
  if(c.ocId){avisar('Esta cotización ya tiene su orden de compra.');return}
  formOrdenCompra(null,c);
};

/* ---- órdenes de compra ---- */
function formOrdenCompra(oc,cot){
  const e=emp(), nuevo=!oc;
  const base=oc||(cot?{proveedorNit:cot.proveedorNit,proveedorNombre:cot.proveedorNombre,items:cot.items.map(i=>({...i})),aplicaIVA:cot.aplicaIVA}:{items:[],aplicaIVA:true});
  abrirModal(nuevo?'Nueva orden de compra':`Editar ${esc(oc.numero)}`,
    `${cot?`<p style="margin:0 0 10px;font-size:13px;color:var(--tinta-suave)">Se arma con la cotización ${esc(cot.numero)} de ${esc(cot.proveedorNombre)}.</p>`:''}
    <div class="rej">${htmlProveedorCampos(e,base.proveedorNit,base.proveedorNombre)}
      <div class="campo"><label>Fecha de la orden</label><input name="fecha" type="date" value="${base.fecha||hoy()}"></div>
      <div class="campo"><label>Entrega esperada</label><input name="fechaEntrega" type="date" value="${base.fechaEntrega||''}"></div>
    </div>
    ${htmlEditorItems(base.items)}${htmlCheckIVA(base.aplicaIVA)}
    <div class="campo full"><label>Condiciones</label><input name="condiciones" value="${esc(base.condiciones||'')}" placeholder="Forma de pago, lugar de entrega…"></div>
    <div class="aviso">Queda como <strong>borrador</strong>. Cuando esté lista, usá "Enviar a aprobación".</div>`,
    d=>{
      if(!d.proveedorNombre.trim()){avisar('Escribí el nombre del proveedor.');return false}
      const items=leerItemsEditor();
      if(!items.length){avisar('Agregá al menos un renglón completo: descripción, cantidad y precio.');return false}
      const aplicaIVA=d.aplicaIVA==='on', t=totalesCompra(items,aplicaIVA);
      const datos={proveedorNit:d.proveedorNit.trim(),proveedorNombre:d.proveedorNombre.trim(),fecha:d.fecha||hoy(),
        fechaEntrega:d.fechaEntrega||'',items,aplicaIVA,...t,condiciones:d.condiciones.trim()};
      if(nuevo){
        const o={id:uid(),numero:proximoNumeroCompras(e,'OC','correlativoOC'),estado:'borrador',creadoPor:quienSoy(),
          cotizacionId:cot?cot.id:'',facturado:0,facturas:[],historial:[],...datos};
        historialOC(o,'Creada',cot?`A partir de la cotización ${cot.numero}`:'');
        (e.ordenesCompra=e.ordenesCompra||[]).push(o);
        if(cot){cot.ocId=o.id; cot.estado='elegida';}
        registrarLog('Creó una orden de compra',`${o.numero} — ${o.proveedorNombre} — Q${Q(t.total)}`);
      }else{ Object.assign(oc,datos); historialOC(oc,'Editada',''); registrarLog('Editó una orden de compra',oc.numero); }
      guardar(); pintar();
    },nuevo?'Guardar borrador':'Guardar cambios');
  enlazarProveedor(e); enlazarEditorItems();
}
ACCIONES.nuevaOrdenCompra=()=>formOrdenCompra(null,null);
ACCIONES.editarOrdenCompra=d=>{
  const oc=buscarOC(emp(),d.id);
  if(!oc) return;
  if(oc.estado!=='borrador'){avisar('Solo se edita una orden en borrador. Si fue rechazada, primero reabrila.');return}
  formOrdenCompra(oc,null);
};
ACCIONES.eliminarOrdenCompra=d=>{
  const e=emp(), oc=buscarOC(e,d.id);
  if(!oc) return;
  if(oc.estado!=='borrador'){avisar('Solo se elimina una orden en borrador. Una orden ya enviada se anula, no se borra.');return}
  confirmar(`Se eliminará el borrador ${oc.numero}.`,()=>{
    const c=oc.cotizacionId&&buscarCot(e,oc.cotizacionId); if(c){c.ocId='';}
    e.ordenesCompra=e.ordenesCompra.filter(x=>x.id!==oc.id); guardar(); pintar();},'Eliminar');
};
ACCIONES.enviarOrdenCompra=d=>{
  const e=emp(), oc=buscarOC(e,d.id);
  if(!oc) return;
  if(oc.estado!=='borrador'){avisar('Solo se envía a aprobación una orden en borrador.');return}
  const lim=+e.limiteAprobacionAuto||0, auto=lim>0&&oc.total<=lim;
  confirmar(auto
    ?`${oc.numero} es de Q${Q(oc.total)}, dentro del límite de aprobación automática (Q${Q(lim)}): queda aprobada al enviarla.`
    :`${oc.numero} (Q${Q(oc.total)}) pasa a aprobación. Un Gerente de Compras o el Administrador tiene que aprobarla.`,()=>{
    if(auto){
      oc.estado='aprobada'; oc.aprobadaPor={id:'',nombre:'Aprobación automática',fecha:new Date().toISOString()};
      historialOC(oc,'Aprobada automáticamente',`Monto dentro del límite de Q${Q(lim)}`);
    }else{ oc.estado='pendiente'; historialOC(oc,'Enviada a aprobación',''); }
    registrarLog('Envió una orden de compra',`${oc.numero} — ${auto?'aprobada automáticamente':'pendiente de aprobación'}`);
    guardar(); pintar();},'Enviar');
};
ACCIONES.aprobarOrdenCompra=d=>{
  const e=emp(), oc=buscarOC(e,d.id);
  if(!oc) return;
  if(!puedeAprobarCompras()){avisar('Tu rol no aprueba gastos. Lo hace el Gerente de Compras o el Administrador.');return}
  if(oc.estado!=='pendiente'){avisar('Esta orden no está pendiente de aprobación.');return}
  const propia=oc.creadoPor&&oc.creadoPor.id&&oc.creadoPor.id===quienSoy().id;
  confirmar(`Aprobar ${oc.numero} de ${oc.proveedorNombre} por Q${Q(oc.total)}.${propia?'\n\nLa preparaste vos mismo: quedará anotado en el historial.':''}`,()=>{
    oc.estado='aprobada'; oc.aprobadaPor={...quienSoy(),fecha:new Date().toISOString()};
    historialOC(oc,'Aprobada',propia?'Aprobó una orden que él mismo preparó':'');
    registrarLog('Aprobó una orden de compra',`${oc.numero} — Q${Q(oc.total)}`);
    guardar(); pintar();},'Aprobar');
};
ACCIONES.rechazarOrdenCompra=d=>{
  const e=emp(), oc=buscarOC(e,d.id);
  if(!oc) return;
  if(!puedeAprobarCompras()){avisar('Tu rol no aprueba gastos. Lo hace el Gerente de Compras o el Administrador.');return}
  if(oc.estado!=='pendiente'){avisar('Esta orden no está pendiente de aprobación.');return}
  abrirModal(`Rechazar ${esc(oc.numero)}`,
    `<p style="margin:0 0 10px;font-size:13px;color:var(--tinta-suave)">${esc(oc.proveedorNombre)} · Q${Q(oc.total)}. Quien la preparó va a ver el motivo.</p>
    <div class="campo full"><label>Motivo del rechazo</label><input name="motivo" placeholder="Ej.: Falta una tercera cotización"></div>`,
    f=>{
      if(!f.motivo.trim()){avisar('Escribí el motivo: sin él, quien preparó la orden no sabe qué corregir.');return false}
      oc.estado='rechazada'; oc.motivo=f.motivo.trim();
      historialOC(oc,'Rechazada',oc.motivo); registrarLog('Rechazó una orden de compra',`${oc.numero} — ${oc.motivo}`);
      guardar(); pintar();
    },'Rechazar');
};
ACCIONES.reabrirOrdenCompra=d=>{
  const oc=buscarOC(emp(),d.id);
  if(!oc||oc.estado!=='rechazada') return;
  oc.estado='borrador'; historialOC(oc,'Reabierta como borrador',''); guardar(); pintar();
};
ACCIONES.anularOrdenCompra=d=>{
  const e=emp(), oc=buscarOC(e,d.id);
  if(!oc) return;
  if(!puedeAprobarCompras()){avisar('Tu rol no anula órdenes ya enviadas. Lo hace el Gerente de Compras o el Administrador.');return}
  if(!['pendiente','aprobada'].includes(oc.estado)){avisar('Solo se anula una orden pendiente o aprobada.');return}
  if((oc.facturas||[]).length){avisar(`${oc.numero} ya tiene facturas vinculadas: no se puede anular.`);return}
  abrirModal(`Anular ${esc(oc.numero)}`,
    `<div class="campo full"><label>Motivo</label><input name="motivo" placeholder="Ej.: El proveedor no tenía existencia"></div>`,
    f=>{
      if(!f.motivo.trim()){avisar('Escribí el motivo de la anulación.');return false}
      oc.estado='anulada'; oc.motivo=f.motivo.trim(); historialOC(oc,'Anulada',oc.motivo);
      registrarLog('Anuló una orden de compra',`${oc.numero} — ${oc.motivo}`); guardar(); pintar();
    },'Anular');
};
ACCIONES.politicaAprobacion=()=>{
  const e=emp();
  if(!puedeAprobarCompras()){avisar('Solo el Gerente de Compras o el Administrador define la política de aprobación.');return}
  abrirModal('Política de aprobación de gastos',
    `<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">Las órdenes por un monto <strong>igual o menor</strong> a este límite se aprueban solas al enviarlas;
      las demás esperan a un Gerente de Compras o al Administrador. Con <strong>0</strong>, toda orden necesita aprobación.</p>
    <div class="campo"><label>Límite de aprobación automática (Q)</label><input name="limite" type="number" min="0" step="0.01" value="${+e.limiteAprobacionAuto||0}"></div>`,
    d=>{
      const v=r2(+d.limite||0);
      if(v<0){avisar('El límite no puede ser negativo.');return false}
      e.limiteAprobacionAuto=v; registrarLog('Cambió la política de aprobación de compras',`límite Q${Q(v)}`);
      guardar(); pintar();
    },'Guardar');
};
ACCIONES.tabCompras=d=>{comprasTab=d.val; pintar();};
ACCIONES.verOrdenCompra=d=>{
  const e=emp(), oc=buscarOC(e,d.id);
  if(!oc){avisar('No se encontró esa orden.');return}
  const cot=oc.cotizacionId&&buscarCot(e,oc.cotizacionId);
  abrirModal(`${esc(oc.numero)} — ${esc(oc.proveedorNombre)}`,
    `<p style="margin:0 0 10px;font-size:13px;color:var(--tinta-suave)">NIT ${esc(oc.proveedorNit||'—')} · ${fFecha(oc.fecha)}${oc.fechaEntrega?` · entrega ${fFecha(oc.fechaEntrega)}`:''}
      · <strong style="color:${COLOR_ESTADO_OC[oc.estado]}">${ESTADOS_OC[oc.estado]}</strong>
      ${cot?` · cotización ${esc(cot.numero)}`:''}</p>
    ${oc.motivo&&['rechazada','anulada'].includes(oc.estado)?`<div class="aviso malo">Motivo: ${esc(oc.motivo)}</div>`:''}
    <table style="font-size:13px"><thead><tr><th>Descripción</th><th class="num">Cantidad</th><th class="num">Precio</th><th class="num">Subtotal</th></tr></thead>
      <tbody>${oc.items.map(i=>`<tr><td>${esc(i.descripcion)}</td><td class="num">${i.cantidad}</td><td class="num">${Q(i.precio)}</td><td class="num">${Q(r2(i.cantidad*i.precio))}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="3">Subtotal</td><td class="num">${Q(oc.subtotal)}</td></tr><tr><td colspan="3">IVA</td><td class="num">${Q(oc.iva)}</td></tr>
      <tr class="total"><td colspan="3">Total</td><td class="num">${Q(oc.total)}</td></tr></tfoot></table>
    ${oc.condiciones?`<p style="font-size:13px;margin:8px 0 0"><strong>Condiciones:</strong> ${esc(oc.condiciones)}</p>`:''}
    <h4 style="margin:14px 0 6px;color:var(--verde);font-size:14px">Facturas vinculadas</h4>
    ${(oc.facturas||[]).length?`<table style="font-size:13px"><tbody>${oc.facturas.map(f=>`<tr><td>${fFecha(f.fecha)}</td><td>${esc(f.tipoDte||'FACT')} ${esc(f.serie||'')}${f.dte?'-'+esc(f.dte):''}</td>
        <td class="num">${f.signo===-1?'−':''}${Q(f.total)}</td></tr>`).join('')}</tbody>
      <tfoot><tr class="total"><td colspan="2">Facturado</td><td class="num">${Q(oc.facturado||0)}</td></tr>
      <tr><td colspan="2">Por facturar</td><td class="num">${Q(porFacturarOC(oc))}</td></tr></tfoot></table>`
      :`<p style="font-size:13px;color:var(--tinta-suave);margin:0">Todavía no hay facturas vinculadas.</p>`}
    <h4 style="margin:14px 0 6px;color:var(--verde);font-size:14px">Historial</h4>
    <table style="font-size:12.5px"><tbody>${(oc.historial||[]).map(h=>`<tr><td>${fFecha(h.fecha.slice(0,10))}</td><td>${esc(h.usuario||'—')}</td><td>${esc(h.accion)}${h.detalle?` — ${esc(h.detalle)}`:''}</td></tr>`).join('')}</tbody></table>`,
    ()=>{},'Cerrar');
};

/* ---- la pantalla ---- */
VISTAS.compras=()=>{
  const e=emp(), ocs=e.ordenesCompra||[], cots=e.cotizaciones||[], aprueba=puedeAprobarCompras();
  const pendientes=ocs.filter(o=>o.estado==='pendiente'), abiertas=ocs.filter(o=>o.estado==='aprobada');
  const pill=o=>`<span style="font-weight:600;color:${COLOR_ESTADO_OC[o.estado]}">${ESTADOS_OC[o.estado]}${o.estado==='aprobada'&&(o.facturado||0)>0?' · facturada en parte':''}</span>`;
  const botonesOC=o=>{
    const b=[`<button class="btn mini sec" data-accion="verOrdenCompra" data-id="${o.id}">Ver</button>`];
    if(o.estado==='borrador') b.push(`<button class="btn mini" data-accion="enviarOrdenCompra" data-id="${o.id}">Enviar a aprobación</button>`,
      `<button class="btn mini sec" data-accion="editarOrdenCompra" data-id="${o.id}">Editar</button>`,
      `<button class="btn mini peligro" data-accion="eliminarOrdenCompra" data-id="${o.id}">Eliminar</button>`);
    if(o.estado==='rechazada') b.push(`<button class="btn mini sec" data-accion="reabrirOrdenCompra" data-id="${o.id}">Reabrir</button>`);
    if(o.estado==='pendiente'&&aprueba) b.push(`<button class="btn mini" data-accion="aprobarOrdenCompra" data-id="${o.id}">Aprobar</button>`,
      `<button class="btn mini peligro" data-accion="rechazarOrdenCompra" data-id="${o.id}">Rechazar</button>`);
    if(['pendiente','aprobada'].includes(o.estado)&&aprueba&&!(o.facturas||[]).length) b.push(`<button class="btn mini peligro" data-accion="anularOrdenCompra" data-id="${o.id}">Anular</button>`);
    b.push(`<button class="btn mini sec" data-accion="pdfOrdenCompra" data-id="${o.id}">PDF</button>`);
    return b.join(' ');
  };
  const tabs=`<div class="segmentado" style="margin-bottom:16px">${[['ordenes','Órdenes de compra'],['cotizaciones','Cotizaciones'],
    ['aprobaciones','Aprobaciones'+(pendientes.length?` (${pendientes.length})`:'')]].map(([k,t])=>
    `<button type="button" class="seg-op${comprasTab===k?' on':''}" data-accion="tabCompras" data-val="${k}">${t}</button>`).join('')}</div>`;

  let cuerpo;
  if(comprasTab==='cotizaciones'){
    const grupos={}; cots.forEach(c=>{(grupos[c.requerimiento||'Sin requerimiento']=grupos[c.requerimiento||'Sin requerimiento']||[]).push(c);});
    cuerpo=Object.keys(grupos).length?Object.entries(grupos).map(([req,lista])=>{
      const vivas=lista.filter(c=>c.estado!=='descartada'), minimo=vivas.length>1?Math.min(...vivas.map(c=>c.total)):null;
      return `<h3 style="color:var(--verde);margin:20px 0 6px">${esc(req)}</h3>
      <table style="font-size:13px"><thead><tr><th>Cotización</th><th>Proveedor</th><th>Vigente hasta</th><th class="num">Total</th><th>Estado</th><th></th></tr></thead><tbody>
      ${lista.sort((a,b)=>a.total-b.total).map(c=>{
        const vencida=c.estado==='vigente'&&c.vigenteHasta&&c.vigenteHasta<hoy();
        const oc=c.ocId&&buscarOC(e,c.ocId);
        return `<tr${c.estado==='descartada'?' style="opacity:.55"':''}><td>${esc(c.numero)}<br><span style="color:var(--tinta-suave)">${fFecha(c.fecha)}</span></td>
          <td>${esc(c.proveedorNombre)}<br><span style="color:var(--tinta-suave)">${c.items.length} renglón(es)${c.notas?' · '+esc(c.notas):''}</span></td>
          <td>${c.vigenteHasta?fFecha(c.vigenteHasta):'—'}${vencida?'<br><span style="color:var(--alerta);font-size:12px">vencida</span>':''}</td>
          <td class="num"><strong>${Q(c.total)}</strong>${minimo!==null&&c.estado!=='descartada'&&c.total===minimo?'<br><span style="color:var(--verde);font-size:12px">la más baja</span>':''}</td>
          <td>${c.estado==='elegida'?(oc?`Elegida · ${esc(oc.numero)}`:'Elegida'):c.estado==='descartada'?'Descartada':'Vigente'}</td>
          <td class="num">${c.estado==='vigente'||c.estado==='descartada'?`<button class="btn mini" data-accion="elegirCotizacion" data-id="${c.id}">Elegir</button>`:''}
            ${c.estado==='elegida'&&!c.ocId?`<button class="btn mini" data-accion="ordenDesdeCotizacion" data-id="${c.id}">Crear orden de compra</button>
              <button class="btn mini sec" data-accion="reabrirCotizacion" data-id="${c.id}">Quitar elección</button>`:''}
            ${!c.ocId?`<button class="btn mini sec" data-accion="editarCotizacion" data-id="${c.id}">Editar</button>
              <button class="btn mini peligro" data-accion="eliminarCotizacion" data-id="${c.id}">Eliminar</button>`:''}</td></tr>`;}).join('')}
      </tbody></table>`;}).join('')
      :`<div class="vacio">Todavía no hay cotizaciones. Registrá las que te lleguen de cada proveedor y compará lado a lado cuál conviene.</div>`;
  }else if(comprasTab==='aprobaciones'){
    const resueltas=ocs.filter(o=>o.aprobadaPor||o.estado==='rechazada').sort((a,b)=>b.fecha.localeCompare(a.fecha)).slice(0,15);
    cuerpo=(aprueba?'':`<div class="aviso">Tu rol prepara las órdenes, pero no las aprueba. Esta es la cola de las que están esperando a un gerente.</div>`)
      +`<h3 style="color:var(--verde);margin:6px 0 6px">Esperando aprobación</h3>`
      +(pendientes.length?`<table style="font-size:13px"><thead><tr><th>Orden</th><th>Proveedor</th><th>Preparó</th><th class="num">Total</th><th></th></tr></thead><tbody>
        ${pendientes.map(o=>`<tr><td>${esc(o.numero)}<br><span style="color:var(--tinta-suave)">${fFecha(o.fecha)}</span></td><td>${esc(o.proveedorNombre)}<br>
          <span style="color:var(--tinta-suave)">${o.items.length} renglón(es)</span></td><td>${esc((o.creadoPor||{}).nombre||'—')}</td>
          <td class="num"><strong>${Q(o.total)}</strong></td><td class="num">${botonesOC(o)}</td></tr>`).join('')}</tbody></table>`
        :`<div class="vacio" style="padding:16px">No hay órdenes esperando aprobación.</div>`)
      +`<h3 style="color:var(--verde);margin:22px 0 6px">Resueltas recientemente</h3>`
      +(resueltas.length?`<table style="font-size:13px"><thead><tr><th>Orden</th><th>Proveedor</th><th class="num">Total</th><th>Resultado</th></tr></thead><tbody>
        ${resueltas.map(o=>`<tr><td>${esc(o.numero)}</td><td>${esc(o.proveedorNombre)}</td><td class="num">${Q(o.total)}</td>
          <td>${o.estado==='rechazada'?`<span style="color:var(--alerta)">Rechazada</span> — ${esc(o.motivo||'')}`
            :`Aprobada por ${esc((o.aprobadaPor||{}).nombre||'—')}${(o.aprobadaPor||{}).fecha?' el '+fFecha(o.aprobadaPor.fecha.slice(0,10)):''}`}</td></tr>`).join('')}</tbody></table>`
        :`<div class="vacio" style="padding:16px">Todavía no hay órdenes resueltas.</div>`);
  }else{
    cuerpo=ocs.length?`<table style="font-size:13px"><thead><tr><th>Orden</th><th>Proveedor</th><th class="num">Total</th><th class="num">Facturado</th><th>Estado</th><th></th></tr></thead><tbody>
      ${[...ocs].sort((a,b)=>b.numero.localeCompare(a.numero)).map(o=>`<tr><td>${esc(o.numero)}<br><span style="color:var(--tinta-suave)">${fFecha(o.fecha)}</span></td>
        <td>${esc(o.proveedorNombre)}<br><span style="color:var(--tinta-suave)">NIT ${esc(o.proveedorNit||'—')}</span></td>
        <td class="num"><strong>${Q(o.total)}</strong></td><td class="num">${Q(o.facturado||0)}</td><td>${pill(o)}${o.estado==='rechazada'&&o.motivo?`<br><span style="font-size:12px;color:var(--alerta)">${esc(o.motivo)}</span>`:''}</td>
        <td class="num">${botonesOC(o)}</td></tr>`).join('')}</tbody></table>`
      :`<div class="vacio">Todavía no hay órdenes de compra. Creá una a partir de una cotización, o directo con "Nueva orden de compra".</div>`;
  }
  const lim=+e.limiteAprobacionAuto||0;
  return cab('Compras','Cotizaciones, órdenes de compra y aprobación de gastos. Esto es previo a la factura: la contabilidad entra por "Cargar facturas".',
    `${aprueba?`<button class="btn sec" data-accion="politicaAprobacion">Política de aprobación</button>`:''}
     <button class="btn sec" data-accion="nuevaCotizacion">Nueva cotización</button>
     <button class="btn" data-accion="nuevaOrdenCompra">Nueva orden de compra</button>`)
  + `<div class="cifras">
      <div class="cifra"><span>Esperando aprobación</span><strong>${pendientes.length} · ${Q(r2(pendientes.reduce((s,o)=>s+o.total,0)))}</strong></div>
      <div class="cifra"><span>Aprobadas por facturar</span><strong>${Q(r2(abiertas.reduce((s,o)=>s+porFacturarOC(o),0)))}</strong></div>
      <div class="cifra"><span>Aprobación automática hasta</span><strong>${lim>0?Q(lim):'Ninguna'}</strong></div>
    </div>`+tabs+cuerpo;
};

/* ---- vínculo con "Cargar facturas" ---- */
/* Una orden se puede vincular a una factura solo si está aprobada y todavía no se facturó completa. */
const ocVinculable=(e,id)=>{const o=buscarOC(e,id);return !!o&&o.estado==='aprobada';};
function htmlCeldaOC(e,d,i){
  if(d.tipo!=='compra') return '<td style="color:var(--tinta-suave)">—</td>';
  const aprobadas=(e.ordenesCompra||[]).filter(o=>o.estado==='aprobada');
  const nit=normNIT(d.nitEmisor);
  const mias=aprobadas.filter(o=>nit&&normNIT(o.proveedorNit)===nit), otras=aprobadas.filter(o=>!mias.includes(o));
  const op=o=>`<option value="${o.id}"${d.ocId===o.id?' selected':''}>${esc(o.numero)} — ${esc(o.proveedorNombre)} — por facturar Q${Q(porFacturarOC(o))}</option>`;
  let nota='';
  const oc=d.ocId&&aprobadas.find(o=>o.id===d.ocId);
  if(oc){
    const rest=porFacturarOC(oc), monto=r2((d.signo||1)*d.total), dif=r2(monto-rest), tol=toleranciaOC(oc.total);
    const partes=[];
    if(normNIT(oc.proveedorNit)&&nit&&normNIT(oc.proveedorNit)!==nit) partes.push('<span style="color:var(--alerta)">El NIT no es el de la orden</span>');
    partes.push(dif>tol?`<span style="color:var(--alerta)">Excede lo que falta por facturar en Q${Q(dif)}</span>`
      :dif<-tol?`<span style="color:var(--tinta-suave)">Quedaría por facturar Q${Q(-dif)}</span>`
      :'<span style="color:var(--verde)">Coincide con la orden</span>');
    nota=`<br><span style="font-size:12px">${partes.join(' · ')}</span>`;
  }else if(d.ocId) nota='<br><span style="font-size:12px;color:var(--alerta)">La orden vinculada ya no está disponible.</span>';
  if(!aprobadas.length&&!d.ocId) return '<td style="color:var(--tinta-suave)">—</td>';
  return `<td style="min-width:170px"><select data-oc="${i}" style="max-width:210px"><option value="">${mias.length?`— sin orden (hay ${mias.length} de este proveedor) —`:'— sin orden —'}</option>
    ${mias.length?`<optgroup label="Del mismo proveedor">${mias.map(op).join('')}</optgroup>`:''}
    ${otras.length?`<optgroup label="Otras órdenes aprobadas">${otras.map(op).join('')}</optgroup>`:''}</select>${nota}</td>`;
}
/* Lo que cada orden recibiría en esta carga, contra lo que le falta por facturar. */
function resumenVinculosOC(e,docs){
  const por={};
  docs.filter(d=>d.tipo==='compra'&&d.ocId).forEach(d=>{por[d.ocId]=r2((por[d.ocId]||0)+(d.signo||1)*d.total);});
  return Object.entries(por).map(([id,monto])=>{
    const oc=buscarOC(e,id), rest=porFacturarOC(oc), tol=toleranciaOC(oc.total), dif=r2(monto-rest);
    return {oc,monto,rest,dif,excede:dif>tol,completa:Math.abs(dif)<=tol};
  });
}
function aplicarVinculosOC(e,docs){
  const lineas=[];
  docs.filter(d=>d.tipo==='compra'&&d.ocId).forEach(d=>{
    const oc=buscarOC(e,d.ocId); if(!oc) return;
    (oc.facturas=oc.facturas||[]).push({fecha:d.fecha,tipoDte:d.tipoDte||'FACT',serie:d.serie,dte:d.dte,total:r2(d.total),signo:d.signo||1});
    oc.facturado=r2(oc.facturas.reduce((s,f)=>s+f.signo*f.total,0));
    historialOC(oc,'Factura vinculada',`${d.tipoDte||'FACT'} ${d.serie||''}${d.dte?'-'+d.dte:''} por Q${Q(d.total)}`);
  });
  [...new Set(docs.filter(d=>d.tipo==='compra'&&d.ocId).map(d=>d.ocId))].forEach(id=>{
    const oc=buscarOC(e,id); if(!oc) return;
    if(oc.estado==='aprobada'&&porFacturarOC(oc)<=toleranciaOC(oc.total)){oc.estado='facturada'; historialOC(oc,'Facturada por completo','');}
    lineas.push(oc.estado==='facturada'?`${oc.numero}: facturada por completo.`:`${oc.numero}: queda por facturar Q${Q(porFacturarOC(oc))}.`);
  });
  return lineas;
}

/* ---- orden de compra en PDF ---- */
ACCIONES.pdfOrdenCompra=async d=>{
  const e=emp(), oc=buscarOC(e,d.id);
  if(!oc){avisar('No se encontró esa orden.');return}
  try{
    const jsPDF=await cargarJsPDF();
    const doc=new jsPDF({unit:'pt',format:'letter'});
    const y=encabezadoPDF(doc,`Orden de compra ${oc.numero}`,`Fecha ${fFecha(oc.fecha)} · ${ESTADOS_OC[oc.estado]}`);
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(40,40,40);
    doc.text(`Proveedor: ${oc.proveedorNombre}`,40,y+6); doc.text(`NIT: ${oc.proveedorNit||'—'}`,40,y+20);
    if(oc.fechaEntrega) doc.text(`Entrega esperada: ${fFecha(oc.fechaEntrega)}`,40,y+34);
    doc.autoTable({startY:y+48,margin:{left:40,right:40},theme:'grid',styles:{fontSize:9,cellPadding:4},headStyles:{fillColor:VERDE},
      head:[['#','Descripción','Cantidad','Precio unitario','Subtotal']],
      body:oc.items.map((it,i)=>[i+1,it.descripcion,String(it.cantidad),Q(it.precio),Q(r2(it.cantidad*it.precio))]),
      columnStyles:{0:{cellWidth:24},2:{halign:'right'},3:{halign:'right'},4:{halign:'right'}}});
    let y2=doc.lastAutoTable.finalY+16;
    const ancho=doc.internal.pageSize.getWidth();
    [['Subtotal',oc.subtotal],['IVA (12%)',oc.iva],['Total',oc.total]].forEach(([t,v],i)=>{
      doc.setFont('helvetica',i===2?'bold':'normal'); doc.text(t,ancho-200,y2); doc.text('Q'+Q(v),ancho-40,y2,{align:'right'}); y2+=15;});
    if(oc.condiciones){doc.setFont('helvetica','normal'); doc.text(doc.splitTextToSize(`Condiciones: ${oc.condiciones}`,ancho-80),40,y2+8); y2+=30;}
    y2=Math.max(y2+50,doc.lastAutoTable.finalY+110);
    doc.setDrawColor(120); doc.line(40,y2,230,y2); doc.line(ancho-230,y2,ancho-40,y2);
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text(`Elaboró: ${(oc.creadoPor||{}).nombre||''}`,40,y2+12);
    doc.text(oc.aprobadaPor?`Aprobó: ${oc.aprobadaPor.nombre}${oc.aprobadaPor.fecha?' — '+fFecha(oc.aprobadaPor.fecha.slice(0,10)):''}`:'Aprobación pendiente',ancho-230,y2+12);
    doc.save(`OrdenCompra-${oc.numero}-${archivoSeguro(e.nombre)}.pdf`);
  }catch(err){
    avisar('No se pudo generar el PDF: '+err.message+'\n\nEl generador se descarga de internet la primera vez, así que necesitás conexión.');
  }
};


