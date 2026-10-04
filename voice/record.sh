#!/usr/bin/env bash
# Records the owner's voice reference for the cloned voice: ./voice/record.sh
# Saves to voice/voices/owner-script.wav (gitignored), which the server prefers over other references.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p voices
SECONDS_TO_RECORD="${1:-45}"
cat SCRIPT.md | sed -n '/^> /p' | sed 's/^> //'
echo
for n in 3 2 1; do echo "Recording in $n…"; sleep 1; done
echo "● Recording for ${SECONDS_TO_RECORD}s — read the script above. Press q to stop early."
ffmpeg -hide_banner -loglevel error -f avfoundation -i ":0" -t "$SECONDS_TO_RECORD" -ac 1 -ar 48000 -y voices/raw-take.wav || true
# Trim leading/trailing silence, remove rumble, normalise loudness, 24 kHz mono for the cloning model.
ffmpeg -hide_banner -loglevel error -y -i voices/raw-take.wav \
  -af "highpass=f=70,silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-18:TP=-2" \
  -ar 24000 -ac 1 voices/owner-script.wav
echo "Saved voice/voices/owner-script.wav ($(ffprobe -v error -show_entries format=duration -of csv=p=0 voices/owner-script.wav)s)."
echo "Switching VENT to your voice (the first time downloads the cloning model, ~1.2 GB)…"
./start.sh --bg
