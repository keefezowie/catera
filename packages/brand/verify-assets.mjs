import fs from 'node:fs';
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
    if (type === 'tEXt' && chunk.toString('utf8').startsWith('impeccable:prompt\0')) prompt = chunk.toString('utf8').slice(18);
    offset += length + 12;
  }
  return { width, height, colorType, hasAlphaChannel: colorType === 4 || colorType === 6, bytes: data.length, sha256: sha(data), pixelDataSha256: sha(Buffer.concat(imageChunks)), prompt };
}

const uses = {
  mascot: 'Standalone brand character for sign-in, onboarding, and brand communication.',
  wordmark: 'Primary horizontal wordmark with tagline, for cream headers and brand introductions.',
  'lockup-horizontal': 'Combined mascot and wordmark for horizontal brand placements.',
  'lockup-stacked': 'Combined mascot and wordmark for square and vertical brand placements.',
  'app-icon': 'Opaque square app-icon master; platform tooling applies its own corner mask.',
  'logo-forest': 'Forest monochrome interpretation on a cream matte.',
  'logo-light': 'Cream monochrome interpretation on a forest matte.',
  'adaptive-foreground': 'Mascot with extra safe-area margin; alpha extraction is still required for an Android foreground layer.',
  leaf: 'Decorative brand sprout supporting freshness messaging.',
  heart: 'Decorative brand heart supporting care and reduced planning messaging.',
  utensils: 'Decorative fork and spoon supporting meal messaging.',
  repeat: 'Decorative recurring-meal symbol.',
  sparkle: 'Decorative Sunrise sparkle pair.',
  welcome: 'Welcome or onboarding illustration for a recurring meal routine.',
  'empty-calendar': 'Illustration for an empty meal schedule.',
  confirmation: 'Illustration accompanying a successfully saved action.'
};

const manifestPath = path.join(root, 'manifest.brand.json');
if (process.argv.includes('--refresh-manifest')) {
  const records = JSON.parse(fs.readFileSync(path.join(root, 'generation-records.json'), 'utf8'));
  const assets = records.map((record) => {
    const file = `assets/${record.name}.png`;
    const metadata = inspect(path.join(root, file));
    const source = inspect(record.sourcePath);
    if (metadata.pixelDataSha256 !== source.pixelDataSha256) throw new Error(`Master pixels differ from generated original: ${file}`);
    const { prompt, ...dimensionsAndHashes } = metadata;
    if (prompt !== record.prompt) throw new Error(`Embedded prompt mismatch: ${file}`);
    return {
      id: record.name, file, ...dimensionsAndHashes,
      format: 'image/png', nativeGeneratedMaster: true, upscaled: false, vector: false,
      background: record.name === 'app-icon' || record.name === 'logo-light' ? 'opaque forest matte' : 'opaque cream matte',
      use: uses[record.name], promptFile: `prompts/${record.name}.txt`,
      source: { generator: 'built-in image_gen', generatedOriginal: record.sourcePath, referenceRole: 'Identity guidance only; no reference-board pixels extracted.', originalPixelDataSha256: source.pixelDataSha256 },
      review: { visuallyInspected: true, spellingChecked: ['wordmark', 'lockup-horizontal', 'lockup-stacked', 'app-icon', 'logo-forest', 'logo-light'].includes(record.name), transparentMasterReady: false }
    };
  });
  const manifest = {
    schemaVersion: 1, brand: 'Catera', tagline: 'Good Food on Repeat.', createdAt: new Date().toISOString(),
    palette: { forest: '#163D2E', sunrise: '#F47B2A', cream: '#FFF7E9', charcoal: '#2E2E2E' },
    paletteNote: 'These are the approved target tokens. Generated PNGs contain antialiasing and tonal variations; they are not exact-color separations.',
    status: 'All sixteen requested compositions generated and inspected. Alpha and requested large master dimensions remain unmet by the built-in generator.',
    limitations: [
      'The built-in generator returned RGB PNGs. Two transparency attempts produced baked checkerboard pixels and were rejected.',
      'Only clean cream/forest matte generations are delivered. Do not claim these files are transparent.',
      'The requested 2048px mascot and 4096px wordmark dimensions were not honored by the generator. Actual native dimensions are recorded per asset. No files were upscaled.',
      'adaptive-foreground.png is an opaque composition master and requires an approved transparency workflow before use as a true Android adaptive foreground.',
      'No editable vector source is available; no raster has been disguised as SVG.'
    ],
    assets
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
for (const asset of manifest.assets) {
  const actual = inspect(path.join(root, asset.file));
  for (const key of ['width', 'height', 'hasAlphaChannel', 'sha256', 'pixelDataSha256']) {
    if (actual[key] !== asset[key]) throw new Error(`${asset.file}: ${key} does not match manifest`);
  }
  if (actual.prompt !== fs.readFileSync(path.join(root, asset.promptFile), 'utf8')) throw new Error(`${asset.file}: prompt file mismatch`);
  console.log(`${asset.id}: ${actual.width}x${actual.height}, alpha=${actual.hasAlphaChannel}, native pixels and prompt verified`);
}
console.log(`Verified ${manifest.assets.length} brand masters.`);
