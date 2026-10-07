/* ============ DESHACER ============ */
/* Un solo nivel de historial, no una pila completa — "deshacer la última
   acción", tal como se pidió. Se guarda solo en memoria, no en el respaldo:
   si recargás la página se pierde, como es de esperar de un deshacer normal,
   y evita que el archivo de respaldo cargue con datos que ya no sirven.
   El snapshot se toma justo ANTES de que la acción de verdad cambie algo —
   no cuando se abre un modal, sino cuando se confirma —, porque muchas
   acciones en este sistema solo mutan datos en el callback de confirmación,
   no en el momento en que se hace clic en el botón que las dispara. */
let snapshotDeshacer=null, etiquetaDeshacer='';
function tomarSnapshotDeshacer(etiqueta){
  const e=emp();
  if(!e) return;
  try{ snapshotDeshacer={empId:e.id,datos:JSON.parse(JSON.stringify(e)),t:Date.now()}; etiquetaDeshacer=etiqueta||'la última acción'; }
  catch(err){ snapshotDeshacer=null; }
}
/* Corrección: antes CUALQUIER clic (incluso "Ver" o "PDF") pisaba la copia
   del deshacer, y se perdía la posibilidad de deshacer un borrado. Ahora la
   copia se toma antes de la acción pero solo se guarda si la acción de verdad
   cambió algo en la empresa. */
let saltarSnapshot=false;
async function conSnapshot(etiqueta,fn){
  const e=emp(), id=e&&e.id;
  let antes=null;
  try{ antes=e?JSON.stringify(e):null; }catch(err){}
  const r=await fn();
  if(saltarSnapshot){ saltarSnapshot=false; return r; }
  const despues=id&&BD.empresas.find(x=>x.id===id);
  if(antes&&despues){
    let cambio=false;
    try{ cambio=JSON.stringify(despues)!==antes; }catch(err){}
    if(cambio){
      snapshotDeshacer={empId:id,datos:JSON.parse(antes),t:Date.now()}; etiquetaDeshacer=etiqueta||'la última acción';
      if(!document.getElementById('modal').open) pintar();
    }
  }
  return r;
}

