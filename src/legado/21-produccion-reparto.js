/* ============ PRODUCCIÓN CON VARIOS PRODUCTOS ============ */
/* Para empresas que fabrican productos diversos. Cada cliente usa lo que le corresponde:
   1. Reparto de un costo común: la mano de obra o un costo indirecto que sirve a varias corridas u órdenes
      abiertas (la planilla de operarios, la energía de la planta) se escribe una vez y se reparte según la
      base que elija la empresa: unidades, horas, costo de materiales, porcentajes o partes iguales.
      Se registra una partida por cada corrida (Productos en proceso contra la cuenta de gasto de origen),
      así anular una corrida o borrar su partida no toca a las demás.
   2. Productos conjuntos: una corrida u orden que termina en varios productos a la vez (de la misma materia
      prima y el mismo proceso). El costo conjunto se reparte entre los productos principales por valor de
      venta relativo o por unidades físicas; los subproductos se valúan a su valor de venta y se restan del
      costo conjunto (método de reducción del costo). */
const BASES_REPARTO={
  unidades:{nombre:'Unidades producidas',ayuda:'Unidades que produce cada una en el período.',pide:true},
  horas:{nombre:'Horas (de mano de obra o de máquina)',ayuda:'Horas que dedicó cada una.',pide:true},
  materiales:{nombre:'Costo de materiales',ayuda:'En proporción a los materiales que ya tiene cargados cada una.',pide:false},
  porcentaje:{nombre:'Porcentajes',ayuda:'El porcentaje que le toca a cada una (deben sumar 100).',pide:true},
  iguales:{nombre:'Partes iguales',ayuda:'Se divide en partes iguales entre las elegidas.',pide:false}};
const METODOS_CONJUNTOS={
  valor:'Valor de venta relativo (cantidad × precio de venta)',
  unidades:'Unidades físicas (cantidad producida)'};

/* Lo que una orden cerrada aportó al inventario: uno o varios productos. Única fuente para el kardex. */
function entradasProduccion(o){
  if(o.estado!=='cerrada'||!(o.cantidadTerminada>0)) return [];
  if(Array.isArray(o.productosConjuntos)&&o.productosConjuntos.length)
    return o.productosConjuntos.filter(p=>p.cantidad>0).map(p=>({producto:p.producto,cantidad:p.cantidad,costo:p.costo,fecha:o.fechaCierre}));
  return [{producto:o.producto,cantidad:o.cantidadTerminada,costo:o.costoTerminado,fecha:o.fechaCierre}];
}

/* Divide un monto según pesos, en centavos exactos (la última parte absorbe el redondeo). */
function repartirMonto(total,pesos){
  const suma=pesos.reduce((s,p)=>s+p,0); if(!(suma>0)) return pesos.map(()=>0);
  let acumulado=0;
  return pesos.map((p,i)=>{ if(i===pesos.length-1) return r2(total-acumulado); const v=r2(total*p/suma); acumulado=r2(acumulado+v); return v; });
}

/* ---- 1. Reparto de un costo común ---- */
ACCIONES.repartirCostoComun=()=>{
  const e=emp(), m=metodoProduccion(e);
  const abiertas=(e.ordenesProduccion||[]).filter(o=>o.estado==='abierta').sort((a,b)=>a.numero-b.numero);
  const etiqueta=m==='continuo'?'corrida':'orden';
  if(abiertas.length<2){avisar(`Para repartir un costo común hacen falta al menos 2 ${etiqueta}s abiertas.`);return}
  const gastos=e.cuentas.filter(c=>c.d&&c.t==='gasto');
  if(!gastos.length){avisar('El catálogo no tiene cuentas de gasto de detalle.');return}
  abrirModal('Repartir un costo común',
    `<p style="margin:0 0 14px;font-size:13.5px;color:var(--tinta-suave)">Un costo que sirve a varias ${etiqueta}s (la planilla de operarios, la energía de la planta) se escribe una vez y se reparte. Igual que al agregarlo a una sola, no es un gasto nuevo: se traslada desde la cuenta de gasto donde ya está registrado.</p>
    <div class="rej">
      <div class="campo"><label>Tipo de costo</label><select name="clase"><option value="manoObra">Mano de obra directa</option><option value="cif">Costos indirectos de fabricación</option></select></div>
      <div class="campo"><label>Se traslada desde la cuenta de gasto</label><select name="origen">${gastos.map(c=>`<option value="${c.c}"${c.c==='6.2.01'?' selected':''}>${c.c} — ${esc(c.n)}</option>`).join('')}</select></div>
      <div class="campo"><label>Monto total</label><input name="monto" type="number" step="0.01" min="0"></div>
      <div class="campo"><label>Fecha</label><input name="fecha" type="date" value="${hoy()}"></div>
      <div class="campo full"><label>Detalle</label><input name="descripcion" placeholder="Ej.: planilla de operarios de octubre"></div>
      <div class="campo full"><label>Base de reparto</label><select name="base">${Object.entries(BASES_REPARTO).map(([k,v])=>`<option value="${k}">${v.nombre}</option>`).join('')}</select>
        <span id="repAyuda" style="font-size:12.5px;color:var(--tinta-suave)"></span></div>
    </div>
    <table style="font-size:13px;margin-top:8px"><thead><tr><th></th><th>${etiqueta==='corrida'?'Corrida':'Orden'}</th><th class="num" id="repColBase">Base</th><th class="num">Le toca</th></tr></thead>
      <tbody>${abiertas.map(o=>`<tr>
        <td><input type="checkbox" name="usar_${o.id}" checked aria-label="Incluir ${etiqueta} ${o.numero}"></td>
        <td>${etiqueta==='corrida'?'Corrida':'Orden'} ${o.numero} — ${esc(o.producto)}</td>
        <td class="num"><input name="base_${o.id}" type="number" step="0.01" min="0" style="width:110px" aria-label="Base de ${etiqueta} ${o.numero}"></td>
        <td class="num" id="rep_${o.id}">—</td></tr>`).join('')}</tbody>
      <tfoot><tr class="total"><td colspan="2">Total</td><td class="num" id="repSumaBase"></td><td class="num" id="repTotal">—</td></tr></tfoot></table>`,
    async f=>{
      const r=calcularReparto(f,abiertas);
      if(r.error){avisar(r.error);return false}
      if(!f.fecha){avisar('Escribí la fecha.');return false}
      if(anioCerradoLibros(e,f.fecha)){avisar('Ese ejercicio ya tiene Cierre de libros.');return false}
      const saldo=saldoNatural(f.origen,movimientos(null,f.fecha));
      if(r.monto>saldo+0.004&&!(await preguntar(`La cuenta ${f.origen} tiene Q${Q(saldo)} a esa fecha; vas a trasladar Q${Q(r.monto)}. ¿Continuar?`))) return false;
      asegurarCuenta(e,'1.1.18','Productos en proceso','activo');
      const cta=e.cuentas.find(c=>c.c===f.origen), clase=f.clase==='cif'?'cif':'manoObra';
      const nombre=clase==='cif'?'costos indirectos':'mano de obra';
      const detalle=(f.descripcion||'').trim();
      const base=BASES_REPARTO[f.base].nombre.toLowerCase();
      e.correlativoReparto=(e.correlativoReparto||0)+1; const nRep=e.correlativoReparto;
      r.partes.forEach((x,k)=>{
        if(!(x.monto>0)) return;
        const o=x.orden, nota=`Reparto R-${nRep} por ${base}: ${x.texto}`;
        const p={id:uid(),numero:e.correlativo++,fecha:f.fecha,
          concepto:`Producción — ${etiqueta} ${o.numero} — ${nombre} (reparto R-${nRep}, ${k+1} de ${r.partes.length})`,
          docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',
          lineas:[{cta:'1.1.18',desc:detalle||nota,debe:x.monto,haber:0},{cta:f.origen,desc:`Traslado a producción (reparto R-${nRep})`,debe:0,haber:x.monto}]};
        e.partidas.push(p);
        o[clase].push({id:uid(),fecha:f.fecha,descripcion:detalle?`${detalle} — ${nota}`:nota,monto:x.monto,
          origen:`${f.origen} ${cta?cta.n:''}`.trim(),partidaId:p.id,partidaNumero:p.numero,reparto:nRep});
      });
      registrarLog(`Repartió ${nombre} entre ${r.partes.length} ${etiqueta}s`,`R-${nRep} por ${base} — Q${Q(r.monto)}`);
      guardar(); pintar();
      avisar(`Se repartieron Q${Q(r.monto)} de ${nombre} entre ${r.partes.length} ${etiqueta}s (reparto R-${nRep}), con una partida para cada una.`,'Listo');
    },'Repartir');
  const g=n=>mForm.querySelector(`[name="${n}"]`);
  const act=()=>{
    const datos={}; mForm.querySelectorAll('[name]').forEach(i=>datos[i.name]=i.type==='checkbox'?(i.checked?'on':''):i.value);
    const b=BASES_REPARTO[datos.base];
    document.getElementById('repAyuda').textContent=b.ayuda;
    document.getElementById('repColBase').textContent=datos.base==='porcentaje'?'%':datos.base==='materiales'?'Materiales':datos.base==='iguales'?'':b.nombre.split(' ')[0];
    abiertas.forEach(o=>{
      const inp=g('base_'+o.id), usar=g('usar_'+o.id).checked;
      inp.disabled=!b.pide||!usar; inp.hidden=datos.base==='iguales';
      if(datos.base==='materiales') inp.value=totalesOrden(o).mat;
    });
    const r=calcularReparto(datos,abiertas,true);
    abiertas.forEach(o=>{ const x=r.partes.find(p=>p.orden===o); document.getElementById('rep_'+o.id).textContent=x?Q(x.monto):'—'; });
    document.getElementById('repSumaBase').textContent=datos.base==='iguales'?'':(datos.base==='porcentaje'?r.sumaBase.toFixed(2)+' %':Q(r.sumaBase));
    document.getElementById('repTotal').textContent=r.error&&!r.parcial?r.error:Q(r.monto||0);
  };
  mForm.querySelectorAll('input,select').forEach(i=>{i.oninput=act;i.onchange=act;});
  act();
};
/* Calcula cuánto le toca a cada corrida. "vista" = para la vista previa (no exige todo completo). */
function calcularReparto(f,abiertas,vista){
  const monto=r2(+f.monto||0);
  const elegidas=abiertas.filter(o=>f['usar_'+o.id]==='on');
  const base=f.base;
  const valor=o=>base==='iguales'?1:base==='materiales'?totalesOrden(o).mat:+f['base_'+o.id]||0;
  const pesos=elegidas.map(valor), sumaBase=r2(pesos.reduce((s,p)=>s+p,0));
  const res={monto,sumaBase,partes:[]};
  if(elegidas.length<2) return {...res,error:'Elegí al menos 2.'};
  if(pesos.some(p=>p<0)) return {...res,error:'La base no puede ser negativa.'};
  if(!(sumaBase>0)) return {...res,error:base==='materiales'?'Las elegidas no tienen materiales cargados: usá otra base.':'Escribí la base de cada una.'};
  if(base==='porcentaje'&&Math.abs(sumaBase-100)>0.01) return {...res,error:`Los porcentajes suman ${sumaBase.toFixed(2)} %, deben sumar 100.`,parcial:vista};
  if(!(monto>0)&&!vista) return {...res,error:'Escribí el monto total.'};
  const montos=repartirMonto(monto,pesos);
  res.partes=elegidas.map((o,i)=>({orden:o,monto:montos[i],texto:base==='iguales'?`1/${elegidas.length}`:base==='porcentaje'?`${pesos[i]} %`:`${pesos[i]} de ${sumaBase} (${(pesos[i]/sumaBase*100).toFixed(2)} %)`}));
  return res;
}

/* ---- 2. Productos conjuntos (al cerrar una corrida u orden) ---- */
/* filas: [{producto,cantidad,precio,tipo:'principal'|'subproducto'}] → reparte "costoConjunto". */
function costearConjuntos(costoConjunto,filas,metodo){
  const validas=filas.filter(x=>x.producto&&x.cantidad>0);
  const principales=validas.filter(x=>x.tipo!=='subproducto'), subs=validas.filter(x=>x.tipo==='subproducto');
  if(validas.length<2) return {error:'Escribí al menos 2 productos con su cantidad.'};
  if(!principales.length) return {error:'Al menos uno tiene que ser producto principal.'};
  const nombres=validas.map(x=>normalizarTexto(x.producto));
  if(new Set(nombres).size!==nombres.length) return {error:'Hay un producto repetido en la lista.'};
  if(subs.some(x=>!(x.precio>=0))) return {error:'Escribí el valor de venta de cada subproducto (puede ser 0).'};
  const valorSubs=r2(subs.reduce((s,x)=>s+x.cantidad*x.precio,0));
  if(valorSubs>=costoConjunto) return {error:`Los subproductos valen Q${Q(valorSubs)}, igual o más que el costo conjunto (Q${Q(costoConjunto)}): revisá sus valores o marcalos como principales.`};
  if(metodo==='valor'&&principales.some(x=>!(x.precio>0))) return {error:'Con "valor de venta relativo", cada producto principal necesita su precio de venta.'};
  const neto=r2(costoConjunto-valorSubs);
  const pesos=principales.map(x=>metodo==='valor'?x.cantidad*x.precio:x.cantidad);
  const montos=repartirMonto(neto,pesos);
  const resultado=[
    ...principales.map((x,i)=>({...x,tipo:'principal',costo:montos[i],costoUnitario:montos[i]/x.cantidad})),
    ...subs.map(x=>{ const c=r2(x.cantidad*x.precio); return {...x,costo:c,costoUnitario:x.precio}; })];
  return {productos:resultado,valorSubs,neto};
}
/* Formulario de productos conjuntos dentro del cierre (lo arma el cierre de la orden). */
function camposConjuntos(o){
  const fila=(i,x={})=>`<tr>
    <td><input name="cj_prod_${i}" list="dlProdCj" value="${esc(x.producto||'')}" placeholder="Producto" style="min-width:140px" aria-label="Producto ${i+1}"></td>
    <td><input name="cj_cant_${i}" type="number" step="0.01" min="0" value="${x.cantidad||''}" style="width:90px" aria-label="Cantidad del producto ${i+1}"></td>
    <td><input name="cj_precio_${i}" type="number" step="0.01" min="0" value="${x.precio||''}" style="width:100px" aria-label="Precio de venta del producto ${i+1}"></td>
    <td><select name="cj_tipo_${i}" style="min-width:128px" aria-label="Tipo del producto ${i+1}"><option value="principal">Principal</option><option value="subproducto">Subproducto</option></select></td>
    <td class="num" id="cj_costo_${i}" style="white-space:nowrap">—</td></tr>`;
  return `<label style="display:flex;align-items:center;gap:8px;margin:14px 0 6px;font-size:14px;cursor:pointer">
      <input type="checkbox" name="conjunto"> Esta ${o.tipo==='continuo'?'corrida':'orden'} produce varios productos a la vez (productos conjuntos)</label>
    <div id="cjBloque" hidden>
      <p style="margin:0 0 10px;font-size:13px;color:var(--tinta-suave)">En "Unidades terminadas" va lo procesado (por ejemplo, quintales de materia prima); aquí, lo que salió de cada producto. Los subproductos se valúan a su valor de venta y se restan del costo conjunto.</p>
      <div class="campo" style="margin-bottom:10px"><label>Cómo se reparte el costo conjunto</label><select name="cj_metodo">${Object.entries(METODOS_CONJUNTOS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
      <datalist id="dlProdCj">${productosConocidos(emp()).map(p=>`<option value="${esc(p)}">`).join('')}</datalist>
      <table style="font-size:13px"><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio de venta</th><th>Tipo</th><th class="num">Costo asignado</th></tr></thead>
        <tbody>${[0,1,2,3,4,5].map(i=>fila(i,i===0?{producto:o.producto}:{})).join('')}</tbody></table>
    </div>`;
}
function leerConjuntos(f){
  return [0,1,2,3,4,5].map(i=>({producto:(f['cj_prod_'+i]||'').trim(),cantidad:r2(+f['cj_cant_'+i]||0),
    precio:f['cj_precio_'+i]===''||f['cj_precio_'+i]===undefined?NaN:+f['cj_precio_'+i],tipo:f['cj_tipo_'+i]||'principal'}))
    .filter(x=>x.producto||x.cantidad>0);
}
