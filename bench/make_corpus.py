"""Generate a corpus of native 1x pixel art for pixel-bench.

pixel-bench ships no corpus; you point it at your own folder of true 1x art.
This makes a varied synthetic one: characters, items, tiles and scenes, with
outlines, shading ramps, dithering and transparency, across the sprite sizes
and palette sizes Pixel Smith actually targets. It is synthetic, so it is not
a substitute for real artist output — but every method sees the identical
corpus, so the comparison between them is fair.
"""
import os, random, sys
import numpy as np
from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else "corpus"
N   = int(sys.argv[2]) if len(sys.argv) > 2 else 60
os.makedirs(OUT, exist_ok=True)

def ramp(base, n=4):
    """A shading ramp: darker->lighter, the way a pixel artist builds one."""
    r, g, b = base
    out = []
    for i in range(n):
        t = (i - (n - 1) / 2) / max(1, n)
        out.append((int(np.clip(r + t * 90, 0, 255)),
                    int(np.clip(g + t * 90, 0, 255)),
                    int(np.clip(b + t * 90, 0, 255))))
    return out

def new(w, h, bg=(0, 0, 0, 0)):
    a = np.zeros((h, w, 4), np.uint8); a[:, :] = bg; return a

def rect(a, x, y, w, h, c):
    a[max(0,y):y+h, max(0,x):x+w] = (*c, 255)

def px(a, x, y, c):
    if 0 <= y < a.shape[0] and 0 <= x < a.shape[1]: a[y, x] = (*c, 255)

def outline(a, c=(20, 18, 26)):
    """8-neighbour dilation of the alpha mask, painted underneath — the same
    definition of an outline Pixel Smith uses."""
    m = a[..., 3] > 0
    d = np.zeros_like(m)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dx == 0 and dy == 0: continue
            d |= np.roll(np.roll(m, dy, 0), dx, 1)
    ring = d & ~m
    a[ring] = (*c, 255)

def dither(a, x, y, w, h, c1, c2):
    for j in range(y, y + h):
        for i in range(x, x + w):
            px(a, i, j, c1 if (i + j) % 2 == 0 else c2)

def character(rng, w, h):
    a = new(w, h)
    skin = ramp(( 224, 168, 120))
    cloth = ramp((rng.randint(40,120), rng.randint(40,140), rng.randint(80,180)))
    hair = ramp((rng.randint(30,90), rng.randint(20,70), rng.randint(20,60)))
    cx = w // 2
    hh = max(3, h // 5)                    # head
    rect(a, cx - hh//2, h//8, hh, hh, skin[2])
    rect(a, cx - hh//2, h//8, hh, max(1,hh//3), hair[1])
    tw = max(4, int(w * 0.5)); th = max(4, int(h * 0.34))
    ty = h//8 + hh
    rect(a, cx - tw//2, ty, tw, th, cloth[2])       # torso
    rect(a, cx - tw//2, ty, max(1,tw//4), th, cloth[1])   # shading
    aw = max(2, tw//4)
    rect(a, cx - tw//2 - aw, ty, aw, int(th*0.8), cloth[2])
    rect(a, cx + tw//2,      ty, aw, int(th*0.8), cloth[2])
    lh = h - (ty + th) - max(1, h//10)
    lw = max(2, tw//3)
    rect(a, cx - tw//2 + 1, ty+th, lw, lh, cloth[0])
    rect(a, cx + tw//2 - lw - 1, ty+th, lw, lh, cloth[0])
    rect(a, cx - tw//2, h - max(1,h//10), lw+1, max(1,h//10), hair[0])
    rect(a, cx + tw//2 - lw - 2, h - max(1,h//10), lw+1, max(1,h//10), hair[0])
    if rng.random() < .5:
        dither(a, cx - tw//2, ty + th//2, tw, max(2,th//4), cloth[2], cloth[1])
    px(a, cx - hh//4, h//8 + hh//2, (20,20,30))
    px(a, cx + hh//4, h//8 + hh//2, (20,20,30))
    outline(a)
    return a

def item(rng, w, h):
    a = new(w, h)
    m = ramp((rng.randint(90,200), rng.randint(90,200), rng.randint(90,200)))
    cx, cy = w//2, h//2
    r = min(w, h)//3
    for j in range(h):
        for i in range(w):
            if (i-cx)**2 + (j-cy)**2 <= r*r:
                a[j, i] = (*m[2 if (i+j) % 3 else 1], 255)
    rect(a, cx - max(1,w//12), cy - r - max(2,h//6), max(2,w//6), max(2,h//6), m[0])
    for k in range(r):                      # a diagonal highlight (stair steps)
        px(a, cx - r//2 + k, cy - r//2 + k, m[3])
    outline(a)
    return a

def tile(rng, w, h):
    """Opaque tileable texture — no alpha, tests the no-transparency path."""
    a = new(w, h, (0,0,0,255))
    base = ramp((rng.randint(60,140), rng.randint(70,150), rng.randint(50,120)), 5)
    a[:, :] = (*base[2], 255)
    for _ in range(rng.randint(6, 18)):
        bw, bh = rng.randint(2, max(3,w//3)), rng.randint(2, max(3,h//3))
        x, y = rng.randint(0, w-bw), rng.randint(0, h-bh)
        rect(a, x, y, bw, bh, base[rng.randint(0, 4)])
    for i in range(0, w, max(2, w//8)):
        for j in range(h):
            if (i + j) % 2 == 0: px(a, i, j, base[0])
    return a

def scene(rng, w, h):
    a = new(w, h, (0,0,0,255))
    sky = ramp((70, 110, 180), 5); ground = ramp((60, 120, 60), 5)
    for j in range(h):
        a[j, :] = (*sky[min(4, j * 5 // max(1,h))], 255)
    gy = int(h * 0.62)
    rect(a, 0, gy, w, h - gy, ground[2])
    dither(a, 0, gy - 2, w, 2, sky[2], ground[2])
    for _ in range(rng.randint(2, 5)):
        bw = rng.randint(max(2,w//10), max(4,w//5)); bh = rng.randint(max(3,h//6), max(5,h//3))
        x = rng.randint(0, max(0, w - bw))
        rect(a, x, gy - bh, bw, bh, ground[0])
        rect(a, x, gy - bh, max(1,bw//3), bh, ground[1])
    return a

MAKERS = [character, character, item, tile, scene]
SIZES  = [(16,16),(24,24),(32,32),(48,48),(64,64),(32,48),(48,64),(64,96),(96,96),(40,72),(56,56),(80,64)]

rng = random.Random(20260817)
for i in range(N):
    mk = MAKERS[i % len(MAKERS)]
    w, h = SIZES[i % len(SIZES)]
    a = mk(rng, w, h)
    Image.fromarray(a, "RGBA").save(os.path.join(OUT, f"{mk.__name__}_{w}x{h}_{i:03d}.png"))
print(f"wrote {N} native sprites to {OUT}/")
