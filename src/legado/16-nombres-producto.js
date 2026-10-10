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
