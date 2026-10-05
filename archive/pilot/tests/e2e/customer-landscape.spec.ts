import { expect, test, type Page } from "@playwright/test";

async function subscriber(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Masuk sebagai pelanggan" }).click();
  await page.getByRole("link", { name: /Dapur Hijau/ }).click();
  await expect(page.locator("main h1")).toBeVisible();
}

test("customer landscape keeps the next delivery, quota and planning in view", async ({
  page,
}) => {
  await subscriber(page);
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.locator(".next-delivery")).toBeVisible();
    const next = await page.locator(".next-delivery").boundingBox();
    const quota = await page
      .locator(".customer-planning-summary .quota-block")
      .boundingBox();
    const upcoming = await page.locator(".customer-upcoming").boundingBox();
    expect(next).not.toBeNull();
    expect(quota).not.toBeNull();
    expect(upcoming).not.toBeNull();
    expect(quota!.x).toBeGreaterThanOrEqual(next!.x + next!.width);
    expect(Math.abs(quota!.y - next!.y)).toBeLessThan(2);
    expect(next!.y + next!.height).toBeLessThanOrEqual(viewport.height);
    expect(upcoming!.y + upcoming!.height).toBeLessThanOrEqual(viewport.height);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("customer can compare available meals and return to their choice after review", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await subscriber(page);
  await page.goto("/w/dapur-hijau/schedule");
  const dateNavigation = page.getByRole("navigation", {
    name: "Lompat ke tanggal kirim",
  });
  await expect(dateNavigation).toBeVisible();
  const target = await dateNavigation
    .getByRole("link")
    .last()
    .getAttribute("href");
  await dateNavigation.getByRole("link").last().click();
  await expect(page.locator(target!)).toBeInViewport();
  await page.locator(".agenda-list>a").last().click();
  await expect(page.locator(".detail-title h1")).toBeVisible();
  const opener = page.getByRole("button", { name: "Pilih menu", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("radio")).toHaveCount(3);
  await expect(
    dialog.getByText("Nasi merah, tempe teriyaki, brokoli, dan wortel.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    dialog.getByText(
      "Nasi putih, dori panggang, sayuran, dan sambal matah terpisah.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(dialog.getByText("Menu utama", { exact: true })).toBeVisible();
  const selected = dialog.getByRole("radio", { name: /Tempe teriyaki/ });
  await selected.check();
  await dialog.getByRole("button", { name: "Tinjau perubahan" }).click();
  await expect(dialog.locator(".review-content")).toContainText(
    "Tempe teriyaki",
  );
  await dialog.getByRole("button", { name: "Kembali", exact: true }).click();
  await expect(selected).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
});
