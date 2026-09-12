import { test, expect } from "@playwright/test";
import fs from "node:fs";
test("marketplace desktop and phone render with food, filters and navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "Katerer pilihan" }),
  ).toBeVisible();
  const catalog = (
    await (await page.request.get("/api/v1/catalog?limit=100")).json()
  ).data.items as { name: string; meal: string }[];
  expect(catalog.length).toBeGreaterThanOrEqual(6);
  await expect(page.locator(".package-card")).toHaveCount(catalog.length);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
  fs.mkdirSync("output/playwright", { recursive: true });
  await page.screenshot({
    path: "output/playwright/marketplace-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "output/playwright/marketplace-phone.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Makan siang", exact: true }).click();
  const lunch = catalog.filter((offer) => offer.meal === "lunch");
  await expect(page.locator(".package-card")).toHaveCount(lunch.length);
  await expect(page.locator(".package-card h3")).toHaveText(
    lunch.map((offer) => offer.name),
  );
  expect(errors).toEqual([]);
});
