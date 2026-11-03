import { expect, it, vi } from "vitest";
import sharp from "sharp";
vi.mock("../apps/web/src/lib/auth", () => ({ session: vi.fn() }));
import { photoParts, withThumbhash } from "@catera/domain";
import { withPlaceholder } from "../apps/web/src/lib/food-upload";
import { foodPhoto } from "../apps/web/src/components/food-image";

it("puts an uploaded photo's ThumbHash after #th= and reads it back off the address", async () => {
  const photo = await sharp({
    create: { width: 400, height: 300, channels: 3, background: "#ee8855" },
  })
    .jpeg()
    .toBuffer();
  const url = await withPlaceholder("https://synthetic.invalid/food/a.jpg", photo);
  const { uri, thumbhash } = photoParts(url);
  expect(uri).toBe("https://synthetic.invalid/food/a.jpg");
  expect(thumbhash).toMatch(/^[A-Za-z0-9+/]+=*$/);
  expect(url.length).toBeLessThan(500);
  expect(foodPhoto(url).placeholder).toMatch(/^data:image\/png;base64,/);
});

it("keeps the bare address when a photo can't be hashed", async () => {
  expect(await withPlaceholder("https://x.invalid/a.png", Buffer.from("no"))).toBe(
    "https://x.invalid/a.png",
  );
});

it("knows a bundled photo by its path, also behind an API base, and leaves other photos without one", () => {
  expect(photoParts("/assets/food/ayam-sambal.png").thumbhash).toBeTruthy();
  expect(photoParts("https://api.invalid/assets/food/ayam-sambal.png").thumbhash).toBeTruthy();
  expect(photoParts("https://x.invalid/a.png")).toEqual({ uri: "https://x.invalid/a.png", thumbhash: undefined });
  expect(photoParts(withThumbhash("https://x.invalid/a.png", ""))).toEqual({ uri: "https://x.invalid/a.png", thumbhash: undefined });
});
