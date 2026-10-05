import { test, expect } from "@playwright/test";

test("operator reviews and completes two frozen deliveries through ready and dispatch", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Masuk sebagai pemilik" }).click();
  await page.getByRole("link", { name: /Dapur Hijau/ }).click();
  await expect(page.locator("main h1")).toBeVisible();
  const date = await page.getByLabel("Tanggal kirim").inputValue();
  await page.goto("/w/dapur-hijau/admin/delivery?date=" + date);
  const rows = ["Bima Pratama", "Alya Safira"].map((name) =>
    page.locator(".delivery-table tbody tr").filter({ hasText: name }),
  );
  for (const row of rows) {
    await expect(row.locator(".status-scheduled")).toBeVisible();
    await row.getByRole("checkbox").check();
  }
  await page
    .getByRole("button", { name: "Tinjau siap (2)", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".batch-review-list li")).toHaveCount(2);
  await dialog
    .getByRole("button", { name: "Konfirmasi 2 kiriman", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText("2 berhasil");
  await dialog
    .getByRole("button", { name: "Tutup", exact: true })
    .last()
    .click();
  await expect(dialog).not.toBeVisible();
  for (const row of rows) {
    await expect(row.locator(".status-ready")).toBeVisible();
    await row.getByRole("checkbox").check();
  }
  await page
    .getByRole("button", { name: "Tinjau kirim (2)", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Konfirmasi 2 kiriman", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText("2 berhasil");
  await dialog
    .getByRole("button", { name: "Tutup", exact: true })
    .last()
    .click();
  for (const row of rows)
    await expect(row.locator(".status-out_for_delivery")).toBeVisible();
  await expect(page.locator(".batch-actionbar")).toHaveCount(0);
});
