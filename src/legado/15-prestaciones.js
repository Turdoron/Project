/* ============ LIQUIDACIÓN FINAL DE UN EMPLEADO QUE SE RETIRA ============ */
/* Lo que hay provisionado y todavía sin pagar de una prestación para un empleado: lo que
   fueron acumulando sus planillas, menos lo ya pagado y menos lo que ya cancelaron liquidaciones. */
function provisionPendienteEmpleado(e,empleadoId,tipo){
  const prov=(e.planillas||[]).filter(p=>p.partidaNumero).reduce((s,p)=>s+p.detalle.filter(f=>f.empleadoId===empleadoId)
    .reduce((a,f)=>a+((f.prestaciones||{})[tipo]||0),0),0);
  const pagado=(e.pagosPrestaciones||[]).filter(p=>p.tipo===tipo).reduce((s,p)=>s+p.detalle
    .filter(f=>f.empleadoId===empleadoId).reduce((a,f)=>a+(f.monto||0),0),0);
  const liq=(e.liquidaciones||[]).filter(l=>l.empleadoId===empleadoId)
    .reduce((s,l)=>s+(((l.conceptos||{})[tipo]||{}).provision||0),0);
  return r2(Math.max(0,prov-pagado-liq));
}
/* Cuánto se le debe a quien se retira, por cada concepto. Todas son una proporción de su monto
   de un año, medida contra los días REALES del período —365 o 366—, de modo que un período
   completo paga exactamente un sueldo (o medio, en vacaciones) aunque haya cruzado un 29 de febrero:
   · Indemnización: (sueldo × 14 ÷ 12) por año de servicio = (((sueldo × 14) ÷ 12) ÷ 365) × días
     laborados, con los años completos contados como años y solo la fracción del año en curso
     medida en días.
   · Aguinaldo: sueldo × días trabajados del período (1 dic – 30 nov) ÷ días del período.
   · Bono 14: sueldo × días trabajados del período (1 jul – 30 jun) ÷ días del período.
   · Vacaciones: (sueldo ÷ 2) × días del año de servicio en curso ÷ días de ese año, contado desde
     el aniversario de ingreso. Se pagan cada año y no se acumulan: lo de años anteriores solo se
     suma si se indica expresamente (aniosVacPendientes). */
function calcularLiquidacion(emp,fechaRetiro,aniosVacPendientes){
  const ing=emp.fechaIngreso, sal=emp.salarioBase, anio=+fechaRetiro.slice(0,4);
  const mayor=(a,b)=>a>b?a:b;
  const bisiesto=y=>(y%4===0&&y%100!==0)||y%400===0;
  const enAnio=(y,mmdd)=>mmdd==='02-29'&&!bisiesto(y)?`${y}-02-28`:`${y}-${mmdd}`;
  const masDia=(f,k)=>{ const d=new Date(f+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+k); return d.toISOString().slice(0,10); };
  const ultimo=mmdd=>{ const f=enAnio(anio,mmdd); return f<=fechaRetiro?f:enAnio(anio-1,mmdd); };

  const diasLaborados=diasEntre(ing,fechaRetiro);
  /* Aguinaldo y Bono 14: período legal en curso, y cuántos días tiene de verdad. */
  const periodo=(mmdd,finMMDD)=>{
    const ini=ultimo(mmdd), fin=enAnio(+ini.slice(0,4)+1,finMMDD);
    return {trabajados:diasEntre(mayor(ing,ini),fechaRetiro), delPeriodo:diasEntre(ini,fin), ini};
  };
  const ag=periodo('12-01','11-30'), b14=periodo('07-01','06-30');
  /* Años de servicio: completos, más la fracción del año en curso. */
  const aniv=n=>enAnio(+ing.slice(0,4)+n,ing.slice(5));
  let n=0; while(masDia(aniv(n+1),-1)<=fechaRetiro) n++;
  const iniParcial=aniv(n), diasParcial=fechaRetiro>=iniParcial?diasEntre(iniParcial,fechaRetiro):0;
  const diasAnioServicio=diasEntre(iniParcial,masDia(aniv(n+1),-1));
  const aniosServicio=n+diasParcial/diasAnioServicio;
  /* Vacaciones: el año de servicio en curso, desde el último aniversario (o desde el ingreso, el primer año). */
  let inicioVac=enAnio(+ultimo(ing.slice(5)).slice(0,4),ing.slice(5));
  if(inicioVac<ing) inicioVac=ing;
  const finVac=masDia(enAnio(+inicioVac.slice(0,4)+1,ing.slice(5)),-1);
  const diasVac=diasEntre(inicioVac,fechaRetiro), diasAnioVac=diasEntre(inicioVac,finVac);
  const anteriores=Math.min(5,Math.max(0,Math.floor(+aniosVacPendientes||0)));   // máximo 5 años (Art. 136, Código de Trabajo)

  return {diasLaborados,aniosServicio,
    diasAg:ag.trabajados,diasPeriodoAg:ag.delPeriodo,iniAg:ag.ini,iniB14:b14.ini,
    diasB14:b14.trabajados,diasPeriodoB14:b14.delPeriodo,
    diasVac,diasAnioVac,aniosVacPendientes:anteriores,
    indemnizacion:r2(sal*14/12*aniosServicio),
    aguinaldo:r2(sal*ag.trabajados/ag.delPeriodo),
    bono14:r2(sal*b14.trabajados/b14.delPeriodo),
    vacaciones:r2(sal/2*diasVac/diasAnioVac+anteriores*sal/2)};
}
const LIQUIDACION_CONCEPTOS=[
  {k:'indemnizacion',nombre:'Indemnización',pasivo:'2.1.14',nPasivo:'Indemnización por pagar (provisión)',gasto:'6.2.21',nGasto:'Provisión de indemnización'},
  {k:'aguinaldo',nombre:'Aguinaldo proporcional',pasivo:'2.1.11',nPasivo:'Aguinaldo por pagar',gasto:'6.2.18',nGasto:'Provisión de aguinaldo'},
  {k:'bono14',nombre:'Bono 14 proporcional',pasivo:'2.1.12',nPasivo:'Bono 14 por pagar',gasto:'6.2.19',nGasto:'Provisión de Bono 14'},
  {k:'vacaciones',nombre:'Vacaciones pendientes',pasivo:'2.1.13',nPasivo:'Vacaciones por pagar',gasto:'6.2.20',nGasto:'Provisión de vacaciones'}];
const MOTIVOS_RETIRO={
  despido_injustificado:{nombre:'Despido injustificado o indirecto — corresponde indemnización',indemniza:true},
  renuncia:{nombre:'Renuncia voluntaria',indemniza:false},
  mutuo:{nombre:'Mutuo acuerdo (si se pactó pagar indemnización, escribí el monto)',indemniza:false},
  despido_justificado:{nombre:'Despido justificado',indemniza:false}};

ACCIONES.liquidarEmpleado=d=>{
  if(!puedeEliminar()){avisar('Tu rol no tiene permiso para liquidar empleados. Pedile a tu gerente que lo haga.');return}
  const e=emp(), x=e.empleados.find(y=>y.id===d.id);
  if(!x){avisar('No se encontró ese empleado.');return}
  if(!x.fechaIngreso){avisar('A este empleado le falta la fecha de ingreso: sin ella no se puede calcular su liquidación. Agregala en Editar.');return}
  const cajaBanco=cuentasCajaBanco(e);
  if(!cajaBanco.length){avisar('El catálogo no tiene ninguna cuenta de Caja o Bancos.');return}
  abrirModal(`Liquidar a ${esc(x.nombre)}`,
    `<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">Ingresó el ${fFecha(x.fechaIngreso)} · sueldo base Q${Q(x.salarioBase)}.
      Los montos salen de la fórmula de cada prestación y se pueden ajustar. Lo que ya estaba provisionado en sus planillas se cancela, y la diferencia se lleva a gasto (o se libera, si sobraba).</p>
    <div class="rej">
      <div class="campo"><label>Fecha de retiro</label><input name="fechaRetiro" type="date" value="${hoy()}"></div>
      <div class="campo"><label>Se paga desde</label><select name="cuenta">${cajaBanco.map(c=>`<option value="${c.c}">${c.c} — ${esc(c.n)}</option>`).join('')}</select></div>
      <div class="campo full"><label>Motivo del retiro</label><select name="motivo">${Object.entries(MOTIVOS_RETIRO).map(([k,m])=>`<option value="${k}">${m.nombre}</option>`).join('')}</select></div>
      <div class="campo full"><label>Años de vacaciones de años anteriores que no se gozaron ni se pagaron</label>
        <input name="aniosVac" type="number" min="0" step="1" value="0">
        <span style="font-size:12.5px;color:var(--tinta-suave)">Las vacaciones deben gozarse cada año. Si al terminar la relación le quedaron años sin gozar ni pagar, se pueden reclamar hasta 5 (Art. 136, Código de Trabajo): escribí cuántos (cada uno suma medio sueldo).</span></div>
    </div>
    <table style="font-size:13px;margin-top:10px"><thead><tr><th>Concepto</th><th class="num">Se le debe</th><th class="num">Ya provisionado</th><th class="num">Ajuste a gasto</th></tr></thead>
      <tbody id="tbLiq"></tbody><tfoot><tr class="total"><td>Total neto a pagar</td><td class="num" id="totLiq"></td><td colspan="2"></td></tr></tfoot></table>
    <p id="detalleLiq" style="margin:8px 0 0;font-size:12.5px;color:var(--tinta-suave)"></p>
    <div class="aviso">La indemnización, el aguinaldo y el Bono 14 están exentos de IGSS y de ISR. Las vacaciones pagadas sí llevan IGSS laboral y patronal e ISR: se calculan solos y los podés ajustar. No incluye el sueldo de los días trabajados del último período (eso va en la planilla). Las vacaciones son las del año de servicio en curso; si le quedan años anteriores pendientes, indicalo arriba.</div>`,
    f=>{
      if(!f.fechaRetiro){avisar('Escribí la fecha de retiro.');return false}
      if(f.fechaRetiro<x.fechaIngreso){avisar('La fecha de retiro no puede ser anterior a la de ingreso.');return false}
      const montos={}, conceptos={};
      let total=0;
      for(const c of LIQUIDACION_CONCEPTOS){
        const v=r2(+mForm.querySelector(`[name="m_${c.k}"]`).value||0);
        if(v<0){avisar('Los montos no pueden ser negativos.');return false}
        montos[c.k]=v; total=r2(total+v);
      }
      const lineas=[];
      LIQUIDACION_CONCEPTOS.forEach(c=>{
        const D=montos[c.k], P=provisionPendienteEmpleado(e,x.id,c.k);
        conceptos[c.k]={debido:D,provision:P};
        if(!D&&!P) return;
        asegurarCuenta(e,c.pasivo,c.nPasivo,'pasivo'); asegurarCuenta(e,c.gasto,c.nGasto,'gasto');
        if(P>0) lineas.push({cta:c.pasivo,desc:`Liquidación de ${x.nombre}`,debe:P,haber:0});
        if(D>P) lineas.push({cta:c.gasto,desc:`Liquidación de ${x.nombre}`,debe:r2(D-P),haber:0});
        if(P>D) lineas.push({cta:c.gasto,desc:`Liquidación de ${x.nombre} — provisión que sobraba`,debe:0,haber:r2(P-D)});
      });
      let partidaNumero=null, partidaId=null;
      /* Descuentos y cargos: IGSS laboral e ISR salen del pago al empleado; las cuotas patronales son gasto de la empresa. */
      const igssLab=r2(+mForm.querySelector('[name="d_igss"]').value||0), isrLiq=r2(+mForm.querySelector('[name="d_isr"]').value||0);
      if(igssLab<0||isrLiq<0){avisar('Los descuentos no pueden ser negativos.');return false}
      if(igssLab+isrLiq>total+0.004){avisar('Los descuentos no pueden superar lo que se le debe.');return false}
      const pat=cargosSobreVacaciones(x.salarioBase,montos.vacaciones,f.fechaRetiro.slice(0,4));
      const patronalTotal=r2(pat.igssPatronal+pat.intecap+pat.irtra);
      const bruto=total, neto=r2(total-igssLab-isrLiq);
      if(patronalTotal>0){
        asegurarCuenta(e,'6.2.16','Cuota patronal INTECAP','gasto'); asegurarCuenta(e,'6.2.17','Cuota patronal IRTRA','gasto');
        lineas.push({cta:'6.2.03',desc:`Cuota patronal IGSS — liquidación de ${x.nombre}`,debe:pat.igssPatronal,haber:0},
          {cta:'6.2.16',desc:`INTECAP — liquidación de ${x.nombre}`,debe:pat.intecap,haber:0},
          {cta:'6.2.17',desc:`IRTRA — liquidación de ${x.nombre}`,debe:pat.irtra,haber:0},
          {cta:'2.1.08',desc:`Cuotas patronales — liquidación de ${x.nombre}`,debe:0,haber:patronalTotal});
      }
      if(igssLab>0) lineas.push({cta:'2.1.07',desc:`IGSS laboral — liquidación de ${x.nombre}`,debe:0,haber:igssLab});
      if(isrLiq>0) lineas.push({cta:'2.1.06',desc:`ISR retenido — liquidación de ${x.nombre}`,debe:0,haber:isrLiq});
      total=neto;
      if(total>0) lineas.push({cta:f.cuenta,desc:`Liquidación de ${x.nombre}`,debe:0,haber:total});
      if(lineas.length){
        const p={id:uid(),numero:e.correlativo++,fecha:f.fechaRetiro,
          concepto:`Liquidación final de ${x.nombre} — ${MOTIVOS_RETIRO[f.motivo].nombre.split(' — ')[0]}`,
          docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:x.nombre,lineas};
        e.partidas.push(p); partidaNumero=p.numero; partidaId=p.id;
      }
      e.liquidaciones=e.liquidaciones||[];
      e.liquidaciones.push({id:uid(),empleadoId:x.id,nombre:x.nombre,fechaRetiro:f.fechaRetiro,motivo:f.motivo,
        diasLaborados:diasEntre(x.fechaIngreso,f.fechaRetiro),conceptos,bruto,total,
        deducciones:{igssLaboral:igssLab,isr:isrLiq},patronal:{igss:pat.igssPatronal,intecap:pat.intecap,irtra:pat.irtra},cuentaPago:f.cuenta,partidaNumero,partidaId});
      x.activo=false; x.fechaRetiro=f.fechaRetiro; x.motivoRetiro=f.motivo;
      registrarLog('Liquidó a un empleado',`${x.nombre} — ${fFecha(f.fechaRetiro)} — Q${Q(total)}`);
      guardar(); pintar();
      avisar(`${x.nombre} liquidado por Q${Q(total)}${partidaNumero?`, en la partida No. ${partidaNumero}`:''}. Quedó dado de baja.`,'Listo');
    },'Liquidar y dar de baja');
  const dibujar=(reiniciar)=>{
    const fecha=mForm.querySelector('[name="fechaRetiro"]').value, motivo=mForm.querySelector('[name="motivo"]').value;
    if(!fecha||fecha<x.fechaIngreso){document.getElementById('tbLiq').innerHTML='<tr><td colspan="4">Elegí una fecha de retiro posterior al ingreso.</td></tr>';return}
    const c=calcularLiquidacion(x,fecha,mForm.querySelector('[name="aniosVac"]').value);
    /* Si ya se pagó (por adelantado) parte del Aguinaldo o del Bono 14 del período en
       curso, se descuenta: no se paga dos veces la misma prestación. */
    const yaPagado=k=>{
      const ini=k==='aguinaldo'?c.iniAg:k==='bono14'?c.iniB14:null; if(!ini) return 0;
      return r2((e.pagosPrestaciones||[]).filter(p=>p.tipo===k&&p.hasta>=ini)
        .reduce((s,p)=>s+p.detalle.filter(f=>f.empleadoId===x.id).reduce((a,f)=>a+(f.monto||0),0),0));
    };
    const sugerido=k=>k==='indemnizacion'&&!MOTIVOS_RETIRO[motivo].indemniza?0:r2(Math.max(0,c[k]-yaPagado(k)));
    document.getElementById('tbLiq').innerHTML=LIQUIDACION_CONCEPTOS.map(co=>{
      const P=provisionPendienteEmpleado(e,x.id,co.k);
      return `<tr><td>${co.nombre}</td><td class="num"><input name="m_${co.k}" type="number" step="0.01" min="0" value="${sugerido(co.k)}" style="width:110px;text-align:right"></td>
        <td class="num">${Q(P)}</td><td class="num" data-ajuste="${co.k}"></td></tr>`;}).join('')
      +`<tr><td>(−) IGSS laboral sobre vacaciones</td><td class="num"><input name="d_igss" type="number" step="0.01" min="0" value="0" style="width:110px;text-align:right"></td><td colspan="2" style="font-size:12px;color:var(--tinta-suave)">4.83% — indemnización, aguinaldo y Bono 14 no pagan</td></tr>
        <tr><td>(−) ISR sobre vacaciones</td><td class="num"><input name="d_isr" type="number" step="0.01" min="0" value="0" style="width:110px;text-align:right"></td><td colspan="2" style="font-size:12px;color:var(--tinta-suave)">estimado sobre su renta anual</td></tr>
        <tr><td colspan="4" id="patLiq" style="font-size:12.5px;color:var(--tinta-suave)"></td></tr>`;
    document.getElementById('detalleLiq').textContent=`${c.diasLaborados} días laborados (${c.aniosServicio.toFixed(4)} años de servicio) · aguinaldo: ${c.diasAg} de ${c.diasPeriodoAg} días del período · Bono 14: ${c.diasB14} de ${c.diasPeriodoB14} · vacaciones: ${c.diasVac} de ${c.diasAnioVac} días de su año de servicio${c.aniosVacPendientes?`, más ${c.aniosVacPendientes} año(s) anterior(es)`:''}.`;
    const recalcular=(autoDescuentos)=>{
      let total=0;
      LIQUIDACION_CONCEPTOS.forEach(co=>{
        const D=r2(+mForm.querySelector(`[name="m_${co.k}"]`).value||0), P=provisionPendienteEmpleado(e,x.id,co.k);
        total=r2(total+D);
        mForm.querySelector(`[data-ajuste="${co.k}"]`).textContent=Q(r2(D-P));
      });
      const cg=cargosSobreVacaciones(x.salarioBase,mForm.querySelector('[name="m_vacaciones"]').value,(fecha||hoy()).slice(0,4));
      if(autoDescuentos){ mForm.querySelector('[name="d_igss"]').value=cg.igssLaboral; mForm.querySelector('[name="d_isr"]').value=cg.isr; }
      const dIgss=r2(+mForm.querySelector('[name="d_igss"]').value||0), dIsr=r2(+mForm.querySelector('[name="d_isr"]').value||0);
      document.getElementById('patLiq').textContent=`Cuotas patronales sobre las vacaciones (gasto de la empresa, no se descuentan al empleado): IGSS Q${Q(cg.igssPatronal)} · INTECAP Q${Q(cg.intecap)} · IRTRA Q${Q(cg.irtra)}.`;
      document.getElementById('totLiq').textContent=Q(r2(total-dIgss-dIsr));
    };
    LIQUIDACION_CONCEPTOS.forEach(co=>{ mForm.querySelector(`[name="m_${co.k}"]`).oninput=()=>recalcular(true); });
    mForm.querySelector('[name="d_igss"]').oninput=()=>recalcular(false);
    mForm.querySelector('[name="d_isr"]').oninput=()=>recalcular(false);
    recalcular(true);
  };
  mForm.querySelector('[name="fechaRetiro"]').onchange=()=>dibujar(true);
  mForm.querySelector('[name="motivo"]').onchange=()=>dibujar(true);
  mForm.querySelector('[name="aniosVac"]').onchange=()=>dibujar(true);
  dibujar(true);
};


/* ---- Pago de prestaciones laborales (aguinaldo, Bono 14, vacaciones,
   indemnización): liquida en efectivo/banco lo que ya se venía provisionando
   mes a mes en cada planilla. El monto por empleado sale de sumar lo
   provisionado en las planillas ya generadas dentro del rango de fechas que
   se elija — por eso es importante no repetir el mismo período dos veces. ---- */
const PRESTACION_INFO={
  aguinaldo:{nombre:'Aguinaldo', ctaGasto:null, ctaPasivo:'2.1.11'},
  bono14:{nombre:'Bono 14', ctaGasto:null, ctaPasivo:'2.1.12'},
  vacaciones:{nombre:'Vacaciones', ctaGasto:null, ctaPasivo:'2.1.13'},
  indemnizacion:{nombre:'Indemnización', ctaGasto:null, ctaPasivo:'2.1.14'},
};
function provisionadoPorEmpleado(e,tipo,desde,hasta){
  const acum={};
  (e.planillas||[]).filter(p=>p.partidaNumero&&p.fechaPago>=desde && p.fechaPago<=hasta).forEach(p=>{
    p.detalle.forEach(f=>{
      const monto=(f.prestaciones||{})[tipo]||0;
      if(!monto) return;
      acum[f.empleadoId]=acum[f.empleadoId]||{empleadoId:f.empleadoId,nombre:f.nombre,monto:0};
      acum[f.empleadoId].monto=r2(acum[f.empleadoId].monto+monto);
    });
  });
  return Object.values(acum).filter(x=>x.monto>0).sort((a,b)=>b.monto-a.monto);
}

VISTAS.pagoPrestaciones=()=>{
  if(borradorPago) return formularioPagoPrestacion();
  const e=emp();
  e.pagosPrestaciones=e.pagosPrestaciones||[];
  const lista=[...e.pagosPrestaciones].sort((a,b)=>b.fechaPago.localeCompare(a.fechaPago));
  const filas=lista.map(p=>`<tr>
    <td>${fFecha(p.fechaPago)}</td>
    <td>${PRESTACION_INFO[p.tipo].nombre}</td>
    <td>${fFecha(p.desde)} — ${fFecha(p.hasta)}</td>
    <td class="num">${p.detalle.length}</td>
    <td class="num">${Q(p.total)}</td>
    <td class="num"><button class="btn mini" data-accion="verPagoPrestacion" data-id="${p.id}">Ver</button>
      <button class="btn mini sec" data-accion="pdfPagoPrestacion" data-id="${p.id}">PDF</button></td></tr>`).join('');
  return cab('Pago de prestaciones','Liquida en efectivo o banco lo que ya se venía provisionando en cada planilla.',
    `<button class="btn" data-accion="nuevoPagoPrestacion">Nuevo pago</button>`)
  + (lista.length? `<table><thead><tr><th>Fecha de pago</th><th>Prestación</th><th>Período liquidado</th>
      <th class="num">Empleados</th><th class="num">Total</th><th class="num"></th></tr></thead>
      <tbody>${filas}</tbody></table>`
     : `<div class="vacio">Todavía no se ha pagado ninguna prestación.</div>`);
};

function formularioPagoPrestacion(){
  const e=emp(), b=borradorPago;
  const cajaBanco=cuentasCajaBanco(e);
  const incluidos=b.detalle.filter(x=>!x.excluido);
  const total=r2(incluidos.reduce((s,f)=>s+f.monto,0));
  const filas=b.detalle.map((f,i)=>{
    const empleado=(e.empleados||[]).find(x=>x.id===f.empleadoId);
    const ingresoEnPeriodo=empleado&&empleado.fechaIngreso&&empleado.fechaIngreso>b.desde&&empleado.fechaIngreso<=b.hasta;
    return `<tr${f.excluido?' style="opacity:.4"':''}>
    <td style="text-align:center"><input type="checkbox" data-incluirPago="${i}"${f.excluido?'':' checked'}></td>
    <td>${esc(f.nombre)}${ingresoEnPeriodo?`<br><span style="font-size:12px;color:var(--tinta-suave)">proporcional, ingresó el ${fFecha(empleado.fechaIngreso)}</span>`:''}</td>
    <td class="num">${Q(f.monto)}</td></tr>`;
  }).join('');
  return cab(`Pago de ${PRESTACION_INFO[b.tipo].nombre}`,
    'Revisá los montos — salen de sumar lo provisionado en las planillas del período elegido.',
    `<button class="btn sec" data-accion="cancelarPagoPrestacion">Descartar</button>
     <button class="btn" data-accion="confirmarPagoPrestacion">Generar pago</button>`)
  + `<div class="tarjeta"><div class="rej">
      <div class="campo"><label>Prestación</label><select id="pgTipo">
        ${Object.keys(PRESTACION_INFO).map(t=>`<option value="${t}"${b.tipo===t?' selected':''}>${PRESTACION_INFO[t].nombre}</option>`).join('')}
      </select></div>
      <div class="campo"><label>Período provisionado — desde</label><input id="pgDesde" type="date" value="${b.desde}"></div>
      <div class="campo"><label>hasta</label><input id="pgHasta" type="date" value="${b.hasta}"></div>
      <div class="campo"><label>Fecha de pago</label><input id="pgFechaPago" type="date" value="${b.fechaPago}"></div>
      <div class="campo"><label>Se paga desde</label><select id="pgCuenta">
        ${cajaBanco.map(c=>`<option value="${c.c}"${c.c===b.cuentaPago?' selected':''}>${c.c} — ${esc(c.n)}</option>`).join('')}
      </select></div>
    </div></div>
    ${b.detalle.length? `<table><thead><tr><th></th><th>Empleado</th><th class="num">Monto</th></tr></thead>
      <tbody>${filas}</tbody>
      <tfoot><tr class="total"><td colspan="2">Total a pagar (${incluidos.length} empleado${incluidos.length===1?'':'s'})</td>
        <td class="num">${Q(total)}</td></tr></tfoot></table>`
     : `<div class="vacio">No hay ${PRESTACION_INFO[b.tipo].nombre.toLowerCase()} provisionado para nadie en ese rango de fechas.
        Cambiá las fechas o generá primero las planillas de ese período.</div>`}
    <div class="aviso">${b.tipo==='aguinaldo'?'El período de Aguinaldo (Dto. 76-78) ya viene precargado: del 1 de diciembre al 30 de noviembre siguiente.':
      b.tipo==='bono14'?'El período de Bono 14 (Dto. 42-92) ya viene precargado: del 1 de julio al 30 de junio siguiente.':
      'Vacaciones e indemnización no tienen un período legal fijo como el Aguinaldo o el Bono 14 — ajustá las fechas a lo que corresponda.'}
      Si algún empleado ingresó a mitad de este período, su monto ya sale proporcional a los días trabajados desde
      su fecha de ingreso — se lo marcamos en su fila.</div>
    <div class="aviso">El monto sale de sumar lo que cada planilla del rango elegido ya provisionó para esta
      prestación. Si volvés a pagar el mismo período dos veces, el sistema no tiene forma de saberlo — asegurate
      de no repetir fechas ya liquidadas.</div>`;
}
function enlazarFormularioPago(){
  const b=borradorPago, e=emp();
  const recalcular=()=>{
    b.detalle=provisionadoPorEmpleado(e,b.tipo,b.desde,b.hasta).map(x=>({...x,excluido:false}));
    pintar();
  };
  const pgTipo=document.getElementById('pgTipo');
  if(pgTipo) pgTipo.onchange=()=>{
    b.tipo=pgTipo.value;
    const periodo=periodoLegalPrestacion(b.tipo,b.fechaPago||hoy());
    b.desde=periodo.desde; b.hasta=periodo.hasta;
    recalcular();
  };
  const pgDesde=document.getElementById('pgDesde'); if(pgDesde) pgDesde.onchange=()=>{ b.desde=pgDesde.value; recalcular(); };
  const pgHasta=document.getElementById('pgHasta'); if(pgHasta) pgHasta.onchange=()=>{ b.hasta=pgHasta.value; recalcular(); };
  const pgFechaPago=document.getElementById('pgFechaPago'); if(pgFechaPago) pgFechaPago.onchange=()=>b.fechaPago=pgFechaPago.value;
  const pgCuenta=document.getElementById('pgCuenta'); if(pgCuenta) pgCuenta.onchange=()=>b.cuentaPago=pgCuenta.value;
  document.querySelectorAll('[data-incluirPago]').forEach(ch=>{
    ch.onchange=()=>{ b.detalle[+ch.dataset.incluirpago].excluido=!ch.checked; pintar(); };
  });
}

/* Período legal de cómputo, según a qué fecha estemos: Aguinaldo (Dto. 76-78)
   corre del 1 de diciembre al 30 de noviembre siguiente; Bono 14 (Dto. 42-92)
   del 1 de julio al 30 de junio siguiente. Vacaciones e indemnización no
   tienen un período fijo así en la ley — se usa el año calendario como
   referencia razonable, editable a mano si hace falta. */
function periodoLegalPrestacion(tipo,fechaRef){
  const d=new Date(fechaRef+'T00:00:00'), anio=d.getFullYear(), mes=d.getMonth()+1;
  if(tipo==='aguinaldo'){
    return mes===12 ? {desde:`${anio}-12-01`,hasta:`${anio+1}-11-30`} : {desde:`${anio-1}-12-01`,hasta:`${anio}-11-30`};
  }
  if(tipo==='bono14'){
    return mes>=7 ? {desde:`${anio}-07-01`,hasta:`${anio+1}-06-30`} : {desde:`${anio-1}-07-01`,hasta:`${anio}-06-30`};
  }
  return {desde:`${anio}-01-01`,hasta:`${anio}-12-31`};
}

ACCIONES.nuevoPagoPrestacion=()=>{
  const e=emp();
  const cajaBanco=cuentasCajaBanco(e);
  if(!cajaBanco.length){avisar('El catálogo no tiene ninguna cuenta de Caja o Bancos.');return}
  const h=hoy(), tipo='aguinaldo', periodo=periodoLegalPrestacion(tipo,h);
  borradorPago={tipo, desde:periodo.desde, hasta:periodo.hasta, fechaPago:h, cuentaPago:cajaBanco[0].c,
    detalle:provisionadoPorEmpleado(e,tipo,periodo.desde,periodo.hasta).map(x=>({...x,excluido:false}))};
  pintar();
};
ACCIONES.cancelarPagoPrestacion=()=>{
  confirmar('Se va a descartar este pago sin generar.',()=>{borradorPago=null;pintar()},'Descartar');
};
ACCIONES.confirmarPagoPrestacion=()=>{
  const e=emp(), b=borradorPago;
  const incluidos=b.detalle.filter(f=>!f.excluido);
  if(!incluidos.length){avisar('No hay ningún empleado incluido en este pago.');return}
  if(!b.fechaPago){avisar('Elegí la fecha de pago.');return}
  const total=r2(incluidos.reduce((s,f)=>s+f.monto,0));
  const info=PRESTACION_INFO[b.tipo];
  confirmar(`Se pagará ${info.nombre} a ${incluidos.length} empleado(s) por un total de Q${Q(total)}, del ${fFecha(b.desde)} al ${fFecha(b.hasta)}.\n\nSe registra la partida contable que liquida ese pasivo.`,()=>{
    const nombresCuenta={aguinaldo:'Aguinaldo por pagar',bono14:'Bono 14 por pagar',
      vacaciones:'Vacaciones por pagar',indemnizacion:'Indemnización por pagar (provisión)'};
    asegurarCuenta(e,info.ctaPasivo,nombresCuenta[b.tipo],'pasivo');
    const p={id:uid(),numero:e.correlativo++,fecha:b.fechaPago,
      concepto:`Pago de ${info.nombre} del ${fFecha(b.desde)} al ${fFecha(b.hasta)} — ${incluidos.length} empleado${incluidos.length===1?'':'s'}`,
      docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',
      lineas:[{cta:info.ctaPasivo,desc:'',debe:total,haber:0},{cta:b.cuentaPago,desc:'',debe:0,haber:total}]};
    e.partidas.push(p);
    e.pagosPrestaciones=e.pagosPrestaciones||[];
    e.pagosPrestaciones.push({id:uid(),tipo:b.tipo,desde:b.desde,hasta:b.hasta,fechaPago:b.fechaPago,
      cuentaPago:b.cuentaPago,detalle:incluidos,total,partidaNumero:p.numero,partidaId:p.id});
    registrarLog(`Pagó ${info.nombre}`,`${incluidos.length} empleados — Q${Q(total)}`);
    borradorPago=null; guardar(); VISTA='pagoPrestaciones'; pintar();
    avisar(`Pago generado. Quedó registrado en la partida No. ${p.numero}.`,'Listo');
  },'Generar pago');
};
ACCIONES.verPagoPrestacion=d=>{
  const e=emp(), p=e.pagosPrestaciones.find(x=>x.id===d.id);
  const filas=p.detalle.map(f=>`<tr><td>${esc(f.nombre)}</td><td class="num">${Q(f.monto)}</td></tr>`).join('');
  abrirModal(`Pago de ${PRESTACION_INFO[p.tipo].nombre} — ${fFecha(p.fechaPago)}`,
    `<p style="margin:0 0 12px;color:var(--tinta-suave);font-size:13px">Provisionado del ${fFecha(p.desde)} al ${fFecha(p.hasta)}
      · Partida No. ${p.partidaNumero}</p>
    <table style="font-size:13px"><thead><tr><th>Empleado</th><th class="num">Monto</th></tr></thead>
      <tbody>${filas}</tbody>
      <tfoot><tr class="total"><td>Total</td><td class="num">${Q(p.total)}</td></tr></tfoot></table>`,
    ()=>{},'Cerrar');
};

VISTAS.planillas=()=>{
  if(borradorPlanilla) return formularioPlanilla();
  const e=emp();
  e.planillas=e.planillas||[];
  const lista=[...e.planillas].sort((a,b)=>b.fechaPago.localeCompare(a.fechaPago));
  const filas=lista.map(p=>`<tr>
    <td>${fFecha(p.fechaPago)}${p.partidaNumero?`<br><span style="font-size:12px;color:var(--tinta-suave)">Partida No. ${p.partidaNumero}</span>`:'<br><span style="font-size:12px;color:var(--alerta)">Sin partida en libros</span>'}</td>
    <td style="text-transform:capitalize">${p.periodo}</td>
    <td>${fFecha(p.desde)} — ${fFecha(p.hasta)}</td>
    <td class="num">${p.detalle.length}<br><span style="font-size:12px;color:${p.detalle.every(f=>f.pago&&f.pago.estado==='pagado')?'var(--verde)':'var(--alerta)'}">${p.detalle.filter(f=>f.pago&&f.pago.estado==='pagado').length} pagado(s)</span></td>
    <td class="num">${Q(p.totales.liquido)}</td>
    <td class="num">${(()=>{
      /* Un solo paso principal por fila (el que toca hacer ahora), "Ver", y el resto dentro de "Más". */
      const sinPartida=!p.partidaNumero;
      const pagosPendientes=!p.detalle.every(f=>f.pago&&f.pago.estado==='pagado');
      const btn=(accion,texto,clase)=>`<button class="btn mini${clase?' '+clase:''}" data-accion="${accion}" data-id="${p.id}">${texto}</button>`;
      const principal=sinPartida?btn('generarPartidaPlanilla','Generar partida'):pagosPendientes?btn('confirmarPagosPlanilla','Confirmar pagos'):'';
      const confirmarEsPrincipal=!sinPartida&&pagosPendientes;
      const resto=[ confirmarEsPrincipal?'':btn('confirmarPagosPlanilla','Confirmar pagos','sec'),
        sinPartida?btn('editarPlanilla','Editar','sec'):'', btn('pdfPlanilla','PDF','sec'),
        sinPartida?btn('eliminarPlanilla','Eliminar','peligro'):'' ].filter(Boolean);
      return principal+' '+btn('verPlanilla','Ver','sec')+' '+masAcciones(`Más acciones de la planilla del ${fFecha(p.fechaPago)}`,resto.join(''));
    })()}</td>
  </tr>`).join('');
  return cab('Planillas','Control de pago de salarios, con el IGSS laboral y patronal calculado cada vez.',
    `<button class="btn" data-accion="nuevaPlanilla">Nueva planilla</button>`)
  + (lista.length? `<table><thead><tr><th>Fecha de pago</th><th>Período</th><th>Rango</th>
      <th class="num">Empleados</th><th class="num">Total líquido</th><th class="num"></th></tr></thead>
      <tbody>${filas}</tbody></table>`
    : `<div class="vacio">Todavía no se ha generado ninguna planilla. Agregá empleados primero si hace falta.</div>`);
};

function formularioPlanilla(){
  const e=emp(), b=borradorPlanilla;
  const cajaBanco=cuentasCajaBanco(e);
  const [cDF,cHE,cHD,cHM,cBA]=CAMPOS_NOVEDAD;
  const filas=b.detalle.map((f,i)=>(b.soloNovedades&&!filaTieneNovedad(f))?'':`<tr${f.excluido?' style="opacity:.4"':''}>
    <td style="text-align:center"><input type="checkbox" data-incluir="${i}"${f.excluido?'':' checked'}></td>
    <td>${esc(f.nombre)}</td>
    <td>${inputNovedad(f,i,cDF)}</td>
    <td>${inputNovedad(f,i,cHE)}</td>
    <td>${inputNovedad(f,i,cHD)}</td>
    <td>${inputNovedad(f,i,cHM)}</td>
    <td class="num" title="Horas extra ${Q(f.montoHorasExtra||0)} + domingo ${Q(f.montoHorasExtraDomingo||0)} − horas de menos ${Q(f.descuentoHorasMenos||0)}">${(()=>{const a=r2((f.montoHorasExtra||0)+(f.montoHorasExtraDomingo||0)-(f.descuentoHorasMenos||0));return a>0?'+'+Q(a):a<0?'−'+Q(-a):'—'})()}</td>
    <td>${inputNovedad(f,i,cBA)}</td>
    <td class="num">${Q(f.salarioPeriodo)}</td>
    <td class="num">${Q(f.bonifPeriodo)}</td>
    <td class="num">${Q(f.igssLaboral)}</td>
    <td class="num">${Q(f.isr)}</td>
    <td class="num"><strong>${Q(f.liquido)}</strong></td>
    <td class="num">${Q(r2(f.igssPatronal+f.intecap+f.irtra))}</td>
    <td class="num">${Q(r2(f.prestaciones.aguinaldo+f.prestaciones.bono14+f.prestaciones.vacaciones+f.prestaciones.indemnizacion))}</td>
  </tr>`).join('');
  const incluidos=b.detalle.filter(x=>!x.excluido);
  const sum=campo=>r2(incluidos.reduce((s,f)=>s+f[campo],0));
  const sumPrest=campo=>r2(incluidos.reduce((s,f)=>s+f.prestaciones[campo],0));
  const totalPatronal=r2(sum('igssPatronal')+sum('intecap')+sum('irtra'));
  const totalPrestaciones=r2(sumPrest('aguinaldo')+sumPrest('bono14')+sumPrest('vacaciones')+sumPrest('indemnizacion'));

  return cab(b.editandoId?'Editar planilla':'Nueva planilla','Revisá los montos antes de generar. Podés excluir empleados de esta planilla sin darlos de baja. La partida en libros se genera después, por separado.',
    `<button class="btn sec" data-accion="cancelarPlanilla">Descartar</button>
     <button class="btn" data-accion="confirmarPlanilla">${b.editandoId?'Guardar cambios':'Generar planilla'}</button>`)
  + `<div class="tarjeta"><div class="rej">
      <div class="campo"><label>Período</label><select id="pPeriodo">
        <option value="semanal"${b.periodo==='semanal'?' selected':''}>Semanal</option>
        <option value="quincenal"${b.periodo==='quincenal'?' selected':''}>Quincenal</option>
        <option value="mensual"${b.periodo==='mensual'?' selected':''}>Mensual</option>
      </select></div>
      <div class="campo"><label>Desde</label><input id="pDesde" type="date" value="${b.desde}"></div>
      <div class="campo"><label>Hasta</label><input id="pHasta" type="date" value="${b.hasta}"></div>
      <div class="campo"><label>Fecha de pago</label><input id="pFechaPago" type="date" value="${b.fechaPago}"></div>
      <div class="campo"><label>Se paga desde</label><select id="pCuenta">
        ${cajaBanco.map(c=>`<option value="${c.c}"${c.c===b.cuentaPago?' selected':''}>${c.c} — ${esc(c.n)}</option>`).join('')}
      </select></div>
    </div></div>
    ${barraPlanillaRapida(b)}
    <table class="densa"><thead><tr><th></th><th>Empleado</th>
      <th>Días falta</th><th>Horas extra</th><th>Horas domingo</th><th>Horas de menos</th>
      <th class="num" title="Valor de horas extra + horas de domingo − descuento por horas de menos">Ajuste por horas</th><th>Bono adic.</th>
      <th class="num">Salario</th><th class="num">Bonif. Q250</th><th class="num">IGSS laboral</th><th class="num">ISR</th>
      <th class="num">Líquido a pagar</th><th class="num">Cuota patronal</th><th class="num">Prestaciones</th></tr></thead>
      <tbody>${filas||`<tr><td colspan="15" style="text-align:center;color:var(--tinta-suave);padding:24px">Ningún empleado tiene novedades todavía.</td></tr>`}</tbody>
      <tfoot><tr class="total"><td colspan="2">Totales (${incluidos.length} empleado${incluidos.length===1?'':'s'})</td>
        <td colspan="6"></td>
        <td class="num">${Q(sum('salarioPeriodo'))}</td><td class="num">${Q(sum('bonifPeriodo'))}</td>
        <td class="num">${Q(sum('igssLaboral'))}</td>
        <td class="num">${Q(sum('isr'))}</td><td class="num">${Q(sum('liquido'))}</td>
        <td class="num">${Q(totalPatronal)}</td><td class="num">${Q(totalPrestaciones)}</td></tr></tfoot></table>
    <div class="aviso">La bonificación incentivo (Q${BONIFICACION_INCENTIVO} mensual, prorrateada) no paga IGSS,
      INTECAP ni IRTRA — pero sí paga ISR, según la ley. Las horas extra se pagan a tiempo y medio
      (Art. 121 del Código de Trabajo) y si son de un empleado con salario mínimo, sí quedan sujetas a IGSS
      e ISR igual que el salario ordinario. El ISR se calcula proyectando el salario fijo a un año completo,
      con la deducción personal de Q${Q(deduccionPersonalAnual((b.hasta||hoy()).slice(0,4),e))} para ${(b.hasta||hoy()).slice(0,4)} (Dto. 13-2026: desde 2027 equivale a
      12 salarios mínimos no agrícolas con bonificación) — los bonos
      adicionales u horas extra de un mes puntual no se reproyectan, así que en meses con ingresos
      inusualmente altos el ISR real podría ser algo mayor al que se muestra acá.</div>
    <div class="aviso">La cuota patronal y las prestaciones se muestran resumidas en una sola columna cada una.
      El desglose completo —IGSS, INTECAP, IRTRA por un lado; aguinaldo, Bono 14, vacaciones e indemnización
      por el otro— vas a poder verlo en el detalle de la planilla ya generada, y en la partida contable.</div>
    <div class="aviso">"Días de falta" descuenta exactamente los días que escribas, tal cual — si corresponde
      descontar también el séptimo día por esa falta (Art. 126 del Código de Trabajo), sumalo vos mismo al número
      de días. "Horas de menos" es para tiempo debido por el empleado (llegadas tarde, salidas antes): se
      descuenta al valor normal de la hora, sin el recargo de tiempo y medio que sí llevan las horas extra.
      Tanto los días de falta como las horas de menos también reducen proporcionalmente la bonificación
      incentivo, porque compensa la dedicación completa al puesto — las horas extra, en cambio, no la afectan
      para nada, ni suman ni restan.</div>`;
}
function enlazarFormularioPlanilla(){
  const b=borradorPlanilla;
  const recalcular=(i)=>{ recalcularFilasPlanilla(i===undefined?undefined:[i]); pintar(); };
  const pPeriodo=document.getElementById('pPeriodo');
  if(pPeriodo) pPeriodo.onchange=()=>{ b.periodo=pPeriodo.value; recalcular(); };
  const pDesde=document.getElementById('pDesde'); if(pDesde) pDesde.onchange=()=>b.desde=pDesde.value;
  const pHasta=document.getElementById('pHasta'); if(pHasta) pHasta.onchange=()=>b.hasta=pHasta.value;
  const pFechaPago=document.getElementById('pFechaPago'); if(pFechaPago) pFechaPago.onchange=()=>b.fechaPago=pFechaPago.value;
  const pCuenta=document.getElementById('pCuenta'); if(pCuenta) pCuenta.onchange=()=>b.cuentaPago=pCuenta.value;
  document.querySelectorAll('[data-incluir]').forEach(ch=>{
    ch.onchange=()=>{ b.detalle[+ch.dataset.incluir].excluido=!ch.checked; pintar(); };
  });
  enlazarPlanillaRapida();   // casillas de novedades: Enter, pegar desde Excel, foco, plantilla
}

ACCIONES.nuevaPlanilla=()=>{
  const e=emp();
  e.empleados=e.empleados||[];
  const activos=e.empleados.filter(x=>x.activo!==false);
  if(!activos.length){avisar('No hay empleados activos. Agregá al menos uno en Empleados.');return}
  const cajaBanco=cuentasCajaBanco(e);
  if(!cajaBanco.length){avisar('El catálogo no tiene ninguna cuenta de Caja o Bancos.');return}
  const h=hoy();
  const desdeInicial=h.slice(0,8)+'01', hastaInicial=h;
  borradorPlanilla={periodo:'mensual',desde:desdeInicial,hasta:hastaInicial,fechaPago:h,
    cuentaPago:cajaBanco[0].c,
    detalle:activos.map(x=>({...calcularPlanillaEmpleado(x,'mensual',{},{desde:desdeInicial,hasta:hastaInicial}),excluido:false}))};
  pintar();
};
ACCIONES.cancelarPlanilla=()=>{
  confirmar('Se va a descartar esta planilla sin generar.',()=>{borradorPlanilla=null;pintar()},'Descartar');
};
/* La planilla y su partida contable son dos pasos separados: primero se genera la planilla
   (para revisarla y corregirla), y solo cuando está bien se "Genera la partida en libros".
   Mientras no tenga partida, la planilla se puede editar o eliminar, y sus provisiones de
   prestaciones todavía no cuentan para nada. */
function postearPartidaPlanilla(e,pl){
  const t=pl.totales;
  asegurarCuenta(e,'6.2.16','Cuota patronal INTECAP','gasto');
  asegurarCuenta(e,'6.2.17','Cuota patronal IRTRA','gasto');
  asegurarCuenta(e,'6.2.18','Provisión de aguinaldo','gasto');
  asegurarCuenta(e,'6.2.19','Provisión de Bono 14','gasto');
  asegurarCuenta(e,'6.2.20','Provisión de vacaciones','gasto');
  asegurarCuenta(e,'6.2.21','Provisión de indemnización','gasto');
  asegurarCuenta(e,'2.1.11','Aguinaldo por pagar','pasivo');
  asegurarCuenta(e,'2.1.12','Bono 14 por pagar','pasivo');
  asegurarCuenta(e,'2.1.13','Vacaciones por pagar','pasivo');
  asegurarCuenta(e,'2.1.14','Indemnización por pagar (provisión)','pasivo');
  const lineas=[];
  const add=(cta,debe,haber)=>{ if(debe||haber) lineas.push({cta,desc:'',debe:r2(debe||0),haber:r2(haber||0)}); };
  /* Gasto del período: salario ordinario y extraordinario (incluye horas extra y bonos
     adicionales, que sí son salario, y resta las horas de menos), bonificación incentivo,
     cuota patronal completa, y la provisión de las cuatro prestaciones. */
  add('6.2.01',r2(t.salario+t.horasExtra+t.horasExtraDomingo+t.bonoAdicional-t.horasMenos),0);
  add('6.2.02',t.bonif,0);
  add('6.2.03',t.igssPatronal,0);
  add('6.2.16',t.intecap,0);
  add('6.2.17',t.irtra,0);
  add('6.2.18',t.aguinaldo,0);
  add('6.2.19',t.bono14,0);
  add('6.2.20',t.vacaciones,0);
  add('6.2.21',t.indemnizacion,0);
  /* Pasivos: lo que se paga en efectivo/banco, y lo pendiente con el IGSS, la SAT y las prestaciones futuras. */
  add(pl.cuentaPago,0,t.liquido);
  add('2.1.07',0,t.igssLaboral);
  add('2.1.08',0,r2(t.igssPatronal+t.intecap+t.irtra));
  if(t.isr) add('2.1.06',0,t.isr);
  add('2.1.11',0,t.aguinaldo);
  add('2.1.12',0,t.bono14);
  add('2.1.13',0,t.vacaciones);
  add('2.1.14',0,t.indemnizacion);
  const n=pl.detalle.length;
  const p={id:uid(),numero:e.correlativo++,fecha:pl.fechaPago,
    concepto:`Planilla ${pl.periodo} del ${fFecha(pl.desde)} al ${fFecha(pl.hasta)} — ${n} empleado${n===1?'':'s'}`,
    docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',lineas};
  e.partidas.push(p);
  pl.partidaNumero=p.numero; pl.partidaId=p.id;
  return p;
}
ACCIONES.confirmarPlanilla=()=>{
  const e=emp(), b=borradorPlanilla;
  const incluidos=b.detalle.filter(f=>!f.excluido);
  if(!incluidos.length){avisar('No hay ningún empleado incluido en esta planilla.');return}
  if(!b.fechaPago){avisar('Elegí la fecha de pago.');return}
  const sum=campo=>r2(incluidos.reduce((s,f)=>s+f[campo],0));
  const sumPrest=campo=>r2(incluidos.reduce((s,f)=>s+f.prestaciones[campo],0));
  const totales={
    salario:sum('salarioPeriodo'),horasExtra:sum('montoHorasExtra'),horasExtraDomingo:sum('montoHorasExtraDomingo'),bonoAdicional:sum('bonoAdicional'),
    horasMenos:sum('descuentoHorasMenos'),
    bonif:sum('bonifPeriodo'),igssLaboral:sum('igssLaboral'),isr:sum('isr'),liquido:sum('liquido'),
    igssPatronal:sum('igssPatronal'),intecap:sum('intecap'),irtra:sum('irtra'),
    aguinaldo:sumPrest('aguinaldo'),bono14:sumPrest('bono14'),vacaciones:sumPrest('vacaciones'),indemnizacion:sumPrest('indemnizacion'),
  };
  const editando=b.editandoId?(e.planillas||[]).find(x=>x.id===b.editandoId):null;
  if(editando&&editando.partidaNumero){avisar('Esa planilla ya tiene partida en libros: ya no se puede editar.');return}
  confirmar(`Se ${editando?'guardarán los cambios de':'generará'} la planilla ${b.periodo} del ${fFecha(b.desde)} al ${fFecha(b.hasta)}, con ${incluidos.length} empleado(s), por un líquido total de Q${Q(totales.liquido)}.\n\nTodavía NO se registra en los libros: podés revisarla y corregirla, y cuando esté bien usás "Generar partida en libros".`,()=>{
    e.planillas=e.planillas||[];
    const datos={periodo:b.periodo,desde:b.desde,hasta:b.hasta,fechaPago:b.fechaPago,cuentaPago:b.cuentaPago,detalle:incluidos,totales};
    if(editando){
      /* Se conserva el estado de pago y correo de quien ya lo tenía. */
      incluidos.forEach(f=>{ const ant=editando.detalle.find(x=>x.empleadoId===f.empleadoId); if(ant){ if(ant.pago) f.pago=ant.pago; if(ant.correo) f.correo=ant.correo; } });
      Object.assign(editando,datos);
      registrarLog('Corrigió una planilla sin partida',`${b.periodo} del ${fFecha(b.desde)} al ${fFecha(b.hasta)} — Q${Q(totales.liquido)}`);
    }else{
      e.planillas.push({id:uid(),...datos,partidaNumero:null,partidaId:null});
      registrarLog('Generó una planilla',`${b.periodo} del ${fFecha(b.desde)} al ${fFecha(b.hasta)} — ${incluidos.length} empleados, Q${Q(totales.liquido)}`);
    }
    borradorPlanilla=null; guardar(); VISTA='planillas'; pintar();
    avisar(`Planilla ${editando?'actualizada':'generada'}. Aún no tiene partida en libros: cuando la hayas revisado, usá "Generar partida".`,'Listo');
  },editando?'Guardar cambios':'Generar planilla');
};
ACCIONES.generarPartidaPlanilla=d=>{
  const e=emp(), pl=(e.planillas||[]).find(x=>x.id===d.id);
  if(!pl){avisar('No se encontró esa planilla.');return}
  if(pl.partidaNumero){avisar(`Esta planilla ya tiene su partida (No. ${pl.partidaNumero}).`);return}
  const anio=pl.fechaPago.slice(0,4);
  if((e.partidas||[]).some(x=>(x.concepto||'').startsWith(PREFIJO_CIERRE_LIBROS+anio))){
    avisar(`El ejercicio ${anio} ya tiene Cierre de libros: no se le pueden agregar partidas. Cambiá la fecha de pago de la planilla (Editar) o deshacé el cierre.`);return}
  confirmar(`Se registrará en los libros la planilla ${pl.periodo} del ${fFecha(pl.desde)} al ${fFecha(pl.hasta)}: sueldos, IGSS, ISR, cuota patronal y provisión de prestaciones, por un líquido de Q${Q(pl.totales.liquido)}, con fecha ${fFecha(pl.fechaPago)}.\n\nDespués de esto la planilla ya no se podrá editar.`,()=>{
    const p=postearPartidaPlanilla(e,pl);
    registrarLog('Generó la partida de una planilla',`${pl.periodo} del ${fFecha(pl.desde)} al ${fFecha(pl.hasta)} — partida No. ${p.numero}`);
    guardar(); pintar();
    avisar(`Partida No. ${p.numero} registrada en los libros.`,'Listo');
  },'Generar partida');
};
ACCIONES.editarPlanilla=d=>{
  const e=emp(), pl=(e.planillas||[]).find(x=>x.id===d.id);
  if(!pl){avisar('No se encontró esa planilla.');return}
  if(pl.partidaNumero){avisar('Esa planilla ya tiene partida en libros: ya no se puede editar.');return}
  const enPlanilla=new Set(pl.detalle.map(f=>f.empleadoId));
  const otros=(e.empleados||[]).filter(x=>x.activo!==false&&!enPlanilla.has(x.id))
    .map(x=>({...calcularPlanillaEmpleado(x,pl.periodo,{},{desde:pl.desde,hasta:pl.hasta}),excluido:true}));
  borradorPlanilla={editandoId:pl.id,periodo:pl.periodo,desde:pl.desde,hasta:pl.hasta,fechaPago:pl.fechaPago,cuentaPago:pl.cuentaPago,
    detalle:[...pl.detalle.map(f=>({...f,excluido:false})),...otros]};
  VISTA='planillas'; pintar();
};
ACCIONES.eliminarPlanilla=d=>{
  if(!puedeEliminar()){avisar('Tu rol no tiene permiso para eliminar planillas.');return}
  const e=emp(), pl=(e.planillas||[]).find(x=>x.id===d.id);
  if(!pl){avisar('No se encontró esa planilla.');return}
  if(pl.partidaNumero){avisar('Esta planilla ya tiene partida en libros. Para quitarla, eliminá primero su partida.');return}
  confirmar(`Se eliminará la planilla ${pl.periodo} del ${fFecha(pl.desde)} al ${fFecha(pl.hasta)} (todavía sin partida en libros).`,()=>{
    e.planillas=e.planillas.filter(x=>x.id!==pl.id);
    registrarLog('Eliminó una planilla sin partida',`${pl.periodo} del ${fFecha(pl.desde)} al ${fFecha(pl.hasta)}`);
    guardar(); pintar();
  },'Eliminar');
};
ACCIONES.verPlanilla=d=>{
  const e=emp(), p=e.planillas.find(x=>x.id===d.id);
  const filas=p.detalle.map(f=>`<tr><td>${esc(f.nombre)}
      ${f.diasFalta?`<br><span style="font-size:12px;color:var(--alerta)">${f.diasFalta} día(s) de falta</span>`:''}
      ${f.horasMenos?`<br><span style="font-size:12px;color:var(--alerta)">${f.horasMenos} h. de menos</span>`:''}
      ${f.horasExtra?`<br><span style="font-size:12px;color:var(--tinta-suave)">${f.horasExtra} h. extra</span>`:''}
      ${f.horasExtraDomingo?`<br><span style="font-size:12px;color:var(--tinta-suave)">${f.horasExtraDomingo} h. domingo</span>`:''}</td>
    <td class="num">${Q(f.salarioPeriodo)}</td>
    <td class="num">${r2((f.montoHorasExtra||0)+(f.montoHorasExtraDomingo||0))?Q(r2((f.montoHorasExtra||0)+(f.montoHorasExtraDomingo||0))):'—'}</td>
    <td class="num">${f.bonoAdicional?Q(f.bonoAdicional):'—'}</td>
    <td class="num">${Q(f.bonifPeriodo)}</td>
    <td class="num">${Q(f.igssLaboral)}</td>
    <td class="num">${f.isr?Q(f.isr):'—'}</td>
    <td class="num"><strong>${Q(f.liquido)}</strong></td></tr>`).join('');
  abrirModal(`Planilla ${p.periodo} — ${fFecha(p.fechaPago)}`,
    `<p style="margin:0 0 12px;color:var(--tinta-suave);font-size:13px">Del ${fFecha(p.desde)} al ${fFecha(p.hasta)}
      · ${p.partidaNumero?`Partida No. ${p.partidaNumero}`:'Sin partida en libros todavía'}
      &nbsp;·&nbsp; <button class="btn mini sec" type="button" id="btnPdfPlanilla">Descargar PDF</button></p>
    <table style="font-size:12.5px"><thead><tr><th>Empleado</th><th class="num">Salario</th>
      <th class="num">H. extra</th><th class="num">Bono adic.</th><th class="num">Bonif. Q250</th>
      <th class="num">IGSS lab.</th><th class="num">ISR</th><th class="num">Líquido</th></tr></thead>
      <tbody>${filas}</tbody></table>
    <p style="margin:14px 0 4px;font-size:13px;color:var(--tinta-suave)">
      <strong style="color:var(--verde)">Cuota patronal:</strong>
      IGSS Q${Q(p.totales.igssPatronal)} · INTECAP Q${Q(p.totales.intecap)} · IRTRA Q${Q(p.totales.irtra)}</p>
    <p style="margin:0;font-size:13px;color:var(--tinta-suave)">
      <strong style="color:var(--verde)">Provisión de prestaciones:</strong>
      Aguinaldo Q${Q(p.totales.aguinaldo)} · Bono 14 Q${Q(p.totales.bono14)} ·
      Vacaciones Q${Q(p.totales.vacaciones)} · Indemnización Q${Q(p.totales.indemnizacion)}</p>`,
    ()=>{},'Cerrar');
  mForm.querySelector('#btnPdfPlanilla').onclick=()=>ACCIONES.pdfPlanilla({id:p.id});
};

/* ============ CONFIRMACIÓN DE PAGO Y CORREO AL EMPLEADO ============ */
/* El sistema es una sola página sin servidor, así que no puede mandar correo por sí mismo.
   Hay dos caminos: (1) un servicio de envío propio de la empresa (EmailJS, gratis hasta 200
   correos al mes) que manda el correo solo, o (2) sin configurar nada, abrir el programa
   de correo del contador con el mensaje ya escrito, uno por empleado. El correo solo se
   manda cuando se confirma que el pago ya se hizo (depósito o efectivo). */
const METODOS_PAGO_PLANILLA={deposito:'Depósito bancario',transferencia:'Transferencia',efectivo:'Efectivo',cheque:'Cheque'};
const correoValido=s=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((s||'').trim());
function mensajeCorreoPago(e,p,f,pago){
  const periodo=p.periodo[0].toUpperCase()+p.periodo.slice(1);
  const extra=r2((f.montoHorasExtra||0)+(f.montoHorasExtraDomingo||0));
  const descuentos=r2((f.descuentoFaltas||0)+(f.descuentoHorasMenos||0)+(f.descuentoBonif||0));
  const L=[];
  L.push(`Estimado(a) ${f.nombre}:`,'');
  L.push(`Le confirmamos que ${e.nombre} realizó el pago de su planilla ${p.periodo} del ${fFecha(p.desde)} al ${fFecha(p.hasta)}.`,'');
  L.push(`Monto pagado: Q${Q(f.liquido)}`);
  L.push(`Forma de pago: ${METODOS_PAGO_PLANILLA[pago.metodo]||pago.metodo}`);
  L.push(`Fecha: ${fFecha(pago.fecha)}`,'');
  L.push('Detalle:');
  L.push(`  Salario del período: Q${Q(f.salarioPeriodo)}`);
  L.push(`  Bonificación incentivo: Q${Q(f.bonifPeriodo)}`);
  if(extra) L.push(`  Horas extra: Q${Q(extra)}`);
  if(f.bonoAdicional) L.push(`  Bono adicional: Q${Q(f.bonoAdicional)}`);
  if(descuentos) L.push(`  Descuentos por faltas o tiempo: -Q${Q(descuentos)}`);
  L.push(`  IGSS laboral: -Q${Q(f.igssLaboral)}`);
  if(f.isr) L.push(`  ISR: -Q${Q(f.isr)}`);
  L.push(`  Líquido recibido: Q${Q(f.liquido)}`,'');
  L.push('Si algún dato no coincide con lo que recibió, por favor avísenos respondiendo este correo.','');
  L.push(`Atentamente,`,e.representante||e.nombre,e.nombre+(e.nit?` — NIT ${e.nit}`:''));
  return {asunto:`Pago de planilla ${p.periodo} — ${e.nombre} — ${fFecha(pago.fecha)}`,texto:L.join('\n')};
}
async function enviarCorreoEmailJS(cfg,para,nombre,asunto,texto){
  const r=await fetch('https://api.emailjs.com/api/v1.0/email/send',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({service_id:cfg.serviceId,template_id:cfg.templateId,user_id:cfg.publicKey,
      template_params:{to_email:para,to_name:nombre,subject:asunto,message:texto}})});
  if(!r.ok) throw new Error((await r.text())||('HTTP '+r.status));
}
ACCIONES.configurarCorreos=()=>{
  const e=emp(), c=e.correoConfig||{};
  abrirModal('Envío automático de correos',
    `<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">Sin esto el sistema igual prepara el correo de cada empleado, pero te lo abre en tu programa de correo para que lo envíes vos.
      Para que salgan solos, creá una cuenta gratuita en <strong>emailjs.com</strong>, conectá tu correo (Gmail, Outlook…) y una plantilla con
      <strong>Para: {{to_email}}</strong>, <strong>Asunto: {{subject}}</strong> y cuerpo <strong>{{message}}</strong>. Después copiá acá los tres datos.</p>
    <div class="rej">
      <div class="campo"><label>Service ID</label><input name="serviceId" value="${esc(c.serviceId||'')}"></div>
      <div class="campo"><label>Template ID</label><input name="templateId" value="${esc(c.templateId||'')}"></div>
      <div class="campo full"><label>Public Key</label><input name="publicKey" value="${esc(c.publicKey||'')}"></div>
    </div>
    <div class="aviso">Dejá los tres vacíos para volver al modo manual. La llave pública de EmailJS está pensada para usarse en páginas web, pero se guarda en este navegador junto con la contabilidad.</div>`,
    d=>{
      const v={serviceId:d.serviceId.trim(),templateId:d.templateId.trim(),publicKey:d.publicKey.trim()};
      if((v.serviceId||v.templateId||v.publicKey)&&!(v.serviceId&&v.templateId&&v.publicKey)){avisar('Llená los tres datos o dejá los tres vacíos.');return false}
      e.correoConfig=v.serviceId?v:null;
      guardar(); pintar();
    },'Guardar');
};
ACCIONES.confirmarPagosPlanilla=d=>{
  const e=emp(), p=(e.planillas||[]).find(x=>x.id===d.id);
  if(!p){avisar('No se encontró esa planilla.');return}
  const emple=id=>(e.empleados||[]).find(x=>x.id===id)||{};
  const filas=p.detalle.map((f,i)=>{
    const pago=f.pago||{};
    const correo=(emple(f.empleadoId).email)||'';
    if(pago.estado==='pagado'){
      return `<tr><td>${esc(f.nombre)}</td><td class="num">${Q(f.liquido)}</td>
        <td colspan="2">Pagado el ${fFecha(pago.fecha)} (${esc(METODOS_PAGO_PLANILLA[pago.metodo]||pago.metodo)}) ·
          ${f.correo&&f.correo.enviado?`correo enviado el ${fFecha(f.correo.fecha)}`:'<span style="color:var(--alerta)">sin correo enviado</span>'}</td>
        <td><input name="email_${i}" type="email" value="${esc(correo)}" placeholder="correo@..." style="width:190px"></td>
        <td style="text-align:center"><input type="checkbox" name="reenviar_${i}" title="Enviar el correo otra vez"> reenviar</td></tr>`;
    }
    return `<tr><td>${esc(f.nombre)}</td><td class="num">${Q(f.liquido)}</td>
      <td style="text-align:center"><input type="checkbox" name="pagado_${i}"> ya se pagó</td>
      <td><select name="metodo_${i}">${Object.entries(METODOS_PAGO_PLANILLA).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></td>
      <td><input name="email_${i}" type="email" value="${esc(correo)}" placeholder="correo@..." style="width:190px"></td><td></td></tr>`;
  }).join('');
  abrirModal(`Confirmar pagos — planilla ${p.periodo} del ${fFecha(p.desde)} al ${fFecha(p.hasta)}`,
    `<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">Marcá a cada empleado cuando ya recibió su dinero. Al confirmar, se le manda un correo con el monto de su pago.
      Envío: <strong>${e.correoConfig?'automático (EmailJS)':'manual — se abre tu programa de correo'}</strong>
      · <button class="btn mini sec" type="button" id="btnCfgCorreo">Configurar envío automático</button></p>
    <div style="max-height:55vh;overflow:auto"><table style="font-size:13px"><thead><tr><th>Empleado</th><th class="num">Líquido</th><th>Pago</th><th>Forma</th><th>Correo</th><th></th></tr></thead>
    <tbody>${filas}</tbody></table></div>`,
    ()=>{
      const aEnviar=[], sinCorreo=[];
      p.detalle.forEach((f,i)=>{
        const campo=n=>mForm.querySelector(`[name="${n}${i}"]`);
        const emp0=(e.empleados||[]).find(x=>x.id===f.empleadoId);
        const mail=campo('email_')?campo('email_').value.trim():'';
        if(emp0&&mail!==(emp0.email||'')) emp0.email=mail;
        let notificar=false;
        if(campo('pagado_')&&campo('pagado_').checked){
          f.pago={estado:'pagado',metodo:campo('metodo_').value,fecha:hoy()};
          notificar=true;
        }else if(campo('reenviar_')&&campo('reenviar_').checked) notificar=true;
        if(!notificar) return;
        if(!correoValido(mail)){ sinCorreo.push(f.nombre); return; }
        aEnviar.push({i,f,mail,...mensajeCorreoPago(e,p,f,f.pago)});
      });
      const confirmados=p.detalle.filter(f=>f.pago&&f.pago.estado==='pagado').length;
      registrarLog('Confirmó pagos de planilla',`${p.periodo} del ${fFecha(p.desde)} al ${fFecha(p.hasta)} — ${confirmados}/${p.detalle.length} pagados`);
      guardar();
      setTimeout(()=>ACCIONES._despacharCorreos(p,aEnviar,sinCorreo),0);
    },'Confirmar y enviar correos');
  const b=mForm.querySelector('#btnCfgCorreo'); if(b) b.onclick=()=>{ cerrarModal(); setTimeout(ACCIONES.configurarCorreos,0); };
};
ACCIONES._despacharCorreos=async(p,aEnviar,sinCorreo)=>{
  const e=emp(), cfg=e.correoConfig;
  const aviso=sinCorreo.length?`\n\nSin correo válido (no se les envió nada): ${sinCorreo.join(', ')}. Agregá su correo en Empleados o en "Confirmar pagos".`:'';
  if(!aEnviar.length){ pintar(); avisar('Pagos guardados.'+(aviso||' No había correos por enviar.'),'Listo'); return; }
  if(cfg){
    let ok=0; const fallos=[];
    for(const x of aEnviar){
      try{
        await enviarCorreoEmailJS(cfg,x.mail,x.f.nombre,x.asunto,x.texto);
        x.f.correo={enviado:true,fecha:hoy(),via:'emailjs',a:x.mail}; ok++;
      }catch(err){ fallos.push(`${x.f.nombre}: ${err.message}`); }
    }
    guardar(); pintar();
    avisar(`Correos enviados: ${ok} de ${aEnviar.length}.`+(fallos.length?`\n\nNo salieron:\n${fallos.join('\n')}`:'')+aviso,fallos.length?'Revisar':'Listo');
    return;
  }
  const filas=aEnviar.map((x,k)=>`<tr><td>${esc(x.f.nombre)}</td><td>${esc(x.mail)}</td><td class="num">${Q(x.f.liquido)}</td>
    <td class="num"><a class="btn mini" data-env="${k}" href="mailto:${encodeURIComponent(x.mail)}?subject=${encodeURIComponent(x.asunto)}&body=${encodeURIComponent(x.texto)}">Abrir correo</a></td></tr>`).join('');
  abrirModal('Enviar correos de pago',
    `<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">Pagos confirmados. Cada botón abre tu programa de correo con el mensaje ya escrito para ese empleado — solo falta darle enviar.
      Para que salgan solos la próxima vez, configurá el envío automático en la pantalla de confirmación.${esc(aviso).replace(/\n/g,'<br>')}</p>
    <table style="font-size:13px"><thead><tr><th>Empleado</th><th>Correo</th><th class="num">Líquido</th><th></th></tr></thead><tbody>${filas}</tbody></table>`,
    ()=>{},'Cerrar');
  mForm.querySelectorAll('[data-env]').forEach(a=>{
    a.addEventListener('click',()=>{
      const x=aEnviar[+a.dataset.env];
      x.f.correo={enviado:true,fecha:hoy(),via:'mailto',a:x.mail}; guardar();
      a.textContent='Abierto ✓';
    });
  });
  pintar();
};

/* ============ FINIQUITO ============ */
function quetzalesEnLetras(monto){
  const U=['cero','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','trece','catorce','quince',
    'dieciséis','diecisiete','dieciocho','diecinueve','veinte','veintiuno','veintidós','veintitrés','veinticuatro','veinticinco','veintiséis','veintisiete','veintiocho','veintinueve'];
  const D=['','','','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
  const C=['','ciento','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos'];
  const menor1000=n=>{
    if(n===100) return 'cien';
    const c=Math.floor(n/100), r=n%100; let s=C[c];
    if(r){ if(s) s+=' '; s+= r<30?U[r]:(D[Math.floor(r/10)]+(r%10?' y '+U[r%10]:'')); }
    return s;
  };
  const apocopar=t=>t.replace(/veintiuno$/,'veintiún').replace(/uno$/,'un');
  const enteroLetras=n=>{
    if(n===0) return 'cero';
    const millones=Math.floor(n/1e6), miles=Math.floor((n%1e6)/1000), resto=n%1000; const p=[];
    if(millones) p.push(millones===1?'un millón':apocopar(menor1000(millones))+' millones');
    if(miles) p.push(miles===1?'mil':apocopar(menor1000(miles))+' mil');
    if(resto) p.push(menor1000(resto));
    return p.join(' ');
  };
  monto=r2(Math.abs(+monto||0));
  const ent=Math.floor(monto), cent=Math.round((monto-ent)*100);
  const letras=enteroLetras(ent);
  return letras.charAt(0).toUpperCase()+letras.slice(1)+' quetzales'+(cent?` con ${String(cent).padStart(2,'0')}/100`:' exactos');
}
ACCIONES.pdfFiniquito=async d=>{
  const e=emp(), l=(e.liquidaciones||[]).find(x=>x.id===d.id);
  if(!l){avisar('No se encontró esa liquidación.');return}
  const x=(e.empleados||[]).find(y=>y.id===l.empleadoId)||{};
  const motivo=(MOTIVOS_RETIRO[l.motivo]?MOTIVOS_RETIRO[l.motivo].nombre.split(' — ')[0]:l.motivo);
  try{
    const jsPDF=await cargarJsPDF();
    const doc=new jsPDF({unit:'pt',format:'letter'});
    const an=doc.internal.pageSize.getWidth(), al=doc.internal.pageSize.getHeight();
    let y=encabezadoPDF(doc,'Finiquito laboral',`Liquidación final · retiro el ${fFecha(l.fechaRetiro)}`);
    const parrafo=(texto,tam=10)=>{
      doc.setFont('helvetica','normal'); doc.setFontSize(tam); doc.setTextColor(40,40,40);
      const ls=doc.splitTextToSize(texto,an-80); doc.text(ls,40,y); y+=ls.length*(tam+4)+8;
    };
    parrafo(`Yo, ${l.nombre}${x.puesto?`, quien me desempeñé como ${x.puesto}`:''}, presté mis servicios a ${e.nombre}${e.nit?` (NIT ${e.nit})`:''} desde el ${fFecha(x.fechaIngreso)} hasta el ${fFecha(l.fechaRetiro)}, es decir, ${l.diasLaborados} días de relación laboral. La relación terminó por: ${motivo.toLowerCase()}.`);
    const filas=LIQUIDACION_CONCEPTOS.filter(c=>((l.conceptos||{})[c.k]||{}).debido>0)
      .map(c=>[c.nombre,Q(l.conceptos[c.k].debido)]);
    const ded=l.deducciones||{};
    if(ded.igssLaboral>0||ded.isr>0){
      filas.push([{content:'Total devengado',styles:{fontStyle:'bold'}},{content:Q(l.bruto!==undefined?l.bruto:l.total),styles:{fontStyle:'bold',halign:'right'}}]);
      if(ded.igssLaboral>0) filas.push(['(−) IGSS laboral sobre vacaciones','-'+Q(ded.igssLaboral)]);
      if(ded.isr>0) filas.push(['(−) ISR sobre vacaciones','-'+Q(ded.isr)]);
    }
    filas.push([{content:'Total recibido (neto)',styles:{fontStyle:'bold',textColor:VERDE}},{content:Q(l.total),styles:{fontStyle:'bold',halign:'right',textColor:VERDE}}]);
    doc.autoTable({head:[['Concepto','Monto (Q)']],body:filas,startY:y,margin:{left:40,right:40,bottom:42},
      styles:{fontSize:10,cellPadding:5,lineColor:[225,222,212],lineWidth:.3},headStyles:{fillColor:VERDE},
      columnStyles:{1:{halign:'right',cellWidth:120}}});
    y=doc.lastAutoTable.finalY+18;
    parrafo(`Declaro que recibí la cantidad de Q${Q(l.total)} (${quetzalesEnLetras(l.total)}), por los conceptos detallados arriba, correspondientes a la terminación de mi relación laboral, y que con ello quedan pagadas esas prestaciones. Esta constancia se entiende sin perjuicio de los derechos que la ley reconoce como irrenunciables al trabajador.`);
    parrafo('No incluye el sueldo de los días trabajados del último período, que se paga en la planilla correspondiente. La indemnización, el aguinaldo y el Bono 14 no llevan descuento de IGSS ni de ISR.',8.5);
    if(y>al-170){ doc.addPage(); y=60; }
    y+=60;
    doc.setDrawColor(90,90,90); doc.setLineWidth(.6);
    doc.line(40,y,an/2-20,y); doc.line(an/2+20,y,an-40,y);
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(60,60,60);
    doc.text(l.nombre,40,y+12); doc.text('Trabajador(a) — firma de recibido',40,y+24);
    doc.text(e.representante||e.nombre,an/2+20,y+12); doc.text('Patrono / representante legal',an/2+20,y+24);
    doc.setFontSize(7.5); doc.setTextColor(130,130,130);
    doc.text(`Generado el ${fFecha(hoy())}`,40,al-22);
    doc.save(`Finiquito-${archivoSeguro(l.nombre)}-${l.fechaRetiro}.pdf`);
    avisarDatosIncompletos();
  }catch(err){
    avisar('No se pudo generar el PDF: '+err.message+'\n\nEl generador se descarga de internet la primera vez, así que necesitás conexión.');
  }
};


/* ---- Accesos rápidos de Inicio, Visibilidad y Configuración ---- */
ACCIONES.irTablero=()=>{VISTA='tablero';filtros={};pintar()};

