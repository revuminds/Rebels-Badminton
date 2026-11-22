#!/usr/bin/env python3
"""Cut Rebel sprite frames out of a sheet (figures in a row on a white background).

Usage:  python3 tools/rebel_cut.py <sheet.jpg|png> <anim>[:i,j,..] [<anim>:i ...]
  e.g.  python3 tools/rebel_cut.py run.jpg run
        python3 tools/rebel_cut.py views.jpg turn:3,2,1 back:5
        python3 tools/rebel_cut.py actions.jpg idle:1 wave:3 thumbs:4 cheer:5

Each figure is cut out (white background removed, soft edge, no white halo), scaled with the
SAME factor for every sheet (so sizes match) and placed in a fixed cell with the feet on one
baseline and the body centred. Frames go to web/rebel/<anim>/01.png, 02.png ... (old frames in
that folder are replaced). tools/build.py packs every web/rebel/<anim>/ folder into the app –
no code change needed. Optional web/rebel/<anim>/anim.json: {"fps": 10, "loop": true}.
"""
import sys, json, pathlib
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'web' / 'rebel'
CELL_W, CELL_H, BASE = 300, 360, 352      # cell size (px) and baseline y (feet) inside the cell
SCALE = 0.36                              # source px → cell px (source figures ≈ 900 px tall → ≈ 325 px)


def cutout(path):
    im = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    d = (255 - im).max(2)                               # distance from white
    near = d <= 16
    lab, _ = ndimage.label(near)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, edge[edge > 0])                   # white connected to the border only
    fg = ~bg
    fg = ndimage.binary_opening(fg, iterations=1)
    # soft edge: inside a 2 px band around the background, alpha follows the distance from white
    band = fg & ndimage.binary_dilation(bg, iterations=2)
    a = fg.astype(np.float32)
    a[band] = np.clip((d[band] - 10) / 40, 0, 1)
    # remove the white fringe: un-blend edge pixels from white
    rgb = im.copy()
    m = (a > 0.02) & (a < 1)
    for c in range(3):
        ch = rgb[..., c]
        ch[m] = np.clip((ch[m] - (1 - a[m]) * 255) / a[m], 0, 255)
    return rgb, a


def figures(a):
    lab, n = ndimage.label(a > 0.5, structure=np.ones((3, 3)))
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    objs = ndimage.find_objects(lab)
    big = [i for i in range(n) if sizes[i] > 20000]
    big.sort(key=lambda i: objs[i].__getitem__(1).start)
    owner = np.zeros(n, int) - 1
    cx = [(objs[i][1].start + objs[i][1].stop) / 2 for i in range(n)]
    for i in range(n):
        if sizes[i] < 30: continue                       # specks
        if i in big: owner[i] = big.index(i); continue
        owner[i] = int(np.argmin([abs(cx[i] - cx[j]) for j in big]))
    masks = []
    for k in range(len(big)):
        ids = [i + 1 for i in range(n) if owner[i] == k]
        mk = np.isin(lab, ids)
        mk = ndimage.binary_dilation(mk, iterations=3)   # keep the soft edge pixels
        masks.append(mk)
    return masks


def frame(rgb, a, mask):
    al = np.where(mask, a, 0)
    ys, xs = np.nonzero(al > 0.05)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    # horizontal anchor = centre of the head + torso (top 55 %), so swinging legs don't make it jitter
    top = al[y0:y0 + int((y1 - y0) * 0.55), x0:x1]
    w = top.sum(0); ax = x0 + (w * np.arange(len(w))).sum() / w.sum()
    rgba = np.dstack([rgb, al * 255]).clip(0, 255).astype(np.uint8)
    crop = Image.fromarray(rgba[y0:y1, x0:x1], 'RGBA')
    cw, ch = max(1, round((x1 - x0) * SCALE)), max(1, round((y1 - y0) * SCALE))
    crop = crop.resize((cw, ch), Image.LANCZOS)
    cell = Image.new('RGBA', (CELL_W, CELL_H), (0, 0, 0, 0))
    px = round(CELL_W / 2 - (ax - x0) * SCALE); py = BASE - ch
    cell.alpha_composite(crop, (px, py)) if px >= 0 and py >= 0 and px + cw <= CELL_W else cell.paste(crop, (px, py), crop)
    return cell


def main():
    src = sys.argv[1]; specs = sys.argv[2:]
    rgb, a = cutout(src)
    masks = figures(a)
    print(src, len(masks), 'figures')
    frames = [frame(rgb, a, m) for m in masks]
    for sp in specs:
        anim, _, idx = sp.partition(':')
        pick = [int(i) for i in idx.split(',')] if idx else list(range(1, len(frames) + 1))
        d = OUT / anim; d.mkdir(parents=True, exist_ok=True)
        for old in d.glob('*.png'): old.unlink()
        for k, i in enumerate(pick, 1):
            frames[i - 1].save(d / ('%02d.png' % k), optimize=True)
        print(' ', anim, '←', pick)


if __name__ == '__main__':
    main()
