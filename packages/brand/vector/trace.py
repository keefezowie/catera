"""Rebuild the Catera raster identity as vector SVG masters.

Run from anywhere: py -3 packages/brand/vector/trace.py
Needs: numpy, opencv-python-headless, pillow, vtracer.

Sources are the transparent derivatives in packages/brand/assets (app-icon.png is opaque).
Pipeline per source: 2x Lanczos upscale -> snap every pixel to a fixed flat palette (CIELAB
nearest) -> 7 px majority filter to drop antialias fringes and generation noise -> vtracer
spline trace -> fills snapped back to exact palette hex. Lockups are composed from the traced
mascot and wordmark, so every file shares one geometry.
"""
import os
import re
import tempfile

import cv2
import numpy as np
import vtracer
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "..", "assets")
SCALE = 2          # trace resolution multiplier; SVG units = source px * SCALE
PAD = 24           # viewBox padding in SVG units

FOREST, CREAM = "#163D2E", "#FFF7E9"

# Sunrise, Cream and Forest are the DESIGN.md tokens; the rest are sampled from the artwork.
MASCOT = {
    "ink": "#08291E", "lid": "#1D543C", "lid-light": "#5B8D74", "cream": CREAM,
    "rice": "#FFFDF7", "shade": "#FBE2B2", "honey": "#F9D196", "sunrise": "#F47B2A",
    "peach": "#FCA777", "blush": "#F4917C", "rust": "#B95106", "greens": "#417711",
    "leafy": "#2F5E2C", "yolk": "#F8C342",
}
ICON = dict(MASCOT, bg=FOREST)
MONO = {"forest": FOREST}


def rgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32)


def prep(src, palette, k=7, alpha_cut=128):
    im = Image.open(src).convert("RGBA")
    im = im.resize((im.width * SCALE, im.height * SCALE), Image.LANCZOS)
    a = np.array(im)
    pal = np.stack([rgb(h) for h in palette.values()]).astype(np.uint8)
    to_lab = lambda x: cv2.cvtColor(x.reshape(-1, 1, 3), cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(np.float32)
    lab, plab = to_lab(a[..., :3].copy()), to_lab(pal)
    labels = ((lab[:, None] - plab[None]) ** 2).sum(-1).argmin(1).reshape(a.shape[:2])
    n = len(pal)
    labels[a[..., 3] < alpha_cut] = n
    votes = np.stack([cv2.blur((labels == i).astype(np.float32), (k, k)) for i in range(n + 1)])
    labels = votes.argmax(0)
    out = np.zeros((*labels.shape, 4), np.uint8)
    for i, c in enumerate(pal):
        out[labels == i] = (*c, 255)
    return out


def trace(src, palette):
    """Return (list of (fill, d, tx, ty)), bbox) in SVG units."""
    rgba = prep(src, palette)
    ys, xs = np.nonzero(rgba[..., 3])
    bbox = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    with tempfile.TemporaryDirectory() as tmp:
        png, svg = os.path.join(tmp, "in.png"), os.path.join(tmp, "out.svg")
        Image.fromarray(rgba).save(png)
        vtracer.convert_image_to_svg_py(
            png, svg, colormode="color", hierarchical="stacked", mode="spline",
            filter_speckle=10 * SCALE, color_precision=8, layer_difference=4,
            corner_threshold=70, length_threshold=6.0, max_iterations=10,
            splice_threshold=45, path_precision=2)
        text = open(svg, encoding="utf-8").read()
    hexes = list(palette.values())
    pal = np.stack([rgb(h) for h in hexes])
    paths = []
    for m in re.finditer(r'<path d="([^"]+)" fill="(#[0-9A-Fa-f]{6})" transform="translate\(([-\d.]+),([-\d.]+)\)"/>', text):
        d, fill, tx, ty = m.group(1), m.group(2).upper(), float(m.group(3)), float(m.group(4))
        fill = hexes[int(((pal - rgb(fill)) ** 2).sum(1).argmin())]
        paths.append((fill, d.strip(), tx, ty))
    return paths, bbox


def body(paths, recolor=None):
    out = []
    for fill, d, tx, ty in paths:
        f = recolor or fill
        out.append(f'<path fill="{f}" transform="translate({tx:g},{ty:g})" d="{d}"/>')
    return "\n".join(out)


def svg_doc(title, bbox, inner, bg=None):
    x0, y0, x1, y1 = bbox
    w, h = x1 - x0, y1 - y0
    rect = f'<rect x="{x0:g}" y="{y0:g}" width="{w:g}" height="{h:g}" fill="{bg}"/>\n' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:g} {y0:g} {w:g} {h:g}" '
            f'width="{w / SCALE:g}" height="{h / SCALE:g}" role="img" aria-label="{title}">\n'
            f'<title>{title}</title>\n{rect}{inner}\n</svg>\n')


def padded(b, p=PAD):
    return (b[0] - p, b[1] - p, b[2] + p, b[3] + p)


def split(paths, y):
    """Partition traced paths by their start point (top edge of each contour)."""
    return [p for p in paths if p[3] < y], [p for p in paths if p[3] >= y]


def bbox_of(paths_src_bbox):
    return paths_src_bbox


def write(name, text):
    with open(os.path.join(HERE, name), "w", encoding="utf-8") as fh:
        fh.write(text)
    print("wrote", name)


def place(inner, sx, tx, ty):
    return f'<g transform="translate({tx:g},{ty:g}) scale({sx:g})">\n{inner}\n</g>'


def contour_bbox(src, palette, keep):
    """Pixel bbox (SVG units) of the prepped image rows selected by keep(y)."""
    rgba = prep(src, palette)
    mask = rgba[..., 3] > 0
    rows = np.arange(mask.shape[0])
    mask[~keep(rows)] = False
    ys, xs = np.nonzero(mask)
    return (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)


if __name__ == "__main__":
    src = lambda n: os.path.join(ASSETS, n)

    # Mascot (full colour)
    mascot, mb = trace(src("mascot.png"), MASCOT)
    write("catera-mascot.svg", svg_doc("Catera mascot", padded(mb), body(mascot)))

    # Wordmark: "Catera" and tagline split at the gap between them.
    wm, wb = trace(src("wordmark.png"), MONO)
    rgba = prep(src("wordmark.png"), MONO)
    rows = np.nonzero(rgba[..., 3].any(1))[0]
    gaps = np.nonzero(np.diff(rows) > 1)[0]
    cut = rows[gaps[0]] + (rows[gaps[0] + 1] - rows[gaps[0]]) // 2   # first empty band
    name, tag = split(wm, cut)
    nb = contour_bbox(src("wordmark.png"), MONO, lambda r: r < cut)
    tb = contour_bbox(src("wordmark.png"), MONO, lambda r: r >= cut)
    write("catera-wordmark-tagline.svg", svg_doc("Catera — Good Food on Repeat", padded(wb), body(wm)))
    write("catera-wordmark.svg", svg_doc("Catera", padded(nb), body(name)))
    write("catera-wordmark-tagline-cream.svg", svg_doc("Catera — Good Food on Repeat", padded(wb), body(wm, CREAM)))
    write("catera-wordmark-cream.svg", svg_doc("Catera", padded(nb), body(name, CREAM)))

    # Monochrome stacked logo (line-art interpretation from logo-forest.png)
    mono, mob = trace(src("logo-forest.png"), MONO)
    write("catera-logo-stacked-forest.svg", svg_doc("Catera", padded(mob), body(mono)))
    write("catera-logo-stacked-cream.svg", svg_doc("Catera", padded(mob), body(mono, CREAM)))
    m_rgba = prep(src("logo-forest.png"), MONO)
    # Mascot and wordmark share rows here (box bottom vs. the C's top), so split on path start
    # points instead: the widest gap between start y values in the band where they meet.
    H = m_rgba.shape[0]
    ys = sorted(p[3] for p in mono if 0.5 * H < p[3] < 0.8 * H)
    i = max(range(len(ys) - 1), key=lambda j: ys[j + 1] - ys[j])
    m_cut = (ys[i] + ys[i + 1]) / 2
    mono_mascot, _ = split(mono, m_cut)
    n, _, stats, _ = cv2.connectedComponentsWithStats((m_rgba[..., 3] > 0).astype(np.uint8), 8)
    parts = [st for st in stats[1:] if st[1] < m_cut]          # components starting above the cut
    mmb = (min(st[0] for st in parts), min(st[1] for st in parts),
           max(st[0] + st[2] for st in parts), max(st[1] + st[3] for st in parts))
    write("catera-mascot-forest.svg", svg_doc("Catera mascot", padded(mmb), body(mono_mascot)))
    write("catera-mascot-cream.svg", svg_doc("Catera mascot", padded(mmb), body(mono_mascot, CREAM)))

    # Lockups composed from the colour mascot and the wordmark.
    def lockups(mascot_inner, mascot_box, wm_inner, wm_box, tag_wm_inner, tag_wm_box, suffix, label):
        mw, mh = mascot_box[2] - mascot_box[0], mascot_box[3] - mascot_box[1]
        for kind, inner_w, box_w in (("", wm_inner, wm_box), ("-tagline", tag_wm_inner, tag_wm_box)):
            ww, wh = box_w[2] - box_w[0], box_w[3] - box_w[1]
            # Horizontal: wordmark cap height block = 46% of mascot height, centred.
            s = (mh * (0.46 if kind == "" else 0.60)) / wh
            gap = mh * 0.10
            tx, ty = mw + gap, (mh - wh * s) / 2
            inner = (place(mascot_inner, 1, -mascot_box[0], -mascot_box[1]) +
                     place(inner_w, s, tx - box_w[0] * s, ty - box_w[1] * s))
            W, H = tx + ww * s, mh
            write(f"catera-lockup-horizontal{kind}{suffix}.svg", svg_doc(label, padded((0, 0, W, H)), inner))
            # Stacked: wordmark width = 112% of mascot width, below with a small gap.
            s2 = (mw * 1.12) / ww
            W2 = max(mw, ww * s2)
            mx = (W2 - mw) / 2
            wy = mh + mh * 0.04
            inner2 = (place(mascot_inner, 1, mx - mascot_box[0], -mascot_box[1]) +
                      place(inner_w, s2, (W2 - ww * s2) / 2 - box_w[0] * s2, wy - box_w[1] * s2))
            write(f"catera-lockup-stacked{kind}{suffix}.svg",
                  svg_doc(label, padded((0, 0, W2, wy + wh * s2)), inner2))

    lockups(body(mascot), mb, body(name), nb, body(wm), wb, "", "Catera")
    lockups(body(mono_mascot), mmb, body(name), nb, body(wm), wb, "-forest", "Catera")
    lockups(body(mono_mascot, CREAM), mmb, body(name, CREAM), nb, body(wm, CREAM), wb, "-cream", "Catera")

    # App icon: full-bleed square, no corner mask (the OS supplies it).
    icon, _ = trace(src("app-icon.png"), ICON)
    w = h = 1254 * SCALE
    write("catera-app-icon.svg", svg_doc("Catera", (0, 0, w, h), body(icon), FOREST))
