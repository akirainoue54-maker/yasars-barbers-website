#!/bin/bash
# Final brightness trim measured on the encoded file (limited-range YAVG): hook seconds (first/last ~1 s) a little brighter than the rest.
# usage: grade.sh in.mp4 out.mp4 BASE HOOK   (negative brightness offsets for eq)
IN=$1; OUT=$2; B=${3:--0.04}; H=${4:--0.06}
END=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")
ffmpeg -hide_banner -loglevel error -y -i "$IN" -vf "eq=brightness='${B}+(${H}-(${B}))*(1-min(1,max(0,(t-1)/1)))*lt(t,2)+(${H}-(${B}))*gt(t,${END}-1.2)':contrast=1.04:eval=frame" -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 -an "$OUT"
