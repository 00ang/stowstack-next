#!/usr/bin/env python3
"""Ambient dither plates in the cloud-sky recipe.

Flat field, stipple at 2px cells, no gradient and no blur.
Inks stay inside folder 003: sky, slate, white, teal, olive, sage,
crayon and periwinkle. No gold, cream, or dark ground.

Sand is white, not tan. Tulip color is crayon and periwinkle, not yellow.
"""
import os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "tools"))
from ic import hx, smooth_noise, dither_mask, apply_ink

CELL = 2
SKY = hx("#93AFE7")
SLATE = hx("#7D8CA9")
WHITE = (255, 255, 255)
TEAL = hx("#537B88")
OLIVE = hx("#5E604C")
SAGE = hx("#E4EADE")
CRAYON = hx("#83372F")
PERI = hx("#707591")

W, H = 1440, 720


def grids():
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    return x / W, y / H


def paint(field, layers):
    img = Image.new("RGB", (W, H), field)
    for tone, ink, seed in layers:
        img = apply_ink(img, dither_mask(np.clip(tone, 0, 1), "stipple", seed, cell=CELL), ink)
    return img


def mountain():
    xn, yn = grids()
    n = smooth_noise((H, W), scale=280, seed=51, octaves=4)
    # One high peak, one shoulder. yn is 0 at the top, so a smaller ridge is taller.
    ridge = (
        0.62
        - 0.36 * np.exp(-((xn - 0.38) ** 2) / 0.012)
        - 0.18 * np.exp(-((xn - 0.74) ** 2) / 0.018)
        + (n - 0.5) * 0.03
    )
    far = 0.50 - 0.08 * np.exp(-((xn - 0.58) ** 2) / 0.04)
    inside = yn > ridge
    far_in = (yn > far) & ~inside
    depth = np.clip((yn - ridge) * 1.8, 0, 1)
    slate = np.where(inside, (0.22 + 0.40 * depth) * (0.75 + 0.25 * n), 0)
    slate = np.maximum(slate, np.where(far_in, 0.16 + 0.08 * n, 0))
    cap = np.clip((ridge + 0.09 - yn) / 0.09, 0, 1)
    snow = np.where(yn > ridge - 0.012, cap * (0.75 + 0.25 * n), 0)
    return paint(SKY, [(slate, SLATE, 53), (snow, WHITE, 54)])


def forest():
    yy, xx = np.mgrid[0:H, 0:W]
    olive = np.zeros((H, W), np.float32)
    rng = np.random.default_rng(62)
    # Overlapping crowns, back row smaller, front row larger. Sky stays the field.
    for yb, count, r0 in ((250, 13, 78), (390, 10, 120), (530, 8, 160)):
        for i in range(count):
            cx = int((i + 0.35) * W / count + rng.uniform(-40, 40))
            cy = int(yb + rng.uniform(-24, 24))
            r = int(r0 + rng.uniform(-16, 28))
            cup = ((xx - cx) / (r * 1.05)) ** 2 + ((yy - cy) / (r * 0.72)) ** 2
            olive = np.maximum(olive, np.clip(1.08 - cup, 0, 1) ** 0.8 * 0.8)
            trunk = (np.abs(xx - cx) <= max(2, r * 0.06)) & (yy > cy) & (yy < min(H - 8, cy + r))
            olive = np.maximum(olive, np.where(trunk, 0.62, 0))
    _, yn = grids()
    teal = np.where((yn > 0.72) & (olive > 0.15), 0.4, 0)
    return paint(SKY, [(olive, OLIVE, 64), (teal, TEAL, 65)])


def tulips():
    yy, xx = np.mgrid[0:H, 0:W]
    crayon = np.zeros((H, W), np.float32)
    peri = np.zeros((H, W), np.float32)
    stem = np.zeros((H, W), np.float32)
    leaf = np.zeros((H, W), np.float32)
    rng = np.random.default_rng(73)
    for row, y0, count in ((0, 150, 16), (1, 300, 18), (2, 470, 16)):
        for i in range(count):
            cx = int((i + 0.5) * W / count + rng.uniform(-18, 18))
            cy = int(y0 + rng.uniform(-36, 36))
            rx = int(rng.uniform(16, 26))
            ry = int(rng.uniform(22, 34))
            cup = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
            tone = np.clip(1.05 - cup, 0, 1) ** 0.7
            if (row + i) % 2 == 0:
                crayon = np.maximum(crayon, tone * 0.8)
            else:
                peri = np.maximum(peri, tone * 0.75)
            col = (np.abs(xx - cx) <= 1.5) & (yy > cy + ry * 0.2) & (yy < cy + ry + 70)
            stem = np.maximum(stem, np.where(col, 0.8, 0))
            leaves = ((yy - (cy + ry)) / 18) ** 2 + ((xx - cx) / 34) ** 2
            leaf = np.maximum(leaf, np.where((leaves < 1) & (yy > cy), 0.45, 0))
    return paint(SAGE, [(leaf, TEAL, 76), (stem, OLIVE, 77), (peri, PERI, 78), (crayon, CRAYON, 79)])


def beach():
    xn, yn = grids()
    n = smooth_noise((H, W), scale=260, seed=84, octaves=4)
    fine = smooth_noise((H, W), scale=70, seed=85, octaves=3)
    horizon = 0.34
    shore = 0.62 + 0.02 * np.sin(xn * np.pi * 5) + 0.012 * (fine - 0.5)
    water = (yn >= horizon) & (yn < shore)
    depth = np.clip((yn - horizon) / np.maximum(shore - horizon, 1e-3), 0, 1)
    teal = np.where(water, 0.28 + 0.5 * depth * (0.55 + 0.45 * fine), 0)
    cloud = np.clip((n - 0.58) * 4.5, 0, 1) * np.clip((horizon - yn) * 3.2, 0, 1)
    # Broken foam, not ruled lines.
    wave = np.sin(yn * 70 + xn * 8 + fine * 6)
    foam_wave = water & (wave > 0.72) & (depth > 0.2) & (fine > 0.4)
    foam_shore = (yn > shore - 0.03) & (yn < shore + 0.012) & (fine > 0.25)
    foam = np.where(foam_wave | foam_shore, 0.8, 0)
    img = paint(SKY, [(teal, TEAL, 86), (cloud, WHITE, 87), (foam, WHITE, 88)])
    arr = np.array(img)
    sand = yn >= shore
    arr[sand] = WHITE
    return Image.fromarray(arr)


if __name__ == "__main__":
    os.makedirs(HERE, exist_ok=True)
    out = {
        "mountain": mountain(),
        "forest": forest(),
        "tulips": tulips(),
        "beach": beach(),
    }
    for name, img in out.items():
        path = os.path.join(HERE, f"{name}-1440.png")
        img.save(path)
        print(path)
