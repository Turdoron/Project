/* ============ CARTERA DE PROVEEDORES Y CLIENTES ============ */
/* Se arma a partir del detalle de documentos, no de las partidas: en el modo
   agrupado por día las partidas ya no distinguen proveedor por línea, pero el
   detalle documento por documento siempre conserva el NIT y el nombre. */
/* Con "hasta", solo lo registrado hasta esa fecha (para conciliar contra la cuenta a esa fecha). */
function carteraProveedores(e,hasta){
  const map={}, enFecha=x=>!hasta||(x.fecha||'')<=hasta;
  (e.documentos||[]).forEach(d=>{
    if(d.tipo!=='compra'||!d.alCredito||!enFecha(d)) return;
    const k=d.nit||'—';
    map[k]=map[k]||{nit:k,nombre:d.nombre,comprado:0,pagado:0};
    map[k].comprado=r2(map[k].comprado+(d.signo||1)*d.total);
    if(d.nombre) map[k].nombre=d.nombre;
  });
  (e.pagos||[]).filter(enFecha).forEach(pg=>{
    const k=pg.nit||'—';
    map[k]=map[k]||{nit:k,nombre:pg.nombre,comprado:0,pagado:0};
    map[k].pagado=r2(map[k].pagado+pg.monto);
  });
  return Object.values(map).map(x=>({...x,saldo:r2(x.comprado-x.pagado)}))
    .sort((a,b)=>b.saldo-a.saldo);
}
function carteraClientes(e,hasta){
  const map={}, enFecha=x=>!hasta||(x.fecha||'')<=hasta;
  (e.documentos||[]).forEach(d=>{
    if(d.tipo!=='venta'||!d.alCredito||!enFecha(d)) return;
    const k=d.nit||'—';
    map[k]=map[k]||{nit:k,nombre:d.nombre,vendido:0,cobrado:0};
    /* Lo que el cliente retuvo (ISR, IVA o 5%) no lo va a pagar: se descuenta del saldo. */
    map[k].vendido=r2(map[k].vendido+(d.signo||1)*r2(d.total-(d.retencionISR||0)-(d.retencionIVA||0)));
    if(d.nombre) map[k].nombre=d.nombre;
  });
  (e.cobros||[]).filter(enFecha).forEach(cb=>{
    const k=cb.nit||'—';
    map[k]=map[k]||{nit:k,nombre:cb.nombre,vendido:0,cobrado:0};
    map[k].cobrado=r2(map[k].cobrado+cb.monto);
  });
  return Object.values(map).map(x=>({...x,saldo:r2(x.vendido-x.cobrado)}))
    .sort((a,b)=>b.saldo-a.saldo);
}
/* Cuentas de caja y bancos, para elegir de dónde sale o a dónde entra el dinero. */
const cuentasCajaBanco=e=>e.cuentas.filter(c=>c.d && /caja|banco/i.test(c.n));

/* Movimientos cronológicos de un proveedor o cliente: las facturas suman al
   saldo (cargo) y los pagos o cobros restan (abono). Para el estado de cuenta. */
function movimientosCuenta(e,nit,tipo){
  const cargos=(e.documentos||[]).filter(d=>
      d.tipo===(tipo==='proveedor'?'compra':'venta') && d.alCredito && d.nit===nit)
    .map(d=>({fecha:d.fecha,
      concepto:`${d.signo===-1?'Nota de crédito':(d.tipoDte||'Factura')} ${d.serie?d.serie+'-':''}${d.dte}`,
      monto:(d.signo||1)*r2(d.total-(d.retencionISR||0)-(d.retencionIVA||0)-(d.retIvaFesp||0)-(d.retIsrFesp||0))}));
  const abonos=(tipo==='proveedor'?(e.pagos||[]):(e.cobros||[])).filter(m=>m.nit===nit)
    .map(m=>({fecha:m.fecha,
      concepto:m.forma==='retencion'?`Retención${m.numeroCheque?' — constancia '+m.numeroCheque:''}`:`${tipo==='proveedor'?'Pago':'Cobro'} en ${m.forma==='cheque'
        ?'cheque'+(m.numeroCheque?' No. '+m.numeroCheque:''):'efectivo'}`,
      monto:-m.monto}));
  return [...cargos,...abonos].sort((a,b)=>a.fecha.localeCompare(b.fecha));
}

VISTAS.proveedores=()=>{
  const e=emp(), cartera=carteraProveedores(e);
  const total=r2(cartera.reduce((s,x)=>s+x.saldo,0));
  const filas=cartera.map(x=>`<tr>
    <td>${esc(x.nombre||'Sin nombre')}<br><span style="font-size:13px;color:var(--tinta-suave)">NIT ${esc(x.nit)}</span></td>
    <td class="num">${Q(x.comprado)}</td><td class="num">${Q(x.pagado)}</td>
    <td class="num"><strong>${Q(x.saldo)}</strong></td>
    <td class="num">
      ${x.saldo>0.005?`<button class="btn mini" data-accion="registrarPago" data-nit="${esc(x.nit)}">Registrar pago</button>`:''}
      <button class="btn mini sec" data-accion="verProveedor" data-nit="${esc(x.nit)}" title="Ver detalle" aria-label="Ver facturas y pagos">⋮</button>
    </td>
  </tr>`).join('');
  return cab('Proveedores','Compras al crédito y pagos, acumulados por proveedor.',
    `<button class="btn" data-accion="registrarPago">Registrar pago</button>`)
  + (cartera.length? `<div class="cifras"><div class="cifra"><span>Total por pagar</span><strong>${Q(total)}</strong></div></div>
      <table><thead><tr><th>Proveedor</th><th class="num">Comprado al crédito</th>
        <th class="num">Pagado</th><th class="num">Saldo</th><th class="num"></th></tr></thead>
      <tbody>${filas}</tbody></table>
      <p style="font-size:13px;color:var(--tinta-suave);margin-top:8px">
        Solo se acumulan las compras al crédito (facturas cambiarias). Las de contado no generan saldo.</p>${htmlAntiguedad(e,'proveedores')}`
    : `<div class="vacio">Todavía no hay compras al crédito registradas.
       Se acumulan al cargar facturas cambiarias (FCAM) desde "Cargar facturas".</div>`);
};

VISTAS.clientes=()=>{
  const e=emp(), cartera=carteraClientes(e);
  const total=r2(cartera.reduce((s,x)=>s+x.saldo,0));
  const filas=cartera.map(x=>`<tr>
    <td>${esc(x.nombre||'Sin nombre')}<br><span style="font-size:13px;color:var(--tinta-suave)">NIT ${esc(x.nit)}</span></td>
    <td class="num">${Q(x.vendido)}</td><td class="num">${Q(x.cobrado)}</td>
    <td class="num"><strong>${Q(x.saldo)}</strong></td>
    <td class="num">
      ${x.saldo>0.005?`<button class="btn mini" data-accion="registrarCobro" data-nit="${esc(x.nit)}">Registrar cobro</button>`:''}
      <button class="btn mini sec" data-accion="verCliente" data-nit="${esc(x.nit)}" title="Ver detalle" aria-label="Ver facturas y cobros">⋮</button>
    </td>
  </tr>`).join('');
  return cab('Clientes','Ventas al crédito y cobros, acumulados por cliente.',
    `<button class="btn" data-accion="registrarCobro">Registrar cobro</button>`)
  + (cartera.length? `<div class="cifras"><div class="cifra"><span>Total por cobrar</span><strong>${Q(total)}</strong></div></div>
      <table><thead><tr><th>Cliente</th><th class="num">Vendido al crédito</th>
        <th class="num">Cobrado</th><th class="num">Saldo</th><th class="num"></th></tr></thead>
      <tbody>${filas}</tbody></table>
      <p style="font-size:13px;color:var(--tinta-suave);margin-top:8px">
        Solo se acumulan las ventas al crédito (facturas cambiarias). Las de contado no generan saldo.</p>${htmlAntiguedad(e,'clientes')}`
    : `<div class="vacio">Todavía no hay ventas al crédito registradas.
       Se acumulan al cargar facturas cambiarias (FCAM) desde "Cargar facturas".</div>`);
};

VISTAS.bitacora=()=>{
  const admin=administradorDeSesion();
  const propia=(BD.bitacora||[]).filter(x=>x.administradorId===admin).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const d=filtros.desde, h=filtros.hasta;
  const filtrada = propia.filter(x=>{
    const soloFecha=x.fecha.slice(0,10);
    if(d && soloFecha<d) return false;
    if(h && soloFecha>h) return false;
    return true;
  });
  const fFechaHora=iso=>{
    const dt=new Date(iso);
    return dt.toLocaleDateString('es-GT')+' '+dt.toLocaleTimeString('es-GT',{hour:'2-digit',minute:'2-digit'});
  };
  const filas=filtrada.slice(0,500).map(x=>`<tr>
    <td style="white-space:nowrap">${fFechaHora(x.fecha)}</td>
    <td>${esc(x.usuarioNombre)}<br><span style="font-size:12px;color:var(--tinta-suave)">${esc(x.rol)}</span></td>
    <td>${esc(x.empresaNombre||'—')}</td>
    <td>${esc(x.accion)}${x.detalle?`<br><span style="font-size:12px;color:var(--tinta-suave)">${esc(x.detalle)}</span>`:''}</td>
  </tr>`).join('');
  return cab('Bitácora','Quién hizo qué y cuándo, dentro de tu despacho. Solo vos la podés ver.')
    + `<div class="barra">
        <div class="campo"><label>Desde</label><input type="date" data-filtro="desde" value="${d||''}"></div>
        <div class="campo"><label>Hasta</label><input type="date" data-filtro="hasta" value="${h||''}"></div>
      </div>`
    + (filtrada.length? `<table><thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Empresa</th><th>Acción</th></tr></thead>
        <tbody>${filas}</tbody></table>
        ${filtrada.length>500?`<p style="font-size:13px;color:var(--tinta-suave);margin-top:8px">Mostrando las 500 más recientes de ${filtrada.length}.</p>`:''}`
      : `<div class="vacio">Todavía no hay nada registrado en este rango.</div>`);
};

VISTAS.usuarios=()=>{
  const u=usuarioActual();
  const esSuper=u.rol==='superadmin';
  /* El superadministrador solo administra cuentas de Administrador de este
     despacho — no existe un directorio de "otras firmas" porque este sistema
     no tiene servidor: cada despacho tiene su propia copia, aislada. Cada
     Administrador, a su vez, solo ve al personal que él mismo dio de alta —
     no el de otro Administrador que use el mismo archivo. */
  const lista=(BD.usuarios||[]).filter(x=> esSuper ? x.rol==='administrador' : x.administradorId===u.id);
  const fila=x=>{
    const r=ROLES[x.rol];
    return `<tr${x.activo===false?' style="opacity:.55"':''}>
      <td>${esc(x.nombre)}${x.activo===false?' <span style="color:var(--alerta);font-size:12px">(bloqueado)</span>':''}</td>
      <td>${esc(x.usuario)}</td>
      <td>${esc(r?r.nombre:x.rol)}</td>
      ${esSuper?`<td>${x.iaPermitida?'<span style="color:var(--ok)">Sí</span>':'<span style="color:var(--tinta-suave)">No</span>'}</td>`:''}
      <td class="num">
        <button class="btn mini sec" data-accion="editarUsuario" data-id="${x.id}">Editar</button>
        <button class="btn mini ${x.activo===false?'':'peligro'}" data-accion="alternarUsuario" data-id="${x.id}">${x.activo===false?'Desbloquear':'Bloquear'}</button>
        <button class="btn mini peligro" data-accion="borrarUsuario" data-id="${x.id}">Eliminar</button>
      </td></tr>`;
  };
  return cab('Usuarios', esSuper
      ? 'Cuentas de Administrador de este despacho. Cada una puede crear y gestionar sus propias empresas.'
      : 'Cuentas del personal que trabaja con vos. Cada rol ve solo lo que le corresponde.',
    `<button class="btn" data-accion="nuevoUsuario">${esSuper?'Agregar administrador':'Agregar usuario'}</button>`)
  + (lista.length? `<table><thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th>${esSuper?'<th>Asistente IA</th>':''}<th class="num"></th></tr></thead>
      <tbody>${lista.map(fila).join('')}</tbody></table>`
     : `<div class="vacio">Todavía no hay ${esSuper?'administradores':'usuarios'} registrados.</div>`)
  + (esSuper?`<div class="tarjeta" style="margin-top:18px"><h3>Asistente de IA</h3>
      <p>Vos decidís qué Administradores pueden usar el asistente que propone partidas (marcalo en "Editar"); su personal
        lo hereda. Para que funcione, pegá acá la clave de API de Anthropic (se crea en console.anthropic.com): cada
        consulta se cobra a esa cuenta, aparte del plan de Claude. La clave se guarda solo en este navegador y no va en los respaldos.</p>
      <div style="display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;margin-top:10px">
        <div class="campo ancho"><label>Clave de API ${claveIA()?'(ya hay una guardada)':''}</label>
          <input id="claveIA" type="password" autocomplete="off" placeholder="${claveIA()?'••••••••  (escribí otra para reemplazarla)':'sk-ant-...'}"></div>
        <button class="btn sec" data-accion="guardarClaveIA">Guardar</button>
        ${claveIA()?'<button class="btn peligro" data-accion="borrarClaveIA">Quitar clave</button>':''}
      </div></div>`:'')
  + `<div class="aviso" style="margin-top:18px">Las cuentas, contraseñas y licencias las controla el servidor. Qué módulos ve cada cargo se
      aplica en esta aplicación; el acceso a los datos de cada empresa lo controla la base de datos, según el Administrador al que pertenezca.</div>`;
};

/* Configuración de los accesos directos (Alt + número): qué pantalla abre cada tecla. */
function tarjetaAtajos(){
  const m=atajosVista();
  const grupos=APPS.map(a=>{
    const bs=[...document.querySelectorAll(`nav .app-menu[data-app="${a.id}"] [data-v]`)].filter(b=>b.style.display!=='none');
    return bs.length?{nombre:a.nombre,ops:bs.map(b=>({v:b.dataset.v,n:textoBoton(b)}))}:null;
  }).filter(Boolean);
  const sel=t=>`<select id="atajo${t}" data-tecla-atajo="${t}"><option value="">— Sin atajo —</option>${grupos.map(g=>`<optgroup label="${esc(g.nombre)}">${g.ops.map(o=>`<option value="${o.v}"${m[t]===o.v?' selected':''}>${esc(o.n)}</option>`).join('')}</optgroup>`).join('')}</select>`;
  return `<div class="tarjeta"><h3>Accesos directos</h3>
    <p>Elegí qué pantalla abre cada atajo de teclado (mantené <kbd>Alt</kbd> y tocá el número). Se muestran en el inicio y en el menú.
      <kbd>Alt+0</kbd> siempre vuelve al inicio. Se guardan para tu usuario en esta computadora.</p>
    <div class="atajos-config">${TECLAS_ATAJO.map(t=>`<div class="campo"><label for="atajo${t}">Alt+${t}</label>${sel(t)}</div>`).join('')}</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
      <button class="btn sec" data-accion="guardarAtajos">Guardar accesos directos</button>
      <button class="btn sec" data-accion="restablecerAtajos">Volver a los de fábrica</button></div></div>`;
}
VISTAS.config=()=>cab('Configuración','Ajustes del sistema, no de una empresa en particular.')
  + `<div class="tarjeta">
      <h3>Visibilidad</h3>
      <p>Agranda o reduce el tamaño de todo el sistema —texto, botones, tablas— para que
        sea más cómodo de leer. El sistema recuerda el tamaño que elijas la próxima vez
        que lo abrás en esta computadora.</p>
      <div style="display:flex;align-items:center;gap:10px;margin-top:10px">
        <button class="btn sec" data-accion="escalaMenos" style="font-size:15px;padding:9px 16px" aria-label="Reducir el tamaño">A−</button>
        <button class="btn sec" data-accion="escalaNormal" style="padding:9px 16px" aria-label="Tamaño predeterminado (90 %)" title="Tamaño predeterminado (90 %)">A</button>
        <button class="btn sec" data-accion="escalaMas" style="font-size:19px;padding:9px 16px" aria-label="Agrandar el tamaño">A+</button>
        <span id="escalaTexto" style="color:var(--tinta-suave);font-size:14px">${Math.round(escalaActual()*100)}%</span>
      </div>
    </div>
    ${tarjetaAtajos()}
    ${(()=>{
      const e=emp();
      if(!e) return `<div class="tarjeta"><h3>Salario mínimo</h3>
        <p>Elegí una empresa primero — el salario mínimo se guarda por empresa, porque no todas
        están en el mismo sector.</p></div>`;
      return `<div class="tarjeta"><h3>Salario mínimo</h3>
        <p>El vigente para ${esc(e.nombre)}, del Acuerdo Gubernativo de este año. Se usa para calcular
          los topes de Pequeño Contribuyente y de los regímenes del Decreto 31-2024 en el Tablero fiscal.</p>
        <div style="display:flex;align-items:center;gap:10px;margin-top:10px">
          <div class="campo" style="max-width:180px"><label>Salario mínimo mensual</label>
            <input id="salarioMinInput" type="number" step="0.01" min="0" value="${e.salarioMinimo||SALARIO_MINIMO}"></div>
          <button class="btn sec" data-accion="guardarSalarioMinimo" style="margin-top:20px">Guardar</button>
        </div></div>
      <div class="tarjeta"><h3>Deducción personal de ISR (planillas)</h3>
        <p>Desde 2027 la deducción del empleado equivale a 12 salarios mínimos no agrícolas con bonificación
          (Dto. 13-2026), y la SAT publica el valor cada año. Si ya lo publicó, escribilo acá; si lo dejás vacío,
          el sistema lo calcula con el salario mínimo de arriba.</p>
        <div style="display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;margin-top:10px">
          <div class="campo" style="max-width:120px"><label>Año</label><input id="dedAnio" type="number" value="${e.ejercicio}"></div>
          <div class="campo" style="max-width:200px"><label>Deducción publicada por la SAT</label>
            <input id="dedMonto" type="number" step="0.01" min="0" value="${(e.deduccionPersonalSAT||{})[e.ejercicio]||''}" placeholder="Calculada: ${Q(deduccionPersonalAnual(e.ejercicio,e))}"></div>
          <button class="btn sec" data-accion="guardarDeduccionPersonal">Guardar</button>
        </div></div>
      <div class="tarjeta"><h3>Gastos vinculados a rentas de capital</h3>
        <p>Los intereses y las ganancias de capital tributan aparte, así que se restan de la renta imponible del
          ISR sobre utilidades. Marcá las cuentas de costo o gasto que corresponden a esas rentas (por ejemplo,
          comisiones bancarias de la cuenta que genera los intereses): se suman de vuelta a la renta imponible.</p>
        <div style="max-height:240px;overflow:auto;border:1px solid var(--linea);border-radius:4px;padding:8px 10px;margin:10px 0">
          ${e.cuentas.filter(c=>c.d&&(c.t==='gasto'||c.t==='costo')&&!CUENTAS_YA_NO_DEDUCIBLES.includes(c.c)).map(c=>`<label style="display:flex;gap:8px;align-items:center;font-size:14px;margin:3px 0">
            <input type="checkbox" data-cta-rc="${c.c}" style="width:auto"${(e.cuentasRentasCapital||[]).includes(c.c)?' checked':''}> ${c.c} — ${esc(c.n)}</label>`).join('')}
        </div>
        <button class="btn sec" data-accion="guardarCuentasRentasCapital">Guardar cuentas</button></div>`;
    })()}
    <div class="tarjeta"><h3>Asistente de IA</h3>
      <p>${iaPermitidaSesion()
        ? (claveIA()?'Habilitado por el Superadministrador. Lo encontrás en Partidas contables → Registrar partida.'
                    :'Habilitado por el Superadministrador, pero todavía no guardó la clave de API en este navegador: pedile que la configure en Usuarios.')
        : 'No está habilitado para tu despacho. Lo habilita el Superadministrador, desde Usuarios.'}</p></div>
    <div class="tarjeta"><h3>Instalar la app</h3>
     <p>ADCONTIS se instala en el teléfono o en la computadora como una app, con su ícono y a pantalla completa.
       <strong>Android:</strong> en Chrome, menú ⋮ → «Instalar app» (o el botón de abajo). <strong>iPhone:</strong> en Safari, Compartir → «Agregar a pantalla de inicio».
       Con «Vencimientos → Agregar a mi calendario» los avisos quedan en el calendario del teléfono.</p>
     ${window.matchMedia&&matchMedia('(display-mode: standalone)').matches?'<p><strong>Ya estás usando la app instalada.</strong></p>':`<button class="btn sec" data-accion="instalarApp">Instalar app</button>`}</div>
    <div class="tarjeta"><h3>Respaldos diarios en la nube</h3>
     <p>Cada día en que se modifica una empresa, la nube guarda sola cómo estaba al empezar el día, y una copia si se elimina. Se conservan 30 días y se pueden restaurar desde acá.</p>
     <button class="btn sec" data-accion="verRespaldos">Ver y restaurar respaldos de esta empresa</button></div>
    <div class="tarjeta"><h3>Exportar</h3>
     <p>Descarga un archivo con todas las empresas, catálogos y partidas. Guardalo en la nube o en una USB.</p>
     <button class="btn" data-accion="exportar">Descargar respaldo</button></div>
     <div class="tarjeta"><h3>Importar</h3>
     <p>Reemplaza todo lo que hay ahora con el contenido del archivo de respaldo.</p>
     <input type="file" id="archivoImp" accept="application/json" style="margin-bottom:10px">
     <button class="btn sec" data-accion="importar">Restaurar desde archivo</button></div>
     <div class="tarjeta"><h3>Borrar los registros contables</h3>
     <p>Elimina las partidas y el detalle de documentos de todas las empresas, y deja el
     correlativo en 1. Las empresas, su catálogo de cuentas y las cuentas recordadas se conservan.
     Para eliminar una empresa completa hay que hacerlo una por una desde la pantalla de Empresas.</p>
     <button class="btn peligro" data-accion="borrarTodo">Borrar los registros contables</button></div>`;

function rangoFechas(d,h){
  return `<div class="barra">
    <div class="campo"><label>Desde</label><input type="date" data-filtro="desde" value="${d}"></div>
    <div class="campo"><label>Hasta</label><input type="date" data-filtro="hasta" value="${h}"></div>
    <button class="btn sec" onclick="window.print()">Imprimir</button></div>`;
}

/* ============ MÓDULO EMPLEADOS Y PLANILLAS — vistas y acciones juntas ============ */
/* A diferencia del resto del archivo, aquí las pantallas (VISTAS.empleados,
   VISTAS.planillas) y sus acciones (ACCIONES.nuevoEmpleado, ACCIONES.confirmarPlanilla,
   etc.) están intercaladas en vez de separadas, porque se escribieron como un
   módulo autocontenido. El cálculo de sueldos, IGSS e ISR vive más arriba,
   en "PLANILLAS Y SALARIOS". */
const ACCIONES={};

/* ACCIONES.deshacer vive acá, apenas se declara ACCIONES, para que cualquier
   otra sección del archivo pueda referenciarla sin problema de orden. La
   captura del snapshot (tomarSnapshotDeshacer) se dispara aparte, en los tres
   puntos donde de verdad se aplica un cambio — ver más abajo, cerca de
   abrirModal y confirmar. */
ACCIONES.deshacer=()=>{
  if(!snapshotDeshacer){avisar('No hay ninguna acción reciente para deshacer.');return}
  const e=emp();
  if(!e||e.id!==snapshotDeshacer.empId){avisar('El deshacer solo funciona en la misma empresa donde se hizo la última acción, y ya cambiaste de empresa.');return}
  const aRestaurar=snapshotDeshacer;   // se guarda en una variable propia — confirmar() también
                                        // toma su propio snapshot antes de aplicar el cambio, y
                                        // eso pisaría snapshotDeshacer antes de llegar a usarlo acá.
  confirmar(`¿Deshacer "${etiquetaDeshacer}"? La empresa vuelve exacto a como estaba antes de esa acción.`,()=>{
    saltarSnapshot=true;   // restaurar no debe guardarse como algo "para deshacer"
    const idx=BD.empresas.findIndex(x=>x.id===aRestaurar.empId);
    if(idx>=0) BD.empresas[idx]=aRestaurar.datos;
    snapshotDeshacer=null; etiquetaDeshacer='';
    guardar(); pintar();
    avisar('Deshecho.','Listo');
  },'Deshacer');
};

