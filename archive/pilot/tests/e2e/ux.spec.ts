import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, role = "pemilik") {
  await page.goto("/login");
  await page.getByRole("button", { name: "Masuk sebagai " + role }).click();
  await page.getByRole("link", { name: /Dapur Hijau/ }).click();
  await expect(page.locator("main h1")).toBeVisible();
}

test("operator filters recover and the mobile menu contains keyboard focus", async ({
  page,
}) => {
  await login(page);
  await page.getByLabel("Saring pekerjaan").selectOption("failed");
  await expect(
    page.getByRole("heading", { name: "Tidak ada kiriman yang cocok" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hapus filter" }).click();
  await expect(page.locator(".delivery-table tbody tr")).not.toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".sidebar")).not.toBeVisible();
  const opener = page.getByRole("button", {
    name: "Menu navigasi",
    exact: true,
  });
  await opener.click();
  const menu = page.getByRole("dialog", { name: "Menu navigasi" });
  await expect(menu).toBeVisible();
  await menu.locator("a").first().focus();
  await page.keyboard.press("Shift+Tab");
  await expect(menu.getByRole("button", { name: "Keluar" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(menu.locator("a").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).not.toBeVisible();
  await expect(opener).toBeFocused();
});

test("scheduling retains quota context and blocks unfunded confirmation", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: "Pelanggan", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Pelanggan", exact: true, level: 1 }),
  ).toBeVisible();
  await page
    .locator("main a.customer-link")
    .filter({ hasText: "Nadia Putri" })
    .click();
  await page.getByRole("button", { name: "Buat jadwal", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Nadia Putri" }),
  ).toBeVisible();
  await expect(dialog.locator(".quota-summary")).toBeVisible();
  await expect(
    dialog.getByText("Masa berlaku paket", { exact: true }),
  ).toBeVisible();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 2);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 30);
  await dialog
    .getByLabel("Tanggal mulai kirim", { exact: true })
    .fill(start.toISOString().slice(0, 10));
  await dialog
    .getByLabel("Sampai tanggal", { exact: true })
    .fill(end.toISOString().slice(0, 10));
  await dialog
    .getByRole("checkbox", { name: "Makan malam", exact: true })
    .check();
  await dialog.getByRole("button", { name: "Tinjau perubahan" }).click();
  await expect(
    dialog.getByRole("button", { name: "Konfirmasi", exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByText("Kuota yang tersedia belum cukup untuk seluruh jadwal."),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Kembali", exact: true }).click();
  await expect(
    dialog.getByLabel("Sampai tanggal", { exact: true }),
  ).toHaveValue(end.toISOString().slice(0, 10));
});

test("subscriber history is separate and unfrozen production cannot be marked ready", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "pelanggan");
  await page
    .locator(".bottom-nav")
    .getByRole("link", { name: "Jadwal", exact: true })
    .click();
  await page.getByRole("button", { name: /Riwayat/ }).click();
  await expect(
    page.locator(".schedule-switch button[aria-pressed=true]"),
  ).toContainText("Riwayat");
  await expect(page.locator(".agenda-list .status-scheduled")).toHaveCount(0);
  await page.getByRole("button", { name: /mendatang/i }).click();
  const detailHref = await page
    .locator(".agenda-list>a")
    .last()
    .getAttribute("href");
  const id = detailHref!.split("/").pop();
  await page.goto("/login");
  await page.getByRole("button", { name: "Masuk sebagai pemilik" }).click();
  await page.getByRole("link", { name: /Dapur Hijau/ }).click();
  await page.goto("/w/dapur-hijau/admin/deliveries/" + id);
  await expect(
    page.getByRole("button", { name: "Tandai siap", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".fulfillment-blocked")).toBeVisible();
  await expect(page.locator(".fulfillment-blocked a")).toHaveAttribute(
    "href",
    /production\?date=/,
  );
});
