/* ============ AJUSTE MANUAL DE INVENTARIO ============ */
/* Para corregir el kardex cuando la realidad no coincide con lo registrado:
   · Merma (producto dañado, vencido, robado) o faltante en el conteo físico: sale del kardex a su costo y se
     reconoce como gasto (6.2.32 Mermas y faltantes, deducible si está documentado; si no, 6.2.14 no deducible),
     contra Inventarios (1.1.08).
   · Venta registrada sin descargar el producto: solo sale del kardex. La venta y su costo ya están en la
     contabilidad (el costo de ventas sale del inventario final), así que no lleva partida.
   · Sobrante en el conteo físico: entra al kardex y a Inventarios contra Otros ingresos (4.2.02).
   · Existencia inicial al empezar a usar el sistema: entra al kardex; la partida es opcional, porque casi
     siempre el inventario ya viene en el saldo de apertura de la cuenta 1.1.08.
   Las entradas viven en e.entradasInventario y las salidas en e.salidasInventario (con ajuste:true), así las
   toman el kardex, el método PEPS y el costo de ventas sin tratamiento aparte. */
const MOTIVOS_AJUSTE={
  merma:{nombre:'Merma: producto dañado, vencido o perdido',tipo:'salida',partida:'gasto'},
  faltante:{nombre:'Faltante en el conteo físico',tipo:'salida',partida:'gasto'},
  venta:{nombre:'Venta registrada sin descargar el producto',tipo:'salida',partida:null},
  sobrante:{nombre:'Sobrante en el conteo físico',tipo:'entrada',partida:'ingreso'},
  inicial:{nombre:'Existencia inicial (al empezar a usar el sistema)',tipo:'entrada',partida:'opcional'}};
const ajustesInventario=e=>[...(e.salidasInventario||[]).filter(s=>s.ajuste),...(e.entradasInventario||[])]
  .sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||'')||(b.creado||'').localeCompare(a.creado||''));
function htmlAjustesInventario(e){
  const l=ajustesInventario(e);
  if(!l.length) return '';
  return `<h3 style="margin:26px 0 8px">Ajustes manuales</h3>
    <table style="font-size:13px"><thead><tr><th>Fecha</th><th>Producto</th><th>Motivo</th><th class="num">Cantidad</th><th class="num">Costo</th><th>Partida</th><th class="num"></th></tr></thead><tbody>
    ${l.map(a=>{ const m=MOTIVOS_AJUSTE[a.motivo]||{nombre:a.motivo,tipo:'salida'}, p=a.partidaId&&(e.partidas||[]).find(x=>x.id===a.partidaId);
      return `<tr><td>${fFecha(a.fecha)}</td><td>${esc(a.producto)}</td><td>${esc(m.nombre)}${a.nota?`<br><span class="ayuda-campo" style="margin:0">${esc(a.nota)}</span>`:''}</td>
      <td class="num">${m.tipo==='entrada'?'+':'−'}${Q(a.cantidad).replace(/\.00$/,'')}</td><td class="num">${Q(a.costoTotal)}</td><td>${p?`No. ${p.numero}`:'—'}</td>
      <td class="num"><button class="btn mini peligro" data-accion="borrarAjusteInventario" data-id="${a.id}">Anular</button></td></tr>`; }).join('')}</tbody></table>`;
}
ACCIONES.ajusteInventario=()=>{
  const e=emp(), lista=inventarioDetalle(e).lista, prods=Object.fromEntries(lista.map(p=>[p.producto,p]));
  const patrimonio=e.cuentas.filter(c=>c.d&&c.t==='patrimonio');
  abrirModal('Ajuste manual de inventario',
    `<div class="rej">
      <div class="campo full"><label>Motivo</label><select name="motivo">${Object.entries(MOTIVOS_AJUSTE).map(([k,m])=>`<option value="${k}">${m.nombre}</option>`).join('')}</select></div>
      <div class="campo full"><label>Producto</label><input name="producto" list="dlProdAjuste" autocomplete="off" placeholder="Escribí o elegí de la lista">
        <datalist id="dlProdAjuste">${lista.map(p=>`<option value="${esc(p.producto)}">`).join('')}</datalist></div>
      <div class="campo"><label>Fecha</label><input name="fecha" type="date" value="${hoy()}"></div>
      <div class="campo"><label>Cantidad</label><input name="cantidad" type="number" step="0.0001" min="0"></div>
      <div class="campo" id="ajCosto"><label>Costo unitario</label><input name="costoUnitario" type="number" step="0.0001" min="0"></div>
      <label class="chequeo full" id="ajDoc"><input type="checkbox" name="documentado"><span>Está documentada (acta notarial o constancia de destrucción): es gasto deducible. Sin documentación se registra como no deducible.</span></label>
      <label class="chequeo full" id="ajPartida"><input type="checkbox" name="conPartida"><span>Registrarla también en la contabilidad (solo si ese inventario todavía no está en el saldo de Inventarios)</span></label>
      <div class="campo full" id="ajContra" hidden><label>Contra la cuenta de patrimonio</label><select name="contra">${patrimonio.map(c=>`<option value="${c.c}"${c.c==='3.1.01'?' selected':''}>${c.c} — ${esc(c.n)}</option>`).join('')}</select></div>
      <div class="campo full"><label>Nota (opcional)</label><input name="nota" placeholder="Ej.: lote vencido el 30/09, conteo del 10/10…"></div>
    </div>
    <p class="ayuda-campo" id="ajResumen" aria-live="polite"></p>`,
    f=>{
      const m=MOTIVOS_AJUSTE[f.motivo], prod=(f.producto||'').trim(), cant=+f.cantidad, existe=prods[prod];
      if(!prod){avisar('Escribí el producto.');return false}
      if(!(cant>0)){avisar('Escribí una cantidad mayor que cero.');return false}
      if(!f.fecha){avisar('Elegí la fecha.');return false}
      if(anioCerrado(e,f.fecha.slice(0,4))){avisar(`El ejercicio ${f.fecha.slice(0,4)} ya tiene cierre de libros: no se le pueden agregar movimientos.`);return false}
      if(m.tipo==='salida'){
        if(!existe){avisar('Ese producto no tiene existencia en el kardex. Elegí uno de la lista.');return false}
        if(cant>existe.cantidad+1e-9){avisar(`Solo hay ${Q(existe.cantidad).replace(/\.00$/,'')} de ${prod} en existencia: no puede salir más de lo que hay.`);return false}
      }
      const cu=m.tipo==='salida'?null:+f.costoUnitario;
      if(m.tipo==='entrada'&&!(cu>=0&&f.costoUnitario!=='')){avisar('Escribí el costo unitario.');return false}
      const id=uid(), creado=new Date().toISOString();
      let costoTotal, costoUnitario;
      if(m.tipo==='salida'){ const c=costoSalidaInventario(e,prod,cant); costoTotal=c.costoTotal; costoUnitario=c.costoUnitario; }
      else{ costoUnitario=cu; costoTotal=r2(cant*cu); }
      /* Partida contable, si corresponde. */
      let partida=null; const desc=`${m.nombre} — ${prod} (${Q(cant).replace(/\.00$/,'')} u.)${f.nota?` — ${f.nota.trim()}`:''}`;
      const lineas=[];
      if(m.partida==='gasto'&&costoTotal>0){
        const doc=f.documentado==='on', cta=doc?'6.2.32':'6.2.14';
        if(doc) asegurarCuenta(e,'6.2.32','Mermas y faltantes de inventario','gasto');
        lineas.push({cta,desc:doc?'':'Sin documentación: no deducible',debe:costoTotal,haber:0},{cta:'1.1.08',desc:'',debe:0,haber:costoTotal});
      }else if(m.partida==='ingreso'&&costoTotal>0){
        lineas.push({cta:'1.1.08',desc:'',debe:costoTotal,haber:0},{cta:'4.2.02',desc:'Sobrante de inventario',debe:0,haber:costoTotal});
      }else if(m.partida==='opcional'&&f.conPartida==='on'&&costoTotal>0){
        lineas.push({cta:'1.1.08',desc:'',debe:costoTotal,haber:0},{cta:f.contra||'3.1.01',desc:'Existencia inicial de inventario',debe:0,haber:costoTotal});
      }
      if(lineas.length){
        partida={id:uid(),numero:e.correlativo++,fecha:f.fecha,concepto:`Ajuste de inventario: ${desc}`,docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',lineas};
        e.partidas.push(partida);
      }
      const reg={id,fecha:f.fecha,producto:prod,cantidad:cant,costoUnitario,costoTotal,motivo:f.motivo,ajuste:true,nota:(f.nota||'').trim(),partidaId:partida?partida.id:'',creado};
      if(m.tipo==='salida') (e.salidasInventario=e.salidasInventario||[]).push(reg);
      else (e.entradasInventario=e.entradasInventario||[]).push(reg);
      registrarLog('Hizo un ajuste de inventario',`${m.nombre}: ${prod} — ${cant} u. — Q${Q(costoTotal)}`);
      guardar(); pintar();
      avisar(`Ajuste registrado: ${m.tipo==='salida'?'salieron':'entraron'} ${Q(cant).replace(/\.00$/,'')} u. de ${prod} (Q${Q(costoTotal)})${partida?`, en la partida No. ${partida.numero}`:', sin partida contable'}.`,'Listo');
    },'Registrar ajuste');
  const q=n=>mForm.querySelector(`[name="${n}"]`);
  const refrescar=()=>{
    const m=MOTIVOS_AJUSTE[q('motivo').value], prod=q('producto').value.trim(), cant=+q('cantidad').value||0, p=prods[prod];
    document.getElementById('ajCosto').hidden=m.tipo==='salida';
    document.getElementById('ajDoc').hidden=m.partida!=='gasto';
    document.getElementById('ajPartida').hidden=m.partida!=='opcional';
    document.getElementById('ajContra').hidden=!(m.partida==='opcional'&&q('conPartida').checked);
    if(m.tipo==='entrada'&&p&&q('costoUnitario').value==='') q('costoUnitario').value=r2(p.costoUnitario);
    const costo=m.tipo==='salida'?(p&&cant?costoSalidaInventario(e,prod,cant).costoTotal:0):r2(cant*(+q('costoUnitario').value||0));
    const exist=p?`Existencia actual: ${Q(p.cantidad).replace(/\.00$/,'')} a Q${Q(p.costoUnitario)} c/u. `:(prod?'Producto nuevo en el kardex. ':'');
    const cont={gasto:`Se registra Q${Q(costo)} como ${q('documentado').checked?'gasto deducible (Mermas y faltantes)':'gasto no deducible'} contra Inventarios.`,
      ingreso:`Se registra Q${Q(costo)} en Inventarios contra Otros ingresos.`,
      opcional:q('conPartida').checked?`Se registra Q${Q(costo)} en Inventarios contra patrimonio.`:'Solo el kardex: se asume que ya está en el saldo de Inventarios.',
      null:'Solo el kardex: la venta y su costo ya están en la contabilidad.'}[m.partida];
    document.getElementById('ajResumen').textContent=exist+(cant?`${m.tipo==='salida'?'Sale':'Entra'} por Q${Q(costo)}. ${cont}`:'');
  };
  mForm.querySelectorAll('[name]').forEach(i=>i.addEventListener(i.tagName==='SELECT'||i.type==='checkbox'?'change':'input',refrescar));
  refrescar();
};
ACCIONES.borrarAjusteInventario=d=>{
  if(!puedeEliminar()){avisar('Tu rol no tiene permiso para anular ajustes.');return}
  const e=emp(), a=ajustesInventario(e).find(x=>x.id===d.id); if(!a) return;
  const p=a.partidaId&&e.partidas.find(x=>x.id===a.partidaId);
  if(p&&anioCerrado(e,p.fecha.slice(0,4))){avisar('Ese ajuste es de un ejercicio con cierre de libros: ya no se puede anular.');return}
  confirmar(`Se anulará el ajuste de ${a.producto} (${MOTIVOS_AJUSTE[a.motivo]?.nombre||a.motivo})${p?` y su partida No. ${p.numero}`:''}. El kardex vuelve a como estaba.`,()=>{
    e.salidasInventario=(e.salidasInventario||[]).filter(x=>x.id!==a.id);
    e.entradasInventario=(e.entradasInventario||[]).filter(x=>x.id!==a.id);
    if(p) e.partidas=e.partidas.filter(x=>x.id!==p.id);
    registrarLog('Anuló un ajuste de inventario',`${a.producto} — ${a.cantidad} u.`); guardar(); pintar();
  },'Anular');
};
