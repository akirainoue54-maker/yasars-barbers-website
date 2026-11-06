"""Per-0.5 s brightness trim so the ENCODED file lands at YAVG ~90 (hook seconds ~94), robust to flash frames (median).
usage: grade2.py in.mp4 out.mp4"""
import re, subprocess, sys, numpy as np
inp, outp = sys.argv[1], sys.argv[2]
subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", inp, "-vf", "signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=build/y_in.txt", "-an", "-f", "null", "-"], check=True)
v = np.array([float(x) for x in re.findall(r"YAVG=([0-9.]+)", open("build/y_in.txt").read())])
n = len(v); end = n / 30.0; K = 333.0                       # eq brightness units -> YAVG (measured)
step = 0.5; nb = int(np.ceil(end / step)); tc, raw = [], []
for i in range(nb):
    a, b = int(i * step * 30), min(n, int((i + 1) * step * 30)); tc.append((i + 0.5) * step); raw.append(np.median(v[a:b]))
tc, raw = np.array(tc), np.array(raw)
tgt = np.array([94 if t < 1.0 else 94 + (90 - 94) * (t - 1.0) if t < 2.0 else 94 if t > end - 1.2 else 90 for t in tc])
bv = (tgt - raw) / K
bv = np.convolve(np.pad(bv, 1, mode="edge"), np.ones(3) / 3, "valid")   # light smoothing
# brightness(t) = b0 + sum of clipped ramps between window centres
expr = f"{bv[0]:.5f}"
for i in range(1, nb):
    d = bv[i] - bv[i - 1]
    if abs(d) > 1e-5: expr += f"+({d:.5f})*clip((t-{tc[i-1]:.3f})/{step},0,1)"
open("build/grade_expr.txt", "w").write(expr)
vf = f"eq=brightness='{expr}':contrast=1.0:eval=frame"
subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", inp, "-vf", vf, "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-r", "30", "-an", outp], check=True)
print("raw median per 0.5 s:", " ".join(f"{x:.0f}" for x in raw))
print("trim (YAVG units):   ", " ".join(f"{b*K:+.0f}" for b in bv))
