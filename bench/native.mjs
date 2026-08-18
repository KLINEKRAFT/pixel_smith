/**
 * NATIVE-ART PROBE.
 *
 * The benchmark only ever feeds upscaled images, so a detector tuned purely on
 * it learns to never refuse — and then shreds the native sprite a real user
 * drops in. This measures the opposite failure: over a corpus of genuinely
 * native art, how often does detectGrid claim a grid it should not?
 *
 * Passing means "refused, or reported a step the app treats as already-native".
 *
 *   node native.mjs <corpusdir> [more dirs...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { api } from './lib_extract.mjs';
import { readPNG } from './png.mjs';

const dirs = process.argv.slice(2);
if(!dirs.length){ console.error('usage: node native.mjs <corpusdir>...'); process.exit(1); }

let n = 0, safe = 0;
const bad = [];
for(const d of dirs){
  for(const f of fs.readdirSync(d).filter(f => f.endsWith('.png')).sort()){
    const img = readPNG(path.join(d, f));
    const bb = api.contentBox(img, 1) || {x:0, y:0, w:img.width, h:img.height};
    const g = api.detectGrid(img, {x0:bb.x, y0:bb.y, cw:bb.w, ch:bb.h});
    /* Mirror prep()'s gates exactly: no grid, a step under 1.7 on both axes,
       or a collapse under 3 cells all mean "leave this alone". Anything else
       rewrites native art. */
    const ok = !g || (g.stepX < 1.7 && g.stepY < 1.7) || g.cols < 3 || g.rows < 3;
    n++; safe += ok;
    if(!ok && bad.length < 12)
      bad.push(`${f} ${img.width}x${img.height} -> ${g.cols}x${g.rows} (step ${g.stepX.toFixed(2)}x${g.stepY.toFixed(2)})`);
  }
}
for(const b of bad) console.log('  MANGLED ' + b);
console.log(`NATIVE-SAFE ${(safe/n*100).toFixed(1)}%  (${safe}/${n})`);
process.exit(safe === n ? 0 : 1);
