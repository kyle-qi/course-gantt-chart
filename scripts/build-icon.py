#!/usr/bin/env python3
"""Bake a macOS-style squircle mask into app icon assets."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "build"
SIZE = 1024
# Inset content so it matches the visual scale of neighboring dock icons.
CONTENT_SCALE = 0.82
# Superellipse exponent approximating the macOS squircle.
SQUIRCLE_N = 5.0


def squircle_mask(size: int, exponent: float = SQUIRCLE_N) -> np.ndarray:
    y, x = np.mgrid[0:size, 0:size].astype(np.float64)
    nx = (x + 0.5) / (size / 2) - 1.0
    ny = (y + 0.5) / (size / 2) - 1.0
    return (np.abs(nx) ** exponent + np.abs(ny) ** exponent <= 1.0).astype(np.uint8) * 255


def compose_icon(source: Path, dest_png: Path) -> None:
    img = Image.open(source).convert("RGBA")
    side = min(img.size)
    left = (img.width - side) // 2
    top = (img.height - side) // 2
    img = img.crop((left, top, left + side, top + side))

    content_px = max(1, int(round(SIZE * CONTENT_SCALE)))
    img = img.resize((content_px, content_px), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    offset = (SIZE - content_px) // 2
    canvas.paste(img, (offset, offset), img)

    mask = Image.fromarray(squircle_mask(SIZE), mode="L")
    canvas.putalpha(Image.composite(canvas.split()[3], Image.new("L", (SIZE, SIZE), 0), mask))

    dest_png.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dest_png, format="PNG")


def build_icns(png_path: Path, icns_path: Path) -> None:
    iconset = BUILD / "icon.iconset"
    if iconset.exists():
        for child in iconset.iterdir():
            child.unlink()
    else:
        iconset.mkdir(parents=True)

    for size in (16, 32, 128, 256, 512):
        for name, dim in ((f"icon_{size}x{size}.png", size), (f"icon_{size}x{size}@2x.png", size * 2)):
            out = iconset / name
            subprocess.run(
                ["sips", "-z", str(dim), str(dim), str(png_path), "--out", str(out)],
                check=True,
                capture_output=True,
            )

    subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o", str(icns_path)], check=True, capture_output=True)
    for child in iconset.iterdir():
        child.unlink()
    iconset.rmdir()


def main() -> int:
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else BUILD / "icon.png"
    png_out = BUILD / "icon.png"
    icns_out = BUILD / "icon.icns"

    compose_icon(source, png_out)
    build_icns(png_out, icns_out)
    print(f"Wrote {png_out} and {icns_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
