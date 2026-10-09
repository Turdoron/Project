import sys, json, wave, numpy as np, soundfile as sf
from piper import PiperVoice, SynthesisConfig
modelo=sys.argv[1]; salida=sys.argv[2]
v=PiperVoice.load(modelo, config_path=modelo+'.json')
G=[(0.2,3.3,"ADCONTIS. Tu contabilidad, al día y sin enredos."),
   (3.7,6.7,"Todo tu negocio, en un solo lugar."),
   (7.3,22.8,"Cargá tus facturas electrónicas de la sat, y el sistema arma las partidas contables por vos, directo al libro diario."),
   (23.6,28.7,"El tablero fiscal calcula el IVA, el I ese erre y el iso, con tus propios libros."),
   (29.2,33.1,"Tus estados financieros, siempre cuadrados."),
   (33.7,45.8,"Hacé contratos de trabajo en minutos. Llenás el formulario, y la vista previa se actualiza al instante."),
   (46.3,51.2,"Descargalo en PDF, listo para firmar."),
   (51.7,55.5,"Y con los atajos de teclado, llegás a cada pantalla al toque."),
   (56.2,61.0,"ADCONTIS. Pedí tu demostración hoy.")]
sr=v.config.sample_rate; total=np.zeros(int(61.3*sr),dtype=np.float32); info=[]; libre=0.0
for ini,fin,t in G:
    ls=1.05
    while True:
        a=np.concatenate([c.audio_float_array for c in v.synthesize(t,syn_config=SynthesisConfig(length_scale=ls,noise_scale=0.6,noise_w_scale=0.8))])
        if len(a)/sr<=fin-ini or ls<=0.8: break
        ls-=0.05
    ini=max(ini,libre+0.2); i=int(ini*sr); total[i:i+len(a)]+=a[:len(total)-i]; libre=ini+len(a)/sr; info.append((round(ini,2),round(len(a)/sr,2),round(fin-ini,2),round(ls,2)))
sf.write(salida,total,sr); print(json.dumps(info))
