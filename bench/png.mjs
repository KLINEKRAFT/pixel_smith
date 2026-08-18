/* Minimal PNG reader for the corpus: 8-bit, non-interlaced. */
import fs from 'node:fs';
import zlib from 'node:zlib';
import { ImageDataShim } from './lib_extract.mjs';

export function readPNG(file){
  const b = fs.readFileSync(file);
  let i = 8, w = 0, h = 0, bd = 0, ct = 0, idat = [], pal = null, trns = null;
  while(i < b.length){
    const len = b.readUInt32BE(i), type = b.toString('ascii', i+4, i+8);
    const data = b.subarray(i+8, i+8+len);
    if(type === 'IHDR'){ w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; }
    else if(type === 'IDAT') idat.push(data);
    else if(type === 'PLTE') pal = data;
    else if(type === 'tRNS') trns = data;
    else if(type === 'IEND') break;
    i += 12 + len;
  }
  if(bd !== 8) throw new Error('unsupported bit depth ' + bd + ' in ' + file);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const nch = ct === 6 ? 4 : ct === 2 ? 3 : ct === 3 ? 1 : ct === 4 ? 2 : 1;
  const stride = w*nch;
  const cur = Buffer.alloc(stride), prev = Buffer.alloc(stride);
  const out = new Uint8ClampedArray(w*h*4);
  let p = 0;
  for(let y=0; y<h; y++){
    const ft = raw[p++];
    raw.copy(cur, 0, p, p+stride); p += stride;
    for(let x=0; x<stride; x++){
      const a = x >= nch ? cur[x-nch] : 0, bb = prev[x], c = x >= nch ? prev[x-nch] : 0;
      let v = cur[x];
      if(ft === 1) v += a;
      else if(ft === 2) v += bb;
      else if(ft === 3) v += (a + bb) >> 1;
      else if(ft === 4){
        const pp = a + bb - c, pa = Math.abs(pp-a), pb = Math.abs(pp-bb), pc = Math.abs(pp-c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? bb : c);
      }
      cur[x] = v & 255;
    }
    for(let x=0; x<w; x++){
      const o = (y*w + x)*4;
      if(ct === 3){
        const k = cur[x];
        out[o] = pal[k*3]; out[o+1] = pal[k*3+1]; out[o+2] = pal[k*3+2];
        out[o+3] = trns && k < trns.length ? trns[k] : 255;
      } else if(ct === 4){
        out[o] = out[o+1] = out[o+2] = cur[x*2]; out[o+3] = cur[x*2+1];
      } else {
        out[o] = cur[x*nch]; out[o+1] = cur[x*nch+1]; out[o+2] = cur[x*nch+2];
        out[o+3] = nch === 4 ? cur[x*nch+3] : 255;
      }
    }
    cur.copy(prev);
  }
  return new ImageDataShim(out, w, h);
}
