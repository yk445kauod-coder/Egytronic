"""Rebuild every icon from the master logo.

`public/assets/img/icon-512.png` is the source of truth; everything else is derived, so the
favicon can never drift from the mark. Google wants a square icon that is a multiple of 48px,
hence the 48/96/144/192 sizes.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MASTER = ROOT / "public/assets/img/icon-512.png"
IMG = ROOT / "public/assets/img"
SIZES = {"icon-16.png": 16, "icon-32.png": 32, "icon-48.png": 48, "icon-96.png": 96, "icon-144.png": 144, "icon-192.png": 192,
         "icon-256.png": 256, "icon-512.png": 512, "apple-touch-icon.png": 180}
ICO_SIZES = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def main() -> None:
    logo = Image.open(MASTER).convert("RGB")
    for name, size in SIZES.items():
        logo.resize((size, size), Image.LANCZOS).save(IMG / name, optimize=True)

    # Maskable icons get a safe zone: Android crops up to 20% off each edge.
    ground = logo.getpixel((8, 256))
    maskable = Image.new("RGB", (512, 512), ground)
    maskable.paste(logo.resize((400, 400), Image.LANCZOS), (56, 56))
    maskable.save(IMG / "icon-maskable-512.png", optimize=True)

    logo.save(ROOT / "public/favicon.ico", sizes=ICO_SIZES)
    print("icons:", ", ".join(SIZES), "+ icon-maskable-512.png + favicon.ico")


if __name__ == "__main__":
    main()
