/* ============ PLANILLAS Y SALARIOS ============ */
/* Tasas verificadas: Acuerdo 1124 IGSS (4.83% laboral, 10.67% patronal),
   Ley del IRTRA Dto. 1528 (1% patronal), INTECAP Dto. 17-72 (1% patronal).
   La bonificación incentivo (Dto. 78-89, Q250 mensual) NO entra en la base de
   ninguna de estas cuotas — solo el salario ordinario y extraordinario las genera. */
const IGSS_LABORAL=0.0483, IGSS_PATRONAL=0.1067, INTECAP_PCT=0.01, IRTRA_PCT=0.01;
const BONIFICACION_INCENTIVO=250;
const RECARGO_HORA_EXTRA=1.5;   // Código de Trabajo, Art. 121: mínimo tiempo y medio
const RECARGO_HORA_EXTRA_DOMINGO=2;   // Trabajo en el día de descanso semanal (domingo) o de asueto

/* ISR sobre rentas del trabajo — Dto. 10-2012, reformado por el Dto. 13-2026.
   Deducción personal anual (sin necesidad de facturas):
   · hasta 2025: Q48,000.
   · 2026: Q51,024 (Q48,000 + Q3,024 extraordinaria del artículo transitorio),
     con la que el salario mínimo queda sin retención en 2026.
   · desde 2027: equivale a 12 salarios mínimos mensuales de actividades no
     agrícolas, INCLUIDA la bonificación incentivo, tomando el más alto del país
     (circunscripción 1). La SAT publica el valor cada año: si ya lo publicó, se
     escribe en Configuración y manda sobre el cálculo.
   La bonificación incentivo SÍ paga ISR, aunque no pague IGSS. */
function deduccionPersonalAnual(anio,e){
  e=e||emp();
  anio=+anio||+hoy().slice(0,4);
  const publicada=e&&e.deduccionPersonalSAT&&+e.deduccionPersonalSAT[anio];
  if(publicada>0) return r2(publicada);
  if(anio<=2025) return 48000;
  if(anio===2026) return 51024;
  const sm=(e&&e.salarioMinimo)||SALARIO_MINIMO;
  return r2(12*(sm+BONIFICACION_INCENTIVO));
}
function isrTablaTrabajo(rentaImponible){
  return rentaImponible<=300000 ? r2(rentaImponible*0.05) : r2(300000*0.05+(rentaImponible-300000)*0.07);
}
function calcularISRMensual(salarioBaseMensual,anio){
  const rentaBrutaAnual=r2((salarioBaseMensual+BONIFICACION_INCENTIVO)*12);
  const igssDeducibleAnual=r2(salarioBaseMensual*12*IGSS_LABORAL);
  const rentaImponible=Math.max(0,r2(rentaBrutaAnual-igssDeducibleAnual-deduccionPersonalAnual(anio)));
  const isrAnual=isrTablaTrabajo(rentaImponible);
  /* Sin r2() acá: esto se pasa a prorratear(), que todavía lo va a dividir
     entre 30 y multiplicar por 7 o 15 si el período es semanal o quincenal —
     redondear antes de esa cuenta es el mismo error que ya corregimos en
     inventario y en planillas. prorratear() ya redondea el monto final. */
  return isrAnual/12;
}

/* Descuentos y cargos sobre lo que se paga al retirarse un empleado. La indemnización, el aguinaldo y
   el Bono 14 están exentos de IGSS y de ISR; las vacaciones pagadas son salario, así que sí llevan
   IGSS laboral (4.83%), cuotas patronales (IGSS, INTECAP, IRTRA) e ISR. El ISR de las vacaciones es
   lo que sube el impuesto anual del empleado al sumar ese pago a su renta de un año (misma tabla
   y deducciones que la planilla). Es una estimación: el cálculo definitivo es el de la retención anual. */
function isrAnualTrabajo(brutoAnual,igssAnual,anio){
  const imp=Math.max(0,r2(brutoAnual-igssAnual-deduccionPersonalAnual(anio)));
  return isrTablaTrabajo(imp);
}
function cargosSobreVacaciones(salarioBase,monto,anio){
  monto=r2(Math.max(0,+monto||0));
  const brutoBase=r2((salarioBase+BONIFICACION_INCENTIVO)*12), igssBase=r2(salarioBase*12*IGSS_LABORAL);
  const igssLaboral=r2(monto*IGSS_LABORAL);
  const isr=r2(Math.max(0,isrAnualTrabajo(brutoBase+monto,igssBase+igssLaboral,anio)-isrAnualTrabajo(brutoBase,igssBase,anio)));
  return {igssLaboral,isr,
    igssPatronal:r2(monto*IGSS_PATRONAL),intecap:r2(monto*INTECAP_PCT),irtra:r2(monto*IRTRA_PCT)};
}
/* Prorratea un monto mensual al período de pago, sobre la base de un mes de 30
   días — el criterio más común en Guatemala para planillas semanales/quincenales. */
function prorratear(montoMensual,periodo){
  const diario=montoMensual/30;
  if(periodo==='semanal') return r2(diario*7);
  if(periodo==='quincenal') return r2(diario*15);
  return r2(montoMensual);   // mensual: completo
}

/* Salario diario "legal": se anualiza el salario mensual y se divide entre 365,
   no entre 30 — es el criterio correcto en Guatemala para prestaciones,
   ausencias y horas extra, porque un mes real no son exactamente 30 días.
   La hora es ese salario diario entre 8 (jornada ordinaria). */
function salarioDiarioLegal(salarioBase){
  /* Sin r2() acá a propósito, mismo motivo que el costo de inventario: esto
     es una TASA que se multiplica después (por horas, por días de
     vacaciones) — si se redondea acá, el redondeo se arrastra multiplicado.
     Se redondea recién en el monto final de cada cálculo que lo usa. */
  return (salarioBase*12)/365;
}

function diasEntre(desde,hasta){ return Math.round((new Date(hasta)-new Date(desde))/86400000)+1; }
function diasNominalesPeriodo(periodo){ return periodo==='semanal'?7:periodo==='quincenal'?15:30; }

/* Provisión de prestaciones laborales, por empleado, en su ley:
   Aguinaldo y Bono 14 = un sueldo al año (1/12 por mes); Vacaciones = 15 días
   hábiles al año, que equivalen a la MITAD del sueldo base mensual (así se
   paga: no se multiplican días de calendario por el salario diario);
   Indemnización = un sueldo por año trabajado sobre el promedio de 14 sueldos
   al año —el sueldo más la parte de aguinaldo y Bono 14—, es decir
   (sueldo × 14 ÷ 12) por año. Solo se paga de verdad si hay despido
   injustificado, pero contablemente se va reconociendo mes a mes. Si la fecha de ingreso del empleado cae DENTRO de este período
   de planilla, se prorratea solo desde ese día — así lo exige la ley tanto
   para el Aguinaldo (Dto. 76-78) como para el Bono 14 (Dto. 42-92). */
function provisionesPrestaciones(salarioBase,periodo,fechaIngreso,desdePeriodo,hastaPeriodo){
  let dias=diasNominalesPeriodo(periodo);
  if(fechaIngreso && desdePeriodo && hastaPeriodo){
    if(fechaIngreso>hastaPeriodo) dias=0;                              // todavía no había ingresado
    else if(fechaIngreso>desdePeriodo) dias=Math.max(0,diasEntre(fechaIngreso,hastaPeriodo));  // ingresó a mitad del período
  }
  const factor=dias/30;
  const vacacionesAnual=r2(salarioBase/2);
  return {
    aguinaldo: r2(salarioBase/12*factor),
    bono14: r2(salarioBase/12*factor),
    vacaciones: r2(vacacionesAnual/12*factor),
    indemnizacion: r2(salarioBase*14/12/12*factor),
  };
}

function calcularPlanillaEmpleado(emp,periodo,extras,fechasPeriodo){
  extras=extras||{}; fechasPeriodo=fechasPeriodo||{};
  const diasFalta=+extras.diasFalta||0, horasExtra=+extras.horasExtra||0, bonoAdicional=r2(+extras.bonoAdicional||0);
  const horasMenos=+extras.horasMenos||0, horasExtraDomingo=+extras.horasExtraDomingo||0;

  const salarioDiario=salarioDiarioLegal(emp.salarioBase);
  /* Descuento simple: los días que se indiquen, tal cual. Si corresponde
     descontar también el séptimo día por la falta (Art. 126 del Código de
     Trabajo), se captura a mano sumándolo a "días de falta" — el sistema no
     lo agrega solo, porque no sabe en qué semana cayó cada falta. */
  const descuentoFaltas=r2(salarioDiario*diasFalta);
  const salarioPeriodo=r2(Math.max(0,prorratear(emp.salarioBase,periodo)-descuentoFaltas));

  const horaOrdinaria=salarioDiario/8;
  const montoHorasExtra=r2(horaOrdinaria*RECARGO_HORA_EXTRA*horasExtra);
  /* Hora trabajada en domingo o día de descanso semanal: el día ya está
     pagado dentro del sueldo mensual (Art. 126), y encima el tiempo
     trabajado se paga aparte, con recargo distinto al de la hora extra
     entre semana. */
  const montoHorasExtraDomingo=r2(horaOrdinaria*RECARGO_HORA_EXTRA_DOMINGO*horasExtraDomingo);
  /* Horas de menos: tiempo que el empleado quedó debiendo (llegadas tarde,
     salidas antes). Se descuentan al valor normal de la hora, sin el recargo
     de tiempo y medio — no son horas extra, son lo contrario. */
  const descuentoHorasMenos=r2(horaOrdinaria*horasMenos);

  /* La bonificación incentivo se reduce en la misma proporción que el tiempo
     no trabajado —días de falta y horas de menos—, porque compensa la
     dedicación completa al puesto. Las horas extra NO la aumentan ni la
     afectan: es un mínimo fijo, no un pago por hora. */
  const bonifDiaria=BONIFICACION_INCENTIVO/30;
  const bonifHora=bonifDiaria/8;
  const descuentoBonif=r2(bonifDiaria*diasFalta+bonifHora*horasMenos);
  const bonifPeriodo=r2(Math.max(0,prorratear(BONIFICACION_INCENTIVO,periodo)-descuentoBonif));

  /* Horas extra (entre semana y domingo) y bonificación adicional SÍ pagan
     IGSS, INTECAP e IRTRA — son salario ordinario y extraordinario. La
     bonificación incentivo, no. Las horas de menos restan de la misma base,
     porque es menos salario devengado, no un concepto aparte. */
  const baseIGSS=r2(Math.max(0,salarioPeriodo+montoHorasExtra+montoHorasExtraDomingo+bonoAdicional-descuentoHorasMenos));
  const igssLaboral=r2(baseIGSS*IGSS_LABORAL);
  const igssPatronal=r2(baseIGSS*IGSS_PATRONAL);
  const intecap=r2(baseIGSS*INTECAP_PCT);
  const irtra=r2(baseIGSS*IRTRA_PCT);

  const isr=prorratear(calcularISRMensual(emp.salarioBase,(fechasPeriodo.hasta||hoy()).slice(0,4)),periodo);
  const prestaciones=provisionesPrestaciones(emp.salarioBase,periodo,emp.fechaIngreso,fechasPeriodo.desde,fechasPeriodo.hasta);

  const liquido=r2(Math.max(0,salarioPeriodo+montoHorasExtra+montoHorasExtraDomingo+bonoAdicional-descuentoHorasMenos+bonifPeriodo-igssLaboral-isr));

  return {empleadoId:emp.id,nombre:emp.nombre,salarioBase:emp.salarioBase,
    diasFalta,horasExtra,horasExtraDomingo,bonoAdicional,horasMenos,descuentoFaltas,descuentoHorasMenos,descuentoBonif,
    salarioPeriodo,montoHorasExtra,montoHorasExtraDomingo,bonifPeriodo,
    igssLaboral,igssPatronal,intecap,irtra,isr,liquido,
    prestaciones};
}

/* Opcional Simplificado: 5% sobre los primeros Q30,000 del mes, 7% del excedente. */
const isrSimplificado=b=> b<=30000 ? r2(b*0.05) : r2(1500+(b-30000)*0.07);

/* El tramo del 5%/7% es MENSUAL ACUMULADO, no por factura ni por día: hay que
   saber cuánto se vendió antes en el mes para calcular el impuesto marginal
   de lo nuevo. Se compara el impuesto sobre "lo acumulado hasta ahora" contra
   el impuesto sobre "lo acumulado antes", y la diferencia es lo que corresponde
   a esta venta. */
function previoVentasAntesDe(e,corte){
  const mesIni=corte.slice(0,7)+'-01';
  return r2((e.documentos||[]).filter(d=>d.tipo==='venta' && d.fecha>=mesIni && d.fecha<corte)
    .reduce((s,d)=>s+(d.signo||1)*d.base,0));
}
function isrIncrementalPorTramo(previo,ventasNuevas){
  if(!ventasNuevas) return 0;
  return r2(isrSimplificado(r2(previo+ventasNuevas))-isrSimplificado(previo));
}
/* Ventas (con signo, las notas de crédito restan) que caen dentro de un grupo
   ya sea un solo día o un mes completo, según el modo de agrupación elegido. */
function ventasDelGrupo(docs,g,modo){
  return r2(docs.filter(d=>d.tipo==='venta' &&
      (modo==='dia' ? d.fecha===g.fecha : d.fecha && d.fecha.slice(0,7)===g.fecha.slice(0,7)))
    .reduce((s,d)=>s+(d.signo||1)*d.base,0));
}

/* Costo de ventas de un período — misma fórmula que usa el Estado de
   Resultados (inventario inicial + compras de bienes del período − inventario
   final), para que el Tablero y los cierres fiscales no sigan calculando la
   utilidad como si comprar mercadería no costara nada. Si no hay un conteo
   físico registrado justo en esa fecha de corte (lo normal para un mes
   suelto, el conteo real casi siempre es al cierre del año), se usa como
   estimación razonable lo comprado en ese mismo período — no es exacto,
   pero es muchísimo mejor que no restar nada. */
function costoVentasPeriodo(e,desde,hasta,mov){
  /* Si ya existe un inventario final guardado para esta fecha de corte, Y el
     saldo real de la cuenta de Inventarios YA coincide con ese monto, quiere
     decir que alguna partida real ya hizo el cierre — no importa cuál acción
     lo posteó (Cerrar costo de ventas, o el cierre fiscal parcial de un
     trimestre que también lo cierra) ni el texto exacto de su concepto.
     Chequear el saldo real en vez de un texto es más robusto: cualquier
     partida que de verdad deje el inventario en ese número cuenta como un
     cierre real, y no hay que estimar de nuevo con la fórmula — se
     contaría dos veces. */
  const invFinalGuardado=Object.prototype.hasOwnProperty.call(e.inventarioFinal||{},hasta)?r2(e.inventarioFinal[hasta]):null;
  const yaCerrado=invFinalGuardado!==null && r2(saldoNatural('1.1.08',movimientos(null,hasta)))===invFinalGuardado;
  if(yaCerrado) return {costo:0,estimado:false,yaCerrado:true};
  const invInicial=saldoCuentaAntesDe(e,'1.1.08',desde);
  /* Una nota de crédito de un proveedor abona (haber) la cuenta de
     Inventarios, no la debita — si acá solo se mira el debe, la devolución
     nunca se resta del costo estimado, aunque el saldo real de la cuenta sí
     la reste. Por eso hay que usar el movimiento neto (debe menos haber),
     igual que hace saldoNatural con cualquier otra cuenta. Se calcula acá
     con movimientoCuentaSinCierreCosto en vez de leer directo de mov, para
     que un cierre de costo de ventas fechado dentro de este mismo rango
     no se cuente como si fuera una compra negativa. */
  const movInv=movimientoCuentaSinCierreCosto(e,'1.1.08',desde,hasta);
  const comprasBienes=r2((movInv.debe||0)-(movInv.haber||0));
  const tieneFinal=Object.prototype.hasOwnProperty.call(e.inventarioFinal||{},hasta);
  if(tieneFinal) return {costo:r2(invInicial+comprasBienes-r2(e.inventarioFinal[hasta])),estimado:false};
  /* Sin un inventario final real, hay que estimar — pero el kardex ya sabe
     el costo real de lo que salió por venta directa y por consignación
     vendida en este período, así que es una base mucho mejor que "todo lo
     que se compró se vendió" (comprasBienes), que se queda corto o se pasa
     de largo según cuánto haya crecido o bajado la mercadería en existencia.
     Si todavía no hay nada en el kardex —una empresa que recién carga
     facturas sin usar Ventas todavía—, comprasBienes sigue como respaldo,
     mejor una estimación gruesa que ninguna. */
  const salidasKardex=(e.salidasInventario||[]).filter(s=>s.fecha>=desde&&s.fecha<=hasta&&s.motivo!=='produccion'&&s.motivo!=='merma'&&s.motivo!=='faltante')
    .reduce((sum,s)=>sum+(s.costoTotal||0),0);
  const consignVendidas=(e.consignaciones||[]).filter(c=>c.estado==='vendido'&&c.fechaVenta&&c.fechaVenta>=desde&&c.fechaVenta<=hasta)
    .reduce((sum,c)=>sum+(c.costoTotal||0),0);
  const costoKardex=r2(salidasKardex+consignVendidas);
  return {costo:costoKardex>0?costoKardex:comprasBienes,estimado:true,deKardex:costoKardex>0};
}

function mesesDelEjercicio(){
  const e=emp(), a=e.ejercicio, out=[];
  for(let m=1;m<=12;m++){
    const mm=String(m).padStart(2,'0');
    const desde=`${a}-${mm}-01`, hasta=`${a}-${mm}-${new Date(a,m,0).getDate()}`;
    const mov=movimientos(desde,hasta,true);
    /* El IVA del mes sale solo de las operaciones del mes: los pagos y
       compensaciones de meses anteriores no deben restarle nada. */
    const movIva=movimientosOperativos(e,desde,hasta);
    const credito=saldoNatural('1.1.09',movIva), debito=saldoNatural('2.1.04',movIva);
    const ingresos=totalTipo(['ingreso'],mov);
    const regimenMes=regimenEn(e,hasta);   // el que regía ESE mes, no necesariamente el de hoy
    const {costo:costoBienes,estimado}=costoVentasPeriodo(e,desde,hasta,mov);
    const cg=r2(costoBienes+totalTipo(['costo'],mov)+totalTipo(['gasto'],mov));
    const fila={m,mm,nombre:MESES_NOM[m-1],desde,hasta,ingresos,regimen:regimenMes,
      cg, costoEstimado:estimado,
      credito,debito,ivaPagar:r2(debito-credito),utilidad:r2(ingresos-cg),imp:0};
    if(regimenMes==='simplificado') fila.imp=isrSimplificado(ingresos);
    else if(regimenMes==='pequeno')  fila.imp=r2(ingresos*0.05);
    else if(regimenMes==='primario'||regimenMes==='pecuario') fila.imp=r2(ingresos*0.015);
    out.push(fila);
  }
  return out;
}

/* Contenido del Resumen del ejercicio (pantalla de Contabilidad). */
function resumenInicio(e){
  const meses=mesesDelEjercicio();
  const conMov=meses.filter(x=>x.ingresos||x.cg);
  const ingresos=r2(meses.reduce((s,x)=>s+x.ingresos,0));
  const gastos=r2(meses.reduce((s,x)=>s+x.cg,0));
  const utilidad=r2(ingresos-gastos);
  const debito=r2(meses.reduce((s,x)=>s+x.debito,0));
  const credito=r2(meses.reduce((s,x)=>s+x.credito,0));
  const ivaNeto=r2(debito-credito);
  const isrAcum=r2(meses.reduce((s,x)=>s+x.imp,0));
  const abonadoProv=r2((e.pagos||[]).reduce((s,pg)=>s+pg.monto,0));
  const cobradoCli=r2((e.cobros||[]).reduce((s,cb)=>s+cb.monto,0));
  const movAnio=movimientos(`${e.ejercicio}-01-01`,`${e.ejercicio}-12-31`);
  const igssLaboralAcum=r2((movAnio['2.1.07']||{haber:0}).haber||0);
  const igssPatronalAcum=r2((movAnio['2.1.08']||{haber:0}).haber||0);
  const cantEmpleados=(e.empleados||[]).filter(x=>x.activo!==false).length;

  return (()=>{
      /* Aviso automático si algún libro auxiliar dejó de coincidir con la contabilidad. */
      const prob=conciliacionLibros(e,`${e.ejercicio}-01-01`,`${e.ejercicio}-12-31`).filter(f=>!f.ok&&!f.informativo);
      return prob.length?`<div class="aviso malo">${prob.length} libro(s) no coinciden con la contabilidad: ${prob.map(f=>esc(f.nombre.split(' — ')[0])).join(', ')}.
        <button class="btn mini" data-accion="irConciliacion" style="margin-left:8px">Ver conciliación</button></div>`:'';
    })()
  + `<h3 style="color:var(--verde);margin:0 0 10px">Ingresos y gastos del ejercicio</h3>
    <div class="cifras">
      <div class="cifra"><span>Ingresos</span><strong>${Q(ingresos)}</strong></div>
      <div class="cifra"><span>Costos y gastos</span><strong>${Q(gastos)}</strong></div>
      <div class="cifra" style="border-top-color:${utilidad>=0?'var(--verde)':'var(--alerta)'}">
        <span>${utilidad>=0?'Utilidad':'Pérdida'} del ejercicio</span><strong>${Q(Math.abs(utilidad))}</strong></div>
    </div>

    <h3 style="color:var(--verde);margin:22px 0 10px">Resumen fiscal</h3>
    <div class="cifras">
      <div class="cifra" style="border-top-color:${ivaNeto>0?'var(--haber)':'var(--verde)'}">
        <span>${ivaNeto>0?'IVA por pagar':'Remanente de crédito IVA'}</span><strong>${Q(Math.abs(ivaNeto))}</strong></div>
      <div class="cifra"><span>Impuesto del régimen, acumulado</span><strong>${Q(isrAcum)}</strong></div>
    </div>
    <p style="margin:10px 0 0"><button class="btn sec mini" data-accion="irTablero">Ver el tablero fiscal completo</button></p>

    <h3 style="color:var(--verde);margin:22px 0 10px">Cartera</h3>
    <div class="cifras">
      <div class="cifra"><span>Abonado a proveedores</span><strong>${Q(abonadoProv)}</strong></div>
      <div class="cifra"><span>Cobrado a clientes</span><strong>${Q(cobradoCli)}</strong></div>
    </div>
    <p style="margin:10px 0 0"><button class="btn sec mini" data-accion="irProveedores">Ver proveedores</button>
      <button class="btn sec mini" data-accion="irClientes">Ver clientes</button></p>

    <h3 style="color:var(--verde);margin:22px 0 10px">Planillas</h3>
    <div class="cifras">
      <div class="cifra"><span>IGSS laboral retenido</span><strong>${Q(igssLaboralAcum)}</strong></div>
      <div class="cifra"><span>IGSS patronal (+ INTECAP + IRTRA)</span><strong>${Q(igssPatronalAcum)}</strong></div>
      <div class="cifra"><span>Empleados activos</span><strong>${cantEmpleados}</strong></div>
    </div>
    <p style="margin:10px 0 0"><button class="btn sec mini" data-accion="irPlanillas">Ver planillas</button></p>

    ${conMov.length? `<h3 style="color:var(--verde);margin:22px 0 10px">Mes a mes</h3>
      <table><thead><tr><th>Mes</th><th class="num">Ingresos</th><th class="num">Costos y gastos</th>
        <th class="num">Utilidad</th></tr></thead>
      <tbody>${conMov.map(x=>`<tr><td>${x.nombre}</td><td class="num">${Q(x.ingresos)}</td>
        <td class="num">${Q(x.cg)}</td><td class="num">${Q(r2(x.ingresos-x.cg))}</td></tr>`).join('')}</tbody></table>`
      : `<div class="vacio">Todavía no hay movimiento registrado en el ejercicio ${e.ejercicio}.</div>`}`;
}

/* Inicio: las aplicaciones a las que la persona tiene acceso, como el menú de un teléfono. */
VISTAS.home=()=>{
  const e=emp(), u=usuarioActual(), apps=appsVisibles();
  const h=new Date().getHours(), saludo=h<12?'Buenos días':h<19?'Buenas tardes':'Buenas noches';
  const nombre=((u&&u.nombre)||'').trim().split(/\s+/)[0];
  const lanzador=apps.length
    ?`<div class="apps">${apps.map(a=>`<button type="button" class="app-tile" data-app="${a.id}">
        <span class="app-ico" data-app="${a.id}">${iconoApp(a.id)}</span>
        <span class="app-nombre">${esc(a.nombre)}</span><span class="app-desc">${esc(a.desc)}</span></button>`).join('')}</div>`
    :'<div class="vacio">Tu cargo todavía no tiene aplicaciones asignadas. Consultá con el administrador.</div>';
  return cab(`${saludo}${nombre?', '+esc(nombre):''}`,`${esc(e.nombre)} · ejercicio ${e.ejercicio} · ${esc(REGIMENES[e.regimen]||'—')}. Elegí con qué vas a trabajar.`)
    + (puedeVer('vencimientos')?htmlAvisosVencimientos(e,15):'') + lanzador + accesosDirectos();
};
/* Accesos directos del inicio: las pantallas que tienen atajo de teclado (Alt + número),
   solo las que el cargo de la persona y la empresa en uso tienen disponibles. */
function accesosDirectos(){
  const lista=Object.entries(atajosVista()).filter(([,v])=>v!=='home').map(([tecla,v])=>{
    const b=document.querySelector(`nav [data-v="${v}"]`);
    if(!b||b.style.display==='none'||!puedeVer(v)) return null;
    const app=APPS.find(a=>a.id===b.closest('.app-menu')?.dataset.app);
    return {tecla,v,nombre:textoBoton(b),app:app?app.nombre:''};
  }).filter(Boolean);
  if(puedeVentaDirecta()) lista.push({tecla:'V',v:'ventaDirecta',nombre:'Nueva venta directa',app:'Ventas'});
  if(!lista.length) return '';
  return `<h2 class="tit-accesos">Accesos directos</h2>
    <ul class="accesos">${lista.map(x=>`<li><button type="button" class="acceso" data-atajo="${x.v}">
      <span class="acceso-txt"><span class="acceso-nombre">${esc(x.nombre)}</span>${x.app?`<span class="acceso-app">${esc(x.app)}</span>`:''}</span>
      <kbd>Alt+${x.tecla}</kbd></button></li>`).join('')}</ul>
    <p class="accesos-pie">Con el teclado: mantené <kbd>Alt</kbd> y tocá el número. <kbd>Alt+0</kbd> vuelve a este inicio y <kbd>Alt+H</kbd> muestra esta lista en cualquier pantalla.${puedeVentaDirecta()?' <kbd>Alt+V</kbd> abre una venta directa desde donde estés.':''} Se cambian en Administración → Configuración.</p>`;
}
/* Resumen del ejercicio y Tablero fiscal van juntos, en dos pestañas. */
function pestanasResumen(activa){
  const p=(id,txt,acc)=>puedeVer(id)?`<button type="button" class="pestana${activa===id?' on':''}" data-accion="${acc}"${activa===id?' aria-current="page"':''}>${txt}</button>`:'';
  return `<div class="pestanas" role="navigation" aria-label="Resumen y tablero fiscal">${p('resumen','Resumen del ejercicio','irResumen')}${p('tablero','Tablero fiscal','irTablero')}</div>`;
}
/* Resumen del ejercicio: pantalla propia dentro de Contabilidad. */
VISTAS.resumen=()=>{
  const e=emp();
  return pestanasResumen('resumen')+cab('Resumen del ejercicio',`${esc(e.nombre)} · ejercicio ${e.ejercicio} · ${esc(REGIMENES[e.regimen]||'—')}`,
    `<button class="btn" data-accion="irFacturas">Cargar facturas</button>`)+resumenInicio(e);
};

/* Detalle de inventario (Libro de Inventarios): junta las líneas de producto de
   todas las compras de bienes y lo producido, agrupado por descripción, y resta
   las salidas (ventas, consignaciones y materiales usados en producción): es la
   existencia según el kardex, no un conteo físico. Los documentos cargados desde Excel
   no traen detalle de línea, así que su valor se cuenta pero queda aparte, sin
   desglosar por producto. */
/* Método de valuación de inventarios — Art. 41, Dto. 10-2012. Para una
   empresa comercializadora la ley deja elegir entre promedio ponderado y PEPS
   (el costo de producción es para quien fabrica). Una vez adoptado, no puede
   cambiarse sin autorización previa de la SAT; por eso se pregunta al crear
   la empresa y después queda bloqueado. Las empresas que ya existían venían
   trabajando con promedio ponderado: ese es el valor por defecto. */
/* A qué se dedica la empresa. "Productora" fabrica o transforma un bien y habilita el área de
   Producción; no quita nada de lo comercial, así que una empresa que fabrica algunos productos
   y revende otros elige "productora". Las empresas que ya existían eran comercializadoras. */
const TIPOS_ACTIVIDAD={
  comercializadora:'Empresa comercializadora — compra y vende bienes o servicios',
  productora:'Industria productora — fabrica o transforma un bien (también puede revender)'};
const esProductora=e=>!!e&&e.tipoActividad==='productora';
const METODOS_COSTEO={ppp:'Promedio ponderado',peps:'PEPS (primero en entrar, primero en salir)'};
const metodoCosteo=e=>(e&&e.metodoCosteo==='peps')?'peps':'ppp';

/* Capas de compra de un producto, en orden cronológico — cada compra de
   bienes con detalle es una capa con su cantidad y su costo neto de IVA.
   Una nota de crédito (signo negativo) es una devolución al proveedor: se
   descuenta de las capas más recientes, que son las que se compraron último. */
/* Costo de una línea de compra en el kardex: lo mismo que quedó cargado en Inventarios. Sin el IVA
   solo cuando ese IVA se tomó como crédito fiscal (el documento lo separó); en Pequeño Contribuyente,
   Primario y Pecuario no hay crédito fiscal y el IVA es parte del costo. */
function netoItemCompra(d,it){
  if(!((+d.iva||0)>0)) return +it.total||0;
  const ivaItem=(it.impuestos||[]).filter(im=>(im.nombre||'').toUpperCase()==='IVA').reduce((a,im)=>a+(im.monto||0),0);
  return (+it.total||0)-ivaItem;
}
function capasDeCompra(e,producto){
  const capas=[];
  (e.documentos||[]).map((d,i)=>({d,i})).filter(x=>x.d.tipo==='compra'&&x.d.cta==='1.1.08'&&x.d.items&&x.d.items.length)
    .sort((a,b)=>(a.d.fecha<b.d.fecha?-1:a.d.fecha>b.d.fecha?1:a.i-b.i))
    .forEach(({d})=>{
      d.items.filter(it=>it.bs==='B'&&productoDe(e,it.descripcion||'Sin descripción')===producto).forEach(it=>{
        const s=d.signo||1;
        const neto=netoItemCompra(d,it), cant=it.cantidad||0;
        if(s>0){ if(cant>0) capas.push({cantidad:cant,total:neto,fecha:d.fecha}); }
        else{
          let quitar=cant;
          for(let k=capas.length-1;k>=0&&quitar>1e-9;k--){
            const t=Math.min(capas[k].cantidad,quitar), cu=capas[k].total/capas[k].cantidad;
            capas[k].cantidad-=t; capas[k].total-=t*cu; quitar-=t;
          }
        }
      });
    });
  /* Lo producido entra como una capa más, en el orden de su fecha de cierre. */
  (e.ordenesProduccion||[]).flatMap(entradasProduccion).filter(x=>x.producto===producto)
    .forEach(x=>capas.push({cantidad:x.cantidad,total:x.costo,fecha:x.fecha}));
  /* Los ajustes que entran (sobrante, existencia inicial) también son capas, en el orden de su fecha. */
  (e.entradasInventario||[]).filter(x=>x.producto===producto&&x.cantidad>0)
    .forEach(x=>capas.push({cantidad:x.cantidad,total:x.costoTotal||0,fecha:x.fecha}));
  if((e.ordenesProduccion||[]).length||(e.entradasInventario||[]).length) capas.sort((a,b)=>(a.fecha||'').localeCompare(b.fecha||''));
  return capas.filter(c=>c.cantidad>1e-9);
}
/* Cuánto cuesta lo que sale. Es LA única fuente para ventas directas,
   consignaciones y las salidas automáticas al cargar facturas — así el
   método elegido no puede aplicarse distinto en cada pantalla.
   · Promedio ponderado: cantidad × (valor total en existencia ÷ unidades en existencia).
   · PEPS: se agotan primero las capas de compra más antiguas; lo que ya salió
     antes (en unidades) se salta, y lo nuevo se valúa con las capas que siguen. */
/* El inventario tal como estaba a una fecha: sin lo que entró ni salió después. */
function empresaAlCorte(e,hasta){
  if(!hasta) return e;
  return {...e,documentos:(e.documentos||[]).filter(d=>(d.fecha||'')<=hasta),
    ordenesProduccion:(e.ordenesProduccion||[]).map(o=>o.estado==='cerrada'&&(o.fechaCierre||'')>hasta?{...o,estado:'abierta'}:o),
    salidasInventario:(e.salidasInventario||[]).filter(s=>(s.fecha||'')<=hasta),
    entradasInventario:(e.entradasInventario||[]).filter(s=>(s.fecha||'')<=hasta)};
}
const inventarioDetalleAl=(e,hasta)=>inventarioDetalle(empresaAlCorte(e,hasta));
/* fecha (opcional): la de la salida. El costo es el que tenía el inventario ese día —una requisición del 20/01
   no se valúa con la compra del 10/02, aunque esa compra se haya cargado antes—. Sin fecha, se usa todo. */
function costoSalidaInventario(e,producto,cantidad,fecha){
  if(fecha) e=empresaAlCorte(e,fecha);
  if(metodoCosteo(e)==='peps'){
    const capas=capasDeCompra(e,producto);
    let saltar=(e.salidasInventario||[]).filter(x=>x.producto===producto).reduce((a,x)=>a+x.cantidad,0);
    let restante=cantidad, costo=0;
    for(const c of capas){
      if(restante<=1e-9) break;
      if(saltar>=c.cantidad-1e-9){ saltar-=c.cantidad; continue; }
      const disp=c.cantidad-Math.max(saltar,0), toma=Math.min(disp,restante);
      costo+=toma*(c.total/c.cantidad); restante-=toma; saltar=0;
    }
    if(restante>1e-9){   // se vendió más de lo que había: el excedente se valúa a la última capa
      const u=capas[capas.length-1];
      costo+=restante*(u?u.total/u.cantidad:0);
    }
    return {costoTotal:r2(costo), costoUnitario:cantidad?costo/cantidad:0};
  }
  const item=inventarioDetalle(e).lista.find(x=>x.producto===producto);
  const cu=item?item.costoUnitario:0;
  return {costoTotal:r2(cantidad*cu), costoUnitario:cu};
}

function inventarioDetalle(e){
  const productos={};
  let sinDetalle=0, sinDetalleValor=0;
  /* Antes esto solo miraba d.bs==='B', sin importar qué cuenta contable
     terminó teniendo el documento — así que una nota de crédito reclasificada
     a "Devoluciones y rebajas sobre compras" (una rebaja de precio, sin que
     la mercadería físicamente vuelva) seguía restando cantidad del kardex
     igual que una devolución real. Ahora el kardex sigue la MISMA decisión
     que ya tomó el contador al clasificar la cuenta: solo entra si de verdad
     quedó en Inventarios (1.1.08), que es la cuenta que implica movimiento
     físico real. */
  (e.documentos||[]).filter(d=>d.tipo==='compra' && d.cta==='1.1.08').forEach(d=>{
    if(d.items && d.items.length){
      d.items.filter(it=>it.bs==='B').forEach(it=>{
        const k=productoDe(e,it.descripcion||'Sin descripción');
        productos[k]=productos[k]||{producto:k,cantidad:0,total:0,movimientos:0};
        const s=d.signo||1;
        const neto=r2(netoItemCompra(d,it));
        productos[k].cantidad=r2(productos[k].cantidad+s*(it.cantidad||0));
        productos[k].total=r2(productos[k].total+s*neto);
        productos[k].movimientos++;
      });
    }else{
      sinDetalle++; sinDetalleValor=r2(sinDetalleValor+(d.signo||1)*d.base);
    }
  });
  /* Lo que sale —una venta directa o algo que se fue a consignación— se
     resta acá, al costo promedio que tenía en el momento de registrarse
     (guardado en la propia salida, no recalculado ahora). Sin esto, el
     inventario solo sumaría entradas para siempre y nunca bajaría, aunque
     ya no quede nada en existencia. */
  /* Lo que se fabricó entra al kardex a su costo de producción (órdenes y corridas ya cerradas). */
  (e.ordenesProduccion||[]).flatMap(entradasProduccion).forEach(x=>{
    const k=x.producto;
    productos[k]=productos[k]||{producto:k,cantidad:0,total:0,movimientos:0};
    productos[k].cantidad=r2(productos[k].cantidad+x.cantidad);
    productos[k].total=r2(productos[k].total+x.costo);
    productos[k].movimientos++;
  });
  /* Ajustes manuales que entran (sobrante en el conteo, existencia inicial). */
  (e.entradasInventario||[]).forEach(x=>{
    const k=x.producto;
    productos[k]=productos[k]||{producto:k,cantidad:0,total:0,movimientos:0};
    productos[k].cantidad=r2(productos[k].cantidad+x.cantidad);
    productos[k].total=r2(productos[k].total+(x.costoTotal||0));
    productos[k].movimientos++;
  });
  (e.salidasInventario||[]).forEach(s=>{
    const k=s.producto;
    productos[k]=productos[k]||{producto:k,cantidad:0,total:0,movimientos:0};
    productos[k].cantidad=r2(productos[k].cantidad-s.cantidad);
    productos[k].total=r2(productos[k].total-s.costoTotal);
  });
  const lista=Object.values(productos).map(p=>({...p,
    /* Sin r2() acá a propósito: si se redondea el costo unitario ANTES de
       usarlo para calcular el costo de una venta o consignación, cada
       transacción grande arrastra un poquito de error — 3,400 cajas a
       Q2.036144 exacto no es lo mismo que 3,400 cajas a Q2.04 redondeado, y
       esa diferencia se va acumulando con cada movimiento. Q() ya redondea
       solo para mostrarlo en pantalla, así que no hace falta perder
       precisión acá. */
    costoUnitario: p.cantidad>0.0001 ? p.total/p.cantidad : 0}))
    /* Un producto que ya se agotó no tiene nada que aportar a "cuánto tengo
       en existencia ahora" — se saca de la lista en vez de dejarlo en cero
       estorbando. Si por algún error de carga quedó en negativo (se vendió
       más de lo que había), sí se deja visible — eso es justo la señal de
       que algo no cuadra y hay que revisarlo, no algo para esconder. */
    .filter(p=>p.cantidad>0.0001||p.cantidad<-0.0001)
    .sort((a,b)=>b.total-a.total);
  return {lista, sinDetalle, sinDetalleValor};
}

/* Si la empresa alguna vez estuvo en alguno de estos regímenes (no
   necesariamente el actual), corresponde que el libro de ese régimen
   siga visible — para no perder el acceso a lo que ya se registró ahí. */
function tuvoRegimen(e,tipos){
  const historial=e.historialRegimen&&e.historialRegimen.length ? e.historialRegimen : [{regimen:e.regimen}];
  return historial.some(h=>tipos.includes(h.regimen));
}

VISTAS.libroPequeno=()=>{
  const e=emp();
  const docs=(e.documentos||[]).filter(d=>regimenEn(e,d.fecha)==='pequeno').sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const ventas=docs.filter(d=>d.tipo==='venta'), compras=docs.filter(d=>d.tipo==='compra');
  const totalVentas=r2(ventas.reduce((s,d)=>s+d.signo*d.total,0));
  const totalCompras=r2(compras.reduce((s,d)=>s+d.signo*d.total,0));
  const fila=d=>`<tr><td>${fFecha(d.fecha)}</td><td>${esc(d.tipoDte||'FACT')} ${esc(d.serie||'')}${d.dte?'-'+esc(d.dte):''}</td>
    <td>${esc(d.nit||'CF')}</td><td>${esc(d.nombre||'—')}</td>
    <td class="num">${d.signo<0?'−':''}${Q(Math.abs(d.total))}</td></tr>`;
  return cab('Libro de Pequeño Contribuyente',
    'Compras y ventas del período en que la empresa estuvo bajo este régimen — sin desglose de IVA, porque no genera crédito fiscal.',
    docs.length?`<button class="btn" data-accion="pdfLibroPequeno">Descargar PDF</button>`:'')
  + `<div class="cifras">
      <div class="cifra"><span>Total de ventas</span><strong>${Q(totalVentas)}</strong></div>
      <div class="cifra"><span>Impuesto del 5%</span><strong>${Q(r2(totalVentas*0.05))}</strong></div>
      <div class="cifra"><span>Total de compras</span><strong>${Q(totalCompras)}</strong></div>
    </div>
    ${docs.length? `<h3 style="color:var(--verde);margin:20px 0 8px">Ventas</h3>
      ${ventas.length?`<table><thead><tr><th>Fecha</th><th>Documento</th><th>NIT</th><th>Cliente</th><th class="num">Total</th></tr></thead>
      <tbody>${ventas.map(fila).join('')}</tbody>
      <tfoot><tr class="total"><td colspan="4">Total ventas</td><td class="num">${Q(totalVentas)}</td></tr></tfoot></table>`
      : `<div class="vacio">Sin ventas en este régimen todavía.</div>`}
      <h3 style="color:var(--verde);margin:20px 0 8px">Compras</h3>
      ${compras.length?`<table><thead><tr><th>Fecha</th><th>Documento</th><th>NIT</th><th>Proveedor</th><th class="num">Total</th></tr></thead>
      <tbody>${compras.map(fila).join('')}</tbody>
      <tfoot><tr class="total"><td colspan="4">Total compras</td><td class="num">${Q(totalCompras)}</td></tr></tfoot></table>`
      : `<div class="vacio">Sin compras en este régimen todavía.</div>`}`
     : `<div class="vacio">Todavía no hay documentos cargados mientras estuvo en este régimen.</div>`}`;
};

/* Libros de Compras y de Ventas (Art. 37 de la Ley del IVA y su reglamento):
   cada documento separa bienes, servicios, operaciones exentas o sin IVA,
   compras a pequeños contribuyentes, el impuesto, y se totaliza por mes. */
function desgloseCV(d){
  const s=d.signo||1, base=s*(d.base||0);
  let pB=d.bs==='S'?0:1;
  if(d.items&&d.items.length){
    const tb=d.items.filter(it=>it.bs==='B').reduce((a,it)=>a+(it.total||0),0);
    const ts=d.items.filter(it=>it.bs==='S').reduce((a,it)=>a+(it.total||0),0);
    if(tb+ts>0) pB=tb/(tb+ts);
  }
  const peq=!!d.pequeno||d.tipoDte==='FPEQ'||d.tipoDte==='FCAP';
  const exenta=!peq&&!d.iva;
  const gravada=!peq&&!exenta;
  const noDed=d.cta==='6.2.14';
  return {
    bienes:gravada?r2(base*pB):0, servicios:gravada?r2(base*(1-pB)):0,
    peq:peq?r2(s*d.total):0, exentas:exenta?r2(base):0,
    idp:r2(s*(d.idp||0)),
    credito:noDed?0:r2(s*(d.iva||0)), ivaNoDed:noDed?r2(s*(d.iva||0)):0,
    iva:r2(s*(d.iva||0)), total:r2(s*d.total)};
}
const COLS_VENTAS=[['bienes','Bienes'],['servicios','Servicios'],['exentas','Exentas / sin IVA'],['iva','Débito fiscal'],['total','Total']];
const COLS_COMPRAS=[['bienes','Bienes'],['servicios','Servicios'],['peq','Peq. contribuyente'],['exentas','Exentas / sin IVA'],['idp','IDP y otros'],['credito','Crédito fiscal'],['ivaNoDed','IVA no deducible'],['total','Total']];
/* Filas de un libro agrupadas por mes: {mes, docs:[{d,x}], tot} y el total general. */
function libroPorMes(docs,cols){
  const meses={}, gen={};
  cols.forEach(([k])=>gen[k]=0);
  docs.forEach(d=>{
    const m=(d.fecha||'').slice(0,7);
    meses[m]=meses[m]||{mes:m,docs:[],tot:Object.fromEntries(cols.map(([k])=>[k,0]))};
    const x=desgloseCV(d);
    meses[m].docs.push({d,x});
    cols.forEach(([k])=>{ meses[m].tot[k]=r2(meses[m].tot[k]+x[k]); gen[k]=r2(gen[k]+x[k]); });
  });
  return {meses:Object.values(meses).sort((a,b)=>a.mes.localeCompare(b.mes)),gen};
}
const nombreMes=m=>{ const [a,mm]=m.split('-'); return `${MESES_NOM[+mm-1]||''} ${a}`; };
function tablaLibroCV(docs,cols,etiquetaContraparte){
  const L=libroPorMes(docs,cols);
  const cab4=`<th>Fecha</th><th>Documento</th><th>NIT</th><th>${etiquetaContraparte}</th>`;
  const cuerpo=L.meses.map(M=>
    `<tr class="grupo-cta"><td colspan="${4+cols.length}">${nombreMes(M.mes)}</td></tr>`
    +M.docs.map(({d,x})=>`<tr><td>${fFecha(d.fecha)}</td><td>${esc(d.tipoDte||'FACT')} ${esc(d.serie||'')}${d.dte?'-'+esc(d.dte):''}</td>
      <td>${esc(d.nit||'CF')}</td><td>${esc(d.nombre||'—')}</td>${cols.map(([k])=>`<td class="num">${x[k]?Q(x[k]):'—'}</td>`).join('')}</tr>`).join('')
    +`<tr><td colspan="4" style="padding-left:26px"><em>Total ${nombreMes(M.mes)}</em></td>${cols.map(([k])=>`<td class="num"><em>${Q(M.tot[k])}</em></td>`).join('')}</tr>`).join('');
  return {L,html:`<table class="densa"><thead><tr>${cab4}${cols.map(([,t])=>`<th class="num">${t}</th>`).join('')}</tr></thead>
    <tbody>${cuerpo}</tbody>
    <tfoot><tr class="total"><td colspan="4">Totales</td>${cols.map(([k])=>`<td class="num">${Q(L.gen[k])}</td>`).join('')}</tr></tfoot></table>`};
}

VISTAS.libroVentas=()=>{
  const e=emp();
  const ventas=(e.documentos||[]).filter(d=>d.tipo==='venta'&&{general:1,simplificado:1}[regimenEn(e,d.fecha)])
    .sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const t=tablaLibroCV(ventas,COLS_VENTAS,'Cliente');
  return cab('Libro de Ventas','Ventas y servicios prestados, régimen general y simplificado — separado por bienes, servicios y exentas, y totalizado por mes (Ley del IVA, Dto. 27-92).',
    ventas.length?`<button class="btn" data-accion="pdfLibroVentas">Descargar PDF</button>`:'')
  + `<div class="cifras"><div class="cifra"><span>Débito fiscal del período</span><strong>${Q(t.L.gen.iva)}</strong></div></div>`
  + (ventas.length?t.html:`<div class="vacio">Sin ventas en este régimen todavía.</div>`);
};

VISTAS.libroCompras=()=>{
  const e=emp();
  const compras=(e.documentos||[]).filter(d=>d.tipo==='compra'&&{general:1,simplificado:1}[regimenEn(e,d.fecha)])
    .sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const t=tablaLibroCV(compras,COLS_COMPRAS,'Proveedor');
  return cab('Libro de Compras','Compras y servicios recibidos — separado por bienes, servicios, pequeños contribuyentes, exentas e IDP, y totalizado por mes (Ley del IVA, Dto. 27-92).',
    compras.length?`<button class="btn" data-accion="pdfLibroCompras">Descargar PDF</button>`:'')
  + `<div class="cifras"><div class="cifra"><span>Crédito fiscal del período</span><strong>${Q(t.L.gen.credito)}</strong></div></div>`
  + (compras.length?t.html:`<div class="vacio">Sin compras en este régimen todavía.</div>`);
};

VISTAS.inventario=()=>{
  const e=emp();
  const {lista, sinDetalle, sinDetalleValor}=inventarioDetalle(e);
  const totalProductos=r2(lista.reduce((s,p)=>s+p.total,0));
  const totalGeneral=r2(totalProductos+sinDetalleValor);
  const filas=lista.map(p=>`<tr><td><button type="button" class="btn-enlace" data-accion="renombrarProducto" data-producto="${esc(p.producto)}" title="Cambiar el nombre">${esc(p.producto)} <span aria-hidden="true" style="opacity:.5">✎</span></button></td>
    <td class="num">${p.cantidad?Q(p.cantidad).replace(/\.00$/,''):'—'}</td>
    <td class="num">${Q(p.costoUnitario)}</td>
    <td class="num">${Q(p.total)}</td></tr>`).join('');
  return cab('Existencias',`Existencia por producto: compras y producción, menos ventas, consignaciones y materiales usados — un kardex de trabajo, no el libro legal. Método de valuación: ${METODOS_COSTEO[metodoCosteo(e)]}.`,
    `<button class="btn sec" data-accion="ajusteInventario">Ajuste manual</button>
     <button class="btn sec" data-accion="revisarItemsInventario">Revisar ítems</button>
     <button class="btn" data-accion="pdfInventario">Descargar PDF</button>`)
  + `<div class="cifras">
      <div class="cifra"><span>Productos distintos</span><strong>${lista.length}</strong></div>
      <div class="cifra"><span>Valor total en inventario</span><strong>${Q(totalGeneral)}</strong></div>
    </div>
    <div class="aviso">Cada producto muestra lo que entró (compras de bienes y producción terminada) menos lo que
      salió (ventas, consignaciones y materiales usados en producción), valuado con el método de la empresa.
      Los servicios no generan inventario. Compará contra un conteo físico antes de cerrar el costo de ventas.
      Tocá el nombre de un producto para ponerle uno más fácil de reconocer.</div>
    ${lista.length? `<table><thead><tr><th>Producto</th><th class="num">Existencia</th>
      <th class="num">Costo unitario prom.</th><th class="num">Valor</th></tr></thead>
      <tbody>${filas}</tbody>
      <tfoot><tr class="total"><td colspan="3">Total con detalle de producto</td><td class="num">${Q(totalProductos)}</td></tr></tfoot></table>`
     : `<div class="vacio">Todavía no hay compras de bienes con detalle de producto registradas.
        Se completa cargando facturas en XML desde "Cargar facturas".</div>`}
    ${sinDetalle? `<div class="aviso" style="margin-top:16px">${sinDetalle} compra${sinDetalle===1?'':'s'} de bienes por Q${Q(sinDetalleValor)}
      se cargaron desde Excel, que no trae detalle de producto por línea. Ese valor está incluido
      en el total general, pero no aparece desglosado por producto arriba. Para verlo desglosado,
      cargá esas facturas en XML en vez de Excel.</div>` : ''}
    ${htmlAjustesInventario(e)}`;
};

VISTAS.tablero=()=>{
  const e=emp(), meses=mesesDelEjercicio();
  const sel=filtros.periodo||'anio';
  const conMov=meses.filter(x=>x.ingresos||x.credito||x.debito||x.cg);
  const opciones=`<option value="anio"${sel==='anio'?' selected':''}>Todo el ejercicio ${e.ejercicio}</option>`
    + meses.map(x=>`<option value="${x.mm}"${sel===x.mm?' selected':''}>${x.nombre} ${e.ejercicio}</option>`).join('');

  const p = sel==='anio'
    ? meses.reduce((a,x)=>({ingresos:r2(a.ingresos+x.ingresos),cg:r2(a.cg+x.cg),
        credito:r2(a.credito+x.credito),debito:r2(a.debito+x.debito),
        utilidad:r2(a.utilidad+x.utilidad),imp:r2(a.imp+x.imp)}),
        {ingresos:0,cg:0,credito:0,debito:0,utilidad:0,imp:0})
    : meses.find(x=>x.mm===sel);
  const ivaNeto=r2(p.debito-p.credito);

  /* --- ISR según el régimen --- */
  let bloqueISR='';
  const hastaPeriodoSel = sel==='anio' ? `${e.ejercicio}-12-31` : (meses.find(x=>x.mm===sel)||{}).hasta;
  const regimenPeriodoSel = regimenEn(e,hastaPeriodoSel);
  if(regimenPeriodoSel==='general'){
    const trim=trimestresGeneral(e);
    const tc=trim.reduce((s,x)=>s+x.cierre,0), te=trim.reduce((s,x)=>s+x.estimada,0);
    /* El acumulado del año se calcula aparte, sobre el ejercicio completo de
       una sola vez — sumar los 4 trimestres tendría el mismo riesgo de
       contar el inventario dos veces si solo alguno de ellos tiene un
       inventario final registrado. */
    const desdeAno=`${e.ejercicio}-01-01`, hastaAno=`${e.ejercicio}-12-31`;
    const movAno=movimientos(desdeAno,hastaAno);
    const rentasAno=totalTipo(['ingreso'],movAno);
    const {costo:costoBienesAno}=costoVentasPeriodo(e,desdeAno,hastaAno,movAno);
    const utilAno=r2(rentasAno-r2(costoBienesAno+totalTipo(['costo'],movAno)+totalTipo(['gasto'],movAno)));
    bloqueISR=`<h3 style="color:var(--verde);margin:26px 0 4px">ISR sobre Utilidades de Actividades Lucrativas</h3>
      <p style="margin:0 0 12px;font-size:14px;color:var(--tinta-suave)">
        Tarifa del 25% con liquidación anual. Los pagos son <strong>trimestrales</strong>, no mensuales,
        y podés elegir entre cierre contable parcial o renta imponible estimada en 8% de la renta bruta.
        Formulario SAT-1361, dentro del mes siguiente al cierre del trimestre.</p>
      <table><thead><tr><th>Trimestre</th><th class="num">Rentas brutas</th><th class="num">Utilidad contable</th>
        <th class="num">Por cierre parcial (25%)</th><th class="num">Por renta estimada (8% × 25%)</th></tr></thead>
      <tbody>${trim.map(x=>`<tr><td>${['Ene–Mar','Abr–Jun','Jul–Sep','Oct–Dic'][x.t-1]}</td>
        <td class="num">${Q(x.rentas)}</td><td class="num">${Q(x.util)}</td>
        <td class="num">${Q(x.cierre)}</td><td class="num">${Q(x.estimada)}</td></tr>`).join('')}</tbody>
      <tfoot><tr class="total"><td>Acumulado del ejercicio</td>
        <td class="num">${Q(rentasAno)}</td>
        <td class="num">${Q(utilAno)}</td>
        <td class="num">${Q(tc)}</td><td class="num">${Q(te)}</td></tr></tfoot></table>
      <div class="aviso">El cuarto trimestre no se paga aparte: se liquida junto con la declaración anual,
        a más tardar el 31 de marzo.</div>
      <h3 style="color:var(--verde);margin:22px 0 4px">Costos y gastos por trimestre</h3>
      <p style="margin:0 0 12px;font-size:14px;color:var(--tinta-suave)">Mismo desglose que la conciliación de
        Estado de Resultados, trimestre por trimestre — para llenar la declaración sin tener que rearmarlo a mano.</p>
      <table><thead><tr><th>Trimestre</th><th class="num">Costo de ventas</th>
        <th class="num">Gastos deducibles</th><th class="num">No deducibles</th><th class="num">Total</th></tr></thead>
      <tbody>${trim.map(x=>`<tr><td>${['Ene–Mar','Abr–Jun','Jul–Sep','Oct–Dic'][x.t-1]}</td>
        <td class="num">${Q(x.costoVentas)}</td><td class="num">${Q(x.gastosDeducibles)}</td>
        <td class="num">${Q(x.noDeducible)}</td>
        <td class="num">${Q(r2(x.costoVentas+x.gastosDeducibles+x.noDeducible))}</td></tr>`).join('')}</tbody>
      <tfoot><tr class="total"><td>Acumulado del ejercicio</td>
        <td class="num">${Q(r2(trim.reduce((s,x)=>s+x.costoVentas,0)))}</td>
        <td class="num">${Q(r2(trim.reduce((s,x)=>s+x.gastosDeducibles,0)))}</td>
        <td class="num">${Q(r2(trim.reduce((s,x)=>s+x.noDeducible,0)))}</td>
        <td class="num">${Q(r2(trim.reduce((s,x)=>s+x.costoVentas+x.gastosDeducibles+x.noDeducible,0)))}</td></tr></tfoot></table>
      ${htmlTarjetaISO(e)}`;
  }
  else if(regimenPeriodoSel==='simplificado'){
    const acum=meses.reduce((s,x)=>s+x.imp,0);
    bloqueISR=`<h3 style="color:var(--verde);margin:26px 0 4px">ISR Régimen Opcional Simplificado sobre Ingresos</h3>
      <p style="margin:0 0 12px;font-size:14px;color:var(--tinta-suave)">
        Pago <strong>mensual y definitivo</strong> sobre la renta bruta, sin deducir costos ni gastos:
        5% sobre los primeros Q30,000 del mes y 7% sobre el excedente.
        Formulario SAT-1311, dentro de los primeros diez días hábiles del mes siguiente.</p>
      <div class="cifras">
        <div class="cifra"><span>Renta bruta ${sel==='anio'?'del ejercicio':'del mes'}</span><strong>${Q(p.ingresos)}</strong></div>
        <div class="cifra"><span>ISR ${sel==='anio'?'acumulado del ejercicio':'del mes'}</span><strong>${Q(p.imp)}</strong></div>
        <div class="cifra"><span>ISR acumulado ${e.ejercicio}</span><strong>${Q(acum)}</strong></div>
      </div>
      <div class="aviso">Al pagar ("Pagar ISR") se restan solas las retenciones de ISR que anotaste al cargar
        las facturas de venta. Las rentas exentas hay que excluirlas a mano.</div>`;
  }
  else if(regimenPeriodoSel==='pequeno'){
    const smVigente=e.salarioMinimo||SALARIO_MINIMO;
    const topePequeno=r2(smVigente*125);
    const anual=meses.reduce((s,x)=>s+x.ingresos,0);
    const pct=Math.min(100,Math.round(anual/topePequeno*100));
    bloqueISR=`<h3 style="color:var(--verde);margin:26px 0 4px">Régimen de Pequeño Contribuyente</h3>
      <p style="margin:0 0 12px;font-size:14px;color:var(--tinta-suave)">
        Se paga <strong>5% sobre los ingresos brutos mensuales</strong>, que sustituye al IVA.
        El artículo 49 de la Ley del IVA releva a este régimen de declarar y pagar ISR,
        así que no hay declaración anual, trimestral ni mensual de ISR.</p>
      <div class="cifras">
        <div class="cifra"><span>Ingresos ${sel==='anio'?'del ejercicio':'del mes'}</span><strong>${Q(p.ingresos)}</strong></div>
        <div class="cifra"><span>Impuesto del 5%</span><strong>${Q(p.imp)}</strong></div>
        <div class="cifra"><span>ISR</span><strong>Relevado</strong></div>
      </div>
      <div class="aviso ${pct>=85?'malo':''}">Ingresos acumulados del ejercicio: <strong>${Q(anual)}</strong>
        de un tope de ${Q(topePequeno)} (125 salarios mínimos, a Q${Q(smVigente)} c/u). Va en el ${pct}% del límite.
        ${pct>=85?'Si lo supera, hay que trasladarlo al régimen general.':''}</div>`;
  }
  else{
    const smVigente=e.salarioMinimo||SALARIO_MINIMO;
    const topeAgro=r2(smVigente*3500);
    const anual=meses.reduce((s,x)=>s+x.ingresos,0);
    bloqueISR=`<h3 style="color:var(--verde);margin:26px 0 4px">${esc(REGIMENES[regimenPeriodoSel]||regimenPeriodoSel)}</h3>
      <p style="margin:0 0 12px;font-size:14px;color:var(--tinta-suave)">
        Impuesto único del <strong>1.5% sobre las ventas brutas</strong>, de pago mensual y definitivo,
        que sustituye al IVA y al ISR. Las exportaciones tributan 2% y los intermediarios de productos
        bovinos 10% sobre utilidades: esos casos hay que calcularlos aparte.</p>
      <div class="cifras">
        <div class="cifra"><span>Ventas ${sel==='anio'?'del ejercicio':'del mes'}</span><strong>${Q(p.ingresos)}</strong></div>
        <div class="cifra"><span>Impuesto del 1.5%</span><strong>${Q(p.imp)}</strong></div>
        <div class="cifra"><span>Acumulado ${e.ejercicio}</span><strong>${Q(anual)}</strong></div>
      </div>
      <div class="aviso">El techo de este régimen es de 3,500 salarios mínimos, alrededor de ${Q(topeAgro)} al año.
        Al superarlo hay que pasar al régimen general.</div>`;
  }

  return pestanasResumen('tablero')+cab('Tablero fiscal',`${esc(e.nombre)} · ejercicio ${e.ejercicio} · régimen actual: ${esc(REGIMENES[e.regimen]||e.regimen)}`,
    `${e.regimen==='general'||e.regimen==='simplificado'?'<button class="btn sec" data-accion="pagarIVA">Pagar IVA</button>':''}
     ${e.regimen!=='general'&&e.regimen!=='simplificado'?`<button class="btn sec" data-accion="pagarISR">Pagar impuesto (${e.regimen==='pequeno'?'5%':'1.5%'})</button>`:''}
     ${e.regimen==='simplificado'?'<button class="btn sec" data-accion="pagarISR">Pagar ISR</button>':''}
     ${e.regimen==='general'?'<button class="btn" data-accion="irCierreFiscal">Cierre fiscal paso a paso</button>':''}
     ${e.regimen==='general'?'<button class="btn sec" data-accion="pagarISO">Pagar ISO</button>':''}
     <button class="btn sec" data-accion="cambiarRegimen">Cambiar régimen</button>`)
  + `<div class="barra"><div class="campo ancho"><label>Período</label>
      <select data-filtro="periodo">${opciones}</select></div></div>

    <h3 style="color:var(--verde);margin:0 0 4px">Impuesto al Valor Agregado</h3>
    <p style="margin:0 0 12px;font-size:14px;color:var(--tinta-suave)">
      Declaración mensual. El débito de las ventas menos el crédito de las compras da el impuesto a pagar;
      si el crédito es mayor, queda un remanente que se traslada al mes siguiente.</p>
    <div class="cifras">
      <div class="cifra"><span>IVA débito fiscal (ventas)</span><strong>${Q(p.debito)}</strong></div>
      <div class="cifra"><span>IVA crédito fiscal (compras)</span><strong>${Q(p.credito)}</strong></div>
      <div class="cifra" style="border-top-color:${ivaNeto>0?'var(--haber)':'var(--verde)'}">
        <span>${ivaNeto>0?'IVA por pagar':'Remanente de crédito a favor'}</span>
        <strong>${Q(Math.abs(ivaNeto))}</strong></div>
    </div>
    ${ivaNeto<0?`<div class="aviso">El crédito fiscal supera al débito. No hay impuesto que pagar en el período
      y el remanente de ${Q(Math.abs(ivaNeto))} se traslada al mes siguiente.</div>`:''}

    ${(()=>{
      /* Punto de partida para una rectificación fiscal: el total de costos y
         gastos del período, separado entre lo deducible y lo que quedó
         marcado como "Gastos no deducibles" (6.2.14). Usa calcularResultados
         directo, en vez de recalcular aparte — así el ISR queda excluido acá
         igual que en Estado de Resultados (el ISR es un impuesto, no un
         costo ni un gasto operativo, así que no cuenta para este total), sin
         arriesgarse a que las dos pantallas se desincronicen con el tiempo. */
      const desdeSel = sel==='anio' ? `${e.ejercicio}-01-01` : (meses.find(x=>x.mm===sel)||{}).desde;
      const Rsel=calcularResultados(e,desdeSel,hastaPeriodoSel);
      const noDeducible=r2(Rsel.noDeducible+Rsel.ivaNoDeducible);
      const totalCostosGastos=r2(Rsel.costoVentas+Rsel.otrosCostos+Rsel.gastos);
      const deducible=r2(totalCostosGastos-noDeducible);
      return `<h3 style="color:var(--verde);margin:22px 0 4px">Costos y gastos, deducibles y no deducibles</h3>
        <p style="margin:0 0 12px;font-size:14px;color:var(--tinta-suave)">
          Punto de partida para una rectificación: el total de costos y gastos del período —sin el ISR, que es
          un impuesto, no un costo—, y aparte lo que quedó marcado como no deducible.</p>
        <div class="cifras">
          <div class="cifra"><span>Total de costos y gastos</span><strong>${Q(totalCostosGastos)}</strong></div>
          <div class="cifra"><span>Deducible</span><strong>${Q(deducible)}</strong></div>
          <div class="cifra" style="border-top-color:var(--haber)"><span>No deducible (gasto 6.2.14 + IVA 6.2.27)</span><strong>${Q(noDeducible)}</strong></div>
        </div>
        ${noDeducible?`<button class="btn sec" style="margin-top:10px" data-accion="pdfGastosNoDeducibles"
          data-desde="${desdeSel}" data-hasta="${hastaPeriodoSel}">Descargar listado de facturas no deducibles</button>`:''}`;
    })()}

    ${bloqueISR}

    <h3 style="color:var(--verde);margin:26px 0 10px">Detalle mes a mes del ejercicio</h3>
    ${meses.some(x=>x.regimen!==meses[0].regimen)?`<div class="aviso">Esta empresa cambió de régimen durante
      el ejercicio — cada mes de la tabla usa el que regía en ese momento, no el de hoy.</div>`:''}
    ${conMov.length? `<table><thead><tr><th>Mes</th><th class="num">Ventas</th>
      <th class="num">Costos y gastos</th><th class="num">Débito</th><th class="num">Crédito</th>
      <th class="num">IVA del mes</th>${meses.some(x=>x.regimen!=='general')?'<th class="num">Impuesto del régimen</th>':''}</tr></thead>
      <tbody>${conMov.map(x=>`<tr><td>${x.nombre}${x.regimen!==e.regimen?`<br><span style="font-size:12px;color:var(--tinta-suave)">${esc(REGIMENES[x.regimen]||x.regimen)}</span>`:''}</td>
        <td class="num">${Q(x.ingresos)}</td><td class="num">${Q(x.cg)}</td>
        <td class="num h">${Q(x.debito)}</td><td class="num d">${Q(x.credito)}</td>
        <td class="num">${x.ivaPagar>0?Q(x.ivaPagar):'('+Q(Math.abs(x.ivaPagar))+')'}</td>
        ${meses.some(m=>m.regimen!=='general')?`<td class="num">${Q(x.imp)}</td>`:''}</tr>`).join('')}</tbody>
      <tfoot><tr class="total"><td>Totales</td>
        <td class="num">${Q(meses.reduce((s,x)=>s+x.ingresos,0))}</td>
        <td class="num">${Q(meses.reduce((s,x)=>s+x.cg,0))}</td>
        <td class="num">${Q(meses.reduce((s,x)=>s+x.debito,0))}</td>
        <td class="num">${Q(meses.reduce((s,x)=>s+x.credito,0))}</td>
        <td class="num">${Q(meses.reduce((s,x)=>s+x.ivaPagar,0))}</td>
        ${meses.some(x=>x.regimen!=='general')?`<td class="num">${Q(meses.reduce((s,x)=>s+x.imp,0))}</td>`:''}</tr></tfoot></table>
      <p style="font-size:13px;color:var(--tinta-suave);margin-top:8px">
        Los montos entre paréntesis son remanentes de crédito fiscal a favor.</p>`
     : `<div class="vacio">Todavía no hay movimiento registrado en el ejercicio ${e.ejercicio}.</div>`}

    <div class="aviso" style="margin-top:22px">Estas cifras salen de tus libros y sirven para anticipar el pago,
      pero no reemplazan la declaración. Las retenciones sufridas se aplican al registrar cada pago;
      las rentas exentas hay que revisarlas a mano.</div>`;
};

