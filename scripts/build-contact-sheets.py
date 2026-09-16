#!/usr/bin/env python3
# hero_photos 사진을 검토용 contact sheet 로 합침.
# 2026-06-22.
#   · 한 행: [작업번호 라벨][전 350px][후 350px].
#   · 한 sheet 10세트 (20장) → 약 5장 contact_01~05.jpg.
#   · 출력: ./hero_photos/contact/.

import os
import re
import sys
from PIL import Image, ImageDraw, ImageFont

# Windows 콘솔 cp949 → utf-8 강제 (한국어 / 유니코드 기호 출력용)
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

SRC_DIR   = os.path.join(os.path.dirname(__file__), "..", "hero_photos")
OUT_DIR   = os.path.join(SRC_DIR, "contact")
FONT_PATH = r"C:\Windows\Fonts\malgun.ttf"

THUMB_W    = 350
THUMB_H    = 280
LABEL_W    = 220
GAP        = 8
PADDING    = 12
PER_SHEET  = 10
FONT_SIZE  = 22
FONT_SMALL = 14

os.makedirs(OUT_DIR, exist_ok=True)

# 짝 추출 — {task_no: {"before": path, "after": path}}
pairs = {}
for fn in os.listdir(SRC_DIR):
    m = re.match(r"^(.+)_(before|after)\.(jpg|jpeg|png|webp)$", fn, re.IGNORECASE)
    if not m:
        continue
    task_no, suffix = m.group(1), m.group(2).lower()
    pairs.setdefault(task_no, {})[suffix] = os.path.join(SRC_DIR, fn)

complete = sorted([k for k, v in pairs.items() if "before" in v and "after" in v])
print(f"[짝 보유 {len(complete)}건]")

if not complete:
    print("대상 없음 — 종료")
    raise SystemExit(0)

font_label = ImageFont.truetype(FONT_PATH, FONT_SIZE)
font_small = ImageFont.truetype(FONT_PATH, FONT_SMALL)


def fit_thumb(img_path: str) -> Image.Image:
    img = Image.open(img_path).convert("RGB")
    img.thumbnail((THUMB_W, THUMB_H))
    canvas = Image.new("RGB", (THUMB_W, THUMB_H), (240, 240, 240))
    x = (THUMB_W - img.width) // 2
    y = (THUMB_H - img.height) // 2
    canvas.paste(img, (x, y))
    return canvas


sheet_w = PADDING + LABEL_W + GAP + THUMB_W + GAP + THUMB_W + PADDING
row_h   = THUMB_H + GAP
sheet_h = PADDING + PER_SHEET * row_h + PADDING

sheet_count = 0
for sheet_idx, start in enumerate(range(0, len(complete), PER_SHEET), 1):
    chunk = complete[start:start + PER_SHEET]
    if not chunk:
        break

    sheet = Image.new("RGB", (sheet_w, sheet_h), (255, 255, 255))
    draw  = ImageDraw.Draw(sheet)

    for i, task_no in enumerate(chunk):
        y = PADDING + i * row_h

        # 라벨 — 작업번호 + 인덱스 (세로 중앙 정렬)
        label_x  = PADDING
        center_y = y + THUMB_H // 2
        # bbox 측 텍스트 크기 측정 → 세로 중앙 맞춤
        bbox = draw.textbbox((0, 0), task_no, font=font_label)
        text_h = bbox[3] - bbox[1]
        draw.text((label_x, center_y - text_h - 4), task_no, fill=(20, 20, 20), font=font_label)
        draw.text((label_x, center_y + 8), f"#{start + i + 1:02d}", fill=(120, 120, 120), font=font_small)

        # before / after thumb
        try:
            sheet.paste(fit_thumb(pairs[task_no]["before"]), (PADDING + LABEL_W + GAP, y))
        except Exception as e:
            print(f"  ✗ {task_no} before: {e}")
        try:
            sheet.paste(fit_thumb(pairs[task_no]["after"]), (PADDING + LABEL_W + GAP + THUMB_W + GAP, y))
        except Exception as e:
            print(f"  ✗ {task_no} after: {e}")

        # 헤더 텍스트 (전/후) — 첫 행 상단에만
        if i == 0:
            head_y = y + 2
            draw.text((PADDING + LABEL_W + GAP + 4, head_y), "BEFORE",
                      fill=(180, 30, 30), font=font_small)
            draw.text((PADDING + LABEL_W + GAP + THUMB_W + GAP + 4, head_y), "AFTER",
                      fill=(30, 120, 30), font=font_small)

    out_path = os.path.join(OUT_DIR, f"contact_{sheet_idx:02d}.jpg")
    sheet.save(out_path, "JPEG", quality=88)
    sheet_count += 1
    print(f"  ✓ {out_path} ({len(chunk)} sets)")

print(f"\n[완료] sheet {sheet_count}장 / 폴더: {os.path.abspath(OUT_DIR)}")
