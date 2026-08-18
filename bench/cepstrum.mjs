/**
 * CEPSTRAL PERIOD ESTIMATION — the candidate that is a PEAK, not a zero.
 *
 * Why this and not the null comb: blur multiplies the spectrum by an envelope
 * and the sinc nulls are zeros, so additive noise fills them in and the cue
 * dies (measured, 0% on blur/bicubic/downup/noise). Taking the LOG of the
 * power spectrum turns every multiplicative envelope — the box sinc, the blur
 * kernel, JPEG's quantisation profile — into an additive offset, and the
 * periodic ripple that the upscale imprints becomes a PEAK in the inverse
 * transform at quefrency s. Peaks survive additive noise; zeros do not.
 *
 * Two things the null-comb probe got wrong and this fixes:
 *   - It took the spectrum of the MEAN profile. Averaging down the scanlines
 *     first cancels the very structure being looked for. Average the power
 *     spectra of individual scanlines instead (Welch), which adds energy
 *     rather than cancelling phase.
 *   - It scored a hand-built comb. The cepstrum reads the period directly.
 *
 *   node cep.mjs <casedir> [category]
 */
import fs from 'node:fs';
import path from 'node:path';
import { ImageDataShim } from './lib_extract.mjs';

const CASES = process.argv[2] || 'cases';
const ONLY  = process.argv[3] || null;

/** Averaged periodogram over scanlines: sum |FFT(line)|^2, no phase cancel. */
function avgPower(img, axis){
  const { width:w, height:h, data:d } = img;
  const len  = axis === 0 ? w : h;
  const nAll = axis === 0 ? h : w;
  const stride = Math.max(1, Math.floor(nAll/48));
  const half = (len>>1) + 1;
  const P = new Float64Array(half);
  const line = new Float64Array(len);
  let rows = 0;
  for(let t=0; t<nAll; t+=stride){
    let mean = 0;
    for(let i=0;i<len;i++){
      const x = axis === 0 ? i : t, y = axis === 0 ? t : i;
      const o = (y*w + x)*4;
      line[i] = (0.299*d[o] + 0.587*d[o+1] + 0.114*d[o+2])/255;
      mean += line[i];
    }
    mean /= len;
    /* Hann window: the axis is not periodic, and leakage from the DC step
       would otherwise dominate every bin. */
    for(let n=1; n<half; n++){
      let re = 0, im = 0;
      const wq = -2*Math.PI*n/len;
      for(let i=0;i<len;i++){
        const win = 0.5 - 0.5*Math.cos(2*Math.PI*i/(len-1));
        const v = (line[i]-mean)*win, a = wq*i;
        re += v*Math.cos(a); im += v*Math.sin(a);
      }
      P[n] += (re*re + im*im)/len;
    }
    rows++;
  }
  for(let n=0;n<half;n++) P[n] /= rows || 1;
  return P;
}

/** Cepstrum: inverse cosine transform of log power. A grid of step s ripples
 *  the spectrum with period len/s bins, which lands as a peak at quefrency s. */
function cepstrum(P, len){
  const half = P.length;
  const L = new Float64Array(half);
  for(let n=1;n<half;n++) L[n] = Math.log(P[n] + 1e-12);
  /* remove the smooth trend so the broad envelope does not swamp low quefrency */
  let mean = 0; for(let n=1;n<half;n++) mean += L[n]; mean /= (half-1);
  for(let n=1;n<half;n++) L[n] -= mean;
  const C = new Float64Array(len);
  for(let q=0;q<len;q++){
    let acc = 0;
    for(let n=1;n<half;n++) acc += L[n]*Math.cos(2*Math.PI*n*q/len);
    C[q] = acc/(half-1);
  }
  return C;
}

function detectAxis(img, axis){
  const len = axis === 0 ? img.width : img.height;
  if(len < 24) return 1;
  const P = avgPower(img, axis);
  const C = cepstrum(P, len);
  /* A true period is a LOCAL PEAK in quefrency, not simply the highest score
     anywhere — scanning cell counts and taking the max falls straight to the
     finest candidate, because a subdivided grid fits everything a coarser one
     does. Take prominent local maxima instead, then walk to the coarsest one
     that still stands up, which is the same octave argument the main detector
     uses. */
  const lo = 1.55, hi = Math.min(64, len/4);
  const peaks = [];
  for(let q=Math.ceil(lo); q<=Math.floor(hi); q++){
    if(C[q] > C[q-1] && C[q] >= C[q+1]){
      /* prominence against the local floor either side */
      let fl = Infinity;
      for(let j=Math.max(2,q-8); j<=Math.min(C.length-1,q+8); j++) if(C[j] < fl) fl = C[j];
      peaks.push({q, prom: C[q]-fl});
    }
  }
  if(!peaks.length) return 1;
  peaks.sort((a,b)=>b.prom-a.prom);
  const top = peaks.slice(0, 6);
  /* prefer the COARSEST step among peaks within 60% of the best prominence */
  const thr = top[0].prom*0.6;
  let s = top.filter(p=>p.prom >= thr).reduce((a,p)=>Math.max(a,p.q), 0) || top[0].q;
  const bestN = Math.max(2, Math.round(len/s));
  return bestN || 1;
}

const index = JSON.parse(fs.readFileSync(path.join(CASES,'index.json'),'utf8'))
                  .filter(c => !ONLY || c.category === ONLY);
const byCat = new Map();
for(const c of index){
  const buf = fs.readFileSync(path.join(CASES, c.file));
  const w = buf.readUInt32LE(0), h = buf.readUInt32LE(4);
  const img = new ImageDataShim(new Uint8ClampedArray(buf.buffer, buf.byteOffset+8, w*h*4), w, h);
  const cols = detectAxis(img, 0), rows = detectAxis(img, 1);
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
console.log(`CEPSTRUM  exact ${(H/N*100).toFixed(1)}%  ±1 ${(N1/N*100).toFixed(1)}%  n=${N}`);
