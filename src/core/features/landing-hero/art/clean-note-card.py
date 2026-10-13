#!/usr/bin/env python3
"""Clean the 12ui hero art for the live note card and export its responsive files.

Usage: python3 clean-note-card.py <conversation.png> <output-directory>
Needs Pillow (with WebP and AVIF support) and NumPy. The input is the 12ui conversion of the approved hero
(`conversation.png`, 1510x1066: a blank note card with a baked pencil oval, its shadow and a yellow pencil).

1. Erase the baked oval: find its graphite stroke against the card's local median, refill it with the card's own
   low-frequency colour plus paper grain copied from a clean patch of the same card, and feather the seam.
2. Map the art's warm paper to the site's --paper (#fbfaf6) with a per-channel gain, then flatten the paper far from
   the card, shadow and pencil to exactly --paper, so the picture has no visible edge on the page.
3. Export 720 and 1200 wide WebP and AVIF.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

PAPER = np.array([251, 250, 246], dtype=np.float32)
OVAL = (190, 290, 610, 548)  # x0, y0, x1, y1 around the baked oval, with margin
DONOR_SHIFT = 245  # rows below the oval that hold clean card of the same tone
PAPER_SAMPLES = ((0, 0, 100, 110), (1160, 0, 1500, 480))
WIDTHS = (720, 1200)


def box(values, radius, axis):
    padded = np.pad(values, [(radius + 1, radius) if a == axis else (0, 0) for a in range(values.ndim)], mode='edge')
    total = np.cumsum(padded, axis=axis)
    upper = np.take(total, range(2 * radius + 1, total.shape[axis]), axis=axis)
    lower = np.take(total, range(0, total.shape[axis] - 2 * radius - 1), axis=axis)
    return (upper - lower) / (2 * radius + 1)


def blur(values, radius):
    """Gaussian-like blur: three box passes per axis, in float, for images (H, W) or (H, W, C)."""
    step = max(1, round(radius * 0.58))
    out = values.astype(np.float32)
    for axis in (0, 1):
        for _ in range(3):
            out = box(out, step, axis)
    return out


def grow(mask, size):
    return np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(size))) > 127


def erase_oval(art):
    x0, y0, x1, y1 = OVAL
    region = art[y0:y1, x0:x1]
    luma = region @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    background = np.asarray(Image.fromarray(luma.astype(np.uint8)).filter(ImageFilter.MedianFilter(21))).astype(np.float32)
    stroke = grow(luma < background - 7, 7)
    keep = (~stroke).astype(np.float32)
    low = blur(region * keep[..., None], 9) / np.maximum(blur(keep, 9), 1e-3)[..., None]
    donor = art[y0 + DONOR_SHIFT:y1 + DONOR_SHIFT, x0:x1]
    patch = low + (donor - blur(donor, 9))
    weight = np.clip(blur(stroke.astype(np.float32), 1.6) * 1.6, 0, 1)[..., None]
    cleaned = art.copy()
    cleaned[y0:y1, x0:x1] = region * (1 - weight) + patch * weight
    return cleaned


def settle_paper(art):
    """RGBA: the art with its paper mapped to --paper, opaque on the card, shadow and pencil, fading to transparent
    over plain paper, so the page's own paper shows through and no encoder rounding can draw the picture's edge."""
    samples = np.concatenate([art[y0:y1, x0:x1].reshape(-1, 3) for x0, y0, x1, y1 in PAPER_SAMPLES])
    art = art * (PAPER / np.median(samples, axis=0))
    # The drawn paper has a gentle light falloff; estimate it from the paper alone and divide it out.
    paper = (~grow(np.abs(blur(art, 3) - PAPER).max(axis=2) > 6, 25)).astype(np.float32)
    field = blur(art * paper[..., None], 60) / np.maximum(blur(paper, 60), 1e-3)[..., None]
    art = art * (PAPER / np.where(blur(paper, 60)[..., None] > 0.02, field, PAPER))
    content = np.abs(blur(art, 3) - PAPER).max(axis=2) > 4.5
    alpha = np.clip(blur(grow(content, 17).astype(np.float32), 14) * 1.5, 0, 1)
    height, width = alpha.shape
    ramp = np.minimum.outer(np.minimum(np.arange(height), np.arange(height)[::-1]), np.minimum(np.arange(width), np.arange(width)[::-1]))
    alpha *= np.clip(ramp / 6, 0, 1)
    colour = np.where(alpha[..., None] > 0, art, PAPER)
    return np.concatenate([colour, alpha[..., None] * 255], axis=2)


def main(source, output):
    art = np.asarray(Image.open(source).convert('RGB')).astype(np.float32)
    clean = Image.fromarray(np.clip(settle_paper(erase_oval(art)) + 0.5, 0, 255).astype(np.uint8), 'RGBA')
    output.mkdir(parents=True, exist_ok=True)
    for width in WIDTHS:
        size = (width, round(clean.height * width / clean.width))
        scaled = clean.resize(size, Image.LANCZOS)
        scaled.save(output / f'note-card-{width}.webp', quality=90, method=6)
        scaled.save(output / f'note-card-{width}.avif', quality=74, speed=2)
        print(width, size)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(Path(sys.argv[1]), Path(sys.argv[2]))
