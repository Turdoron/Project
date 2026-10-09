import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs'
const BASE=process.env.BASE
const SB='https://dvhymhamlyjljpyskmmj.supabase.co'
const hoy=new Date().toISOString().slice(0,10)
const ADMIN_ID='11111111-1111-4111-8111-111111111111', SUP_ID='00000000-0000-4000-8000-000000000000'
const perfiles=[
 {id:SUP_ID,nombre:'Superadministrador',rol:'superadmin',admin_id:null,activo:true,email:'admin@tinbrew.com',rol_app:'superadmin',ia_permitida:false,debe_cambiar_clave:false},
 {id:ADMIN_ID,nombre:'Cliente Uno',rol:'administrador',admin_id:null,activo:true,email:'cliente@x.com',rol_app:'administrador',ia_permitida:false,debe_cambiar_clave:false}]
const licencias=[{admin_id:ADMIN_ID,estado:'activa',vence:null,max_empresas:10,max_usuarios:25}]
let quien=SUP_ID, log=[], empresasDB=[]
function sesion(id){const p=perfiles.find(x=>x.id===id);return{access_token:'a.b.c',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'r',user:{id,email:p.email,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}}}
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}).catch(()=>chromium.launch({args:['--no-sandbox']}))
async function nuevaPagina(){
  const ctx=await b.newContext(); const page=await ctx.newPage()
  page.on('pageerror',e=>log.push('PAGEERROR '+e.message))
  await page.route('https://cdnjs.cloudflare.com/**',r=>r.fulfill({body:'',contentType:'application/javascript'}))
  
  await page.route(SB+'/**',async r=>{
    const req=r.request(), u=new URL(req.url()), m=req.method(), path=u.pathname
    const js=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',headers:{'access-control-allow-origin':'*','content-range':'0-0/*'},body:JSON.stringify(o)})
    if(m==='OPTIONS') return r.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}})
    if(path==='/auth/v1/token'){ const body=JSON.parse(req.postData()); const p=perfiles.find(x=>x.email===body.email); if(!p||body.password!=='buena') return js({error:'invalid_grant',error_description:'Invalid login credentials'},400); quien=p.id; return js(sesion(p.id)) }
    if(path==='/auth/v1/user') return js(sesion(quien).user)
    if(path==='/auth/v1/logout') return r.fulfill({status:204,headers:{'access-control-allow-origin':'*'}})
    if(path==='/rest/v1/perfiles') return js(perfiles)
    if(path==='/rest/v1/licencias') return js(licencias)
    if(path==='/rest/v1/miembros'||path==='/rest/v1/bitacora') { if(m==='POST') {log.push('BITACORA '+req.postData().slice(0,80)); return r.fulfill({status:201,headers:{'access-control-allow-origin':'*'}})} return js([]) }
    if(path==='/rest/v1/empresas'){
      if(m==='GET') return js(empresasDB.filter(e=>quien===e.admin_id))
      if(m==='POST'){ const d=JSON.parse(req.postData()); log.push('INSERT empresa '+d.nombre+' admin='+d.admin_id); empresasDB.push({...d,version:1}); return js({version:1},201) }
      if(m==='PATCH'){ const d=JSON.parse(req.postData()); const id=u.searchParams.get('id').replace('eq.',''); const v=+u.searchParams.get('version').replace('eq.',''); const e=empresasDB.find(x=>x.id===id); if(!e||e.version!==v){log.push('PATCH conflicto');return js([])} e.datos=d.datos;e.version++; log.push('PATCH empresa v'+e.version); return js([{version:e.version}]) }
    }
    if(path==='/rest/v1/rpc/clave_cambiada') return js(null)
    log.push('NO MOCK '+m+' '+path); js({},404)
  })
  await page.route(BASE+'/api/usuarios',async r=>{ log.push('API '+r.request().postData()); r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}) })
  return page
}
import fs from 'fs'
import {execSync} from 'child_process'
const SP=process.env.SP, JP=SP+'/jspdfpkg/node_modules/'
const r2=n=>Math.round((n+Number.EPSILON)*100)/100
let fallas=0, pasan=0
const ok=(c,m)=>{ if(c) pasan++; else fallas++; console.log((c?'PASS ':'FAIL ')+m); if(!c) process.exitCode=1 }
const casi=(a,b)=>Math.abs((+a||0)-(+b||0))<0.005
const page=await nuevaPagina(); await page.setViewportSize({width:1080,height:1350})
await page.route('https://cdnjs.cloudflare.com/ajax/libs/jspdf/**',r=>r.fulfill({body:fs.readFileSync(JP+'jspdf/dist/jspdf.umd.min.js','utf8'),contentType:'application/javascript'}))
await page.route('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/**',r=>r.fulfill({body:fs.readFileSync(JP+'jspdf-autotable/dist/jspdf.plugin.autotable.min.js','utf8'),contentType:'application/javascript'}))
await page.goto(BASE); await page.waitForSelector('#loginUsuario')
await page.fill('#loginUsuario','cliente@x.com'); await page.fill('#loginClave','buena'); await page.click('#btnLogin')
await page.waitForSelector('#app',{state:'visible'}); await page.waitForTimeout(400)

/* ---------- utilidades de la prueba ---------- */
const NIT='7777777'
const sinIVA=reg=>!['general','simplificado'].includes(reg)
function xmlDTE({tipo,fecha,emisor,receptor,serie,numero,items,conIVA}){
  let iva=0, gran=0
  const its=items.map(([bs,desc,cant,precio],i)=>{ const total=r2(cant*precio), im=conIVA?r2(total/1.12*0.12):0; iva=r2(iva+im); gran=r2(gran+total)
    return `<dte:Item NumeroLinea="${i+1}" BienOServicio="${bs}"><dte:Cantidad>${cant}</dte:Cantidad><dte:UnidadMedida>UNI</dte:UnidadMedida><dte:Descripcion>${desc}</dte:Descripcion><dte:PrecioUnitario>${precio}</dte:PrecioUnitario><dte:Precio>${total}</dte:Precio><dte:Descuento>0</dte:Descuento>${conIVA?`<dte:Impuestos><dte:Impuesto><dte:NombreCorto>IVA</dte:NombreCorto><dte:CodigoUnidadGravable>1</dte:CodigoUnidadGravable><dte:MontoGravable>${r2(total-im)}</dte:MontoGravable><dte:MontoImpuesto>${im}</dte:MontoImpuesto></dte:Impuesto></dte:Impuestos>`:''}<dte:Total>${total}</dte:Total></dte:Item>` }).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><dte:GTDocumento xmlns:dte="http://www.sat.gob.gt/dte/fel/0.2.0" Version="0.1"><dte:SAT ClaseDocumento="dte"><dte:DTE ID="DatosCertificados"><dte:DatosEmision ID="DatosEmision">
<dte:DatosGenerales Tipo="${tipo}" FechaHoraEmision="${fecha}T10:00:00-06:00" CodigoMoneda="GTQ"/>
<dte:Emisor NITEmisor="${emisor[0]}" NombreEmisor="${emisor[1]}" AfiliacionIVA="GEN"/>
<dte:Receptor IDReceptor="${receptor[0]}" NombreReceptor="${receptor[1]}"/>
<dte:Items>${its}</dte:Items>
<dte:Totales>${conIVA?`<dte:TotalImpuestos><dte:TotalImpuesto NombreCorto="IVA" TotalMontoImpuesto="${iva}"/></dte:TotalImpuestos>`:''}<dte:GranTotal>${gran}</dte:GranTotal></dte:Totales>
</dte:DatosEmision></dte:DTE><dte:Certificacion><dte:NumeroAutorizacion Numero="${numero}" Serie="${serie}">AAAA-${numero}</dte:NumeroAutorizacion></dte:Certificacion></dte:SAT></dte:GTDocumento>`
}
const avisoTexto=async()=>{ await page.waitForTimeout(120); if(await page.locator('#aviso[open]').count()){ const t=await page.textContent('#avisoCuerpo'); const b=page.locator('#aviso[open] #aSi'); if(await b.count()) await b.click(); else await page.click('#aviso[open] .pie-modal .btn:last-child'); await page.waitForTimeout(150); return t } return '' }
const si=async()=>{ await page.waitForSelector('#aviso[open] #aSi'); await page.click('#aviso[open] #aSi'); await page.waitForTimeout(200) }
const aceptar=async()=>{ await page.click('#mAceptar'); await page.waitForTimeout(220) }
const ir=v=>page.evaluate(v=>{ VISTA=v; filtros={}; ordenProdActual=null; pantallaProd=null; pintar() },v)
const clic=async sel=>{ await page.click(sel); await page.waitForTimeout(150) }
const modal=async accion=>{ await page.evaluate(a=>{ const [n,arg]=a; conSnapshot(n,()=>ACCIONES[n](arg||{})) },accion); await page.waitForSelector('#modal[open]') }
const descargar=async(fn)=>{ const [dl]=await Promise.all([page.waitForEvent('download',{timeout:20000}),fn()]); const ruta=SP+'/entrega/sis/'+dl.suggestedFilename(); await dl.saveAs(ruta); await avisoTexto(); return {nombre:dl.suggestedFilename(),txt:execSync(`pdftotext -layout "${ruta}" -`).toString()} }
fs.mkdirSync(SP+'/entrega/sis',{recursive:true})
const fmt=n=>(+n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})

async function cargarFacturas(tipo,docs,ajustes={}){
  await ir('facturas')
  await page.evaluate(t=>ACCIONES.elegirTipoArchivo({val:t}),tipo)
  await page.setInputFiles('#reporte',docs.map((d,i)=>({name:`${d.serie}-${d.numero}.xml`,mimeType:'text/xml',buffer:Buffer.from(xmlDTE(d))})))
  await clic('[data-accion="leerReporte"]'); await page.waitForTimeout(400)
  const msg=await avisoTexto()
  for(const [numero,campos] of Object.entries(ajustes)){
    const i=await page.evaluate(n=>lote.findIndex(d=>d.dte===n),numero)
    for(const [campo,valor] of Object.entries(campos)){
      if(campo==='ret'||campo==='retiva'){ const sel=campo==='ret'?`[data-retencion="${i}"]`:`[data-retencioniva="${i}"]`; await page.fill(sel,String(valor)); await page.$eval(sel,x=>x.dispatchEvent(new Event('change'))); }
      else await page.selectOption(`[data-f="${i}"][data-campo="${campo}"]`,valor);
      await page.waitForTimeout(80) }
  }
  await page.selectOption('#modoPartida','documento')
  await clic('[data-accion="generarPartidas"]')
  if(await page.locator('#modal[open]').count()) await aceptar()   // vincular productos, si lo pide
  await si(); return {carga:msg,fin:await avisoTexto()}
}
