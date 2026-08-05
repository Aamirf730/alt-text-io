#!/usr/bin/env python3
"""Generate WordPress.org listing assets for Alt Text Pro."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets"
OUT.mkdir(parents=True, exist_ok=True)
LOGO_SOURCE = ROOT / "alt-text-pro" / "assets" / "images" / "logo-alt-text-pro.png"

COLORS = {
    "ink": "#12343b",
    "teal": "#0d4f5e",
    "teal_dark": "#083f4b",
    "paper": "#faf9f6",
    "cloud": "#eef4f3",
    "line": "#d9e5e3",
    "orange": "#f47a3d",
    "green": "#18a058",
    "muted": "#6d7b80",
    "white": "#ffffff",
}


def font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def text(draw, xy, value, size, fill=None, bold=False):
    draw.text(xy, value, font=font(size, bold), fill=fill or COLORS["ink"])


def button(draw, box, label, fill=None):
    rounded(draw, box, 12, fill or COLORS["teal"])
    tw = draw.textlength(label, font=font(22, True))
    x0, y0, x1, y1 = box
    text(draw, (x0 + ((x1 - x0) - tw) / 2, y0 + 15), label, 22, COLORS["white"], True)


def logo_mark(draw, x, y, size):
    rounded(draw, (x, y, x + size, y + size), int(size * 0.22), COLORS["teal"])
    text(draw, (x + size * 0.22, y + size * 0.2), "ALT", int(size * 0.2), COLORS["white"], True)
    text(draw, (x + size * 0.22, y + size * 0.47), "TEXT", int(size * 0.18), COLORS["white"], True)


def save_icon():
    img = Image.open(LOGO_SOURCE).convert("RGBA")
    img.resize((256, 256), Image.Resampling.LANCZOS).save(OUT / "icon-256x256.png")
    img.resize((128, 128), Image.Resampling.LANCZOS).save(OUT / "icon-128x128.png")


def save_banner(scale=1):
    w, h = 772 * scale, 250 * scale
    img = Image.new("RGB", (w, h), COLORS["paper"])
    d = ImageDraw.Draw(img)
    rounded(d, (30 * scale, 30 * scale, 742 * scale, 220 * scale), 28 * scale, COLORS["white"], COLORS["line"], 2 * scale)
    logo_mark(d, 64 * scale, 66 * scale, 118 * scale)
    text(d, (220 * scale, 62 * scale), "AI Alt Text Pro", 48 * scale, COLORS["ink"], True)
    text(d, (224 * scale, 122 * scale), "Bulk image alt text for WordPress", 27 * scale, COLORS["teal"], True)
    text(d, (224 * scale, 164 * scale), "Accessibility first. SEO ready. Built for agencies and site owners.", 18 * scale, COLORS["muted"])
    rounded(d, (600 * scale, 72 * scale, 704 * scale, 116 * scale), 18 * scale, COLORS["cloud"])
    text(d, (622 * scale, 84 * scale), "WP", 22 * scale, COLORS["teal"], True)
    img.save(OUT / f"banner-{w}x{h}.png")


def draw_admin_frame(title, subtitle):
    img = Image.new("RGB", (1200, 900), COLORS["paper"])
    d = ImageDraw.Draw(img)
    rounded(d, (40, 40, 1160, 860), 24, COLORS["white"], COLORS["line"], 2)
    rounded(d, (40, 40, 1160, 126), 24, COLORS["teal"])
    logo_mark(d, 72, 60, 42)
    text(d, (132, 64), "Alt Text Pro", 28, COLORS["white"], True)
    text(d, (72, 160), title, 44, COLORS["ink"], True)
    text(d, (74, 218), subtitle, 22, COLORS["muted"])
    return img, d


def save_screenshot_1():
    img, d = draw_admin_frame("Dashboard overview", "Credits, connection status, recent activity, and next best actions.")
    for i, (label, value, color) in enumerate([
        ("Available Credits", "400", COLORS["teal"]),
        ("Images Optimized", "1,248", COLORS["ink"]),
        ("Current Plan", "Standard", COLORS["orange"]),
    ]):
        x = 72 + i * 350
        rounded(d, (x, 290, x + 312, 470), 18, COLORS["cloud"])
        text(d, (x + 28, 326), label, 20, COLORS["muted"], True)
        text(d, (x + 28, 372), value, 48, color, True)
    button(d, (72, 540, 330, 602), "Bulk Process")
    button(d, (356, 540, 640, 602), "Download Plugin", COLORS["orange"])
    rounded(d, (72, 660, 1128, 792), 18, COLORS["white"], COLORS["line"])
    text(d, (104, 696), "Recent activity", 26, COLORS["ink"], True)
    text(d, (104, 742), "Alt text generated for 18 new product images.", 22, COLORS["muted"])
    img.save(OUT / "screenshot-1.png")


def save_screenshot_2():
    img, d = draw_admin_frame("Settings and connection", "Connect automatically, test your key, and control generation behavior.")
    button(d, (72, 288, 344, 350), "Connect Account")
    rounded(d, (72, 400, 1128, 466), 12, COLORS["cloud"])
    text(d, (104, 418), "API Key: saved securely", 24, COLORS["teal"], True)
    for i, label in enumerate(["Auto-generate on upload", "Context-aware generation", "Overwrite existing alt text"]):
        y = 536 + i * 82
        rounded(d, (76, y, 138, y + 36), 18, COLORS["green"])
        text(d, (166, y + 2), label, 24, COLORS["ink"], True)
    img.save(OUT / "screenshot-2.png")


def save_screenshot_3():
    img, d = draw_admin_frame("Bulk alt text generator", "Process missing alt text across an existing WordPress media library.")
    rounded(d, (72, 300, 1128, 358), 14, COLORS["cloud"])
    rounded(d, (72, 300, 742, 358), 14, COLORS["teal"])
    text(d, (84, 313), "63% complete", 24, COLORS["white"], True)
    for i in range(5):
        y = 430 + i * 68
        rounded(d, (72, y, 1128, y + 46), 10, COLORS["white"], COLORS["line"])
        text(d, (104, y + 10), f"image-{i + 1}.jpg", 20, COLORS["ink"])
        text(d, (900, y + 10), "Generated", 20, COLORS["green"], True)
    img.save(OUT / "screenshot-3.png")


def save_screenshot_4():
    img, d = draw_admin_frame("Media library integration", "Generate and apply alt text directly from WordPress media workflows.")
    for i in range(4):
        x = 82 + i * 270
        rounded(d, (x, 300, x + 220, 510), 16, COLORS["cloud"])
        rounded(d, (x + 22, 328, x + 198, 430), 12, COLORS["teal"])
        text(d, (x + 28, 448), "Generate with AI", 20, COLORS["teal"], True)
    rounded(d, (82, 590, 1118, 740), 16, COLORS["white"], COLORS["line"])
    text(d, (118, 626), "Alt Text", 24, COLORS["ink"], True)
    text(d, (118, 672), "Woman reviewing a product catalog on a laptop in a bright workspace.", 22, COLORS["muted"])
    img.save(OUT / "screenshot-4.png")


def save_screenshot_5():
    img, d = draw_admin_frame("Generation logs", "Review, copy, and audit every generated description.")
    headers = ["Image", "Alt Text", "Credits", "Status"]
    xs = [86, 320, 842, 960]
    for x, header in zip(xs, headers):
        text(d, (x, 304), header, 20, COLORS["teal"], True)
    for i in range(6):
        y = 360 + i * 62
        rounded(d, (72, y, 1128, y + 44), 8, COLORS["white"], COLORS["line"])
        text(d, (86, y + 10), f"upload-{i + 11}.jpg", 18, COLORS["ink"])
        text(d, (320, y + 10), "Descriptive alt text generated from image context.", 18, COLORS["muted"])
        text(d, (868, y + 10), "1", 18, COLORS["ink"], True)
        text(d, (960, y + 10), "Success", 18, COLORS["green"], True)
    img.save(OUT / "screenshot-5.png")


def save_screenshot_6():
    img, d = draw_admin_frame("Responsive WordPress admin", "The plugin stays usable on smaller admin screens and tablets.")
    rounded(d, (412, 260, 788, 780), 42, COLORS["ink"])
    rounded(d, (434, 300, 766, 738), 24, COLORS["white"])
    text(d, (470, 344), "Alt Text Pro", 30, COLORS["teal"], True)
    rounded(d, (470, 418, 730, 498), 14, COLORS["cloud"])
    text(d, (494, 438), "Credits", 18, COLORS["muted"], True)
    text(d, (494, 464), "400", 28, COLORS["ink"], True)
    button(d, (470, 558, 730, 614), "Process Images")
    img.save(OUT / "screenshot-6.png")


def main():
    save_icon()
    save_banner(1)
    save_banner(2)
    save_screenshot_1()
    save_screenshot_2()
    save_screenshot_3()
    save_screenshot_4()
    save_screenshot_5()
    save_screenshot_6()


if __name__ == "__main__":
    main()
