/**
 * SPECTRAL NULL COMB — is it really blur-invariant?
 *
 * Upscaling by s convolves the native art with a box of width s, so the
 * spectrum is multiplied by sinc(pi f s), which is exactly ZERO at f = k/s.
 * Any later smooth filter multiplies by another envelope: it attenuates those
 * nulls but cannot move them. So the null comb should encode s and survive
 * damage that kills the derivative profiles boundaryMaps reads.
 *
 * This measures that claim directly against ground truth, per category,
 * BEFORE anything gets integrated. Three ideas this session looked sound on
 * paper and lost points end to end.
 *
 *   node nulls.mjs <casedir> [category]
 */
import fs from 'node:fs';
import path from 'node:path';
import { ImageDataShim } from './lib_extract.mjs';

const CASES = process.argv[2] || 'cases';
const ONLY  = process.argv[3] || null;

/* mean luma profile along an axis — NO differencing, that is the whole point */
function profile(img, axis){
  const { width:w, height:h, data:d } = img;
  const len = axis === 0 ? w : h, nAll = axis === 0 ? h : w;
  const p = new Float64Array(len);
  for(let i=0; i<len; i++){
    let acc = 0;
    for(let t=0; t<nAll; t++){
      const x = axis === 0 ? i : t, y = axis === 0 ? t : i;
      const o = (y*w + x)*4;
      acc += 0.299*d[o] + 0.587*d[o+1] + 0.114*d[o+2];
    }
    p[i] = acc/nAll/255;
  }
  return p;
}

/* |DFT|^2 of the mean-removed profile, at integer bin n over the axis */
function powerSpectrum(p){
  const N = p.length;
  let mean = 0; for(let i=0;i<N;i++) mean += p[i]; mean /= N;
  const P = new Float64Array((N>>1) + 1);
  for(let n=0; n<=N>>1; n++){
    let re = 0, im = 0;
    const w = -2*Math.PI*n/N;
    for(let i=0;i<N;i++){ const v = p[i]-mean, a = w*i; re += v*Math.cos(a); im += v*Math.sin(a); }
    P[n] = (re*re + im*im)/N;
  }
  return P;
}

/* Score a candidate cell count n (so step s = len/n): the sinc nulls sit at
   frequency bins that are multiples of n. Compare the power AT those bins to
   the power in the neighbourhood around them — a true s gives a deep, regular
   comb of dips. Log-domain so multiplicative envelopes (blur, JPEG) cancel. */
function nullScore(P, n){
  const N = (P.length-1)*2;
  let dip = 0, cnt = 0;
  for(let k=1; k*n <= P.length-1; k++){
    const b = k*n;
    if(b < 3) continue;
    /* local background: bins either side, skipping the null itself */
    let bg = 0, m = 0;
    for(const off of [-3,-2,2,3]){
      const j = b + off;
      if(j > 0 && j < P.length){ bg += Math.log(P[j] + 1e-12); m++; }
    }
    if(!m) continue;
    dip += bg/m - Math.log(P[b] + 1e-12);
    cnt++;
  }
  return cnt >= 2 ? dip/cnt : -Infinity;
}

function detectAxisNulls(img, axis, gt){
  const p = profile(img, axis);
  const len = p.length;
  const P = powerSpectrum(p);
  let best = -Infinity, bestN = 0;
  /* every integer cell count whose step is in the plausible range */
  const nLo = Math.max(2, Math.ceil(len/64)), nHi = Math.floor(len/1.55);
  for(let n=nLo; n<=nHi; n++){
    const sc = nullScore(P, n);
    if(sc > best){ best = sc; bestN = n; }
  }
  return bestN;
}

const index = JSON.parse(fs.readFileSync(path.join(CASES,'index.json'),'utf8'))
                  .filter(c => !ONLY || c.category === ONLY);
const byCat = new Map();
for(const c of index){
  const buf = fs.readFileSync(path.join(CASES, c.file));
  const w = buf.readUInt32LE(0), h = buf.readUInt32LE(4);
  const img = new ImageDataShim(new Uint8ClampedArray(buf.buffer, buf.byteOffset+8, w*h*4), w, h);
  const cols = detectAxisNulls(img, 0), rows = detectAxisNulls(img, 1);
  const ok  = cols === c.gt_cols && rows === c.gt_rows;
  const ok1 = Math.abs(cols-c.gt_cols) <= 1 && Math.abs(rows-c.gt_rows) <= 1;
  const e = byCat.get(c.category) || {n:0,h:0,n1:0,bad:[]};
  e.n++; e.h += ok; e.n1 += ok1;
  if(!ok && e.bad.length < 2) e.bad.push(`${w}x${h} -> ${cols}x${rows} want ${c.gt_cols}x${c.gt_rows}`);
  byCat.set(c.category, e);
}
let H=0,N=0,N1=0;
for(const [k,v] of [...byCat.entries()].sort()){
  H+=v.h; N+=v.n; N1+=v.n1;
  console.log(`${k.padEnd(16)}${(v.h/v.n*100).toFixed(0).padStart(5)}%${(v.n1/v.n*100).toFixed(0).padStart(6)}% (±1)`);
  for(const b of v.bad) console.log('     ' + b);
}
console.log(`\nNULL-COMB  exact ${(H/N*100).toFixed(1)}%  ±1 ${(N1/N*100).toFixed(1)}%  n=${N}`);
