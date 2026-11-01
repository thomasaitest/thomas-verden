#!/usr/bin/env python3
import sys
from PIL import Image
concept, shot, dest = sys.argv[1:4]
a = Image.open(concept).convert('RGB')
b = Image.open(shot).convert('RGB')
h = min(a.height, b.height, 900)
def rs(im):
  r = h / im.height
  return im.resize((max(1, int(im.width * r)), h), Image.LANCZOS)
a, b = rs(a), rs(b)
out = Image.new('RGB', (a.width + b.width + 16, h), (20, 24, 30))
out.paste(a, (0, 0))
out.paste(b, (a.width + 16, 0))
out.save(dest, quality=92)
print('wrote', dest)
