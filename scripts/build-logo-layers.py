"""Crop + downscale the 4096px AusMC logo layers for the web.

Each layer is cropped to its own bounding box (snapped to a 16px grid so that
every piece lands on whole pixels at the target scale), then resized with
premultiplied alpha so edges keep clean, fringe-free transparency.
Writes public/logo/*.png and src/data/logo-layers.json.
"""
import json, os, sys
from PIL import Image
import numpy as np

SRC = os.path.join(os.path.dirname(__file__), '..', '..')
OUT_IMG = os.path.join(os.path.dirname(__file__), '..', 'public', 'logo')
OUT_JSON = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'logo-layers.json')
SRC_SIZE, DST_SIZE, GRID = 4096, 1280, 16          # 16 src px == 5 dst px
SCALE = DST_SIZE / SRC_SIZE

manifest = json.load(open(os.path.join(SRC, 'layer-manifest.json')))
ids = ['badge', 'ring', 'text-top', 'text-bottom', 'leaf-left', 'leaf-right',
       'mainland', 'tasmania', 'jack-white', 'jack-red', 'star-commonwealth',
       'star-top', 'star-left', 'star-right', 'star-small', 'star-bottom']

def snap_down(v): return max(0, (v // GRID) * GRID)
def snap_up(v): return min(SRC_SIZE, -(-v // GRID) * GRID)

layers = []
total_px = 0
for lid, entry in zip(ids, manifest['layers']):
    im = Image.open(os.path.join(SRC, entry['file'])).convert('RGBA')
    a = np.asarray(im.getchannel('A'))
    ys, xs = np.nonzero(a > 0)
    pad = GRID
    x0, y0 = snap_down(xs.min() - pad), snap_down(ys.min() - pad)
    x1, y1 = snap_up(xs.max() + 1 + pad), snap_up(ys.max() + 1 + pad)
    crop = im.crop((x0, y0, x1, y1))
    w, h = round((x1 - x0) * SCALE), round((y1 - y0) * SCALE)
    small = crop.convert('RGBa').resize((w, h), Image.LANCZOS).convert('RGBA')
    # zero out colour where fully transparent (smaller files, no stray fringes)
    arr = np.array(small)
    arr[arr[..., 3] == 0] = 0
    small = Image.fromarray(arr, 'RGBA')
    fname = f"{lid}.png"
    small.save(os.path.join(OUT_IMG, fname), optimize=True)
    total_px += w * h
    layers.append({'id': lid, 'label': entry['label'], 'src': f'logo/{fname}',
                   'x': round(x0 * SCALE), 'y': round(y0 * SCALE), 'w': w, 'h': h})

json.dump({'size': DST_SIZE, 'layers': layers}, open(OUT_JSON, 'w'), indent=2)

# full composite for nav / favicon / social
comp = Image.new('RGBA', (DST_SIZE, DST_SIZE), (0, 0, 0, 0))
for L in layers:
    comp.alpha_composite(Image.open(os.path.join(OUT_IMG, f"{L['id']}.png")), (L['x'], L['y']))
for size in (512, 192):
    comp.convert('RGBa').resize((size, size), Image.LANCZOS).convert('RGBA') \
        .save(os.path.join(OUT_IMG, f'badge-{size}.png'), optimize=True)
comp.save(os.path.join(OUT_IMG, 'badge-1280.png'), optimize=True)
print(f"decoded memory for all layers ≈ {total_px * 4 / 1e6:.1f} MB (vs {16 * 4096 * 4096 * 4 / 1e6:.0f} MB originals)")
