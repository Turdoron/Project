/* Grabación: escenario vertical 1080×1920 con el sistema en un iframe, textos, cámara y cursor. */
const VID=SP+'/video'
const logoB64=fs.readFileSync('/home/user/Project/public/logo-blanco.png').toString('base64')
const ESCENARIO=`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>ADCONTIS</title><style>
:root{--ac:#8EA2FF;--fondo:#0E0D0B;--tinta:#F4F1EA;--suave:#A8A296}
*{box-sizing:border-box}
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:var(--fondo);color:var(--tinta);font-family:var(--f-inter,system-ui),sans-serif}
#arriba{position:absolute;left:0;top:0;width:1080px;height:340px;padding:70px 64px 0}
#marca{display:flex;align-items:center;gap:14px;font-size:24px;letter-spacing:.22em;text-transform:uppercase;color:var(--suave);font-weight:600}
#marca i{display:block;width:44px;height:3px;background:var(--ac);border-radius:2px}
#cap{margin-top:22px;font:500 64px/1.08 var(--f-fraunces,Georgia),serif;letter-spacing:-.015em;min-height:70px}
#sub{margin-top:14px;font-size:32px;line-height:1.3;color:var(--suave);min-height:42px}
.entra{animation:entra .6s cubic-bezier(.2,.8,.2,1) both}
.entra2{animation:entra .6s .12s cubic-bezier(.2,.8,.2,1) both}
@keyframes entra{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
#ventana{position:absolute;left:28px;top:350px;width:1024px;height:1280px;overflow:hidden;border-radius:28px;
  box-shadow:0 0 0 1px rgba(255,255,255,.08),0 30px 80px rgba(0,0,0,.55);background:#151412}
#cam{position:absolute;left:0;top:0;width:1024px;height:1280px;transform-origin:0 0;transition:transform 1.1s cubic-bezier(.45,.05,.2,1)}
#app{border:0;width:1024px;height:1280px;display:block}
#cursor{position:absolute;left:0;top:0;width:38px;height:38px;z-index:5;pointer-events:none;transition:transform .7s cubic-bezier(.45,.05,.2,1),opacity .3s;opacity:0}
#cursor svg{filter:drop-shadow(0 3px 6px rgba(0,0,0,.5))}
.onda{position:absolute;width:70px;height:70px;margin:-35px 0 0 -35px;border-radius:50%;border:4px solid var(--ac);z-index:4;pointer-events:none;animation:onda .6s ease-out forwards}
@keyframes onda{from{transform:scale(.3);opacity:1}to{transform:scale(1.3);opacity:0}}
#teclas{position:absolute;left:0;right:0;bottom:60px;display:flex;justify-content:center;gap:16px;z-index:6;pointer-events:none}
#teclas kbd{font:600 46px/1 var(--f-inter,system-ui),sans-serif;padding:22px 30px;border-radius:18px;background:#F4F1EA;color:#1A1916;
  box-shadow:0 8px 0 #B9B3A6,0 18px 40px rgba(0,0,0,.5);animation:entra .35s cubic-bezier(.2,.8,.2,1) both}
#teclas span{align-self:center;font-size:44px;font-weight:600;color:#F4F1EA;text-shadow:0 2px 10px rgba(0,0,0,.6)}
#abajo{position:absolute;left:0;bottom:0;width:1080px;height:270px;display:flex;align-items:center;justify-content:center;gap:22px}
#abajo img{height:120px}
#abajo div{font-size:26px;letter-spacing:.2em;text-transform:uppercase;color:var(--suave);font-weight:600;line-height:1.6}
#hoja{position:absolute;left:50%;top:50%;width:760px;margin-left:-380px;transform:translateY(1300px) rotate(4deg);transition:transform 1s cubic-bezier(.2,.8,.2,1);z-index:7;
  box-shadow:0 40px 90px rgba(0,0,0,.6);border-radius:6px;overflow:hidden;background:#fff}
#hoja.ver{transform:translateY(-50%) rotate(-1.5deg)}
#hoja img{display:block;width:100%}
#hoja b{position:absolute;top:24px;right:24px;font:600 26px/1 var(--f-inter,system-ui);background:var(--ac);color:#0E0D0B;padding:12px 18px;border-radius:999px}
.pantalla{position:absolute;inset:0;z-index:20;background:radial-gradient(1200px 900px at 50% 40%,#1D2240 0%,var(--fondo) 62%);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 80px;transition:opacity .8s}
.pantalla img{width:430px}
.pantalla h1{font:500 72px/1.1 var(--f-fraunces,Georgia),serif;margin:60px 0 0;letter-spacing:-.02em}
.pantalla p{font-size:34px;color:var(--suave);margin:26px 0 0;line-height:1.4}
.pantalla .pill{margin-top:70px;font-size:36px;font-weight:600;background:var(--ac);color:#0E0D0B;padding:26px 52px;border-radius:999px}
.oculta{opacity:0;pointer-events:none}
</style></head><body>
<div id="arriba"><div id="marca"><i></i>ADCONTIS · Módulo Contable</div><div id="cap"></div><div id="sub"></div></div>
<div id="ventana"><div id="cam"><iframe id="app" src="/" title="ADCONTIS"></iframe></div>
  <div id="cursor"><svg width="38" height="38" viewBox="0 0 24 24"><path d="M4 2l15 10.5-6.6 1.2 3.9 7.3-3 1.6-3.9-7.4L4 19.6z" fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/></svg></div>
  <div id="teclas"></div></div>
<div id="abajo"><img src="data:image/png;base64,${logoB64}" alt=""></div>
<div id="hoja"><img id="hojaImg" alt=""><b>PDF listo</b></div>
<div class="pantalla" id="intro"><img src="data:image/png;base64,${logoB64}" alt=""><h1>Tu contabilidad, al día y sin enredos</h1><p>Hecho para empresas guatemaltecas</p></div>
<div class="pantalla oculta" id="outro"><img src="data:image/png;base64,${logoB64}" alt=""><h1>Contabilidad, impuestos, planillas, compras y producción</h1><p>En un solo sistema, en la nube</p><div class="pill">Pedí tu demostración</div></div>
</body></html>`
await page.route(BASE+'/',async r=>{ if(r.request().resourceType()!=='document') return r.continue(); const resp=await r.fetch(); const h={...resp.headers()}; delete h['x-frame-options']; r.fulfill({response:resp,headers:h}) })
await page.route(BASE+'/__escenario',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:ESCENARIO}))
await page.setViewportSize({width:1080,height:1920})
await page.goto(BASE+'/__escenario')
const marco=await (await page.waitForSelector('#app')).contentFrame()
await marco.waitForSelector('#app',{state:'visible',timeout:20000})
await marco.waitForTimeout(800)
// fuentes del sistema en el escenario, y sin el aviso flotante de Deshacer
await page.evaluate(()=>{
  const d=document.getElementById('app').contentDocument, st=document.createElement('style'); let css=''
  for(const s of d.styleSheets){ try{ for(const r of s.cssRules) if(r.constructor.name==='CSSFontFaceRule') css+=r.cssText+'\n' }catch(err){} }
  const cs=getComputedStyle(d.body), ff=cs.fontFamily, h1=d.querySelector('h1'), ft=h1?getComputedStyle(h1).fontFamily:''
  st.textContent=css+`:root{--f-inter:${ff};--f-fraunces:${ft}}`; document.head.appendChild(st)
  const s2=d.createElement('style'); s2.textContent='#deshacerFlotante{display:none!important} .aviso.malo{display:none!important}'; d.head.appendChild(s2)
})
await marco.evaluate(()=>{ VISTA='home'; APP_ACTUAL=null; pintar(); scrollTo(0,0) })

/* ---------- utilidades de cámara ---------- */
const W=1024, H=1280
let camZ=1, camX=0, camY=0
const esperar=ms=>page.waitForTimeout(ms)
async function camara(z=1,cx=W/2,cy=H/2,ms=1100){
  camZ=z; camX=Math.min(0,Math.max(W-W*z,W/2-cx*z)); camY=Math.min(0,Math.max(H-H*z,H/2-cy*z))
  await page.evaluate(([x,y,z,ms])=>{ const c=document.getElementById('cam'); c.style.transitionDuration=ms+'ms'; c.style.transform=`translate(${x}px,${y}px) scale(${z})` },[camX,camY,z,ms])
}
async function rect(sel){ try{ return await marco.$eval(sel,el=>{ const r=el.getBoundingClientRect(); return {x:r.left,y:r.top,w:r.width,h:r.height} }) }catch(err){ await page.screenshot({path:SP+'/fallo.png'}).catch(()=>{}); console.log('ESTADO',await marco.evaluate(()=>JSON.stringify({v:VISTA,m:modal.open,a:document.getElementById('aviso').open,t:document.getElementById('avisoCuerpo').textContent.slice(0,200)})).catch(()=>'')); throw err } }
async function enfocar(sel,z,ajY=0){ const r=await rect(sel); await camara(z,r.x+r.w/2,r.y+r.h/2+ajY) }
async function cursorA(sel,dx=0.5,dy=0.5){
  const r=await rect(sel); const x=(r.x+r.w*dx)*camZ+camX, y=(r.y+r.h*dy)*camZ+camY
  await page.evaluate(([x,y])=>{ const c=document.getElementById('cursor'); c.style.opacity=1; c.style.transform=`translate(${x-6}px,${y-4}px)` },[x,y])
  await esperar(520); return {x,y}
}
async function clicar(sel,{dx=0.5,dy=0.5}={}){
  const p=await cursorA(sel,dx,dy)
  await page.evaluate(([x,y])=>{ const o=document.createElement('div'); o.className='onda'; o.style.left=x+'px'; o.style.top=y+'px'; document.getElementById('ventana').appendChild(o); setTimeout(()=>o.remove(),700) },[p.x,p.y])
  await esperar(120); await marco.$eval(sel,el=>el.click()); await esperar(220)
}
async function escribir(sel,txt){
  await marco.$eval(sel,el=>{ el.focus(); el.value=''; el.dispatchEvent(new Event('input',{bubbles:true})) })
  for(const ch of txt){ await marco.$eval(sel,(el,ch)=>{ el.value+=ch; el.dispatchEvent(new Event('input',{bubbles:true})) },ch); await esperar(110) }
}
const ocultarCursor=()=>page.evaluate(()=>{ document.getElementById('cursor').style.opacity=0 })
async function texto(cap,sub=''){
  await page.evaluate(([cap,sub])=>{ for(const [id,t,cl] of [['cap',cap,'entra'],['sub',sub,'entra2']]){ const el=document.getElementById(id); el.classList.remove('entra','entra2'); void el.offsetWidth; el.textContent=t; el.classList.add(cl) } },[cap,sub])
}
async function atajo(n){
  await page.evaluate(n=>{ document.getElementById('teclas').innerHTML=`<kbd>Alt</kbd><span>+</span><kbd>${n}</kbd>` },n)
  await esperar(650)
  await marco.evaluate(n=>document.dispatchEvent(new KeyboardEvent('keydown',{altKey:true,code:'Digit'+n,key:n,bubbles:true})),n)
  await esperar(700); await page.evaluate(()=>{ document.getElementById('teclas').innerHTML='' })
}
const subir=y=>marco.evaluate(y=>{ scrollTo({top:y,behavior:'smooth'}) },y)

/* ---------- grabación (screencast de Chrome) ---------- */
const cdp=await page.context().newCDPSession(page), cuadros=[]
cdp.on('Page.screencastFrame',async f=>{ cuadros.push({t:f.metadata.timestamp,d:f.data}); try{ await cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId}) }catch(err){} })
await cdp.send('Page.startScreencast',{format:'jpeg',quality:92,maxWidth:1080,maxHeight:1920,everyNthFrame:1})
const t0=Date.now(), marca=n=>console.log(`  ${((Date.now()-t0)/1000).toFixed(1)}s  ${n}`)
// animación continua mínima para que siempre haya cuadros
await page.evaluate(()=>{ const p=document.createElement('div'); p.style.cssText='position:absolute;left:0;top:0;width:1px;height:1px;opacity:.01'; document.body.appendChild(p); let i=0; setInterval(()=>{ p.style.transform=`translateX(${(i++)%2}px)` },33) })
