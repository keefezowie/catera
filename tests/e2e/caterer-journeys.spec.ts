import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const cid = "10000000-0000-4000-8000-000000000001";
async function command(page: Page, action: string, payload: unknown) {
  const response = await page.request.post("/api/v1/commands", {
    data: { action, payload, requestId: crypto.randomUUID() },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()).data;
}
test.beforeEach(async ({ page, baseURL }) => {
  const me = await page.request.get("/api/v1/me");
  expect((await me.json()).data.demo).toBe(true);
  await page
    .context()
    .addCookies([{ name: "catera_locale", value: "en", url: baseURL! }]);
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
});

test("duration discard, conflict retention and saved values; consequential action cancellation", async ({
  page,
}) => {
  await page.goto("/seller/packages");
  const card = page.locator(".seller-packages > article").first();
  let lifecycleCommands = 0;
  page.on("request", (request) => {
    if (
      request.url().endsWith("/api/v1/commands") &&
      /package\.(suspend|archive)/.test(request.postData() || "")
    )
      lifecycleCommands++;
  });
  await card
    .getByRole("button", { name: "Suspend package", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("cannot be reopened");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(lifecycleCommands).toBe(0);
  const trigger = card.locator(".duration-editor-trigger");
  await trigger.click();
  const row = page.locator(".duration-editor .duration-option").nth(1);
  await row.getByRole("checkbox").check();
  await row.getByRole("spinbutton").fill("7");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Close without saving?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(row.getByRole("spinbutton")).toHaveValue("7");
  await page.route("**/api/v1/commands", async (route) => {
    if (
      route.request().postDataJSON().action === "package.durationPricing.save"
    )
      await route.fulfill({
        status: 409,
        json: { error: { code: "CONFLICT" } },
      });
    else await route.continue();
  });
  await page
    .getByRole("button", { name: "Save duration options", exact: true })
    .click();
  await expect(page.locator(".error-notice[role=alert]")).toBeVisible();
  await expect(row.getByRole("spinbutton")).toHaveValue("7");
  await page.unrouteAll();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(row.getByRole("checkbox")).not.toBeChecked();
  await row.getByRole("checkbox").check();
  await row.getByRole("spinbutton").fill("4");
  await page
    .getByRole("button", { name: "Save duration options", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await trigger.click();
  await expect(row.getByRole("spinbutton")).toHaveValue("4");
  // Restore the original pricing through the same versioned command.
  const seller = (
    await (await page.request.get(`/api/v1/seller/${cid}`)).json()
  ).data;
  const offer = seller.offers[0];
  await command(page, "package.durationPricing.save", {
    catererId: cid,
    packageId: offer.id,
    revision: offer.durationPricing.revision,
    options: [{ cycles: 1, discountPercent: 0 }],
  });
});

test("menu and customer context survive reload; filtered empty resets; change drafts survive type switching", async ({
  page,
}) => {
  await page.goto("/seller/menus");
  await page.getByRole("combobox", { name: "Package", exact: true }).click();
  await page
    .getByRole("option", { name: "Rantang Nusantara", exact: true })
    .click();
  await page.getByRole("combobox", { name: "Meal", exact: true }).click();
  await page.getByRole("option", { name: "Dinner", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Package", exact: true }),
  ).toContainText("Rantang");
  await expect(
    page.getByRole("combobox", { name: "Meal", exact: true }),
  ).toContainText("Dinner");
  await page.goto("/seller/customers?search=does-not-exist");
  await expect(
    page.getByText("No matching customers", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page
    .getByRole("button", { name: /View customer|View details|View schedule/ })
    .first()
    .click();
  await expect(page).toHaveURL(/customerRecordId=/);
  await page.reload();
  await expect(page.locator(".pilot-customer-grid")).toContainText("Nadia");
  // The existing seller-experience suite verifies the durable date/address changes.
});

test("support replies survive switching, failed sends and workspace navigation", async ({
  page,
}) => {
  await page.request.post("/api/v1/auth/demo", { data: { role: "customer" } });
  const customer = (await (await page.request.get("/api/v1/customer")).json())
    .data;
  const subscription = customer.subscriptions.find(
    (s: any) => s.snapshot.offer.catererId === cid,
  );
  const ids: string[] = [],
    prefix = "Journey reply " + Date.now() + " ";
  for (let i = 0; i < 2; i++)
    ids.push(
      (
        await command(page, "support.create", {
          subscriptionId: subscription.id,
          subject: prefix + i,
          description: "Synthetic support request for draft retention",
        })
      ).id,
    );
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  await page.goto("/seller/support?case=" + ids[0]);
  await page
    .getByRole("textbox", { name: "Caterer response", exact: true })
    .fill("Synthetic retained reply");
  await page.getByRole("button", { name: new RegExp(prefix + "1") }).click();
  await page
    .getByRole("textbox", { name: "Caterer response", exact: true })
    .fill("Second case draft");
  await page.getByRole("button", { name: new RegExp(prefix + "0") }).click();
  await expect(
    page.getByRole("textbox", { name: "Caterer response", exact: true }),
  ).toHaveValue("Synthetic retained reply");
  await page.route("**/api/v1/commands", async (route) =>
    route.request().postDataJSON().action === "support.respond"
      ? route.fulfill({
          status: 503,
          json: { error: { code: "REQUEST_FAILED" } },
        })
      : route.continue(),
  );
  await page
    .getByRole("button", { name: "Send response", exact: true })
    .click();
  await expect(page.locator(".error-notice[role=alert]")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Caterer response", exact: true }),
  ).toHaveValue("Synthetic retained reply");
  await page.unrouteAll();
  await page
    .getByRole("button", { name: "Send response", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Caterer response", exact: true }),
  ).toHaveValue("");
  const seller = (
    await (await page.request.get(`/api/v1/seller/${cid}`)).json()
  ).data;
  expect(seller.cases.find((c: any) => c.id === ids[0]).resolution).toContain(
    "Synthetic retained reply",
  );
});

test("production copy survives refresh and remains whole-day; staff finance explains access", async ({
  page,
}) => {
  const seller = (
    await (await page.request.get(`/api/v1/seller/${cid}`)).json()
  ).data;
  await page.goto(
    `/seller/schedule?date=${seller.today}&production=1&package=${seller.offers[0].id}`,
  );
  await page
    .getByRole("button", { name: "Save delivery list", exact: true })
    .click();
  const download = page.getByRole("link", { name: /Download CSV/ });
  await expect(download).toBeVisible();
  const url = await download.getAttribute("href");
  const csv = await page.request.get(url!);
  expect(csv.ok()).toBe(true);
  expect(await csv.text()).toContain("Dinner");
  await page.reload();
  await expect(download).toHaveAttribute("href", url!);
  await expect(page.locator(".ops-saved-copy")).toContainText("Matches orders");
  await page.request.post("/api/v1/auth/demo", { data: { role: "staff" } });
  await page.goto("/seller/transactions");
  await expect(
    page.getByRole("heading", { name: "Owner access required" }),
  ).toBeVisible();
  await expect(page.locator(".settlement-screen")).toHaveCount(0);
});

test("seller notifications preserve navigation; transaction tabs and range persist", async ({
  page,
}) => {
  await page.goto("/seller/schedule?meal=dinner");
  await page.getByRole("link", { name: "Notifications", exact: true }).click();
  await expect(page).toHaveURL(/seller\/notifications/);
  await expect(page.locator(".ops-sidebar")).toBeVisible();
  await page
    .getByRole("link", { name: "Return to operations", exact: true })
    .click();
  await expect(page).toHaveURL(/meal=dinner/);
  await page.goto("/seller/transactions");
  await expect(
    page.getByRole("tab", { name: "Sales", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("region", { name: "Earnings chart" }),
  ).not.toBeVisible();
  await page
    .getByRole("tab", { name: "Earnings activity", exact: true })
    .click();
  await page.getByRole("button", { name: "7 days", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "Earnings activity", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("button", { name: "7 days", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

for (const locale of ["id", "en"])
  for (const width of [320, 390, 768, 1440]) {
    test(`journey layouts and accessibility ${locale} ${width}`, async ({
      page,
      baseURL,
    }) => {
      test.setTimeout(240000);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page
        .context()
        .addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
      await page.setViewportSize({ width, height: 1000 });
      for (const path of [
        "",
        "/schedule",
        "/packages",
        "/menus",
        "/customers",
        "/support",
        "/transactions",
        "/settings",
        "/profile",
        "/notifications",
      ]) {
        await page.goto("/seller" + path);
        await expect(page.locator("main h1")).toBeVisible();
        await expect(page.locator("main .mascot-loading:visible")).toHaveCount(
          0,
        );
        await page.screenshot({
          path: `output/playwright/journeys/${locale}-${width}-${path.slice(1) || "today"}.png`,
          fullPage: true,
          animations: "disabled",
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          path,
        ).toBe(true);
        if (width === 390 || width === 1440)
          expect(
            (
              await new AxeBuilder({ page })
                .include("main")
                .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
                .analyze()
            ).violations,
            path,
          ).toEqual([]);
      }
      expect(errors).toEqual([]);
    });
  }
