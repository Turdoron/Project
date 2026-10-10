/* ============ CARGA DE FACTURAS ============ */
let lote=[], leyendo=false;
const soloNit=s=>String(s||'').replace(/[^0-9kK]/g,'').toUpperCase();

/* Cuentas sugeridas por categoría del reporte de la Agencia Virtual. */
const MAPEO_BASE={
  'Combustibles':'6.1.06',
  'No genera Credito Fiscal':'6.2.14',
  'No genera Crédito Fiscal':'6.2.14',
  'Otras Compras':'5.1.02',
  'Servicios Adquiridos':'6.2.24',
  'Notas de Credito':'5.1.03',
};

/* Asigna base, IVA y tipo según el régimen de la empresa que lleva la contabilidad. */
/* Si el documento viene de XML, se sabe con certeza por línea (BienOServicio real
   de la SAT, no una suposición). Se compara el valor de las líneas de bien contra
   las de servicio y gana la mayoría. Sin detalle de líneas (Excel), no hay cómo
   saberlo desde el documento mismo y se devuelve null. */
function bsDelDocumento(d){
  if(!d.items || !d.items.length) return null;
  const totalB=d.items.filter(it=>it.bs==='B').reduce((s,it)=>s+(it.total||0),0);
  const totalS=d.items.filter(it=>it.bs==='S').reduce((s,it)=>s+(it.total||0),0);
  if(!totalB && !totalS) return null;
  return totalB>=totalS ? 'B' : 'S';
}

function clasificar(d){
  const e=emp(), nitEmp=soloNit(e.nit);
  e.mapeoNit=e.mapeoNit||{}; e.mapeoCat=e.mapeoCat||{}; e.mapeoBS=e.mapeoBS||{};
  /* Factura especial: la EMITE la propia empresa (comprador) a nombre del
     vendedor. Para tratarla como compra, la contraparte es el receptor. */
  if(d.tipoDte==='FESP' && nitEmp && d.nitEmisor===nitEmp && d.nitReceptor!==nitEmp && !d.fespInvertida){
    [d.nitEmisor,d.nitReceptor]=[d.nitReceptor,d.nitEmisor];
    [d.emisor,d.receptor]=[d.receptor,d.emisor];
    d.fespInvertida=true; d.tipo='compra'; d.tipoFijo=true;
  }
  /* Si el usuario declaró de qué es el archivo, esa decisión manda sobre el NIT. */
  if(!d.tipoFijo){
    d.tipo = nitEmp&&d.nitReceptor===nitEmp ? 'compra'
           : nitEmp&&d.nitEmisor===nitEmp ? 'venta'
           : (d.tipo||'compra');
  }
  const nitOtro = d.tipo==='compra'?d.nitEmisor:d.nitReceptor;

  /* Bien o servicio se decide ANTES que la cuenta, porque ahora la cuenta depende
     de esto: una compra de bienes debe cargarse a Inventarios (Ley de Comercio,
     libro de inventarios), no a Compras/gasto directo. Orden de prioridad: el
     detalle real del XML, luego lo aprendido por proveedor, y si no hay ninguna
     pista, se asume bien (es lo más común en una compra). */
  if(!d.bs) d.bs = bsDelDocumento(d) || e.mapeoBS[nitOtro] || 'B';

  /* El régimen que decide si hay crédito fiscal es el que regía EN LA FECHA
     del documento, no el de hoy — si la empresa cambió de régimen, un
     documento viejo se clasifica con las reglas de cuando ocurrió, nunca
     con las de ahora. */
  const regimenDoc = regimenEn(e,d.fecha);
  const conCredito = regimenDoc==='general'||regimenDoc==='simplificado';
  const sinCredito = (d.categoria&&/no genera cr[ée]dito/i.test(d.categoria)) || d.pequeno;
  /* El IDP y los demás impuestos específicos no pagan IVA y no son acreditables:
     forman parte del costo, pero se separan para poder verlos. */
  const especificos=r2((d.idp||0)+(d.otrosImp||0));
  if(conCredito && !sinCredito){
    /* Si el reporte trae la columna de IVA, manda ese dato aunque venga en cero
       (exentos, pequeño contribuyente). Solo se calcula cuando no hay dato. */
    if(!d.ivaReportado) d.iva = r2(d.total - d.total/1.12);
    d.noAcred = d.tipo==='compra' ? especificos : 0;
    d.base = r2(d.total - d.iva - d.noAcred);
  }else{
    d.iva=0; d.noAcred=0; d.base=d.total;   // sin derecho a crédito fiscal: todo es costo
  }
  if(!d.cta){
    d.cta = e.mapeoNit[nitOtro]
         || e.mapeoCat[d.categoria]
         || MAPEO_BASE[(d.categoria||'').trim()]
         || (d.tipo==='compra'
              ? (d.signo===-1 && d.bs==='B' ? '5.1.03'   // nota de crédito de bienes: rebaja el costo de compras, no la mercadería en existencia
                 : d.bs==='B' ? '1.1.08' : '5.1.02')     // bien -> Inventarios; servicio -> Compras
              : '4.1.01');
  }
  if(!e.cuentas.some(c=>c.c===d.cta&&c.d))
    d.cta = d.tipo==='compra'
      ? (d.signo===-1 && d.bs==='B' ? '5.1.03' : d.bs==='B'?'1.1.08':'5.1.02')
      : '4.1.01';
  /* Si la cuenta resuelta —aunque sea por un proveedor ya aprendido— es
     Gastos no deducibles, el IVA de esa compra tampoco es acreditable, pero
     eso no significa que haya que fundirlo con el gasto: se separa igual
     que cualquier factura normal, y en generarPartidas() va a su propia
     cuenta (6.2.27, "IVA no deducible"), para que el Estado de Resultados y
     el formulario de IVA lo puedan identificar aparte. Esto reemplaza lo
     que hizo sinCredito más arriba si la razón de no acreditar fue otra
     (por ejemplo, régimen Pequeño), porque acá la razón específica es que
     el gasto en sí no es deducible, no que la empresa no participe del IVA. */
  if(d.cta==='6.2.14'){
    if(!d.ivaReportado) d.iva=r2(d.total-d.total/1.12);
    d.noAcred=0; d.base=r2(d.total-d.iva);
  }
  /* Cambiaria = operación al crédito: va a cuentas por pagar o por cobrar.
     El resto se asume de contado. */
  if(!d.ctaPago){
    d.ctaPago = d.alCredito
      ? (d.tipo==='compra' ? '2.1.01' : '1.1.04')
      : '1.1.01';
  }
  if(d.noAcred && !d.ctaIdp){
    asegurarCuenta(e,'6.1.07','Impuesto a la distribución de petróleo (IDP)','gasto');
    d.ctaIdp='6.1.07';
  }
  return d;
}
/* Las empresas creadas antes de que existiera una cuenta no la tienen en su catálogo. */
function asegurarCuenta(e,c,n,t){
  if(e.cuentas.some(x=>x.c===c)) return;
  e.cuentas.push({c,n,t,d:true});
  e.cuentas.sort((a,b)=>a.c.localeCompare(b.c,undefined,{numeric:true}));
  guardar();
}

/* ---- Reporte de DTE de la Agencia Virtual (.xls / .xlsx) ----
   El archivo no trae encabezados: las columnas se leen por posición.
   Las filas con una sola celda son el nombre de la categoría. */
const COL={fecha:0,auth:1,tipoDte:2,serie:3,dte:4,nitEmisor:8,emisor:9,
  nitReceptor:12,receptor:13,estado:16,moneda:17,total:18,iva:19,
  petroleo:22,otrosDesde:23,otrosHasta:32};

async function cargarSheetJs(){
  if(window.XLSX) return window.XLSX;
  await new Promise((ok,mal)=>{
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload=ok; s.onerror=()=>mal(new Error('no se pudo cargar el lector de Excel'));
    document.head.appendChild(s);
  });
  return window.XLSX;
}
const TIPOS_DTE=['FACT','FCAM','FPEQ','FCAP','NCRE','NDEB','NABN','RDON','FESP','FACA'];
/* El receptor puede venir como CF (consumidor final) en vez de NIT. */
const nitDoc=v=>{
  const s=String(v??'').trim().toUpperCase();
  if(!s||s==='NAN'||s==='CF'||s==='C/F'||s==='CONSUMIDOR FINAL') return 'CF';
  return s.replace(/\.0+$/,'').replace(/[^0-9K]/g,'') || 'CF';
};

/* ---- Lector de DTE en XML (el mismo documento que certifica el certificador) ----
   Estructura verificada contra archivos reales de la SAT (namespace dte 0.2.0):
   dte:GTDocumento > dte:SAT > dte:DTE > dte:DatosEmision >
     dte:DatosGenerales@Tipo,@FechaHoraEmision
     dte:Emisor@NITEmisor,@NombreEmisor  (+ dte:DireccionEmisor/dte:Direccion)
     dte:Receptor@IDReceptor,@NombreReceptor
     dte:Items/dte:Item@BienOServicio  (Cantidad, Descripcion, PrecioUnitario, Impuestos, Total)
     dte:Totales/dte:TotalImpuestos/dte:TotalImpuesto@NombreCorto,@TotalMontoImpuesto ; dte:GranTotal
   dte:Certificacion/dte:NumeroAutorizacion@Numero,@Serie
   Complemento de factura cambiaria (cfc:): cfc:Abono con fecha de vencimiento por cuota,
   dato que el Excel de la Agencia Virtual no trae. */
function leerXmlDTE(texto,archivo){
  let doc;
  try{ doc=new DOMParser().parseFromString(texto,'application/xml'); }
  catch(e){ return {archivo,estado:'revisar',aviso:'XML inválido',total:0}; }
  if(doc.querySelector('parsererror')) return {archivo,estado:'revisar',aviso:'XML inválido',total:0};

  const porNS=(tag)=>{
    const x=doc.getElementsByTagNameNS('*',tag);
    return x.length?x[0]:null;
  };
  const gen=porNS('DatosGenerales'), emi=porNS('Emisor'), rec=porNS('Receptor'),
        certif=porNS('NumeroAutorizacion'), totales=porNS('Totales');
  if(!gen||!emi||!rec) return {archivo,estado:'revisar',aviso:'No es un DTE reconocible',total:0};

  const tipoDte=(gen.getAttribute('Tipo')||'').toUpperCase();
  const nitEmisor=soloNit(emi.getAttribute('NITEmisor'));
  const nitReceptor=nitDoc(rec.getAttribute('IDReceptor'));

  // items: detalle de bienes o servicios, con su propio bien/servicio y monto de IVA
  const items=[...doc.getElementsByTagNameNS('*','Item')].map(it=>{
    const txt=(tag)=>{ const n=it.getElementsByTagNameNS('*',tag)[0]; return n?n.textContent:''; };
    const impuestos=[...it.getElementsByTagNameNS('*','Impuesto')].map(im=>({
      nombre:(im.getElementsByTagNameNS('*','NombreCorto')[0]||{}).textContent||'',
      monto:+((im.getElementsByTagNameNS('*','MontoImpuesto')[0]||{}).textContent||0)
    }));
    return {
      bs: it.getAttribute('BienOServicio')||'B',
      cantidad:+txt('Cantidad')||0, descripcion:txt('Descripcion'),
      precioUnitario:+txt('PrecioUnitario')||0, total:+txt('Total')||0,
      impuestos
    };
  });
  // total por nombre de impuesto: IVA aparte, cualquier otro (IDP u otros específicos) se suma aparte
  // sin necesidad de conocer su nombre exacto de antemano.
  let iva=0, otros=0;
  (totales?[...totales.getElementsByTagNameNS('*','TotalImpuesto')]:[]).forEach(ti=>{
    const nom=(ti.getAttribute('NombreCorto')||'').toUpperCase();
    const monto=+(ti.getAttribute('TotalMontoImpuesto')||0);
    if(nom==='IVA') iva=r2(iva+monto); else otros=r2(otros+monto);
  });
  const granTotal=totales?+((totales.getElementsByTagNameNS('*','GranTotal')[0]||{}).textContent||0):0;

  // vencimientos de factura cambiaria (complemento cfc), si existen
  const vencimientos=[...doc.getElementsByTagNameNS('*','Abono')].map(a=>({
    numero:+((a.getElementsByTagNameNS('*','NumeroAbono')[0]||{}).textContent||0),
    fecha:(a.getElementsByTagNameNS('*','FechaVencimiento')[0]||{}).textContent||'',
    monto:+((a.getElementsByTagNameNS('*','MontoAbono')[0]||{}).textContent||0)
  }));

  return {
    archivo, estado:'ok', tipoDte,
    fecha:(gen.getAttribute('FechaHoraEmision')||'').slice(0,10),
    nitEmisor, emisor:emi.getAttribute('NombreEmisor')||'',
    nitReceptor, receptor:rec.getAttribute('NombreReceptor')||'',
    serie:certif?certif.getAttribute('Serie')||'':'', dte:certif?certif.getAttribute('Numero')||'':'',
    total:r2(granTotal), iva:r2(iva), otrosImp:r2(otros), ivaReportado:true,
    idp:0,   // los impuestos específicos (IDP u otros) quedan en "otrosImp", ver arriba
    /* Una nota de crédito reduce lo que se le debe al proveedor, así que
       tiene que entrar a la Cartera igual que una factura cambiaria — si no,
       nunca resta del saldo y hay que compensarla con una partida aparte a mano. */
    alCredito: tipoDte==='FCAM' || tipoDte==='FCAP' || tipoDte==='NCRE', pequeno: tipoDte==='FPEQ' || tipoDte==='FCAP',
    signo: tipoDte==='NCRE' ? -1 : 1,
    items, vencimientos
  };
}

async function cargarJsZip(){
  if(window.JSZip) return window.JSZip;
  await new Promise((ok,mal)=>{
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload=ok; s.onerror=()=>mal(new Error('no se pudo cargar el lector de ZIP'));
    document.head.appendChild(s);
  });
  return window.JSZip;
}

function leerReporteSAT(filas,archivo,tipoArchivo){
  const docs=[]; let categoria='', anuladas=0, saltadas=0;
  filas.forEach(f=>{
    const llenas=f.filter(v=>v!==null&&v!==undefined&&String(v).trim()!=='');
    if(llenas.length===0) return;
    if(llenas.length===1 && String(f[0]||'').trim()){ categoria=String(f[0]).replace(/\s*\(.*$/,'').trim(); return; }
    const tipoDte=String(f[COL.tipoDte]||'').trim().toUpperCase();
    if(!TIPOS_DTE.includes(tipoDte)){ saltadas++; return; }
    const estado=String(f[COL.estado]||'').trim();
    if(/anulad/i.test(estado)){ anuladas++; return; }
    const entero=v=>String(v??'').replace(/\.0+$/,'').replace(/[^0-9Kk]/g,'').toUpperCase();
    const d={
      archivo, categoria, estado:'ok', tipoDte,
      fecha:String(f[COL.fecha]||'').slice(0,10),
      serie:String(f[COL.serie]||'').trim(),
      dte:entero(f[COL.dte]),
      nitEmisor:entero(f[COL.nitEmisor]), emisor:String(f[COL.emisor]||'').trim(),
      nitReceptor:nitDoc(f[COL.nitReceptor]), receptor:String(f[COL.receptor]||'').trim(),
      moneda:String(f[COL.moneda]||'GTQ').trim(),
      total:r2(+f[COL.total]||0), iva:r2(+f[COL.iva]||0), ivaReportado:true,
      idp:r2(+f[COL.petroleo]||0),
      otrosImp:r2(Array.from({length:COL.otrosHasta-COL.otrosDesde+1},
        (_,k)=>+f[COL.otrosDesde+k]||0).reduce((s,v)=>s+v,0)),
      alCredito: tipoDte==='FCAM' || tipoDte==='FCAP' || tipoDte==='NCRE',
      signo: tipoDte==='NCRE' ? -1 : 1,
      pequeno: tipoDte==='FPEQ' || tipoDte==='FCAP',
    };
    if(!d.total) return;
    d.tipo=tipoArchivo; d.tipoFijo=true;
    docs.push(clasificar(d));
  });
  return {docs,anuladas,saltadas};
}

/* Validación y mensaje final, compartidos entre Excel, XML suelto y ZIP de XML. */
function finalizarCarga(docs,anuladas,tipoArchivo,prog){
  if(!docs.length){
    avisar('No se encontraron documentos legibles en el archivo.\n\nRevisá que sea la consulta de DTE de la Agencia Virtual, o un XML/ZIP de DTE certificados.');
    if(prog) prog.textContent=''; return;
  }
  const e=emp(), nitEmp=soloNit(e.nit);
  let contradicen=0, ajenos=0;
  if(nitEmp) docs.filter(d=>d.tipoDte!=='FESP').forEach(d=>{   // la factura especial ya se acomodó como compra en clasificar()
    const propio = tipoArchivo==='compra' ? d.nitReceptor : d.nitEmisor;
    const otro   = tipoArchivo==='compra' ? d.nitEmisor   : d.nitReceptor;
    if(propio!==nitEmp) (otro===nitEmp ? contradicen++ : ajenos++);
  });
  if(contradicen===docs.length && docs.length){
    if(prog) prog.textContent='';
    avisar(`Dijiste que el archivo es de ${tipoArchivo==='compra'?'compras':'ventas'}, pero en los ${docs.length} documentos el NIT ${nitEmp} aparece del lado contrario.\n\nEse archivo parece ser de ${tipoArchivo==='compra'?'ventas':'compras'}. No se cargó nada.`,'El archivo no coincide');
    return;
  }
  lote=lote.concat(docs);
  pintar();
  let msg=`Se cargaron ${docs.length} documentos como ${tipoArchivo==='compra'?'compras':'ventas'}.`;
  if(anuladas) msg+=`\n\nSe omitieron ${anuladas} documentos anulados.`;
  if(contradicen) msg+=`\n\n${contradicen} tienen el NIT del lado contrario: revisalos uno por uno.`;
  if(ajenos) msg+=`\n\n${ajenos} no mencionan el NIT ${nitEmp} por ningún lado.`;
  if(!nitEmp) msg+=`\n\nLa empresa no tiene NIT registrado, así que no pude verificar nada. Agregalo.`;
  avisar(msg,'Reporte cargado');
}

/* Extrae, de un Excel de la Agencia Virtual, solo el conjunto de documentos
   marcados como anulados (clave serie-numero), para usarlo como filtro sobre
   el XML/ZIP: el XML del documento no dice si está anulado, esa información
   únicamente vive en el estado que reporta este Excel. */
function clavesAnuladasDelExcel(filas){
  const claves=new Set();
  const TIPOS_DTE_LOCAL=['FACT','FCAM','FPEQ','FCAP','NCRE','NDEB','NABN','RDON','FESP','FACA'];
  filas.forEach(f=>{
    const tipoDte=String(f[2]||'').trim().toUpperCase();
    if(!TIPOS_DTE_LOCAL.includes(tipoDte)) return;
    if(!/anulad/i.test(String(f[16]||''))) return;
    const serie=String(f[3]||'').trim();
    const dte=String(f[4]??'').replace(/\.0+$/,'');
    claves.add(serie+'-'+dte);
  });
  return claves;
}

ACCIONES.leerReporte=async()=>{
  const archivos=[...(document.getElementById('reporte').files||[])];
  const tipoArchivo=(document.getElementById('tipoArchivo')||{}).value||'compra';
  if(!archivos.length){avisar('Elegí el archivo que bajaste de la Agencia Virtual.');return}
  const prog=document.getElementById('progreso');

  const extDe=f=>(f.name.split('.').pop()||'').toLowerCase();
  const excelFile = archivos.find(f=>['xls','xlsx'].includes(extDe(f)));
  const zipFile    = archivos.find(f=>extDe(f)==='zip');
  const xmlFiles    = archivos.filter(f=>extDe(f)==='xml');
  const soloExcelSinZipNiXml = excelFile && !zipFile && !xmlFiles.length;

  /* Si además del ZIP/XML se seleccionó un Excel, se usa solo para saber cuáles
     documentos están anulados — el resto del Excel se ignora en ese caso. */
  let anuladasRef=null;
  if(excelFile && (zipFile || xmlFiles.length)){
    try{
      const XL=await cargarSheetJs();
      const wb=XL.read(await excelFile.arrayBuffer(),{type:'array'});
      const filas=XL.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true,defval:null});
      anuladasRef=clavesAnuladasDelExcel(filas);
    }catch(err){
      avisar('No se pudo leer el Excel para cruzar las anuladas: '+err.message+'\n\nSe sigue cargando el XML/ZIP, pero sin ese filtro.');
    }
  }
  const claveDoc=d=>(d.serie||'')+'-'+(d.dte||'');

  if(soloExcelSinZipNiXml){
    prog.textContent='Leyendo el reporte...';
    try{
      const XL=await cargarSheetJs();
      const wb=XL.read(await excelFile.arrayBuffer(),{type:'array'});
      const filas=XL.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true,defval:null});
      const {docs,anuladas}=leerReporteSAT(filas,excelFile.name,tipoArchivo);
      finalizarCarga(docs,anuladas,tipoArchivo,prog);
    }catch(err){
      prog.textContent='';
      avisar('No se pudo leer el reporte: '+err.message+'\n\nEl lector se descarga de internet la primera vez, así que necesitás conexión.');
    }
    return;
  }

  if(zipFile){
    prog.textContent='Descomprimiendo...';
    try{
      const JSZip=await cargarJsZip();
      const zip=await JSZip.loadAsync(await zipFile.arrayBuffer());
      const nombres=Object.keys(zip.files).filter(n=>!zip.files[n].dir && n.toLowerCase().endsWith('.xml'));
      if(!nombres.length){ prog.textContent=''; avisar('El ZIP no trae ningún archivo .xml adentro.'); return; }
      const docs=[]; let malos=0, anuladasOmitidas=0;
      for(let i=0;i<nombres.length;i++){
        prog.textContent=`Leyendo ${i+1} de ${nombres.length}...`;
        try{
          const texto=await zip.files[nombres[i]].async('text');
          const d=leerXmlDTE(texto,nombres[i]);
          if(d.estado!=='ok'){ malos++; continue; }
          if(anuladasRef && anuladasRef.has(claveDoc(d))){ anuladasOmitidas++; continue; }
          d.tipo=tipoArchivo; d.tipoFijo=true; d.sinVerificarAnulacion=!anuladasRef; docs.push(clasificar(d));
        }catch(e){ malos++; }
      }
      let avisoExtra='';
      if(malos) avisoExtra+=`${malos} archivo(s) del ZIP no se pudieron leer y se omitieron.\n\n`;
      if(anuladasOmitidas) avisoExtra+=`${anuladasOmitidas} documento(s) estaban anulados según el Excel y se excluyeron.\n\n`;
      if(!anuladasRef) avisoExtra+='No se cargó un Excel de referencia junto al ZIP, así que no se pudo verificar si alguno de estos documentos está anulado — el XML por sí solo no lo dice. Revisá los totales.\n\n';
      if(avisoExtra) avisar(avisoExtra.trim(),'Aviso');
      finalizarCarga(docs,anuladasOmitidas,tipoArchivo,prog);
    }catch(err){
      prog.textContent='';
      avisar('No se pudo leer el ZIP: '+err.message+'\n\nEl lector se descarga de internet la primera vez, así que necesitás conexión.');
    }
    return;
  }

  if(xmlFiles.length){
    prog.textContent='Leyendo el XML...';
    try{
      const docs=[]; let malos=0, anuladasOmitidas=0;
      for(let i=0;i<xmlFiles.length;i++){
        const texto=await xmlFiles[i].text();
        const d=leerXmlDTE(texto,xmlFiles[i].name);
        if(d.estado!=='ok'){ malos++; continue; }
        if(anuladasRef && anuladasRef.has(claveDoc(d))){ anuladasOmitidas++; continue; }
        d.tipo=tipoArchivo; d.tipoFijo=true; d.sinVerificarAnulacion=!anuladasRef; docs.push(clasificar(d));
      }
      let avisoExtra='';
      if(malos) avisoExtra+=`${malos} archivo(s) no se pudieron leer.\n\n`;
      if(anuladasOmitidas) avisoExtra+=`${anuladasOmitidas} documento(s) estaban anulados según el Excel y se excluyeron.\n\n`;
      if(!anuladasRef && !soloExcelSinZipNiXml) avisoExtra+='No se cargó un Excel de referencia, así que no se pudo verificar anulaciones — el XML por sí solo no lo dice.\n\n';
      if(avisoExtra) avisar(avisoExtra.trim(),'Aviso');
      finalizarCarga(docs,anuladasOmitidas,tipoArchivo,prog);
    }catch(err){
      prog.textContent='';
      avisar('No se pudo leer el XML: '+err.message);
    }
    return;
  }

  avisar('No se reconoció ningún archivo de Excel, XML o ZIP entre lo que elegiste.');
};

/* ---- Recuerda la cuenta elegida para no repetir la clasificación cada mes ---- */
function recordarCuenta(d){
  const e=emp();
  e.mapeoNit=e.mapeoNit||{}; e.mapeoCat=e.mapeoCat||{};
  const nit=d.tipo==='compra'?d.nitEmisor:d.nitReceptor;
  /* "Gastos no deducibles" es una decisión por factura, no por proveedor —
     recordarla como el default de todo el NIT haría que la próxima factura
     de este mismo proveedor, que puede ser perfectamente deducible, caiga
     ahí solo por venir del mismo emisor. Para esta cuenta específica, mejor
     no recordar nada y dejar que cada factura se revise por su cuenta. */
  if(nit && d.cta!=='6.2.14') e.mapeoNit[nit]=d.cta;
  if(d.categoria && !MAPEO_BASE[d.categoria] && d.cta!=='6.2.14') e.mapeoCat[d.categoria]=d.cta;
  guardar();
}

/* Detalle de línea de un documento, solo disponible para lo cargado desde XML/ZIP
   (el Excel de la Agencia Virtual no trae producto por producto). */
function popoverProductos(d){
  const filas=d.items.map(it=>`<tr>
      <td class="num" style="text-align:left">${it.cantidad?Q(it.cantidad).replace(/\.00$/,''):''}</td>
      <td>${esc(it.descripcion)}${it.bs==='S'?' <span style="color:var(--tinta-suave)">(servicio)</span>':''}</td>
      <td class="num">${Q(it.total)}</td>
    </tr>`).join('');
  return `<strong style="display:block;margin-bottom:4px;color:var(--verde)">
      ${esc((d.tipo==='compra'?d.emisor:d.receptor)||'')}</strong>
    <table style="width:100%;font-size:11.5px"><thead><tr>
      <th style="text-align:left">Cant.</th><th style="text-align:left">Producto o servicio</th>
      <th class="num">Total</th></tr></thead><tbody>${filas}</tbody></table>`;
}

VISTAS.facturas=()=>{
  const e=emp();
  const ops=(sel,filtro)=>e.cuentas.filter(c=>c.d&&filtro(c))
    .map(x=>`<option value="${x.c}"${x.c===sel?' selected':''}>${x.c} — ${esc(x.n)}</option>`).join('');
  const ctasGasto=c=>['costo','gasto','activo','ingreso'].includes(c.t);
  const ctasPago=c=>['activo','pasivo'].includes(c.t);

  const filas=lote.map((d,i)=>`<tr${d.sel?' style="background:var(--activo)"':''}${d.anuladaManual?' class="fila-anulada"':''}>
    <td style="text-align:center"><input type="checkbox" data-sel="${i}"${d.sel?' checked':''}
      style="width:auto;margin:0" aria-label="Seleccionar documento"></td>
    <td style="text-align:center"><input type="checkbox" data-anular="${i}"${d.anuladaManual?' checked':''}
      style="width:auto;margin:0" aria-label="Marcar como anulada, se excluye de los totales"></td>
    <td style="font-size:13px">
      ${d.items&&d.items.length? `<span class="detalle-hover">${esc(d.fecha||'—')}
        <span class="popover-items">${popoverProductos(d)}</span></span>`
       : esc(d.fecha||'—')}<br>
      <span style="color:var(--tinta-suave)">${esc(d.tipoDte||'FACT')} ${esc(d.serie||'')}${d.dte?'-'+esc(d.dte):''}</span>
      ${d.anuladaManual?'<br><span style="font-size:12px;color:var(--alerta);font-weight:600">marcada como anulada</span>':''}
      ${d.alCredito?'<br><span style="font-size:12px;color:var(--verde);font-weight:600">cambiaria · al crédito</span>':''}
      ${d.signo===-1?'<br><span class="h" style="font-size:12px">nota de crédito, resta</span>':''}
      ${d.signo===-1 && d.tipo==='compra' && d.bs==='B' ? `<br><span style="font-size:12px;color:var(--alerta);font-weight:600">
        ¿La mercadería volvió de verdad, o es una rebaja/descuento? Revisá la cuenta →</span>` : ''}
      ${d.tipo==='venta'? `<br><span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--tinta-suave)">
        ${regimenEn(emp(),d.fecha)==='pequeno'?'Te retuvieron el 5%:':'Te retuvieron ISR:'} <input type="number" min="0" step="0.01" data-retencion="${i}"
          value="${d.retencionISR||''}" placeholder="0.00" style="width:72px;padding:2px 4px;font-size:12px"></span>`:''}
      ${d.tipo==='venta'&&['general','simplificado'].includes(regimenEn(emp(),d.fecha))? `<br><span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--tinta-suave)">
        Te retuvieron IVA: <input type="number" min="0" step="0.01" data-retencioniva="${i}"
          value="${d.retencionIVA||''}" placeholder="0.00" style="width:72px;padding:2px 4px;font-size:12px"></span>`:''}
      ${(()=>{const r=regimenEn(emp(),d.fecha);
        if(r==='pequeno') return '<br><span style="font-size:12px;color:var(--tinta-suave)">Pequeño Contribuyente — sin IVA, 5% sobre el total</span>';
        if(r==='primario'||r==='pecuario') return '<br><span style="font-size:12px;color:var(--tinta-suave)">'+esc(REGIMENES[r])+' — sin IVA, 1.5% sobre el total</span>';
        return '';})()}</td>
    <td style="font-size:13px">${esc((d.tipo==='compra'?d.emisor:d.receptor)||'—')}<br>
      <span style="color:var(--tinta-suave)">NIT ${esc(d.tipo==='compra'?d.nitEmisor:d.nitReceptor)}</span>
      ${d.categoria?`<br><span style="color:var(--tinta-suave)">${esc(d.categoria)}</span>`:''}</td>
    <td><select data-f="${i}" data-campo="bs">
      <option value="B"${d.bs==='B'?' selected':''}>Bien</option>
      <option value="S"${d.bs==='S'?' selected':''}>Servicio</option></select></td>
    <td><select data-f="${i}" data-campo="cta">${ops(d.cta,ctasGasto)}</select></td>
    <td><select data-f="${i}" data-campo="ctaPago">${ops(d.ctaPago,ctasPago)}</select></td>
    ${htmlCeldaOC(e,d,i)}
    <td class="num">${Q(d.base)}</td>
    <td class="num">${d.noAcred?Q(d.noAcred):'—'}</td>
    <td class="num">${d.iva?Q(d.iva):'—'}</td>
    <td class="num"><strong>${Q(d.total)}</strong></td>
    <td class="num"><button class="btn mini peligro" data-accion="quitarFactura" data-i="${i}">Quitar</button></td>
  </tr>`).join('');

  const activos=lote.filter(d=>!d.anuladaManual);
  const tot=activos.reduce((s,d)=>s+d.total,0);
  const totIva=activos.reduce((s,d)=>s+d.iva,0);
  const malas=lote.filter(d=>d.estado!=='ok').length;
  const sel=lote.filter(d=>d.sel).length;
  const anuladasMarcadas=lote.filter(d=>d.anuladaManual).length;

  return cab('Cargar facturas','Se leen los documentos, los revisás en pantalla y hasta entonces se generan las partidas.')
  + `<div class="tarjeta">
      <h3 style="margin-bottom:6px">Cargar desde la Agencia Virtual</h3>
      <p style="margin:0 0 14px;font-size:14px;color:var(--tinta-suave)">
        El Excel de la consulta de DTE trae cientos de documentos de un golpe, ya
        clasificados por categoría y con el IVA calculado — la vía más rápida para un mes
        completo. El XML de un DTE certificado (suelto o en ZIP) trae menos volumen pero
        más detalle: el producto o servicio línea por línea, y en las facturas cambiarias,
        la fecha de vencimiento de cada abono.</p>

      <div class="campo" style="margin-bottom:14px">
        <label>Este archivo es de</label>
        <div class="segmentado" id="segTipo">
          <button type="button" class="seg-op on" data-accion="elegirTipoArchivo" data-val="compra">
            Compras<span>documentos recibidos</span></button>
          <button type="button" class="seg-op" data-accion="elegirTipoArchivo" data-val="venta">
            Ventas<span>documentos emitidos</span></button>
        </div>
        <input type="hidden" id="tipoArchivo" value="compra">
      </div>

      <div class="campo full" style="margin-bottom:12px">
        <label>Archivo</label>
        <label class="dropzone" for="reporte" id="dropzoneLabel">
          <strong>Elegí el archivo o arrastralo aquí</strong>
          <span id="dropzoneTexto">Excel (.xls, .xlsx) o XML/ZIP de la SAT (.xml, .zip) — podés
            elegir los dos juntos: si cargás el ZIP y el Excel del mismo período a la vez,
            el sistema usa el Excel para saber cuáles están anuladas y las excluye del XML.</span>
        </label>
        <input type="file" id="reporte" accept=".xls,.xlsx,.xml,.zip" multiple
          style="width:1px;height:1px;opacity:0;overflow:hidden;position:fixed;top:-100px">
      </div>
      <button class="btn" data-accion="leerReporte">Cargar reporte</button>
    </div>
    <div class="tarjeta">
      <h3 style="margin-bottom:6px">Cuentas recordadas</h3>
      <p style="margin:0 0 10px;font-size:14px;color:var(--tinta-suave)">
        Cada vez que asignás una cuenta a un proveedor o cliente, el sistema la recuerda y la aplica sola
        la próxima vez. Ahora hay ${Object.keys(e.mapeoNit||{}).length} recordadas.</p>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        ${lote.length?`<button class="btn sec" data-accion="limpiarLote">Vaciar la lista</button>`:''}
        ${Object.keys(e.mapeoNit||{}).length?`<button class="btn sec" data-accion="olvidarCuentas">Olvidar las cuentas recordadas</button>`:''}
        <span id="progreso" style="font-size:14px;color:var(--tinta-suave)"></span>
      </div>
    </div>`
  + (lote.length? `
    <div class="cifras">
      <div class="cifra"><span>Documentos</span><strong>${lote.length}${anuladasMarcadas?` (${activos.length} activos)`:''}</strong></div>
      <div class="cifra"><span>Total facturado</span><strong>${Q(tot)}</strong></div>
      <div class="cifra"><span>IVA</span><strong>${Q(totIva)}</strong></div>
      ${lote.some(d=>d.noAcred)?`<div class="cifra"><span>IDP y otros específicos</span><strong>${Q(lote.reduce((s,d)=>s+(d.anuladaManual?0:(d.noAcred||0)),0))}</strong></div>`:''}
      ${lote.filter(d=>d.alCredito).length?`<div class="cifra"><span>Al crédito (FCAM)</span><strong>${lote.filter(d=>d.alCredito).length}</strong></div>`:''}
    </div>
    ${lote.filter(d=>d.alCredito).length?`<div class="aviso">Las facturas cambiarias se asignaron automáticamente a
      ${lote.some(d=>d.tipo==='compra')?'<strong>Proveedores</strong>':''}${lote.some(d=>d.tipo==='compra')&&lote.some(d=>d.tipo==='venta')?' y ':''}${lote.some(d=>d.tipo==='venta')?'<strong>Clientes</strong>':''}
      por ser operaciones al crédito. El resto quedó contra Caja. Podés cambiar cualquiera en su fila.</div>`:''}
    ${malas?`<div class="aviso malo">${malas} documento${malas===1?'':'s'} no se pudo leer bien. Corregí los datos a mano.</div>`:''}
    ${anuladasMarcadas?`<div class="aviso">${anuladasMarcadas} documento${anuladasMarcadas===1?'':'s'} marcado${anuladasMarcadas===1?'':'s'}
      como anulado${anuladasMarcadas===1?'':'s'} a mano. Quedan tachados en la tabla, no cuentan en los totales de
      arriba y no se van a incluir al generar las partidas.</div>`:''}
    ${lote.some(x=>x.sinVerificarAnulacion)?`<div class="aviso malo">
      ${lote.filter(x=>x.sinVerificarAnulacion).length} documento${lote.filter(x=>x.sinVerificarAnulacion).length===1?'':'s'}
      se cargaron desde XML sin el Excel de referencia, así que no se pudo verificar si alguno está anulado —
      el XML no lleva esa información. Si sabés cuál es, marcalo con la casilla "Anulada" de su fila.
      Si no, revisá el total contra tu Excel antes de generar las partidas, o volvé a cargar
      seleccionando el ZIP y el Excel juntos.</div>`:''}
    <div class="barra" style="margin-bottom:10px">
      <button class="btn sec" data-accion="seleccionarTodo">${
        lote.every(d=>d.sel)&&lote.length ? 'Quitar la selección' : 'Seleccionar todo'}</button>
      <button class="btn peligro" data-accion="borrarSeleccion">Eliminar seleccionados</button>
      <span id="contadorSel" style="font-size:14px;color:var(--tinta-suave)">${
        sel? `${sel} de ${lote.length} seleccionados` : 'Ninguno seleccionado'}</span>
    </div>
    <table><thead><tr><th style="width:32px"></th><th style="width:70px">Anulada</th><th>Fecha y documento</th><th>Contraparte</th><th>B/S</th>
      <th>Cuenta de la operación</th><th>Contrapartida</th><th>Orden de compra</th>
      <th class="num">Base</th><th class="num">IDP</th><th class="num">IVA</th><th class="num">Total</th><th></th></tr></thead>
      <tbody>${filas}</tbody></table>
    <div class="barra" style="margin-top:14px">
      <div class="campo"><label>Cómo generar las partidas</label>
        <select id="modoPartida">
          <option value="dia"${modoPartida==='dia'?' selected':''}>Agrupadas por día</option>
          <option value="mes"${modoPartida==='mes'?' selected':''}>Agrupadas por mes</option>
          <option value="documento"${modoPartida==='documento'?' selected':''}>Una por documento (${lote.length})</option>
        </select></div>
      <button class="btn" data-accion="generarPartidas">Generar partidas</button>
      <span style="font-size:14px;color:var(--tinta-suave);flex:1">
        Las operaciones de un mismo día entran en una sola partida. El detalle documento por documento
        se guarda siempre para los libros de IVA.</span>
    </div>`
   : '');
};

ACCIONES.seleccionarTodo=()=>{
  const todos=lote.length>0 && lote.every(d=>d.sel);
  lote.forEach(d=>d.sel=!todos);
  pintar();
};
ACCIONES.borrarSeleccion=()=>{
  const n=lote.filter(d=>d.sel).length;
  if(!n){avisar('No hay documentos seleccionados. Marcá las casillas de los que querés quitar.');return}
  confirmar(`Se quitarán ${n} documento${n===1?'':'s'} de la lista.\n\nNo se borran de la SAT ni de tus archivos: solo salen de esta carga.`,
    ()=>{lote=lote.filter(d=>!d.sel);pintar()},'Eliminar');
};
ACCIONES.olvidarCuentas=()=>{
  const e=emp();
  confirmar(`Se olvidarán las ${Object.keys(e.mapeoNit||{}).length} cuentas recordadas por proveedor y cliente.\n\nLas partidas ya generadas no se tocan.`,
    ()=>{e.mapeoNit={};e.mapeoCat={};guardar();pintar()},'Olvidar');
};
ACCIONES.quitarFactura=d=>{lote.splice(+d.i,1);pintar()};
ACCIONES.limpiarLote=()=>{
  confirmar(`Se quitarán las ${lote.length} facturas de la lista. Las partidas ya generadas no se tocan.`,
    ()=>{lote=[];pintar()},'Vaciar');
};

let modoPartida='dia';

/* Todos los documentos del período entran en UNA partida. Los montos se acumulan
   por cuenta con signo: positivo va al debe, negativo al haber. Así las compras
   de contado y al crédito del mismo día conviven como renglones distintos. */
function agruparDocs(docs,modo){
  const g={};
  docs.forEach(d=>{
    const f=d.fecha||hoy();
    const per = modo==='dia' ? f : f.slice(0,7)+'-01';
    /* La clave es solo el período: compras y ventas del mismo día caen
       en el mismo grupo, y de ahí a la misma partida. */
    g[per]=g[per]||{fecha:modo==='dia'?f:ultimoDia(f),acum:{},n:0};
    const a=g[per]; a.n++;
    const s=d.signo||1;   // las notas de crédito restan
    const sumar=(cta,v)=>{ if(cta&&v) a.acum[cta]=(a.acum[cta]||0)+v; };
    if(d.tipo==='compra'){
      sumar(d.cta,    s*d.base);
      sumar(d.ctaIdp, s*(d.noAcred||0));
      /* Mismo criterio que en armar(): el IVA de un gasto no deducible no
         es crédito fiscal, va a su propia cuenta de gasto (6.2.27). */
      sumar(d.cta==='6.2.14'?'6.2.27':'1.1.09', s*d.iva);
      /* Factura especial: la empresa retiene el IVA y el ISR al vendedor y
         los entera ella a la SAT — al vendedor se le paga el neto. */
      const rIva=s*r2(d.retIvaFesp||0), rIsr=s*r2(d.retIsrFesp||0);
      sumar(d.ctaPago,-s*d.total+rIva+rIsr);
      if(rIva) sumar('2.1.19',-rIva);
      if(rIsr) sumar('2.1.06',-rIsr);
    }else{
      /* Si el cliente te retuvo impuesto al pagarte, ese monto no llega en
         efectivo — queda como crédito a favor contra tu propio impuesto:
         ISR (1.1.10) o, en Pequeño Contribuyente, el 5% (1.1.17). */
      const retISR=s*r2(d.retencionISR||0), retIVA=s*r2(d.retencionIVA||0);
      sumar(d.ctaPago, s*d.total-retISR-retIVA);
      if(retISR) sumar(ctaRetencionVenta(d), retISR);
      if(retIVA) sumar('1.1.19', retIVA);
      sumar(d.cta,    -s*d.base);
      sumar('2.1.04', -s*d.iva);
    }
  });
  return Object.values(g).sort((a,b)=>a.fecha.localeCompare(b.fecha));
}
function lineasDeGrupo(g){
  return Object.keys(g.acum)
    .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))
    .map(cta=>{ const v=r2(g.acum[cta]); return {cta,desc:'',debe:v>0?v:0,haber:v<0?-v:0}; })
    .filter(l=>l.debe||l.haber);
}
/* Suma un movimiento (debe/haber) a una partida existente, neteando por cuenta.
   Así, varios pagos del mismo día quedan en una sola partida en vez de una por pago. */
function sumarMovimiento(p,cta,debe,haber){
  const acum={};
  p.lineas.forEach(l=>{ acum[l.cta]=(acum[l.cta]||0)+(+l.debe||0)-(+l.haber||0); });
  acum[cta]=(acum[cta]||0)+((debe||0)-(haber||0));
  p.lineas=Object.keys(acum).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))
    .map(c=>{ const v=r2(acum[c]); return {cta:c,desc:'',debe:v>0?v:0,haber:v<0?-v:0}; })
    .filter(l=>l.debe||l.haber);
}
/* Todo lo que pasó en un día —compras, ventas, pagos a proveedores, cobros a
   clientes— cae en la MISMA partida, sin importar de qué pantalla venga. */
function partidaDelDia(e,fecha){
  let p=e.partidas.find(x=>x.fecha===fecha && x.origen==='dia');
  if(!p){
    p={id:uid(),numero:e.correlativo++,fecha,concepto:'',origen:'dia',n:0,
      docTipo:'',docSerie:'',docNum:'',nit:'',contraparte:'',lineas:[]};
    e.partidas.push(p);
  }
  return p;
}
function actualizarConceptoDia(p){
  p.concepto=`Operaciones del ${fFecha(p.fecha)} — ${p.n} operaci${p.n===1?'ón':'ones'}`;
}
function ultimoDia(f){
  const [a,m]=f.split('-'); return `${a}-${m}-${new Date(+a,+m,0).getDate()}`;
}

/* Encuentra, entre las facturas de venta del lote, qué descripciones de
   producto todavía no se sabe a qué producto del inventario corresponden —
   ni porque el texto coincide exacto con uno ya conocido, ni porque ya se
   vinculó antes (e.mapeoProducto). Una sola por descripción, aunque
   aparezca en varias facturas del mismo lote. */
function itemsVentaSinMapear(e,activos){
  const {lista}=inventarioDetalle(e);
  const nombresConocidos=new Set(lista.map(p=>p.producto));
  /* Las compras del MISMO lote todavía no están en e.documentos —recién se
     guardan cuando se confirma la generación—, así que inventarioDetalle()
     todavía no las ve. Sin esto, una venta con el mismo nombre exacto que
     una compra que se está cargando junto pedía vincular igual, como si el
     producto fuera desconocido. */
  activos.filter(d=>d.tipo==='compra'&&d.items&&d.items.length).forEach(d=>{
    d.items.filter(it=>it.bs==='B'&&it.descripcion).forEach(it=>{ nombresConocidos.add(it.descripcion.trim()); nombresConocidos.add(productoDe(e,it.descripcion)); });
  });
  const vistos=new Set(), pendientes=[];
  activos.filter(d=>d.tipo==='venta'&&d.items&&d.items.length).forEach(d=>{
    d.items.filter(it=>it.bs==='B').forEach(it=>{
      const desc=(it.descripcion||'').trim();
      if(!desc||vistos.has(desc)) return;
      vistos.add(desc);
      if((e.mapeoProducto||{})[desc]||nombresConocidos.has(desc)) return;
      pendientes.push(desc);
    });
  });
  return pendientes;
}
ACCIONES.generarPartidas=()=>{
  const e=emp();
  const modo=(document.getElementById('modoPartida')||{}).value||'dia';
  modoPartida=modo;
  const activos=lote.filter(d=>!d.anuladaManual);
  const excluidas=lote.length-activos.length;
  if(!activos.length){avisar('Todos los documentos están marcados como anulados. No hay nada que generar.');return}
  const sinCuenta=activos.filter(d=>!d.cta||!d.ctaPago||!d.total);
  if(sinCuenta.length){avisar(`${sinCuenta.length} documento(s) no tienen cuenta o monto. Completalos antes de generar.`);return}

  const pendientes=itemsVentaSinMapear(e,activos);
  if(pendientes.length){
    const {lista}=inventarioDetalle(e);
    const nombresLista=new Set(lista.map(p=>p.producto));
    const nombresLote=new Set();
    activos.filter(x=>x.tipo==='compra'&&x.items&&x.items.length).forEach(x=>
      x.items.filter(it=>it.bs==='B'&&it.descripcion).forEach(it=>nombresLote.add(productoDe(e,it.descripcion))));
    /* Las opciones del desplegable tienen que incluir también los productos
       de las compras del MISMO lote que se está por procesar — todavía no
       están en e.documentos, así que inventarioDetalle() por sí solo no
       los ve, pero igual son productos válidos a los que vincular una
       venta. */
    const todosLosProductos=[...nombresLista,...[...nombresLote].filter(n=>!nombresLista.has(n))].sort();
    const opsProd=todosLosProductos.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');
    abrirModal('Vincular productos de venta',
      `<p style="margin:0 0 14px;font-size:13px;color:var(--tinta-suave)">Estas ${pendientes.length} descripción(es)
        de las facturas de venta no coinciden con ningún producto que ya tengas en el inventario. Decí a cuál
        corresponde cada una — se acuerda de tu elección, así que la próxima vez que aparezca esta misma
        descripción ya la va a reconocer sola. Si alguna no es un producto físico (un servicio, un flete, algo que
        no debería descontar inventario), dejala en "Omitir".</p>
      <div class="rej">${pendientes.map((desc,i)=>`
        <div class="campo full"><label>${esc(desc)}</label>
          <select name="producto_${i}"><option value="">— Omitir, no es un producto de inventario —</option>${opsProd}</select>
        </div>`).join('')}</div>`,
      d=>{
        e.mapeoProducto=e.mapeoProducto||{};
        pendientes.forEach((desc,i)=>{ if(d['producto_'+i]) e.mapeoProducto[desc]=d['producto_'+i]; });
        guardar();
        continuarGenerarPartidas(e,activos,excluidas,modo);
      },'Vincular y continuar');
    return;
  }
  continuarGenerarPartidas(e,activos,excluidas,modo);
};
/* Cuenta donde queda lo que el cliente retuvo al pagarte. */
const ctaRetencionVenta=d=>regimenEn(emp(),d.fecha)==='pequeno'?'1.1.17':'1.1.10';
/* Factura especial (FESP): quien compra emite el documento y retiene el IVA
   completo y el ISR (5% sobre la base) al vendedor; los entera él a la SAT. */
function prepararRetencionesFesp(d){
  if(d.tipo==='compra'&&d.tipoDte==='FESP'){
    d.retIvaFesp=r2(d.iva||0);
    d.retIsrFesp=r2((d.base||0)*0.05);
  }else{ d.retIvaFesp=0; d.retIsrFesp=0; }
}
function continuarGenerarPartidas(e,activos,excluidas,modo){
  activos.forEach(prepararRetencionesFesp);
  if(activos.some(d=>d.retIvaFesp)) asegurarCuenta(e,'2.1.19','IVA retenido por pagar (facturas especiales)','pasivo');
  if(activos.some(d=>d.tipo==='venta'&&d.retencionIVA)) asegurarCuenta(e,'1.1.19','IVA retenido por clientes (constancias por aplicar)','activo');
  if(activos.some(d=>d.tipo==='venta'&&d.retencionISR&&ctaRetencionVenta(d)==='1.1.17'))
    asegurarCuenta(e,'1.1.17','Retenciones del 5% sufridas (Pequeño Contribuyente)','activo');
  const grupos = modo==='documento' ? null : agruparDocs(activos,modo);
  const cuantas = grupos ? grupos.length : activos.length;
  const detalle = modo==='documento' ? 'una por cada documento'
    : `${cuantas} partidas consolidadas a partir de ${activos.length} documentos`;

  /* Órdenes de compra vinculadas: tienen que seguir aprobadas y disponibles, y se
     compara lo que se va a facturar contra lo que a cada una le falta. */
  if(activos.some(d=>d.tipo==='compra'&&d.ocId&&!ocVinculable(e,d.ocId))){
    avisar('Una de las órdenes de compra vinculadas ya no está aprobada o disponible. Revisá la columna "Orden de compra" y volvé a elegirla.');
    return;
  }
  const vinculos=resumenVinculosOC(e,activos);
  const textoOC=vinculos.length?`\n\nÓrdenes de compra vinculadas:\n${vinculos.map(v=>`• ${v.oc.numero}: Q${Q(v.monto)} de Q${Q(v.rest)} por facturar${v.excede?` — OJO: se pasa por Q${Q(v.dif)}`:v.completa?' — la completa':` — queda por facturar Q${Q(-v.dif)}`}`).join('\n')}`:'';
  confirmar(`Se crearán ${cuantas} partidas en ${e.nombre}, ${detalle}.${excluidas?`\n\nSe excluyen ${excluidas} documento(s) marcados como anulados.`:''}\n\nSe numeran en orden cronológico, de la fecha más antigua a la más reciente.\n\nRevisá que las cuentas asignadas sean las correctas: después hay que corregirlas una por una.${textoOC}`,()=>{
    /* Empresas creadas antes de que existiera esta cuenta no la tienen en su
       propio catálogo, aunque nuevoCatalogo() ya la incluya para las
       nuevas — sin esto, la partida queda apuntando a un código que no
       existe, y en vez del nombre se ve un signo de interrogación. */
    asegurarCuenta(e,'6.2.27','IVA no deducible','gasto');
    e.documentos=e.documentos||[];
    /* El reporte de la SAT viene de la fecha más reciente hacia atrás.
       Se ordena al derecho para que el correlativo siga la cronología. */
    const enOrden=[...activos].sort((a,b)=>
      (a.fecha||'').localeCompare(b.fecha||'') || (a.serie||'').localeCompare(b.serie||''));
    /* El detalle siempre se guarda, aunque el diario vaya resumido. */
    /* Cada documento guardado recuerda en qué partida quedó (partidaId), para
       que al eliminar esa partida se puedan quitar también sus documentos,
       su cartera y sus salidas de inventario. */
    const docGuardado=new Map();
    enOrden.forEach(d=>{
      const g={id:uid(),tipo:d.tipo,tipoDte:d.tipoDte||'FACT',signo:d.signo||1,
      fecha:d.fecha,serie:d.serie,dte:d.dte,categoria:d.categoria||'',
      nit:d.tipo==='compra'?d.nitEmisor:d.nitReceptor,
      nombre:d.tipo==='compra'?d.emisor:d.receptor,
      bs:d.bs||'B',base:r2(d.base),idp:r2(d.noAcred||0),iva:r2(d.iva),total:r2(d.total),
      alCredito:!!d.alCredito,cta:d.cta,ctaPago:d.ctaPago,pequeno:!!d.pequeno,
      vencimiento:(d.vencimientos||[]).map(v=>v.fecha).filter(Boolean).sort().pop()||'',   // último abono de la factura cambiaria
      items:d.items||[],   // detalle de producto por línea, solo disponible desde XML
      retencionISR:r2(d.retencionISR||0),retencionIVA:r2(d.retencionIVA||0),retIvaFesp:r2(d.retIvaFesp||0),retIsrFesp:r2(d.retIsrFesp||0),
      ocId:d.ocId||'',ocNumero:(d.ocId&&buscarOC(e,d.ocId))?buscarOC(e,d.ocId).numero:''};
      e.documentos.push(g); docGuardado.set(d,g);
    });
    const fechaGrupo=d=>{ const f=d.fecha||hoy(); return modo==='dia'?f:ultimoDia(f); };
    const lineasOC=aplicarVinculosOC(e,enOrden);

    const armar=(o,concepto,doc)=>{
      const lineas=[];
      const inv=o.signo===-1;
      const D=(cta,desc,m)=>lineas.push(inv?{cta,desc,debe:0,haber:r2(m)}:{cta,desc,debe:r2(m),haber:0});
      const H=(cta,desc,m)=>lineas.push(inv?{cta,desc,debe:r2(m),haber:0}:{cta,desc,debe:0,haber:r2(m)});
      /* Las líneas no llevan el nombre del proveedor ni del cliente: ese dato
         queda en la cabecera de la partida y en el detalle para los libros de IVA. */
      if(o.tipo==='compra'){
        D(o.cta,'',o.base);
        if(o.noAcred) D(o.ctaIdp,'',o.noAcred);
        /* El IVA de una compra marcada como gasto no deducible tampoco es
           acreditable — no tendría sentido que el gasto no cuente para ISR
           pero su IVA sí contara como crédito fiscal —, así que en vez de
           ir a 1.1.09 (crédito fiscal) va a su propia cuenta de gasto,
           6.2.27, para que se pueda identificar aparte tanto en el Estado
           de Resultados como en el reporte de IVA. */
        if(o.iva) D(o.cta==='6.2.14'?'6.2.27':'1.1.09','',o.iva);
        const rIva=r2(o.retIvaFesp||0), rIsr=r2(o.retIsrFesp||0);
        H(o.ctaPago,'',r2(o.total-rIva-rIsr));
        if(rIva) H('2.1.19','IVA retenido — factura especial',rIva);
        if(rIsr) H('2.1.06','ISR retenido — factura especial',rIsr);
      }else{
        const retISR=r2(o.retencionISR||0), retIVA=r2(o.retencionIVA||0);
        D(o.ctaPago,'',r2(o.total-retISR-retIVA));
        if(retISR) D(ctaRetencionVenta(o),'',retISR);
        if(retIVA) D('1.1.19','IVA retenido por el cliente',retIVA);
        H(o.cta,'',o.base);
        if(o.iva) H('2.1.04','',o.iva);
      }
      const p={id:uid(),numero:e.correlativo++,fecha:o.fecha||hoy(),concepto,
        docTipo:doc.docTipo||'',docSerie:doc.docSerie||'',docNum:doc.docNum||'',
        nit:doc.nit||'',contraparte:doc.nombre||'',lineas};
      e.partidas.push(p);
      return p;
    };

    if(grupos){
      grupos.forEach(g=>{
        const lineas=lineasDeGrupo(g);
        if(lineas.length<2) return;   // si todo se anula, no hay partida que registrar
        const p=partidaDelDia(e,g.fecha);
        lineas.forEach(l=>sumarMovimiento(p,l.cta,l.debe,l.haber));
        p.n=(p.n||0)+g.n;
        enOrden.filter(d=>fechaGrupo(d)===g.fecha).forEach(d=>{ docGuardado.get(d).partidaId=p.id; });
        if(regimenEn(e,g.fecha)==='simplificado'){
          const ventas=ventasDelGrupo(enOrden,g,modo);
          const corte = modo==='dia' ? g.fecha : g.fecha.slice(0,7)+'-01';
          const previo=previoVentasAntesDe(e,corte);
          const isr=isrIncrementalPorTramo(previo,ventas);
          if(isr){
            asegurarCuenta(e,'6.2.15','ISR Régimen Opcional Simplificado','gasto');
            sumarMovimiento(p,'6.2.15',isr>0?isr:0,isr<0?-isr:0);
            sumarMovimiento(p,'2.1.05',isr<0?-isr:0,isr>0?isr:0);
          }
        }
        actualizarConceptoDia(p);
      });
    }else{
      /* En este modo cada documento es su propia partida, pero el tramo del
         5%/7% sigue siendo mensual: se lleva un acumulado del día para no
         recalcular mal cuando hay varios documentos en la misma fecha. */
      let diaISR=null, acumHoyISR=0;
      enOrden.forEach(d=>{
        const ref=`${d.serie?d.serie+'-':''}${d.dte}`;
        const nombreDoc = d.signo===-1?'nota de crédito':(d.tipoDte==='NDEB'?'nota de débito':'factura');
        const nombre = d.tipo==='compra'?d.emisor:d.receptor;
        const p=armar(d,`${d.tipo==='compra'?'Compra según':'Venta según'} ${nombreDoc} ${ref}`,
          {nombre,docTipo:d.tipoDte||'Factura',docSerie:d.serie,docNum:d.dte,
           nit:d.tipo==='compra'?d.nitEmisor:d.nitReceptor});
        docGuardado.get(d).partidaId=p.id;
        if(regimenEn(e,d.fecha)==='simplificado' && d.tipo==='venta'){
          if(d.fecha!==diaISR){ diaISR=d.fecha; acumHoyISR=0; }
          const venta=r2((d.signo||1)*d.base);
          const previo=r2(previoVentasAntesDe(e,d.fecha)+acumHoyISR);
          const isr=isrIncrementalPorTramo(previo,venta);
          acumHoyISR=r2(acumHoyISR+venta);
          if(isr){
            asegurarCuenta(e,'6.2.15','ISR Régimen Opcional Simplificado','gasto');
            p.lineas.push({cta:'6.2.15',desc:'',debe:isr>0?isr:0,haber:isr<0?-isr:0});
            p.lineas.push({cta:'2.1.05',desc:'',debe:isr<0?-isr:0,haber:isr>0?isr:0});
          }
        }
      });
    }
    /* Con las partidas ya generadas, ahora se descuenta el inventario solo,
       para cada ítem de una factura de venta que ya se sepa a qué producto
       corresponde —ya sea porque el texto coincidía exacto con uno
       conocido, o porque se vinculó recién arriba—. Antes esto había que
       hacerlo aparte, a mano, con "Nueva venta directa" por cada factura.
       Se recalcula el inventario disponible después de cada salida, para
       que dos ventas del mismo producto en el mismo lote se descuenten en
       cadena y no las dos contra el mismo disponible inicial. */
    const avisosInventario=[];
    e.salidasInventario=e.salidasInventario||[];
    enOrden.filter(d=>d.tipo==='venta'&&d.items&&d.items.length).forEach(d=>{
      d.items.filter(it=>it.bs==='B').forEach(it=>{
        const desc=(it.descripcion||'').trim();
        if(!desc||!it.cantidad) return;
        const {lista}=inventarioDetalle(e);
        const conocido=lista.find(p=>p.producto===desc);
        const producto=(e.mapeoProducto||{})[desc]||(conocido?desc:'');
        if(!producto) return;   // se dejó en "Omitir" — no es un producto de inventario
        /* Lo que había ESE día (una venta del 20/04 no puede usar lo producido el 30/04). */
        const item=inventarioDetalleAl(e,d.fecha).lista.find(p=>p.producto===producto);
        const disponible=item?item.cantidad:0;
        /* Lo que este cliente ya recibió con una entrega de pedido (Ventas) queda cubierto por esta factura
           y no se descuenta otra vez: solo sale lo que no estaba entregado. */
        const guardado=docGuardado.get(d);
        const cubierto=cubrirConEntregas(e,{id:guardado.id,nit:guardado.nit||d.nit,fecha:d.fecha,serie:d.serie,dte:d.dte},producto,r2((d.signo||1)*it.cantidad));
        const cantidad=r2((d.signo||1)*it.cantidad-cubierto);
        if(!cantidad) return;
        const {costoUnitario,costoTotal}=costoSalidaInventario(e,producto,cantidad,d.fecha);
        if(cantidad>disponible) avisosInventario.push(`${producto}: se vendieron ${cantidad}, pero solo había ${disponible} en existencia (factura ${d.serie?d.serie+'-':''}${d.dte}, ${fFecha(d.fecha)})`);
        e.salidasInventario.push({id:uid(),fecha:d.fecha,producto,cantidad,
          costoUnitario,costoTotal,motivo:'venta',partidaId:docGuardado.get(d).partidaId||'',documentoId:docGuardado.get(d).id});
      });
    });
    const n=activos.length; lote=[]; guardar(); VISTA='partidas'; pintar();
    registrarLog('Generó partidas desde facturas cargadas',`${cuantas} partida(s) a partir de ${n} documentos`);
    avisar(`Se generaron ${cuantas} partidas a partir de ${n} documentos.${excluidas?` Se excluyeron ${excluidas} marcados como anulados.`:''} Revisalas antes de cerrar el mes.${lineasOC.length?`\n\nÓrdenes de compra:\n${lineasOC.join('\n')}`:''}${avisosInventario.length?`\n\nOjo con el inventario:\n${avisosInventario.join('\n')}`:''}`,'Listo');
  },'Generar partidas');
}

