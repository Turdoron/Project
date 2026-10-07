/* ============ FLUJO DE EFECTIVO — por variación de saldos (método indirecto simplificado) ============ */
/* No parte de estimar categorías a ojo: usa la identidad contable de la
   partida doble. Cada partida cuadra siempre (debe=haber), así que la suma
   de TODOS los movimientos de una cuenta que no sea Caja/Bancos, con el
   signo invertido, es exactamente el efecto que tuvo esa cuenta sobre el
   efectivo — sin importar si el otro lado de la operación tocó Caja
   directamente o pasó por Clientes, Proveedores, etc. primero. Lo único que
   sí es una simplificación real: como el catálogo no separa "activo fijo"
   de circulante, todo activo que no sea de los operativos conocidos
   (Clientes, Inventarios, IVA, etc.) se clasifica como inversión — puede
   que alguna cuenta puntual no encaje ahí para tu caso. */
const CUENTAS_OPERATIVAS_FLUJO=['1.1.04','1.1.05','1.1.06','1.1.07','1.1.08','1.1.09','1.1.10','1.1.11',
  '1.1.12','1.1.13','1.1.14','1.1.15','2.1.01','2.1.02','2.1.03','2.1.04','2.1.05','2.1.06','2.1.07',
  '2.1.08','2.1.09','2.1.10','2.1.11','2.1.12','2.1.13','2.1.14','2.1.15','2.1.16'];
function claseFlujo(c){
  /* Aportes de capital y lo que los socios deben de su suscripción: financiamiento. */
  if(c.c.startsWith('3.')||c.c==='1.1.12') return 'financiamiento';
  /* Préstamos y documentos financieros: financiamiento (antes caían en operación). */
  if(c.t==='pasivo' && (c.c==='2.1.17'||c.c==='2.2.01'||/pr[ée]stamo|financiamiento|hipoteca/i.test(c.n))) return 'financiamiento';
  /* Depreciación y amortización acumuladas no son inversión: son el ajuste
     que no movió efectivo y compensa el gasto de depreciación (operación). */
  if(c.t==='activo' && /depreciaci|amortizaci/i.test(c.n)) return 'operacion';
  if(CUENTAS_OPERATIVAS_FLUJO.includes(c.c)) return 'operacion';
  if(c.t==='ingreso'||c.t==='gasto'||c.t==='costo') return 'operacion';
  /* Todo el activo corriente (1.1.x) es capital de trabajo: operación. */
  if(c.t==='activo' && c.c.startsWith('1.1.')) return 'operacion';
  if(c.t==='activo') return 'inversion';   // activo no corriente: propiedad, planta y equipo, inversiones
  return 'operacion';
}
function flujoEfectivo(e,desde,hasta){
  const mov=movimientos(desde,hasta,true);
  const cuentasCaja=cuentasCajaBanco(e).map(c=>c.c);
  const buckets={operacion:0,inversion:0,financiamiento:0};
  const detalle={operacion:[],inversion:[],financiamiento:[]};
  e.cuentas.filter(c=>c.d&&!cuentasCaja.includes(c.c)).forEach(c=>{
    const m=mov[c.c]; if(!m) return;
    const impactoCaja=r2((m.haber||0)-(m.debe||0));   // efecto opuesto al movimiento propio de la cuenta
    if(!impactoCaja) return;
    const clase=claseFlujo(c);
    buckets[clase]=r2(buckets[clase]+impactoCaja);
    detalle[clase].push({cuenta:c.c,nombre:c.n,monto:impactoCaja});
  });
  const saldoInicial=r2(cuentasCaja.reduce((s,cta)=>s+saldoCuentaAntesDe(e,cta,desde),0));
  const cambioNeto=r2(buckets.operacion+buckets.inversion+buckets.financiamiento);
  const saldoFinal=r2(saldoInicial+cambioNeto);
  return {buckets,detalle,saldoInicial,cambioNeto,saldoFinal};
}

VISTAS.flujoEfectivo=()=>{
  const e=emp();
  const d=filtros.desdeFlujo||`${e.ejercicio}-01-01`, h=filtros.hastaFlujo||`${e.ejercicio}-12-31`;
  const f=flujoEfectivo(e,d,h);
  const seccion=(titulo,clave)=>{
    const items=f.detalle[clave];
    if(!items.length) return `<tr class="grupo-cta"><td colspan="2">${titulo}</td></tr>
      <tr><td style="padding-left:26px;color:var(--tinta-suave)">Sin movimiento</td><td></td></tr>`;
    return `<tr class="grupo-cta"><td colspan="2">${titulo}</td></tr>`
      + items.map(x=>`<tr><td style="padding-left:26px">${esc(x.nombre)}</td><td class="num">${Q(x.monto)}</td></tr>`).join('')
      + `<tr><td style="padding-left:26px"><em>Efectivo neto de ${titulo.toLowerCase()}</em></td><td class="num"><em>${Q(f.buckets[clave])}</em></td></tr>`;
  };
  return cab('Flujo de efectivo',`Del ${fFecha(d)} al ${fFecha(h)} · método indirecto (variación de saldos) · cifras en quetzales`,
    `<button class="btn" data-accion="pdfFlujoEfectivo">Descargar PDF</button>`)
  + `<div class="barra">
      <div class="campo"><label>Desde</label><input type="date" data-filtro="desdeFlujo" value="${d}"></div>
      <div class="campo"><label>Hasta</label><input type="date" data-filtro="hastaFlujo" value="${h}"></div>
    </div>
    <div class="aviso">Clasificación: activo corriente (1.1), resultados, depreciación acumulada y pasivos comerciales →
      operación; activo no corriente (1.2) → inversión; préstamos, capital y aportes de socios → financiamiento.
      Revisá que te haga sentido si agregaste cuentas propias al catálogo.</div>
    <table><tbody>
      ${seccion('Actividades de operación','operacion')}
      ${seccion('Actividades de inversión','inversion')}
      ${seccion('Actividades de financiamiento','financiamiento')}
      <tr class="total"><td>Aumento (disminución) neto de efectivo</td><td class="num">${Q(f.cambioNeto)}</td></tr>
      <tr><td style="padding-left:26px">Efectivo al inicio del período</td><td class="num">${Q(f.saldoInicial)}</td></tr>
      <tr class="total"><td>Efectivo al final del período</td><td class="num">${Q(f.saldoFinal)}</td></tr>
    </tbody></table>`;
};

/* ============ LIBRO DE ESTADOS FINANCIEROS — Art. 368 Código de Comercio ============ */
/* Los cuatro estados bajo un solo período, para la presentación formal que
   exige la ley. Para el trabajo del día a día —como ajustar el inventario
   final del costo de ventas— seguís usando cada pantalla suelta; esta es la
   vista de conjunto para imprimir o entregar. */
VISTAS.estadosFinancieros=()=>{
  const e=emp();
  const d=filtros.desdeEF||`${e.ejercicio}-01-01`, h=filtros.hastaEF||`${e.ejercicio}-12-31`;
  const R=calcularResultados(e,d,h);

  const movBal=movimientos(null,h);
  const bloqueB=tipo=>{
    let s=0,f='';
    e.cuentas.filter(c=>c.d&&c.t===tipo).forEach(c=>{
      const v=saldoNatural(c.c,movBal); if(!v) return; s+=v;
      f+=`<tr><td style="padding-left:26px">${esc(c.n)}</td><td class="num">${Q(v)}</td></tr>`;
    });
    return {html:f,total:r2(s)};
  };
  const act=bloqueB('activo'), pas=bloqueB('pasivo'), patr=bloqueB('patrimonio');
  /* La utilidad acumulada del balance tiene que coincidir con la del Estado
     de Resultados de todo el ejercicio hasta esta fecha de corte — mismo
     motivo que en el Balance General suelto. */
  const utilAcum=utilidadPatrimonioSinDuplicar(e,h);

  const f=flujoEfectivo(e,d,h);

  const patrInicial=r2(e.cuentas.filter(c=>c.d&&c.t==='patrimonio').reduce((s,c)=>s+saldoCuentaAntesDe(e,c.c,d),0));
  const aumentosPeriodo=r2(e.cuentas.filter(c=>c.d&&c.t==='patrimonio')
    .reduce((s,c)=>{const m=R.mov[c.c]||{debe:0,haber:0};return s+((m.haber||0)-(m.debe||0));},0));
  const patrFinal=r2(patrInicial+aumentosPeriodo+R.netaReal);

  return cab('Libro de Estados Financieros',`Del ${fFecha(d)} al ${fFecha(h)} · cifras en quetzales`,
    `<button class="btn" data-accion="pdfEstadosFinancieros">Descargar libro completo</button>`)
  + `<div class="barra">
      <div class="campo"><label>Desde</label><input type="date" data-filtro="desdeEF" value="${d}"></div>
      <div class="campo"><label>Hasta</label><input type="date" data-filtro="hastaEF" value="${h}"></div>
    </div>
    <div class="aviso">Esta es la vista de conjunto para imprimir o entregar. Para ajustar el inventario final
      del costo de ventas, o ver el detalle línea por línea de cada cuenta, usá las pantallas de Estado de
      resultados, Balance general o Flujo de efectivo por separado — ahí sí se edita.</div>

    <h3 style="color:var(--verde);margin:24px 0 8px">1. Estado de Resultados <button class="btn mini sec" style="margin-left:10px;vertical-align:middle" data-accion="pdfEstadosFinancieros" data-solo="resultados">Descargar solo este</button></h3>
    <table><tbody>
      <tr><td>Ingresos</td><td class="num">${Q(R.ingresos)}</td></tr>
      ${filasAHtml(filasCostoVentas(R))}
      ${R.otrosCostos?`<tr><td style="padding-left:26px">Otros costos (fletes, compras de servicios)</td><td class="num">${Q(R.otrosCostos)}</td></tr>`:''}
      <tr class="total"><td>${R.bruta<0?'Pérdida bruta':'Utilidad bruta'}</td><td class="num">${Q(R.bruta)}</td></tr>
      <tr><td>Gastos de operación (venta, administración, financieros)</td><td class="num">${Q(R.gastos)}</td></tr>
      ${filasAHtml(filasConciliacionISR(R))}
      ${filaISRTexto(R)?`<tr><td>${filaISRTexto(R)}</td><td class="num">${Q(R.isr)}</td></tr>`:''}
      <tr class="total"><td>${R.neta<0?'Pérdida':'Utilidad'} del período</td><td class="num">${Q(R.neta)}</td></tr>
    </tbody></table>

    <h3 style="color:var(--verde);margin:24px 0 8px">2. Balance General <span style="font-weight:400;font-size:14px;color:var(--tinta-suave)">(al ${fFecha(h)})</span> <button class="btn mini sec" style="margin-left:10px;vertical-align:middle" data-accion="pdfEstadosFinancieros" data-solo="balance">Descargar solo este</button></h3>
    <table><tbody>
      <tr class="grupo-cta"><td colspan="2">Activo</td></tr>${act.html}
      <tr class="total"><td>Total activo</td><td class="num">${Q(act.total)}</td></tr>
      <tr class="grupo-cta"><td colspan="2">Pasivo</td></tr>${pas.html}
      <tr class="total"><td>Total pasivo</td><td class="num">${Q(pas.total)}</td></tr>
      <tr class="grupo-cta"><td colspan="2">Patrimonio</td></tr>${patr.html}
      ${filasUtilidadPatrimonio(e,h)}
      <tr class="total"><td>Total patrimonio</td><td class="num">${Q(r2(patr.total+utilAcum))}</td></tr>
      <tr class="total"><td>Total pasivo + patrimonio</td><td class="num">${Q(r2(pas.total+patr.total+utilAcum))}</td></tr>
    </tbody></table>

    <h3 style="color:var(--verde);margin:24px 0 8px">3. Estado de Flujo de Efectivo <button class="btn mini sec" style="margin-left:10px;vertical-align:middle" data-accion="pdfEstadosFinancieros" data-solo="flujo">Descargar solo este</button></h3>
    <table><tbody>
      <tr><td>Actividades de operación</td><td class="num">${Q(f.buckets.operacion)}</td></tr>
      <tr><td>Actividades de inversión</td><td class="num">${Q(f.buckets.inversion)}</td></tr>
      <tr><td>Actividades de financiamiento</td><td class="num">${Q(f.buckets.financiamiento)}</td></tr>
      <tr class="total"><td>Aumento (disminución) neto de efectivo</td><td class="num">${Q(f.cambioNeto)}</td></tr>
      <tr><td style="padding-left:26px">Efectivo al inicio del período</td><td class="num">${Q(f.saldoInicial)}</td></tr>
      <tr class="total"><td>Efectivo al final del período</td><td class="num">${Q(f.saldoFinal)}</td></tr>
    </tbody></table>

    <h3 style="color:var(--verde);margin:24px 0 8px">4. Estado de Cambios en el Patrimonio <button class="btn mini sec" style="margin-left:10px;vertical-align:middle" data-accion="pdfEstadosFinancieros" data-solo="patrimonio">Descargar solo este</button></h3>
    <table><tbody>
      <tr><td>Patrimonio al inicio del período</td><td class="num">${Q(patrInicial)}</td></tr>
      <tr><td>Aportaciones y aumentos de capital del período</td><td class="num">${Q(aumentosPeriodo)}</td></tr>
      <tr><td>${R.neta<0?'Pérdida':'Utilidad'} del período</td><td class="num">${Q(R.neta)}</td></tr>
      <tr class="total"><td>Patrimonio al final del período</td><td class="num">${Q(patrFinal)}</td></tr>
    </tbody></table>
    <div class="aviso">Este resumen del patrimonio es simplificado: junta todas las cuentas de capital en un
      solo total, no columna por columna (capital social, reservas, utilidades retenidas por separado). Para
      el detalle completo de cada cuenta de patrimonio, revisá el Balance General o el Libro de Inventarios.</div>

    <h3 style="color:var(--verde);margin:24px 0 8px">Notas a los Estados Financieros</h3>
    <p style="margin:0 0 10px;font-size:13px;color:var(--tinta-suave)">Texto libre — aclaraciones, políticas
      contables, o cualquier cosa que quieras que quede junto al reporte cuando lo descargues en PDF. Se guarda
      por empresa, no por período: la misma nota aparece sin importar qué fechas tengas filtradas arriba.</p>
    <textarea id="notaEF" rows="6"
      style="width:100%;max-width:640px;padding:10px;border:1px solid var(--borde);border-radius:8px;
      font-family:inherit;font-size:14px;resize:vertical"
      placeholder="Ejemplo: Los estados financieros se presentan bajo la base contable de acumulación (devengado). El costo de ventas del período está cerrado con conteo físico al corte."
      >${esc(e.notaEstadosFinancieros||'')}</textarea><br>
    <button class="btn sec" style="margin-top:8px" data-accion="guardarNotaEF">Guardar nota</button>`;
};

/* ============ TABLERO FISCAL ============ */
/* Bases legales: IVA Dto. 27-92 · ISR Dto. 10-2012 · Regímenes primario y
   pecuario Dto. 31-2024 y su reglamento AG 54-2026. */
const MESES_NOM=['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const SALARIO_MINIMO=4002.28;            // sector no agrícola, 2026 — se puede ajustar por empresa

