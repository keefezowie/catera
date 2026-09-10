import { test, expect } from "@playwright/test";
import fs from "node:fs";
test("marketplace desktop and phone render with food, filters and navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Makan enak/ })).toBeVisible();
  await expect(page.locator(".package-card")).toHaveCount(6);
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
  await expect(page.locator(".package-card")).toHaveCount(4);
  expect(errors).toEqual([]);
});
