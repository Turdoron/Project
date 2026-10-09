import sys, json, numpy as np, soundfile as sf, librosa, torch
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
# python narrar_chatterbox.py salida.wav [voz_referencia.wav]  (referencia opcional: 10 s de una voz latinoamericana)
salida=sys.argv[1]; ref=sys.argv[2] if len(sys.argv)>2 else None
m=ChatterboxMultilingualTTS.from_pretrained(device="cpu")
G=[(0.2,3.3,"ADCONTIS. Tu contabilidad, al día y sin enredos."),
   (3.7,6.7,"Todo tu negocio, en un solo lugar."),
   (7.3,22.8,"Cargá tus facturas electrónicas de la sat, y el sistema arma las partidas contables por vos, directo al libro diario."),
   (23.6,28.7,"El tablero fiscal calcula el IVA, el I ese erre y el iso, con tus propios libros."),
   (29.2,33.1,"Tus estados financieros, siempre cuadrados."),
   (33.7,45.8,"Hacé contratos de trabajo en minutos. Llenás el formulario, y la vista previa se actualiza al instante."),
   (46.3,51.2,"Descargalo en PDF, listo para firmar."),
   (51.7,55.5,"Y con los atajos de teclado, llegás a cada pantalla al toque."),
   (56.2,61.0,"ADCONTIS. Pedí tu demostración hoy.")]
sr=m.sr; total=np.zeros(int(61.3*sr),dtype=np.float32); info=[]; libre=0.0
for k,(ini,fin,t) in enumerate(G):
    mejor=None
    for intento in range(3):  # varias tomas; se queda con la más corta que entre (o la más corta)
        torch.manual_seed(1000*k+intento)
        a=m.generate(t,language_id="es",audio_prompt_path=ref,exaggeration=0.55,cfg_weight=0.4,temperature=0.75).squeeze(0).numpy()
        a,_=librosa.effects.trim(a,top_db=35)
        if mejor is None or len(a)<len(mejor): mejor=a
        if len(a)/sr<=fin-ini: break
    a=mejor; r=1.0
    if len(a)/sr>fin-ini:  # acelera como máximo 15 % para respetar el tiempo
        r=min(1.15,len(a)/sr/(fin-ini)); a=librosa.effects.time_stretch(a,rate=r)
    ini=max(ini,libre+0.2); i=int(ini*sr); a=a[:len(total)-i]; total[i:i+len(a)]+=a; libre=ini+len(a)/sr
    info.append((round(ini,2),round(len(a)/sr,2),round(fin-ini,2),round(r,2)))
sf.write(salida,total,sr); print(json.dumps(info))
