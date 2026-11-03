"""Run on Akira's PC (not the cloud): word timestamps -> script check -> captions.srt
usage: python make_captions.py ../voiceover.mp3 ../
Adjust MAX_WORDS etc. to the caption rules in zack_bible.md (v2)."""
import sys, json, re, difflib
from pathlib import Path
SCRIPT = ("If you swallowed a piece of gum, you've probably been told it would sit in your stomach for seven years, "
"because that's what everyone's parents say. But the moment it lands, your stomach washes away the sugar and flavour, "
"while the rubbery gum base, which your body can't break down at all, gets squeezed into your intestines. From there, "
"it slides along with everything else you ate, and just a few days later, it leaves your body the same way everything "
"else does. The only real danger is swallowing loads of it at once, because it can clump into a ball big enough to "
"block your gut… so maybe just spit it out.")
MAX_WORDS, MAX_CHARS, PAUSE_BREAK, MIN_DUR = 3, 18, 0.25, 0.35   # <- bible v2 values here
norm = lambda s: re.sub(r"[^a-z0-9']", "", s.lower().replace("’", "'"))

def transcribe(mp3):
    from faster_whisper import WhisperModel
    m = WhisperModel("medium.en", device="cpu", compute_type="int8")
    segs, info = m.transcribe(str(mp3), word_timestamps=True, language="en",
                              initial_prompt=SCRIPT)
    return [{"w": w.word.strip(), "s": w.start, "e": w.end} for s in segs for w in s.words]

def check(words):
    a = [norm(w) for w in SCRIPT.split()]; b = [norm(w["w"]) for w in words]
    out = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b).get_opcodes():
        if op != "equal":
            out.append(f"{op}: script={' '.join(a[i1:i2])!r} heard={' '.join(b[j1:j2])!r} @ {words[min(j1,len(words)-1)]['s']:.2f}s")
    return out

def chunks(words):
    cur, res = [], []
    for i, w in enumerate(words):
        cur.append(w)
        gap = words[i+1]["s"] - w["e"] if i+1 < len(words) else 9
        text = " ".join(x["w"] for x in cur)
        if len(cur) >= MAX_WORDS or len(text) >= MAX_CHARS or gap >= PAUSE_BREAK or re.search(r"[,.…!?]$", w["w"]):
            res.append(cur); cur = []
    if cur: res.append(cur)
    return res

def ts(t):
    ms = int(round(t*1000)); return f"{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}"

def srt(groups):
    lines = []
    for k, g in enumerate(groups):
        s = g[0]["s"]; e = max(g[-1]["e"], s + MIN_DUR)
        if k+1 < len(groups): e = min(e, groups[k+1][0]["s"])
        txt = re.sub(r"[,.…]+$", "", " ".join(x["w"] for x in g)).upper()
        lines += [str(k+1), f"{ts(s)} --> {ts(e)}", txt, ""]
    return "\n".join(lines)

if __name__ == "__main__":
    mp3, out = Path(sys.argv[1]), Path(sys.argv[2])
    words = json.load(open(sys.argv[3])) if len(sys.argv) > 3 else transcribe(mp3)
    json.dump(words, open(out/"words.json", "w"), indent=0)
    diff = check(words)
    (out/"transcript_check.txt").write_text("\n".join(diff) or "MATCH: transcript == script")
    (out/"captions.srt").write_text(srt(chunks(words)))
    print(len(words), "words;", len(diff), "differences")
