// Runtime copies of the polish artwork for the native apps. The originals in assets/polish/<group>/ are the masters and
// stay untouched; these are downscaled derivatives, never masters, never enlarged. Like the Phase F runtime stills
// (build-phase-f-runtime.mjs) each is one file sized for a 3x screen, with no @2x/@3x density variants.
// - Cutouts keep their full square canvas (no trim) and alpha, resized to min(source, 3 x the largest display size).
// - welcome-meja is an opaque photo: kept at its native 1024 x 1536 (cover at ~430pt wide needs more, never enlarged)
//   and stored as JPEG, since a lossless PNG of a photo would cost megabytes and it has no alpha to keep. (WebP at equal
//   PSNR softened the linen texture, so it stays JPEG.)
// - Food cutouts (plate-*, token-*) are photos with alpha: lossy WebP quality 85, alphaQuality 100. Checked side by side
//   with the PNG at 2x zoom on white and dark: no visible difference, ~5x smaller.
// - Illustrations are lossless WebP with exact: true, so every RGBA pixel equals the PNG it replaced (~27% smaller).
// Writes assets/polish/runtime/*.{webp,jpg} and assets/polish/runtime/manifest.json. Rerun after verify-polish --refresh.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets/polish');
const runtime = path.join(root, 'runtime');
const DENSITY = 3;

/** Largest display size in points (the longer side), from docs/brand/2026-10-30-polish-artwork-prompts.md. */
function displayPoints(stem) {
  if (stem === 'welcome-meja') return 430;
  if (['spot-nota', 'spot-lid-heart', 'spot-saringan'].includes(stem)) return 160; // empty states at ~160pt
  if (stem === 'moment-rantang-meledak') return 280;
  if (/^(empty|moment|primer|dapur)-/.test(stem)) return 240;
  if (/^(plate|token)-/.test(stem)) return 160;
  return 72; // spot icons, category chips (48-56pt), compliment medals (48pt in a 72pt ring)
}

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const polish = JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf8'));
const used = polish.assets.filter(asset => asset.usedByApp);

await fs.rm(runtime, { recursive: true, force: true });
await fs.mkdir(runtime, { recursive: true });

const files = [];
for (const asset of used) {
  const stem = path.basename(asset.file, '.png');
  const sourceBytes = await fs.readFile(path.join(root, asset.file));
  if (hash(sourceBytes) !== asset.sha256) throw new Error(`${asset.file}: does not match manifest.json; run verify-polish.mjs`);
  const photo = asset.transparentPixels === 0;
  const points = displayPoints(stem);
  // The longer side is what the display size limits for square cutouts; the photo is limited by its width.
  const wanted = points * DENSITY;
  const scale = Math.min(1, wanted / (photo ? asset.width : Math.max(asset.width, asset.height)));
  const width = Math.round(asset.width * scale);
  const height = Math.round(asset.height * scale);
  let pipeline = sharp(sourceBytes);
  if (scale < 1) pipeline = pipeline.resize(width, height, { kernel: sharp.kernel.lanczos3, fit: 'fill' });
  const food = /^(plate|token)-/.test(stem);
  const bytes = photo
    ? await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer()
    : food
      ? await pipeline.ensureAlpha().webp({ quality: 85, alphaQuality: 100, effort: 6, smartSubsample: true }).toBuffer()
      : await pipeline.ensureAlpha().webp({ lossless: true, exact: true, effort: 6 }).toBuffer();
  const meta = await sharp(bytes).metadata();
  if (meta.width !== width || meta.height !== height) throw new Error(`${stem}: wrote ${meta.width}x${meta.height}`);
  if (!photo && !meta.hasAlpha) throw new Error(`${stem}: lost alpha`);
  const format = photo ? 'jpeg' : food ? 'webp-lossy' : 'webp-lossless';
  const file = `${stem}.${photo ? 'jpg' : 'webp'}`;
  await fs.writeFile(path.join(runtime, file), bytes);
  files.push({
    name: stem,
    file: `runtime/${file}`,
    derivedFrom: asset.file,
    sourceSha256: asset.sha256,
    sourceWidth: asset.width,
    sourceHeight: asset.height,
    sourceBytes: asset.bytes,
    displayPoints: points,
    width,
    height,
    format,
    bytes: bytes.length,
    sha256: hash(bytes),
    alpha: !photo,
    method: `sharp ${sharp.versions.sharp}: ${scale < 1 ? `Lanczos3 downscale by ${scale.toFixed(4)}` : 'not resampled (source is below 3x the display size)'}, full canvas, no trim; ${photo ? 'JPEG quality 85 (mozjpeg), opaque source' : food ? 'WebP quality 85, alphaQuality 100, effort 6, full RGBA kept' : 'WebP lossless (exact), effort 6, full RGBA kept'}`,
    nativeGeneratedMaster: false,
    upscaled: false,
  });
}

const totalBytes = files.reduce((sum, f) => sum + f.bytes, 0);
await fs.writeFile(path.join(runtime, 'manifest.json'), JSON.stringify({
  script: 'packages/brand/build-polish-runtime.mjs',
  note: 'Runtime derivatives of the polish originals, the only polish art the native apps import. Not masters, never upscaled, not trimmed. One file per asset sized for 3x screens. The superseded dapur-rak-kosong and dapur/alternatives are not exported.',
  density: DENSITY,
  count: files.length,
  totalBytes,
  files,
}, null, 2) + '\n');

console.log(JSON.stringify({ count: files.length, totalBytes, sizes: Object.fromEntries(files.map(f => [f.name, `${f.width}x${f.height} ${f.bytes}`])) }, null, 2));
