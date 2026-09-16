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
