# pixel-bench results

Suite **v1** at severity **1.0** on **60** source images (2580 scored inputs across 43 distortion categories).

Signals (see `docs/METRICS.md`): **exact/±1** native-resolution hit rate, **rel err** median resolution error, **grid align** (do the detected grid lines sit on the true grid, from ground-truth U/V), **pixel match** (share of native pixels exactly right), **ΔE** mean CIELAB colour error. Higher is better except rel err and ΔE.

## Overall

| Method | Exact % | ±1 % | Rel err % | Grid align % | Pixel match % | ΔE |
|---|---|---|---|---|---|---|
| pixelsmith | 66.7 | 68.7 | 0.0 | 79.1 | 75.7 | 1.7 |
| Pixel Art Fixer | 72.4 | 76.7 | 0.0 | 88.8 | 77.2 | 1.1 |
| Naive | 3.7 | 6.6 | 341.4 | 41.7 | 79.0 | 1.3 |

### Colour on the exact-resolution subset

Raw ΔE flatters methods that over-segment. Conditioned on getting the native size exactly right, colour fidelity is like-for-like:

| Method | n (exact) | ΔE | Pixel match % |
|---|---|---|---|
| pixelsmith | 1721 | 1.3 | 77.6 |
| Pixel Art Fixer | 1869 | 0.8 | 78.8 |
| Naive | 95 | 0.0 | 90.9 |

## By distortion category

### ai_upscale (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 48.3 | 48.3 | 11.7 | 64.6 | 3.7 |
| Pixel Art Fixer | 63.3 | 66.7 | 0.0 | 85.8 | 2.9 |
| Naive | 0.0 | 0.0 | 441.6 | 31.2 | 2.1 |

### alpha_halo (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 88.3 | 88.3 | 0.0 | 91.8 | 1.4 |
| Pixel Art Fixer | 88.3 | 88.3 | 0.0 | 96.9 | 0.7 |
| Naive | 0.0 | 0.0 | 397.7 | 34.2 | 0.6 |

### banding (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 93.3 | 93.3 | 0.0 | 96.5 | 5.3 |
| Pixel Art Fixer | 93.3 | 93.3 | 0.0 | 97.8 | 5.4 |
| Naive | 13.3 | 26.7 | 8.6 | 69.0 | 7.0 |

### bicubic (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 70.0 | 70.0 | 0.0 | 81.4 | 1.7 |
| Pixel Art Fixer | 86.7 | 88.3 | 0.0 | 95.1 | 0.6 |
| Naive | 0.0 | 0.0 | 374.5 | 35.9 | 0.5 |

### bilinear (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 85.0 | 85.0 | 0.0 | 89.6 | 1.4 |
| Pixel Art Fixer | 78.3 | 78.3 | 0.0 | 93.5 | 0.8 |
| Naive | 0.0 | 0.0 | 328.4 | 37.6 | 0.5 |

### block_reset (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 43.3 | 68.3 | 1.0 | 61.7 | 0.7 |
| Pixel Art Fixer | 43.3 | 70.0 | 0.8 | 65.2 | 0.8 |
| Naive | 20.0 | 31.7 | 7.8 | 63.2 | 2.5 |

### blur (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 60.0 | 60.0 | 0.0 | 72.7 | 0.7 |
| Pixel Art Fixer | 83.3 | 93.3 | 0.0 | 96.8 | 0.6 |
| Naive | 0.0 | 0.0 | 350.9 | 35.8 | 0.4 |

### break_outlines (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 83.3 | 83.3 | 0.0 | 89.6 | 1.4 |
| Pixel Art Fixer | 88.3 | 90.0 | 0.0 | 97.0 | 0.8 |
| Naive | 0.0 | 0.0 | 405.1 | 34.1 | 0.6 |

### cell_gradient (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 98.3 | 98.3 | 0.0 | 99.6 | 1.5 |
| Pixel Art Fixer | 100.0 | 100.0 | 0.0 | 100.0 | 1.0 |
| Naive | 0.0 | 0.0 | 684.9 | 22.4 | 1.0 |

### cell_noise (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 98.3 | 98.3 | 0.0 | 98.7 | 0.6 |
| Pixel Art Fixer | 91.7 | 91.7 | 0.0 | 96.9 | 0.6 |
| Naive | 0.0 | 0.0 | 613.8 | 25.6 | 0.6 |

### cell_texture (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 95.0 | 95.0 | 0.0 | 96.6 | 9.1 |
| Pixel Art Fixer | 73.3 | 76.7 | 0.0 | 89.5 | 9.6 |
| Naive | 0.0 | 0.0 | 711.7 | 21.7 | 9.2 |

### chroma_noise (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 76.7 | 76.7 | 0.0 | 86.2 | 5.9 |
| Pixel Art Fixer | 85.0 | 85.0 | 0.0 | 96.0 | 6.7 |
| Naive | 0.0 | 0.0 | 393.8 | 35.1 | 5.5 |

### chroma_sub (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 78.3 | 78.3 | 0.0 | 85.2 | 2.1 |
| Pixel Art Fixer | 80.0 | 81.7 | 0.0 | 93.7 | 1.3 |
| Naive | 0.0 | 0.0 | 365.6 | 35.8 | 1.0 |

### clean_nn (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 93.3 | 93.3 | 0.0 | 97.3 | 0.0 |
| Pixel Art Fixer | 83.3 | 83.3 | 0.0 | 91.9 | 0.0 |
| Naive | 80.0 | 80.0 | 0.0 | 90.3 | 0.0 |

### color_field (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 95.0 | 95.0 | 0.0 | 97.4 | 4.5 |
| Pixel Art Fixer | 96.7 | 96.7 | 0.0 | 98.8 | 4.9 |
| Naive | 0.0 | 0.0 | 309.0 | 40.0 | 4.2 |

### dead_cells (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 86.7 | 86.7 | 0.0 | 92.5 | 1.8 |
| Pixel Art Fixer | 96.7 | 96.7 | 0.0 | 99.5 | 0.8 |
| Naive | 0.0 | 0.0 | 338.2 | 36.7 | 0.7 |

### downup (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 43.3 | 43.3 | 37.4 | 62.6 | 1.4 |
| Pixel Art Fixer | 75.0 | 83.3 | 0.0 | 92.5 | 0.3 |
| Naive | 0.0 | 0.0 | 359.1 | 36.1 | 0.3 |

### drift (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 6.7 | 18.3 | 6.2 | 62.2 | 2.3 |
| Pixel Art Fixer | 16.7 | 28.3 | 5.2 | 67.1 | 3.0 |
| Naive | 6.7 | 31.7 | 6.2 | 62.1 | 3.5 |

### fractional (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 95.0 | 95.0 | 0.0 | 96.8 | 0.0 |
| Pixel Art Fixer | 93.3 | 93.3 | 0.0 | 97.9 | 0.0 |
| Naive | 11.7 | 28.3 | 6.2 | 64.1 | 1.2 |

### glow (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 96.7 | 96.7 | 0.0 | 97.7 | 0.6 |
| Pixel Art Fixer | 91.7 | 93.3 | 0.0 | 97.6 | 0.6 |
| Naive | 0.0 | 3.3 | 285.9 | 41.6 | 1.1 |

### grid_soften (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 31.7 | 41.7 | 72.7 | 52.6 | 3.1 |
| Pixel Art Fixer | 38.3 | 71.7 | 1.0 | 80.8 | 1.3 |
| Naive | 0.0 | 0.0 | 340.1 | 37.5 | 0.6 |

### heavy_jpeg (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 16.7 | 16.7 | 82.8 | 50.1 | 6.1 |
| Pixel Art Fixer | 33.3 | 41.7 | 7.7 | 74.5 | 4.6 |
| Naive | 0.0 | 0.0 | 313.5 | 38.1 | 3.2 |

### jitter (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 78.3 | 81.7 | 0.0 | 88.2 | 0.0 |
| Pixel Art Fixer | 85.0 | 88.3 | 0.0 | 96.9 | 0.0 |
| Naive | 6.7 | 18.3 | 8.9 | 65.8 | 1.7 |

### jpeg (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 60.0 | 60.0 | 0.0 | 74.0 | 3.2 |
| Pixel Art Fixer | 68.3 | 70.0 | 0.0 | 86.4 | 2.8 |
| Naive | 0.0 | 0.0 | 359.4 | 36.0 | 2.2 |

### jpeg_twice (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 36.7 | 36.7 | 44.9 | 59.8 | 5.0 |
| Pixel Art Fixer | 40.0 | 46.7 | 10.9 | 75.4 | 3.9 |
| Naive | 0.0 | 0.0 | 345.3 | 36.4 | 2.7 |

### kitchen_sink (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 3.3 | 6.7 | 42.2 | 56.4 | 6.0 |
| Pixel Art Fixer | 11.7 | 21.7 | 7.0 | 64.6 | 6.9 |
| Naive | 0.0 | 0.0 | 511.6 | 28.8 | 5.4 |

### median (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 88.3 | 88.3 | 0.0 | 93.5 | 0.0 |
| Pixel Art Fixer | 91.7 | 96.7 | 0.0 | 99.0 | 0.0 |
| Naive | 6.7 | 21.7 | 8.5 | 66.6 | 1.4 |

### mush (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 66.7 | 66.7 | 0.0 | 79.5 | 1.6 |
| Pixel Art Fixer | 76.7 | 76.7 | 0.0 | 90.7 | 1.4 |
| Naive | 0.0 | 0.0 | 442.0 | 31.8 | 1.4 |

### mush_warp (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 50.0 | 50.0 | 3.1 | 43.4 | 4.3 |
| Pixel Art Fixer | 60.0 | 63.3 | 0.0 | 58.8 | 2.8 |
| Naive | 0.0 | 0.0 | 411.7 | 32.9 | 2.4 |

### native_aa (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 80.0 | 80.0 | 0.0 | 85.1 | 1.6 |
| Pixel Art Fixer | 75.0 | 76.7 | 0.0 | 94.5 | 0.6 |
| Naive | 0.0 | 0.0 | 391.1 | 33.9 | 1.0 |

### noise (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 0.0 | 0.0 | 319.3 | 33.5 | 5.2 |
| Pixel Art Fixer | 46.7 | 50.0 | 1.9 | 84.0 | 4.9 |
| Naive | 0.0 | 0.0 | 397.4 | 33.6 | 3.0 |

### nonsquare (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 80.0 | 80.0 | 0.0 | 94.0 | 0.0 |
| Pixel Art Fixer | 55.0 | 55.0 | 0.0 | 91.3 | 0.0 |
| Naive | 1.7 | 10.0 | 6.4 | 67.5 | 1.8 |

### overquantize (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 83.3 | 83.3 | 0.0 | 88.2 | 1.3 |
| Pixel Art Fixer | 88.3 | 88.3 | 0.0 | 97.1 | 0.6 |
| Naive | 0.0 | 0.0 | 372.5 | 35.4 | 0.5 |

### painterly (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 53.3 | 85.0 | 0.0 | 77.6 | 2.5 |
| Pixel Art Fixer | 70.0 | 81.7 | 0.0 | 75.9 | 2.5 |
| Naive | 0.0 | 0.0 | 695.8 | 21.9 | 2.4 |

### resize_chain (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 50.0 | 50.0 | 2.1 | 71.4 | 0.3 |
| Pixel Art Fixer | 61.7 | 66.7 | 0.0 | 90.2 | 0.2 |
| Naive | 0.0 | 3.3 | 275.3 | 45.3 | 0.1 |

### row_jitter (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 93.3 | 93.3 | 0.0 | 88.5 | 0.0 |
| Pixel Art Fixer | 91.7 | 91.7 | 0.0 | 89.7 | 0.0 |
| Naive | 11.7 | 28.3 | 6.2 | 73.1 | 1.8 |

### screenshot (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 11.7 | 11.7 | 41.4 | 61.0 | 3.7 |
| Pixel Art Fixer | 18.3 | 25.0 | 19.5 | 73.4 | 3.7 |
| Naive | 0.0 | 0.0 | 294.8 | 40.7 | 2.5 |

### sharpen (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 71.7 | 71.7 | 0.0 | 83.2 | 1.4 |
| Pixel Art Fixer | 80.0 | 81.7 | 0.0 | 94.3 | 1.1 |
| Naive | 0.0 | 0.0 | 343.8 | 37.7 | 0.8 |

### soft_bicubic (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 68.3 | 68.3 | 0.0 | 81.7 | 1.3 |
| Pixel Art Fixer | 81.7 | 86.7 | 0.0 | 94.3 | 1.1 |
| Naive | 0.0 | 0.0 | 420.8 | 33.4 | 0.8 |

### soft_bilinear (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 75.0 | 75.0 | 0.0 | 82.9 | 1.7 |
| Pixel Art Fixer | 83.3 | 83.3 | 0.0 | 95.7 | 0.9 |
| Naive | 0.0 | 0.0 | 427.6 | 34.0 | 0.7 |

### subpixel_shift (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 86.7 | 88.3 | 0.0 | 92.7 | 0.0 |
| Pixel Art Fixer | 83.3 | 83.3 | 0.0 | 97.5 | 0.0 |
| Naive | 0.0 | 0.0 | 359.4 | 36.4 | 0.0 |

### warp (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 73.3 | 73.3 | 0.0 | 60.0 | 1.9 |
| Pixel Art Fixer | 83.3 | 83.3 | 0.0 | 67.3 | 1.2 |
| Naive | 0.0 | 0.0 | 366.5 | 35.1 | 1.3 |

### webp (60 images)

| Method | Exact % | ±1 % | Rel err % | Grid align % | ΔE |
|---|---|---|---|---|---|
| pixelsmith | 75.0 | 75.0 | 0.0 | 82.9 | 1.8 |
| Pixel Art Fixer | 83.3 | 91.7 | 0.0 | 96.1 | 1.8 |
| Naive | 0.0 | 0.0 | 349.5 | 37.2 | 1.3 |

## Runtime

| Method | Mean s / image |
|---|---|
| pixelsmith | 0.26 |
| Pixel Art Fixer | 0.78 |
| Naive | 0.17 |

Wall time: 2308.5s. pixel-bench 0.1.0, seed 1234.

