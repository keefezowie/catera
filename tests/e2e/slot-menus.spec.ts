import { test, expect, type Page, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { addDays, localDay, type Offer } from "@catera/domain";
const catererId = "10000000-0000-4000-8000-000000000001";
async function command(page: Page, action: string, payload: unknown) {
  const r = await page.request.post("/api/v1/commands", {
    data: { action, payload, requestId: crypto.randomUUID() },
  });
  expect(r.ok(), await r.text()).toBe(true);
  return (await r.json()).data;
}
// Real pointer movement crosses the browser's drag threshold before entering a target.
async function dragDish(page: Page, source: Locator, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  await source.scrollIntoViewIfNeeded();
  const from = (await source.boundingBox())!,
    to = (await target.boundingBox())!;
  const x = from.x + from.width / 2,
    y = from.y + from.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 10, y + 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 16,
  });
  await page.mouse.move(to.x + to.width / 2 + 1, to.y + to.height / 2, {
    steps: 2,
  });
  await page.mouse.up();
}
async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
const month = addDays(localDay(), 65).slice(0, 7) + "-01",
  date = month.slice(0, 8) + "10",
  date2 = month.slice(0, 8) + "11";
async function fixture(page: Page, mainSlots = 1) {
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  const base = (
    (await (await page.request.get("/api/v1/catalog")).json()).data
      .items as Offer[]
  ).find((o) => o.catererId === catererId)!;
  const name = "Sintetis kalender " + Date.now();
  const menus = [
    {
      contentModel: "slots",
      meal: "lunch",
      name: "",
      description: "",
      image: "",
      items: [],
      composition: [
        { id: "main", categoryId: "main", name: "Lauk", slots: mainSlots },
        { id: "soup", categoryId: "soup", name: "Sup", slots: 1 },
      ],
      nutrition: null,
    },
  ];
  const p = await command(page, "package.save", {
    catererId,
    slug: "calendar-" + crypto.randomUUID(),
    offer: {
      ...base,
      name,
      meal: "lunch",
      packageType: "ala_carte",
      days: 2,
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      capacity: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, 100])),
      menus,
    },
  });
  const chicken = await command(page, "dish.save", {
    catererId,
    details: {
      name: "Ayam kalender " + Date.now(),
      description: "Synthetic dish",
      image: "/assets/food/ayam-panggang.png",
      serving: "120 g",
      categoryId: "main",
    },
  });
  const soup = await command(page, "dish.save", {
    catererId,
    details: {
      name: "Sup kalender " + Date.now(),
      description: "Synthetic soup",
      image: "",
      serving: "1 mangkuk",
      categoryId: "soup",
    },
  });
  await page.goto("/seller/menus?date=" + date);
  await choose(page, "Paket dan versi isi", name + " · Versi 1");
  await expect(page.locator(".menu-day")).toHaveCount(
    new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate(),
  );
  return { id: p.id, name, chicken, soup, menus };
}
const day = (page: Page, n: number) =>
  page.locator(".menu-day").filter({
    has: page.locator("strong", { hasText: new RegExp("^" + n + "$") }),
  });
test("calendar batch, search, drag/drop and conflict recovery retain the draft", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const f = await fixture(page);
  await mkdir("output/slack-bugs/0003", { recursive: true });
  await page.screenshot({
    path: "output/slack-bugs/0003/calendar-desktop.png",
    fullPage: true,
  });

  await page
    .getByRole("button", { name: "Pilih beberapa tanggal", exact: true })
    .click();
  await day(page, 10).click();
  await day(page, 11).click();
  await page.getByRole("button", { name: "Atur menu", exact: true }).click();
  await page
    .locator(".menu-slot")
    .first()
    .getByRole("button", { name: /Pilih hidangan/ })
    .click();
  const lib = page.locator(".menu-library-desktop");
  await lib.getByLabel("Cari hidangan", { exact: true }).fill(f.chicken.name);
  await lib
    .locator(".menu-library-row")
    .filter({ hasText: f.chicken.name })
    .getByRole("button", { name: "Pilih", exact: true })
    .click();
  await lib.getByLabel("Cari hidangan", { exact: true }).fill(f.soup.name);
  await dragDish(
    page,
    lib
      .locator(".menu-library-row")
      .filter({ hasText: f.soup.name })
      .locator(".menu-drag-handle"),
    page.locator(".menu-slot").nth(1),
  );
  await expect(page.locator(".menu-slot").nth(1)).toContainText(f.soup.name);
  await expect(page.locator(".menu-slot input")).toHaveCount(0);
  await expect(page.getByLabel("Protein (g)", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Kembali ke kalender", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Simpan perubahan menu?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Lanjut mengedit", exact: true })
    .click();
  await page.screenshot({
    path: "output/slack-bugs/0003/editor-desktop.png",
    fullPage: true,
  });
  const saved = page.waitForResponse(
    (r) =>
      r.url().endsWith("/commands") &&
      r.request().postDataJSON()?.action === "menu.saveBatch",
  );
  await page.getByRole("button", { name: "Simpan menu", exact: true }).click();
  expect((await saved).ok()).toBe(true);
  await expect(page.locator(".menu-day.configured")).toHaveCount(2);
  await expect(day(page, 10)).toContainText(f.chicken.name);
  await expect(day(page, 10)).toContainText(f.soup.name);
  await expect(day(page, 10)).not.toContainText("Terisi");
  // A concurrent update must retain the local draft and leave the entire batch unchanged.
  await page
    .getByRole("button", { name: "Selesai memilih", exact: true })
    .click();
  await expect(day(page, 10)).toHaveCSS(
    "background-color",
    "rgb(240, 243, 233)",
  );
  await expect(day(page, 10)).toHaveCSS("color", "rgb(22, 61, 46)");
  await expect(day(page, 10)).toHaveAccessibleName(
    new RegExp(f.chicken.name + ", " + f.soup.name),
  );
  await page.screenshot({
    path: "output/slack-bugs/0003/calendar-configured-desktop.png",
    fullPage: true,
  });
  await day(page, 10).click();
  // Make a local dish change before another operator saves this date.
  await page.locator(".menu-slot-select").first().click();
  await lib.getByLabel("Cari hidangan", { exact: true }).fill(f.chicken.name);
  await lib.getByRole("button", { name: "Pilih", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Ganti hidangan", exact: true })
    .click();
  const cal = (
    await (
      await page.request.get(
        `/api/v1/menu-month?packageId=${f.id}&revision=1&month=${month}&meal=lunch`,
      )
    ).json()
  ).data;
  const existing = cal.dates.find((d: { date: string }) => d.date === date);
  await command(page, "menu.saveBatch", {
    catererId,
    packageId: f.id,
    contentRevision: 1,
    meal: "lunch",
    details: existing.details,
    dates: [{ date, version: 1 }],
  });
  await page.getByRole("button", { name: "Simpan menu", exact: true }).click();
  await page
    .getByRole("button", { name: "Ganti dan simpan", exact: true })
    .click();
  await expect(page.getByText(/Menu berubah sejak dibuka/)).toBeVisible();
  await expect(page.locator(".menu-slot").first()).toContainText(
    f.chicken.name,
  );
  await expect(page.locator(".menu-completion")).toHaveText("2/2 slot terisi");
  await page
    .getByRole("button", { name: "Muat ulang tanggal", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Buang perubahan", exact: true })
    .click();
  await expect(page.locator(".menu-month-grid")).toBeVisible();
  const axe = await new AxeBuilder({ page })
    .include(".menu-workspace")
    .analyze();
  expect(
    axe.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
  expect(errors).toEqual([]);
});

test("visual assembly advances through repeated slots, wraps, supports keyboard and preserves cancelled replacement", async ({
  page,
}) => {
  const f = await fixture(page, 2);
  await day(page, 10).click();
  const slots = page.locator(".menu-slot-select"),
    lib = page.locator(".menu-library-desktop");
  await expect(slots).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Simpan menu", exact: true }),
  ).toBeDisabled();
  await slots.nth(2).click();
  await expect(lib.locator("summary")).toHaveCount(1);
  await expect(lib.locator("summary")).toContainText("Sup");
  await lib.getByLabel("Cari hidangan", { exact: true }).fill(f.soup.name);
  await dragDish(
    page,
    lib
      .locator(".menu-library-row")
      .filter({ hasText: f.soup.name })
      .locator(".menu-drag-handle"),
    page.locator(".menu-slot").nth(2),
  );
  await expect(slots.first()).toHaveAttribute("aria-pressed", "true");
  await expect(lib.getByLabel("Cari hidangan", { exact: true })).toHaveValue(
    "",
  );
  await expect(lib.locator("summary")).toContainText("Lauk");
  await lib.getByLabel("Cari hidangan", { exact: true }).fill(f.chicken.name);
  // Drag the dish photograph itself, not just its grip.
  await dragDish(
    page,
    lib
      .locator(".menu-library-row")
      .filter({ hasText: f.chicken.name })
      .locator("img"),
    page.locator(".menu-slot").first(),
  );
  await expect(slots.nth(1)).toHaveAttribute("aria-pressed", "true");
  await lib.getByRole("button", { name: "Pilih", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".menu-completion")).toHaveText("3/3 slot terisi");
  await expect(page.getByLabel("Protein (g)", { exact: true })).toHaveCount(0);
  await slots.first().focus();
  await page.keyboard.press("Enter");
  await lib.getByRole("button", { name: "Pilih", exact: true }).click();
  const replace = page.getByRole("dialog", {
    name: "Ganti hidangan pada slot ini?",
  });
  await expect(replace).toBeVisible();
  await replace.getByRole("button", { name: "Tutup", exact: true }).click();
  await expect(page.locator(".menu-completion")).toHaveText("3/3 slot terisi");
  await expect(page.locator(".menu-slot").first()).toContainText(
    f.chicken.name,
  );
  await page
    .locator(".menu-slot")
    .first()
    .getByRole("button", { name: /^Kosongkan/ })
    .click();
  await expect(page.locator(".menu-completion")).toHaveText("2/3 slot terisi");
  await expect(
    page.getByRole("button", { name: "Simpan menu", exact: true }),
  ).toBeDisabled();
  await lib.getByRole("button", { name: "Pilih", exact: true }).click();
  await page.getByRole("button", { name: "Simpan menu", exact: true }).click();
  await expect(page.locator(".menu-month-grid")).toBeVisible();
  await day(page, 10).click();
  await expect(page.locator(".menu-completion")).toHaveText("3/3 slot terisi");
  const axe = await new AxeBuilder({ page })
    .include(".menu-workspace")
    .analyze();
  expect(
    axe.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
});

test("all seeded package revisions use slots and the combined package separates lunch and dinner with reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  const seller = (
    await (
      await page.request.get(`/api/v1/seller/${catererId}?date=${date}`)
    ).json()
  ).data;
  expect(
    seller.contentRevisions
      .filter((r: { packageId: string }) => r.packageId.startsWith("20000000-"))
      .every((r: { contents: { menus: { contentModel: string }[] } }) =>
        r.contents.menus.every((m) => m.contentModel === "slots"),
      ),
  ).toBe(true);
  const combined = seller.contentRevisions.find(
    (r: { name: string }) => r.name === "Rantang Nusantara",
  );
  await page.goto("/seller/menus?date=" + date);
  await choose(
    page,
    "Paket dan versi isi",
    combined.name + " · Versi " + combined.revision,
  );
  await day(page, 12).click();
  await expect(page.locator(".menu-slot")).toHaveCount(4);
  expect(
    await page
      .locator(".menu-main")
      .evaluate((el) => el.getAnimations({ subtree: true }).length),
  ).toBe(0);
  await page.screenshot({
    path: "output/slack-bugs/0003/visual-card-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Kembali ke kalender", exact: true })
    .click();
  await choose(page, "Waktu makan", "Makan malam");
  await day(page, 12).click();
  await expect(page.locator(".menu-completion")).toHaveText("0/4 slot terisi");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "output/slack-bugs/0003/visual-card-phone.png",
    fullPage: true,
  });
  await expect(page.locator(".menu-slot input")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("phone keyboard/touch picker, category creation, library editing and legacy redirect", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const f = await fixture(page);
  await page.screenshot({
    path: "output/slack-bugs/0003/calendar-phone.png",
    fullPage: true,
  });
  await day(page, 10).focus();
  await page.keyboard.press("Enter");
  await page
    .locator(".menu-slot")
    .first()
    .getByRole("button", { name: /Pilih hidangan/ })
    .click();
  const dialog = page.getByRole("dialog", { name: "Pustaka hidangan" });
  await expect(dialog).toBeVisible();
  await dialog
    .getByLabel("Cari hidangan", { exact: true })
    .fill(f.chicken.name);
  await dialog.getByRole("button", { name: "Pilih", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".menu-slot-select").nth(1)).toBeFocused();
  await page
    .locator(".menu-slot")
    .nth(1)
    .getByRole("button", { name: /Pilih hidangan/ })
    .click();
  await dialog.getByLabel("Cari hidangan", { exact: true }).fill(f.soup.name);
  await dialog.getByRole("button", { name: "Pilih", exact: true }).click();
  await expect(page.locator(".menu-slot-select").nth(1)).toBeFocused();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "output/slack-bugs/0003/editor-phone.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Simpan menu", exact: true }).click();
  await expect(page.locator(".menu-day.configured")).toHaveCount(1);
  await expect
    .poll(() =>
      page
        .locator(".menu-main")
        .evaluate(
          (el) =>
            el
              .getAnimations({ subtree: true })
              .filter((animation) => animation.playState === "running").length,
        ),
    )
    .toBe(0);
  await expect(page.locator(".menu-month-heading h2")).toBeFocused();
  await page.screenshot({
    path: "output/slack-bugs/0003/calendar-configured-phone.png",
    fullPage: true,
  });
  await expect(page.locator(".menu-month-heading h2")).toBeFocused();
  await page
    .getByRole("button", { name: "Pustaka hidangan", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Kategori baru", exact: true })
    .click();
  const category = "Camilan " + Date.now();
  await dialog.getByLabel("Nama kategori", { exact: true }).fill(category);
  await dialog
    .getByRole("button", { name: "Simpan kategori", exact: true })
    .click();
  await expect(
    dialog.locator("summary").filter({ hasText: category }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Tambah", exact: true }).click();
  await dialog
    .getByRole("combobox", { name: "Kategori hidangan", exact: true })
    .click();
  await page.getByRole("option", { name: category, exact: true }).click();
  await dialog
    .getByLabel("Nama hidangan", { exact: true })
    .fill("Puding sintetis");
  await dialog
    .getByRole("button", { name: "Simpan hidangan", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "Hidangan baru" }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "Tutup", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/seller/dishes");
  await expect(page).toHaveURL(/\/seller\/menus\?library=1/);
  await expect(
    page.getByRole("dialog", { name: "Pustaka hidangan" }),
  ).toBeVisible();
});
test("package wizard publishes composition only and customers buy before dated menus exist", async ({
  page,
}) => {
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  await page.goto("/seller/packages");
  await page.getByRole("button", { name: "Buat paket", exact: true }).click();
  await choose(page, "Jenis paket", "Nasi box");
  const name = "Paket komposisi " + Date.now();
  await page.getByLabel("Nama paket", { exact: true }).fill(name);
  await page
    .getByLabel("Cerita paket", { exact: true })
    .fill("Paket sintetis dengan menu yang diatur melalui kalender.");
  await page.getByRole("button", { name: /2\. Isi/ }).click();
  await page
    .getByRole("button", { name: "Gunakan foto sintetis demo" })
    .click();
  await choose(page, "Tambah kategori ke paket", "Lauk");
  await page.getByLabel("Jumlah Lauk", { exact: true }).fill("2");
  await expect(page.getByLabel("Nama hidangan", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: /6\. Tinjau/ }).click();
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
  await page.getByRole("button", { name: "Simpan paket", exact: true }).click();
  const response = await save;
  expect(response.ok(), await response.text()).toBe(true);
  const id = (await response.json()).data.id;
  await page.request.post("/api/v1/auth/demo", { data: { role: "customer" } });
  await page.goto("/packages/" + id);
  await expect(
    page.getByText("Menu belum ditentukan", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("2 Lauk", { exact: true }).first()).toBeVisible();
  const customer = (await (await page.request.get("/api/v1/customer")).json())
    .data;
  const checkout = await command(page, "checkout.create", {
    packageId: id,
    addressId: customer.addresses[0].id,
    portions: 1,
    startDate: addDays(localDay(), 30),
    trial: false,
  });
  await command(page, "checkout.demo_pay", { id: checkout.id });
  const after = (await (await page.request.get("/api/v1/customer")).json())
    .data;
  const delivery = after.deliveries.find(
    (d: { offer: Offer }) => d.offer.id === id,
  );
  await page.goto("/deliveries/" + delivery.id);
  await expect(
    page
      .locator(".package-contents")
      .getByText(/Menu belum ditentukan/)
      .first(),
  ).toBeVisible();
});

test("mixed dates start empty, reject a wrong category and confirm slot and date replacement", async ({
  page,
}) => {
  const f = await fixture(page);
  const details = {
    ...f.menus[0],
    items: [
      {
        name: f.chicken.name,
        description: f.chicken.description,
        image: f.chicken.image,
        serving: f.chicken.serving,
        categoryId: "main",
        id: "main:0",
        groupId: "main",
        sourceDishId: f.chicken.id,
        sourceDishVersion: f.chicken.version,
      },
      {
        name: f.soup.name,
        description: f.soup.description,
        image: f.soup.image,
        serving: f.soup.serving,
        categoryId: "soup",
        id: "soup:0",
        groupId: "soup",
        sourceDishId: f.soup.id,
        sourceDishVersion: f.soup.version,
      },
    ],
  };
  await command(page, "menu.saveBatch", {
    catererId,
    packageId: f.id,
    contentRevision: 1,
    meal: "lunch",
    details,
    dates: [{ date, version: 0 }],
  });
  await page.reload();
  await choose(page, "Paket dan versi isi", f.name + " · Versi 1");
  await page
    .getByRole("button", { name: "Pilih beberapa tanggal", exact: true })
    .click();
  await day(page, 10).click();
  await day(page, 11).click();
  await page.getByRole("button", { name: "Atur menu", exact: true }).click();
  await expect(page.getByText(/Menu berbeda\. Susun/)).toBeVisible();
  await expect(page.locator(".menu-slot").first()).toContainText(
    "Taruh hidangan di sini",
  );
  await page.locator(".menu-slot-select").nth(1).click();
  const lib = page.locator(".menu-library-desktop");
  await lib.getByLabel("Cari hidangan", { exact: true }).fill(f.soup.name);
  await dragDish(
    page,
    lib
      .locator(".menu-library-row")
      .filter({ hasText: f.soup.name })
      .locator(".menu-drag-handle"),
    page.locator(".menu-slot").first(),
  );
  await expect(
    page.getByText("Kategori hidangan tidak sesuai slot.", { exact: true }),
  ).toBeVisible();
  await page.locator(".menu-slot-select").first().click();
  await lib.getByLabel("Cari hidangan", { exact: true }).fill(f.chicken.name);
  await lib.getByRole("button", { name: "Pilih", exact: true }).click();
  await page.locator(".menu-slot-select").first().click();
  await lib.getByLabel("Cari hidangan", { exact: true }).fill(f.chicken.name);
  await lib.getByRole("button", { name: "Pilih", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Ganti hidangan pada slot ini?" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Ganti hidangan", exact: true })
    .click();
  await lib.getByLabel("Cari hidangan", { exact: true }).fill(f.soup.name);
  await dragDish(
    page,
    lib
      .locator(".menu-library-row")
      .filter({ hasText: f.soup.name })
      .locator(".menu-drag-handle"),
    page.locator(".menu-slot").nth(1),
  );
  await page.getByRole("button", { name: "Simpan menu", exact: true }).click();
  const confirm = page.getByRole("dialog", {
    name: "Ganti menu yang tersimpan?",
  });
  await expect(confirm).toContainText("10");
  await expect(confirm).not.toContainText("11 Nov");
  await confirm
    .getByRole("button", { name: "Ganti dan simpan", exact: true })
    .click();
  await expect(page.locator(".menu-day.configured")).toHaveCount(2);
});
