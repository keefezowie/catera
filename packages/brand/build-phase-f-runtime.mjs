// Runtime copies of the Phase F stills and rig layers for the native apps. The root PNGs are processed transparent
// derivatives (see processing-records.json); these are further downscaled derivatives of them. Neither is a master.
// Downscale only, never upscale; rig layers stay square and untrimmed so they remain registered at one origin.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.dirname(fileURLToPath(import.meta.url));
const directory = path.join(root, 'assets/phase-f');
const runtime = path.join(directory, 'runtime');
const RUNTIME_SIZE = 600;
const ALPHA_FLOOR = 8;

const poses = ['merayakan', 'membaca', 'tidur', 'bingung', 'melambai', 'mencari', 'memasak'];
const successLayers = ['rig-body', 'rig-lid', 'rig-badge', 'rig-arms-up', 'rig-eyes-open', 'rig-eyes-closed', 'rig-sparkles'];
const readingLayers = ['rig-reading-body', 'rig-reading-eyes', 'rig-reading-magnifier'];
const sources = [...poses.map(pose => `mascot-${pose}`), ...successLayers, ...readingLayers].map(name => `${name}.png`);

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const method = `sharp ${sharp.versions.sharp} resize to fit ${RUNTIME_SIZE}x${RUNTIME_SIZE} with the Lanczos3 kernel (libvips premultiplied alpha), never enlarged; PNG compression level 9, full RGBA kept, no trim, no palette`;

async function pixels(file) {
  return sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

/** Bounding box of every pixel with alpha above the floor, as fractions of the canvas. */
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

await fs.mkdir(runtime, { recursive: true });
for (const stale of await fs.readdir(runtime)) if (stale.endsWith('.png') && !sources.includes(stale)) await fs.rm(path.join(runtime, stale));

const records = [];
const boxes = {};
for (const name of sources) {
  const sourceFile = path.join(directory, name);
  const sourceBytes = await fs.readFile(sourceFile);
  const raw = await pixels(sourceBytes);
  if (raw.info.width !== raw.info.height) throw new Error(`${name}: source canvas is not square`);
  boxes[name] = visible(raw);
  const size = Math.min(RUNTIME_SIZE, raw.info.width);
  const bytes = await sharp(sourceBytes)
    .ensureAlpha()
    .resize(size, size, { kernel: sharp.kernel.lanczos3, fit: 'fill', withoutEnlargement: true })
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
    .toBuffer();
  const copy = await sharp(bytes).metadata();
  if (copy.width !== size || copy.height !== size || !copy.hasAlpha) throw new Error(`${name}: runtime copy is ${copy.width}x${copy.height}, alpha ${copy.hasAlpha}`);
  await fs.writeFile(path.join(runtime, name), bytes);
  records.push({
    name: `runtime/${name}`,
    source: name,
    sourceSha256: hash(sourceBytes),
    sourceWidth: raw.info.width,
    sourceHeight: raw.info.height,
    sourceBytes: sourceBytes.length,
    sha256: hash(bytes),
    width: size,
    height: size,
    bytes: bytes.length,
    method,
    derivativeOf: `Processed transparent export ${name} (its own record above); runtime copy for the native apps`,
    nativeGeneratedMaster: false,
    upscaled: false,
    trimmed: false,
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
  note: 'Downscaled runtime derivatives of the processed Phase F exports, the only Phase F art the native apps import. Not masters, not upscaled, not trimmed; hashes match assets/phase-f/processing-records.json.',
  files: records.map(record => ({ file: `assets/phase-f/${record.name}`, source: `assets/phase-f/${record.source}`, width: record.width, height: record.height, bytes: record.bytes, sha256: record.sha256, nativeGeneratedMaster: false, upscaled: false })),
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
const ts = `// Generated by packages/brand/build-phase-f-runtime.mjs from the Phase F artwork. Do not edit by hand.
// Boxes are measured from alpha > ${ALPHA_FLOOR} on the ${canvas}px processed exports and normalised to 0..1 of the canvas.
// Rig points come from assets/phase-f/rig.json, normalised the same way.

export type MascotPose = ${poses.map(pose => JSON.stringify(pose)).join(' | ')};
export type PhaseFBox = { x: number; y: number; w: number; h: number };
export type PhaseFPoint = { x: number; y: number };

export const mascotPoses: readonly MascotPose[] = ${JSON.stringify(poses)};

/** Visible box of each still. \`MascotArt\` scales by it so every pose renders at one optical size. */
export const visibleBox: Record<MascotPose, PhaseFBox> = ${JSON.stringify(geometry.visibleBox, null, 2)};

/** Visible box of the success rig at rest (eyes open, sparkles hidden), across its registered layers. */
export const successRigBox: PhaseFBox = ${JSON.stringify(geometry.successRigBox)};

/** Visible box of the reading rig across its registered layers. */
export const readingRigBox: PhaseFBox = ${JSON.stringify(geometry.readingRigBox)};

export const successRig = ${JSON.stringify(geometry.successRig, null, 2)} as const;

export const readingRig = ${JSON.stringify(geometry.readingRig, null, 2)} as const;
`;
await fs.writeFile(path.join(root, 'phaseF.ts'), ts);

console.log(JSON.stringify(records.map(({ name, sourceBytes, bytes, width }) => ({ name, sourceBytes, bytes, width })), null, 2));
console.log(JSON.stringify(geometry.visibleBox), JSON.stringify(geometry.successRigBox), JSON.stringify(geometry.readingRigBox));
