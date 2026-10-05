import { test, expect } from "@playwright/test";

test("locked customer delivery keeps selected meal ingredients readable", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Masuk sebagai pelanggan" }).click();
  await page.getByRole("link", { name: /Dapur Hijau/ }).click();
  await page.goto("/w/dapur-hijau/schedule");
  await page.locator(".agenda-list>a").first().click();
  await expect(
    page.getByText("Perubahan pelanggan ditutup", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".meal-name")).toHaveText("Ayam panggang kemangi");
  await expect(
    page.getByText(
      "Nasi merah, ayam panggang, tumis buncis, dan sambal terpisah.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pilih menu", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".cutoff-notice")).toContainText("Asia/Jakarta");
});

test("owner customer schedule action header has a localized accessible name", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Masuk sebagai pemilik" }).click();
  await page.getByRole("link", { name: /Dapur Hijau/ }).click();
  await page.getByRole("link", { name: "Pelanggan", exact: true }).click();
  await page.getByRole("link", { name: /Nadia Putri/ }).click();
  const schedule = page.locator(".table-scroll table").first();
  await expect(schedule.getByRole("columnheader")).toHaveCount(5);
  await expect(schedule.getByRole("columnheader").nth(4)).toHaveAccessibleName(
    "Lihat detail",
  );
  await expect(
    schedule.getByRole("link", { name: "Lihat detail" }).first(),
  ).toBeVisible();
});
