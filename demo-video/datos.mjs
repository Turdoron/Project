/* Datos de la empresa de demostración (ficticia). Se pega después de base.mjs. */
const YO=[NIT,'Industrias Los Volcanes, S. A.']
const PRV={cafe:['3101','Finca El Mirador, S. A.'],azu:['3102','Ingenio La Unión'],ene:['3103','Empresa Eléctrica'],alq:['3104','Inmobiliaria Central']}
const CLT={a:['4201','Supermercados La Ceiba'],b:['4202','Cafetería Antigua'],c:['4203','Hoteles del Lago, S. A.']}
await page.evaluate(([NIT])=>{
  const id=crypto.randomUUID()
  const e={id,nombre:'Industrias Los Volcanes, S. A.',nit:NIT,direccion:'12 calle 1-25, zona 10',representante:'Industrias Los Volcanes, S. A.',administradorId:BD.sesion,cuentas:nuevoCatalogo(),partidas:[],documentos:[],pagos:[],cobros:[],
    empleados:[],planillas:[],socios:[],mapeoNit:{},mapeoCat:{},mapeoBS:{},mapeoProducto:{},inventarioFinal:{},historialRegimen:[{regimen:'general',vigenteDesde:'2026-01-01'}],historialISO:[{opcion:'pagos',vigenteDesde:'2026-01-01'}],
    regimen:'general',metodoCosteo:'promedio',metodoCosteoConfirmado:true,tipoActividad:'comercializadora',tipoSociedad:'sociedad',correlativo:1,ejercicio:2026,salarioMinimo:SALARIO_MINIMO}
  e.partidas.push({id:crypto.randomUUID(),numero:e.correlativo++,fecha:'2026-01-02',concepto:'Aporte de capital inicial',lineas:[{cta:'1.1.03',desc:'',debe:250000,haber:0},{cta:'3.1.01',desc:'',debe:0,haber:250000}]})
  e.datosContrato={esSociedad:true,cargo:'gerente general y representante legal',municipio:'Guatemala',departamento:'Guatemala',direccionLetras:direccionEnLetras(e.direccion),
    rep:{nombre:'Carlos Eduardo Méndez Ruiz',sexo:'M',fechaNac:'1975-06-21',estadoCivil:'casado',profesion:'administrador de empresas',nacionalidad:'guatemalteco',vecindad:'Guatemala',dpi:'2581 36947 0101'},
    personeria:{notario:'Ana Lucía Herrera Paz',fecha:'2024-02-12',registro:'645210',folio:'318',libro:'792'}}
  const p=asegurarPuesto(e,'Auxiliar contable'); if(p) p.salario=4500
  e.empleados.push({id:crypto.randomUUID(),nombre:'María Fernanda Castillo Gómez',puesto:'Auxiliar contable',puestoId:p&&p.id,salarioBase:4500,fechaIngreso:'2026-11-02',activo:true,
    dpi:'3012 45678 0108',fechaNac:'1997-09-14',sexo:'F',estadoCivil:'soltero',profesion:'perito contador',nacionalidad:'guatemalteca',municipio:'Mixco',departamento:'Guatemala'})
  BD.empresas.push(e); BD.activa=id; guardar(); pintar() },[NIT])

const mes=m=>String(m).padStart(2,'0')
const compras=[], ventas=[]
for(let m=1;m<=9;m++){
  compras.push({tipo:'FACT',fecha:`2026-${mes(m)}-03`,emisor:PRV.cafe,receptor:YO,serie:'FM',numero:String(100+m),items:[['B','Café en grano (quintal)',40,1680]],conIVA:true})
  compras.push({tipo:'FACT',fecha:`2026-${mes(m)}-05`,emisor:PRV.azu,receptor:YO,serie:'IU',numero:String(200+m),items:[['B','Azúcar (quintal)',60,392]],conIVA:true})
  compras.push({tipo:'FACT',fecha:`2026-${mes(m)}-28`,emisor:PRV.ene,receptor:YO,serie:'EE',numero:String(300+m),items:[['S','Energía eléctrica',1,1450+m*35]],conIVA:true})
  compras.push({tipo:'FACT',fecha:`2026-${mes(m)}-01`,emisor:PRV.alq,receptor:YO,serie:'IC',numero:String(400+m),items:[['S','Arrendamiento de bodega',1,6720]],conIVA:true})
  ventas.push({tipo:'FACT',fecha:`2026-${mes(m)}-12`,emisor:YO,receptor:CLT.a,serie:'A',numero:String(m*3-2),items:[['B','Café en grano (quintal)',22+m%4,2520],['B','Azúcar (quintal)',30,504]],conIVA:true})
  ventas.push({tipo:'FACT',fecha:`2026-${mes(m)}-18`,emisor:YO,receptor:CLT.b,serie:'A',numero:String(m*3-1),items:[['B','Café en grano (quintal)',9,2688]],conIVA:true})
  ventas.push({tipo:'FACT',fecha:`2026-${mes(m)}-24`,emisor:YO,receptor:CLT.c,serie:'A',numero:String(m*3),items:[['B','Azúcar (quintal)',25,532]],conIVA:true})
}
const ajC={}; compras.forEach(d=>{ if(d.serie==='IC'||d.serie==='EE') ajC[d.numero]={ctaPago:'1.1.03'} })
const rc=await cargarFacturas('compra',compras,ajC); console.log('compras:',rc.fin.replace(/\s+/g,' ').slice(0,120))
const rv=await cargarFacturas('venta',ventas); console.log('ventas:',rv.fin.replace(/\s+/g,' ').slice(0,120))
await page.evaluate(()=>{ renumerarPartidas(emp()); guardar() })
const resumen=await page.evaluate(()=>{ const e=emp(); return {partidas:e.partidas.length,docs:e.documentos.length} })
console.log('datos listos',JSON.stringify(resumen),log.filter(l=>l.startsWith('PAGEERROR')).join(' | '))
/* Facturas de octubre: se cargan frente a la cámara */
const OCTUBRE=[
  {tipo:'FACT',fecha:'2026-10-03',emisor:PRV.cafe,receptor:YO,serie:'FM',numero:'110',items:[['B','Café en grano (quintal)',40,1680]],conIVA:true},
  {tipo:'FACT',fecha:'2026-10-05',emisor:PRV.azu,receptor:YO,serie:'IU',numero:'210',items:[['B','Azúcar (quintal)',60,392]],conIVA:true},
  {tipo:'FACT',fecha:'2026-10-01',emisor:PRV.alq,receptor:YO,serie:'IC',numero:'410',items:[['S','Arrendamiento de bodega',1,6720]],conIVA:true},
  {tipo:'FACT',fecha:'2026-10-08',emisor:PRV.ene,receptor:YO,serie:'EE',numero:'310',items:[['S','Energía eléctrica',1,1820]],conIVA:true}]
await page.evaluate(()=>{ try{ localStorage.setItem('contagt_tema','oscuro'); localStorage.setItem('contagt_escala2','1.1') }catch(err){} })
await page.waitForTimeout(2500)   // que termine de guardar en la "nube" simulada
