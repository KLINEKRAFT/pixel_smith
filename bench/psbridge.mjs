/**
 * Pixel Smith <-> pixel-bench bridge.
 *
 * Runs the REAL detection and reconstruction code out of index.html — the
 * functions are extracted from the shipped file by name, not copied — so the
 * benchmark measures what actually ships, and cannot drift from it.
 *
 * Protocol on stdin/stdout, length-prefixed binary:
 *   in : [magic u32 = 0x50534d31][w u32][h u32][w*h*4 RGBA]
 *   out: [cols u32][rows u32][cols*rows*4 RGBA]
 */
import fs from 'node:fs';

import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const HTML = process.env.PS_HTML || path.join(HERE, '..', 'index.html');
const GATES = process.env.PS_GATES !== '0';   // 0 = force the detector, no gates

/* ---- pull named declarations out of the shipped script ---- */
const src = fs.readFileSync(HTML, 'utf8');
const script = src.slice(src.indexOf('<script>') + 8, src.lastIndexOf('</script>'));

function grabFn(name){
  const re = new RegExp('(?:^|\\n)function\\s+' + name + '\\s*\\(', 'g');
  const m = re.exec(script);
  if(!m) throw new Error('function not found in index.html: ' + name);
  let i = script.indexOf('{', m.index + m[0].length - 1);
  let depth = 0, inStr = null, inCmt = null;
  for(let j = i; j < script.length; j++){
    const c = script[j], n = script[j+1];
    if(inCmt){ if(inCmt === '//' && c === '\n') inCmt = null;
               else if(inCmt === '/*' && c === '*' && n === '/'){ inCmt = null; j++; } continue; }
    if(inStr){ if(c === '\\'){ j++; continue; } if(c === inStr) inStr = null; continue; }
    if(c === '/' && n === '/'){ inCmt = '//'; j++; continue; }
    if(c === '/' && n === '*'){ inCmt = '/*'; j++; continue; }
    if(c === '"' || c === "'" || c === '`'){ inStr = c; continue; }
    if(c === '{') depth++;
    else if(c === '}'){ depth--; if(depth === 0) return script.slice(m.index, j+1); }
  }
  throw new Error('unbalanced braces for ' + name);
}
function grabConst(name){
  // single-line form first
  let re = new RegExp('(?:^|\\n)const\\s+' + name + '\\s*=[^\\n{]*;', 'g');
  let m = re.exec(script);
  if(m) return m[0];
  // multi-line object/array literal: brace-match from the opening bracket
  re = new RegExp('(?:^|\\n)const\\s+' + name + '\\s*=\\s*[\\[{]', 'g');
  m = re.exec(script);
  if(!m) throw new Error('const not found in index.html: ' + name);
  const open = script[m.index + m[0].length - 1];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  for(let j = m.index + m[0].length - 1; j < script.length; j++){
    const c = script[j];
    if(c === open) depth++;
    else if(c === close){ depth--; if(depth === 0) return script.slice(m.index, j+1) + ';'; }
  }
  throw new Error('unbalanced literal for ' + name);
}

const FNS = ['cloneImg','hardAlpha','collect','medianCut','chRange','spread','widest','avg',
             'mapPalette','labOf','labDist2','hasAlpha','keyOut','keyPockets',
             'snapGrid','labelComponents','opaqueMask','nyquistFraction',
             'boundaryProfile','yinPeriod','detectYinAxis','yinCurve','yinAt',
             'distScoreCurve','distAt','trendAt','detectAxis',
             'contentBox','bboxOf','mergeNearColors','cleanIsolated','fillPinholes',
             'modalNeighbour','edgeCleanup',
             'gridPalette','gridQuant','gridLines','gridSums','gridEnergy','distillAxis','pickStep','detectGrid'];
const CONSTS = ['RING','ORTH','NOISE_TOL','clamp','GRID','GB'];

class ImageDataShim {
  constructor(a, b, c){
    if(a instanceof Uint8ClampedArray){ this.data = a; this.width = b; this.height = c; }
    else { this.width = a; this.height = b; this.data = new Uint8ClampedArray(a*b*4); }
  }
}

const preamble = 'const ImageData = ImageDataShim; const _labCache = new Map();\n';
const body = CONSTS.map(grabConst).join('\n') + '\n' + FNS.map(grabFn).join('\n');
const api = new Function('ImageDataShim',
  preamble + body + '\n; return {' + FNS.concat(CONSTS).join(',') + '};')(ImageDataShim);

/* ---- the pipeline, mirroring prep() in index.html ---- */
const SNAP_COLORS = 32;

function reconstruct(w, h, rgba){
  const img = new ImageDataShim(new Uint8ClampedArray(rgba), w, h);

  // Detection runs on the content box, exactly as prep() does.
  const bb = api.contentBox(img, 1)
          || api.bboxOf(img.data, w, h, 0, 0, w, h, 1)
          || {x:0, y:0, w, h};
  const box = {x0:bb.x, y0:bb.y, cw:bb.w, ch:bb.h};

  const g = api.detectGrid(img, box);

  let reject = '';
  if(!g) reject = 'no grid';
  else if(GATES){
    if(g.stepX < 1.7 && g.stepY < 1.7) reject = 'already native';
    else if(g.cols < 3 || g.rows < 3) reject = 'would collapse';
  }
  if(reject){
    // Shipped behaviour: refuse to snap, hand back the source untouched.
    return {cols:w, rows:h, data:rgba};
  }

  // Reconstruct the WHOLE frame on the detected grid (pixel-bench scores the
  // full native canvas; the app additionally crops to the drawn art).
  if(SNAP_COLORS >= 2){
    const pal = api.medianCut(api.collect([img], 24000), SNAP_COLORS);
    if(pal.length) api.mapPalette(img, pal);
  }
  const cols = Math.max(1, Math.round(w/g.stepX));
  const rows = Math.max(1, Math.round(h/g.stepY));
  const out = api.snapGrid(img, {x0:0, y0:0, cw:w, ch:h}, cols, rows, 1);
  return {cols:out.width, rows:out.height, data:out.data};
}

/* ---- stdin/stdout framing ---- */
const MAGIC = 0x50534d31;
let buf = Buffer.alloc(0);
process.stdin.on('data', chunk => {
  buf = Buffer.concat([buf, chunk]);
  for(;;){
    if(buf.length < 12) return;
    if(buf.readUInt32LE(0) !== MAGIC){ process.stderr.write('bad magic\n'); process.exit(2); }
    const w = buf.readUInt32LE(4), h = buf.readUInt32LE(8);
    const need = 12 + w*h*4;
    if(buf.length < need) return;
    const px = buf.subarray(12, need);
    buf = buf.subarray(need);
    let r;
    try { r = reconstruct(w, h, px); }
    catch(e){
      // Never silently fall back: a bug in the bridge would masquerade as the
      // detector scoring badly, which is exactly the confusion this exists to
      // remove. Die loudly and let the run fail.
      process.stderr.write('BRIDGE ERROR: ' + (e && e.stack || e) + '\n');
      process.exit(3);
    }
    const head = Buffer.alloc(8);
    head.writeUInt32LE(r.cols, 0); head.writeUInt32LE(r.rows, 4);
    process.stdout.write(head);
    process.stdout.write(Buffer.from(r.data.buffer ? Buffer.from(r.data.buffer, r.data.byteOffset, r.cols*r.rows*4) : r.data));
  }
});
process.stdin.on('end', () => process.exit(0));

/* Self-test before accepting any work.
   The extraction lists above name functions in index.html; when the app
   renames one, a stale list silently yields a bridge that throws on every
   request. Falling back to "return the source" then looks exactly like a
   detector that refuses everything — it scored this harness 0.0% exact once,
   which cost more time than the bug did. So prove the pipeline runs, on a
   synthetic 8x checkerboard whose answer is known, before reporting ready. */
(function selfTest(){
  const N = 16, S8 = 8, W = N*S8;
  const img = new ImageDataShim(W, W);
  for(let y=0; y<W; y++) for(let x=0; x<W; x++){
    const on = ((x/S8|0) + (y/S8|0)) % 2 === 0;
    const i = (y*W + x)*4;
    img.data[i] = on ? 230 : 40; img.data[i+1] = on ? 200 : 60;
    img.data[i+2] = on ? 120 : 90; img.data[i+3] = 255;
  }
  let g;
  try { g = api.detectGrid(img, {x0:0, y0:0, cw:W, ch:W}); }
  catch(e){
    process.stderr.write('psbridge SELF-TEST THREW: ' + (e && e.stack || e) +
      '\nThe extraction lists in this file are probably stale against index.html.\n');
    process.exit(4);
  }
  if(!g || Math.abs(g.cols - N) > 1 || Math.abs(g.rows - N) > 1){
    process.stderr.write('psbridge SELF-TEST FAILED: an 8x checkerboard of a ' +
      N + 'x' + N + ' grid came back as ' + (g ? g.cols+'x'+g.rows : 'null') + '\n');
    process.exit(5);
  }
  process.stderr.write('psbridge ready (gates=' + (GATES?'on':'off') +
    ', self-test ' + g.cols + 'x' + g.rows + ' ok)\n');
})();
