import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function customer(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Masuk sebagai pemilik" }).click();
  await page.getByRole("link", { name: /Dapur Hijau/ }).click();
  await expect(page.locator("main h1")).toBeVisible();
  await page.getByRole("link", { name: "Pelanggan", exact: true }).click();
  await page
    .locator("main a.customer-link")
    .filter({ hasText: "Nadia Putri" })
    .click();
  await expect(page.locator("main h1")).toHaveText("Nadia Putri");
}
function shift(date: string, days: number) {
  const value = new Date(date + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
const formatDate = (date: string) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date + "T12:00:00Z"));

test("purchase review includes the exact reference and inclusive validity dates", async ({
  page,
}) => {
  await customer(page);
  await page
    .getByRole("button", { name: "Catat pembelian", exact: true })
    .click();
  const dialog = page.getByRole("dialog"),
    start = dialog.locator('input[name="starts_on"]');
  await dialog
    .getByRole("combobox", { name: "Paket dibeli", exact: true })
    .selectOption({ label: "Paket Seimbang · 26" });
  const futureStart = shift(await start.inputValue(), 14),
    reference = "BANK-2026-10-05 / 0042";
  await start.fill(futureStart);
  const startCaption = dialog.locator(
    '.date-input-control:has(input[name="starts_on"]) .date-input-caption time',
  );
  await expect(startCaption).toHaveAttribute("datetime", futureStart);
  await expect(startCaption).toHaveText(formatDate(futureStart));
  await dialog
    .getByLabel("Referensi pembayaran eksternal", { exact: true })
    .fill(reference);
  await dialog
    .getByRole("button", { name: "Tinjau perubahan", exact: true })
    .click();
  await expect(dialog.locator(".record-customer-context h3")).toHaveText(
    "Nadia Putri",
  );
  await expect(dialog.locator(".purchase-reference")).toHaveText(reference);
  await expect(dialog.locator(".purchase-validity-range")).toHaveText(
    `${formatDate(futureStart)} → ${formatDate(shift(futureStart, 44))}`,
  );
  await expect(dialog.locator(".purchase-review")).toContainText(
    "Berlaku 45 hari",
  );
  await expect(dialog.locator(".purchase-review")).toContainText(
    "+26 pengiriman",
  );
  await dialog.getByRole("button", { name: "Kembali", exact: true }).click();
  await expect(start).toHaveValue(futureStart);
  await expect(startCaption).toHaveText(formatDate(futureStart));
  await expect(
    dialog.getByLabel("Referensi pembayaran eksternal", { exact: true }),
  ).toHaveValue(reference);
});

test("purchase review makes an empty reference and a non-expiring package explicit", async ({
  page,
}) => {
  await customer(page);
  await page
    .getByRole("button", { name: "Catat pembelian", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Paket dibeli", exact: true })
    .selectOption({ label: "Paket Coba · 5" });
  await dialog
    .getByRole("button", { name: "Tinjau perubahan", exact: true })
    .click();
  await expect(dialog.locator(".purchase-reference")).toHaveText("Tidak diisi");
  await expect(dialog.locator(".purchase-validity-range")).toContainText(
    "Tanpa kedaluwarsa",
  );
});

test("underfunded schedule offers a whole-date repair without losing days or slots", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await customer(page);
  await page.getByRole("button", { name: "Buat jadwal", exact: true }).click();
  const dialog = page.getByRole("dialog"),
    start = dialog.locator('input[name="starts_on"]'),
    end = dialog.locator('input[name="ends_on"]');
  const originalStart = await start.inputValue(),
    originalEnd = await end.getAttribute("max");
  expect(originalEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  const startCaption = dialog.locator(
    '.date-input-control:has(input[name="starts_on"]) .date-input-caption time',
  );
  const endCaption = dialog.locator(
    '.date-input-control:has(input[name="ends_on"]) .date-input-caption time',
  );
  await expect(startCaption).toHaveText(formatDate(originalStart));
  await end.fill(originalEnd!);
  await expect(endCaption).toHaveAttribute("datetime", originalEnd!);
  await expect(endCaption).toHaveText(formatDate(originalEnd!));
  for (const box of await dialog
    .locator('input[name="weekdays"], input[name="slot_ids"]')
    .all())
    await box.check();
  await dialog
    .getByRole("button", { name: "Tinjau perubahan", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Konfirmasi", exact: true }),
  ).toBeDisabled();
  const preview = dialog.getByRole("list", {
    name: "Tanggal pengiriman dan alokasi kuota",
    exact: true,
  });
  await expect(preview).toHaveAttribute("tabindex", "0");
  expect(
    await preview.evaluate((list) => list.scrollHeight > list.clientHeight),
  ).toBe(true);
  await dialog
    .getByRole("button", {
      name: "Kurangi rentang atau hari pengiriman",
      exact: true,
    })
    .focus();
  await page.keyboard.press("Tab");
  await expect(preview).toBeFocused();
  const scrollBefore = await preview.evaluate((list) => list.scrollTop);
  await page.keyboard.press("PageDown");
  await expect
    .poll(() => preview.evaluate((list) => list.scrollTop))
    .toBeGreaterThan(scrollBefore);
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Kembali", exact: true }),
  ).toBeFocused();
  await expect(
    dialog.getByRole("button", { name: "Kembali", exact: true }),
  ).toBeInViewport();
  await expect(
    dialog.getByRole("button", { name: "Konfirmasi", exact: true }),
  ).toBeInViewport();
  const accessibility = await new AxeBuilder({ page })
    .include(".dialog-content")
    .withRules(["scrollable-region-focusable"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  const firstShortfallDate = await dialog
    .locator(".schedule-preview li")
    .filter({ hasText: "Kuota tidak tersedia" })
    .first()
    .locator("time")
    .getAttribute("datetime");
  const fundedDates = await dialog
    .locator(".schedule-preview li")
    .filter({ hasText: "Kuota tersedia" })
    .locator("time")
    .evaluateAll((times) =>
      times.map((time) => time.getAttribute("datetime")!),
    );
  const lastFullDate = fundedDates
    .filter((date) => date < firstShortfallDate!)
    .at(-1)!;
  expect(lastFullDate).toBeTruthy();
  const proposalName = `Ubah tanggal akhir menjadi ${formatDate(lastFullDate)}`;
  await expect(
    dialog.getByRole("button", { name: proposalName, exact: true }),
  ).toBeVisible();
  await expect(dialog.locator(".schedule-repair")).toContainText(
    "Kuota pertama kali kurang pada",
  );
  await dialog
    .getByRole("button", {
      name: "Kurangi rentang atau hari pengiriman",
      exact: true,
    })
    .click();
  await expect(end).toBeFocused();
  await expect(start).toHaveValue(originalStart);
  await expect(end).toHaveValue(originalEnd!);
  await expect(endCaption).toHaveText(formatDate(originalEnd!));
  for (const box of await dialog
    .locator('input[name="weekdays"], input[name="slot_ids"]')
    .all())
    await expect(box).toBeChecked();

  await dialog
    .getByRole("button", { name: "Tinjau perubahan", exact: true })
    .click();
  await dialog.getByRole("button", { name: proposalName, exact: true }).click();
  await expect(end).toHaveValue(lastFullDate);
  await expect(endCaption).toHaveAttribute("datetime", lastFullDate);
  await expect(endCaption).toHaveText(formatDate(lastFullDate));
  await expect(startCaption).toHaveText(formatDate(originalStart));
  await expect(end).toBeFocused();
  for (const box of await dialog
    .locator('input[name="weekdays"], input[name="slot_ids"]')
    .all())
    await expect(box).toBeChecked();
  await dialog
    .getByRole("button", { name: "Tinjau perubahan", exact: true })
    .click();
  await expect(
    dialog.locator(".allocation-summary > div").last().locator("dd"),
  ).toHaveText("0");
  await expect(dialog.locator(".schedule-repair")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Konfirmasi", exact: true }),
  ).toBeEnabled();
});
