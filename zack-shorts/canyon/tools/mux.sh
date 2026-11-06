#!/bin/bash
# Mux rendered video + mastered mix -> final MP4, then verify loudness / true peak / duration
set -e
V=${1:-build/draft/video.mp4}; OUT=${2:-final.mp4}
ffmpeg -hide_banner -loglevel error -y -i "$V" -i build/mix_master.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest "$OUT"
echo "== $OUT"; ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate -of compact "$OUT"
ffmpeg -hide_banner -i "$OUT" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I:|Peak:)"
