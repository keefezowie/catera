// Registered derivatives from individual mascot artwork, never the brand board.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
const root = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(root, "assets/mascot-motion");
await fs.mkdir(out, { recursive: true });
const source = path.join(root, "assets/mascot.png");
const { data: original, info } = await sharp(source)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;
const body = Buffer.from(original),
  sparkles = Buffer.alloc(original.length);
// Select the two disconnected sparkle islands using actual alpha, not a geometric cutout.
const seen = new Uint8Array(w * h);
let islands = 0;
for (let start = 0; start < w * h; start++) {
  if (seen[start] || original[start * 4 + 3] === 0) continue;
  const queue = [start];
  seen[start] = 1;
  let minX = w,
    minY = h,
    maxY = 0;
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i],
      x = p % w,
      y = Math.floor(p / w);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    for (const n of [
      x > 0 ? p - 1 : -1,
      x < w - 1 ? p + 1 : -1,
      y > 0 ? p - w : -1,
      y < h - 1 ? p + w : -1,
    ]) {
      if (n >= 0 && !seen[n] && original[n * 4 + 3] > 0) {
        seen[n] = 1;
        queue.push(n);
      }
    }
  }
  if (minX > 940 && minY > 350 && maxY < 620 && queue.length > 100) {
    islands++;
    for (const p of queue) {
      original.copy(sparkles, p * 4, p * 4, p * 4 + 4);
      body[p * 4 + 3] = 0;
    }
  }
}
if (islands !== 2)
  throw new Error(`Expected two sparkle islands, found ${islands}`);
const raw = { width: w, height: h, channels: 4 };
const write = (name, buffer) =>
  sharp(buffer, { raw })
    .resize(480, 480, { fit: "contain" })
    .png({ compressionLevel: 9 })
    .toFile(path.join(out, `${name}.png`));
await write("neutral", original);
await write("body", body);
await write("sparkles", sparkles);
const patch = { left: 458, top: 796, width: 174, height: 146, feather: 14 };
const sources = [];
for (const pose of ["half", "closed"]) {
  const file = path.join(root, `motion-sources/${pose}.png`);
  const metadata = await sharp(file).metadata();
  if (metadata.width !== w || metadata.height !== h)
    throw new Error(`${pose}: registration dimensions differ`);
  const pixels = await sharp(file).ensureAlpha().raw().toBuffer();
  const layer = Buffer.alloc(original.length);
  for (let y = patch.top; y < patch.top + patch.height; y++)
    for (let x = patch.left; x < patch.left + patch.width; x++) {
      const p = (y * w + x) * 4;
      pixels.copy(layer, p, p, p + 3);
      const edge = Math.min(
        x - patch.left,
        y - patch.top,
        patch.left + patch.width - 1 - x,
        patch.top + patch.height - 1 - y,
      );
      const t = Math.min(1, edge / patch.feather);
      layer[p + 3] = Math.round(255 * t * t * (3 - 2 * t));
    }
  await write(pose, layer);
  sources.push({
    file: `motion-sources/${pose}.png`,
    width: metadata.width,
    height: metadata.height,
    hasAlpha: metadata.hasAlpha,
    sha256: crypto
      .createHash("sha256")
      .update(await fs.readFile(file))
      .digest("hex"),
  });
}
const files = [];
for (const name of ["neutral", "body", "half", "closed", "sparkles"]) {
  const data = await fs.readFile(path.join(out, `${name}.png`));
  files.push({
    file: `${name}.png`,
    width: 480,
    height: 480,
    bytes: data.length,
    sha256: crypto.createHash("sha256").update(data).digest("hex"),
  });
}
const totalBytes = files.reduce((sum, f) => sum + f.bytes, 0);
await fs.writeFile(
  path.join(out, "manifest.json"),
  JSON.stringify(
    {
      version: 1,
      source: "assets/mascot.png",
      sourceSha256: crypto
        .createHash("sha256")
        .update(await fs.readFile(source))
        .digest("hex"),
      sources,
      patch,
      canvas: 480,
      bodyPivot: [0.5, 0.8],
      sparklePivot: [0.84, 0.39],
      totalBytes,
      files,
      notes:
        "Original body and sparkles preserved. Generated blink artwork used only inside feathered eye patches. Opaque generated backgrounds are not used. Runtime PNG derivatives contain real alpha; no upscaling.",
    },
    null,
    2,
  ) + "\n",
);
console.log(`Mascot runtime artwork: ${totalBytes} bytes`);
