/**
 * Fast detector loop: runs detectGrid from the shipped index.html over
 * pre-dumped pixel-bench cases, in pure node. Seconds instead of ten minutes.
 *
 *   node fastbench.mjs <casedir> [categoryFilter] [--verbose]
 */
import fs from 'node:fs';
import path from 'node:path';

const CASES = process.argv[2] || 'cases';
const FILTER = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : null;
const VERBOSE = process.argv.includes('--verbose');
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const HTML = process.env.PS_HTML || path.join(HERE, '..', 'index.html');

/* ---- pull the real functions out of the shipped file ---- */
const src = fs.readFileSync(HTML, 'utf8');
const script = src.slice(src.indexOf('<script>') + 8, src.lastIndexOf('</script>'));
function grabFn(name){
  const re = new RegExp('(?:^|\\n)function\\s+' + name + '\\s*\\(', 'g');
  const m = re.exec(script);
  if(!m) throw new Error('function not found: ' + name);
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
  throw new Error('unbalanced braces: ' + name);
}
function grabConst(name){
  let re = new RegExp('(?:^|\\n)const\\s+' + name + '\\s*=[^\\n{]*;', 'g');
  let m = re.exec(script);
  if(m) return m[0];
  re = new RegExp('(?:^|\\n)const\\s+' + name + '\\s*=\\s*[\\[{]', 'g');
  m = re.exec(script);
  if(!m) throw new Error('const not found: ' + name);
  const open = script[m.index + m[0].length - 1], close = open === '{' ? '}' : ']';
  let depth = 0;
  for(let j = m.index + m[0].length - 1; j < script.length; j++){
    const c = script[j];
    if(c === open) depth++;
    else if(c === close){ depth--; if(depth === 0) return script.slice(m.index, j+1) + ';'; }
  }
  throw new Error('unbalanced literal: ' + name);
}
class ImageDataShim {
  constructor(a,b,c){ if(a instanceof Uint8ClampedArray){ this.data=a; this.width=b; this.height=c; }
                      else { this.width=a; this.height=b; this.data=new Uint8ClampedArray(a*b*4); } }
}
const FNS = ['collect','medianCut','chRange','spread','widest','avg','mapPalette',
             'labelComponents','opaqueMask','contentBox','bboxOf',
             'gridPalette','gridQuant','gridLines','gridSums','gridEnergy',
             'distillAxis','pickStep','distScoreCurve','distAt','trendAt','detectAxis','detectGrid','yinCurve','yinAt','nyquistFraction',
             'boundaryProfile','yinPeriod','detectYinAxis'];
const CONSTS = ['RING','ORTH','clamp','GRID','GB'];
const api = new Function('ImageDataShim',
  'const ImageData = ImageDataShim;\n' +
  CONSTS.map(grabConst).join('\n') + '\n' + FNS.map(grabFn).join('\n') +
  '\n; return {' + FNS.concat(CONSTS).join(',') + '};')(ImageDataShim);

/* ---- run ---- */
const index = JSON.parse(fs.readFileSync(path.join(CASES, 'index.json'), 'utf8'));
const cases = index.filter(c => !FILTER || c.category === FILTER);
const byCat = new Map();
let hit = 0, near = 0, tot = 0, refused = 0, t0 = Date.now();

for(const c of cases){
  const buf = fs.readFileSync(path.join(CASES, c.file));
  const w = buf.readUInt32LE(0), h = buf.readUInt32LE(4);
  const px = new Uint8ClampedArray(buf.buffer, buf.byteOffset + 8, w*h*4);
  const img = new ImageDataShim(px, w, h);
  const bb = api.contentBox(img, 1) || {x:0, y:0, w, h};
  const bx = {x0:bb.x, y0:bb.y, cw:bb.w, ch:bb.h};
  let g = null;
  try {
    if(process.env.PS_DET === 'yin'){
      const rx = api.detectYinAxis(img, bx, 0), ry = api.detectYinAxis(img, bx, 1);
      if(rx || ry){
        let sx = rx ? rx.period : ry.period, sy = ry ? ry.period : rx.period;
        if(Math.abs(sx-sy)/Math.max(sx,sy) < 0.05){ const m=(sx+sy)/2; sx=m; sy=m; }
        g = {stepX:sx, stepY:sy};
      }
    } else {
      g = api.detectGrid(img, bx);
    }
  }
  catch(e){ console.error('THREW on ' + c.file + ': ' + e.message); throw e; }

  // the bench scores the full native canvas
  const cols = g ? Math.max(1, Math.round(w/g.stepX)) : w;
  const rows = g ? Math.max(1, Math.round(h/g.stepY)) : h;
  const ok = cols === c.gt_cols && rows === c.gt_rows;
  const ok1 = Math.abs(cols-c.gt_cols) <= 1 && Math.abs(rows-c.gt_rows) <= 1;
  if(!g) refused++;
  hit += ok; near += ok1; tot++;
  const e = byCat.get(c.category) || {hit:0, near:0, n:0, refused:0, bad:[]};
  e.hit += ok; e.near += ok1; e.n++; if(!g) e.refused++;
  if(!ok && e.bad.length < 3) e.bad.push(`${c.image} ${w}x${h} -> ${cols}x${rows} want ${c.gt_cols}x${c.gt_rows}`);
  byCat.set(c.category, e);
}

const rows = [...byCat.entries()].map(([k,v]) => [v.hit/v.n*100, k, v]).sort((a,b)=>b[0]-a[0]);
if(VERBOSE || FILTER){
  console.log(`${'category'.padEnd(16)}${'exact'.padStart(7)}${'±1'.padStart(6)}${'refused'.padStart(9)}`);
  for(const [pc,k,v] of rows){
    console.log(`${k.padEnd(16)}${pc.toFixed(0).padStart(6)}%${(v.near/v.n*100).toFixed(0).padStart(5)}%${String(v.refused+'/'+v.n).padStart(9)}`);
    if(pc < 100) for(const b of v.bad) console.log(`    ${b}`);
  }
  console.log('');
}
console.log(`EXACT ${(hit/tot*100).toFixed(1)}%  (±1 ${(near/tot*100).toFixed(1)}%)  n=${tot}  refused=${refused}  ${((Date.now()-t0)/1000).toFixed(1)}s`);
