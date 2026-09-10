// Derive UI cutouts from the individually generated originals, without resizing.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

const root = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.brand.json'), 'utf8'));
const names = (await fs.readdir(path.join(root, 'assets'))).filter(n => n.endsWith('.png'));
for (const name of names) {
  const original = path.join(root, 'masters', name);
  if (name === 'app-icon.png') continue;
  const source = await fs.readFile(original);
  const expected = manifest.assets.find(asset => asset.id + '.png' === name)?.source.retainedMasterSha256;
  if (createHash('sha256').update(source).digest('hex') !== expected)
    throw new Error(`${name}: retained original is missing or changed`);
  const {data, info: {width: w, height: h}} = await sharp(source).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const count = w * h;
  const samples = [[], [], []];
  for (let y = 0; y < h; y += 8) for (const x of [0, 1, w-2, w-1])
    for (let c = 0; c < 3; c++) samples[c].push(data[(y*w+x)*3+c]);
  const bg = samples.map(a => a.sort((a,b)=>a-b)[Math.floor(a.length/2)]);
  const distance = new Float32Array(count);
  for (let i = 0; i < count; i++) distance[i] = Math.hypot(...bg.map((v,c)=>data[i*3+c]-v));
  const mask = new Uint8Array(count), queue = new Int32Array(count);
  const barrier = new Uint8Array(count);
  // Occluded paper outlines have deliberate gaps. Bridge only those gaps in
  // the segmentation mask so cream paper is not mistaken for the exterior.
  const bridges = name === 'welcome.png' ? [[829,600,812,664]] :
    name === 'empty-calendar.png' ? [[235,798,252,952]] : [];
  for (const [x1,y1,x2,y2] of bridges) {
    const steps=Math.ceil(Math.hypot(x2-x1,y2-y1));
    for(let s=0;s<=steps;s++) for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++)
      barrier[(Math.round(y1+(y2-y1)*s/steps)+dy)*w+Math.round(x1+(x2-x1)*s/steps)+dx]=1;
  }
  let head = 0, tail = 0;
  const seed = i => { if (!barrier[i] && !mask[i] && distance[i] < 80) { mask[i] = 1; queue[tail++] = i; } };
  for (let x = 0; x < w; x++) { seed(x); seed((h-1)*w+x); }
  for (let y = 0; y < h; y++) { seed(y*w); seed(y*w+w-1); }
  // Remove enclosed counters in lettering and negative space in monochrome symbols.
  const monochrome = ['wordmark.png','logo-forest.png','logo-light.png','heart.png','leaf.png','repeat.png','sparkle.png','utensils.png'].includes(name);
  for (let i = 0; i < count; i++) {
    if (monochrome || (name === 'lockup-horizontal.png' && i%w > w*.35) ||
        (name === 'lockup-stacked.png' && Math.floor(i/w) > h*.70)) seed(i);
  }
  while (head < tail) {
    const i = queue[head++], x = i%w;
    if (x) seed(i-1); if (x < w-1) seed(i+1);
    if (i >= w) seed(i-w); if (i < count-w) seed(i+w);
  }
  const rgba = Buffer.alloc(count*4);
  for (let i = 0; i < count; i++) {
    let alpha = mask[i] ? 0 : 1;
    let foreground;
    if (mask[i] && distance[i] > 12) {
      const x = i%w, y = Math.floor(i/w);
      // Estimate edge coverage against nearby solid ink and remove matte contamination.
      let nearest = Infinity;
      for (let dy=-4; dy<=4; dy++) for (let dx=-4; dx<=4; dx++) {
        if (x+dx<0 || x+dx>=w || y+dy<0 || y+dy>=h) continue;
        const j=(y+dy)*w+x+dx, d=dx*dx+dy*dy;
        if (!mask[j] && d<nearest) { nearest=d; foreground=j; }
      }
      if (foreground !== undefined) {
        let dot=0, norm=0;
        for(let c=0;c<3;c++) {const f=data[foreground*3+c]-bg[c];dot+=(data[i*3+c]-bg[c])*f;norm+=f*f;}
        alpha=Math.max(0,Math.min(1,dot/norm));
      }
    }
    for(let c=0;c<3;c++) rgba[i*4+c] = alpha ? Math.max(0,Math.min(255,(data[i*3+c]-(1-alpha)*bg[c])/alpha)) : 0;
    rgba[i*4+3]=Math.round(alpha*255);
  }
  let png = await sharp(rgba,{raw:{width:w,height:h,channels:4}}).png().toBuffer();
  // Retain embedded generation prompts verbatim, including their original CRCs.
  const textChunks=[];
  for(let o=8;o+12<=source.length;) {const n=source.readUInt32BE(o);if(source.toString('ascii',o+4,o+8)==='tEXt')textChunks.push(source.subarray(o,o+n+12));o+=n+12;}
  png=Buffer.concat([png.subarray(0,png.length-12),...textChunks,png.subarray(png.length-12)]);
  const destination = path.join(root,'assets',name);
  const current = await fs.readFile(destination).catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return undefined;
  });
  if (!current?.equals(png)) await fs.writeFile(destination,png);
  console.log(`${name}: ${w}x${h}, background ${bg.join(',')}, exterior pixels ${tail}`);
}
