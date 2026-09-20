import { test, expect, type Page } from "@playwright/test";
import { addDays, localDay } from "@catera/domain";
const cid = "10000000-0000-4000-8000-000000000001";
for (const locale of ["id", "en"])
  for (const width of [390, 768, 1440, 1920])
    test(`screenshot regressions: seller data and duration layout ${locale} ${width}`, async ({
      page,
      baseURL,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page
        .context()
        .addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
      await page.setViewportSize({ width, height: 1000 });
      await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
      for (const resource of ["seller-attention", "payout-setup"]) {
        const response = await page.request.get(`/api/v1/${resource}/${cid}`);
        expect(response.ok(), await response.text()).toBe(true);
      }
      await page.goto("/seller");
      await expect(page.locator(".seller-attention")).toContainText(
        /Perlu perhatian|Needs attention/,
      );
      await expect(page.locator(".seller-attention")).not.toHaveAttribute(
        "aria-busy",
        "true",
      );
      await expect(
        page.getByText(/Data tidak ditemukan|Data not found/),
      ).toHaveCount(0);
      for (const path of ["transactions", "settings"]) {
        await page.goto(`/seller/${path}`);
        await expect(page.locator("#payout")).toBeVisible();
        await expect(
          page.getByText(/Data tidak ditemukan|Data not found/),
        ).toHaveCount(0);
      }
      await page.goto("/seller/packages");
      const editor = page.locator(".duration-editor").first();
      await editor.locator("summary").click();
      await expect(editor).toHaveAttribute("open", "");
      const twoCycles = editor.locator(".duration-option").nth(1);
      await twoCycles.getByRole("checkbox").check();
      await twoCycles.getByRole("spinbutton").fill("3");
      await expect(twoCycles.locator("output")).not.toBeEmpty();
      const cards = page.locator(".seller-packages > article");
      const secondBefore = await cards.nth(1).boundingBox();
      const card = await cards.first().boundingBox();
      const box = await editor.boundingBox();
      expect(box!.width).toBeGreaterThan(card!.width * 0.7);
      const collisions = await editor
        .locator(".duration-option")
        .evaluateAll((rows) =>
          rows.some((row) => {
            const children = Array.from(row.children).map((child) =>
              child.getBoundingClientRect(),
            );
            return children.some((a, i) =>
              children
                .slice(i + 1)
                .some(
                  (b) =>
                    a.left < b.right &&
                    a.right > b.left &&
                    a.top < b.bottom &&
                    a.bottom > b.top,
                ),
            );
          }),
        );
      expect(collisions).toBe(false);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `output/screenshot-fixes/packages-${locale}-${width}.png`,
        fullPage: true,
      });
      const saved = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/v1/commands") &&
          response.request().postDataJSON()?.action ===
            "package.durationPricing.save",
      );
      await editor
        .getByRole("button", {
          name: /Simpan pilihan durasi|Save duration options/,
        })
        .click();
      expect((await saved).ok()).toBe(true);
      await editor.locator("summary").click();
      const secondAfter = await cards.nth(1).boundingBox();
      expect(Math.abs(secondBefore!.height - secondAfter!.height)).toBeLessThan(
        2,
      );
      await page.reload();
      await editor.locator("summary").click();
      await expect(twoCycles.getByRole("checkbox")).toBeChecked();
      await expect(twoCycles.getByRole("spinbutton")).toHaveValue("3");
      expect(errors).toEqual([]);
    });
async function command(page: Page, action: string, payload: unknown) {
  const response = await page.request.post("/api/v1/commands", {
    data: { action, payload, requestId: crypto.randomUUID() },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()).data;
}
async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
test("seller package modes, inline schedule filters, and subscription-only customers", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  const seller = (
    await (await page.request.get(`/api/v1/seller/${cid}`)).json()
  ).data;
  const base = seller.offers.find((o: any) => o.status === "published");
  const stamp = Date.now();
  const dish = await command(page, "dish.save", {
    catererId: cid,
    details: {
      name: `Ayam UI ${stamp}`,
      categoryId: "main",
      serving: "120 g",
      description: "Synthetic test dish",
      image: base.image,
    },
  });
  const offers = [];
  for (const mode of ["caterer", "customer"]) {
    const name = `Paket UI ${mode} ${stamp}`;
    const saved = await command(page, "package.save", {
      catererId: cid,
      slug: `ui-${mode}-${stamp}`,
      choiceDishIds: mode === "customer" ? [dish.id] : undefined,
      offer: {
        ...base,
        name,
        status: "published",
        menuSelectionMode: mode,
        meal: "lunch",
        days: 1,
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        capacity: Object.fromEntries(
          [0, 1, 2, 3, 4, 5, 6].map((d) => [d, 100]),
        ),
        menus: [
          {
            contentModel: "slots",
            meal: "lunch",
            name: "",
            description: "",
            image: "",
            items: [],
            composition: [
              { id: "main", categoryId: "main", name: "Lauk", slots: 1 },
            ],
          },
        ],
      },
    });
    offers.push({ id: saved.id, name });
  }
  await page.goto("/seller/menus");
  await choose(page, "Paket", offers[1].name);
  await expect(page.locator(".menu-month-heading")).toHaveCount(0);
  await expect(page.locator(".choice-option-card")).toContainText(
    `Ayam UI ${stamp}`,
  );
  await expect(page.locator(".choice-composition")).toContainText("1 Lauk");
  await page.screenshot({
    path: "output/seller-ui/menu-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".choice-option-card")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "output/seller-ui/menu-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .locator(".package-choice-library")
    .getByRole("button", { name: "Tambahkan ke paket" })
    .first()
    .click();
  await expect(page.locator(".choice-option-card")).toHaveCount(2);
  await page
    .locator(".choice-option-card")
    .filter({ hasText: `Ayam UI ${stamp}` })
    .getByRole("button", { name: "Nonaktifkan" })
    .click();
  await expect(page.locator(".choice-option-card.is-retired")).toHaveCount(1);
  await choose(page, "Paket", offers[0].name);
  await expect(page.locator(".menu-month-heading")).toBeVisible();
  await expect(page.locator(".package-choice-library")).toHaveCount(0);

  let date = addDays(localDay(), 40);
  for (let attempt = 0; attempt < 250; attempt++) {
    const day = (
      await (
        await page.request.get(`/api/v1/seller/${cid}?date=${date}`)
      ).json()
    ).data;
    if (!day.deliveries.length) break;
    date = addDays(date, 1);
  }
  await page.request.post("/api/v1/auth/demo", { data: { role: "customer" } });
  const customer = (await (await page.request.get("/api/v1/customer")).json())
    .data;
  const destination = {
    ...customer.addresses[0],
    id: undefined,
    label: "Kantor UI",
    line: `Jalan Kantor UI ${stamp}`,
  };
  const secondAddress = await command(page, "address.save", destination);
  for (const offer of offers) {
    const checkout = await command(page, "checkout.create", {
      packageId: offer.id,
      portions: 2,
      trial: false,
      startDate: date,
      addressId:
        offer.id === offers[0].id ? customer.addresses[0].id : secondAddress.id,
      paymentMethod: "qris",
    });
    await command(page, "checkout.demo_pay", { id: checkout.id });
  }
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/seller/schedule?date=${date}&meal=lunch`);
  await page.getByRole("button", { name: /Pelanggan unik/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Filter pelanggan" }),
  ).toBeVisible();
  await expect(page.locator(".ops-group-heading")).toHaveCount(1);
  await choose(
    page,
    "Filter pelanggan",
    customer.subscriptions[0]?.customer?.name || "Nadia Putri",
  );
  await expect(page).toHaveURL(/filter=/);
  await expect(
    page.locator(".ops-order-table tbody tr:not(.ops-group-heading)"),
  ).toHaveCount(2);
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Filter pelanggan" }),
  ).toContainText("Nadia");
  await page.getByRole("button", { name: /Tujuan unik/ }).click();
  await expect(
    page.getByRole("combobox", { name: "Filter tujuan" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".ops-group-heading")).toHaveCount(2);
  await choose(
    page,
    "Filter tujuan",
    `${destination.line}, ${destination.area}`,
  );
  await expect(
    page.locator(".ops-order-table tbody tr:not(.ops-group-heading)"),
  ).toHaveCount(1);
  await expect(page.locator(".ops-order-table")).toContainText(offers[1].name);
  await page.screenshot({
    path: "output/seller-ui/schedule-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const metrics = await page.locator(".ops-metrics > *").evaluateAll((cards) =>
    cards.map((card) => ({
      top: card.getBoundingClientRect().top,
      height: card.getBoundingClientRect().height,
    })),
  );
  expect(metrics[2].top).toBe(metrics[3].top);
  expect(metrics[2].height).toBe(metrics[3].height);
  await page.screenshot({
    path: "output/seller-ui/schedule-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Hapus filter" }).click();
  await expect(page.locator(".ops-group-heading")).toHaveCount(0);
  await page.goto(`/seller?date=${date}&meal=lunch`);
  await expect(page.locator(".ops-group-heading")).toHaveCount(2);
  const toolbar = page.locator(".ops-list-toolbar");
  expect((await toolbar.boundingBox())!.height).toBeLessThan(70);
  await page.screenshot({
    path: "output/seller-ui/today-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const group = page.locator(".ops-group-heading").first();
    expect((await group.locator("th").boundingBox())!.width).toBeGreaterThan(
      (await group.boundingBox())!.width * 0.8,
    );
    await page.screenshot({
      path: `output/seller-ui/today-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
  await page.goto("/seller/customers");
  await expect(
    page.getByRole("button", {
      name: /Tambah pelanggan|Catat pembayaran eksternal/,
    }),
  ).toHaveCount(0);
  await expect(page.locator(".pilot-customer-grid")).toContainText("Nadia");
  await expect(
    page.getByRole("button", { name: "Impor prabayar" }),
  ).toBeVisible();
  for (const action of ["customer.save"]) {
    const response = await page.request.post("/api/v1/commands", {
      data: {
        action,
        payload: { catererId: cid },
        requestId: crypto.randomUUID(),
      },
    });
    expect(response.ok()).toBe(false);
    expect(await response.text()).toContain("NOT_AVAILABLE");
  }
  expect(errors).toEqual([]);
});
