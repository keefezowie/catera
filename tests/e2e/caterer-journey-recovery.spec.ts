import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const cid = "10000000-0000-4000-8000-000000000001";
test.beforeEach(async ({ page }) => {
  expect((await (await page.request.get("/api/v1/me")).json()).data.demo).toBe(
    true,
  );
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
});
for (const locale of ["id", "en"])
  test(`read loading, first failure, retained failure, empty and retry ${locale}`, async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(180000);
    await page
      .context()
      .addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
    await page.setViewportSize({ width: 390, height: 900 });
    for (const [path, resource] of [
      ["", `seller/${cid}**`],
      ["/menus", "menu-month?**"],
      ["/customers", "seller-customers/**"],
      ["/support", "conversations**"],
      ["/transactions", "seller-settlement/**"],
      ["/settings", "payout-setup/**"],
    ]) {
      const pattern = "**/api/v1/" + resource;
      await page.route(pattern, (route) =>
        route.fulfill({
          status: 503,
          json: { error: { code: "REQUEST_FAILED" } },
        }),
      );
      await page.goto("/seller" + path);
      const error = page.locator("main .error-notice:visible").first();
      await expect(error).toBeVisible();
      await page.screenshot({
        path: `output/playwright/journeys/recovery-${locale}-${path.slice(1) || "today"}.png`,
        fullPage: true,
      });
      await page.unroute(pattern);
      await error
        .getByRole("button", {
          name: locale === "id" ? "Coba lagi" : "Try again",
          exact: true,
        })
        .click();
      await expect(page.locator("main .error-notice:visible")).toHaveCount(0);
    }
    await page.goto("/seller/transactions");
    await expect(page.locator(".settlement-summary")).toBeVisible();
    const previous = await page.locator(".settlement-summary").textContent();
    await page.route("**/api/v1/seller-settlement/**", (route) =>
      route.fulfill({
        status: 503,
        json: { error: { code: "REQUEST_FAILED" } },
      }),
    );
    await page
      .getByRole("button", {
        name: locale === "id" ? "Perbarui saldo" : "Refresh balances",
        exact: true,
      })
      .click();
    await expect(
      page.locator(".settlement-screen .error-notice"),
    ).toBeVisible();
    await expect(page.locator(".settlement-summary")).toHaveText(previous!);
    await page.unrouteAll();
    await page.locator(".settlement-screen .error-notice button").click();
    await expect(page.locator(".settlement-screen .error-notice")).toHaveCount(
      0,
    );
    await page.route("**/api/v1/conversations**", (route) =>
      route.fulfill({ json: { data: [] } }),
    );
    await page.goto("/seller/support?tab=messages");
    await expect(
      page.getByRole("link", {
        name: locale === "id" ? "Lihat pelanggan" : "View customers",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(/Explore caterers|Jelajah katerer/),
    ).toHaveCount(0);
    await page.unrouteAll();
    await page.route("**/api/v1/seller-customers/**", (route) =>
      route.fulfill({
        json: { data: { customers: [], total: 0, packages: [] } },
      }),
    );
    await page.goto("/seller/customers");
    await expect(
      page.getByText(
        locale === "id"
          ? "Belum ada pelanggan berlangganan"
          : "No subscribers yet",
        { exact: true },
      ),
    ).toBeVisible();
    await page.goto("/seller/customers?followup=true");
    await expect(
      page.getByText(
        locale === "id"
          ? "Tidak ada pelanggan yang cocok"
          : "No matching customers",
        { exact: true },
      ),
    ).toBeVisible();
    await page.unrouteAll();
  });

test("choice counts stay unknown until data arrives and on first-load error", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "catera_locale", value: "en", url: baseURL! }]);
  const state = (await (await page.request.get(`/api/v1/seller/${cid}`)).json())
    .data;
  let offer = state.offers.find((o: any) => o.menuSelectionMode === "customer");
  if (!offer) {
    const base = state.offers[0];
    const dish = state.dishes.find(
      (d: any) => d.categoryId === "main" && !d.archived,
    );
    const response = await page.request.post("/api/v1/commands", {
      data: {
        action: "package.save",
        requestId: crypto.randomUUID(),
        payload: {
          catererId: cid,
          slug: "journey-loading-" + Date.now(),
          choiceDishIds: [dish.id],
          offer: {
            ...base,
            name: "Synthetic choice recovery",
            menuSelectionMode: "customer",
            packageType: "ala_carte",
            meal: "lunch",
            menus: [
              {
                meal: "lunch",
                contentModel: "slots",
                name: "",
                image: "",
                description: "",
                items: [],
                composition: [
                  { id: "main", categoryId: "main", name: "Lauk", slots: 1 },
                ],
              },
            ],
          },
        },
      },
    });
    expect(response.ok(), await response.text()).toBe(true);
    offer = (await response.json()).data;
  }
  let release!: () => void;
  const delay = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/v1/package-options?**", async (route) => {
    await delay;
    await route.continue();
  });
  await page.goto(`/seller/menus?package=${offer.id}`);
  await expect(page.locator(".choice-active-count")).toHaveText(
    "Loading options…",
  );
  await expect(page.getByText("0 active dishes", { exact: true })).toHaveCount(
    0,
  );
  release();
  await expect(page.locator(".choice-option-card").first()).toBeVisible();
  await page.unrouteAll();
  await page.route("**/api/v1/package-options?**", (route) =>
    route.fulfill({ status: 503, json: { error: { code: "REQUEST_FAILED" } } }),
  );
  await page.reload();
  await expect(page.locator(".choice-active-count")).toHaveText(
    "Count unavailable",
  );
  await expect(page.getByText("No dishes yet.", { exact: true })).toHaveCount(
    0,
  );
  await page.unrouteAll();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".choice-category").first()).toContainText(
    "required slots per meal",
  );
});

test("customer change keeps each type and reason; keyboard returns to selected delivery", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "catera_locale", value: "en", url: baseURL! }]);
  const data = (
    await (await page.request.get(`/api/v1/seller-customers/${cid}`)).json()
  ).data;
  const c = data.customers.find((x: any) => x.name === "Nadia Putri");
  await page.goto(
    `/seller/customers?customerRecordId=${c.id}&deliveryView=list`,
  );
  await page
    .getByRole("button", { name: "Change on request", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  const choose = async (option: string) => {
    await dialog
      .getByRole("combobox", { name: "Change type", exact: true })
      .click();
    await page.getByRole("option", { name: option, exact: true }).click();
  };
  await dialog
    .getByRole("textbox", { name: "Customer request", exact: true })
    .fill("Preserve this customer request");
  await choose("Address");
  await dialog
    .getByRole("textbox", { name: "Delivery address", exact: true })
    .fill("Synthetic retained address 123");
  await choose("Date");
  await choose("Address");
  await expect(
    dialog.getByRole("textbox", { name: "Delivery address", exact: true }),
  ).toHaveValue("Synthetic retained address 123");
  await expect(
    dialog.getByRole("textbox", { name: "Customer request", exact: true }),
  ).toHaveValue("Preserve this customer request");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  const seller = (
    await (await page.request.get(`/api/v1/seller/${cid}`)).json()
  ).data;
  await page.goto(`/seller/schedule?date=${seller.today}`);
  const opener = page.locator("[data-delivery-detail]").first();
  await opener.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/delivery=/);
  await expect(page.locator(".detail-panel")).toBeFocused();
  await page.goBack();
  await expect(opener).toBeFocused();
  await opener.click();
  await page.reload();
  await expect(page.locator(".detail-panel")).toBeVisible();
  await page
    .getByRole("button", { name: "Close details", exact: true })
    .click();
  await expect(opener).toBeFocused();
});

test("verification states are truthful and rejected profile saves preserve data", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "catera_locale", value: "en", url: baseURL! }]);
  const original = (
    await (await page.request.get(`/api/v1/seller/${cid}`)).json()
  ).data;
  for (const [status, text] of [
    ["draft", "Complete your profile"],
    ["submitted", "Catera is reviewing"],
    ["corrections", "Address the notes above"],
    ["approved", "Your profile is approved"],
  ]) {
    await page.route(`**/api/v1/seller/${cid}**`, (route) =>
      route.fulfill({
        json: {
          data: {
            ...original,
            caterer: {
              ...original.caterer,
              status,
              review_note:
                status === "corrections" ? "Synthetic correction note" : null,
            },
          },
        },
      }),
    );
    await page.goto("/seller/profile");
    await expect(page.locator(".verification-help")).toContainText(text);
    await page.unrouteAll();
  }
  await page
    .getByRole("textbox", { name: "Caterer name", exact: true })
    .fill("Synthetic retained profile");
  await page.route("**/api/v1/commands", (route) =>
    route.fulfill({ status: 409, json: { error: { code: "CONFLICT" } } }),
  );
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Caterer name", exact: true }),
  ).toHaveValue("Synthetic retained profile");
  await expect(page.locator(".error-notice")).toBeVisible();
  let savesAfterFailure = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/v1/commands")) savesAfterFailure++;
  });
  const discard = page.getByRole("button", {
    name: "Discard changes",
    exact: true,
  });
  await expect(discard).toHaveAttribute("type", "button");
  page.once("dialog", (dialog) => dialog.accept());
  await discard.click();
  await expect(
    page.getByRole("textbox", { name: "Caterer name", exact: true }),
  ).toHaveValue(original.caterer.name);
  expect(savesAfterFailure).toBe(0);
});

test("200 percent reflow retains usable controls", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "catera_locale", value: "en", url: baseURL! }]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const path of [
    "/packages",
    "/customers",
    "/support",
    "/transactions",
    "/settings",
  ]) {
    await page.goto("/seller" + path);
    await expect(page.locator("main h1")).toBeVisible();
    await page
      .locator("body")
      .evaluate((element) => (element.style.zoom = "2"));
    await page.screenshot({
      path: `output/playwright/journeys/zoom200-${path.slice(1)}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .include("main")
          .withTags(["wcag2a", "wcag2aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
});
