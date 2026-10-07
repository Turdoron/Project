/* ======================= HOJA DE PRODUCCIÓN (para imprimir) ======================= */
/* A partir de una receta y de lo que se va a producir, calcula cuánto lleva de cada material y arma un PDF
   para el departamento de producción y la bodega. No lleva costos: es la instrucción de qué y cuánto poner,
   con espacio para anotar lo entregado y lo realmente usado (que después se registra en la orden). */
function lineasHojaProduccion(e,r,base){
  const bodega={}; inventarioDetalle(e).lista.forEach(p=>{ bodega[p.producto]=+p.cantidad||0; });
  return consumoTeorico(r,base).map(t=>({material:t.material,unidad:t.unidad,cantidad:t.cantidad,
    porBase:t.linea.modo==='porcentaje'?`${fmtCant(t.linea.valor)} %`:`${fmtCant(t.linea.valor)} ${t.unidad}`.trim(),
    bodega:bodega[t.material],falta:bodega[t.material]!==undefined&&t.cantidad>bodega[t.material]+0.00005}));
}
const etiquetaCantidadHoja=r=>r.baseTipo==='materia'?`Cantidad de ${r.materiaBase||'materia prima base'} a procesar (${r.baseUnidad||'unidades'})`:`Cantidad a producir (${r.baseUnidad||'unidades'})`;
ACCIONES.hojaProduccion=d=>{
  const e=emp(), o=d.orden?(e.ordenesProduccion||[]).find(x=>x.id===d.orden):null;
  /* Desde una orden: sus recetas y las demás del mismo producto (una por proceso). Desde Recetas: esa. */
  const opciones=o?[...new Set([...recetasDeOrden(e,o),...(e.recetas||[]).filter(r=>r.producto===o.producto)])]:(e.recetas||[]).filter(r=>r.id===d.id);
  if(!opciones.length){avisar(o?'Esta orden no tiene receta. Creala en "Recetas" con el mismo nombre de producto o elegila al crear la orden.':'No se encontró la receta.');return}
  const nombreOpcion=r=>`${r.producto}${r.centroId?' — '+nombreCentro(e,r.centroId):''} (por ${etiquetaBase(r)})`;
  abrirModal('Hoja de producción',
    `<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">Calcula cuánto lleva de cada material para la cantidad que se va a producir y genera un PDF para producción y bodega, sin costos.</p>
    <div class="rej">
      ${opciones.length>1?`<div class="campo full"><label>Receta</label><select name="recetaId">${opciones.map(r=>`<option value="${r.id}">${esc(nombreOpcion(r))}</option>`).join('')}</select></div>`:`<input type="hidden" name="recetaId" value="${opciones[0].id}">`}
      <div class="campo"><label id="hpBaseLbl">Cantidad a producir</label><input name="base" type="number" step="0.0001" min="0"></div>
      <div class="campo"><label>Fecha</label><input name="fecha" type="date" value="${o?fechaSugerida(o):hoy()}"></div>
      <div class="campo full"><label>Indicaciones para producción (opcional)</label><textarea name="nota" rows="2" style="width:100%" placeholder="Ej.: lote para el pedido de Supermercados La Torre; revisar humedad de la madera"></textarea></div>
    </div>
    <div id="hpPrev" style="margin-top:12px"></div>`,
    async f=>{
      const r=opciones.find(x=>x.id===f.recetaId)||opciones[0], base=+f.base||0;
      if(!(base>0)){avisar('Escribí la cantidad que se va a producir.');return false}
      await pdfHojaProduccion(e,r,base,f.fecha||hoy(),(f.nota||'').trim(),o);
    },'Generar PDF');
  const g=n=>mForm.querySelector(`[name="${n}"]`);
  const receta=()=>opciones.find(x=>x.id===g('recetaId').value)||opciones[0];
  const sugerida=r=>{ if(!o) return ''; if(r.baseTipo!=='materia') return o.cantidadPlan||'';
    const b=(o.basesReceta||[]).filter(x=>(x.recetaId||o.recetaId)===r.id).reduce((s,x)=>s+x.base,0); return b||''; };
  const act=()=>{
    const r=receta(), base=+g('base').value||0;
    document.getElementById('hpBaseLbl').textContent=etiquetaCantidadHoja(r);
    if(!(base>0)){document.getElementById('hpPrev').innerHTML='';return}
    const ls=lineasHojaProduccion(e,r,base), faltan=ls.filter(x=>x.falta);
    document.getElementById('hpPrev').innerHTML=`<div class="tabla-scroll"><table style="font-size:13px"><thead><tr><th>Material</th><th class="num">Por ${esc(r.baseUnidad||'unidad')}</th><th class="num">Cantidad a usar</th><th class="num">En bodega</th></tr></thead><tbody>
      ${ls.map(x=>`<tr><td>${esc(x.material)}</td><td class="num">${esc(x.porBase)}</td><td class="num"><strong>${fmtCant(x.cantidad)} ${esc(x.unidad)}</strong></td>
        <td class="num"${x.falta?' style="color:var(--peligro)"':''}>${x.bodega===undefined?'—':fmtCant(x.bodega)+(x.falta?' (no alcanza)':'')}</td></tr>`).join('')}</tbody></table></div>
      ${+r.horasStd>0?`<p style="margin:8px 0 0;font-size:13px">Tiempo estándar de mano de obra: ${fmtCant(Math.round(r.horasStd*base*100)/100)} horas.</p>`:''}
      ${faltan.length?`<p style="margin:8px 0 0;font-size:13px;color:var(--peligro)">No alcanza en bodega: ${faltan.map(x=>esc(x.material)).join(', ')}.</p>`:''}`;
  };
  const alCambiarReceta=()=>{ g('base').value=sugerida(receta()); act(); };
  if(g('recetaId').tagName==='SELECT') g('recetaId').addEventListener('change',alCambiarReceta);
  g('base').addEventListener('input',act);
  alCambiarReceta();
};
async function pdfHojaProduccion(e,r,base,fecha,nota,o){
  const ls=lineasHojaProduccion(e,r,base), alto=altoEncabezado();
  const etiqueta=o?`${o.tipo==='continuo'?'Corrida':'Orden'} ${o.numero}`:'';
  try{
    const jsPDF=await cargarJsPDF();
    const doc=new jsPDF({unit:'pt',format:'letter'});
    const an=doc.internal.pageSize.getWidth(), al=doc.internal.pageSize.getHeight();
    const titulo=`Hoja de producción — ${r.producto}${etiqueta?' · '+etiqueta:''}`;
    const sub=`${r.centroId?'Proceso: '+nombreCentro(e,r.centroId)+' · ':''}fecha ${fFecha(fecha)}${o&&o.fechaFin?` · entrega ${fFecha(o.fechaFin)}`:''}`;
    const pie={didDrawPage:()=>encabezadoPDF(doc,titulo,sub)};
    const estilo={styles:{fontSize:9,cellPadding:4,lineColor:[225,222,212],lineWidth:.3},headStyles:{fillColor:CREMA,textColor:VERDE,fontSize:8.5},margin:{top:alto,left:40,right:40,bottom:42}};
    const datos=[['Producto',r.producto],[etiquetaCantidadHoja(r),fmtCant(base)]];
    if(+r.horasStd>0) datos.push(['Tiempo estándar de mano de obra',`${fmtCant(Math.round(r.horasStd*base*100)/100)} horas`]);
    if(nota) datos.push(['Indicaciones',nota]);
    doc.autoTable({...estilo,...pie,startY:alto,body:datos,theme:'plain',columnStyles:{0:{fontStyle:'bold',cellWidth:190,textColor:VERDE}}});
    doc.autoTable({...estilo,...pie,startY:doc.lastAutoTable.finalY+12,
      head:[['#','Material',`Por ${r.baseUnidad||'unidad'}`,'Cantidad a usar','Entregado','Usado real']],
      body:ls.map((x,i)=>[i+1,x.material,x.porBase,{content:`${fmtCant(x.cantidad)} ${x.unidad}`.trim(),styles:{fontStyle:'bold'}},'','']),
      columnStyles:{0:{cellWidth:22,halign:'right'},2:{halign:'right'},3:{halign:'right'},4:{cellWidth:72},5:{cellWidth:72}},
      didParseCell:c=>{ if(c.section==='head'&&(c.column.index===2||c.column.index===3)) c.cell.styles.halign='right'; }});
    if(r.instrucciones) doc.autoTable({...estilo,...pie,startY:doc.lastAutoTable.finalY+12,head:[['Preparación']],body:[[r.instrucciones]]});
    let y=doc.lastAutoTable.finalY+14;
    const faltan=ls.filter(x=>x.falta);
    doc.setFontSize(8.5);
    if(faltan.length){ doc.setTextColor(170,40,40); const t=doc.splitTextToSize(`Atención: según el inventario no alcanza ${faltan.map(x=>`${x.material} (hay ${fmtCant(x.bodega)})`).join(', ')}.`,an-80); doc.text(t,40,y); y+=t.length*11+4; }
    doc.setTextColor(90,90,90);
    const ayuda=doc.splitTextToSize('Usar exactamente las cantidades indicadas. Anotar en "Usado real" lo que se usó, para registrarlo y comparar con la receta. Cualquier diferencia o desperdicio debe anotarse en observaciones.',an-80);
    doc.text(ayuda,40,y); y+=ayuda.length*11+10;
    if(y>al-150){ doc.addPage(); encabezadoPDF(doc,titulo,sub); y=alto; }
    doc.setDrawColor(200,200,200); doc.setTextColor(60,60,60); doc.setFontSize(9);
    doc.text('Observaciones:',40,y); [16,32,48].forEach(d2=>doc.line(40,y+d2,an-40,y+d2)); y+=100;
    const ancho=(an-80-40)/3;
    ['Elaboró','Entregó (bodega)','Recibió (producción)'].forEach((t,i)=>{ const x=40+i*(ancho+20); doc.line(x,y,x+ancho,y); doc.text(t,x+ancho/2,y+12,{align:'center'}); });
    const n=doc.internal.getNumberOfPages();
    for(let i=1;i<=n;i++){ doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(130,130,130); doc.text(`Generado el ${fFecha(hoy())}`,40,al-22); doc.text(`Página ${i} de ${n}`,an-40,al-22,{align:'right'}); }
    doc.save(`Hoja-Produccion-${archivoSeguro(r.producto)}${o?'-'+o.numero:''}.pdf`);
    registrarLog('Generó una hoja de producción',`${r.producto} — ${fmtCant(base)} ${r.baseUnidad||''}`.trim());
    avisarDatosIncompletos();
  }catch(err){ avisar('No se pudo generar el PDF: '+err.message+'\n\nEl generador se descarga de internet la primera vez, así que necesitás conexión.'); }
}
