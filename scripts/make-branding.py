"""Builds the app's logo, icons and splash image from the prospectus logo crop.

Usage: python scripts/make-branding.py

Reads assets/source/logo-from-prospectus.png (the shield cropped from the prospectus cover,
still on its pink background) and writes transparent PNGs into assets/images.
Requires Pillow only.
"""

from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "source" / "logo-from-prospectus.png"
OUT = ROOT / "assets" / "images"

# The white rim outside the shield's red outline is 13-15 px wide (measured across the edge).
# Limiting the rim to a band that follows the red outline gives the shield a smooth
# edge and cuts off the cover's light diagonal band where it touches the rim.
RIM_RADIUS = 14
EDGE_BAND = 3
RIM_WHITE = (250, 246, 248)


def is_background(p):
    # Loose enough to include print noise on the pink cover, but well clear of the
    # white rim, which is only reached by flooding in from the image border.
    r, g, b = p
    return r > 150 and b > 90 and (r - g) > 25 and (b - g) > 10


def is_red(p):
    r, g, b = p
    return r > 150 and g < 90 and b < 110


def flood_from_border(width, height, passable):
    """Marks every passable pixel reachable from the image border."""
    seen = bytearray(width * height)
    queue = deque()
    for x in range(width):
        for y in (0, height - 1):
            i = y * width + x
            if passable[i] and not seen[i]:
                seen[i] = 1
                queue.append(i)
    for y in range(height):
        for x in (0, width - 1):
            i = y * width + x
            if passable[i] and not seen[i]:
                seen[i] = 1
                queue.append(i)
    while queue:
        i = queue.popleft()
        x, y = i % width, i // width
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < width and 0 <= ny < height:
                j = ny * width + nx
                if passable[j] and not seen[j]:
                    seen[j] = 1
                    queue.append(j)
    return seen


def chamfer_distance(width, height, sources):
    """Approximate Euclidean distance (in pixels) to the nearest source pixel."""
    big = 1 << 30
    dist = [0 if s else big for s in sources]
    for y in range(height):
        for x in range(width):
            i = y * width + x
            d = dist[i]
            if x > 0:
                d = min(d, dist[i - 1] + 3)
            if y > 0:
                d = min(d, dist[i - width] + 3)
                if x > 0:
                    d = min(d, dist[i - width - 1] + 4)
                if x < width - 1:
                    d = min(d, dist[i - width + 1] + 4)
            dist[i] = d
    for y in range(height - 1, -1, -1):
        for x in range(width - 1, -1, -1):
            i = y * width + x
            d = dist[i]
            if x < width - 1:
                d = min(d, dist[i + 1] + 3)
            if y < height - 1:
                d = min(d, dist[i + width] + 3)
                if x < width - 1:
                    d = min(d, dist[i + width + 1] + 4)
                if x > 0:
                    d = min(d, dist[i + width - 1] + 4)
            dist[i] = d
    return [d / 3 for d in dist]


def largest_component(width, height, mask):
    label = [0] * (width * height)
    best_label, best_size, current = 0, 0, 0
    for start in range(width * height):
        if not mask[start] or label[start]:
            continue
        current += 1
        size = 0
        queue = deque([start])
        label[start] = current
        while queue:
            i = queue.popleft()
            size += 1
            x, y = i % width, i // width
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < width and 0 <= ny < height:
                    j = ny * width + nx
                    if mask[j] and not label[j]:
                        label[j] = current
                        queue.append(j)
        if size > best_size:
            best_label, best_size = current, size
    return bytearray(1 if l == best_label else 0 for l in label)


def extract_logo():
    image = Image.open(SOURCE).convert("RGB")
    width, height = image.size
    pixels = list(image.get_flattened_data())

    not_red = bytearray(0 if is_red(p) else 1 for p in pixels)
    outside_red = flood_from_border(width, height, not_red)
    inside_red = [not o for o in outside_red]
    distance = chamfer_distance(width, height, inside_red)

    background_like = bytearray(1 if is_background(p) else 0 for p in pixels)
    background = flood_from_border(width, height, background_like)

    candidate = Image.new("L", (width, height))
    candidate.putdata(
        [
            255 if inside_red[i] or (distance[i] <= RIM_RADIUS and not background[i]) else 0
            for i in range(width * height)
        ]
    )
    # An opening removes print-noise specks and the thin spike left where the band met the rim.
    candidate = candidate.filter(ImageFilter.MinFilter(7)).filter(ImageFilter.MaxFilter(7))
    shield = largest_component(
        width, height, bytearray(1 if v else 0 for v in candidate.get_flattened_data())
    )

    # Recolour the outer edge band to the rim's white so no pink fringe remains.
    outside_shield = [not s for s in shield]
    edge_distance = chamfer_distance(width, height, outside_shield)
    cleaned = [
        RIM_WHITE if shield[i] and edge_distance[i] <= EDGE_BAND else pixels[i]
        for i in range(width * height)
    ]

    alpha = Image.new("L", (width, height))
    alpha.putdata([255 if s else 0 for s in shield])
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.8))

    logo = Image.new("RGB", (width, height))
    logo.putdata(cleaned)
    logo.putalpha(alpha)
    return logo.crop(logo.getbbox())


def place(logo, canvas_size, box, background=(0, 0, 0, 0)):
    """Centres the logo on a square canvas, scaled to fit inside a box of the given size."""
    scale = min(box / logo.width, box / logo.height)
    resized = logo.resize(
        (round(logo.width * scale), round(logo.height * scale)), Image.LANCZOS
    )
    canvas = Image.new("RGBA", (canvas_size, canvas_size), background)
    offset = ((canvas_size - resized.width) // 2, (canvas_size - resized.height) // 2)
    canvas.alpha_composite(resized, offset)
    return canvas


def monochrome(image):
    alpha = image.getchannel("A")
    white = Image.new("RGBA", image.size, (255, 255, 255, 0))
    white.putalpha(alpha)
    return white


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    logo = extract_logo()
    logo.save(OUT / "school-logo.png")

    place(logo, 1024, 860, (255, 255, 255, 255)).save(OUT / "icon.png")

    # Android adaptive icons are masked to a circle or squircle; keep the shield
    # inside the central safe zone (about 66% of the canvas).
    foreground = place(logo, 1024, 560)
    foreground.save(OUT / "android-icon-foreground.png")
    monochrome(foreground).save(OUT / "android-icon-monochrome.png")

    place(logo, 512, 512).save(OUT / "splash-icon.png")
    print("logo size:", logo.size)


if __name__ == "__main__":
    main()
