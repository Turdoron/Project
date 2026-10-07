/* ============ PLANILLA RÁPIDA — llenar novedades de muchos empleados a la vez ============ */
/* Cuatro formas de no escribir casilla por casilla (las novedades son días de falta, horas extra,
   horas de domingo, horas de menos y bono adicional):
   1. Plantilla de Excel: se descarga con los empleados de la planilla, se llena y se vuelve a subir.
      Lee también un Excel propio si sus encabezados se parecen (Nombre, Horas extra, Bono…).
   2. Bono fijo mensual en la ficha del empleado: aparece solo en cada planilla, prorrateado al período.
   3. Aplicar un mismo dato a todos los incluidos o a los de un puesto.
   4. Como en Excel: Enter baja al siguiente empleado, se puede pegar una columna (o varias) copiada
      de Excel, y un filtro deja solo a quienes tienen novedades. */
const CAMPOS_NOVEDAD=[
  {k:'diasFalta',        t:'Días falta',     paso:1,    ancho:64},
  {k:'horasExtra',       t:'Horas extra',    paso:0.5,  ancho:64},
  {k:'horasExtraDomingo',t:'Horas domingo',  paso:0.5,  ancho:64},
  {k:'horasMenos',       t:'Horas de menos', paso:0.5,  ancho:64},
  {k:'bonoAdicional',    t:'Bono adic.',     paso:0.01, ancho:84},
];
const NOMBRE_NOVEDAD={diasFalta:'Días de falta',horasExtra:'Horas extra',horasExtraDomingo:'Horas de domingo',horasMenos:'Horas de menos',bonoAdicional:'Bono adicional'};
/* Dónde poner el cursor después de redibujar la planilla (por empleado, no por fila: el filtro cambia las filas). */
let focoPlanilla=null;

const bonoFijoPeriodo=(empleado,periodo)=>empleado&&+empleado.bonoFijo>0 ? prorratear(+empleado.bonoFijo,periodo) : 0;
/* Novedades con las que arranca un empleado en una planilla nueva: solo su bono fijo, si tiene. */
function filaInicialPlanilla(empleado,periodo,fechas,excluido){
  const bono=bonoFijoPeriodo(empleado,periodo);
  return {...calcularPlanillaEmpleado(empleado,periodo,{bonoAdicional:bono},fechas),excluido:!!excluido,bonoDeFicha:bono>0};
}
const filaTieneNovedad=f=>CAMPOS_NOVEDAD.some(c=>+f[c.k]);

/* Recalcula filas del borrador sin redibujar (quien llama decide cuándo pintar). */
function recalcularFilasPlanilla(indices){
  const b=borradorPlanilla, e=emp();
  (indices||b.detalle.map((_,i)=>i)).forEach(i=>{
    const f=b.detalle[i];
    const empleado=e.empleados.find(x=>x.id===f.empleadoId);
    if(!empleado) return;
    const extras={}; CAMPOS_NOVEDAD.forEach(c=>extras[c.k]=f[c.k]);
    b.detalle[i]=Object.assign(calcularPlanillaEmpleado(empleado,b.periodo,extras,{desde:b.desde,hasta:b.hasta}),
      {excluido:f.excluido,bonoDeFicha:f.bonoDeFicha});
  });
}
/* Si cambia el período, el bono que vino de la ficha se vuelve a prorratear (el que se escribió a mano, no). */
function reprorratearBonosFijos(){
  const b=borradorPlanilla, e=emp();
  b.detalle.forEach(f=>{ if(f.bonoDeFicha) f.bonoAdicional=bonoFijoPeriodo(e.empleados.find(x=>x.id===f.empleadoId),b.periodo); });
}

/* "1,250.50", "Q 300", " 8 " → número; vacío → 0; texto que no es número → null. */
function leerNumeroNovedad(v){
  if(typeof v==='number') return isFinite(v)?v:null;
  const s=String(v??'').replace(/[Qq\s]/g,'').replace(/,/g,'');
  if(s==='') return 0;
  const n=Number(s);
  return isFinite(n)?n:null;
}
/* Días del período para los topes: el rango elegido, pero nunca menos que el período nominal
   (al crear una planilla mensual el "hasta" es hoy, y no debe rechazar faltas del mes completo). */
function diasDelPeriodoPlanilla(b){
  const d=b.desde&&b.hasta?diasEntre(b.desde,b.hasta):0;
  return Math.max(d,diasNominalesPeriodo(b.periodo));
}
/* Revisa un valor antes de usarlo: error = no se usa; aviso = se usa, pero conviene mirarlo. */
function revisarNovedad(campo,valor,b,nombre){
  if(valor===null) return {error:`${nombre}: "${NOMBRE_NOVEDAD[campo]}" no es un número.`};
  if(valor<0) return {error:`${nombre}: "${NOMBRE_NOVEDAD[campo]}" no puede ser negativo.`};
  const dias=diasDelPeriodoPlanilla(b);
  if(campo==='diasFalta'&&valor>dias) return {error:`${nombre}: ${valor} días de falta es más que los ${dias} días del período.`};
  /* Art. 122 del Código de Trabajo: jornada ordinaria más extraordinaria, hasta 12 horas al día (4 extra sobre 8). */
  if(campo==='horasExtra'&&valor>dias*4) return {aviso:`${nombre}: ${valor} horas extra supera el máximo legal de 4 por día (${dias*4} en ${dias} días).`};
  if(campo==='horasMenos'&&valor>dias*8) return {aviso:`${nombre}: ${valor} horas de menos es más que la jornada completa del período.`};
  return {};
}

function inputNovedad(f,i,c){
  const deFicha=c.k==='bonoAdicional'&&f.bonoDeFicha;
  return `<input type="number" min="0" step="${c.paso}" value="${f[c.k]||0}" data-campo-emp="${c.k}" data-fila="${i}" data-emp="${f.empleadoId}"
    style="width:${c.ancho}px"${deFicha?' title="Bono fijo de la ficha del empleado, prorrateado al período"':''}>`;
}

/* Barra "Llenar más rápido" que va encima de la tabla de la planilla. */
function barraPlanillaRapida(b){
  const e=emp();
  const incluidos=b.detalle.filter(f=>!f.excluido);
  const puestos=[...new Set(incluidos.map(f=>((e.empleados.find(x=>x.id===f.empleadoId)||{}).puesto||'').trim()).filter(Boolean))].sort((a,c)=>a.localeCompare(c,'es'));
  const conNovedad=b.detalle.filter(filaTieneNovedad).length;
  return `<div class="tarjeta">
    <h3 style="margin-bottom:6px">Llenar más rápido</h3>
    <p style="margin:0 0 16px;font-size:13.5px;color:var(--tinta-suave)">Enter baja al siguiente empleado (Shift+Enter sube).
      Podés pegar una columna, o varias, copiada de Excel en la primera casilla: se reparte hacia abajo.</p>
    <div class="barra" style="margin-bottom:14px">
      <button class="btn sec" type="button" data-accion="plantillaNovedades">Descargar plantilla de Excel</button>
      <button class="btn sec" type="button" data-accion="subirNovedades">Cargar novedades desde Excel</button>
      <input type="file" id="archivoNovedades" accept=".xlsx,.xls,.csv" hidden>
    </div>
    <div class="barra" style="margin-bottom:10px">
      <div class="campo"><label for="nvCampo">Dato</label><select id="nvCampo">
        ${CAMPOS_NOVEDAD.map(c=>`<option value="${c.k}">${NOMBRE_NOVEDAD[c.k]}</option>`).join('')}</select></div>
      <div class="campo"><label for="nvValor">Valor</label><input id="nvValor" type="number" min="0" step="0.01" value="0" style="width:110px"></div>
      <div class="campo"><label for="nvDestino">Aplicar a</label><select id="nvDestino">
        <option value="todos">Todos los incluidos (${incluidos.length})</option>
        ${puestos.map(p=>`<option value="puesto:${esc(p)}">Puesto: ${esc(p)} (${incluidos.filter(f=>((e.empleados.find(x=>x.id===f.empleadoId)||{}).puesto||'').trim()===p).length})</option>`).join('')}
      </select></div>
      <button class="btn sec" type="button" data-accion="aplicarNovedadVarios">Aplicar</button>
    </div>
    <label style="display:inline-flex;align-items:center;gap:8px;font-size:14px;cursor:pointer">
      <input type="checkbox" id="nvSoloNovedades"${b.soloNovedades?' checked':''}>
      Mostrar solo empleados con novedades (${conNovedad} de ${b.detalle.length})</label>
  </div>
  ${b.nota?`<div class="aviso ${b.nota.tipo==='malo'?'malo':'bien'}" role="status" style="white-space:pre-line">${esc(b.nota.texto)}</div>`:''}`;
}

/* Enlaza las casillas de novedades: cambio diferido (para no perder el cursor), Enter y pegar. */
function enlazarPlanillaRapida(){
  const b=borradorPlanilla;
  const entradas=[...document.querySelectorAll('[data-campo-emp]')];
  const siguiente=(inp,paso)=>{
    const col=entradas.filter(x=>x.dataset.campoEmp===inp.dataset.campoEmp);
    return col[col.indexOf(inp)+paso]||null;
  };
  const guardarValor=inp=>{
    const i=+inp.dataset.fila, f=b.detalle[i], campo=inp.dataset.campoEmp;
    const v=leerNumeroNovedad(inp.value);
    const r=revisarNovedad(campo,v,b,f.nombre);
    if(r.error){ b.nota={tipo:'malo',texto:r.error}; inp.value=f[campo]||0; return false; }
    if((+f[campo]||0)===v) return false;
    f[campo]=v;
    if(campo==='bonoAdicional') f.bonoDeFicha=false;
    b.nota=r.aviso?{tipo:'malo',texto:r.aviso}:null;
    recalcularFilasPlanilla([i]);
    return true;
  };
  entradas.forEach(inp=>{
    inp.onchange=()=>{
      /* Se espera a que el foco llegue a la casilla siguiente (Tab o clic) y se la devuelve tras redibujar. */
      setTimeout(()=>{
        const a=document.activeElement;
        if(a&&a.dataset&&a.dataset.campoEmp) focoPlanilla={campo:a.dataset.campoEmp,emp:a.dataset.emp};
        guardarValor(inp); pintar();
      },0);
    };
    inp.onkeydown=ev=>{
      if(ev.key!=='Enter') return;
      ev.preventDefault();
      const destino=siguiente(inp,ev.shiftKey?-1:1)||inp;
      focoPlanilla={campo:destino.dataset.campoEmp,emp:destino.dataset.emp};
      guardarValor(inp); pintar();
    };
    inp.onpaste=ev=>{
      const texto=(ev.clipboardData&&ev.clipboardData.getData('text'))||'';
      if(!/[\t\n]/.test(texto.trim())) return;          // un solo valor: pegado normal
      ev.preventDefault();
      pegarEnPlanilla(inp,texto,entradas);
    };
  });
  const solo=document.getElementById('nvSoloNovedades');
  if(solo) solo.onchange=()=>{ b.soloNovedades=solo.checked; pintar(); };
  const arch=document.getElementById('archivoNovedades');
  if(arch) arch.onchange=()=>{ const f=arch.files[0]; arch.value=''; if(f) leerExcelNovedades(f); };
  if(focoPlanilla){
    const {campo,emp:id}=focoPlanilla; focoPlanilla=null;
    const destino=document.querySelector(`[data-campo-emp="${campo}"][data-emp="${id}"]`);
    if(destino){ destino.focus({preventScroll:false}); destino.select(); }
  }
}

/* Pegado desde Excel: filas hacia abajo (empleados visibles, en orden) y columnas hacia la derecha (novedades). */
function pegarEnPlanilla(inp,texto,entradas){
  const b=borradorPlanilla;
  const filas=texto.replace(/\r/g,'').split('\n'); if(filas[filas.length-1]==='') filas.pop();
  const col0=CAMPOS_NOVEDAD.findIndex(c=>c.k===inp.dataset.campoEmp);
  const filasVisibles=[...new Set(entradas.map(x=>+x.dataset.fila))];
  const desde=filasVisibles.indexOf(+inp.dataset.fila);
  let n=0, sobranFilas=0, sobranCols=0; const errores=[], avisos=[], tocadas=new Set();
  filas.forEach((linea,r)=>{
    const i=filasVisibles[desde+r];
    if(i===undefined){ sobranFilas++; return; }
    const f=b.detalle[i];
    linea.split('\t').forEach((celda,c)=>{
      const campo=CAMPOS_NOVEDAD[col0+c];
      if(!campo){ sobranCols++; return; }
      const v=leerNumeroNovedad(celda), rev=revisarNovedad(campo.k,v,b,f.nombre);
      if(rev.error){ errores.push(rev.error); return; }
      if(rev.aviso) avisos.push(rev.aviso);
      f[campo.k]=v; if(campo.k==='bonoAdicional') f.bonoDeFicha=false;
      tocadas.add(i); n++;
    });
  });
  recalcularFilasPlanilla([...tocadas]);
  const partes=[`Se pegaron ${n} valor${n===1?'':'es'} en ${tocadas.size} empleado${tocadas.size===1?'':'s'}.`];
  if(sobranFilas) partes.push(`${sobranFilas} fila${sobranFilas===1?'':'s'} del portapapeles no tenía${sobranFilas===1?'':'n'} empleado debajo y no se usó.`);
  if(sobranCols) partes.push(`Se ignoraron ${sobranCols} celda${sobranCols===1?'':'s'} que quedaban a la derecha de "Bono adic.".`);
  if(errores.length) partes.push('No se usaron:\n· '+errores.slice(0,8).join('\n· ')+(errores.length>8?`\n· …y ${errores.length-8} más`:''));
  if(avisos.length) partes.push('Revisá:\n· '+avisos.slice(0,8).join('\n· '));
  b.nota={tipo:errores.length||avisos.length?'malo':'bien',texto:partes.join('\n')};
  focoPlanilla={campo:inp.dataset.campoEmp,emp:inp.dataset.emp};
  pintar();
}

ACCIONES.aplicarNovedadVarios=()=>{
  const b=borradorPlanilla, e=emp();
  const campo=document.getElementById('nvCampo').value;
  const valor=leerNumeroNovedad(document.getElementById('nvValor').value);
  const destino=document.getElementById('nvDestino').value;
  const puesto=destino.startsWith('puesto:')?destino.slice(7):null;
  const indices=b.detalle.map((f,i)=>i).filter(i=>{
    const f=b.detalle[i]; if(f.excluido) return false;
    return !puesto||(((e.empleados.find(x=>x.id===f.empleadoId)||{}).puesto||'').trim()===puesto);
  });
  if(!indices.length){ avisar('No hay empleados incluidos para ese grupo.'); return; }
  const errores=[], avisos=[], usados=[];
  indices.forEach(i=>{
    const f=b.detalle[i], rev=revisarNovedad(campo,valor,b,f.nombre);
    if(rev.error){ errores.push(rev.error); return; }
    if(rev.aviso) avisos.push(rev.aviso);
    f[campo]=valor; if(campo==='bonoAdicional') f.bonoDeFicha=false; usados.push(i);
  });
  if(!usados.length){ avisar(errores[0]||'No se aplicó a nadie.'); return; }
  recalcularFilasPlanilla(usados);
  const grupo=puesto?`los de "${puesto}"`:'todos los incluidos';
  b.nota={tipo:avisos.length||errores.length?'malo':'bien',
    texto:`${NOMBRE_NOVEDAD[campo]} = ${valor} para ${grupo}: ${usados.length} empleado${usados.length===1?'':'s'}.`
      +(errores.length?`\nNo se aplicó a ${errores.length}: ${errores[0]}`:'')
      +(avisos.length?`\nRevisá: ${avisos[0]}${avisos.length>1?` (y ${avisos.length-1} más)`:''}`:'')};
  pintar();
};

/* ---- Plantilla de Excel ---- */
const COLUMNAS_PLANTILLA=['Código (no cambiar)','Nombre','Puesto',...CAMPOS_NOVEDAD.map(c=>NOMBRE_NOVEDAD[c.k])];
ACCIONES.plantillaNovedades=async()=>{
  const b=borradorPlanilla, e=emp();
  let XLSX; try{ XLSX=await cargarSheetJs(); }catch(err){ avisar('No se pudo cargar el generador de Excel. Revisá tu conexión e intentá de nuevo.'); return; }
  const filas=b.detalle.map(f=>[f.empleadoId,f.nombre,((e.empleados.find(x=>x.id===f.empleadoId)||{}).puesto||''),...CAMPOS_NOVEDAD.map(c=>+f[c.k]||0)]);
  const hoja=XLSX.utils.aoa_to_sheet([COLUMNAS_PLANTILLA,...filas]);
  hoja['!cols']=[{hidden:true,wch:12},{wch:38},{wch:20},{wch:12},{wch:12},{wch:14},{wch:15},{wch:15}];
  const ayuda=XLSX.utils.aoa_to_sheet([
    ['Cómo llenar esta plantilla'],[''],
    ['1. Escribí las novedades de cada empleado en las columnas de la hoja "Novedades". Lo que quede vacío cuenta como 0.'],
    ['2. Días falta: días completos que no trabajó. Si corresponde descontar el séptimo día, sumalo aquí.'],
    ['3. Horas extra: entre semana, a tiempo y medio. Máximo legal: 4 por día.'],
    ['4. Horas domingo: horas trabajadas en domingo o día de descanso.'],
    ['5. Horas de menos: llegadas tarde o salidas antes. Se descuentan al valor normal de la hora.'],
    ['6. Bono adic.: monto en quetzales para este período (si el empleado tiene bono fijo, ya viene escrito).'],
    ['7. No cambies ni borres la columna oculta "Código": sirve para reconocer a cada empleado aunque cambies el nombre.'],
    ['8. Guardá el archivo y subilo en la planilla con "Cargar novedades desde Excel". Antes de aplicar, el sistema te muestra los cambios.'],
  ]);
  ayuda['!cols']=[{wch:110}];
  const libro=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro,hoja,'Novedades');
  XLSX.utils.book_append_sheet(libro,ayuda,'Instrucciones');
  XLSX.writeFile(libro,`Novedades planilla ${b.desde} al ${b.hasta}.xlsx`);
};
ACCIONES.subirNovedades=()=>{ const a=document.getElementById('archivoNovedades'); if(a) a.click(); };

const normalizarTexto=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
/* Reconoce las columnas por su encabezado, para aceptar la plantilla del sistema o un Excel propio parecido. */
function columnaNovedad(encabezado){
  const h=normalizarTexto(encabezado);
  if(!h) return null;
  if(h==='id'||h.startsWith('codigo')) return 'id';
  if(h.includes('falta')) return 'diasFalta';
  if(h.includes('domingo')||h.includes('descanso')||h.includes('asueto')) return 'horasExtraDomingo';
  if(h.includes('menos')||h.includes('tarde')) return 'horasMenos';
  if(h.includes('extra')) return 'horasExtra';
  if((h.includes('bono')||h.includes('bonific'))&&!h.includes('incentivo')&&!h.includes('14')) return 'bonoAdicional';   // "Bono", "Bonificación adicional"; no la incentivo ni el Bono 14
  if(h.includes('nombre')||h.includes('empleado')||h.includes('trabajador')||h.includes('colaborador')) return 'nombre';
  return null;
}
async function leerExcelNovedades(archivo){
  const b=borradorPlanilla;
  let XLSX; try{ XLSX=await cargarSheetJs(); }catch(err){ avisar('No se pudo cargar el lector de Excel. Revisá tu conexión e intentá de nuevo.'); return; }
  let filas;
  try{
    const libro=XLSX.read(await archivo.arrayBuffer(),{type:'array'});
    const hoja=libro.Sheets['Novedades']||libro.Sheets[libro.SheetNames[0]];
    filas=XLSX.utils.sheet_to_json(hoja,{header:1,defval:'',raw:true});
  }catch(err){ avisar('No se pudo leer el archivo. Tiene que ser un Excel (.xlsx o .xls) o un .csv.'); return; }
  /* El encabezado es la primera fila (de las 10 primeras) que tenga nombre o código y al menos una novedad. */
  let cab=-1, mapa={};
  for(let r=0;r<Math.min(10,filas.length);r++){
    const m={}; filas[r].forEach((v,c)=>{ const k=columnaNovedad(v); if(k&&m[k]===undefined) m[k]=c; });
    if((m.id!==undefined||m.nombre!==undefined)&&CAMPOS_NOVEDAD.some(c=>m[c.k]!==undefined)){ cab=r; mapa=m; break; }
  }
  if(cab<0){ avisar('No encontré los encabezados. El archivo necesita una columna "Nombre" (o la columna "Código" de la plantilla) y al menos una de: Días falta, Horas extra, Horas domingo, Horas de menos, Bono.\n\nLo más fácil es usar "Descargar plantilla de Excel".'); return; }

  const porId=new Map(b.detalle.map((f,i)=>[f.empleadoId,i]));
  const porNombre=new Map(); b.detalle.forEach((f,i)=>porNombre.set(normalizarTexto(f.nombre),i));
  const buscarPorNombre=n=>{
    if(!n) return undefined;
    if(porNombre.has(n)) return porNombre.get(n);
    const parecidos=[...porNombre.keys()].filter(k=>k.startsWith(n+' ')||n.startsWith(k+' '));   // "Juan Pérez" ↔ "Juan Pérez López"
    return parecidos.length===1?porNombre.get(parecidos[0]):undefined;
  };
  const cambios=new Map(), noEncontrados=[], errores=[], avisos=[], repetidos=new Set(), vistos=new Set();
  filas.slice(cab+1).forEach((fila,r)=>{
    const id=mapa.id!==undefined?String(fila[mapa.id]||'').trim():'';
    const nombre=mapa.nombre!==undefined?String(fila[mapa.nombre]||'').trim():'';
    if(!id&&!nombre&&CAMPOS_NOVEDAD.every(c=>mapa[c.k]===undefined||fila[mapa[c.k]]===''||fila[mapa[c.k]]==null)) return;   // fila vacía
    let i=id?porId.get(id):undefined;
    if(i===undefined) i=buscarPorNombre(normalizarTexto(nombre));
    if(i===undefined){ noEncontrados.push(`Fila ${cab+r+2}: ${nombre||id||'(sin nombre)'}`); return; }
    if(vistos.has(i)) repetidos.add(b.detalle[i].nombre); vistos.add(i);
    const f=b.detalle[i], nuevo=cambios.get(i)||{};
    CAMPOS_NOVEDAD.forEach(c=>{
      if(mapa[c.k]===undefined) return;           // esa columna no viene: se deja lo que hay
      const v=leerNumeroNovedad(fila[mapa[c.k]]), rev=revisarNovedad(c.k,v,b,f.nombre);
      if(rev.error){ errores.push(rev.error); return; }
      if(rev.aviso) avisos.push(rev.aviso);
      if((+f[c.k]||0)!==v) nuevo[c.k]=v; else delete nuevo[c.k];
    });
    if(Object.keys(nuevo).length) cambios.set(i,nuevo); else cambios.delete(i);
  });
  mostrarVistaPreviaNovedades(cambios,{noEncontrados,errores,avisos,repetidos:[...repetidos]},archivo.name);
}
function mostrarVistaPreviaNovedades(cambios,prob,nombreArchivo){
  const b=borradorPlanilla;
  const lista=[...cambios.entries()];
  const nValores=lista.reduce((s,[,c])=>s+Object.keys(c).length,0);
  const excluidos=lista.filter(([i])=>b.detalle[i].excluido).map(([i])=>b.detalle[i].nombre);
  const bloque=(titulo,items,max=10)=>items.length?`<div class="aviso malo" style="margin:12px 0 0;white-space:normal"><strong>${titulo}</strong><br>
    ${items.slice(0,max).map(esc).join('<br>')}${items.length>max?`<br>…y ${items.length-max} más`:''}</div>`:'';
  const filas=lista.slice(0,200).map(([i,c])=>`<tr><td>${esc(b.detalle[i].nombre)}</td><td>${Object.entries(c).map(([k,v])=>
    `${NOMBRE_NOVEDAD[k]}: ${+b.detalle[i][k]||0} → <strong>${v}</strong>`).join('<br>')}</td></tr>`).join('');
  abrirModal('Novedades desde Excel',
    `<p style="margin:0 0 12px;color:var(--tinta-suave);font-size:14px">${esc(nombreArchivo)}</p>
     ${lista.length?`<p style="margin:0 0 12px">Se van a cambiar <strong>${nValores} valor${nValores===1?'':'es'}</strong> en <strong>${lista.length} empleado${lista.length===1?'':'s'}</strong>.</p>
       <div style="max-height:300px;overflow:auto;border:1px solid var(--linea);border-radius:var(--radio-chico)">
       <table style="font-size:13px"><thead><tr><th>Empleado</th><th>Cambios</th></tr></thead><tbody>${filas}</tbody></table></div>`
      :'<p style="margin:0">El archivo no trae cambios: todos los valores ya coinciden con la planilla.</p>'}
     ${bloque('No se encontraron en esta planilla (no se usan):',prob.noEncontrados)}
     ${bloque('Valores que no se usan:',prob.errores)}
     ${bloque('Revisá (sí se aplican):',prob.avisos)}
     ${bloque('Aparecen más de una vez (queda la última fila):',prob.repetidos)}
     ${bloque('Están excluidos de esta planilla (se cargan sus datos, pero siguen sin incluirse):',excluidos)}`,
    ()=>{
      if(!lista.length) return;
      lista.forEach(([i,c])=>{ Object.assign(b.detalle[i],c); if('bonoAdicional' in c) b.detalle[i].bonoDeFicha=false; });
      recalcularFilasPlanilla(lista.map(([i])=>i));
      b.nota={tipo:'bien',texto:`Se cargaron ${nValores} valor${nValores===1?'':'es'} desde Excel en ${lista.length} empleado${lista.length===1?'':'s'}.`};
    },lista.length?'Aplicar cambios':'Cerrar');
}
