import { test, expect, type Page } from "@playwright/test";
import { addDays, localDay, type Offer } from "@catera/domain";
async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
async function cmd(page: Page, action: string, payload: unknown) {
  const r = await page.request.post("/api/v1/commands", {
    data: { action, payload, requestId: crypto.randomUUID() },
  });
  expect(r.ok(), await r.text()).toBe(true);
  return (await r.json()).data;
}
async function base(page: Page) {
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  const actor = (await (await page.request.get("/api/v1/me")).json()).data
    .actor;
  return (
    (await (await page.request.get("/api/v1/catalog?limit=100")).json()).data
      .items as Offer[]
  ).find((o) => o.catererId === actor.catererId)!;
}
test("slot purchase resolves dated dishes through customer delivery and frozen production, preserving purchase contents", async ({
  page,
}) => {
  const b = await base(page),
    menu = {
      contentModel: "slots",
      meal: "lunch",
      name: "",
      description: "",
      image: "",
      items: [],
      composition: [{ id: "main", categoryId: "main", name: "Lauk", slots: 2 }],
      nutrition: null,
    };
  const created = await cmd(page, "package.save", {
    catererId: b.catererId,
    slug: "contents-" + crypto.randomUUID(),
    offer: {
      ...b,
      name: "Sintetis isi " + Date.now(),
      meal: "lunch",
      days: 2,
      packageType: "ala_carte",
      nutrition: { proteinG: { min: 35, max: 45 }, carbsG: 0 },
      menus: [menu],
    },
  });
  await page.request.post("/api/v1/auth/demo", { data: { role: "customer" } });
  const customer = (await (await page.request.get("/api/v1/customer")).json())
    .data;
  const checkout = await cmd(page, "checkout.create", {
    packageId: created.id,
    addressId: customer.addresses[0].id,
    portions: 1,
    startDate: addDays(localDay(), 30),
    trial: false,
  });
  await cmd(page, "checkout.demo_pay", { id: checkout.id });
  const before = (await (await page.request.get("/api/v1/customer")).json())
      .data,
    sub = before.subscriptions.find(
      (s: { package_id: string }) => s.package_id === created.id,
    ),
    delivery = before.deliveries.find(
      (d: { subscription_id: string }) => d.subscription_id === sub.id,
    );
  await page.goto("/deliveries/" + delivery.id);
  await expect(page.locator(".package-contents")).toContainText(
    "Menu belum ditentukan",
  );
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  const details = {
    ...menu,
    items: [
      {
        id: "main:0",
        groupId: "main",
        categoryId: "main",
        name: "Ayam kecap pengganti",
        description: "",
        image: "",
        serving: "150 g",
      },
      {
        id: "main:1",
        groupId: "main",
        categoryId: "main",
        name: "Tempe bacem verifikasi",
        description: "",
        image: "",
        serving: "2 potong",
      },
    ],
    nutrition: null,
  };
  await cmd(page, "menu.saveBatch", {
    catererId: b.catererId,
    packageId: created.id,
    contentRevision: 1,
    meal: "lunch",
    details,
    dates: [{ date: delivery.service_date, version: 0 }],
  });
  const frozen = await cmd(page, "production.freeze", {
    catererId: b.catererId,
    date: delivery.service_date,
  });
  const csv = await page.request.get("/api/manifests/" + frozen.id);
  expect(await csv.text()).toContain("Ayam kecap pengganti");
  expect(await csv.text()).toContain("Tempe bacem verifikasi (2 potong)");
  await page.request.post("/api/v1/auth/demo", { data: { role: "customer" } });
  await page.goto("/deliveries/" + delivery.id);
  await expect(page.locator(".package-contents")).toContainText(
    "Ayam kecap pengganti",
  );
  await expect(page.locator(".package-contents")).toContainText(
    "35–45 g protein",
  );
  await page.goto("/subscriptions/" + sub.id);
  await expect(page.locator(".package-contents")).toContainText(
    "Menu belum ditentukan",
  );
  const after = (await (await page.request.get("/api/v1/customer")).json())
    .data;
  expect(
    after.subscriptions.find((s: { id: string }) => s.id === sub.id).snapshot,
  ).toEqual(sub.snapshot);
});
test("legacy nasi box retains concrete dishes, macros, discovery filtering and English presentation", async ({
  page,
}) => {
  const b = await base(page),
    name = "Legacy isi " + Date.now();
  const menu = {
    meal: "lunch",
    name: "Sup jagung",
    description: "Legacy synthetic menu",
    image: "",
    composition: [{ id: "soup", name: "Sup", slots: 1 }],
    items: [
      {
        id: "soup",
        groupId: "soup",
        name,
        description: "Sup jagung sintetis",
        image: "",
        serving: "1 mangkuk",
      },
    ],
    nutrition: { proteinG: 12 },
  };
  const p = await cmd(page, "package.save", {
    catererId: b.catererId,
    slug: "legacy-" + crypto.randomUUID(),
    offer: {
      ...b,
      name,
      meal: "lunch",
      packageType: "nasi_box",
      menus: [menu],
    },
  });
  await page.request.post("/api/v1/auth/demo", { data: { role: "customer" } });
  await page.goto("/packages/" + p.id);
  await expect(page.locator(".package-contents")).toContainText("1 Sup");
  await expect(page.locator(".package-contents")).toContainText(
    "Sup jagung sintetis",
  );
  await choose(page, "Bahasa", "English");
  await expect(page.locator(".package-contents")).toContainText("Example menu");
  await expect(page.locator(".package-contents")).toContainText(
    "Caterer estimate",
  );
  await page.goto("/#packages");
  await choose(page, "Package type", "Rice box");
  await page.getByRole("textbox", { name: "Search caterers" }).fill(name);
  await expect(page.locator(".package-card")).toHaveCount(1);
});
test("wizard reviews custom categories and counts before publishing the new composition", async ({
  page,
}) => {
  await base(page);
  await page.goto("/seller/packages");
  await page.getByRole("button", { name: "Buat paket", exact: true }).click();
  await choose(page, "Jenis paket", "Nasi box");
  const name = "Komposisi kustom " + Date.now();
  await page.getByLabel("Nama paket", { exact: true }).fill(name);
  await page
    .getByLabel("Cerita paket", { exact: true })
    .fill("Komposisi sintetis untuk kategori dan slot.");
  await page.getByRole("button", { name: /2\. Isi/ }).click();
  await page
    .getByRole("button", { name: "Gunakan foto sintetis demo" })
    .click();
  await choose(page, "Tambah kategori ke paket", "Lauk");
  await page.getByLabel("Jumlah Lauk", { exact: true }).fill("2");
  await page
    .getByRole("button", { name: "Kategori baru", exact: true })
    .click();
  const category = "Buah pilihan " + Date.now();
  await page.getByLabel("Nama kategori", { exact: true }).fill(category);
  await page
    .getByRole("button", { name: "Simpan kategori", exact: true })
    .click();
  await expect(
    page.getByLabel("Jumlah " + category, { exact: true }),
  ).toHaveValue("1");
  await expect(page.getByLabel("Nama hidangan", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: /5\. Periksa/ }).click();
  await choose(
    page,
    "Status penawaran",
    "Tayangkan setelah verifikasi katerer",
  );
  const save = page.waitForResponse(
    (r) =>
      r.url().endsWith("/commands") &&
      r.request().postDataJSON()?.action === "package.save",
  );
  await page.getByRole("button", { name: "Tayangkan paket", exact: true }).click();
  expect((await save).ok()).toBe(true);
  const offer = (
    (await (await page.request.get("/api/v1/catalog?limit=100")).json()).data
      .items as Offer[]
  ).find((o) => o.name === name)!;
  expect(offer.menus[0].composition!.map((g) => g.slots)).toEqual([2, 1]);
  expect(offer.menus[0].items).toEqual([]);
  expect(offer.menus[0].nutrition).toBeNull();
  expect(offer.menus[0].contentModel).toBe("slots");
});
