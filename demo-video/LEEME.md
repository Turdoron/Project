# Video demostrativo de ADCONTIS (redes sociales)

Material para el video vertical de 1 minuto (1080×1920). No es parte del sistema.

- `video-sin-sonido.mp4`: el video ya grabado, sin audio (61 s).
- Grabación: `base.mjs` + `datos.mjs` + `escena.mjs` + `guion.mjs` se concatenan en un solo
  script de Playwright (`cat base.mjs datos.mjs escena.mjs guion.mjs > video.mjs`) y se corre con
  `BASE=http://localhost:4195 SP=<carpeta> node video.mjs`, con el sistema compilado (`npm run build`,
  `npx next start -p 4195`) desde la rama `claude/sharp-thompson-npjar1` (tiene los accesos directos que
  salen en el video). `base.mjs` espera jsPDF local en `<SP>/jspdfpkg/node_modules` (`npm i jspdf jspdf-autotable`).
  La salida queda en `<SP>/video/`.
- Audio:
  - `musica.py`: música de fondo sintetizada (sin derechos), 61.3 s → `python musica.py musica.wav`.
  - `narrar_piper.py`: narración con voces Piper (`python narrar_piper.py modelo.onnx salida.wav`).
  - `narrar.py`: narración con Kokoro (descartada: sonaba artificial).
  - Los tiempos de cada frase están en la lista `G` de los scripts de narración (inicio, fin disponible, texto).

## Mezcla (voz + música sobre el video)

```
ffmpeg -i video-sin-sonido.mp4 -i voz.wav -i musica.wav -filter_complex "[1:a]aresample=44100,loudnorm=I=-15:TP=-1.5:LRA=7,asplit=2[vz1][vz2];[2:a]volume=0.16[mu];[mu][vz1]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[md];[md][vz2]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.9[au]" -map 0:v -map "[au]" -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart final.mp4
```

## Pendiente

El cliente pidió una voz más natural. Kokoro y Piper sonaron artificiales. Con `huggingface.co`
habilitado en la red del entorno, probar **Chatterbox Multilingual** (ResembleAI, licencia MIT, apto
para publicidad) en español con el mismo guion y tiempos, y mezclar como arriba.
