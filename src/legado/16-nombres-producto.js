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
    ${otras.length?`<p style="margin:12px 0 0;font-size:12.5px;color:var(--tinta-suave)">Descripciones de factura ligadas a este producto:<br>${otras.map(x=>`· ${esc(x)}`).join('<br>')}</p>`:''}`,
    f=>{
      const nuevo=(f.nombre||'').trim().replace(/\s+/g,' ');
      if(!nuevo){avisar('Escribí el nombre.');return false}
      if(nuevo===viejo) return;
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
