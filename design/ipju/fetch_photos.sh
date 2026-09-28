#!/usr/bin/env bash
# Higgsfield("올데이케어 입주청소 랜딩" 프로젝트)에서 생성한 원본 사진 7장을 내려받아 photos/*.jpg 로 저장
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p photos
B=https://d8j0ntlcm91z4.cloudfront.net/user_3IAAqaDreZjJLcTAHJGbYVemZLk
declare -A SRC=(
  [p1_hero]=hf_20260928_114031_cfd91a08-3448-4f66-a0d1-f5cc52fd39f2
  [p2_dust]=hf_20260928_114032_3a84662a-b2ba-44b5-ba69-e83a79623758
  [p3_living]=hf_20260928_114031_9aa71ece-6fde-4af8-b867-27f71040f1c9
  [p4_kitchen]=hf_20260928_114031_44a857c8-a08a-4dc4-8883-db624f38a267
  [p5_bath]=hf_20260928_114031_b589094c-9f4b-4a76-8c01-e1f7ed13458b
  [p6_window]=hf_20260928_114055_febbdc97-4c2c-4929-85f5-f31ca6f085a5
  [p7_entry]=hf_20260928_114031_0408ddf6-299d-4246-a385-200f926282fe
)
for name in "${!SRC[@]}"; do
  if [ -f "photos/$name.jpg" ]; then echo "skip $name"; continue; fi
  curl -sSfL -o "photos/$name.png" "$B/${SRC[$name]}.png"
  node -e "require('sharp')('photos/$name.png').jpeg({quality:92}).toFile('photos/$name.jpg').then(()=>require('fs').unlinkSync('photos/$name.png'))"
  echo "ok $name"
done
