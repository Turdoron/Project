/* ============ RESPALDOS DIARIOS EN LA NUBE ============ */
/* La base guarda sola, por empresa, cómo estaba al empezar cada día en que se modificó (30 días) y una copia
   si se elimina (supabase/migrations/0006_respaldos_diarios.sql). Acá se listan y se restauran. Restaurar
   reemplaza los datos de la empresa por los de esa copia; se puede deshacer con «Deshacer» mientras no se
   cierre la sesión, y la copia del día de hoy sigue guardada en la base. */
const faltaTablaRespaldos=err=>/empresas_respaldos|does not exist|PGRST205|42P01/i.test((err&&(err.message||err.code))||'');
async function listarRespaldos(empresaId){
  const r=await window.sb.from('empresas_respaldos').select('dia,creado,nombre,version,eliminada').eq('empresa_id',empresaId).order('dia',{ascending:false}).order('creado',{ascending:false});
  if(r.error) throw r.error;
  return r.data||[];
}
ACCIONES.verRespaldos=async()=>{
  const e=emp(); if(!e){avisar('Elegí una empresa primero.');return}
  if(!window.sb){avisar('Los respaldos diarios están en la nube: necesitás conexión.');return}
  let lista;
  try{ lista=await listarRespaldos(e.id); }
  catch(err){ avisar(faltaTablaRespaldos(err)
      ?'Los respaldos diarios todavía no están activados en la base de datos. Hay que ejecutar una sola vez el archivo supabase/migrations/0006_respaldos_diarios.sql en Supabase → SQL Editor.'
      :'No se pudieron leer los respaldos: '+msgError(err.message||String(err)),'Respaldos diarios'); return; }
  abrirModal(`Respaldos diarios — ${esc(e.nombre)}`,
    `<p style="margin:0 0 12px;font-size:13px;color:var(--tinta-suave)">Cada día en que se modificó la empresa, la nube guardó sola cómo estaba <strong>al empezar ese día</strong>. Se conservan 30 días. Restaurar reemplaza todos los datos de la empresa por los de esa copia.</p>
    ${lista.length?`<table style="font-size:13px"><thead><tr><th>Copia</th><th>Guardada</th><th class="num"></th></tr></thead><tbody>
      ${lista.map((r,i)=>`<tr><td>${r.eliminada?`Al eliminarla el ${fFecha(r.dia)}`:`Al empezar el ${fFecha(r.dia)}`}</td><td>${new Date(r.creado).toLocaleString('es-GT',{dateStyle:'short',timeStyle:'short'})}</td>
        <td class="num"><button type="button" class="btn mini sec" data-restaurar="${i}">Restaurar</button></td></tr>`).join('')}</tbody></table>`
      :'<div class="vacio">Todavía no hay copias: se guarda la primera la próxima vez que se modifique la empresa en otro día.</div>'}`,
    ()=>{},'Cerrar');
  mForm.querySelectorAll('[data-restaurar]').forEach(b=>b.onclick=()=>{
    const r=lista[+b.dataset.restaurar];
    confirmar(`Se reemplazarán TODOS los datos de ${e.nombre} por la copia de ${r.eliminada?'cuando se eliminó, el':'al empezar el'} ${fFecha(r.dia)}. Lo registrado después de esa copia se pierde (podés deshacerlo con «Deshacer» mientras no cierres la sesión).`,async()=>{
      const q=await window.sb.from('empresas_respaldos').select('datos,nombre').eq('empresa_id',e.id).eq('dia',r.dia).eq('eliminada',r.eliminada).single();
      if(q.error){avisar('No se pudo leer esa copia: '+msgError(q.error.message));return}
      conSnapshot(`Restaurar respaldo del ${fFecha(r.dia)}`,()=>{
        const i=BD.empresas.findIndex(x=>x.id===e.id); if(i<0) return;
        BD.empresas[i]={...q.data.datos,id:e.id,nombre:q.data.nombre||e.nombre,administradorId:e.administradorId};
        registrarLog('Restauró un respaldo diario',`${e.nombre} — copia del ${fFecha(r.dia)}`);
        guardar(); cerrarModal(); pintar();
      });
      avisar(`Listo: ${e.nombre} quedó como estaba ${r.eliminada?'al eliminarla':'al empezar'} el ${fFecha(r.dia)}.`,'Respaldo restaurado');
    },'Restaurar');
  });
};
