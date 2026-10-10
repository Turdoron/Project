/* ============ CALENDARIO DE VENCIMIENTOS ============ */
/* Fechas límite de los impuestos y cuotas de cada empresa, según su régimen:
   · IVA mensual: último día hábil del mes siguiente (todos los regímenes; Pequeño Contribuyente en el SAT-2046).
   · ISR sobre utilidades: pagos trimestrales dentro de los 10 días hábiles siguientes al trimestre (Art. 38,
     Dto. 10-2012; el 4.º trimestre va en la anual) y liquidación anual a más tardar el 31 de marzo.
   · ISR opcional simplificado: dentro de los 10 primeros días hábiles del mes siguiente.
   · ISO: dentro del mes siguiente a cada trimestre (Art. 10, Dto. 73-2008), salvo trimestres exentos.
   · IGSS (cuotas laborales y patronales): a más tardar el día 20 del mes siguiente.
   · Retenciones de ISR de la planilla: dentro de los 10 primeros días hábiles del mes siguiente.
   · Bono 14: a más tardar el 15 de julio · Aguinaldo: 50% en la primera quincena de diciembre y 50% en la
     segunda de enero (o todo en diciembre).
   Días inhábiles: sábados, domingos y asuetos del Art. 127 del Código de Trabajo. Para "N días hábiles" solo se
   descuentan los asuetos completos; para "último día hábil" también los medios días (Miércoles Santo, 24 y 31 de
   diciembre): así el plazo que se muestra nunca queda después del real. */
function domingoPascua(a){
  const A=a%19,B=Math.floor(a/100),C=a%100,D=Math.floor(B/4),E=B%4,F=Math.floor((B+8)/25),G=Math.floor((B-F+1)/3),
    H=(19*A+B-D-G+15)%30,I=Math.floor(C/4),K=C%4,L=(32+2*E+2*I-H-K)%7,M=Math.floor((A+11*H+22*L)/451),
    mes=Math.floor((H+L-7*M+114)/31),dia=((H+L-7*M+114)%31)+1;
  return `${a}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
}
function asuetosGT(a,conMedios){
  const p=domingoPascua(a), s=['01-01','05-01','06-30','09-15','10-20','11-01','12-25'].map(x=>`${a}-${x}`);
  s.push(sumarDias(p,-3),sumarDias(p,-2));                                   // Jueves y Viernes Santo
  if(conMedios) s.push(sumarDias(p,-4),`${a}-12-24`,`${a}-12-31`);          // Miércoles Santo, 24 y 31 de diciembre
  return new Set(s);
}
function esHabil(f,conMedios){ const w=new Date(f+'T00:00:00Z').getUTCDay(); return w!==0&&w!==6&&!asuetosGT(+f.slice(0,4),conMedios).has(f); }
function ultimoHabilDelMes(anio,mes){ let f=finDeMes(anio,mes); while(!esHabil(f,true)) f=sumarDias(f,-1); return f; }
function habilesDespues(fecha,n){ let f=fecha, c=0; while(c<n){ f=sumarDias(f,1); if(esHabil(f,false)) c++; } return f; }
const corridoAHabil=f=>{ while(!esHabil(f,false)) f=sumarDias(f,1); return f; };
const finDeMes=(a,m)=>sumarDias(`${m===12?a+1:a}-${String(m===12?1:m+1).padStart(2,'0')}-01`,-1);
const MESES_CORTOS=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

/* Vencimientos de un año calendario (los del mes de diciembre caen en enero del año siguiente). */
function vencimientosEmpresa(e,anio){
  const lista=[], tieneEmpleados=(e.empleados||[]).some(x=>x.activo!==false);
  /* Nada de antes de que la empresa empezara a operar (o a registrarse en el sistema). */
  const inicio=e.inicioOperaciones||(e.partidas||[]).map(p=>p.fecha).filter(Boolean).sort()[0]||`${anio}-01-01`;
  const out={push:(...vs)=>vs.forEach(v=>{ if((v.fin||v.fecha)>=inicio) lista.push(v); })};
  const pagoIVA=(d,h)=>(e.partidas||[]).some(p=>p.liqIVA&&p.liqIVA.desde<=h&&p.liqIVA.hasta>=d)||(e.ivaDeclarado||[]).some(x=>x.desde<=h&&x.hasta>=d);
  const pagoISRmes=(d,h)=>(e.partidas||[]).some(p=>p.liqISR&&p.liqISR.desde<=h&&p.liqISR.hasta>=d);
  for(let m=1;m<=12;m++){
    const d=`${anio}-${String(m).padStart(2,'0')}-01`, h=finDeMes(anio,m), sigA=m===12?anio+1:anio, sigM=m===12?1:m+1, reg=regimenEn(e,h);
    /* Pequeño Contribuyente paga su 5% y los regímenes primario/pecuario su impuesto único con "Pagar impuesto"
       (liquidación tipo ISR); los demás, el IVA normal (SAT-2237). */
    if(reg==='pequeno'||reg==='primario'||reg==='pecuario') out.push({fin:h,clave:`iva-${anio}-${m}`,tipo:reg==='pequeno'?'IVA':'Impuesto',fecha:ultimoHabilDelMes(sigA,sigM),
      titulo:reg==='pequeno'?`IVA de ${MESES_CORTOS[m-1]} ${anio}`:`Impuesto único de ${MESES_CORTOS[m-1]} ${anio}`,
      detalle:reg==='pequeno'?'Pequeño Contribuyente (5%), formulario SAT-2046':'Impuesto único (1.5% sobre ventas brutas), Dto. 31-2024',pagado:pagoISRmes(d,h)});
    else out.push({fin:h,clave:`iva-${anio}-${m}`,tipo:'IVA',fecha:ultimoHabilDelMes(sigA,sigM),titulo:`IVA de ${MESES_CORTOS[m-1]} ${anio}`,
      detalle:'Formulario SAT-2237',pagado:pagoIVA(d,h)});
    if(reg==='simplificado') out.push({fin:h,clave:`isrm-${anio}-${m}`,tipo:'ISR',fecha:habilesDespues(h,10),titulo:`ISR de ${MESES_CORTOS[m-1]} ${anio}`,
      detalle:'Régimen opcional simplificado (5% / 7%), si no te lo retuvieron',pagado:pagoISRmes(d,h)});
    if(tieneEmpleados){
      out.push({fin:h,clave:`igss-${anio}-${m}`,tipo:'IGSS',fecha:corridoAHabil(`${sigA}-${String(sigM).padStart(2,'0')}-20`),titulo:`IGSS de ${MESES_CORTOS[m-1]} ${anio}`,detalle:'Cuotas laboral y patronal (y planilla electrónica)',...((e.partidas||[]).some(p=>p.pagoIGSS)?{pagado:(e.partidas||[]).some(p=>p.pagoIGSS&&p.pagoIGSS.hasta>=h)}:{})});
      out.push({fin:h,clave:`retisr-${anio}-${m}`,tipo:'ISR',fecha:habilesDespues(h,10),titulo:`Retenciones de ISR de ${MESES_CORTOS[m-1]} ${anio}`,detalle:'ISR retenido en la planilla'});
    }
  }
  /* El ISO solo si la empresa está afecta ese año (con el año anterior completo y margen de más del 4%). */
  const afectaISO=anio===e.ejercicio?calcularISO(e).aplica:(e.pagosISO||[]).some(p=>p.anio===anio);
  for(let t=1;t<=4;t++){
    const finT=finDeMes(anio,t*3), reg=regimenEn(e,finT);
    if(reg!=='general') continue;
    if(t<4) out.push({fin:finT,clave:`isrt-${anio}-${t}`,tipo:'ISR',fecha:habilesDespues(finT,10),titulo:`ISR trimestral ${t} de ${anio}`,
      detalle:'Cierre contable parcial o renta estimada (SAT-1361)',pagado:(e.cierresParciales||[]).some(c=>c.ejercicio===anio&&c.trimestre===t)});
    const sigA=t===4?anio+1:anio, sigM=t===4?1:t*3+1;
    if(afectaISO&&!isoExentoTrimestre(e,anio,t)) out.push({fin:finT,clave:`iso-${anio}-${t}`,tipo:'ISO',fecha:ultimoHabilDelMes(sigA,sigM),titulo:`ISO del trimestre ${t} de ${anio}`,
      detalle:'Impuesto de Solidaridad (SAT-1608)',pagado:(e.pagosISO||[]).some(p=>p.anio===anio&&p.trimestre===t)});
  }
  if(regimenEn(e,`${anio}-12-31`)==='general') out.push({fin:`${anio}-12-31`,clave:`isra-${anio}`,tipo:'ISR',fecha:corridoAHabil(`${anio+1}-03-31`),titulo:`ISR anual ${anio}`,
    detalle:'Liquidación definitiva anual (SAT-1411)',pagado:(e.partidas||[]).some(p=>(p.concepto||'').startsWith(`Cierre fiscal total ${anio}`))});
  if(tieneEmpleados){
    out.push({fin:`${anio}-06-30`,clave:`b14-${anio}`,tipo:'Prestaciones',fecha:`${anio}-07-15`,titulo:`Bono 14 de ${anio}`,detalle:'A más tardar el 15 de julio (Dto. 42-92)'});
    out.push({fin:`${anio}-11-30`,clave:`agui1-${anio}`,tipo:'Prestaciones',fecha:`${anio}-12-15`,titulo:`Aguinaldo ${anio} (primer 50%)`,detalle:'Primera quincena de diciembre (Dto. 76-78)'});
    out.push({fin:`${anio}-11-30`,clave:`agui2-${anio}`,tipo:'Prestaciones',fecha:`${anio+1}-01-31`,titulo:`Aguinaldo ${anio} (segundo 50%)`,detalle:'Segunda quincena de enero, si no se pagó completo en diciembre'});
  }
  return lista.sort((a,b)=>a.fecha.localeCompare(b.fecha));
}
/* Los que importan hoy: vencidos sin pagar (de los que el sistema sabe si se pagaron) y los próximos días. */
function vencimientosProximos(e,dias){
  const h=hoy(), lim=sumarDias(h,dias), a=+h.slice(0,4);
  /* Vencidos sin pagar: solo los de los últimos 90 días y de lo que el sistema sabe si se pagó (IVA, ISR, ISO). */
  return [...vencimientosEmpresa(e,a-1),...vencimientosEmpresa(e,a)].filter(v=>v.fecha<=lim&&!v.pagado&&(v.fecha>=h||(v.pagado===false&&v.fecha>=sumarDias(h,-90))))
    .sort((x,y)=>x.fecha.localeCompare(y.fecha));
}
const diasHasta=f=>diasEntre(hoy(),f)-1;
const textoPlazo=f=>{ const n=diasHasta(f); return n<0?`venció hace ${-n} día${n===-1?'':'s'}`:n===0?'vence hoy':n===1?'vence mañana':`en ${n} días`; };
function htmlAvisosVencimientos(e,dias=15){
  const l=vencimientosProximos(e,dias); if(!l.length) return '';
  const venc=l.filter(v=>diasHasta(v.fecha)<0);
  return `<div class="aviso${venc.length?' malo':''} avisos-venc"><strong>${venc.length?`${venc.length} vencimiento${venc.length===1?'':'s'} sin pagar`:'Próximos vencimientos'}</strong>
    <ul>${l.slice(0,6).map(v=>`<li><span>${esc(v.titulo)}</span> <strong>${fFecha(v.fecha)}</strong> · ${textoPlazo(v.fecha)}</li>`).join('')}</ul>
    <button class="btn mini sec" data-accion="irVencimientos">Ver el calendario</button></div>`;
}
VISTAS.vencimientos=()=>{
  const e=emp(), anio=+(filtros.anioVenc||e.ejercicio), h=hoy();
  const lista=vencimientosEmpresa(e,anio);
  const estado=v=>v.pagado===true?'<span class="venc-ok">Pagado</span>':v.fecha<h?(v.pagado===false?'<span class="venc-mal">Vencido</span>':'<span class="venc-pasado">Pasó</span>'):`<span class="venc-prox">${textoPlazo(v.fecha)}</span>`;
  const porMes={}; lista.forEach(v=>{ const k=v.fecha.slice(0,7); (porMes[k]=porMes[k]||[]).push(v); });
  return cab('Vencimientos',`Fechas límite de impuestos y cuotas de ${esc(e.nombre)}, según su régimen · ${anio}`,
    `<button class="btn" data-accion="calendarioICS">Agregar a mi calendario</button>`)
  +`<div class="barra"><div class="campo"><label for="anioVenc">Año</label><input id="anioVenc" type="number" data-filtro="anioVenc" value="${anio}" style="width:110px"></div></div>`
  +htmlAvisosVencimientos(e,15)
  +Object.entries(porMes).map(([k,vs])=>`<h3 class="venc-mes">${MESES_CORTOS[+k.slice(5)-1]} ${k.slice(0,4)}</h3>
    <table class="densa"><thead><tr><th>Fecha límite</th><th>Obligación</th><th>Detalle</th><th>Estado</th></tr></thead><tbody>
    ${vs.map(v=>`<tr><td><strong>${fFecha(v.fecha)}</strong></td><td><span class="venc-tipo">${esc(v.tipo)}</span> ${esc(v.titulo)}</td><td>${esc(v.detalle)}</td><td>${estado(v)}</td></tr>`).join('')}</tbody></table>`).join('')
  +`<div class="aviso">Las fechas se corren al día hábil según la ley, contando los asuetos nacionales (no los feriados municipales). «Pagado» se marca solo con lo que el sistema registra (IVA, ISR, ISO); IGSS, retenciones y prestaciones se muestran como recordatorio.
     «Agregar a mi calendario» descarga los vencimientos de ${anio} con alarmas 3 días y 1 día antes: en el teléfono abre la app de calendario; en la computadora se importa en Google Calendar u Outlook.</div>`;
};
ACCIONES.irVencimientos=()=>{ VISTA='vencimientos'; filtros={}; pintar(); };
ACCIONES.calendarioICS=()=>{
  const e=emp(), anio=+(filtros.anioVenc||e.ejercicio), lista=vencimientosEmpresa(e,anio);
  const txt=s=>String(s).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
  /* Líneas de 75 octetos como máximo (RFC 5545): se cuentan bytes, no letras, por las tildes. */
  const bytes=ch=>new TextEncoder().encode(ch).length;
  const plegar=l=>{ const out=[]; let cur='', n=0;
    for(const ch of l){ const b=bytes(ch); if(n+b>75){ out.push(cur); cur=' '; n=1; } cur+=ch; n+=b; }
    out.push(cur); return out.join('\r\n'); };
  const sello=new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
  const ev=v=>{ const d=v.fecha.replace(/-/g,''), d2=sumarDias(v.fecha,1).replace(/-/g,'');
    return ['BEGIN:VEVENT',`UID:${e.id}-${v.clave}@adcontis`,`DTSTAMP:${sello}`,`DTSTART;VALUE=DATE:${d}`,`DTEND;VALUE=DATE:${d2}`,
      `SUMMARY:${txt(`${v.titulo} — ${e.nombre}`)}`,`DESCRIPTION:${txt(`${v.detalle}. Fecha límite: ${fFecha(v.fecha)}.`)}`,'TRANSP:TRANSPARENT',
      'BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:${txt(v.titulo)}`,'TRIGGER:-P3D','END:VALARM',
      'BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:${txt(v.titulo)}`,'TRIGGER:-P1D','END:VALARM','END:VEVENT'].map(plegar).join('\r\n'); };
  const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//ADCONTIS//Vencimientos//ES','CALSCALE:GREGORIAN','METHOD:PUBLISH',
    plegar(`X-WR-CALNAME:${txt(`Vencimientos ${e.nombre}`)}`),'X-WR-TIMEZONE:America/Guatemala',...lista.map(ev),'END:VCALENDAR'].join('\r\n')+'\r\n';
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([ics],{type:'text/calendar;charset=utf-8'}));
  a.download=`Vencimientos-${anio}-${archivoSeguro(e.nombre)}.ics`; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500);
  registrarLog('Descargó el calendario de vencimientos',`${e.nombre} — ${anio} — ${lista.length} fechas`);
};
