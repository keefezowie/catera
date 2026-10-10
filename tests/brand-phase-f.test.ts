import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { crispMaxSize, mascotPoses, readingRigBox, stillRuntime, successRigBox, visibleBox, type MascotPose } from '../packages/brand/phaseF';

type Crop = { left: number; top: number; width: number; height: number };
type RuntimeRecord = {
  name: string; source: string; sha256: string; method: string; width: number; height: number; upscaled: boolean;
  trimmed: boolean; crop?: Crop; visibleHeight?: number;
};

const directory = path.join(process.cwd(), 'packages/brand/assets/phase-f');
const runtime = path.join(directory, 'runtime');
const records: RuntimeRecord[] = JSON.parse(readFileSync(path.join(directory, 'processing-records.json'), 'utf8'));
const runtimeFiles = readdirSync(runtime).filter(name => name.endsWith('.png')).sort();
const stills = mascotPoses.map(pose => `mascot-${pose}.png`);
const successLayers = ['rig-body', 'rig-lid', 'rig-badge', 'rig-arms-up', 'rig-eyes-open', 'rig-eyes-closed', 'rig-sparkles'].map(name => `${name}.png`);
const successRest = successLayers.filter(name => !['rig-eyes-closed.png', 'rig-sparkles.png'].includes(name));
const readingLayers = ['rig-reading-body', 'rig-reading-eyes', 'rig-reading-magnifier'].map(name => `${name}.png`);
const rigLayers = [...successLayers, ...readingLayers];
const runtimeRecord = (file: string) => records.find(record => record.name === `runtime/${file}`)!;

/** Spec 7.2 sizes in points: the success beat's 180 for merayakan and the success rig, 120 for everything else. */
const DENSITY = 3;
const specSize = (pose: MascotPose) => (pose === 'merayakan' ? 180 : 120);

type Bounds = { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
async function bounds(file: string): Promise<Bounds> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 8) {
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY, width: info.width, height: info.height };
}
const unionHeight = (all: Bounds[]) => Math.max(...all.map(b => b.maxY)) - Math.min(...all.map(b => b.minY)) + 1;

describe('Phase F runtime artwork', () => {
  it('writes one runtime copy for every still and rig layer, and nothing else', () => {
    expect(runtimeFiles).toEqual([...stills, ...rigLayers].sort());
  });

  it('every still holds at least 3x its largest spec size in visible subject pixels, never more than its source', async () => {
    for (const pose of mascotPoses) {
      const file = `mascot-${pose}.png`;
      const copy = await bounds(path.join(runtime, file));
      const source = await bounds(path.join(directory, file));
      const copyHeight = copy.maxY - copy.minY + 1;
      const sourceHeight = source.maxY - source.minY + 1;
      expect(copyHeight, file).toBeGreaterThanOrEqual(DENSITY * specSize(pose));
      // Downscaled to a 540px subject (180pt at 3x) or left at the source's own height, never enlarged.
      expect(copyHeight, file).toBeLessThanOrEqual(Math.min(sourceHeight, 540) + 1);
      expect(copy.width, file).toBeLessThanOrEqual(source.width);
      expect(copy.height, file).toBeLessThanOrEqual(source.height);
      expect(crispMaxSize.stills[pose], file).toBeGreaterThanOrEqual(specSize(pose));
      expect(runtimeRecord(file).visibleHeight, file).toBe(copyHeight);
    }
  });

  it('stills are trimmed to their visible box plus a 3% transparent margin, and the crop rect is recorded', async () => {
    for (const pose of mascotPoses) {
      const file = `mascot-${pose}.png`;
      const record = runtimeRecord(file);
      const source = await bounds(path.join(directory, file));
      const boxW = source.maxX - source.minX + 1;
      const boxH = source.maxY - source.minY + 1;
      const margin = Math.round(0.03 * Math.max(boxW, boxH));
      expect(record.trimmed, file).toBe(true);
      expect(record.crop, file).toEqual({
        left: source.minX - margin,
        top: source.minY - margin,
        width: boxW + 2 * margin,
        height: boxH + 2 * margin,
      });
      // phaseF.ts carries the same source-measured box as fractions of the trimmed file, and the crop's aspect.
      const runtimeBox = stillRuntime[pose];
      expect(runtimeBox.aspect).toBeCloseTo(record.crop!.width / record.crop!.height, 12);
      expect(runtimeBox.box.x).toBeCloseTo(margin / record.crop!.width, 12);
      expect(runtimeBox.box.y).toBeCloseTo(margin / record.crop!.height, 12);
      expect(runtimeBox.box.h * record.crop!.height).toBeCloseTo(visibleBox[pose].h * 1254, 9);
      expect(runtimeBox.box.w * record.crop!.width).toBeCloseTo(visibleBox[pose].w * 1254, 9);
      // The file keeps the crop's shape to the pixel.
      expect(Math.abs(record.width / record.height - runtimeBox.aspect), file).toBeLessThan(2 / record.height);
    }
  });

  it('rig layers stay full canvas and untrimmed: the success rig at 800px, the reading rig at 600px', async () => {
    for (const file of rigLayers) {
      const copy = await sharp(path.join(runtime, file)).metadata();
      const size = successLayers.includes(file) ? 800 : 600;
      expect(copy.width, file).toBe(size);
      expect(copy.height, file).toBe(size);
      expect(copy.width, file).toBeLessThanOrEqual(1254);
      expect(runtimeRecord(file).trimmed, file).toBe(false);
      expect(runtimeRecord(file).crop, file).toBeUndefined();
    }
  });

  it('the success rig holds 3x its 180pt spec size; the reading rig records its crisp ceiling of about 144pt', async () => {
    const success = unionHeight(await Promise.all(successRest.map(file => bounds(path.join(runtime, file)))));
    expect(success).toBeGreaterThanOrEqual(DENSITY * 180);
    expect(crispMaxSize.successRig).toBeGreaterThanOrEqual(180);
    expect(crispMaxSize.successRig).toBe(Math.floor((successRigBox.h * 800) / DENSITY * 10) / 10);

    const reading = unionHeight(await Promise.all(readingLayers.map(file => bounds(path.join(runtime, file)))));
    expect(reading).toBeGreaterThanOrEqual(DENSITY * 120);
    expect(crispMaxSize.readingRig).toBe(Math.floor((readingRigBox.h * 600) / DENSITY * 10) / 10);
    expect(crispMaxSize.readingRig).toBeCloseTo(144, 0);
    expect(Math.abs(reading / DENSITY - crispMaxSize.readingRig)).toBeLessThan(1);
  });

  it('runtime copies keep real alpha', async () => {
    for (const file of runtimeFiles) {
      const { data, info } = await sharp(path.join(runtime, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      expect(info.channels, file).toBe(4);
      let transparent = 0, opaque = 0, partial = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] === 0) transparent++; else if (data[i] === 255) opaque++; else partial++;
      }
      expect(transparent, file).toBeGreaterThan(info.width * info.height * 0.1);
      expect(opaque, file).toBeGreaterThan(0);
      expect(partial, file).toBeGreaterThan(0);
      // Every edge stays empty, so neither the trim nor the resample cut anything off.
      for (let x = 0; x < info.width; x++) {
        expect(data[x * 4 + 3], file).toBe(0);
        expect(data[((info.height - 1) * info.width + x) * 4 + 3], file).toBe(0);
      }
      for (let y = 0; y < info.height; y++) {
        expect(data[y * info.width * 4 + 3], file).toBe(0);
        expect(data[(y * info.width + info.width - 1) * 4 + 3], file).toBe(0);
      }
    }
  });

  it('phaseF visible boxes exist for all seven poses and lie inside 0..1', () => {
    expect(mascotPoses).toEqual(['merayakan', 'membaca', 'tidur', 'bingung', 'melambai', 'mencari', 'memasak']);
    const all = [...mascotPoses.flatMap(pose => [visibleBox[pose], stillRuntime[pose].box]), successRigBox, readingRigBox];
    for (const box of all) {
      expect(box.w).toBeGreaterThan(0);
      expect(box.h).toBeGreaterThan(0);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.w).toBeLessThanOrEqual(1);
      expect(box.y + box.h).toBeLessThanOrEqual(1);
    }
  });

  it('phaseF visible boxes are measured from the 1254px source alpha', async () => {
    for (const pose of mascotPoses) {
      const { minX, minY, maxX, maxY, width } = await bounds(path.join(directory, `mascot-${pose}.png`));
      expect(width).toBe(1254);
      expect(visibleBox[pose]).toEqual({ x: minX / 1254, y: minY / 1254, w: (maxX - minX + 1) / 1254, h: (maxY - minY + 1) / 1254 });
    }
  });

  it('processing records list every runtime copy with a matching sha256', () => {
    const runtimeRecords = records.filter(record => record.name.startsWith('runtime/'));
    expect(runtimeRecords.map(record => record.name).sort()).toEqual(runtimeFiles.map(file => `runtime/${file}`));
    for (const record of runtimeRecords) {
      const bytes = readFileSync(path.join(directory, record.name));
      expect(createHash('sha256').update(bytes).digest('hex'), record.name).toBe(record.sha256);
      expect(record.source).toBe(record.name.slice('runtime/'.length));
      expect(record.upscaled).toBe(false);
      // A still under 540px visible is trimmed but not resampled; everything else names its Lanczos3 resample.
      if (record.trimmed) expect(record.method, record.name).toMatch(/trimmed to the visible box/);
      else expect(record.method, record.name).toMatch(/Lanczos3/);
    }
    // The 23 delivered exports keep their own records, untouched.
    expect(records.filter(record => !record.name.startsWith('runtime/'))).toHaveLength(23);
  });

  it('the brand manifest records the runtime derivatives without calling them masters', () => {
    const manifest = JSON.parse(readFileSync(path.join(process.cwd(), 'packages/brand/manifest.brand.json'), 'utf8'));
    const files: Array<{ file: string; sha256: string; nativeGeneratedMaster: boolean; upscaled: boolean; trimmed: boolean; crop?: Crop }> =
      manifest.phaseFRuntime.files;
    expect(files.map(entry => entry.file).sort()).toEqual(runtimeFiles.map(file => `assets/phase-f/runtime/${file}`));
    for (const entry of files) {
      const record = records.find(candidate => `assets/phase-f/${candidate.name}` === entry.file)!;
      expect(entry.nativeGeneratedMaster).toBe(false);
      expect(entry.upscaled).toBe(false);
      expect(record.sha256).toBe(entry.sha256);
      expect(entry.trimmed).toBe(record.trimmed);
      expect(entry.crop).toEqual(record.crop);
    }
    expect(manifest.phaseFRuntime.note).not.toMatch(/not trimmed/);
  });
});
