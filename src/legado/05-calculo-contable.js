/* ============ CÁLCULO CONTABLE ============ */
/* Signo: activo/costo/gasto suman por el debe; pasivo/patrimonio/ingreso por el haber. */
const NATURAL_DEUDORA=t=>t==='activo'||t==='costo'||t==='gasto';

/* Prefijo con el que se marca la partida de cierre de libros — se usa acá
   mismo y en cualquier cálculo que necesite "olvidarse" de que existe, para
   que un año ya cerrado se pueda seguir consultando con sus cifras reales. */
const PREFIJO_CIERRE_LIBROS='Cierre de libros ';
/* Las partidas de "Cierre de costo de ventas" mueven la cuenta de
   Inventarios (la acreditan, para reconocer el costo de lo vendido) — si
   una de esas partidas cae DENTRO del rango que se está analizando (por
   ejemplo, el cierre del 31 de marzo, mirado dentro de un cálculo de enero
   a marzo), su efecto no debe contarse como si fuera una compra negativa:
   no es una nota de crédito de un proveedor, es la reclasificación del
   propio cierre. Antes esto contaminaba comprasBienes — el trimestre
   parecía haber comprado menos de lo que realmente compró, exactamente por
   el monto que se cerró ese mismo corte. Esta función calcula el
   movimiento de una cuenta excluyendo esas partidas puntuales, sin tocar
   movimientos() en general — esa función la usan muchos otros cálculos
   (como leer el saldo REAL de Costo de Ventas después de un cierre) que si
   necesitan ver el efecto de esas mismas partidas. */
const PREFIJO_CIERRE_COSTO='Cierre de costo de ventas al ';
function movimientoCuentaSinCierreCosto(e,cta,desde,hasta){
  let debe=0,haber=0;
  (e.partidas||[]).forEach(p=>{
    if(desde&&p.fecha<desde) return;
    if(hasta&&p.fecha>hasta) return;
    if((p.concepto||'').startsWith(PREFIJO_CIERRE_COSTO)) return;
    p.lineas.forEach(l=>{ if(l.cta===cta){ debe+=(+l.debe||0); haber+=(+l.haber||0); } });
  });
  return {debe:r2(debe),haber:r2(haber)};
}
/* El Balance, el Libro de Inventarios y el Libro de Estados Financieros
   suman al Patrimonio la utilidad del ejercicio en curso, recalculada en
   vivo — así el Balance cuadra sin depender de que alguien haga el cierre a
   tiempo. Pero si el ejercicio que se está mirando YA se cerró con "Cierre
   de libros", ese resultado ya está adentro de las cuentas reales de
   Patrimonio (Capital o Utilidades Retenidas) — sumarlo de nuevo acá lo
   contaría dos veces. Por eso, para un ejercicio ya cerrado, esto devuelve 0:
   la utilidad real ya vive en el saldo de Patrimonio, no hace falta
   recalcularla aparte. */
/* Antes solo miraba el ejercicio de trabajo (e.ejercicio), sin importar la
   fecha de corte, y si un año anterior nunca se cerró con "Cierre de libros"
   su resultado no aparecía en ningún lado y el Balance descuadraba. Ahora se
   suman los resultados de TODOS los ejercicios hasta la fecha de corte que
   todavía no tienen cierre de libros, separando el del año del corte de los
   anteriores. */
function anioCerrado(e,anio){
  return (e.partidas||[]).some(p=>(p.concepto||'').startsWith(`${PREFIJO_CIERRE_LIBROS}${anio}`));
}
function utilidadPatrimonioDetalle(e,h){
  const anioH=+h.slice(0,4);
  const fechas=(e.partidas||[]).map(p=>p.fecha).filter(Boolean).sort();
  const primero=fechas.length?+fechas[0].slice(0,4):anioH;
  let actual=0, anteriores=0;
  for(let a=Math.min(primero,anioH);a<=anioH;a++){
    const corte=a===anioH?h:`${a}-12-31`;
    /* Un año con cierre de libros ya tiene su resultado pasado al patrimonio, pero solo desde la fecha de esa partida:
       un balance a una fecha ANTERIOR (p. ej. el 30/06 de un año ya cerrado) todavía lleva la utilidad aparte. */
    const cierre=(e.partidas||[]).find(p=>(p.concepto||'').startsWith(`${PREFIJO_CIERRE_LIBROS}${a}`));
    if(cierre&&cierre.fecha<=corte) continue;
    const v=calcularResultados(e,`${a}-01-01`,corte).netaReal;
    if(a===anioH) actual=r2(actual+v); else anteriores=r2(anteriores+v);
  }
  return {actual,anteriores,total:r2(actual+anteriores)};
}
function utilidadPatrimonioSinDuplicar(e,h){ return utilidadPatrimonioDetalle(e,h).total; }
/* Filas HTML de la utilidad que se suma al patrimonio (el año del corte y,
   si hay, ejercicios anteriores sin cierre de libros). */
function filasUtilidadPatrimonio(e,h){
  const u=utilidadPatrimonioDetalle(e,h);
  return (u.anteriores?`<tr><td style="padding-left:26px">${u.anteriores<0?'Pérdidas':'Utilidades'} de ejercicios anteriores sin cierre de libros</td><td class="num">${Q(u.anteriores)}</td></tr>`:'')
    +`<tr><td style="padding-left:26px">${u.actual<0?'Pérdida':'Utilidad'} del ejercicio en curso</td><td class="num">${Q(u.actual)}</td></tr>`;
}

/* Partidas que LIQUIDAN impuestos (pagos o compensaciones de IVA, pagos del
   ISR mensual, devoluciones de crédito fiscal). No son operaciones del
   período: si se dejaran en el cálculo, el pago de enero —fechado en
   febrero— restaría del débito y del crédito de febrero y se pagaría de menos. */
const RE_LIQ_IVA=/^(Pago de IVA del |Compensación de IVA del |Solicitud de devolución de crédito fiscal IVA|Devolución de crédito fiscal IVA recibida|Cierre fiscal total \d{4} — (compensación|pago) de IVA)/;
const RE_LIQ_ISR=/^(Pago de ISR|Pago de IVA — Régimen de Pequeño|Pago del impuesto único)/;
const esLiquidacionIVA=p=>!!p.liqIVA||RE_LIQ_IVA.test(p.concepto||'');
const esLiquidacionISR=p=>!!p.liqISR||RE_LIQ_ISR.test(p.concepto||'');
/* Movimientos de un rango SIN las partidas de liquidación de impuestos ni el cierre de libros. */
function movimientosOperativos(e,desde,hasta){
  const m={};
  (e.partidas||[]).forEach(p=>{
    if(desde&&p.fecha<desde) return;
    if(hasta&&p.fecha>hasta) return;
    if((p.concepto||'').startsWith(PREFIJO_CIERRE_LIBROS)) return;
    if(esLiquidacionIVA(p)||esLiquidacionISR(p)) return;
    p.lineas.forEach(l=>{
      if(!m[l.cta]) m[l.cta]={debe:0,haber:0};
      m[l.cta].debe+=(+l.debe||0); m[l.cta].haber+=(+l.haber||0);
    });
  });
  return m;
}
/* IVA de un período: débito y crédito de las operaciones del período, más el
   remanente de crédito fiscal que viene de antes (Art. 17, Ley del IVA). El
   remanente se saca del saldo REAL de la cuenta de crédito fiscal, menos el
   crédito de las operaciones que todavía no se han liquidado (las de este
   período en adelante). */
function ivaDelPeriodo(e,desde,hasta){
  const mov=movimientosOperativos(e,desde,hasta);
  const debito=r2((mov['2.1.04']||{haber:0}).haber-(mov['2.1.04']||{debe:0}).debe);
  const credito=r2((mov['1.1.09']||{debe:0}).debe-(mov['1.1.09']||{haber:0}).haber);
  const movFuturo=movimientosOperativos(e,desde,null);
  const saldoCredito=r2(saldoNaturalEn(e,'1.1.09',movimientos(null,null)));
  const creditoPendiente=r2((movFuturo['1.1.09']||{debe:0}).debe-(movFuturo['1.1.09']||{haber:0}).haber);
  const remanente=r2(Math.max(0,saldoCredito-creditoPendiente));
  const saldoDebito=r2(saldoNaturalEn(e,'2.1.04',movimientos(null,null)));
  const debitoPendiente=r2((movFuturo['2.1.04']||{haber:0}).haber-(movFuturo['2.1.04']||{debe:0}).debe);
  const debitoAtrasado=r2(Math.max(0,saldoDebito-debitoPendiente));
  const neto=r2(debito-credito-remanente);
  /* Retenciones de IVA que te hicieron tus clientes (constancias) todavía sin
     aplicar hasta el final del período: se restan del IVA a pagar. */
  const retencionesIVA=r2(Math.max(0,saldoNaturalEn(e,'1.1.19',movimientos(null,hasta))));
  return {debito,credito,remanente,neto,debitoAtrasado,retencionesIVA};
}
function saldoNaturalEn(e,cta,mov){
  const c=e.cuentas.find(x=>x.c===cta); if(!c) return 0;
  const m=mov[cta]||{debe:0,haber:0};
  return r2(NATURAL_DEUDORA(c.t) ? m.debe-m.haber : m.haber-m.debe);
}
function movimientos(desde,hasta,excluirCierres){
  const e=emp(); if(!e) return {};
  const m={};
  e.partidas.forEach(p=>{
    if(desde && p.fecha<desde) return;
    if(hasta && p.fecha>hasta) return;
    if(excluirCierres && (p.concepto||'').startsWith(PREFIJO_CIERRE_LIBROS)) return;
    p.lineas.forEach(l=>{
      if(!m[l.cta]) m[l.cta]={debe:0,haber:0};
      m[l.cta].debe+=(+l.debe||0);
      m[l.cta].haber+=(+l.haber||0);
    });
  });
  return m;
}
/* saldo con signo natural positivo */
function saldoNatural(cta,mov){
  const e=emp(); const c=e.cuentas.find(x=>x.c===cta); if(!c) return 0;
  const m=mov[cta]||{debe:0,haber:0};
  return r2(NATURAL_DEUDORA(c.t) ? m.debe-m.haber : m.haber-m.debe);
}
function totalTipo(tipos,mov){
  const e=emp(); let s=0;
  e.cuentas.filter(c=>c.d&&tipos.includes(c.t)).forEach(c=>s+=saldoNatural(c.c,mov));
  return r2(s);
}
function utilidad(mov){
  return r2(totalTipo(['ingreso'],mov)-totalTipo(['costo'],mov)-totalTipo(['gasto'],mov));
}

/* Una empresa puede cambiar de régimen a mitad de año, así que ningún cálculo
   puede asumir que el régimen de HOY aplicó siempre. e.historialRegimen guarda
   cada cambio con la fecha en que entró en vigencia; e.regimen se mantiene
   sincronizado con el más reciente, para no tener que tocar el resto del
   código que ya lo usa como "el régimen actual". */
function regimenEn(e,fecha){
  const historial=e.historialRegimen;
  if(!historial||!historial.length) return e.regimen;
  const vigentes=historial.filter(h=>h.vigenteDesde<=fecha).sort((a,b)=>b.vigenteDesde.localeCompare(a.vigenteDesde));
  return vigentes.length ? vigentes[0].regimen : historial[0].regimen;
}
/* Desde cuándo rige, dentro de [desde, hasta], el régimen vigente en "hasta". Si la empresa cambió de régimen a
   mitad del período (p. ej. de Pequeño Contribuyente a General el 1 de julio), devuelve la fecha del cambio: el ISR
   sobre utilidades solo grava lo ganado desde que está inscrita en ese régimen. Si no hubo cambio, devuelve desde. */
function inicioRegimenEn(e,desde,hasta){
  const h=(e.historialRegimen||[]).filter(x=>x.vigenteDesde<=hasta).sort((a,b)=>b.vigenteDesde.localeCompare(a.vigenteDesde))[0];
  return h&&h.vigenteDesde>desde?h.vigenteDesde:desde;
}
function sincronizarRegimenActual(e){
  const historial=e.historialRegimen;
  if(historial&&historial.length) e.regimen=regimenEn(e,hoy());
}

