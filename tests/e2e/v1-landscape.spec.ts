import { expect, test, type Page } from "@playwright/test";
import type { CustomerState, SellerOperationsState } from "@catera/domain";

const catererId = "10000000-0000-4000-8000-000000000001";
async function login(page: Page, role: string) {
  expect(
    (await page.request.post("/api/v1/auth/demo", { data: { role } })).ok(),
  ).toBe(true);
}
test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([
    { name: "catera_locale", value: "en", url: baseURL! },
  ]);
});
test.use({ reducedMotion: "reduce" });

for (const [width, height] of [
  [1280, 800],
  [1440, 900],
]) {
  test(`seller can reach the first order action without scrolling at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await login(page, "owner");
    await page.goto("/seller");
    const action = page.locator(".order-next").first();
    await expect(action).toBeVisible();
    const box = (await action.boundingBox())!;
    expect(box.y).toBeGreaterThan(0);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await action.focus();
    await expect(action).toBeFocused();
    await page.getByText("How to update orders", { exact: true }).click();
    await expect(page.locator(".ops-task-help")).toContainText(
      "Kitchen and delivery lists always cover the whole day",
    );
  });
}

test("delivery cutoff closes change controls while the page stays open and explains the reason", async ({
  page,
}) => {
  await login(page, "customer");
  const customer: CustomerState = (
    await (await page.request.get("/api/v1/customer")).json()
  ).data;
  const delivery = customer.deliveries[0];
  const start = Date.now();
  await page.clock.install({ time: new Date(start) });
  await page.route("**/api/v1/customer?deliveryId=*", (route) =>
    route.fulfill({
      json: {
        data: {
          ...customer,
          deliveries: [
            {
              ...delivery,
              status: "scheduled",
              canChange: true,
              cutoff_at: new Date(start + 10000).toISOString(),
              offer: { ...delivery.offer, flexible: true },
            },
          ],
        },
      },
    }),
  );
  await page.goto("/deliveries/" + delivery.id);
  await expect(
    page.getByRole("button", { name: "Change schedule", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Change address", exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(11000);
  await expect(
    page.getByRole("button", { name: "Change schedule", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Change address", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".delivery-management-summary")).toContainText(
    "Changes closed at",
  );
  await expect(page.locator(".delivery-management-summary")).toContainText(
    delivery.offer.timezone,
  );
  await expect(
    page.getByRole("link", { name: "Contact caterer", exact: true }),
  ).toBeVisible();
});

test("marking an order delivered requires review and a conflict preserves recovery", async ({
  page,
}) => {
  await login(page, "owner");
  const state: SellerOperationsState = (
    await (await page.request.get(`/api/v1/seller/${catererId}`)).json()
  ).data;
  const deliveries = state.deliveries.map((delivery) => ({
    ...delivery,
    status: "out_for_delivery",
    meals: delivery.meals.map((meal) => ({
      ...meal,
      status: "out_for_delivery",
    })),
  }));
  await page.route(`**/api/v1/seller/${catererId}*`, (route) =>
    route.fulfill({ json: { data: { ...state, deliveries } } }),
  );
  let mutations = 0;
  await page.route("**/api/v1/commands", async (route) => {
    mutations++;
    await route.fulfill({
      status: 409,
      json: {
        error: { code: "CONFLICT", requestId: "synthetic-landscape-conflict" },
      },
    });
  });

  await page.goto("/seller?meal=lunch");
  await page.locator(".order-next").first().click();
  await expect(
    page.getByRole("dialog", { name: "Confirm order update" }),
  ).toBeVisible();
  expect(mutations).toBe(0);
  await expect(page.locator(".bulk-confirmation")).toContainText("Delivered");
  await expect(page.locator(".confirmation-orders")).toContainText(
    deliveries[0].customer.name,
  );
  await expect(page.locator(".confirmation-orders")).toContainText(
    deliveries[0].offer.name,
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  await expect(page.locator(".ops-orders-panel [role=alert]")).toContainText(
    "This batch made no changes",
  );
  expect(mutations).toBe(1);
  await expect(
    page.getByRole("dialog", { name: "Confirm order update" }),
  ).toHaveCount(0);
  await expect(
    page
      .locator(".ops-orders-panel [role=alert]")
      .getByRole("button", { name: "Refresh", exact: true }),
  ).toBeVisible();
});

test("the complete Indonesian order row fits at 1280 with the long delivery status", async ({
  page,
  context,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await context.addCookies([
    { name: "catera_locale", value: "id", url: baseURL! },
  ]);
  await login(page, "owner");
  const state: SellerOperationsState = (
    await (await page.request.get(`/api/v1/seller/${catererId}`)).json()
  ).data;
  await page.route(`**/api/v1/seller/${catererId}*`, (route) =>
    route.fulfill({
      json: {
        data: {
          ...state,
          deliveries: state.deliveries.map((delivery) => ({
            ...delivery,
            meals: delivery.meals.map((meal) => ({
              ...meal,
              status: "out_for_delivery",
            })),
          })),
        },
      },
    }),
  );
  await page.goto("/seller?meal=lunch");
  const row = page
    .locator(".ops-order-table tbody tr:not(.ops-group-heading)")
    .first();
  await expect(row).toContainText("Dalam pengantaran");
  const bounds = (await row.boundingBox())!;
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(800);
  expect(
    (await row.locator(".order-next").boundingBox())!.height,
  ).toBeGreaterThanOrEqual(44);
});

test("an open reschedule review cannot submit after cutoff", async ({
  page,
}) => {
  await login(page, "customer");
  const customer: CustomerState = (
    await (await page.request.get("/api/v1/customer")).json()
  ).data;
  const delivery = customer.deliveries.find((d) => d.status === "scheduled")!;
  const start = Date.now();
  await page.clock.install({ time: new Date(start) });
  await page.route("**/api/v1/customer?deliveryId=*", (route) =>
    route.fulfill({
      json: {
        data: {
          ...customer,
          deliveries: [
            {
              ...delivery,
              canChange: true,
              cutoff_at: new Date(start + 60000).toISOString(),
              offer: { ...delivery.offer, flexible: true },
            },
          ],
        },
      },
    }),
  );
  await page.route("**/api/v1/availability/**", (route) =>
    route.fulfill({
      json: {
        data: [
          { date: "2026-10-15", available: true, reason: null, remaining: 99 },
        ],
      },
    }),
  );
  await page.goto("/deliveries/" + delivery.id);
  await page
    .getByRole("button", { name: "Change schedule", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review change", exact: true })
    .click();
  const confirm = page.getByRole("button", {
    name: "Confirm schedule change",
    exact: true,
  });
  await expect(confirm).toBeEnabled();
  await page.clock.fastForward(61000);
  await expect(confirm).toHaveCount(0);
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "The change cutoff has passed",
  );
});

for (const locale of ["en", "id"]) {
  test(`reschedule conflict reloads current delivery truth before retry: ${locale}`, async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([
      { name: "catera_locale", value: locale, url: baseURL! },
    ]);
    await login(page, "customer");
    const customer: CustomerState = (
      await (await page.request.get("/api/v1/customer")).json()
    ).data;
    const delivery = customer.deliveries.find((d) => d.status === "scheduled")!;
    let reads = 0;
    await page.route("**/api/v1/customer?deliveryId=*", async (route) => {
      reads++;
      const current = {
        ...delivery,
        canChange: reads === 1,
        status: reads === 1 ? "scheduled" : "delivered",
        cutoff_at: new Date(Date.now() + 3600000).toISOString(),
        version: delivery.version + (reads === 1 ? 0 : 1),
        offer: { ...delivery.offer, flexible: true },
        meals: delivery.meals.map((m) => ({
          ...m,
          status: reads === 1 ? "scheduled" : "delivered",
        })),
      };
      await route.fulfill({
        json: { data: { ...customer, deliveries: [current] } },
      });
    });
    await page.route("**/api/v1/availability/**", (route) =>
      route.fulfill({
        json: {
          data: [
            {
              date: "2026-10-15",
              available: true,
              reason: null,
              remaining: 99,
            },
          ],
        },
      }),
    );
    let commands = 0;
    await page.route("**/api/v1/commands", (route) => {
      commands++;
      return route.fulfill({
        status: 409,
        json: {
          error: { code: "CONFLICT", requestId: "synthetic-delivery-recovery" },
        },
      });
    });
    await page.goto("/deliveries/" + delivery.id);
    await page
      .getByRole("button", {
        name: locale === "en" ? "Change schedule" : "Ubah jadwal",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", {
        name: locale === "en" ? "Review change" : "Tinjau perubahan",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", {
        name:
          locale === "en"
            ? "Confirm schedule change"
            : "Konfirmasi perubahan jadwal",
        exact: true,
      })
      .click();
    await expect.poll(() => reads).toBeGreaterThanOrEqual(2);
    await expect(
      page.getByRole("dialog").getByRole("alert").first(),
    ).toContainText(locale === "en" ? "delivered" : "Terkirim");
    await expect(
      page.getByRole("button", {
        name: locale === "en" ? "Review change" : "Tinjau perubahan",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: locale === "en" ? "Move this delivery" : "Pindahkan pengantaran",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("dialog").getByRole("link", {
        name: locale === "en" ? "Contact caterer" : "Hubungi katering",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).not.toContainText("Available");
    expect(commands).toBe(1);
  });
}

for (const width of [1280, 1440]) {
  test(`first catalog result price is readable above the fold at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 900 });
    await page.goto("/");
    const price = page.locator(".package-card-v2 .card-price > strong").first();
    await expect(price).toBeVisible();
    const bounds = (await price.boundingBox())!;
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(
      width === 1280 ? 800 : 900,
    );
  });
}

for (const locale of ["en", "id"]) {
  test(`calendar summary names the selected future week: ${locale}`, async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([
      { name: "catera_locale", value: locale, url: baseURL! },
    ]);
    await login(page, "customer");
    await page.goto("/calendar");
    await page.locator('.coverage-day[data-day="2026-10-12"]').click();
    await expect(page.locator(".coverage-summary")).toContainText(
      locale === "en" ? "Selected week" : "Minggu terpilih",
    );
    await expect(page.locator(".coverage-summary")).toContainText("12");
  });
}
