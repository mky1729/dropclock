from pathlib import Path
import sys

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]


def resize_icon(source, size):
    return source.resize((size, size), Image.Resampling.LANCZOS)


def make_maskable(source, size):
    background = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pixels = background.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            r = round(221 * (1 - t) + 142 * t)
            g = round(206 * (1 - t) + 197 * t)
            b = round(255 * (1 - t) + 252 * t)
            pixels[x, y] = (r, g, b, 255)

    inset = round(size * 0.08)
    foreground = resize_icon(source, size - inset * 2)
    background.alpha_composite(foreground, (inset, inset))
    return background


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: generate_icons.py <source-png>")

    source_path = Path(sys.argv[1]).resolve()
    source = Image.open(source_path).convert("RGBA")

    files_dir = ROOT / "files"
    files_dir.mkdir(exist_ok=True)

    outputs = {
        ROOT / "icon-dropclock-192.png": resize_icon(source, 192),
        ROOT / "icon-dropclock-512.png": resize_icon(source, 512),
        ROOT / "apple-touch-icon.png": resize_icon(source, 180),
        files_dir / "icon-dropclock-maskable-512.png": make_maskable(source, 512),
    }

    for path, image in outputs.items():
        image.save(path)

    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    source.save(
        files_dir / "favicon.ico",
        format="ICO",
        sizes=[(size, size) for size in ico_sizes],
    )


if __name__ == "__main__":
    main()
