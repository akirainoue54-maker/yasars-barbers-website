"""Sound design + mix for the watermelon seed short.
All SFX/music: CC0 recordings (see credits.md). Output: build/mix_raw.wav (48 kHz stereo, pre-loudnorm)."""
import json, os, re, shutil, sys
import numpy as np, soundfile as sf
from scipy.signal import resample_poly, butter, sosfilt

SR = 48000
LIB = "/home/user/sfx_src/CC0-Sounds-Web/public/sounds/"
DATA = json.loads(re.sub(r"^export const DATA = |;\s*$", "", open("engine/data.js").read()))
W = lambda i: DATA["words"][i]["s"]
END = DATA["words"][-1]["e"] + 1.15
N = int(round(END * SR))
os.makedirs("sfx", exist_ok=True)
used = {}

def load(rel):
    src = LIB + rel; dst = "sfx/" + os.path.basename(rel).replace(" ", "_")
    if not os.path.exists(dst): shutil.copy(src, dst)
    used[os.path.basename(dst)] = rel
    a, sr = sf.read(dst, dtype="float32", always_2d=True)
    a = a.mean(1)
    if sr != SR:
        from math import gcd
        g = gcd(SR, sr); a = resample_poly(a, SR // g, sr // g).astype(np.float32)
    return a

def loudest(a, dur):
    """window of length dur around the strongest transient"""
    n = int(dur * SR); env = np.convolve(np.abs(a), np.ones(480) / 480, "same")
    i = int(np.argmax(env)); s = max(0, i - int(0.04 * SR)); return a[s:s + n]

def clip(rel, start=0.0, dur=None, rate=1.0, rev=False, pick=None):
    a = load(rel)
    if pick: a = loudest(a, pick)
    else:
        a = a[int(start * SR):]
        if dur: a = a[:int(dur * SR)]
    if rate != 1.0:  # pitch/speed change by resampling
        a = resample_poly(a, 100, int(round(100 * rate))).astype(np.float32)
    if rev: a = a[::-1].copy()
    f = min(len(a), int(0.012 * SR)); a[-f:] *= np.linspace(1, 0, f); a[:64] *= np.linspace(0, 1, 64)
    pk = np.abs(a).max() + 1e-9
    return a / pk * 10 ** (-6 / 20)  # every clip normalised to -6 dBFS peak

sfx = np.zeros(N, np.float32); amb = np.zeros(N, np.float32)
def put(bus, t, a, db):
    i = int(round(t * SR)); j = min(N, i + len(a))
    if i < N and i + len(a) > 0:
        s0 = max(0, -i); bus[max(i, 0):j] += a[s0: s0 + (j - max(i, 0))] * 10 ** (db / 20)
def ev(t, rel, db, **kw): put(sfx, t, clip(rel, **kw), db)

M = "Micro Pack - CaptSubtle - Melon/"; WO = "Micro Pack - Organic Wooshes/"; BP = "bb - Bottle Plops (Apr 2021)/"; SW = "bb - Slide Whistle (Aug 2021)/"
WS = "40-cc0-water-splash-slime-sfx/"; AB = "Free Sound Assets/abstract/"; MG = "Magic Sound Effects/"; RT = "BB_Retail Therapy Sample Pack/"; UI = "Free Sound Assets/ui/"
GL = ["100-CC0-SFX/glass_01.ogg", "100-CC0-SFX/glass_03.ogg", "75-cc0-breaking-falling-hit-sfx/bfh1_glass_hit_01.ogg", "75-cc0-breaking-falling-hit-sfx/bfh1_glass_hit_02.ogg", "100-CC0-SFX/glass_05.ogg"]
POP = [AB + "pop1.wav", AB + "pop2.wav", AB + "pop3.wav"]
T0 = W(78) - 0.05; BEAT = 0.95

# ---- A: tooth drops into the glass, orbit, dive, bubbles, lands (0 - 3.4)
ev(0.00, WS + "splash_03.ogg", -2); ev(0.02, "100-CC0-SFX/plop_02.ogg", -8, start=0.06); ev(0.05, WS + "bubble_01.ogg", -10)
ev(0.45, WO + "Swish 3.wav", -9); ev(1.0, WS + "splash_07.ogg", -9, dur=0.7); ev(1.02, WS + "bubble_02.ogg", -9)
ev(1.5, WO + "Combo 1.wav", -8); ev(2.2, WO + "Swish 5.wav", -9)
ev(2.95, RT + "Beefy Thud 1.wav", -8, pick=0.5); ev(2.97, RT + "Glass Glasses 1.wav", -9, pick=0.6)
# ---- B: the myth - pull-back, racing clock, tooth melts, pop (3.4 - 7.05)
ev(3.4, WO + "Combo 2.wav", -6)
for k in range(30): ev(3.6 + k * 0.1 * (1 - 0.012 * k), UI + "click1.wav", -17 - 2 * (k % 2), rate=1.0 + 0.04 * (k % 3))
ev(3.6, "BB_2HTC Samples Vol 4/Weird/2022-01-08 Slowly Being Erased - Stopwatch.wav", -12, dur=3.0)
ev(4.3, M + "Uncomfortable Gooshy Sounds 2.wav", -11, pick=0.5)
for k, tt in enumerate([4.7, 5.05, 5.4, 5.75]): ev(tt, WS + ["bubble_01.ogg", "bubble_02.ogg", "bubble_03.ogg", "bubble_02.ogg"][k], -9)
ev(4.6, WS + "slime_05.ogg", -11); ev(5.3, WS + "slime_09.ogg", -12)
ev(5.0, WO + "Swish 5.wav", -7); ev(5.9, WO + "Combo 1.wav", -8)
ev(6.33, POP[0], -5); ev(6.35, RT + "Boyioioing 1.wav", -7); ev(6.4, MG + "chimes.wav", -14)
ev(6.7, MG + "chimes.wav", -17)
# ---- rewind
ev(W(24) - 0.05, "FREE SFX PACK VOL 3/OGG/Wet_Reverse_1.ogg", -6, dur=0.75)
ev(W(24) - 0.05, "Micro Pack - Record Fuzzies/Record Skipping 1.wav", -12, pick=0.7)
ev(W(24) - 0.05, WO + "Combo 2.wav", -8, rev=True, rate=1.6)
# ---- C0 / C1 / C2
ev(7.75, WO + "Swish 3.wav", -9); ev(7.8, POP[0], -8); ev(7.82, AB + "ding.wav", -9)
ev(W(30), WO + "Combo 1.wav", -7); ev(W(30) + 0.02, POP[1], -8)
ev(W(36), POP[2], -8); ev(W(36) + 0.35, AB + "clack.wav", -9)
ev(9.8, "80-CC0-creature-SFX/burble_01.ogg", -15); ev(10.5, "80-CC0-creature-SFX/burble_02.ogg", -15)
ev(W(37) - 0.05, WO + "Swish 5.wav", -8); ev(W(37), POP[2], -9)
for k in range(22): ev(11.55 + k * 0.095, UI + "click1.wav", -18 - 2 * (k % 2), rate=1.0 + 0.04 * (k % 3))
ev(W(40) + 0.05, AB + "sching.wav", -9); ev(W(40) + 0.06, AB + "ding.wav", -9); ev(13.0, MG + "chimes.wav", -13)
# ---- D: DAY 1 / 3 / 7
ev(W(46) - 0.07, WO + "Swish 5.wav", -8); ev(W(46) - 0.04, POP[0], -9); ev(13.8, MG + "chimes.wav", -12)
ev(15.2, RT + "Flipping Pages 1.wav", -9); ev(15.22, POP[1], -10); ev(15.4, MG + "chimes.wav", -18)
ev(16.5, RT + "Flipping Pages 3.wav", -9); ev(16.52, POP[2], -10); ev(16.62, SW + "Fast Drop.wav", -10)
# ---- E: acid rain on the mucus layer, gel, rebuild
ev(W(58) - 0.03, WO + "Combo 2.wav", -8)
rr = np.random.default_rng(5)
for tt in np.arange(18.3, 24.4, 0.21): ev(float(tt + rr.uniform(0, 0.12)), WS + ["bubble_01.ogg", "bubble_02.ogg", "bubble_03.ogg"][int(rr.integers(0, 3))], -23 + float(rr.uniform(-2, 2)))
ev(W(63) - 0.1, POP[0], -8); ev(W(70) - 0.05, AB + "sching.wav", -9); ev(W(70) - 0.04, WO + "Swish 3.wav", -10)
ev(21.7, WS + "slime_09.ogg", -11); ev(22.5, WS + "slime_05.ogg", -12); ev(22.95, M + "Uncomfortable Gooshy Sounds 1.wav", -14, pick=0.6)
for k, tt in enumerate([W(76) - 0.05, W(76) + 0.12, W(76) + 0.29, W(76) + 0.46]): ev(tt, BP + "Plop - Viscous 1.wav", -11 + k, pick=0.35, rate=1.0 + 0.12 * k)
ev(24.1, MG + "chimes.wav", -14)
# ---- F: sipping all day - glass touches the teeth
for b in range(5):
    tb = T0 + b * BEAT
    ev(tb - 0.02, WO + "Swish 5.wav", -11); ev(tb + 0.02, UI + "click1.wav", -12)
    ev(tb + 0.34, GL[b], -5); ev(tb + 0.42, WS + "slime_05.ogg", -13); ev(tb + 0.55, "80-CC0-creature-SFX/burble_01.ogg", -17)
ev(T0 + 4 * BEAT + 0.3, SW + "Wobble Drop.wav", -14, dur=0.9)
# ---- G: drink it quickly, then rinse with water
tg = W(94) - 0.05; tw = W(99) - 0.1
ev(tg, WO + "Combo 1.wav", -8); ev(tg + 0.28, GL[0], -6)
for k in range(4): ev(tg + 0.45 + k * 0.17, "80-CC0-creature-SFX/burble_0%d.ogg" % (1 + k % 2), -12 - k)
ev(tg + 0.5, WS + "slime_09.ogg", -11); ev(tg + 0.9, WS + "slime_05.ogg", -12)
ev(tw, WO + "Swish 3.wav", -8); ev(tw + 0.12, WS + "splash_03.ogg", -7); ev(tw + 0.3, WS + "bubble_01.ogg", -10)
ev(W(101) - 0.05, AB + "ding.wav", -7); ev(W(101) - 0.04, MG + "chimes.wav", -11); ev(W(101) + 0.03, MG + "success.wav", -14)
# ---- L: loop back to the glass
ev(W(101) + 0.33, WO + "Combo 1.wav", -8); ev(END - 1.0, POP[0], -9); ev(END - 0.55, WO + "Swish 5.wav", -14)

# --- ambience: fizzing cola bed, glassy room tone, acid/gel bed, water for the rinse
loopb = clip(WS + "loop_bubbles_1.ogg"); loopw = clip(WS + "loop_water_01.ogg"); loopb2 = clip(WS + "loop_bubbles_02.ogg")
def bed(loop, t0, t1, db, fade=0.25):
    n = int((t1 - t0) * SR); x = np.tile(loop, n // len(loop) + 1)[:n].copy()
    f = int(fade * SR); x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f); put(amb, t0, x, db)
bed(loopb, 0.0, 3.5, -15); bed(loopb, 3.5, 7.1, -22); bed(loopb, 7.7, 13.6, -22); bed(loopb2, 9.2, 11.4, -18)
bed(loopb2, 18.1, 24.7, -17); bed(loopb, 24.7, 29.5, -26)
bed(loopb, 29.5, 31.0, -20); bed(loopw, tw, W(101) + 0.33, -13, fade=0.2); bed(loopb, W(101) + 0.3, END, -18)

# --- music: bright loop, crossfaded tiling, ducked under the voice
mus = load("BB_2HTC Samples Vol 4/Loops/2022-03-24 A Vacation From My Vacation - Vibes.wav")
mus /= np.abs(mus).max() + 1e-9
L = len(mus); xf = int(0.05 * SR); music = np.zeros(N + L, np.float32); pos = 0
while pos < N:
    seg = mus.copy(); seg[:xf] *= np.linspace(0, 1, xf); seg[-xf:] *= np.linspace(1, 0, xf)
    music[pos:pos + L] += seg; pos += L - xf
music = music[:N]
music[-int(0.6 * SR):] *= np.linspace(1, 0.5, int(0.6 * SR))

# --- voice (trim so speech starts at 0.0)
v, sr = sf.read("voiceover.mp3", dtype="float32", always_2d=True) if False else (None, None)
os.system(f"ffmpeg -hide_banner -loglevel error -y -ss {DATA['off']} -i voiceover.mp3 -ar {SR} -ac 1 build/vo48.wav")
voice, _ = sf.read("build/vo48.wav", dtype="float32")
voice = np.pad(voice, (0, max(0, N - len(voice))))[:N]
# ducking envelope from voice activity
env = np.sqrt(np.convolve(voice ** 2, np.ones(960) / 960, "same"))
active = (20 * np.log10(env + 1e-9) > -38).astype(np.float32)
a_att, a_rel = np.exp(-1 / (0.03 * SR)), np.exp(-1 / (0.35 * SR))
duck = np.zeros(N, np.float32); g = 0.0
for i in range(0, N, 48):  # 1 ms steps
    target = active[i]; c = a_att if target > g else a_rel
    for _ in range(1): g = target + (g - target) * (c ** 48)
    duck[i:i + 48] = g
music_gain = 10 ** ((-13 - 8 * duck) / 20)  # -13 dB bed, -21 dB under speech
amb_gain = 10 ** ((-3 * duck) / 20)
mix = voice * 1.0 + sfx + amb * amb_gain + music * music_gain
stereo = np.stack([mix, mix], 1)
# subtle width for music/sfx: small Haas offset on the music only
d = int(0.012 * SR); mw = music * music_gain
stereo[d:, 0] += 0.15 * mw[:-d]; stereo[:, 1] -= 0.0
peak = np.abs(stereo).max(); print("pre-norm peak dBFS", 20 * np.log10(peak))
for nm, x in [("voice", voice), ("sfx", sfx), ("amb", amb * amb_gain), ("music", music * music_gain)]: sf.write(f"build/stem_{nm}.wav", x, SR, subtype="FLOAT")
sf.write("build/mix_raw.wav", stereo / max(1.0, peak / 0.89), SR, subtype="FLOAT")
json.dump(used, open("build/sfx_used.json", "w"), indent=1)
print("duration", N / SR, "sfx files", len(used))
