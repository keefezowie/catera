import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

type Asset = { file: string; sha256: string; width: number; height: number; transparentPixels: number; usedByApp: boolean; supersededBy?: string };
type Derivative = {
  name: string; file: string; derivedFrom: string; sourceSha256: string; displayPoints: number; width: number; height: number;
  format: 'jpeg' | 'webp-lossy' | 'webp-lossless'; bytes: number; sha256: string; alpha: boolean; nativeGeneratedMaster: boolean; upscaled: boolean;
};

const root = path.join(process.cwd(), 'packages/brand/assets/polish');
const polish: { assets: Asset[] } = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const runtime: { files: Derivative[]; totalBytes: number } = JSON.parse(readFileSync(path.join(root, 'runtime/manifest.json'), 'utf8'));
const used = polish.assets.filter(asset => asset.usedByApp);
const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const registry = readFileSync(path.join(process.cwd(), 'packages/mobile-ui/src/brand/polishArt.tsx'), 'utf8');

describe('polish artwork set', () => {
  it('dapur-kosong replaces dapur-rak-kosong in the app; the old file stays as an unused record', () => {
    expect(polish.assets).toHaveLength(46);
    expect(used).toHaveLength(45);
    expect(polish.assets.find(a => a.file === 'dapur/dapur-rak-kosong.png')).toMatchObject({ usedByApp: false, supersededBy: 'dapur/dapur-kosong.png' });
    expect(used.map(a => a.file)).toContain('dapur/dapur-kosong.png');
    for (const asset of polish.assets) expect(sha(path.join(root, asset.file)), asset.file).toBe(asset.sha256);
  });
});

describe('polish runtime derivatives', () => {
  it('one derivative per used asset and nothing else on disk', () => {
    expect(runtime.files.map(f => f.derivedFrom).sort()).toEqual(used.map(a => a.file).sort());
    const onDisk = readdirSync(path.join(root, 'runtime')).filter(f => f !== 'manifest.json').sort();
    expect(onDisk).toEqual(runtime.files.map(f => f.file.replace('runtime/', '')).sort());
  });

  it('records derived-from hashes and file hashes, and never claims to be a master or upscaled', () => {
    for (const d of runtime.files) {
      const source = used.find(a => a.file === d.derivedFrom)!;
      expect(d.sourceSha256, d.name).toBe(source.sha256);
      expect(sha(path.join(root, d.file)), d.name).toBe(d.sha256);
      expect(d.nativeGeneratedMaster).toBe(false);
      expect(d.upscaled).toBe(false);
    }
  });

  it('is 3x the display size or the source size, whichever is smaller, keeping alpha on cutouts', async () => {
    for (const d of runtime.files) {
      const source = used.find(a => a.file === d.derivedFrom)!;
      const meta = await sharp(path.join(root, d.file)).metadata();
      expect([meta.width, meta.height], d.name).toEqual([d.width, d.height]);
      expect(d.width, d.name).toBeLessThanOrEqual(source.width);
      expect(d.height, d.name).toBeLessThanOrEqual(source.height);
      expect(d.width, d.name).toBe(Math.min(source.width, d.displayPoints * 3));
      expect(meta.hasAlpha, d.name).toBe(source.transparentPixels > 0);
      expect(d.alpha, d.name).toBe(source.transparentPixels > 0);
    }
  });

  it('the mobile-ui registry requires exactly these runtime files', () => {
    const required = [...registry.matchAll(/"([\w-]+)": require\("\.\.\/\.\.\/\.\.\/brand\/assets\/polish\/(runtime\/[\w.-]+)"\)/g)].map(m => [m[1], m[2]]);
    expect(required.sort()).toEqual(runtime.files.map(d => [d.name, d.file]).sort());
  });

  it('reports the runtime bundle size', () => {
    const total = runtime.files.reduce((sum, d) => sum + d.bytes, 0);
    expect(runtime.totalBytes).toBe(total);
    console.log(`polish runtime: ${runtime.files.length} files, ${(total / 1024 / 1024).toFixed(2)} MB`);
    expect(total).toBeLessThan(4.5 * 1024 * 1024);
  });

  it('ships food cutouts as lossy WebP, illustrations as lossless WebP and only welcome-meja as JPEG', async () => {
    for (const d of runtime.files) {
      const expected = d.name === 'welcome-meja' ? 'jpeg' : /^(plate|token)-/.test(d.name) ? 'webp-lossy' : 'webp-lossless';
      expect(d.format, d.name).toBe(expected);
      expect(d.file, d.name).toBe(`runtime/${d.name}.${expected === 'jpeg' ? 'jpg' : 'webp'}`);
      expect((await sharp(path.join(root, d.file)).metadata()).format, d.name).toBe(expected === 'jpeg' ? 'jpeg' : 'webp');
    }
  });
});
