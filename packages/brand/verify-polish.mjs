import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets/polish');
const records = JSON.parse(await fs.readFile(path.join(root, 'generation-records.json'), 'utf8'));
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const manifest = [];
const errors = [];
for (const record of records) {
  const relative = `${record.group}/${record.name}`;
  const file = path.join(root, relative);
  const bytes = await fs.readFile(file);
  const {data, info} = await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let transparent=0, opaque=0, partial=0, minX=info.width, minY=info.height, maxX=-1, maxY=-1;
  for(let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) {
    const alpha=data[(y*info.width+x)*4+3];
    if(alpha===0) transparent++; else if(alpha===255) opaque++; else partial++;
    if(alpha>127) {minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  }
  const expected=record.number===19?[1024,1536]:record.photo?[1024,1024]:[1254,1254];
  const margins=[minX,minY,info.width-1-maxX,info.height-1-maxY];
  const warnings=[];
  if(info.width!==expected[0] || info.height!==expected[1]) warnings.push(`Native output ${info.width}x${info.height}; requested ${expected.join('x')}. Original retained without resizing.`);
  if(!record.photo && margins.some(n=>n<info.width*.1)) warnings.push('Visible-subject margin below requested 10 percent on at least one side. Use contain with layout padding; original retained.');
  if(record.number===19 ? transparent>0 : transparent===0) errors.push(`${relative}: unexpected transparency`);
  if(maxX<0 || maxY<0) errors.push(`${relative}: no visible subject`);
  let sourceMatches=null;
  try {sourceMatches=hash(await fs.readFile(record.source))===hash(bytes);if(!sourceMatches)errors.push(`${relative}: modified original`);} catch {warnings.push('Original generator source is unavailable on this machine; verify retained SHA-256 instead.');}
  manifest.push({number:record.number,file:relative,priority:record.number<=29?'P1':record.number<=36?'P2':'P3',usedByApp:record.usedByApp!==false,...(record.supersededBy?{supersededBy:record.supersededBy}:{}),width:info.width,height:info.height,requestedDimensions:expected,sha256:hash(bytes),bytes:bytes.length,transparentPixels:transparent,opaquePixels:opaque,partialAlphaPixels:partial,visibleSubjectMarginsAtAlpha128:margins,sourceMatches,provenance:'Built-in image_gen output, copied byte-for-byte; no cropping, retouching or upscaling',warnings});
}
// 46 entries: asset 46 (dapur-kosong) replaced asset 45 (dapur-rak-kosong) in the app; 45 is kept unchanged, unused.
const EXPECTED=46;
if(records.length!==EXPECTED || new Set(records.map(r=>r.number)).size!==EXPECTED) errors.push(`Expected ${EXPECTED} unique entries`);
if(manifest.filter(x=>!x.usedByApp).length!==1) errors.push('Expected exactly one superseded (unused) entry');
const result={generatedAt:new Date().toISOString(),assetCount:manifest.length,usedCount:manifest.filter(x=>x.usedByApp).length,transparentCount:manifest.filter(x=>x.transparentPixels>0).length,opaqueCount:manifest.filter(x=>x.transparentPixels===0).length,errors,assets:manifest};
if(process.argv.includes('--refresh')) await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify(result,null,2)+'\n');
else {
  const previous=JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8'));
  for(const item of manifest) if(previous.assets.find(p=>p.file===item.file)?.sha256!==item.sha256) errors.push(`${item.file}: retained hash mismatch`);
}
console.log(JSON.stringify({assets:result.assetCount,used:result.usedCount,transparent:result.transparentCount,opaque:result.opaqueCount,sizeDeviations:manifest.filter(x=>x.width!==x.requestedDimensions[0]||x.height!==x.requestedDimensions[1]).length,marginWarnings:manifest.filter(x=>x.warnings.some(w=>w.includes('margin'))).length,errors},null,2));
if(errors.length) process.exitCode=1;
