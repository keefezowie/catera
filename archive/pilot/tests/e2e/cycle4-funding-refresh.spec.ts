import { test, expect, type Page } from "@playwright/test";

async function purchaseFive(page: Page, reference: string) {
  await page
    .getByRole("button", { name: "Catat pembelian", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .locator('select[name="package_id"]')
    .selectOption({ label: "Paket Coba · 5" });
  await dialog.locator('input[name="external_reference"]').fill(reference);
  await dialog
    .getByRole("button", { name: "Tinjau perubahan", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Konfirmasi", exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

test("an open schedule keeps funding context, allocation review and confirmation coherent after a new purchase", async ({
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
  const name = "Alokasi Browser " + Date.now();
  await dialog.getByLabel("Nama", { exact: true }).fill(name);
  await dialog
    .getByLabel("Jalan, nomor, dan area")
    .fill("Jl. Alokasi Sintetis No. 74");
  await dialog.getByLabel("Kota", { exact: true }).fill("Jakarta");
  await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("link", { name, exact: false }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  const customerUrl = page.url();
  await purchaseFive(page, "Funding refresh first");
  await expect(
    page.locator(".account-overview .quota-summary strong"),
  ).toHaveText(["5", "0", "5"]);
  await page.getByRole("button", { name: "Buat jadwal", exact: true }).click();
  const start = await dialog.locator('input[name="starts_on"]').inputValue();
  const end = new Date(start + "T12:00:00Z");
  end.setUTCDate(end.getUTCDate() + 6);
  await dialog
    .locator('input[name="ends_on"]')
    .fill(end.toISOString().slice(0, 10));
  for (const box of await dialog.locator('input[name="weekdays"]').all())
    await box.check();
  const slots = dialog.locator('input[name="slot_ids"]');
  for (const box of await slots.all()) await box.uncheck();
  await slots.first().check();
  await dialog
    .getByRole("button", { name: "Tinjau perubahan", exact: true })
    .click();
  await expect(dialog.locator(".allocation-summary dd")).toHaveText([
    "7",
    "5",
    "2",
  ]);
  await expect(
    dialog.getByRole("button", { name: "Konfirmasi", exact: true }),
  ).toBeDisabled();

  const second = await page.context().newPage();
  try {
    await second.goto(customerUrl);
    await expect(
      second.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await purchaseFive(second, "Funding refresh second");
    await expect(
      second.locator(".account-overview .quota-summary strong"),
    ).toHaveText(["10", "0", "10"]);
  } finally {
    await second.close();
  }
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(dialog.locator(".quota-summary strong")).toHaveText([
    "10",
    "0",
    "10",
  ]);
  await expect(dialog.locator(".allocation-summary dd")).toHaveText([
    "7",
    "7",
    "0",
  ]);
  await expect(dialog.locator(".schedule-repair")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Konfirmasi", exact: true }),
  ).toBeEnabled();
  await dialog.getByRole("button", { name: "Kembali", exact: true }).click();
  await expect(dialog.locator('input[name="starts_on"]')).toHaveValue(start);
  await expect(dialog.locator('input[name="ends_on"]')).toHaveValue(
    end.toISOString().slice(0, 10),
  );
  await expect(dialog.locator('input[name="weekdays"]:checked')).toHaveCount(7);
  await expect(dialog.locator('input[name="slot_ids"]:checked')).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("main table tbody tr")).toHaveCount(0);
});
