#!/usr/bin/env python3
"""Operator ads in the same film print as the hilltop photographs.

The light, grain, and color stay. The subject changes, and the line
talks to the person who owns the facility: the search, the empty unit,
the fence sign, the move-in, the REIT down the road.
"""
import os, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from make_hilltop import INK, WHITE, logo, logo_center, pane, headline, fit, font
from make_film_ads import film, story_line

SRC = os.path.join(HERE, "src")
OUT = os.path.join(HERE, "png")


def square(base, line, size=56, sky_logo=False, pane_h=194):
    img = base.copy()
    d = ImageDraw.Draw(img)
    w, h = img.size
    if sky_logo:
        logo_center(d, w / 2, 44, 120, WHITE, word=76)
        box = (48, h - pane_h, w - 58, h - 28)
        pane(d, box)
        size = fit(line, size, w - 200)
        ascent, descent = font(size, 800).getmetrics()
        baseline = box[1] + ((box[3] - box[1]) - (ascent + descent)) / 2 + ascent
        headline(d, (80, baseline), line, size)
        return img
    box = (48, h - pane_h - 28, w - 58, h - 48)
    pane(d, box)
    logo(d, 76, box[1] + 18, 48, INK, word=26)
    size = fit(line, min(size, 48), w - 200)
    headline(d, (76, box[3] - 28), line, size)
    return img


def open_top(path, top):
    """Drop the top of a square frame so a low subject sits above the pane."""
    im = Image.open(path).convert("RGB")
    w, h = im.size
    y0 = int(h * top)
    dest = "/tmp/" + os.path.basename(path) + ".crop.jpg"
    im.crop((0, y0, w, h)).save(dest, quality=95)
    return dest


def two_line(base, a, b):
    """Two sentences, one pane. Used when Blake's line is a pair."""
    img = base.copy()
    d = ImageDraw.Draw(img)
    w, h = img.size
    top = h - 390
    box = (36, top, w - 28, top + 276)
    pane(d, box)
    logo(d, 76, box[1] + 18, 48, INK, word=26)
    s1 = fit(a, 40, w - 200)
    s2 = fit(b, 40, w - 200)
    headline(d, (76, box[1] + 148), a, s1)
    headline(d, (76, box[1] + 148 + s1 + 28), b, s2)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    phone = film(os.path.join(SRC, "phone-look.jpg"), 1080, 1080, "top", seed=21)
    unit = film(os.path.join(SRC, "empty-unit.jpg"), 1080, 1080, "center", seed=22)
    road = film(os.path.join(SRC, "facility-road.jpg"), 1080, 1080, "center", seed=23)
    fence = film(os.path.join(SRC, "fence-sign.jpg"), 1080, 1080, "center", seed=24)
    keys = film(open_top(os.path.join(SRC, "keys-counter.jpg"), 0.22), 1080, 1080, "center", seed=25)
    truck = film(os.path.join(SRC, "truck-road.jpg"), 1080, 1920, "center", seed=26)
    desk = film(os.path.join(SRC, "empty-desk.jpg"), 1080, 1080, "center", seed=27)

    ads = [
        ("40-phone-looking.png", square(phone, "Catch them while they're looking.", 52, pane_h=188)),
        ("41-unit-empty.png", square(unit, "This unit is still empty.", 56, pane_h=200)),
        ("42-road-before.png", square(road, "Show up before they search.", 58, sky_logo=True, pane_h=168)),
        ("43-fence-plan.png", square(fence, "A fence sign is not a plan.", 48, pane_h=200)),
        ("44-keys-movein.png", square(keys, "Make the reservation a move-in.", 44, pane_h=188)),
        ("45-truck-trade.png", story_line(truck, "Someone is moving in your trade area.", 52)),
        ("46-desk-reits.png", two_line(desk, "The REITs have a marketing team.", "Now you do too.")),
        ("47-road-plugin.png", square(road, "Plug it in. Fill the place.", 58, sky_logo=True, pane_h=168)),
    ]
    for name, im in ads:
        im.save(os.path.join(OUT, name), "PNG", optimize=True)
        print("wrote", name, im.size)


if __name__ == "__main__":
    main()
