import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { addDays, localDay, type Offer } from "@catera/domain";
const date = addDays(localDay(), 15);
async function cmd(page: Page, action: string, payload: unknown) {
  const r = await page.request.post("/api/v1/commands", {
    data: { action, payload, requestId: crypto.randomUUID() },
  });
  expect(r.ok(), await r.text()).toBe(true);
  return (await r.json()).data;
}
async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
async function fixture(page: Page, editor = false) {
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  const base = (
    (await (await page.request.get("/api/v1/catalog")).json()).data
      .items as Offer[]
  )[0];
  const names = [
    "Ayam pilihan " + Date.now(),
    "Ikan pilihan " + Date.now(),
    "Tempe pilihan " + Date.now(),
  ];
  const ids = [];
  for (const name of names)
    ids.push(
      (
        await cmd(page, "dish.save", {
          catererId: base.catererId,
          details: {
            name,
            categoryId: "main",
            serving: "120 g",
            description: "Hidangan sintetis",
            image: base.image,
          },
        })
      ).id,
    );
  const name = "Paket pilihan " + Date.now(),
    slug = "choice-" + crypto.randomUUID();
  const p = await cmd(page, "package.save", {
    catererId: base.catererId,
    slug,
    choiceDishIds: editor ? undefined : ids,
    offer: {
      ...base,
      name,
      status: editor ? "draft" : "published",
      menuSelectionMode: editor ? "caterer" : "customer",
      packageType: "nasi_box",
      days: 2,
      meal: "lunch",
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      capacity: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, 100])),
      menus: [
        {
          contentModel: "slots",
          meal: "lunch",
          name: "",
          description: "",
          image: "",
          items: [],
          composition: [
            { id: "main", categoryId: "main", name: "Lauk", slots: 2 },
          ],
        },
      ],
    },
  });
  if (editor) {
    await page.goto("/seller/packages");
    await page
      .locator(".seller-packages article")
      .filter({ hasText: name })
      .getByRole("button", { name: "Kelola paket" })
      .click();
    await page.getByRole("button", { name: "2. Isi", exact: true }).click();
    await choose(
      page,
      "Siapa yang memilih menu?",
      "Pelanggan · Pilih menu sendiri",
    );
    for (const dish of names)
      await page.getByLabel(dish + " · 120 g", { exact: true }).check();
    await page.getByRole("button", { name: "5. Periksa", exact: true }).click();
    await choose(
      page,
      "Status penawaran",
      "Tayangkan setelah verifikasi katerer",
    );
    await page
      .getByRole("button", { name: "Tayangkan paket", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Kelola paket" }),
    ).toBeHidden();
  }
  await page.request.post("/api/v1/auth/demo", { data: { role: "customer" } });
  const customer = (await (await page.request.get("/api/v1/customer")).json())
    .data;
  const checkout = await cmd(page, "checkout.create", {
    acceptedTerms: true,
    packageId: p.id,
    portions: 2,
    trial: false,
    startDate: date,
    addressId: customer.addresses[0].id,
    paymentMethod: "qris",
  });
  await cmd(page, "checkout.demo_pay", { id: checkout.id });
  const after = (await (await page.request.get("/api/v1/customer")).json())
    .data;
  const subscription = after.subscriptions.find(
    (s: { package_id: string }) => s.package_id === p.id,
  );
  return { p, base, names, subscription, slug };
}
async function selectDish(page: Page, index: number, name: string) {
  await page.locator(".menu-slot-select").nth(index).click();
  let lib = page.getByRole("dialog", { name: "Pustaka hidangan", exact: true });
  if (!(await lib.isVisible())) {
    await page.locator(".menu-library-trigger").click();
    lib = page.getByRole("dialog", { name: "Pustaka hidangan", exact: true });
  }
  await expect(
    lib.getByRole("button", { name: "Tambah hidangan", exact: true }),
  ).toHaveCount(0);
  await expect(
    lib.getByRole("button", { name: "Edit", exact: true }),
  ).toHaveCount(0);
  await lib
    .locator(".menu-library-row")
    .filter({ hasText: name })
    .getByRole("button", { name: "Pilih", exact: true })
    .click();
  await expect(page.locator(".menu-slot-select").nth(1)).toBeFocused();
}
test("seller configures customer choice; customer selects; kitchen and CSV preserve dishes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const f = await fixture(page, true);
  await page.goto("/packages/" + f.slug);
  await expect(
    page.getByText("Hidangan yang boleh dipilih pelanggan"),
  ).toHaveCount(0);
  await expect(page.locator("#main .package-choice-library:visible")).toContainText(
    f.names[0],
  );
  await page.goto("/subscriptions/" + f.subscription.id);
  await page
    .getByRole("link", { name: "Pilih menu sendiri", exact: true })
    .click();
  await page.locator("button.menu-day").first().click();
  await selectDish(page, 0, f.names[0]);
  await selectDish(page, 1, f.names[1]);
  await expect(page.getByText(/2\/2/)).toBeVisible();
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/commands") &&
      r.request().postDataJSON()?.action === "customerMenu.saveBatch",
  );
  await page.getByRole("button", { name: "Simpan menu", exact: true }).click();
  expect((await response).ok()).toBe(true);
  await expect(page.locator(".menu-day.configured")).toHaveCount(1);
  const c = (await (await page.request.get("/api/v1/customer")).json()).data;
  const delivery = c.deliveries.find(
    (d: { subscription_id: string }) => d.subscription_id === f.subscription.id,
  );
  await page.goto("/deliveries/" + delivery.id);
  await page.getByText("Isi paket", { exact: true }).click();
  await expect(page.locator(".package-contents")).toContainText(f.names[0]);
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  await page.goto("/seller/menus");
  await choose(page, "Paket", f.subscription.snapshot.offer.name);
  await expect(page.locator("#main .package-choice-library:visible")).toContainText(f.names[0]);
  const frozen = await cmd(page, "production.freeze", {
    catererId: f.base.catererId,
    date,
  });
  const csv = await page.request.get("/api/manifests/" + frozen.id);
  expect(await csv.text()).toContain(f.names[0]);
  expect(errors).toEqual([]);
});
test("responsive calendar and picker, keyboard, atomic multi-date selection and reset", async ({
  page,
}) => {
  const f = await fixture(page);
  await page.goto("/subscriptions/" + f.subscription.id + "/menu?date=" + date);
  await mkdir("output/customer-choice", { recursive: true });
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `output/customer-choice/calendar-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.locator("button.menu-day").first().focus();
    await page.keyboard.press("Enter");
    await selectDish(page, 0, f.names[0]);
    await selectDish(page, 1, f.names[1]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `output/customer-choice/editor-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page }).include(".menu-workspace").analyze()
      ).violations.filter((v) =>
        ["serious", "critical"].includes(v.impact || ""),
      ),
    ).toEqual([]);
    await page
      .getByRole("button", { name: "Kembali ke kalender", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Simpan perubahan menu?" });
    await dialog
      .getByRole("button", { name: /Buang|Tanpa menyimpan|Jangan simpan/i })
      .click();
  }
  await page
    .getByRole("button", { name: "Pilih beberapa tanggal", exact: true })
    .click();
  for (const card of await page.locator("button.menu-day").all())
    await card.click();
  await page.getByRole("button", { name: "Atur menu", exact: true }).click();
  await selectDish(page, 0, f.names[0]);
  await selectDish(page, 1, f.names[1]);
  await page.getByRole("button", { name: "Simpan menu", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: /Simpan menu/ });
  if (await confirm.isVisible())
    await confirm
      .getByRole("button", { name: /Simpan/ })
      .last()
      .click();
  await expect(page.locator(".menu-day.configured")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Selesai memilih", exact: true })
    .click();
  await page.locator("button.menu-day").first().click();
  await page
    .getByRole("button", { name: "Serahkan ke katerer", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ya, serahkan ke katerer", exact: true })
    .click();
  await expect(page.locator(".menu-day.configured")).toHaveCount(1);
});
