import { expect, it, vi } from "vitest";
import sharp from "sharp";
vi.mock("../apps/web/src/lib/auth", () => ({ session: vi.fn() }));
import {
  validateFoodImage,
  uploadLimit,
} from "../apps/web/src/lib/food-upload";

for (const [format, expected] of [
  ["png", "png"],
  ["jpeg", "jpg"],
  ["webp", "webp"],
] as const) {
  it(`decodes ${format} and accepts the full 8 MiB image-body limit`, async () => {
    const original = await sharp({
      create: { width: 16, height: 16, channels: 3, background: "#ee8855" },
    })
      .toFormat(format)
      .toBuffer();
    expect(await validateFoodImage(original)).toBe(expected);
    const full = Buffer.concat([
      original,
      Buffer.alloc(uploadLimit - original.length),
    ]);
    expect(await validateFoodImage(full)).toBe(expected);
    await expect(
      validateFoodImage(Buffer.concat([full, Buffer.from([0])])),
    ).rejects.toThrow("INVALID_SIZE");
  });
}
it("rejects empty, forged, truncated and unsupported image bytes", async () => {
  await expect(validateFoodImage(Buffer.alloc(0))).rejects.toThrow(
    "INVALID_SIZE",
  );
  await expect(validateFoodImage(Buffer.from("not an image"))).rejects.toThrow(
    "INVALID_TYPE",
  );
  const png = await sharp({
    create: { width: 100, height: 100, channels: 3, background: "#ee8855" },
  })
    .png()
    .toBuffer();
  await expect(validateFoodImage(png.subarray(0, 40))).rejects.toThrow(
    "INVALID_TYPE",
  );
  const gif = await sharp({
    create: { width: 10, height: 10, channels: 3, background: "#ee8855" },
  })
    .gif()
    .toBuffer();
  await expect(validateFoodImage(gif)).rejects.toThrow("INVALID_TYPE");
});
it("stops the longer side at 1600 px, keeping the shape, and never enlarges", async () => {
  const { cleanFoodImage } = await import("../apps/web/src/lib/food-upload");
  const image = (width: number, height: number) =>
    sharp({ create: { width, height, channels: 3, background: "#ee8855" } })
      .jpeg()
      .toBuffer();
  const size = async (bytes: Buffer) => {
    const meta = await sharp((await cleanFoodImage(bytes)).bytes).metadata();
    return [meta.width, meta.height];
  };
  expect(await size(await image(3200, 1600))).toEqual([1600, 800]);
  expect(await size(await image(1200, 2400))).toEqual([800, 1600]);
  expect(await size(await image(40, 20))).toEqual([40, 20]);
});
it("re-encodes uploads without EXIF, GPS or comments, upright and repeatable", async () => {
  const { cleanFoodImage } = await import("../apps/web/src/lib/food-upload");
  for (const format of ["jpeg", "png", "webp"] as const) {
    // 20x10 landscape pixels tagged orientation 6: shown upright it is 10x20.
    const tagged = await sharp({
      create: { width: 20, height: 10, channels: 3, background: "#ee8855" },
    })
      .toFormat(format)
      .withMetadata({ orientation: 6 })
      .withExifMerge({
        IFD0: { Make: "SyntheticCam", ImageDescription: "kitchen" },
        IFD3: { GPSLatitudeRef: "S", GPSLatitude: "6/1 10/1 0/1" },
      })
      .toBuffer();
    expect((await sharp(tagged).metadata()).orientation).toBe(6);
    expect((await sharp(tagged).metadata()).exif).toBeDefined();
    expect(tagged.includes(Buffer.from("SyntheticCam"))).toBe(true);
    const { ext, bytes } = await cleanFoodImage(tagged);
    expect(ext).toBe(format === "jpeg" ? "jpg" : format);
    const meta = await sharp(bytes).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect(meta.orientation ?? 1).toBe(1);
    expect([meta.width, meta.height]).toEqual([10, 20]);
    expect(bytes.includes(Buffer.from("SyntheticCam"))).toBe(false);
    expect((await cleanFoodImage(tagged)).bytes.equals(bytes)).toBe(true);
  }
});
