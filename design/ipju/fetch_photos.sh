#!/usr/bin/env bash
# Higgsfield(recraft_v4_1)로 생성한 원본 사진 7장을 내려받아 photos/*.jpg 로 저장
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p photos
B=https://d8j0ntlcm91z4.cloudfront.net/user_3IAAqaDreZjJLcTAHJGbYVemZLk
declare -A SRC=(
  [p1_hero]=hf_20260928_111855_1dfb9ca3-2e92-4281-838a-a815be29c3e8
  [p2_dust]=hf_20260928_111822_8765d818-2a35-43c2-a249-f1671c824fe0
  [p3_living]=hf_20260928_111823_38e1f124-c768-436e-9b72-4dbd66f0841c
  [p4_kitchen]=hf_20260928_111841_82eee872-6a24-438e-86cb-ef0a707b22a9
  [p5_bath]=hf_20260928_111822_266be951-9010-4b9e-b0c7-3436c524d6dc
  [p6_window]=hf_20260928_111822_21084af8-4fe2-4490-afe9-78d471dfabda
  [p7_entry]=hf_20260928_111822_45e65fbc-d2a9-4e19-9f24-8097d4cba817
)
for name in "${!SRC[@]}"; do
  if [ -f "photos/$name.jpg" ]; then echo "skip $name"; continue; fi
  curl -sSfL -o "photos/$name.png" "$B/${SRC[$name]}.png"
  node -e "require('sharp')('photos/$name.png').jpeg({quality:92}).toFile('photos/$name.jpg').then(()=>require('fs').unlinkSync('photos/$name.png'))"
  echo "ok $name"
done
