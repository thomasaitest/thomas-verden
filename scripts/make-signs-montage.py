#!/usr/bin/env python3
from PIL import Image
from pathlib import Path
import sys
out = Path(sys.argv[1] if len(sys.argv) > 1 else '/workspace/heddas-verden-shots/next')
names = ['02-shop-3d-sign','03-vet-cross-sign','03b-sign-eggbutikk','03c-sign-bilbutikk','03d-sign-dyrebutikk']
imgs = []
for n in names:
    fp = out / f'{n}.png'
    if fp.exists():
        imgs.append(Image.open(fp).convert('RGB'))
if not imgs:
    raise SystemExit('no sign shots')
w, h = 640, 450
imgs = [im.resize((w, h)) for im in imgs]
cols, rows = 3, 2
pad = 10
canvas = Image.new('RGB', (cols * w + (cols + 1) * pad, rows * h + (rows + 1) * pad), (232, 244, 255))
for i, im in enumerate(imgs):
    r, c = i // cols, i % cols
    canvas.paste(im, (pad + c * (w + pad), pad + r * (h + pad)))
dest = out / '03-shop-signs-montage.png'
canvas.save(dest)
print('saved', dest)
