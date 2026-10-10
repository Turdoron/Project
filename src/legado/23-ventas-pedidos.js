/* ============ VENTAS: precios, cotizaciones, pedidos y entregas ============ */
/* El lado comercial de la venta. Nada de esto genera partidas: la contabilidad (ingreso, IVA, costo, cartera)
   sigue saliendo de la factura electrónica que se carga en "Cargar facturas". Lo único que toca es el
   inventario: cada entrega descuenta lo que salió (e.salidasInventario, motivo 'venta', con pedidoId), y al
   cargar después la factura de ese cliente, lo que ya salió con una entrega no se vuelve a descontar —la
   factura se liga sola al pedido (cubrirConEntregas)—. Una factura puede cubrir varios pedidos y un pedido
   puede facturarse en varias facturas: se cuadra por producto y cantidad.
   Datos: e.preciosVenta {producto:{precio,precioMayor,minMayor}}, e.cotizacionesVenta, e.pedidosVenta. */
let ventasTab='pedidos';
const ESTADOS_COT_VENTA={borrador:'Borrador',enviada:'Enviada',aceptada:'Aceptada',rechazada:'Rechazada',vencida:'Vencida'};
const lineaVenta=it=>r2((+it.cantidad||0)*(+it.precio||0)*(1-(+it.descuento||0)/100));
/* Los precios se manejan con IVA incluido, como se cotiza en Guatemala. En el régimen general se desglosa. */
function totalesVenta(e,items,fecha){
  const total=r2((items||[]).reduce((s,it)=>s+lineaVenta(it),0));
  if(regimenEn(e,fecha||hoy())!=='general') return {total,subtotal:total,iva:null};
  const subtotal=r2(total/1.12);
  return {total,subtotal,iva:r2(total-subtotal)};
}
function precioSugerido(e,producto,cantidad){
  const p=(e.preciosVenta||{})[producto]; if(!p) return '';
  if(p.precioMayor>0&&p.minMayor>0&&cantidad>=p.minMayor) return p.precioMayor;
  return p.precio>0?p.precio:'';
}
const venceCotizacion=c=>{ const d=new Date(c.fecha+'T00:00:00'); d.setDate(d.getDate()+(+c.vigenciaDias||0)); return d.toISOString().slice(0,10); };
const estadoCotizacion=c=>(['borrador','enviada'].includes(c.estado)&&c.vigenciaDias>0&&venceCotizacion(c)<hoy())?'vencida':c.estado;
/* Clientes que el sistema ya conoce: los de las facturas de venta y los de cotizaciones y pedidos anteriores. */
function clientesConocidos(e){
  const m={};
  const poner=(nit,nombre,direccion)=>{ const k=normNIT(nit); if(!k) return; m[k]=m[k]||{nit:String(nit).trim(),nombre:'',direccion:''};
    if(nombre) m[k].nombre=nombre; if(direccion) m[k].direccion=direccion; };
  (e.documentos||[]).filter(d=>d.tipo==='venta').forEach(d=>poner(d.nit,d.nombre));
  [...(e.cotizacionesVenta||[]),...(e.pedidosVenta||[])].forEach(x=>poner(x.clienteNit,x.clienteNombre,x.clienteDireccion));
  return Object.values(m).sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||'','es'));
}
/* ---- cantidades de un pedido ---- */
const entregadoLinea=(p,i)=>r2((p.entregas||[]).reduce((s,en)=>s+en.items.filter(x=>x.idx===i).reduce((a,x)=>a+x.cantidad,0),0));
/* Para cuadrar con facturas solo cuenta lo que salió del inventario (los servicios no se ligan). */
const entregadoProd=(p,prod)=>r2((p.entregas||[]).reduce((s,en)=>s+en.items.filter(x=>x.salidaId&&x.producto===prod).reduce((a,x)=>a+x.cantidad,0),0));
const facturadoProd=(p,prod)=>r2((p.facturas||[]).filter(f=>f.producto===prod).reduce((s,f)=>s+f.cantidad,0));
const pendienteLinea=(p,i)=>r2(p.items[i].cantidad-entregadoLinea(p,i));
const porFacturarPedido=p=>{ const prods=[...new Set(p.items.map(it=>it.producto))];
  return prods.map(prod=>({producto:prod,cantidad:r2(entregadoProd(p,prod)-facturadoProd(p,prod))})).filter(x=>x.cantidad>1e-9); };
function estadoPedido(p){
  if(p.anulado) return {clave:'anulado',texto:'Anulado',color:'var(--tinta-suave)'};
  const pend=p.items.some((it,i)=>pendienteLinea(p,i)>1e-9), algo=(p.entregas||[]).length>0;
  const sinFact=porFacturarPedido(p).length>0, fact=(p.facturas||[]).length>0;
  const hayInv=(p.entregas||[]).some(en=>en.items.some(x=>x.salidaId));
  if(!pend&&algo&&!sinFact) return {clave:'facturado',texto:hayInv?'Entregado y facturado':'Entregado',color:'var(--verde)'};
  if(!pend&&algo) return {clave:'entregado',texto:fact?'Entregado · facturado en parte':'Entregado · falta facturar',color:'var(--haber)'};
  if(algo) return {clave:'parcial',texto:'Entregado en parte'+(sinFact?'':' · facturado'),color:'var(--haber)'};
  return {clave:'pendiente',texto:'Por entregar',color:'var(--tinta)'};
}
const valorPendientePedido=p=>r2(p.items.reduce((s,it,i)=>s+lineaVenta({...it,cantidad:Math.max(0,pendienteLinea(p,i))}),0));
const valorSinFacturarPedido=p=>{ const precio={}; p.items.forEach(it=>{ if(!(it.producto in precio)) precio[it.producto]=it.cantidad?lineaVenta(it)/it.cantidad:0; });
  return r2(porFacturarPedido(p).reduce((s,x)=>s+x.cantidad*(precio[x.producto]||0),0)); };

/* Al cargar una factura de venta: lo que ese cliente ya recibió con entregas sin facturar queda cubierto por
   esta factura (pedido más antiguo primero) y no se descuenta otra vez del inventario. Devuelve lo cubierto. */
function cubrirConEntregas(e,doc,producto,cantidad){
  if(!(cantidad>0)) return 0;
  const nit=normNIT(doc.nit); let resta=cantidad;
  const peds=(e.pedidosVenta||[]).filter(p=>!p.anulado&&normNIT(p.clienteNit)===nit)
    .sort((a,b)=>(a.fecha||'').localeCompare(b.fecha||'')||a.numero-b.numero);
  for(const p of peds){
    if(resta<=1e-9) break;
    const pend=r2(entregadoProd(p,producto)-facturadoProd(p,producto)); if(pend<=1e-9) continue;
    const t=r2(Math.min(pend,resta));
    (p.facturas=p.facturas||[]).push({documentoId:doc.id,producto,cantidad:t,fecha:doc.fecha,ref:`${doc.serie?doc.serie+'-':''}${doc.dte||''}`});
    resta=r2(resta-t);
  }
  return r2(cantidad-resta);
}

/* Lo mismo con las ventas directas: si ya se descontó el producto con "Nueva venta directa", la factura de esa venta
   no lo vuelve a descontar. Se cubren las ventas directas sin factura, del mismo producto y de fecha igual o anterior. */
const facturadoVentaDirecta=s=>r2((s.facturas||[]).reduce((a,f)=>a+f.cantidad,0));
const esVentaDirectaSinFactura=s=>s.motivo==='venta'&&!s.documentoId&&!s.pedidoId&&!s.ajuste&&!s.referenciaId&&r2(s.cantidad-facturadoVentaDirecta(s))>1e-9;
function cubrirConVentasDirectas(e,doc,producto,cantidad){
  if(!(cantidad>0)) return 0;
  let resta=cantidad;
  (e.salidasInventario||[]).filter(s=>s.producto===producto&&(s.fecha||'')<=(doc.fecha||'')&&esVentaDirectaSinFactura(s))
    .sort((a,b)=>(a.fecha||'').localeCompare(b.fecha||'')).forEach(s=>{
      if(resta<=1e-9) return;
      const t=r2(Math.min(resta,s.cantidad-facturadoVentaDirecta(s)));
      (s.facturas=s.facturas||[]).push({documentoId:doc.id,cantidad:t,ref:`${doc.serie?doc.serie+'-':''}${doc.dte||''}`});
      resta=r2(resta-t);
    });
  return r2(cantidad-resta);
}

/* ---- pestañas ---- */
ACCIONES.verVentasTab=d=>{ ventasTab=d.tab; pintar(); };
VISTAS.ventas=()=>{
  const e=emp();
  const peds=e.pedidosVenta||[], abiertos=peds.filter(p=>!p.anulado&&estadoPedido(p).clave!=='facturado');
  const tabs=`<div class="segmentado" style="margin-bottom:16px">${[['pedidos','Pedidos'+(abiertos.length?` (${abiertos.length})`:'')],['cotizaciones','Cotizaciones'],['precios','Precios'],['directas','Venta directa y consignación']]
    .map(([k,t])=>`<button type="button" class="seg-op${ventasTab===k?' on':''}" data-accion="verVentasTab" data-tab="${k}">${t}</button>`).join('')}</div>`;
  const botones={pedidos:`<button class="btn" data-accion="nuevoPedidoVenta">Nuevo pedido</button>`,
    cotizaciones:`<button class="btn" data-accion="nuevaCotizacionVenta">Nueva cotización</button>`,
    precios:'',directas:`<button class="btn" data-accion="nuevaVentaDirecta">Nueva venta directa</button>
     <button class="btn sec" data-accion="nuevaConsignacion">Nueva consignación</button>`}[ventasTab]||'';
  const cuerpo={pedidos:cuerpoPedidosVenta,cotizaciones:cuerpoCotizacionesVenta,precios:cuerpoPreciosVenta,directas:cuerpoVentasDirectas}[ventasTab]||cuerpoPedidosVenta;
  return cab('Ventas','Cotizaciones, pedidos y entregas. La contabilidad de cada venta sale, como siempre, de la factura que se carga en "Cargar facturas".',botones)
    + tabs + cuerpo(e);
};
function cuerpoPedidosVenta(e){
  const peds=(e.pedidosVenta||[]).slice().sort((a,b)=>b.numero-a.numero);
  if(!peds.length) return `<div class="vacio">Todavía no hay pedidos. Creá uno con "Nuevo pedido" o convertí una cotización aceptada.</div>`;
  const vivos=peds.filter(p=>!p.anulado);
  const porEntregar=r2(vivos.reduce((s,p)=>s+valorPendientePedido(p),0)), sinFacturar=r2(vivos.reduce((s,p)=>s+valorSinFacturarPedido(p),0));
  const filas=peds.map(p=>{ const st=estadoPedido(p), t=totalesVenta(e,p.items,p.fecha);
    const b=[`<button class="btn mini sec" data-accion="verPedidoVenta" data-id="${p.id}">Ver</button>`];
    if(!p.anulado&&p.items.some((it,i)=>pendienteLinea(p,i)>1e-9)) b.unshift(`<button class="btn mini" data-accion="entregarPedidoVenta" data-id="${p.id}">Entregar</button>`);
    b.push(`<button class="btn mini sec" data-accion="pdfPedidoVenta" data-id="${p.id}">PDF</button>`);
    return `<tr${p.anulado?' style="opacity:.55"':''}><td>No. ${p.numero}</td><td>${fFecha(p.fecha)}</td>
      <td>${esc(p.clienteNombre||'—')}<br><span style="font-size:12px;color:var(--tinta-suave)">NIT ${esc(p.clienteNit||'—')}</span></td>
      <td class="num">${Q(t.total)}</td><td><span style="font-weight:600;color:${st.color}">${st.texto}</span>${p.fechaEntrega&&['pendiente','parcial'].includes(st.clave)?`<br><span style="font-size:12px;color:${p.fechaEntrega<hoy()?'var(--alerta)':'var(--tinta-suave)'}">Entrega ${fFecha(p.fechaEntrega)}</span>`:''}</td>
      <td class="num" style="white-space:nowrap">${b.join(' ')}</td></tr>`; }).join('');
  return `<div class="cifras">
      <div class="cifra"><span>Pedidos abiertos</span><strong>${vivos.filter(p=>estadoPedido(p).clave!=='facturado').length}</strong></div>
      <div class="cifra"><span>Por entregar</span><strong>${Q(porEntregar)}</strong></div>
      <div class="cifra"><span>Entregado sin facturar</span><strong>${Q(sinFacturar)}</strong></div></div>
    <div class="aviso">Cada entrega descuenta el inventario. Cuando cargues la factura de ese cliente, se liga sola a sus
      pedidos entregados (por NIT, producto y cantidad) y lo que ya salió no se descuenta otra vez.</div>
    <table><thead><tr><th>Pedido</th><th>Fecha</th><th>Cliente</th><th class="num">Total</th><th>Estado</th><th class="num"></th></tr></thead>
    <tbody>${filas}</tbody></table>`;
}
function cuerpoCotizacionesVenta(e){
  const cots=(e.cotizacionesVenta||[]).slice().sort((a,b)=>b.numero-a.numero);
  if(!cots.length) return `<div class="vacio">Todavía no hay cotizaciones. Creá una con "Nueva cotización": sale en PDF con los datos de la empresa.</div>`;
  const color={borrador:'var(--tinta-suave)',enviada:'var(--haber)',aceptada:'var(--verde)',rechazada:'var(--alerta)',vencida:'var(--tinta-suave)'};
  return `<table><thead><tr><th>Cotización</th><th>Fecha</th><th>Cliente</th><th class="num">Total</th><th>Estado</th><th class="num"></th></tr></thead><tbody>
    ${cots.map(c=>{ const st=estadoCotizacion(c), t=totalesVenta(e,c.items,c.fecha), b=[];
      if(st!=='aceptada'&&st!=='rechazada') b.push(`<button class="btn mini" data-accion="pedidoDesdeCotizacion" data-id="${c.id}">Aceptada → pedido</button>`);
      if(!c.pedidoId) b.push(`<button class="btn mini sec" data-accion="editarCotizacionVenta" data-id="${c.id}">Editar</button>`);
      if(st==='borrador') b.push(`<button class="btn mini sec" data-accion="marcarCotizacionVenta" data-id="${c.id}" data-estado="enviada">Enviada</button>`);
      if(st==='enviada'||st==='vencida') b.push(`<button class="btn mini sec" data-accion="marcarCotizacionVenta" data-id="${c.id}" data-estado="rechazada">Rechazada</button>`);
      b.push(`<button class="btn mini sec" data-accion="pdfCotizacionVenta" data-id="${c.id}">PDF</button>`);
      if(!c.pedidoId) b.push(`<button class="btn mini peligro" data-accion="eliminarCotizacionVenta" data-id="${c.id}" aria-label="Eliminar cotización ${c.numero}">×</button>`);
      const ped=c.pedidoId&&(e.pedidosVenta||[]).find(p=>p.id===c.pedidoId);
      return `<tr><td>No. ${c.numero}</td><td>${fFecha(c.fecha)}</td>
        <td>${esc(c.clienteNombre||'—')}<br><span style="font-size:12px;color:var(--tinta-suave)">NIT ${esc(c.clienteNit||'—')}</span></td>
        <td class="num">${Q(t.total)}</td><td><span style="font-weight:600;color:${color[st]}">${ESTADOS_COT_VENTA[st]}</span>
        <br><span style="font-size:12px;color:var(--tinta-suave)">${ped?`Pedido No. ${ped.numero}`:c.vigenciaDias>0?`Válida hasta ${fFecha(venceCotizacion(c))}`:''}</span></td>
        <td class="num" style="white-space:nowrap">${b.join(' ')}</td></tr>`; }).join('')}</tbody></table>`;
}
function cuerpoPreciosVenta(e){
  const lista=inventarioDetalle(e).lista, precios=e.preciosVenta||{};
  const nombres=[...new Set([...lista.map(p=>p.producto),...Object.keys(precios)])].sort((a,b)=>a.localeCompare(b,'es'));
  if(!nombres.length) return `<div class="vacio">Todavía no hay productos en el inventario. Aparecen al cargar compras con detalle de producto.</div>`;
  const filas=nombres.map(n=>{ const k=lista.find(p=>p.producto===n), pr=precios[n]||{}, cu=k?k.costoUnitario:0;
    const margen=pr.precio>0&&cu>0?r2((pr.precio/1.12-cu)/(pr.precio/1.12)*100):null;
    return `<tr><td>${esc(n)}</td><td class="num">${k?Q(k.cantidad).replace(/\.00$/,''):'—'}</td><td class="num">${cu?Q(cu):'—'}</td>
      <td class="num">${pr.precio>0?Q(pr.precio):'—'}</td><td class="num">${pr.precioMayor>0?`${Q(pr.precioMayor)}<br><span style="font-size:12px;color:var(--tinta-suave)">desde ${pr.minMayor} u.</span>`:'—'}</td>
      <td class="num"${margen!==null&&margen<0?' style="color:var(--alerta)"':''}>${margen===null?'—':margen+' %'}</td>
      <td class="num"><button class="btn mini sec" data-accion="editarPrecioVenta" data-producto="${esc(n)}">Precio</button></td></tr>`; }).join('');
  return `<div class="aviso">Precios de venta con IVA incluido. En "Precio" también se le liga el código de barras a cada producto. Al armar una cotización o un pedido, el precio se llena solo
      (el de mayoreo si la cantidad llega al mínimo). El margen se calcula sobre el precio sin IVA contra el costo del inventario.</div>
    <table><thead><tr><th>Producto</th><th class="num">Existencia</th><th class="num">Costo unitario</th><th class="num">Precio</th>
      <th class="num">Precio por mayor</th><th class="num">Margen</th><th class="num"></th></tr></thead><tbody>${filas}</tbody></table>`;
}
ACCIONES.editarPrecioVenta=d=>{
  const e=emp(), n=d.producto, pr=(e.preciosVenta||{})[n]||{}, k=inventarioDetalle(e).lista.find(p=>p.producto===n);
  abrirModal(`Precio de venta — ${esc(n)}`,
    `<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">${k?`Costo unitario en inventario: Q${Q(k.costoUnitario)}. `:''}Los precios llevan el IVA incluido.</p>
    <div class="rej"><div class="campo"><label>Precio unitario</label><input name="precio" type="number" min="0" step="0.01" value="${pr.precio||''}"></div>
      <div class="campo"><label>Precio por mayor (opcional)</label><input name="precioMayor" type="number" min="0" step="0.01" value="${pr.precioMayor||''}"></div>
      <div class="campo"><label>Por mayor desde (unidades)</label><input name="minMayor" type="number" min="0" step="1" value="${pr.minMayor||''}"></div></div>
    <p class="ayuda-campo" id="pvMargen" aria-live="polite"></p>
    ${htmlCampoCodigos(e,n)}`,
    f=>{
      const precio=+f.precio||0, precioMayor=+f.precioMayor||0, minMayor=+f.minMayor||0;
      if(precioMayor>0&&!(minMayor>0)){avisar('Escribí desde cuántas unidades aplica el precio por mayor.');return false}
      const choca=guardarCodigos(e,n,f.codigos); if(choca){avisar(choca);return false}
      e.preciosVenta=e.preciosVenta||{};
      if(!precio&&!precioMayor) delete e.preciosVenta[n]; else e.preciosVenta[n]={precio,precioMayor,minMayor:precioMayor>0?minMayor:0};
      registrarLog('Cambió un precio de venta',`${n} — Q${Q(precio)}`); guardar(); pintar();
    },'Guardar');
  const ver=()=>{ const p=+mForm.querySelector('[name="precio"]').value||0;
    document.getElementById('pvMargen').textContent=k&&p>0?`Margen: ${r2((p/1.12-k.costoUnitario)/(p/1.12)*100)} % (ganancia de Q${Q(r2(p/1.12-k.costoUnitario))} por unidad, sin IVA).`:''; };
  mForm.querySelector('[name="precio"]').addEventListener('input',ver); ver();
};

/* ---- editor de cotización / pedido ---- */
const filaItemVenta=(it={})=>`<tr data-iv><td><input data-c="prod" list="dlProdVenta" value="${esc(it.producto||'')}" placeholder="Producto o servicio" style="width:100%;min-width:180px" aria-label="Producto"></td>
  <td><input data-c="cant" type="number" min="0" step="0.01" value="${it.cantidad===undefined?1:it.cantidad}" style="width:76px;text-align:right" aria-label="Cantidad"></td>
  <td><input data-c="precio" type="number" min="0" step="0.01" value="${it.precio===undefined?'':it.precio}" style="width:96px;text-align:right" aria-label="Precio unitario"></td>
  <td><input data-c="desc" type="number" min="0" max="100" step="0.01" value="${it.descuento||''}" placeholder="0" style="width:62px;text-align:right" aria-label="Descuento en porcentaje"></td>
  <td class="num" data-sub></td><td><button type="button" class="btn mini peligro" data-quitar aria-label="Quitar renglón">×</button></td></tr>`;
function formDocVenta(e,tipo,x){
  const cli=clientesConocidos(e), lista=inventarioDetalle(e).lista;
  const prods=[...new Set([...lista.map(p=>p.producto),...Object.keys(e.preciosVenta||{})])].sort((a,b)=>a.localeCompare(b,'es'));
  return `<datalist id="dlCliVenta">${cli.map(c=>`<option value="${esc(c.nit)}">${esc(c.nombre)}</option>`).join('')}</datalist>
    <datalist id="dlProdVenta">${prods.map(p=>{ const k=lista.find(y=>y.producto===p); return `<option value="${esc(p)}">${k?`${Q(k.cantidad).replace(/\.00$/,'')} en existencia`:'sin existencia'}</option>`; }).join('')}</datalist>
    <div class="rej">
      <div class="campo"><label>NIT del cliente</label><input name="clienteNit" list="dlCliVenta" value="${esc(x?x.clienteNit:'')}" placeholder="NIT o CF" autocomplete="off"></div>
      <div class="campo"><label>Nombre del cliente</label><input name="clienteNombre" value="${esc(x?x.clienteNombre:'')}"></div>
      <div class="campo full"><label>Dirección (opcional)</label><input name="clienteDireccion" value="${esc(x?x.clienteDireccion||'':'')}"></div>
      <div class="campo"><label>Fecha</label><input name="fecha" type="date" value="${x?x.fecha:hoy()}"></div>
      ${tipo==='cotizacion'?`<div class="campo"><label>Válida por (días)</label><input name="vigenciaDias" type="number" min="0" step="1" value="${x?x.vigenciaDias:15}"></div>`
        :`<div class="campo"><label>Entrega comprometida (opcional)</label><input name="fechaEntrega" type="date" value="${x?x.fechaEntrega||'':''}"></div>`}
      <div class="campo full"><label>Condiciones de pago</label><input name="condiciones" value="${esc(x?x.condiciones||'':'Contado')}" placeholder="Contado, crédito 30 días…"></div>
    </div>
    <div style="margin-top:12px">${htmlEscaner()}</div>
    <table style="font-size:13px;margin-top:10px"><thead><tr><th>Producto o servicio</th><th class="num">Cantidad</th><th class="num">Precio (con IVA)</th><th class="num">Desc. %</th><th class="num">Subtotal</th><th></th></tr></thead>
      <tbody id="tbVentaItems">${(x&&x.items.length?x.items:[{}]).map(filaItemVenta).join('')}</tbody></table>
    <button type="button" class="btn mini sec" id="btnAddItemVenta" style="margin-top:6px">+ Agregar renglón</button>
    <p id="totVenta" style="margin:10px 0 4px;font-size:14px"></p><p class="ayuda-campo" id="avisoVenta" aria-live="polite" style="margin:0"></p>
    <div class="campo full" style="margin-top:10px"><label>Notas (opcional, salen en el PDF)</label><input name="notas" value="${esc(x?x.notas||'':'')}" placeholder="Tiempo de entrega, garantía…"></div>`;
}
function leerItemsVenta(){
  return [...mForm.querySelectorAll('[data-iv]')].map(tr=>({producto:tr.querySelector('[data-c="prod"]').value.trim().replace(/\s+/g,' '),
    cantidad:+tr.querySelector('[data-c="cant"]').value||0, precio:+tr.querySelector('[data-c="precio"]').value||0,
    descuento:Math.min(100,Math.max(0,+tr.querySelector('[data-c="desc"]').value||0)),
    sinPrecio:tr.querySelector('[data-c="precio"]').value===''})).filter(it=>it.producto||it.precio);
}
function enlazarFormDocVenta(e,tipo){
  const tb=mForm.querySelector('#tbVentaItems'), lista=inventarioDetalle(e).lista;
  const nit=mForm.querySelector('[name="clienteNit"]'), nom=mForm.querySelector('[name="clienteNombre"]'), dir=mForm.querySelector('[name="clienteDireccion"]');
  nit.addEventListener('change',()=>{ const c=clientesConocidos(e).find(y=>normNIT(y.nit)===normNIT(nit.value));
    if(c){ if(!nom.value) nom.value=c.nombre; if(!dir.value&&c.direccion) dir.value=c.direccion; }
    if(normNIT(nit.value)==='CF'&&!nom.value) nom.value='Consumidor final'; });
  const recalcular=()=>{
    tb.querySelectorAll('[data-iv]').forEach(tr=>{ const it={cantidad:+tr.querySelector('[data-c="cant"]').value||0,precio:+tr.querySelector('[data-c="precio"]').value||0,descuento:+tr.querySelector('[data-c="desc"]').value||0};
      tr.querySelector('[data-sub]').textContent=it.cantidad&&it.precio?Q(lineaVenta(it)):''; });
    const items=leerItemsVenta(), t=totalesVenta(e,items,mForm.querySelector('[name="fecha"]').value);
    mForm.querySelector('#totVenta').innerHTML=t.iva===null?`<strong>Total Q${Q(t.total)}</strong>`:`Subtotal sin IVA Q${Q(t.subtotal)} · IVA Q${Q(t.iva)} · <strong>Total Q${Q(t.total)}</strong>`;
    /* Aviso (no bloquea): lo pedido que pasa de la existencia actual. */
    const pedido={}; items.forEach(it=>{ pedido[it.producto]=(pedido[it.producto]||0)+it.cantidad; });
    const faltan=Object.entries(pedido).map(([p,c])=>{ const k=lista.find(y=>y.producto===p); return k&&c>k.cantidad+1e-9?`${p} (hay ${Q(k.cantidad).replace(/\.00$/,'')})`:null; }).filter(Boolean);
    mForm.querySelector('#avisoVenta').textContent=faltan.length?`Más de lo que hay en existencia: ${faltan.join(', ')}.`:'';
  };
  tb.addEventListener('input',ev=>{
    const tr=ev.target.closest('[data-iv]'); if(!tr) return;
    const pr=tr.querySelector('[data-c="precio"]');
    if(ev.target.dataset.c==='precio') delete tr.dataset.auto;
    if(ev.target.dataset.c==='prod'||ev.target.dataset.c==='cant'){
      const sug=precioSugerido(e,tr.querySelector('[data-c="prod"]').value.trim(),+tr.querySelector('[data-c="cant"]').value||0);
      if(sug!==''&&(pr.value===''||tr.dataset.auto)){ pr.value=sug; tr.dataset.auto='1'; }
    }
    recalcular();
  });
  tb.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();ev.stopPropagation();}});
  tb.addEventListener('click',ev=>{ if(!ev.target.matches('[data-quitar]')) return;
    ev.target.closest('[data-iv]').remove(); if(!tb.querySelector('[data-iv]')) tb.insertAdjacentHTML('beforeend',filaItemVenta({})); recalcular(); });
  mForm.querySelector('#btnAddItemVenta').onclick=()=>{ tb.insertAdjacentHTML('beforeend',filaItemVenta({})); tb.querySelector('[data-iv]:last-child [data-c="prod"]').focus(); recalcular(); };
  mForm.querySelector('[name="fecha"]').addEventListener('change',recalcular);
  /* Lector de código de barras: suma 1 al renglón de ese producto (con su precio, el de mayoreo si llega) o lo agrega. */
  const prods=[...new Set([...lista.map(p=>p.producto),...Object.keys(e.preciosVenta||{})])].sort((a,b)=>a.localeCompare(b,'es'));
  enlazarEscaner(e,prod=>{
    let tr=[...tb.querySelectorAll('[data-iv]')].find(x=>x.querySelector('[data-c="prod"]').value.trim()===prod);
    if(!tr) tr=[...tb.querySelectorAll('[data-iv]')].find(x=>!x.querySelector('[data-c="prod"]').value.trim());
    if(!tr){ tb.insertAdjacentHTML('beforeend',filaItemVenta({})); tr=tb.querySelector('[data-iv]:last-child'); }
    const pr=tr.querySelector('[data-c="prod"]'), c=tr.querySelector('[data-c="cant"]'), precio=tr.querySelector('[data-c="precio"]');
    if(pr.value.trim()===prod) c.value=r2((+c.value||0)+1); else { pr.value=prod; c.value=1; }
    const sug=precioSugerido(e,prod,+c.value);
    if(sug!==''&&(precio.value===''||tr.dataset.auto)){ precio.value=sug; tr.dataset.auto='1'; }
    recalcular();
    return `Agregado: ${prod} (${c.value})`;
  },prods);
  recalcular();
}
/* Valida y arma los datos comunes. Devuelve null (y avisa) si falta algo. */
function datosDocVenta(f){
  const items=leerItemsVenta();
  if(!(f.clienteNombre||'').trim()&&!(f.clienteNit||'').trim()){avisar('Escribí el cliente (NIT o nombre).');return null}
  if(!f.fecha){avisar('Elegí la fecha.');return null}
  if(!items.length){avisar('Agregá al menos un producto.');return null}
  if(items.some(it=>!it.producto)){avisar('Hay un renglón sin producto.');return null}
  if(items.some(it=>!(it.cantidad>0))){avisar('Cada renglón necesita una cantidad mayor que cero.');return null}
  if(items.some(it=>it.sinPrecio)){avisar('Cada renglón necesita su precio (puede ser 0 si es bonificación).');return null}
  return {clienteNit:(f.clienteNit||'').trim().toUpperCase(),clienteNombre:(f.clienteNombre||'').trim(),clienteDireccion:(f.clienteDireccion||'').trim(),
    fecha:f.fecha,condiciones:(f.condiciones||'').trim(),notas:(f.notas||'').trim(),items:items.map(({sinPrecio,...it})=>it)};
}
const autorVenta=()=>{ const u=usuarioActual(); return u?{id:u.id,nombre:u.nombre}:null; };

/* ---- cotizaciones ---- */
function formCotizacionVenta(c){
  const e=emp();
  abrirModal(c?`Cotización No. ${c.numero}`:'Nueva cotización',formDocVenta(e,'cotizacion',c),f=>{
    const datos=datosDocVenta(f); if(!datos) return false;
    datos.vigenciaDias=Math.max(0,Math.round(+f.vigenciaDias||0));
    if(c) Object.assign(c,datos);
    else{ e.cotizacionesVenta=e.cotizacionesVenta||[]; e.correlativoCotV=(e.correlativoCotV||0)+1;
      e.cotizacionesVenta.push({id:uid(),numero:e.correlativoCotV,estado:'borrador',...datos,creado:new Date().toISOString(),creadoPor:autorVenta()}); }
    registrarLog(c?'Editó una cotización de venta':'Creó una cotización de venta',`${datos.clienteNombre} — Q${Q(totalesVenta(e,datos.items,datos.fecha).total)}`);
    ventasTab='cotizaciones'; guardar(); pintar();
  },c?'Guardar':'Crear cotización');
  enlazarFormDocVenta(e,'cotizacion');
}
ACCIONES.nuevaCotizacionVenta=()=>formCotizacionVenta(null);
ACCIONES.editarCotizacionVenta=d=>{ const c=(emp().cotizacionesVenta||[]).find(x=>x.id===d.id); if(c) formCotizacionVenta(c); };
ACCIONES.marcarCotizacionVenta=d=>{ const e=emp(), c=(e.cotizacionesVenta||[]).find(x=>x.id===d.id); if(!c) return;
  c.estado=d.estado; registrarLog('Marcó una cotización de venta',`No. ${c.numero} — ${ESTADOS_COT_VENTA[d.estado]}`); guardar(); pintar(); };
ACCIONES.eliminarCotizacionVenta=d=>{
  if(!puedeEliminar()){avisar('Tu rol no tiene permiso para eliminar.');return}
  const e=emp(), c=(e.cotizacionesVenta||[]).find(x=>x.id===d.id); if(!c) return;
  confirmar(`Se eliminará la cotización No. ${c.numero} de ${c.clienteNombre||c.clienteNit}.`,()=>{
    e.cotizacionesVenta=e.cotizacionesVenta.filter(x=>x.id!==c.id); registrarLog('Eliminó una cotización de venta',`No. ${c.numero}`); guardar(); pintar(); });
};
ACCIONES.pedidoDesdeCotizacion=d=>{
  const e=emp(), c=(e.cotizacionesVenta||[]).find(x=>x.id===d.id); if(!c) return;
  confirmar(`La cotización No. ${c.numero} queda aceptada y se crea un pedido con sus mismos productos y precios. Después podés registrar las entregas.`,()=>{
    const p=nuevoPedido(e,{clienteNit:c.clienteNit,clienteNombre:c.clienteNombre,clienteDireccion:c.clienteDireccion,fecha:hoy(),condiciones:c.condiciones,notas:c.notas,
      items:c.items.map(it=>({...it})),cotizacionId:c.id});
    c.estado='aceptada'; c.pedidoId=p.id;
    registrarLog('Convirtió una cotización en pedido',`Cotización ${c.numero} → pedido ${p.numero}`);
    ventasTab='pedidos'; guardar(); pintar();
    avisar(`Se creó el pedido No. ${p.numero}.`,'Listo');
  },'Crear pedido');
};

/* ---- pedidos ---- */
function nuevoPedido(e,datos){
  e.pedidosVenta=e.pedidosVenta||[]; e.correlativoPedV=(e.correlativoPedV||0)+1;
  const p={id:uid(),numero:e.correlativoPedV,fechaEntrega:'',...datos,entregas:[],facturas:[],creado:new Date().toISOString(),creadoPor:autorVenta()};
  e.pedidosVenta.push(p); return p;
}
function formPedidoVenta(p){
  const e=emp();
  abrirModal(p?`Pedido No. ${p.numero}`:'Nuevo pedido',formDocVenta(e,'pedido',p),f=>{
    const datos=datosDocVenta(f); if(!datos) return false;
    datos.fechaEntrega=f.fechaEntrega||'';
    if(p) Object.assign(p,datos); else p=nuevoPedido(e,datos);
    registrarLog('Guardó un pedido de venta',`No. ${p.numero} — ${datos.clienteNombre} — Q${Q(totalesVenta(e,datos.items,datos.fecha).total)}`);
    ventasTab='pedidos'; guardar(); pintar();
  },p?'Guardar':'Crear pedido');
  enlazarFormDocVenta(e,'pedido');
}
ACCIONES.nuevoPedidoVenta=()=>formPedidoVenta(null);
ACCIONES.verPedidoVenta=d=>{
  const e=emp(), p=(e.pedidosVenta||[]).find(x=>x.id===d.id); if(!p) return;
  const st=estadoPedido(p), t=totalesVenta(e,p.items,p.fecha);
  const lineas=p.items.map((it,i)=>`<tr><td>${esc(it.producto)}</td><td class="num">${Q(it.cantidad).replace(/\.00$/,'')}</td>
    <td class="num">${Q(entregadoLinea(p,i)).replace(/\.00$/,'')}</td><td class="num">${Q(Math.max(0,pendienteLinea(p,i))).replace(/\.00$/,'')}</td><td class="num">${Q(lineaVenta(it))}</td></tr>`).join('');
  const entregas=(p.entregas||[]).map(en=>`<tr><td>Envío ${p.numero}-${en.numero}</td><td>${fFecha(en.fecha)}</td>
    <td>${en.items.map(x=>`${esc(x.producto)}: ${Q(x.cantidad).replace(/\.00$/,'')}`).join('<br>')}</td><td>${esc(en.recibe||'—')}</td>
    <td class="num" style="white-space:nowrap"><button type="button" class="btn mini sec" data-pdfent="${en.id}">PDF</button>
      ${p.anulado?'':`<button type="button" class="btn mini peligro" data-anularent="${en.id}">Anular</button>`}</td></tr>`).join('');
  const facts=(p.facturas||[]).map(f=>`<li>Factura ${esc(f.ref||'')} del ${fFecha(f.fecha)}: ${esc(f.producto)} × ${Q(f.cantidad).replace(/\.00$/,'')}</li>`).join('');
  const sinF=porFacturarPedido(p);
  abrirModal(`Pedido No. ${p.numero} — ${esc(p.clienteNombre||p.clienteNit)}`,
    `<p style="margin:0 0 10px;font-size:13px;color:var(--tinta-suave)">${fFecha(p.fecha)} · NIT ${esc(p.clienteNit||'—')} · <strong style="color:${st.color}">${st.texto}</strong>${p.fechaEntrega?` · entrega comprometida ${fFecha(p.fechaEntrega)}`:''}${p.condiciones?` · ${esc(p.condiciones)}`:''}</p>
    <table style="font-size:13px"><thead><tr><th>Producto</th><th class="num">Pedido</th><th class="num">Entregado</th><th class="num">Pendiente</th><th class="num">Valor</th></tr></thead>
      <tbody>${lineas}</tbody><tfoot><tr class="total"><td colspan="4">Total${t.iva!==null?' (IVA incluido)':''}</td><td class="num">${Q(t.total)}</td></tr></tfoot></table>
    <h4 style="margin:16px 0 6px">Entregas</h4>
    ${entregas?`<table style="font-size:13px"><tbody>${entregas}</tbody></table>`:'<p style="margin:0;font-size:13px;color:var(--tinta-suave)">Todavía no se ha entregado nada.</p>'}
    <h4 style="margin:16px 0 6px">Facturas ligadas</h4>
    ${facts?`<ul style="margin:0;padding-left:18px;font-size:13px">${facts}</ul>`:'<p style="margin:0;font-size:13px;color:var(--tinta-suave)">Ninguna todavía: se ligan solas al cargar la factura de este cliente.</p>'}
    ${sinF.length?`<p style="margin:8px 0 0;font-size:13px;color:var(--haber)">Entregado sin facturar: ${sinF.map(x=>`${esc(x.producto)} × ${Q(x.cantidad).replace(/\.00$/,'')}`).join(', ')}</p>`:''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
      ${!p.anulado&&!(p.entregas||[]).length?`<button type="button" class="btn mini sec" id="pvEditar">Editar pedido</button>`:''}
      ${!p.anulado&&!(p.entregas||[]).length?`<button type="button" class="btn mini peligro" id="pvAnular">Anular pedido</button>`:''}
    </div>`,
    ()=>{},'Cerrar');
  const b=id=>mForm.querySelector('#'+id);
  if(b('pvEditar')) b('pvEditar').onclick=()=>{ cerrarModal(); conSnapshot('Editar pedido',()=>formPedidoVenta(p)); };
  if(b('pvAnular')) b('pvAnular').onclick=()=>{
    if(!puedeEliminar()){avisar('Tu rol no tiene permiso para anular pedidos.');return}
    confirmar(`Se anulará el pedido No. ${p.numero}. Queda en la lista como anulado.`,()=>{ p.anulado=true; registrarLog('Anuló un pedido de venta',`No. ${p.numero}`); guardar(); cerrarModal(); pintar(); },'Anular pedido'); };
  mForm.querySelectorAll('[data-pdfent]').forEach(x=>x.onclick=()=>ACCIONES.pdfEntregaVenta({id:p.id,entrega:x.dataset.pdfent}));
  mForm.querySelectorAll('[data-anularent]').forEach(x=>x.onclick=()=>anularEntregaVenta(e,p,x.dataset.anularent));
};
function anularEntregaVenta(e,p,entId){
  if(!puedeEliminar()){avisar('Tu rol no tiene permiso para anular entregas.');return}
  const en=(p.entregas||[]).find(x=>x.id===entId); if(!en) return;
  if(anioCerrado(e,en.fecha.slice(0,4))){avisar('Esa entrega es de un ejercicio con cierre de libros: ya no se puede anular.');return}
  /* Lo que ya se facturó tiene que seguir entregado. */
  const sinEsta={...p,entregas:p.entregas.filter(x=>x.id!==entId)};
  const choca=[...new Set(en.items.map(x=>x.producto))].find(prod=>entregadoProd(sinEsta,prod)<facturadoProd(p,prod)-1e-9);
  if(choca){avisar(`Esa entrega ya está facturada (${choca}). Si la factura está mal, eliminá su partida primero.`);return}
  confirmar(`Se anulará el envío ${p.numero}-${en.numero}. Lo entregado vuelve al inventario.`,()=>{
    const ids=new Set(en.items.map(x=>x.salidaId).filter(Boolean));
    e.salidasInventario=(e.salidasInventario||[]).filter(s=>!ids.has(s.id));
    p.entregas=p.entregas.filter(x=>x.id!==entId);
    registrarLog('Anuló una entrega de pedido',`Envío ${p.numero}-${en.numero}`); guardar(); cerrarModal(); pintar();
  },'Anular entrega');
}
ACCIONES.entregarPedidoVenta=d=>{
  const e=emp(), p=(e.pedidosVenta||[]).find(x=>x.id===d.id); if(!p) return;
  const lista=inventarioDetalle(e).lista;
  const filas=p.items.map((it,i)=>({it,i,pend:pendienteLinea(p,i),k:lista.find(y=>y.producto===it.producto)})).filter(x=>x.pend>1e-9);
  /* Lo disponible se reparte entre renglones del mismo producto, en orden. */
  const disp={}; lista.forEach(k=>disp[k.producto]=k.cantidad);
  abrirModal(`Entregar pedido No. ${p.numero}`,
    `<p style="margin:0 0 10px;font-size:13px;color:var(--tinta-suave)">${esc(p.clienteNombre||p.clienteNit)} · Lo que se entregue sale del inventario. Los servicios o productos sin existencia en el kardex se marcan entregados sin mover inventario.</p>
    <table style="font-size:13px"><thead><tr><th>Producto</th><th class="num">Pendiente</th><th class="num">En existencia</th><th class="num">Entregar ahora</th></tr></thead><tbody>
    ${filas.map(x=>{ const hay=x.k?Math.max(0,disp[x.it.producto]||0):null, sug=hay===null?x.pend:Math.min(x.pend,hay); if(hay!==null) disp[x.it.producto]=r2(hay-sug);
      return `<tr><td>${esc(x.it.producto)}</td><td class="num">${Q(x.pend).replace(/\.00$/,'')}</td><td class="num">${x.k?Q(x.k.cantidad).replace(/\.00$/,''):'— (sin inventario)'}</td>
        <td class="num"><input name="ent_${x.i}" type="number" min="0" step="0.01" value="${r2(sug)}" style="width:86px;text-align:right" aria-label="Entregar ahora de ${esc(x.it.producto)}"></td></tr>`; }).join('')}</tbody></table>
    <div class="rej" style="margin-top:12px"><div class="campo"><label>Fecha</label><input name="fecha" type="date" value="${hoy()}"></div>
      <div class="campo"><label>Recibe (nombre)</label><input name="recibe" placeholder="Quién recibe"></div>
      <div class="campo full"><label>Nota (opcional)</label><input name="nota" placeholder="Transporte, lugar de entrega…"></div></div>`,
    f=>{
      if(!f.fecha){avisar('Elegí la fecha.');return false}
      if(anioCerrado(e,f.fecha.slice(0,4))){avisar(`El ejercicio ${f.fecha.slice(0,4)} ya tiene cierre de libros.`);return false}
      const sel=filas.map(x=>({...x,cant:r2(+f['ent_'+x.i]||0)})).filter(x=>x.cant>0);
      if(!sel.length){avisar('Escribí al menos una cantidad a entregar.');return false}
      const exceso=sel.find(x=>x.cant>x.pend+1e-9); if(exceso){avisar(`De ${exceso.it.producto} solo faltan ${Q(exceso.pend).replace(/\.00$/,'')} por entregar.`);return false}
      const total={}; sel.filter(x=>x.k).forEach(x=>total[x.it.producto]=(total[x.it.producto]||0)+x.cant);
      const falta=Object.entries(total).find(([prod,c])=>c>(lista.find(y=>y.producto===prod)||{cantidad:0}).cantidad+1e-9);
      if(falta){avisar(`No hay suficiente ${falta[0]} en existencia para entregar ${Q(falta[1]).replace(/\.00$/,'')}.`);return false}
      const en={id:uid(),numero:(p.entregas||[]).reduce((m,x)=>Math.max(m,x.numero),0)+1,fecha:f.fecha,recibe:(f.recibe||'').trim(),nota:(f.nota||'').trim(),items:[],creado:new Date().toISOString()};
      e.salidasInventario=e.salidasInventario||[];
      sel.forEach(x=>{
        let salidaId=null, costoTotal=0;
        if(x.k){ const c=costoSalidaInventario(e,x.it.producto,x.cant,f.fecha); salidaId=uid(); costoTotal=c.costoTotal;
          e.salidasInventario.push({id:salidaId,fecha:f.fecha,producto:x.it.producto,cantidad:x.cant,costoUnitario:c.costoUnitario,costoTotal:c.costoTotal,motivo:'venta',pedidoId:p.id,entregaId:en.id}); }
        en.items.push({idx:x.i,producto:x.it.producto,cantidad:x.cant,salidaId,costoTotal});
      });
      (p.entregas=p.entregas||[]).push(en);
      registrarLog('Registró una entrega de pedido',`Envío ${p.numero}-${en.numero} — ${p.clienteNombre}`);
      guardar(); pintar();
      avisar(`Entrega registrada (envío ${p.numero}-${en.numero}). Podés descargar el envío en PDF para que lo firme quien recibe, desde "Ver" en el pedido.`,'Listo');
    },'Registrar entrega');
};

/* ---- PDF ---- */
async function pdfDocVenta(e,titulo,x,opc={}){
  const jsPDF=await cargarJsPDF();
  const doc=new jsPDF({unit:'pt',format:'letter'}), an=doc.internal.pageSize.getWidth();
  doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(...VERDE); doc.text(e.nombre,40,48);
  doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(80,80,80);
  let y=62; [`NIT ${e.nit||'—'}`,e.direccion||''].filter(Boolean).forEach(l=>{ doc.splitTextToSize(l,an-280).forEach(s=>{ doc.text(s,40,y); y+=11; }); });
  doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(...VERDE); doc.text(titulo,an-40,48,{align:'right'});
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(60,60,60);
  (opc.datos||[]).forEach((l,i)=>doc.text(l,an-40,63+i*12,{align:'right'}));
  y=Math.max(y,63+(opc.datos||[]).length*12)+8;
  doc.setDrawColor(...VERDE); doc.setLineWidth(1); doc.line(40,y,an-40,y); y+=16;
  doc.setFontSize(9.5); doc.setTextColor(30,30,30);
  doc.setFont('helvetica','bold'); doc.text('Cliente:',40,y); doc.setFont('helvetica','normal'); doc.text(`${x.clienteNombre||'—'}   ·   NIT ${x.clienteNit||'—'}`,85,y);
  if(x.clienteDireccion){ y+=13; doc.setFont('helvetica','bold'); doc.text('Dirección:',40,y); doc.setFont('helvetica','normal'); doc.text(doc.splitTextToSize(x.clienteDireccion,an-140)[0],95,y); }
  y+=12;
  doc.autoTable({startY:y,margin:{left:40,right:40},theme:'grid',styles:{fontSize:9,cellPadding:4},headStyles:{fillColor:VERDE},head:[opc.head],body:opc.body,columnStyles:opc.columnas||{}});
  let y2=doc.lastAutoTable.finalY+16;
  (opc.totales||[]).forEach(([t,v,neg])=>{ doc.setFont('helvetica',neg?'bold':'normal'); doc.text(t,an-220,y2); doc.text(v,an-40,y2,{align:'right'}); y2+=14; });
  doc.setFont('helvetica','normal'); doc.setFontSize(9);
  (opc.textos||[]).filter(Boolean).forEach(tx=>{ y2+=4; doc.splitTextToSize(tx,an-80).forEach(l=>{ doc.text(l,40,y2); y2+=12; }); });
  if(opc.firmas){ y2=Math.max(y2+60,doc.lastAutoTable.finalY+120);
    if(y2>doc.internal.pageSize.getHeight()-60){ doc.addPage(); y2=120; }
    doc.setDrawColor(120); doc.setLineWidth(.6);
    opc.firmas.forEach((lineas,i)=>{ const x0=i===0?40:an-250; doc.line(x0,y2,x0+210,y2); lineas.forEach((l,j)=>doc.text(l,x0,y2+12+j*12)); }); }
  doc.save(opc.archivo);
}
const filasPdfVenta=items=>items.map((it,i)=>[i+1,it.producto,Q(it.cantidad).replace(/\.00$/,''),Q(it.precio),it.descuento?it.descuento+' %':'',Q(lineaVenta(it))]);
const columnasPdfVenta={0:{cellWidth:24},2:{halign:'right'},3:{halign:'right'},4:{halign:'right'},5:{halign:'right'}};
const totalesPdfVenta=t=>t.iva===null?[['Total',`Q${Q(t.total)}`,true]]:[['Subtotal sin IVA',`Q${Q(t.subtotal)}`],['IVA (12 %)',`Q${Q(t.iva)}`],['Total',`Q${Q(t.total)}`,true]];
const errorPdf=err=>avisar('No se pudo generar el PDF: '+err.message+'\n\nEl generador se descarga de internet la primera vez, así que necesitás conexión.');
ACCIONES.pdfCotizacionVenta=async d=>{
  const e=emp(), c=(e.cotizacionesVenta||[]).find(x=>x.id===d.id); if(!c) return;
  const t=totalesVenta(e,c.items,c.fecha);
  try{ await pdfDocVenta(e,`COTIZACIÓN No. ${c.numero}`,c,{datos:[`Fecha: ${fFecha(c.fecha)}`,...(c.vigenciaDias>0?[`Válida hasta: ${fFecha(venceCotizacion(c))}`]:[])],
    head:['#','Descripción','Cantidad','Precio unitario','Desc.','Subtotal'],body:filasPdfVenta(c.items),columnas:columnasPdfVenta,totales:totalesPdfVenta(t),
    textos:[`Precios en quetzales${t.iva!==null?', IVA incluido':''}.`,c.condiciones?`Condiciones de pago: ${c.condiciones}.`:'',c.notas],
    archivo:`Cotizacion-${c.numero}-${archivoSeguro(c.clienteNombre||c.clienteNit)}.pdf`}); }catch(err){ errorPdf(err); }
};
ACCIONES.pdfPedidoVenta=async d=>{
  const e=emp(), p=(e.pedidosVenta||[]).find(x=>x.id===d.id); if(!p) return;
  const t=totalesVenta(e,p.items,p.fecha);
  try{ await pdfDocVenta(e,`PEDIDO No. ${p.numero}`,p,{datos:[`Fecha: ${fFecha(p.fecha)}`,...(p.fechaEntrega?[`Entrega: ${fFecha(p.fechaEntrega)}`]:[]),...(p.anulado?['ANULADO']:[])],
    head:['#','Descripción','Cantidad','Precio unitario','Desc.','Subtotal'],body:filasPdfVenta(p.items),columnas:columnasPdfVenta,totales:totalesPdfVenta(t),
    textos:[p.condiciones?`Condiciones de pago: ${p.condiciones}.`:'',p.notas],firmas:[['Autorizado por'],['Aceptado por el cliente']],
    archivo:`Pedido-${p.numero}-${archivoSeguro(p.clienteNombre||p.clienteNit)}.pdf`}); }catch(err){ errorPdf(err); }
};
ACCIONES.pdfEntregaVenta=async d=>{
  const e=emp(), p=(e.pedidosVenta||[]).find(x=>x.id===d.id), en=p&&(p.entregas||[]).find(x=>x.id===d.entrega); if(!en) return;
  try{ await pdfDocVenta(e,`ENVÍO No. ${p.numero}-${en.numero}`,p,{datos:[`Fecha: ${fFecha(en.fecha)}`,`Pedido No. ${p.numero}`],
    head:['#','Descripción','Cantidad entregada'],body:en.items.map((x,i)=>[i+1,x.producto,Q(x.cantidad).replace(/\.00$/,'')]),columnas:{0:{cellWidth:24},2:{halign:'right',cellWidth:120}},
    textos:[en.nota,'Recibí conforme la mercadería detallada, en buen estado.'],firmas:[['Entregó'],[`Recibió: ${en.recibe||''}`,'Firma, nombre y fecha']],
    archivo:`Envio-${p.numero}-${en.numero}-${archivoSeguro(p.clienteNombre||p.clienteNit)}.pdf`}); }catch(err){ errorPdf(err); }
};
