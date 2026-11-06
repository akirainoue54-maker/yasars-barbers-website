#!/bin/bash
# Render the whole video in frame chunks (2 in parallel), then join. Usage: ./render_all.sh outdir [chunk]
set -e
OUT=${1:-../build/draft}; CH=${2:-125}
mkdir -p "$OUT"
END=$(node -e "const s=require('fs').readFileSync('data.js','utf8').replace('export const DATA = ','').replace(/;\s*$/,''); const d=JSON.parse(s); console.log((d.words[d.words.length-1].e+1.15).toFixed(4))")
N=$(python3 -c "print(round($END*30))")
echo "END=$END frames=$N"
jobs=()
for ((a=0; a<N; a+=CH)); do
  b=$((a+CH)); [ $b -gt $N ] && b=$N
  f=$(printf "%s/chunk_%04d.mp4" "$OUT" $a)
  [ -f "$f" ] && continue
  node render.js video "$f" $(python3 -c "print($a/30)") $(python3 -c "print($b/30)") 30 2> "$f.log" &
  jobs+=($!)
  if [ ${#jobs[@]} -ge 2 ]; then wait ${jobs[0]}; jobs=("${jobs[@]:1}"); fi
done
wait
ls "$OUT"/chunk_*.mp4 | sed "s|^|file '|; s|$|'|" | sed "s|file '$OUT/|file '|" > "$OUT/list.txt"
(cd "$OUT" && ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i list.txt -c copy video.mp4)
ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames,duration -of csv=p=0 "$OUT/video.mp4"
