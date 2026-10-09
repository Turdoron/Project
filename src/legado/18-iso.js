/* ============ ISO — FORMA DE ACREDITAMIENTO (Art. 11, Dto. 73-2008) ============ */
/* El contribuyente elige UNA de dos formas, y la SAT la lleva en el RTU:
   a) el ISO pagado en los cuatro trimestres de un año se acredita al ISR (mensual,
      trimestral o anual) de los TRES años calendario siguientes, hasta agotarse; lo que
      no se logre acreditar es gasto deducible en la liquidación anual del año en que
      concluyen los tres años.
   b) los pagos trimestrales de ISR se acreditan al ISO del mismo año calendario.
   Se puede cambiar al inicio de cada período fiscal. Según la SAT, quien pasa de a) a b)
   ya no puede aplicar al ISR el ISO que pagó bajo a). */
const ISO_OPCIONES={
  a:{corto:'ISO a ISR',nombre:'a) El ISO pagado se acredita al ISR de los 3 años siguientes (la más común)'},
  b:{corto:'ISR a ISO',nombre:'b) Los pagos trimestrales de ISR se acreditan al ISO del mismo año'}};
const ISO_ANOS_CREDITO=3;
function isoOpcionEn(e,fecha){
  const h=(e.historialISO||[]).filter(x=>x.vigenteDesde<=fecha).sort((x,y)=>x.vigenteDesde.localeCompare(y.vigenteDesde));
  return h.length?h[h.length-1].opcion:null;
}
const isoOpcionDelAnio=(e,anio)=>isoOpcionEn(e,`${anio}-12-31`);
/* Art. 4, Dto. 73-2008: quien inicia actividades está exento durante sus primeros cuatro trimestres de
   operación. Se cuentan desde el trimestre en que empezó (inclusive). Solo se aplica si la fecha de inicio
   está registrada a propósito: una empresa con años de operación que recién empieza a usar el sistema
   no es nueva, y su primera partida no dice cuándo empezó a operar. */
function trimestresExentosISO(e){
  if(!e.inicioOperaciones) return [];
  let anio=+e.inicioOperaciones.slice(0,4), t=Math.ceil(+e.inicioOperaciones.slice(5,7)/3);
  const out=[];
  for(let i=0;i<4;i++){ out.push({anio,t}); t++; if(t>4){ t=1; anio++; } }
  return out;
}
const isoExentoTrimestre=(e,anio,t)=>trimestresExentosISO(e).some(x=>x.anio===anio&&x.t===t);
const NOMBRE_TRIM=['Ene–Mar','Abr–Jun','Jul–Sep','Oct–Dic'];
ACCIONES.inicioOperacionesISO=()=>{
  const e=emp(), primera=(e.partidas||[]).map(p=>p.fecha).filter(Boolean).sort()[0]||'';
  abrirModal('Inicio de operaciones',
    `<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">Quien <strong>inicia actividades</strong> está exento del ISO durante sus <strong>primeros cuatro trimestres de operación</strong> (Art. 4, Dto. 73-2008). Escribí la fecha en que la empresa empezó a operar.
      Si la empresa ya operaba antes de usar este sistema, poné la fecha real de inicio (aunque sea de años atrás) o dejala vacía: así no se le aplica una exención que no le corresponde.</p>
    <div class="rej"><div class="campo"><label>Inicio de operaciones</label><input name="fecha" type="date" value="${esc(e.inicioOperaciones||'')}"></div></div>
    ${primera&&!e.inicioOperaciones?`<p class="ayuda-campo">La primera partida registrada es del ${fFecha(primera)}.</p>`:''}`,
    d=>{ e.inicioOperaciones=d.fecha||'';
      registrarLog('Registró el inicio de operaciones',`${e.nombre} — ${d.fecha?fFecha(d.fecha):'sin fecha'}`); guardar(); pintar(); },'Guardar');
};
const restanteCreditoISO=c=>r2(c.monto-(c.usado||0)-(c.vencido||0));

/* Opción a): créditos de ISO. Un ISO pagado en el año Y se puede aplicar en Y+1, Y+2 y Y+3. */
function creditosISOUsables(e,anioUso){
  return (e.creditosISO||[]).filter(c=>!c.congelado&&c.anio<anioUso&&c.anio+ISO_ANOS_CREDITO>=anioUso&&restanteCreditoISO(c)>0.004)
    .sort((x,y)=>x.anio-y.anio||x.trimestre-y.trimestre);
}
const totalCreditoISOUsable=(e,anioUso)=>r2(creditosISOUsables(e,anioUso).reduce((s,c)=>s+restanteCreditoISO(c),0));
/* Aplica créditos empezando por los más viejos (son los primeros que vencen). */
function aplicarCreditosISO(e,monto,fecha,contexto,partidaId){
  let falta=monto, aplicado=0;
  creditosISOUsables(e,+fecha.slice(0,4)).forEach(c=>{
    if(falta<=0.004) return;
    const t=r2(Math.min(restanteCreditoISO(c),falta));
    c.usado=r2((c.usado||0)+t); (c.usos=c.usos||[]).push({fecha,monto:t,contexto,partidaId:partidaId||''});
    falta=r2(falta-t); aplicado=r2(aplicado+t);
  });
  return aplicado;
}
/* Opción b): lo que se pagó de ISR en los trimestres de un año, menos lo que ya se usó para pagar ISO. */
function isrConsumidoPorISO(e,anio,antesDeTrimestre){
  return r2((e.pagosISO||[]).filter(p=>p.anio===anio&&p.opcion==='b'&&(antesDeTrimestre===undefined||p.trimestre<antesDeTrimestre))
    .reduce((s,p)=>s+(p.acreditadoISR||0),0));
}
function poolISRparaISO(e,anio,hastaTrimestre){
  const pagado=(e.cierresParciales||[]).filter(c=>c.ejercicio===anio&&c.trimestre<=hastaTrimestre).reduce((s,c)=>s+c.monto,0);
  return r2(Math.max(0,pagado-isrConsumidoPorISO(e,anio)));
}
/* Partida de pago de ISR: del ISR por pagar sale el efectivo y, si hay, el crédito de ISO. */
function lineasPagoISR(ctaDebe,monto,cred,cuenta){
  const l=[{cta:ctaDebe,desc:'',debe:monto,haber:0}];
  if(cred>0.004) l.push({cta:'1.1.16',desc:'',debe:0,haber:cred});
  if(monto-cred>0.004) l.push({cta:cuenta,desc:'',debe:0,haber:r2(monto-cred)});
  return l;
}
/* Liquidación anual con ISO (opción a): el crédito se aplica al ISR a pagar, y el ISO que cumple
   sus tres años sin usarse pasa a gasto deducible — pero ese gasto baja la renta imponible y, con
   ella, el ISR contra el que se aplicaría el crédito. Se resuelve iterando hasta que se estabilice. */
function planificarISOAnual(e,base0,pagado){
  const Z=e.ejercicio, cs=e.creditosISO||[];
  const usables=creditosISOUsables(e,Z);
  const totalUsable=r2(usables.reduce((s,c)=>s+restanteCreditoISO(c),0));
  const vencUsables=r2(usables.filter(c=>c.anio+ISO_ANOS_CREDITO===Z).reduce((s,c)=>s+restanteCreditoISO(c),0));
  const vencCongelados=r2(cs.filter(c=>c.congelado&&c.anio+ISO_ANOS_CREDITO===Z).reduce((s,c)=>s+restanteCreditoISO(c),0));
  let E=0;
  for(let i=0;i<60;i++){
    const isr=r2(Math.max(0,r2(base0-E))*0.25), dif=r2(isr-pagado);
    const aplic=r2(Math.min(totalUsable,Math.max(0,dif)));
    const nuevo=r2(vencCongelados+Math.max(0,vencUsables-aplic));
    if(Math.abs(nuevo-E)<0.005){E=nuevo;break}
    E=nuevo;
  }
  const base=r2(base0-E), isr=r2(Math.max(0,base)*0.25), dif=r2(isr-pagado);
  return {base,isr,dif,aplicado:r2(Math.min(totalUsable,Math.max(0,dif))),vencido:E};
}
/* Pasa a gasto deducible el ISO que cumplió sus tres años sin acreditarse. */
function postearISOVencido(e,hastaAno){
  const Z=e.ejercicio;
  const venc=(e.creditosISO||[]).filter(c=>c.anio+ISO_ANOS_CREDITO===Z&&restanteCreditoISO(c)>0.004);
  const total=r2(venc.reduce((s,c)=>s+restanteCreditoISO(c),0));
  if(total<=0.004) return 0;
  asegurarCuenta(e,'6.2.25','Impuesto de Solidaridad (ISO) no acreditado','gasto');
  asegurarCuenta(e,'1.1.16','ISO por acreditar','activo');
  e.partidas.push({id:uid(),numero:e.correlativo++,fecha:hastaAno,
    concepto:`Cierre fiscal total ${Z} — ISO no acreditado en 3 años, pasa a gasto deducible`,
    docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',
    lineas:[{cta:'6.2.25',desc:'',debe:total,haber:0},{cta:'1.1.16',desc:'',debe:0,haber:total}]});
  const pv=e.partidas[e.partidas.length-1];
  venc.forEach(c=>{c.vencido=r2((c.vencido||0)+restanteCreditoISO(c)); c.vencidoPartidaId=pv.id;});
  return total;
}

ACCIONES.elegirISO=(continuar)=>{
  const e=emp();
  abrirModal('¿Cómo acredita esta empresa el ISO?',
    `<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">El régimen General lleva Impuesto de Solidaridad, y la ley deja elegir una de dos formas de acreditarlo (Art. 11).
      Es la que tiene inscrita la empresa en la SAT: confirmala antes de pagar el primer trimestre.</p>
    <div class="rej"><div class="campo full"><label>Forma de acreditamiento</label>
      <select name="opcion">${Object.entries(ISO_OPCIONES).map(([k,o])=>`<option value="${k}">${o.nombre}</option>`).join('')}</select></div></div>`,
    d=>{
      e.historialISO=[{opcion:d.opcion,vigenteDesde:`${e.ejercicio}-01-01`}];
      registrarLog('Eligió la forma de acreditar el ISO',`${e.nombre} — ${ISO_OPCIONES[d.opcion].corto}`);
      guardar(); pintar();
      if(typeof continuar==='function') setTimeout(continuar,0);
    },'Guardar');
};
ACCIONES.cambiarISO=()=>{
  const e=emp(), actual=isoOpcionDelAnio(e,e.ejercicio);
  const otra=actual==='a'?'b':'a';
  abrirModal('Cambiar la forma de acreditar el ISO',
    `<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">Forma actual: <strong>${esc(ISO_OPCIONES[actual||'a'].nombre)}</strong>.
      El cambio solo puede regir desde el <strong>1 de enero</strong> de un año, y tiene que coincidir con lo que se registre en la SAT.</p>
    <div class="rej">
      <div class="campo full"><label>Nueva forma</label><select name="opcion">${Object.entries(ISO_OPCIONES).map(([k,o])=>`<option value="${k}"${k===otra?' selected':''}>${o.nombre}</option>`).join('')}</select></div>
      <div class="campo full"><label>Rige desde</label><input name="vigenteDesde" type="date" value="${e.ejercicio+1}-01-01"></div>
    </div>
    <div class="aviso">Si pasás de a) a b), según la SAT el ISO que ya pagaste bajo a) <strong>ya no se puede aplicar al ISR</strong>.
      El sistema lo deja congelado y, al cumplirse sus tres años, lo pasa a gasto deducible.</div>`,
    d=>{
      if(d.opcion===actual){avisar('Ya es la forma que tiene la empresa — elegí la otra.');return false}
      if(!/^\d{4}-01-01$/.test(d.vigenteDesde||'')){avisar('El cambio solo puede regir desde el 1 de enero de un año.');return false}
      e.historialISO=e.historialISO||[];
      e.historialISO.push({opcion:d.opcion,vigenteDesde:d.vigenteDesde});
      if(d.opcion==='b') (e.creditosISO||[]).forEach(c=>{ if(restanteCreditoISO(c)>0.004) c.congelado=true; });
      registrarLog('Cambió la forma de acreditar el ISO',`${e.nombre} — ahora ${ISO_OPCIONES[d.opcion].corto} desde ${fFecha(d.vigenteDesde)}`);
      guardar(); pintar();
    },'Registrar cambio');
};

ACCIONES.pagarISO=()=>{
  const e=emp();
  if(e.regimen!=='general'){avisar('El Impuesto de Solidaridad es solo para el régimen General.');return}
  const iso=calcularISO(e);
  if(!iso.aplica){avisar('Esta empresa no está afecta al ISO ahora mismo: '+iso.motivo);return}
  const cajaBanco=cuentasCajaBanco(e);
  if(!cajaBanco.length){avisar('El catálogo no tiene ninguna cuenta de Caja o Bancos.');return}
  const opcion=isoOpcionDelAnio(e,e.ejercicio);
  if(!opcion){ACCIONES.elegirISO(()=>ACCIONES.pagarISO());return}
  abrirModal('Pagar Impuesto de Solidaridad',
    `<p style="margin:0 0 14px;font-size:13px;color:var(--tinta-suave)">
      Base: la mayor entre 1/4 del activo neto (Q${Q(iso.activoNetoAnt)}) y 1/4 de los ingresos brutos
      (Q${Q(iso.ingresosAnt)}) del ejercicio ${iso.ejercicioAnterior} — en este caso, ${esc(iso.criterio)}.
      <strong>ISO trimestral: Q${Q(iso.isoTrimestral)}.</strong> Forma de acreditar: <strong>${esc(ISO_OPCIONES[opcion].corto)}</strong>.</p>
    <div class="rej">
      <div class="campo"><label>Trimestre</label><select name="trimestre">
        ${[1,2,3,4].map(t=>`<option value="${t}">${NOMBRE_TRIM[t-1]}${isoExentoTrimestre(e,e.ejercicio,t)?' (exento: inicio de operaciones)':''}</option>`).join('')}
      </select></div>
      <div class="campo"><label>Monto del ISO</label><input name="monto" type="number" step="0.01" min="0" value="${iso.isoTrimestral}"></div>
      <div class="campo"><label>Se paga desde</label><select name="cuenta">
        ${cajaBanco.map(c=>`<option value="${c.c}">${c.c} — ${esc(c.n)}</option>`).join('')}
      </select></div>
      <div class="campo"><label>Fecha de pago</label><input name="fechaPago" type="date" value="${fechaPagoDefault(e)}"></div>
    </div>
    ${iso.criterio==='activo neto'?`<div class="rej" style="margin-top:8px">
      <div class="campo full"><label>¿La empresa paga IUSI?</label>
        <select name="pagaIUSI"><option value="">— Elegí una opción —</option><option value="no">No paga IUSI (no tiene inmuebles a su nombre, o está exenta)</option><option value="si">Sí paga IUSI</option></select></div>
    </div>
    <div class="rej" id="camposIUSI" style="margin-top:8px;display:none">
      <div class="campo"><label>IUSI pagado en el trimestre</label><input name="iusi" type="number" step="0.01" min="0" value="0"></div>
      <div class="campo"><label>Estimar IUSI: valor del inmueble</label><input name="iusiValor" type="number" step="0.01" min="0" placeholder="Opcional"></div>
      <div class="campo"><label>Uso</label><select name="iusiUso"><option value="comercial">Comercial u otros</option><option value="vivienda">Vivienda o mixto</option></select></div>
    </div>
    <p id="previewIUSI" style="margin:6px 0 0;font-size:12.5px;color:var(--tinta-suave)"></p>`:''}
    <p style="margin:6px 0 0;font-size:12.5px;color:var(--tinta-suave)">El monto viene calculado sobre la base de arriba.
      ${iso.criterio==='activo neto'?'Como la base es el activo neto, el IUSI pagado en el trimestre se resta del ISO: escribilo arriba y el monto se ajusta solo.':'El IUSI solo se resta cuando la base es el activo neto; acá la base son los ingresos, así que no aplica.'}
      <br>Nuevo IUSI (Dto. 18-2026, aplicado desde ${fFecha(IUSI_VIGENCIA_NUEVA)}): vivienda exenta; comercial 3‰, 6‰ y 9‰ por tramos.</p>
    <p id="previewISO" style="margin:10px 0 0;font-size:13px"></p>
    <div class="aviso">${opcion==='a'
      ? 'Se registra como <strong>ISO por acreditar</strong> (un activo), no como gasto: se aplicará al ISR de los 3 años siguientes. Lo que no se acredite en ese plazo pasa a gasto deducible.'
      : 'Se paga con los pagos trimestrales de ISR del mismo año, hasta donde alcancen. Lo que se use así ya no cuenta como ISR pagado, y el ISO no se recupera más adelante: se registra como gasto no deducible.'}</div>`,
    d=>{
      const t=+d.trimestre, monto=r2(+d.monto);
      if(isoExentoTrimestre(e,e.ejercicio,t)){avisar(`El trimestre ${NOMBRE_TRIM[t-1]} de ${e.ejercicio} está exento: es uno de los primeros cuatro trimestres de operación de la empresa (inició el ${fFecha(e.inicioOperaciones)}, Art. 4 del Dto. 73-2008). No se paga ISO.`);return false}
      /* No todas las empresas pagan IUSI: se pregunta cada vez, cuando aplica. */
      if(iso.criterio==='activo neto'&&!d.pagaIUSI){avisar('Indicá si la empresa paga IUSI: el IUSI pagado se resta del ISO cuando la base es el activo neto.');return false}
      if(!(monto>0)){avisar('Escribí el monto del ISO.');return false}
      const yaPagado=(e.pagosISO||[]).some(x=>x.anio===e.ejercicio&&x.trimestre===t)
        ||e.partidas.some(x=>(x.concepto||'').startsWith(`Pago de ISO — trimestre ${t} de ${e.ejercicio}`));
      if(yaPagado){avisar(`El ISO del trimestre ${t} de ${e.ejercicio} ya está registrado.`);return false}
      e.pagosISO=e.pagosISO||[];
      let p;
      if(opcion==='a'){
        asegurarCuenta(e,'1.1.16','ISO por acreditar','activo');
        p={id:uid(),numero:e.correlativo++,fecha:d.fechaPago,
          concepto:`Pago de ISO — trimestre ${t} de ${e.ejercicio} (por acreditar al ISR)`,
          docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',
          lineas:[{cta:'1.1.16',desc:'',debe:monto,haber:0},{cta:d.cuenta,desc:'',debe:0,haber:monto}]};
        e.partidas.push(p);
        (e.creditosISO=e.creditosISO||[]).push({id:uid(),anio:e.ejercicio,trimestre:t,monto,usado:0,vencido:0,
          fechaPago:d.fechaPago,partidaId:p.id,congelado:false,usos:[]});
        e.pagosISO.push({id:uid(),anio:e.ejercicio,trimestre:t,monto,fecha:d.fechaPago,opcion:'a',acreditadoISR:0,partidaId:p.id});
      }else{
        const A=r2(Math.min(monto,poolISRparaISO(e,e.ejercicio,t)));
        asegurarCuenta(e,'6.2.28','ISO pagado con crédito de ISR (no deducible)','gasto');
        asegurarCuenta(e,'2.1.05','ISR por pagar','pasivo');
        const lineas=[{cta:'6.2.28',desc:'',debe:monto,haber:0}];
        if(A>0.004) lineas.push({cta:'2.1.05',desc:'',debe:0,haber:A});
        if(monto-A>0.004) lineas.push({cta:d.cuenta,desc:'',debe:0,haber:r2(monto-A)});
        p={id:uid(),numero:e.correlativo++,fecha:d.fechaPago,
          concepto:`Pago de ISO — trimestre ${t} de ${e.ejercicio}${A>0.004?' (acreditando ISR pagado)':''}`,
          docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',lineas};
        e.partidas.push(p);
        e.pagosISO.push({id:uid(),anio:e.ejercicio,trimestre:t,monto,fecha:d.fechaPago,opcion:'b',acreditadoISR:A,partidaId:p.id});
      }
      registrarLog('Pagó ISO',`${e.nombre} — trimestre ${t}/${e.ejercicio} — Q${Q(monto)} — ${ISO_OPCIONES[opcion].corto}`);
      guardar(); pintar();
      avisar(`ISO pagado por Q${Q(monto)}, registrado en la partida No. ${p.numero}.`,'Listo');
    },'Registrar pago');
  const actualizar=()=>{
    const t=+mForm.querySelector('[name="trimestre"]').value, monto=r2(+mForm.querySelector('[name="monto"]').value||0);
    document.getElementById('previewISO').innerHTML = opcion==='a'
      ? `Quedará como crédito para el ISR de ${e.ejercicio+1} a ${e.ejercicio+ISO_ANOS_CREDITO}.`
      : (()=>{const A=r2(Math.min(monto,poolISRparaISO(e,e.ejercicio,t)));
          return `Pagos de ISR disponibles para acreditar: Q${Q(poolISRparaISO(e,e.ejercicio,t))} · se acreditan Q${Q(A)} · en efectivo Q${Q(r2(monto-A))}.`})();
  };
  mForm.querySelector('[name="trimestre"]').onchange=actualizar;
  mForm.querySelector('[name="monto"]').oninput=actualizar;
  const campoIUSI=mForm.querySelector('[name="iusi"]');
  const selPagaIUSI=mForm.querySelector('[name="pagaIUSI"]');
  if(selPagaIUSI) selPagaIUSI.onchange=()=>{
    const si=selPagaIUSI.value==='si';
    document.getElementById('camposIUSI').style.display=si?'':'none';
    document.getElementById('previewIUSI').style.display=si?'':'none';
    if(!si){ campoIUSI.value=0; campoIUSI.oninput(); }
  };
  if(campoIUSI){
    const estimar=()=>{
      const v=+mForm.querySelector('[name="iusiValor"]').value||0;
      const el=document.getElementById('previewIUSI');
      if(!v){ el.textContent=''; return; }
      const r=calcularIUSI(v,mForm.querySelector('[name="iusiUso"]').value,mForm.querySelector('[name="fechaPago"]').value);
      el.textContent=`IUSI estimado (${r.ley}): Q${Q(r.anual)} al año, Q${Q(r2(r.anual/4))} por trimestre. ${r.nota} Es una estimación; el monto real es el del recibo de la municipalidad.`;
      campoIUSI.value=r2(r.anual/4);
      campoIUSI.oninput();
    };
    campoIUSI.oninput=()=>{
      const iusi=Math.max(0,r2(+campoIUSI.value||0));
      mForm.querySelector('[name="monto"]').value=Math.max(0,r2(iso.isoTrimestral-iusi));
      actualizar();
    };
    ['iusiValor','iusiUso','fechaPago'].forEach(n=>{ mForm.querySelector(`[name="${n}"]`).oninput=estimar; mForm.querySelector(`[name="${n}"]`).onchange=estimar; });
  }
  actualizar();
};

/* La tarjeta del Tablero fiscal: cuánto toca de ISO y cómo está su acreditamiento. */
function htmlTarjetaISO(e){
  const iso=calcularISO(e);
  if(!iso.aplica) return `<div class="aviso">Impuesto de Solidaridad: ${esc(iso.motivo)}</div>`;
  const op=isoOpcionDelAnio(e,e.ejercicio);
  let detalle;
  if(!op){
    detalle=`<div class="aviso malo">Falta elegir cómo acredita esta empresa el ISO. <button class="btn mini" data-accion="elegirISO">Elegir ahora</button></div>`;
  }else if(op==='a'){
    const cs=[...(e.creditosISO||[])].sort((x,y)=>x.anio-y.anio||x.trimestre-y.trimestre);
    detalle=`<p style="margin:0 0 8px;font-size:13px;color:var(--tinta-suave)">El ISO pagado se acredita al ISR de los 3 años siguientes; lo que no se use pasa a gasto deducible al cumplirse el plazo.</p>`
      +(cs.length?`<table style="font-size:13px"><thead><tr><th>ISO pagado</th><th class="num">Monto</th><th class="num">Aplicado</th><th class="num">Por aplicar</th><th>Estado</th></tr></thead><tbody>${cs.map(c=>{
        const rest=restanteCreditoISO(c);
        const est=c.congelado?'Congelado por cambio de forma':(rest<=0.004?(c.vencido?'Pasó a gasto':'Aplicado'):(e.ejercicio<=c.anio?`Aplicable desde ${c.anio+1}`:`Vence al cierre de ${c.anio+ISO_ANOS_CREDITO}`));
        return `<tr><td>Trimestre ${c.trimestre} de ${c.anio}</td><td class="num">${Q(c.monto)}</td><td class="num">${Q(c.usado||0)}</td><td class="num">${Q(rest)}</td><td>${est}</td></tr>`;}).join('')}</tbody></table>`
        :`<div class="vacio" style="padding:14px">Todavía no hay ISO pagado por acreditar.</div>`);
  }else{
    const ps=(e.pagosISO||[]).filter(x=>x.anio===e.ejercicio&&x.opcion==='b');
    detalle=`<p style="margin:0 0 8px;font-size:13px;color:var(--tinta-suave)">Los pagos trimestrales de ISR se acreditan al ISO del mismo año. Lo que se usa así ya no cuenta como ISR pagado en la liquidación anual.</p>
      <div class="cifras"><div class="cifra"><span>ISR pagado en ${e.ejercicio}</span><strong>${Q(r2((e.cierresParciales||[]).filter(c=>c.ejercicio===e.ejercicio).reduce((s,c)=>s+c.monto,0)))}</strong></div>
      <div class="cifra"><span>Usado para pagar ISO</span><strong>${Q(isrConsumidoPorISO(e,e.ejercicio))}</strong></div>
      <div class="cifra"><span>ISO pagado en ${e.ejercicio}</span><strong>${Q(r2(ps.reduce((s,x)=>s+x.monto,0)))}</strong></div></div>`;
  }
  return `<h3 style="color:var(--verde);margin:22px 0 4px">Impuesto de Solidaridad (ISO)</h3>
    <p style="margin:0 0 12px;font-size:14px;color:var(--tinta-suave)">
      Tarifa del 1% trimestral sobre la mayor entre 1/4 del activo neto y 1/4 de los ingresos brutos,
      ambos del ejercicio ${iso.ejercicioAnterior} completo (Dto. 73-2008).
      ${op?`Forma de acreditar: <strong>${esc(ISO_OPCIONES[op].nombre)}</strong>. <button class="btn mini sec" data-accion="cambiarISO">Cambiar</button>`:''}</p>
    <p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">${(()=>{ const ex=trimestresExentosISO(e), ini=e.inicioOperaciones;
      const txt=!ini?'Inicio de operaciones sin registrar (si la empresa es nueva, sus primeros cuatro trimestres están exentos).'
        :`Inició operaciones el ${fFecha(ini)}: exenta del ISO en ${ex.map(x=>`${NOMBRE_TRIM[x.t-1]} ${x.anio}`).join(', ')} (Art. 4).`;
      return esc(txt)+` <button class="btn mini sec" data-accion="inicioOperacionesISO">${ini?'Cambiar':'Registrar'}</button>`; })()}</p>
    <div class="cifras">
      <div class="cifra"><span>Activo neto ${iso.ejercicioAnterior}</span><strong>${Q(iso.activoNetoAnt)}</strong></div>
      <div class="cifra"><span>Ingresos brutos ${iso.ejercicioAnterior}</span><strong>${Q(iso.ingresosAnt)}</strong></div>
      <div class="cifra"><span>Base (${esc(iso.criterio)})</span><strong>${Q(iso.base)}</strong></div>
      <div class="cifra"><span>ISO trimestral (1%)</span><strong>${Q(iso.isoTrimestral)}</strong></div>
    </div>${iso.reservaExceso>0?`<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">La reserva para cuentas incobrables al cierre de ${iso.ejercicioAnterior} (Q${Q(iso.reservaAnt)}) pasa del 3% de clientes y documentos por cobrar (Q${Q(iso.topeReserva)}), que es lo que acepta la ley del ISR: el exceso de Q${Q(iso.reservaExceso)} se suma de vuelta al activo neto.</p>`:''}${detalle}`;
}

/* Cierre de libros — el cierre contable tradicional de fin de ejercicio:
   deja en cero cada cuenta de ingreso, costo y gasto, y traslada el
   resultado neto a Utilidades Retenidas, dentro del Patrimonio. Se marca con
   un concepto reconocible (PREFIJO_CIERRE_LIBROS) para que Resultados, el
   Tablero y el Flujo de Efectivo la ignoren al recalcular — así un ejercicio
   ya cerrado se sigue pudiendo consultar con sus cifras reales, sin que su
   propia partida de cierre las deje en cero. El Balance General SÍ la ve
   normal, porque ahí es donde tiene que aparecer el traslado a patrimonio. */
ACCIONES.cierreDeLibros=()=>{
  const e=emp();
  const desde=`${e.ejercicio}-01-01`, hasta=`${e.ejercicio}-12-31`;
  const yaCerrado=(e.partidas||[]).some(p=>(p.concepto||'').startsWith(`${PREFIJO_CIERRE_LIBROS}${e.ejercicio}`));
  if(yaCerrado){avisar(`El ejercicio ${e.ejercicio} ya tiene un cierre de libros registrado. Si necesitás corregirlo, borrá esas partidas primero desde Partidas.`);return}

  const mov=movimientos(desde,hasta,true);
  const lineas=[], detalle=[];
  let totalIngresos=0, totalCostosGastos=0;
  e.cuentas.filter(c=>c.d&&['ingreso','costo','gasto'].includes(c.t)).forEach(c=>{
    const saldo=saldoNatural(c.c,mov);
    if(!saldo) return;
    if(c.t==='ingreso'){ lineas.push({cta:c.c,desc:'',debe:saldo,haber:0}); totalIngresos=r2(totalIngresos+saldo); }
    else{ lineas.push({cta:c.c,desc:'',debe:0,haber:saldo}); totalCostosGastos=r2(totalCostosGastos+saldo); }
    detalle.push({cuenta:c.c,nombre:c.n,tipo:c.t,saldo});
  });
  if(!lineas.length){avisar(`No hay movimiento de ingresos, costos ni gastos en el ejercicio ${e.ejercicio} para cerrar.`);return}
  const neto=r2(totalIngresos-totalCostosGastos);
  /* En una empresa individual no hay "utilidades retenidas" separadas del
     capital del dueño — todo es la misma cuenta, así que el resultado del
     ejercicio se suma directo a Capital. En una sociedad, en cambio, sí
     tiene sentido llevarlo aparte a Utilidades Retenidas, distinguiendo lo
     que los socios aportaron de lo que la empresa generó. */
  const esIndividual=e.tipoSociedad!=='sociedad';
  const ctaDestino=esIndividual?'3.1.01':'3.1.03';
  const nombreDestino=esIndividual?'Capital':'Utilidades retenidas';

  abrirModal('Cierre de libros',
    `<p style="margin:0 0 14px;font-size:13px;color:var(--tinta-suave)">Cierre contable tradicional, en dos
      partidas con una cuenta puente — "Pérdidas y Ganancias" —, no una sola directa a Patrimonio:</p>
    <ol style="margin:0 0 14px;padding-left:20px;font-size:13px;color:var(--tinta-suave)">
      <li>Cada cuenta de ingreso se debita, cada cuenta de costo y gasto se acredita, y la contrapartida de las
        dos va a Pérdidas y Ganancias — así quedan todas en cero para el año que empieza.</li>
      <li>El saldo que le queda a Pérdidas y Ganancias —${neto>=0?'utilidad':'pérdida'} de
        Q${Q(Math.abs(neto))}— se traslada aparte a ${nombreDestino}, y la cuenta puente también queda en cero.</li>
      ${!esIndividual&&neto>0?`<li>Por ser sociedad, se separa el 5% de la utilidad neta —Q${Q(r2(neto*0.05))}— como Reserva legal (Art. 36, Código de Comercio).</li>`:''}
    </ol>
    <p style="margin:0 0 14px;font-size:13px;color:var(--tinta-suave)">Los reportes de Estado de Resultados y el
      Libro de Estados Financieros van a seguir mostrando las cifras reales de ${e.ejercicio} si los volvés a
      consultar — estas dos partidas no se mezclan con esos cálculos, solo con el Balance General y el Diario.
      No se deshacen con un botón, solo borrándolas a mano desde Partidas si hiciera falta.</p>
    <div style="max-height:40vh;overflow:auto"><table style="font-size:13px"><thead><tr><th>Cuenta</th>
      <th class="num">Se cierra por</th></tr></thead><tbody>
      ${detalle.map(x=>`<tr><td>${x.cuenta} — ${esc(x.nombre)}</td><td class="num">${x.tipo==='ingreso'?'Debe':'Haber'} ${Q(x.saldo)}</td></tr>`).join('')}
      <tr class="total"><td>Pérdidas y Ganancias, saldo del ejercicio</td>
        <td class="num">${neto>=0?'Haber':'Debe'} ${Q(Math.abs(neto))}</td></tr>
      <tr class="total"><td>${neto>=0?'Utilidad':'Pérdida'} a ${nombreDestino}</td>
        <td class="num">${neto>=0?'Haber':'Debe'} ${Q(Math.abs(neto))}</td></tr>
      </tbody></table></div>`,
    ()=>{
      asegurarCuenta(e,'3.1.08','Pérdidas y ganancias del ejercicio','patrimonio');
      asegurarCuenta(e,ctaDestino,nombreDestino,'patrimonio');
      /* Partida 1: cada cuenta de ingreso/costo/gasto se cierra contra la
         cuenta puente — nunca directo contra Patrimonio. */
      lineas.push(neto>=0?{cta:'3.1.08',desc:'',debe:0,haber:neto}:{cta:'3.1.08',desc:'',debe:r2(-neto),haber:0});
      const p1={id:uid(),numero:e.correlativo++,fecha:hasta,
        concepto:`${PREFIJO_CIERRE_LIBROS}${e.ejercicio} — traslado a Pérdidas y Ganancias`,
        docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',lineas};
      e.partidas.push(p1);
      /* Partida 2: recién acá se traslada el resultado neto —ya sentado en
         la cuenta puente— hacia Patrimonio. Dos movimientos separados, no
         uno solo, para que la cuenta puente exista de verdad en el Mayor
         como un paso intermedio, tal como espera ver un auditor. */
      const p2={id:uid(),numero:e.correlativo++,fecha:hasta,
        concepto:`${PREFIJO_CIERRE_LIBROS}${e.ejercicio} — traslado de Pérdidas y Ganancias a ${nombreDestino}`,
        docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',
        lineas: neto>=0
          ? [{cta:'3.1.08',desc:'',debe:neto,haber:0},{cta:ctaDestino,desc:'',debe:0,haber:neto}]
          : [{cta:'3.1.08',desc:'',debe:0,haber:r2(-neto)},{cta:ctaDestino,desc:'',debe:r2(-neto),haber:0}]};
      e.partidas.push(p2);
      /* Art. 36 del Código de Comercio: toda sociedad separa anualmente, como
         mínimo, el 5% de la utilidad neta del ejercicio para la reserva legal. */
      let p3=null;
      if(!esIndividual && neto>0){
        const reserva=r2(neto*0.05);
        asegurarCuenta(e,'3.1.02','Reserva legal','patrimonio');
        p3={id:uid(),numero:e.correlativo++,fecha:hasta,
          concepto:`${PREFIJO_CIERRE_LIBROS}${e.ejercicio} — reserva legal del 5% (Art. 36, Código de Comercio)`,
          docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',
          lineas:[{cta:'3.1.03',desc:'',debe:reserva,haber:0},{cta:'3.1.02',desc:'',debe:0,haber:reserva}]};
        e.partidas.push(p3);
      }
      registrarLog('Hizo el cierre de libros',`${e.nombre} — ejercicio ${e.ejercicio} — ${neto>=0?'utilidad':'pérdida'} Q${Q(Math.abs(neto))}`);
      guardar();
      avisar(`Cierre de libros del ejercicio ${e.ejercicio} registrado en las partidas No. ${p1.numero} y ${p2.numero}${p3?`, y la reserva legal (Q${Q(p3.lineas[0].debe)}) en la No. ${p3.numero}`:''}.`,'Listo');
    },'Postear el cierre');
};

ACCIONES.cambiarRegimen=()=>{
  const e=emp();
  const ops=Object.entries(REGIMENES).map(([k,v])=>`<option value="${k}"${k===e.regimen?' selected':''}>${v}</option>`).join('');
  abrirModal('Cambiar régimen',
    `<p style="margin:0 0 14px;font-size:13px;color:var(--tinta-suave)">Régimen actual: <strong>${esc(REGIMENES[e.regimen]||e.regimen)}</strong>.
      Los meses ya registrados bajo el régimen anterior no se recalculan — cada uno conserva el régimen que regía
      en su momento.</p>
    <div class="rej">
      <div class="campo full"><label>Nuevo régimen</label><select name="nuevoRegimen">${ops}</select></div>
      <div class="campo full"><label>Vigente a partir de</label><input name="vigenteDesde" type="date"></div>
    </div>`,
    d=>{
      if(!d.vigenteDesde){avisar('Elegí la fecha desde la que rige el nuevo régimen.');return false}
      if(d.nuevoRegimen===e.regimen){avisar('Ya es el régimen actual — elegí uno distinto.');return false}
      /* De Pequeño Contribuyente hacia cualquier otro régimen se puede en
         cualquier momento (incluso la ley obliga a hacerlo apenas se supera
         el tope de ingresos). De cualquier otro régimen HACIA Pequeño
         Contribuyente, solo entra en vigencia el 1 de enero. */
      if(d.nuevoRegimen==='pequeno' && e.regimen!=='pequeno'){
        const [anio,mes,dia]=d.vigenteDesde.split('-').map(Number);
        if(mes!==1||dia!==1){
          avisar('El cambio hacia Pequeño Contribuyente solo puede entrar en vigencia el 1 de enero. Elegí esa fecha, del año que corresponda.');
          return false;
        }
      }
      e.historialRegimen=e.historialRegimen||[{regimen:e.regimen,vigenteDesde:`${e.ejercicio}-01-01`}];
      e.historialRegimen.push({regimen:d.nuevoRegimen,vigenteDesde:d.vigenteDesde});
      e.historialRegimen.sort((a,b)=>a.vigenteDesde.localeCompare(b.vigenteDesde));
      sincronizarRegimenActual(e);
      registrarLog('Cambió de régimen',`${e.nombre} — ${REGIMENES[d.nuevoRegimen]} desde el ${fFecha(d.vigenteDesde)}`);
      guardar(); pintar();
      const pideISO=d.nuevoRegimen==='general'&&!(e.historialISO||[]).length;
      avisar(`Régimen actualizado. Los meses antes del ${fFecha(d.vigenteDesde)} conservan el régimen anterior en todos los cálculos.${pideISO?'\n\nEl régimen General lleva Impuesto de Solidaridad: elegí cómo se acredita en el Tablero fiscal, antes de pagar el primer trimestre.':''}`,'Listo');
    },'Registrar cambio');
};
ACCIONES.irProveedores=()=>{VISTA='proveedores';filtros={};pintar()};
ACCIONES.irConciliacion=()=>{VISTA='conciliacion';filtros={};pintar()};
ACCIONES.irClientes=()=>{VISTA='clientes';filtros={};pintar()};
ACCIONES.irFacturas=()=>{VISTA='facturas';filtros={};pintar()};
ACCIONES.irPlanillas=()=>{VISTA='planillas';filtros={};pintar()};
ACCIONES.guardarInvFinal=d=>{
  const e=emp(), input=document.getElementById('invFinalInput');
  const monto=+input.value;
  if(input.value===''||isNaN(monto)||monto<0){avisar('Escribí el valor del inventario final, del conteo físico.');return}
  e.inventarioFinal=e.inventarioFinal||{};
  e.inventarioFinal[d.hasta]=r2(monto);
  guardar(); pintar();
};
ACCIONES.guardarNotaEF=()=>{
  const e=emp(), textarea=document.getElementById('notaEF');
  e.notaEstadosFinancieros=textarea.value.trim();
  guardar();
  avisar('Nota guardada — va a aparecer junto al reporte, en pantalla y en el PDF.','Listo');
};
/* El costo de ventas, hasta acá, siempre fue solo una fórmula de reporte —
   nunca se posteaba una partida real que redujera Inventarios. Eso hacía que
   el Balance General mostrara TODO lo comprado en la vida de la empresa como
   activo, mientras el Estado de Resultados restaba una porción como gasto:
   dos historias distintas de la misma plata. Esto sí postea la diferencia de
   verdad: lo que hay en 1.1.08 baja hasta el inventario final que diste, y
   la diferencia se reconoce como Costo de Ventas real. */
ACCIONES.cerrarCostoVentas=d=>{
  const e=emp();
  /* Un cierre fechado en el futuro no tiene sentido contable — sería
     reconocer el costo de mercadería que todavía no tuvo tiempo de
     venderse. Sin este candado, era fácil terminar cerrando sin querer una
     fecha de fin de año mientras se estaba trabajando un corte anterior,
     si el filtro de la pantalla había quedado en el 31 de diciembre. */
  if(d.hasta>hoy()){avisar(`${fFecha(d.hasta)} todavía no llegó — no se puede cerrar el costo de ventas de una fecha futura. Si querés cerrar el trimestre o el año en curso, cambiá el filtro de arriba a la fecha de corte real.`);return}
  const invFinal=e.inventarioFinal?.[d.hasta];
  if(invFinal===undefined){avisar('Primero guardá el inventario final de esa fecha de corte.');return}
  const saldoActual=saldoNatural('1.1.08',movimientos(null,d.hasta));
  const costo=r2(saldoActual-invFinal);
  if(costo<=0){avisar(costo===0?'El inventario ya está exacto en ese monto — no hay nada que cerrar.':
    'El inventario final es mayor que el saldo actual de Inventarios — revisá el monto, porque no puede vender más de lo que hay.');return}
  confirmar(`Esto va a postear una partida que reduce Inventarios de Q${Q(saldoActual)} a Q${Q(invFinal)},
    reconociendo Q${Q(costo)} como Costo de Ventas real del período. Después de esto, el Balance General y el
    Estado de Resultados van a coincidir exactos — no se puede deshacer con un botón, solo borrando la partida
    a mano si hace falta. ¿Confirmás?`,()=>{
    asegurarCuenta(e,'5.1.01','Costo de ventas','costo');
    const p={id:uid(),numero:e.correlativo++,fecha:d.hasta,
      concepto:`Cierre de costo de ventas al ${fFecha(d.hasta)} — inventario final Q${Q(invFinal)}`,
      docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',
      lineas:[{cta:'5.1.01',desc:'',debe:costo,haber:0},{cta:'1.1.08',desc:'',debe:0,haber:costo}]};
    e.partidas.push(p);
    registrarLog('Cerró el costo de ventas',`${e.nombre} — Q${Q(costo)} al ${fFecha(d.hasta)}`);
    guardar(); pintar();
    avisar(`Costo de ventas cerrado en la partida No. ${p.numero}. Inventarios queda en Q${Q(invFinal)}.`,'Listo');
  },'Postear el cierre');
};
ACCIONES.escalaMenos=()=>aplicarEscala(escalaActual()-0.1);
ACCIONES.escalaMas=()=>aplicarEscala(escalaActual()+0.1);
ACCIONES.escalaNormal=()=>aplicarEscala(ESCALA_BASE);
ACCIONES.guardarAtajos=()=>{
  const m={}, primera={};
  document.querySelectorAll('[data-tecla-atajo]').forEach(s=>{ m[s.dataset.teclaAtajo]=s.value; });
  for(const t of TECLAS_ATAJO){ const v=m[t]; if(!v) continue;
    if(primera[v]){ avisar(`Alt+${primera[v]} y Alt+${t} abren la misma pantalla. Dejá cada pantalla en un solo atajo.`); return; }
    primera[v]=t; }
  guardarAtajosVista(m); registrarLog('Cambió los accesos directos',TECLAS_ATAJO.map(t=>`Alt+${t}=${m[t]||'—'}`).join(', ')); pintar();
  avisar('Listo: los accesos directos quedaron guardados.','Accesos directos');
};
ACCIONES.restablecerAtajos=()=>{ guardarAtajosVista(null); registrarLog('Restableció los accesos directos',''); pintar(); };
ACCIONES.guardarDeduccionPersonal=()=>{
  const e=emp(), anio=+document.getElementById('dedAnio').value, v=document.getElementById('dedMonto').value;
  if(!(anio>=2000&&anio<=2100)){avisar('Escribí un año válido.');return}
  e.deduccionPersonalSAT=e.deduccionPersonalSAT||{};
  if(v===''||!(+v>0)) delete e.deduccionPersonalSAT[anio]; else e.deduccionPersonalSAT[anio]=r2(+v);
  guardar(); pintar();
  avisar(`Deducción personal ${anio}: Q${Q(deduccionPersonalAnual(anio,e))}${e.deduccionPersonalSAT[anio]?' (publicada por la SAT)':' (calculada)'}.`,'Guardado');
};
ACCIONES.guardarCuentasRentasCapital=()=>{
  const e=emp();
  e.cuentasRentasCapital=[...document.querySelectorAll('[data-cta-rc]')].filter(c=>c.checked).map(c=>c.dataset.ctaRc);
  guardar(); pintar();
  avisar(`${e.cuentasRentasCapital.length} cuenta(s) vinculadas a rentas de capital.`,'Guardado');
};
function claveIA(){ try{ return localStorage.getItem('contagt_ia_clave')||''; }catch(err){ return ''; } }
ACCIONES.guardarClaveIA=()=>{
  if(!(usuarioActual()&&usuarioActual().rol==='superadmin')){avisar('Solo el Superadministrador configura la clave de API.');return}
  const v=(document.getElementById('claveIA').value||'').trim();
  if(!v){avisar('Pegá la clave de API.');return}
  if(!/^sk-ant-/.test(v)){avisar('Esa no parece una clave de API de Anthropic (empieza con "sk-ant-").');return}
  try{ localStorage.setItem('contagt_ia_clave',v); }catch(err){ avisar('Este navegador no permite guardar la clave.'); return; }
  pintar(); avisar('Clave guardada en este navegador. El asistente ya puede usarse en el archivo descargado.','Listo');
};
ACCIONES.borrarClaveIA=()=>{
  if(!(usuarioActual()&&usuarioActual().rol==='superadmin')){avisar('Solo el Superadministrador configura la clave de API.');return} try{ localStorage.removeItem('contagt_ia_clave'); }catch(err){} pintar(); };
ACCIONES.guardarSalarioMinimo=()=>{
  const e=emp(), input=document.getElementById('salarioMinInput');
  const monto=+input.value;
  if(!monto||monto<=0){avisar('Escribí un salario mínimo mayor a cero.');return}
  e.salarioMinimo=r2(monto);
  guardar(); pintar();
  avisar(`Salario mínimo de ${e.nombre} actualizado a Q${Q(e.salarioMinimo)}.`,'Guardado');
};
ACCIONES.elegirTipoArchivo=d=>{
  document.getElementById('tipoArchivo').value=d.val;
  document.querySelectorAll('#segTipo .seg-op').forEach(b=>b.classList.toggle('on',b.dataset.val===d.val));
};

function formEmpresa(existente){
  const e=existente||{};
  const ops=Object.entries(REGIMENES)
    .map(([k,v])=>`<option value="${k}"${e.regimen===k?' selected':''}>${v}</option>`).join('');
  abrirModal(existente?'Editar empresa':'Agregar empresa',
    `<div class="rej">
      <div class="campo full"><label>Razón social</label><input name="nombre" value="${esc(e.nombre||'')}"></div>
      <div class="campo full"><label>Propietario o sociedad propietaria</label>
        <input name="representante" value="${esc(e.representante||'')}" placeholder="Nombre completo del dueño o de la sociedad"></div>
      <div class="campo full"><label>Dirección fiscal</label>
        <input name="direccion" value="${esc(e.direccion||'')}" placeholder="Como aparece en el RTU"></div>
      <div class="campo"><label>NIT</label><input name="nit" value="${esc(e.nit||'')}" placeholder="1234567-8"></div>
      <div class="campo"><label>Ejercicio contable</label>
        <input name="ejercicio" type="number" value="${e.ejercicio||new Date().getFullYear()}"></div>
      <div class="campo full"><label>¿A qué se dedica la empresa?</label>
        <select name="tipoActividad">${Object.entries(TIPOS_ACTIVIDAD).map(([k,v])=>`<option value="${k}"${(esProductora(e)?'productora':'comercializadora')===k?' selected':''}>${v}</option>`).join('')}</select>
        <span style="font-size:12.5px;color:var(--tinta-suave)">Una industria productora habilita el área de Producción. Si la empresa solo compra y vende, dejá comercializadora: no vas a ver ese módulo, y lo comercial —compras, inventario, ventas— funciona igual en las dos.</span></div>
      <div class="campo full"><label>Método de valuación de inventarios (Art. 41, Dto. 10-2012)</label>
        <select name="metodoCosteo">${Object.entries(METODOS_COSTEO).map(([k,v])=>`<option value="${k}"${metodoCosteo(e)===k?' selected':''}>${v}</option>`).join('')}</select>
        <span style="font-size:12.5px;color:var(--tinta-suave)">${e.metodoCosteoConfirmado
          ? 'Una vez adoptado, la ley no permite cambiarlo sin autorización previa de la SAT. Si ya la tenés, escribí el número de resolución abajo.'
          : (existente?'Esta empresa venía trabajando con promedio ponderado. Confirmá el método que tenés registrado en la SAT — después de guardarlo, ya no se puede cambiar sin autorización.'
                       :'Es el método que vas a usar para valuar la existencia al cerrar cada año. Una vez adoptado, no se puede cambiar sin autorización previa de la SAT, así que elegí con cuidado.')}</span></div>
      ${e.metodoCosteoConfirmado?`<div class="campo full"><label>Resolución de la SAT que autoriza el cambio (solo si lo cambiás)</label><input name="autorizacionCosteo" placeholder="Número de resolución"></div>`:''}
      ${!existente? `<div class="campo full"><label>Régimen de ISR</label><select name="regimen">${ops}</select></div>
      <div class="campo full" id="campoISO"><label>Forma de acreditar el Impuesto de Solidaridad (Art. 11, Dto. 73-2008)</label>
        <select name="isoOpcion">${Object.entries(ISO_OPCIONES).map(([k,o])=>`<option value="${k}">${o.nombre}</option>`).join('')}</select>
        <span style="font-size:12.5px;color:var(--tinta-suave)">El ISO lo llevan las empresas del régimen General. Es la opción que tenés inscrita en la SAT; se puede cambiar al inicio de cada período fiscal, pero cambiarla afecta el ISO que ya pagaste.</span></div>
      <div class="campo full"><label>Tipo</label><select name="tipoSociedad">
        <option value="individual">Empresa individual</option>
        <option value="sociedad">Sociedad</option>
      </select></div>` : ''}
    </div>
    <p style="margin:4px 0 0;font-size:13px;color:var(--tinta-suave)">
      Estos datos encabezan cada hoja de los libros. La razón social, el propietario, el NIT,
      la dirección fiscal y el ejercicio son obligatorios en los libros habilitados.
      ${!existente?' Después de crearla te voy a pedir el capital inicial.'
        :' El régimen de ISR ya no se edita acá — usá "Cambiar régimen" en el Tablero fiscal, porque un cambio de régimen necesita fecha de vigencia, no es un dato que se sobrescribe sin más.'}</p>`,
    d=>{
      if(!d.nombre.trim()){avisar('Escribí la razón social.');return false}
      const datos={nombre:d.nombre.trim(),representante:(d.representante||'').trim(),
        direccion:(d.direccion||'').trim(),nit:d.nit.trim(),
        ejercicio:+d.ejercicio||new Date().getFullYear(),
        tipoActividad:d.tipoActividad==='productora'?'productora':'comercializadora'};
      if(existente){
        const cambia=existente.metodoCosteoConfirmado && d.metodoCosteo!==metodoCosteo(existente);
        if(cambia && !(d.autorizacionCosteo||'').trim()){
          avisar('Cambiar el método de valuación de inventarios necesita autorización previa de la SAT (Art. 41, Dto. 10-2012). Escribí el número de resolución, o dejá el método como está.');
          return false;
        }
        Object.assign(existente,datos);
        existente.metodoCosteo=d.metodoCosteo; existente.metodoCosteoConfirmado=true;
        if(cambia) registrarLog('Cambió el método de valuación de inventarios',`${datos.nombre} — ahora ${METODOS_COSTEO[d.metodoCosteo]} — resolución SAT ${d.autorizacionCosteo.trim()}`);
        registrarLog('Editó una empresa',datos.nombre);
      }
      else{
        const nueva={id:uid(),...datos,regimen:d.regimen,metodoCosteo:d.metodoCosteo,metodoCosteoConfirmado:true,
          historialRegimen:[{regimen:d.regimen,vigenteDesde:`${datos.ejercicio}-01-01`}],
          historialISO:d.regimen==='general'?[{opcion:d.isoOpcion,vigenteDesde:`${datos.ejercicio}-01-01`}]:[],
          tipoSociedad:d.tipoSociedad,administradorId:administradorDeSesion(),
          cuentas:nuevoCatalogo(),partidas:[],documentos:[],
          mapeoNit:{},mapeoCat:{},mapeoBS:{},mapeoProducto:{},pagos:[],cobros:[],inventarioFinal:{},
          empleados:[],planillas:[],socios:[],salarioMinimo:SALARIO_MINIMO,correlativo:1};
        BD.empresas.push(nueva); BD.activa=nueva.id;
        registrarLog('Creó una empresa',nueva.nombre);
        guardar();
        setTimeout(()=>{
          if(d.tipoSociedad==='sociedad'){
            borradorCapital={empresaId:nueva.id,capitalAutorizado:0,fecha:fechaConstitucionDefault(nueva),socios:[socioVacio(),socioVacio()]};
            VISTA='capitalSocial'; pintar();
          }
          else { formCapitalIndividual(nueva); }
        },0);
        return;
      }
      guardar();
    }, existente?'Guardar cambios':'Crear empresa');
  const selReg=mForm.querySelector('[name="regimen"]'), campoISO=mForm.querySelector('#campoISO');
  if(selReg&&campoISO){
    const alternar=()=>{ campoISO.style.display=selReg.value==='general'?'':'none'; };
    selReg.onchange=alternar; alternar();
  }
}
