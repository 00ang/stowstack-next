#!/usr/bin/env python3
"""Hilltop ads. Visual grammar taken from the 1971 hilltop film, drawn in folder 003.

What the stills do, and what these plates keep:
  Low angle. The sky is the set. People stand at the bottom and look up.
  Two kinds of light. A clear blue afternoon, and a backlight where the
  color sits in the stipple (peach, pink, orange dots on the sky field).
  A green hill. From above, the crowd is a shape on the grass.
  A voiceover card. Short lines, then the name, on a white pane with a
  hard offset so the words sit just off the picture.
  A product plate. The mark on a clean card in front of the hill.
  Film grain at 10% on the plate only.

Left out on purpose: the bottle, the script, the song, the lyric card.
The hand is the only person who fills a frame.
"""
import os, sys, math
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "tools"))
import ic
ic.MANROPE = os.path.join(HERE, "..", "..", "..", "src", "fonts", "Manrope-800.ttf")
from ic import text, text_w, font, smooth_noise, dither_mask, apply_ink, hx

OUT = os.path.join(HERE, "png")
CELL = 2

SKY = hx("#93AFE7")
SLATE = hx("#7D8CA9")
WHITE = (255, 255, 255)
TEAL = hx("#537B88")
OLIVE = hx("#5E604C")
SAGE = hx("#E4EADE")
CRAYON = hx("#83372F")
PERI = hx("#707591")
RED = hx("#E8281E")
GREEN = hx("#396335")
BLUE = hx("#2054B7")
INK = hx("#16161A")
LINE = hx("#121214")
QUIET = hx("#525766")
PEACH = hx("#E38B6C")
PINK = hx("#E7A4C4")
PURPLE = hx("#8E78C8")
SKIN = hx("#E8B59A")

CLOTH = [RED, GREEN, BLUE, CRAYON, PERI, TEAL, WHITE, PEACH, INK, SAGE]
WALLS = [RED, GREEN, BLUE, CRAYON, PERI, TEAL, PEACH, OLIVE, SKY]
HAIR = [INK, CRAYON, SLATE, PEACH, PERI]
HAND = [
    (16, 54, 66, 56),
    (16, 18, 12, 42),
    (34, 8, 12, 52),
    (52, 14, 12, 46),
    (70, 24, 12, 36),
    (82, 60, 24, 14),
]


def grids(w, h):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    return x / w, y / h


def grain(img, amount=0.10, seed=3):
    arr = np.asarray(img).astype(np.float32)
    n = np.random.default_rng(seed).random(arr.shape[:2]).astype(np.float32)
    arr = arr * (1 - amount) + (n * 255.0)[..., None] * amount
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def stipple(img, tone, ink, seed):
    return apply_ink(img, dither_mask(np.clip(tone, 0, 1), "stipple", seed, cell=CELL), ink)


def logo(d, x, y, hand, fill, word=None, gap=16):
    s = hand / 120.0
    for rx, ry, rw, rh in HAND:
        d.rectangle([x + rx * s, y + ry * s, x + (rx + rw) * s, y + (ry + rh) * s], fill=fill)
    wp = word or int(hand * 0.62)
    text(d, (x + hand + gap, y + hand * 0.58), "StorageAds", wp, 800, fill, anchor="lm", tracking=-0.03)
    return hand + gap + text_w("StorageAds", wp, 800, tracking=-0.03)


def logo_center(d, cx, y, hand, fill, word=None):
    wp = word or int(hand * 0.62)
    total = hand + 16 + text_w("StorageAds", wp, 800, tracking=-0.03)
    logo(d, cx - total / 2, y, hand, fill, wp)


def pane(d, box, shadow=10):
    x0, y0, x1, y1 = box
    d.rectangle([x0 + shadow, y0 + shadow, x1 + shadow, y1 + shadow], fill=LINE)
    d.rectangle([x0, y0, x1, y1], fill=WHITE)
    d.rectangle([x0, y0, x1, y1], outline=LINE, width=3)
    return box


def awning(d, x, y, w, h=22):
    cw = w / 3.0
    for i, c in enumerate((RED, GREEN, BLUE)):
        d.rectangle([x + i * cw, y, x + (i + 1) * cw, y + h], fill=c)
    d.rectangle([x, y, x + w, y + h], outline=LINE, width=2)


def headline(d, xy, s, size, fill=INK, anchor="ls"):
    # "s" is the baseline. "t" lifts the period up to the cap line.
    text(d, xy, s, size, 800, fill, anchor=anchor, tracking=-0.035)


def fit(s, size, maxw):
    while size > 28 and text_w(s, size, 800, tracking=-0.035) > maxw:
        size -= 2
    return size


def line_in_pane(d, box, s, size, xpad=36):
    x0, y0, x1, y1 = box
    size = fit(s, size, (x1 - x0) - xpad * 2)
    ascent, descent = font(size, 800).getmetrics()
    baseline = y0 + ((y1 - y0) - (ascent + descent)) / 2 + ascent
    headline(d, (x0 + xpad, baseline), s, size, anchor="ls")
    return size


def house(img, x, y, s, wall, seed):
    """A unit in the facility-plate grammar: thin ink line, stippled wall, white roof."""
    w, h, roof = s * 0.92, s * 0.56, s * 0.30
    x0, y0 = int(round(x - w / 2)), int(round(y - h))
    x1, y1 = int(round(x + w / 2)), int(round(y))
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(img.width - 1, x1), min(img.height - 1, y1)
    if x1 - x0 < 6 or y1 - y0 < 6:
        return img
    tone = np.full((y1 - y0, x1 - x0), 0.7, np.float32)
    dw = max(2, int((x1 - x0) * 0.24))
    dh = max(3, int((y1 - y0) * 0.46))
    cx0 = max(0, (x1 - x0) // 2 - dw // 2)
    tone[max(0, (y1 - y0) - dh):, cx0:cx0 + dw] = 0
    mask = dither_mask(tone, "stipple", seed, cell=2)
    arr = np.array(img)
    sub = arr[y0:y0 + mask.shape[0], x0:x0 + mask.shape[1]]
    mm = mask[:sub.shape[0], :sub.shape[1]]
    sub[mm] = wall
    arr[y0:y0 + sub.shape[0], x0:x0 + sub.shape[1]] = sub
    img = Image.fromarray(arr)
    d = ImageDraw.Draw(img)
    d.rectangle([x0, y0, x1, y1], outline=INK, width=2)
    d.polygon(
        [(x0 - 2, y0), (x, y0 - roof), (x1 + 2, y0)],
        fill=WHITE, outline=INK, width=2,
    )
    d.rectangle([x0 + cx0, y1 - dh, x0 + cx0 + dw, y1], outline=INK, width=1)
    return img


def hat(d, x, y, s, color):
    """The public mark. One brim, one crown. No face."""
    sw = max(2, int(round(s / 14)))
    k = s / 32.0
    def P(px, py):
        return (x + (px - 22) * k, y + (py - 70) * k)
    d.line([P(6, 70), P(38, 70)], fill=color, width=sw)
    crown = [(14, 70), (14, 52), (20, 52), (23, 44), (29, 44), (31, 52), (36, 52), (36, 70)]
    d.line([P(a, b) for a, b in crown], fill=color, width=sw, joint="curve")


def walker(d, x, y, h, color=INK):
    """A person as a line icon, same stroke as the attention marks. No face."""
    s = h / 100.0
    sw = max(2, int(round(h / 36)))
    r = 7.5 * s
    hy = y - 86 * s
    d.ellipse([x - r, hy - r, x + r, hy + r], outline=color, width=sw)
    d.line([(x, hy + r), (x + 2 * s, y - 34 * s)], fill=color, width=sw)
    d.line([(x + 2 * s, y - 58 * s), (x + 16 * s, y - 46 * s)], fill=color, width=sw)
    d.line([(x + 2 * s, y - 34 * s), (x - 14 * s, y)], fill=color, width=sw)
    d.line([(x + 2 * s, y - 34 * s), (x + 16 * s, y)], fill=color, width=sw)


def ribbons(d, x, y, length, sw=5):
    """One crayon ribbon and one periwinkle ribbon. The hand-layer pair."""
    def strand(color, dx, phase):
        pts = []
        for i in range(18):
            t = i / 17
            pts.append((x + dx + math.sin(t * 3.2 + phase) * length * 0.08, y + t * length))
        d.line(pts, fill=color, width=sw, joint="curve")
    strand(CRAYON, -sw, 0.4)
    strand(PERI, sw * 1.4, 1.6)


def hill(w, h, horizon=0.28, seed=11, clear_logo=True):
    xn, yn = grids(w, h)
    n = smooth_noise((h, w), scale=240, seed=seed, octaves=4)
    fine = smooth_noise((h, w), scale=56, seed=seed + 3, octaves=2)
    img = Image.new("RGB", (w, h), SKY)
    sky = yn < horizon
    cloud = np.clip((n - 0.58) * 4.2, 0, 1) * sky * np.clip((horizon - yn) * 3.4, 0, 1)
    if clear_logo:
        cloud *= np.clip((np.abs(xn - 0.5) - 0.16) * 8, 0, 1)
        cloud *= np.clip((yn - 0.02) * 10, 0, 1)
    under = np.clip(np.roll(cloud, 8, axis=0) * 0.75, 0, 1)
    img = stipple(img, under, SLATE, seed)
    img = stipple(img, cloud, WHITE, seed + 1)
    arr = np.array(img)
    arr[yn >= horizon] = SAGE
    img = Image.fromarray(arr)
    olive = np.where(yn >= horizon, 0.16 + 0.42 * fine * np.clip((yn - horizon + 0.05) * 1.5, 0.3, 1), 0)
    teal = np.where(yn >= horizon, 0.14 * n * np.clip((yn - 0.72) * 4, 0, 1), 0)
    img = stipple(img, olive, OLIVE, seed + 2)
    img = stipple(img, teal, TEAL, seed + 3)
    # Sun on the grass, as dots. The aerial frames are lit from behind the hill.
    sun = np.where((yn >= horizon) & (yn < horizon + 0.18), (0.10 + 0.18 * fine) * np.clip((horizon + 0.18 - yn) * 6, 0, 1), 0)
    img = stipple(img, sun, PEACH, seed + 6)
    img = stipple(img, sun * 0.35, PINK, seed + 7)
    return grain(img, 0.10, seed + 9)


def crowd(img, y0, y1, seed=4, gap=None, n=42, h0=64, h1=28):
    """Households on the hill. An oval, nearer units larger. Not a bottle."""
    w, h = img.size
    rng = np.random.default_rng(seed)
    cx = w / 2
    cy = (y0 + y1) / 2
    rx = w * 0.38
    ry = (y1 - y0) / 2
    placed = []
    for _ in range(n * 12):
        if len(placed) >= n:
            break
        x = cx + rng.normal(0, rx * 0.62)
        y = cy + rng.normal(0, ry * 0.62)
        if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1:
            continue
        if x < 40 or x > w - 40 or y < 40 or y > h - 20:
            continue
        if gap and gap[0] < x < gap[1] and gap[2] < y < gap[3]:
            continue
        t = float(np.clip((y - y0) / max(1, y1 - y0), 0, 1))
        hh = h0 + h1 * t
        if any((x - px) ** 2 + (y - py) ** 2 < (max(hh, ph) * 0.72) ** 2 for px, py, ph in placed):
            continue
        placed.append((x, y, hh))
    placed.sort(key=lambda p: p[1])
    for i, (x, y, hh) in enumerate(placed):
        img = house(img, x, y, hh, WALLS[i % len(WALLS)], seed + i)
    return img


def hand_only(d, cx, y, hand, fill):
    s = hand / 120.0
    x = cx - hand / 2
    for rx, ry, rw, rh in HAND:
        d.rectangle([x + rx * s, y + ry * s, x + (rx + rw) * s, y + (ry + rh) * s], fill=fill)


def lookup():
    w = h = 1080
    xn, yn = grids(w, h)
    n = smooth_noise((h, w), scale=280, seed=21, octaves=4)
    img = Image.new("RGB", (w, h), SKY)
    # Clear blue, the low-angle frames. Clouds stay off the logo and off the people.
    cloud = np.clip((n - 0.55) * 4.5, 0, 1)
    cloud *= np.clip((np.abs(xn - 0.5) - 0.18) * 6, 0, 1)
    cloud *= np.clip(yn * 5, 0, 1) * np.clip((0.55 - yn) * 4, 0, 1)
    img = stipple(img, np.clip(np.roll(cloud, 10, 0) * 0.7, 0, 1), SLATE, 22)
    img = stipple(img, cloud, WHITE, 23)
    img = grain(img, 0.10, 24)
    for i, (x, s) in enumerate(((160, 86), (330, 104), (520, 124), (730, 108), (920, 90))):
        img = house(img, x, 908, s, WALLS[i], 40 + i)
    d = ImageDraw.Draw(img)
    logo_center(d, w / 2, 48, 132, WHITE, word=84)
    box = (48, 900, w - 58, h - 58)
    pane(d, box)
    line_in_pane(d, box, "Someone needs a unit.", 68)
    return img


def the_hill():
    w = h = 1080
    img = hill(w, h, horizon=0.30, seed=31)
    img = crowd(img, 390, 790, seed=8, n=34, h0=78, h1=36)
    d = ImageDraw.Draw(img)
    logo_center(d, w / 2, 36, 128, WHITE, word=80)
    box = (48, 820, w - 58, h - 58)
    pane(d, box)
    line_in_pane(d, box, "Fill the place.", 80)
    return img


def the_hour():
    """Backlight. The color is the dots. The hand fills the frame the way a face did."""
    w = h = 1080
    xn, yn = grids(w, h)
    n = smooth_noise((h, w), scale=180, seed=41, octaves=4)
    fine = smooth_noise((h, w), scale=70, seed=42, octaves=3)
    img = Image.new("RGB", (w, h), SKY)
    halo = np.exp(-((xn - 0.50) ** 2) / 0.07 - ((yn - 0.34) ** 2) / 0.035)
    blow = np.clip((n - 0.42) * 2.6, 0, 1) * np.clip((yn - 0.04) * 2.2, 0, 1)
    blow = np.clip(blow * 0.55 + halo * 0.95, 0, 1)
    pink = np.clip((yn - 0.10) * 1.6, 0, 0.82) * (0.4 + 0.6 * fine)
    peach = np.clip((yn - 0.22) * 2.0, 0, 0.9) * (0.45 + 0.55 * n)
    orange = np.clip((yn - 0.42) * 2.4, 0, 0.88) * (0.45 + 0.55 * fine)
    img = stipple(img, pink, PINK, 43)
    img = stipple(img, peach, PEACH, 44)
    img = stipple(img, orange, hx("#E07A62"), 45)
    img = stipple(img, blow, WHITE, 46)
    img = grain(img, 0.10, 47)
    d = ImageDraw.Draw(img)
    hand_only(d, w / 2, 120, 500, WHITE)
    box = (48, 820, w - 58, h - 58)
    pane(d, box)
    logo(d, 76, 842, 52, INK, word=26)
    size = fit("Ads that feel like instruments.", 42, w - 200)
    headline(d, (76, 990), "Ads that feel like instruments.", size)
    return img


def the_card():
    w = h = 1080
    img = hill(w, h, horizon=0.20, seed=51)
    img = crowd(img, 700, 1040, seed=12, n=22, h0=70, h1=24)
    d = ImageDraw.Draw(img)
    logo_center(d, w / 2, 28, 100, WHITE, word=64)
    box = (120, 210, w - 130, 720)
    pane(d, box)
    awning(d, 120, 210, (w - 130) - 120, 26)
    lines = [("A lot of lives.", 72), ("One place.", 84)]
    y = 340
    for line, size in lines:
        size = fit(line, size, w - 340)
        ascent, descent = font(size, 800).getmetrics()
        headline(d, (w / 2, y), line, size, anchor="ms")
        y += int((ascent + descent) * 1.15)
    word = 52
    hand = 80
    total = hand + 16 + text_w("StorageAds", word, 800, tracking=-0.03)
    logo(d, (w - total) / 2, y + 16, hand, INK, word=word)
    return img


def the_plate():
    w = h = 1080
    img = hill(w, h, horizon=0.30, seed=61, clear_logo=False)
    img = crowd(img, 560, 1040, seed=15, n=26, h0=64, h1=28, gap=(280, 800, 140, 730))
    d = ImageDraw.Draw(img)
    box = (300, 168, 780, 700)
    pane(d, box, shadow=12)
    hand_only(d, 540, 210, 220, INK)
    ascent, descent = font(46, 800).getmetrics()
    headline(d, (540, 470 + ascent), "StorageAds", 46, anchor="ms")
    size = fit("Built to fill units.", 40, 420)
    a2, d2 = font(size, 800).getmetrics()
    headline(d, (540, 470 + ascent + descent + 28 + a2), "Built to fill units.", size, anchor="ms")
    return img


def the_line():
    w, h = 1080, 1920
    xn, yn = grids(w, h)
    n = smooth_noise((h, w), scale=320, seed=71, octaves=4)
    fine = smooth_noise((h, w), scale=90, seed=72, octaves=3)
    ridge = 0.66 + 0.012 * np.sin((xn + 0.2) * math.pi * 1.4) + (fine - 0.5) * 0.008
    above = yn < ridge
    img = Image.new("RGB", (w, h), SKY)
    purple = np.clip((yn - 0.08) * 1.6, 0, 0.72) * (0.35 + 0.65 * fine) * above
    pink = np.clip((yn - 0.28) * 2.2, 0, 0.84) * (0.3 + 0.7 * n) * above
    orange = np.clip((yn - 0.46) * 2.8, 0, 0.92) * (0.4 + 0.6 * fine) * above
    blow = np.clip(1 - np.abs(yn - (ridge)) / 0.07, 0, 1) * 0.8
    cloud = np.clip((n - 0.62) * 4, 0, 1) * np.clip((0.20 - yn) * 8, 0, 1)
    cloud *= np.clip((np.abs(xn - 0.5) - 0.22) * 5, 0, 1)
    img = stipple(img, purple, PURPLE, 73)
    img = stipple(img, pink, PINK, 74)
    img = stipple(img, orange, PEACH, 75)
    img = stipple(img, blow, WHITE, 76)
    img = stipple(img, cloud, WHITE, 77)
    img = stipple(img, np.clip(np.roll(cloud, 8, 0) * 0.6, 0, 1), SLATE, 78)
    arr = np.array(img)
    arr[~above] = SAGE
    img = Image.fromarray(arr)
    olive = np.where(~above, 0.22 + 0.4 * fine, 0)
    img = stipple(img, olive, OLIVE, 79)
    img = grain(img, 0.10, 80)
    x = 36.0
    for i in range(8):
        t = i / 7
        s = 52 + (t ** 1.15) * 108
        x += s * 1.05
        yy = float(ridge[0, min(w - 1, int(min(x, w - 1)))]) * h + 2
        img = house(img, x, yy, s, WALLS[i % len(WALLS)], 90 + i)
    d = ImageDraw.Draw(img)
    logo_center(d, w / 2, 56, 150, WHITE, word=92)
    box = (48, 1580, w - 58, h - 64)
    pane(d, box)
    line_in_pane(d, box, "The REITs already run this.", 60)
    return img


def contact(images):
    """Vertical sheet, phone width, one caption under each."""
    thumb_w = 540
    gap = 28
    caps = [
        "14  Looking up. The public, in the hat mark.",
        "15  The hill. Households, side by side.",
        "16  The hour. The light is the close-up.",
        "17  The card. A lot of lives. One place.",
        "18  The plate. The mark in front of the hill.",
        "19  The line. Icons along the ridge.",
    ]
    thumbs = []
    for im in images:
        tw = thumb_w
        th = int(im.height * tw / im.width)
        thumbs.append(im.resize((tw, th), Image.BOX))
    cap_h = 64
    H = gap + sum(t.height + cap_h + gap for t in thumbs)
    sheet = Image.new("RGB", (thumb_w + gap * 2, H), hx("#E0E0E5"))
    d = ImageDraw.Draw(sheet)
    y = gap
    for im, cap in zip(thumbs, caps):
        sheet.paste(im, (gap, y))
        y += im.height + 12
        text(d, (gap, y), cap, 22, 700, INK, anchor="lt")
        y += cap_h
    return sheet


def main():
    os.makedirs(OUT, exist_ok=True)
    ads = [
        ("14-lookup.png", lookup()),
        ("15-hill.png", the_hill()),
        ("16-hour.png", the_hour()),
        ("17-card.png", the_card()),
        ("18-plate.png", the_plate()),
        ("19-line.png", the_line()),
    ]
    images = []
    for name, im in ads:
        path = os.path.join(OUT, name)
        im.save(path, "PNG", optimize=True)
        print("wrote", path, im.size)
        images.append(im)
    sheet = contact(images)
    sheet.save(os.path.join(OUT, "00-hilltop-set.png"), "PNG", optimize=True)
    print("wrote", os.path.join(OUT, "00-hilltop-set.png"), sheet.size)


if __name__ == "__main__":
    main()
