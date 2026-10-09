/* ============ LIBRO DE SALARIOS ============ */
/* Art. 102 del Código de Trabajo: el patrono que ocupa permanentemente a diez o más trabajadores
   lleva un libro de salarios autorizado y sellado por la Dirección General de Trabajo (Acuerdo
   Ministerial 124-2019); de tres a nueve, planillas. Se arma por trabajador, período por período,
   con lo que ya registran las planillas, los pagos de prestaciones y la liquidación final.
   Art. 123: el trabajo extraordinario va en columna aparte del ordinario. */
const COLS_LIBRO_SALARIOS=[
  ['periodo','Período de trabajo'],['dias','Días trab.'],['ordinario','Salario ordinario'],['extraordinario','Salario extraordinario'],
  ['otros','Otros salarios'],['vacaciones','Vacaciones'],['total','Salario total'],['igss','IGSS laboral'],['isr','ISR'],
  ['totalDed','Total deducciones'],['bonif','Bonif. incentivo'],['otrasPrest','Aguinaldo, Bono 14 e indemnización'],['liquido','Líquido recibido']];
function filasLibroSalarios(e,x,anio){
  const desde=`${anio}-01-01`, hasta=`${anio}-12-31`, filas=[];
  (e.planillas||[]).filter(p=>p.fechaPago>=desde&&p.fechaPago<=hasta).forEach(p=>{
    const f=p.detalle.find(d=>d.empleadoId===x.id); if(!f) return;
    /* Mes de 30 días, como se calcula la planilla; si ingresó a mitad del período, los días reales desde su ingreso. */
    const base=x.fechaIngreso&&x.fechaIngreso>p.desde?Math.min(diasNominalesPeriodo(p.periodo),diasEntre(x.fechaIngreso,p.hasta)):diasNominalesPeriodo(p.periodo);
    const dias=Math.max(0,base-(f.diasFalta||0));
    const ordinario=r2((f.salarioPeriodo||0)-(f.descuentoHorasMenos||0)), extraordinario=r2((f.montoHorasExtra||0)+(f.montoHorasExtraDomingo||0)), otros=r2(f.bonoAdicional||0);
    const total=r2(ordinario+extraordinario+otros), igss=r2(f.igssLaboral||0), isr=r2(f.isr||0);
    filas.push({fecha:p.fechaPago,periodo:`${fFecha(p.desde)} al ${fFecha(p.hasta)}`,dias,ordinario,extraordinario,otros,vacaciones:0,total,igss,isr,
      totalDed:r2(igss+isr),bonif:r2(f.bonifPeriodo||0),otrasPrest:0,liquido:r2(f.liquido||0),
      nota:[f.horasExtra?`${f.horasExtra} h. extra`:'',f.horasExtraDomingo?`${f.horasExtraDomingo} h. en descanso`:'',f.diasFalta?`${f.diasFalta} día(s) de falta`:''].filter(Boolean).join(' · ')});
  });
  (e.pagosPrestaciones||[]).filter(p=>p.fechaPago>=desde&&p.fechaPago<=hasta).forEach(p=>{
    const f=p.detalle.find(d=>d.empleadoId===x.id); if(!f||!f.monto) return;
    const vac=p.tipo==='vacaciones', m=r2(f.monto);
    filas.push({fecha:p.fechaPago,periodo:`${PRESTACION_INFO[p.tipo].nombre}: ${fFecha(p.desde)} al ${fFecha(p.hasta)}`,dias:'',ordinario:0,extraordinario:0,otros:0,
      vacaciones:vac?m:0,total:vac?m:0,igss:0,isr:0,totalDed:0,bonif:0,otrasPrest:vac?0:m,liquido:m,nota:''});
  });
  (e.liquidaciones||[]).filter(l=>l.empleadoId===x.id&&l.fechaRetiro>=desde&&l.fechaRetiro<=hasta).forEach(l=>{
    const c=k=>r2(((l.conceptos||{})[k]||{}).debido||0), ded=l.deducciones||{};
    const vac=c('vacaciones'), otras=r2(c('aguinaldo')+c('bono14')+c('indemnizacion')), igss=r2(ded.igssLaboral||0), isr=r2(ded.isr||0);
    filas.push({fecha:l.fechaRetiro,periodo:`Liquidación final al ${fFecha(l.fechaRetiro)}`,dias:'',ordinario:0,extraordinario:0,otros:0,vacaciones:vac,total:vac,
      igss,isr,totalDed:r2(igss+isr),bonif:0,otrasPrest:otras,liquido:r2(l.total||0),nota:''});
  });
  return filas.sort((a,b)=>a.fecha.localeCompare(b.fecha)).map((f,i)=>({...f,n:i+1}));
}
function datosTrabajadorLibro(x){
  const edad=edadAl(x.fechaNac);
  return [['Nombre',x.nombre],['DPI',x.dpi||'—'],['Afiliación IGSS',x.igss||'—'],['Edad',edad!=null?`${edad} años`:'—'],
    ['Sexo',x.sexo==='F'?'Femenino':'Masculino'],['Nacionalidad',nacionalidadTxt(x.nacionalidad,x.sexo)],['Ocupación',x.puesto||'—'],
    ['Fecha de ingreso',x.fechaIngreso?fFecha(x.fechaIngreso):'—'],['Fecha de retiro',x.fechaRetiro?fFecha(x.fechaRetiro):'—'],
    ['Salario base mensual','Q'+Q(x.salarioBase||0)]];
}
VISTAS.libroSalarios=()=>{
  const e=emp(), anio=+(filtros.anioLS||e.ejercicio);
  const todos=(e.empleados||[]).map(x=>({x,filas:filasLibroSalarios(e,x,anio)}));
  const conMov=todos.filter(t=>t.filas.length), activos=(e.empleados||[]).filter(x=>x.activo!==false).length;
  const sel=filtros.empLS&&conMov.some(t=>t.x.id===filtros.empLS)?filtros.empLS:'';
  const mostrar=sel?conMov.filter(t=>t.x.id===sel):conMov;
  const faltanDatos=conMov.filter(t=>!t.x.dpi||!t.x.igss||!t.x.fechaNac).map(t=>t.x.nombre);
  const tabla=({x,filas})=>{
    const tot=k=>r2(filas.reduce((s,f)=>s+(+f[k]||0),0));
    return `<section class="ls-trab"><h3>${esc(x.nombre)}${x.activo===false?' <span class="etiqueta">baja</span>':''}</h3>
      <dl class="ls-datos">${datosTrabajadorLibro(x).slice(1).map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(String(v))}</dd></div>`).join('')}</dl>
      <table class="densa"><thead><tr><th class="num">No.</th>${COLS_LIBRO_SALARIOS.map(([k,n])=>`<th${k==='periodo'?'':' class="num"'}>${n}</th>`).join('')}</tr></thead>
      <tbody>${filas.map(f=>`<tr><td class="num">${f.n}</td>${COLS_LIBRO_SALARIOS.map(([k])=>k==='periodo'?`<td>${esc(f.periodo)}${f.nota?`<br><span class="ayuda-campo" style="margin:0">${esc(f.nota)}</span>`:''}</td>`
        :k==='dias'?`<td class="num">${f.dias}</td>`:`<td class="num">${f[k]?Q(f[k]):'—'}</td>`).join('')}</tr>`).join('')}</tbody>
      <tfoot><tr class="total"><td></td><td>Total ${anio}</td><td></td>${COLS_LIBRO_SALARIOS.slice(2).map(([k])=>`<td class="num">${Q(tot(k))}</td>`).join('')}</tr></tfoot></table></section>`;
  };
  return cab('Libro de Salarios',`Por trabajador y período de pago, con lo registrado en planillas, prestaciones y liquidaciones · ejercicio ${anio}`,
    conMov.length?`<button class="btn" data-accion="pdfLibroSalarios">Descargar PDF</button>`:'')
  +`<div class="barra"><div class="campo"><label for="lsAnio">Año</label><input id="lsAnio" type="number" data-filtro="anioLS" value="${anio}" style="width:110px"></div>
     <div class="campo ancho"><label for="lsEmp">Trabajador</label><select id="lsEmp" data-filtro="empLS"><option value="">Todos (${conMov.length})</option>${conMov.map(t=>`<option value="${t.x.id}"${sel===t.x.id?' selected':''}>${esc(t.x.nombre)}</option>`).join('')}</select></div></div>`
  +`<div class="aviso">El <strong>Art. 102 del Código de Trabajo</strong> obliga a llevar este libro, autorizado y sellado por la Dirección General de Trabajo, a quien ocupa permanentemente a <strong>diez o más</strong> trabajadores (de tres a nueve, bastan las planillas). ${activos?`Esta empresa tiene ${activos} trabajador${activos===1?'':'es'} activo${activos===1?'':'s'}${activos>=10?': le corresponde llevarlo':''}.`:''}
     El horario ordinario y el extraordinario van en columnas separadas (Art. 123). Si el libro lo llevás en el portal electrónico del Ministerio de Trabajo, usá estos montos para llenar su plantilla oficial.</div>`
  +(faltanDatos.length?`<div class="aviso">Al libro le faltan datos de ${faltanDatos.length} trabajador${faltanDatos.length===1?'':'es'} (DPI, afiliación al IGSS o fecha de nacimiento): ${esc(faltanDatos.join(', '))}. Completalos en <strong>Empleados → Editar</strong>.</div>`:'')
  +(mostrar.length?mostrar.map(tabla).join(''):`<div class="vacio">No hay pagos de salario registrados en ${anio}. El libro se llena solo con las planillas que generes.</div>`);
};
ACCIONES.pdfLibroSalarios=async()=>{
  const e=emp(), anio=+(filtros.anioLS||e.ejercicio);
  const lista=(e.empleados||[]).filter(x=>!filtros.empLS||x.id===filtros.empLS).map(x=>({x,filas:filasLibroSalarios(e,x,anio)})).filter(t=>t.filas.length);
  if(!lista.length){avisar(`No hay pagos de salario registrados en ${anio}.`);return}
  try{
    const jsPDF=await cargarJsPDF();
    const doc=new jsPDF({unit:'pt',format:'letter',orientation:'landscape'}), an=doc.internal.pageSize.getWidth();
    lista.forEach(({x,filas},i)=>{
      if(i>0) doc.addPage();
      let y=encabezadoPDF(doc,'Libro de Salarios',`Ejercicio ${anio}   ·   Art. 102 del Código de Trabajo   ·   cifras en quetzales`);
      const datos=datosTrabajadorLibro(x), colW=(an-80)/5;
      doc.setFontSize(8);
      datos.forEach(([k,v],j)=>{ const cx=40+(j%5)*colW, cy=y+Math.floor(j/5)*24;
        doc.setFont('helvetica','normal'); doc.setTextColor(110,110,110); doc.text(k,cx,cy+8);
        doc.setFont('helvetica','bold'); doc.setTextColor(30,30,30); doc.text(doc.splitTextToSize(String(v),colW-8)[0],cx,cy+19); });
      y+=Math.ceil(datos.length/5)*24+8;
      const tot=k=>r2(filas.reduce((s,f)=>s+(+f[k]||0),0));
      doc.autoTable({
        head:[['No.',...COLS_LIBRO_SALARIOS.map(c=>c[1]),'Firma']],
        body:[...filas.map(f=>[f.n,f.periodo+(f.nota?`\n${f.nota}`:''),f.dias,...COLS_LIBRO_SALARIOS.slice(2).map(([k])=>f[k]?Q(f[k]):'—'),'']),
          [{content:`Total ${anio}`,colSpan:3,styles:{fontStyle:'bold',textColor:VERDE}},...COLS_LIBRO_SALARIOS.slice(2).map(([k])=>({content:Q(tot(k)),styles:{fontStyle:'bold',halign:'right'}})),'']],
        startY:y, margin:{left:40,right:40,bottom:42,top:60},
        styles:{fontSize:7,cellPadding:3,lineColor:[225,222,212],lineWidth:.3,valign:'middle',minCellHeight:24},
        headStyles:{fillColor:VERDE,fontSize:6.5,halign:'center'},
        columnStyles:{0:{cellWidth:20,halign:'center'},1:{cellWidth:92},2:{cellWidth:28,halign:'center'},
          ...Object.fromEntries(COLS_LIBRO_SALARIOS.slice(2).map((c,j)=>[j+3,{halign:'right'}])),[COLS_LIBRO_SALARIOS.length+1]:{cellWidth:62}}
      });
    });
    pieDePagina(doc);
    doc.save(`Libro-de-Salarios-${anio}-${archivoSeguro(e.nombre)}.pdf`);
    registrarLog('Descargó el Libro de Salarios',`${anio} — ${lista.length} trabajador(es)`);
    avisarDatosIncompletos();
  }catch(err){ avisar('No se pudo generar el PDF: '+err.message+'\n\nEl generador se descarga de internet la primera vez, así que necesitás conexión.'); }
};

/* ============ DOCUMENTOS LABORALES ============ */
/* Constancia laboral, carta de despido (Art. 78: la causa se comunica por escrito) y aceptación de
   renuncia (Art. 83: preaviso). Se arman con los datos del trabajador y del patrono, se ven antes
   de descargar y quedan en un historial para volver a imprimirlos igual. */
const CAUSAS_DESPIDO_ART77={
  a:'Se condujo durante sus labores en forma abiertamente inmoral, o acudió a la injuria, la calumnia o las vías de hecho contra el patrono o sus representantes.',
  b:'Cometió alguno de esos actos contra otro trabajador, alterando la disciplina del lugar de trabajo.',
  c:'Fuera del lugar y de las horas de trabajo acudió a la injuria, la calumnia o las vías de hecho contra el patrono o sus representantes, sin haber sido provocado.',
  d:'Causó intencionalmente, o por negligencia grave, daño material en las máquinas, herramientas, materias primas, productos u otros bienes relacionados con el trabajo.',
  e:'Reveló secretos técnicos, comerciales o de fabricación de los productos a cuya elaboración concurre.',
  f:'Dejó de asistir al trabajo sin permiso del patrono o sin causa justificada durante dos días laborales completos y consecutivos, o durante seis medios días laborales en un mismo mes calendario.',
  g:'Se negó de manera manifiesta a adoptar las medidas preventivas o a seguir los procedimientos indicados para evitar accidentes o enfermedades.',
  h:'Violó las prohibiciones del artículo 64 del Código de Trabajo o del reglamento interior de trabajo, después de haber sido apercibido una vez por escrito.',
  i:'Al celebrar el contrato indujo en error al patrono con certificados, referencias o atestados personales falsos, o atribuyéndose cualidades o aptitudes que evidentemente no tiene.',
  j:'Fue condenado por sentencia ejecutoriada a sufrir pena de prisión.',
  k:'Incurrió en otra falta grave a las obligaciones que le impone el contrato.'};
const TIPOS_DOC_LABORAL={constancia:'Constancia laboral',despido:'Carta de despido',renuncia:'Aceptación de renuncia'};
/* Preaviso que debe dar quien renuncia (Art. 83), según su tiempo de servicio. */
function preavisoRenuncia(ingreso,fecha){
  const meses=ingreso?(+fecha.slice(0,4)-+ingreso.slice(0,4))*12+(+fecha.slice(5,7)-+ingreso.slice(5,7))-(+fecha.slice(8)<+ingreso.slice(8)?1:0):0;
  if(meses<6) return {dias:7,texto:'una semana'};
  if(meses<12) return {dias:10,texto:'diez días'};
  if(meses<60) return {dias:14,texto:'dos semanas'};
  return {dias:30,texto:'un mes'};
}
function membreteDoc(e){
  return `<p class="ct-membrete"><strong>${esc((e.nombre||'').toUpperCase())}</strong><br>${esc([e.direccion,e.nit?`NIT ${e.nit}`:''].filter(Boolean).join(' · '))}</p>`;
}
function firmaPatronoDoc(e,extra){
  const dc=datosContratoEmpresa(e), r=dc.rep;
  const cargo=dc.esSociedad?dc.cargo.charAt(0).toUpperCase()+dc.cargo.slice(1):'Propietario';
  return `<div class="ct-firmas"><div><span class="ct-linea"></span>${valCt(r.nombre,'representante')}<br><small>${esc(cargo)}</small><br><small>${esc(e.nombre)}</small></div>${extra||''}</div>`;
}
function htmlDocLaboral(e,x,tipo,o){
  const dc=datosContratoEmpresa(e), F=x.sexo==='F', g=(m,f)=>F?f:m;
  const lugar=`${nombreLugar(dc.municipio)}, ${fechaEnLetras(o.fecha)}`;
  const quien=`${g('el señor','la señora')} <strong>${esc((x.nombre||'').toUpperCase())}</strong>`;
  const dpi=x.dpi?`, quien se identifica con el Documento Personal de Identificación con Código Único de Identificación número ${esc(x.dpi)}`:'';
  const puesto=x.puesto?esc(x.puesto.toLowerCase()):faltaCt('puesto');
  if(tipo==='constancia'){
    const activo=!x.fechaRetiro;
    const salario=o.conSalario?`, devengando un salario ordinario mensual de ${quetzalesEnLetras(x.salarioBase).toUpperCase()} (Q ${Q(x.salarioBase)}), más la bonificación incentivo de doscientos cincuenta quetzales exactos (Q 250.00) mensuales`:'';
    return `${membreteDoc(e)}<p class="ct-derecha">${lugar}</p><h1 class="ct-titulo">CONSTANCIA LABORAL</h1>
      <p><strong>${esc((o.destinatario||'A quien interese').toUpperCase())}:</strong></p>
      <p>Por este medio, <strong>${esc(e.nombre)}</strong> hace constar que ${quien}${dpi}, ${activo?'labora':'laboró'} en esta entidad desde el ${x.fechaIngreso?fechaEnLetras(x.fechaIngreso):faltaCt('fecha de ingreso')}${activo?' a la fecha':` hasta el ${fechaEnLetras(x.fechaRetiro)}`}, desempeñando el puesto de ${puesto}${salario}.</p>
      ${o.nota?`<p>${esc(o.nota)}</p>`:''}
      <p>Se extiende la presente a solicitud de${g('l interesado',' la interesada')}, para los usos que a ${g('él','ella')} convengan.</p>
      <p>Atentamente,</p>${firmaPatronoDoc(e)}`;
  }
  const encab=`${membreteDoc(e)}<p class="ct-derecha">${lugar}</p>
    <p>${g('Señor','Señora')}<br><strong>${esc(x.nombre||'')}</strong><br>${x.puesto?esc(x.puesto)+'<br>':''}Presente.</p>`;
  const recibi=`<div><span class="ct-linea"></span>Recibí: ${esc(x.nombre||'')}<br><small>Fecha: ____ / ____ / ________</small></div>`;
  if(tipo==='despido'){
    const just=o.motivo==='justificado';
    const causa=just?`con fundamento en el artículo 77, literal ${o.inciso}), del Código de Trabajo, porque: ${esc(o.hechos||CAUSAS_DESPIDO_ART77[o.inciso]||'')}`:'sin causa justificada, con responsabilidad de nuestra parte';
    return `${encab}<h1 class="ct-titulo">CARTA DE DESPIDO</h1>
      <p>Por este medio le notificamos que <strong>${esc(e.nombre)}</strong> da por terminada la relación de trabajo que tiene con usted, a partir del ${o.fechaEfectiva?fechaEnLetras(o.fechaEfectiva):faltaCt('fecha')}, ${causa}.</p>
      ${just?`<p>Esta comunicación se hace por escrito, indicando la causa del despido, en cumplimiento del artículo 78 del Código de Trabajo. Se le pagará el salario que se le adeude y las prestaciones que le correspondan: aguinaldo, bonificación anual (Bono 14) y vacaciones, en la parte proporcional al tiempo trabajado.</p>`
        :`<p>De conformidad con el artículo 82 del Código de Trabajo, se le pagará la indemnización por tiempo de servicio, junto con el salario que se le adeude y las prestaciones que le correspondan: aguinaldo, bonificación anual (Bono 14) y vacaciones, en la parte proporcional al tiempo trabajado.</p>`}
      <p>${o.entrega?esc(o.entrega):'Le agradeceremos devolver los bienes de la empresa que tenga a su cargo y presentarse a recibir su liquidación en la fecha que se le indique.'}</p>
      <p>Atentamente,</p>${firmaPatronoDoc(e,recibi)}`;
  }
  const pre=preavisoRenuncia(x.fechaIngreso,o.fechaPresentacion||o.fecha);
  const diasAviso=o.fechaPresentacion&&o.ultimoDia?diasEntre(o.fechaPresentacion,o.ultimoDia)-1:null;
  const preTxt=o.dispensar?`Le dispensamos del preaviso que establece el artículo 83 del Código de Trabajo.`
    :diasAviso!=null&&diasAviso<pre.dias?`Le recordamos que, por su tiempo de servicio, el preaviso que establece el artículo 83 del Código de Trabajo es de ${pre.texto}.`
    :`Se tiene por cumplido el preaviso que establece el artículo 83 del Código de Trabajo.`;
  return `${encab}<h1 class="ct-titulo">ACEPTACIÓN DE RENUNCIA</h1>
    <p>Acusamos recibo de su carta de renuncia presentada el ${o.fechaPresentacion?fechaEnLetras(o.fechaPresentacion):faltaCt('fecha de la renuncia')}, la cual <strong>${esc(e.nombre)}</strong> acepta. Su último día de labores será el ${o.ultimoDia?fechaEnLetras(o.ultimoDia):faltaCt('último día')}.</p>
    <p>${preTxt}</p>
    <p>Por tratarse de una renuncia voluntaria no corresponde indemnización. Se le pagará el salario que se le adeude y las prestaciones que le correspondan: aguinaldo, bonificación anual (Bono 14) y vacaciones, en la parte proporcional al tiempo trabajado.</p>
    <p>Le agradecemos los servicios prestados y le deseamos éxito en sus próximos proyectos.</p>
    <p>Atentamente,</p>${firmaPatronoDoc(e,recibi)}`;
}
VISTAS.documentosLaborales=()=>{
  const e=emp(), lista=(e.empleados||[]).slice().sort((a,b)=>(a.activo===false)-(b.activo===false)||a.nombre.localeCompare(b.nombre));
  const hist=(e.documentosLaborales||[]).slice().sort((a,b)=>b.creado.localeCompare(a.creado));
  const liq=id=>(e.liquidaciones||[]).filter(l=>l.empleadoId===id).sort((a,b)=>b.fechaRetiro.localeCompare(a.fechaRetiro))[0];
  return cab('Documentos laborales','Constancias, cartas de despido y aceptación de renuncia, con los datos del trabajador y del patrono. Se imprimen para firmar.')
  +(lista.length?`<table><thead><tr><th>Trabajador</th><th>Puesto</th><th>Ingreso</th><th class="num"></th></tr></thead><tbody>
    ${lista.map(x=>{ const l=liq(x.id); return `<tr${x.activo===false?' style="opacity:.6"':''}><td>${esc(x.nombre)}${x.activo===false?' <span class="etiqueta">baja</span>':''}</td><td>${esc(x.puesto||'—')}</td><td>${x.fechaIngreso?fFecha(x.fechaIngreso):'—'}</td>
      <td class="num" style="white-space:nowrap"><button class="btn mini" data-accion="docLaboral" data-tipo="constancia" data-id="${x.id}">Constancia</button>
      ${x.activo===false?'':`<button class="btn mini sec" data-accion="docLaboral" data-tipo="despido" data-id="${x.id}">Despido</button> <button class="btn mini sec" data-accion="docLaboral" data-tipo="renuncia" data-id="${x.id}">Renuncia</button>`}
      ${l?`<button class="btn mini sec" data-accion="pdfFiniquito" data-id="${l.id}">Finiquito</button>`:''}</td></tr>`; }).join('')}</tbody></table>`
    :`<div class="vacio">Todavía no hay empleados. Agregalos en Empleados.</div>`)
  +`<div class="aviso">Al despedir, la causa se comunica <strong>por escrito</strong> (Art. 78 del Código de Trabajo). El finiquito se genera al <strong>liquidar</strong> al trabajador en Empleados. Revisá cada carta antes de firmarla: es un modelo y conviene adaptarla a cada caso.</div>`
  +(hist.length?`<h3 style="margin:24px 0 8px">Documentos generados</h3><table style="font-size:13px"><thead><tr><th>Fecha</th><th>Documento</th><th>Trabajador</th><th class="num"></th></tr></thead><tbody>
    ${hist.map(d=>`<tr><td>${fFecha(d.opciones.fecha)}</td><td>${TIPOS_DOC_LABORAL[d.tipo]}</td><td>${esc(d.nombre)}</td>
      <td class="num"><button class="btn mini sec" data-accion="pdfDocLaboral" data-id="${d.id}">Descargar PDF</button></td></tr>`).join('')}</tbody></table>`:'');
};
ACCIONES.docLaboral=d0=>{
  const e=emp(), x=(e.empleados||[]).find(y=>y.id===d0.id), tipo=d0.tipo;
  if(!x||!TIPOS_DOC_LABORAL[tipo]) return;
  const h=hoy(), pre=preavisoRenuncia(x.fechaIngreso,h);
  const campos={
    constancia:`<div class="campo"><label>Fecha</label><input name="fecha" type="date" value="${h}"></div>
      <div class="campo"><label>Dirigida a</label><input name="destinatario" value="A quien interese"></div>
      <label class="chequeo full"><input type="checkbox" name="conSalario"><span>Incluir el salario (Q${Q(x.salarioBase)} + bonificación incentivo)</span></label>
      <div class="campo full"><label>Párrafo adicional (opcional)</label><textarea name="nota" rows="2" placeholder="Ej.: Durante su permanencia ha demostrado responsabilidad y buena conducta."></textarea></div>`,
    despido:`<div class="campo"><label>Fecha de la carta</label><input name="fecha" type="date" value="${h}"></div>
      <div class="campo"><label>Despido a partir del</label><input name="fechaEfectiva" type="date" value="${h}"></div>
      <div class="campo full"><label>Tipo de despido</label><select name="motivo"><option value="justificado">Justificado (Art. 77): sin indemnización</option><option value="injustificado">Sin causa justificada: con indemnización (Art. 82)</option></select></div>
      <div class="campo full" data-despido="justificado"><label>Causa (Art. 77 del Código de Trabajo)</label><select name="inciso">${Object.entries(CAUSAS_DESPIDO_ART77).map(([k,v])=>`<option value="${k}">${k}) ${esc(v.length>95?v.slice(0,92)+'…':v)}</option>`).join('')}</select></div>
      <div class="campo full" data-despido="justificado"><label>Hechos concretos</label><textarea name="hechos" rows="3" placeholder="Describí qué pasó y cuándo (fechas, lugar). Si lo dejás vacío, se usa el texto de la causa."></textarea></div>
      <div class="campo full"><label>Indicaciones de entrega (opcional)</label><input name="entrega" placeholder="Ej.: Presentarse el lunes 12 a las 9:00 a Recursos Humanos a recibir su liquidación."></div>`,
    renuncia:`<div class="campo"><label>Fecha de la carta</label><input name="fecha" type="date" value="${h}"></div>
      <div class="campo"><label>Presentó la renuncia el</label><input name="fechaPresentacion" type="date" value="${h}"></div>
      <div class="campo"><label>Último día de labores</label><input name="ultimoDia" type="date" value=""></div>
      <label class="chequeo full"><input type="checkbox" name="dispensar"><span>Dispensarle el preaviso</span></label>
      <p class="ayuda-campo full" id="ayudaPreaviso">Por su tiempo de servicio, el preaviso es de ${pre.texto} (Art. 83).</p>`};
  abrirModal(`${TIPOS_DOC_LABORAL[tipo]} — ${esc(x.nombre)}`,
    `<div class="rej">${campos[tipo]}</div><p class="ayuda-campo" style="margin:10px 0 6px">Vista previa</p><article class="ct-hoja doc-previa" id="docPrevia" tabindex="0" aria-label="Vista previa del documento"></article>`,
    async f=>{
      const o=opcionesDocLaboral(tipo,f);
      if(tipo==='despido'&&!o.fechaEfectiva){avisar('Escribí desde cuándo es el despido.');return false}
      if(tipo==='renuncia'&&(!o.fechaPresentacion||!o.ultimoDia)){avisar('Escribí la fecha de la renuncia y el último día de labores.');return false}
      if(tipo==='renuncia'&&o.ultimoDia<o.fechaPresentacion){avisar('El último día no puede ser antes de la renuncia.');return false}
      e.documentosLaborales=e.documentosLaborales||[];
      const doc={id:uid(),tipo,empleadoId:x.id,nombre:x.nombre,opciones:o,creado:new Date().toISOString()};
      e.documentosLaborales.push(doc); registrarLog(`Generó ${TIPOS_DOC_LABORAL[tipo].toLowerCase()}`,x.nombre); guardar();
      await descargarDocLaboral(e,doc); pintar();
    },'Descargar PDF');
  const previa=()=>{
    const f=Object.fromEntries([...mForm.querySelectorAll('[name]')].map(i=>[i.name,i.type==='checkbox'?i.checked:i.value]));
    mForm.querySelectorAll('[data-despido]').forEach(el=>el.hidden=f.motivo!==el.dataset.despido);
    if(tipo==='renuncia'){ const p=preavisoRenuncia(x.fechaIngreso,f.fechaPresentacion||h), dias=f.fechaPresentacion&&f.ultimoDia?diasEntre(f.fechaPresentacion,f.ultimoDia)-1:null;
      document.getElementById('ayudaPreaviso').textContent=`Por su tiempo de servicio, el preaviso es de ${p.texto} (Art. 83)`+(dias!=null?`; entre la renuncia y su último día hay ${dias} día${dias===1?'':'s'}${dias<p.dias&&!f.dispensar?': la carta se lo recuerda, o marcá «Dispensarle el preaviso»':''}.`:'.'); }
    document.getElementById('docPrevia').innerHTML=htmlDocLaboral(e,x,tipo,opcionesDocLaboral(tipo,f));
  };
  mForm.querySelectorAll('[name]').forEach(i=>i.addEventListener(i.tagName==='SELECT'||i.type==='checkbox'?'change':'input',previa));
  previa();
};
function opcionesDocLaboral(tipo,f){
  const o={fecha:f.fecha||hoy()};
  if(tipo==='constancia') Object.assign(o,{destinatario:(f.destinatario||'').trim()||'A quien interese',conSalario:!!f.conSalario,nota:(f.nota||'').trim()});
  if(tipo==='despido') Object.assign(o,{fechaEfectiva:f.fechaEfectiva||'',motivo:f.motivo,inciso:f.inciso,hechos:(f.hechos||'').trim(),entrega:(f.entrega||'').trim()});
  if(tipo==='renuncia') Object.assign(o,{fechaPresentacion:f.fechaPresentacion||'',ultimoDia:f.ultimoDia||'',dispensar:!!f.dispensar});
  return o;
}
async function descargarDocLaboral(e,d){
  const x=(e.empleados||[]).find(y=>y.id===d.empleadoId)||{nombre:d.nombre};
  try{
    const jsPDF=await cargarJsPDF(), r=armarPdfHtml(jsPDF,htmlDocLaboral(e,x,d.tipo,d.opciones));
    r.doc.save(`${archivoSeguro(TIPOS_DOC_LABORAL[d.tipo])}-${archivoSeguro(d.nombre)}-${d.opciones.fecha}.pdf`);
  }catch(err){ avisar('No se pudo generar el PDF: '+err.message+'\n\nEl generador se descarga de internet la primera vez, así que necesitás conexión.'); }
}
ACCIONES.pdfDocLaboral=d0=>{ const e=emp(), d=(e.documentosLaborales||[]).find(y=>y.id===d0.id); if(d) return descargarDocLaboral(e,d); };

/* ============ REGISTRO DEL CONTRATO EN LA DIRECCIÓN GENERAL DE TRABAJO ============ */
/* Art. 28 del Código de Trabajo: el patrono remite copia del contrato a la Dirección General de
   Trabajo dentro de los quince días siguientes a su celebración. Se cuentan días hábiles (sin
   sábados ni domingos; los asuetos no se descuentan, así que el plazo real puede ser un poco mayor). */
function limiteRegistroContrato(fecha){
  if(!fecha) return '';
  const d=new Date(fecha+'T00:00:00Z'); let n=0;
  while(n<15){ d.setUTCDate(d.getUTCDate()+1); const w=d.getUTCDay(); if(w!==0&&w!==6) n++; }
  return d.toISOString().slice(0,10);
}
function estadoRegistroContrato(c){
  if(c.registro&&c.registro.fecha) return {estado:'ok',texto:`Presentado el ${fFecha(c.registro.fecha)}${c.registro.numero?` · No. ${c.registro.numero}`:''}`};
  const lim=limiteRegistroContrato(c.fecha);
  if(!lim) return {estado:'sin',texto:'Sin fecha de contrato'};
  return lim<hoy()?{estado:'vencido',texto:`Venció el ${fFecha(lim)}`,limite:lim}:{estado:'pendiente',texto:`Presentar a más tardar el ${fFecha(lim)}`,limite:lim};
}
ACCIONES.registroContrato=d0=>{
  const e=emp(), c=(e.contratos||[]).find(x=>x.id===d0.id); if(!c) return;
  const r=c.registro||{};
  abrirModal(`Registro del contrato No. ${c.numero} en Trabajo`,
    `<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">El patrono debe remitir una copia del contrato a la <strong>Dirección General de Trabajo</strong> dentro de los quince días siguientes a su celebración (Art. 28 del Código de Trabajo).${c.fecha?` Para este contrato, a más tardar el <strong>${fFecha(limiteRegistroContrato(c.fecha))}</strong> (días hábiles, sin contar asuetos).`:''}</p>
     <div class="rej"><div class="campo"><label>Fecha en que se presentó</label><input name="fecha" type="date" value="${r.fecha||hoy()}"></div>
       <div class="campo"><label>Número de registro o expediente (opcional)</label><input name="numero" value="${esc(r.numero||'')}"></div></div>
     ${r.fecha?'<p class="ayuda-campo">Para quitar el registro, borrá la fecha y guardá.</p>':''}`,
    f=>{ c.registro=f.fecha?{fecha:f.fecha,numero:(f.numero||'').trim()}:null;
      registrarLog(f.fecha?'Registró un contrato en Trabajo':'Quitó el registro de un contrato',`No. ${c.numero}`); guardar(); pintar(); },'Guardar');
};
