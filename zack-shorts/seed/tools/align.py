"""Word timestamps for the voiceover with Parakeet TDT (sherpa-onnx), matched to script.txt."""
import json, re, sys, difflib
import numpy as np, soundfile as sf, sherpa_onnx

M = "models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8/"
rec = sherpa_onnx.OfflineRecognizer.from_transducer(
    encoder=M + "encoder.int8.onnx", decoder=M + "decoder.int8.onnx",
    joiner=M + "joiner.int8.onnx", tokens=M + "tokens.txt",
    model_type="nemo_transducer", num_threads=4)
audio, sr = sf.read("build/vo16.wav", dtype="float32")
s = rec.create_stream(); s.accept_waveform(sr, audio); rec.decode_stream(s)
r = s.result
toks, ts = list(r.tokens), list(r.timestamps)
durs = list(getattr(r, "durations", []) or [])
print(r.text)
# group BPE tokens into words (tokens starting with ▁ or space begin a word)
words = []
for i, (tk, t) in enumerate(zip(toks, ts)):
    d = durs[i] if i < len(durs) else 0.08
    if tk.startswith("▁") or tk.startswith(" ") or not words:
        words.append({"w": tk.lstrip("▁ "), "start": t, "end": t + d})
    else:
        words[-1]["w"] += tk; words[-1]["end"] = t + d
json.dump(words, open("build/asr_words.json", "w"), indent=1)
norm = lambda w: re.sub(r"[^a-z0-9']", "", w.lower().replace("’", "'"))
script = open("script.txt").read().split()
a = [norm(w["w"]) for w in words]; b = [norm(w) for w in script]
sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
out = [None] * len(script)
for tag, i1, i2, j1, j2 in sm.get_opcodes():
    if tag == "equal":
        for k in range(i2 - i1): out[j1 + k] = dict(words[i1 + k])
    else:
        print("DIFF", tag, a[i1:i2], b[j1:j2])
        if i2 > i1 and j2 > j1:  # spread the ASR span over the script words
            t0, t1 = words[i1]["start"], words[i2 - 1]["end"]
            n = j2 - j1
            for k in range(n):
                out[j1 + k] = {"start": t0 + (t1 - t0) * k / n, "end": t0 + (t1 - t0) * (k + 1) / n}
for k, w in enumerate(script):
    out[k] = out[k] or {}
    out[k]["w"] = w
json.dump(out, open("words.json", "w"), indent=1)
missing = [k for k, o in enumerate(out) if "start" not in o]
print("words", len(script), "missing", missing)
for k in range(1, len(out)):
    if "start" in out[k] and "end" in out[k-1]:
        g = out[k]["start"] - out[k-1]["end"]
        if g >= 0.25: print(f"gap {g:.2f}s after '{out[k-1]['w']}' at {out[k-1]['end']:.2f}")
