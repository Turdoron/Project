(async()=>{
  await window.sbListo;
  let guardado=null;
  try{ guardado=localStorage.getItem('contagt_panel'); }catch(err){}
  /* En pantalla grande el panel arranca visible; en la chica, oculto. */
  alternarPanel(guardado!==null ? guardado==='1' : innerWidth>820);
  aplicarEscala(escalaActual(),false);
  window.sb.auth.onAuthStateChange(ev=>{
    if(ev==='SIGNED_OUT' && BD.sesion){ BD=VACIO(); pantallaLogin('Tu sesión terminó. Iniciá sesión de nuevo.'); }
  });
  /* getSession() espera a que Supabase termine de leer el enlace de la URL (si viene del correo de recuperación);
     solo después se sabe si hay que pedir una contraseña nueva. */
  const {data:{session}}=await window.sb.auth.getSession();
  if(window.__recuperando){ BD=VACIO(); pantallaCambioClave({nombre:'Recuperación de contraseña'}); return; }
  if(!session){ pantallaLogin(); return; }
  await iniciarSesionApp();
})();
