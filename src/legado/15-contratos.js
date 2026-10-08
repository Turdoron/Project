/* ============ CONTRATOS DE TRABAJO Y PUESTOS ============ */
/* Contrato individual de trabajo (Código de Trabajo, Dto. 1441): se llena con un formulario y se ve en
   vivo como quedará; los datos de la empresa y del trabajador salen de su ficha. Después de armarlo se
   puede corregir el texto a mano. Los puestos tienen su catálogo de funciones, que pasa a la cláusula
   del cargo. */

/* ---------- Números, fechas y DPI en letras ---------- */
const LET_U=['cero','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','trece','catorce','quince',
  'dieciséis','diecisiete','dieciocho','diecinueve','veinte','veintiuno','veintidós','veintitrés','veinticuatro','veinticinco','veintiséis','veintisiete','veintiocho','veintinueve'];
const LET_D=['','','','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
const LET_C=['','ciento','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos'];
function enteroEnLetras(n){
  n=Math.floor(Math.abs(+n||0));
  const m1000=x=>{ if(x===100) return 'cien'; const c=Math.floor(x/100), r=x%100; let s=LET_C[c];
    if(r){ if(s) s+=' '; s+=r<30?LET_U[r]:(LET_D[Math.floor(r/10)]+(r%10?' y '+LET_U[r%10]:'')); } return s; };
  const apoc=t=>t.replace(/veintiuno$/,'veintiún').replace(/uno$/,'un');
  if(n===0) return 'cero';
  const mill=Math.floor(n/1e6), miles=Math.floor((n%1e6)/1000), resto=n%1000, p=[];
  if(mill) p.push(mill===1?'un millón':apoc(m1000(mill))+' millones');
  if(miles) p.push(miles===1?'mil':apoc(m1000(miles))+' mil');
  if(resto) p.push(m1000(resto));
  return p.join(' ');
}
const MESES_LETRAS=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
/* "ocho de octubre del año dos mil veintiséis" */
function fechaEnLetras(f){
  if(!f) return '';
  const [a,m,d]=f.split('-').map(Number);
  return `${d===1?'uno':enteroEnLetras(d)} de ${MESES_LETRAS[m-1]} del año ${enteroEnLetras(a)}`;
}
/* Cifras de un documento, grupo por grupo, con los ceros a la izquierda dichos: 0801 → "CERO OCHOCIENTOS UNO". */
function cifrasEnLetras(texto){
  return String(texto||'').trim().split(/\s+/).filter(Boolean).map(g=>{
    const ceros=(g.match(/^0+/)||[''])[0].length, resto=g.slice(ceros);
    return [...Array(ceros).fill('cero'),...(resto?[enteroEnLetras(+resto)]:[])].join(' ');
  }).join(', ').toUpperCase();
}
const dpiFormato=dpi=>{ const s=String(dpi||'').replace(/\D/g,''); return s.length===13?`${s.slice(0,4)} ${s.slice(4,9)} ${s.slice(9)}`:String(dpi||'').trim(); };
const edadAl=(nac,fecha)=>{ if(!nac) return null; const [a,m,d]=nac.split('-').map(Number), [a2,m2,d2]=(fecha||hoy()).split('-').map(Number);
  return a2-a-((m2<m||(m2===m&&d2<d))?1:0); };
const ESTADOS_CIVILES={soltero:['soltero','soltera'],casado:['casado','casada'],unido:['unido de hecho','unida de hecho'],divorciado:['divorciado','divorciada'],viudo:['viudo','viuda']};
const generoTxt=(sexo,m,f)=>sexo==='F'?f:m;
const nacionalidadTxt=(nac,sexo)=>{ const n=(nac||'guatemalteco').trim().toLowerCase(); return sexo==='F'?n.replace(/o$/,'a'):n; };

/* ---------- Puestos y funciones ---------- */
/* Puesto del catálogo de la empresa; si no está pero existe en la base de puestos, se agrega solo. */
function asegurarPuesto(e,nombre){
  const n=(nombre||'').trim(); if(!n) return null;
  e.puestos=e.puestos||[];
  let p=e.puestos.find(x=>x.nombre.toLowerCase()===n.toLowerCase());
  if(p) return p;
  const base=PUESTOS_BASE.find(x=>x.nombre.toLowerCase()===n.toLowerCase());
  if(!base) return null;
  p={id:uid(),nombre:base.nombre,area:base.area,salario:0,funciones:[...base.funciones]}; e.puestos.push(p);
  return p;
}
const puestoDeEmpleado=(e,x)=>(e.puestos||[]).find(p=>p.id===x.puestoId)||(e.puestos||[]).find(p=>p.nombre.toLowerCase()===(x.puesto||'').toLowerCase())||null;
/* Opciones para elegir puesto: primero los de la empresa, después los de la base que todavía no están. */
function opcionesPuestos(e){
  const ya=new Set((e.puestos||[]).map(p=>p.nombre.toLowerCase()));
  return (e.puestos||[]).map(p=>`<option value="${esc(p.nombre)}">${esc(p.area||'Puesto de la empresa')}</option>`).join('')
    +PUESTOS_BASE.filter(p=>!ya.has(p.nombre.toLowerCase())).map(p=>`<option value="${esc(p.nombre)}">${esc(p.area)} · de la base de puestos</option>`).join('');
}
const funcionesDe=p=>(p&&p.funciones||[]).filter(Boolean);
VISTAS.puestos=()=>{
  const e=emp(), lista=(e.puestos||[]).slice().sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
  const empleadosEn=p=>(e.empleados||[]).filter(x=>x.activo!==false&&(x.puesto||'').toLowerCase()===p.nombre.toLowerCase()).length;
  return cab('Puestos y funciones','Cada puesto con sus funciones: pasan solas a la cláusula del cargo en el contrato de trabajo.',
    `<button class="btn sec" data-accion="puestosComunes">Agregar de la base de puestos</button><button class="btn" data-accion="editarPuesto">Nuevo puesto</button>`)
  +(lista.length?`<table><thead><tr><th>Puesto</th><th>Funciones</th><th class="num">Salario sugerido</th><th class="num">Empleados</th><th class="num"></th></tr></thead><tbody>
    ${lista.map(p=>`<tr><td><strong>${esc(p.nombre)}</strong></td><td style="font-size:13px;color:var(--tinta-suave)">${funcionesDe(p).slice(0,3).map(esc).join(' · ')}${funcionesDe(p).length>3?` · y ${funcionesDe(p).length-3} más`:''}</td>
      <td class="num">${p.salario?Q(p.salario):'—'}</td><td class="num">${empleadosEn(p)}</td>
      <td class="num" style="white-space:nowrap"><button class="btn mini sec" data-accion="editarPuesto" data-id="${p.id}">Editar</button> <button class="btn mini peligro" data-accion="borrarPuesto" data-id="${p.id}">Eliminar</button></td></tr>`).join('')}</tbody></table>`
   :`<div class="vacio">Todavía no hay puestos. Agregalos desde la base de puestos (${PUESTOS_BASE.length} puestos con sus funciones, por área) o creá uno propio. También se agregan solos al elegir el puesto en la ficha de un empleado.</div>`);
};
ACCIONES.editarPuesto=d=>{
  const e=emp(); e.puestos=e.puestos||[];
  const p=d&&d.id?e.puestos.find(x=>x.id===d.id):null;
  abrirModal(p?`Editar puesto — ${esc(p.nombre)}`:'Nuevo puesto',
    `<div class="rej">
      <div class="campo"><label>Nombre del puesto</label><input name="nombre" value="${esc(p?p.nombre:'')}" placeholder="Ej.: Auxiliar de bodega"></div>
      <div class="campo"><label>Salario base sugerido (opcional)</label><input name="salario" type="number" step="0.01" min="0" value="${p&&p.salario||''}"></div>
      <div class="campo full"><label>Funciones (una por línea)</label><textarea name="funciones" rows="8" style="width:100%" placeholder="Atender a los clientes&#10;Llevar el control de…">${esc(funcionesDe(p).join('\n'))}</textarea></div>
    </div>`,
    f=>{
      const nombre=(f.nombre||'').trim(); if(!nombre){avisar('Escribí el nombre del puesto.');return false}
      if(e.puestos.some(x=>x.nombre.toLowerCase()===nombre.toLowerCase()&&(!p||x.id!==p.id))){avisar('Ya existe un puesto con ese nombre.');return false}
      const datos={nombre,salario:+f.salario||0,funciones:(f.funciones||'').split('\n').map(s=>s.trim().replace(/^[-•·\d.)\s]+/,'').trim()).filter(Boolean)};
      if(p) Object.assign(p,datos); else e.puestos.push({id:uid(),...datos});
      registrarLog(p?'Editó un puesto':'Creó un puesto',nombre); guardar();
    },p?'Guardar puesto':'Crear puesto');
};
ACCIONES.borrarPuesto=d=>{
  const e=emp(), p=(e.puestos||[]).find(x=>x.id===d.id); if(!p) return;
  confirmar(`Se eliminará el puesto ${p.nombre}. Los empleados y contratos que ya lo usan no cambian.`,()=>{ e.puestos=e.puestos.filter(x=>x.id!==p.id); guardar(); pintar(); },'Eliminar');
};
ACCIONES.puestosComunes=()=>{
  const e=emp(), ya=new Set((e.puestos||[]).map(p=>p.nombre.toLowerCase()));
  abrirModal('Base de puestos',
    `<p style="margin:0 0 10px;font-size:13px;color:var(--tinta-suave)">Marcá los puestos que tiene la empresa. Se agregan con sus funciones, que después podés ajustar.</p>
    <input id="buscaPuesto" type="search" placeholder="Buscar puesto (ej.: bodega, contador, piloto)" aria-label="Buscar puesto" style="margin-bottom:12px">
    <div class="base-puestos">${Object.keys(PUESTOS_BASE_AREAS).map(area=>`<div class="bp-area"><h4>${esc(area)}</h4>${PUESTOS_BASE.map((p,i)=>p.area!==area?'':`<label class="chequeo bp-item" data-busca="${esc((p.nombre+' '+p.funciones.join(' ')).toLowerCase())}"><input type="checkbox" name="pb_${i}"${ya.has(p.nombre.toLowerCase())?' disabled checked':''}>
      <span><strong>${esc(p.nombre)}</strong>${ya.has(p.nombre.toLowerCase())?' <em>(ya está)</em>':''}<br><small>${esc(p.funciones.slice(0,2).join(' · '))}…</small></span></label>`).join('')}</div>`).join('')}</div>`,
    f=>{
      e.puestos=e.puestos||[]; let n=0;
      PUESTOS_BASE.forEach((p,i)=>{ if(f['pb_'+i]==='on'&&!ya.has(p.nombre.toLowerCase())){ asegurarPuesto(e,p.nombre); n++; } });
      if(!n){avisar('Marcá al menos un puesto.');return false}
      registrarLog('Agregó puestos de la base',`${n} puesto(s)`); guardar();
    },'Agregar');
  const b=document.getElementById('buscaPuesto');
  b.addEventListener('input',()=>{ const q=b.value.trim().toLowerCase();
    mForm.querySelectorAll('.bp-item').forEach(it=>{ it.hidden=!!q&&!it.dataset.busca.includes(q); });
    mForm.querySelectorAll('.bp-area').forEach(a=>{ a.hidden=![...a.querySelectorAll('.bp-item')].some(it=>!it.hidden); }); });
};

/* ---------- Datos de la empresa para los contratos ---------- */
function datosContratoEmpresa(e){
  const d=e.datosContrato||{};
  const pareceSociedad=e.tipoSociedad==='sociedad'||/sociedad an[oó]nima|\bs\.\s?a\.?$/i.test(e.nombre||'');
  return {esSociedad:d.esSociedad!==undefined?!!d.esSociedad:pareceSociedad,ciudad:d.ciudad||'Guatemala',municipio:d.municipio||'Guatemala',departamento:d.departamento||'Guatemala',
    rep:Object.assign({nombre:e.representante||'',sexo:'M',fechaNac:'',estadoCivil:'casado',profesion:'',nacionalidad:'guatemalteco',vecindad:'',dpi:''},d.rep||{}),
    personeria:Object.assign({notario:'',fecha:'',registro:'',folio:'',libro:''},d.personeria||{})};
}
ACCIONES.datosContratoEmpresa=()=>{
  const e=emp(), d=datosContratoEmpresa(e), r=d.rep, p=d.personeria, soc=d.esSociedad;
  const ec=Object.entries(ESTADOS_CIVILES).map(([k,v])=>`<option value="${k}"${r.estadoCivil===k?' selected':''}>${v[0]} / ${v[1]}</option>`).join('');
  abrirModal('Datos de la empresa para los contratos',
    `<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">Se llenan una sola vez y se usan en todos los contratos.</p>
    <div class="rej">
      <div class="campo full"><label>La empresa es</label><select name="esSociedad">
        <option value="si"${soc?' selected':''}>Sociedad (anónima u otra) — comparece su representante legal, nombrado por acta notarial</option>
        <option value="no"${soc?'':' selected'}>Empresa individual — comparece el propietario</option></select></div>
      <div class="campo"><label>Municipio donde se firman</label><input name="municipio" value="${esc(d.municipio)}"></div>
      <div class="campo"><label>Departamento</label><input name="departamento" value="${esc(d.departamento)}"></div>
      <div class="campo full"><label id="lblRep">${soc?'Representante legal':'Propietario'} — nombre completo</label><input name="r_nombre" value="${esc(r.nombre)}"></div>
      <div class="campo"><label>Sexo</label><select name="r_sexo"><option value="M"${r.sexo!=='F'?' selected':''}>Masculino</option><option value="F"${r.sexo==='F'?' selected':''}>Femenino</option></select></div>
      <div class="campo"><label>Fecha de nacimiento</label><input name="r_fechaNac" type="date" value="${esc(r.fechaNac)}"></div>
      <div class="campo"><label>Estado civil</label><select name="r_estadoCivil">${ec}</select></div>
      <div class="campo"><label>Profesión u oficio</label><input name="r_profesion" value="${esc(r.profesion)}" placeholder="Ej.: ingeniero electricista"></div>
      <div class="campo"><label>Nacionalidad</label><input name="r_nacionalidad" value="${esc(r.nacionalidad)}"></div>
      <div class="campo"><label>Vecino del municipio de</label><input name="r_vecindad" value="${esc(r.vecindad)}" placeholder="Guatemala"></div>
      <div class="campo full"><label>DPI (CUI)</label><input name="r_dpi" value="${esc(r.dpi)}" placeholder="2695 40784 0801" inputmode="numeric"></div>
    </div>
    <div id="bloqueNombramiento"${soc?'':' hidden'}><h4 style="margin:16px 0 4px">Razón de nombramiento del representante legal</h4>
    <p style="margin:0 0 8px;font-size:12.5px;color:var(--tinta-suave)">Del acta notarial de nombramiento y su razón de inscripción en el Registro Mercantil. En el contrato salen en letras y en números.</p><div class="rej">
      <div class="campo"><label>Acta notarial autorizada por el notario</label><input name="p_notario" value="${esc(p.notario)}"></div>
      <div class="campo"><label>Fecha del acta notarial</label><input name="p_fecha" type="date" value="${esc(p.fecha)}"></div>
      <div class="campo"><label>Registro número</label><input name="p_registro" value="${esc(p.registro)}" inputmode="numeric"></div>
      <div class="campo"><label>Folio</label><input name="p_folio" value="${esc(p.folio)}" inputmode="numeric"></div>
      <div class="campo"><label>Libro (de Auxiliares de Comercio)</label><input name="p_libro" value="${esc(p.libro)}" inputmode="numeric"></div>
      <div class="campo full" id="prevNombramiento" style="font-size:12.5px;color:var(--tinta-suave)"></div>
    </div></div>`,
    async f=>{
      const socF=f.esSociedad==='si';
      if(socF&&(!(f.p_registro||'').trim()||!(f.p_folio||'').trim()||!(f.p_libro||'').trim()||!(f.p_notario||'').trim()||!f.p_fecha)){
        if(!(await preguntar('Falta parte de la razón de nombramiento (notario, fecha, registro, folio o libro). En el contrato quedará marcado como pendiente.','Guardar así'))) return false; }
      e.datosContrato={esSociedad:socF,municipio:(f.municipio||'').trim(),departamento:(f.departamento||'').trim(),ciudad:(f.municipio||'').trim(),
        rep:{nombre:(f.r_nombre||'').trim(),sexo:f.r_sexo,fechaNac:f.r_fechaNac||'',estadoCivil:f.r_estadoCivil,profesion:(f.r_profesion||'').trim(),nacionalidad:(f.r_nacionalidad||'').trim(),vecindad:(f.r_vecindad||'').trim(),dpi:(f.r_dpi||'').trim()},
        personeria:socF?{notario:(f.p_notario||'').trim(),fecha:f.p_fecha||'',registro:(f.p_registro||'').trim(),folio:(f.p_folio||'').trim(),libro:(f.p_libro||'').trim()}:{}};
      if(!e.representante&&e.datosContrato.rep.nombre) e.representante=e.datosContrato.rep.nombre;
      registrarLog('Actualizó los datos para contratos',e.nombre); guardar();
    },'Guardar');
  const g=n=>mForm.querySelector(`[name="${n}"]`);
  const act=()=>{ const so=g('esSociedad').value==='si';
    document.getElementById('bloqueNombramiento').hidden=!so; document.getElementById('lblRep').textContent=(so?'Representante legal':'Propietario')+' — nombre completo';
    const n=x=>x&&/^\d+$/.test(x.trim())?`${enteroEnLetras(+x).toUpperCase()} (${x.trim()})`:'—';
    document.getElementById('prevNombramiento').textContent=so?`Así queda: registro ${n(g('p_registro').value)}, folio ${n(g('p_folio').value)}, libro ${n(g('p_libro').value)} de Auxiliares de Comercio.`:''; };
  ['esSociedad','p_registro','p_folio','p_libro'].forEach(k=>{ const el=g(k); if(el){ el.addEventListener('input',act); el.addEventListener('change',act); } }); act();
};

/* ---------- El contrato ---------- */
const PLAZOS_CONTRATO={indefinido:'Por tiempo indefinido',fijo:'A plazo fijo',obra:'Para obra determinada'};
const JORNADAS={diurna:{nombre:'diurna',horas:44,horario:'de lunes a viernes, de las ocho a las diecisiete horas'},
  mixta:{nombre:'mixta',horas:42,horario:'de lunes a sábado, de las catorce a las veintiún horas'},
  nocturna:{nombre:'nocturna',horas:36,horario:'de lunes a sábado, de las dieciocho a las veinticuatro horas'}};
const PAGOS_CONTRATO={quincenal:'quincenal',mensual:'mensual',semanal:'semanal'};
const CLAUSULAS_OPCIONALES={
  prueba:{nombre:'Período de prueba de dos meses (Art. 81)',def:true},
  productividad:{nombre:'Bonificación por productividad (variable)',def:true},
  vehiculos:{nombre:'Uso de vehículos y equipo de protección',def:false},
  exclusividad:{nombre:'Exclusividad',def:true},
  confidencialidad:{nombre:'Confidencialidad',def:true},
  legalizacion:{nombre:'Acta de legalización de firmas (notario)',def:false}};
let contratoActual=null;
function nuevoDatosContrato(e,x){
  const p=puestoDeEmpleado(e,x)||asegurarPuesto(e,x.puesto);
  return {empleadoId:x.id,fecha:hoy(),fechaInicio:x.fechaIngreso||hoy(),plazo:'indefinido',plazoHasta:'',obra:'',
    jornada:'diurna',horario:JORNADAS.diurna.horario,descanso:'sábado y domingo',almuerzo:'de las doce a las trece horas',
    salario:x.salarioBase||0,pago:'quincenal',lugar:'',puesto:x.puesto||'',funciones:funcionesDe(p).join('\n'),
    clausulas:Object.fromEntries(Object.entries(CLAUSULAS_OPCIONALES).map(([k,c])=>[k,c.def])),fechaLegalizacion:''};
}
/* Valor o marca de dato faltante (se ve resaltado en la vista previa; al imprimir queda una línea para llenar). */
const faltaCt=t=>`<span class="falta" title="Falta: ${esc(t)}">[${esc(t)}]</span>`;
const valCt=(x,t)=>x?esc(x):faltaCt(t);
function htmlContrato(e,c){
  const dc=datosContratoEmpresa(e), r=dc.rep, per=dc.personeria, soc=dc.esSociedad;
  const t=(e.empleados||[]).find(x=>x.id===c.empleadoId)||{}, sx=t.sexo, cl=c.clausulas||{};
  const edadT=edadAl(t.fechaNac,c.fecha), edadR=edadAl(r.fechaNac,c.fecha);
  const ecT=t.estadoCivil?ESTADOS_CIVILES[t.estadoCivil][sx==='F'?1:0]:'', ecR=r.estadoCivil?ESTADOS_CIVILES[r.estadoCivil][r.sexo==='F'?1:0]:'';
  const dpiT=dpiFormato(t.dpi), dpiR=dpiFormato(r.dpi);
  const emp_=`“${esc((e.nombre||'').toUpperCase())}”`;
  const lugar=c.lugar||`${e.direccion||''}`;
  const J=JORNADAS[c.jornada]||JORNADAS.diurna;
  const funciones=(c.funciones||'').split('\n').map(s=>s.trim()).filter(Boolean);
  const plazoTxt=c.plazo==='fijo'?`A PLAZO FIJO, hasta el ${c.plazoHasta?fechaEnLetras(c.plazoHasta):faltaCt('fecha de terminación')}`
    :c.plazo==='obra'?`PARA OBRA DETERMINADA, que consiste en: ${valCt(c.obra,'descripción de la obra')}`:'TIEMPO INDEFINIDO';
  const n=[]; const cl_=(titulo,txt)=>n.push(`<p><strong>${n.length+1}. ${titulo}:</strong> ${txt}</p>`);
  const comp=soc
    ?`comparece ${generoTxt(r.sexo,'el señor','la señora')} ${valCt((r.nombre||'').toUpperCase(),'nombre del representante legal')}, de ${edadR!==null?enteroEnLetras(edadR):faltaCt('edad')} años de edad, ${valCt(ecR,'estado civil')}, ${valCt(r.profesion,'profesión')}, ${esc(nacionalidadTxt(r.nacionalidad,r.sexo))}, ${generoTxt(r.sexo,'vecino','vecina')} del municipio de ${valCt(r.vecindad,'vecindad')}, quien se identifica con Documento Personal de Identificación con Código Único de Identificación número ${dpiR?`${cifrasEnLetras(dpiR)} (${esc(dpiR)})`:faltaCt('DPI del representante')}, extendido por el Registro Nacional de las Personas de la República de Guatemala, quien actúa en su calidad de representante legal de la entidad ${emp_}, lo que acredita con el acta notarial de su nombramiento autorizada por el Notario ${valCt(per.notario,'notario')}, el ${per.fecha?fechaEnLetras(per.fecha):faltaCt('fecha del acta')}, inscrita en el Registro Mercantil General de la República bajo el número ${per.registro?`${enteroEnLetras(+per.registro).toUpperCase()} (${esc(per.registro)})`:faltaCt('registro')}, folio ${per.folio?`${enteroEnLetras(+per.folio).toUpperCase()} (${esc(per.folio)})`:faltaCt('folio')}, del libro ${per.libro?`${enteroEnLetras(+per.libro).toUpperCase()} (${esc(per.libro)})`:faltaCt('libro')} de Auxiliares de Comercio`
    :`comparece ${generoTxt(r.sexo,'el señor','la señora')} ${valCt((r.nombre||'').toUpperCase(),'nombre del propietario')}, de ${edadR!==null?enteroEnLetras(edadR):faltaCt('edad')} años de edad, ${valCt(ecR,'estado civil')}, ${valCt(r.profesion,'profesión')}, ${esc(nacionalidadTxt(r.nacionalidad,r.sexo))}, ${generoTxt(r.sexo,'vecino','vecina')} del municipio de ${valCt(r.vecindad,'vecindad')}, quien se identifica con Documento Personal de Identificación con Código Único de Identificación número ${dpiR?`${cifrasEnLetras(dpiR)} (${esc(dpiR)})`:faltaCt('DPI del propietario')}, extendido por el Registro Nacional de las Personas de la República de Guatemala, en su calidad de ${generoTxt(r.sexo,'propietario','propietaria')} de la empresa ${emp_}`;
  const encabezado=`<p class="ct-num">Contrato No. ${esc(String(c.numero||''))}</p><h1 class="ct-titulo">CONTRATO INDIVIDUAL DE TRABAJO</h1>
    <p>En el municipio de ${valCt(dc.municipio,'municipio')}, departamento de ${valCt(dc.departamento,'departamento')}, el ${c.fecha?fechaEnLetras(c.fecha):faltaCt('fecha')}, constituidos en las instalaciones de ${emp_}, ubicada en ${valCt(e.direccion,'dirección de la empresa')}; por una parte ${comp}; y por la otra parte comparece ${valCt((t.nombre||'').toUpperCase(),'nombre del trabajador')}, de ${edadT!==null?enteroEnLetras(edadT):faltaCt('edad')} años de edad, ${valCt(ecT,'estado civil')}, ${valCt(t.profesion,'profesión u oficio')}, ${esc(nacionalidadTxt(t.nacionalidad,sx))}, ${generoTxt(sx,'vecino','vecina')} del municipio de ${valCt(t.municipio,'municipio')}, departamento de ${valCt(t.departamento,'departamento')}, quien se identifica con Documento Personal de Identificación con Código Único de Identificación número ${dpiT?`${cifrasEnLetras(dpiT)} (${esc(dpiT)})`:faltaCt('DPI del trabajador')}, extendido por el Registro Nacional de las Personas de la República de Guatemala; quienes para los efectos de este contrato se denominarán “EL PATRONO” y “EL TRABAJADOR”, respectivamente, y celebran el presente CONTRATO INDIVIDUAL DE TRABAJO de conformidad con las cláusulas siguientes:</p>`;
  cl_('INICIO DE LA RELACIÓN DE TRABAJO',`La relación de trabajo se inicia el ${c.fechaInicio?fechaEnLetras(c.fechaInicio):faltaCt('fecha de inicio')}.`);
  cl_('CARGO Y SERVICIOS DEL TRABAJADOR',`El trabajador desempeñará su trabajo con la eficiencia y esmero apropiados, en la forma, tiempo y lugar indicados por el patrono, ocupando el cargo de ${valCt((c.puesto||'').toUpperCase(),'puesto')}, y le corresponden los servicios inherentes al mismo, que de manera enunciativa y no limitativa son los siguientes:</p>${funciones.length?`<ol class="ct-lista" type="a">${funciones.map(f=>`<li>${esc(f)}</li>`).join('')}</ol>`:`<p>${faltaCt('funciones del puesto')}</p>`}<p>`);
  cl_('LUGAR DE PRESTACIÓN DE LOS SERVICIOS',`Los servicios se prestarán en ${valCt(lugar,'lugar de trabajo')}, y en cualquier otro lugar que por la naturaleza del trabajo así se requiera dentro de la República de Guatemala, previa notificación del jefe inmediato.`);
  cl_('PLAZO DEL CONTRATO',`La duración del presente contrato es ${plazoTxt}.${cl.prueba?' Los primeros dos meses se consideran período de prueba, conforme al artículo 81 del Código de Trabajo, durante el cual cualquiera de las partes puede ponerle término sin responsabilidad de su parte.':''}`);
  cl_('JORNADA DE TRABAJO',`La jornada ordinaria de trabajo será ${J.nombre}, ${valCt(c.horario,'horario')}, sin exceder de ${enteroEnLetras(J.horas)} (${J.horas}) horas a la semana${c.almuerzo?`, con un período para tomar alimentos ${esc(c.almuerzo)}, que no forma parte de la jornada`:''}. El descanso semanal será ${valCt(c.descanso,'días de descanso')}. El tiempo trabajado fuera de la jornada ordinaria se pagará como jornada extraordinaria, conforme a los artículos 121, 126 y 127 del Código de Trabajo.`);
  cl_('SALARIO, BONIFICACIÓN INCENTIVO Y FORMA DE PAGO',`El trabajador devengará un salario ordinario mensual de ${c.salario>0?`${quetzalesEnLetras(c.salario).toUpperCase()} (Q ${Q(c.salario)})`:faltaCt('salario')}. Además se le pagará la Bonificación Incentivo de doscientos cincuenta quetzales exactos (Q 250.00) mensuales, conforme a los Decretos 78-89 y 37-2001 del Congreso de la República.${cl.productividad?' Adicionalmente podrá recibir una bonificación por productividad (artículo 2, Decreto 78-89), según la evaluación de desempeño que el patrono realice conforme a los estándares que le comunique por escrito; esta bonificación es variable, no forma parte del salario y el no recibirla no constituye un cambio en las condiciones de trabajo.':''} Los pagos se harán en forma ${esc(PAGOS_CONTRATO[c.pago]||c.pago)}, mediante transferencia bancaria, cheque o en efectivo en las instalaciones del patrono. La bonificación incentivo no está afecta al pago de cuotas del IGSS, IRTRA e INTECAP.`);
  cl_('OTRAS PRESTACIONES','Las vacaciones, la bonificación anual para trabajadores del sector privado y público (Decreto 42-92) y el aguinaldo (Decreto 76-78) se pagarán al trabajador de conformidad con la ley.');
  cl_('OBLIGACIONES DEL TRABAJADOR',`Además de las contenidas en el artículo 63 del Código de Trabajo, el trabajador se obliga a:</p><ol class="ct-lista" type="a">${[
    'Desempeñar el servicio contratado bajo la dirección del patrono o de su representante, a cuya autoridad queda sujeto en todo lo concerniente al trabajo',
    'Ejecutar el trabajo con la eficiencia, cuidado y esmero apropiados y en la forma, tiempo y lugar convenidos',
    'Restituir al patrono los materiales no usados y conservar en buen estado los instrumentos y útiles que se le faciliten para el trabajo',
    'Observar buenas costumbres durante el trabajo',
    'Prestar los auxilios necesarios en caso de siniestro o riesgo inminente en que las personas o intereses del patrono o de algún compañero de trabajo estén en peligro',
    'Someterse a reconocimiento médico cuando el patrono o el Instituto Guatemalteco de Seguridad Social lo soliciten',
    'Guardar los secretos técnicos, comerciales o de fabricación, así como los asuntos administrativos reservados, cuya divulgación pueda causar perjuicio a la empresa',
    'Observar rigurosamente las medidas preventivas de seguridad y protección personal que acuerden las autoridades competentes y las que indique el patrono',
    ...(cl.vehiculos?['Procurar el buen mantenimiento de los vehículos asignados para el cumplimiento de sus labores y usarlos solo en los horarios y lugares autorizados','Usar el equipo de protección que le entregue el patrono en cada una de sus actividades']:[]),
    'Presentarse puntualmente a la hora y en el lugar indicados para realizar sus labores'].map(x=>`<li>${x}</li>`).join('')}</ol><p>`);
  cl_('PROHIBICIONES DEL TRABAJADOR','Las establecidas en el artículo 64 del Código de Trabajo, entre ellas: abandonar el trabajo en horas de labor sin causa justificada o sin licencia del patrono; trabajar en estado de embriaguez o bajo la influencia de drogas; usar los útiles y herramientas del patrono para objeto distinto de aquel a que están destinados; portar armas durante las horas de labor, salvo las herramientas propias del trabajo; y ejecutar actos que constituyan sabotaje contra la producción normal de la empresa.');
  cl_('OBLIGACIONES Y PROHIBICIONES DEL PATRONO','El patrono cumplirá las obligaciones del artículo 61 y se abstendrá de lo prohibido por el artículo 62 del Código de Trabajo, entre ello: inducir a los trabajadores a comprar sus artículos de consumo en determinados establecimientos; exigir o aceptar dinero como gratificación para admitirlos en el trabajo; obligarlos a retirarse de los sindicatos o grupos legales a que pertenezcan; influir en sus decisiones políticas o convicciones religiosas; retener sus herramientas u objetos; y cualquier otro acto que restrinja los derechos que la ley le otorga.');
  cl_('MEDIDAS DISCIPLINARIAS','El incumplimiento de las leyes de trabajo y previsión social y del presente contrato se sancionará, según su gravedad, con amonestación verbal, amonestación escrita o suspensión de uno a ocho días sin goce de salario, previa audiencia al trabajador por dos días hábiles; de toda medida se dejará constancia escrita en su expediente. Son causas de despido justificado las contempladas en el artículo 77 del Código de Trabajo, y el incumplimiento grave de las obligaciones del presente contrato.');
  if(cl.exclusividad) cl_('EXCLUSIVIDAD',`El trabajador se obliga a prestar sus servicios con exclusividad a favor de ${emp_}, quedándole prohibido realizar trabajos similares a favor de terceros o por su cuenta durante la vigencia del presente contrato.`);
  if(cl.confidencialidad) cl_('CONFIDENCIALIDAD','El trabajador se compromete a guardar absoluta reserva sobre los documentos, información, acuerdos, contratos, correos electrónicos y cualquier conocimiento sobre las actividades del patrono, aun después de terminada la relación laboral. Su violación es causa de despido justificado conforme a los artículos 63 literal g) y 77 literal c) del Código de Trabajo, sin perjuicio de la responsabilidad por daños y perjuicios.');
  const firmas=`<p>El presente contrato se suscribe en el municipio de ${valCt(dc.municipio,'municipio')}, departamento de ${valCt(dc.departamento,'departamento')}, el ${c.fecha?fechaEnLetras(c.fecha):faltaCt('fecha')}, en tres ejemplares: uno para cada una de las partes y uno que el patrono remitirá a la Dirección General de Trabajo dentro de los quince días siguientes a su celebración.</p>
    <div class="ct-firmas"><div><span class="ct-linea"></span>${valCt(t.nombre,'trabajador')}<br><small>EL TRABAJADOR</small></div><div><span class="ct-linea"></span>${valCt(r.nombre,'representante')}<br><small>EL PATRONO</small></div></div>`;
  const legal=cl.legalizacion?`<p class="ct-legal">En el municipio de ${valCt(dc.municipio,'municipio')}, el ${c.fechaLegalizacion?fechaEnLetras(c.fechaLegalizacion):(c.fecha?fechaEnLetras(c.fecha):faltaCt('fecha'))}, como Notario DOY FE: que las firmas que anteceden son auténticas, por haber sido puestas el día de hoy en mi presencia por ${valCt((t.nombre||'').toUpperCase(),'trabajador')}, quien se identifica con el Documento Personal de Identificación con Código Único de Identificación número ${dpiT?`${cifrasEnLetras(dpiT)} (${esc(dpiT)})`:faltaCt('DPI del trabajador')}, y por ${valCt((r.nombre||'').toUpperCase(),'representante')}, quien se identifica con el Documento Personal de Identificación con Código Único de Identificación número ${dpiR?`${cifrasEnLetras(dpiR)} (${esc(dpiR)})`:faltaCt('DPI del representante')}, ambos extendidos por el Registro Nacional de las Personas de la República de Guatemala. Los signatarios vuelven a firmar la presente acta de legalización con el Notario que autoriza.</p>`:'';
  return encabezado+n.join('')+firmas+legal;
}
const textoContrato=c=>c.htmlManual||htmlContrato(emp(),c);

/* ---------- Lista de contratos ---------- */
VISTAS.contratos=()=>{
  const e=emp(), lista=(e.contratos||[]).slice().sort((a,b)=>(b.numero||0)-(a.numero||0));
  const dc=datosContratoEmpresa(e), faltaEmp=!dc.rep.nombre||!dc.rep.dpi||!e.direccion;
  const nombreEmp=id=>((e.empleados||[]).find(x=>x.id===id)||{}).nombre||'(empleado eliminado)';
  return cab('Contratos de trabajo','Contrato individual de trabajo con los datos de la empresa y del trabajador. Se llena con un formulario, se ve en vivo y se puede corregir a mano.',
    `<button class="btn sec" data-accion="datosContratoEmpresa">Datos de la empresa</button><button class="btn" data-accion="nuevoContrato">Nuevo contrato</button>`)
  +(faltaEmp?`<div class="aviso">Antes del primer contrato completá los <strong>datos de la empresa</strong> (${dc.esSociedad?'representante legal y su razón de nombramiento':'propietario'}, DPI y dirección). Se llenan una sola vez. <button class="btn mini" data-accion="datosContratoEmpresa" style="margin-left:6px">Completar</button></div>`:'')
  +(lista.length?`<table><thead><tr><th>No.</th><th>Trabajador</th><th>Puesto</th><th>Inicio</th><th>Plazo</th><th>Estado</th><th class="num"></th></tr></thead><tbody>
    ${lista.map(c=>`<tr><td>${c.numero}</td><td>${esc(nombreEmp(c.empleadoId))}</td><td>${esc(c.puesto||'—')}</td><td>${fFecha(c.fechaInicio)}</td><td>${esc(PLAZOS_CONTRATO[c.plazo]||'')}</td>
      <td>${c.htmlManual?'<span class="etiqueta">Editado a mano</span>':''}</td>
      <td class="num" style="white-space:nowrap"><button class="btn mini" data-accion="abrirContrato" data-id="${c.id}">Abrir</button> <button class="btn mini peligro" data-accion="borrarContrato" data-id="${c.id}">Eliminar</button></td></tr>`).join('')}</tbody></table>`
   :`<div class="vacio">Todavía no hay contratos. Usá "Nuevo contrato" y elegí al trabajador.</div>`);
};
ACCIONES.nuevoContrato=()=>{
  const e=emp(), activos=(e.empleados||[]).filter(x=>x.activo!==false);
  if(!activos.length){avisar('Primero agregá al trabajador en "Empleados".');return}
  abrirModal('Nuevo contrato de trabajo',
    `<div class="rej"><div class="campo full"><label>Trabajador</label><select name="empleadoId">${activos.map(x=>`<option value="${x.id}">${esc(x.nombre)}${x.puesto?' — '+esc(x.puesto):''}</option>`).join('')}</select></div></div>
     <p style="margin:6px 0 0;font-size:13px;color:var(--tinta-suave)">El contrato se arma con su ficha (puesto, salario, fecha de ingreso). Lo que falte se completa en el formulario.</p>`,
    f=>{
      const x=activos.find(y=>y.id===f.empleadoId); if(!x) return false;
      e.contratos=e.contratos||[]; e.correlativoContratos=(e.correlativoContratos||0)+1;
      const c={id:uid(),numero:e.correlativoContratos,...nuevoDatosContrato(e,x),htmlManual:null,creado:hoy()};
      e.contratos.push(c); registrarLog('Creó un contrato de trabajo',`No. ${c.numero} — ${x.nombre}`); guardar();
      contratoActual=c.id; setTimeout(()=>{ VISTA='contratoEditar'; pintar(); },0);
    },'Crear y abrir');
};
ACCIONES.abrirContrato=d=>{ contratoActual=d.id; VISTA='contratoEditar'; pintar(); };
ACCIONES.borrarContrato=d=>{
  const e=emp(), c=(e.contratos||[]).find(x=>x.id===d.id); if(!c) return;
  confirmar(`Se eliminará el contrato No. ${c.numero}.`,()=>{ e.contratos=e.contratos.filter(x=>x.id!==c.id); guardar(); pintar(); },'Eliminar');
};

/* ---------- Editor: formulario + vista previa ---------- */
VISTAS.contratoEditar=()=>{
  const e=emp(), c=(e.contratos||[]).find(x=>x.id===contratoActual);
  if(!c){ VISTA='contratos'; return VISTAS.contratos(); }
  const t=(e.empleados||[]).find(x=>x.id===c.empleadoId)||{};
  const opt=(obj,sel)=>Object.entries(obj).map(([k,x])=>`<option value="${k}"${k===sel?' selected':''}>${typeof x==='string'?x:x.nombre}</option>`).join('');
  const ec=Object.entries(ESTADOS_CIVILES).map(([k,x])=>`<option value="${k}"${t.estadoCivil===k?' selected':''}>${x[t.sexo==='F'?1:0]}</option>`).join('');
  const manual=!!c.htmlManual, dis=manual?' disabled':'';
  return cab(`Contrato No. ${c.numero} — ${esc(t.nombre||'')}`,'A la izquierda los datos; a la derecha cómo queda el contrato. Lo que falta se marca en amarillo.',
    `<button class="btn sec" data-accion="volverContratos">Volver</button>
     <button class="btn sec" data-accion="wordContrato">Descargar Word</button>
     <button class="btn" data-accion="imprimirContrato">Imprimir o guardar PDF</button>`)
  +`<div class="ct-editor">
    <form class="ct-form" id="ctForm" autocomplete="off">
      ${manual?`<div class="aviso">Editaste el texto a mano, así que el formulario está bloqueado para no borrar tus cambios. <button type="button" class="btn mini" data-accion="rearmarContrato">Volver a armar desde el formulario</button></div>`:''}
      <fieldset${dis}>
      <h3>Trabajador</h3>
      <div class="rej">
        <div class="campo"><label>DPI (CUI)</label><input data-emp="dpi" value="${esc(t.dpi||'')}" placeholder="0000 00000 0000" inputmode="numeric"></div>
        <div class="campo"><label>Fecha de nacimiento</label><input data-emp="fechaNac" type="date" value="${esc(t.fechaNac||'')}"></div>
        <div class="campo"><label>Sexo</label><select data-emp="sexo"><option value="M"${t.sexo!=='F'?' selected':''}>Masculino</option><option value="F"${t.sexo==='F'?' selected':''}>Femenino</option></select></div>
        <div class="campo"><label>Estado civil</label><select data-emp="estadoCivil"><option value="">—</option>${ec}</select></div>
        <div class="campo"><label>Profesión u oficio</label><input data-emp="profesion" value="${esc(t.profesion||'')}" placeholder="Ej.: perito contador"></div>
        <div class="campo"><label>Nacionalidad</label><input data-emp="nacionalidad" value="${esc(t.nacionalidad||'guatemalteco')}"></div>
        <div class="campo"><label>Vecino del municipio de</label><input data-emp="municipio" value="${esc(t.municipio||'')}"></div>
        <div class="campo"><label>Departamento</label><input data-emp="departamento" value="${esc(t.departamento||'')}"></div>
      </div>
      <h3>Puesto y funciones</h3>
      <div class="rej">
        <div class="campo full"><label>Puesto</label><input data-ct="puesto" list="dlPuestosCt" value="${esc(c.puesto||'')}"><datalist id="dlPuestosCt">${opcionesPuestos(e)}</datalist></div>
        <div class="campo full"><label>Funciones (una por línea)</label><textarea data-ct="funciones" rows="6">${esc(c.funciones||'')}</textarea>
          <span class="ayuda-campo">Al elegir un puesto de la lista (de la empresa o de la base de puestos) se cargan sus funciones; se pueden ajustar acá solo para este contrato.</span></div>
      </div>
      <h3>Condiciones</h3>
      <div class="rej">
        <div class="campo"><label>Fecha del contrato</label><input data-ct="fecha" type="date" value="${esc(c.fecha||'')}"></div>
        <div class="campo"><label>Inicio de la relación laboral</label><input data-ct="fechaInicio" type="date" value="${esc(c.fechaInicio||'')}"></div>
        <div class="campo"><label>Plazo</label><select data-ct="plazo">${opt(PLAZOS_CONTRATO,c.plazo)}</select></div>
        <div class="campo" data-si="plazo=fijo"><label>Hasta</label><input data-ct="plazoHasta" type="date" value="${esc(c.plazoHasta||'')}"></div>
        <div class="campo full" data-si="plazo=obra"><label>Obra determinada</label><input data-ct="obra" value="${esc(c.obra||'')}"></div>
        <div class="campo"><label>Jornada</label><select data-ct="jornada">${opt(JORNADAS,c.jornada)}</select></div>
        <div class="campo"><label>Días de descanso</label><input data-ct="descanso" value="${esc(c.descanso||'')}"></div>
        <div class="campo full"><label>Horario</label><input data-ct="horario" value="${esc(c.horario||'')}"></div>
        <div class="campo full"><label>Tiempo para alimentos</label><input data-ct="almuerzo" value="${esc(c.almuerzo||'')}" placeholder="de las doce a las trece horas"></div>
        <div class="campo"><label>Salario mensual (Q)</label><input data-ct="salario" type="number" step="0.01" min="0" value="${c.salario||''}"></div>
        <div class="campo"><label>Pago</label><select data-ct="pago">${opt(PAGOS_CONTRATO,c.pago)}</select></div>
        <div class="campo full"><label>Lugar de trabajo</label><input data-ct="lugar" value="${esc(c.lugar||'')}" placeholder="${esc(e.direccion||'Dirección de la empresa')}"></div>
      </div>
      <h3>Cláusulas</h3>
      <div class="lista-chequeo">${Object.entries(CLAUSULAS_OPCIONALES).map(([k,x])=>`<label class="chequeo"><input type="checkbox" data-cl="${k}"${(c.clausulas||{})[k]?' checked':''}><span>${x.nombre}</span></label>`).join('')}</div>
      <div class="rej" data-si="cl:legalizacion"><div class="campo"><label>Fecha de la legalización</label><input data-ct="fechaLegalizacion" type="date" value="${esc(c.fechaLegalizacion||'')}"></div></div>
    </fieldset></form>
    <div class="ct-previa">
      <div class="ct-barra"><span id="ctFaltan"></span>
        <button type="button" class="btn mini ${manual?'':'sec'}" id="ctManual" aria-pressed="${manual}">${manual?'Editando el texto a mano':'Editar el texto a mano'}</button></div>
      <article class="ct-hoja" id="ctHoja" tabindex="0" aria-label="Vista previa del contrato"${manual?' contenteditable="true"':''}>${textoContrato(c)}</article>
    </div>
  </div>`;
};
ACCIONES.volverContratos=()=>{ VISTA='contratos'; pintar(); };
ACCIONES.rearmarContrato=()=>{
  const c=(emp().contratos||[]).find(x=>x.id===contratoActual); if(!c) return;
  confirmar('Se descartan los cambios que hiciste a mano en el texto y el contrato se vuelve a armar con el formulario.',()=>{ c.htmlManual=null; guardar(); pintar(); },'Volver a armar');
};
let tGuardarContrato=null;
function enlazarEditorContrato(){
  const e=emp(), c=(e.contratos||[]).find(x=>x.id===contratoActual); if(!c) return;
  const t=(e.empleados||[]).find(x=>x.id===c.empleadoId)||{};
  const hoja=document.getElementById('ctHoja'), form=document.getElementById('ctForm');
  const guardarPronto=()=>{ clearTimeout(tGuardarContrato); tGuardarContrato=setTimeout(guardar,600); };
  const visibilidad=()=>form.querySelectorAll('[data-si]').forEach(el=>{ const s=el.dataset.si;
    el.hidden=s.startsWith('cl:')?!(c.clausulas||{})[s.slice(3)]:c[s.split('=')[0]]!==s.split('=')[1]; });
  let tHojas=null;
  const faltan=()=>{ const n=hoja.querySelectorAll('.falta').length;
    const base=n?`<strong>${n}</strong> dato(s) por completar`:'✓ Contrato completo';
    document.getElementById('ctFaltan').innerHTML=base;
    clearTimeout(tHojas); tHojas=setTimeout(()=>{ const el=document.getElementById('ctFaltan'); if(!el) return; const pg=paginasContrato(c);
      el.innerHTML=`${base} · ${pg.hojas} hoja${pg.hojas===1?'':'s'}${pg.hojaLegal?` · legalización de firmas en la hoja ${pg.hojaLegal}${pg.blanco?` (la ${pg.hojas+1} queda en blanco)`:''}`:''}`; },250); };
  const refrescar=()=>{ if(!c.htmlManual) hoja.innerHTML=htmlContrato(e,c); faltan(); };
  form.querySelectorAll('[data-ct]').forEach(i=>{ const k=i.dataset.ct; const ev=i.tagName==='SELECT'?'change':'input';
    i.addEventListener(ev,()=>{ c[k]=k==='salario'?r2(+i.value||0):i.value;
      if(k==='puesto'){ const p=asegurarPuesto(e,i.value);
        if(p&&funcionesDe(p).length){ c.funciones=funcionesDe(p).join('\n'); form.querySelector('[data-ct="funciones"]').value=c.funciones; } }
      if(k==='jornada'){ c.horario=(JORNADAS[i.value]||JORNADAS.diurna).horario; form.querySelector('[data-ct="horario"]').value=c.horario; }
      visibilidad(); refrescar(); guardarPronto(); }); });
  form.querySelectorAll('[data-emp]').forEach(i=>{ const k=i.dataset.emp; const ev=i.tagName==='SELECT'?'change':'input';
    i.addEventListener(ev,()=>{ t[k]=i.value; refrescar(); guardarPronto(); }); });
  form.querySelectorAll('[data-cl]').forEach(i=>i.addEventListener('change',()=>{ c.clausulas=c.clausulas||{}; c.clausulas[i.dataset.cl]=i.checked; visibilidad(); refrescar(); guardarPronto(); }));
  hoja.addEventListener('input',()=>{ if(!c.htmlManual) return; c.htmlManual=hoja.innerHTML; faltan(); guardarPronto(); });
  document.getElementById('ctManual').onclick=()=>{
    if(c.htmlManual) return;
    c.htmlManual=hoja.innerHTML; guardar(); pintar();
    const h=document.getElementById('ctHoja'); if(h) h.focus();
  };
  visibilidad(); faltan();
}
/* Hoja lista para imprimir o para Word: los datos faltantes quedan como línea en blanco. */
const HOJA_CONTRATO={anchoPx:608,altoPx:867};   // carta, márgenes 3 cm izquierda y 2.5 cm en los demás lados (96 px por pulgada)
function documentoContrato(c,paraWord){
  const cuerpo=textoContrato(c).replace(/<span class="falta"[^>]*>\[[^\]]*\]<\/span>/g,'______________________');
  let html=paraWord?cuerpo.replace(/<div class="ct-firmas"><div>(.*?)<\/div><div>(.*?)<\/div><\/div>/s,'<table class="firmas" width="100%"><tr><td>$1</td><td>$2</td></tr></table>'):cuerpo;
  /* La legalización de firmas va en hoja aparte (en Word, desde una hoja nueva). */
  if(paraWord) html=html.replace(/<p class="ct-legal">/,'<br clear="all" style="page-break-before:always"><p class="ct-legal">');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Contrato No. ${c.numero}</title><style>
    @page{size:letter;margin:2.5cm 2.5cm 2.5cm 3cm}
    body{font-family:'Times New Roman',Times,serif;font-size:12pt;line-height:1.5;color:#000;margin:0;orphans:1;widows:1}
    @media screen{body{width:${HOJA_CONTRATO.anchoPx}px}}
    p{margin:0 0 10pt;text-align:justify} .ct-num{text-align:right;font-size:11pt} .ct-titulo{text-align:center;font-size:14pt;margin:6pt 0 14pt;letter-spacing:.5pt}
    .ct-lista{margin:0 0 10pt 24pt} .ct-lista li{margin:0 0 4pt;text-align:justify}
    .ct-firmas{display:flex;justify-content:space-between;gap:40pt;margin:60pt 0 30pt;text-align:center;break-inside:avoid} .ct-firmas div{flex:1}
    .ct-linea{display:block;border-top:1px solid #000;margin-bottom:4pt}
    .hoja-legal,.hoja-blanco{break-before:page;page-break-before:always} .hoja-blanco{height:1px}
    table.firmas td{width:50%;text-align:center;padding-top:60pt;border-top:0}
  </style></head><body><div id="ctCuerpo">${html}</div></body></html>`;
}
/* Separa la legalización en su propia hoja y la deja en hoja impar: mide cuántas hojas ocupa el contrato
   y, si termina en hoja impar, deja una hoja en blanco (3 hojas de contrato → legalización en la 5). */
function paginarContrato(doc){
  const legal=doc.querySelector('#ctCuerpo .ct-legal'), cuerpo=doc.getElementById('ctCuerpo');
  const hojas=Math.max(1,Math.ceil((cuerpo.getBoundingClientRect().height-(legal?legal.getBoundingClientRect().height:0)-1)/HOJA_CONTRATO.altoPx));
  if(!legal) return {hojas,hojaLegal:null,blanco:false};
  const caja=doc.createElement('div'); caja.className='hoja-legal';
  let n=legal; const mover=[]; while(n){ mover.push(n); n=n.nextSibling; } mover.forEach(x=>caja.appendChild(x));
  const blanco=hojas%2===1;
  if(blanco){ const b=doc.createElement('div'); b.className='hoja-blanco'; b.innerHTML='&nbsp;'; doc.body.appendChild(b); }
  doc.body.appendChild(caja);
  return {hojas,hojaLegal:blanco?hojas+2:hojas+1,blanco};
}
function marcoMedida(){
  let fr=document.getElementById('marcoContrato');
  if(!fr){ fr=document.createElement('iframe'); fr.id='marcoContrato'; fr.setAttribute('aria-hidden','true'); fr.tabIndex=-1;
    fr.style.cssText='position:fixed;left:-10000px;top:0;width:900px;height:600px;border:0;visibility:hidden'; document.body.appendChild(fr); }
  return fr;
}
function paginasContrato(c){
  const fr=marcoMedida(), d=fr.contentDocument; d.open(); d.write(documentoContrato(c,false)); d.close();
  return paginarContrato(d);
}
ACCIONES.imprimirContrato=()=>{
  const c=(emp().contratos||[]).find(x=>x.id===contratoActual); if(!c) return;
  const fr=document.createElement('iframe'); fr.style.cssText='position:fixed;left:-10000px;top:0;width:900px;height:600px;border:0';
  document.body.appendChild(fr);
  const d=fr.contentDocument; d.open(); d.write(documentoContrato(c,false)); d.close();
  paginarContrato(d);
  setTimeout(()=>{ try{ fr.contentWindow.focus(); fr.contentWindow.print(); }catch(err){} setTimeout(()=>fr.remove(),2000); },250);
};
ACCIONES.wordContrato=()=>{
  const e=emp(), c=(e.contratos||[]).find(x=>x.id===contratoActual); if(!c) return;
  const t=(e.empleados||[]).find(x=>x.id===c.empleadoId)||{};
  const blob=new Blob(['﻿'+documentoContrato(c,true)],{type:'application/msword'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`Contrato-${c.numero}-${archivoSeguro(t.nombre||'trabajador')}.doc`;
  document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500);
};
