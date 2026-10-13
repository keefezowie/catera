import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/** Private bucket for the kitchen's Sampai photos; reads go through a short signed URL. */
export const proofBucket = "catera-v1-proof";
export const proofUrlSeconds = 300;
export const proofTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && uuid.test(value);
export const isMeal = (value: unknown): value is "lunch" | "dinner" =>
  value === "lunch" || value === "dinner";

/** {catererId}/{deliveryId}/{meal}/{uuid}.{ext}: the path delivery.arrive accepts for that stop. */
export function proofPath(
  catererId: string,
  deliveryId: string,
  meal: "lunch" | "dinner",
  ext: string,
) {
  return `${catererId}/${deliveryId}/${meal}/${crypto.randomUUID()}.${ext}`;
}

/** Demo mode keeps photos on disk next to the demo database, never in hosted storage. */
const demoFolder = () =>
  path.join(
    /apps[\\/]web$/.test(process.cwd())
      ? path.resolve(process.cwd(), "../..")
      : process.cwd(),
    ".data",
    "v1-proof",
  );
export async function writeDemoProof(object: string, bytes: Buffer) {
  const file = path.join(demoFolder(), object);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
}

/**
 * The demo's stored photo, or a plain synthetic image when the demo stop was marked without one on
 * this disk. It is a flat colour with no picture in it, so it never passes for a real delivery.
 */
export async function readDemoProof(object: string) {
  try {
    return await readFile(path.join(demoFolder(), object));
  } catch {
    return sharp({
      create: { width: 480, height: 360, channels: 3, background: "#E9DFCF" },
    })
      .png()
      .toBuffer();
  }
}
