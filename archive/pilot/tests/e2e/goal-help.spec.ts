import { test, expect } from "@playwright/test";

test("task help is searchable, contextual and keyboard discoverable", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Masuk sebagai pemilik" }).click();
  await page.getByRole("link", { name: /Dapur Hijau/ }).click();
  await expect(page.locator("main h1")).toBeVisible();
  const workSearch = page.locator("main .search-control input");
  await workSearch.fill("Nadia");
  await expect(page.locator(".delivery-table tbody tr")).toHaveCount(1);
  await workSearch.fill("");
  await page.getByRole("link", { name: "Hari ini", exact: true }).focus();
  await page.keyboard.press("/");
  await expect(page.locator("main .search-control input")).toBeFocused();
  await page.locator("main h1").click();
  await page.keyboard.press("?");
  await expect(page.locator("main h1")).toHaveText("Panduan");
  const search = page.getByRole("searchbox");
  await search.fill("produksi");
  await expect(page.locator(".help-article")).toContainText("versi");
  await expect(page.locator(".help-article a")).toHaveAttribute(
    "href",
    /admin\/(production|delivery)/,
  );
  await search.fill("nothingmatches123");
  await expect(
    page.getByRole("heading", { name: "Panduan belum ditemukan" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hapus filter" }).click();
  await expect(page.locator(".help-article")).toBeVisible();
});

test("server field validation preserves the form and identifies the invalid input", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Masuk sebagai pemilik" }).click();
  await page.getByRole("link", { name: /Dapur Hijau/ }).click();
  await page.getByRole("link", { name: "Pelanggan", exact: true }).click();
  await page.getByRole("button", { name: "Tambah pelanggan" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nama", { exact: true }).fill("   ");
  await dialog
    .getByLabel("Jalan, nomor, dan area")
    .fill("Synthetic Address 123");
  await dialog.getByLabel("Kota", { exact: true }).fill("Jakarta");
  await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.locator(".field-error-links")).toContainText("Nama");
  await expect(dialog.getByLabel("Nama", { exact: true })).toBeFocused();
  await expect(dialog.getByLabel("Jalan, nomor, dan area")).toHaveValue(
    "Synthetic Address 123",
  );
});
