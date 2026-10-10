import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { mascotPoses, readingRigBox, successRigBox, visibleBox } from '../packages/brand/phaseF';

const directory = path.join(process.cwd(), 'packages/brand/assets/phase-f');
const runtime = path.join(directory, 'runtime');
const records: Array<{ name: string; source: string; sha256: string; method: string; width: number; height: number; upscaled: boolean }> =
  JSON.parse(readFileSync(path.join(directory, 'processing-records.json'), 'utf8'));
const runtimeFiles = readdirSync(runtime).filter(name => name.endsWith('.png')).sort();
const stills = mascotPoses.map(pose => `mascot-${pose}.png`);
const rigLayers = ['rig-body', 'rig-lid', 'rig-badge', 'rig-arms-up', 'rig-eyes-open', 'rig-eyes-closed', 'rig-sparkles', 'rig-reading-body', 'rig-reading-eyes', 'rig-reading-magnifier'].map(name => `${name}.png`);

describe('Phase F runtime artwork', () => {
  it('writes one runtime copy for every still and rig layer, and nothing else', () => {
    expect(runtimeFiles).toEqual([...stills, ...rigLayers].sort());
  });

  it('every runtime copy is at most 600px and no larger than its source', async () => {
    for (const file of runtimeFiles) {
      const copy = await sharp(path.join(runtime, file)).metadata();
      const source = await sharp(path.join(directory, file)).metadata();
      expect(copy.width, file).toBeLessThanOrEqual(600);
      expect(copy.height, file).toBeLessThanOrEqual(600);
      expect(copy.width, file).toBeLessThanOrEqual(source.width!);
      expect(copy.height, file).toBeLessThanOrEqual(source.height!);
      // Rig layers stay registered: square, untrimmed, the same canvas as every other layer.
      expect(copy.width, file).toBe(copy.height);
    }
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
      // The canvas edge stays empty, so nothing was cut off.
      for (let x = 0; x < info.width; x++) {
        expect(data[x * 4 + 3], file).toBe(0);
        expect(data[((info.height - 1) * info.width + x) * 4 + 3], file).toBe(0);
      }
    }
  });

  it('phaseF visible boxes exist for all seven poses and lie inside 0..1', () => {
    expect(mascotPoses).toEqual(['merayakan', 'membaca', 'tidur', 'bingung', 'melambai', 'mencari', 'memasak']);
    for (const box of [...mascotPoses.map(pose => visibleBox[pose]), successRigBox, readingRigBox]) {
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
      const { data, info } = await sharp(path.join(directory, `mascot-${pose}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let minX = info.width, minY = info.height, maxX = -1, maxY = -1;
      for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
        if (data[(y * info.width + x) * 4 + 3] > 8) {
          minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        }
      }
      expect(info.width).toBe(1254);
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
      expect(record.method).toMatch(/Lanczos/);
      expect(record.upscaled).toBe(false);
    }
    // The 23 delivered exports keep their own records, untouched.
    expect(records.filter(record => !record.name.startsWith('runtime/'))).toHaveLength(23);
  });

  it('the brand manifest records the runtime derivatives without calling them masters', () => {
    const manifest = JSON.parse(readFileSync(path.join(process.cwd(), 'packages/brand/manifest.brand.json'), 'utf8'));
    const files: Array<{ file: string; sha256: string; nativeGeneratedMaster: boolean; upscaled: boolean }> = manifest.phaseFRuntime.files;
    expect(files.map(entry => entry.file).sort()).toEqual(runtimeFiles.map(file => `assets/phase-f/runtime/${file}`));
    for (const entry of files) {
      expect(entry.nativeGeneratedMaster).toBe(false);
      expect(entry.upscaled).toBe(false);
      expect(records.find(record => `assets/phase-f/${record.name}` === entry.file)?.sha256).toBe(entry.sha256);
    }
  });
});
