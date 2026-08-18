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

The bridge self-tests on startup and the adapter kills the run if it ever
dies. Both exist because the extraction list went stale once: `detectGrid`
threw on every image, the adapter had `stderr=DEVNULL`, and the runner drops
errored rows from the aggregate — so a completely dead bridge looked like a
run that was working, for ten minutes.

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

The **full** 60-image corpus, 2580 scored inputs, every method scored by
pixel-bench's own runner in one process:

| Method | Exact % | Grid align % | Native-safe % |
|---|---|---|---|
| Pixel Smith, old edge-energy comb | 2.9 | 38.2 | - |
| Naive baseline | 3.7 | 41.7 | 80.0 |
| Pixel Smith, two detectors + arbiter | 57.3 | 85.0 | 22.5 |
| **Pixel Smith, coherence ranking + native guard** | **66.7** | **79.1** | **68.3** |
| Retro Diffusion Pixel Art Fixer | **72.4** | **88.8** | **0.0** |

Two columns of merit, because one of them the benchmark cannot see. Pixel Art
Fixer is still ahead on exact native size by 5.7 points, and ahead in 30
categories of 43. It is 0 for 60 on leaving native art alone.

The 5.7 points split cleanly, measured by re-running the full corpus with
`GRID.NATIVE_R` set to 0:

| Build | Exact % | Native-safe % |
|---|---|---|
| Pixel Art Fixer | 72.4 | 0.0 |
| Pixel Smith, native guard OFF | 68.4 | ~22.5 |
| Pixel Smith, shipped (`NATIVE_R` 2.0) | 66.7 | 68.3 |

**4.0 points are genuine detector error** — they are still there with the
guard disabled, and they live entirely in the photometric-damage categories
below. **1.7 points are what native safety costs**, buying a 45.8-point gain
in not rewriting the user's own art. Worth it, but a real price, not free.

`NATIVE_R` was tuned on the 8-image subset and has deliberately not been
re-tuned against the full corpus — doing that would turn the full corpus into
the tuning set and leave nothing honest to report against.

### Always quote the full corpus

`dump_cases.py` produces an 8-image subset for fast iteration. It is **not** a
substitute for a full run. Measured on that subset the exact-resolution
comparison read 77.0 for Pixel Smith against 76.5 for Pixel Art Fixer; on all
60 images it reads 66.7 against 72.4. Ten points, and the sign flipped. A
0.5-point lead on 344 samples was always inside the noise, and reading it as
real cost a retracted claim.

This is the second version of the same mistake — see below — so the rule is
now unconditional: **iterate on the subset, conclude only on the full run.**

### Beware the subset

`pixelbench.runner.run` selects its images with `rng(1234).choice`, NOT the
first N. `dump_cases.py` replicates that exactly, and it must keep doing so: an
earlier version took the first N, measured a materially easier subset, and
reported 69.8% where the real benchmark said 57.3%. Fourteen points of phantom
progress. If the fast loop and a real `pixelbench run` ever disagree by more
than a point or two, suspect the subset before suspecting the detector.

### The failure the benchmark cannot see

pixel-bench only ever feeds **upscaled** images. Every method is scored on one
question — did you find the grid — and nothing in the suite ever asks the
opposite one: handed art that is *already native*, do you leave it alone?

That is not hypothetical for a sprite tool. It is the most damaging thing
Pixel Smith can do, and the most silent: a user drops in their own 48x48
sprite, hits MAKE PIXEL PERFECT, and gets 9x11 back.

`bench/native.mjs` (fast, node, reads the shipped index.html) and
`bench/native_any.py` (any registered pixel-bench method) measure it over the
same corpus at 1x. Passing means refused, or a step the app treats as
already-native.

    node bench/native.mjs corpus
    PYTHONPATH=pixel-bench ./venv/bin/python bench/native_any.py corpus pixelsmith fixer naive

Pixel Art Fixer halves a native 16x16 sprite to 8x8, and does the equivalent
on all 60 images. That is defensible for a converter only ever handed AI
output, and it genuinely buys benchmark score — never refusing cannot cost you
a detection. It is the wrong default for a tool pointed at the user's own art.
Its `confidence` field cannot be used to bolt the check on either: on native
art it reads "medium" 96% of the time, the same as half of genuine upscales,
so no threshold on it refuses native art without also refusing real upscales.

### Why the residual guard failed, and what replaced it

The old guard was "a real grid is near-lossless, so refuse when the best grid
destroys too much variance". It does not work, for two independent reasons:

- **Sprites are mostly flat.** Collapsing 4x4 blocks of *native* art also
  loses almost nothing. Across 116 native axes against 688 upscaled ones the
  residual measured 0.131 against 0.056 — two clouds on top of each other,
  AUC 0.80, and barely better than a coin inside the size band where the
  populations actually overlap.
- **Noise pushes genuine upscales the wrong way**, past any fixed threshold.
  `noise` and `chroma_noise` were refused outright, 5 of 8 and 4 of 8.

The honest question is not what a grid costs but whether one is *there*: the
coherence peak has to stand clear of the incoherent floor of its own spectrum.
That ratio separates the same two populations at **AUC 0.95**, is noise-
tolerant because noise lifts peak and floor together, and is computed entirely
within one image so nothing about scene content or palette leaks in.

**Both axes have to clear it, not either.** An upscale is two-dimensional, so
a real grid shows up twice; native art that happens to have one periodic
direction — a dither band, a row of identical tiles — does not. Taking the
weaker axis rather than the stronger moves the whole trade-off curve outward
instead of sliding along it, worth about two points of benchmark score at
equal native-safety, which no amount of tuning the either-axis threshold buys.

Once both axes must agree, the residual test becomes pure cost and is gone:
removing it was worth 1.1 points of exact for 1.3 points of native-safety, and
it took `chroma_noise` from 50% to 100%. `noise` is still 0%, but now by
honest refusal (6 of 8) rather than by confidently answering 5x8 where the
truth was 32x48 — heavy noise really does drown the coherence peak.

### Choosing the operating point

One constant, `GRID.NATIVE_R`, slides the whole trade-off. On the tuning
corpus:

| `NATIVE_R` | Native-safe % | Exact % |
|---|---|---|
| 1.6 | 58.8 | 76.7 |
| 1.7 | 66.3 | 76.5 |
| **2.0** | **86.3** | **75.9** |
| 2.5 | 96.3 | 72.7 |

(the 2.0 row reads 86.7 / 77.0 once the residual gate is removed as well).

2.0 ships. Raise it if protecting native art matters more than the benchmark:
a refusal is visible and recoverable — the app says so, and the manual pitch
override forces a grid — whereas a wrong snap is silent.

### Two corpora, and what the second one showed

`corpus` is characters and tiles; `corpus_val` is items and scenes at roughly
half the pixel size (min side p10 of 80px against 132px). Held-out exact drops
to 61.6%, which looks alarming until you slide the threshold on that corpus
too: from `NATIVE_R` 1.4 to 2.0 the val bench moves 63.4 -> 61.6 while val
native-safety moves 20 -> 80. The drop is corpus difficulty, not a threshold
that failed to transfer. Small sprites are simply harder for everyone, which
is why the head-to-head has to be run per corpus rather than compared across.

### The asymmetry that governs everything

A too-COARSE grid destroys variance, so any fit measure detects it. A too-FINE
grid fits *perfectly* — splitting one cell into four identical quarters has
exactly zero residual — so **no goodness-of-fit measure can ever rule it out.**

Rayleigh coherence is structurally immune to the coarse error (if boundaries
sit at multiples of d then R(d) = 1 and R(2d) ~ 0, because alternate
boundaries land in antiphase), which is why it replaced the fit-based
ranking — too-coarse was 166 of 212 axis failures. But it inherits the fine
side: a soft GCD ties on subdivisions, R(d/2) = R(d) for a perfect lattice, so
after the change "one octave too fine" became the largest error bucket.

That tie breaks on an asymmetry rather than a threshold. If d is the truth
then R(2d) is ~0; if the candidate is d/2 then R(2*(d/2)) = R(d) is still
high. So the ranking walks to the half count while its coherence holds up
(`GRID.OCT`), judged on coherence only — the variance gate systematically
favours finer grids and would fight the walk.

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
| Short-run share as extra native evidence | AUC said +0.05 in the matched band; end to end it was 1.5-2 points WORSE at equal native-safety. The proxy lied |
| Octave drop, `loss(s/2)/loss(s)`, as native evidence | AUC 0.55 pooled and 0.28 matched — worse than chance. Both losses sit near zero, so the ratio is noise |
| Normalising contrast by `sqrt(ln M)`, `ln len`, `len^k` | worse in every size band. Contrast growing with axis length is real signal, not a confound |
| Concluding from the 8-image subset (twice) | first time: 69.8% reported against a real 57.3%. Second time: a 77.0-vs-76.5 win over Pixel Art Fixer that was really 66.7 vs 72.4. Constants tuned on 344 samples, a sub-point lead read as real |

### The remaining gap

`nonsquare` is no longer given up: the cross-axis stage offers independence as
a third option, priced against the two shared ones by an MDL-style margin
(`GRID.NONSQ`), since two steps is one more parameter than one. 0% -> 80%.

What is left is one coherent class, and it is where all 5.7 remaining points
live: **heavy photometric damage**.

| Category | Smith | Fixer |
|---|---|---|
| `noise` | 0.0 | 46.7 |
| `downup` | 43.3 | 75.0 |
| `blur` | 60.0 | 83.3 |
| `bicubic` | 70.0 | 86.7 |
| `heavy_jpeg` | 16.7 | 33.3 |
| `ai_upscale` | 48.3 | 63.3 |

Coherence reads boundary ENERGY, and low-pass filtering is precisely the
operation that flattens it: the peak and the incoherent floor converge, so
both the ranking and the contrast guard lose their grip at once. That is why
`noise` is 0% by refusal rather than by a wrong answer — an honest failure,
but a failure.

Against that, Pixel Smith leads exactly where photometry survives and only
geometry is damaged: `nonsquare` 80.0 vs 55.0, `cell_texture` 95.0 vs 73.3,
`clean_nn` 93.3 vs 83.3, `cell_noise` 98.3 vs 91.7.

Closing it needs a signal that does not depend on edge contrast at all. The
two candidates worth trying, in order: per-tile phase freedom with local step
integration (what Pixel Art Fixer does, and it wins every one of these
categories), and drift-aware counting — summing `width_i / s_i` over windows
rather than fitting one step across the whole axis.
