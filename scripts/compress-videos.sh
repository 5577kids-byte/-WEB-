#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_DIR="${1:-$ROOT/source-videos}"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

mkdir -p "$WORK_DIR/desktop" "$WORK_DIR/mobile"
mkdir -p "$ROOT/assets/videos/desktop" "$ROOT/assets/videos/mobile"

if [[ -n "${2:-}" ]]; then
  names=("$2")
else
  names=(01-hero-intro 02-ai-training 03-automation-flow 04-development)
fi

for name in "${names[@]}"; do
  input="$SOURCE_DIR/$name.mp4"
  if [[ ! -f "$input" ]]; then
    echo "元動画が見つかりません: $input" >&2
    exit 1
  fi

  ffmpeg -y -loglevel error -i "$input" -an \
    -vf "scale='min(1280,iw)':-2:force_original_aspect_ratio=decrease,scale='trunc(iw/2)*2':'trunc(ih/2)*2',fps=24" \
    -c:v libx264 -preset medium -crf 29 -pix_fmt yuv420p \
    -g 24 -keyint_min 24 -sc_threshold 0 -movflags +faststart \
    "$WORK_DIR/desktop/$name.mp4"

  ffmpeg -y -loglevel error -i "$input" -an \
    -vf "scale='min(1280,iw)':-2:force_original_aspect_ratio=decrease,scale='trunc(iw/2)*2':'trunc(ih/2)*2',fps=24" \
    -c:v libvpx-vp9 -crf 39 -b:v 0 -g 24 -row-mt 1 -threads 4 \
    "$WORK_DIR/desktop/$name.webm"

  ffmpeg -y -loglevel error -i "$input" -an \
    -vf "scale='min(704,iw)':-2:force_original_aspect_ratio=decrease,scale='trunc(iw/2)*2':'trunc(ih/2)*2',fps=24" \
    -c:v libx264 -preset medium -crf 30 -pix_fmt yuv420p \
    -g 24 -keyint_min 24 -sc_threshold 0 -movflags +faststart \
    "$WORK_DIR/mobile/$name.mp4"

  ffmpeg -y -loglevel error -i "$input" -an \
    -vf "scale='min(704,iw)':-2:force_original_aspect_ratio=decrease,scale='trunc(iw/2)*2':'trunc(ih/2)*2',fps=24" \
    -c:v libvpx-vp9 -crf 41 -b:v 0 -g 24 -row-mt 1 -threads 4 \
    "$WORK_DIR/mobile/$name.webm"
done

for size in desktop mobile; do
  for file in "$WORK_DIR/$size"/*; do
    mv "$file" "$ROOT/assets/videos/$size/$(basename "$file")"
  done
done

echo "公開動画を再圧縮しました。"
