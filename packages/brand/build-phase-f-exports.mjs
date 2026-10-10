// User approved clean exports on 2026-10-11; generated originals remain byte-identical.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const directory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets/phase-f');
const originals = path.join(directory, 'originals');
const records = JSON.parse(await fs.readFile(path.join(directory, 'generation-records.json'), 'utf8'));
await fs.mkdir(originals, { recursive: true });
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function clean(data, width, height) {
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] <= 8) data.fill(0, i, i + 4);
  const seen = new Uint8Array(width * height);
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || !data[start * 4 + 3]) continue;
    const queue = [start]; seen[start] = 1;
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i], x = p % width, y = Math.floor(p / width);
      for (const next of [x ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y ? p - width : -1, y < height - 1 ? p + width : -1]) {
        if (next >= 0 && !seen[next] && data[next * 4 + 3]) { seen[next] = 1; queue.push(next); }
      }
    }
    if (queue.length < 32) for (const p of queue) data.fill(0, p * 4, p * 4 + 4);
  }
  return data;
}
function bounds(data, width, height) {
  const b = [width, height, -1, -1];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3]) {
    b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y);
  }
  return b;
}
function transform(data, width, height, outputSize, sx, sy, dx, dy, rotationDegrees = 0) {
  const output = Buffer.alloc(outputSize * outputSize * 4);
  const angle = rotationDegrees * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  for (let y = 0; y < outputSize; y++) for (let x = 0; x < outputSize; x++) {
    const px = x + .5 - dx, py = y + .5 - dy;
    const fx = (cos * px + sin * py) / sx - .5, fy = (-sin * px + cos * py) / sy - .5;
    const left = Math.floor(fx), top = Math.floor(fy), tx = fx - left, ty = fy - top;
    let alpha = 0; const color = [0, 0, 0];
    for (const [px, py, weight] of [[left, top, (1 - tx) * (1 - ty)], [left + 1, top, tx * (1 - ty)], [left, top + 1, (1 - tx) * ty], [left + 1, top + 1, tx * ty]]) {
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      const index = (py * width + px) * 4, a = data[index + 3] * weight;
      alpha += a;
      for (let c = 0; c < 3; c++) color[c] += data[index + c] * a;
    }
    if (alpha <= 8) continue;
    const index = (y * outputSize + x) * 4;
    for (let c = 0; c < 3; c++) output[index + c] = Math.round(color[c] / alpha);
    output[index + 3] = Math.round(alpha);
  }
  return clean(output, outputSize, outputSize);
}
function transformParts(data, width, height, size, parts) {
  const combined = Buffer.alloc(size * size * 4);
  for (const { sourceRegion: [x0, y0, x1, y1], sx, sy, dx, dy } of parts) {
    const isolated = Buffer.alloc(data.length);
    for (let y = y0; y < y1; y++) data.copy(isolated, (y * width + x0) * 4, (y * width + x0) * 4, (y * width + x1) * 4);
    const moved = transform(isolated, width, height, size, sx, sy, dx, dy);
    for (let i = 0; i < moved.length; i += 4) if (moved[i + 3]) {
      if (combined[i + 3]) throw new Error('Registration parts overlap');
      moved.copy(combined, i, i, i + 4);
    }
  }
  return combined;
}

const exports = [];
for (const record of records) {
  const retained = path.join(originals, record.name);
  let original;
  try { original = await fs.readFile(retained); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    original = await fs.readFile(path.join(directory, record.name));
    await fs.writeFile(retained, original, { flag: 'wx' });
  }
  if (record.sourceSha256 && hash(original) !== record.sourceSha256) throw new Error(`Original changed: ${record.name}`);
  const { data, info } = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  clean(data, info.width, info.height);
  const size = record.size || (record.name.startsWith('rig-') ? 1254 : 1024);
  let sx = size / info.width, sy = size / info.height, dx = 0, dy = 0;
  let parts = null, rotationDegrees = 0;
  if (record.name.startsWith('rig-')) {
    if (record.name === 'rig-lid.png') {
      sx = .945; sy = .805; rotationDegrees = 8;
      const angle = rotationDegrees * Math.PI / 180;
      dx = 100 + Math.cos(angle) * -81 - Math.sin(angle) * -611.8;
      dy = 590 + Math.sin(angle) * -81 + Math.cos(angle) * -611.8;
    }
    if (record.name === 'rig-eyes-open.png') parts = [
      { sourceRegion: [0, 0, 700, info.height], sx: 1, sy: 1, dx: 0, dy: 0 },
      { sourceRegion: [700, 0, info.width, info.height], sx: 1, sy: 1, dx: 50, dy: -20 }
    ];
    if (record.name === 'rig-eyes-closed.png') parts = [
      { sourceRegion: [0, 0, 700, info.height], sx: .856, sy: 1, dx: 53, dy: -120 },
      { sourceRegion: [700, 0, info.width, info.height], sx: .856, sy: 1, dx: 105, dy: -140 }
    ];
    if (record.name === 'rig-arms-up.png') dy = -90;
    if (record.name === 'rig-badge.png') { sx = sy = .63; dx = 505; dy = -30; }
    if (record.name === 'rig-sparkles.png') parts = [
      { sourceRegion: [0, 0, 800, info.height], sx: 1, sy: 1, dx: -40, dy: -210 },
      { sourceRegion: [800, 0, info.width, 470], sx: 1, sy: 1, dx: 0, dy: -150 },
      { sourceRegion: [800, 470, info.width, 590], sx: 1, sy: 1, dx: -230, dy: -377 },
      { sourceRegion: [800, 590, info.width, info.height], sx: 1, sy: 1, dx: 5, dy: -495 }
    ];
    if (record.name === 'rig-reading-eyes.png') { sx = sy = .785; dx = 247; dy = 250; }
    if (record.name === 'rig-reading-magnifier.png') { sx = sy = .75; dx = 230; dy = 350; }
  } else {
    const b = bounds(data, info.width, info.height), w = b[2] - b[0] + 1, h = b[3] - b[1] + 1;
    const margin = record.name.startsWith('icon-ios-') ? .13 : .105;
    sx = sy = Math.min(sx, size * (1 - 2 * margin) / w, size * (1 - 2 * margin) / h);
    dx = size / 2 - (b[0] + b[2] + 1) / 2 * sx;
    dy = size / 2 - (b[1] + b[3] + 1) / 2 * sy;
  }
  const output = parts ? transformParts(data, info.width, info.height, size, parts) : transform(data, info.width, info.height, size, sx, sy, dx, dy, rotationDegrees);
  let colorConversion = null;
  if (record.name === 'icon-monochrome.png') {
    colorConversion = 'Solid RGB #000000; antialiasing in alpha only';
    for (let i = 0; i < output.length; i += 4) output[i] = output[i + 1] = output[i + 2] = 0;
  }
  if (record.name === 'icon-ios-tinted.png') {
    colorConversion = 'Neutral grayscale, R=G=B; map luminance to 96..255';
    for (let i = 0; i < output.length; i += 4) if (output[i + 3]) {
      const gray = Math.round(96 + (.2126 * output[i] + .7152 * output[i + 1] + .0722 * output[i + 2]) / 255 * 159);
      output[i] = output[i + 1] = output[i + 2] = gray;
    }
  }
  const bytes = await sharp(output, { raw: { width: size, height: size, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
  await fs.writeFile(path.join(directory, record.name), bytes);
  exports.push({ name: record.name, retainedOriginal: `originals/${record.name}`, originalSha256: hash(original), exportSha256: hash(bytes), width: size, height: size,
    method: 'Remove alpha <=8/255 and disconnected islands under 32 pixels; premultiplied-alpha bilinear resampling; preserve transparent canvas',
    transform: parts ? { parts, note: 'Empty source-space regions isolate existing features; all visible pixels retained without painting' } : { sx, sy, dx, dy, rotationDegrees }, colorConversion, nativeGeneratedMaster: false, upscaled: false, authorization: 'User approved preserving originals and creating clean exports, 2026-10-11' });
}
await fs.writeFile(path.join(directory, 'processing-records.json'), JSON.stringify(exports, null, 2) + '\n');
console.log(`Created ${exports.length} clean exports; all generated originals retained byte-for-byte.`);
