/* ---------- Guion (≈60 s) ---------- */
// 0. Portada
await esperar(3400); marca('portada')
await page.evaluate(()=>document.getElementById('intro').classList.add('oculta'))
// 1. Inicio como apps
await texto('Todo tu negocio, en un solo lugar','Contabilidad, RRHH, compras y ventas, ordenadas como apps')
await camara(1); await esperar(900)
await cursorA('.app-tile[data-app="contabilidad"]'); await esperar(500)
await cursorA('.app-tile[data-app="rrhh"]'); await esperar(500)
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
await enfocar('[data-accion="generarPartidas"]',1.25,-260); await esperar(1300)
await clicar('[data-accion="generarPartidas"]'); await esperar(300)
if(await marco.$('#modal[open]')) await clicar('#mAceptar')
await marco.waitForSelector('#aviso[open] #aSi'); await esperar(400); await clicar('#aviso[open] #aSi'); await esperar(500)
await camara(1.15,W/2,H/2); await esperar(1200)
if(await marco.$('#aviso[open]')) await clicar('#aviso[open] .pie-modal .btn:last-child')
marca('facturas')
// 3. Libro diario
await atajo('3'); await camara(1.3,W*0.62,330); await esperar(1600)
marca('diario')
// 4. Tablero fiscal
await texto('IVA, ISR e ISO al día','El tablero fiscal calcula cada impuesto con tus libros')
await ocultarCursor(); await atajo('2'); await camara(1); await marco.evaluate(()=>scrollTo(0,0)); await esperar(500)
await enfocar('#vista .tit',1.25,260); await esperar(2200)
await subir(520); await esperar(1500)
marca('tablero')
// 5. Estados financieros
await texto('Estados financieros que cuadran','Balance general, resultados y flujo de efectivo')
await camara(1); await atajo('9'); await marco.evaluate(()=>scrollTo(0,0)); await esperar(400)
{ const r=await rect('#vista .aviso'); await camara(Math.min(1.3,(W-24)/r.w),r.x+r.w/2,r.y+300) } await esperar(2600)
marca('balance')
// 6. Contratos
await texto('Contratos de trabajo en minutos','Se llenan con un formulario y se ven en vivo')
await camara(1); await atajo('6'); await esperar(300)
await clicar('[data-accion="nuevoContrato"]'); await marco.waitForSelector('#modal[open]'); await esperar(600)
await clicar('#mAceptar'); await marco.waitForSelector('#ctHoja'); await esperar(800)
await enfocar('#ctHoja',1.5,-260); await esperar(1800)
await enfocar('[data-ct="salario"]',1.6); await esperar(300)
await clicar('[data-ct="salario"]'); await escribir('[data-ct="salario"]','5200'); await esperar(400)
await marco.evaluate(()=>{ const h=document.getElementById('ctHoja'); const p=[...h.querySelectorAll('p')].find(x=>/devengará un salario/.test(x.textContent)); if(p){ p.scrollIntoView({block:'center'}); p.style.transition='background .4s'; p.style.background='rgba(142,162,255,.22)' } })
await enfocar('#ctHoja',1.5,0); await esperar(2800)
marca('contrato')
// 7. PDF
await texto('PDF listo para firmar','Con márgenes y legalización de firmas en su lugar')
await camara(1); await esperar(500)
const [dl]=await Promise.all([page.waitForEvent('download',{timeout:20000}),clicar('[data-accion="pdfContrato"]')])
const rutaPdf=VID+'/contrato.pdf'; await dl.saveAs(rutaPdf)
execSync(`pdftoppm -r 110 -png -f 1 -l 1 -singlefile "${rutaPdf}" "${VID}/hoja1"`)
const hoja=fs.readFileSync(VID+'/hoja1.png').toString('base64')
await page.evaluate(b=>{ document.getElementById('hojaImg').src='data:image/png;base64,'+b },hoja); await esperar(200)
await ocultarCursor(); await page.evaluate(()=>document.getElementById('hoja').classList.add('ver')); await esperar(3000)
await page.evaluate(()=>document.getElementById('hoja').classList.remove('ver'))
marca('pdf')
// 8. Atajos
await texto('Atajos a tu medida','Alt + número te lleva a cada pantalla')
await atajo('0'); await marco.evaluate(()=>scrollTo(0,0)); await esperar(300)
await enfocar('.accesos',1.25,40); await esperar(900)
await subir(9999); await esperar(1600)
marca('atajos')
// 9. Cierre
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
