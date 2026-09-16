# Naver ad thumbnail generator — gauge-only, top-left white logo with drop shadow.
# Boss spec (2026-07-01 v2):
#   Gauge 002428728 -> 3 variants (tight / room / boost).
#   Logo: logo_white.png at top-left, no white disc. Soft drop shadow for
#   legibility on lighter parts of the outdoor-unit body.
#   Reason for top-left: the gauges sit at right-of-center (red) and mid-left
#   (blue); top-left is the outdoor-unit body / dark backdrop with no subject.

from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

ROOT       = Path(r"C:\Users\butto\Desktop\ollit")
SRC        = ROOT / "hero_selected"
OUT        = SRC / "ad_thumbs"
LOGO_PATH  = ROOT / "public" / "landing" / "assets" / "logo_white.png"

CANVAS         = 1000
LOGO_W         = 400        # 2x from 180 per boss spec (~40% of canvas)
MARGIN         = 32         # distance from canvas edge (top + left)
SHADOW_BLUR    = 6          # gaussian blur radius for drop shadow (scaled with logo)
SHADOW_OFFSET  = (3, 3)     # (dx, dy) shadow displacement (scaled)
SHADOW_ALPHA   = 170        # 0..255

GAUGE = SRC / "KakaoTalk_20260623_002428728.jpg"


def load(path: Path) -> Image.Image:
    im = Image.open(path)
    im = ImageOps.exif_transpose(im)
    return im.convert("RGB")


def center_crop_square(im: Image.Image, shrink: float = 1.0, y_bias: float = 0.5) -> Image.Image:
    w, h = im.size
    side = int(min(w, h) * shrink)
    left = (w - side) // 2
    top  = int((h - side) * y_bias)
    return im.crop((left, top, left + side, top + side))


def to_canvas(im: Image.Image) -> Image.Image:
    return im.resize((CANVAS, CANVAS), Image.LANCZOS)


def boost(im: Image.Image) -> Image.Image:
    im = ImageEnhance.Color(im).enhance(1.45)
    im = ImageEnhance.Contrast(im).enhance(1.30)
    im = ImageEnhance.Sharpness(im).enhance(1.20)
    return im


def prepare_logo() -> Image.Image:
    logo = Image.open(LOGO_PATH).convert("RGBA")
    ratio = LOGO_W / logo.width
    new_h = max(1, int(logo.height * ratio))
    return logo.resize((LOGO_W, new_h), Image.LANCZOS)


def make_shadow(logo_rgba: Image.Image) -> Image.Image:
    """Soft dark shadow derived from the logo's alpha channel."""
    alpha = logo_rgba.split()[-1]
    shadow = Image.new("RGBA", logo_rgba.size, (0, 0, 0, 0))
    # Paint black wherever the logo is opaque, keeping the alpha profile.
    black = Image.new("RGBA", logo_rgba.size, (0, 0, 0, SHADOW_ALPHA))
    shadow.paste(black, mask=alpha)
    return shadow.filter(ImageFilter.GaussianBlur(SHADOW_BLUR))


def paste_logo_top_left(canvas_rgb: Image.Image, logo_rgba: Image.Image) -> Image.Image:
    canvas = canvas_rgb.convert("RGBA")
    shadow = make_shadow(logo_rgba)
    sx = MARGIN + SHADOW_OFFSET[0]
    sy = MARGIN + SHADOW_OFFSET[1]
    canvas.alpha_composite(shadow, (sx, sy))
    canvas.alpha_composite(logo_rgba, (MARGIN, MARGIN))
    return canvas.convert("RGB")


def save_png(im: Image.Image, path: Path) -> None:
    im.save(path, format="PNG", optimize=True)
    kb = path.stat().st_size / 1024
    print(f"  saved: {path.name}  {im.size}  {kb:.1f} KB")


def make_gauge(logo: Image.Image) -> None:
    print("gauge variants (002428728):")
    src = load(GAUGE)
    tight = to_canvas(center_crop_square(src, shrink=0.72, y_bias=0.35))
    room  = to_canvas(center_crop_square(src, shrink=1.00, y_bias=0.40))
    save_png(paste_logo_top_left(tight,        logo), OUT / "gauge_tight_1000.png")
    save_png(paste_logo_top_left(room,         logo), OUT / "gauge_room_1000.png")
    save_png(paste_logo_top_left(boost(tight), logo), OUT / "gauge_boost_1000.png")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    logo = prepare_logo()
    make_gauge(logo)
    print("done.")


if __name__ == "__main__":
    main()
