#!/usr/bin/env bash
# Encode the source footage into web-ready H.264 MP4s (1080p desktop + 720p mobile).
# Header/footer get a baked-in crossfade loop: the tail dissolves into the head,
# so the native <video loop> point is invisible.
set -euo pipefail
SRC="${1:-..}"
OUT="${2:-public/media}"
mkdir -p "$OUT"

loop() { # in out_basename D X fps crf1080 crf720
  local in="$1" name="$2" D="$3" X="$4" fps="$5" c1="${6:-23}" c2="${7:-24}"
  local off; off=$(python3 -c "print(round($D-2*$X,4))")
  for spec in "1920:1080:$c1" "1280:720:$c2"; do
    IFS=: read -r w h crf <<<"$spec"
    ffmpeg -v error -y -i "$in" -filter_complex \
      "[0:v]fps=$fps,scale=$w:$h:flags=lanczos,format=yuv420p,split[a][b];[a]trim=start=$X:end=$D,setpts=PTS-STARTPTS[m];[b]trim=start=0:end=$X,setpts=PTS-STARTPTS[hd];[m][hd]xfade=transition=fade:duration=$X:offset=$off,format=yuv420p[v]" \
      -map "[v]" -an -c:v libx264 -preset slow -crf "$crf" -profile:v high -pix_fmt yuv420p -movflags +faststart "$OUT/$name-$h.mp4"
  done
  ffmpeg -v error -y -ss 0.5 -i "$OUT/$name-720.mp4" -frames:v 1 -q:v 4 "$OUT/$name-poster.jpg"
}

loop "$SRC/sydney-at-night-for header.mov" skyline 12.8 3.2 30
loop "$SRC/aerial-video-of-sydney-city-and-sydney-harbor- for footer.mov" harbour 21.0 4.0 30 30 30

# the arrival, trimmed 4s shorter than the source (14.85s → 10.85s) with a soft
# fade to dark at the new end
PLANE_T=10.85
for spec in "1920:1080:22" "1280:720:23"; do
  IFS=: read -r w h crf <<<"$spec"
  ffmpeg -v error -y -i "$SRC/airplane flyby.mp4" -t $PLANE_T -map 0:v:0 -map 0:a:0 \
    -vf "scale=$w:$h:flags=lanczos,format=yuv420p,fade=t=out:st=9.65:d=1.2" -c:v libx264 -preset slow -crf "$crf" -profile:v high -pix_fmt yuv420p \
    -af "volume=0.7,afade=t=out:st=9.65:d=1.2" -c:a aac -b:a 160k -ar 48000 -movflags +faststart "$OUT/plane-$h.mp4"
done
ffmpeg -v error -y -i "$OUT/plane-720.mp4" -frames:v 1 -q:v 4 "$OUT/plane-poster.jpg"

# harbour ambience: a seamless loop from the full-level middle (3s–45s) with a
# 4s crossfade of the tail into the head (output 38s)
ffmpeg -v error -y -i "$SRC/harbor sfx soundtrack.mp3" -filter_complex \
  "[0:a]atrim=start=7:end=45,asetpts=PTS-STARTPTS[m];[0:a]atrim=start=3:end=7,asetpts=PTS-STARTPTS[h];[m][h]acrossfade=d=4:c1=qsin:c2=qsin" \
  -c:a aac -b:a 128k -movflags +faststart "$OUT/harbour-ambience.m4a"

# soundtrack: already trimmed to the lyric timeline; AAC is smaller than the 320k MP3
ffmpeg -v error -y -i "$SRC/official soundtrack.mp3" -af "volume=0.8" -c:a aac -b:a 192k -movflags +faststart "$OUT/soundtrack.m4a"
ls -la "$OUT"
