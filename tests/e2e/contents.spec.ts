import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { addDays, localDay } from "@catera/domain";
import { mkdir } from "node:fs/promises";
import { pickDate } from "./date-picker";

async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
test("seller publishes multiple dishes and customers see the same contents through checkout and production", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await mkdir("output/package-contents", { recursive: true });
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  await page.goto("/seller/packages");
  await page.getByRole("button", { name: "Buat paket", exact: true }).click();
  await choose(page, "Jenis paket", "À la carte");
  const name = "Sintetis · Hidangan lengkap " + Date.now();
  await page.getByLabel("Nama paket", { exact: true }).fill(name);
  await page
    .getByLabel("Cerita paket", { exact: true })
    .fill("Data sintetis untuk verifikasi paket dengan beberapa hidangan.");
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await page
    .getByRole("button", { name: "Gunakan foto sintetis demo" })
    .click();
  await page
    .getByRole("button", { name: "Tambah hidangan", exact: true })
    .click();
  await page
    .getByLabel("Nama hidangan", { exact: true })
    .nth(0)
    .fill("Ayam panggang verifikasi");
  await page
    .getByLabel("Ukuran saji (opsional)", { exact: true })
    .nth(0)
    .fill("150 g");
  await page
    .getByRole("button", { name: "Tambah hidangan", exact: true })
    .click();
  await page
    .getByLabel("Nama hidangan", { exact: true })
    .nth(1)
    .fill("Tempe bacem verifikasi");
  await page
    .getByLabel("Ukuran saji (opsional)", { exact: true })
    .nth(1)
    .fill("2 potong");
  await page.getByText("Informasi gizi (opsional)", { exact: true }).click();
  await page.getByLabel("Protein (g)", { exact: true }).fill("42");
  await page.getByLabel("Karbohidrat (g)", { exact: true }).fill("0");
  await expect(
    page.locator(".package-contents").getByText(/42 g protein/),
  ).toBeVisible();
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    if (process.env.CATERA_CAPTURE_CONTENTS === "true")
      await page.screenshot({
        path: `output/package-contents/seller-${width}.png`,
        fullPage: true,
      });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  const accessibility = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .analyze();
  expect(
    accessibility.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    ),
  ).toEqual([]);
  await page.getByRole("button", { name: /6\. Tinjau/ }).click();
  await choose(
    page,
    "Status penawaran",
    "Tayangkan setelah verifikasi katerer",
  );
  const packageSaved = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/commands") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Simpan paket", exact: true }).click();
  const packageResult = await packageSaved;
  expect(packageResult.ok(), await packageResult.text()).toBe(true);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const offers = (await (await page.request.get("/api/v1/catalog?limit=100")).json()).data
    .items;
  const offer = offers.find((o: { name: string }) => o.name === name);
  expect(offer.menus[0].items).toHaveLength(2);
  expect(offer.contentRevision).toBe(1);
  await page.request.post("/api/v1/auth/demo", { data: { role: "customer" } });
  await page.goto("/packages/" + offer.slug);
  await expect(
    page
      .locator(".package-contents")
      .getByText("Ayam panggang verifikasi", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".package-contents")
      .getByText("Tempe bacem verifikasi", { exact: true }),
  ).toBeVisible();
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    if (process.env.CATERA_CAPTURE_CONTENTS === "true")
      await page.screenshot({
        path: `output/package-contents/customer-${width}.png`,
        fullPage: true,
      });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto("/checkout/" + offer.id);
  await pickDate(page, "Mulai tanggal", addDays(localDay(), 40));
  await page.getByRole("button", { name: "Tinjau jadwal & harga" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Lanjutkan ke pembayaran" }).click();
  await expect(page).toHaveURL(/\/payment\//);
  const checkoutId = page.url().split("/").at(-1)!;
  await page
    .getByRole("button", { name: "Simulasikan pembayaran berhasil" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Makanan baik sudah dijadwalkan." }),
  ).toBeVisible();
  const checkout = (
    await (await page.request.get("/api/v1/checkouts/" + checkoutId)).json()
  ).data;
  const customer = (await (await page.request.get("/api/v1/customer")).json())
    .data;
  const delivery = customer.deliveries.find(
    (d: { subscription_id: string }) =>
      d.subscription_id === checkout.subscription_id,
  );
  await page.goto("/deliveries/" + delivery.id);
  await expect(
    page
      .locator(".package-contents")
      .getByText("Tempe bacem verifikasi", { exact: true }),
  ).toBeVisible();
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  await page.goto("/seller/menus?date=" + delivery.service_date);
  await choose(page, "Paket dan versi isi", name + " · Versi 1");
  await page
    .getByLabel("Nama hidangan", { exact: true })
    .nth(0)
    .fill("Ayam kecap pengganti");
  const menuSaved = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/commands") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  const menuResult = await menuSaved;
  expect(menuResult.ok(), await menuResult.text()).toBe(true);
  await expect(page.locator(".error-notice")).toHaveCount(0);
  await page.request.post("/api/v1/auth/demo", { data: { role: "customer" } });
  await page.goto("/deliveries/" + delivery.id);
  await expect(
    page
      .locator(".package-contents")
      .getByText("Ayam kecap pengganti", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Informasi gizi belum tersedia", { exact: true }),
  ).toBeVisible();
  await page.goto("/subscriptions/" + checkout.subscription_id);
  await expect(
    page
      .locator(".package-contents")
      .getByText("Ayam panggang verifikasi", { exact: true }),
  ).toBeVisible();
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  const frozen = await page.request.post("/api/v1/commands", {
    data: {
      action: "production.freeze",
      requestId: crypto.randomUUID(),
      payload: { catererId: offer.catererId, date: delivery.service_date },
    },
  });
  expect(frozen.ok()).toBe(true);
  const csv = await page.request.get(
    "/api/manifests/" + (await frozen.json()).data.id,
  );
  expect(await csv.text()).toContain("Ayam kecap pengganti");
  expect(await csv.text()).toContain("Tempe bacem verifikasi (2 potong)");
  expect(errors).toEqual([]);
});

test("nasi box composition, optional macros, discovery filter and English contents", async ({
  page,
}) => {
  await page.goto("/packages/demo-nasi-box");
  await expect(
    page
      .locator(".package-contents")
      .getByText("2 Lauk · 1 Sayur", { exact: false }),
  ).toBeVisible();
  await expect(
    page.locator(".package-contents").getByText("Sup jagung", { exact: true }),
  ).toBeVisible();
  await page.goto("/#packages");
  await choose(page, "Jenis paket", "Nasi box");
  const cards = page.locator(".package-card");
  expect(await cards.count()).toBeGreaterThan(0);
  await expect(
    cards.filter({ hasText: "Demo · Ayam dan tempe ala carte" }),
  ).toHaveCount(0);
  await page.getByRole("textbox", { name: "Cari katering" }).fill("Sup jagung");
  await expect(cards).toHaveCount(1);
  await page.goto("/packages/demo-nasi-box");
  await choose(page, "Bahasa", "English");
  await expect(
    page.locator(".package-contents").getByText(/Example menu/),
  ).toBeVisible();
  await expect(
    page
      .locator(".package-contents")
      .getByText(/Caterer estimate · per meal portion/),
  ).toBeVisible();
});

test("seller creates a nasi box with recoverable dish slots and custom components", async ({
  page,
}) => {
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  await page.goto("/seller/packages");
  await page.getByRole("button", { name: "Buat paket", exact: true }).click();
  await choose(page, "Jenis paket", "Nasi box");
  const name = "Sintetis · Box " + Date.now();
  await page.getByLabel("Nama paket", { exact: true }).fill(name);
  await page
    .getByLabel("Cerita paket", { exact: true })
    .fill(
      "Contoh sintetis nasi box yang memiliki dua lauk dan komponen khusus.",
    );
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await page
    .getByRole("button", { name: "Gunakan foto sintetis demo" })
    .click();
  await page.getByLabel("Jumlah hidangan", { exact: true }).fill("2");
  await page
    .getByLabel("Nama hidangan", { exact: true })
    .nth(0)
    .fill("Ayam bakar");
  await page
    .getByLabel("Nama hidangan", { exact: true })
    .nth(1)
    .fill("Telur balado");
  await page.getByLabel("Jumlah hidangan", { exact: true }).fill("1");
  await page.getByLabel("Jumlah hidangan", { exact: true }).fill("2");
  await expect(
    page.getByLabel("Nama hidangan", { exact: true }).nth(1),
  ).toHaveValue("Telur balado");
  await choose(page, "Tambah komponen", "Komponen khusus…");
  await page
    .getByLabel("Komponen", { exact: true })
    .nth(1)
    .fill("Buah pilihan");
  await page.getByLabel("Nama hidangan", { exact: true }).nth(2).fill("Pepaya");
  await page.getByRole("button", { name: /6\. Tinjau/ }).click();
  await choose(
    page,
    "Status penawaran",
    "Tayangkan setelah verifikasi katerer",
  );
  const saving = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/commands") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Simpan paket", exact: true }).click();
  const result = await saving;
  expect(result.ok(), await result.text()).toBe(true);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const offer = (
    await (await page.request.get("/api/v1/catalog?limit=100")).json()
  ).data.items.find((o: { name: string }) => o.name === name);
  expect(
    offer.menus[0].composition.map((g: { slots: number }) => g.slots),
  ).toEqual([2, 1]);
  expect(offer.menus[0].items.map((i: { name: string }) => i.name)).toEqual([
    "Ayam bakar",
    "Telur balado",
    "Pepaya",
  ]);
  expect(offer.menus[0].nutrition).toBeNull();
});
