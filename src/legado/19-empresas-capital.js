/* ============ ACCIONES GENERALES — empresas, catálogo, cartera ============ */
/* Un usuario solo puede tocar cuentas dentro de lo que le toca administrar:
   el superadmin, cuentas de Administrador; cada Administrador, su propio
   personal — nunca el de otro Administrador. */
/* ============ CAPITAL SOCIAL — al constituir una empresa individual o sociedad ============ */
const socioVacio=()=>({nombre:'',monto:0,tipo:'dineraria',cuenta:'1.1.01'});
/* La partida de capital ya no se fecha siempre con la fecha de hoy: si la
   empresa se crea para un ejercicio pasado, ese ejercicio quedaba sin capital. */
const fechaConstitucionDefault=e=>hoy().slice(0,4)===String(e.ejercicio)?hoy():`${e.ejercicio}-01-01`;

VISTAS.capitalSocial=()=>{
  const e=emp(), b=borradorCapital;
  if(!b) return cab('Capital social')+`<div class="vacio">No hay ningún registro de capital pendiente.</div>`;
  const cajaBanco=cuentasCajaBanco(e);
  const cuentasActivo=e.cuentas.filter(c=>c.d&&c.t==='activo');
  const totalSuscrito=r2(b.socios.reduce((s,x)=>s+(+x.monto||0),0));
  const excede=b.capitalAutorizado && totalSuscrito>b.capitalAutorizado;
  const filas=b.socios.map((s,i)=>`<tr>
    <td><input data-socio="${i}" data-campo="nombre" value="${esc(s.nombre)}" placeholder="Nombre del socio"></td>
    <td><input data-socio="${i}" data-campo="monto" type="number" step="0.01" min="0" value="${s.monto||''}" style="width:120px"></td>
    <td><select data-socio="${i}" data-campo="tipo">
      <option value="dineraria"${s.tipo==='dineraria'?' selected':''}>En dinero</option>
      <option value="no_dineraria"${s.tipo==='no_dineraria'?' selected':''}>En especie (bienes)</option>
    </select></td>
    <td><select data-socio="${i}" data-campo="cuenta">
      ${s.tipo==='dineraria'
        ? cajaBanco.map(c=>`<option value="${c.c}"${s.cuenta===c.c?' selected':''}>${c.c} — ${esc(c.n)}</option>`).join('')
        : cuentasActivo.map(c=>`<option value="${c.c}"${s.cuenta===c.c?' selected':''}>${c.c} — ${esc(c.n)}</option>`).join('')}
    </select></td>
    <td class="num"><button class="btn mini peligro" data-quitarSocio="${i}">Quitar</button></td></tr>`).join('');
  return cab('Capital social',`${esc(e.nombre)} — registrá los socios y lo que aporta cada uno.`,
    `<button class="btn" data-accion="confirmarCapitalSocial">Registrar capital</button>`)
  + `<div class="tarjeta"><div class="campo" style="max-width:260px">
      <label>Capital autorizado (según la escritura)</label>
      <input id="capAutorizado" type="number" step="0.01" min="0" value="${b.capitalAutorizado||''}"></div>
      <div class="campo" style="max-width:260px;margin-top:10px"><label>Fecha de la escritura / registro</label>
      <input id="capFecha" type="date" value="${b.fecha||fechaConstitucionDefault(e)}"></div></div>
    <table><thead><tr><th>Socio</th><th>Monto que suscribe</th><th>Forma de aportación</th>
      <th>¿A qué cuenta entra?</th><th class="num"></th></tr></thead>
      <tbody>${filas}</tbody>
      <tfoot><tr class="total"><td colspan="1">Total suscrito</td><td class="num">${Q(totalSuscrito)}</td>
        <td colspan="3"></td></tr></tfoot></table>
    <p style="margin:10px 0"><button class="btn sec mini" data-accion="agregarSocio">Agregar socio</button></p>
    ${excede?`<div class="aviso malo">Lo suscrito (Q${Q(totalSuscrito)}) supera el capital autorizado (Q${Q(b.capitalAutorizado)}).
      No puede ser mayor.</div>`:''}
    <div class="aviso">Se van a generar dos partidas: primero la que reconoce el capital autorizado y lo que
      cada socio se compromete a aportar (queda como una cuenta por cobrar a cada socio, identificada con su
      nombre); y otra que registra el pago real de esa aportación, a la cuenta que elegiste para cada quien.
      Si algún socio todavía no paga lo que suscribió, dejá su fila en la primera parte y generá el pago después
      desde una partida manual.</div>`;
};

function enlazarCapitalSocial(){
  const b=borradorCapital;
  const capAut=document.getElementById('capAutorizado');
  if(capAut) capAut.onchange=()=>{ b.capitalAutorizado=r2(+capAut.value||0); pintar(); };
  const capFecha=document.getElementById('capFecha');
  if(capFecha) capFecha.onchange=()=>{ b.fecha=capFecha.value; };
  document.querySelectorAll('[data-socio]').forEach(campo=>{
    campo.onchange=()=>{
      const i=+campo.dataset.socio, prop=campo.dataset.campo;
      b.socios[i][prop] = prop==='monto' ? (+campo.value||0) : campo.value;
      if(prop==='tipo'){   // cambia el tipo: reiniciar la cuenta al valor por defecto de ese tipo
        b.socios[i].cuenta = campo.value==='dineraria' ? '1.1.01' : (emp().cuentas.find(c=>c.d&&c.t==='activo')||{}).c;
      }
      pintar();
    };
  });
  document.querySelectorAll('[data-quitarSocio]').forEach(btn=>{
    btn.onclick=()=>{ b.socios.splice(+btn.dataset.quitarsocio,1); pintar(); };
  });
}
ACCIONES.agregarSocio=()=>{ borradorCapital.socios.push(socioVacio()); pintar(); };
ACCIONES.confirmarCapitalSocial=()=>{
  const e=emp(), b=borradorCapital;
  const socios=b.socios.filter(s=>s.nombre.trim() && (+s.monto||0)>0);
  if(!socios.length){avisar('Agregá al menos un socio con nombre y monto.');return}
  const totalSuscrito=r2(socios.reduce((s,x)=>s+(+x.monto||0),0));
  const autorizado=r2(+b.capitalAutorizado||0);
  if(!autorizado){avisar('Escribí el capital autorizado según la escritura.');return}
  if(totalSuscrito>autorizado){avisar('Lo suscrito no puede ser mayor que el capital autorizado.');return}

  confirmar(`Se registrará un capital autorizado de Q${Q(autorizado)}, con Q${Q(totalSuscrito)} suscrito entre ${socios.length} socio(s), y el pago correspondiente a la cuenta que elegiste para cada uno.`,()=>{
    asegurarCuenta(e,'1.1.12','Capital suscrito por cobrar a socios','activo');
    asegurarCuenta(e,'3.1.05','Capital Autorizado','patrimonio');
    asegurarCuenta(e,'3.1.06','Capital Autorizado No Suscrito','patrimonio');
    asegurarCuenta(e,'3.1.07','Capital Suscrito','patrimonio');

    /* Partida 1: se reconoce el capital autorizado completo, y de ese total,
       lo que ya se suscribió queda como una cuenta por cobrar a cada socio,
       identificada con su nombre. */
    const noSuscrito=r2(autorizado-totalSuscrito);
    const lineas1=[];
    if(noSuscrito) lineas1.push({cta:'3.1.06',desc:'',debe:noSuscrito,haber:0});
    socios.forEach(s=>lineas1.push({cta:'1.1.12',desc:`Suscripción de ${s.nombre.trim()}`,debe:r2(s.monto),haber:0}));
    lineas1.push({cta:'3.1.05',desc:'',debe:0,haber:autorizado});
    const fechaCap=b.fecha||fechaConstitucionDefault(e);
    const p1={id:uid(),numero:e.correlativo++,fecha:fechaCap,
      concepto:`Capital autorizado y suscrito de ${e.nombre}`,
      docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',lineas:lineas1};
    e.partidas.push(p1);

    /* Partida 2: el pago real de lo suscrito, a la cuenta que corresponda
       según si cada socio aportó en dinero o en especie. */
    const lineas2=[];
    socios.forEach(s=>lineas2.push({cta:s.cuenta,desc:`Aportación de ${s.nombre.trim()}`,debe:r2(s.monto),haber:0}));
    socios.forEach(s=>lineas2.push({cta:'1.1.12',desc:`Pago de ${s.nombre.trim()}`,debe:0,haber:r2(s.monto)}));
    const p2={id:uid(),numero:e.correlativo++,fecha:fechaCap,
      concepto:`Pago del capital suscrito de ${e.nombre}`,
      docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',lineas:lineas2};
    e.partidas.push(p2);

    /* Se guarda la lista de socios aparte de las partidas, para poder elegirlos
       después en un aumento de capital sin tener que volver a escribir el
       nombre ni arriesgar que quede distinto por un error de tipeo. */
    e.socios=e.socios||[];
    socios.forEach(s=>{
      if(!e.socios.some(x=>x.nombre.trim().toLowerCase()===s.nombre.trim().toLowerCase()))
        e.socios.push({id:uid(),nombre:s.nombre.trim()});
    });

    registrarLog('Registró el capital social',`${e.nombre} — autorizado Q${Q(autorizado)}, suscrito Q${Q(totalSuscrito)} entre ${socios.length} socios`);
    borradorCapital=null; guardar(); VISTA='empresas'; pintar();
    avisar(`Capital social registrado en las partidas No. ${p1.numero} y No. ${p2.numero}.`,'Listo');
  },'Registrar capital');
};

/* ---- Aumento de capital: aportaciones posteriores a la constitución, de
   cualquier origen (sueldo, préstamo, venta de un bien personal, etc.) — se
   identifican siempre con quién aporta y de dónde salió el dinero, para que
   quede trazable. ---- */
const ORIGENES_CAPITAL=['Sueldo de relación de dependencia','Préstamo personal del propietario o socio',
  'Venta de un bien personal','Herencia o donación recibida','Ahorros propios','Otro'];

VISTAS.aumentosCapital=()=>{
  const e=emp();
  e.aumentosCapital=e.aumentosCapital||[];
  const lista=[...e.aumentosCapital].sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const filas=lista.map(a=>`<tr><td>${fFecha(a.fecha)}</td>
    <td>${a.socio?esc(a.socio):'—'}</td>
    <td>${esc(a.origen)}${a.origenDetalle?`<br><span style="font-size:12px;color:var(--tinta-suave)">${esc(a.origenDetalle)}</span>`:''}</td>
    <td class="num">${Q(a.monto)}</td>
    <td class="num"><button class="btn mini" data-accion="verPartida" data-id="${a.partidaId}">Ver partida</button></td></tr>`).join('');
  return cab('Aumento de capital','Aportaciones a la empresa después de la constitución, con su origen identificado.',
    `<button class="btn" data-accion="nuevoAumentoCapital">Registrar aumento</button>`)
  + (lista.length? `<table><thead><tr><th>Fecha</th><th>${e.tipoSociedad==='sociedad'?'Socio':'Aportante'}</th>
      <th>Origen del dinero</th><th class="num">Monto</th><th class="num"></th></tr></thead>
      <tbody>${filas}</tbody>
      <tfoot><tr class="total"><td colspan="3">Total aportado después de la constitución</td>
        <td class="num">${Q(r2(lista.reduce((s,a)=>s+a.monto,0)))}</td><td></td></tr></tfoot></table>`
     : `<div class="vacio">Todavía no se ha registrado ningún aumento de capital.</div>`);
};

ACCIONES.nuevoAumentoCapital=()=>{
  const e=emp();
  const cajaBanco=cuentasCajaBanco(e);
  if(!cajaBanco.length){avisar('El catálogo no tiene ninguna cuenta de Caja o Bancos.');return}
  const esSociedad=e.tipoSociedad==='sociedad';
  const cuentasActivo=e.cuentas.filter(c=>c.d&&c.t==='activo');
  const opsSocio = esSociedad ? (e.socios||[]).map(s=>`<option value="${esc(s.nombre)}">${esc(s.nombre)}</option>`)
    .concat(['<option value="__nuevo__">+ Nuevo socio (escribir nombre)</option>']).join('') : '';

  abrirModal('Registrar aumento de capital',
    `<div class="rej">
      <div class="campo full"><label>Monto aportado</label><input name="monto" type="number" step="0.01" min="0"></div>
      <div class="campo"><label>Fecha</label><input name="fecha" type="date" value="${hoy()}"></div>
      ${esSociedad? `<div class="campo"><label>Socio que aporta</label><select name="socio">${opsSocio}</select></div>
      <div class="campo full" id="socioNuevoWrap" style="display:none"><label>Nombre del socio nuevo</label>
        <input name="socioNuevo"></div>` : ''}
      <div class="campo full"><label>¿De dónde proviene el dinero?</label><select name="origen">
        ${ORIGENES_CAPITAL.map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join('')}
      </select></div>
      <div class="campo full" id="origenDetalleWrap" style="display:none"><label>Especificá</label>
        <input name="origenDetalle" placeholder="Ej. venta de un vehículo particular"></div>
      <div class="campo full"><label>Forma de aportación</label><select name="tipoAportacion">
        <option value="dineraria">En dinero</option>
        <option value="no_dineraria">En especie (bienes)</option>
      </select></div>
      <div class="campo full" id="cuentaDinerariaWrap"><label>¿A qué cuenta entra?</label><select name="cuentaDineraria">
        ${cajaBanco.map(c=>`<option value="${c.c}">${c.c} — ${esc(c.n)}</option>`).join('')}
      </select></div>
      <div class="campo full" id="cuentaNoDinerariaWrap" style="display:none"><label>¿A qué cuenta de activo entra?</label>
        <select name="cuentaNoDineraria">${cuentasActivo.map(c=>`<option value="${c.c}">${c.c} — ${esc(c.n)}</option>`).join('')}</select></div>
    </div>`,
    d=>{
      const monto=r2(+d.monto);
      if(!monto||monto<=0){avisar('Escribí el monto aportado.');return false}
      let socio='';
      if(esSociedad){
        socio = d.socio==='__nuevo__' ? (d.socioNuevo||'').trim() : d.socio;
        if(!socio){avisar('Elegí quién aporta, o escribí el nombre del socio nuevo.');return false}
      }
      const origen = d.origen==='Otro' ? 'Otro' : d.origen;
      const origenDetalle = d.origen==='Otro' ? (d.origenDetalle||'').trim() : '';
      if(d.origen==='Otro' && !origenDetalle){avisar('Especificá de dónde proviene el dinero.');return false}
      const cuenta = d.tipoAportacion==='dineraria' ? d.cuentaDineraria : d.cuentaNoDineraria;

      asegurarCuenta(e,'3.1.05','Capital Autorizado','patrimonio');
      asegurarCuenta(e,'3.1.07','Capital Suscrito','patrimonio');
      const ctaCapital = esSociedad ? '3.1.07' : '3.1.01';
      const quien = esSociedad ? socio : (e.representante||'el propietario');
      const lineas=[
        {cta:cuenta,desc:`Aumento de capital — ${quien}`,debe:monto,haber:0},
        {cta:ctaCapital,desc:`Aumento de capital — ${quien}`,debe:0,haber:monto},
      ];
      const p={id:uid(),numero:e.correlativo++,fecha:d.fecha||hoy(),
        concepto:`Aumento de capital de ${e.nombre}${esSociedad?' — '+socio:''} (${origenDetalle||origen})`,
        docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:socio,lineas};
      e.partidas.push(p);

      if(esSociedad && socio){
        e.socios=e.socios||[];
        if(!e.socios.some(x=>x.nombre.toLowerCase()===socio.toLowerCase())) e.socios.push({id:uid(),nombre:socio});
      }
      e.aumentosCapital=e.aumentosCapital||[];
      e.aumentosCapital.push({id:uid(),fecha:d.fecha||hoy(),monto,socio,origen,origenDetalle,partidaId:p.id});

      registrarLog('Registró un aumento de capital',`${e.nombre}${esSociedad?' — '+socio:''} — Q${Q(monto)} (${origenDetalle||origen})`);
      guardar();
      avisar(`Aumento de capital registrado en la partida No. ${p.numero}.`,'Listo');
    },'Registrar aumento');

  const selOrigen=mForm.querySelector('[name="origen"]');
  selOrigen.onchange=()=>{ document.getElementById('origenDetalleWrap').style.display = selOrigen.value==='Otro'?'':'none'; };
  const selTipo=mForm.querySelector('[name="tipoAportacion"]');
  selTipo.onchange=()=>{
    const dineraria=selTipo.value==='dineraria';
    document.getElementById('cuentaDinerariaWrap').style.display=dineraria?'':'none';
    document.getElementById('cuentaNoDinerariaWrap').style.display=dineraria?'none':'';
  };
  if(esSociedad){
    const selSocio=mForm.querySelector('[name="socio"]');
    selSocio.onchange=()=>{ document.getElementById('socioNuevoWrap').style.display = selSocio.value==='__nuevo__'?'':'none'; };
  }
};

function formCapitalIndividual(empresa){
  abrirModal('Capital inicial',
    `<p style="margin:0 0 14px;font-size:13px;color:var(--tinta-suave)">${esc(empresa.nombre)} es una empresa
      individual. Este capital queda a nombre del propietario.</p>
    <div class="rej">
      <div class="campo full"><label>Capital inicial</label><input name="capital" type="number" step="0.01" min="0"></div>
      <div class="campo full"><label>Fecha de inicio de operaciones</label><input name="fecha" type="date" value="${fechaConstitucionDefault(empresa)}"></div>
      <div class="campo full"><label>¿A qué cuenta va?</label><select name="destino">
        <option value="caja">Solo Caja</option>
        <option value="bancos">Solo Bancos</option>
        <option value="ambas">Parte en Caja y parte en Bancos</option>
      </select></div>
      <div class="campo" id="montoCajaWrap" style="display:none"><label>Monto en Caja</label>
        <input name="montoCaja" type="number" step="0.01" min="0"></div>
      <div class="campo" id="montoBancosWrap" style="display:none"><label>Monto en Bancos</label>
        <input name="montoBancos" type="number" step="0.01" min="0"></div>
    </div>`,
    d=>{
      const capital=r2(+d.capital);
      if(!capital||capital<=0){avisar('Escribí el capital inicial.');return false}
      const e=empresa;
      let montoCaja=0, montoBancos=0;
      if(d.destino==='caja') montoCaja=capital;
      else if(d.destino==='bancos') montoBancos=capital;
      else{
        montoCaja=r2(+d.montoCaja||0); montoBancos=r2(+d.montoBancos||0);
        if(r2(montoCaja+montoBancos)!==capital){avisar(`Caja + Bancos tiene que sumar exacto el capital inicial (Q${Q(capital)}).`);return false}
      }
      const lineas=[];
      if(montoCaja) lineas.push({cta:'1.1.01',desc:'',debe:montoCaja,haber:0});
      if(montoBancos) lineas.push({cta:'1.1.03',desc:'',debe:montoBancos,haber:0});
      lineas.push({cta:'3.1.01',desc:'',debe:0,haber:capital});
      e.partidas.push({id:uid(),numero:e.correlativo++,fecha:d.fecha||fechaConstitucionDefault(e),
        concepto:`Capital inicial de ${e.nombre}`,
        docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',lineas});
      registrarLog('Registró el capital inicial',`${e.nombre} — Q${Q(capital)}`);
      guardar(); VISTA='empresas'; pintar();
      avisar('Capital inicial registrado.','Listo');
    },'Registrar capital');
  const destinoSel=mForm.querySelector('[name="destino"]');
  destinoSel.onchange=()=>{
    const ambas=destinoSel.value==='ambas';
    document.getElementById('montoCajaWrap').style.display=ambas?'':'none';
    document.getElementById('montoBancosWrap').style.display=ambas?'':'none';
  };
}

function usuarioEnAlcance(id){
  const actual=usuarioActual();
  const x=(BD.usuarios||[]).find(u=>u.id===id);
  if(!x||!actual) return null;
  if(actual.rol==='superadmin') return x.rol==='administrador' ? x : null;
  if(actual.rol==='administrador') return x.administradorId===actual.id ? x : null;
  return null;
}
ACCIONES.nuevoUsuario=()=>formUsuario(null);
ACCIONES.editarUsuario=d=>{
  const x=usuarioEnAlcance(d.id);
  if(!x){avisar('Esa cuenta no está a tu alcance.');return}
  formUsuario(x);
};
function formUsuario(existente){
  const actual=usuarioActual(), esSuper=actual.rol==='superadmin';
  const x=existente||{};
  const lic=x.licencia||{};
  const opsRol = esSuper
    ? `<option value="administrador">Administrador</option>`
    : ROLES_ASIGNABLES.filter(r=>r!=='administrador')
        .map(r=>`<option value="${r}"${x.rol===r?' selected':''}>${ROLES[r].nombre}</option>`).join('');
  const misEmpresas = esSuper ? [] : BD.empresas.filter(e=>e.administradorId===actual.id);
  const asignadasActuales = Array.isArray(x.empresasAsignadas) ? x.empresasAsignadas : null;   // null = cuenta nueva
  const checksEmpresas = misEmpresas.map(e=>`<label style="display:flex;align-items:center;gap:6px;font-weight:400;margin-bottom:4px">
      <input type="checkbox" name="emp_${e.id}" style="width:auto"
        ${asignadasActuales===null || asignadasActuales.includes(e.id) ? 'checked' : ''}>
      ${esc(e.nombre)}</label>`).join('');
  const limites=[10,20,50,100,500];
  const opsLimite=limites.map(n=>`<option value="${n}"${(lic.max_empresas||10)===n?' selected':''}>Hasta ${n} empresas</option>`).join('');
  abrirModal(existente?'Editar usuario':(esSuper?'Agregar administrador':'Agregar usuario'),
    `<div class="rej">
      <div class="campo full"><label>Nombre completo</label><input name="nombre" value="${esc(x.nombre||'')}"></div>
      <div class="campo"><label>Correo electrónico (con él inicia sesión)</label><input name="usuario" type="email" value="${esc(x.usuario||'')}"></div>
      <div class="campo"><label>Rol</label><select name="rol" ${esSuper?'disabled':''}>${opsRol}</select></div>
      <div class="campo full"><label>${existente?'Nueva contraseña (dejar en blanco para no cambiarla)':'Contraseña inicial (la persona tendrá que cambiarla al entrar)'}</label>
        <input name="clave" type="password" autocomplete="new-password"></div>
      ${esSuper ? `<div class="campo"><label>Plan (tramo de empresas)</label><select name="limiteEmpresas">${opsLimite}</select></div>
      <div class="campo"><label>Máximo de usuarios</label><input name="maxUsuarios" type="number" min="1" value="${lic.max_usuarios||25}"></div>
      <div class="campo"><label>La licencia vence (vacío = sin vencimiento)</label><input name="vence" type="date" value="${esc(lic.vence||'')}"></div>
      <div class="campo full"><label style="display:flex;gap:8px;align-items:flex-start;font-weight:400">
        <input type="checkbox" name="iaPermitida" style="width:auto;margin-top:4px"${x.iaPermitida?' checked':''}>
        <span><strong>Puede usar el asistente de IA</strong> — lo usa también todo el personal de este Administrador.
        Cada consulta se cobra a la clave de API que guardaste en Usuarios.</span></label></div>` : ''}
      ${!esSuper ? `<div class="campo full"><label>Empresas a las que tiene acceso</label>
        ${misEmpresas.length? checksEmpresas
          : '<p style="font-size:13px;color:var(--tinta-suave);margin:0">Todavía no tenés empresas creadas.</p>'}
        </div>` : ''}
    </div>`,
    async d=>{
      if(!d.nombre.trim()){avisar('Escribí el nombre.');return false}
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.usuario.trim())){avisar('Escribí un correo electrónico válido.');return false}
      if(!existente && !d.clave){avisar('Escribí una contraseña.');return false}
      if(d.clave && d.clave.length<8){avisar('La contraseña tiene que tener al menos 8 caracteres.');return false}
      const rol = esSuper ? 'administrador' : d.rol;
      const payload={accion:existente?'editar':'crear',id:existente&&existente.id,nombre:d.nombre.trim(),
        email:d.usuario.trim(),clave:d.clave||undefined,rol,
        empresas:esSuper?undefined:misEmpresas.filter(e=>d['emp_'+e.id]==='on').map(e=>e.id),
        iaPermitida:esSuper?d.iaPermitida==='on':undefined,
        limiteEmpresas:d.limiteEmpresas,maxUsuarios:d.maxUsuarios,vence:d.vence||null};
      try{
        await apiUsuarios(payload);
        await recargarDatos();
      }catch(err){ avisar(err.message); return false; }
      registrarLog(existente?'Editó una cuenta de usuario':'Creó una cuenta de usuario',`${d.nombre.trim()} (${d.usuario.trim()}) — ${ROLES[rol].nombre}`);
      pintar();
    },existente?'Guardar cambios':'Crear cuenta');
}
ACCIONES.alternarUsuario=async d=>{
  const x=usuarioEnAlcance(d.id);
  if(!x){avisar('Esa cuenta no está a tu alcance.');return}
  if(x.id===BD.sesion){avisar('No podés bloquear tu propia cuenta mientras la estás usando.');return}
  try{ await apiUsuarios({accion:'alternar',id:x.id}); await recargarDatos(); }
  catch(err){ avisar(err.message); return; }
  registrarLog(x.activo===false?'Bloqueó una cuenta':'Desbloqueó una cuenta',`${x.nombre} (${x.usuario})`);
  pintar();
};
ACCIONES.borrarUsuario=d=>{
  const x=usuarioEnAlcance(d.id);
  if(!x){avisar('Esa cuenta no está a tu alcance.');return}
  if(x.id===BD.sesion){avisar('No podés eliminar tu propia cuenta mientras la estás usando.');return}
  const extra=x.rol==='administrador'?'\n\nSe eliminarán también TODAS sus empresas y su personal. No se puede deshacer.':'';
  confirmar(`Se eliminará la cuenta de ${x.nombre} (${x.usuario}).${extra}`,async()=>{
    try{ await apiUsuarios({accion:'borrar',id:x.id}); await recargarDatos(); }
    catch(err){ avisar(err.message); return; }
    registrarLog('Eliminó una cuenta de usuario',`${x.nombre} (${x.usuario})`);
    pintar();
  },'Eliminar cuenta');
};


ACCIONES.nuevaEmpresa=()=>formEmpresa(null);
ACCIONES.editarEmpresa=d=>{
  const e=empresasVisibles().find(x=>x.id===d.id);
  if(!e){avisar('Esa empresa no está a tu alcance.');return}
  formEmpresa(e);
};
ACCIONES.usarEmpresa=d=>{cambiarEmpresa(d.id)};
ACCIONES.borrarEmpresa=d=>{
  const e=empresasVisibles().find(x=>x.id===d.id);
  if(!e){avisar('Esa empresa no está a tu alcance.');return}
  confirmar(`Se eliminará "${e.nombre}" junto con sus ${e.partidas.length} partidas y su catálogo de cuentas.\n\nEsto no se puede deshacer.`,()=>{
    BD.empresas=BD.empresas.filter(x=>x.id!==d.id);
    registrarLog('Eliminó una empresa',e.nombre);
    if(BD.activa===d.id)BD.activa=empresasVisibles()[0]?empresasVisibles()[0].id:null;
    guardar();pintar();
  },'Eliminar empresa');
};

ACCIONES.nuevaCuenta=()=>{
  const tipos=['activo','pasivo','patrimonio','ingreso','costo','gasto']
    .map(t=>`<option value="${t}">${t}</option>`).join('');
  abrirModal('Agregar cuenta',
    `<div class="rej">
      <div class="campo"><label>Código</label><input name="c" placeholder="1.1.12"></div>
      <div class="campo"><label>Tipo</label><select name="t">${tipos}</select></div>
      <div class="campo full"><label>Nombre de la cuenta</label><input name="n"></div>
      <div class="campo full"><label>Uso</label><select name="d"><option value="1">De detalle (recibe movimiento)</option><option value="0">Agrupadora</option></select></div>
    </div>`,
    d=>{
      const e=emp();
      if(!d.c.trim()||!d.n.trim()){avisar('Faltan el código y el nombre.');return false}
      if(!/^\d+(\.\d+)*$/.test(d.c.trim())){avisar('El código solo puede llevar números separados por puntos, por ejemplo 1.1.12 o 6.2.32.');return false}
      if(e.cuentas.some(x=>x.c===d.c.trim())){avisar('Ya existe una cuenta con ese código.');return false}
      e.cuentas.push({c:d.c.trim(),n:d.n.trim(),t:d.t,d:d.d==='1'});
      e.cuentas.sort((a,b)=>a.c.localeCompare(b.c,undefined,{numeric:true}));
      guardar();
    });
};
ACCIONES.borrarCuenta=d=>{
  if(!puedeEliminar()){avisar('Tu rol no tiene permiso para eliminar cuentas del catálogo.');return}
  const e=emp();
  if(e.partidas.some(p=>p.lineas.some(l=>l.cta===d.c))){
    avisar('Esta cuenta ya tiene movimiento registrado, así que no se puede eliminar sin dejar partidas huérfanas.');return}
  const c=e.cuentas.find(x=>x.c===d.c);
  confirmar(`Se eliminará la cuenta ${d.c} — ${c?c.n:''} del catálogo.`,()=>{
    e.cuentas=e.cuentas.filter(x=>x.c!==d.c);guardar();pintar();
  },'Eliminar cuenta');
};

ACCIONES.verProveedor=d=>{
  const e=emp(), x=carteraProveedores(e).find(c=>c.nit===d.nit);
  if(!x){avisar('No se encontró información de este proveedor.');return}
  const docs=(e.documentos||[]).filter(doc=>doc.tipo==='compra'&&doc.alCredito&&doc.nit===d.nit)
    .sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const pagos=(e.pagos||[]).filter(p=>p.nit===d.nit).sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const filasDocs=docs.map(doc=>`<tr><td>${fFecha(doc.fecha)}</td>
    <td>${esc(doc.tipoDte||'FACT')} ${esc(doc.serie||'')}${doc.dte?'-'+esc(doc.dte):''}</td>
    <td class="num">${Q(doc.base)}</td><td class="num">${doc.iva?Q(doc.iva):'—'}</td>
    <td class="num">${doc.signo===-1?'−':''}${Q(doc.total)}</td></tr>`).join('');
  const filasPagos=pagos.map(p=>{
    const c=e.cuentas.find(y=>y.c===p.cuenta);
    return `<tr><td>${fFecha(p.fecha)}</td>
      <td>${p.forma==='cheque'?'Cheque'+(p.numeroCheque?' No. '+esc(p.numeroCheque):''):'Efectivo'}</td>
      <td>${esc(c?c.n:p.cuenta)}</td><td class="num">${Q(p.monto)}</td></tr>`;
  }).join('');
  abrirModal(esc(x.nombre||d.nit),
    `<p style="margin:0 0 14px;color:var(--tinta-suave);font-size:14px">NIT ${esc(d.nit)}
      &nbsp;·&nbsp; Saldo pendiente <strong style="color:var(--tinta)">Q${Q(x.saldo)}</strong>
      &nbsp;·&nbsp; <button class="btn mini sec" type="button" id="btnImprimirEC">Imprimir estado de cuenta</button></p>
    <h4 style="margin:0 0 6px;color:var(--verde);font-size:14px">Facturas al crédito</h4>
    ${docs.length? `<table style="font-size:13px;margin-bottom:16px"><thead><tr><th>Fecha</th><th>Documento</th>
      <th class="num">Base</th><th class="num">IVA</th><th class="num">Total</th></tr></thead>
      <tbody>${filasDocs}</tbody></table>`
      : `<p style="font-size:13px;color:var(--tinta-suave);margin:0 0 16px">Sin facturas registradas.</p>`}
    <h4 style="margin:0 0 6px;color:var(--verde);font-size:14px">Pagos realizados</h4>
    ${pagos.length? `<table style="font-size:13px"><thead><tr><th>Fecha</th><th>Forma</th>
      <th>Cuenta</th><th class="num">Monto</th></tr></thead><tbody>${filasPagos}</tbody></table>`
      : `<p style="font-size:13px;color:var(--tinta-suave);margin:0">Todavía no se le ha pagado nada.</p>`}`,
    ()=>{},'Cerrar');
  mForm.querySelector('#btnImprimirEC').onclick=()=>ACCIONES.pdfEstadoCuenta({nit:d.nit,tipoCuenta:'proveedor'});
};

ACCIONES.verCliente=d=>{
  const e=emp(), x=carteraClientes(e).find(c=>c.nit===d.nit);
  if(!x){avisar('No se encontró información de este cliente.');return}
  const docs=(e.documentos||[]).filter(doc=>doc.tipo==='venta'&&doc.alCredito&&doc.nit===d.nit)
    .sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const cobros=(e.cobros||[]).filter(c=>c.nit===d.nit).sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const filasDocs=docs.map(doc=>`<tr><td>${fFecha(doc.fecha)}</td>
    <td>${esc(doc.tipoDte||'FACT')} ${esc(doc.serie||'')}${doc.dte?'-'+esc(doc.dte):''}</td>
    <td class="num">${Q(doc.base)}</td><td class="num">${doc.iva?Q(doc.iva):'—'}</td>
    <td class="num">${doc.signo===-1?'−':''}${Q(doc.total)}</td></tr>`).join('');
  const filasCobros=cobros.map(c=>{
    const ct=e.cuentas.find(y=>y.c===c.cuenta);
    return `<tr><td>${fFecha(c.fecha)}</td>
      <td>${c.forma==='retencion'?'Retención'+(c.numeroCheque?' — constancia '+esc(c.numeroCheque):''):c.forma==='cheque'?'Cheque'+(c.numeroCheque?' No. '+esc(c.numeroCheque):''):c.forma==='transferencia'?'Transferencia':'Efectivo'}</td>
      <td>${esc(ct?ct.n:c.cuenta)}</td><td class="num">${Q(c.monto)}</td></tr>`;
  }).join('');
  abrirModal(esc(x.nombre||d.nit),
    `<p style="margin:0 0 14px;color:var(--tinta-suave);font-size:14px">NIT ${esc(d.nit)}
      &nbsp;·&nbsp; Saldo pendiente <strong style="color:var(--tinta)">Q${Q(x.saldo)}</strong>
      &nbsp;·&nbsp; <button class="btn mini sec" type="button" id="btnImprimirEC">Imprimir estado de cuenta</button></p>
    <h4 style="margin:0 0 6px;color:var(--verde);font-size:14px">Facturas al crédito</h4>
    ${docs.length? `<table style="font-size:13px;margin-bottom:16px"><thead><tr><th>Fecha</th><th>Documento</th>
      <th class="num">Base</th><th class="num">IVA</th><th class="num">Total</th></tr></thead>
      <tbody>${filasDocs}</tbody></table>`
      : `<p style="font-size:13px;color:var(--tinta-suave);margin:0 0 16px">Sin facturas registradas.</p>`}
    <h4 style="margin:0 0 6px;color:var(--verde);font-size:14px">Cobros realizados</h4>
    ${cobros.length? `<table style="font-size:13px"><thead><tr><th>Fecha</th><th>Forma</th>
      <th>Cuenta</th><th class="num">Monto</th></tr></thead><tbody>${filasCobros}</tbody></table>`
      : `<p style="font-size:13px;color:var(--tinta-suave);margin:0">Todavía no se le ha cobrado nada.</p>`}`,
    ()=>{},'Cerrar');
  mForm.querySelector('#btnImprimirEC').onclick=()=>ACCIONES.pdfEstadoCuenta({nit:d.nit,tipoCuenta:'cliente'});
};

ACCIONES.registrarPago=d=>{
  const e=emp(), cartera=carteraProveedores(e).filter(x=>x.saldo>0.005);
  if(!cartera.length){avisar('No hay proveedores con saldo pendiente.');return}
  const cajaBanco=cuentasCajaBanco(e);
  if(!cajaBanco.length){avisar('El catálogo no tiene ninguna cuenta de Caja o Bancos.');return}
  const opsProv=cartera.map(x=>`<option value="${esc(x.nit)}"${d.nit===x.nit?' selected':''}>
    ${esc(x.nombre||x.nit)} — saldo Q${Q(x.saldo)}</option>`).join('');
  abrirModal('Registrar pago a proveedor',
    `<div class="rej">
      <div class="campo full"><label>Proveedor</label><select name="nit">${opsProv}</select></div>
      <div class="campo"><label>Fecha</label><input name="fecha" type="date" value="${hoy()}"></div>
      <div class="campo"><label>Forma de pago</label><select name="forma">
        <option value="efectivo">Efectivo</option><option value="cheque">Cheque</option>
        <option value="transferencia">Transferencia</option></select></div>
      <div class="campo"><label id="lblCuenta">Se descuenta de</label><select name="cuenta"></select></div>
      <div class="campo"><label id="lblReferencia">No. de cheque (si aplica)</label><input name="numCheque"></div>
      <div class="campo full"><label>Monto pagado</label><input name="monto" type="number" step="0.01" min="0"></div>
    </div>`,
    dat=>{
      const prov=cartera.find(x=>x.nit===dat.nit);
      const monto=r2(+dat.monto||0);
      if(!prov){avisar('Elegí el proveedor al que se le pagó.');return false}
      if(!monto){avisar('Escribí el monto pagado.');return false}
      if(monto>r2(prov.saldo+0.01)){avisar(`El monto supera el saldo pendiente de Q${Q(prov.saldo)} con ese proveedor.`);return false}
      if(!dat.cuenta){avisar('No se encontró una cuenta de Caja o Bancos para esta forma de pago.');return false}
      const forma = dat.forma==='cheque' ? `cheque${dat.numCheque?' No. '+dat.numCheque.trim():''}`
        : dat.forma==='transferencia' ? `transferencia${dat.numCheque?' — ref. '+dat.numCheque.trim():''}`
        : 'efectivo';
      /* Se une a la partida del día, junto con cualquier otra operación de esa fecha. */
      const p=partidaDelDia(e,dat.fecha);
      sumarMovimiento(p,'2.1.01',monto,0);
      sumarMovimiento(p,dat.cuenta,0,monto);
      p.n=(p.n||0)+1;
      actualizarConceptoDia(p);
      e.pagos=e.pagos||[];
      e.pagos.push({id:uid(),fecha:dat.fecha,nit:prov.nit,nombre:prov.nombre,
        forma:dat.forma,numeroCheque:(dat.numCheque||'').trim(),cuenta:dat.cuenta,monto,partidaId:p.id});
      registrarLog('Registró un pago a proveedor',`${prov.nombre||prov.nit} — Q${Q(monto)}`);
      guardar();
    },'Registrar pago');
  /* La cuenta se elige sola según la forma de pago: efectivo va a Caja, cheque
     y transferencia van a Bancos. Si hay más de una cuenta del mismo tipo
     (varios bancos), se puede elegir entre ellas. */
  const formaSel=mForm.querySelector('[name="forma"]'), cuentaSel=mForm.querySelector('[name="cuenta"]');
  const lbl=mForm.querySelector('#lblCuenta'), lblRef=mForm.querySelector('#lblReferencia');
  const actualizarCuenta=()=>{
    const vaABanco=formaSel.value==='cheque'||formaSel.value==='transferencia';
    lbl.textContent = vaABanco ? 'Se descuenta del banco' : 'Se descuenta de';
    lblRef.textContent = formaSel.value==='transferencia' ? 'No. de referencia o confirmación (si aplica)'
      : formaSel.value==='cheque' ? 'No. de cheque (si aplica)' : 'Referencia (si aplica)';
    let ops=cajaBanco.filter(c=>(vaABanco?/banco/i:/caja/i).test(c.n));
    if(!ops.length) ops=cajaBanco;
    cuentaSel.innerHTML=ops.map(c=>`<option value="${c.c}">${c.c} — ${esc(c.n)}</option>`).join('');
  };
  formaSel.onchange=actualizarCuenta; actualizarCuenta();
};

ACCIONES.registrarCobro=d=>{
  const e=emp(), cartera=carteraClientes(e).filter(x=>x.saldo>0.005);
  if(!cartera.length){avisar('No hay clientes con saldo pendiente.');return}
  const cajaBanco=cuentasCajaBanco(e);
  if(!cajaBanco.length){avisar('El catálogo no tiene ninguna cuenta de Caja o Bancos.');return}
  const opsCli=cartera.map(x=>`<option value="${esc(x.nit)}"${d.nit===x.nit?' selected':''}>
    ${esc(x.nombre||x.nit)} — saldo Q${Q(x.saldo)}</option>`).join('');
  abrirModal('Registrar cobro a cliente',
    `<div class="rej">
      <div class="campo full"><label>Cliente</label><select name="nit">${opsCli}</select></div>
      <div class="campo"><label>Fecha</label><input name="fecha" type="date" value="${hoy()}"></div>
      <div class="campo"><label>Forma de cobro</label><select name="forma">
        <option value="efectivo">Efectivo</option><option value="cheque">Cheque</option>
        <option value="transferencia">Transferencia</option></select></div>
      <div class="campo"><label id="lblCuenta">Entra a</label><select name="cuenta"></select></div>
      <div class="campo"><label id="lblReferencia">No. de cheque (si aplica)</label><input name="numCheque"></div>
      <div class="campo full"><label>Monto cobrado</label><input name="monto" type="number" step="0.01" min="0"></div>
    </div>`,
    dat=>{
      const cli=cartera.find(x=>x.nit===dat.nit);
      const monto=r2(+dat.monto||0);
      if(!cli){avisar('Elegí el cliente al que se le cobró.');return false}
      if(!monto){avisar('Escribí el monto cobrado.');return false}
      if(monto>r2(cli.saldo+0.01)){avisar(`El monto supera el saldo pendiente de Q${Q(cli.saldo)} con ese cliente.`);return false}
      if(!dat.cuenta){avisar('No se encontró una cuenta de Caja o Bancos para esta forma de cobro.');return false}
      const forma = dat.forma==='cheque' ? `cheque${dat.numCheque?' No. '+dat.numCheque.trim():''}`
        : dat.forma==='transferencia' ? `transferencia${dat.numCheque?' — ref. '+dat.numCheque.trim():''}`
        : 'efectivo';
      /* Se une a la partida del día, junto con cualquier otra operación de esa fecha. */
      const p=partidaDelDia(e,dat.fecha);
      sumarMovimiento(p,dat.cuenta,monto,0);
      sumarMovimiento(p,'1.1.04',0,monto);
      p.n=(p.n||0)+1;
      actualizarConceptoDia(p);
      e.cobros=e.cobros||[];
      e.cobros.push({id:uid(),fecha:dat.fecha,nit:cli.nit,nombre:cli.nombre,
        forma:dat.forma,numeroCheque:(dat.numCheque||'').trim(),cuenta:dat.cuenta,monto,partidaId:p.id});
      registrarLog('Registró un cobro a cliente',`${cli.nombre||cli.nit} — Q${Q(monto)}`);
      guardar();
    },'Registrar cobro');
  const formaSel=mForm.querySelector('[name="forma"]'), cuentaSel=mForm.querySelector('[name="cuenta"]');
  const lbl=mForm.querySelector('#lblCuenta'), lblRef=mForm.querySelector('#lblReferencia');
  const actualizarCuenta=()=>{
    const vaABanco=formaSel.value==='cheque'||formaSel.value==='transferencia';
    lbl.textContent = vaABanco ? 'Entra al banco' : 'Entra a';
    lblRef.textContent = formaSel.value==='transferencia' ? 'No. de referencia o confirmación (si aplica)'
      : formaSel.value==='cheque' ? 'No. de cheque (si aplica)' : 'Referencia (si aplica)';
    let ops=cajaBanco.filter(c=>(vaABanco?/banco/i:/caja/i).test(c.n));
    if(!ops.length) ops=cajaBanco;
    cuentaSel.innerHTML=ops.map(c=>`<option value="${c.c}">${c.c} — ${esc(c.n)}</option>`).join('');
  };
  formaSel.onchange=actualizarCuenta; actualizarCuenta();
};


