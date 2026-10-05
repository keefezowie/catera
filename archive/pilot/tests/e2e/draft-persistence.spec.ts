import { test, expect, type Page } from "@playwright/test";

async function customer(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Masuk sebagai pemilik" }).click();
  await page.getByRole("link", { name: /Dapur Hijau/ }).click();
  await page.getByRole("link", { name: "Pelanggan", exact: true }).click();
  await page.getByRole("button", { name: "Tambah pelanggan" }).click();
  const dialog = page.getByRole("dialog"),
    name = "Draft Sintetis " + Date.now();
  await dialog.getByLabel("Nama", { exact: true }).fill(name);
  await dialog.locator('input[name="phone"]').fill("0800000099");
  await dialog
    .getByLabel("Jalan, nomor, dan area")
    .fill("Jl. Draft Sintetis No. 99");
  await dialog.getByLabel("Kota", { exact: true }).fill("Jakarta");
  await dialog
    .locator('textarea[name="instructions"]')
    .fill("Instruksi tersimpan sintetis");
  await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("link", { name, exact: false }).click();
  return dialog;
}
function shift(date: string, days: number) {
  const value = new Date(date + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
async function fields(page: Page) {
  return page
    .getByRole("dialog")
    .locator("form")
    .evaluate((form) => {
      const data = new FormData(form as HTMLFormElement);
      return {
        starts: data.get("starts_on"),
        ends: data.get("ends_on"),
        weekdays: data.getAll("weekdays"),
        slots: data.getAll("slot_ids"),
      };
    });
}

test("Escape retains controlled schedule dates and choices; Back keeps allocation math; Batal discards", async ({
  page,
}) => {
  const dialog = await customer(page);
  await page.getByRole("button", { name: "Catat pembelian" }).click();
  await dialog
    .locator('select[name="package_id"]')
    .selectOption({ label: "Paket Seimbang · 26" });
  await dialog.getByRole("button", { name: "Tinjau perubahan" }).click();
  await dialog.getByRole("button", { name: "Konfirmasi", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Buat jadwal", exact: true }).click();
  const defaults = await fields(page);
  const starts = shift(String(defaults.starts), 2),
    ends = shift(starts, 6);
  await dialog.locator('input[name="starts_on"]').fill(starts);
  await dialog.locator('input[name="ends_on"]').fill(ends);
  for (const input of await dialog.locator('input[name="weekdays"]').all())
    await input.setChecked(["0", "2", "6"].includes(await input.inputValue()));
  for (const input of await dialog.locator('input[name="slot_ids"]').all())
    await input.check();
  const edited = await fields(page);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Buat jadwal", exact: true }).click();
  await expect.poll(() => fields(page)).toEqual(edited);
  await expect(
    dialog.getByText("Draf sebelumnya dipulihkan.", { exact: false }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Konfirmasi", exact: true }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "Tinjau perubahan" }).click();
  const count = await dialog.locator(".schedule-preview li").count();
  expect(count).toBe(6);
  await expect(
    dialog.getByRole("button", { name: "Konfirmasi", exact: true }),
  ).toBeEnabled();
  await dialog.getByRole("button", { name: "Kembali", exact: true }).click();
  await expect.poll(() => fields(page)).toEqual(edited);
  // Changing a restored controlled value forces a React rerender. Other choices
  // must remain restored in both the native form and the next allocation review.
  await dialog.locator('input[name="ends_on"]').fill(shift(ends, 1));
  await dialog.locator('input[name="ends_on"]').fill(ends);
  await expect.poll(() => fields(page)).toEqual(edited);
  await dialog.getByRole("button", { name: "Tinjau perubahan" }).click();
  await expect(dialog.locator(".schedule-preview li")).toHaveCount(count);
  await dialog.getByRole("button", { name: "Kembali", exact: true }).click();
  await dialog.getByRole("button", { name: "Batal", exact: true }).click();
  await page.getByRole("button", { name: "Buat jadwal", exact: true }).click();
  await expect.poll(() => fields(page)).toEqual(defaults);
  await expect(
    dialog.getByText("Draf sebelumnya dipulihkan.", { exact: false }),
  ).toHaveCount(0);
});

test("ordinary account close preserves typed address and textarea; Batal restores saved defaults", async ({
  page,
}) => {
  const dialog = await customer(page);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await dialog.locator('input[name="phone"]').fill("0800000088");
  await dialog
    .getByLabel("Jalan, nomor, dan area")
    .fill("Jl. Draft Sintetis No. 88");
  await dialog
    .locator('textarea[name="instructions"]')
    .fill("Instruksi draft belum tersimpan");
  await dialog.getByRole("button", { name: "Tutup", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(dialog.locator('input[name="phone"]')).toHaveValue("0800000088");
  await expect(
    dialog.getByText("Draf sebelumnya dipulihkan.", { exact: false }),
  ).toBeVisible();
  await expect(dialog.getByLabel("Jalan, nomor, dan area")).toHaveValue(
    "Jl. Draft Sintetis No. 88",
  );
  await expect(dialog.locator('textarea[name="instructions"]')).toHaveValue(
    "Instruksi draft belum tersimpan",
  );
  await expect(dialog.locator('input[name="phone"]')).toBeEnabled();
  await dialog.getByRole("button", { name: "Batal", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(dialog.locator('input[name="phone"]')).toHaveValue("0800000099");
  await expect(
    dialog.getByText("Draf sebelumnya dipulihkan.", { exact: false }),
  ).toHaveCount(0);
  await expect(dialog.getByLabel("Jalan, nomor, dan area")).toHaveValue(
    "Jl. Draft Sintetis No. 99",
  );
  await expect(dialog.locator('textarea[name="instructions"]')).toHaveValue(
    "Instruksi tersimpan sintetis",
  );
  await dialog.locator('input[name="phone"]').fill("0800000077");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(dialog.locator(".draft-resumed-notice")).toBeVisible();
  await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(dialog.locator('input[name="phone"]')).toHaveValue("0800000077");
  await expect(dialog.locator(".draft-resumed-notice")).toHaveCount(0);
});
