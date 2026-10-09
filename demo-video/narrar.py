import sys, json, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
d=sys.argv[1]; voz=sys.argv[2]; salida=sys.argv[3]
k=Kokoro(d+'/kokoro-v1.0.onnx', d+'/voices-v1.0.bin')
# (inicio, fin disponible, texto)
G=[(0.2,3.3,"ADCONTIS. Tu contabilidad, al día y sin enredos."),
   (3.7,6.6,"Todo tu negocio, en un solo lugar."),
   (7.0,17.2,"Cargá tus facturas electrónicas de la sat, y el sistema arma las partidas por vos."),
   (17.8,25.8,"Libro diario, mayor, compras y ventas, listos en PDF para imprimir."),
   (26.3,29.0,"Y la conciliación te confirma que todo cuadra."),
   (29.4,33.7,"El tablero fiscal calcula el IVA, el I ese erre y el iso, con tus propios libros."),
   (34.0,37.4,"Tus estados financieros, siempre cuadrados."),
   (37.9,47.4,"Controlá tus activos fijos: la depreciación se calcula mes a mes, con los porcentajes de ley."),
   (47.9,59.5,"Generá la planilla con el igss, el I ese erre y la bonificación ya calculados, y registrala en libros con un clic."),
   (60.0,64.5,"Y al liquidar, la indemnización, el aguinaldo y el bono catorce salen solos."),
   (65.0,74.0,"Hacé contratos de trabajo en minutos. Llenás el formulario, y la vista previa se actualiza al instante."),
   (74.5,78.7,"Descargalo en PDF, listo para firmar."),
   (79.2,84.8,"Aprobá las órdenes de compra antes de gastar."),
   (85.3,95.5,"En producción, costeá cada orden con sus materiales, mano de obra y costos indirectos."),
   (96.0,101.9,"Trabajá con varias empresas desde un solo acceso."),
   (102.3,105.6,"Y con atajos de teclado, llegás al toque."),
   (106.0,111.2,"ADCONTIS. Pedí tu demostración hoy.")]
sr=24000; total=np.zeros(int(111.6*sr),dtype=np.float32); info=[]
for ini,fin,t in G:
    vel=1.0
    while True:
        a,sr=k.create(t,voice=voz,speed=vel,lang='es-419')
        if len(a)/sr<=fin-ini or vel>=1.25: break
        vel+=0.05
    i=int(ini*sr); total[i:i+len(a)]+=a[:len(total)-i]; info.append((ini,round(len(a)/sr,2),fin-ini,round(vel,2)))
sf.write(salida,total,sr); print(json.dumps(info))
