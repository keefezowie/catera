import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { scrubClaimUrl } from "../apps/web/src/components/web-analytics";
import { enteredDay } from "../apps/web/src/components/meal-calendar";

const manifestSource = readFileSync(
  new URL("../apps/web/src/app/manifest.ts", import.meta.url),
  "utf8",
);

describe("analytics never see a claim token", () => {
  it.each([
    ["https://catera.id/claim/abc123", "https://catera.id/claim/[token]"],
    ["https://catera.id/claim/abc123?x=1#y", "https://catera.id/claim/[token]?x=1#y"],
    [
      "https://catera.id/login?next=%2Fclaim%2Fabc123",
      "https://catera.id/login?next=%2Fclaim%2F[token]",
    ],
    [
      "https://catera.id/login?next=%252Fclaim%252Fabc123&a=1",
      "https://catera.id/login?next=%252Fclaim%252F[token]&a=1",
    ],
    ["https://catera.id/login?next=/claim/abc123", "https://catera.id/login?next=/claim/[token]"],
  ])("%s", (url, scrubbed) => {
    expect(scrubClaimUrl(url)).toBe(scrubbed);
  });
  it("leaves other pages alone", () => {
    expect(scrubClaimUrl("https://catera.id/claims/x")).toBe("https://catera.id/claims/x");
    expect(scrubClaimUrl("https://catera.id/home?next=%2Fsaved")).toBe(
      "https://catera.id/home?next=%2Fsaved",
    );
  });
});

describe("jump to date", () => {
  it.each([
    ["2026-11-07", "2026-11-07"],
    ["07/11/2026", "2026-11-07"],
    ["7/11/2026", "2026-11-07"],
    [" 7/1/2026 ", "2026-01-07"],
    ["29/02/2028", "2028-02-29"],
  ])("accepts %s", (text, day) => {
    expect(enteredDay(text)).toBe(day);
  });
  it.each(["31/02/2026", "29/02/2026", "13/13/2026", "7/11/26", "11-07-2026", "2026-02-31", ""])(
    "rejects %s",
    (text) => {
      expect(enteredDay(text)).toBe("");
    },
  );
});

describe("web manifest icons", () => {
  it("lists 192 and 512 files that exist at those sizes", async () => {
    const sharp = (await import("sharp")).default;
    expect(manifestSource).not.toContain("/assets/app-icon.png");
    for (const size of [192, 512]) {
      expect(manifestSource).toContain(`/icons/icon-${size}.png`);
      expect(manifestSource).toContain(`${size}x${size}`);
      const file = readFileSync(
        new URL(`../apps/web/public/icons/icon-${size}.png`, import.meta.url),
      );
      const meta = await sharp(file).metadata();
      expect([meta.width, meta.height, meta.format]).toEqual([size, size, "png"]);
    }
  });
});
