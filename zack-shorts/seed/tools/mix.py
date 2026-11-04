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
    if i < N: bus[i:j] += a[: j - i] * 10 ** (db / 20)
def ev(t, rel, db, **kw): put(sfx, t, clip(rel, **kw), db)

M = "Micro Pack - CaptSubtle - Melon/"; WO = "Micro Pack - Organic Wooshes/"; BP = "bb - Bottle Plops (Apr 2021)/"; SW = "bb - Slide Whistle (Aug 2021)/"
WS = "40-cc0-water-splash-slime-sfx/"; AB = "Free Sound Assets/abstract/"; MG = "Magic Sound Effects/"
# --- A: bite, juice, tongue, gulp, down the throat
ev(0.00, WO + "Gentle Swish.wav", -14)
ev(0.74, M + "Rip and Tear 2.wav", -1, start=0.12)
ev(0.78, M + "Slap the Melon 1.wav", -7)
ev(0.79, "LQ_interface/Crunch.flac", -12, dur=0.35)
ev(0.86, M + "Uncomfortable Gooshy Sounds 2.wav", -9, pick=0.5)
ev(1.04, WO + "Swish 3.wav", -7)
ev(1.25, WS + "slime_05.ogg", -9)
ev(1.62, M + "Uncomfortable Gooshy Sounds 1.wav", -15, pick=0.6)
ev(2.36, BP + "Plop - Viscous 3.wav", -1, pick=0.45, rate=0.82)
ev(2.40, "25-CC0-mud-sfx/mud_07.ogg", -11)
ev(2.68, WO + "Combo 2.wav", -6)
ev(2.75, WS + "slime_09.ogg", -13)
ev(3.20, WO + "Combo 1.wav", -6)
# --- B1: the myth sprouts
ev(3.60, BP + "Plop - Viscous 1.wav", -8, pick=0.4)
ev(4.12, "100-CC0-wood-metal-SFX/wood_cracking_03.ogg", -10)
ev(4.18, MG + "chimes.wav", -13)
ev(4.33, SW + "Fast Rise.wav", -11)
for k, tt in enumerate([4.6, 4.82, 4.98, 5.12]): ev(tt, AB + ["pop1.wav", "pop2.wav", "pop3.wav", "pop2.wav"][k], -13)
ev(4.95, WO + "Twirl 1.wav", -12)
# --- B2: belly bulges, vine bursts, melon boing
ev(5.72, M + "Uncomfortable Gooshy Sounds 2.wav", -11, pick=0.35)
ev(W(18) - 0.02, M + "Rip and Tear 1.wav", -6, pick=0.4)
ev(W(18), SW + "Quick Rise 2.wav", -9)
ev(W(18) + 0.02, AB + "pop1.wav", -9)
for k in range(5): ev(W(18) + 0.18 + k * 0.16, AB + ["pop2.wav", "pop3.wav"][k % 2], -13)
ev(7.2, SW + "Bounce Up and Down.wav", -12, dur=0.7)
ev(W(23) - 0.02, "FREE SFX PACK VOL 3/OGG/Bounce_Up_1.ogg", -8, dur=0.9)
ev(W(23) + 0.05, MG + "chimes.wav", -15)
# --- rewind
ev(W(24) - 0.02, "FREE SFX PACK VOL 3/OGG/Wet_Reverse_1.ogg", -7, dur=0.75)
ev(W(24), "Micro Pack - Record Fuzzies/Record Skipping 1.wav", -12, pick=0.62)
ev(W(24), WO + "Combo 2.wav", -9, rev=True, rate=1.6)
# --- C: falls into acid, splash, fizz, telops, sprout wilts
ev(8.78, WO + "Swish 5.wav", -9, rate=0.8)
tDrop = W(30) + 0.02
ev(tDrop - 0.02, WS + "splash_07.ogg", -2)
ev(tDrop, "100-CC0-SFX/plop_02.ogg", -7, start=0.08)
ev(tDrop + 0.08, WS + "bubble_01.ogg", -10)
ev(W(35), AB + "pop1.wav", -9); ev(W(35) + 0.03, AB + "sching.wav", -16)
for k in range(3): ev(W(41) + k * 0.13, AB + "clack.wav", -11)
ev(W(48), AB + "pop3.wav", -11); ev(W(48) + 0.02, SW + "Quick Rise 2.wav", -16, rate=1.3)
ev(W(50) + 0.02, SW + "Wobble Drop.wav", -9, dur=1.1)
# --- D1/D2: shell shine, stomach squeeze
ev(W(53), AB + "sching.wav", -9)
ev(W(55), M + "Unimaginably Uncomfortable Gooshy Sounds 2.wav", -10, dur=1.6)
ev(W(55) + 0.1, "25-CC0-mud-sfx/mud_03.ogg", -11)
ev(W(57), "80-CC0-creature-SFX/burble_01.ogg", -12)
ev(18.5, WO + "Combo 1.wav", -6)
# --- D3: x-ray, squeezed into intestines
ev(W(61), MG + "chimes.wav", -15)
ev(W(62), WS + "slime_05.ogg", -8)
ev(W(64), "80-CC0-creature-SFX/burble_02.ogg", -12)
# --- D4/D5: sliding along, days pass
ev(W(66) - 0.05, WO + "Swish 3.wav", -9)
ev(W(66) + 0.1, WS + "slime_09.ogg", -12)
ev(21.7, "80-CC0-creature-SFX/burble_01.ogg", -14)
ev(W(73), WO + "Twirl 1.wav", -8)
tDays = W(73); t1d = W(79)
for d in (2, 3): ev(tDays + 0.15 + (t1d - 0.3 - tDays - 0.15) * (d - 1) / 3, AB + "pop1.wav", -10)
# --- D6: toilet plop, bubbles, dings
ev(W(79), SW + "Fast Drop.wav", -9)
tHit = W(79) + 0.42
ev(tHit, "100-CC0-SFX/plop_01.ogg", -1)
ev(tHit + 0.01, WS + "splash_03.ogg", -8)
ev(tHit + 0.1, WS + "bubble_01.ogg", -12)
ev(W(82), AB + "ding.wav", -5); ev(W(82) + 0.02, MG + "chimes.wav", -13)
ev(W(86), AB + "bell.wav", -12)
# --- E: crack, glow, nutrients, back to the plate
ev(W(88) - 0.03, WO + "Swish 5.wav", -9)
ev(W(96) - 0.01, "100-CC0-wood-metal-SFX/wood_cracking_01.ogg", -1)
ev(W(96), "LQ_interface/Crunch.flac", -8, dur=0.4)
ev(W(96) + 0.35, MG + "spell.wav", -11)
for k, i in enumerate([100, 104, 105]): ev(W(i), AB + ["pop1.wav", "pop2.wav", "pop3.wav"][k], -8)
ev(W(105) + 0.2, WO + "Twirl 1.wav", -11)
ev(END - 1.0, AB + "pop1.wav", -9)

# --- ambience: acid fizz under the stomach scenes, bubbles under the toilet water
loopb = clip(WS + "loop_bubbles_1.ogg")
def bed(t0, t1, db, fade=0.25):
    n = int((t1 - t0) * SR); x = np.tile(loopb, n // len(loopb) + 1)[:n].copy()
    f = int(fade * SR); x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f); put(amb, t0, x, db)
bed(W(30), W(61), -17)
bed(tHit, W(88), -19)
# low wet body rumble during the inside-the-body scenes (lowpassed gooshy texture)
goo = clip(M + "Uncomfortable Gooshy Sounds 1.wav")
lp = butter(4, 400, "low", fs=SR, output="sos"); goo = sosfilt(lp, goo).astype(np.float32); goo /= np.abs(goo).max() + 1e-9
for t0, t1 in [(2.4, 5.55), (8.78, W(61))]:
    n = int((t1 - t0) * SR); x = np.tile(goo, n // len(goo) + 1)[:n].copy(); f = int(0.3 * SR); x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f); put(amb, t0, x, -24)

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
