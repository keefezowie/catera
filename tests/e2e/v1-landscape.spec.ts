import { expect, test, type Page } from "@playwright/test";
import {
  addDays,
  localDay,
  zoneLabel,
  type CustomerState,
  type SellerOperationsState,
} from "@catera/domain";

const catererId = "10000000-0000-4000-8000-000000000001";
async function login(page: Page, role: string) {
  expect(
    (await page.request.post("/api/v1/auth/demo", { data: { role } })).ok(),
  ).toBe(true);
}
async function sellerDay(page: Page) {
  for (const delta of [-1, 1, 0, 2, 3]) {
    const date = addDays(localDay(), delta);
    const state: SellerOperationsState = (
      await (
        await page.request.get(`/api/v1/seller/${catererId}?date=${date}`)
      ).json()
    ).data;
    // A day with a lunch still to act on: delivered history has no next order action.
    const open = (status: string) => !["delivered", "cancelled"].includes(status);
    if (
      state.deliveries.some(
        (d) => open(d.status) && d.meals.some((m) => m.meal === "lunch" && open(m.status)),
      )
    )
      return state;
  }
  throw new Error("No nearby synthetic seller day with a lunch to act on");
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
    const state = await sellerDay(page);
    const date = state.deliveries[0].service_date;
    await page.route(`**/api/v1/seller/${catererId}*`, (r) =>
      r.fulfill({ json: { data: { ...state, today: date } } }),
    );
    await page.goto(`/seller?date=${date}&meal=lunch`);
    // The loading skeleton holds its own order rows; measure the loaded action.
    await expect(page.locator("main .skeleton-screen")).toHaveCount(0);
    const action = page.locator(".order-next").first();
    await expect(action).toBeVisible();
    // The row re-renders while the attention card finishes loading; read the box once it is attached.
    let box = { y: 0, height: 0 };
    await expect
      .poll(async () => {
        box = (await action.boundingBox()) || box;
        return box.height;
      })
      .toBeGreaterThan(0);
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
    zoneLabel(delivery.offer.timezone),
  );
  await expect(
    page.getByRole("link", { name: "Contact caterer", exact: true }),
  ).toBeVisible();
});

test("marking an order arrived requires a photo review and a conflict preserves recovery", async ({
  page,
}) => {
  await login(page, "owner");
  const state = await sellerDay(page);
  const date = state.deliveries[0].service_date;
  const deliveries = state.deliveries.map((delivery) => ({
    ...delivery,
    status: "out_for_delivery",
    meals: delivery.meals.map((meal) => ({
      ...meal,
      status: "out_for_delivery",
      arrived_at: null,
      arrived_photo: null,
      confirmed_at: null,
      confirmed_by: null,
    })),
  }));
  await page.route(`**/api/v1/seller/${catererId}*`, (route) =>
    route.fulfill({ json: { data: { ...state, today: date, deliveries } } }),
  );
  // Synthetic upload: no file reaches storage and no delivery changes.
  let uploads = 0;
  await page.route("**/api/uploads/proof", (route) => {
    uploads++;
    return route.fulfill({
      json: { data: { path: "proofs/synthetic-arrival.png" } },
    });
  });
  let mutations = 0;
  let payload: { photos?: Record<string, string> } = {};
  await page.route("**/api/v1/commands", async (route) => {
    mutations++;
    payload = route.request().postDataJSON().payload;
    await route.fulfill({
      status: 409,
      json: {
        error: { code: "CONFLICT", requestId: "synthetic-landscape-conflict" },
      },
    });
  });

  await page.goto(`/seller?date=${date}&meal=lunch`);
  await expect(page.locator("main .skeleton-screen")).toHaveCount(0);
  await page.locator(".order-next").first().click();
  const dialog = page.getByRole("dialog", { name: "Mark arrived with a photo" });
  await expect(dialog).toBeVisible();
  expect(mutations).toBe(0);
  await expect(page.locator(".bulk-confirmation")).toContainText(
    "Marked arrived",
  );
  await expect(page.locator(".confirmation-orders")).toContainText(
    deliveries[0].customer.name,
  );
  await expect(page.locator(".confirmation-orders")).toContainText(
    deliveries[0].offer.name,
  );
  const confirm = dialog.getByRole("button", { name: /^Mark arrived · 1$/ });
  await expect(confirm).toBeDisabled();
  await dialog.locator('.proof-photo input[type="file"]').setInputFiles({
    name: "synthetic-arrival.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await confirm.click();
  await expect(page.locator(".ops-orders-panel [role=alert]")).toContainText(
    "This batch made no changes",
  );
  expect(uploads).toBe(1);
  expect(mutations).toBe(1);
  expect(Object.values(payload.photos || {})).toEqual([
    "proofs/synthetic-arrival.png",
  ]);
  await expect(dialog).toHaveCount(0);
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
  const state = await sellerDay(page);
  const date = state.deliveries[0].service_date;
  await page.route(`**/api/v1/seller/${catererId}*`, (route) =>
    route.fulfill({
      json: {
        data: {
          ...state,
          today: date,
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
  await page.goto(`/seller?date=${date}&meal=lunch`);
  const row = page
    .locator(".ops-order-table tbody tr:not(.ops-group-heading)")
    .first();
  await expect(row).toContainText("Sedang diantar");
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
    // The delivery stays changeable through every read until the change is sent, however often the page reads it;
    // only the reads after the conflict show the newer truth.
    let commands = 0;
    let readsAfterConflict = 0;
    await page.route("**/api/v1/customer?deliveryId=*", async (route) => {
      const before = commands === 0;
      if (!before) readsAfterConflict++;
      const current = {
        ...delivery,
        canChange: before,
        status: before ? "scheduled" : "delivered",
        cutoff_at: new Date(Date.now() + 3600000).toISOString(),
        version: delivery.version + (before ? 0 : 1),
        offer: { ...delivery.offer, flexible: true },
        meals: delivery.meals.map((m) => ({
          ...m,
          status: before ? "scheduled" : "delivered",
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
        name: locale === "en" ? "Review change" : "Cek perubahan",
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
    await expect.poll(() => readsAfterConflict).toBeGreaterThanOrEqual(1);
    await expect(
      page.getByRole("dialog").getByRole("alert").first(),
    ).toContainText(locale === "en" ? "Arrived" : "Sampai");
    await expect(
      page.getByRole("button", {
        name: locale === "en" ? "Review change" : "Cek perubahan",
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
  test(`first catalog result starts above the fold at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 900 });
    await page.goto("/");
    // Food-led cards put the photo first, so the price sits under it; the fold must still show the first result.
    const card = page.locator(".package-card-v2").first();
    await expect(card).toBeVisible();
    expect((await card.boundingBox())!.y).toBeLessThan(width === 1280 ? 800 : 900);
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
