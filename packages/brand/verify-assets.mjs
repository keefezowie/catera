import fs from 'node:fs';
import sharp from 'sharp';
import './verify-mascot-motion.mjs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const sha = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

function inspect(file) {
  const data = fs.readFileSync(file);
  if (data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`Invalid PNG: ${file}`);
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  const colorType = data[25];
  const imageChunks = [];
  let prompt;
  for (let offset = 8; offset + 12 <= data.length;) {
    const length = data.readUInt32BE(offset);
    const type = data.toString('ascii', offset + 4, offset + 8);
    const chunk = data.subarray(offset + 8, offset + 8 + length);
    if (type === 'IDAT') imageChunks.push(chunk);
    if (type === 'tEXt' && chunk.toString('utf8').includes('\0')) {
      const text = chunk.toString('utf8');
      const separator = text.indexOf('\0');
      if (separator >= 0 && text.slice(0, separator).toLowerCase().endsWith(':prompt')) prompt = text.slice(separator + 1);
    }
    offset += length + 12;
  }
  return { width, height, colorType, hasAlphaChannel: colorType === 4 || colorType === 6, bytes: data.length, sha256: sha(data), pixelDataSha256: sha(Buffer.concat(imageChunks)), prompt };
}

const manifestPath = path.join(root, 'manifest.brand.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const refresh = process.argv.includes('--refresh-manifest');
for (const asset of manifest.assets) {
  const file = path.join(root, asset.file);
  const actual = inspect(file);
  const originalFile = 'masters/' + asset.id + '.png';
  const original = inspect(path.join(root, originalFile));
  if (original.pixelDataSha256 !== asset.source.originalPixelDataSha256) throw new Error(asset.id + ': original master changed');
  if (actual.width !== original.width || actual.height !== original.height) throw new Error(asset.id + ': dimensions changed');
  const {data, info} = await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let transparentPixels=0, opaquePixels=0, partialAlphaPixels=0;
  for(let i=3;i<data.length;i+=4) {
    if(data[i]===0) transparentPixels++; else if(data[i]===255) opaquePixels++; else partialAlphaPixels++;
  }
  const isCutout = asset.id !== 'app-icon';
  if (isCutout) {
    if (!actual.hasAlphaChannel || transparentPixels < info.width*info.height*.1 || !opaquePixels || !partialAlphaPixels)
      throw new Error(asset.id + ': missing genuine cutout transparency or antialiased edges');
    for(let x=0;x<info.width;x++) for(const y of [0,info.height-1])
      if(data[(y*info.width+x)*4+3]!==0) throw new Error(asset.id + ': opaque top/bottom border');
    for(let y=0;y<info.height;y++) for(const x of [0,info.width-1])
      if(data[(y*info.width+x)*4+3]!==0) throw new Error(asset.id + ': opaque side border');
  } else if(transparentPixels || partialAlphaPixels) throw new Error('App icon must remain opaque');
  const alpha = {transparentPixels, opaquePixels, partialAlphaPixels};
  if (refresh) {
    const {prompt, ...metadata} = actual;
    Object.assign(asset, metadata, {nativeGeneratedMaster: !isCutout, background: isCutout ? 'transparent alpha' : 'opaque forest matte', alpha});
    asset.source.retainedMaster = originalFile;
    asset.source.retainedMasterSha256 = original.sha256;
    if(isCutout) asset.derivation = {script:'transparent-assets.mjs', method:'Background segmentation and edge matte removal from the individual original; no resizing or regeneration.'};
    asset.review.transparentMasterReady = isCutout;
    if(asset.id === 'logo-forest') asset.use='Forest monochrome logo on transparent background for light surfaces.';
    if(asset.id === 'logo-light') asset.use='Cream monochrome logo on transparent background for dark surfaces.';
    if(asset.id === 'adaptive-foreground') asset.use='Transparent mascot foreground with original safe-area margin.';
  }
  for (const key of ['width', 'height', 'hasAlphaChannel', 'sha256', 'pixelDataSha256'])
    if(actual[key]!==asset[key]) throw new Error(asset.id + ': ' + key + ' does not match manifest');
  if (asset.source.retainedMasterSha256 !== original.sha256) throw new Error(asset.id + ': retained master hash mismatch');
  if (JSON.stringify(asset.alpha)!==JSON.stringify(alpha)) throw new Error(asset.id + ': alpha statistics mismatch');
  if(actual.prompt !== fs.readFileSync(path.join(root,asset.promptFile),'utf8')) throw new Error(asset.id + ': prompt file mismatch');
  console.log(asset.id + ': ' + actual.width + 'x' + actual.height + ', transparent pixels=' + transparentPixels);
}
if(refresh) {
  manifest.schemaVersion=2;
  manifest.updatedAt=new Date().toISOString();
  manifest.status='Fifteen transparent UI derivatives verified; opaque app icon and original generated masters retained.';
  manifest.limitations=[
    'Original generations are opaque and retained in masters/. The UI cutouts are derived alpha PNGs, not newly generated masters.',
    'Actual dimensions remain 1254x1254 or 2172x724; requested 2048/4096 master sizes remain unmet. No upscaling.',
    'No editable vector source or platform-specific icon export pack is included.'
  ];
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
}
console.log('Verified ' + manifest.assets.length + ' brand assets, source provenance and decoded alpha pixels.');
