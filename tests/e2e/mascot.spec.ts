import { test, expect } from "@playwright/test";

test("mascot loads, pauses, respects reduced motion and releases loading immediately", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/dev/mascot");
  const mascot = page.locator(".mascot-animation").first();
  await expect(mascot).toHaveAttribute("data-ready", "true");
  await expect(mascot).toHaveAttribute("data-active", "true");
  await page.getByRole("button", { name: "Jeda", exact: true }).click();
  await expect(mascot).toHaveAttribute("data-active", "false");
  await expect(mascot.locator(".mascot-poster")).toBeVisible();
  await page.getByRole("button", { name: "Putar", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(mascot.locator(".mascot-rig")).toBeHidden();
  await expect(mascot.locator(".mascot-poster")).toBeVisible();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Mulai memuat", exact: true }).click();
  await expect(page.getByRole("status")).toHaveAttribute(
    "aria-label",
    "Menyiapkan Catera untuk Anda…",
  );
  await expect(page.locator(".mascot-loading-visual")).toBeVisible();
  await page.getByRole("button", { name: "Selesai", exact: true }).click();
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("note")).toHaveText("Konten siap.");
  expect(errors).toEqual([]);
});

test("missing animation layer retains neutral artwork", async ({ page }) => {
  await page.route("**/mascot-motion/closed.png", (route) => route.abort());
  await page.goto("/dev/mascot");
  const mascot = page.locator(".mascot-animation").first();
  await expect(mascot.locator(".mascot-poster")).toBeVisible();
  await expect(mascot).toHaveAttribute("data-ready", "false");
});

test("reveal delay prevents fast-load flashes and narrow layouts do not overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/mascot");
  await page.getByRole("button", { name: "Mulai memuat", exact: true }).click();
  // A CSS delay works before hydration as well as afterwards; no minimum display time.
  expect(
    await page
      .locator(".mascot-loading-visual")
      .evaluate((el) => getComputedStyle(el).animationDelay),
  ).toBe("0.3s");
  await page.getByRole("button", { name: "Selesai", exact: true }).click();
  await expect(page.getByRole("status")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
