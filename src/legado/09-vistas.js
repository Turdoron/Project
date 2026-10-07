/* ============ VISTAS ============ */
const VISTAS={};

VISTAS.empresas=()=>{
  const visibles=empresasVisibles();
  const filas=visibles.map(e=>`<tr>
    <td><strong>${esc(e.nombre)}</strong>${e.representante?`<br><span style="font-size:13px;color:var(--tinta-suave)">${esc(e.representante)}</span>`:''}
      ${e.direccion?`<br><span style="font-size:13px;color:var(--tinta-suave)">${esc(e.direccion)}</span>`
        :`<br><span style="font-size:13px;color:var(--alerta)">Falta la dirección fiscal</span>`}</td>
    <td>${esc(e.nit||'—')}</td>
    <td>${esc(REGIMENES[e.regimen]||e.regimen)}<br><span style="font-size:13px;color:var(--tinta-suave)">${esProductora(e)?'Industria productora':'Comercializadora'}</span></td>
    <td class="num">${e.ejercicio}</td>
    <td class="num">${e.partidas.length}</td>
    <td class="num">
      ${e.id===BD.activa?'<span class="ok">En uso</span>':`<button class="btn mini" data-accion="usarEmpresa" data-id="${e.id}">Usar</button>`}
      <button class="btn mini" data-accion="editarEmpresa" data-id="${e.id}">Editar</button>
      <button class="btn mini peligro" data-accion="borrarEmpresa" data-id="${e.id}">Eliminar</button>
    </td></tr>`).join('');
  return cab('Empresas','Cada empresa lleva su propio catálogo, sus partidas y su régimen. Solo ves las que creaste vos.',
    `<button class="btn" data-accion="nuevaEmpresa">Agregar empresa</button>`)
    + (visibles.length
      ? `<table><thead><tr><th>Razón social y representante</th><th>NIT</th><th>Régimen ISR</th><th class="num">Ejercicio</th><th class="num">Partidas</th><th class="num">Acciones</th></tr></thead><tbody>${filas}</tbody></table>`
      : `<div class="vacio">Todavía no hay empresas. Agregá la primera para empezar a registrar.</div>`);
};

VISTAS.catalogo=()=>{
  const e=emp();
  const q=(filtros.q||'').toLowerCase();
  const filas=e.cuentas.filter(c=>!q||c.c.includes(q)||c.n.toLowerCase().includes(q))
    .map(c=>c.d
      ? `<tr><td class="num" style="text-align:left;padding-left:${(c.c.split('.').length-1)*16+10}px">${c.c}</td>
         <td>${esc(c.n)}</td><td>${c.t}</td>
         <td>${NATURAL_DEUDORA(c.t)?'Deudora':'Acreedora'}</td>
         <td class="num"><button class="btn mini peligro" data-accion="borrarCuenta" data-c="${c.c}">Eliminar</button></td></tr>`
      : `<tr class="grupo-cta"><td class="num" style="text-align:left">${c.c}</td><td colspan="4">${esc(c.n)}</td></tr>`
    ).join('');
  return cab('Catálogo de cuentas',`${e.cuentas.filter(c=>c.d).length} cuentas de detalle · las cuentas en negrita son agrupadoras y no reciben movimiento`,
    `<button class="btn" data-accion="nuevaCuenta">Agregar cuenta</button>`)
    + `<div class="barra"><div class="campo ancho"><label>Buscar por código o nombre</label>
       <input data-filtro="q" value="${esc(filtros.q||'')}" placeholder="Ej. bancos, 1.1.03"></div></div>`
    + `<table><thead><tr><th>Código</th><th>Nombre</th><th>Tipo</th><th>Naturaleza</th><th class="num"></th></tr></thead><tbody>${filas}</tbody></table>`;
};

VISTAS.partidas=()=>{
  if(borrador) return formularioPartida();
  const e=emp();
  const lista=[...e.partidas].sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.numero-b.numero);
  const fuera=lista.some((p,i)=>i>0 && p.numero<lista[i-1].numero);
  const filas=lista.map(p=>{
    const t=p.lineas.reduce((s,l)=>s+(+l.debe||0),0);
    return `<tr><td class="num" style="text-align:left">${p.numero}</td><td>${fFecha(p.fecha)}</td>
      <td>${esc(p.concepto)}${p.docNum?`<br><span style="font-size:13px;color:var(--tinta-suave)">${esc(p.docTipo||'Documento')} ${esc(p.docSerie?p.docSerie+'-':'')}${esc(p.docNum)}${p.contraparte?' · '+esc(p.contraparte):''}</span>`:''}</td>
      <td class="num">${Q(t)}</td>
      <td class="num"><button class="btn mini" data-accion="verPartida" data-id="${p.id}">Ver</button>
      <button class="btn mini sec" data-accion="editarPartida" data-id="${p.id}">Editar</button>
      <button class="btn mini peligro" data-accion="borrarPartida" data-id="${p.id}">Eliminar</button></td></tr>`;
  }).join('');
  return cab('Partidas contables','Ordenadas por fecha, como debe leerse el Diario.',
    `<button class="btn" data-accion="nuevaPartida">Registrar partida</button>`)
    + (fuera?`<div class="aviso malo">Hay partidas cuyo número no sigue el orden de las fechas.
        El Diario debe ser cronológico y el correlativo debe acompañarlo.
        <button class="btn mini" data-accion="renumerar" style="margin-left:8px">Renumerar</button></div>`:'')
    + (lista.length? `<table><thead><tr><th>No.</th><th>Fecha</th><th>Concepto</th><th class="num">Monto</th><th class="num"></th></tr></thead><tbody>${filas}</tbody></table>`
      : `<div class="vacio">No hay partidas registradas en esta empresa.</div>`);
};

function formularioPartida(){
  const e=emp();
  const b=borrador;
  /* Un <select> con 70+ cuentas obliga a hacer scroll para encontrar una.
     Un <input> con <datalist> deja escribir para filtrar, con el mismo
     desplegable nativo del navegador — sin agregar ninguna librería. La
     cuenta que muestra cada línea es "código — nombre"; al guardar se
     recorta solo el código con una expresión regular. */
  const etiquetaCuenta=cod=>{
    const c=e.cuentas.find(x=>x.c===cod);
    return c ? `${c.c} — ${c.n}` : '';
  };
  const datalistCuentas=`<datalist id="listaCuentas">${e.cuentas.filter(x=>x.d)
    .map(x=>`<option value="${x.c} — ${esc(x.n)}">`).join('')}</datalist>`;
  const tipos=['Factura','Factura pequeño contribuyente','Nota de crédito','Nota de débito','Recibo',
    'Planilla','Nota contable','Otro'].map(t=>`<option${t===b.docTipo?' selected':''}>${t}</option>`).join('');
  const filas=b.lineas.map((l,i)=>`<tr>
    <td><input list="listaCuentas" data-l="${i}" data-campo="cta" value="${esc(etiquetaCuenta(l.cta))}" placeholder="Buscar cuenta..."></td>
    <td><input data-l="${i}" data-campo="desc" value="${esc(l.desc)}" placeholder="opcional"></td>
    <td><input data-l="${i}" data-campo="debe" type="number" step="0.01" min="0" class="num" value="${l.debe||''}"></td>
    <td><input data-l="${i}" data-campo="haber" type="number" step="0.01" min="0" class="num" value="${l.haber||''}"></td>
    <td class="num"><button class="btn mini peligro" data-accion="quitarLinea" data-i="${i}" title="Quitar línea">Quitar</button></td>
  </tr>`).join('');
  const td=r2(b.lineas.reduce((s,l)=>s+(+l.debe||0),0));
  const th=r2(b.lineas.reduce((s,l)=>s+(+l.haber||0),0));
  const dif=r2(td-th);

  return cab(b.editando?`Editando partida No. ${b.numero}`:`Partida No. ${b.numero}`,
    'Los datos del documento son opcionales, pero alimentan los libros de IVA.',
    `<button class="btn sec" data-accion="cancelarPartida">Descartar</button>
     <button class="btn" data-accion="guardarPartida">${b.editando?'Guardar cambios':'Guardar partida'}</button>`)
  + (b.editando? `<div class="aviso malo">Si esta partida se generó sola —desde una factura cargada, un pago,
      un cobro o una planilla—, el detalle que alimenta la cartera, el inventario o el ISR de esos módulos
      <strong>no se entera de este cambio</strong>, porque vive guardado aparte. El Libro Mayor y los estados
      financieros sí se actualizan solos porque siempre recalculan de las partidas; lo que no se actualiza es
      el origen. Para esos casos, suele ser más seguro eliminar la partida y volver a generarla desde donde
      salió, en vez de editarla a mano.</div>` : !iaPermitidaSesion() ? '' : `<div class="tarjeta">
      <h3 style="margin-bottom:10px">Asistente de registro</h3>
      <p style="margin:0 0 10px;color:var(--tinta-suave);font-size:14px">
        Describí la operación como se la contarías a un colega y te propongo la partida usando tu catálogo.
        Revisá siempre lo que sugiere antes de guardar: la responsabilidad del registro es tuya.</p>
      <textarea id="iaTexto" style="resize:vertical" rows="2" placeholder="Ej. Compré 50 resmas de papel bond por Q1,250 más IVA, según factura serie A número 4471 de Distribuidora Xela, pagado con cheque del banco"></textarea>
      <div style="margin-top:10px;display:flex;gap:8px;align-items:center">
        <button class="btn" data-accion="sugerirIA">Proponer partida</button>
        <span id="iaEstado" style="font-size:14px;color:var(--tinta-suave)"></span>
      </div>
      <div id="iaNota"></div>
    </div>`)
  + `<div class="tarjeta">
      <div class="rej">
        <div class="campo"><label>Fecha</label><input data-cab="fecha" type="date" value="${b.fecha}"></div>
        <div class="campo"><label>Número de partida</label><input data-cab="numero" type="number" value="${b.numero}"></div>
        <div class="campo full"><label>Concepto</label><input data-cab="concepto" value="${esc(b.concepto)}" placeholder="Ej. Compra de papelería según factura A-4471"></div>
        <div class="campo"><label>Tipo de documento</label><select data-cab="docTipo"><option value=""></option>${tipos}</select></div>
        <div class="campo"><label>Serie y número</label>
          <div style="display:flex;gap:6px">
            <input data-cab="docSerie" value="${esc(b.docSerie)}" placeholder="Serie" style="width:40%">
            <input data-cab="docNum" value="${esc(b.docNum)}" placeholder="Número">
          </div></div>
        <div class="campo"><label>NIT de la contraparte</label><input data-cab="nit" value="${esc(b.nit)}" placeholder="C/F o 1234567-8"></div>
        <div class="campo"><label>Nombre de la contraparte</label><input data-cab="contraparte" value="${esc(b.contraparte)}"></div>
      </div>
    </div>

    ${datalistCuentas}
    <table><thead><tr><th style="width:34%">Cuenta</th><th>Descripción</th>
      <th class="num" style="width:15%">Debe</th><th class="num" style="width:15%">Haber</th><th></th></tr></thead>
      <tbody>${filas}</tbody>
      <tfoot><tr class="total"><td colspan="2">Sumas</td>
        <td class="num d" id="totDebe">${Q(td)}</td><td class="num h" id="totHaber">${Q(th)}</td><td></td></tr></tfoot>
    </table>
    <div class="barra" style="margin-top:12px">
      <button class="btn sec" data-accion="agregarLinea">Agregar línea</button>
      <div id="cuadre" class="aviso ${dif===0&&td>0?'bien':'malo'}" style="margin:0;flex:1">${textoCuadre(td,th)}</div>
    </div>`;
}
function textoCuadre(td,th){
  const dif=r2(td-th);
  if(td===0&&th===0) return 'Todavía no hay montos cargados.';
  if(dif===0) return `La partida cuadra en Q${Q(td)}.`;
  return `Descuadre de Q${Q(Math.abs(dif))}. ${dif>0?'Falta en el haber.':'Falta en el debe.'}`;
}
function leerCabecera(){
  document.querySelectorAll('[data-cab]').forEach(i=>borrador[i.dataset.cab]=i.value);
}
function enlazarFormulario(){
  document.querySelectorAll('[data-cab]').forEach(i=>i.oninput=()=>borrador[i.dataset.cab]=i.value);
  document.querySelectorAll('[data-l]').forEach(i=>{
    i.oninput=i.onchange=()=>{
      const l=borrador.lineas[+i.dataset.l], campo=i.dataset.campo;
      if(campo==='cta'){
        /* El input trae "código — nombre" si se eligió del desplegable, o
           puede traer solo el código si alguien lo escribió de memoria y no
           llegó a seleccionar la sugerencia — las dos formas son válidas.
           Solo se guarda cuando lo escrito coincide exacto con una cuenta
           real del catálogo, así nunca se guarda algo a medio teclear ni un
           código inventado. */
        const valor=(i.value||'').trim();
        const m=valor.match(/^([0-9][0-9.]*)\s*—/);   // admite códigos como 1.10.01 o 1.1.03.01
        const codigo=m?m[1]:valor;
        if(emp().cuentas.some(c=>c.c===codigo)) l.cta=codigo;
      }else{
        l[campo]=(campo==='debe'||campo==='haber')?(+i.value||0):i.value;
      }
      if(campo==='debe'&&+i.value) { l.haber=0; const o=document.querySelector(`[data-l="${i.dataset.l}"][data-campo="haber"]`); if(o)o.value=''; }
      if(campo==='haber'&&+i.value){ l.debe=0; const o=document.querySelector(`[data-l="${i.dataset.l}"][data-campo="debe"]`); if(o)o.value=''; }
      const td=r2(borrador.lineas.reduce((s,x)=>s+(+x.debe||0),0));
      const th=r2(borrador.lineas.reduce((s,x)=>s+(+x.haber||0),0));
      document.getElementById('totDebe').textContent=Q(td);
      document.getElementById('totHaber').textContent=Q(th);
      const c=document.getElementById('cuadre');
      c.textContent=textoCuadre(td,th);
      c.className='aviso '+(r2(td-th)===0&&td>0?'bien':'malo');
    };
  });
}

VISTAS.diario=()=>{
  const e=emp();
  const d=filtros.desde||`${e.ejercicio}-01-01`, h=filtros.hasta||`${e.ejercicio}-12-31`;
  const lista=e.partidas.filter(p=>p.fecha>=d&&p.fecha<=h)
    .sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.numero-b.numero);
  let td=0,th=0, cuerpo='';
  lista.forEach(p=>{
    cuerpo+=`<tr class="grupo-cta"><td colspan="4">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <span>Partida No. ${p.numero} — ${fFecha(p.fecha)} — ${esc(p.concepto)}</span>
        <button class="btn mini sec" data-accion="editarPartida" data-id="${p.id}">Editar</button>
      </div></td></tr>`;
    p.lineas.forEach(l=>{
      td+=(+l.debe||0); th+=(+l.haber||0);
      const c=e.cuentas.find(x=>x.c===l.cta);
      cuerpo+=`<tr><td class="num" style="text-align:left">${l.cta}</td>
        <td>${esc(c?c.n:'?')}${l.desc?` <span style="color:var(--tinta-suave)">· ${esc(l.desc)}</span>`:''}</td>
        <td class="num d">${l.debe?Q(l.debe):''}</td><td class="num h">${l.haber?Q(l.haber):''}</td></tr>`;
    });
  });
  return cab('Libro Diario','Registro cronológico, con las operaciones de cada día en una sola partida.',
    `<button class="btn sec" data-accion="cierreDeLibros">Cierre de libros</button>
     <button class="btn" data-accion="pdfDiario">Descargar PDF</button>`)
    + rangoFechas(d,h)
    + (lista.length? `<table><thead><tr><th>Cuenta</th><th>Descripción</th><th class="num">Debe</th><th class="num">Haber</th></tr></thead>
       <tbody>${cuerpo}</tbody><tfoot><tr class="total"><td colspan="2">Sumas iguales</td>
       <td class="num d">${Q(td)}</td><td class="num h">${Q(th)}</td></tr></tfoot></table>`
      : `<div class="vacio">Sin operaciones en el rango seleccionado.</div>`);
};

VISTAS.mayor=()=>{
  const e=emp();
  const d=filtros.desde||`${e.ejercicio}-01-01`, h=filtros.hasta||`${e.ejercicio}-12-31`;
  const detalle=e.cuentas.filter(c=>c.d);
  const cta=filtros.cta||(detalle[0]&&detalle[0].c);
  const c=e.cuentas.find(x=>x.c===cta);
  const opciones=detalle.map(x=>`<option value="${x.c}" ${x.c===cta?'selected':''}>${x.c} — ${esc(x.n)}</option>`).join('');
  let cuerpo='',ant=0,sd=0,sh=0;
  if(c){
    e.partidas.filter(p=>p.fecha<d).forEach(p=>p.lineas.filter(l=>l.cta===cta)
      .forEach(l=>ant+=(+l.debe||0)-(+l.haber||0)));
    let corr=ant;
    e.partidas.filter(p=>p.fecha>=d&&p.fecha<=h)
      .sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.numero-b.numero)
      .forEach(p=>p.lineas.filter(l=>l.cta===cta).forEach(l=>{
        corr+=(+l.debe||0)-(+l.haber||0); sd+=(+l.debe||0); sh+=(+l.haber||0);
        cuerpo+=`<tr><td>${fFecha(p.fecha)}</td><td class="num" style="text-align:left">${p.numero}</td>
          <td>${esc(l.desc||p.concepto)}</td><td class="num d">${l.debe?Q(l.debe):''}</td>
          <td class="num h">${l.haber?Q(l.haber):''}</td>
          <td class="num">${Q(NATURAL_DEUDORA(c.t)?corr:-corr)}</td></tr>`;
      }));
  }
  return cab('Libro Mayor', c?`${c.c} — ${esc(c.n)} · naturaleza ${NATURAL_DEUDORA(c.t)?'deudora':'acreedora'}`:'',
    `<button class="btn" data-accion="pdfMayor">Descargar PDF de todas las cuentas</button>`)
    + `<div class="barra"><div class="campo ancho"><label>Cuenta</label><select data-filtro="cta">${opciones}</select></div>
       <div class="campo"><label>Desde</label><input type="date" data-filtro="desde" value="${d}"></div>
       <div class="campo"><label>Hasta</label><input type="date" data-filtro="hasta" value="${h}"></div></div>`
    + (c? `<table><thead><tr><th>Fecha</th><th>Partida</th><th>Descripción</th><th class="num">Debe</th><th class="num">Haber</th><th class="num">Saldo</th></tr></thead>
      <tbody><tr class="grupo-cta"><td colspan="5">Saldo al ${fFecha(d)}</td><td class="num">${Q(NATURAL_DEUDORA(c.t)?ant:-ant)}</td></tr>
      ${cuerpo}</tbody>
      <tfoot><tr class="total"><td colspan="3">Movimientos del período</td><td class="num d">${Q(sd)}</td>
      <td class="num h">${Q(sh)}</td><td class="num">${Q(NATURAL_DEUDORA(c.t)?ant+sd-sh:-(ant+sd-sh))}</td></tr></tfoot></table>`
      : `<div class="vacio">Agregá cuentas de detalle al catálogo.</div>`);
};

VISTAS.balanza=()=>{
  const e=emp();
  const d=filtros.desde||`${e.ejercicio}-01-01`, h=filtros.hasta||`${e.ejercicio}-12-31`;
  const mov=movimientos(d,h);
  let td=0,th=0,tsd=0,tsh=0,cuerpo='';
  e.cuentas.filter(c=>c.d).forEach(c=>{
    const m=mov[c.c]; if(!m) return;
    const neto=r2(m.debe-m.haber);
    td+=m.debe; th+=m.haber;
    const sd=neto>0?neto:0, sh=neto<0?-neto:0;
    tsd+=sd; tsh+=sh;
    cuerpo+=`<tr><td class="num" style="text-align:left">${c.c}</td><td>${esc(c.n)}</td>
      <td class="num d">${Q(m.debe)}</td><td class="num h">${Q(m.haber)}</td>
      <td class="num">${sd?Q(sd):''}</td><td class="num">${sh?Q(sh):''}</td></tr>`;
  });
  const cuadra=r2(td)===r2(th)&&r2(tsd)===r2(tsh);
  return cab('Balance de comprobación','Sumas y saldos de todas las cuentas con movimiento.')
    + rangoFechas(d,h)
    + `<div class="aviso ${cuadra?'bien':'malo'}">${cuadra
        ? 'La balanza cuadra: las sumas del debe y del haber son iguales.'
        : 'La balanza no cuadra. Revisá las partidas del período.'}</div>`
    + (cuerpo? `<table><thead><tr><th>Código</th><th>Cuenta</th><th class="num" colspan="2" style="text-align:center">Movimientos</th>
       <th class="num" colspan="2" style="text-align:center">Saldos</th></tr>
       <tr><th></th><th></th><th class="num">Debe</th><th class="num">Haber</th><th class="num">Deudor</th><th class="num">Acreedor</th></tr></thead>
       <tbody>${cuerpo}</tbody><tfoot><tr class="total"><td colspan="2">Totales</td>
       <td class="num d">${Q(td)}</td><td class="num h">${Q(th)}</td>
       <td class="num">${Q(tsd)}</td><td class="num">${Q(tsh)}</td></tr></tfoot></table>`
      : `<div class="vacio">Sin movimientos en el rango seleccionado.</div>`);
};

/* Saldo de una cuenta, en su signo natural, con todos los movimientos anteriores
   a una fecha — el mismo "saldo anterior" que ya usa el Libro Mayor. */
function saldoCuentaAntesDe(e,cta,fecha){
  const c=e.cuentas.find(x=>x.c===cta); if(!c) return 0;
  let ant=0;
  e.partidas.filter(p=>p.fecha<fecha).forEach(p=>p.lineas.filter(l=>l.cta===cta)
    .forEach(l=>ant+=(+l.debe||0)-(+l.haber||0)));
  return NATURAL_DEUDORA(c.t) ? ant : -ant;
}
/* Lo mismo, pero sumando TODAS las cuentas de un tipo — para el activo neto
   del ISO no importa una cuenta en particular, importa el activo completo. */
function saldoTipoAntesDe(e,tipos,fecha){
  return r2(e.cuentas.filter(c=>c.d&&tipos.includes(c.t))
    .reduce((s,c)=>s+saldoCuentaAntesDe(e,c.c,fecha),0));
}

/* Impuesto de Solidaridad — Dto. 73-2008. Solo régimen General, con margen
   bruto mayor al 4%. La base es la mayor entre 1/4 del activo neto y 1/4 de
   los ingresos brutos, ambos del EJERCICIO ANTERIOR completo — nunca del
   actual, así lo exige el Art. 7. Si el activo neto es más de 4 veces los
   ingresos, la base son solo los ingresos (para no castigar a una empresa
   con mucho activo pero pocas ventas). */
/* IUSI — Impuesto Único Sobre Inmuebles. Dos regímenes:
   · Dto. 15-98 (vigente hoy): exento hasta Q2,000; 2‰ de Q2,000.01 a Q20,000;
     6‰ de Q20,000.01 a Q70,000; 9‰ arriba de Q70,000.
   · Dto. 18-2026 (aprobado el 29/07/2026, sancionado y publicado el 28/08/2026):
     vivienda y uso mixto = 0‰ (exentos); uso comercial u otros = 3‰ hasta
     Q500,000; 6‰ de Q500,000.01 a Q1,000,000; 9‰ arriba de Q1,000,000.
     Rige 90 días después de su publicación (ver IUSI_VIGENCIA_NUEVA).
   Los tramos se aplican por rangos de valor (cada tasa solo a su porción).
   Es una ESTIMACIÓN: el monto real lo fija el avalúo de la municipalidad.
   Confirmar la fecha exacta de vigencia con el texto publicado. */
/* Corrección: antes se aplicaba desde el 01/07/2026, antes de que la ley
   existiera. Una ley no puede aplicarse antes de su vigencia: el Dto. 18-2026
   se sancionó y publicó el 28/08/2026 y rige 90 días después. Confirmar la
   fecha exacta con el Diario de Centro América. */
const IUSI_VIGENCIA_NUEVA='2026-11-26';
const IUSI_TRAMOS_VIGENTE=[[2000,0],[20000,0.002],[70000,0.006],[Infinity,0.009]];
const IUSI_TRAMOS_NUEVO_COMERCIAL=[[500000,0.003],[1000000,0.006],[Infinity,0.009]];
function calcularIUSI(valor,uso,fecha){
  valor=+valor||0;
  const nuevo=(fecha||hoy())>=IUSI_VIGENCIA_NUEVA;
  if(nuevo&&uso==='vivienda') return {anual:0,ley:'Dto. 18-2026',nota:'Vivienda y uso mixto: exentos.'};
  const tramos=nuevo?IUSI_TRAMOS_NUEVO_COMERCIAL:IUSI_TRAMOS_VIGENTE;
  let previo=0,total=0;
  for(const [tope,tasa] of tramos){
    if(valor>previo) total+=(Math.min(valor,tope)-previo)*tasa;
    previo=tope;
  }
  return {anual:r2(total),ley:nuevo?'Dto. 18-2026':'Dto. 15-98',nota:''};
}

function calcularISO(e){
  const ejercicioAnterior=e.ejercicio-1;
  const desdeAnt=`${ejercicioAnterior}-01-01`, hastaAnt=`${ejercicioAnterior}-12-31`;
  const huboPartidasAntes=e.partidas.some(p=>p.fecha<`${e.ejercicio}-01-01`);
  if(!huboPartidasAntes) return {aplica:false,motivo:'No hay datos del ejercicio anterior todavía — el ISO se calcula sobre el activo y los ingresos del año pasado completo, y este parece ser el primer ejercicio de la empresa en el sistema.'};
  const movAnt=movimientos(desdeAnt,hastaAnt,true);
  const ingresosAnt=totalTipo(['ingreso'],movAnt);
  const {costo:costoBienesAnt}=costoVentasPeriodo(e,desdeAnt,hastaAnt,movAnt);
  const costoTotalAnt=r2(costoBienesAnt+totalTipo(['costo'],movAnt));
  const margenBruto = ingresosAnt ? r2((ingresosAnt-costoTotalAnt)/ingresosAnt*100) : 0;
  if(ingresosAnt && margenBruto<4) return {aplica:false,motivo:`Exenta: el margen bruto del ejercicio ${ejercicioAnterior} fue de ${margenBruto}%, inferior al 4% (Art. 4, Dto. 73-2008).`};
  /* Activo neto: activo total menos depreciaciones, reserva de incobrables (ya
     vienen restando como cuentas de activo) y menos los créditos fiscales
     pendientes de reintegro por la SAT (Art. 7, Dto. 73-2008): el IVA en devolución (1.1.15) y el ISR
     pagado en exceso que se reclama con el SAT-2350 (1.1.13). */
  const iniAnio=`${e.ejercicio}-01-01`;
  const activoNetoAnt=r2(saldoTipoAntesDe(e,['activo'],iniAnio)-saldoCuentaAntesDe(e,'1.1.15',iniAnio)-saldoCuentaAntesDe(e,'1.1.13',iniAnio));
  const baseActivo=activoNetoAnt/4, baseIngresos=ingresosAnt/4;
  let base, criterio;
  if(activoNetoAnt>ingresosAnt*4){ base=baseIngresos; criterio='ingresos brutos (el activo supera 4 veces los ingresos)'; }
  else if(baseActivo>=baseIngresos){ base=baseActivo; criterio='activo neto'; }
  else{ base=baseIngresos; criterio='ingresos brutos'; }
  const isoTrimestral=r2(base*0.01);
  return {aplica:true,ejercicioAnterior,activoNetoAnt,ingresosAnt,margenBruto,base,criterio,isoTrimestral};
}

/* Cálculo completo del Estado de Resultados — usado por la pantalla de
   Resultados, el Libro de Estados Financieros combinado, y sus dos PDF.
   Vive en un solo lugar a propósito: la vez pasada el libro combinado tenía
   su propia copia de este cálculo, se desactualizó apenas se corrigió el
   costo de ventas por inventario y el ajuste de viáticos/donaciones, y quedó
   mostrando números viejos sin que nadie lo notara hasta que alguien lo
   comparó contra la pantalla de Resultados. Que nunca se pueda desincronizar
   de nuevo: todo lo que muestra cualquiera de las pantallas sale de acá. */
function calcularResultados(e,desde,hasta){
  const mov=movimientos(desde,hasta,true);
  const porTipo=(tipos,prefijo,excluir)=>{
    let s=0;
    e.cuentas.filter(c=>c.d&&tipos.includes(c.t)&&(!prefijo||c.c.startsWith(prefijo))&&!(excluir&&excluir.includes(c.c)))
      .forEach(c=>s+=saldoNatural(c.c,mov));
    return r2(s);
  };
  const invInicial=r2(saldoCuentaAntesDe(e,'1.1.08',desde));
  const movInvComprasBienes=movimientoCuentaSinCierreCosto(e,'1.1.08',desde,hasta);
  const comprasBienes=r2((movInvComprasBienes.debe||0)-(movInvComprasBienes.haber||0));
  const tieneFinal=Object.prototype.hasOwnProperty.call(e.inventarioFinal||{},hasta);
  const invFinal=tieneFinal?r2(e.inventarioFinal[hasta]):0;
  /* costoVentasPeriodo ya sabe si esta fecha de corte tuvo un cierre real
     posteado (ACCIONES.cerrarCostoVentas) — en ese caso devuelve costo:0,
     porque a partir de ahí se usa el saldo real de 5.1.01 en vez de la
     fórmula, que ya no significa nada una vez cerrado. */
  const {costo:costoVentasFormula,yaCerrado}=costoVentasPeriodo(e,desde,hasta,mov);
  /* Las devoluciones y rebajas sobre compras (5.1.03) son un ajuste directo
     al costo de lo vendido, no un "otro costo" aparte — se funden en la
     misma línea de Costo de Ventas. Antes vivían sueltas en un bloque de
     "Otros costos", lo que hacía que el costo de ventas pareciera aparecer
     dos veces: una en 0 (la fórmula, antes de cerrar) y otra con el monto
     real, escondida más abajo. */
  const devolucionesCompras=saldoNatural('5.1.03',mov);
  const costoVentasBase=yaCerrado?saldoNatural('5.1.01',mov):costoVentasFormula;
  const costoVentas=r2(costoVentasBase+devolucionesCompras);
  const ingresos=porTipo(['ingreso']);
  /* "Otros costos" ahora es de verdad "lo que no es costo de ventas": compras
     de servicios (5.1.02) y fletes (5.1.04). 5.1.01 y 5.1.03 ya se sumaron
     arriba, en la línea de Costo de Ventas. */
  const otrosCostos=porTipo(['costo'],null,['5.1.01','5.1.03']);
  const costoTotal=r2(costoVentas+otrosCostos);

  const regimenPeriodo=regimenEn(e,hasta);
  const anioHasta=+hasta.slice(0,4);
  const cierreTotalHecho=(e.partidas||[]).some(p=>(p.concepto||'').startsWith('Cierre fiscal total '+anioHasta));
  /* El ISR nunca debe verse mezclado adentro de "Gastos de operación" — es
     un impuesto sobre la utilidad, no un gasto operativo del negocio, y
     tiene su propia línea aparte más abajo ("ISR sobre utilidades"), que
     resta directo de la utilidad antes de impuesto. Antes esto solo se
     excluía después del Cierre Fiscal Total, así que mientras tanto el
     ISR ya pagado en los cierres parciales se contaba DOS veces: una vez
     adentro de "Gastos de operación" (porque ahí vive la partida real que
     lo posteó), y otra vez en la línea de "ISR sobre utilidades" de abajo.
     Sacarlo siempre de acá, sin importar si el año ya cerró del todo,
     corrige eso — y de paso ya no hace falta compensarlo aparte en otros
     cálculos (como el de la renta imponible acumulada), porque nunca llega
     a estar adentro de "gastos" para empezar.
     Ojo: 6.2.22 también se usa para el impuesto definitivo mensual de
     Pequeño/Primario — ahí siempre es un gasto operativo normal, la
     exclusión es solo para régimen General. */
  const excluirDeGastos = regimenPeriodo==='general' ? ['6.2.22'] : [];
  /* El ISO que se paga con pagos de ISR (opción b del Art. 11, Dto. 73-2008)
     no se puede recuperar contra el ISR más adelante, y la ley solo declara
     deducible el remanente no acreditado de la opción a). Se trata por eso,
     con criterio prudente, como gasto no deducible —6.2.28—, y viaja junto a
     6.2.14 para que se sume de vuelta a la renta imponible en todos los
     cálculos sin tocarlos uno por uno. */
  /* 6.2.29 (pérdida en baja de activos, que es pérdida de capital) y 6.2.31
     (ISR sobre rentas de capital) tampoco se deducen de las actividades
     lucrativas. */
  const noDeducible=r2(saldoNatural('6.2.14',mov)+saldoNatural('6.2.28',mov)+saldoNatural('6.2.29',mov)+saldoNatural('6.2.31',mov));
  /* Rentas de OTRAS categorías (Dto. 10-2012): los intereses (4.2.01) y las
     ganancias de capital por venta de activos (4.2.03) son rentas de capital,
     que tributan aparte (10%), no dentro del ISR sobre utilidades. Se restan
     de la renta imponible para no cobrarlas dos veces. */
  const rentasOtrasCategorias=r2(saldoNatural('4.2.01',mov)+saldoNatural('4.2.03',mov));
  /* Los costos y gastos que la empresa vincula a esas rentas de capital
     (elegidos en Configuración) tampoco se deducen de las actividades
     lucrativas: se suman de vuelta a la renta imponible. */
  const gastosRentasCapital=r2(cuentasGastoRentasCapital(e).reduce((s,c)=>s+saldoNatural(c,mov),0));
  /* El IVA de una compra marcada como gasto no deducible tampoco es
     acreditable, así que va a su propia cuenta (6.2.27) — es un gasto real
     igual que 6.2.14, y para el ISR juega el mismo papel: se suma de vuelta
     a la renta imponible. Se muestra aparte porque identificarlo por
     separado ayuda a explicar de dónde sale cada peso, en vez de fundirlo
     con "Gastos no deducibles" sin distinción. */
  const ivaNoDeducible=saldoNatural('6.2.27',mov);
  const gv=porTipo(['gasto'],'6.1',excluirDeGastos), ga=porTipo(['gasto'],'6.2',excluirDeGastos), gf=porTipo(['gasto'],'6.3',excluirDeGastos);
  const bruta=r2(ingresos-costoTotal);
  const gastos=r2(gv+ga+gf);
  const antesISR=r2(bruta-gastos);
  /* "antesISR" y, más abajo, "isr" y "neta" son para MOSTRAR el Estado de
     Resultados — ahí el ISR siempre se calcula completo, sin importar si la
     partida que lo paga ya quedó posteada a esta fecha exacta o todavía no
     (por ejemplo, si el cierre de un trimestre es al 31/03 pero el pago se
     hace el 10/04, esos diez días de diferencia). Pero el Balance General
     necesita otra cosa: cuánto cambió el Patrimonio de verdad, según lo que
     el libro mayor YA tiene posteado a esta fecha — ni un centavo más, ni
     un centavo menos. Por eso "netaReal" se calcula aparte, sin excluir
     6.2.22: si la partida del pago ya existe a esta fecha, la cuenta real
     de ISR ya la tiene adentro y hay que dejarla ahí; si todavía no existe,
     tampoco debe restarse acá aunque el Estado de Resultados sí la
     muestre como gasto del período completo. */
  const gastosConIsrReal=r2(gv+ga+gf+(regimenPeriodo==='general'?saldoNatural('6.2.22',mov):0));
  /* Corrección: el costo de ventas de "bruta" puede ser una ESTIMACIÓN (sin
     inventario final cerrado), pero el Balance necesita solo lo posteado en el
     mayor — si no, la mercadería se resta como costo y a la vez sigue en
     Inventarios, y el Balance descuadra por ese monto. */
  const netaReal=r2(ingresos-porTipo(['costo'])-r2(gv+ga+gf)-(regimenPeriodo==='general'?saldoNatural('6.2.22',mov):0));
  const viaticos=saldoNatural('6.2.23',mov);
  const limiteViaticos=r2(ingresos*0.03);
  const excesoViaticos=r2(Math.max(0,viaticos-limiteViaticos));
  const donaciones=saldoNatural('6.2.26',mov);
  const limiteDonaciones=r2(Math.min(Math.max(0,antesISR)*0.05,500000));
  const excesoDonaciones=r2(Math.max(0,donaciones-limiteDonaciones));
  const excesoNoDeducible=r2(excesoViaticos+excesoDonaciones);

  const baseImponibleISR=r2(antesISR+excesoNoDeducible+noDeducible+ivaNoDeducible+gastosRentasCapital-rentasOtrasCategorias);
  const isrYaCerrado=cierreTotalHecho;
  let isr=0;
  if(regimenPeriodo==='general'){
    if(cierreTotalHecho){
      isr=saldoNatural('6.2.22',mov);
    }else{
      /* Los gastos no deducibles bajan la utilidad contable de arriba, porque
         son un gasto real de la empresa — pero para el ISR la ley no permite
         restarlos, así que se suman de vuelta acá para llegar a la renta
         imponible real. Es la misma lógica que ya se aplicaba al exceso de
         viáticos y donaciones, solo que antes no se aplicaba a "gastos no
         deducibles" en general — el formulario de la SAT (Declaraguate) lo
         muestra exactamente así: "(+) Costos y gastos no deducibles". */
      const baseImponible=baseImponibleISR;
      const proyeccionCompleta=baseImponible>0?r2(baseImponible*0.25):0;
      /* Acá va el 25% completo sobre la renta imponible del período que se
         está mirando — el gasto real de ISR de ESE período para Estado de
         Resultados —, no "lo que todavía falta pagar" descontando lo ya
         posteado en cierres parciales anteriores. Esas son dos preguntas
         distintas: cuánto le costó el impuesto a este período (la de acá),
         contra cuánto hay que desembolsar hoy en la próxima declaración (la
         de "Impuesto determinado en este trimestre", en el cierre parcial y
         el formulario de la SAT). Restar isrYaPosteado acá mezclaba las dos
         y hacía que la utilidad del período pareciera mejor de lo que era,
         mientras el impuesto ya pagado quedaba escondido adentro de "Gastos
         de operación" — doble conteo en un lado, faltante en el otro. */
      isr=proyeccionCompleta;
    }
  }
  const neta=r2(antesISR-isr);

  return {mov,invInicial,comprasBienes,tieneFinal,invFinal,costoVentas,yaCerrado,devolucionesCompras,ingresos,otrosCostos,costoTotal,
    gv,ga,gf,bruta,gastos,antesISR,viaticos,limiteViaticos,excesoViaticos,donaciones,limiteDonaciones,noDeducible,ivaNoDeducible,
    excesoDonaciones,excesoNoDeducible,regimenPeriodo,isr,isrYaCerrado,neta,netaReal,rentasOtrasCategorias,gastosRentasCapital,baseImponibleISR};
}
/* Cuentas de costo o gasto que la empresa marcó como vinculadas a rentas de
   capital. Se excluyen las que ya se suman de vuelta por otro motivo, para no
   contarlas dos veces. */
const CUENTAS_YA_NO_DEDUCIBLES=['6.2.14','6.2.22','6.2.27','6.2.28','6.2.29','6.2.31'];
function cuentasGastoRentasCapital(e){
  return (e.cuentasRentasCapital||[]).filter(c=>!CUENTAS_YA_NO_DEDUCIBLES.includes(c)&&e.cuentas.some(x=>x.c===c&&x.d&&(x.t==='gasto'||x.t==='costo')));
}

/* Estas funciones son la ÚNICA fuente del desglose de costo de ventas y de
   la conciliación del ISR — Estado de Resultados, el Libro de Estados
   Financieros, y su PDF, los tres leen de acá. Antes cada pantalla armaba su
   propia versión de estas mismas líneas por separado, y cada vez que se
   corregía una se le olvidaba corregir la otra — exactamente lo que acaba de
   pasar con el desglose de costo de ventas. Devuelven un array neutral de
   filas ({tipo,label,value}), no HTML ni una tabla de PDF todavía — cada
   pantalla lo convierte al formato que le toca con filasAHtml() o
   filasAPdf(). */
function filasCostoVentas(R){
  const filas=[];
  if(R.yaCerrado){
    filas.push({tipo:'grupo',label:'Costo de ventas'});
    if(R.devolucionesCompras){
      filas.push({tipo:'linea',label:'Costo de ventas (cerrado)',value:r2(R.costoVentas-R.devolucionesCompras)});
      filas.push({tipo:'linea',label:'Devoluciones y rebajas sobre compras',value:R.devolucionesCompras});
      filas.push({tipo:'subtotal',label:'Costo de ventas',value:R.costoVentas});
    }else{
      /* Sin devoluciones que sumarle, la línea del cierre YA es el total —
         repetirla como subtotal abajo mostraba el mismo número dos veces
         seguidas, sin agregar nada. */
      filas.push({tipo:'linea',label:'Costo de ventas (cerrado)',value:R.costoVentas});
    }
  }else if(R.invInicial||R.comprasBienes||R.tieneFinal||R.devolucionesCompras){
    filas.push({tipo:'grupo',label:'Costo de ventas'});
    filas.push({tipo:'linea',label:'Inventario inicial',value:R.invInicial});
    filas.push({tipo:'linea',label:'(+) Compras de bienes del período, neto de notas de crédito',value:R.comprasBienes});
    if(R.devolucionesCompras) filas.push({tipo:'linea',label:'Devoluciones y rebajas sobre compras',value:R.devolucionesCompras});
    filas.push({tipo:'linea',label:`(−) Inventario final${R.tieneFinal?'':' (sin ingresar)'}`,value:R.invFinal});
    filas.push({tipo:'subtotal',label:'Costo de ventas',value:R.costoVentas});
  }
  return filas;
}
function filasConciliacionISR(R){
  const filas=[];
  if(R.regimenPeriodo==='general'&&(R.noDeducible||R.ivaNoDeducible||R.excesoNoDeducible||R.rentasOtrasCategorias||R.gastosRentasCapital)){
    filas.push({tipo:'linea',label:`${R.antesISR<0?'Pérdida':'Utilidad'} antes de ISR`,value:R.antesISR});
    if(R.noDeducible) filas.push({tipo:'linea',label:'(+) Gastos no deducibles',value:R.noDeducible});
    if(R.ivaNoDeducible) filas.push({tipo:'linea',label:'(+) IVA no deducible',value:R.ivaNoDeducible});
    if(R.excesoViaticos) filas.push({tipo:'linea',label:'(+) Exceso de viáticos no deducible',value:R.excesoViaticos});
    if(R.excesoDonaciones) filas.push({tipo:'linea',label:'(+) Exceso de donaciones no deducible',value:R.excesoDonaciones});
    if(R.gastosRentasCapital) filas.push({tipo:'linea',label:'(+) Costos y gastos vinculados a rentas de capital (no deducibles)',value:R.gastosRentasCapital});
    if(R.rentasOtrasCategorias) filas.push({tipo:'linea',label:'(−) Rentas de capital (intereses y ganancias de capital, tributan aparte)',value:-R.rentasOtrasCategorias});
    filas.push({tipo:'subtotal',label:'Renta imponible',value:R.baseImponibleISR});
  }
  return filas;
}
function filaISRTexto(R){
  if(R.regimenPeriodo!=='general') return '';
  return `ISR sobre utilidades${R.isrYaCerrado?' (cerrado con el cierre fiscal total)':' (25%)'}`;
}
function notaISRTexto(R){
  if(R.regimenPeriodo==='general') return R.isrYaCerrado
    ? 'El cierre fiscal total ya liquidó este impuesto — el monto que se muestra es la partida real posteada, no una proyección.'
    : 'El 25% se calcula sobre la renta imponible, no sobre la utilidad contable — los gastos no deducibles y los excesos de viáticos y donaciones bajan la utilidad de arriba porque son gastos reales, pero la ley no permite restarlos para el ISR, así que se suman de vuelta antes de aplicar la tarifa. Los pagos trimestrales que se hacen durante el año son a cuenta de este mismo impuesto anual — el detalle está en el Tablero fiscal.';
  if(R.regimenPeriodo==='simplificado') return 'El ISR del Régimen Opcional Simplificado ya está descontado arriba, dentro de Gastos de administración, porque se contabiliza en el momento de cada venta.';
  return `El régimen vigente en este período (${esc(REGIMENES[R.regimenPeriodo]||'—')}) no calcula ISR por separado del IVA.`;
}
function filasAHtml(filas){
  return filas.map(f=>{
    if(f.tipo==='grupo') return `<tr class="grupo-cta"><td colspan="2">${f.label}</td></tr>`;
    if(f.tipo==='subtotal') return `<tr><td style="padding-left:26px"><em>${f.label}</em></td><td class="num"><em>${Q(f.value)}</em></td></tr>`;
    /* Mismo color que se usa en el listado de gastos para estas dos líneas
       —"Gastos no deducibles" e "IVA no deducible"—, para que se reconozcan
       como la misma cosa en las dos partes donde aparecen: donde se restan
       dentro de gastos, y acá donde se vuelven a sumar para la renta
       imponible. */
    const esNoDeducible=/no deducible/i.test(f.label);
    return `<tr><td style="padding-left:26px${esNoDeducible?';color:var(--haber)':''}">${f.label}</td><td class="num"${esNoDeducible?' style="color:var(--haber)"':''}>${Q(f.value)}</td></tr>`;
  }).join('');
}
function filasAPdf(filas){
  return filas.filter(f=>f.tipo!=='grupo').map(f=>
    f.tipo==='subtotal'
      ? [{content:f.label,styles:{fontStyle:'italic'}},{content:Q(f.value),styles:{fontStyle:'italic',halign:'right'}}]
      : [f.label,Q(f.value)]);
}

VISTAS.resultados=()=>{
  const e=emp();
  e.inventarioFinal=e.inventarioFinal||{};
  const d=filtros.desde||`${e.ejercicio}-01-01`, h=filtros.hasta||`${e.ejercicio}-12-31`;
  const R=calcularResultados(e,d,h);
  const mov=R.mov;
  const bloque=(titulo,tipos,prefijo,excluir)=>{
    let s=0,f='';
    e.cuentas.filter(c=>c.d&&tipos.includes(c.t)&&(!prefijo||c.c.startsWith(prefijo))&&!(excluir&&excluir.includes(c.c))).forEach(c=>{
      const v=saldoNatural(c.c,mov); if(!v) return; s+=v;
      /* Gastos no deducibles y su IVA se destacan con otro color dentro del
         listado — mezclados con Honorarios, Papelería y demás gastos
         normales, no se notaba que estas dos son de una naturaleza
         distinta: no bajan la base del ISR, aunque sí sean un gasto real. */
      const esNoDeducible=c.c==='6.2.14'||c.c==='6.2.27'||c.c==='6.2.28';
      f+=`<tr><td style="padding-left:26px${esNoDeducible?';color:var(--haber)':''}">${esc(c.n)}</td><td class="num"${esNoDeducible?' style="color:var(--haber)"':''}>${Q(v)}</td></tr>`;
    });
    return f? {html:`<tr class="grupo-cta"><td colspan="2">${titulo}</td></tr>${f}
      <tr><td style="padding-left:26px"><em>Total ${titulo.toLowerCase()}</em></td><td class="num"><em>${Q(s)}</em></td></tr>`,total:r2(s)}
      : {html:'',total:0};
  };

  /* Una vez que el costo de ventas ya se cerró con una partida real, no tiene
     sentido seguir mostrando la fórmula (inventario inicial + compras −
     inventario final) — esos números de compras quedan contaminados por la
     propia partida de cierre, y mostrar "0.00" ahí, para después mostrar el
     costo real más abajo como si fuera otra cosa, es justo la confusión que
     hacía parecer que el costo de ventas aparecía dos veces. Cerrado, se
     muestra directo el saldo real de la cuenta. Las devoluciones y rebajas
     sobre compras se funden en esta misma línea siempre, cerrado o no. */
  const cosInvHtml = filasAHtml(filasCostoVentas(R));

  const ing={total:R.ingresos,html:bloque('Ingresos',['ingreso']).html};
  const cosOtros=bloque('Otros costos',['costo'],null,['5.1.01','5.1.03']);   // fletes u otras cuentas de costo
  const excluirGastos = R.regimenPeriodo==='general' ? ['6.2.22'] : [];
  const gv=bloque('Gastos de venta',['gasto'],'6.1',excluirGastos);
  const ga=bloque('Gastos de administración',['gasto'],'6.2',excluirGastos);
  const gf=bloque('Gastos financieros',['gasto'],'6.3',excluirGastos);

  /* La conciliación de ISR, el texto de su línea y su nota son los mismos
     que arma el Libro de Estados Financieros — misma fuente, así no se
     pueden desincronizar entre pantallas. */
  const filasConciliacion=filasAHtml(filasConciliacionISR(R));
  const isrTexto=filaISRTexto(R);
  const filaISR=isrTexto?`<tr><td>${isrTexto}</td><td class="num">${Q(R.isr)}</td></tr>`:'';
  const notaISR=notaISRTexto(R);

  return cab('Estado de resultados',`Del ${fFecha(d)} al ${fFecha(h)} · cifras en quetzales`)
    + rangoFechas(d,h)
    + (!R.tieneFinal && (R.invInicial||R.comprasBienes) ? `<div class="aviso malo">
        Falta el inventario final al ${fFecha(h)} para que el costo de ventas sea correcto.
        Se está calculando con Q0.00 mientras tanto, lo que infla el costo de ventas.
        Ingresalo abajo, con el valor de un conteo físico real.</div>` : '')
    + (R.excesoViaticos ? `<div class="aviso malo">Los viáticos del período (Q${Q(R.viaticos)}) superan el 3% de la renta
        bruta permitido por ley (Q${Q(R.limiteViaticos)}, Art. 21 Dto. 10-2012). El exceso, Q${Q(R.excesoViaticos)},
        sigue siendo un gasto contable real, pero no es deducible para ISR — ya se sumó de vuelta a la utilidad
        imponible de abajo.</div>` : '')
    + (R.excesoDonaciones ? `<div class="aviso malo">Las donaciones del período (Q${Q(R.donaciones)}) superan el límite
        deducible —el menor entre 5% de la renta neta y Q500,000 anuales— que es de Q${Q(R.limiteDonaciones)}
        (Art. 21 núm. 22, Dto. 10-2012). El exceso, Q${Q(R.excesoDonaciones)}, sigue siendo un gasto contable real,
        pero no es deducible para ISR — ya se sumó de vuelta a la utilidad imponible de abajo. Esto no aplica a
        donaciones a universidades o a asociaciones científicas y culturales no lucrativas, que no tienen este
        límite — si es tu caso, revisá el monto a mano.</div>` : '')
    + (R.noDeducible && R.regimenPeriodo==='general' && !R.isrYaCerrado ? `<div class="aviso">Los gastos no
        deducibles del período (Q${Q(R.noDeducible)}) siguen siendo un gasto contable real —por eso bajan la
        utilidad de arriba—, pero la ley no permite restarlos para el ISR: ya se sumaron de vuelta a la utilidad
        imponible de abajo, igual que muestra el propio formulario de la SAT en Declaraguate.</div>` : '')
    + `<div class="barra" style="margin-bottom:10px">
        <div class="campo"><label>Inventario final al ${fFecha(h)}</label>
          <input id="invFinalInput" type="number" step="0.01" min="0"
            value="${R.tieneFinal?R.invFinal:''}" placeholder="Del conteo físico"></div>
        <button class="btn sec" data-accion="guardarInvFinal" data-hasta="${h}">Guardar inventario final</button>
        ${R.tieneFinal&&!R.yaCerrado?`<button class="btn" data-accion="cerrarCostoVentas" data-hasta="${h}">Cerrar costo de ventas</button>`:''}
      </div>
    ${R.yaCerrado?`<div class="aviso bien">El costo de ventas de este período ya se cerró con una partida real —
        Inventarios y Costo de Ventas reflejan el conteo físico que diste, no una estimación.</div>`:''}
    <table><tbody>${ing.html}${cosInvHtml}${cosOtros.html}
      <tr class="total"><td>${R.bruta<0?'Pérdida bruta':'Utilidad bruta'}</td><td class="num">${Q(R.bruta)}</td></tr>
      ${gv.html}${ga.html}${gf.html}
      <tr class="total"><td>Total gastos de operación</td><td class="num">${Q(R.gastos)}</td></tr>
      ${filasConciliacion || `<tr class="total"><td>${R.antesISR<0?'Pérdida':'Utilidad'} antes de ISR</td><td class="num">${Q(R.antesISR)}</td></tr>`}
      ${filaISR}
      <tr class="total"><td>${R.neta<0?'Pérdida':'Utilidad'} neta del período</td><td class="num">${Q(R.neta)}</td></tr>
      </tbody></table>
      <div class="aviso">${notaISR}</div>`;
};

/* Libro de Inventarios — Art. 368 Código de Comercio: "un detalle clasificado
   y pormenorizado del contenido del saldo de cada una de las cuentas de
   activo, pasivo y capital", normalmente al cierre del ejercicio. No es un
   kardex de productos (eso vive en "Inventario") — es el detalle de TODO
   el balance, cuenta por cuenta, y donde ya se tiene el desglose (inventario,
   clientes, proveedores) se muestra completo. */
VISTAS.libroInventarios=()=>{
  const e=emp();
  const h=filtros.corteInventario||`${e.ejercicio}-12-31`;
  const mov=movimientos(null,h);
  const siguienteDia=(()=>{ const d=new Date(h+'T00:00:00'); d.setDate(d.getDate()+1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();

  const detalleCuenta=cta=>{
    if(cta==='1.1.08'){
      const {lista}=inventarioDetalle(e);
      return lista.map(p=>({nombre:p.producto+(p.cantidad?` (${p.cantidad} u.)`:''),monto:p.total}));
    }
    if(cta==='1.1.04') return carteraClientes(e).filter(x=>x.saldo).map(x=>({nombre:x.nombre||x.nit,monto:x.saldo}));
    if(cta==='2.1.01') return carteraProveedores(e).filter(x=>x.saldo).map(x=>({nombre:x.nombre||x.nit,monto:x.saldo}));
    return null;
  };
  const bloque=(titulo,tipo)=>{
    let s=0,f='';
    e.cuentas.filter(c=>c.d&&c.t===tipo).forEach(c=>{
      const v=saldoCuentaAntesDe(e,c.c,siguienteDia); if(!v) return; s+=v;
      const detalle=detalleCuenta(c.c);
      f+=`<tr class="grupo-cta"><td colspan="2">${esc(c.c)} — ${esc(c.n)}</td></tr>`;
      if(detalle&&detalle.length){
        detalle.forEach(x=>f+=`<tr><td style="padding-left:36px;font-size:13px;color:var(--tinta-suave)">${esc(x.nombre)}</td>
          <td class="num" style="font-size:13px">${Q(x.monto)}</td></tr>`);
        f+=`<tr><td style="padding-left:26px"><em>Subtotal ${esc(c.n)}</em></td><td class="num"><em>${Q(v)}</em></td></tr>`;
      }else{
        f+=`<tr><td style="padding-left:26px">${esc(c.n)}</td><td class="num">${Q(v)}</td></tr>`;
      }
    });
    return {html:f||`<tr class="grupo-cta"><td colspan="2">${titulo}</td></tr><tr><td style="padding-left:26px;color:var(--tinta-suave)">Sin saldos</td><td></td></tr>`,total:r2(s)};
  };
  const a=bloque('Activo','activo'), p=bloque('Pasivo','pasivo'), pt=bloque('Patrimonio','patrimonio');
  /* Misma utilidad que el Balance General (antes sumaba toda la historia de
     la empresa y no coincidía). */
  const u=utilidadPatrimonioSinDuplicar(e,h);
  return cab('Libro de Inventarios',`Al ${fFecha(h)} · detalle de cada cuenta del balance · cifras en quetzales`,
    `<button class="btn" data-accion="pdfLibroInventarios">Descargar PDF</button>`)
  + `<div class="barra"><div class="campo"><label>Fecha de corte</label>
      <input type="date" data-filtro="corteInventario" value="${h}"></div></div>
    <div class="aviso">Normalmente se corta al cierre del ejercicio, el 31 de diciembre. Las cuentas de
      Inventarios, Clientes y Proveedores ya muestran su desglose completo — producto por producto,
      contraparte por contraparte. El resto de cuentas se ve por su saldo total.</div>
    <h3 style="color:var(--verde);margin:20px 0 4px">Activo</h3>
    <table><tbody>${a.html}<tr class="total"><td>Total activo</td><td class="num">${Q(a.total)}</td></tr></tbody></table>
    <h3 style="color:var(--verde);margin:20px 0 4px">Pasivo</h3>
    <table><tbody>${p.html}<tr class="total"><td>Total pasivo</td><td class="num">${Q(p.total)}</td></tr></tbody></table>
    <h3 style="color:var(--verde);margin:20px 0 4px">Capital / Patrimonio</h3>
    <table><tbody>${pt.html}
      ${filasUtilidadPatrimonio(e,h)}
      <tr class="total"><td>Total patrimonio</td><td class="num">${Q(r2(pt.total+u))}</td></tr></tbody></table>`;
};

VISTAS.balance=()=>{
  const e=emp();
  const h=filtros.hasta||`${e.ejercicio}-12-31`;
  const mov=movimientos(null,h);
  const bloque=(titulo,tipo)=>{
    let s=0,f='';
    e.cuentas.filter(c=>c.d&&c.t===tipo).forEach(c=>{
      const v=saldoNatural(c.c,mov); if(!v) return; s+=v;
      f+=`<tr><td style="padding-left:26px">${esc(c.n)}</td><td class="num">${Q(v)}</td></tr>`;
    });
    return {html:`<tr class="grupo-cta"><td colspan="2">${titulo}</td></tr>${f||'<tr><td style="padding-left:26px;color:var(--tinta-suave)">Sin saldos</td><td></td></tr>'}`,total:r2(s)};
  };
  const a=bloque('Activo','activo'), p=bloque('Pasivo','pasivo'), pt=bloque('Patrimonio','patrimonio');
  /* La utilidad que se suma al patrimonio tiene que ser la misma que muestra
     el Estado de Resultados para el mismo ejercicio — si no, este balance y
     ese reporte cuentan una historia distinta del mismo negocio. Se toma
     desde el inicio del ejercicio hasta la fecha de corte del balance. */
  const u=utilidadPatrimonioSinDuplicar(e,h);
  const totalPP=r2(p.total+pt.total+u);
  const cuadra=r2(a.total)===totalPP;
  return cab('Balance general',`Al ${fFecha(h)} · cifras en quetzales`)
    + `<div class="barra"><div class="campo"><label>Al</label><input type="date" data-filtro="hasta" value="${h}"></div></div>`
    + `<div class="aviso ${cuadra?'bien':'malo'}">${cuadra
        ? 'El balance cuadra: activo igual a pasivo más patrimonio.'
        : `Descuadre de Q${Q(Math.abs(a.total-totalPP))}. Revisá las partidas.`}</div>`
    + `<table><tbody>${a.html}
      <tr class="total"><td>Total activo</td><td class="num">${Q(a.total)}</td></tr>
      ${p.html}<tr class="total"><td>Total pasivo</td><td class="num">${Q(p.total)}</td></tr>
      ${pt.html}${filasUtilidadPatrimonio(e,h)}
      <tr class="total"><td>Total patrimonio</td><td class="num">${Q(r2(pt.total+u))}</td></tr>
      <tr class="total"><td>Total pasivo y patrimonio</td><td class="num">${Q(totalPP)}</td></tr>
      </tbody></table>`;
};

