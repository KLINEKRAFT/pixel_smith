/**
 * detectFrames fixtures. Easiest case FIRST — anything that cannot count a
 * clean 4-frame strip with padding is broken regardless of how it does on the
 * awkward ones. That check would have killed two dead ideas in a minute
 * earlier today, so it goes at the top now.
 *
 *   node frames.mjs
 */
import { api, ImageDataShim } from './lib_extract.mjs';

const P = (r,g,b,a=255) => [r,g,b,a];
function sheet(frames, fw, fh, draw){
  const img = new ImageDataShim(frames*fw, fh);
  for(let f=0; f<frames; f++) draw(f, (x,y,col) => {
    if(x<0||y<0||x>=fw||y>=fh) return;
    const o = (y*frames*fw + f*fw + x)*4;
    img.data[o]=col[0]; img.data[o+1]=col[1]; img.data[o+2]=col[2]; img.data[o+3]=col[3];
  });
  return img;
}
const BODY = P(40,90,140), SKIN = P(224,168,120);

let pass = 0, fail = 0;
function ok(cond, msg){
  if(cond) { pass++; console.log('  PASS  ' + msg); }
  else     { fail++; console.log('  FAIL  ' + msg); }
}

/* ── 1. the easy one: 4 frames, generous padding, identical poses ── */
ok(api.detectFrames(sheet(4, 32, 32, (f,px) => {
  for(let y=8;y<28;y++) for(let x=10;x<22;x++) px(x,y,BODY);
})) === 4, 'clean 4-frame strip, identical poses, padded');

/* ── 2. a real walk cycle: poses differ frame to frame ── */
ok(api.detectFrames(sheet(8, 24, 32, (f,px) => {
  const lean = (f % 4) - 1;                       // body shifts
  for(let y=10;y<26;y++) for(let x=8+lean;x<16+lean;x++) px(x,y,BODY);
  for(let y=4;y<11;y++)  for(let x=9;x<15;x++) px(x,y,SKIN);
  const swing = [0,2,4,2,0,-2,-4,-2][f];          // legs swing
  for(let y=26;y<31;y++){ px(11+ (swing>>1), y, BODY); px(13- (swing>>1), y, BODY); }
})) === 8, '8-frame walk cycle with differing poses');

/* ── 3. must NOT be fooled by a detached element inside one frame ── */
ok(api.detectFrames(sheet(2, 48, 32, (f,px) => {
  for(let y=10;y<28;y++) for(let x=6;x<18;x++) px(x,y,BODY);   // body
  for(let y=6;y<24;y++)  for(let x=30;x<34;x++) px(x,y,SKIN);  // detached sword
})) === 2, 'detached sword inside each frame does not inflate the count');

/* ── 4. single frame must come back as "no answer", not 2 ── */
ok(api.detectFrames(sheet(1, 64, 64, (f,px) => {
  for(let y=12;y<52;y++) for(let x=16;x<48;x++) px(x,y,BODY);
})) === 0, 'a single sprite is not split into frames');

/* ── 5. fully opaque image: no silhouette to read, must refuse ── */
ok(api.detectFrames(sheet(1, 128, 32, (f,px) => {
  for(let y=0;y<32;y++) for(let x=0;x<128;x++) px(x,y,BODY);
})) === 0, 'fully opaque image refuses rather than inventing frames');

/* ── 6. tightly packed frames touching the seam: refuse, do not guess ── */
ok(api.detectFrames(sheet(4, 32, 32, (f,px) => {
  for(let y=8;y<28;y++) for(let x=0;x<32;x++) px(x,y,BODY);   // fills cell edge-to-edge
})) === 0, 'frames touching the seam refuse rather than guessing wrong');

/* ── 7. 6 frames, and the answer must be 6 rather than 2 or 3 ── */
const six = api.detectFrames(sheet(6, 20, 24, (f,px) => {
  for(let y=6;y<20;y++) for(let x=6;x<14;x++) px(x,y,BODY);
  for(let y=3;y<7;y++)  for(let x=7+(f%2);y<7&&x<13+(f%2);x++) px(x,y,SKIN);
}));
ok(six === 6, `6-frame strip counts 6, not a submultiple (got ${six})`);

/* ── 8. odd count, 5 frames ── */
ok(api.detectFrames(sheet(5, 28, 28, (f,px) => {
  for(let y=7;y<23;y++) for(let x=9;x<19;x++) px(x,y,BODY);
})) === 5, '5-frame strip (odd count) counts 5');

/* ── 9. ADVERSARIAL: a narrow centred sprite leaves empty columns MID-frame,
      so the half-frame boundaries are empty too. "Largest passing F" must not
      double the count — the silhouette does not repeat at half a frame. ── */
const narrow = api.detectFrames(sheet(4, 32, 32, (f,px) => {
  for(let y=8;y<28;y++) for(let x=14;x<18;x++) px(x,y,BODY);   // 4px wide, centred
}));
ok(narrow === 4, `narrow centred sprite counts 4, not 8 (got ${narrow})`);

/* ── 10. ADVERSARIAL: two sprites per frame, symmetric about the centre.
      Both the gap test AND correlation pass at 2x. This is the case the rule
      genuinely cannot distinguish from 8 real frames, and it should be
      recorded as such rather than pretended away. ── */
const twin = api.detectFrames(sheet(4, 32, 32, (f,px) => {
  for(let y=10;y<26;y++){
    for(let x=4;x<12;x++)  px(x,y,BODY);
    for(let x=20;x<28;x++) px(x,y,BODY);
  }
}));
console.log(`  NOTE  two identical sprites per frame -> ${twin} (genuinely ambiguous with ${twin===8?'8 real frames':'4'})`);

console.log(`\n${fail ? 'FAILURES: ' + fail : 'ALL ' + pass + ' FRAME CHECKS PASSED'}`);
process.exit(fail ? 1 : 0);
