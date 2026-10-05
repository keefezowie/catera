import { test, expect } from "@playwright/test";

test("save feedback stays clear of the next dialog and expires across snapshot refresh", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Masuk sebagai pemilik", exact: true })
    .click();
  await page.getByRole("link", { name: /Dapur Hijau/ }).click();
  await page.getByRole("link", { name: "Pelanggan", exact: true }).click();
  await page
    .getByRole("button", { name: "Tambah pelanggan", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const name = "Konfirmasi Browser " + Date.now();
  await dialog.getByLabel("Nama", { exact: true }).fill(name);
  await dialog
    .getByLabel("Jalan, nomor, dan area")
    .fill("Jl. Data Sintetis No. 72");
  await dialog.getByLabel("Kota", { exact: true }).fill("Jakarta");
  await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const notice = page.locator(".save-notice");
  await expect(notice).not.toBeEmpty();
  await page.getByRole("link", { name, exact: false }).click();
  await page
    .getByRole("button", { name: "Catat pembelian", exact: true })
    .click();
  await dialog
    .locator('select[name="package_id"]')
    .selectOption({ label: "Paket Coba · 5" });
  await dialog
    .locator('input[name="external_reference"]')
    .fill("Feedback browser purchase");
  await dialog
    .getByRole("button", { name: "Tinjau perubahan", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Konfirmasi", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(notice).toHaveText("Pembelian tercatat dan kuota ditambahkan.");
  await page.getByRole("button", { name: "Buat jadwal", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(notice).not.toBeEmpty();
  const review = dialog.getByRole("button", {
    name: "Tinjau perubahan",
    exact: true,
  });
  await expect(review).toBeEnabled();
  const unobscured = await review.evaluate((button) => {
    const box = button.getBoundingClientRect();
    const top = document.elementFromPoint(
      box.x + box.width / 2,
      box.y + box.height / 2,
    );
    return button === top || button.contains(top);
  });
  expect(unobscured).toBe(true);
  expect(
    await notice.evaluate((element) => getComputedStyle(element).position),
  ).toBe("static");
  // Focus causes the production shell's real snapshot refresh while the notice is active.
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(notice).toBeEmpty({ timeout: 9000 });
  await expect(dialog).toBeVisible();
  await expect(review).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});
