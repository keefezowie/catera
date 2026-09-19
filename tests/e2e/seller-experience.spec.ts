import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { addDays, localDay } from "@catera/domain";
import { pickDate } from "./date-picker";
const cid = "10000000-0000-4000-8000-000000000001";
async function command(page: Page, action: string, payload: unknown) {
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
async function layout(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
for (const locale of ["id", "en"])
  for (const width of [390, 1440])
    test(`seller profile settings and dish draft ${locale} ${width}`, async ({
      page,
      baseURL,
    }) => {
      const t = (id: string, en: string) => (locale === "id" ? id : en),
        errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page
        .context()
        .addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
      await page.setViewportSize({ width, height: 900 });
      await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
      await page.goto("/seller/profile");
      await expect(
        page.getByRole("heading", {
          name: t("Profil katerer", "Caterer profile"),
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByLabel(t("Nama katerer", "Caterer name"), { exact: true }),
      ).toHaveValue("Dapur Senja");
      await layout(page);
      await page.screenshot({
        path: `output/slack-bugs/0017-0027/profile-${width}-${locale}.png`,
        fullPage: true,
      });
      await page.goto("/seller/settings");
      await expect(page.locator("#payout")).toContainText(
        t("Rekening & pencairan", "Bank account & payouts"),
      );
      await expect(
        page.getByRole("button", {
          name: t("Keluar dari sesi ini", "Sign out of this session"),
        }),
      ).toBeVisible();
      await layout(page);
      await page.screenshot({
        path: `output/slack-bugs/0017-0027/settings-${width}-${locale}.png`,
        fullPage: true,
      });
      await page.goto("/seller/settings#verification");
      await expect(page).toHaveURL(/\/seller\/profile#verification$/);
      await page.goto("/seller/menus?library=1");
      await page
        .getByRole("button", {
          name: t("Tambah hidangan", "Add dish"),
          exact: true,
        })
        .click();
      const name = "Synthetic draft " + locale + width + " " + Date.now(),
        category = "Synthetic category " + locale + width + " " + Date.now();
      await page
        .getByLabel(t("Nama hidangan", "Dish name"), { exact: true })
        .fill(name);
      const buffer = await sharp({
        create: { width: 40, height: 40, channels: 3, background: "#ed9747" },
      })
        .png()
        .toBuffer();
      await page.locator(".menu-library input[type=file]").setInputFiles({
        name: "synthetic.png",
        mimeType: "image/png",
        buffer,
      });
      const preview = page.getByRole("button", {
        name: new RegExp(t("Lihat foto:", "Preview photo:")),
      });
      await expect(preview).toBeVisible();
      await page
        .getByRole("button", {
          name: t("Tambah kategori", "Add category"),
          exact: true,
        })
        .click();
      await page
        .getByLabel(t("Nama kategori", "Category name"), { exact: true })
        .fill(category);
      await page
        .getByRole("button", {
          name: t("Simpan kategori", "Save category"),
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("combobox", {
          name: t("Kategori hidangan", "Dish category"),
          exact: true,
        }),
      ).toContainText(category);
      await expect(
        page.getByLabel(t("Nama hidangan", "Dish name"), { exact: true }),
      ).toHaveValue(name);
      await expect(preview).toBeVisible();
      const image = await page
        .locator(".photo-thumbnail img")
        .getAttribute("src");
      await page.locator(".menu-library input[type=file]").setInputFiles({
        name: "invalid.png",
        mimeType: "image/png",
        buffer: Buffer.from("forged invalid image"),
      });
      await expect(
        page.locator(".menu-library").getByRole("alert"),
      ).toContainText(t("File bukan gambar", "The file is not a valid"));
      await expect(page.locator(".photo-thumbnail img")).toHaveAttribute(
        "src",
        image!,
      );
      await layout(page);
      await page.screenshot({
        path: `output/slack-bugs/0017-0027/dish-${width}-${locale}.png`,
        animations: "disabled",
        fullPage: false,
      });
      await page
        .getByRole("button", {
          name: t("Simpan hidangan", "Save dish"),
          exact: true,
        })
        .click();
      await expect(
        page.getByLabel(t("Nama hidangan", "Dish name"), { exact: true }),
      ).toHaveCount(0);
      await page.reload();
      const library = page.getByRole("dialog");
      await library
        .getByLabel(t("Cari hidangan", "Search dishes"), { exact: true })
        .fill(name);
      await expect(
        library.locator(".menu-library-row").filter({ hasText: name }),
      ).toBeVisible();
      expect(errors).toEqual([]);
    });

test("past seller menu dates are disabled for pointer and keyboard", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "catera_locale", value: "en", url: baseURL! }]);
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  await page.goto("/seller/menus");
  await page
    .getByRole("button", { name: "Previous month", exact: true })
    .click();
  await expect(page.locator("button.menu-day").first()).toBeDisabled();
  expect(
    await page
      .locator("button.menu-day")
      .evaluateAll(
        (buttons) =>
          buttons.length > 0 &&
          buttons.every((b) => (b as HTMLButtonElement).disabled),
      ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Previous month", exact: true })
    .focus();
  for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() =>
      document.activeElement?.matches(".menu-day:disabled"),
    ),
  ).toBe(false);
  await page
    .locator("button.menu-day")
    .first()
    .evaluate((b) => (b as HTMLButtonElement).click());
  await expect(page.locator(".menu-editor")).toHaveCount(0);
});

test("owner bank review and account help remain separate from settlement dispatch", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "catera_locale", value: "en", url: baseURL! }]);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  const prior = (
    await (await page.request.get("/api/v1/payout-setup/" + cid)).json()
  ).data.latest;
  if (prior?.status === "submitted") {
    // Recover only this synthetic fixture after an interrupted earlier run.
    expect(prior.bank).toBe("Synthetic Browser Bank");
    await page.request.post("/api/v1/auth/demo", {
      data: { role: "platform_admin" },
    });
    await command(page, "payoutDestination.review", {
      catererId: cid,
      id: prior.id,
      version: prior.version,
      decision: "rejected",
      reason: "Reset interrupted synthetic browser verification",
    });
    await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  }
  await page.goto("/seller/settings");
  const payout = page.locator("#payout");
  await payout
    .getByRole("button", { name: /Set up payout|Change bank account/ })
    .click();
  await page
    .getByLabel("Bank name", { exact: true })
    .fill("Synthetic Browser Bank");
  await page
    .getByLabel("Account holder name", { exact: true })
    .fill("Synthetic Browser Owner");
  await page.getByLabel("Account number", { exact: true }).fill("112233445566");
  await page
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(payout).toContainText("awaiting review");
  const setup = (
    await (await page.request.get("/api/v1/payout-setup/" + cid)).json()
  ).data;
  expect(JSON.stringify(setup)).not.toContain("112233445566");
  expect(setup.dispatchEnabled).toBe(false);
  const helpDetails =
    "Synthetic account deletion assistance only " + Date.now();
  await choose(page, "Request type", "Request account deletion");
  await page
    .locator("#help")
    .getByLabel("Details", { exact: true })
    .fill(helpDetails);
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await expect(
    page.locator("#help .request-row").filter({ hasText: helpDetails }),
  ).toBeVisible();
  await page.request.post("/api/v1/auth/demo", {
    data: { role: "platform_admin" },
  });
  await page.goto("/admin/payouts");
  await page
    .getByRole("button", { name: "Review bank details", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("112233445566");
  await page
    .getByLabel("Verified recipient given name", { exact: true })
    .fill("Synthetic");
  await page
    .getByLabel("Verified recipient surname", { exact: true })
    .fill("Browser Owner");
  await page
    .getByLabel("Verified bank SWIFT code", { exact: true })
    .fill("SYNTHETI");
  await page.getByRole("checkbox").check();
  await page
    .getByLabel("Decision reason", { exact: true })
    .fill("Synthetic browser verification");
  await page
    .getByRole("button", { name: "Save decision", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  await page.goto("/seller/settings");
  await expect(payout).toContainText("•••• 5566");
  await expect(payout).toContainText("Awaiting payout activation");
  await layout(page);
  await page.screenshot({
    path: "output/slack-bugs/0017-0027/payout-approved-390-en.png",
    fullPage: true,
  });
  await page.request.post("/api/v1/auth/demo", { data: { role: "staff" } });
  await page.goto("/seller/settings");
  await expect(page.locator("#payout")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Sign out of this session" }),
  ).toBeVisible();
  await page.goto("/seller/profile");
  await expect(page.getByRole("button", { name: "Save profile" })).toHaveCount(
    0,
  );
  await expect(page.locator("#main")).toContainText("Dapur Senja");
});

test("seller starts messages with subscribed customers", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "catera_locale", value: "en", url: baseURL! }]);
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  const customers = (
    await (await page.request.get("/api/v1/message-customers/" + cid)).json()
  ).data.items;
  const linked = customers.find((c: any) => c.user_id);
  expect(linked).toBeTruthy();
  await page.goto("/seller/support");
  await page
    .getByRole("button", { name: "Start conversation", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Search customers", { exact: true })
    .fill(linked.name);
  await dialog.getByRole("button", { name: linked.name, exact: true }).click();
  await dialog
    .getByLabel("Message", { exact: true })
    .fill("Synthetic first seller message " + Date.now());
  await dialog
    .getByRole("button", { name: "Send first message", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("#main")).toContainText(
    "Synthetic first seller message",
  );
});

test("customer calendar persists address and date changes and retains a failed request", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "catera_locale", value: "en", url: baseURL! }]);
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  const state = (await (await page.request.get("/api/v1/seller/" + cid)).json())
    .data;
  const base = state.offers.find((p: any) => p.meal === "both");
  const name = "Synthetic calendar " + Date.now();
  const offer = await command(page, "package.save", {
    catererId: cid,
    slug: "calendar-customer-" + crypto.randomUUID(),
    offer: { ...base, name, days: 1, flexible: true },
  });
  await page.request.post("/api/v1/auth/demo", { data: { role: "customer" } });
  const buyer = (await (await page.request.get("/api/v1/customer")).json())
    .data;
  const checkout = await command(page, "checkout.create", {
    packageId: offer.id,
    portions: 2,
    startDate: addDays(localDay(), 95),
    addressId: buyer.addresses[0].id,
    trial: false,
    paymentMethod: "qris",
  });
  await command(page, "checkout.demo_pay", { id: checkout.id });
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  const list = (
    await (await page.request.get("/api/v1/seller-customers/" + cid)).json()
  ).data;
  const customer = list.customers.find((c: any) =>
    c.subscriptions.some((s: any) => s.package_id === offer.id),
  );
  expect(customer).toBeTruthy();
  await page.goto("/seller/customers?customerRecordId=" + customer.id);
  const calendar = page.locator(".customer-delivery-calendar");
  await choose(page, "Schedule view", "List");
  await choose(page, "Package", name);
  await choose(page, "Meal period", "Lunch");
  await expect(calendar.locator(".pilot-delivery")).toHaveCount(1);
  await calendar.getByRole("button", { name: "Change on request" }).click();
  await choose(page, "Change type", "Address");
  await page
    .getByLabel("Delivery address", { exact: true })
    .fill("Synthetic updated road 77");
  await page
    .getByLabel("Customer request", { exact: true })
    .fill("Synthetic customer requested address");
  await page.route(
    "**/api/v1/commands",
    (route) =>
      route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "CONFLICT", message: "Synthetic conflict" },
        }),
      }),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Save change", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByLabel("Delivery address", { exact: true }),
  ).toHaveValue("Synthetic updated road 77");
  await page.getByRole("button", { name: "Save change", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(calendar).toContainText("Synthetic updated road 77");
  await expect(
    page.getByRole("combobox", { name: "Package", exact: true }),
  ).toContainText(name);
  await expect(
    page.getByRole("combobox", { name: "Meal period", exact: true }),
  ).toContainText("Lunch");
  await choose(page, "Schedule view", "Calendar");
  const before = (
    await (
      await page.request.get(
        "/api/v1/seller-customers/" + cid + "?customerRecordId=" + customer.id,
      )
    ).json()
  ).data;
  const deliveries = before.customers[0].subscriptions
      .filter((s: any) => s.package_id === offer.id)
      .flatMap((s: any) => s.deliveries),
    first = deliveries.find(
      (d: any) => d.address.line === "Synthetic updated road 77",
    );
  const target = addDays(
    deliveries
      .map((d: any) => d.service_date)
      .sort()
      .at(-1),
    14,
  );
  await calendar.getByRole("button", { name: "Change on request" }).click();
  await choose(page, "Change type", "Date");
  await pickDate(page, "New date", target);
  await page
    .getByLabel("Customer request", { exact: true })
    .fill("Synthetic customer requested date");
  const saved = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/commands") &&
      r.request().postDataJSON()?.action === "customer.deliveryChange",
  );
  await page.route("**/api/v1/seller-customers/**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "REQUEST_FAILED" } }),
    }),
  );
  await page.getByRole("button", { name: "Save change", exact: true }).click();
  const response = await saved;
  expect(response.ok(), await response.text()).toBe(true);
  const result = (await response.json()).data;
  expect(result.id).toBe(first.id);
  expect(result.delivery.service_date).toBe(target);
  expect(result.subscription.ends_on).toBe(target);
  await expect(
    page.getByRole("combobox", { name: "Package", exact: true }),
  ).toContainText(name);
  await expect(
    page.getByRole("combobox", { name: "Meal period", exact: true }),
  ).toContainText("Lunch");
  await expect(calendar.locator(".pilot-delivery")).toContainText(target);
  await expect(calendar.locator(".pilot-delivery")).toContainText(
    "Synthetic updated road 77",
  );
  await expect(page.locator(".pilot-workspace").first()).toContainText(
    "Change saved, but the schedule could not be refreshed.",
  );
  await page.unroute("**/api/v1/seller-customers/**");
  await page.reload();
  await choose(page, "Schedule view", "List");
  await expect(
    calendar.locator(`[data-delivery-id="${first.id}"]`),
  ).toContainText(target);
  await choose(page, "Schedule view", "Calendar");
  await calendar
    .getByRole("button", { name: "Next month", exact: true })
    .click();
  await layout(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await layout(page);
  await page.screenshot({
    path: "output/slack-bugs/0017-0027/customer-390-en.png",
    animations: "disabled",
    fullPage: true,
  });
});
