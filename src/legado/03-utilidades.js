/* ============ UTILIDADES ============ */
const uid=()=>crypto.randomUUID();
const Q=n=>(n||0).toLocaleString('es-GT',{minimumFractionDigits:2,maximumFractionDigits:2});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* Fecha LOCAL (Guatemala, UTC−6). toISOString() devuelve la fecha en UTC, que
   después de las 18:00 ya es "mañana" — por eso no se usa. */
const fechaLocal=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const hoy=()=>fechaLocal(new Date());
/* Rango completo del mes anterior a hoy, calculado sobre el texto de la fecha
   (sin setMonth, que se desborda los días 29, 30 y 31). */
function mesAnteriorRango(){
  let [a,m]=hoy().split('-').map(Number);
  m--; if(m===0){m=12;a--;}
  const mm=String(m).padStart(2,'0');
  return {desde:`${a}-${mm}-01`,hasta:`${a}-${mm}-${String(new Date(a,m,0).getDate()).padStart(2,'0')}`};
}
/* Para el campo "Fecha de pago" de los cierres: si hoy cae dentro del
   ejercicio que se está trabajando, usar hoy es lo correcto — es trabajo del
   día a día. Pero si se está cerrando un ejercicio PASADO en una fecha
   posterior (trabajo atrasado, algo muy común), poner la fecha real de hoy
   dejaría la partida fuera del rango que el Diario muestra por default para
   ese ejercicio — el usuario ve que "se creó la partida" pero después no la
   encuentra en ningún lado. En ese caso, el fin del ejercicio es un default
   mucho más razonable. */
const fechaPagoDefault=e=>hoy().slice(0,4)===String(e.ejercicio)?hoy():`${e.ejercicio}-12-31`;
const fFecha=f=>f?f.split('-').reverse().join('/'):'';
const r2=n=>Math.round((n+Number.EPSILON)*100)/100;

