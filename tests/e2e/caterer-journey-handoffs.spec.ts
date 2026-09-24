import { test, expect, type Page } from "@playwright/test";
import { addDays, localDay, offerSchema } from "@catera/domain";
import { mkdir } from "node:fs/promises";
const cid = "10000000-0000-4000-8000-000000000001";
async function command(page: Page, action: string, payload: unknown) {
  if (action === "package.save") {
    const checked = offerSchema.safeParse(
      (payload as { offer: unknown }).offer,
    );
    expect(checked.success, JSON.stringify(checked.error?.issues)).toBe(true);
  }
  const response = await page.request.post("/api/v1/commands", {
    data: { action, payload, requestId: crypto.randomUUID() },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()).data;
}
test.beforeEach(async ({ page, baseURL }) => {
  expect((await (await page.request.get("/api/v1/me")).json()).data.demo).toBe(
    true,
  );
  await page
    .context()
    .addCookies([{ name: "catera_locale", value: "en", url: baseURL! }]);
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
});
test("all package modes expose commercial terms; confirmed lifecycle persists once", async ({
  page,
}) => {
  test.setTimeout(180000);
  const state = (await (await page.request.get(`/api/v1/seller/${cid}`)).json())
    .data;
  const base = state.offers.find((o: any) => o.status === "published");
  const dish = state.dishes.find(
    (d: any) => d.categoryId === "main" && !d.archived,
  );
  const created = [];
  for (const packageType of ["nasi_box", "ala_carte"])
    for (const menuSelectionMode of ["caterer", "customer"])
      for (const meal of ["lunch", "dinner", "both"]) {
        const name = `Journey ${packageType} ${menuSelectionMode} ${meal} ${Date.now()}`;
        const offer = await command(page, "package.save", {
          catererId: cid,
          slug: "journey-" + crypto.randomUUID(),
          choiceDishIds:
            menuSelectionMode === "customer" ? [dish.id] : undefined,
          offer: {
            ...base,
            name,
            packageType,
            menuSelectionMode,
            meal,
            days: 2,
            weekdays: [0, 1, 2, 3, 4, 5, 6],
            capacity: Object.fromEntries(
              [0, 1, 2, 3, 4, 5, 6].map((day) => [day, 100]),
            ),
            menus: (meal === "both" ? ["lunch", "dinner"] : [meal]).map(
              (meal) => ({
                meal,
                name: "",
                description: "",
                image: "",
                contentModel: "slots",
                items: [],
                composition: [
                  {
                    id: "main",
                    categoryId: "main",
                    name: state.categories.find(
                      (category: any) => category.id === "main",
                    ).name,
                    slots: 1,
                  },
                ],
              }),
            ),
          },
        });
        created.push({ ...offer, name });
        await page.goto(`/seller/packages?package=${offer.id}`);
        const dialog = page.getByRole("dialog");
        await expect(dialog).toContainText("Operating days & capacity");
        await expect(dialog).toContainText("Asia/Jakarta");
        await expect(
          dialog.locator("dt").filter({ hasText: /^Lunch$/ }),
        ).toHaveCount(meal === "dinner" ? 0 : 1);
        await expect(
          dialog.locator("dt").filter({ hasText: /^Dinner$/ }),
        ).toHaveCount(meal === "lunch" ? 0 : 1);
        await page.keyboard.press("Escape");
      }
  const target = created[0];
  const initial = (
    await (await page.request.get(`/api/v1/seller/${cid}`)).json()
  ).data.offers.find((o: any) => o.id === target.id);
  const card = page.locator(".seller-packages article").filter({
    has: page.getByRole("heading", { name: target.name, exact: true }),
  });
  await card
    .getByRole("button", { name: "Suspend package", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(target.name);
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/commands") &&
      r.request().postDataJSON().action === "package.suspend",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Suspend package", exact: true })
    .dblclick();
  expect((await response).ok()).toBe(true);
  await expect(
    card.getByRole("button", { name: "Archive package", exact: true }),
  ).toBeEnabled();
  await card
    .getByRole("button", { name: "Archive package", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Archive package", exact: true })
    .click();
  await page.reload();
  const saved = (
    await (await page.request.get(`/api/v1/seller/${cid}`)).json()
  ).data.offers.find((o: any) => o.id === target.id);
  expect(saved.status).toBe("retired");
  expect(saved.version).toBe(initial.version + 2);
});
test("notification read failures recover inside seller navigation", async ({
  page,
}) => {
  const state = (await (await page.request.get("/api/v1/customer")).json())
    .data;
  const id = crypto.randomUUID();
  let read = false;
  await page.route("**/api/v1/customer", (route) =>
    route.fulfill({
      json: {
        data: {
          ...state,
          notifications: [
            {
              id,
              body: "Synthetic seller task",
              created_at: new Date().toISOString(),
              read_at: read ? new Date().toISOString() : null,
              href: "/seller/schedule?date=2026-09-23&meal=dinner",
            },
          ],
        },
      },
    }),
  );
  let fail = true;
  await page.route("**/api/v1/commands", (route) => {
    if (route.request().postDataJSON().action !== "notification.read")
      return route.continue();
    if (fail)
      return route.fulfill({
        status: 503,
        json: { error: { code: "REQUEST_FAILED" } },
      });
    read = true;
    return route.fulfill({ json: { data: {} } });
  });
  await page.goto(
    "/seller/notifications?from=%2Fseller%2Fschedule%3Fmeal%3Ddinner",
  );
  await page.getByRole("button", { name: "Mark as read", exact: true }).click();
  await expect(page.locator(".error-notice")).toContainText(
    "Read status was not saved",
  );
  fail = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Mark as read", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Return to operations", exact: true }),
  ).toHaveAttribute("href", "/seller/schedule?meal=dinner");
  await page.getByRole("link", { name: /Synthetic seller task/ }).click();
  await expect(page).toHaveURL(/seller\/schedule\?date=2026-09-23&meal=dinner/);
  await expect(
    page.getByRole("complementary", {
      name: "Caterer navigation",
      exact: true,
    }),
  ).toBeVisible();
});
test("saved production and print preserve whole-day scope with an empty table filter", async ({
  page,
}) => {
  const date = addDays(localDay(), -1);
  const saved = await command(page, "production.freeze", {
    catererId: cid,
    date,
  });
  await page.goto(
    `/seller/schedule?date=${date}&meal=lunch&package=${crypto.randomUUID()}&production=1`,
  );
  await expect(
    page.locator(".ops-orders-panel").getByText("No orders", { exact: true }),
  ).toBeVisible();
  const production = page.locator(".ops-production");
  await expect(production).toContainText("12 meal portions");
  await expect(
    production.getByRole("link", { name: /Download CSV/ }),
  ).toHaveAttribute("href", "/api/manifests/" + saved.id);
  const csv = await (
    await page.request.get("/api/manifests/" + saved.id)
  ).text();
  expect(csv).toContain("Jalan Sintetis Kantor 2");
  expect(csv).toContain("Jalan Sintetis Rumah 1");
  expect(csv).toContain("Dinner");
  expect(csv).toContain("Lunch");
  await page.emulateMedia({ media: "print" });
  await expect(
    production.getByText("Dinner", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    production.getByText("Lunch", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator(".ops-order-table")).toBeHidden();
  await mkdir("output/playwright/journeys", { recursive: true });
  await page.pdf({
    path: "output/playwright/journeys/whole-day-handoff.pdf",
    format: "A4",
    printBackground: true,
  });
  await page.screenshot({
    path: "output/playwright/journeys/whole-day-print.png",
    fullPage: true,
  });
});
test("staff invite copy, failed acceptance and durable role boundary", async ({
  page,
  context,
}) => {
  // Run against the separate operations database: this accepts an invitation
  // for its synthetic customer and deliberately changes that fixture's role.
  test.skip(
    !process.env.CATERA_OPS_TEST_URL,
    "Requires separate operations fixture",
  );
  await page.goto("/seller/settings");
  await page
    .getByRole("button", { name: "Create staff invite", exact: true })
    .click();
  const code = await page.locator(".notice code").innerText();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page
    .getByRole("button", { name: "Copy invitation code", exact: true })
    .click();
  await expect(page.locator(".toast")).toContainText("Code copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
  await page.request.post("/api/v1/auth/demo", { data: { role: "customer" } });
  await page.goto("/seller/onboarding");
  await page.getByText("I was invited as staff", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "Invite code", exact: true })
    .fill(code);
  await page.route("**/api/v1/commands", (route) =>
    route.fulfill({ status: 503, json: { error: { code: "REQUEST_FAILED" } } }),
  );
  await page
    .getByRole("button", { name: "Accept invite", exact: true })
    .click();
  await expect(page.locator(".error-notice")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Invite code", exact: true }),
  ).toHaveValue(code);
  await page.unrouteAll();
  await page
    .getByRole("button", { name: "Accept invite", exact: true })
    .click();
  await expect(page).toHaveURL(/\/seller$/);
  expect(
    (await (await page.request.get("/api/v1/me")).json()).data.actor.role,
  ).toBe("staff");
  await page.goto("/seller/transactions");
  await expect(
    page.getByRole("heading", { name: "Owner access required", exact: true }),
  ).toBeVisible();
  expect(
    (await page.request.get(`/api/v1/seller-settlement/${cid}`)).status(),
  ).toBe(403);
});
