#!/usr/bin/env python3
# 검토용 contact sheet 3종 — cleaning (pairs) / refrigerant / repair (gallery).
# 2026-06-22.
#   · cleaning: [전][후] 짝 + 작업번호. 10세트/sheet.
#   · refrig / repair: 작업 사진 나열 + 작업번호. 20장/sheet (4 col × 5 row).
#   · 출력: ./hero_photos/contact/ — cleaning_NN.jpg / refrig_NN.jpg / repair_NN.jpg.

import os
import re
import sys
from PIL import Image, ImageDraw, ImageFont

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT       = os.path.dirname(__file__)
OUT_DIR    = os.path.join(ROOT, "..", "hero_photos", "contact")
FONT_PATH  = r"C:\Windows\Fonts\malgun.ttf"

THUMB_W    = 350
THUMB_H    = 280
LABEL_W    = 220       # cleaning pairs 측 라벨 폭
PADDING    = 12
GAP        = 8
PER_PAIRS  = 10        # cleaning pairs/sheet (전후 합쳐 20장)
PER_GRID   = 20        # gallery 한 sheet 20장
COL_GRID   = 4
FONT_SIZE  = 22
FONT_SMALL = 14

os.makedirs(OUT_DIR, exist_ok=True)
font_label = ImageFont.truetype(FONT_PATH, FONT_SIZE)
font_small = ImageFont.truetype(FONT_PATH, FONT_SMALL)


def fit_thumb(p: str, w: int, h: int) -> Image.Image:
    img = Image.open(p).convert("RGB")
    img.thumbnail((w, h))
    canvas = Image.new("RGB", (w, h), (240, 240, 240))
    canvas.paste(img, ((w - img.width) // 2, (h - img.height) // 2))
    return canvas


def build_pairs(src_dir: str, out_prefix: str) -> int:
    pairs = {}
    if not os.path.isdir(src_dir):
        print(f"  폴더 없음: {src_dir}")
        return 0
    for fn in sorted(os.listdir(src_dir)):
        m = re.match(r"^(.+)_(before|after)\.(jpg|jpeg|png|webp)$", fn, re.IGNORECASE)
        if not m:
            continue
        pairs.setdefault(m.group(1), {})[m.group(2).lower()] = os.path.join(src_dir, fn)
    keys = sorted([k for k, v in pairs.items() if "before" in v and "after" in v])
    print(f"  짝 {len(keys)}건")
    if not keys:
        return 0

    sheet_w = PADDING + LABEL_W + GAP + THUMB_W + GAP + THUMB_W + PADDING
    row_h   = THUMB_H + GAP
    sheet_h = PADDING + PER_PAIRS * row_h + PADDING

    count = 0
    for sidx, start in enumerate(range(0, len(keys), PER_PAIRS), 1):
        chunk = keys[start:start + PER_PAIRS]
        if not chunk:
            break
        sheet = Image.new("RGB", (sheet_w, sheet_h), (255, 255, 255))
        draw  = ImageDraw.Draw(sheet)
        for i, k in enumerate(chunk):
            y = PADDING + i * row_h
            cy = y + THUMB_H // 2
            bbox = draw.textbbox((0, 0), k, font=font_label)
            text_h = bbox[3] - bbox[1]
            draw.text((PADDING, cy - text_h - 4), k, fill=(20, 20, 20), font=font_label)
            draw.text((PADDING, cy + 8), f"#{start + i + 1:02d}", fill=(120, 120, 120), font=font_small)
            sheet.paste(fit_thumb(pairs[k]["before"], THUMB_W, THUMB_H), (PADDING + LABEL_W + GAP, y))
            sheet.paste(fit_thumb(pairs[k]["after"],  THUMB_W, THUMB_H), (PADDING + LABEL_W + GAP + THUMB_W + GAP, y))
            if i == 0:
                draw.text((PADDING + LABEL_W + GAP + 4, y + 2), "BEFORE",
                          fill=(180, 30, 30), font=font_small)
                draw.text((PADDING + LABEL_W + GAP + THUMB_W + GAP + 4, y + 2), "AFTER",
                          fill=(30, 120, 30), font=font_small)
        out = os.path.join(OUT_DIR, f"{out_prefix}_{sidx:02d}.jpg")
        sheet.save(out, "JPEG", quality=88)
        count += 1
        print(f"  ✓ {os.path.basename(out)} ({len(chunk)} sets)")
    return count


def build_gallery(src_dir: str, out_prefix: str) -> int:
    if not os.path.isdir(src_dir):
        print(f"  폴더 없음: {src_dir}")
        return 0
    files = []
    for fn in os.listdir(src_dir):
        m = re.match(r"^(.+)_(\d+)\.(jpg|jpeg|png|webp)$", fn, re.IGNORECASE)
        if not m:
            continue
        files.append((m.group(1), int(m.group(2)), os.path.join(src_dir, fn)))
    files.sort(key=lambda x: (x[0], x[1]))
    print(f"  사진 {len(files)}장")
    if not files:
        return 0

    cell_label_h = 26
    cell_h = THUMB_H + cell_label_h + GAP
    sheet_w = PADDING + COL_GRID * THUMB_W + (COL_GRID - 1) * GAP + PADDING
    rows_per_sheet = PER_GRID // COL_GRID
    sheet_h = PADDING + rows_per_sheet * cell_h + PADDING

    count = 0
    for sidx, start in enumerate(range(0, len(files), PER_GRID), 1):
        chunk = files[start:start + PER_GRID]
        if not chunk:
            break
        sheet = Image.new("RGB", (sheet_w, sheet_h), (255, 255, 255))
        draw  = ImageDraw.Draw(sheet)
        for i, (task_no, idx, fp) in enumerate(chunk):
            col = i % COL_GRID
            row = i // COL_GRID
            x = PADDING + col * (THUMB_W + GAP)
            y = PADDING + row * cell_h
            label = f"{task_no} #{idx}"
            draw.text((x + 4, y + 2), label, fill=(20, 20, 20), font=font_small)
            sheet.paste(fit_thumb(fp, THUMB_W, THUMB_H), (x, y + cell_label_h))
        out = os.path.join(OUT_DIR, f"{out_prefix}_{sidx:02d}.jpg")
        sheet.save(out, "JPEG", quality=88)
        count += 1
        print(f"  ✓ {os.path.basename(out)} ({len(chunk)} photos)")
    return count


SRC_CLEAN  = os.path.join(ROOT, "..", "hero_photos")
SRC_REFRIG = os.path.join(ROOT, "..", "hero_photos_refrig")
SRC_REPAIR = os.path.join(ROOT, "..", "hero_photos_repair")

print(">> cleaning (pairs)")
c1 = build_pairs(SRC_CLEAN, "cleaning")
print("\n>> refrigerant (gallery)")
c2 = build_gallery(SRC_REFRIG, "refrig")
print("\n>> repair (gallery)")
c3 = build_gallery(SRC_REPAIR, "repair")

print(f"\n[완료] sheet 총 {c1 + c2 + c3}장 (cleaning {c1} / refrig {c2} / repair {c3})")
print(f"폴더: {os.path.abspath(OUT_DIR)}")
