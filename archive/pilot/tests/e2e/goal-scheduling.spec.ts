import { test, expect, type Page } from "@playwright/test";

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

test("schedule catches reversed dates before review and preserves choices through back", async ({
  page,
}) => {
  await customer(page);
  await page.getByRole("button", { name: "Buat jadwal", exact: true }).click();
  const dialog = page.getByRole("dialog"),
    start = dialog.locator('input[name="starts_on"]'),
    end = dialog.locator('input[name="ends_on"]');
  const initialStart = await start.inputValue();
  const selectedStart = shift(initialStart, 1);
  await start.fill(selectedStart);
  await end.fill(initialStart);
  await expect(dialog.locator(".schedule-field-help").first()).toHaveText(
    "Tanggal akhir harus sama atau setelah tanggal mulai.",
  );
  await expect(end).toHaveAttribute("aria-invalid", "true");
  await expect(end).toHaveAttribute("min", selectedStart);
  await expect(
    dialog.getByRole("button", { name: "Tinjau perubahan", exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "Konfirmasi", exact: true }),
  ).toHaveCount(0);

  const selectedEnd = shift(selectedStart, 3);
  await end.fill(selectedEnd);
  const weekdays = dialog.locator('input[name="weekdays"]');
  for (const box of await weekdays.all()) await box.check();
  const slots = dialog.locator('input[name="slot_ids"]');
  for (const box of await slots.all()) await box.check();
  await dialog
    .getByRole("button", { name: "Tinjau perubahan", exact: true })
    .click();
  await expect(dialog.locator(".schedule-preview li")).not.toHaveCount(0);
  await expect(dialog.locator(".schedule-context h3")).toHaveText(
    "Nadia Putri",
  );
  await expect(dialog.locator(".quota-summary")).toBeVisible();
  await dialog.getByRole("button", { name: "Kembali", exact: true }).click();
  await expect(start).toHaveValue(selectedStart);
  await expect(end).toHaveValue(selectedEnd);
  for (const box of await weekdays.all()) await expect(box).toBeChecked();
  for (const box of await slots.all()) await expect(box).toBeChecked();
});

test("schedule exposes validity limits and stops an out-of-validity date before review", async ({
  page,
}) => {
  await customer(page);
  await page.getByRole("button", { name: "Buat jadwal", exact: true }).click();
  const dialog = page.getByRole("dialog"),
    start = dialog.locator('input[name="starts_on"]'),
    end = dialog.locator('input[name="ends_on"]');
  const max = await end.getAttribute("max");
  expect(max).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await expect(start).toHaveAttribute("max", max!);
  const beyond = shift(max!, 1);
  await start.fill(beyond);
  await end.fill(beyond);
  for (const box of await dialog.locator('input[name="weekdays"]').all())
    await box.check();
  await expect(dialog.locator(".schedule-field-help").first()).toContainText(
    "di luar masa berlaku paket",
  );
  expect(
    await end.evaluate(
      (input: HTMLInputElement) => input.validity.rangeOverflow,
    ),
  ).toBe(true);
  await expect(
    dialog.getByRole("button", { name: "Tinjau perubahan", exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "Konfirmasi", exact: true }),
  ).toHaveCount(0);
});

test("owner purchase names the purchased package and retains the customer and future start", async ({
  page,
}) => {
  await customer(page);
  await page
    .getByRole("button", { name: "Catat pembelian", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".record-customer-context h3")).toHaveText(
    "Nadia Putri",
  );
  const selectedPackage = dialog.getByRole("combobox", {
    name: "Paket dibeli",
    exact: true,
  });
  await selectedPackage.selectOption({ index: 1 });
  const packageId = await selectedPackage.inputValue();
  const start = dialog.locator('input[name="starts_on"]');
  const futureStart = shift(await start.inputValue(), 14);
  await start.fill(futureStart);
  await dialog
    .getByRole("button", { name: "Tinjau perubahan", exact: true })
    .click();
  await expect(dialog.locator(".record-customer-context h3")).toHaveText(
    "Nadia Putri",
  );
  await dialog.getByRole("button", { name: "Kembali", exact: true }).click();
  await expect(selectedPackage).toHaveValue(packageId);
  await expect(start).toHaveValue(futureStart);
});
