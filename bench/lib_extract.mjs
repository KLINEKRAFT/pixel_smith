/* Shared extraction of the real functions out of the shipped index.html. */
import fs from 'node:fs';

const HTML = process.env.PS_HTML || new URL('../index.html', import.meta.url).pathname;
const src = fs.readFileSync(HTML, 'utf8');
const script = src.slice(src.indexOf('<script>') + 8, src.lastIndexOf('</script>'));

export function grabFn(name){
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
export function grabConst(name){
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

export class ImageDataShim {
  constructor(a,b,c){ if(a instanceof Uint8ClampedArray){ this.data=a; this.width=b; this.height=c; }
                      else { this.width=a; this.height=b; this.data=new Uint8ClampedArray(a*b*4); } }
}

const FNS = ['boundaryMaps','raylAt','raylP','phaseScan','lossAt','distillAxis','detectAxis','detectGrid','shortRuns',
             'gridPalette','gridQuant','gridLines','gridSums','gridEnergy',
             'collect','medianCut','chRange','spread','widest','avg','mapPalette',
             'labelComponents','opaqueMask','contentBox','bboxOf','snapGrid'];
const CONSTS = ['RING','ORTH','clamp','GRID','GB'];
const HAVE_F = FNS.filter(n => { try { grabFn(n); return true; } catch { return false; } });
const HAVE_C = CONSTS.filter(n => { try { grabConst(n); return true; } catch { return false; } });

export const api = new Function('ImageDataShim',
  'const ImageData = ImageDataShim;\n' +
  HAVE_C.map(grabConst).join('\n') + '\n' + HAVE_F.map(grabFn).join('\n') +
  '\n; return {' + HAVE_F.concat(HAVE_C).join(',') + '};')(ImageDataShim);
