// Runtime copies of the Phase F stills and rig layers for the native apps. The root PNGs are processed transparent
// derivatives (see processing-records.json); these are further derivatives of them. Neither is a master.
// Sizes follow each piece's largest spec size on a 3x screen (spec 7.2, controller ruling 2026-10-11):
// - Stills are trimmed to their visible box plus a 3% transparent margin, then downscaled so the visible height is
//   min(source visible height, 540px) (540 = 180pt x 3). Never enlarged. phaseF.ts records the box in the trimmed file.
// - Success rig layers stay full canvas, untrimmed and registered, downscaled to 800px (180pt at 3x needs 796px).
// - Reading rig layers stay full canvas, untrimmed, at 600px; their crisp ceiling at 3x is recorded in phaseF.ts.
// Rerun after build-phase-f-exports.mjs, which rewrites processing-records.json without the runtime block.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.dirname(fileURLToPath(import.meta.url));
const directory = path.join(root, 'assets/phase-f');
const runtime = path.join(directory, 'runtime');
const ALPHA_FLOOR = 8;
/** The densest screen the apps target. */
const DENSITY = 3;
/** The largest spec size of a still (the success beat's 180pt) at that density: the tallest a still's subject needs. */
const STILL_VISIBLE_MAX = 180 * DENSITY;
/** Transparent margin kept around a still's visible box, as a fraction of the box's longer side. */
const STILL_MARGIN = 0.03;
const SUCCESS_RIG_SIZE = 800;
const READING_RIG_SIZE = 600;

const poses = ['merayakan', 'membaca', 'tidur', 'bingung', 'melambai', 'mencari', 'memasak'];
const successLayers = ['rig-body', 'rig-lid', 'rig-badge', 'rig-arms-up', 'rig-eyes-open', 'rig-eyes-closed', 'rig-sparkles'];
const readingLayers = ['rig-reading-body', 'rig-reading-eyes', 'rig-reading-magnifier'];
const sources = [...poses.map(pose => `mascot-${pose}`), ...successLayers, ...readingLayers].map(name => `${name}.png`);
const rigSize = name => (successLayers.includes(name.slice(0, -'.png'.length)) ? SUCCESS_RIG_SIZE : READING_RIG_SIZE);

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const png = { compressionLevel: 9, adaptiveFiltering: true, palette: false };
const kept = 'PNG compression level 9, full RGBA kept, no palette';
const trim = `trimmed to the visible box (alpha > ${ALPHA_FLOOR}) plus a ${STILL_MARGIN * 100}% transparent margin (crop rect in source pixels in \`crop\`)`;
const stillMethod = (resampled, scale) => resampled
  ? `sharp ${sharp.versions.sharp}: ${trim}, then resized by ${scale.toFixed(4)} with the Lanczos3 kernel (libvips premultiplied alpha) so the visible height is about ${STILL_VISIBLE_MAX}px, never enlarged; ${kept}`
  : `sharp ${sharp.versions.sharp}: ${trim}; not resampled (no Lanczos3), its visible height is already under ${STILL_VISIBLE_MAX}px; ${kept}`;
const rigMethod = size => `sharp ${sharp.versions.sharp} resize of the full canvas to ${size}x${size} with the Lanczos3 kernel (libvips premultiplied alpha), never enlarged; not trimmed, so every layer stays registered at one origin; ${kept}`;

async function pixels(file) {
  return sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

/** Bounding box of every pixel with alpha above the floor, in pixels. */
function visible({ data, info }) {
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > ALPHA_FLOOR) {
      if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) throw new Error('No visible pixels');
  return { minX, minY, maxX, maxY, width: info.width, height: info.height };
}
const union = boxes => boxes.reduce((a, b) => ({ minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY), width: a.width, height: a.height }));
const normalise = b => ({ x: b.minX / b.width, y: b.minY / b.height, w: (b.maxX - b.minX + 1) / b.width, h: (b.maxY - b.minY + 1) / b.height });
/** The largest size in points a subject this many pixels tall shows at on a 3x screen, rounded down to a tenth. */
const crispPoints = px => Math.floor((px / DENSITY) * 10) / 10;

/**
 * A still trimmed to its visible box plus the margin and downscaled so the subject is at most STILL_VISIBLE_MAX tall.
 * The resample can soften the outermost rows under the alpha floor, so the target grows a pixel at a time until the
 * measured subject is as tall as asked; it never passes the source's own height (never enlarged).
 */
async function still(sourceBytes, box) {
  const boxW = box.maxX - box.minX + 1;
  const boxH = box.maxY - box.minY + 1;
  const margin = Math.round(STILL_MARGIN * Math.max(boxW, boxH));
  const left = Math.max(0, box.minX - margin);
  const top = Math.max(0, box.minY - margin);
  const crop = { left, top, width: Math.min(box.width, box.maxX + 1 + margin) - left, height: Math.min(box.height, box.maxY + 1 + margin) - top };
  const wanted = Math.min(boxH, STILL_VISIBLE_MAX);
  for (let target = wanted; ; target++) {
    const resampled = target < boxH;
    const scale = target / boxH;
    const width = resampled ? Math.round(crop.width * scale) : crop.width;
    const height = resampled ? Math.round(crop.height * scale) : crop.height;
    let pipeline = sharp(sourceBytes).ensureAlpha().extract(crop);
    if (resampled) pipeline = pipeline.resize(width, height, { kernel: sharp.kernel.lanczos3, fit: 'fill', withoutEnlargement: true });
    const bytes = await pipeline.png(png).toBuffer();
    const measured = visible(await pixels(bytes));
    const visibleHeight = measured.maxY - measured.minY + 1;
    if (visibleHeight >= wanted || !resampled) {
      return {
        bytes, width, height, crop, visibleHeight,
        method: stillMethod(resampled, scale),
        // The source-measured box as fractions of the trimmed file: a fill resize maps the crop's fractions onto it.
        box: { x: (box.minX - crop.left) / crop.width, y: (box.minY - crop.top) / crop.height, w: boxW / crop.width, h: boxH / crop.height },
        aspect: crop.width / crop.height,
        subjectPx: (boxH * height) / crop.height,
      };
    }
  }
}

async function rigLayer(sourceBytes, size) {
  const bytes = await sharp(sourceBytes)
    .ensureAlpha()
    .resize(size, size, { kernel: sharp.kernel.lanczos3, fit: 'fill', withoutEnlargement: true })
    .png(png)
    .toBuffer();
  return { bytes, width: size, height: size };
}

await fs.mkdir(runtime, { recursive: true });
for (const stale of await fs.readdir(runtime)) if (stale.endsWith('.png') && !sources.includes(stale)) await fs.rm(path.join(runtime, stale));

const records = [];
const boxes = {};
const stills = {};
for (const name of sources) {
  const sourceBytes = await fs.readFile(path.join(directory, name));
  const raw = await pixels(sourceBytes);
  if (raw.info.width !== raw.info.height) throw new Error(`${name}: source canvas is not square`);
  boxes[name] = visible(raw);
  const pose = name.startsWith('mascot-') ? name.slice('mascot-'.length, -'.png'.length) : null;
  const made = pose ? await still(sourceBytes, boxes[name]) : await rigLayer(sourceBytes, Math.min(rigSize(name), raw.info.width));
  if (pose) stills[pose] = made;
  const copy = await sharp(made.bytes).metadata();
  if (copy.width !== made.width || copy.height !== made.height || !copy.hasAlpha) throw new Error(`${name}: runtime copy is ${copy.width}x${copy.height}, alpha ${copy.hasAlpha}`);
  if (copy.width > raw.info.width || copy.height > raw.info.height) throw new Error(`${name}: runtime copy is larger than its source`);
  await fs.writeFile(path.join(runtime, name), made.bytes);
  records.push({
    name: `runtime/${name}`,
    source: name,
    sourceSha256: hash(sourceBytes),
    sourceWidth: raw.info.width,
    sourceHeight: raw.info.height,
    sourceBytes: sourceBytes.length,
    sha256: hash(made.bytes),
    width: made.width,
    height: made.height,
    bytes: made.bytes.length,
    method: pose ? made.method : rigMethod(made.width),
    derivativeOf: `Processed transparent export ${name} (its own record above); runtime copy for the native apps`,
    nativeGeneratedMaster: false,
    upscaled: false,
    trimmed: Boolean(pose),
    ...(pose ? { crop: made.crop, visibleHeight: made.visibleHeight } : {}),
  });
}

// processing-records.json keeps the 23 export records first; runtime records are replaced as a block on every run.
const processingPath = path.join(directory, 'processing-records.json');
const processing = JSON.parse(await fs.readFile(processingPath, 'utf8')).filter(record => !record.name.startsWith('runtime/'));
await fs.writeFile(processingPath, JSON.stringify([...processing, ...records], null, 2) + '\n');

const manifestPath = path.join(root, 'manifest.brand.json');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
manifest.phaseFRuntime = {
  script: 'build-phase-f-runtime.mjs',
  note: `Runtime derivatives of the processed Phase F exports, the only Phase F art the native apps import. Not masters and never upscaled. Stills are trimmed to their visible box plus a ${STILL_MARGIN * 100}% margin (crop rect recorded) and downscaled to a visible height of at most ${STILL_VISIBLE_MAX}px; success rig layers are untrimmed ${SUCCESS_RIG_SIZE}px canvases and reading rig layers untrimmed ${READING_RIG_SIZE}px canvases. Hashes match assets/phase-f/processing-records.json.`,
  files: records.map(record => ({
    file: `assets/phase-f/${record.name}`,
    source: `assets/phase-f/${record.source}`,
    width: record.width,
    height: record.height,
    bytes: record.bytes,
    sha256: record.sha256,
    nativeGeneratedMaster: false,
    upscaled: false,
    trimmed: record.trimmed,
    ...(record.crop ? { crop: record.crop } : {}),
  })),
};
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

// phaseF.ts: measured geometry for the native components. Never edit by hand; rerun this script.
const rig = JSON.parse(await fs.readFile(path.join(directory, 'rig.json'), 'utf8'));
const canvas = rig.canvas.width;
if (rig.canvas.height !== canvas) throw new Error('Rig canvas is not square');
const point = ([x, y]) => ({ x: x / canvas, y: y / canvas });
const successRest = union(successLayers.filter(layer => !['rig-eyes-closed', 'rig-sparkles'].includes(layer)).map(layer => boxes[`${layer}.png`]));
const readingRest = union(readingLayers.map(layer => boxes[`${layer}.png`]));
const highlight = rig.readingRig.paperHighlight;
const geometry = {
  visibleBox: Object.fromEntries(poses.map(pose => [pose, normalise(boxes[`mascot-${pose}.png`])])),
  stillRuntime: Object.fromEntries(poses.map(pose => [pose, { box: stills[pose].box, aspect: stills[pose].aspect }])),
  successRigBox: normalise(successRest),
  readingRigBox: normalise(readingRest),
  successRig: { lidHinge: point(rig.successRig.lidHinge), bodyPivot: point(rig.successRig.bodyPivot), badgePivot: point(rig.successRig.badgePivot) },
  readingRig: {
    magnifierPivot: point(rig.readingRig.magnifierPivot),
    eyeSeam: rig.readingRig.eyeParts[0].clipX[1] / canvas,
    eyePivots: rig.readingRig.eyeParts.map(part => point(part.pivot)),
    paperHighlight: { ...point(highlight.center), w: highlight.width / canvas, h: highlight.height / canvas, rotate: highlight.rotationDegrees },
  },
};
const crispMaxSize = {
  stills: Object.fromEntries(poses.map(pose => [pose, crispPoints(stills[pose].subjectPx)])),
  successRig: crispPoints(normalise(successRest).h * SUCCESS_RIG_SIZE),
  readingRig: crispPoints(normalise(readingRest).h * READING_RIG_SIZE),
};
const ts = `// Generated by packages/brand/build-phase-f-runtime.mjs from the Phase F artwork. Do not edit by hand.
// Boxes are measured from alpha > ${ALPHA_FLOOR} on the ${canvas}px processed exports and normalised to 0..1 of the canvas.
// Rig points come from assets/phase-f/rig.json, normalised the same way.

export type MascotPose = ${poses.map(pose => JSON.stringify(pose)).join(' | ')};
export type PhaseFBox = { x: number; y: number; w: number; h: number };
export type PhaseFPoint = { x: number; y: number };

export const mascotPoses: readonly MascotPose[] = ${JSON.stringify(poses)};

/** Visible box of each still on its ${canvas}px source canvas. \`MascotArt\` keeps every pose at one optical size by it. */
export const visibleBox: Record<MascotPose, PhaseFBox> = ${JSON.stringify(geometry.visibleBox, null, 2)};

/**
 * Each still's runtime file is trimmed to its visible box plus a ${STILL_MARGIN * 100}% transparent margin. \`box\` is the same
 * source-measured visible box as fractions of that trimmed file, and \`aspect\` its true width over height (the crop's).
 */
export const stillRuntime: Record<MascotPose, { box: PhaseFBox; aspect: number }> = ${JSON.stringify(geometry.stillRuntime, null, 2)};

/** Visible box of the success rig at rest (eyes open, sparkles hidden), across its registered layers. */
export const successRigBox: PhaseFBox = ${JSON.stringify(geometry.successRigBox)};

/** Visible box of the reading rig across its registered layers. */
export const readingRigBox: PhaseFBox = ${JSON.stringify(geometry.readingRigBox)};

/**
 * The largest \`size\` in points each piece renders at on a ${DENSITY}x screen without upscaling its runtime file, rounded down to
 * a tenth. Spec sizes: 180 for the success rig and \`merayakan\`, 120 for the other stills and the reading rig.
 */
export const crispMaxSize = ${JSON.stringify(crispMaxSize, null, 2)} as const;

export const successRig = ${JSON.stringify(geometry.successRig, null, 2)} as const;

export const readingRig = ${JSON.stringify(geometry.readingRig, null, 2)} as const;
`;
await fs.writeFile(path.join(root, 'phaseF.ts'), ts);

console.log(JSON.stringify(records.map(({ name, sourceBytes, bytes, width, height, visibleHeight }) => ({ name, sourceBytes, bytes, width, height, visibleHeight })), null, 2));
console.log(JSON.stringify(crispMaxSize));
