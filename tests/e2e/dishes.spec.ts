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

test("uses one shared recurring capacity for every selected operating day", async ({
  page,
}) => {
  await openEditor(page);
  await choose(page, "Jenis paket", "Nasi box");
  await page
    .getByLabel("Nama paket", { exact: true })
    .fill("Kapasitas bersama");
  await page
    .getByLabel("Cerita paket", { exact: true })
    .fill("Paket sintetis untuk menguji kapasitas harian bersama.");
  await page.getByRole("button", { name: /2\. Isi/ }).click();
  await page
    .getByRole("button", { name: "Gunakan foto sintetis demo", exact: true })
    .click();
  await choose(page, "Tambah kategori ke paket", "Nasi");
  await page.getByRole("button", { name: /3\. Harga/ }).click();
  await page.getByRole("button", { name: /4\. Hari/ }).click();

  const capacity = page.getByLabel("Kapasitas porsi per hari", { exact: true });
  await expect(capacity).toHaveCount(1);
  await expect(page.getByText(/Kapasitas porsi ·/)).toHaveCount(0);
  await capacity.fill("42");
  await page.getByLabel("Sab", { exact: true }).check();
  await expect(capacity).toHaveValue("42");

  const request = page.waitForRequest(
    (r) => r.url().endsWith("/api/v1/commands") && r.method() === "POST",
  );
  await page.getByRole("button", { name: "Simpan draf", exact: true }).click();
  const payload = (await request).postDataJSON() as {
    action: string;
    payload: {
      offer: { capacity: Record<string, number>; weekdays: number[] };
    };
  };
  expect(payload.action).toBe("package.save");
  const selected = payload.payload.offer.weekdays;
  expect(selected).toContain(6);
  expect(
    new Set(
      selected.map(
        (weekday) => payload.payload.offer.capacity[String(weekday)],
      ),
    ),
  ).toEqual(new Set([42]));
  await page.goto("/seller/capacity");
  await expect(page).toHaveURL(/\/seller\/packages$/);
  await expect(
    page.getByRole("link", { name: "Kapasitas", exact: true }),
  ).toHaveCount(0);
});

test("integrated library edits, category retention and archival versions", async ({
  page,
}) => {
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  const actor = (await (await page.request.get("/api/v1/me")).json()).data
    .actor;
  const name = "Hidangan stabil " + Date.now();
  const command = async (action: string, payload: unknown) => {
    const r = await page.request.post("/api/v1/commands", {
      data: { action, payload, requestId: crypto.randomUUID() },
    });
    expect(r.ok(), await r.text()).toBe(true);
    return (await r.json()).data;
  };
  const dish = await command("dish.save", {
    catererId: actor.catererId,
    details: {
      name,
      description: "Synthetic reusable food",
      image: "/assets/food/ayam-panggang.png",
      serving: "120 g",
      categoryId: "main",
    },
  });
  await page.goto("/seller/menus");
  const lib = page.locator(".menu-library-desktop");
  await lib.getByLabel("Cari hidangan", { exact: true }).fill(name);
  const row = lib.locator(".menu-library-row").filter({ hasText: name });
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await lib
    .getByLabel("Nama hidangan", { exact: true })
    .fill(name + " terbaru");
  await lib.getByLabel("Ukuran saji (opsional)", { exact: true }).fill("200 g");
  await lib
    .getByRole("button", { name: "Simpan hidangan", exact: true })
    .click();
  await expect(
    lib.locator(".menu-library-row").filter({ hasText: name + " terbaru" }),
  ).toContainText("200 g");
  await lib
    .locator(".menu-library-row")
    .filter({ hasText: name + " terbaru" })
    .getByRole("button", { name: "Arsipkan", exact: true })
    .click();
  await expect(
    lib.locator(".menu-library-row").filter({ hasText: name }),
  ).toHaveCount(0);
  await lib.getByLabel("Tampilkan arsip").check();
  await expect(
    lib.locator(".menu-library-row").filter({ hasText: name }),
  ).toContainText("Arsip");
  const state = (
    await (
      await page.request.get(
        "/api/v1/seller/" + actor.catererId + "?date=2026-09-11",
      )
    ).json()
  ).data;
  expect(
    state.dishes.find((d: { id: string }) => d.id === dish.id).version,
  ).toBe(3);
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

test("owner can upload a validated package photo", async ({ page }) => {
  await openEditor(page);
  await choose(page, "Jenis paket", "À la carte");
  await page.getByLabel("Nama paket", { exact: true }).fill("Sintetis foto");
  await page
    .getByLabel("Cerita paket", { exact: true })
    .fill("Data sintetis unggah foto berhasil.");
  await page.getByRole("button", { name: /2\. Isi/ }).click();

  const uploaded = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/uploads") &&
      response.request().method() === "POST",
  );
  await page
    .getByLabel("Foto paket", { exact: true })
    .setInputFiles("apps/web/public/assets/food/ayam-panggang.png");

  const response = await uploaded;
  expect(response.ok(), await response.text()).toBe(true);
  await expect(
    page.getByText("Foto berhasil diunggah", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".photo-preview")).toHaveAttribute(
    "src",
    /^\/api\/uploads\?file=[0-9a-f-]{36}\.png$/,
  );
});
