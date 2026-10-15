/* ============ NOMBRE DE LOS PRODUCTOS EN EL INVENTARIO ============ */
/* El kardex nace con la descripción que trae la factura del proveedor ("[7699151] [7699151] TONIC 12OZ"),
   que no siempre se reconoce fácil. Renombrar guarda en e.mapeoProducto «descripción de factura → nombre en
   inventario» —el mismo mapa que ya usaban las facturas de venta—, así cualquier factura nueva, de compra o
   de venta, con esa descripción cae sola en el producto renombrado. Si el nombre nuevo ya existe, los dos se
   unen en uno (el mismo producto que venía con dos descripciones distintas). Lo registrado a mano con el
   nombre viejo (ventas, consignaciones, ajustes, producción, recetas) pasa al nombre nuevo. Las facturas no
   se tocan: siguen diciendo lo que dice el documento. */
function productoDe(e,desc){
  const d=(desc||'').trim();
  return (e.mapeoProducto||{})[d]||d;
}
function renombrarProducto(e,viejo,nuevo){
  const mapa=e.mapeoProducto=e.mapeoProducto||{};
  /* Toda descripción de factura que hoy termina en el nombre viejo apunta ahora al nuevo. */
  (e.documentos||[]).forEach(d=>(d.items||[]).forEach(it=>{
    if(it.bs!=='B') return;
    const desc=(it.descripcion||'Sin descripción').trim();
    if(productoDe(e,desc)===viejo) mapa[desc]=nuevo;
  }));
  Object.keys(mapa).forEach(k=>{ if(mapa[k]===viejo) mapa[k]=nuevo; if(mapa[k]===k) delete mapa[k]; });
  const cambiar=x=>{ if(x&&x.producto===viejo) x.producto=nuevo; };
  (e.salidasInventario||[]).forEach(cambiar);
  (e.entradasInventario||[]).forEach(cambiar);
  (e.consignaciones||[]).forEach(cambiar);
  (e.ordenesProduccion||[]).forEach(o=>{ cambiar(o); (o.productosConjuntos||[]).forEach(cambiar); (o.materiales||[]).forEach(cambiar); });
  [...(e.pedidosVenta||[]),...(e.cotizacionesVenta||[])].forEach(x=>{ (x.items||[]).forEach(cambiar);
    (x.entregas||[]).forEach(en=>en.items.forEach(cambiar)); (x.facturas||[]).forEach(cambiar); });
  Object.keys(e.codigosProducto||{}).forEach(k=>{ if(e.codigosProducto[k]===viejo) e.codigosProducto[k]=nuevo; });
  if(e.preciosVenta&&e.preciosVenta[viejo]){ if(!e.preciosVenta[nuevo]) e.preciosVenta[nuevo]=e.preciosVenta[viejo]; delete e.preciosVenta[viejo]; }
  (e.recetas||[]).forEach(r=>{ cambiar(r); if(r.materiaBase===viejo) r.materiaBase=nuevo;
    (r.lineas||[]).forEach(l=>{ if(l.material===viejo) l.material=nuevo; }); });
}
/* Las descripciones de factura que hoy caen en este producto (para mostrarlas al renombrar). */
const descripcionesDeProducto=(e,producto)=>[...new Set((e.documentos||[]).flatMap(d=>(d.items||[])
  .filter(it=>it.bs==='B').map(it=>(it.descripcion||'Sin descripción').trim())).filter(desc=>productoDe(e,desc)===producto&&desc!==producto))];
ACCIONES.renombrarProducto=d=>{
  const e=emp(), viejo=d.producto, lista=inventarioDetalle(e).lista;
  const otras=descripcionesDeProducto(e,viejo);
  abrirModal('Nombre del producto',
    `<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">Poné un nombre que se reconozca fácil. Las facturas no cambian: el sistema recuerda que esa descripción es este producto, y las próximas facturas que la traigan, de compra o de venta, se ligan solas.</p>
    <div class="campo full"><label>Nombre en el inventario</label><input name="nombre" value="${esc(viejo)}" list="dlRenProd" autocomplete="off">
      <datalist id="dlRenProd">${lista.filter(p=>p.producto!==viejo).map(p=>`<option value="${esc(p.producto)}">`).join('')}</datalist></div>
    <p class="ayuda-campo" id="renAviso" aria-live="polite"></p>
    ${htmlCampoCodigos(e,viejo)}
    ${otras.length?`<p style="margin:12px 0 0;font-size:12.5px;color:var(--tinta-suave)">Descripciones de factura ligadas a este producto:<br>${otras.map(x=>`· ${esc(x)}`).join('<br>')}</p>`:''}`,
    f=>{
      const nuevo=(f.nombre||'').trim().replace(/\s+/g,' ');
      if(!nuevo){avisar('Escribí el nombre.');return false}
      const choca=guardarCodigos(e,viejo,f.codigos); if(choca){avisar(choca);return false}
      if(nuevo===viejo){ guardar(); pintar(); return; }
      const unir=lista.some(p=>p.producto===nuevo);
      renombrarProducto(e,viejo,nuevo);
      registrarLog(unir?'Unió dos productos del inventario':'Renombró un producto del inventario',`${viejo} → ${nuevo}`);
      guardar(); pintar();
      avisar(unir?`«${viejo}» quedó unido a «${nuevo}»: ahora es un solo producto, con la existencia y el costo de los dos.`
        :`Listo: el producto ahora se llama «${nuevo}». Las próximas facturas con la descripción anterior se ligan solas.`,'Listo');
    },'Guardar');
  const inp=mForm.querySelector('[name="nombre"]'), aviso=document.getElementById('renAviso');
  const ver=()=>{ const v=inp.value.trim().replace(/\s+/g,' ');
    aviso.textContent=v!==viejo&&lista.some(p=>p.producto===v)?`Ya existe «${v}»: se van a unir en un solo producto, sumando existencia y costo.`:''; };
  inp.addEventListener('input',ver); inp.select();
};

/* ============ CÓDIGOS DE BARRAS ============ */
/* Un lector de código de barras funciona como un teclado: escribe el código y da Enter. El código se busca:
   1) en los que se ligaron a mano (e.codigosProducto {código: producto}); 2) dentro de las descripciones de
   las facturas de compra, donde los proveedores suelen ponerlo ("[7401234] GALLETA"), aunque el producto
   ya se haya renombrado; 3) como nombre exacto del producto. */
const normCodigo=c=>String(c||'').trim().replace(/\s+/g,'').toUpperCase();
const tieneCodigo=(texto,cod)=>cod.length>=4&&new RegExp('(^|[^0-9A-Z])'+cod.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'($|[^0-9A-Z])').test(String(texto).toUpperCase());
function productoPorCodigo(e,codigo){
  const cod=normCodigo(codigo); if(!cod) return null;
  const mapa=e.codigosProducto||{};
  if(mapa[cod]) return mapa[cod];
  for(const d of (e.documentos||[])) for(const it of (d.items||[])){
    if(it.bs==='B'&&tieneCodigo(it.descripcion||'',cod)) return productoDe(e,it.descripcion||'');
  }
  const k=inventarioDetalle(e).lista.find(p=>normCodigo(p.producto)===cod||tieneCodigo(p.producto,cod));
  return k?k.producto:null;
}
/* Códigos que vienen en las descripciones de factura (números de 6 o más cifras). */
const codigosEnFacturas=(e,producto)=>[...new Set((e.documentos||[]).flatMap(d=>(d.items||[]).filter(it=>it.bs==='B'&&productoDe(e,it.descripcion||'')===producto)
  .flatMap(it=>(String(it.descripcion||'').match(/\d{6,}/g)||[]))))];
const codigosManuales=(e,producto)=>Object.keys(e.codigosProducto||{}).filter(k=>e.codigosProducto[k]===producto);
function htmlCampoCodigos(e,producto){
  const auto=codigosEnFacturas(e,producto).filter(c=>!codigosManuales(e,producto).includes(c));
  return `<div class="campo full" style="margin-top:10px"><label>Código de barras (opcional)</label>
    <input name="codigos" value="${esc(codigosManuales(e,producto).join(', '))}" placeholder="Escaneá el código acá" autocomplete="off" inputmode="numeric">
    <span class="ayuda-campo">Si tiene varios códigos, separalos con coma.${auto.length?` Ya se reconoce por el código de la factura: ${auto.map(esc).join(', ')}.`:''}</span></div>`;
}
/* Guarda los códigos escritos para el producto. Devuelve un mensaje si alguno ya es de otro producto. */
function guardarCodigos(e,producto,texto){
  const nuevos=[...new Set(String(texto||'').split(/[,;\n]/).map(normCodigo).filter(Boolean))];
  const mapa=e.codigosProducto=e.codigosProducto||{};
  const otro=nuevos.find(c=>mapa[c]&&mapa[c]!==producto);
  if(otro) return `El código ${otro} ya es de «${mapa[otro]}». Quitalo de allá primero.`;
  Object.keys(mapa).forEach(k=>{ if(mapa[k]===producto&&!nuevos.includes(k)) delete mapa[k]; });
  nuevos.forEach(c=>mapa[c]=producto);
  return '';
}
/* Casilla para escanear dentro de un formulario. alEncontrar(producto) agrega el renglón. Si el código no se
   conoce, deja elegir a qué producto corresponde y lo recuerda para la próxima. */
function htmlEscaner(){
  return `<div class="escaner"><label for="escCodigo">Código de barras</label>
    <input id="escCodigo" autocomplete="off" inputmode="numeric" placeholder="Escaneá o escribí el código y Enter">
    <p class="ayuda-campo" id="escEstado" aria-live="polite" style="margin:4px 0 0"></p><div id="escLigar"></div></div>`;
}
function enlazarEscaner(e,alEncontrar,productos){
  const inp=mForm.querySelector('#escCodigo'), est=mForm.querySelector('#escEstado'), ligar=mForm.querySelector('#escLigar');
  if(!inp) return;
  inp.addEventListener('keydown',ev=>{
    if(ev.key!=='Enter') return;
    ev.preventDefault(); ev.stopPropagation();
    const cod=normCodigo(inp.value); inp.value=''; ligar.innerHTML='';
    if(!cod) return;
    const prod=productoPorCodigo(e,cod);
    if(prod){ const txt=alEncontrar(prod); est.textContent=txt||`Agregado: ${prod}`; return; }
    const lista=(productos||inventarioDetalle(e).lista.map(p=>p.producto));
    est.textContent=`No se conoce el código ${cod}.`;
    ligar.innerHTML=`<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px"><select id="escProd" aria-label="Producto de ese código" style="flex:1 1 200px;min-width:0">
      <option value="">¿Qué producto es?</option>${lista.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('')}</select>
      <button type="button" class="btn mini" id="escGuardar">Ligar código</button></div>`;
    ligar.querySelector('#escGuardar').onclick=()=>{
      const p=ligar.querySelector('#escProd').value; if(!p){ est.textContent='Elegí el producto.'; return; }
      (e.codigosProducto=e.codigosProducto||{})[cod]=p; ligar.innerHTML='';
      registrarLog('Ligó un código de barras',`${cod} → ${p}`);
      const txt=alEncontrar(p); est.textContent=`Código ${cod} ligado a ${p}. ${txt||'Agregado.'}`; inp.focus();
    };
  });
}

/* ============ VENTAS QUE NO SALIERON DEL INVENTARIO Y LIGAS DE DESCRIPCIONES ============ */
/* Producto del inventario al que corresponde una descripción de factura: la liga guardada o el mismo nombre. */
function productoDeInventario(e,desc){
  const d=(desc||'').trim(); if(!d) return '';
  const mapa=e.mapeoProducto||{};
  if(Object.prototype.hasOwnProperty.call(mapa,d)) return mapa[d]||'';   // '' = se desligó a propósito
  return nombresDeInventario(e).has(d)?d:'';
}
/* Nombres de producto que existen en el kardex (compras con detalle, producción, entradas y ajustes). */
function nombresDeInventario(e){
  const s=new Set();
  (e.documentos||[]).filter(d=>d.tipo==='compra'&&d.cta==='1.1.08').forEach(d=>(d.items||[]).filter(it=>it.bs==='B').forEach(it=>s.add(productoDe(e,it.descripcion||'Sin descripción'))));
  (e.ordenesProduccion||[]).flatMap(entradasProduccion).forEach(x=>s.add(x.producto));
  (e.entradasInventario||[]).forEach(x=>s.add(x.producto));
  return s;
}
/* Renglones de facturas de venta cuyo producto no salió (o no salió completo) del inventario. Se compara, por factura
   y producto, lo vendido contra lo descontado (salidas de esa factura, entregas de pedidos y ventas directas que la
   factura cubre). Si hay ventas directas del mismo producto, anteriores y sin factura, puede que la mercadería
   ya haya salido con ellas: se señala para no descontarla dos veces. */
function ventasSinDescargar(e){
  const out=[], sal=e.salidasInventario||[];
  (e.documentos||[]).filter(d=>d.tipo==='venta'&&d.id&&(d.signo||1)>0&&(d.items||[]).length).forEach(d=>{
    const porProd={};
    d.items.forEach(it=>{ const p=productoDeInventario(e,it.descripcion); if(p&&it.cantidad>0) porProd[p]=r2((porProd[p]||0)+it.cantidad); });
    Object.entries(porProd).forEach(([prod,cant])=>{
      const descontado=r2(sal.filter(s=>s.documentoId===d.id&&s.producto===prod).reduce((a,s)=>a+s.cantidad,0)
        +(e.pedidosVenta||[]).reduce((a,p)=>a+(p.facturas||[]).filter(f=>f.documentoId===d.id&&f.producto===prod).reduce((b,f)=>b+f.cantidad,0),0)
        +sal.reduce((a,s)=>a+(s.producto===prod?(s.facturas||[]).filter(f=>f.documentoId===d.id).reduce((b,f)=>b+f.cantidad,0):0),0));
      const falta=r2(cant-descontado);
      if(falta<=1e-9) return;
      /* Ventas directas de ese producto, anteriores a la factura y todavía sin factura: puede que la mercadería ya haya
         salido con ellas. */
      const vds=sal.filter(s=>s.producto===prod&&(s.fecha||'')<=d.fecha&&esVentaDirectaSinFactura(s));
      const vdLibre=r2(vds.reduce((a,s)=>a+s.cantidad-facturadoVentaDirecta(s),0));
      const vd=vds.length?{fecha:vds[0].fecha,cantidad:vdLibre}:null;
      out.push({doc:d,producto:prod,cantidad:falta,ventaDirecta:vd||null,cerrado:anioCerrado(e,d.fecha.slice(0,4))});
    });
  });
  return out.sort((a,b)=>a.doc.fecha.localeCompare(b.doc.fecha));
}
ACCIONES.ventasSinDescargar=()=>{
  const e=emp(), lista=ventasSinDescargar(e);
  if(!lista.length){avisar('Todas las facturas de venta ya salieron del inventario.','Inventario al día');return}
  abrirModal('Ventas que no salieron del inventario',
    `<p style="margin:0 0 10px;font-size:13px;color:var(--tinta-suave)">Estas facturas de venta tienen productos que no se descontaron del inventario (por ejemplo, se cargaron antes de ligar la descripción, o la factura marcó la caja como «servicio»). Mientras no salgan, el kardex queda alto y el costo de ventas estimado queda bajo, y eso infla el ISR del tablero. Elegí qué hacer con cada una: «Descontar» la saca del inventario con la fecha y el costo de ese día; «Ya salió» la liga a una venta directa sin factura anterior, porque esa mercadería ya salió (no descuenta otra vez).</p>
    <div style="max-height:52vh;overflow:auto"><table style="font-size:13px"><thead><tr><th>Factura</th><th>Producto</th><th class="num">Cantidad</th><th>Qué hacer</th></tr></thead><tbody>
    ${lista.map((x,i)=>`<tr${x.cerrado?' style="opacity:.55"':''}>
      <td>${fFecha(x.doc.fecha)}<br>${esc(x.doc.dte||'')}<br><span style="font-size:12px;color:var(--tinta-suave)">${esc(x.doc.nombre||'')}</span></td>
      <td>${esc(x.producto)}${x.ventaDirecta?`<br><span style="font-size:12px;color:var(--haber)">Venta directa sin factura del ${fFecha(x.ventaDirecta.fecha)} (${Q(x.ventaDirecta.cantidad).replace(/\.00$/,'')} u.)</span>`:''}${x.cerrado?'<br><span style="font-size:12px">Ejercicio cerrado</span>':''}</td>
      <td class="num">${Q(x.cantidad).replace(/\.00$/,'')}</td>
      <td><select style="width:auto;min-width:0;max-width:115px" name="v_${i}" aria-label="Qué hacer con ${esc(x.producto)}"${x.cerrado?' disabled':''}>
        <option value="descontar"${!x.ventaDirecta?' selected':''}>Descontar</option>
        ${x.ventaDirecta?'<option value="vd" selected>Ya salió</option>':''}
        <option value="">Nada</option></select></td></tr>`).join('')}</tbody></table></div>`,
    f=>{
      const elegidas=lista.map((x,i)=>({...x,que:f['v_'+i]||''})).filter(x=>x.que&&!x.cerrado);
      if(!elegidas.length){avisar('No elegiste ninguna.');return false}
      e.salidasInventario=e.salidasInventario||[];
      let costo=0, nDesc=0, nVD=0;
      elegidas.forEach(x=>{
        let cant=x.cantidad;
        if(x.que==='vd'){ const d=x.doc; const cub=cubrirConVentasDirectas(e,{id:d.id,nit:d.nit,fecha:d.fecha,serie:d.serie,dte:d.dte},x.producto,cant); cant=r2(cant-cub); if(cub>0) nVD++; }
        if(cant<=1e-9) return;
        const c=costoSalidaInventario(e,x.producto,cant,x.doc.fecha); costo=r2(costo+c.costoTotal); nDesc++;
        e.salidasInventario.push({id:uid(),fecha:x.doc.fecha,producto:x.producto,cantidad:cant,costoUnitario:c.costoUnitario,costoTotal:c.costoTotal,motivo:'venta',partidaId:x.doc.partidaId||'',documentoId:x.doc.id}); });
      registrarLog('Revisó ventas que no salieron del inventario',`${nDesc} descontadas (Q${Q(costo)}), ${nVD} ligadas a ventas directas`);
      guardar(); pintar();
      avisar(`Listo: ${nDesc?`salieron del inventario ${nDesc} renglones con un costo de Q${Q(costo)}`:'no se descontó nada nuevo'}${nVD?`; ${nVD} se ligaron a ventas directas que ya habían salido`:''}. El costo de ventas y el ISR del tablero ya lo toman en cuenta.`,'Inventario actualizado');
    },'Aplicar');
};
/* Ligas «descripción de factura de venta → producto del inventario»: verlas todas y corregir las equivocadas. Al
   cambiar una liga, las facturas con esa descripción se vuelven a descontar con el producto correcto (o dejan de
   descontar, si se desliga). */
ACCIONES.ligasProductos=()=>{
  const e=emp(), mapa=e.mapeoProducto||{};
  const descs=[...new Set((e.documentos||[]).filter(d=>d.tipo==='venta').flatMap(d=>(d.items||[]).map(it=>(it.descripcion||'').trim())).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const prods=[...nombresDeInventario(e)].sort((a,b)=>a.localeCompare(b,'es'));
  if(!descs.length){avisar('Todavía no hay facturas de venta con detalle de productos.');return}
  abrirModal('Ligas de las facturas de venta',
    `<p style="margin:0 0 10px;font-size:13px;color:var(--tinta-suave)">Cada descripción que aparece en tus facturas de venta, y el producto del inventario que descuenta. Si alguna está ligada al producto equivocado, cambiala; si no es un producto (un servicio), dejala «Sin ligar».</p>
    <div style="max-height:56vh;overflow:auto"><table style="font-size:13px"><thead><tr><th>Descripción en la factura</th><th>Producto del inventario</th></tr></thead><tbody>
    ${descs.map((d,i)=>{ const actual=productoDeInventario(e,d), opciones=[...new Set([...prods,...(actual?[actual]:[])])];
      return `<tr><td>${esc(d)}</td><td><select name="l_${i}" aria-label="Producto para ${esc(d)}" style="width:100%;min-width:200px"><option value="">— Sin ligar (no descuenta) —</option>${opciones.map(p=>`<option value="${esc(p)}"${p===actual?' selected':''}>${esc(p)}</option>`).join('')}</select></td></tr>`; }).join('')}</tbody></table></div>`,
    f=>{
      const cambios=descs.map((d,i)=>({d,antes:productoDeInventario(e,d),despues:f['l_'+i]||''})).filter(x=>x.antes!==x.despues);
      if(!cambios.length) return;
      e.mapeoProducto=e.mapeoProducto||{};
      cambios.forEach(x=>{ if(x.despues&&x.despues!==x.d) e.mapeoProducto[x.d]=x.despues; else if(x.despues===x.d) delete e.mapeoProducto[x.d]; else e.mapeoProducto[x.d]=''; });
      /* Las facturas con esas descripciones se vuelven a descontar con la liga nueva (solo las salidas que nacieron de
         la factura; las ventas directas y las entregas de pedidos no se tocan). */
      const set=new Set(cambios.map(x=>x.d)), docs=(e.documentos||[]).filter(d=>d.tipo==='venta'&&d.id&&(d.items||[]).some(it=>set.has((it.descripcion||'').trim())));
      let movidas=0;
      docs.forEach(d=>{
        if(anioCerrado(e,d.fecha.slice(0,4))) return;
        const porProd={}; d.items.forEach(it=>{ const p=productoDeInventario(e,it.descripcion); if(p&&it.cantidad) porProd[p]=r2((porProd[p]||0)+(d.signo||1)*it.cantidad); });
        /* Una venta directa que esta factura «cubría» con el producto viejo queda libre otra vez. */
        let libero=false;
        (e.salidasInventario||[]).forEach(s=>{ if(!(s.facturas||[]).some(f=>f.documentoId===d.id)||porProd[s.producto]) return;
          s.facturas=s.facturas.filter(f=>f.documentoId!==d.id); libero=true; });
        const antes=(e.salidasInventario||[]).filter(s=>s.documentoId===d.id);
        /* Si la factura no descontó nada propio (la cubrió una venta directa o un pedido), no se toca: lo que falte se
           ve en «Ventas que no salieron del inventario», donde se decide sin descontar dos veces. */
        if(!antes.length){ if(libero) movidas++; return; }
        e.salidasInventario=(e.salidasInventario||[]).filter(s=>s.documentoId!==d.id);
        Object.entries(porProd).forEach(([prod,total])=>{
          const cubierto=r2((e.salidasInventario||[]).reduce((a,s)=>a+(s.producto===prod?(s.facturas||[]).filter(f=>f.documentoId===d.id).reduce((b,f)=>b+f.cantidad,0):0),0)
            +(e.pedidosVenta||[]).reduce((a,p)=>a+(p.facturas||[]).filter(f=>f.documentoId===d.id&&f.producto===prod).reduce((b,f)=>b+f.cantidad,0),0));
          const cant=total>0?r2(total-cubierto):total; if(!cant||(total>0&&cant<0)) return;
          const c=costoSalidaInventario(e,prod,cant,d.fecha);
          e.salidasInventario.push({id:uid(),fecha:d.fecha,producto:prod,cantidad:cant,costoUnitario:c.costoUnitario,costoTotal:c.costoTotal,motivo:'venta',partidaId:d.partidaId||'',documentoId:d.id}); });
        movidas++;
      });
      registrarLog('Corrigió ligas de productos',cambios.map(x=>`${x.d} → ${x.despues||'sin ligar'}`).join('; '));
      guardar(); pintar();
      avisar(`Ligas actualizadas (${cambios.length}). ${movidas?`Se volvieron a descontar ${movidas} factura(s) de venta con el producto correcto.`:''}`,'Listo');
    },'Guardar ligas');
};
