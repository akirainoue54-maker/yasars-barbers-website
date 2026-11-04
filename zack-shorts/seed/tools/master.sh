#!/bin/bash
# Loudness master: -14 LUFS integrated, true peak <= -1 dBTP (aim -1.5 to leave room for AAC)
set -e
IN=build/mix_raw.wav; OUT=build/mix_master.wav
# gentle bus compression first so the limiter does little work
ffmpeg -hide_banner -loglevel error -y -i $IN -af "acompressor=threshold=-18dB:ratio=2.5:attack=8:release=120:makeup=1" build/mix_comp.wav
J=$(ffmpeg -hide_banner -i build/mix_comp.wav -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
mi=$(echo "$J" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['input_i'])")
mtp=$(echo "$J" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['input_tp'])")
mlra=$(echo "$J" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['input_lra'])")
mth=$(echo "$J" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['input_thresh'])")
off=$(echo "$J" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['target_offset'])")
ffmpeg -hide_banner -loglevel error -y -i build/mix_comp.wav -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$mi:measured_TP=$mtp:measured_LRA=$mlra:measured_thresh=$mth:offset=$off:linear=true:print_format=summary,aresample=48000" -ar 48000 -c:a pcm_s24le $OUT
ffmpeg -hide_banner -i $OUT -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I:|Peak:|LRA:)"
