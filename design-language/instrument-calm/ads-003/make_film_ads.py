#!/usr/bin/env python3
"""Hilltop ads from photographs.

The frames are original pictures: a gathering on a hill, a sky shot from
below, a backlight, a ridge at sunset. A print stipple and grain sit on
the picture so it reads as film. Type stays on a white pane.

The crowd is people, seen from far away or from behind. The line on each
ad is a different way of saying the same human fact: a lot of lives,
one place, and someone is in the middle of a move.
"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from make_hilltop import (
    WHITE, INK, LINE, logo, logo_center, pane, hand_only, headline, fit, font, text, text_w,
)

SRC = os.path.join(HERE, "src")
OUT = os.path.join(HERE, "png")


def cover(path, w, h, focus="center"):
    im = Image.open(path).convert("RGB")
    sw, sh = im.size
    scale = max(w / sw, h / sh)
    im = im.resize((int(sw * scale) + 1, int(sh * scale) + 1), Image.LANCZOS)
    nw, nh = im.size
    x = (nw - w) // 2
    if focus == "bottom":
        y = max(0, nh - h)
    elif focus == "top":
        y = 0
    else:
        y = (nh - h) // 2
    return im.crop((x, y, x + w, y + h))


def film(path, w, h, focus="center", cell=4, seed=4):
    """Photograph, then a print tooth. The picture stays. The dots are the filter."""
    im = cover(path, w, h, focus)
    small = im.resize((max(1, w // cell), max(1, h // cell)), Image.BOX)
    dots = np.asarray(small.resize((w, h), Image.NEAREST)).astype(np.float32)
    base = np.asarray(im).astype(np.float32)
    mix = base * 0.62 + dots * 0.38
    n = np.random.default_rng(seed).random(mix.shape[:2]).astype(np.float32)
    mix = mix * 0.90 + (n * 255.0)[..., None] * 0.10
    return Image.fromarray(np.clip(mix, 0, 255).astype(np.uint8))


def square_line(base, line, size=72, sky_logo=False):
    img = base.copy()
    d = ImageDraw.Draw(img)
    w, h = img.size
    if sky_logo:
        logo_center(d, w / 2, 44, 120, WHITE, word=76)
        # Sit the pane on the shoulders so the heads stay in the picture.
        box = (48, h - 176, w - 58, h - 28)
    else:
        box = (48, h - 250, w - 58, h - 56)
    pane(d, box)
    if sky_logo:
        # The line gets the whole pane. The mark is already in the sky.
        size = fit(line, size, w - 200)
        ascent, descent = font(size, 800).getmetrics()
        baseline = box[1] + ((box[3] - box[1]) - (ascent + descent)) / 2 + ascent
        headline(d, (80, baseline), line, size)
    else:
        logo(d, 76, box[1] + 22, 52, INK, word=28)
        size = fit(line, min(size, 52), w - 200)
        headline(d, (76, box[3] - 36), line, size)
    return img


def story_line(base, line, size=64):
    img = base.copy()
    d = ImageDraw.Draw(img)
    w, h = img.size
    logo_center(d, w / 2, 56, 140, WHITE, word=86)
    box = (48, h - 280, w - 58, h - 64)
    pane(d, box)
    size = fit(line, size, w - 180)
    ascent, descent = font(size, 800).getmetrics()
    baseline = box[1] + ((box[3] - box[1]) - (ascent + descent)) / 2 + ascent
    headline(d, (80, baseline), line, size)
    return img


def plate(base, line):
    img = base.copy()
    d = ImageDraw.Draw(img)
    w, h = img.size
    # Card sits on the empty hill. The gathering stays in the picture below it.
    box = (290, 28, w - 290, 392)
    pane(d, box, shadow=12)
    hand_only(d, w / 2, 52, 150, INK)
    headline(d, (w / 2, 248), "StorageAds", 40, anchor="mt")
    size = fit(line, 34, box[2] - box[0] - 72)
    headline(d, (w / 2, 328), line, size, anchor="ms")
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    sky = film(os.path.join(SRC, "sky-from-below.jpg"), 1080, 1080, "bottom", seed=11)
    hill = film(os.path.join(SRC, "hill-gathering.jpg"), 1080, 1080, "center", seed=12)
    hour = film(os.path.join(SRC, "backlight-close.jpg"), 1080, 1080, "center", seed=13)
    ridge = film(os.path.join(SRC, "ridge-line.jpg"), 1080, 1920, "center", seed=14)

    ads = [
        ("20-sky-needs.png", square_line(sky, "Someone needs a unit.", 76, sky_logo=True)),
        ("21-sky-place.png", square_line(sky, "They all need a place.", 72, sky_logo=True)),
        ("22-sky-week.png", square_line(sky, "Someone is moving this week.", 60, sky_logo=True)),
        ("23-hill-household.png", square_line(hill, "Every unit is a household.", 56)),
        ("24-hill-lives.png", square_line(hill, "One facility. A lot of lives.", 56)),
        ("25-hill-fill.png", square_line(hill, "Fill the place.", 72)),
        ("26-hour-between.png", square_line(hour, "Between homes. Still theirs.", 52)),
        ("27-hour-hold.png", square_line(hour, "Hold it till they come back.", 52)),
        ("28-hour-tagline.png", square_line(hour, "Ads that feel like instruments.", 46)),
        ("29-ridge-move.png", story_line(ridge, "The move is already happening.", 52)),
        ("30-ridge-reits.png", story_line(ridge, "The REITs already run this.", 56)),
        ("31-plate-built.png", plate(hill, "Built to fill units.")),
        ("32-plate-door.png", plate(hill, "A locked door for their things.")),
    ]
    images = []
    for name, im in ads:
        path = os.path.join(OUT, name)
        im.save(path, "PNG", optimize=True)
        print("wrote", name, im.size)
        images.append((name, im))
    contact(images)


def contact(images):
    thumb = 420
    gap = 22
    label_h = 56
    rows = []
    y = gap
    # two columns
    col_w = thumb
    sheet_w = gap * 3 + col_w * 2
    heights = []
    thumbs = []
    for name, im in images:
        th = int(im.height * thumb / im.width)
        thumbs.append(im.resize((thumb, th), Image.BOX))
        heights.append(th)
    # pair them
    H = gap
    pairs = list(zip(thumbs[0::2], thumbs[1::2], images[0::2], images[1::2]))
    if len(images) % 2:
        pairs.append((thumbs[-1], None, images[-1], None))
    blocks = []
    for a, b, ia, ib in pairs:
        blocks.append((a, b, ia, ib))
        H += max(a.height, b.height if b else 0) + label_h + gap
    sheet = Image.new("RGB", (sheet_w, H), (224, 224, 229))
    d = ImageDraw.Draw(sheet)
    y = gap
    for a, b, ia, ib in blocks:
        sheet.paste(a, (gap, y))
        text(d, (gap, y + a.height + 8), ia[0].replace(".png", ""), 18, 700, INK)
        if b is not None:
            sheet.paste(b, (gap * 2 + thumb, y))
            text(d, (gap * 2 + thumb, y + b.height + 8), ib[0].replace(".png", ""), 18, 700, INK)
        y += max(a.height, b.height if b else 0) + label_h + gap
    path = os.path.join(OUT, "00-film-set.png")
    sheet.save(path, "PNG", optimize=True)
    print("wrote", path, sheet.size)


if __name__ == "__main__":
    main()
