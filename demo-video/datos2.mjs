/* Datos adicionales de la demostración (se pega después de datos.mjs): personal, planilla de septiembre,
   una orden de compra por aprobar y una orden de producción en marcha. Todo ficticio. */
const llenar=async vals=>{
  for(const [k,v] of Object.entries(vals)) await page.evaluate(([k,v])=>{ const el=mForm.querySelector(`[name="${k}"]`); if(!el) throw new Error('falta '+k); if(el.type==='checkbox') el.checked=!!v; else el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})) },[k,v])
  await aceptar()
}
await page.evaluate(()=>{
  const e=emp()
  const mk=(nombre,puesto,sal,dpi,fn,sexo,mun)=>({id:crypto.randomUUID(),nombre,puesto,salarioBase:sal,fechaIngreso:'2026-03-01',activo:true,dpi,fechaNac:fn,sexo,estadoCivil:'soltero',profesion:'',nacionalidad:'guatemalteco',municipio:mun,departamento:'Guatemala'})
  e.empleados.push(mk('Luis Alberto Pérez Ruiz','Operario de producción',4200,'2410 55872 0101','1994-02-10','M','Villa Nueva'),
                   mk('Ana Sofía Morales Díaz','Operaria de producción',4100,'3120 77451 0101','1996-07-30','F','Guatemala'))
  guardar()
  /* Planilla de septiembre ya generada, con su partida */
  VISTA='planillas'; ACCIONES.nuevaPlanilla()
  const b=borradorPlanilla; b.desde='2026-09-01'; b.hasta='2026-09-30'; b.fechaPago='2026-09-30'; b.cuentaPago='1.1.03'
  b.detalle=b.detalle.filter(f=>f.nombre!=='María Fernanda Castillo Gómez')
  recalcularFilasPlanilla(); pintar()
})
await page.evaluate(()=>ACCIONES.confirmarPlanilla()); await si(); await avisoTexto()
await page.evaluate(()=>ACCIONES.generarPartidaPlanilla({id:emp().planillas[0].id})); await si(); await avisoTexto()
console.log('planilla sep:',await page.evaluate(()=>JSON.stringify(emp().planillas.map(p=>[p.desde,p.partidaNumero,p.totales.liquido]))))
/* Orden de compra pendiente de aprobación */
await page.evaluate(()=>{
  const e=emp(), items=[{descripcion:'Bolsas de empaque para café (millar)',cantidad:12,precio:850},{descripcion:'Etiquetas adhesivas (millar)',cantidad:20,precio:210}]
  const t=totalesCompra(items,true)
  e.ordenesCompra=e.ordenesCompra||[]
  const o={id:uid(),numero:proximoNumeroCompras(e,'OC','correlativoOC'),estado:'pendiente',creadoPor:quienSoy(),cotizacionId:'',facturado:0,facturas:[],historial:[],
    proveedorNit:'5105',proveedorNombre:'Empaques y Etiquetas, S. A.',fecha:'2026-10-07',fechaEntrega:'2026-10-14',items,aplicaIVA:true,...t,condiciones:'Pago a 30 días, entrega en bodega'}
  historialOC(o,'Creada',''); historialOC(o,'Enviada a aprobación',''); e.ordenesCompra.push(o); guardar()
})
console.log('oc:',await page.evaluate(()=>JSON.stringify(emp().ordenesCompra.map(o=>[o.numero,o.total,o.estado]))))
/* Producción: la empresa fabrica, así que se habilita el módulo y se deja una orden en marcha */
await page.evaluate(()=>{
  const e=emp(); e.tipoActividad='productora'; e.metodoProduccion='ordenes'
  e.costos={tarifaGeneral:32,cuentaMOD:'6.2.01',centros:[{id:'general',nombre:'Producción'}],cif:{modo:'tasa',base:'horasMOD',presupuestoFijo:96000,variablePorBase:0,capacidadNormal:2400,cuentas:['6.2.07'],porProceso:false,procesos:{},asignacion:{}}}
  guardar(); VISTA='produccion'; pintar(); ACCIONES.nuevaOrdenProduccion()
})
await page.waitForSelector('#modal[open]')
await llenar({producto:'Café tostado y molido (libra)',fecha:'2026-10-01',fechaFin:'2026-10-31',cantidadPlan:3000,nota:'Pedido de Supermercados La Ceiba'})
const oid=await page.evaluate(()=>emp().ordenesProduccion[0].id)
await page.evaluate(id=>ACCIONES.materialOrdenProduccion({id}),oid); await page.waitForSelector('#modal[open]')
await llenar({material:'Café en grano (quintal)',cantidad:30,fecha:'2026-10-02'}); await avisoTexto()
await page.evaluate(id=>ACCIONES.boletaManoObra({id}),oid); await page.waitForSelector('#modal[open]')
await llenar({fecha:'2026-10-05',horas:120,tarifa:32,descripcion:'Tostado y molido, primera semana'}); await avisoTexto()
console.log('orden:',await page.evaluate(()=>{const o=emp().ordenesProduccion[0];return JSON.stringify([o.materiales.length,o.manoObra.length,o.cif.length,totalesOrden(o)])}))
/* Segunda empresa, para mostrar el trabajo con varias empresas */
const idPrincipal=await page.evaluate(()=>BD.activa)
await page.evaluate(()=>{ VISTA='empresas'; pintar(); ACCIONES.nuevaEmpresa() }); await page.waitForSelector('#modal[open]')
await llenar({nombre:'Panadería El Trigal, S. A.',representante:'Familia Ordóñez Barrios',direccion:'5a avenida 8-30, zona 1',nit:'8888888',ejercicio:2026})
await page.waitForTimeout(500)
if(await page.locator('#modal[open]').count()) await page.evaluate(()=>cerrarModal())
await page.evaluate(id=>{ cambiarEmpresa(id); VISTA='home'; pintar() },idPrincipal)
console.log('empresas:',await page.evaluate(()=>JSON.stringify([BD.empresas.map(e=>e.nombre),BD.activa===BD.empresas[0].id])))
console.log('errores datos2:',log.filter(l=>/PAGEERROR/.test(l)).join(' | '))
