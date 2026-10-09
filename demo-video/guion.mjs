/* ---------- Guion (≈105 s) ---------- */
const avisos=async(n=3)=>{ for(let i=0;i<n;i++){ if(!await marco.$('#aviso[open]')) break; await esperar(350); await clicar('#aviso[open] #aSi, #aviso[open] .pie-modal .btn:last-child') } }
async function irA(v){ const sel=`nav [data-v="${v}"]`
  const vis=await marco.$eval(sel,el=>{ const r=el.getBoundingClientRect(); return r.width>0&&r.height>0 }).catch(()=>false)
  if(vis) await clicar(sel); else { await marco.$eval(sel,el=>el.click()); await esperar(350) } }
async function app(id){ await atajo('0'); await camara(1); await marco.evaluate(()=>scrollTo(0,0)); await clicar(`.app-tile[data-app="${id}"]`); await esperar(400) }
async function pdfSobre(accion,rotulo){
  const [dl]=await Promise.all([page.waitForEvent('download',{timeout:30000}),clicar(`[data-accion="${accion}"]`)])
  const ruta=VID+'/'+accion+'.pdf'; await dl.saveAs(ruta)
  execSync(`pdftoppm -r 110 -png -f 1 -l 1 -singlefile "${ruta}" "${VID}/${accion}"`)
  const img=fs.readFileSync(`${VID}/${accion}.png`).toString('base64')
  await page.evaluate(([b,t])=>{ document.getElementById('hojaImg').src='data:image/png;base64,'+b; document.querySelector('#hoja b').textContent=t },[img,rotulo]); await esperar(200)
  await ocultarCursor(); await page.evaluate(()=>document.getElementById('hoja').classList.add('ver')); await esperar(2300)
  await page.evaluate(()=>document.getElementById('hoja').classList.remove('ver')); await esperar(500) }
// 0. Portada
await esperar(3400); marca('portada')
await page.evaluate(()=>document.getElementById('intro').classList.add('oculta'))
// 1. Inicio como apps
await texto('Todo tu negocio, en un solo lugar','Contabilidad, RRHH, compras, ventas y producción, ordenadas como apps')
await camara(1); await esperar(800)
await cursorA('.app-tile[data-app="contabilidad"]'); await esperar(300)
await cursorA('.app-tile[data-app="rrhh"]'); await esperar(300)
await cursorA('.app-tile[data-app="produccion"]'); await esperar(300)
marca('inicio')
// 2. Facturas FEL
await texto('Cargá tus facturas FEL','Subí los XML de la SAT y las partidas se hacen solas')
await atajo('1')
await marco.waitForSelector('#reporte',{state:'attached'})
await enfocar('[data-accion="elegirTipoArchivo"][data-val="compra"]',1.35,180)
await clicar('[data-accion="elegirTipoArchivo"][data-val="compra"]')
await marco.setInputFiles('#reporte',OCTUBRE.map(d=>({name:`${d.serie}-${d.numero}.xml`,mimeType:'text/xml',buffer:Buffer.from(xmlDTE(d))})))
await esperar(300)
await clicar('[data-accion="leerReporte"]'); await esperar(500)
if(await marco.$('#aviso[open]')) { await clicar('#aviso[open] #aSi, #aviso[open] .pie-modal .btn:last-child') }
await marco.selectOption('#modoPartida','documento')
await enfocar('[data-accion="generarPartidas"]',1.25,-260); await esperar(1000)
await clicar('[data-accion="generarPartidas"]'); await esperar(300)
if(await marco.$('#modal[open]')) await clicar('#mAceptar')
await marco.waitForSelector('#aviso[open] #aSi'); await esperar(400); await clicar('#aviso[open] #aSi'); await esperar(500)
await camara(1.15,W/2,H/2); await esperar(900)
if(await marco.$('#aviso[open]')) await clicar('#aviso[open] .pie-modal .btn:last-child')
marca('facturas')
// 3. Libro diario, libros de IVA en PDF y conciliación
await texto('Libros legales al instante','Diario, mayor, compras y ventas, listos para imprimir en PDF')
await atajo('3'); await camara(1.3,W*0.62,330); await esperar(1500)
await camara(1); await irA('libroVentas'); await marco.evaluate(()=>scrollTo(0,0)); await esperar(700)
await pdfSobre('pdfLibroVentas','Libro de Ventas')
marca('libros')
await irA('conciliacion'); await marco.evaluate(()=>scrollTo(0,0)); await esperar(300)
await texto('Todo cuadra, libro por libro','La conciliación compara los libros con la contabilidad')
await enfocar('#vista .aviso',1.2,200); await esperar(1900)
marca('conciliacion')
// 4. Tablero fiscal
await texto('IVA, ISR e ISO al día','El tablero fiscal calcula cada impuesto con tus libros')
await ocultarCursor(); await atajo('2'); await camara(1); await marco.evaluate(()=>scrollTo(0,0)); await esperar(400)
await enfocar('#vista .tit',1.25,260); await esperar(1700)
await subir(520); await esperar(1200)
marca('tablero')
// 5. Estados financieros
await texto('Estados financieros que cuadran','Balance general, resultados y flujo de efectivo')
await camara(1); await atajo('9'); await marco.evaluate(()=>scrollTo(0,0)); await esperar(300)
{ const r=await rect('#vista .aviso'); await camara(Math.min(1.3,(W-24)/r.w),r.x+r.w/2,r.y+300) } await esperar(2000)
marca('balance')
// 6. Activos fijos
await texto('Activos fijos y depreciación','Con los porcentajes máximos de ley, mes a mes')
await camara(1); await marco.evaluate(()=>scrollTo(0,0)); await irA('activosFijos'); await esperar(400)
await clicar('[data-accion="nuevoActivoFijo"]'); await marco.waitForSelector('#modal[open]'); await esperar(500)
await marco.evaluate(()=>{ const el=document.querySelector('#modal [name="descripcion"]'); el.value='Computadora portátil'; el.dispatchEvent(new Event('input',{bubbles:true})) }); await esperar(300)
await escribir('#modal [name="costo"]','8500'); await esperar(100)
await marco.evaluate(()=>{ for(const [n,v] of [['fechaAdquisicion','2026-07-15'],['fechaInicioUso','2026-07-15']]){ const el=document.querySelector(`#modal [name="${n}"]`); el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})) } })
await clicar('#modal [name="confirmaPct"]')
await clicar('#mAceptar'); await esperar(300)
await clicar('[data-accion="generarDepreciacion"]'); await marco.waitForSelector('#modal[open]'); await esperar(1200)
await clicar('#mAceptar'); await esperar(300); await avisos(2)
await esperar(500)
marca('activos')
// 7. Planillas y prestaciones
await texto('Planillas y prestaciones','IGSS, ISR y bonificación calculados solos');
await atajo('5'); await esperar(300)
await clicar('[data-accion="nuevaPlanilla"]'); await marco.waitForSelector('#pDesde'); await esperar(200)
await marco.evaluate(()=>{ borradorPlanilla.hasta='2026-10-31'; borradorPlanilla.fechaPago='2026-10-31'; recalcularFilasPlanilla(); pintar() }); await esperar(300)
await enfocar('table.densa',1.3,-60); await esperar(1500)
await camara(1); await clicar('[data-accion="confirmarPlanilla"]'); await avisos(2); await esperar(500)
{ const id=await marco.evaluate(()=>emp().planillas.find(p=>p.desde==='2026-10-01').id)
  await clicar(`[data-accion="generarPartidaPlanilla"][data-id="${id}"]`); await avisos(2); await esperar(200) }
marca('planilla')
await texto('Liquidaciones y prestaciones','Indemnización, aguinaldo y Bono 14 se calculan al retirarse')
await irA('empleados'); await esperar(300)
{ const id=await marco.evaluate(()=>emp().empleados.find(x=>/Luis/.test(x.nombre)).id)
  await clicar(`[data-accion="liquidarEmpleado"][data-id="${id}"]`); await marco.waitForSelector('#modal[open]'); await esperar(1700); await clicar('#mCancelar'); await esperar(200) }
marca('liquidacion')
// 8. Contratos
await texto('Contratos de trabajo en minutos','Se llenan con un formulario y se ven en vivo')
await camara(1); await atajo('6'); await esperar(300)
await clicar('[data-accion="nuevoContrato"]'); await marco.waitForSelector('#modal[open]'); await esperar(500)
await clicar('#mAceptar'); await marco.waitForSelector('#ctHoja'); await esperar(600)
await enfocar('#ctHoja',1.5,-260); await esperar(1300)
await enfocar('[data-ct="salario"]',1.6); await esperar(200)
await clicar('[data-ct="salario"]'); await escribir('[data-ct="salario"]','5200'); await esperar(300)
await marco.evaluate(()=>{ const h=document.getElementById('ctHoja'); const p=[...h.querySelectorAll('p')].find(x=>/devengará un salario/.test(x.textContent)); if(p){ p.scrollIntoView({block:'center'}); p.style.transition='background .4s'; p.style.background='rgba(142,162,255,.22)' } })
await enfocar('#ctHoja',1.5,0); await esperar(1700)
marca('contrato')
// 9. PDF del contrato
await texto('PDF listo para firmar','Con márgenes y legalización de firmas en su lugar')
await camara(1); await esperar(400)
await pdfSobre('pdfContrato','PDF listo')
marca('pdf')
// 10. Compras
await texto('Compras con aprobación','Órdenes de compra que un gerente aprueba antes de gastar')
await app('compras'); await esperar(500)
await clicar('[data-accion="aprobarOrdenCompra"]'); await avisos(2); await esperar(800)
marca('compras')
// 11. Producción y costeo
await texto('Producción y costeo','Materiales, mano de obra y costos indirectos de cada orden')
await app('produccion'); await esperar(300)
await clicar('[data-accion="abrirOrdenProduccion"]'); await marco.evaluate(()=>scrollTo(0,0)); await esperar(500)
await enfocar('.cifras',1.3,200); await esperar(1100)
await camara(1); await clicar('[data-accion="cerrarOrdenProduccion"]'); await marco.waitForSelector('#modal[open]'); await esperar(1500)
await clicar('#mAceptar'); await esperar(300); await avisos(2); await esperar(500)
marca('produccion')
// 12. Varias empresas
await texto('Varias empresas, un solo acceso','Cada empresa con sus libros, y el personal ve solo lo suyo')
await app('empresa'); await esperar(500)
await camara(1.1,W/2,300); await esperar(700)
{ const id=await marco.evaluate(()=>BD.empresas.find(e=>/Trigal/.test(e.nombre)).id)
  await clicar(`[data-accion="usarEmpresa"][data-id="${id}"]`); await esperar(1000)
  const id0=await marco.evaluate(()=>BD.empresas.find(e=>!/Trigal/.test(e.nombre)).id)
  await marco.evaluate(i=>cambiarEmpresa(i),id0); await esperar(500) }
marca('empresas')
// 13. Atajos
await texto('Atajos a tu medida','Alt + número te lleva a cada pantalla')
await atajo('0'); await marco.evaluate(()=>scrollTo(0,0)); await esperar(300)
await enfocar('.accesos',1.25,40); await esperar(900)
await subir(9999); await esperar(1200)
marca('atajos')
// 14. Cierre
await page.evaluate(()=>document.getElementById('outro').classList.remove('oculta')); await esperar(5600)
marca('fin')
const tFin=Date.now()/1000
await cdp.send('Page.stopScreencast')
console.log('cuadros:',cuadros.length,'errores:',log.filter(l=>/PAGEERROR/.test(l)).join(' | '))

/* ---------- Armar el MP4 ---------- */
const dir=VID+'/cuadros'; fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir)
let lista=''
cuadros.forEach((c,i)=>{ const f=`${dir}/${String(i).padStart(5,'0')}.jpg`; fs.writeFileSync(f,Buffer.from(c.d,'base64'))
  const dur=i<cuadros.length-1?Math.max(0.001,cuadros[i+1].t-c.t):Math.max(0.5,tFin-c.t)
  lista+=`file '${f}'\nduration ${dur.toFixed(4)}\n` })
lista+=`file '${dir}/${String(cuadros.length-1).padStart(5,'0')}.jpg'\n`
fs.writeFileSync(VID+'/lista.txt',lista)
execSync(`ffmpeg -y -loglevel error -f concat -safe 0 -i "${VID}/lista.txt" -vf "fps=30,scale=1080:1920:flags=lanczos,format=yuv420p" -c:v libx264 -preset slow -crf 18 -movflags +faststart "${VID}/adcontis-demo.mp4"`)
console.log(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${VID}/adcontis-demo.mp4"`).toString().trim(),'s')
await b.close()
