"""Dump pixel-bench distorted cases to disk once, so the detector can be
iterated in pure node without a Python round trip.

Uses the benchmark's own engine and seeds, so a case here is bit-identical to
the case the real runner would score.

    python dump_cases.py <corpus> <outdir> [n_images] [categories...]

Writes outdir/<category>/<image>.raw   little-endian: [w u32][h u32][RGBA...]
and   outdir/index.json  with ground-truth cols/rows per case.
"""
import json, os, sys
import numpy as np

sys.path.insert(0, os.environ.get("PIXELBENCH", "pixel-bench"))

from pixelbench.data import list_images, load_art
from pixelbench.distort import make_spec, distort, category_names, damage_native
from pixelbench.distort.suite import _seed as _suite_seed
from pixelbench.runner import _clamp, MIN_DISTORTED_SIDE, MAX_SOURCE_SIDE

corpus = sys.argv[1]
outdir = sys.argv[2]
n_img  = int(sys.argv[3]) if len(sys.argv) > 3 else 8
cats   = sys.argv[4:] or list(category_names())

# Select exactly as pixelbench.runner.run does, or the fast loop silently
# measures a different (and usually easier) subset than the real benchmark —
# that cost 14 points of phantom progress once.
paths = list_images(corpus, max_side=MAX_SOURCE_SIDE)
if n_img and n_img < len(paths):
    idx = np.random.default_rng(1234).choice(len(paths), n_img, replace=False)
    paths = [paths[i] for i in sorted(idx)]
os.makedirs(outdir, exist_ok=True)
index = []

for cat in cats:
    d = os.path.join(outdir, cat)
    os.makedirs(d, exist_ok=True)
    for p in paths:
        image_id = os.path.basename(p)
        art = load_art(p, np.random.default_rng(_suite_seed(image_id, "bg")))
        art = damage_native(cat, image_id, art)          # native damage -> new GT
        h, w = art.shape[:2]
        spec = _clamp(w, h, make_spec(cat, image_id, 1.0))
        o = distort(art, spec, np.random.default_rng(spec.seed))
        img = o["img"]
        if min(img.shape[:2]) < MIN_DISTORTED_SIDE:
            continue
        rgba = np.dstack([img, np.full(img.shape[:2], 255, np.uint8)]).astype(np.uint8)
        dh, dw = rgba.shape[:2]
        name = image_id.replace(".png", "") + ".raw"
        with open(os.path.join(d, name), "wb") as f:
            f.write(np.array([dw, dh], "<u4").tobytes())
            f.write(np.ascontiguousarray(rgba).tobytes())
        index.append({"category": cat, "image": image_id, "file": f"{cat}/{name}",
                      "gt_cols": int(w), "gt_rows": int(h),
                      "dist_w": int(dw), "dist_h": int(dh)})

json.dump(index, open(os.path.join(outdir, "index.json"), "w"))
print(f"dumped {len(index)} cases across {len(cats)} categories to {outdir}/")
