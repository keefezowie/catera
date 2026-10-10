import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const directory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets/phase-f');
const records = JSON.parse(await fs.readFile(path.join(directory, 'generation-records.json'), 'utf8'));
let processing = [];
try { processing = JSON.parse(await fs.readFile(path.join(directory, 'processing-records.json'), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const assets = [];
for (const record of records) {
  const file = path.join(directory, record.name);
  const bytes = await fs.readFile(file);
  const metadata = await sharp(bytes).metadata();
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bounds = [info.width, info.height, -1, -1];
  let transparent = 0, opaque = 0, partial = 0, strongAlpha = 0, borderPixels = 0, outsideCircle = 0;
  let nonGray = 0, nonBlack = 0;
  const circleFraction = record.name === 'adaptive-foreground.png' || record.name === 'icon-monochrome.png' ? .33 : 680 / 2048;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const index = (y * info.width + x) * 4;
    const [r, g, b, a] = data.subarray(index, index + 4);
    if (a === 0) { transparent++; continue; }
    if (a === 255) opaque++; else partial++;
    if (a >= 240) strongAlpha++;
    bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.min(bounds[1], y);
    bounds[2] = Math.max(bounds[2], x); bounds[3] = Math.max(bounds[3], y);
    if (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) borderPixels++;
    if (Math.hypot(x + .5 - info.width / 2, y + .5 - info.height / 2) > info.width * circleFraction) outsideCircle++;
    if (r !== g || g !== b) nonGray++;
    if (r !== 0 || g !== 0 || b !== 0) nonBlack++;
  }
  const failures = [];
  const warnings = [];
  const derivative = processing.find(item => item.name === record.name);
  const expectedSize = record.size || (record.name.startsWith('mascot-') || record.name.startsWith('rig-') ? 1254 : 1024);
  if (!metadata.hasAlpha || transparent < info.width * info.height * .1 || strongAlpha === 0) failures.push('Missing genuine subject/background alpha');
  if (borderPixels) failures.push(`${borderPixels} nontransparent pixels touch canvas edge`);
  if (info.width !== expectedSize || info.height !== expectedSize) (derivative ? failures : warnings).push(`Requested ${expectedSize}x${expectedSize}; output is ${info.width}x${info.height}`);
  if (/^(splash-mark|adaptive-foreground|icon-monochrome)/.test(record.name) && outsideCircle) failures.push(`${outsideCircle} nontransparent pixels outside required circle`);
  if (record.name === 'icon-ios-tinted.png' && nonGray) failures.push(`${nonGray} colored pixels in grayscale icon`);
  if (record.name === 'icon-monochrome.png' && nonBlack) failures.push(`${nonBlack} nonblack pixels in single-black-ink icon`);
  if (record.name.startsWith('mascot-') && (bounds[0] < info.width * .1 || bounds[1] < info.height * .1 || bounds[2] >= info.width * .9 || bounds[3] >= info.height * .9)) failures.push('Artwork exceeds the required 10% empty margin');
  if (/^icon-ios-/.test(record.name) && (bounds[0] < info.width * .12 || bounds[1] < info.height * .12 || bounds[2] >= info.width * .88 || bounds[3] >= info.height * .88)) failures.push('Artwork exceeds the required 12% empty margin');
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  let originalHash = record.sourceSha256;
  try { originalHash = crypto.createHash('sha256').update(await fs.readFile(record.sourcePath)).digest('hex'); }
  catch (error) { if (error.code !== 'ENOENT' || !originalHash) throw error; }
  if (derivative) {
    const retainedHash = crypto.createHash('sha256').update(await fs.readFile(path.join(directory, derivative.retainedOriginal))).digest('hex');
    if (retainedHash !== originalHash || retainedHash !== derivative.originalSha256) failures.push('Retained original differs from generator output');
    if (sha256 !== derivative.exportSha256) failures.push('Export changed after recorded processing');
  } else if (originalHash !== sha256) failures.push('Delivered PNG differs from generated original');
  record.sourceSha256 = originalHash;
  assets.push({ id: record.name.replace('.png', ''), file: record.name, priority: record.priority || 'P1', width: info.width, height: info.height, bytes: bytes.length, sha256, nativeGeneratedMaster: !derivative, upscaled: false, cropped: false, retouched: Boolean(derivative), derivation: derivative || null, hasAlpha: metadata.hasAlpha, alpha: { transparent, opaque, partial }, bounds, outsideCircle, failures, warnings });
}
const confettiBytes = await fs.readFile(path.join(directory, 'confetti.json'));
const confetti = JSON.parse(confettiBytes);
if (confetti.fr !== 60 || confetti.op - confetti.ip !== 72 || confetti.layers.length !== 24 || confetti.assets.length || confettiBytes.length > 150 * 1024) throw new Error('Confetti animation contract failed');
const allowedColors = ['163D2E', 'F47B2A', '9B4309', 'FFF7E9'].map(hex => [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16) / 255));
for (const layer of confetti.layers) {
  if (layer.ty !== 4 || layer.ks.o.k.at(-1).s[0] !== 0 || layer.op > confetti.op - 1) throw new Error('Confetti must contain vector layers and end transparent');
  for (const shape of layer.shapes.filter(shape => shape.ty === 'fl' || shape.ty === 'st')) {
    if (!allowedColors.some(color => color.every((channel, index) => Math.abs(channel - shape.c.k[index]) < 1e-9))) throw new Error('Confetti palette mismatch');
  }
}
const poster = await sharp(path.join(directory, 'confetti-last-frame.png')).ensureAlpha().raw().toBuffer();
if (poster.some((channel, index) => index % 4 === 3 && channel !== 0)) throw new Error('Confetti last frame must be empty');
// Check the assembled character's anatomy, not just each PNG's canvas contract.
const rigNames = ['body', 'lid', 'eyes-open', 'eyes-closed', 'badge', 'arms-up', 'sparkles'];
const rigPixels = Object.fromEntries(await Promise.all(rigNames.map(async name => [name, await sharp(path.join(directory, `rig-${name}.png`)).ensureAlpha().raw().toBuffer()])));
const rigChecks = { eyeMouthOverlaps: 0, eyeFoodOverlaps: 0, eyeArmOverlaps: 0, badgeCheckOccludedPixels: 0, handBadgeOverlapPixels: 0, handLidOverlapPixels: 0, lidBodyOverlapPixels: 0, sparkleSubjectOverlapPixels: 0, hingeContact: true };
const foodPolygon = [[150, 580], [800, 373], [1178, 650], [300, 780]];
function insidePolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[i], [bx, by] = polygon[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}
for (let y = 0; y < 1254; y++) for (let x = 0; x < 1254; x++) {
  const i = (y * 1254 + x) * 4;
  const [r, g, b, a] = rigPixels.body.subarray(i, i + 4);
  const eye = rigPixels['eyes-open'][i + 3] > 32 || rigPixels['eyes-closed'][i + 3] > 32;
  const mouth = x >= 600 && x < 850 && y >= 800 && y < 1010 && a > 32 && ((r < 90 && g < 140 && b < 110) || (r > 200 && g < 160 && b < 130));
  if (eye && mouth) rigChecks.eyeMouthOverlaps++;
  if (eye && a > 32 && insidePolygon(x, y, foodPolygon)) rigChecks.eyeFoodOverlaps++;
  const badge = rigPixels.badge, arm = rigPixels['arms-up'][i + 3] > 32;
  if (eye && arm) rigChecks.eyeArmOverlaps++;
  if (arm && rigPixels.lid[i + 3] > 32) rigChecks.handLidOverlapPixels++;
  if (a > 32 && rigPixels.lid[i + 3] > 32) rigChecks.lidBodyOverlapPixels++;
  if (badge[i + 3] > 32 && arm) {
    rigChecks.handBadgeOverlapPixels++;
    if (badge[i] > 200 && badge[i + 1] > 190 && badge[i + 2] > 160) rigChecks.badgeCheckOccludedPixels++;
  }
  if (rigPixels.sparkles[i + 3] > 32 && ['body', 'lid', 'badge', 'arms-up'].some(name => rigPixels[name][i + 3] > 32)) rigChecks.sparkleSubjectOverlapPixels++;
}
for (const name of ['lid', 'body']) {
  let touchesHinge = false;
  for (let y = 550; y <= 610; y++) for (let x = 70; x <= 130; x++) if (rigPixels[name][(y * 1254 + x) * 4 + 3] > 32) touchesHinge = true;
  rigChecks.hingeContact &&= touchesHinge;
}
const lidBounds = assets.find(asset => asset.file === 'rig-lid.png').bounds, bodyBounds = assets.find(asset => asset.file === 'rig-body.png').bounds;
rigChecks.lidToBodyWidthRatio = (lidBounds[2] - lidBounds[0] + 1) / (bodyBounds[2] - bodyBounds[0] + 1);
const rig = JSON.parse(await fs.readFile(path.join(directory, 'rig.json'), 'utf8'));
const expectedDrawOrder = ['rig-body.png', 'rig-lid.png', 'rig-badge.png', 'rig-arms-up.png', 'rig-eyes-open.png', 'rig-eyes-closed.png', 'rig-sparkles.png'];
if (JSON.stringify(rig.successRig.drawOrderBackToFront) !== JSON.stringify(expectedDrawOrder)) throw new Error('Success rig must draw the lid over the back rim and under the foreground hands');
if (rigChecks.eyeMouthOverlaps || rigChecks.eyeFoodOverlaps || rigChecks.eyeArmOverlaps || rigChecks.badgeCheckOccludedPixels || rigChecks.sparkleSubjectOverlapPixels || rigChecks.handBadgeOverlapPixels < 100 || rigChecks.handLidOverlapPixels < 100 || rigChecks.lidBodyOverlapPixels < 100 || rigChecks.lidToBodyWidthRatio < .8 || rigChecks.lidToBodyWidthRatio > 1.05 || !rigChecks.hingeContact) throw new Error(`Rig assembly geometry failed: ${JSON.stringify(rigChecks)}`);
const manifest = { schemaVersion: 1, brief: '../../../../docs/brand/phase-f-artwork-briefs.md', generator: 'built-in image_gen', originalsPreserved: true, assets,
  rigChecks,
  animations: [{ file: 'confetti.json', kind: 'code-drawn vector Lottie', fps: 60, durationSeconds: 1.2, loop: false, bytes: confettiBytes.length, sha256: crypto.createHash('sha256').update(confettiBytes).digest('hex'), poster: 'confetti-last-frame.png' }],
  mascotAnimations: 'Layered rig alternative from the brief, with registration and motion recipes in rig.json; no mascot Lottie exports claimed' };
await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await fs.writeFile(path.join(directory, 'generation-records.json'), JSON.stringify(records, null, 2) + '\n');
console.log(JSON.stringify(assets.map(({ file, width, height, failures, warnings }) => ({ file, width, height, failures, warnings })), null, 2));
if (assets.some(asset => asset.failures.length)) process.exitCode = 1;
