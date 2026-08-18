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

Measured on a 20-sprite synthetic corpus, 8 images x 43 categories, all methods
on identical inputs:

| Method | Exact % | Grid align % |
|---|---|---|
| Pixel Smith, old edge-energy comb | 2.9 | 38.2 |
| Naive baseline | 2.3 | 39.8 |
| **Pixel Smith, two detectors + arbiter** | **57.3** | **85.0** |
| Retro Diffusion Pixel Art Fixer | **77.3** | **90.9** |

A 20x improvement on where this started, and grid alignment is now within six
points of Pixel Art Fixer. Exact native size is still 20 points behind, which
is the number that matters most, so this is not yet a win.

### Beware the subset

`pixelbench.runner.run` selects its images with `rng(1234).choice`, NOT the
first N. `dump_cases.py` replicates that exactly, and it must keep doing so: an
earlier version took the first N, measured a materially easier subset, and
reported 69.8% where the real benchmark said 57.3%. Fourteen points of phantom
progress. If the fast loop and a real `pixelbench run` ever disagree by more
than a point or two, suspect the subset before suspecting the detector.

### What each detector is for

Two signals with different physics, because they fail on different images:

| | distillability | YIN on the boundary profile |
|---|---|---|
| reads | within-cell variance | period of the second-difference impulse train |
| `clean_nn` | 100% | 0% |
| `soft_bilinear` | 0% | 50% |
| `dead_cells` | 0% | 38% |
| `drift` | 0% | 38% |

Neither dominates. Fusing them took 30.8% to 52.3% on the old subset; the
arbiter lets both score every candidate, including each proposal's half and
double, because the cheapest way to fix one detector's octave slip is to ask a
detector with different physics which octave it prefers.

### The asymmetry that governs everything

A too-COARSE grid destroys variance, so any fit measure detects it. A too-FINE
grid fits *perfectly* - splitting one cell into four identical quarters has
exactly zero residual - so **no goodness-of-fit measure can ever rule it out.**
Fit kills one side; only a complexity penalty kills the other. That is why the
selection pays for cells (MDL) rather than simply preferring the smallest
plausible step, which fell straight through to the minimum step on ghosted
composites.

### Measured and rejected

Recorded so they are not retried:

| Idea | Result |
|---|---|
| Curvature channels in the variance metric | 54% -> 25%; a smeared edge differentiates into a +/- doublet, halving the apparent period |
| Gradient channels in the same metric | 38%; derivative channels bias the error curve the cap depends on |
| SHR odd/even octave test | too-fine direction never fired; too-coarse cost 5.5 points |
| Overriding with tile-integrated steps on drift | -5 to -12 points; per-window YIN is noisier than the global fit |
| Letting confident axes disagree (to win `nonsquare`) | -11 points; square upscales dominate |
| Dropping the refusal threshold to answer everything | refusals 191 -> 4, exact 30.8% -> 27.6%; the refusals were honest |

### The remaining gap

Weakest categories are `nonsquare` (given up deliberately), `warp`, `mush_warp`,
`block_reset` and `drift` - every one a grid that is not globally uniform, where
no single (step, phase) fits and the global fit collapses rather than degrades.
Pixel Art Fixer handles these with per-tile phase freedom and local step
integration across three independent detectors with deliberately opposite
octave biases. Closing the last 20 points means building that, not tuning this.
