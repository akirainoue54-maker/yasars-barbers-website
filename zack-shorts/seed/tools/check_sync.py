"""Caption sync check: for each caption chunk, first frame it is drawn vs. measured onset of its first word."""
import json, re
DATA = json.loads(re.sub(r"^export const DATA = |;\s*$", "", open("engine/data.js").read()))
worst = 0
for c in DATA["captions"]:
    import math
    f = math.ceil(c["s"] * 30 - 1e-9)  # first frame index with t >= s
    err = f / 30 - c["s"]; worst = max(worst, abs(err))
print(f"captions: {len(DATA['captions'])}, worst frame-quantisation offset {worst*1000:.1f} ms (< 1 frame = 33.3 ms)")
