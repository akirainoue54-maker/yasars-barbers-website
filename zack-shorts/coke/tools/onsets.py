"""Refine word onsets from the audio itself (energy attack after a dip), using the ASR times only to pick WHICH rise belongs to which word.
Writes build/onsets.json: [{w, asr, onset, how}] in untrimmed audio time."""
import json, numpy as np, soundfile as sf
words = json.load(open("words.json"))
a, sr = sf.read("build/vo16.wav"); hop = int(sr * 0.005); n = len(a) // hop
x = a[: n * hop].reshape(n, hop); x2 = np.concatenate([x[:-1], x[1:]], 1) if n > 1 else x
db = 20 * np.log10(np.sqrt((x2 ** 2).mean(1)) + 1e-9)             # 10 ms RMS, 5 ms hop
rise = np.array([db[min(k + 3, len(db) - 1)] - db[k] for k in range(len(db))])   # dB gained over 15 ms
before = np.array([db[max(0, k - 8):k + 1].min() for k in range(len(db))])        # quietest point in the 40 ms before
PAUSE_FIRST = {24: 7.236, 46: 13.771, 58: 18.196, 78: 24.836, 94: 29.556}   # untrimmed, from ffmpeg silencedetect (-38 dB)
# Hand-checked fixes (envelope + 3.5-7.5 kHz band inspected): the true onset is earlier than the energy/ASR estimate.
#  52 "surface": the /s/ hiss starts ~110 ms before the vowel rise; 76 "constantly": /k/ burst after a deep dip; 100 "with": the vowel right after rinse's /s/.
OVERRIDE = {52: 15.995, 76: 23.360, 100: 31.440}
cands = []
for k in range(2, len(db) - 4):
    if rise[k] >= 6.0 and rise[k] == rise[max(0, k - 4):k + 5].max() and db[k + 3] - before[k] >= 8.0:
        cands.append((k * 0.005, float(rise[k])))
cands.sort()
out = []; prev = -1.0; fb = 0
for i, w in enumerate(words):
    t0 = w["start"]
    if i in OVERRIDE:
        t = OVERRIDE[i]; out.append({"w": w["w"], "asr": round(t0, 3), "onset": round(t, 3), "how": "override", "d_ms": round((t - t0) * 1000)}); prev = t; continue
    if i in PAUSE_FIRST:                                   # first word after a measured pause: the silence end is exact
        t, how = PAUSE_FIRST[i] - 0.012, "pause"; out.append({"w": w["w"], "asr": round(t0, 3), "onset": round(t, 3), "how": how, "d_ms": round((t - t0) * 1000)}); prev = t; continue
    win = [(t, r) for t, r in cands if t0 - 0.13 <= t <= t0 + 0.12 and t > prev + 0.06]
    if win:
        t, r = min(win, key=lambda c: (abs(c[0] - t0) - 0.002 * min(c[1], 40)))   # nearest to the ASR time, stronger rise wins ties
        how = "energy"
    else:   # shallow dip between words: the deepest valley near the ASR time, then the attack starts just after it
        vs = [k for k in range(max(1, int((t0 - 0.10) / 0.005)), min(len(db) - 14, int((t0 + 0.10) / 0.005)))
              if db[k] <= db[k - 1] and db[k] <= db[k + 1] and db[k + 3:k + 13].max() - db[k] >= 2.5 and k * 0.005 > prev + 0.06]
        if vs:
            k = min(vs, key=lambda k: (abs(k * 0.005 - t0) - 0.01 * (db[k + 3:k + 13].max() - db[k]))); t, how = k * 0.005 + 0.015, "valley"
        else:
            t, how = max(t0, prev + 0.07), "asr"; fb += 1
    out.append({"w": w["w"], "asr": round(t0, 3), "onset": round(t, 3), "how": how, "d_ms": round((t - t0) * 1000)}); prev = t
json.dump(out, open("build/onsets.json", "w"), indent=1)
d = np.array([o["d_ms"] for o in out if o["how"] in ("energy", "valley")])
from collections import Counter; print(Counter(o["how"] for o in out))
print(f"words {len(out)}: refined from audio {len(d)}, ASR fallback {fb}; onset - ASR (ms): median {np.median(d):.0f}, p10 {np.percentile(d,10):.0f}, p90 {np.percentile(d,90):.0f}, min {d.min()}, max {d.max()}")
print("fallbacks:", [(i, o["w"]) for i, o in enumerate(out) if o["how"] == "asr"])
