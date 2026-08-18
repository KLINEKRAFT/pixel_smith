# bench — measuring the grid detector

Grid detection is the hard part of Pixel Smith and the part that kept
regressing: fixing one class of image quietly broke another, because there was
only ever one hand-made test to check against, and that test had been shaped to
suit the tool rather than the other way round.

This wires Pixel Smith into [**pixel-bench**](https://github.com/Retro-Diffusion/pixel-bench)
(MIT, by Retro Diffusion), an open benchmark that takes native pixel art,
damages it through 43 categories of real-world distortion — fractional and
non-square upscales, blur, JPEG, grid drift, AI-upscaler mush, painterly fakes,
broken outlines, dead pixels — and scores how well a tool recovers the original.

The point is that **every change to the detector now gets a number** instead of
an opinion.

## What it measures

| Signal | Meaning |
|---|---|
| `exact` | both cols and rows exactly right — the one that matters |
| `within1` | both within ±1 cell |
| `grid_align` | do the detected grid lines sit on the true grid |
| `pixel_match` | share of native pixels exactly right |
| `delta_e` | mean CIELAB colour error |

Read `rel err`, `pixel match` and `ΔE` with care when `exact` is low: a method
that refuses to snap returns the source at full resolution, which trivially
"matches" per pixel after nearest-resampling and posts a flattering ΔE. `exact`
and `grid_align` are the honest columns.

## Running it

```sh
git clone https://github.com/Retro-Diffusion/pixel-bench
python3 -m venv venv && ./venv/bin/pip install numpy scipy opencv-python-headless Pillow

# a corpus of native 1x art (or point it at your own folder of real pixel art)
./venv/bin/python bench/make_corpus.py corpus 60

# register Pixel Smith as a method
cp bench/pixelsmith.py pixel-bench/pixelbench/methods/
export PIXELSMITH_BRIDGE=$PWD/bench/psbridge.mjs

PYTHONPATH=pixel-bench ./venv/bin/python -m pixelbench.cli \
    run --data corpus --out results/run.json --methods pixelsmith,naive --workers 1
```

To compare against Retro Diffusion's own converter, also
`pip install ./pixel-art-fixer/python` and add `fixer` to `--methods`.

## How it runs the real code

`psbridge.mjs` does **not** contain a copy of the algorithm. It reads
`../index.html`, pulls the named functions straight out of the shipped
`<script>` by brace-matching, and evaluates them against a small `ImageData`
shim in node. So the benchmark measures exactly what ships, and cannot drift
away from it as the app changes.

It speaks a length-prefixed binary protocol on stdin/stdout so one node process
serves the whole run:

```
in : [magic u32][w u32][h u32][w*h*4 RGBA]
out: [cols u32][rows u32][cols*rows*4 RGBA]
```

Two methods register: `pixelsmith` (shipped behaviour, gates included) and
`pixelsmith_nogate` (the same detector with the refusal gates removed), which
separates "the detector was wrong" from "the gate was cautious".

One difference from the app, deliberately: the bridge reconstructs the **whole
frame** on the detected grid and does not key out the background, because
pixel-bench scores the full native canvas. The app additionally crops to the
drawn art and keys backgrounds, which is right for sprite prep and would score
as an error here.

## The corpus

`make_corpus.py` generates synthetic native sprites — characters, items, tiles
and scenes with outlines, shading ramps, dithering and transparency, across the
sizes Pixel Smith targets. It is synthetic, so it is **not** a substitute for
real artist output, and absolute numbers on it are not comparable to the
numbers in pixel-bench's own README. Every method sees the identical corpus,
so the comparison between methods is fair. Point `--data` at a folder of real
1x pixel art when you have one; `pixelbench validate` will warn if anything in
it is not actually native.

## Where we stand

Measured on a 60-sprite synthetic corpus, 8 images × 43 categories:

| Method | Exact % | Grid align % |
|---|---|---|
| Pixel Smith, old edge-energy comb | 2.9 | 38.2 |
| Naive baseline | 4.4 | 42.5 |
| **Pixel Smith, distillability** | **29.4** | **57.8** |
| Retro Diffusion Pixel Art Fixer | 76.5 | 89.7 |

The old detector scored below the zero-effort baseline. The current one is a
10x improvement and clears the baseline properly, but the per-category split
shows exactly what kind of detector it is.

Strongest — geometric damage, where the photometry survives:

| Category | Smith | Naive | Fixer |
|---|---|---|---|
| `clean_nn` integer upscale | **100%** | 100% | 62% |
| `fractional` non-integer scale | **100%** | 12% | 88% |
| `color_field` colour cast | **100%** | 0% | 88% |
| `subpixel_shift` | 88% | 0% | 88% |
| `banding` posterised | **88%** | 12% | 75% |

Weakest — heavy photometric damage, where it scores zero:

| Category | Smith | Naive | Fixer |
|---|---|---|---|
| `alpha_halo` composite fringe | 0% | 0% | 100% |
| `dead_cells` wrong native pixels | 0% | 0% | 100% |
| `cell_texture` painterly infill | 0% | 0% | 100% |
| `break_outlines` | 0% | 0% | 88% |
| `ai_upscale` soft + sharpened + glow | 0% | 0% | 62% |

That split is the honest description of within-cell variance as a signal: it
is structural, so it reads geometry well and dies when the photometry inside
the cells is destroyed. A smeared cell is locally linear, and a linear ramp
has the same variance wherever you cut it, so phase — the thing the whole
method leans on — stops mattering.

Closing that gap needs genuinely independent detectors voting rather than more
tuning of this one: run-length combs over boundary distances (phase-free, and
strong exactly where this is weak) and shift self-similarity. Retro Diffusion
run three cheap detectors and arbitrate when they disagree, which is why they
lead every category. Note `ai_upscale` at 0% is the most commercially relevant
miss, since it is literally the input this tool exists for — though the
smoother, blockier fake art the app is usually handed does work (see the hero
case in the app test suite).
