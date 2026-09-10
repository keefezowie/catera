import fs from "node:fs/promises";
import crypto from "node:crypto";
import sharp from "sharp";
const root = new URL("./assets/mascot-motion/", import.meta.url);
const manifest = JSON.parse(
  await fs.readFile(new URL("manifest.json", root), "utf8"),
);
const hash = (data) => crypto.createHash("sha256").update(data).digest("hex");
if (
  hash(await fs.readFile(new URL("./assets/mascot.png", import.meta.url))) !==
  manifest.sourceSha256
)
  throw new Error("Mascot source changed; rebuild motion derivatives");
let total = 0;
for (const source of manifest.sources) {
  if (
    hash(await fs.readFile(new URL(source.file, import.meta.url))) !==
    source.sha256
  )
    throw new Error(`Generated source changed: ${source.file}`);
}
for (const file of manifest.files) {
  const buffer = await fs.readFile(new URL(file.file, root));
  total += buffer.length;
  if (hash(buffer) !== file.sha256)
    throw new Error(`${file.file}: hash mismatch`);
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== 480 || info.height !== 480)
    throw new Error("Wrong dimensions");
  let transparent = 0,
    partial = 0,
    opaque = 0;
  for (let p = 0; p < 480 * 480; p++) {
    const a = data[p * 4 + 3],
      x = p % 480,
      y = Math.floor(p / 480);
    if (a === 0) transparent++;
    else if (a === 255) opaque++;
    else partial++;
    if ((x === 0 || y === 0 || x === 479 || y === 479) && a !== 0)
      throw new Error(`${file.file}: clipped border`);
  }
  if (!transparent || !partial || !opaque)
    throw new Error(`${file.file}: invalid alpha`);
}
if (total > 500 * 1024 || total !== manifest.totalBytes)
  throw new Error(`Runtime budget exceeded or manifest stale: ${total}`);
console.log(`Verified five registered alpha PNGs, ${total} bytes`);
