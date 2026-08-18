"""Print the head-to-head from a pixel-bench results json: overall, then the
categories where the gap is largest in each direction."""
import json
import sys

d = json.load(open(sys.argv[1]))
bm = d["aggregate"]["by_method"]
cats = d["aggregate"]["categories"]
methods = [m for m in ("pixelsmith", "fixer", "naive") if m in bm]

print(f"{d['n_scored']} scored inputs, {len(cats)} categories, "
      f"{d['dataset'] if isinstance(d.get('dataset'), str) else ''}")
print()
print(f"{'method':14s}{'exact %':>9}{'±1 %':>8}{'grid align %':>14}{'pixel match %':>15}{'ΔE':>7}")
for m in methods:
    o = bm[m]["overall"]
    print(f"{m:14s}{o['exact']*100:>9.1f}{o['within1']*100:>8.1f}"
          f"{o['grid_align']*100:>14.1f}{o['pixel_match']*100:>15.1f}{o['delta_e']:>7.2f}")

if "fixer" in bm and "pixelsmith" in bm:
    rows = []
    for c in cats:
        p = bm["pixelsmith"][c]["exact"] * 100
        f = bm["fixer"][c]["exact"] * 100
        rows.append((p - f, c, p, f))
    rows.sort()
    print("\nwhere fixer wins:")
    for dl, c, p, f in rows[:8]:
        if dl < -0.5:
            print(f"   {c:16s} smith {p:5.1f}   fixer {f:5.1f}   {dl:+6.1f}")
    print("\nwhere pixel smith wins:")
    for dl, c, p, f in reversed(rows[-8:]):
        if dl > 0.5:
            print(f"   {c:16s} smith {p:5.1f}   fixer {f:5.1f}   {dl:+6.1f}")
    won = sum(1 for dl, *_ in rows if dl > 0.5)
    lost = sum(1 for dl, *_ in rows if dl < -0.5)
    print(f"\ncategories: pixel smith ahead in {won}, fixer ahead in {lost}, "
          f"tied in {len(rows)-won-lost}")
