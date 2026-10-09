import sys, numpy as np, soundfile as sf
sr=44100; dur=61.3; n=int(dur*sr); t=np.arange(n)/sr
bpm=96; beat=60/bpm; bar=beat*4
def nota(m): return 440*2**((m-69)/12)
prog=[[60,64,67,71],[57,60,64,67],[53,57,60,64],[55,59,62,67]]  # Cmaj7 Am7 Fmaj7 G
out=np.zeros(n)
# colchón suave
for b in range(int(dur/bar)+1):
    ch=prog[b%4]; s=int(b*bar*sr); e=min(n,int((b+1)*bar*sr)); tt=np.arange(e-s)/sr
    env=np.minimum(1,tt/0.6)*np.minimum(1,(bar-tt)/0.6)
    for m in ch:
        f=nota(m-12); out[s:e]+=0.05*env*(np.sin(2*np.pi*f*tt)+0.3*np.sin(2*np.pi*2*f*tt+0.5))
    f=nota(ch[0]-24); out[s:e]+=0.07*env*np.sin(2*np.pi*f*tt)
# arpegio tipo marimba en corcheas
for k in range(int(dur/(beat/2))):
    b=int(k*(beat/2)/bar); ch=prog[b%4]; m=ch[[0,1,2,3,2,1,0,2][k%8]]+12
    s=int(k*beat/2*sr); L=int(0.5*sr); e=min(n,s+L); tt=np.arange(e-s)/sr; f=nota(m)
    out[s:e]+=0.045*np.exp(-tt*7)*(np.sin(2*np.pi*f*tt)+0.25*np.sin(2*np.pi*3*f*tt))
# pulso suave
for k in range(int(dur/beat)):
    s=int(k*beat*sr); L=int(0.12*sr); e=min(n,s+L); tt=np.arange(e-s)/sr
    out[s:e]+=0.05*np.exp(-tt*35)*np.sin(2*np.pi*(90-200*tt)*tt)
fade=np.minimum(1,t/1.5)*np.minimum(1,(dur-t)/2.5)
out*=fade; out/=np.max(np.abs(out))*1.05
sf.write(sys.argv[1],out.astype(np.float32),sr)
