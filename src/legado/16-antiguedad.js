/* ============ ANTIGÜEDAD DE SALDOS ============ */
/* Cuánto deben clientes (o se les debe a proveedores) y desde hace cuánto está vencido.
   Los pagos y cobros no se registran contra una factura en particular, así que se aplican a las
   facturas más viejas primero (PEPS), que es el criterio usual. Cada factura vence en la fecha del
   último abono de la factura cambiaria (FEL); si no la trae, a los días de crédito de la empresa. */
const PLAZO_CREDITO_DEFECTO=30;
const TRAMOS_ANTIGUEDAD=[['corriente','Por vencer'],['d30','1 a 30 días'],['d60','31 a 60 días'],['d90','61 a 90 días'],['mas90','Más de 90 días']];
const sumarDias=(f,n)=>{ const d=new Date(f+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); };
const plazoCredito=(e,tipo)=>{ const v=(e.plazoCredito||{})[tipo]; return Number.isFinite(+v)&&v!==''&&v!=null?+v:PLAZO_CREDITO_DEFECTO; };
function tramoAntiguedad(dias){ return dias<=0?'corriente':dias<=30?'d30':dias<=60?'d60':dias<=90?'d90':'mas90'; }
function antiguedadSaldos(e,tipo,corte){
  const esCliente=tipo==='clientes', plazo=plazoCredito(e,tipo);
  const neto=d=>r2(d.total-(d.retencionISR||0)-(d.retencionIVA||0)-(d.retIvaFesp||0)-(d.retIsrFesp||0));
  const por={};
  (e.documentos||[]).forEach(d=>{
    if(d.tipo!==(esCliente?'venta':'compra')||!d.alCredito||(d.fecha||'')>corte) return;
    const k=d.nit||'—', x=por[k]=por[k]||{nit:k,nombre:d.nombre,facturas:[],abonos:0};
    if(d.nombre) x.nombre=d.nombre;
    if((d.signo||1)===-1) x.abonos=r2(x.abonos+neto(d));   // nota de crédito: rebaja lo que se debe
    else x.facturas.push({fecha:d.fecha,doc:`${d.serie?d.serie+'-':''}${d.dte||''}`,monto:neto(d),vence:d.vencimiento||sumarDias(d.fecha,plazo),venceFEL:!!d.vencimiento});
  });
  ((esCliente?e.cobros:e.pagos)||[]).filter(m=>(m.fecha||'')<=corte).forEach(m=>{
    const k=m.nit||'—', x=por[k]=por[k]||{nit:k,nombre:m.nombre,facturas:[],abonos:0};
    x.abonos=r2(x.abonos+(+m.monto||0));
  });
  const filas=Object.values(por).map(x=>{
    let resto=x.abonos; const t={corriente:0,d30:0,d60:0,d90:0,mas90:0}, abiertas=[];
    x.facturas.sort((a,b)=>a.vence.localeCompare(b.vence)||a.fecha.localeCompare(b.fecha)).forEach(f=>{
      const aplicado=Math.min(resto,f.monto); resto=r2(resto-aplicado);
      const saldo=r2(f.monto-aplicado); if(saldo<=0.004) return;
      const dias=diasEntre(f.vence,corte)-1, tr=tramoAntiguedad(dias);
      t[tr]=r2(t[tr]+saldo); abiertas.push({...f,saldo,dias,tramo:tr});
    });
    const total=r2(Object.values(t).reduce((s,v)=>s+v,0));
    return {nit:x.nit,nombre:x.nombre,...t,total,anticipo:r2(resto),abiertas,vencido:r2(total-t.corriente)};
  }).filter(f=>f.total>0.004||f.anticipo>0.004).sort((a,b)=>b.vencido-a.vencido||b.total-a.total);
  const tot={corriente:0,d30:0,d60:0,d90:0,mas90:0,total:0,vencido:0};
  filas.forEach(f=>Object.keys(tot).forEach(k=>tot[k]=r2(tot[k]+f[k])));
  return {filas,tot,plazo,corte};
}
function htmlAntiguedad(e,tipo){
  const corte=filtros.corteAnt||hoy(), a=antiguedadSaldos(e,tipo,corte), esCliente=tipo==='clientes';
  if(!a.filas.length) return '';
  const quien=esCliente?'clientes':'proveedores', venc=a.filas.filter(f=>f.vencido>0.004);
  const aviso=a.tot.vencido>0.004?`<div class="aviso${a.tot.mas90>0.004?' malo':''}"><strong>Q${Q(a.tot.vencido)} vencido${esCliente?'s por cobrar':'s por pagar'}</strong> en ${venc.length} ${venc.length===1?(esCliente?'cliente':'proveedor'):quien}${a.tot.mas90>0.004?`, de los que <strong>Q${Q(a.tot.mas90)} tienen más de 90 días</strong>${esCliente?' (revisá si conviene gestionarlos como incobrables)':''}`:''}.</div>`:'';
  return `<h3 class="ant-tit" id="antiguedad">Antigüedad de saldos</h3>
    <div class="barra"><div class="campo"><label for="corteAnt">Al</label><input id="corteAnt" type="date" data-filtro="corteAnt" value="${corte}"></div>
      <p class="ayuda-campo" style="align-self:end;margin:0 0 10px">Días vencidos desde el vencimiento de cada factura: el de la factura cambiaria o, si no lo trae, <strong>${a.plazo} días de crédito</strong>. <button class="btn mini sec" data-accion="plazoCredito" data-tipo="${tipo}">Cambiar plazo</button></p></div>
    ${aviso}
    <table class="densa"><thead><tr><th>${esCliente?'Cliente':'Proveedor'}</th>${TRAMOS_ANTIGUEDAD.map(([,n])=>`<th class="num">${n}</th>`).join('')}<th class="num">Total</th></tr></thead>
    <tbody>${a.filas.map(f=>`<tr><td>${esc(f.nombre||'Sin nombre')}<br><span class="ayuda-campo" style="margin:0">NIT ${esc(f.nit)}${f.anticipo>0.004?` · anticipo Q${Q(f.anticipo)}`:''}</span></td>
      ${TRAMOS_ANTIGUEDAD.map(([k])=>`<td class="num${k!=='corriente'&&f[k]>0.004?' ant-venc':''}${k==='mas90'&&f[k]>0.004?' ant-grave':''}">${f[k]>0.004?Q(f[k]):'—'}</td>`).join('')}
      <td class="num"><strong>${Q(f.total)}</strong></td></tr>`).join('')}</tbody>
    <tfoot><tr class="total"><td>Total</td>${TRAMOS_ANTIGUEDAD.map(([k])=>`<td class="num">${Q(a.tot[k])}</td>`).join('')}<td class="num">${Q(a.tot.total)}</td></tr></tfoot></table>`;
}
ACCIONES.plazoCredito=d0=>{
  const e=emp(), tipo=d0.tipo==='proveedores'?'proveedores':'clientes';
  abrirModal(`Días de crédito de ${tipo}`,
    `<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">Se usa para las facturas que no traen fecha de vencimiento (las facturas cambiarias de FEL sí la traen en sus abonos).</p>
     <div class="rej"><div class="campo"><label>Días de crédito</label><input name="dias" type="number" min="0" step="1" value="${plazoCredito(e,tipo)}"></div></div>`,
    f=>{ const n=Math.floor(+f.dias); if(!(n>=0)){avisar('Escribí un número de días (0 o más).');return false}
      e.plazoCredito=Object.assign({},e.plazoCredito,{[tipo]:n}); registrarLog('Cambió los días de crédito',`${tipo}: ${n}`); guardar(); pintar(); },'Guardar');
};
