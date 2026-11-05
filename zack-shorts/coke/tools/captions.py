"""Build caption chunks (1-3 words) + word times on the trimmed voice timeline -> engine/data.js"""
import json, re
import numpy as np, soundfile as sf

OFF = 0.095  # seconds trimmed from the start so speech begins at 0.0 (measured onset 0.105 s)
words = json.load(open("words.json"))
a, sr = sf.read("build/vo16.wav")
hop = int(sr * 0.005)
e = np.array([np.sqrt(np.mean(a[i:i + hop * 2] ** 2) + 1e-12) for i in range(0, len(a) - hop * 2, hop)])
db = 20 * np.log10(e)

def refine(t):
    """snap a word onset to the steepest energy rise within +-70 ms of the ASR time"""
    i0, i1 = int((t - 0.07) / 0.005), int((t + 0.07) / 0.005)
    i0 = max(i0, 1); seg = np.diff(db[i0 - 1:i1 + 1])
    k = int(np.argmax(seg)); return (i0 + k) * 0.005

for w in words:
    # Parakeet onsets run ~40-80 ms early; trust the energy snap only when it moves later
    r = refine(w["start"])
    w["s"] = round((r if r >= w["start"] else w["start"] + 0.04) - OFF, 3)
    w["e"] = round(w["end"] - OFF, 3)
# fix word ends before pauses using measured silence starts
pauses = [(6.781, 7.236), (13.391, 13.771), (17.863, 18.196), (24.491, 24.836), (29.230, 29.556)]
for ps, pe in pauses:
    for w in words:
        if w["start"] < ps < w["end"] + 0.1: w["e"] = round(ps - OFF, 3)
words[0]["s"] = 0.0

HL = {"coke", "coke's", "dissolve", "overnight", "weaker", "stronger", "melt", "shine", "days", "mucus", "rebuilt", "sipping", "break", "quickly", "water"}
groups = [[0,1,2],[3,4],[5,6,7],[8,9],[10,11],[12,13],[14,15,16],[17],[18,19],[20,21],[22,23],
          [24,25],[26,27,28],[29,30],[31,32],[33,34],[35,36],[37,38],[39,40],[41,42],[43,44,45],
          [46,47],[48,49],[50,51],[52,53],[54,55],[56,57],
          [58,59,60],[61,62],[63,64],[65,66,67],[68,69,70],[71,72,73],[74,75],[76,77],
          [78,79,80],[81,82],[83,84],[85,86],[87,88],[89,90],[91,92,93],
          [94,95],[96,97],[98,99],[100,101]]
flat = [i for g in groups for i in g]
assert flat == list(range(len(words))), "chunks must cover all words in order"
# fix: groups containing 4 words -> split
chunks = []
for g in groups:
    if len(g) > 3: chunks += [g[:2], g[2:]]
    else: chunks.append(g)
cap = []
for k, g in enumerate(chunks):
    s = words[g[0]]["s"]
    nxt = words[chunks[k + 1][0]]["s"] if k + 1 < len(chunks) else words[g[-1]]["e"] + 0.15
    end = min(nxt, words[g[-1]]["e"] + 0.25)
    txt = []
    for i in g:
        clean = re.sub(r"[^\w']", "", words[i]["w"]).lower()
        txt.append({"w": re.sub(r"[,.…]", "", words[i]["w"]).upper(), "hl": clean in HL, "s": words[i]["s"]})
    cap.append({"s": round(s, 3), "e": round(end, 3), "words": txt})
data = {"words": [{"w": w["w"], "s": w["s"], "e": w["e"]} for w in words], "captions": cap, "off": OFF}
open("engine/data.js", "w").write("export const DATA = " + json.dumps(data) + ";\n")
for w in words: 
    d = w["s"] - (w["start"] - OFF)
    if abs(d) > 0.045: print(f"refined {w['w']:12s} asr {w['start']-OFF:6.3f} -> {w['s']:6.3f} ({d*1000:+.0f} ms)")
for c in cap: print(f"{c['s']:6.2f}-{c['e']:6.2f}  " + " ".join(("*" if x["hl"] else "") + x["w"] for x in c["words"]))
