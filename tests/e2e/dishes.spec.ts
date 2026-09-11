import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";

async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
async function openEditor(page: Page) {
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  await page.goto("/seller/packages");
  await page.getByRole("button", { name: "Buat paket", exact: true }).click();
}
test("every forward tab and keyboard submit validate prerequisites; incomplete drafts remain saveable", async ({
  page,
}) => {
  await openEditor(page);
  for (const label of [
    /2\. Isi/,
    /3\. Harga/,
    /4\. Hari/,
    /5\. Fleksibilitas/,
    /6\. Tinjau/,
  ]) {
    await page.getByRole("button", { name: label }).click();
    await expect(
      page.getByRole("button", { name: /1\. Penawaran/ }),
    ).toHaveAttribute("aria-current", "step");
    await expect(
      page.getByRole("combobox", { name: "Jenis paket", exact: true }),
    ).toBeFocused();
  }
  await page.getByLabel("Nama paket", { exact: true }).press("Enter");
  await expect(
    page.getByRole("button", { name: /1\. Penawaran/ }),
  ).toHaveAttribute("aria-current", "step");
  const saving = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/commands") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Simpan draf", exact: true }).click();
  const response = await saving;
  expect(response.ok(), await response.text()).toBe(true);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Buat paket", exact: true }).click();
  await choose(page, "Jenis paket", "À la carte");
  await page
    .getByLabel("Nama paket", { exact: true })
    .fill("Sintetis validasi");
  await page
    .getByLabel("Cerita paket", { exact: true })
    .fill("Data sintetis untuk validasi langkah.");
  await page.getByRole("button", { name: /2\. Isi/ }).click();
  await page.getByRole("button", { name: /6\. Tinjau/ }).click();
  await expect(page.getByRole("button", { name: /2\. Isi/ })).toHaveAttribute(
    "aria-current",
    "step",
  );
  await page.getByRole("button", { name: /1\. Penawaran/ }).click();
  await page.getByLabel("Nama paket", { exact: true }).fill("");
  await page.getByRole("button", { name: /2\. Isi/ }).click();
  await expect(page.getByLabel("Nama paket", { exact: true })).toBeFocused();
});

test("component-first entry, optional library save, photo feedback and faithful customer previews", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await mkdir("output/reusable-dishes", { recursive: true });
  await openEditor(page);
  await choose(page, "Jenis paket", "Nasi box");
  const name = "Sintetis · Dapur berulang " + Date.now(),
    dishName = "Ayam reusable " + Date.now();
  await page.getByLabel("Nama paket", { exact: true }).fill(name);
  await page
    .getByLabel("Cerita paket", { exact: true })
    .fill(
      "Nasi box sintetis untuk menguji daftar hidangan, foto dan pratinjau pelanggan.",
    );
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await page
    .getByLabel("Foto paket", { exact: true })
    .setInputFiles("apps/web/public/assets/food/ayam-panggang.png");
  await expect(
    page.getByText("Foto berhasil diunggah", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".photo-preview")).toHaveCount(1);
  await expect(page.getByRole("textbox", { name: /URL/ })).toHaveCount(0);
  const first = page.locator(".component-editor").first();
  await first.getByLabel("Nama hidangan", { exact: true }).fill(dishName);
  await first
    .getByLabel("Ukuran saji (opsional)", { exact: true })
    .fill("150 g");
  await first
    .getByRole("button", { name: "Simpan ke daftar hidangan", exact: true })
    .click();
  await expect(
    first.getByText("Hidangan tersimpan di daftar", { exact: true }),
  ).toBeVisible();
  await first.getByLabel("Jumlah hidangan", { exact: true }).fill("2");
  const slot = first.locator(".dish-editor").nth(1);
  await slot
    .getByRole("combobox", { name: "Pilih hidangan tersimpan", exact: true })
    .click();
  await page
    .getByRole("option", { name: dishName + " · 150 g", exact: true })
    .click();
  await slot
    .getByLabel("Ukuran saji (opsional)", { exact: true })
    .fill("2 potong");
  await choose(page, "Tambah komponen", "Komponen khusus…");
  const custom = page.locator(".component-editor").nth(1);
  await custom
    .getByLabel("Komponen", { exact: true })
    .fill("Pelengkap spesial");
  await custom
    .getByLabel("Nama hidangan", { exact: true })
    .fill("Sambal sintetis");
  const componentPosition = await first.boundingBox(),
    addPosition = await page
      .getByRole("combobox", { name: "Tambah komponen", exact: true })
      .boundingBox();
  expect(addPosition!.y).toBeGreaterThan(
    componentPosition!.y + componentPosition!.height,
  );
  await page.getByText("Informasi gizi (opsional)", { exact: true }).click();
  await page.getByLabel("Protein (g)", { exact: true }).fill("42");
  await page.getByLabel("Karbohidrat (g)", { exact: true }).fill("0");
  await page.getByLabel("Protein (g)", { exact: true }).fill("-1");
  await page.getByRole("button", { name: /6\. Tinjau/ }).click();
  await expect(page.getByLabel("Protein (g)", { exact: true })).toBeFocused();
  await page.getByLabel("Protein (g)", { exact: true }).fill("42");
  await first
    .getByLabel("Foto hidangan (opsional)", { exact: true })
    .first()
    .setInputFiles("apps/web/public/assets/food/ayam-panggang.png");
  await expect(first.locator(".photo-preview")).toHaveCount(1);
  await expect(page.getByLabel("Protein (g)", { exact: true })).toHaveValue(
    "42",
  );
  await first
    .getByRole("button", { name: "Turunkan hidangan 1", exact: true })
    .click();
  await expect(page.getByLabel("Protein (g)", { exact: true })).toHaveValue(
    "42",
  );
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await first.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `output/reusable-dishes/contents-${width}.png`,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  const axe = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .analyze();
  expect(
    axe.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
  await page.getByRole("button", { name: /6\. Tinjau/ }).click();
  await expect(page.locator(".listing-preview .package-card")).toContainText(
    name,
  );
  await expect(page.locator(".listing-preview .package-card")).toContainText(
    "42 g",
  );
  await page.getByRole("button", { name: "Detail paket", exact: true }).click();
  await expect(page.locator(".listing-preview .package-detail")).toContainText(
    "Sambal sintetis",
  );
  await expect(
    page.locator(".listing-preview .package-detail"),
  ).toHaveAttribute("inert", "");
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator(".listing-preview").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `output/reusable-dishes/review-${width}.png`,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await choose(
    page,
    "Status penawaran",
    "Tayangkan setelah verifikasi katerer",
  );
  const saved = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/commands") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Simpan paket", exact: true }).click();
  const response = await saved;
  expect(response.ok(), await response.text()).toBe(true);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const offer = (
    await (await page.request.get("/api/v1/catalog?limit=100")).json()
  ).data.items.find((o: { name: string }) => o.name === name);
  expect(offer.menus[0].items).toHaveLength(3);
  expect(offer.menus[0].items[0].sourceDishId).toBe(
    offer.menus[0].items[1].sourceDishId,
  );
  expect(offer.menus[0].items[0].id).not.toBe(offer.menus[0].items[1].id);
  await page.goto("/packages/" + offer.slug);
  await expect(page.locator(".package-detail")).toContainText(
    "Sambal sintetis",
  );
  await expect(page.locator(".package-detail .detail-hero")).toHaveAttribute(
    "src",
    offer.image,
  );
  await page.goto("/seller/dishes");
  const row = page.locator(".library-row").filter({ hasText: dishName });
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByLabel("Nama hidangan", { exact: true })
    .fill(dishName + " terbaru");
  await page
    .getByLabel("Ukuran saji (opsional)", { exact: true })
    .fill("200 g");
  await page
    .getByRole("button", { name: "Simpan hidangan", exact: true })
    .click();
  await expect(page.locator(".dish-library > .form")).toHaveCount(0);
  const unchanged = (
    await (await page.request.get("/api/v1/catalog?limit=100")).json()
  ).data.items.find((o: { id: string }) => o.id === offer.id);
  expect(unchanged.menus).toEqual(offer.menus);
  await page.goto("/seller/packages");
  await page
    .locator(".seller-packages article")
    .filter({ hasText: name })
    .getByRole("button", { name: /Kelola paket/ })
    .click();
  await page.getByRole("button", { name: /2\. Isi/ }).click();
  await page
    .getByRole("button", { name: "Gunakan versi terbaru", exact: true })
    .first()
    .click();
  await expect(
    page.getByLabel("Nama hidangan", { exact: true }).first(),
  ).toHaveValue(dishName + " terbaru");
  await expect(
    page.getByLabel("Ukuran saji (opsional)", { exact: true }).first(),
  ).toHaveValue("2 potong");
  await page.getByText("Informasi gizi (opsional)", { exact: true }).click();
  await expect(page.getByLabel("Protein (g)", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: /1\. Penawaran/ }).click();
  await choose(page, "Jenis paket", "À la carte");
  await choose(page, "Jenis paket", "Nasi box");
  await page.getByRole("button", { name: /2\. Isi/ }).click();
  await expect(
    page.getByLabel("Nama hidangan", { exact: true }).first(),
  ).toHaveValue(dishName + " terbaru");
  await page.getByRole("button", { name: /6\. Tinjau/ }).click();
  await page.getByRole("button", { name: "Simpan paket", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const refreshed = (
    await (await page.request.get("/api/v1/catalog?limit=100")).json()
  ).data.items.find((o: { id: string }) => o.id === offer.id);
  expect(refreshed.contentRevision).toBe(offer.contentRevision + 1);
  await page.goto("/seller/dishes");
  await page
    .locator(".library-row")
    .filter({ hasText: dishName })
    .getByRole("button", { name: "Arsipkan", exact: true })
    .click();
  await expect(
    page.locator(".library-row").filter({ hasText: dishName }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("upload failure preserves the old photo and pending uploads block navigation", async ({
  page,
}) => {
  await openEditor(page);
  await choose(page, "Jenis paket", "À la carte");
  await page.getByLabel("Nama paket", { exact: true }).fill("Sintetis foto");
  await page
    .getByLabel("Cerita paket", { exact: true })
    .fill("Data sintetis unggah foto.");
  await page.getByRole("button", { name: /2\. Isi/ }).click();
  await page
    .getByRole("button", { name: "Gunakan foto sintetis demo", exact: true })
    .click();
  let release!: () => void;
  const wait = new Promise<void>((r) => (release = r));
  await page.route("**/api/uploads", async (route) => {
    await wait;
    await route.fulfill({ status: 503, body: "Upload failed" });
  });
  await page
    .getByLabel("Foto paket", { exact: true })
    .setInputFiles("apps/web/public/assets/food/ayam-panggang.png");
  await expect(page.getByRole("button", { name: /6\. Tinjau/ })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Lanjutkan", exact: true }),
  ).toBeDisabled();
  release();
  await expect(
    page.getByText(
      "Foto belum berhasil diunggah. Pilih file untuk mencoba lagi.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.locator(".photo-preview")).toHaveAttribute(
    "src",
    "/assets/food/ayam-panggang.png",
  );
  await page.getByRole("button", { name: "Hapus foto", exact: true }).click();
  await expect(page.locator(".photo-preview")).toHaveCount(0);
  await page.unroute("**/api/uploads");
});
