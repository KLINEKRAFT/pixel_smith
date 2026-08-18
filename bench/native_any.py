"""NATIVE-ART PROBE for any pixel-bench method.

pixel-bench only ever feeds upscaled images, so it cannot see the failure that
matters most to a user: dropping in art that is ALREADY native and getting it
rewritten. This runs each method over a corpus of genuine 1x art and asks the
only question that matters there — did it leave the art alone?

    python native_any.py <corpusdir> <method> [method...]
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "rd", "pixel-bench"))

from pixelbench.data import list_images, load_art
from pixelbench.methods import get_method
from pixelbench.distort.suite import _seed as _suite_seed

corpus = sys.argv[1]
names = sys.argv[2:] or ["pixelsmith"]

paths = list_images(corpus)
for name in names:
    m = get_method(name)
    if not m.available():
        print(f"{name:14s} UNAVAILABLE")
        continue
    n = safe = 0
    bad = []
    for p in paths:
        image_id = os.path.basename(p)
        art = load_art(p, np.random.default_rng(_suite_seed(image_id, "bg")))
        h, w = art.shape[:2]
        rgb = art[:, :, :3] if art.shape[2] >= 3 else art
        try:
            r = m.reconstruct(np.ascontiguousarray(rgb))
            cols, rows = r.size()
        except Exception as e:                      # a crash is not "safe"
            cols, rows = None, None
            bad.append(f"{image_id} {w}x{h} -> ERROR {e}")
        n += 1
        # Untouched is the only correct answer on art that is already native.
        ok = cols == w and rows == h
        safe += ok
        if not ok and cols is not None and len(bad) < 10:
            bad.append(f"{image_id} {w}x{h} -> {cols}x{rows}")
    for b in bad:
        print("   MANGLED " + b)
    print(f"{name:14s} NATIVE-SAFE {safe/n*100:5.1f}%  ({safe}/{n})")
