import sys, json, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
d=sys.argv[1]; voz=sys.argv[2]; salida=sys.argv[3]
k=Kokoro(d+'/kokoro-v1.0.onnx', d+'/voices-v1.0.bin')
# (inicio, fin disponible, texto)
G=[(0.4,3.3,"ADCONTIS. Tu contabilidad, al día y sin enredos."),
   (3.7,6.7,"Todo tu negocio, en un solo lugar."),
   (7.3,22.8,"Cargá tus facturas electrónicas de la sat, y el sistema arma las partidas contables por vos, directo al libro diario."),
   (23.6,28.7,"El tablero fiscal calcula el IVA, el I ese erre y el iso, con tus propios libros."),
   (29.2,33.1,"Tus estados financieros, siempre cuadrados."),
   (33.7,45.8,"Hacé contratos de trabajo en minutos. Llenás el formulario, y la vista previa se actualiza al instante."),
   (46.3,51.2,"Descargalo en PDF, listo para firmar."),
   (51.7,55.5,"Y con los atajos de teclado, llegás a cada pantalla al toque."),
   (56.2,61.0,"ADCONTIS. Pedí tu demostración hoy.")]
sr=24000; total=np.zeros(int(61.3*sr),dtype=np.float32); info=[]
for ini,fin,t in G:
    vel=1.0
    while True:
        a,sr=k.create(t,voice=voz,speed=vel,lang='es-419')
        if len(a)/sr<=fin-ini or vel>=1.25: break
        vel+=0.05
    i=int(ini*sr); total[i:i+len(a)]+=a[:len(total)-i]; info.append((ini,round(len(a)/sr,2),fin-ini,round(vel,2)))
sf.write(salida,total,sr); print(json.dumps(info))
