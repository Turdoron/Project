/* ============ PRODUCCIÓN: COSTO DE LO QUE SE FABRICA ============ */
/* Contabilidad de costos ligada a la contabilidad general. La ley (Art. 41, Dto. 10-2012) y la NIC 2
   piden valuar lo fabricado a su "costo de producción" (materiales + mano de obra + costos indirectos)
   y mantener el método. Cada empresa elige el suyo y el sistema aplica ese y no otro:
   · Por órdenes: cada pedido o lote tiene su hoja de costos, con fecha de inicio y de fin.
   · Proceso continuo: producción en serie que pasa por procesos (departamentos) en orden; se costea por
     período con el informe de costo de producción (unidades equivalentes, promedio ponderado).
   · Costo estándar: hoja de costo estándar (receta con precios estándar, horas estándar y tasa de CIF);
     lo terminado entra al estándar y las diferencias se separan en variaciones.

   LOS TRES ELEMENTOS DEL COSTO Y SU REGISTRO (sistema periódico, como el resto del inventario)
   · Materiales directos — requisición: Productos en proceso (1.1.18) contra Inventarios (1.1.08), al costo
     del método de inventario (promedio o PEPS). Con receta (lista de materiales/fórmula) se calcula lo que
     DEBÍA usarse —por unidad producida o como % del peso de la materia prima base— y se compara con lo usado.
   · Mano de obra directa — boleta de tiempo: horas × tarifa por hora del proceso, con fecha dentro del
     período de la orden. Productos en proceso contra la cuenta donde la planilla registró los sueldos
     (se traslada, no se duplica). Lo que no se aplica a órdenes sigue como gasto (mano de obra indirecta).
   · Costos indirectos (CIF), dos formas:
       - Tasa predeterminada (costeo normal, lo usual): tasa = presupuesto anual de CIF ÷ base a capacidad
         normal (horas MOD, costo MOD, horas máquina o unidades). Se aplica con cada boleta: Productos en
         proceso contra "CIF aplicados" (5.1.10). Los CIF reales se registran en sus cuentas de gasto como
         siempre; al cierre del período se comparan: la diferencia es la sub o sobreaplicación, que va a
         resultados (5.1.08). NIC 2: el CIF fijo se reparte según la capacidad normal; el no absorbido por
         baja producción es gasto del período, no inventario.
       - Costeo real: los CIF reales del período se reparten entre las órdenes con "Repartir costo común".
   · Producto terminado: Inventarios (1.1.08) contra Productos en proceso; entra al kardex a su costo.
   · Pérdidas en proceso continuo: la normal la absorben las unidades buenas; la anormal va a resultados
     (5.1.09), no al inventario (NIC 2).
   Así el costo de lo fabricado entra a la fórmula del costo de ventas sin duplicar nada. */
const METODOS_PRODUCCION={
  ordenes:{nombre:'Por órdenes de producción',corto:'Por órdenes',
    texto:'Cada pedido o lote tiene su hoja de costos, con fecha de inicio y de fin. Ideal si fabricás sobre pedido o por lotes distintos entre sí (calzado por pedido, muebles, imprenta).'},
  continuo:{nombre:'Proceso continuo (por procesos)',corto:'Proceso continuo',
    texto:'Producción en serie que pasa por procesos en orden (corte → aparado → montaje; ribera → curtido → acabado). Se costea por período con unidades equivalentes.'},
  estandar:{nombre:'Costo estándar',corto:'Costo estándar',
    texto:'Fijás de antemano cuánto debe costar cada unidad (receta, horas y CIF). Lo terminado entra a ese costo y las diferencias se separan en variaciones de precio, cantidad, tarifa y eficiencia.'}};
const BASES_CIF={
  horasMOD:{nombre:'Horas de mano de obra directa',unidad:'horas MOD',una:'hora MOD'},
  costoMOD:{nombre:'Costo de mano de obra directa (Q)',unidad:'quetzales de MOD',una:'quetzal de MOD'},
  horasMaquina:{nombre:'Horas máquina',unidad:'horas máquina',una:'hora máquina'},
  unidades:{nombre:'Unidades producidas',unidad:'unidades',una:'unidad'}};
/* Cuentas que usa costos (se crean solas cuando hacen falta). */
const CTA_PEP='1.1.18', CTA_CIF_APLICADOS='5.1.10', CTA_VAR_CIF='5.1.08', CTA_PERDIDA_ANORMAL='5.1.09';
const VARIACIONES_DETALLE=[
  ['precioMat','5.1.05','Variación en precio de materiales'],
  ['cantidadMat','5.1.11','Variación en cantidad de materiales'],
  ['tarifaMod','5.1.06','Variación en tarifa de mano de obra'],
  ['eficienciaMod','5.1.12','Variación en eficiencia de mano de obra'],
  ['eficienciaCif','5.1.07','Variación en eficiencia de costos indirectos']];
const NOMBRE_VARIACION={precioMat:'Precio de materiales',cantidadMat:'Cantidad de materiales',tarifaMod:'Tarifa de mano de obra',eficienciaMod:'Eficiencia de mano de obra',eficienciaCif:'Eficiencia de CIF'};
/* Estándares viejos (antes de las recetas): se siguen respetando para lo que ya existía. */
const VARIACIONES_ESTANDAR=[['mat','5.1.05','Variación de materiales (costo estándar)'],['mod','5.1.06','Variación de mano de obra (costo estándar)'],['cif','5.1.07','Variación de costos indirectos (costo estándar)']];
/* Jornada ordinaria diurna: 44 horas semanales (Art. 116 del Código de Trabajo) → horas por mes. */
const HORAS_MES=44*52/12;

let ordenProdActual=null, pantallaProd=null;
const anioCerradoLibros=(e,fecha)=>(e.partidas||[]).some(p=>(p.concepto||'').startsWith(PREFIJO_CIERRE_LIBROS+fecha.slice(0,4)));
const metodoProduccion=e=>(e&&METODOS_PRODUCCION[e.metodoProduccion])?e.metodoProduccion:'';
const sumaOrden=(o,k,filtro)=>r2((o[k]||[]).filter(filtro||(()=>true)).reduce((s,x)=>s+(x.monto!==undefined?x.monto:x.costoTotal||0),0));
function totalesOrden(o,centroId){
  const f=centroId===undefined?null:(x=>(x.centroId||'general')===centroId);
  const mat=sumaOrden(o,'materiales',f), mod=sumaOrden(o,'manoObra',f), cif=sumaOrden(o,'cif',f);
  return {mat,mod,cif,total:r2(mat+mod+cif)};
}
function productosConocidos(e){
  const s=new Set(inventarioDetalle(e).lista.map(p=>p.producto));
  (e.ordenesProduccion||[]).forEach(o=>s.add(o.producto));
  (e.recetas||[]).forEach(r=>s.add(r.producto));
  return [...s].sort();
}

/* ---- Configuración de costos ---- */
function cfgCostos(e){
  const c=e.costos||{};
  const centros=(c.centros&&c.centros.length)?c.centros:[{id:'general',nombre:'Producción'}];
  const cif=Object.assign({modo:'tasa',base:'horasMOD',presupuestoFijo:0,variablePorBase:0,capacidadNormal:0,cuentas:[],porProceso:false,procesos:{},asignacion:{}},c.cif||{});
  return {centros,tarifaGeneral:+c.tarifaGeneral||0,tarifas:c.tarifas||{},cuentaMOD:c.cuentaMOD||'6.2.01',cif};
}
const tarifaCentro=(e,centroId)=>{ const c=cfgCostos(e); return +(c.tarifas[centroId]||0)||c.tarifaGeneral; };
/* Tasa predeterminada: CIF fijo presupuestado ÷ capacidad normal + CIF variable por unidad de base.
   Una sola para toda la planta, o una por proceso (tasas departamentales) cuando los procesos consumen
   CIF muy distinto (un acabado con mucha maquinaria frente a una ribera casi manual). */
const tasaDe=p=>(+p.capacidadNormal>0?(+p.presupuestoFijo||0)/(+p.capacidadNormal):0)+(+p.variablePorBase||0);
function parametrosCIF(e,centroId){
  const c=cfgCostos(e).cif;
  const p=c.porProceso&&centroId&&c.procesos[centroId]?c.procesos[centroId]:c;
  const base=BASES_CIF[p.base]?p.base:'horasMOD';
  return {base,capacidadNormal:+p.capacidadNormal||0,presupuestoFijo:+p.presupuestoFijo||0,variablePorBase:+p.variablePorBase||0,tasa:tasaDe(p)};
}
const tasaCIF=(e,centroId)=>parametrosCIF(e,centroId).tasa;
const baseCIF=(e,centroId)=>parametrosCIF(e,centroId).base;
/* Bases que usa la empresa (para mostrar "horas máquina" solo si alguna tasa las usa). */
const basesEnUso=e=>{ const c=cfgCostos(e); return new Set(c.cif.porProceso?c.centros.map(x=>baseCIF(e,x.id)):[baseCIF(e)]); };
const nombreCentro=(e,id)=>{ const c=cfgCostos(e).centros.find(x=>x.id===(id||'general')); return c?c.nombre:(id&&id!=='general'?'(proceso eliminado)':'Producción'); };
function centrosDeOrden(e,o){
  const todos=cfgCostos(e).centros;
  if(o.tipo!=='continuo') return todos;
  const ids=o.centros&&o.centros.length?o.centros:[todos[0].id];
  return ids.map(id=>todos.find(c=>c.id===id)||{id,nombre:nombreCentro(e,id)});
}
function avisoConfiguracion(e){
  const c=cfgCostos(e), faltas=[];
  if(!tarifaCentro(e,c.centros[0].id)) faltas.push('la tarifa por hora de mano de obra');
  if(c.cif.modo==='tasa'&&!c.cif.porProceso&&!(tasaCIF(e)>0)) faltas.push('la tasa de costos indirectos (presupuesto y capacidad normal)');
  if(c.cif.modo==='tasa'&&c.cif.porProceso){ const sin=c.centros.filter(x=>!(tasaCIF(e,x.id)>0)); if(sin.length) faltas.push(`la tasa de costos indirectos de ${sin.map(x=>x.nombre).join(', ')}`); }
  if(c.cif.modo==='tasa'&&!c.cif.cuentas.length) faltas.push('las cuentas donde se registran los CIF reales');
  return faltas;
}

/* ---- Recetas (lista de materiales / fórmula) ---- */
/* baseTipo "producto": cantidades por unidad producida (calzado: piezas por par).
   baseTipo "materia": cantidades por unidad de la materia prima base, o % de su peso (tenería: químicos
   como % del peso del cuero; acabado: litros por hoja). */
const recetaDe=(e,o)=>o&&o.recetaId?(e.recetas||[]).find(r=>r.id===o.recetaId)||null:null;
const coefLinea=l=>l.modo==='porcentaje'?(+l.valor||0)/100:(+l.valor||0);
const consumoTeorico=(r,base)=>(r.lineas||[]).map(l=>({material:l.material,unidad:l.unidad||'',cantidad:Math.round(coefLinea(l)*base*10000)/10000,precioStd:+l.precioStd||0,linea:l}));
const etiquetaBase=r=>r.baseTipo==='materia'?`${r.baseUnidad||'unidades'} de ${r.materiaBase||'materia prima base'}`:`${r.baseUnidad||'unidades'} producidas`;
/* Recetas que aplican a una orden: la suya y las que se usaron al consumir (una por proceso: en una
   tenería, la de ribera y curtido va por kg de cuero y la de acabado por hoja). */
function recetasDeOrden(e,o){
  const ids=[o.recetaId,...(o.basesReceta||[]).map(b=>b.recetaId||o.recetaId)].filter(Boolean);
  return [...new Set(ids)].map(id=>(e.recetas||[]).find(r=>r.id===id)).filter(Boolean);
}
/* Base con la que se compara: unidades terminadas (producto) o materia prima procesada declarada (materia). */
function baseControl(o,r,T){
  if(r.baseTipo==='materia') return r2((o.basesReceta||[]).filter(b=>(b.recetaId||o.recetaId)===r.id).reduce((s,b)=>s+b.base,0));
  return T!==undefined?T:(o.cantidadTerminada||o.cantidadPlan||0);
}
const fmtCant=x=>(+x||0).toLocaleString('es-GT',{maximumFractionDigits:4});
/* Control: lo que la receta dice que debía usarse frente a lo que realmente salió del inventario. */
function controlReceta(e,o,T){
  const recetas=recetasDeOrden(e,o); if(!recetas.length) return null;
  const bases=recetas.map(r=>({receta:r,base:baseControl(o,r,T)}));
  const porMaterial={};
  bases.forEach(({receta,base})=>consumoTeorico(receta,base).forEach(t=>{
    const x=porMaterial[t.material]||(porMaterial[t.material]={material:t.material,unidad:t.unidad,cantidad:0,precioStd:t.precioStd});
    x.cantidad=Math.round((x.cantidad+t.cantidad)*10000)/10000; }));
  const teo=Object.values(porMaterial);
  const r=recetas[0], base=bases[0].base;
  const reales={};
  (o.materiales||[]).forEach(m=>{ const k=m.producto; reales[k]=reales[k]||{cantidad:0,costo:0}; reales[k].cantidad=Math.round((reales[k].cantidad+m.cantidad)*10000)/10000; reales[k].costo=r2(reales[k].costo+m.costoTotal); });
  const filas=teo.map(t=>{ const re=reales[t.material]||{cantidad:0,costo:0}; delete reales[t.material];
    const dif=Math.round((re.cantidad-t.cantidad)*10000)/10000, pct=t.cantidad>0?dif/t.cantidad*100:(re.cantidad>0?100:0);
    return {material:t.material,unidad:t.unidad,teorico:t.cantidad,real:re.cantidad,costoReal:re.costo,dif,pct,precioStd:t.precioStd}; });
  Object.entries(reales).forEach(([k,v])=>filas.push({material:k,unidad:'',teorico:0,real:v.cantidad,costoReal:v.costo,dif:v.cantidad,pct:100,fueraReceta:true}));
  const horasReales=r2((o.manoObra||[]).reduce((s,x)=>s+(+x.horas||0),0));
  const horasStd=r2(bases.reduce((s,b)=>s+(+b.receta.horasStd||0)*b.base,0));
  const descBase=bases.map(b=>`${fmtCant(b.base)} ${etiquetaBase(b.receta)}`).join(' · ');
  return {receta:r,base,bases,descBase,filas,horasReales,horasStd,hayBase:bases.some(b=>b.base>0)};
}
const estadoConsumo=p=>Math.abs(p)<=2?'Según receta':p>0?`Usó ${p.toFixed(1)} % más`:`Usó ${Math.abs(p).toFixed(1)} % menos`;
function tablaControlReceta(e,o){
  const c=controlReceta(e,o); if(!c) return '';
  if(!c.hayBase) return `<div class="aviso">Receta "${esc(c.receta.producto)}": todavía no hay ${esc(etiquetaBase(c.receta))} para comparar lo usado contra lo que debía usarse${c.receta.baseTipo==='materia'?' (se registran con "Consumir según receta")':''}.</div>`;
  const pctH=c.horasStd>0?(c.horasReales-c.horasStd)/c.horasStd*100:0;
  return `<h3 style="margin:24px 0 8px;font-size:15px">Control de consumo — receta frente a lo usado</h3>
    <p style="margin:0 0 8px;font-size:13px;color:var(--tinta-suave)">Base: ${esc(c.descBase)}. Lo teórico sale de ${c.bases.length>1?'las recetas':'la receta'}; lo real, de las requisiciones de esta ${o.tipo==='continuo'?'corrida':'orden'}.</p>
    <table style="font-size:13px"><thead><tr><th>Material</th><th class="num">Debía usarse</th><th class="num">Se usó</th><th class="num">Diferencia</th><th>Resultado</th></tr></thead><tbody>
    ${c.filas.map(f=>`<tr><td>${esc(f.material)}${f.fueraReceta?' <span style="font-size:12px;color:var(--tinta-suave)">(fuera de receta)</span>':''}</td>
      <td class="num">${fmtCant(f.teorico)} ${esc(f.unidad)}</td><td class="num">${fmtCant(f.real)}</td>
      <td class="num">${f.dif>0?'+':''}${fmtCant(f.dif)}</td>
      <td style="color:${f.fueraReceta||f.pct>2?'var(--peligro)':f.pct<-2?'var(--advertencia)':'var(--exito)'}">${f.fueraReceta?'No está en la receta':estadoConsumo(f.pct)}</td></tr>`).join('')}
    ${c.horasStd>0?`<tr><td>Horas de mano de obra</td><td class="num">${Q(c.horasStd)} h</td><td class="num">${Q(c.horasReales)} h</td><td class="num">${pctH>0?'+':''}${Q(r2(c.horasReales-c.horasStd))}</td>
      <td>${Math.abs(pctH)<=2?'Según estándar':pctH>0?`Trabajó ${pctH.toFixed(1)} % más`:`Trabajó ${Math.abs(pctH).toFixed(1)} % menos`}</td></tr>`:''}
    </tbody></table>`;
}

/* ---- Fechas de la orden ---- */
const enPeriodoOrden=(o,fecha)=>fecha>=o.fechaInicio&&(!o.fechaFin||fecha<=o.fechaFin);
function revisarFechaOrden(e,o,fecha){
  if(!fecha) return 'Escribí la fecha.';
  if(!enPeriodoOrden(o,fecha)) return `La fecha ${fFecha(fecha)} está fuera del período de la ${o.tipo==='continuo'?'corrida':'orden'} (${fFecha(o.fechaInicio)} al ${o.fechaFin?fFecha(o.fechaFin):'—'}). Corregí la fecha o ampliá el período con "Cambiar fechas".`;
  if(anioCerradoLibros(e,fecha)) return 'Ese ejercicio ya tiene Cierre de libros.';
  return '';
}
const fechaSugerida=o=>enPeriodoOrden(o,hoy())?hoy():(o.fechaFin&&hoy()>o.fechaFin?o.fechaFin:o.fechaInicio);

/* Registra una partida verificando que cuadre. */
function partidaProduccion(e,fecha,concepto,lineas){
  const dif=r2(lineas.reduce((s,l)=>s+(+l.debe||0)-(+l.haber||0),0));
  if(Math.abs(dif)>0.004) throw new Error('La partida no cuadra por Q'+Q(dif));
  const p={id:uid(),numero:e.correlativo++,fecha,concepto,docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',lineas:lineas.filter(l=>l.debe||l.haber)};
  e.partidas.push(p); return p;
}
const asegurarCuentasCostos=e=>{
  asegurarCuenta(e,CTA_PEP,'Productos en proceso','activo');
  asegurarCuenta(e,CTA_CIF_APLICADOS,'Costos indirectos aplicados a la producción','costo');
};

/* ---- Proceso continuo: informe de costo de producción por proceso (promedio ponderado) ---- */
function inicialProcesoContinuo(e,producto){
  const prev=(e.ordenesProduccion||[]).filter(o=>o.tipo==='continuo'&&o.producto===producto&&o.estado==='cerrada'&&o.wipFinal)
    .sort((a,b)=>(a.fechaCierre||'').localeCompare(b.fechaCierre||'')||a.numero-b.numero).pop();
  return prev?prev.wipFinal:{unidades:0,mat:0,conv:0,avMat:0,avConv:0};
}
function inicialPorCentro(e,o){
  if(o.inicialPorCentro) return o.inicialPorCentro;
  /* Corridas anteriores a los procesos: lo que venía en proceso entra al primer proceso. */
  const ini=o.inicial||{unidades:0,mat:0,conv:0};
  const primero=centrosDeOrden(e,o)[0].id;
  return {[primero]:{unidades:ini.unidades||0,ant:0,mat:ini.mat||0,conv:ini.conv||0}};
}
/* Un proceso: costo recibido del anterior + materiales + conversión (MOD + CIF), repartido en unidades
   equivalentes. La pérdida normal no entra en las equivalentes (su costo lo absorben las buenas); la
   anormal sí (se detecta al final del proceso, 100 %) y su costo va a resultados. */
function costeoProceso(ini,costos,u){
  const T=+u.T||0, W=+u.W||0, A=+u.A||0, pm=(+u.pm||0)/100, pc=(+u.pc||0)/100;
  const ant=r2((ini.ant||0)+(costos.ant||0)), mat=r2((ini.mat||0)+costos.mat), conv=r2((ini.conv||0)+costos.conv);
  const euAnt=T+W+A, euM=T+W*pm+A, euC=T+W*pc+A;
  const cuAnt=euAnt>0?ant/euAnt:0, cuM=euM>0?mat/euM:0, cuC=euC>0?conv/euC:0;
  const transferido=r2(T*(cuAnt+cuM+cuC)), anormal=r2(A*(cuAnt+cuM+cuC));
  const enProceso=r2(ant+mat+conv-transferido-anormal);
  const wipAnt=r2(W*cuAnt), wipMat=r2(W*pm*cuM);
  return {ant,mat,conv,euAnt,euM,euC,cuAnt,cuM,cuC,transferido,anormal,enProceso,
    wip:{unidades:W,ant:wipAnt,mat:wipMat,conv:r2(enProceso-wipAnt-wipMat),avMat:+u.pm||0,avConv:+u.pc||0}};
}
/* Recorre los procesos en orden: lo transferido de uno es el costo "recibido" del siguiente. */
function informeCorrida(e,o,datos){
  const centros=centrosDeOrden(e,o), inis=inicialPorCentro(e,o);
  let recibidoU=0, recibidoQ=0; const filas=[];
  centros.forEach((c,i)=>{
    const d=datos[c.id]||{}, ini=inis[c.id]||{unidades:0,ant:0,mat:0,conv:0}, t=totalesOrden(o,c.id);
    const entradas=i===0?(+d.iniciadas||0):recibidoU;
    const cuadreU=r2((ini.unidades||0)+entradas-((+d.T||0)+(+d.W||0)+(+d.N||0)+(+d.A||0)));
    const r=costeoProceso(ini,{ant:i===0?0:recibidoQ,mat:t.mat,conv:r2(t.mod+t.cif)},d);
    filas.push({centro:c,ini,entradas,datos:d,costos:t,cuadreU,...r});
    recibidoU=+d.T||0; recibidoQ=r.transferido;
  });
  const ultimo=filas[filas.length-1];
  return {filas,transferidoFinal:ultimo?ultimo.transferido:0,unidadesFinal:ultimo?(+ultimo.datos.T||0):0,
    anormalTotal:r2(filas.reduce((s,f)=>s+f.anormal,0))};
}

/* ---- Costo estándar con receta: hoja de costo estándar y variaciones ---- */
function hojaEstandar(e,r){
  const teo=consumoTeorico(r,1);
  const mat=teo.reduce((s,t)=>s+t.cantidad*t.precioStd,0);
  const c=cfgCostos(e), centro=r.centroId||c.centros[0].id, tarifa=tarifaCentro(e,centro);
  const mod=(+r.horasStd||0)*tarifa, pc=parametrosCIF(e,centro);
  const baseCif=pc.base==='horasMOD'?(+r.horasStd||0):pc.base==='costoMOD'?mod:pc.base==='horasMaquina'?(+r.horasMaqStd||0):1;
  const cif=c.cif.modo==='tasa'?baseCif*pc.tasa:0;
  return {mat,mod,cif,total:mat+mod+cif,tarifa,baseCif};
}
function variacionesConReceta(e,o,T){
  const r=recetaDe(e,o), c=controlReceta(e,o,T), h=hojaEstandar(e,r), t=totalesOrden(o);
  let precioMat=0, cantidadMat=0;
  c.filas.forEach(f=>{
    if(f.fueraReceta){ cantidadMat+=f.costoReal; return; }
    precioMat+=f.costoReal-f.real*f.precioStd;          // (precio real − estándar) × cantidad real
    cantidadMat+=(f.real-f.teorico)*f.precioStd;          // (cantidad real − estándar permitida) × precio estándar
  });
  const H=c.horasReales, Hs=(+r.horasStd||0)*T;
  const tarifaMod=t.mod-H*h.tarifa;                       // (tarifa real − estándar) × horas reales
  const eficienciaMod=(H-Hs)*h.tarifa;                    // (horas reales − estándar permitidas) × tarifa estándar
  const estandar={mat:r2(h.mat*T),mod:r2(h.mod*T),cif:r2(h.cif*T)};
  const eficienciaCif=t.cif-estandar.cif;                 // CIF aplicado a la base real − CIF estándar permitido
  const v={precioMat:r2(precioMat),cantidadMat:r2(cantidadMat),tarifaMod:r2(tarifaMod),eficienciaMod:r2(eficienciaMod),eficienciaCif:r2(eficienciaCif)};
  const estTotal=r2(estandar.mat+estandar.mod+estandar.cif);
  /* Redondeo: el total de variaciones tiene que explicar exactamente real − estándar. */
  const ajuste=r2(t.total-estTotal-Object.values(v).reduce((s,x)=>s+x,0));
  if(Math.abs(ajuste)>0) v.cantidadMat=r2(v.cantidadMat+ajuste);
  return {estandar,estTotal,var:v,hoja:h,control:c};
}
function varianzasEstandar(e,o,T){
  const std=(e.costosEstandar||{})[o.producto]||{mat:0,mod:0,cif:0}, t=totalesOrden(o);
  const est={mat:r2(T*std.mat),mod:r2(T*std.mod),cif:r2(T*std.cif)};
  return {est,estTotal:r2(est.mat+est.mod+est.cif),var:{mat:r2(t.mat-est.mat),mod:r2(t.mod-est.mod),cif:r2(t.cif-est.cif)}};
}

/* ======================= PANTALLAS ======================= */
function vistaProduccion(){
  const e=emp(); e.ordenesProduccion=e.ordenesProduccion||[];
  const m=metodoProduccion(e);
  if(!m){
    return cab('Producción','Costo de lo que fabricás: elegí cómo lo vas a calcular.')
    + `<div class="tarjeta"><h3>¿Cómo se costea la producción de ${esc(e.nombre)}?</h3>
        <p style="font-size:13px;color:var(--tinta-suave)">Hay varias formas válidas. Elegí la que usa la empresa: una vez que se empieza a producir, el método se mantiene (cambiarlo requiere que no haya órdenes abiertas y queda en la bitácora).</p>
        ${Object.entries(METODOS_PRODUCCION).map(([k,v])=>`<div style="margin:10px 0;padding:12px 14px;border:1px solid var(--linea);border-radius:var(--radio-chico)">
          <strong>${v.nombre}</strong><div style="font-size:13px;color:var(--tinta-suave);margin:4px 0 8px">${v.texto}</div>
          <button class="btn mini" data-accion="elegirMetodoProduccion" data-metodo="${k}">Usar este método</button></div>`).join('')}
      </div>`;
  }
  if(pantallaProd==='recetas') return vistaRecetas(e);
  if(ordenProdActual){ const o=e.ordenesProduccion.find(x=>x.id===ordenProdActual); if(o) return vistaOrdenProduccion(e,o); ordenProdActual=null; }
  const mov=movimientos(null,null);
  const wip=saldoNatural(CTA_PEP,mov);
  const c=cfgCostos(e);
  const lista=[...e.ordenesProduccion].sort((a,b)=>b.numero-a.numero);
  const etiqueta=m==='continuo'?'Corrida':'Orden';
  const abiertas=lista.filter(o=>o.estado==='abierta').length;
  const faltas=avisoConfiguracion(e);
  const anio=`${e.ejercicio}`;
  const aplicadoAnio=r2(e.partidas.filter(p=>p.fecha.slice(0,4)===anio&&!(e.cierresCIF||[]).some(x=>x.partidaId===p.id))
    .reduce((s,p)=>s+p.lineas.filter(l=>l.cta===CTA_CIF_APLICADOS).reduce((a,l)=>a+(+l.haber||0)-(+l.debe||0),0),0));
  const filas=lista.map(o=>{const t=totalesOrden(o); return `<tr><td>${etiqueta} ${o.numero}</td><td>${esc(o.producto)}${o.nota?`<br><span style="font-size:12px;color:var(--tinta-suave)">${esc(o.nota)}</span>`:''}</td>
    <td>${fFecha(o.fechaInicio)}${o.fechaFin?` al ${fFecha(o.fechaFin)}`:''}</td>
    <td>${o.estado==='cerrada'?`Cerrada ${fFecha(o.fechaCierre)}`:'<span style="color:var(--alerta)">Abierta</span>'}</td>
    <td class="num">${Q(t.mat)}</td><td class="num">${Q(t.mod)}</td><td class="num">${Q(t.cif)}</td><td class="num">${Q(t.total)}</td>
    <td class="num">${o.estado==='cerrada'&&o.productosConjuntos?`${o.productosConjuntos.length} productos conjuntos`:o.estado==='cerrada'&&o.cantidadTerminada?`${Q(o.cantidadTerminada)} u. a Q${Q(o.costoUnitario)}`:'—'}</td>
    <td class="num"><button class="btn mini" data-accion="abrirOrdenProduccion" data-id="${o.id}">Abrir</button></td></tr>`;}).join('');
  return cab('Producción',`Método de costeo: ${METODOS_PRODUCCION[m].nombre} · CIF ${c.cif.modo!=='tasa'?'reales repartidos':c.cif.porProceso?`con tasa por proceso: ${c.centros.map(x=>{const pc=parametrosCIF(e,x.id);return `${x.nombre} Q${pc.tasa.toFixed(2)}/${BASES_CIF[pc.base].una}`;}).join(' · ')}`:`con tasa predeterminada de Q${tasaCIF(e).toFixed(4)} por ${BASES_CIF[c.cif.base].una}`}`,
    `<button class="btn sec" data-accion="configuracionCostos">Configuración de costos</button>
     <button class="btn sec" data-accion="verRecetas">Recetas</button>
     ${c.cif.modo==='tasa'?'<button class="btn sec" data-accion="cierreCIF">Cierre de CIF del período</button>':''}
     ${abiertas>=2?'<button class="btn sec" data-accion="repartirCostoComun">Repartir costo común</button>':''}
     <button class="btn sec" data-accion="cambiarMetodoProduccion">Cambiar método</button>
     <button class="btn" data-accion="nuevaOrdenProduccion">${m==='continuo'?'Nueva corrida (período)':'Nueva orden'}</button>`)
  + (faltas.length?`<div class="aviso malo">Para costear con exactitud falta configurar ${faltas.join(', ')}. <button class="btn mini sec" data-accion="configuracionCostos">Configurar ahora</button></div>`:'')
  + `<div class="cifras">
      <div class="cifra"><span>Productos en proceso (en libros)</span><strong>${Q(wip)}</strong></div>
      ${c.cif.modo==='tasa'?`<div class="cifra"><span>CIF aplicados en ${anio}</span><strong>${Q(aplicadoAnio)}</strong></div>`:''}
      <div class="cifra"><span>${etiqueta}s abiertas</span><strong>${abiertas}</strong></div>
      <div class="cifra"><span>${etiqueta}s cerradas</span><strong>${lista.length-abiertas}</strong></div>
    </div>`
  + (lista.length?`<table><thead><tr><th></th><th>Producto</th><th>Período</th><th>Estado</th><th class="num">Materiales</th><th class="num">Mano de obra</th><th class="num">CIF</th><th class="num">Costo total</th><th class="num">Terminado</th><th></th></tr></thead><tbody>${filas}</tbody></table>`
    :`<div class="vacio">Todavía no hay ${etiqueta.toLowerCase()}s. Creá la primera con el botón de arriba.</div>`)
  + `<div class="aviso">Cómo se liga con la contabilidad: los materiales salen del inventario a Productos en proceso; la mano de obra se aplica con boletas de tiempo (horas × tarifa) trasladándola desde la cuenta de sueldos, sin duplicarla; los CIF ${c.cif.modo==='tasa'?'se aplican con la tasa predeterminada y al cierre del período se comparan con los reales (sub o sobreaplicación)':'reales se reparten entre las corridas u órdenes'}; lo terminado entra al inventario y al kardex a su costo de producción.</div>`;
}
VISTAS.produccion=vistaProduccion;

function vistaOrdenProduccion(e,o){
  const m=o.tipo, t=totalesOrden(o), abierta=o.estado==='abierta', etiqueta=m==='continuo'?'Corrida':'Orden';
  const c=cfgCostos(e), r=recetaDe(e,o);
  const tabla=(titulo,lista,cols,filaFn)=>`<h3 style="margin:22px 0 8px;font-size:15px">${titulo}</h3>`
    +(lista.length?`<table style="font-size:13px"><thead><tr>${cols.map((x,i)=>`<th${i===cols.length-1?' class="num"':''}>${x}</th>`).join('')}</tr></thead><tbody>${lista.map(filaFn).join('')}</tbody></table>`
      :`<div class="vacio" style="padding:14px">Sin registros todavía.</div>`);
  const centros=centrosDeOrden(e,o);
  const conCentro=centros.length>1;
  const colC=conCentro?['Proceso']:[], celC=x=>conCentro?`<td>${esc(nombreCentro(e,x.centroId))}</td>`:'';
  const inis=m==='continuo'?inicialPorCentro(e,o):null;
  const conIni=inis&&Object.values(inis).some(x=>x.unidades>0||x.mat>0||x.conv>0||x.ant>0);
  return cab(`${etiqueta} ${o.numero} — ${esc(o.producto)}`,
      `${METODOS_PRODUCCION[m].nombre} · del ${fFecha(o.fechaInicio)} al ${o.fechaFin?fFecha(o.fechaFin):'(sin fecha de fin)'}${o.cantidadPlan?` · a producir: ${fmtCant(o.cantidadPlan)}`:''}${r?` · receta: ${esc(r.producto)}`:''}${o.nota?' · '+esc(o.nota):''}`,
    `<button class="btn sec" data-accion="volverProduccion">Volver</button>
     ${recetasDeOrden(e,o).length||(e.recetas||[]).some(x=>x.producto===o.producto)?`<button class="btn sec" data-accion="hojaProduccion" data-orden="${o.id}">Hoja para producción</button>`:''}
     <button class="btn sec" data-accion="pdfOrdenProduccion" data-id="${o.id}">Hoja de costos PDF</button>
     ${abierta?`<button class="btn sec" data-accion="fechasOrdenProduccion" data-id="${o.id}">Cambiar fechas</button>
       <button class="btn peligro" data-accion="anularOrdenProduccion" data-id="${o.id}">Anular</button>
       <button class="btn" data-accion="cerrarOrdenProduccion" data-id="${o.id}">Cerrar y pasar a inventario</button>`:''}`)
  + `<div class="cifras">
      <div class="cifra"><span>Materiales directos</span><strong>${Q(t.mat)}</strong></div>
      <div class="cifra"><span>Mano de obra directa</span><strong>${Q(t.mod)}</strong></div>
      <div class="cifra"><span>Costos indirectos</span><strong>${Q(t.cif)}</strong></div>
      <div class="cifra"><span>Costo acumulado</span><strong>${Q(t.total)}</strong></div>
    </div>`
  + (m==='continuo'&&centros.length>1?`<p style="margin:-12px 0 16px;font-size:13px;color:var(--tinta-suave)">Recorre: ${centros.map(cc=>{const tc=totalesOrden(o,cc.id);return `${esc(cc.nombre)} (Q${Q(tc.total)})`;}).join(' → ')}</p>`:'')
  + (conIni?`<div class="aviso">Viene con producción en proceso del período anterior: ${centros.map(cc=>{const x=inis[cc.id]; return x&&x.unidades?`${esc(cc.nombre)} ${fmtCant(x.unidades)} u. (Q${Q(r2((x.ant||0)+(x.mat||0)+(x.conv||0)))})`:''}).filter(Boolean).join(' · ')}.</div>`:'')
  + (abierta?`<div class="barra" style="margin:16px 0 4px">
      <button class="btn mini" data-accion="materialOrdenProduccion" data-id="${o.id}">Requisición de materiales</button>
      ${r||(e.recetas||[]).some(x=>x.producto===o.producto)?`<button class="btn mini" data-accion="consumirRecetaProduccion" data-id="${o.id}">Consumir según receta</button>`:''}
      <button class="btn mini" data-accion="boletaManoObra" data-id="${o.id}">Boleta de mano de obra</button>
      ${c.cif.modo==='real'?`<button class="btn mini sec" data-accion="costoOrdenProduccion" data-id="${o.id}" data-clase="cif">Costo indirecto real</button>`:''}
      ${c.cif.modo==='tasa'&&centros.some(x=>baseCIF(e,x.id)==='unidades')?'<span style="font-size:12.5px;color:var(--tinta-suave)">Los CIF por unidad se aplican al cerrar.</span>':''}
    </div>`:'')
  + tabla('Materiales directos (requisiciones)',o.materiales||[],['Fecha',...colC,'Material','Cantidad','Costo unitario','Costo'],x=>`<tr><td>${fFecha(x.fecha)}</td>${celC(x)}<td>${esc(x.producto)}</td><td class="num">${fmtCant(x.cantidad)}</td><td class="num">${Q(x.costoUnitario)}</td><td class="num">${Q(x.costoTotal)}</td></tr>`)
  + tabla('Mano de obra directa (boletas de tiempo)',o.manoObra||[],['Fecha',...colC,'Detalle','Horas','Tarifa','Monto'],x=>`<tr><td>${fFecha(x.fecha)}</td>${celC(x)}<td>${esc([x.empleado,x.descripcion].filter(Boolean).join(' — ')||x.origen||'')}</td>
      <td class="num">${x.horas!==undefined?Q(x.horas):'—'}</td><td class="num">${x.tarifa!==undefined?Q(x.tarifa):'—'}</td><td class="num">${Q(x.monto)}</td></tr>`)
  + tabla('Costos indirectos de fabricación',o.cif||[],['Fecha',...colC,'Detalle','Monto'],x=>`<tr><td>${fFecha(x.fecha)}</td>${celC(x)}<td>${esc(x.descripcion||'')}${x.aplicado?'':`<br><span style="font-size:12px;color:var(--tinta-suave)">Real, desde ${esc(x.origen||'')}</span>`}</td><td class="num">${Q(x.monto)}</td></tr>`)
  + tablaControlReceta(e,o)
  + (o.estado==='cerrada'?resumenCierre(e,o,t):'');
}
function resumenCierre(e,o,t){
  const m=o.tipo;
  let html=`<div class="aviso bien" style="margin-top:20px"><strong>Cerrada el ${fFecha(o.fechaCierre)}.</strong>
      ${fmtCant(o.cantidadTerminada)} u. terminadas, ${m==='estandar'?`al costo estándar de Q${Q(o.costoUnitario)} c/u (costo real Q${Q(t.total)})`:`Q${Q(o.costoTerminado)} a Q${Q(o.costoUnitario)} c/u`}.
      ${o.wipFinal&&o.wipFinal.unidades>0?` En proceso: ${fmtCant(o.wipFinal.unidades)} u. (Q${Q(r2((o.wipFinal.ant||0)+o.wipFinal.mat+o.wipFinal.conv))}).`:''}
      ${o.perdidaAnormal?` Pérdida anormal a resultados: Q${Q(o.perdidaAnormal)}.`:''}
      Partida No. ${o.partidaCierreNumero}.</div>`;
  if(o.informe) html+=`<h3 style="margin:22px 0 8px;font-size:15px">Informe de costo de producción</h3>${tablaInforme(o.informe)}`;
  if(o.variacionesDetalle) html+=`<h3 style="margin:22px 0 8px;font-size:15px">Variaciones frente al estándar</h3>
    <table style="font-size:13px"><thead><tr><th>Variación</th><th class="num">Monto</th><th>Lectura</th></tr></thead><tbody>
    ${Object.entries(o.variacionesDetalle).map(([k,v])=>`<tr><td>${NOMBRE_VARIACION[k]}</td><td class="num">${Q(v)}</td><td>${Math.abs(v)<0.005?'Sin diferencia':v>0?'Desfavorable (costó más que el estándar)':'Favorable (costó menos)'}</td></tr>`).join('')}</tbody></table>`;
  else if(o.variaciones) html+=`<div class="aviso">Variaciones: materiales Q${Q(o.variaciones.mat)}, mano de obra Q${Q(o.variaciones.mod)}, indirectos Q${Q(o.variaciones.cif)} (positivo = gastó más que el estándar).</div>`;
  if(o.productosConjuntos) html+=`<h3 style="margin:18px 0 6px;font-size:15px">Productos conjuntos — ${esc(METODOS_CONJUNTOS[o.metodoConjunto]||'')}</h3>
      <table style="font-size:13px"><thead><tr><th>Producto</th><th>Tipo</th><th class="num">Cantidad</th><th class="num">Precio de venta</th><th class="num">Costo unitario</th><th class="num">Costo</th></tr></thead>
      <tbody>${o.productosConjuntos.map(x=>`<tr><td>${esc(x.producto)}</td><td>${x.tipo==='subproducto'?'Subproducto':'Principal'}</td><td class="num">${x.cantidad}</td><td class="num">${x.precio!=null?Q(x.precio):'—'}</td><td class="num">${Q(x.costoUnitario)}</td><td class="num">${Q(x.costo)}</td></tr>`).join('')}</tbody></table>`;
  return html;
}
function tablaInforme(inf){
  const n=x=>(+x||0).toLocaleString('es-GT',{maximumFractionDigits:2});
  const col=inf.filas.length+1;
  return `<div class="tabla-scroll"><table style="font-size:12.5px"><thead><tr><th><span class="solo-lector">Concepto</span></th>${inf.filas.map(f=>`<th class="num">${esc(f.centro.nombre)}</th>`).join('')}</tr></thead><tbody>
    <tr class="grupo-cta"><td colspan="${col}">Unidades</td></tr>
    <tr><td>En proceso al inicio</td>${inf.filas.map(f=>`<td class="num">${n(f.ini.unidades)}</td>`).join('')}</tr>
    <tr><td>Iniciadas / recibidas</td>${inf.filas.map(f=>`<td class="num">${n(f.entradas)}</td>`).join('')}</tr>
    <tr><td>Terminadas y transferidas</td>${inf.filas.map(f=>`<td class="num">${n(f.datos.T)}</td>`).join('')}</tr>
    <tr><td>En proceso al final (% mat. / % conv.)</td>${inf.filas.map(f=>`<td class="num">${n(f.datos.W)} (${n(f.datos.pm)} / ${n(f.datos.pc)})</td>`).join('')}</tr>
    <tr><td>Pérdida normal / anormal</td>${inf.filas.map(f=>`<td class="num">${n(f.datos.N)} / ${n(f.datos.A)}</td>`).join('')}</tr>
    <tr class="grupo-cta"><td colspan="${col}">Unidades equivalentes</td></tr>
    <tr><td>Recibido / materiales / conversión</td>${inf.filas.map(f=>`<td class="num">${n(f.euAnt)} / ${n(f.euM)} / ${n(f.euC)}</td>`).join('')}</tr>
    <tr class="grupo-cta"><td colspan="${col}">Costos</td></tr>
    <tr><td>Recibido del proceso anterior</td>${inf.filas.map(f=>`<td class="num">${Q(f.ant)}</td>`).join('')}</tr>
    <tr><td>Materiales</td>${inf.filas.map(f=>`<td class="num">${Q(f.mat)}</td>`).join('')}</tr>
    <tr><td>Conversión (MOD + CIF)</td>${inf.filas.map(f=>`<td class="num">${Q(f.conv)}</td>`).join('')}</tr>
    <tr><td>Costo unitario equivalente</td>${inf.filas.map(f=>`<td class="num">${Q(f.cuAnt+f.cuM+f.cuC)}</td>`).join('')}</tr>
    <tr class="total"><td>Transferido</td>${inf.filas.map(f=>`<td class="num">${Q(f.transferido)}</td>`).join('')}</tr>
    <tr><td>Pérdida anormal (a resultados)</td>${inf.filas.map(f=>`<td class="num">${Q(f.anormal)}</td>`).join('')}</tr>
    <tr><td>Queda en proceso</td>${inf.filas.map(f=>`<td class="num">${Q(f.enProceso)}</td>`).join('')}</tr>
  </tbody></table></div>`;
}

/* ---- Recetas ---- */
function vistaRecetas(e){
  const lista=(e.recetas||[]).slice().sort((a,b)=>a.producto.localeCompare(b.producto,'es'));
  const m=metodoProduccion(e);
  return cab('Recetas y fórmulas',`Lo que debe usarse para producir: por unidad producida o como proporción de la materia prima base.${m==='estandar'?' Con costo estándar, la receta con sus precios estándar es la hoja de costo estándar.':''}`,
    `<button class="btn sec" data-accion="volverProduccion">Volver</button><button class="btn" data-accion="editarReceta">Nueva receta</button>`)
  + (lista.length?`<table><thead><tr><th>Producto</th><th>Proceso</th><th>Base</th><th class="num">Materiales</th><th class="num">Horas MOD por base</th>${m==='estandar'?'<th class="num">Costo estándar por unidad</th>':''}<th></th></tr></thead><tbody>
    ${lista.map(r=>`<tr><td>${esc(r.producto)}</td><td>${r.centroId?esc(nombreCentro(e,r.centroId)):'Todos'}</td><td>Por ${esc(r.baseTipo==='materia'?`${r.baseUnidad} de ${r.materiaBase||'materia prima'}`:(r.baseUnidad||'unidad'))}</td>
      <td class="num">${(r.lineas||[]).length}</td><td class="num">${fmtCant(+r.horasStd||0)}</td>${m==='estandar'?`<td class="num">${Q(hojaEstandar(e,r).total)}</td>`:''}
      <td class="num" style="white-space:nowrap"><button class="btn mini sec" data-accion="hojaProduccion" data-id="${r.id}">Hoja para producción</button> <button class="btn mini sec" data-accion="editarReceta" data-id="${r.id}">Editar</button> <button class="btn mini peligro" data-accion="borrarReceta" data-id="${r.id}">Eliminar</button></td></tr>`).join('')}</tbody></table>`
    :`<div class="vacio">Todavía no hay recetas. Ejemplos: un zapato (piezas de cuero, suela, hilo y pegamento por par) o una fórmula de tenería (cada químico como % del peso del cuero; el acabado en litros por hoja).</div>`)
  + `<div class="aviso">Con una receta, cada orden o corrida puede "Consumir según receta" (calcula y descarga del inventario lo que corresponde) y muestra el control de lo que debía usarse frente a lo que se usó: si se usó más, menos o según la receta. Las cantidades tienen que estar en la misma unidad en que se lleva el material en el inventario (kg, lb, litros, unidades).</div>`;
}
ACCIONES.verRecetas=()=>{ pantallaProd='recetas'; ordenProdActual=null; pintar(); };
ACCIONES.editarReceta=d=>{
  const e=emp(); e.recetas=e.recetas||[];
  const x=d&&d.id?e.recetas.find(r=>r.id===d.id):null, c=cfgCostos(e), m=metodoProduccion(e);
  const mats=inventarioDetalle(e).lista.map(p=>p.producto);
  /* Arranca con los materiales que ya tiene (o una fila vacía) y "Agregar material" suma filas. */
  const lineas=x&&x.lineas.length?[...x.lineas]:[null];
  const fila=(l,i)=>`<tr>
    <td style="width:40%"><input name="l_mat_${i}" list="dlMatReceta" value="${esc(l?l.material:'')}" style="min-width:180px;width:100%" aria-label="Material ${i+1}"></td>
    <td><select name="l_modo_${i}" style="min-width:178px" aria-label="Forma de la cantidad ${i+1}"><option value="cantidad"${l&&l.modo!=='porcentaje'?' selected':''}>Cantidad por base</option><option value="porcentaje"${l&&l.modo==='porcentaje'?' selected':''}>% de la base</option></select></td>
    <td><input name="l_valor_${i}" type="number" step="0.0001" min="0" value="${l?l.valor:''}" style="width:96px" aria-label="Cantidad ${i+1}"></td>
    <td><input name="l_unidad_${i}" value="${esc(l?l.unidad||'':'')}" style="width:70px" placeholder="kg" aria-label="Unidad ${i+1}"></td>
    ${m==='estandar'?`<td><input name="l_precio_${i}" type="number" step="0.0001" min="0" value="${l&&l.precioStd!==undefined?l.precioStd:''}" style="width:96px" aria-label="Precio estándar ${i+1}"></td>`:''}</tr>`;
  abrirModal(x?`Editar receta — ${esc(x.producto)}`:'Nueva receta',
    `<div class="rej">
      <div class="campo"><label>Producto que se fabrica</label><input name="producto" list="dlProdReceta" value="${esc(x?x.producto:'')}"><datalist id="dlProdReceta">${productosConocidos(e).map(p=>`<option value="${esc(p)}">`).join('')}</datalist></div>
      <div class="campo"><label>Proceso</label><select name="centroId"><option value="">Todos / no aplica</option>${c.centros.map(cc=>`<option value="${cc.id}"${x&&x.centroId===cc.id?' selected':''}>${esc(cc.nombre)}</option>`).join('')}</select></div>
      <div class="campo"><label>Las cantidades son</label><select name="baseTipo"><option value="producto"${!x||x.baseTipo!=='materia'?' selected':''}>Por unidad producida</option><option value="materia"${x&&x.baseTipo==='materia'?' selected':''}>Por unidad de la materia prima base (peso, volumen…)</option></select></div>
      <div class="campo"><label>Unidad de la base</label><input name="baseUnidad" value="${esc(x?x.baseUnidad||'':'')}" placeholder="par, kg, lb, hoja, litro"></div>
      <div class="campo"><label>Materia prima base (si aplica)</label><input name="materiaBase" value="${esc(x?x.materiaBase||'':'')}" placeholder="Ej.: cuero salado"></div>
      <div class="campo"><label>Horas de mano de obra por base</label><input name="horasStd" type="number" step="0.0001" min="0" value="${x?x.horasStd||'':''}"></div>
      ${basesEnUso(e).has('horasMaquina')?`<div class="campo"><label>Horas máquina por base</label><input name="horasMaqStd" type="number" step="0.0001" min="0" value="${x?x.horasMaqStd||'':''}"></div>`:''}
    </div>
    <datalist id="dlMatReceta">${mats.map(p=>`<option value="${esc(p)}">`).join('')}</datalist>
    <div class="tabla-scroll" style="margin-top:12px"><table style="font-size:13px"><thead><tr><th>Material</th><th>Forma</th><th>Cantidad</th><th>Unidad</th>${m==='estandar'?'<th>Precio estándar</th>':''}</tr></thead>
      <tbody id="filasReceta">${lineas.map(fila).join('')}</tbody></table></div>
    <button class="btn mini sec" type="button" id="agregarMaterial" style="margin-top:10px">+ Agregar material</button>
    <div class="campo" style="margin-top:14px"><label>Pasos o indicaciones de preparación (opcional, salen en la hoja de producción)</label><textarea name="instrucciones" rows="3" style="width:100%" placeholder="Ej.: 1. Lavar y pelar la fruta. 2. Disolver el azúcar en el agua tibia. 3. Mezclar y pasteurizar a 85 °C.">${esc(x?x.instrucciones||'':'')}</textarea></div>
    <p style="margin:10px 0 0;font-size:12.5px;color:var(--tinta-suave)">Tenería: base "kg de cuero" y cada químico como "% de la base" (por ejemplo, sal 8 %, cromo 6 %). Acabado: base "hoja" y cada producto en "cantidad por base" (litros por hoja). Calzado: base "par" y las piezas por par.</p>`,
    d=>{
      const producto=(d.producto||'').trim(); if(!producto){avisar('Escribí el producto.');return false}
      const filasN=mForm.querySelectorAll('[name^="l_mat_"]').length;
      const ls=Array.from({length:filasN},(_,i)=>({material:(d['l_mat_'+i]||'').trim(),modo:d['l_modo_'+i]==='porcentaje'?'porcentaje':'cantidad',valor:+d['l_valor_'+i]||0,unidad:(d['l_unidad_'+i]||'').trim(),
        ...(m==='estandar'?{precioStd:+d['l_precio_'+i]||0}:{})})).filter(l=>l.material||l.valor);
      if(!ls.length){avisar('Agregá al menos un material.');return false}
      if(ls.some(l=>!l.material||!(l.valor>0))){avisar('Cada material necesita su nombre y una cantidad mayor que cero.');return false}
      if(new Set(ls.map(l=>l.material)).size!==ls.length){avisar('Hay un material repetido en la receta.');return false}
      if(d.baseTipo==='materia'&&!(d.baseUnidad||'').trim()){avisar('Escribí la unidad de la base (kg, lb, hoja…).');return false}
      if(m==='estandar'&&ls.some(l=>!(l.precioStd>0))){avisar('Con costo estándar, cada material necesita su precio estándar.');return false}
      const dup=e.recetas.find(r=>r.producto===producto&&(r.centroId||'')===(d.centroId||'')&&(!x||r.id!==x.id));
      if(dup){avisar('Ese producto ya tiene una receta para ese proceso: editala.');return false}
      const datos={producto,centroId:d.centroId||'',baseTipo:d.baseTipo==='materia'?'materia':'producto',baseUnidad:(d.baseUnidad||'').trim()||(d.baseTipo==='materia'?'':'unidad'),
        materiaBase:(d.materiaBase||'').trim(),horasStd:+d.horasStd||0,horasMaqStd:+d.horasMaqStd||0,instrucciones:(d.instrucciones||'').trim(),lineas:ls};
      if(x) Object.assign(x,datos); else e.recetas.push({id:uid(),...datos});
      registrarLog(x?'Editó una receta de producción':'Creó una receta de producción',`${producto} — ${ls.length} materiales`);
      guardar();
    },x?'Guardar receta':'Crear receta');
  document.getElementById('agregarMaterial').onclick=()=>{
    const cuerpo=document.getElementById('filasReceta'), i=cuerpo.querySelectorAll('tr').length;
    cuerpo.insertAdjacentHTML('beforeend',fila(null,i));
    const nuevo=mForm.querySelector(`[name="l_mat_${i}"]`); nuevo.focus(); nuevo.scrollIntoView({block:'nearest'});
  };
};
ACCIONES.borrarReceta=d=>{
  const e=emp(), r=(e.recetas||[]).find(x=>x.id===d.id); if(!r) return;
  if((e.ordenesProduccion||[]).some(o=>o.recetaId===r.id&&o.estado==='abierta')){avisar('Hay órdenes o corridas abiertas que usan esa receta.');return}
  confirmar(`Se eliminará la receta de ${r.producto}. Lo ya registrado no cambia.`,()=>{ e.recetas=e.recetas.filter(x=>x.id!==r.id); registrarLog('Eliminó una receta de producción',r.producto); guardar(); pintar(); },'Eliminar');
};

/* ---- Configuración ---- */
/* Tarifa por hora sugerida a partir de la última planilla: costo laboral total ÷ horas ordinarias. */
function tarifaDesdePlanilla(e){
  const pl=(e.planillas||[]).slice().sort((a,b)=>(b.fechaPago||'').localeCompare(a.fechaPago||''))[0];
  if(!pl) return null;
  const costo=pl.detalle.reduce((s,f)=>s+(f.salarioPeriodo||0)+(f.montoHorasExtra||0)+(f.montoHorasExtraDomingo||0)+(f.bonoAdicional||0)-(f.descuentoHorasMenos||0)+(f.bonifPeriodo||0)
    +(f.igssPatronal||0)+(f.intecap||0)+(f.irtra||0)+Object.values(f.prestaciones||{}).reduce((a,b)=>a+(b||0),0),0);
  const horas=pl.detalle.length*HORAS_MES*(pl.periodo==='semanal'?7/30:pl.periodo==='quincenal'?0.5:1);
  return {planilla:pl,costo:r2(costo),horas,tarifa:horas>0?costo/horas:0};
}
ACCIONES.configuracionCostos=()=>{
  const e=emp(), c=cfgCostos(e);
  const reservadas=new Set([CTA_CIF_APLICADOS,CTA_VAR_CIF,CTA_PERDIDA_ANORMAL,...VARIACIONES_DETALLE.map(v=>v[1])]);
  const gastos=e.cuentas.filter(x=>x.d&&(x.t==='gasto'||x.t==='costo')&&!reservadas.has(x.c)&&!['5.1.01','5.1.02','5.1.03','5.1.04'].includes(x.c));
  const opcionesBase=sel=>Object.entries(BASES_CIF).map(([k,v])=>`<option value="${k}"${k===sel?' selected':''}>${v.nombre}</option>`).join('');
  /* Parámetros guardados de cada proceso, por nombre (los procesos se pueden renombrar o agregar en esta misma ventana). */
  const guardadoPorNombre={}; c.centros.forEach(x=>{ guardadoPorNombre[x.nombre.toLowerCase()]=c.cif.procesos[x.id]||null; });
  const asigPorNombre={}; Object.entries(c.cif.asignacion||{}).forEach(([cta,id])=>{ const cc=c.centros.find(x=>x.id===id); if(cc) asigPorNombre[cta]=cc.nombre.toLowerCase(); });
  abrirModal('Configuración de costos',
    `<h4 style="margin:0 0 8px">Procesos o departamentos</h4>
     <p style="margin:0 0 8px;font-size:13px;color:var(--tinta-suave)">Uno por línea, en el orden en que pasa la producción (por ejemplo: Corte, Aparado, Montaje, Acabado; o Ribera, Curtido, Recurtido, Acabado). En proceso continuo, cada corrida recorre estos procesos; en órdenes, sirven para saber en qué proceso se trabajó.</p>
     <textarea name="centros" rows="4" style="width:100%" aria-label="Procesos">${esc(c.centros.map(x=>x.nombre).join('\n'))}</textarea>
     <h4 style="margin:18px 0 8px">Mano de obra directa</h4>
     <div class="rej">
       <div class="campo"><label>Tarifa por hora (todos los procesos)</label><input name="tarifaGeneral" type="number" step="0.01" min="0" value="${c.tarifaGeneral||''}"></div>
       <div class="campo"><label>Se traslada desde la cuenta</label><select name="cuentaMOD">${gastos.map(x=>`<option value="${x.c}"${x.c===c.cuentaMOD?' selected':''}>${x.c} — ${esc(x.n)}</option>`).join('')}</select></div>
     </div>
     <p style="margin:6px 0 0;font-size:13px"><button class="btn mini sec" type="button" id="sugerirTarifa">Calcular la tarifa desde la última planilla</button> <span id="tarifaSugerida" style="color:var(--tinta-suave)"></span></p>
     ${c.centros.length>1?`<div class="tabla-scroll" style="margin-top:8px"><table style="font-size:13px"><thead><tr><th>Proceso</th><th>Tarifa propia por hora (opcional)</th></tr></thead><tbody>
       ${c.centros.map(x=>`<tr><td>${esc(x.nombre)}</td><td><input name="tarifa_${x.id}" type="number" step="0.01" min="0" value="${c.tarifas[x.id]||''}" placeholder="usa la general" style="width:140px" aria-label="Tarifa de ${esc(x.nombre)}"></td></tr>`).join('')}</tbody></table></div>`:''}
     <h4 style="margin:18px 0 8px">Costos indirectos de fabricación (CIF)</h4>
     <div class="rej">
       <div class="campo full"><label>Cómo se cargan</label><select name="modo">
         <option value="tasa"${c.cif.modo==='tasa'?' selected':''}>Tasa predeterminada (presupuesto ÷ capacidad normal) — costeo normal</option>
         <option value="real"${c.cif.modo==='real'?' selected':''}>Reales del período, repartidos al final — costeo real</option></select></div>
     </div>
     <div id="cifTasa">
     <div class="rej" style="margin-top:12px" id="estructuraCampo">
       <div class="campo full"><label>Tasa</label><select name="estructura">
         <option value="planta"${!c.cif.porProceso?' selected':''}>Una sola tasa para toda la planta (empresas pequeñas o procesos parecidos)</option>
         <option value="proceso"${c.cif.porProceso?' selected':''}>Una tasa por proceso (cuando los procesos consumen CIF muy distinto)</option></select></div>
     </div>
     <div class="rej" style="margin-top:12px" id="cifPlanta">
       <div class="campo"><label>Base de aplicación</label><select name="base">${opcionesBase(c.cif.base)}</select></div>
       <div class="campo"><label>Capacidad normal anual (en la base)</label><input name="capacidadNormal" type="number" step="0.01" min="0" value="${c.cif.capacidadNormal||''}"></div>
       <div class="campo"><label>CIF fijos presupuestados del año (Q)</label><input name="presupuestoFijo" type="number" step="0.01" min="0" value="${c.cif.presupuestoFijo||''}"></div>
       <div class="campo"><label>CIF variable por unidad de base (Q, opcional)</label><input name="variablePorBase" type="number" step="0.0001" min="0" value="${c.cif.variablePorBase||''}"></div>
     </div>
     <div id="cifProcesos" hidden style="margin-top:12px">
       <p style="margin:0 0 8px;font-size:13px;color:var(--tinta-suave)">Cada proceso con su propio presupuesto de CIF, su capacidad normal y su base (por ejemplo, horas de mano de obra en un proceso manual y horas máquina en uno mecanizado). Cada boleta aplica la tasa del proceso donde se trabajó, así que los CIF no se duplican: cada proceso absorbe solo los suyos.</p>
       <div class="tabla-scroll"><table style="font-size:13px"><thead><tr><th>Proceso</th><th>Base de aplicación</th><th>Capacidad normal anual</th><th>CIF fijos del año (Q)</th><th>Variable por base (Q)</th><th class="num">Tasa</th></tr></thead><tbody id="filasProcesosCIF"></tbody></table></div>
     </div>
     <details id="estimador" style="margin-top:12px;border:1px solid var(--linea);border-radius:var(--radio-chico);padding:10px 14px"${!(c.cif.capacidadNormal>0)&&!c.cif.porProceso?' open':''}>
       <summary style="cursor:pointer;font-weight:600;font-size:14px">¿Empresa nueva, sin estos datos? Estimar la tasa</summary>
       <p style="margin:8px 0 10px;font-size:13px;color:var(--tinta-suave)">Sin historia, la tasa se arma con una estimación técnica de lo que se espera. Después de unos meses se ajusta con "Calcular con lo registrado".</p>
       <div class="rej">
         <div class="campo full" id="estDestinoCampo" hidden><label>Estimar para el proceso</label><select name="est_destino"></select></div>
         <div class="campo"><label id="estCantLbl">Trabajadores directos en producción</label><input name="est_cant" type="number" step="1" min="0" value="${(e.empleados||[]).filter(x=>x.activo!==false).length||''}"></div>
         <div class="campo" id="estHorasCampo"><label id="estHorasLbl">Horas de cada uno al mes</label><input name="est_horas" type="number" step="0.01" min="0" value="${HORAS_MES.toFixed(2)}"></div>
         <div class="campo" id="estPctCampo"><label>% del tiempo que se produce</label><input name="est_pct" type="number" step="1" min="1" max="100" value="85"></div>
         <div class="campo"><label>Gastos indirectos esperados por mes (Q)</label><input name="est_gasto" type="number" step="0.01" min="0" placeholder="energía, alquiler de planta, mantenimiento…"></div>
       </div>
       <p style="margin:8px 0 0;font-size:12.5px;color:var(--tinta-suave)">Incluí lo que cuesta tener la planta (o ese proceso) funcionando aunque no se produzca: energía, alquiler o depreciación de local y maquinaria, mantenimiento, supervisión, seguros. No incluyas materiales ni sueldos de quienes producen (esos ya van directo). Las horas por defecto son la jornada ordinaria de 44 horas semanales.</p>
       <p style="margin:10px 0 0"><button class="btn mini" type="button" id="usarEstimacion">Usar esta estimación</button> <span id="estRes" style="font-size:13px;color:var(--tinta-suave)"></span></p>
     </details>
     <p style="margin:10px 0 0;font-size:13px"><button class="btn mini sec" type="button" id="calcRegistrado">Calcular con lo registrado</button> <span id="regRes" style="color:var(--tinta-suave)"></span></p>
     <p id="tasaPrev" style="margin:10px 0 0;font-weight:600"></p>
     </div>
     <p id="realNota" style="margin:10px 0 0;font-size:13px;color:var(--tinta-suave)" hidden>Con costeo real no hace falta presupuesto ni capacidad: al final de cada período, los CIF que realmente se gastaron se reparten entre las órdenes o corridas con "Repartir costo común". Es lo más sencillo para empezar; cuando haya unos meses de historia se puede pasar a tasa predeterminada.</p>
     <p style="margin:12px 0 6px;font-size:13px;color:var(--tinta-suave)">Cuentas donde la empresa registra los CIF reales (energía de la planta, depreciación de maquinaria, mantenimiento, mano de obra indirecta…). Al cierre del período se comparan con los aplicados.<span id="asigAyuda" hidden> Con tasa por proceso, indicá de qué proceso es cada cuenta si es propia de uno; las compartidas se reparten según lo aplicado.</span></p>
     <div style="max-height:220px;overflow:auto;border:1px solid var(--linea);border-radius:var(--radio-chico);padding:8px 12px" id="listaCuentasCIF">
       ${gastos.map(x=>`<div style="display:flex;gap:10px;align-items:center;justify-content:space-between;padding:3px 0"><label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" name="cifcta_${x.c}"${c.cif.cuentas.includes(x.c)?' checked':''}> ${x.c} — ${esc(x.n)}</label>
         <select name="asig_${x.c}" class="asigCuenta" data-guardado="${esc(asigPorNombre[x.c]||'')}" style="width:auto;min-width:160px;font-size:12.5px;padding:4px 8px" aria-label="Proceso de la cuenta ${x.c}" hidden></select></div>`).join('')}
     </div>
     <div class="aviso" style="margin-top:14px">NIC 2: la capacidad normal es la producción esperada en circunstancias normales (promedio de varios períodos). Así, un mes de baja producción no encarece cada unidad: el CIF no absorbido queda como subaplicación y va a resultados.</div>`,
    d=>{
      const nombres=(d.centros||'').split('\n').map(s=>s.trim()).filter(Boolean);
      if(!nombres.length){avisar('Escribí al menos un proceso.');return false}
      if(new Set(nombres.map(n=>n.toLowerCase())).size!==nombres.length){avisar('Hay un proceso repetido.');return false}
      const centros=nombres.map(n=>{ const ex=c.centros.find(x=>x.nombre.toLowerCase()===n.toLowerCase()); return {id:ex?ex.id:uid(),nombre:n}; });
      const usados=new Set((e.ordenesProduccion||[]).filter(o=>o.estado==='abierta').flatMap(o=>[...(o.centros||[]),...[...o.materiales,...o.manoObra,...o.cif].map(x=>x.centroId)]).filter(Boolean));
      const quitados=c.centros.filter(x=>!centros.some(y=>y.id===x.id)&&usados.has(x.id));
      if(quitados.length){avisar(`No se puede quitar ${quitados.map(x=>x.nombre).join(', ')}: lo usan órdenes o corridas abiertas.`);return false}
      const cuentas=gastos.filter(x=>d['cifcta_'+x.c]==='on').map(x=>x.c);
      if(d.modo!=='real'&&cuentas.includes(d.cuentaMOD)){avisar(`La cuenta ${d.cuentaMOD} es la de donde se traslada la mano de obra directa: no puede ser también una cuenta de CIF reales (se contaría dos veces).`);return false}
      const porProceso=d.modo!=='real'&&d.estructura==='proceso'&&centros.length>1;
      const procesos={};
      if(porProceso) centros.forEach((x,i)=>{ procesos[x.id]={base:BASES_CIF[d['pp_base_'+i]]?d['pp_base_'+i]:'horasMOD',capacidadNormal:+d['pp_cap_'+i]||0,presupuestoFijo:+d['pp_fijo_'+i]||0,variablePorBase:+d['pp_var_'+i]||0}; });
      const asignacion={};
      if(porProceso) cuentas.forEach(cta=>{ const n=(d['asig_'+cta]||'').toLowerCase(); const cc=centros.find(x=>x.nombre.toLowerCase()===n); if(cc) asignacion[cta]=cc.id; });
      const tarifas={}; centros.forEach(x=>{ const v=+d['tarifa_'+x.id]; if(v>0) tarifas[x.id]=v; });
      e.costos={centros,tarifaGeneral:+d.tarifaGeneral||0,tarifas,cuentaMOD:d.cuentaMOD,
        cif:{modo:d.modo==='real'?'real':'tasa',base:BASES_CIF[d.base]?d.base:'horasMOD',capacidadNormal:+d.capacidadNormal||0,presupuestoFijo:+d.presupuestoFijo||0,variablePorBase:+d.variablePorBase||0,cuentas,porProceso,procesos,asignacion}};
      registrarLog('Configuró los costos de producción',`${centros.length} procesos · tarifa Q${Q(+d.tarifaGeneral||0)} · CIF ${d.modo==='real'?'reales':porProceso?'tasa por proceso':'tasa Q'+tasaCIF(e).toFixed(4)}`);
      guardar();
    },'Guardar configuración');
  const g=n=>mForm.querySelector(`[name="${n}"]`);
  const nombresActuales=()=>(g('centros').value||'').split('\n').map(s=>s.trim()).filter(Boolean);
  const porProcesoUI=()=>g('modo').value!=='real'&&g('estructura').value==='proceso'&&nombresActuales().length>1;
  /* Filas por proceso: se rearman cuando cambia la lista de procesos, conservando lo escrito por nombre. */
  let escritoPorNombre={};
  const leerFilas=()=>{ document.querySelectorAll('#filasProcesosCIF tr').forEach(tr=>{ const n=tr.dataset.nombre, i=tr.dataset.i;
    escritoPorNombre[n]={base:g('pp_base_'+i).value,capacidadNormal:g('pp_cap_'+i).value,presupuestoFijo:g('pp_fijo_'+i).value,variablePorBase:g('pp_var_'+i).value}; }); };
  const armarFilas=()=>{
    leerFilas();
    const filas=nombresActuales().map((n,i)=>{ const k=n.toLowerCase(), v=escritoPorNombre[k]||guardadoPorNombre[k]||{base:g('base').value};
      return `<tr data-nombre="${esc(k)}" data-i="${i}"><td>${esc(n)}</td>
        <td><select name="pp_base_${i}" aria-label="Base de ${esc(n)}" style="min-width:190px">${opcionesBase(v.base||'horasMOD')}</select></td>
        <td><input name="pp_cap_${i}" type="number" step="0.01" min="0" value="${v.capacidadNormal||''}" style="width:120px" aria-label="Capacidad de ${esc(n)}"></td>
        <td><input name="pp_fijo_${i}" type="number" step="0.01" min="0" value="${v.presupuestoFijo||''}" style="width:120px" aria-label="CIF fijos de ${esc(n)}"></td>
        <td><input name="pp_var_${i}" type="number" step="0.0001" min="0" value="${v.variablePorBase||''}" style="width:100px" aria-label="Variable de ${esc(n)}"></td>
        <td class="num" id="pp_tasa_${i}">—</td></tr>`; }).join('');
    document.getElementById('filasProcesosCIF').innerHTML=filas;
    document.querySelectorAll('#filasProcesosCIF input,#filasProcesosCIF select').forEach(i=>{ i.addEventListener('input',prev); i.addEventListener('change',prev); });
    const opcProc=nombresActuales().map(n=>`<option value="${esc(n.toLowerCase())}">${esc(n)}</option>`).join('');
    g('est_destino').innerHTML=opcProc;
    document.querySelectorAll('.asigCuenta').forEach(s=>{ const actual=s.value||s.dataset.guardado; s.innerHTML=`<option value="">Compartida</option>${opcProc}`; s.value=[...s.options].some(o=>o.value===actual)?actual:''; });
  };
  const prev=()=>{
    const real=g('modo').value==='real', pp=porProcesoUI(), multi=nombresActuales().length>1;
    document.getElementById('cifTasa').hidden=real; document.getElementById('realNota').hidden=!real;
    document.getElementById('estructuraCampo').hidden=!multi;
    document.getElementById('cifPlanta').hidden=pp; document.getElementById('cifProcesos').hidden=!pp;
    document.getElementById('estDestinoCampo').hidden=!pp; document.getElementById('asigAyuda').hidden=!pp;
    document.querySelectorAll('.asigCuenta').forEach(s=>{ const chk=g('cifcta_'+s.name.slice(5)); s.hidden=!pp||!chk.checked; });
    const base=pp?(g('pp_base_'+nombresActuales().findIndex(n=>n.toLowerCase()===g('est_destino').value))||g('base')).value:g('base').value;
    document.getElementById('estCantLbl').textContent=base==='horasMaquina'?'Máquinas en producción':base==='unidades'?'Unidades que se esperan producir al mes':'Trabajadores directos en producción';
    document.getElementById('estHorasLbl').textContent=base==='horasMaquina'?'Horas de cada máquina al mes':'Horas de cada uno al mes';
    document.getElementById('estHorasCampo').hidden=base==='unidades'; document.getElementById('estPctCampo').hidden=base==='unidades';
    if(pp){
      nombresActuales().forEach((n,i)=>{ const t=tasaDe({capacidadNormal:g('pp_cap_'+i).value,presupuestoFijo:g('pp_fijo_'+i).value,variablePorBase:g('pp_var_'+i).value});
        document.getElementById('pp_tasa_'+i).textContent=`Q${t.toFixed(4)}`; });
      document.getElementById('tasaPrev').textContent='Cada proceso aplica su propia tasa a las boletas que se registran en él.';
    }else{
      const cap=+g('capacidadNormal').value||0, fijo=+g('presupuestoFijo').value||0, vari=+g('variablePorBase').value||0;
      document.getElementById('tasaPrev').textContent=`Tasa predeterminada: Q${Q(fijo)} ÷ ${cap||0} + Q${vari} = Q${tasaDe({capacidadNormal:cap,presupuestoFijo:fijo,variablePorBase:vari}).toFixed(4)} por ${BASES_CIF[g('base').value].una}`;
    }
  };
  mForm.querySelectorAll('input,select,textarea').forEach(i=>{ i.addEventListener('input',prev); i.addEventListener('change',prev); });
  g('centros').addEventListener('input',()=>{ armarFilas(); prev(); });
  armarFilas(); prev();
  /* Destino de una estimación o de un cálculo: los campos de la planta o la fila del proceso elegido. */
  const camposDestino=idx=>idx===null?{base:g('base'),cap:g('capacidadNormal'),fijo:g('presupuestoFijo')}:{base:g('pp_base_'+idx),cap:g('pp_cap_'+idx),fijo:g('pp_fijo_'+idx)};
  /* Estimación técnica para una empresa nueva: capacidad = cantidad × horas × 12 × % de aprovechamiento. */
  document.getElementById('usarEstimacion').onclick=()=>{
    const idx=porProcesoUI()?nombresActuales().findIndex(n=>n.toLowerCase()===g('est_destino').value):null, dest=camposDestino(idx);
    const base=dest.base.value, cant=+g('est_cant').value||0, horas=+g('est_horas').value||0, pct=(+g('est_pct').value||0)/100, gasto=+g('est_gasto').value||0;
    const out=document.getElementById('estRes');
    if(!(cant>0)||!(gasto>0)||(base!=='unidades'&&(!(horas>0)||!(pct>0)))){ out.textContent='Completá los datos de la estimación.'; return; }
    let cap=base==='unidades'?cant*12:cant*horas*12*pct;
    if(base==='costoMOD'){ const t=+g('tarifaGeneral').value||0; if(!(t>0)){ out.textContent='Para la base "costo de mano de obra" primero escribí la tarifa por hora.'; return; } cap*=t; }
    dest.cap.value=Math.round(cap*100)/100; dest.fijo.value=Math.round(gasto*12*100)/100;
    out.textContent=`${idx!==null?nombresActuales()[idx]+': ':''}capacidad normal ${fmtCant(Math.round(cap*100)/100)} ${BASES_CIF[base].unidad} al año · CIF del año Q${Q(gasto*12)}.`;
    prev();
  };
  /* Con historia: promedio mensual de los CIF reales y de la base registrada, en los 12 meses que terminan en
     el último movimiento. Por proceso: sus cuentas propias más las compartidas repartidas según sus horas. */
  document.getElementById('calcRegistrado').onclick=()=>{
    const out=document.getElementById('regRes'), pp=porProcesoUI();
    const cuentas=gastos.filter(x=>g('cifcta_'+x.c)&&g('cifcta_'+x.c).checked).map(x=>x.c);
    if(!cuentas.length){ out.textContent='Primero marcá abajo las cuentas de CIF reales.'; return; }
    const cierres=new Set((e.cierresCIF||[]).map(x=>x.partidaId));
    const conCIF=e.partidas.filter(p=>!cierres.has(p.id)&&p.lineas.some(l=>cuentas.includes(l.cta)));
    const d1=conCIF.reduce((mx,p)=>p.fecha>mx?p.fecha:mx,'');
    const desde=new Date((d1||hoy())+'T12:00'); desde.setFullYear(desde.getFullYear()-1); const d0=desde.toISOString().slice(0,10);
    const meses=new Set(), realPorCuenta={};
    conCIF.filter(p=>p.fecha>d0).forEach(p=>p.lineas.forEach(l=>{ if(cuentas.includes(l.cta)){ realPorCuenta[l.cta]=(realPorCuenta[l.cta]||0)+(+l.debe||0)-(+l.haber||0); meses.add(p.fecha.slice(0,7)); } }));
    const real=Object.values(realPorCuenta).reduce((a,b)=>a+b,0);
    if(!meses.size||!(real>0)){ out.textContent='Todavía no hay CIF reales registrados en esas cuentas: usá la estimación.'; return; }
    const ords=e.ordenesProduccion||[], n=meses.size;
    const dentro=x=>x.fecha>d0&&meses.has(x.fecha.slice(0,7));
    const baseDe=(base,centroIds)=>{ const en=x=>!centroIds||centroIds.includes(x.centroId||'general');
      return base==='horasMOD'?ords.flatMap(o=>o.manoObra||[]).filter(x=>dentro(x)&&en(x)).reduce((s2,x)=>s2+(+x.horas||0),0)
        :base==='costoMOD'?ords.flatMap(o=>o.manoObra||[]).filter(x=>dentro(x)&&en(x)).reduce((s2,x)=>s2+(+x.monto||0),0)
        :base==='horasMaquina'?ords.flatMap(o=>o.manoObra||[]).filter(x=>dentro(x)&&en(x)).reduce((s2,x)=>s2+(+x.horasMaq||0),0)
        :ords.filter(o=>o.estado==='cerrada'&&o.fechaCierre&&dentro({fecha:o.fechaCierre})).reduce((s2,o)=>s2+(+o.cantidadTerminada||0),0); };
    if(!pp){
      const base=g('base').value, cantBase=baseDe(base,null);
      if(!(cantBase>0)){ out.textContent=`Hay CIF reales en ${n} mes(es), pero todavía no hay ${BASES_CIF[base].unidad} registradas en producción: usá la estimación.`; return; }
      g('capacidadNormal').value=Math.round(cantBase/n*12*100)/100; g('presupuestoFijo').value=Math.round(real/n*12*100)/100;
      out.textContent=`Promedio de ${n} mes(es): CIF Q${Q(real/n)} y ${fmtCant(Math.round(cantBase/n*100)/100)} ${BASES_CIF[base].unidad} por mes.${n<3?' Con menos de 3 meses conviene revisarlo más adelante.':''}`;
      prev(); return;
    }
    /* Por proceso: horas MOD de cada uno para repartir las cuentas compartidas. */
    const nombres=nombresActuales(), ids=nombres.map(nm=>{ const cc=c.centros.find(x=>x.nombre.toLowerCase()===nm.toLowerCase()); return cc?cc.id:null; });
    const horasProc=ids.map(id=>id?baseDe('horasMOD',[id]):0), horasTot=horasProc.reduce((a,b)=>a+b,0);
    const compartido=cuentas.filter(cta=>!(g('asig_'+cta).value)).reduce((s2,cta)=>s2+(realPorCuenta[cta]||0),0);
    const res=[];
    nombres.forEach((nm,i)=>{
      if(!ids[i]){ res.push(`${nm}: sin datos todavía`); return; }
      const propio=cuentas.filter(cta=>g('asig_'+cta).value===nm.toLowerCase()).reduce((s2,cta)=>s2+(realPorCuenta[cta]||0),0);
      const realP=propio+(horasTot>0?compartido*horasProc[i]/horasTot:0);
      const base=g('pp_base_'+i).value, cantBase=baseDe(base,[ids[i]]);
      if(!(cantBase>0)||!(realP>0)){ res.push(`${nm}: sin ${BASES_CIF[base].unidad} o sin CIF registrados`); return; }
      g('pp_cap_'+i).value=Math.round(cantBase/n*12*100)/100; g('pp_fijo_'+i).value=Math.round(realP/n*12*100)/100;
      res.push(`${nm}: CIF Q${Q(realP/n)} y ${fmtCant(Math.round(cantBase/n*100)/100)} ${BASES_CIF[base].unidad} por mes`);
    });
    out.textContent=`Promedio de ${n} mes(es) — ${res.join(' · ')}.${compartido>0?' Las cuentas compartidas se repartieron según las horas de cada proceso.':''}${n<3?' Con menos de 3 meses conviene revisarlo más adelante.':''}`;
    prev();
  };
  document.getElementById('sugerirTarifa').onclick=()=>{
    const s=tarifaDesdePlanilla(e), out=document.getElementById('tarifaSugerida');
    if(!s){ out.textContent='No hay planillas generadas todavía.'; return; }
    g('tarifaGeneral').value=s.tarifa.toFixed(2);
    out.textContent=`Planilla del ${fFecha(s.planilla.fechaPago)}: costo laboral total Q${Q(s.costo)} (salario, extras, bonificación, cuota patronal y prestaciones) ÷ ${s.horas.toFixed(1)} horas ordinarias = Q${s.tarifa.toFixed(2)} por hora.`;
  };
};

ACCIONES.elegirMetodoProduccion=d=>{
  const e=emp(); if(!METODOS_PRODUCCION[d.metodo]) return;
  e.metodoProduccion=d.metodo;
  registrarLog('Eligió el método de costeo de producción',`${e.nombre} — ${METODOS_PRODUCCION[d.metodo].nombre}`);
  guardar(); pintar();
  if(avisoConfiguracion(e).length) ACCIONES.configuracionCostos();
};
ACCIONES.cambiarMetodoProduccion=()=>{
  const e=emp();
  if((e.ordenesProduccion||[]).some(o=>o.estado==='abierta')){avisar('Hay órdenes abiertas: cerrá o anulá todas antes de cambiar el método de costeo.');return}
  abrirModal('Cambiar el método de costeo',
    `<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">Método actual: <strong>${METODOS_PRODUCCION[metodoProduccion(e)].nombre}</strong>. Cambiarlo mezcla criterios dentro del mismo ejercicio: lo ya cerrado no se recalcula. Si la empresa cambió de forma de producir, conviene hacerlo al inicio de un ejercicio.</p>
    <div class="campo full"><label>Nuevo método</label><select name="metodo">${Object.entries(METODOS_PRODUCCION).map(([k,v])=>`<option value="${k}"${k===metodoProduccion(e)?' selected':''}>${v.nombre}</option>`).join('')}</select></div>`,
    d=>{
      if(d.metodo===metodoProduccion(e)){avisar('Ese ya es el método actual.');return false}
      e.metodoProduccion=d.metodo; ordenProdActual=null;
      registrarLog('Cambió el método de costeo de producción',`${e.nombre} — ahora ${METODOS_PRODUCCION[d.metodo].nombre}`);
      guardar(); pintar();
    },'Cambiar método');
};
ACCIONES.volverProduccion=()=>{ordenProdActual=null;pantallaProd=null;pintar()};
ACCIONES.abrirOrdenProduccion=d=>{ordenProdActual=d.id;pantallaProd=null;pintar()};

/* ---- Nueva orden / corrida ---- */
ACCIONES.nuevaOrdenProduccion=()=>{
  const e=emp(), m=metodoProduccion(e); if(!m) return;
  const etiqueta=m==='continuo'?'corrida':'orden', c=cfgCostos(e);
  const fin=new Date(hoy()+'T12:00'); fin.setMonth(fin.getMonth()+1,0);
  abrirModal(`Nueva ${etiqueta} de producción`,
    `<div class="rej">
      <div class="campo full"><label>Producto que se fabrica</label><input name="producto" list="dlProd2" placeholder="Nombre del producto terminado"><datalist id="dlProd2">${productosConocidos(e).map(p=>`<option value="${esc(p)}">`).join('')}</datalist></div>
      <div class="campo"><label>${m==='continuo'?'Inicio del período':'Fecha de inicio'}</label><input name="fecha" type="date" value="${hoy()}"></div>
      <div class="campo"><label>${m==='continuo'?'Fin del período':'Fecha de fin (prevista)'}</label><input name="fechaFin" type="date" value="${m==='continuo'?fin.toISOString().slice(0,10):''}"></div>
      <div class="campo"><label>Cantidad a producir</label><input name="cantidadPlan" type="number" step="0.01" min="0"></div>
      <div class="campo"><label>Receta</label><select name="recetaId"><option value="">${(e.recetas||[]).length?'La del producto (si tiene)':'Sin receta'}</option>${(e.recetas||[]).map(r=>`<option value="${r.id}">${esc(r.producto)}${r.centroId?' — '+esc(nombreCentro(e,r.centroId)):''}</option>`).join('')}</select></div>
      ${m==='continuo'&&c.centros.length>1?`<div class="campo full"><label>Procesos que recorre (en orden)</label>
        <div style="display:flex;gap:14px;flex-wrap:wrap">${c.centros.map(cc=>`<label style="display:flex;gap:6px;align-items:center;font-size:14px"><input type="checkbox" name="centro_${cc.id}" checked> ${esc(cc.nombre)}</label>`).join('')}</div></div>`:''}
      <div class="campo full"><label>Nota (cliente, pedido, lote…)</label><input name="nota" placeholder="Opcional"></div>
    </div>
    ${m==='estandar'?'<div class="aviso">Con costo estándar, el producto necesita su receta con precios estándar (botón "Recetas").</div>':''}`,
    d=>{
      const p=(d.producto||'').trim(); if(!p){avisar('Escribí el producto que se fabrica.');return false}
      if(!d.fecha){avisar('Escribí la fecha de inicio.');return false}
      if(d.fechaFin&&d.fechaFin<d.fecha){avisar('La fecha de fin no puede ser anterior a la de inicio.');return false}
      if(m==='continuo'&&!d.fechaFin){avisar('Escribí el fin del período de la corrida.');return false}
      let recetaId=d.recetaId||'';
      if(!recetaId){ const auto=(e.recetas||[]).find(r=>r.producto===p&&!r.centroId)||(e.recetas||[]).find(r=>r.producto===p); if(auto) recetaId=auto.id; }
      const receta=recetaId?(e.recetas||[]).find(r=>r.id===recetaId):null;
      if(m==='estandar'&&!receta&&!(e.costosEstandar||{})[p]){avisar('Ese producto no tiene receta con precios estándar. Creala primero en "Recetas".');return false}
      if(m==='estandar'&&receta&&receta.baseTipo!=='producto'){avisar('Para costo estándar la receta tiene que estar "por unidad producida".');return false}
      if(m==='estandar'&&receta&&(receta.lineas||[]).some(l=>!(+l.precioStd>0))){avisar('La receta de ese producto no tiene precios estándar: completalos en "Recetas".');return false}
      if(m==='continuo'&&e.ordenesProduccion.some(o=>o.producto===p&&o.estado==='abierta')){avisar('Ese producto ya tiene una corrida abierta: cerrala antes de abrir otra.');return false}
      const centros=m==='continuo'?(c.centros.length>1?c.centros.filter(cc=>d['centro_'+cc.id]==='on').map(cc=>cc.id):[c.centros[0].id]):undefined;
      if(m==='continuo'&&!centros.length){avisar('Elegí al menos un proceso.');return false}
      e.correlativoProd=(e.correlativoProd||0)+1;
      const o={id:uid(),numero:e.correlativoProd,tipo:m,producto:p,fechaInicio:d.fecha,fechaFin:d.fechaFin||'',cantidadPlan:+d.cantidadPlan||0,recetaId,
        nota:(d.nota||'').trim(),estado:'abierta',materiales:[],manoObra:[],cif:[],basesReceta:[]};
      if(m==='continuo'){
        o.centros=centros;
        const prev=(e.ordenesProduccion||[]).filter(x=>x.tipo==='continuo'&&x.producto===p&&x.estado==='cerrada').sort((a,b)=>(a.fechaCierre||'').localeCompare(b.fechaCierre||'')||a.numero-b.numero).pop();
        if(prev&&prev.wipPorCentro) o.inicialPorCentro=prev.wipPorCentro;
        else{ const ini=inicialProcesoContinuo(e,p); o.inicialPorCentro={[centros[0]]:{unidades:ini.unidades||0,ant:ini.ant||0,mat:ini.mat||0,conv:ini.conv||0}}; }
      }
      e.ordenesProduccion.push(o); ordenProdActual=o.id; pantallaProd=null;
      registrarLog('Abrió una orden de producción',`${etiqueta} ${o.numero} — ${p}`);
      guardar(); pintar();
    },`Crear ${etiqueta}`);
};
const ordenAbierta=(e,id)=>{ const o=(e.ordenesProduccion||[]).find(x=>x.id===id); if(!o){avisar('No se encontró esa orden.');return null} if(o.estado!=='abierta'){avisar('Esa orden ya está cerrada.');return null} return o; };
ACCIONES.fechasOrdenProduccion=d=>{
  const e=emp(), o=ordenAbierta(e,d.id); if(!o) return;
  abrirModal(`Período de la ${o.tipo==='continuo'?'corrida':'orden'} ${o.numero}`,
    `<div class="rej"><div class="campo"><label>Inicio</label><input name="ini" type="date" value="${o.fechaInicio}"></div>
      <div class="campo"><label>Fin</label><input name="fin" type="date" value="${o.fechaFin||''}"></div></div>`,
    f=>{
      if(!f.ini){avisar('Escribí la fecha de inicio.');return false}
      if(f.fin&&f.fin<f.ini){avisar('La fecha de fin no puede ser anterior a la de inicio.');return false}
      if(o.tipo==='continuo'&&!f.fin){avisar('La corrida necesita fecha de fin del período.');return false}
      const fuera=[...o.materiales,...o.manoObra,...o.cif].filter(x=>x.fecha<f.ini||(f.fin&&x.fecha>f.fin));
      if(fuera.length){avisar(`Hay ${fuera.length} registro(s) con fecha fuera de ese período (por ejemplo, ${fFecha(fuera[0].fecha)}). El período tiene que cubrir todo lo registrado.`);return false}
      o.fechaInicio=f.ini; o.fechaFin=f.fin||''; registrarLog('Cambió el período de una orden de producción',`${o.producto} — ${f.ini} al ${f.fin||'—'}`); guardar();
    },'Guardar');
};

/* Campo "proceso" para los formularios (solo si hay más de uno para elegir). */
const campoCentro=(e,o,sel)=>{ const cs=centrosDeOrden(e,o); return cs.length>1?`<div class="campo"><label>Proceso</label><select name="centroId">${cs.map(c=>`<option value="${c.id}"${c.id===sel?' selected':''}>${esc(c.nombre)}</option>`).join('')}</select></div>`:''; };
const centroElegido=(e,o,f)=>f.centroId||centrosDeOrden(e,o)[0].id;

/* ---- Requisición de materiales ---- */
function registrarMateriales(e,o,fecha,centroId,items,concepto){
  asegurarCuentasCostos(e);
  const costeados=items.map(it=>({...it,...costoSalidaInventario(e,it.producto,it.cantidad)}));
  const total=r2(costeados.reduce((s,x)=>s+x.costoTotal,0));
  const p=partidaProduccion(e,fecha,concepto,[
    ...costeados.map(x=>({cta:CTA_PEP,desc:`${x.producto} × ${fmtCant(x.cantidad)}`,debe:x.costoTotal,haber:0})),
    ...costeados.map(x=>({cta:'1.1.08',desc:x.producto,debe:0,haber:x.costoTotal}))]);
  e.salidasInventario=e.salidasInventario||[];
  costeados.forEach(x=>{
    const sid=uid();
    e.salidasInventario.push({id:sid,fecha,producto:x.producto,cantidad:x.cantidad,costoUnitario:x.costoUnitario,costoTotal:x.costoTotal,motivo:'produccion',ordenId:o.id});
    o.materiales.push({id:uid(),fecha,centroId,producto:x.producto,cantidad:x.cantidad,costoUnitario:x.costoUnitario,costoTotal:x.costoTotal,salidaId:sid,partidaId:p.id,partidaNumero:p.numero});
  });
  return {p,total};
}
ACCIONES.materialOrdenProduccion=d=>{
  const e=emp(), o=ordenAbierta(e,d.id); if(!o) return;
  const {lista}=inventarioDetalle(e);
  abrirModal('Requisición de materiales',
    `<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">Salen del inventario al costo del método de la empresa (${METODOS_COSTEO[metodoCosteo(e)]}) y pasan a Productos en proceso.</p>
    <div class="rej">
      <div class="campo full"><label>Material</label><select name="material">${lista.filter(p=>p.cantidad>0).map(p=>`<option value="${esc(p.producto)}">${esc(p.producto)} — disponible ${fmtCant(p.cantidad)}</option>`).join('')}</select></div>
      <div class="campo"><label>Cantidad</label><input name="cantidad" type="number" step="0.0001" min="0"></div>
      <div class="campo"><label>Fecha</label><input name="fecha" type="date" value="${fechaSugerida(o)}"></div>
      ${campoCentro(e,o)}
    </div><p id="prevMat" style="margin:8px 0 0;font-size:13px"></p>`,
    async f=>{
      const cantidad=+f.cantidad, prod=f.material;
      if(!prod){avisar('No hay materiales en existencia.');return false}
      if(!(cantidad>0)){avisar('Escribí la cantidad.');return false}
      const err=revisarFechaOrden(e,o,f.fecha); if(err){avisar(err);return false}
      const item=lista.find(x=>x.producto===prod), disp=item?item.cantidad:0;
      if(cantidad>disp&&!(await preguntar(`Solo hay ${fmtCant(disp)} en existencia de ${prod}. ¿Registrar de todos modos?`,'Registrar'))) return false;
      const {total}=registrarMateriales(e,o,f.fecha,centroElegido(e,o,f),[{producto:prod,cantidad}],`Producción — ${o.tipo==='continuo'?'corrida':'orden'} ${o.numero} — requisición: ${prod}`);
      registrarLog('Aplicó materiales a producción',`${o.producto} — ${prod} × ${cantidad} — Q${Q(total)}`);
      guardar(); pintar();
    },'Registrar requisición');
  const act=()=>{const sel=mForm.querySelector('[name="material"]'); const c=+mForm.querySelector('[name="cantidad"]').value||0;
    document.getElementById('prevMat').textContent=sel.value?`Costo que sale del inventario: Q${Q(costoSalidaInventario(e,sel.value,c).costoTotal)}`:'';};
  mForm.querySelector('[name="material"]').onchange=act; mForm.querySelector('[name="cantidad"]').oninput=act; act();
};
/* Consumo según receta: calcula lo que corresponde a la base (unidades a producir o peso de la materia
   prima base), deja corregir lo realmente usado y lo descarga del inventario en una sola partida. */
ACCIONES.consumirRecetaProduccion=d=>{
  const e=emp(), o=ordenAbierta(e,d.id); if(!o) return;
  const opciones=(e.recetas||[]).filter(x=>x.producto===o.producto||x.id===o.recetaId);
  const r=(d.receta&&opciones.find(x=>x.id===d.receta))||recetaDe(e,o)||opciones[0];
  if(!r){avisar('No hay receta para este producto. Creala en "Recetas".');return}
  const {lista}=inventarioDetalle(e);
  const disp=p=>{const x=lista.find(y=>y.producto===p);return x?x.cantidad:0};
  const baseSugerida=r.baseTipo==='producto'?(o.cantidadPlan||''):'';
  const selReceta=opciones.length>1?`<div class="campo full"><label>Receta</label><select name="recetaSel">${opciones.map(x=>`<option value="${x.id}"${x.id===r.id?' selected':''}>${esc(x.producto)}${x.centroId?' — '+esc(nombreCentro(e,x.centroId)):''} (por ${esc(etiquetaBase(x))})</option>`).join('')}</select></div>`:'';
  abrirModal(`Consumir según receta — ${esc(r.producto)}`,
    `<div class="rej">
      ${selReceta}
      <div class="campo"><label>${esc(r.baseTipo==='materia'?`${r.baseUnidad} de ${r.materiaBase||'materia prima base'} procesados`:`${r.baseUnidad||'Unidades'} a producir`)}</label><input name="base" type="number" step="0.0001" min="0" value="${baseSugerida}"></div>
      <div class="campo"><label>Fecha</label><input name="fecha" type="date" value="${fechaSugerida(o)}"></div>
      ${campoCentro(e,o,r.centroId)}
    </div>
    <table style="font-size:13px;margin-top:10px"><thead><tr><th>Material</th><th class="num">Según receta</th><th class="num">Realmente usado</th><th class="num">Disponible</th></tr></thead>
      <tbody>${r.lineas.map((l,i)=>`<tr><td>${esc(l.material)} <span style="font-size:12px;color:var(--tinta-suave)">${l.modo==='porcentaje'?`${l.valor} % de la base`:`${l.valor} ${esc(l.unidad||'')} por base`}</span></td>
        <td class="num" id="rc_teo_${i}">—</td><td class="num"><input name="rc_real_${i}" type="number" step="0.0001" min="0" style="width:110px" aria-label="Cantidad usada de ${esc(l.material)}"></td>
        <td class="num">${fmtCant(disp(l.material))}</td></tr>`).join('')}</tbody></table>
    <p id="rcTotal" style="margin:10px 0 0;font-size:13px"></p>
    <p style="margin:6px 0 0;font-size:12.5px;color:var(--tinta-suave)">"Realmente usado" arranca igual a la receta; cambialo si en planta se usó otra cantidad. La diferencia se verá en el control de consumo.</p>`,
    async f=>{
      const base=+f.base; if(!(base>0)){avisar('Escribí la base.');return false}
      const err=revisarFechaOrden(e,o,f.fecha); if(err){avisar(err);return false}
      const items=r.lineas.map((l,i)=>({producto:l.material,cantidad:+f['rc_real_'+i]||0})).filter(x=>x.cantidad>0);
      if(!items.length){avisar('No hay cantidades para descargar.');return false}
      const faltan=items.filter(x=>x.cantidad>disp(x.producto)+1e-9);
      if(faltan.length&&!(await preguntar(`No alcanza la existencia de: ${faltan.map(x=>`${x.producto} (hay ${fmtCant(disp(x.producto))}, se usan ${fmtCant(x.cantidad)})`).join(', ')}. ¿Registrar de todos modos?`,'Registrar'))) return false;
      const centroId=centroElegido(e,o,f);
      const {total}=registrarMateriales(e,o,f.fecha,centroId,items,`Producción — ${o.tipo==='continuo'?'corrida':'orden'} ${o.numero} — consumo según receta (${fmtCant(base)} ${r.baseUnidad||''})`);
      o.basesReceta=o.basesReceta||[]; o.basesReceta.push({fecha:f.fecha,base,centroId,recetaId:r.id});
      registrarLog('Consumió materiales según receta',`${o.producto} — base ${base} — Q${Q(total)}`);
      guardar(); pintar();
    },'Descargar del inventario');
  const g=n=>mForm.querySelector(`[name="${n}"]`);
  if(g('recetaSel')) g('recetaSel').onchange=()=>ACCIONES.consumirRecetaProduccion({id:o.id,receta:g('recetaSel').value});
  let baseAnterior=null;
  const act=()=>{
    const base=+g('base').value||0, teo=consumoTeorico(r,base);
    let total=0;
    teo.forEach((t,i)=>{ document.getElementById('rc_teo_'+i).textContent=`${fmtCant(t.cantidad)} ${t.unidad}`;
      const inp=g('rc_real_'+i); if(baseAnterior!==base) inp.value=t.cantidad||'';
      total+=costoSalidaInventario(e,t.material,+inp.value||0).costoTotal; });
    baseAnterior=base;
    document.getElementById('rcTotal').textContent=`Costo que sale del inventario: Q${Q(total)}`;
  };
  mForm.querySelectorAll('input').forEach(i=>i.addEventListener('input',act)); act();
};

/* ---- Boleta de tiempo: mano de obra directa (y CIF aplicado con la tasa) ---- */
ACCIONES.boletaManoObra=d=>{
  const e=emp(), o=ordenAbierta(e,d.id); if(!o) return;
  const c=cfgCostos(e), cs=centrosDeOrden(e,o);
  const empleados=(e.empleados||[]).filter(x=>x.activo!==false);
  /* La tasa (y su base) es la del proceso elegido en la boleta. */
  const aplica=centroId=>{ const pc=parametrosCIF(e,centroId); return c.cif.modo==='tasa'&&pc.base!=='unidades'&&pc.tasa>0?pc:null; };
  const aplicaCIF=cs.some(x=>aplica(x.id));
  const usaMaquina=c.cif.modo==='tasa'&&cs.some(x=>baseCIF(e,x.id)==='horasMaquina');
  abrirModal(`Boleta de mano de obra — ${o.tipo==='continuo'?'corrida':'orden'} ${o.numero}`,
    `<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">Horas trabajadas directamente en esta ${o.tipo==='continuo'?'corrida':'orden'}. Se trasladan desde ${esc(c.cuentaMOD)} (donde la planilla registró los sueldos) a Productos en proceso${aplicaCIF?', y se aplican los CIF con la tasa predeterminada':''}.</p>
    <div class="rej">
      <div class="campo"><label>Fecha</label><input name="fecha" type="date" value="${fechaSugerida(o)}"></div>
      ${campoCentro(e,o)}
      <div class="campo"><label>Empleado (opcional)</label><select name="empleadoId"><option value="">— Varios / cuadrilla —</option>${empleados.map(x=>`<option value="${x.id}">${esc(x.nombre)}${x.puesto?' — '+esc(x.puesto):''}</option>`).join('')}</select></div>
      <div class="campo"><label>Horas</label><input name="horas" type="number" step="0.01" min="0"></div>
      <div class="campo"><label>Tarifa por hora</label><input name="tarifa" type="number" step="0.01" min="0" value="${tarifaCentro(e,cs[0].id)||''}"></div>
      ${usaMaquina?'<div class="campo"><label>Horas máquina</label><input name="horasMaq" type="number" step="0.01" min="0"></div>':''}
      <div class="campo full"><label>Detalle</label><input name="descripcion" placeholder="Ej.: corte de 120 pares"></div>
    </div><p id="prevBoleta" style="margin:10px 0 0;font-size:13.5px"></p>`,
    async f=>{
      const horas=+f.horas, tarifa=+f.tarifa;
      if(!(horas>0)){avisar('Escribí las horas.');return false}
      if(!(tarifa>0)){avisar('Escribí la tarifa por hora (o configurala en "Configuración de costos").');return false}
      const err=revisarFechaOrden(e,o,f.fecha); if(err){avisar(err);return false}
      const monto=r2(horas*tarifa);
      const saldo=saldoNatural(c.cuentaMOD,movimientos(null,f.fecha));
      if(monto>saldo+0.004&&!(await preguntar(`La cuenta ${c.cuentaMOD} tiene Q${Q(saldo)} a esa fecha y vas a trasladar Q${Q(monto)}. Normalmente primero se registra la planilla. ¿Continuar?`))) return false;
      const centroId=centroElegido(e,o,f), emple=empleados.find(x=>x.id===f.empleadoId);
      const horasMaq=+f.horasMaq||0;
      const pc=aplica(centroId);
      const cantBase=!pc?0:pc.base==='horasMOD'?horas:pc.base==='costoMOD'?monto:pc.base==='horasMaquina'?horasMaq:0;
      const tasa=pc?pc.tasa:0, cif=pc?r2(cantBase*tasa):0;
      asegurarCuentasCostos(e);
      const cta=e.cuentas.find(x=>x.c===c.cuentaMOD);
      const p=partidaProduccion(e,f.fecha,`Producción — ${o.tipo==='continuo'?'corrida':'orden'} ${o.numero} — mano de obra ${horas} h${cif?' y CIF aplicado':''}`,[
        {cta:CTA_PEP,desc:`MOD ${horas} h × Q${Q(tarifa)}${emple?' — '+emple.nombre:''}`,debe:monto,haber:0},
        {cta:c.cuentaMOD,desc:'Mano de obra aplicada a producción',debe:0,haber:monto},
        ...(cif?[{cta:CTA_PEP,desc:`CIF aplicado${c.cif.porProceso?' ('+nombreCentro(e,centroId)+')':''}: Q${tasa.toFixed(4)} × ${Q(cantBase)} ${BASES_CIF[pc.base].unidad}`,debe:cif,haber:0},{cta:CTA_CIF_APLICADOS,desc:`CIF aplicados — ${o.producto}`,debe:0,haber:cif}]:[])]);
      o.manoObra.push({id:uid(),fecha:f.fecha,centroId,empleadoId:emple?emple.id:'',empleado:emple?emple.nombre:'',horas,horasMaq,tarifa,monto,descripcion:(f.descripcion||'').trim(),
        origen:`${c.cuentaMOD} ${cta?cta.n:''}`.trim(),partidaId:p.id,partidaNumero:p.numero});
      if(cif) o.cif.push({id:uid(),fecha:f.fecha,centroId,aplicado:true,base:pc.base,cantidadBase:cantBase,tasa,monto:cif,
        descripcion:`Aplicado: Q${tasa.toFixed(4)} × ${Q(cantBase)} ${BASES_CIF[pc.base].unidad}`,partidaId:p.id,partidaNumero:p.numero});
      registrarLog('Registró una boleta de mano de obra',`${o.producto} — ${horas} h — Q${Q(monto)}${cif?` + CIF Q${Q(cif)}`:''}`);
      guardar(); pintar();
    },'Registrar boleta');
  const g=n=>mForm.querySelector(`[name="${n}"]`);
  const act=()=>{
    const h=+g('horas').value||0, t=+g('tarifa').value||0, monto=h*t, hm=g('horasMaq')?+g('horasMaq').value||0:0;
    const pc=aplica(g('centroId')?g('centroId').value:cs[0].id);
    const cant=!pc?0:pc.base==='horasMOD'?h:pc.base==='costoMOD'?monto:hm;
    document.getElementById('prevBoleta').innerHTML=`Mano de obra: <strong>Q${Q(monto)}</strong>${pc?` · CIF aplicado: <strong>Q${Q(cant*pc.tasa)}</strong> (Q${pc.tasa.toFixed(4)} × ${Q(cant)} ${BASES_CIF[pc.base].unidad})`:''}`;
  };
  if(g('centroId')) g('centroId').addEventListener('change',()=>{ g('tarifa').value=tarifaCentro(e,g('centroId').value)||''; act(); });
  mForm.querySelectorAll('input').forEach(i=>i.addEventListener('input',act)); act();
};

/* ---- Costo indirecto real (solo con costeo real) ---- */
ACCIONES.costoOrdenProduccion=d=>{
  const e=emp(), o=ordenAbierta(e,d.id); if(!o) return;
  const clase=d.clase==='manoObra'?'manoObra':'cif';
  const nombre=clase==='cif'?'costo indirecto real':'mano de obra directa';
  const gastos=e.cuentas.filter(c=>c.d&&c.t==='gasto');
  const cfg=cfgCostos(e);
  const defecto=gastos.find(c=>cfg.cif.cuentas.includes(c.c))||gastos.find(c=>c.c==='6.2.07')||gastos[0];
  abrirModal(`Agregar ${nombre}`,
    `<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">No es un gasto nuevo: pasa a Productos en proceso un monto que ya está registrado como gasto. Elegí de cuál cuenta se traslada, para que no se cuente dos veces.</p>
    <div class="rej">
      <div class="campo full"><label>Se traslada desde la cuenta de gasto</label><select name="origen">${gastos.map(c=>`<option value="${c.c}"${defecto&&c.c===defecto.c?' selected':''}>${c.c} — ${esc(c.n)}</option>`).join('')}</select></div>
      <div class="campo"><label>Monto</label><input name="monto" type="number" step="0.01" min="0"></div>
      <div class="campo"><label>Fecha</label><input name="fecha" type="date" value="${fechaSugerida(o)}"></div>
      ${campoCentro(e,o)}
      <div class="campo full"><label>Detalle</label><input name="descripcion" placeholder="Ej.: energía de la planta, octubre"></div>
    </div>`,
    async f=>{
      const monto=r2(+f.monto); if(!(monto>0)){avisar('Escribí el monto.');return false}
      const err=revisarFechaOrden(e,o,f.fecha); if(err){avisar(err);return false}
      const saldo=saldoNatural(f.origen,movimientos(null,f.fecha));
      if(monto>saldo+0.004&&!(await preguntar(`La cuenta ${f.origen} tiene Q${Q(saldo)} a esa fecha; vas a trasladar Q${Q(monto)}. ¿Continuar?`))) return false;
      asegurarCuentasCostos(e);
      const cta=e.cuentas.find(c=>c.c===f.origen);
      const p=partidaProduccion(e,f.fecha,`Producción — ${o.tipo==='continuo'?'corrida':'orden'} ${o.numero} — ${nombre}`,
        [{cta:CTA_PEP,desc:(f.descripcion||'').trim(),debe:monto,haber:0},{cta:f.origen,desc:'Traslado a producción',debe:0,haber:monto}]);
      o[clase].push({id:uid(),fecha:f.fecha,centroId:centroElegido(e,o,f),descripcion:(f.descripcion||'').trim(),monto,origen:`${f.origen} ${cta?cta.n:''}`.trim(),partidaId:p.id,partidaNumero:p.numero});
      registrarLog(`Aplicó ${nombre} a producción`,`${o.producto} — Q${Q(monto)}`);
      guardar(); pintar();
    },'Agregar');
};

/* ======================= CIERRE DE LA ORDEN / CORRIDA ======================= */
function leerDatosProcesos(cs,f){
  const datos={};
  cs.forEach(cc=>{ const v=k=>f[k]===''||f[k]===undefined?0:+f[k];
    datos[cc.id]={iniciadas:v('p_ini_'+cc.id),T:v('p_T_'+cc.id),W:v('p_W_'+cc.id),pm:v('p_pm_'+cc.id),pc:v('p_pc_'+cc.id),N:v('p_N_'+cc.id),A:v('p_A_'+cc.id)}; });
  return datos;
}
ACCIONES.cerrarOrdenProduccion=d=>{
  const e=emp(), o=ordenAbierta(e,d.id); if(!o) return;
  const t=totalesOrden(o), m=o.tipo, c=cfgCostos(e), r=recetaDe(e,o);
  const inis=m==='continuo'?inicialPorCentro(e,o):null;
  const traeIni=inis&&Object.values(inis).some(x=>(x.mat||0)+(x.conv||0)+(x.ant||0)>0);
  if(t.total<=0&&!traeIni){avisar('La orden no tiene ningún costo todavía: registrá materiales y mano de obra antes de cerrarla.');return}
  const usaReceta=m==='estandar'&&r;
  const cs=centrosDeOrden(e,o);
  /* CIF por unidades: cada proceso con base "unidades" aplica su tasa a lo que terminó (en órdenes, a las
     unidades terminadas de la orden). */
  const centrosUnidades=c.cif.modo==='tasa'?cs.filter(x=>baseCIF(e,x.id)==='unidades'&&tasaCIF(e,x.id)>0):[];
  const cifUnidades=centrosUnidades.length>0;
  const cifPorUnidades=(T,datos)=>centrosUnidades.map(x=>{ const u=datos?(+((datos[x.id]||{}).T)||0):T, tasa=tasaCIF(e,x.id); return {centroId:x.id,unidades:u,tasa,monto:r2(u*tasa)}; }).filter(x=>x.monto>0);
  const filaProceso=(cc,i)=>`<tr><td>${esc(cc.nombre)}</td>
    ${i===0?`<td><input name="p_ini_${cc.id}" type="number" step="0.01" min="0" style="width:90px" aria-label="Unidades iniciadas en ${esc(cc.nombre)}"></td>`:'<td style="color:var(--tinta-suave);font-size:12px">las transferidas del anterior</td>'}
    <td><input name="p_T_${cc.id}" type="number" step="0.01" min="0" style="width:90px" aria-label="Terminadas en ${esc(cc.nombre)}"></td>
    <td><input name="p_W_${cc.id}" type="number" step="0.01" min="0" value="0" style="width:80px" aria-label="En proceso en ${esc(cc.nombre)}"></td>
    <td><input name="p_pm_${cc.id}" type="number" step="1" min="0" max="100" value="100" style="width:64px" aria-label="Avance de materiales en ${esc(cc.nombre)}"></td>
    <td><input name="p_pc_${cc.id}" type="number" step="1" min="0" max="100" value="50" style="width:64px" aria-label="Avance de conversión en ${esc(cc.nombre)}"></td>
    <td><input name="p_N_${cc.id}" type="number" step="0.01" min="0" value="0" style="width:70px" aria-label="Pérdida normal en ${esc(cc.nombre)}"></td>
    <td><input name="p_A_${cc.id}" type="number" step="0.01" min="0" value="0" style="width:70px" aria-label="Pérdida anormal en ${esc(cc.nombre)}"></td></tr>`;
  abrirModal(`Cerrar ${m==='continuo'?'la corrida':'la orden'} ${o.numero} — ${esc(o.producto)}`,
    `<div class="rej">
      <div class="campo"><label>Fecha de cierre</label><input name="fecha" type="date" value="${o.fechaFin&&o.fechaFin<hoy()?o.fechaFin:hoy()}"></div>
      ${m!=='continuo'?`<div class="campo"><label>Unidades terminadas</label><input name="terminadas" type="number" step="0.01" min="0" value="${o.cantidadPlan||''}"></div>`:''}
    </div>
    ${m==='continuo'?`<p style="margin:12px 0 6px;font-size:13px;color:var(--tinta-suave)">Informe de cantidades de cada proceso. Lo que termina un proceso pasa al siguiente; lo que termina el último entra al inventario. Pérdida normal: propia del proceso (la absorben las unidades buenas). Pérdida anormal: no debería ocurrir (va a resultados).</p>
      <div class="tabla-scroll"><table style="font-size:12.5px"><thead><tr><th>Proceso</th><th>Iniciadas</th><th>Terminadas y transferidas</th><th>En proceso al final</th><th>% avance mat.</th><th>% avance conv.</th><th>Pérdida normal</th><th>Pérdida anormal</th></tr></thead>
      <tbody>${cs.map(filaProceso).join('')}</tbody></table></div>`:''}
    ${cifUnidades?`<div class="aviso" style="margin-top:10px">Se aplican CIF por unidad terminada: ${centrosUnidades.map(x=>`${c.cif.porProceso?esc(x.nombre)+' ':''}Q${tasaCIF(e,x.id).toFixed(4)}`).join(' · ')} × unidades.</div>`:''}
    <div id="tablaCierre" style="margin-top:12px"></div>
    ${m!=='estandar'?camposConjuntos(o):''}
    <div class="aviso" style="margin-top:12px">${m==='ordenes'?'Todo el costo de la orden pasa al producto terminado; el costo unitario es el total entre las unidades terminadas.'
      :m==='continuo'?'Promedio ponderado: el costo de cada proceso (lo recibido + materiales + conversión) se divide entre sus unidades equivalentes. Lo que queda en proceso sigue en Productos en proceso y la próxima corrida del producto arranca con ello.'
      :'El producto entra al inventario al costo estándar; las diferencias contra el costo real se separan en variaciones y van a resultados.'}</div>`,
    f=>{
      if(!f.fecha||f.fecha<o.fechaInicio){avisar('La fecha de cierre no puede ser anterior al inicio.');return false}
      const ultimoReg=[...o.materiales,...o.manoObra,...o.cif].reduce((mx,x)=>x.fecha>mx?x.fecha:mx,'');
      if(ultimoReg&&f.fecha<ultimoReg){avisar(`Hay registros con fecha ${fFecha(ultimoReg)}: la fecha de cierre no puede ser anterior.`);return false}
      if(anioCerradoLibros(e,f.fecha)){avisar('Ese ejercicio ya tiene Cierre de libros.');return false}
      let T, datos=null;
      if(m==='continuo'){
        datos=leerDatosProcesos(cs,f);
        const inf0=informeCorrida(e,o,datos);
        const desc=inf0.filas.find(x=>Math.abs(x.cuadreU)>0.004);
        if(desc){avisar(`Las unidades de ${desc.centro.nombre} no cuadran: inicio + entradas debe ser igual a terminadas + en proceso + pérdidas (diferencia ${desc.cuadreU}).`);return false}
        if(inf0.filas.some(x=>[x.datos.pm,x.datos.pc].some(v=>v<0||v>100))){avisar('Los porcentajes de avance van de 0 a 100.');return false}
        T=inf0.unidadesFinal; if(!(T>0)){avisar('El último proceso tiene que terminar alguna unidad.');return false}
      }else{
        T=r2(+f.terminadas||0); if(!(T>0)){avisar('Escribí las unidades terminadas.');return false}
      }
      asegurarCuentasCostos(e);
      const lineasCierre=[], extra={};
      /* CIF por unidad terminada: se aplican antes de cerrar (partida propia). */
      const porU=cifPorUnidades(T,m==='continuo'?datos:null);
      if(porU.length){
        const p=partidaProduccion(e,f.fecha,`Producción — ${m==='continuo'?'corrida':'orden'} ${o.numero} — CIF aplicado por unidades`,
          porU.flatMap(x=>[{cta:CTA_PEP,desc:`CIF aplicado${c.cif.porProceso?' ('+nombreCentro(e,x.centroId)+')':''}: Q${x.tasa.toFixed(4)} × ${x.unidades} u.`,debe:x.monto,haber:0},{cta:CTA_CIF_APLICADOS,desc:`CIF aplicados — ${o.producto}`,debe:0,haber:x.monto}]));
        porU.forEach(x=>o.cif.push({id:uid(),fecha:f.fecha,centroId:x.centroId,aplicado:true,base:'unidades',cantidadBase:x.unidades,tasa:x.tasa,monto:x.monto,descripcion:`Aplicado: Q${x.tasa.toFixed(4)} × ${x.unidades} unidades`,partidaId:p.id,partidaNumero:p.numero}));
      }
      let costoTerm, cu;
      const t2=totalesOrden(o);
      if(m==='continuo'){
        const inf=informeCorrida(e,o,datos);
        costoTerm=inf.transferidoFinal; cu=costoTerm/T;
        if(costoTerm<=0){avisar('El costo transferido es cero: revisá los costos y las unidades.');return false}
        const wipPorCentro={}; inf.filas.forEach(x=>{ wipPorCentro[x.centro.id]=x.wip; });
        const tot=inf.filas.reduce((s,x)=>({unidades:s.unidades+x.wip.unidades,ant:s.ant+x.wip.ant,mat:s.mat+x.wip.mat,conv:s.conv+x.wip.conv}),{unidades:0,ant:0,mat:0,conv:0});
        Object.assign(extra,{wipPorCentro,wipFinal:{unidades:tot.unidades,ant:r2(tot.ant),mat:r2(tot.mat),conv:r2(tot.conv)},perdidaAnormal:inf.anormalTotal,
          informe:{filas:inf.filas.map(x=>({centro:x.centro,ini:x.ini,entradas:x.entradas,datos:x.datos,euAnt:x.euAnt,euM:x.euM,euC:x.euC,ant:x.ant,mat:x.mat,conv:x.conv,cuAnt:x.cuAnt,cuM:x.cuM,cuC:x.cuC,transferido:x.transferido,anormal:x.anormal,enProceso:x.enProceso}))}});
        lineasCierre.push({cta:'1.1.08',desc:o.producto,debe:costoTerm,haber:0},{cta:CTA_PEP,desc:`${o.producto} — corrida ${o.numero}`,debe:0,haber:costoTerm});
        if(inf.anormalTotal>0){ asegurarCuenta(e,CTA_PERDIDA_ANORMAL,'Pérdidas anormales de producción','costo');
          lineasCierre.push({cta:CTA_PERDIDA_ANORMAL,desc:'Pérdida anormal en proceso',debe:inf.anormalTotal,haber:0},{cta:CTA_PEP,desc:'Pérdida anormal',debe:0,haber:inf.anormalTotal}); }
      }else if(m==='ordenes'){
        costoTerm=t2.total; cu=costoTerm/T;
        lineasCierre.push({cta:'1.1.08',desc:o.producto,debe:costoTerm,haber:0},{cta:CTA_PEP,desc:`${o.producto} — orden ${o.numero}`,debe:0,haber:costoTerm});
      }else if(usaReceta){
        const v=variacionesConReceta(e,o,T);
        costoTerm=v.estTotal; cu=costoTerm/T;
        lineasCierre.push({cta:'1.1.08',desc:`${o.producto} al estándar`,debe:costoTerm,haber:0},{cta:CTA_PEP,desc:`${o.producto} — orden ${o.numero} (real)`,debe:0,haber:t2.total});
        VARIACIONES_DETALLE.forEach(([k,cta,nom])=>{ const x=v.var[k]; if(Math.abs(x)<0.005) return; asegurarCuenta(e,cta,nom,'costo');
          lineasCierre.push(x>0?{cta,desc:'Desfavorable',debe:x,haber:0}:{cta,desc:'Favorable',debe:0,haber:-x}); });
        Object.assign(extra,{variacionesDetalle:v.var,estandarUnitario:{mat:v.hoja.mat,mod:v.hoja.mod,cif:v.hoja.cif,total:v.hoja.total}});
      }else{
        const v=varianzasEstandar(e,o,T);
        costoTerm=v.estTotal; cu=costoTerm/T;
        lineasCierre.push({cta:'1.1.08',desc:o.producto,debe:costoTerm,haber:0},{cta:CTA_PEP,desc:`${o.producto} — orden ${o.numero}`,debe:0,haber:t2.total});
        VARIACIONES_ESTANDAR.forEach(([k,cta,nom])=>{ const x=v.var[k]; if(Math.abs(x)<0.005) return; asegurarCuenta(e,cta,nom,'costo');
          lineasCierre.push(x>0?{cta,desc:'Gastó más que el estándar',debe:x,haber:0}:{cta,desc:'Gastó menos que el estándar',debe:0,haber:-x}); });
        extra.variaciones=v.var;
      }
      costoTerm=r2(costoTerm);
      let titulo=`${o.producto} × ${T}`;
      if(m!=='estandar'&&f.conjunto==='on'){
        const cj=costearConjuntos(costoTerm,leerConjuntos(f),f.cj_metodo);
        if(cj.error){avisar(cj.error);return false}
        const i=lineasCierre.findIndex(l=>l.cta==='1.1.08'&&l.debe>0);
        lineasCierre.splice(i,1,...cj.productos.map(x=>({cta:'1.1.08',desc:`${x.producto} × ${x.cantidad}${x.tipo==='subproducto'?' (subproducto)':''}`,debe:x.costo,haber:0})));
        extra.productosConjuntos=cj.productos.map(x=>({producto:x.producto,cantidad:x.cantidad,precio:isFinite(x.precio)?x.precio:null,tipo:x.tipo,costo:x.costo,costoUnitario:x.costoUnitario}));
        extra.metodoConjunto=f.cj_metodo;
        titulo=`productos conjuntos: ${cj.productos.map(x=>x.producto).join(', ')}`;
      }
      const ctl=controlReceta(e,o,T);
      if(ctl) extra.controlCierre={base:ctl.base,filas:ctl.filas.map(x=>({material:x.material,teorico:x.teorico,real:x.real,pct:x.pct})),horasStd:ctl.horasStd,horasReales:ctl.horasReales};
      let p;
      try{ p=partidaProduccion(e,f.fecha,`Producción terminada — ${m==='continuo'?'corrida':'orden'} ${o.numero} — ${titulo}`,lineasCierre); }
      catch(err){ avisar(err.message+'. Revisá los costos.'); return false; }
      Object.assign(o,{estado:'cerrada',fechaCierre:f.fecha,cantidadTerminada:T,costoTerminado:costoTerm,costoUnitario:cu,partidaCierreId:p.id,partidaCierreNumero:p.numero},extra);
      registrarLog('Cerró una orden de producción',`${titulo} — Q${Q(costoTerm)}`);
      guardar(); pintar();
      avisar(extra.productosConjuntos
        ? `${m==='continuo'?'Corrida':'Orden'} cerrada. Entran al inventario:\n${extra.productosConjuntos.map(x=>`· ${x.producto}: ${x.cantidad} u. a Q${Q(x.costoUnitario)} c/u (Q${Q(x.costo)})${x.tipo==='subproducto'?' — subproducto':''}`).join('\n')}\nPartida No. ${p.numero}.`
        : `${m==='continuo'?'Corrida':'Orden'} cerrada: ${T} u. de ${o.producto} entran al inventario a Q${Q(cu)} c/u.${extra.perdidaAnormal?` Pérdida anormal a resultados: Q${Q(extra.perdidaAnormal)}.`:''} Partida No. ${p.numero}.`,'Listo');
    },'Cerrar y pasar a inventario');
  const g=n=>mForm.querySelector(`[name="${n}"]`);
  const act=()=>{
    let html='', conjunto=0;
    const simular=(T,datos)=>cifPorUnidades(T,datos).map(x=>({centroId:x.centroId,monto:x.monto}));
    const datosForm=Object.fromEntries([...mForm.querySelectorAll('[name]')].map(i=>[i.name,i.value]));
    if(m==='continuo'){
      const datos=leerDatosProcesos(cs,datosForm);
      const oSim={...o,cif:[...o.cif,...simular(0,datos)]};
      const inf=informeCorrida(e,oSim,datos);
      const malos=inf.filas.filter(x=>Math.abs(x.cuadreU)>0.004);
      html=(malos.length?`<div class="aviso malo">No cuadran las unidades de ${malos.map(x=>`${esc(x.centro.nombre)} (diferencia ${x.cuadreU})`).join(', ')}.</div>`:'')+tablaInforme(inf);
      conjunto=inf.transferidoFinal;
    }else{
      const T=+g('terminadas').value||0, extraU=simular(T,null), tt={...t,cif:r2(t.cif+extraU.reduce((a,x)=>a+x.monto,0))}; tt.total=r2(tt.mat+tt.mod+tt.cif);
      if(m==='ordenes'){
        html=`<table style="font-size:13px"><tbody><tr><td>Materiales / mano de obra / CIF</td><td class="num">${Q(tt.mat)} / ${Q(tt.mod)} / ${Q(tt.cif)}</td></tr>
          <tr class="total"><td>Costo total de la orden</td><td class="num">${Q(tt.total)}</td></tr><tr><td>Costo unitario</td><td class="num">${T>0?Q(tt.total/T):'—'}</td></tr></tbody></table>`;
        conjunto=tt.total;
      }else if(usaReceta&&T>0){
        const oSim={...o,cif:[...o.cif,...extraU]};
        const v=variacionesConReceta(e,oSim,T);
        html=`<table style="font-size:13px"><tbody><tr><td>Costo estándar de ${T} u. (Q${Q(v.hoja.total)} c/u)</td><td class="num">${Q(v.estTotal)}</td></tr><tr><td>Costo real acumulado</td><td class="num">${Q(tt.total)}</td></tr>
          ${Object.entries(v.var).map(([k,x])=>`<tr><td>${NOMBRE_VARIACION[k]}</td><td class="num">${Q(x)}${Math.abs(x)<0.005?'':x>0?' (desfavorable)':' (favorable)'}</td></tr>`).join('')}
          <tr class="total"><td>Variación total</td><td class="num">${Q(r2(tt.total-v.estTotal))}</td></tr></tbody></table>`;
      }else if(m==='estandar'&&T>0){
        const v=varianzasEstandar(e,o,T);
        html=`<table style="font-size:13px"><tbody><tr><td>Costo estándar de ${T} u.</td><td class="num">${Q(v.estTotal)}</td></tr><tr><td>Costo real</td><td class="num">${Q(tt.total)}</td></tr>
          <tr class="total"><td>Variación total (positivo = gastó más)</td><td class="num">${Q(r2(tt.total-v.estTotal))}</td></tr></tbody></table>`;
      }
    }
    document.getElementById('tablaCierre').innerHTML=html;
    const chk=g('conjunto'); if(!chk) return;
    document.getElementById('cjBloque').hidden=!chk.checked;
    if(!chk.checked) return;
    const filas=leerConjuntos(datosForm), cj=costearConjuntos(r2(conjunto),filas,datosForm.cj_metodo);
    [0,1,2,3,4,5].forEach(i=>{
      const nom=(datosForm['cj_prod_'+i]||'').trim(), x=cj.productos&&cj.productos.find(y=>y.producto===nom);
      document.getElementById('cj_costo_'+i).textContent=x?`${Q(x.costo)} (Q${Q(x.costoUnitario)} c/u)`:'—';
    });
    document.getElementById('tablaCierre').insertAdjacentHTML('beforeend',`<table style="font-size:13px"><tbody><tr class="total"><td>Costo conjunto a repartir${cj.valorSubs?` (menos subproductos Q${Q(cj.valorSubs)})`:''}</td>
      <td class="num">${cj.error?`<span style="color:var(--peligro)">${esc(cj.error)}</span>`:Q(cj.neto)}</td></tr></tbody></table>`);
  };
  mForm.querySelectorAll('input,select').forEach(i=>{i.addEventListener('input',act);i.addEventListener('change',act);});
  act();
};

/* ======================= CIERRE DE CIF DEL PERÍODO ======================= */
/* CIF reales (cuentas configuradas) frente a CIF aplicados (5.1.10) del período. La diferencia es la
   sub o sobreaplicación y se cierra contra 5.1.08, en resultados. Se muestra además el análisis de
   presupuesto (real − presupuesto flexible) y de volumen o capacidad (presupuesto flexible − aplicado). */
function analisisCIF(e,desde,hasta){
  const c=cfgCostos(e).cif;
  const cierres=new Set((e.cierresCIF||[]).map(x=>x.partidaId));
  const delPeriodo=e.partidas.filter(p=>p.fecha>=desde&&p.fecha<=hasta&&!cierres.has(p.id));
  const real={};
  delPeriodo.forEach(p=>p.lineas.forEach(l=>{ if(c.cuentas.includes(l.cta)) real[l.cta]=r2((real[l.cta]||0)+(+l.debe||0)-(+l.haber||0)); }));
  const aplicado=r2(delPeriodo.reduce((s,p)=>s+p.lineas.filter(l=>l.cta===CTA_CIF_APLICADOS).reduce((a,l)=>a+(+l.haber||0)-(+l.debe||0),0),0));
  const totalReal=r2(Object.values(real).reduce((s,x)=>s+x,0));
  const baseReal=r2((e.ordenesProduccion||[]).flatMap(o=>o.cif||[]).filter(x=>x.aplicado&&x.fecha>=desde&&x.fecha<=hasta).reduce((s,x)=>s+(+x.cantidadBase||0),0));
  const dias=diasEntre(desde,hasta);
  let fijoPeriodo=r2((+c.presupuestoFijo||0)*dias/365);
  let flexible=r2(fijoPeriodo+(+c.variablePorBase||0)*baseReal);
  let procesos=null;
  if(c.porProceso){
    /* Tasa por proceso: cada proceso tiene su presupuesto flexible y sus CIF propios (cuentas asignadas).
       Las cuentas compartidas se reparten según lo aplicado en cada proceso. Así ningún CIF se cuenta dos veces. */
    const centros=cfgCostos(e).centros;
    const items=(e.ordenesProduccion||[]).flatMap(o=>o.cif||[]).filter(x=>x.aplicado&&x.fecha>=desde&&x.fecha<=hasta);
    const idDe=id=>centros.some(x=>x.id===id)?id:centros[0].id;
    procesos=centros.map(cc=>{
      const pc=parametrosCIF(e,cc.id), mios=items.filter(x=>idDe(x.centroId)===cc.id);
      const base=r2(mios.reduce((s,x)=>s+(+x.cantidadBase||0),0)), apl=r2(mios.reduce((s,x)=>s+(+x.monto||0),0));
      const fijo=r2(pc.presupuestoFijo*dias/365);
      const propio=r2(Object.entries(real).filter(([cta])=>c.asignacion[cta]===cc.id).reduce((s,[,v])=>s+v,0));
      return {id:cc.id,nombre:cc.nombre,base,aplicado:apl,fijo,flexible:r2(fijo+pc.variablePorBase*base),propio,compartido:0};
    });
    const compartido=r2(Object.entries(real).filter(([cta])=>!centros.some(x=>x.id===c.asignacion[cta])).reduce((s,[,v])=>s+v,0));
    const totApl=procesos.reduce((s,x)=>s+x.aplicado,0);
    let resto=compartido;
    procesos.forEach((x,i)=>{ x.compartido=i===procesos.length-1?r2(resto):r2(compartido*(totApl>0?x.aplicado/totApl:1/procesos.length)); resto=r2(resto-x.compartido);
      x.real=r2(x.propio+x.compartido); x.diferencia=r2(x.real-x.aplicado); });
    fijoPeriodo=r2(procesos.reduce((s,x)=>s+x.fijo,0));
    flexible=r2(procesos.reduce((s,x)=>s+x.flexible,0));
  }
  return {real,totalReal,aplicado,diferencia:r2(totalReal-aplicado),baseReal,fijoPeriodo,flexible,procesos,
    presupuesto:r2(totalReal-flexible),volumen:r2(flexible-aplicado)};
}
ACCIONES.cierreCIF=()=>{
  const e=emp(), c=cfgCostos(e);
  if(!c.cif.cuentas.length){avisar('Primero elegí en "Configuración de costos" las cuentas donde se registran los CIF reales.');return}
  const ultimo=(e.cierresCIF||[]).slice().sort((a,b)=>b.hasta.localeCompare(a.hasta))[0];
  const ini=ultimo?new Date(new Date(ultimo.hasta+'T12:00').getTime()+86400000).toISOString().slice(0,10):`${e.ejercicio}-01-01`;
  const finMes=new Date(ini+'T12:00'); finMes.setMonth(finMes.getMonth()+1,0);
  abrirModal('Cierre de CIF del período',
    `<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">Compara los costos indirectos reales del período con los aplicados a la producción. La diferencia (sub o sobreaplicación) se cierra contra resultados (${CTA_VAR_CIF}).</p>
    <div class="rej"><div class="campo"><label>Desde</label><input name="desde" type="date" value="${ini}"></div><div class="campo"><label>Hasta</label><input name="hasta" type="date" value="${finMes.toISOString().slice(0,10)}"></div></div>
    <div id="cifPrev" style="margin-top:12px"></div>`,
    f=>{
      if(!f.desde||!f.hasta||f.hasta<f.desde){avisar('Revisá las fechas.');return false}
      if((e.cierresCIF||[]).some(x=>!(f.hasta<x.desde||f.desde>x.hasta))){avisar('Ese período se cruza con un cierre de CIF ya hecho.');return false}
      if(anioCerradoLibros(e,f.hasta)){avisar('Ese ejercicio ya tiene Cierre de libros.');return false}
      const a=analisisCIF(e,f.desde,f.hasta);
      if(!(a.totalReal>0)&&!(a.aplicado>0)){avisar('No hay CIF reales ni aplicados en ese período.');return false}
      asegurarCuentasCostos(e); asegurarCuenta(e,CTA_VAR_CIF,'Variación de CIF (sub o sobreaplicados)','costo');
      const lineas=[{cta:CTA_CIF_APLICADOS,desc:'Cierre de CIF aplicados',debe:a.aplicado,haber:0},
        ...Object.entries(a.real).filter(([,v])=>Math.abs(v)>0.004).map(([cta,v])=>v>0?{cta,desc:'CIF reales del período',debe:0,haber:v}:{cta,desc:'CIF reales del período',debe:-v,haber:0})];
      if(Math.abs(a.diferencia)>0.004) lineas.push(a.diferencia>0?{cta:CTA_VAR_CIF,desc:'CIF subaplicados',debe:a.diferencia,haber:0}:{cta:CTA_VAR_CIF,desc:'CIF sobreaplicados',debe:0,haber:-a.diferencia});
      let p; try{ p=partidaProduccion(e,f.hasta,`Cierre de CIF del ${fFecha(f.desde)} al ${fFecha(f.hasta)} — ${a.diferencia>0?'subaplicados':a.diferencia<0?'sobreaplicados':'sin diferencia'} Q${Q(Math.abs(a.diferencia))}`,lineas); }
      catch(err){ avisar(err.message); return false; }
      e.cierresCIF=e.cierresCIF||[]; e.cierresCIF.push({id:uid(),desde:f.desde,hasta:f.hasta,real:a.totalReal,aplicado:a.aplicado,diferencia:a.diferencia,presupuesto:a.presupuesto,volumen:a.volumen,partidaId:p.id,partidaNumero:p.numero,porProceso:a.procesos?a.procesos.map(x=>({centroId:x.id,aplicado:x.aplicado,real:x.real,diferencia:x.diferencia})):undefined});
      registrarLog('Cerró los CIF del período',`${f.desde} al ${f.hasta} — real Q${Q(a.totalReal)}, aplicado Q${Q(a.aplicado)}`);
      guardar(); pintar();
      avisar(`CIF del período cerrados. Reales Q${Q(a.totalReal)}, aplicados Q${Q(a.aplicado)}: ${a.diferencia>0?`subaplicados Q${Q(a.diferencia)} (se cargan a resultados)`:a.diferencia<0?`sobreaplicados Q${Q(-a.diferencia)} (se abonan a resultados)`:'sin diferencia'}. Partida No. ${p.numero}.`,'Listo');
    },'Cerrar CIF');
  const g=n=>mForm.querySelector(`[name="${n}"]`);
  const act=()=>{
    const d=g('desde').value, h=g('hasta').value; if(!d||!h||h<d){document.getElementById('cifPrev').innerHTML='';return}
    const a=analisisCIF(e,d,h);
    document.getElementById('cifPrev').innerHTML=`<table style="font-size:13px"><tbody>
      ${Object.entries(a.real).map(([cta,v])=>`<tr><td>${cta} — ${esc((e.cuentas.find(x=>x.c===cta)||{}).n||'')}</td><td class="num">${Q(v)}</td></tr>`).join('')||'<tr><td colspan="2" style="color:var(--tinta-suave)">Sin CIF reales registrados en el período.</td></tr>'}
      <tr class="total"><td>CIF reales</td><td class="num">${Q(a.totalReal)}</td></tr>
      <tr><td>CIF aplicados a la producción</td><td class="num">${Q(a.aplicado)}</td></tr>
      <tr class="total"><td>${a.diferencia>0?'Subaplicados (gasto mayor que lo aplicado)':a.diferencia<0?'Sobreaplicados (se aplicó de más)':'Diferencia'}</td><td class="num">${Q(Math.abs(a.diferencia))}</td></tr>
      <tr class="grupo-cta"><td colspan="2">Análisis</td></tr>
      <tr><td>Presupuesto flexible (fijo del período Q${Q(a.fijoPeriodo)} + variable × ${a.procesos?'base de cada proceso':Q(a.baseReal)})</td><td class="num">${Q(a.flexible)}</td></tr>
      <tr><td>Variación de presupuesto (real − flexible)</td><td class="num">${Q(a.presupuesto)}</td></tr>
      <tr><td>Variación de volumen o capacidad (flexible − aplicado)</td><td class="num">${Q(a.volumen)}</td></tr></tbody></table>
      ${a.procesos?`<table style="font-size:13px;margin-top:12px" id="cifPorProceso"><thead><tr><th>Proceso</th><th class="num">Aplicado</th><th class="num">Real propio</th><th class="num">Parte compartida</th><th class="num">Diferencia</th></tr></thead><tbody>
        ${a.procesos.map(x=>`<tr><td>${esc(x.nombre)}</td><td class="num">${Q(x.aplicado)}</td><td class="num">${Q(x.propio)}</td><td class="num">${Q(x.compartido)}</td><td class="num">${x.diferencia>0?'Sub ':x.diferencia<0?'Sobre ':''}${Q(Math.abs(x.diferencia))}</td></tr>`).join('')}</tbody></table>
        <p style="margin:6px 0 0;font-size:12.5px;color:var(--tinta-suave)">Los CIF de cuentas asignadas a un proceso son suyos; los compartidos se reparten según lo aplicado en cada proceso. Cada gasto se cuenta una sola vez.</p>`:''}
      <p style="margin:8px 0 0;font-size:12.5px;color:var(--tinta-suave)">Una variación de volumen desfavorable indica capacidad ociosa: según la NIC 2, ese CIF fijo no absorbido es gasto del período.</p>`;
  };
  mForm.querySelectorAll('input').forEach(i=>i.addEventListener('input',act)); act();
};

/* ======================= ANULAR Y PDF ======================= */
ACCIONES.anularOrdenProduccion=d=>{
  const e=emp(), o=ordenAbierta(e,d.id); if(!o) return;
  confirmar(`Se anulará ${o.tipo==='continuo'?'la corrida':'la orden'} ${o.numero} de ${o.producto}: los materiales vuelven al inventario, la mano de obra vuelve a su cuenta y se reversan los CIF aplicados (se borran las partidas que se hicieron para esta orden).`,()=>{
    const ids=new Set([...o.materiales,...o.manoObra,...o.cif].map(x=>x.partidaId));
    e.partidas=e.partidas.filter(p=>!ids.has(p.id));
    const sal=new Set(o.materiales.map(x=>x.salidaId));
    e.salidasInventario=(e.salidasInventario||[]).filter(s=>!sal.has(s.id));
    e.ordenesProduccion=e.ordenesProduccion.filter(x=>x.id!==o.id);
    ordenProdActual=null;
    registrarLog('Anuló una orden de producción',`${o.producto} — ${o.tipo==='continuo'?'corrida':'orden'} ${o.numero}`);
    guardar(); pintar();
  },'Anular');
};

ACCIONES.pdfOrdenProduccion=async d=>{
  const e=emp(), o=(e.ordenesProduccion||[]).find(x=>x.id===d.id);
  if(!o){avisar('No se encontró esa orden.');return}
  const t=totalesOrden(o), etiqueta=o.tipo==='continuo'?'Corrida':'Orden';
  const alto=altoEncabezado();
  try{
    const jsPDF=await cargarJsPDF();
    const doc=new jsPDF({unit:'pt',format:'letter'});
    const sec=(titulo,head,body)=>{
      doc.autoTable({head:[[{content:titulo,colSpan:head.length,styles:{halign:'left',fillColor:VERDE}}],head],body:body.length?body:[[{content:'Sin registros',colSpan:head.length,styles:{textColor:[150,150,150]}}]],
        startY:doc.lastAutoTable?doc.lastAutoTable.finalY+14:alto,margin:{top:alto,left:40,right:40,bottom:42},
        styles:{fontSize:8.5,cellPadding:3.5,lineColor:[225,222,212],lineWidth:.3},headStyles:{fillColor:CREMA,textColor:VERDE,fontSize:8},
        columnStyles:{[head.length-1]:{halign:'right'}},
        didDrawPage:()=>encabezadoPDF(doc,`Hoja de costos — ${etiqueta} ${o.numero}: ${o.producto}`,
          `${METODOS_PRODUCCION[o.tipo].nombre} · del ${fFecha(o.fechaInicio)} al ${o.fechaFin?fFecha(o.fechaFin):'—'}${o.fechaCierre?' · cierre '+fFecha(o.fechaCierre):' · abierta'} · cifras en quetzales`)});
    };
    sec('Materiales directos',['Fecha','Proceso','Material','Cantidad','Costo unitario','Costo'],(o.materiales||[]).map(x=>[fFecha(x.fecha),nombreCentro(e,x.centroId),x.producto,fmtCant(x.cantidad),Q(x.costoUnitario),Q(x.costoTotal)]));
    sec('Mano de obra directa',['Fecha','Proceso','Detalle','Horas','Tarifa','Monto'],(o.manoObra||[]).map(x=>[fFecha(x.fecha),nombreCentro(e,x.centroId),[x.empleado,x.descripcion].filter(Boolean).join(' — ')||x.origen||'',x.horas!==undefined?Q(x.horas):'—',x.tarifa!==undefined?Q(x.tarifa):'—',Q(x.monto)]));
    sec('Costos indirectos de fabricación',['Fecha','Proceso','Detalle','Monto'],(o.cif||[]).map(x=>[fFecha(x.fecha),nombreCentro(e,x.centroId),x.descripcion||'',Q(x.monto)]));
    const ctl=controlReceta(e,o);
    if(ctl&&ctl.hayBase) sec(`Control de consumo (base ${ctl.descBase})`,['Material','Debía usarse','Se usó','Resultado'],
      ctl.filas.map(x=>[x.material,fmtCant(x.teorico),fmtCant(x.real),x.fueraReceta?'Fuera de receta':estadoConsumo(x.pct)]));
    const resumen=[['Materiales directos',Q(t.mat)],['Mano de obra directa',Q(t.mod)],['Costos indirectos',Q(t.cif)],[{content:'Costo total',styles:{fontStyle:'bold',textColor:VERDE}},{content:Q(t.total),styles:{fontStyle:'bold',halign:'right',textColor:VERDE}}]];
    if(o.estado==='cerrada'&&o.productosConjuntos) o.productosConjuntos.forEach(x=>resumen.push([`${x.tipo==='subproducto'?'Subproducto':'Producto conjunto'}: ${x.producto}, ${x.cantidad} u. a Q${Q(x.costoUnitario)} c/u`,Q(x.costo)]));
    else if(o.estado==='cerrada') resumen.push([`Producto terminado: ${fmtCant(o.cantidadTerminada)} u. a Q${Q(o.costoUnitario)} c/u`,Q(o.costoTerminado)]);
    if(o.wipFinal&&o.wipFinal.unidades>0) resumen.push([`En proceso al cierre: ${fmtCant(o.wipFinal.unidades)} u.`,Q(r2((o.wipFinal.ant||0)+o.wipFinal.mat+o.wipFinal.conv))]);
    if(o.perdidaAnormal) resumen.push(['Pérdida anormal (a resultados)',Q(o.perdidaAnormal)]);
    if(o.variacionesDetalle) Object.entries(o.variacionesDetalle).forEach(([k,v])=>resumen.push([`Variación: ${NOMBRE_VARIACION[k]}`,Q(v)]));
    else if(o.variaciones) resumen.push(['Variaciones vs. estándar (mat. / M.O. / indirectos)',`${Q(o.variaciones.mat)} / ${Q(o.variaciones.mod)} / ${Q(o.variaciones.cif)}`]);
    sec('Resumen',['Concepto','Monto'],resumen);
    const n=doc.internal.getNumberOfPages(), al=doc.internal.pageSize.getHeight(), an=doc.internal.pageSize.getWidth();
    for(let i=1;i<=n;i++){ doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(130,130,130); doc.text(`Generado el ${fFecha(hoy())}`,40,al-22); doc.text(`Página ${i} de ${n}`,an-40,al-22,{align:'right'}); }
    doc.save(`Hoja-Costos-${etiqueta}-${o.numero}-${archivoSeguro(o.producto)}.pdf`);
    avisarDatosIncompletos();
  }catch(err){
    avisar('No se pudo generar el PDF: '+err.message+'\n\nEl generador se descarga de internet la primera vez, así que necesitás conexión.');
  }
};
