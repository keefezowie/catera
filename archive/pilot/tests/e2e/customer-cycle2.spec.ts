import { expect, test } from "@playwright/test";

test("pending meal reminder names that delivery's published default and detail uses sequential headings", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Masuk sebagai pelanggan" }).click();
  await page.getByRole("link", { name: /Dapur Hijau/ }).click();
  const reminder = page.locator(".selection-notice");
  await expect(reminder).toBeVisible();
  const outcome = await reminder.locator(".selection-outcome").innerText();
  expect(outcome).toMatch(
    /^Jika belum memilih, .+ akan dipakai saat batas perubahan\.$/,
  );
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    const choose = reminder.getByRole("link", {
      name: "Pilih menu",
      exact: true,
    });
    const bounds = await choose.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    const next = await page.locator(".next-delivery").boundingBox();
    const planning = await page.locator(".customer-upcoming").boundingBox();
    expect(next!.y + next!.height).toBeLessThanOrEqual(viewport.height);
    expect(planning!.y + planning!.height).toBeLessThanOrEqual(viewport.height);
  }
  await reminder.getByRole("link", { name: "Pilih menu", exact: true }).click();
  const detail = page.locator(".delivery-detail");
  await expect(detail.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(
    detail.getByRole("heading", { name: "Menu", exact: true, level: 2 }),
  ).toBeVisible();
  await expect(
    detail.getByRole("heading", {
      name: "Alamat kirim",
      exact: true,
      level: 2,
    }),
  ).toBeVisible();
  await expect(detail.getByRole("heading", { level: 3 })).toHaveCount(0);
  await page.getByRole("button", { name: "Pilih menu", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const mainMeal = await dialog
    .locator(".menu-choice-option")
    .filter({ has: page.locator(".menu-choice-default") })
    .locator("strong")
    .innerText();
  expect(outcome).toBe(
    `Jika belum memilih, ${mainMeal} akan dipakai saat batas perubahan.`,
  );
  await page.keyboard.press("Escape");
});
