import { test, expect, type Locator, type Page } from "@playwright/test";
import { offerSchema, type SellerState } from "@catera/domain";

const catererId = "10000000-0000-4000-8000-000000000001";
type Locale = "id" | "en";
const copy = (locale: Locale, id: string, en: string) =>
  locale === "id" ? id : en;
const editor = (page: Page) => page.locator(".package-dialog");
const input = (page: Page, field: string) =>
  editor(page).locator(`[data-editor-field="${field}"] input`).first();

async function authenticate(
  page: Page,
  baseURL: string,
  locale: Locale,
  role = "owner",
) {
  const target = new URL(baseURL);
  expect(
    ["127.0.0.1", "localhost"],
    "This suite writes synthetic fixtures only",
  ).toContain(target.hostname);
  expect((await (await page.request.get("/api/v1/me")).json()).data.demo).toBe(
    true,
  );
  await page
    .context()
    .addCookies([{ name: "catera_locale", value: locale, url: baseURL }]);
  const response = await page.request.post("/api/v1/auth/demo", {
    data: { role },
  });
  expect(response.ok(), await response.text()).toBe(true);
}

async function seller(page: Page): Promise<SellerState> {
  const response = await page.request.get(`/api/v1/seller/${catererId}`);
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()).data;
}

async function command(page: Page, action: string, payload: unknown) {
  const response = await page.request.post("/api/v1/commands", {
    data: { action, payload, requestId: crypto.randomUUID() },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()).data;
}

async function choose(page: Page, control: Locator, option: string | RegExp) {
  await control.click();
  await page
    .getByRole("option", { name: option, exact: typeof option === "string" })
    .click();
}

async function next(page: Page, locale: Locale) {
  await editor(page)
    .getByRole("button", {
      name: copy(locale, "Lanjutkan", "Continue"),
      exact: true,
    })
    .click();
}

async function back(page: Page, locale: Locale) {
  await editor(page)
    .getByRole("button", { name: copy(locale, "Kembali", "Back"), exact: true })
    .click();
}

async function saveDraft(page: Page, locale: Locale) {
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/commands") &&
      r.request().postDataJSON().action === "package.save",
  );
  await editor(page)
    .getByRole("button", {
      name: copy(locale, "Simpan draf", "Save draft"),
      exact: true,
    })
    .click();
  expect((await response).ok()).toBe(true);
  await expect(editor(page)).toHaveCount(0);
}

async function reopen(page: Page, name: string, locale: Locale) {
  await page.reload();
  const card = page
    .locator(".seller-packages > article")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
  await card
    .getByRole("button", {
      name: copy(locale, "Kelola paket", "Manage package"),
      exact: true,
    })
    .click();
  await expect(editor(page)).toBeVisible();
}

async function seedDraft(page: Page, overrides: Record<string, unknown> = {}) {
  const state = await seller(page);
  const template = state.offers.find((offer) => offer.status === "published")!;
  expect(template).toBeTruthy();
  const name = `Synthetic setup ${crypto.randomUUID()}`;
  const offer = {
    ...template,
    name,
    description: "Synthetic package used only for setup verification.",
    status: "draft",
    packageType: "nasi_box",
    menuSelectionMode: "caterer",
    image: "/assets/food/ayam-panggang.png",
    meal: "lunch",
    days: 5,
    price: 42000,
    weekdays: [1, 2, 3, 4, 5],
    capacity: { "1": 37, "2": 37, "3": 37, "4": 37, "5": 37 },
    trialPrice: null,
    trialMax: 2,
    tiers: [],
    nutrition: null,
    durationPricing: {
      revision: 0,
      options: [{ cycles: 1, discountPercent: 0 }],
    },
    menus: [
      {
        meal: "lunch",
        name: "",
        description: "",
        image: "",
        items: [],
        contentModel: "slots",
        composition: [
          {
            id: "main",
            categoryId: "main",
            name: state.categories!.find((category) => category.id === "main")!
              .name,
            slots: 1,
          },
        ],
      },
    ],
    ...overrides,
  };
  const saved = await command(page, "package.save", {
    catererId,
    slug: `setup-${crypto.randomUUID()}`,
    offer: offerSchema.parse(offer),
  });
  return { ...saved, name: offer.name };
}

async function assertLayout(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  const bounds = await editor(page).boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(-1);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width + 1,
  );
}

for (const locale of ["id", "en"] as const) {
  for (const width of [390, 1440]) {
    test(`new package blank commitments persist and can be cleared ${locale} ${width}`, async ({
      page,
      baseURL,
    }) => {
      await authenticate(page, baseURL!, locale);
      await page.setViewportSize({ width, height: 900 });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/seller/packages");
      await page
        .getByRole("button", {
          name: copy(locale, "Buat paket", "Create package"),
          exact: true,
        })
        .click();
      const name = `Synthetic blank ${locale} ${width} ${crypto.randomUUID()}`;
      await choose(
        page,
        editor(page)
          .locator('[data-editor-field="packageType"]')
          .getByRole("combobox"),
        copy(locale, "Nasi box", "Rice box"),
      );
      await input(page, "name").fill(name);
      await editor(page)
        .locator('[data-editor-field="description"] textarea')
        .fill("Synthetic package with explicit price and capacity decisions.");
      await next(page, locale);
      await editor(page)
        .getByRole("button", {
          name: copy(
            locale,
            "Gunakan foto sintetis demo",
            "Use synthetic demo photo",
          ),
          exact: true,
        })
        .click();
      const state = await seller(page);
      const main = state.categories!.find(
        (category) => category.id === "main",
      )!;
      await choose(
        page,
        editor(page).getByRole("combobox", {
          name: copy(
            locale,
            "Tambah kategori ke paket",
            "Add package category",
          ),
          exact: true,
        }),
        locale === "id" ? main.name : main.nameEn || main.name,
      );
      await next(page, locale);
      await expect(input(page, "price")).toHaveValue("");
      await input(page, "price").focus();
      await page.keyboard.press("Tab");
      await expect(input(page, "price")).toHaveValue("");
      await expect(
        editor(page).locator(".package-price-summary strong"),
      ).toHaveText("—");
      await assertLayout(page);
      await page.screenshot({
        path: `output/playwright/caterer-setup/blank-price-${locale}-${width}.png`,
        fullPage: true,
      });
      await saveDraft(page, locale);
      let saved = (await seller(page)).offers.find(
        (offer) => offer.name === name,
      )!;
      expect(saved.price).toBeNull();
      expect(saved.capacity).toEqual({});
      expect(saved.trialPrice).toBeNull();
      expect(saved.status).toBe("draft");

      await reopen(page, name, locale);
      await next(page, locale);
      await next(page, locale);
      await expect(input(page, "price")).toHaveValue("");
      await input(page, "price").fill("47000");
      await next(page, locale);
      await expect(input(page, "capacity")).toHaveValue("");
      await input(page, "capacity").focus();
      await page.keyboard.press("Tab");
      await expect(input(page, "capacity")).toHaveValue("");
      await input(page, "capacity").fill("24");
      await saveDraft(page, locale);
      saved = (await seller(page)).offers.find((offer) => offer.name === name)!;
      expect(saved.price).toBe(47000);
      expect(Object.values(saved.capacity)).toEqual([24, 24, 24, 24, 24]);

      await reopen(page, name, locale);
      await next(page, locale);
      await next(page, locale);
      await expect(input(page, "price")).toHaveValue("47000");
      await next(page, locale);
      await input(page, "capacity").fill("");
      await page.keyboard.press("Tab");
      await expect(input(page, "capacity")).toHaveValue("");
      await back(page, locale);
      await input(page, "price").fill("");
      await page.keyboard.press("Tab");
      await expect(input(page, "price")).toHaveValue("");
      await saveDraft(page, locale);
      saved = (await seller(page)).offers.find((offer) => offer.name === name)!;
      expect(saved.price).toBeNull();
      expect(saved.capacity).toEqual({});
      await reopen(page, name, locale);
      await next(page, locale);
      await next(page, locale);
      await expect(input(page, "price")).toHaveValue("");
      await next(page, locale);
      await expect(input(page, "price")).toBeFocused();
      await expect(editor(page).locator("[data-editor-errors]")).toBeVisible();
      expect(errors).toEqual([]);
    });

    test(`registration suggests an editable address and retains rejected entries ${locale} ${width}`, async ({
      page,
      baseURL,
    }) => {
      await authenticate(page, baseURL!, locale, "customer");
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/seller/onboarding");
      const name = page.getByRole("textbox", {
        name: copy(locale, "Nama katerer", "Caterer name"),
        exact: true,
      });
      const slug = page.getByRole("textbox", {
        name: copy(locale, "Alamat halaman katerer", "Caterer page address"),
        exact: true,
      });
      const description = page.getByRole("textbox", {
        name: copy(locale, "Tentang makananmu", "About your food"),
        exact: true,
      });
      await name.fill("Synthetic Dapur Pertama");
      await expect(slug).toHaveValue("synthetic-dapur-pertama");
      await name.fill("Synthetic Dapur Kedua");
      await expect(slug).toHaveValue("synthetic-dapur-kedua");
      await slug.fill("synthetic-address-owned");
      await name.fill("Synthetic Dapur Ketiga");
      await expect(slug).toHaveValue("synthetic-address-owned");
      await description.fill(
        "Synthetic catering description retained after a rejected save.",
      );
      const area = page.locator('input[name="areas"]').first();
      await area.check();
      let submitted: Record<string, unknown> | undefined;
      await page.route("**/api/v1/commands", async (route) => {
        const body = route.request().postDataJSON();
        if (body.action !== "seller.create") return route.continue();
        submitted = body.payload;
        return route.fulfill({
          status: 409,
          json: { error: { code: "CONFLICT" } },
        });
      });
      await page
        .getByRole("button", {
          name: copy(locale, "Buat profil katerer", "Create caterer profile"),
          exact: true,
        })
        .click();
      await expect(page.locator(".error-notice[role=alert]")).toBeVisible();
      await expect(name).toHaveValue("Synthetic Dapur Ketiga");
      await expect(slug).toHaveValue("synthetic-address-owned");
      await expect(description).toHaveValue(
        "Synthetic catering description retained after a rejected save.",
      );
      await expect(area).toBeChecked();
      expect(submitted).toMatchObject({
        name: "Synthetic Dapur Ketiga",
        slug: "synthetic-address-owned",
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
    });
  }
}

test("the authenticated API rejects publication with missing commercial commitments", async ({
  page,
  baseURL,
}) => {
  await authenticate(page, baseURL!, "en");
  const created = await seedDraft(page, { price: null, capacity: {} });
  const persisted = (await seller(page)).offers.find(
    (offer) => offer.id === created.id,
  )!;
  for (const changes of [
    { price: null, capacity: { "1": 24, "2": 24, "3": 24, "4": 24, "5": 24 } },
    { price: 42000, capacity: {} },
  ]) {
    const response = await page.request.post("/api/v1/commands", {
      data: {
        action: "package.save",
        requestId: crypto.randomUUID(),
        payload: {
          catererId,
          id: persisted.id,
          version: persisted.version,
          slug: persisted.slug,
          offer: { ...persisted, ...changes, status: "published" },
        },
      },
    });
    expect(response.ok()).toBe(false);
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
    expect(
      (await seller(page)).offers.find((offer) => offer.id === created.id)
        ?.status,
    ).toBe("draft");
  }
});

test("existing optional settings survive editor open and explicit save", async ({
  page,
  baseURL,
}) => {
  await authenticate(page, baseURL!, "en");
  const created = await seedDraft(page, {
    trialPrice: 43000,
    trialMax: 3,
    tiers: [{ min: 3, percent: 5 }],
    durationPricing: {
      revision: 0,
      options: [
        { cycles: 1, discountPercent: 0 },
        { cycles: 2, discountPercent: 7 },
      ],
    },
    nutrition: { caloriesKcal: 600, proteinG: 30 },
  });
  const original = (await seller(page)).offers.find(
    (offer) => offer.id === created.id,
  )!;
  await page.goto("/seller/packages");
  await reopen(page, created.name, "en");
  await next(page, "en");
  await next(page, "en");
  await expect(input(page, "price")).toHaveValue("42000");
  await expect(
    editor(page).locator('[data-editor-field="trialPrice"] input'),
  ).toHaveValue("43000");
  const duration = editor(page)
    .locator("details.optional-section")
    .filter({
      has: page
        .locator("summary")
        .filter({ hasText: "Additional durations (optional)" }),
    });
  await expect(duration).toHaveAttribute("open", "");
  await expect(
    editor(page)
      .locator("details.optional-section")
      .filter({ hasText: "One-day trial" }),
  ).toHaveAttribute("open", "");
  await saveDraft(page, "en");
  const after = (await seller(page)).offers.find(
    (offer) => offer.id === created.id,
  )!;
  for (const field of [
    "price",
    "capacity",
    "trialPrice",
    "trialMax",
    "tiers",
    "durationPricing",
    "nutrition",
  ] as const)
    expect(after[field], field).toEqual(original[field]);
});

test("an existing unlimited trial stays unlimited after blur, review and save", async ({
  page,
  baseURL,
}) => {
  await authenticate(page, baseURL!, "en");
  const created = await seedDraft(page, { trialPrice: 43000, trialMax: null });
  await page.goto("/seller/packages");
  await reopen(page, created.name, "en");
  await next(page, "en");
  await next(page, "en");
  const trial = editor(page)
    .locator("details.optional-section")
    .filter({ hasText: "One-day trial" });
  await expect(trial.locator("summary")).toContainText("No quantity limit");
  await expect(input(page, "trialMax")).toHaveValue("");
  await input(page, "trialMax").focus();
  await page.keyboard.press("Tab");
  await expect(input(page, "trialMax")).toHaveValue("");
  await next(page, "en");
  await next(page, "en");
  await expect(editor(page)).toContainText("No quantity limit");
  await saveDraft(page, "en");
  expect(
    (await seller(page)).offers.find((offer) => offer.id === created.id),
  ).toMatchObject({ trialPrice: 43000, trialMax: null });
});

test("keyboard disclosure reveals invalid optional nutrition and recovers without losing entries", async ({
  page,
  baseURL,
}) => {
  await authenticate(page, baseURL!, "en");
  const created = await seedDraft(page);
  await page.goto("/seller/packages");
  await reopen(page, created.name, "en");
  await next(page, "en");
  const disclosure = editor(page)
    .locator("details.optional-section")
    .filter({ has: page.locator(".package-nutrition") });
  const summary = disclosure.locator("summary");
  await expect(disclosure).not.toHaveAttribute("open", "");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(disclosure).toHaveAttribute("open", "");
  const minimum = disclosure.getByRole("spinbutton", {
    name: "Protein · fixed or minimum value (g)",
    exact: true,
  });
  const maximum = disclosure.getByRole("spinbutton", {
    name: "Protein · optional maximum value (g)",
    exact: true,
  });
  await minimum.fill("50");
  await maximum.fill("30");
  await summary.click();
  await expect(disclosure).not.toHaveAttribute("open", "");
  await next(page, "en");
  await expect(disclosure).toHaveAttribute("open", "");
  await expect(editor(page).locator("[data-editor-errors]")).toBeVisible();
  await expect(minimum).toHaveValue("50");
  await expect(maximum).toHaveValue("30");
  expect(
    await disclosure
      .locator("input")
      .evaluateAll((inputs) =>
        inputs.includes(document.activeElement as HTMLInputElement),
      ),
  ).toBe(true);
  await maximum.fill("60");
  await next(page, "en");
  await expect(input(page, "price")).toHaveValue("42000");
  await saveDraft(page, "en");
  expect(
    (await seller(page)).offers.find((offer) => offer.id === created.id)
      ?.nutrition,
  ).toMatchObject({ proteinG: { min: 50, max: 60 } });
});

test("failed draft save retains the edited price and permits an explicit retry", async ({
  page,
  baseURL,
}) => {
  await authenticate(page, baseURL!, "en");
  await page.setViewportSize({ width: 390, height: 900 });
  const created = await seedDraft(page);
  await page.goto("/seller/packages");
  await reopen(page, created.name, "en");
  await next(page, "en");
  await next(page, "en");
  await input(page, "price").fill("51000");
  let failed = false;
  await page.route("**/api/v1/commands", async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "package.save" && !failed) {
      failed = true;
      return route.fulfill({
        status: 503,
        json: { error: { code: "INTERNAL" } },
      });
    }
    return route.continue();
  });
  await editor(page)
    .getByRole("button", { name: "Save draft", exact: true })
    .click();
  await expect(editor(page).locator(".error-notice[role=alert]")).toBeVisible();
  await expect(input(page, "price")).toHaveValue("51000");
  expect(
    (await seller(page)).offers.find((offer) => offer.id === created.id)?.price,
  ).toBe(42000);
  await saveDraft(page, "en");
  expect(
    (await seller(page)).offers.find((offer) => offer.id === created.id)?.price,
  ).toBe(51000);
});

for (const [locale, width] of [
  ["id", 390],
  ["en", 1440],
] as const) {
  test(`inline choice dish retries while package edits remain unsaved ${locale} ${width}`, async ({
    page,
    baseURL,
  }) => {
    await authenticate(page, baseURL!, locale);
    await page.setViewportSize({ width, height: 900 });
    const created = await seedDraft(page);
    const state = await seller(page);
    const main = state.categories!.find((category) => category.id === "main")!;
    await page.goto("/seller/packages");
    await reopen(page, created.name, locale);
    const changedName = `${created.name} edited`;
    await input(page, "name").fill(changedName);
    await next(page, locale);
    const choices = editor(page)
      .locator("details.optional-section")
      .filter({
        hasText: copy(
          locale,
          "Pilihan menu pelanggan (opsional)",
          "Customer menu choices (optional)",
        ),
      });
    await choices.locator("summary").click();
    await choose(
      page,
      choices.getByRole("combobox"),
      copy(
        locale,
        "Pelanggan · Pilih menu sendiri",
        "Customer · Choose your menu",
      ),
    );
    await choices
      .getByRole("button", {
        name: copy(locale, "Buat hidangan", "Create dish"),
        exact: true,
      })
      .click();
    const dishDialog = page.getByRole("dialog", {
      name: copy(locale, "Buat hidangan", "Create dish"),
      exact: true,
    });
    await expect(dishDialog).toBeVisible();
    const dishName = `Synthetic choice ${crypto.randomUUID()}`;
    await choose(
      page,
      dishDialog.getByRole("combobox", {
        name: copy(locale, "Kategori hidangan", "Dish category"),
        exact: true,
      }),
      locale === "id" ? main.name : main.nameEn || main.name,
    );
    const dishNameInput = dishDialog.getByRole("textbox", {
      name: copy(locale, "Nama hidangan", "Dish name"),
      exact: true,
    });
    await dishNameInput.fill(dishName);
    let firstAttempt = true;
    await page.route("**/api/v1/commands", async (route) => {
      if (
        route.request().postDataJSON().action === "dish.save" &&
        firstAttempt
      ) {
        firstAttempt = false;
        return route.fulfill({
          status: 409,
          json: { error: { code: "CONFLICT" } },
        });
      }
      return route.continue();
    });
    await dishDialog
      .getByRole("button", {
        name: copy(locale, "Simpan hidangan", "Save dish"),
        exact: true,
      })
      .click();
    await expect(dishDialog.locator(".error-notice[role=alert]")).toBeVisible();
    await expect(dishNameInput).toHaveValue(dishName);
    const savedResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/commands") &&
        response.request().postDataJSON().action === "dish.save",
    );
    await dishDialog
      .getByRole("button", {
        name: copy(locale, "Simpan hidangan", "Save dish"),
        exact: true,
      })
      .click();
    const savedDish = (await (await savedResponse).json()).data;
    await expect(dishDialog).toHaveCount(0);
    await expect(
      choices.getByRole("checkbox", { name: new RegExp(dishName) }),
    ).toBeChecked();
    expect(
      (await seller(page)).offers.find((offer) => offer.id === created.id)
        ?.name,
    ).toBe(created.name);
    await back(page, locale);
    await expect(input(page, "name")).toHaveValue(changedName);
    await next(page, locale);
    await expect(
      choices.getByRole("checkbox", { name: new RegExp(dishName) }),
    ).toBeChecked();
    await saveDraft(page, locale);
    expect(
      (await seller(page)).offers.find((offer) => offer.id === created.id)
        ?.name,
    ).toBe(changedName);
    const options = (
      await (
        await page.request.get(
          `/api/v1/package-options?packageId=${created.id}`,
        )
      ).json()
    ).data;
    expect(
      options.some(
        (option: { sourceDishId: string }) =>
          option.sourceDishId === savedDish.id,
      ),
    ).toBe(true);
  });
}

test("an inline dish outside the package categories saves to the library without a hidden selection", async ({
  page,
  baseURL,
}) => {
  await authenticate(page, baseURL!, "en");
  const created = await seedDraft(page);
  const state = await seller(page);
  const otherCategory = state.categories!.find(
    (category) => category.id !== "main",
  )!;
  expect(otherCategory).toBeTruthy();
  await page.goto("/seller/packages");
  await reopen(page, created.name, "en");
  const editedName = `${created.name} changed`;
  await input(page, "name").fill(editedName);
  await next(page, "en");
  const choices = editor(page)
    .locator("details.optional-section")
    .filter({ hasText: "Customer menu choices (optional)" });
  await choices.locator("summary").click();
  await choose(
    page,
    choices.getByRole("combobox"),
    "Customer · Choose your menu",
  );
  await choices
    .getByRole("button", { name: "Create dish", exact: true })
    .click();
  const dishDialog = page.getByRole("dialog", {
    name: "Create dish",
    exact: true,
  });
  await choose(
    page,
    dishDialog.getByRole("combobox", { name: "Dish category", exact: true }),
    otherCategory.nameEn || otherCategory.name,
  );
  const dishName = `Synthetic other category ${crypto.randomUUID()}`;
  await dishDialog
    .getByRole("textbox", { name: "Dish name", exact: true })
    .fill(dishName);
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/commands") &&
      r.request().postDataJSON().action === "dish.save",
  );
  await dishDialog
    .getByRole("button", { name: "Save dish", exact: true })
    .click();
  const savedDish = (await (await response).json()).data;
  await expect(dishDialog).toHaveCount(0);
  await expect(choices.getByRole("status")).toHaveText(
    "Dish saved to the library. Its category is not in the package contents, so it has not been selected for this package.",
  );
  await expect(
    choices.getByRole("checkbox", { name: new RegExp(dishName) }),
  ).toHaveCount(0);
  await expect(choices.locator('input[type="checkbox"]:checked')).toHaveCount(
    0,
  );
  await saveDraft(page, "en");
  const savedState = await seller(page);
  expect(savedState.offers.find((offer) => offer.id === created.id)?.name).toBe(
    editedName,
  );
  expect(
    savedState.dishes?.find((dish) => dish.id === savedDish.id),
  ).toMatchObject({ name: dishName, categoryId: otherCategory.id });
  const options = (
    await (
      await page.request.get(`/api/v1/package-options?packageId=${created.id}`)
    ).json()
  ).data;
  expect(
    options.some(
      (option: { sourceDishId: string }) =>
        option.sourceDishId === savedDish.id,
    ),
  ).toBe(false);
});

test("review explains the total, supports correction and publishes only on explicit action", async ({
  page,
  baseURL,
}) => {
  await authenticate(page, baseURL!, "en");
  const created = await seedDraft(page);
  await page.goto("/seller/packages");
  await reopen(page, created.name, "en");
  for (let step = 0; step < 4; step++) await next(page, "en");
  await expect(editor(page).locator(".package-review-summary")).toContainText(
    /210[,.]000/,
  );
  await expect(
    editor(page).getByRole("combobox", { name: "Offer status" }),
  ).toHaveCount(0);
  await expect(
    editor(page).getByRole("button", { name: "Save draft", exact: true }),
  ).toBeVisible();
  const fullPreview = editor(page)
    .locator("details.optional-section")
    .filter({ hasText: "Customer preview" });
  await expect(fullPreview).not.toHaveAttribute("open", "");
  await editor(page)
    .getByRole("button", { name: "Edit Price & package length", exact: true })
    .click();
  await input(page, "price").fill("46000");
  await next(page, "en");
  await next(page, "en");
  await expect(editor(page).locator(".package-review-summary")).toContainText(
    /230[,.]000/,
  );
  expect(
    (await seller(page)).offers.find((offer) => offer.id === created.id)
      ?.status,
  ).toBe("draft");
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/commands") &&
      r.request().postDataJSON().action === "package.save",
  );
  await editor(page)
    .getByRole("button", { name: "Publish package", exact: true })
    .click();
  expect((await response).ok()).toBe(true);
  await expect(editor(page)).toHaveCount(0);
  expect(
    (await seller(page)).offers.find((offer) => offer.id === created.id),
  ).toMatchObject({ status: "published", price: 46000 });
  await expect(
    page.getByRole("link", { name: "Open package menus", exact: true }),
  ).toHaveAttribute("href", `/seller/menus?package=${created.id}`);
});

for (const locale of ["id", "en"] as const) {
  test(`partial draft details distinguish missing commitments from zero ${locale}`, async ({
    page,
    baseURL,
  }) => {
    await authenticate(page, baseURL!, locale);
    const created = await seedDraft(page, { price: null, capacity: {} });
    await page.goto(`/seller/packages?package=${created.id}`);
    const details = page.getByRole("dialog", {
      name: created.name,
      exact: true,
    });
    await expect(details).toContainText(
      copy(locale, "Harga belum diisi", "Price not entered"),
    );
    await expect(details).toContainText(
      copy(locale, "Total belum tersedia", "Total not available yet"),
    );
    await expect(details).toContainText(
      copy(locale, "Kapasitas belum diisi", "Capacity not entered"),
    );
    await page.keyboard.press("Escape");
    const zero = await seedDraft(page, {
      capacity: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
    });
    await page.goto(`/seller/packages?package=${zero.id}`);
    const zeroDetails = page.getByRole("dialog", {
      name: zero.name,
      exact: true,
    });
    await expect(zeroDetails).toContainText(
      copy(locale, "0 porsi", "0 portions"),
    );
    await expect(zeroDetails).not.toContainText(
      copy(locale, "Kapasitas belum diisi", "Capacity not entered"),
    );
  });

  test(`readiness names the next useful action and distinguishes pending sales ${locale}`, async ({
    page,
    baseURL,
  }) => {
    await authenticate(page, baseURL!, locale);
    await page.setViewportSize({
      width: locale === "id" ? 390 : 1440,
      height: 900,
    });
    const original = await seller(page);
    const template = original.offers.find(
      (offer) => offer.status === "published",
    )!;
    const partial = { ...template, status: "draft", price: null, capacity: {} };
    const scenarios = [
      {
        status: "draft",
        description: "",
        offers: [],
        action: copy(locale, "Lengkapi profil", "Complete your profile"),
        href: "/seller/profile",
      },
      {
        status: "draft",
        offers: [],
        action: copy(locale, "Buat paket pertama", "Create your first package"),
        href: "/seller/packages?new=1",
      },
      {
        status: "draft",
        offers: [partial],
        action: copy(locale, "Ajukan verifikasi", "Request verification"),
        href: "/seller/profile#verification",
        state: copy(locale, "Draf paket tersimpan", "Package draft saved"),
      },
      {
        status: "submitted",
        offers: [partial],
        action: copy(
          locale,
          "Lanjutkan draf paket",
          "Continue your package draft",
        ),
        href: `/seller/packages?edit=${partial.id}`,
        state: copy(
          locale,
          "Menunggu verifikasi katerer",
          "Awaiting caterer verification",
        ),
      },
      {
        status: "corrections",
        offers: [partial],
        action: copy(
          locale,
          "Periksa catatan perbaikan",
          "Review requested changes",
        ),
        href: "/seller/profile#verification",
        state: copy(locale, "Perlu perbaikan", "Changes requested"),
      },
      {
        status: "submitted",
        offers: [template],
        action: copy(
          locale,
          "Lihat status verifikasi",
          "View verification status",
        ),
        href: "/seller/profile#verification",
        state: copy(
          locale,
          "Paket tayang, menunggu persetujuan katerer",
          "Published, awaiting caterer approval",
        ),
      },
      {
        status: "suspended",
        offers: [template],
        action: copy(locale, "Lihat status katerer", "View caterer status"),
        href: "/seller/profile#verification",
        state: copy(locale, "Penjualan ditangguhkan", "Sales paused"),
      },
    ];
    let active = scenarios[0];
    await page.route(`**/api/v1/seller/${catererId}**`, (route) =>
      route.fulfill({
        json: {
          data: {
            ...original,
            caterer: {
              ...original.caterer,
              status: active.status,
              description: active.description ?? original.caterer.description,
              review_note:
                active.status === "corrections"
                  ? "Synthetic correction note"
                  : null,
            },
            offers: active.offers,
          },
        },
      }),
    );
    for (const scenario of scenarios) {
      active = scenario;
      await page.goto("/seller/packages");
      const readiness = page.locator(".seller-readiness");
      await expect(readiness.locator(".seller-readiness-next")).toHaveText(
        scenario.action,
      );
      await expect(readiness.locator(".seller-readiness-next")).toHaveAttribute(
        "href",
        scenario.href,
      );
      if (scenario.state)
        await expect(readiness.locator(".seller-readiness-state")).toHaveText(
          scenario.state,
        );
      await expect(
        readiness.locator(".seller-readiness-checklist"),
      ).not.toHaveAttribute("open", "");
      await readiness.locator(".seller-readiness-checklist summary").focus();
      await page.keyboard.press("Enter");
      await expect(readiness).toContainText(
        copy(
          locale,
          "Aktivasi pencairan diperiksa terpisah di Pengaturan.",
          "Payout activation is checked separately in Settings.",
        ),
      );
      if (scenario.status === "corrections")
        await expect(readiness).toContainText("Synthetic correction note");
    }
    await page.unrouteAll();
    await page.route(`**/api/v1/seller/${catererId}**`, (route) =>
      route.fulfill({
        json: {
          data: {
            ...original,
            caterer: { ...original.caterer, status: "approved" },
            offers: [template],
          },
        },
      }),
    );
    await page.goto("/seller/packages");
    await expect(page.locator(".seller-readiness")).toHaveCount(0);
  });
}
