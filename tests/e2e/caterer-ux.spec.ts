import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const fixture = JSON.parse(
  readFileSync("output/playwright/caterer-ux/fixture.json", "utf8"),
);
const folder = "output/playwright/caterer-ux";
test.beforeEach(async ({ page }) => {
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
});
test("matched visual evidence", async ({ page }) => {
  const phase = process.env.UX_PHASE || "after";
  for (const locale of ["id", "en"]) {
    await page
      .context()
      .addCookies([
        { name: "catera_locale", value: locale, url: (process.env.CATERA_CATERER_UX_URL || "http://127.0.0.1:3138") },
      ]);
    for (const [width, height] of [
      [390, 844],
      [768, 1024],
      [1366, 768],
      [1440, 1000],
    ]) {
      await page.setViewportSize({ width, height });
      for (const route of ["today", "schedule"]) {
        await page.goto(
          `/seller${route === "schedule" ? "/schedule" : ""}?date=${fixture.date}&meal=lunch`,
        );
        await expect(
          page.locator(".ops-order-table tbody tr:not(.ops-group-heading)"),
        ).toHaveCount(phase === "before" && route === "today" ? 5 : 4);
        await expect(
          page.locator(".seller-attention[aria-busy=true]"),
        ).toHaveCount(0);
        if (route === 'schedule') await expect(page.locator('.coverage-strip')).toHaveAttribute('aria-busy','false');
        await page.screenshot({
          path: `${folder}/${phase}-${route}-${locale}-${width}.png`,
          fullPage: true,
          animations: "disabled",
        });
        if (phase === "after")
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
      }
    }
  }
});

const cid = "10000000-0000-4000-8000-000000000001";
const orderRows = (page: import("@playwright/test").Page) =>
  page.locator(".ops-order-table tbody tr:not(.ops-group-heading)");
async function english(page: import("@playwright/test").Page) {
  await page
    .context()
    .addCookies([
      { name: "catera_locale", value: "en", url: (process.env.CATERA_CATERER_UX_URL || "http://127.0.0.1:3138") },
    ]);
}
async function state(
  page: import("@playwright/test").Page,
  date = fixture.date,
) {
  return (
    await (await page.request.get(`/api/v1/seller/${cid}?date=${date}`)).json()
  ).data;
}

test("AT-01/02/19 primary Today clears future date; explicit dates, reload and history remain coherent", async ({
  page,
}) => {
  await english(page);
  await page.goto("/seller/schedule?date=2026-12-01&meal=dinner");
  await expect(
    page.getByRole("heading", { name: "Order schedule", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Today", exact: true }).first().click();
  await expect(page).not.toHaveURL(/date=/);
  await expect(
    page.getByRole("heading", { name: "Today", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ops-context")).toContainText("Asia/Jakarta");
  const current = await state(page, fixture.today);
  await expect(page.locator(".ops-orders-panel h2")).toContainText(
    current.today,
  );
  await page.goto(`/seller?date=${fixture.date}&meal=dinner`);
  await expect(
    page.getByRole("heading", { name: "Operations", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ops-orders-panel h2")).toContainText(
    fixture.date,
  );
  await page.getByRole("tab", { name: /Lunch/ }).click();
  await expect(page.getByRole("tab", { name: /Lunch/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.goBack();
  await expect(page.getByRole("tab", { name: /Dinner/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.goForward();
  await page.reload();
  await expect(page.getByRole("tab", { name: /Lunch/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("AT-04/05/06/07 dinner-only, explicit empty meal, empty day and exact mixed workload", async ({
  page,
}) => {
  await english(page);
  await page.goto(`/seller?date=${fixture.dinnerDate}`);
  await expect(
    page.getByRole("tab", { name: /Dinner · 4 portions/ }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: /Lunch/ }).click();
  await expect(
    page.getByRole("button", { name: "View orders for dinner" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("tab", { name: /Lunch/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("button", { name: "View orders for dinner" }).click();
  await expect(page.getByRole("tab", { name: /Dinner/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.goto(`/seller?date=${fixture.emptyDate}`);
  await expect(page.locator(".ops-workload")).toContainText(
    "Total portions for lunch: 0",
  );
  await expect(page.locator(".ops-deadlines")).toHaveCount(0);
  await page.goto(`/seller?date=${fixture.date}&meal=lunch`);
  await expect(
    page.getByRole("tab", { name: /Lunch · 8 portions/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: /Dinner · 9 portions/ }),
  ).toBeVisible();
  await expect(page.locator(".ops-workload")).toContainText(
    "Total portions for lunch: 8",
  );
  await expect(page.locator(".ops-stages")).toContainText("3 portions");
  await expect(page.locator(".ops-stages")).toContainText("2 portions");
  await expect(page.locator(".ops-stages")).toContainText("1 portions");
  await expect(page.locator(".ops-deadlines summary")).toContainText("Passed");
  await expect(page.locator(".ops-deadlines summary")).toContainText(
    fixture.date,
  );
});

test("AT-08/09/16 explicit searchable grouping filters match summary, reset and cancelled scope", async ({
  page,
}) => {
  await english(page);
  await page.goto(`/seller/schedule?date=${fixture.date}&meal=lunch`);
  await page
    .getByRole("combobox", { name: "Group orders", exact: true })
    .click();
  await page.getByRole("option", { name: "Customer", exact: true }).click();
  await expect(page.locator(".ops-scope-summary")).toContainText(
    "4 orders · 8 meal portions",
  );
  await page
    .getByRole("searchbox", { name: "Search customers or destinations" })
    .fill("UX U1");
  await page.getByRole("combobox", { name: "Customer filter" }).click();
  await page.getByRole("option", { name: /UX U1 / }).click();
  await expect(orderRows(page)).toHaveCount(2);
  await expect(page.locator(".ops-scope-summary")).toContainText(
    "2 orders · 4 meal portions",
  );
  await page.reload();
  await expect(page.locator(".ops-scope-summary")).toContainText(
    "2 orders · 4 meal portions",
  );
  await page
    .getByRole("combobox", { name: "Group orders", exact: true })
    .click();
  await page.getByRole("option", { name: "Destination", exact: true }).click();
  await expect(page).not.toHaveURL(/filter=/);
  await expect(page.locator(".ops-scope-summary")).toContainText(
    "4 orders · 8 meal portions",
  );
  await page.getByRole("combobox", { name: "Order status" }).click();
  await page.getByRole("option", { name: "Cancelled", exact: true }).click();
  await expect(orderRows(page)).toHaveCount(1);
  await expect(page.locator(".ops-scope-summary")).toContainText(
    "1 orders · 2 meal portions",
  );
  await expect(page.locator(".ops-scope-summary")).toContainText(
    "cancelled historical quantities",
  );
  await page.getByRole("button", { name: "Reset table filters" }).click();
  await expect(page.locator(".ops-scope-summary")).toContainText(
    "5 orders · 17 meal portions",
  );
  await expect(
    page.getByRole("button", { name: "Choose date", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Operational date", exact: true }),
  ).toHaveCount(0);
});

test("AT-12/13 queue preview and service limit remain truthful; dinner issues visible during lunch", async ({
  page,
}) => {
  await english(page);
  await page.goto(`/seller?date=${fixture.dinnerDate}&meal=lunch`);
  const queue = page.getByRole("region", {
    name: "Needs attention",
    exact: true,
  });
  await expect(queue).toContainText("All dates · lunch and dinner");
  await expect(queue.locator(".queue-row")).toHaveCount(3);
  await expect(queue).toContainText("100 of 102");
  await expect(queue).toContainText("dinner");
  await queue.getByRole("button", { name: /View all tasks/ }).click();
  await expect(queue.locator(".queue-row")).toHaveCount(100);
  await queue.getByRole("button", { name: /Show 3 priorities/ }).click();
  await expect(queue.locator(".queue-row")).toHaveCount(3);
});

test("AT-10 whole-day kitchen path, actual revision and CSV preserve 17 portions behind filtered table", async ({
  page,
}) => {
  await english(page);
  await page.goto(
    `/seller/schedule?date=${fixture.date}&meal=lunch&group=customers&filter=${fixture.users[0]}`,
  );
  await expect(page.locator(".ops-scope-summary")).toContainText(
    "2 orders · 4 meal portions",
  );
  await page
    .getByRole("link", { name: "Kitchen & delivery list · whole day" })
    .click();
  const kitchen = page.locator("#production");
  await expect(kitchen).toHaveAttribute("open", "");
  await expect(kitchen).toContainText(
    "Live overview · whole day · 17 meal portions",
  );
  await kitchen
    .getByRole("button", { name: "Save delivery list", exact: true })
    .click();
  const csv = kitchen.getByRole("link", { name: /Download CSV/ });
  await expect(csv).toBeVisible();
  const response = await page.request.get((await csv.getAttribute("href"))!);
  expect(response.ok()).toBe(true);
  const text = await response.text();
  const { writeFileSync } = await import("node:fs");
  writeFileSync(`${folder}/manifest.csv`, text);
  expect(text).toContain("Lunch");
  expect(text).toContain("Dinner");
  const records = text
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split('","'));
  expect(records.reduce((n, r) => n + Number(r[5]), 0)).toBe(17);
  expect(
    records
      .filter((r) => r[3] === "Lunch")
      .reduce((n, r) => n + Number(r[5]), 0),
  ).toBe(8);
  expect(
    records
      .filter((r) => r[3] === "Dinner")
      .reduce((n, r) => n + Number(r[5]), 0),
  ).toBe(9);
  expect(records.filter((r) => r[6] === "Yes")).toHaveLength(1);
  expect(text).toContain("Jalan Sintetis X");
  expect(text).not.toContain("Jalan Sintetis Q");
  let printed = false;
  await page.exposeFunction("recordPrint", () => {
    printed = true;
  });
  await page.evaluate(() => {
    window.print = () => {
      (window as unknown as { recordPrint: () => void }).recordPrint();
    };
  });
  await kitchen.getByRole("button", { name: "Print", exact: true }).click();
  await expect.poll(() => printed).toBe(true);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".ops-order-layout")).toBeHidden();
  await expect(kitchen.locator("table")).toBeVisible();
  await page.pdf({
    path: `${folder}/kitchen.pdf`,
    format: "A4",
    printBackground: true,
  });
  await page.screenshot({ path: `${folder}/print.png`, fullPage: true });
  await page.emulateMedia({ media: "screen" });
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    csv.click(),
  ]);
  await download.saveAs(`${folder}/downloaded-manifest.csv`);
  await page.goto(`/seller/schedule?date=${fixture.emptyDate}&production=1`);
  await expect(page.getByRole("link", { name: /Download CSV/ })).toHaveCount(0);
});

test("AT-14 failed and late responses never label old orders as a new day", async ({
  page,
}) => {
  await english(page);
  await page.goto(`/seller?date=${fixture.date}&meal=lunch`);
  await expect(orderRows(page)).toHaveCount(4);
  await page.route(
    `**/api/v1/seller/${cid}?date=${fixture.dinnerDate}`,
    async (route) => {
      await new Promise((r) => setTimeout(r, 800));
      await route.fulfill({
        status: 503,
        json: { error: { code: "UNAVAILABLE" } },
      });
    },
  );
  await page.goto(`/seller?date=${fixture.dinnerDate}&meal=dinner`);
  await expect(orderRows(page)).toHaveCount(0);
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator(".ops-workload")).toHaveCount(0);
});

test("AT-14 attention errors are distinct from a zero queue", async ({
  page,
}) => {
  await english(page);
  await page.route(/\/api\/v1\/seller-attention\//, (route) =>
    route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE" } } }),
  );
  await page.goto(`/seller?date=${fixture.date}&meal=lunch`);
  const queue = page.getByRole("region", { name: "Needs attention" });
  await expect(queue.getByRole("alert")).toBeVisible();
  await expect(queue).not.toContainText("No exceptions");
});

test("AT-17 staff operational access preserves restricted navigation", async ({
  page,
}) => {
  await english(page);
  await page.request.post("/api/v1/auth/demo", { data: { role: "staff" } });
  await page.goto(`/seller?date=${fixture.date}&meal=lunch`);
  await expect(page.locator(".ops-workload")).toContainText(
    "Total portions for lunch: 8",
  );
  await expect(
    page.getByRole("link", { name: "Transactions", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Kitchen & delivery list · whole day" }),
  ).toBeVisible();
});

test("AT-03/14 server timezone and rollover stay authoritative; explicit selected date stays pinned", async ({
  page,
}) => {
  await english(page);
  const snapshot = await state(page);
  let day = "2026-09-22";
  await page.route(`**/api/v1/seller/${cid}*`, (route) =>
    route.fulfill({
      json: {
        data: {
          ...snapshot,
          today: day,
          operationalDate:
            new URL(route.request().url()).searchParams.get("date") || day,
        },
      },
    }),
  );
  await page.goto("/seller?meal=lunch");
  await expect(page.locator(".ops-orders-panel h2")).toContainText(day);
  day = "2026-09-23";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".ops-orders-panel h2")).toContainText(day);
  await page.goto(`/seller?date=${fixture.date}&meal=lunch`);
  await expect(
    page.getByRole("heading", { name: "Operations", exact: true }),
  ).toBeVisible();
  day = "2026-09-24";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".ops-orders-panel h2")).toContainText(
    fixture.date,
  );
});

test("AT-18/20 keyboard, accessibility, mobile paths, long-list layout and customer smoke", async ({
  page,
}) => {
  await english(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/seller?date=${fixture.date}&meal=lunch`);
  const lunch = page.getByRole("tab", { name: /Lunch/ });
  await lunch.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /Dinner/ })).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(lunch).toBeFocused();
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  expect(
    (await new AxeBuilder({ page }).include("#main").analyze()).violations,
  ).toEqual([]);
  await page
    .getByRole("link", { name: "Kitchen & delivery list · whole day" })
    .click();
  await expect(page.locator("#production")).toHaveAttribute("open", "");
  await page.goto(`/seller?date=${fixture.scaleDate}&meal=lunch`);
  await expect(orderRows(page)).toHaveCount(100);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: `${folder}/scale-phone.png`, fullPage: false });
  await page
    .getByRole("region", { name: "Needs attention" })
    .locator(".queue-row")
    .first()
    .click();
  await expect(page).toHaveURL(/meal=dinner/);
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page
    .getByRole("link", { name: "Customers", exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(/seller\/customers/);
  await page
    .getByRole("link", { name: "Packages", exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(/seller\/packages/);
  await page.request.post("/api/v1/auth/demo", { data: { role: "customer" } });
  await page.goto("/home");
  await expect(page.locator("#main")).toBeVisible();
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Explore catering", exact: true }).first(),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("AT-14 selection clears across meals; failed save has no download; late save cannot cross dates", async ({
  page,
}) => {
  await english(page);
  await page.goto(`/seller?date=${fixture.date}&meal=lunch`);
  await page
    .getByRole("checkbox", { name: "Select all orders", exact: true })
    .check();
  await expect(page.locator(".ops-bulk-toolbar")).toBeVisible();
  await page.getByRole("tab", { name: /Dinner/ }).click();
  await expect(page.locator(".ops-bulk-toolbar")).toHaveCount(0);
  await page.goto(`/seller/schedule?date=${fixture.date}&production=1`);
  await page.route("**/api/v1/commands", (route) =>
    route.fulfill({ status: 409, json: { error: { code: "CONFLICT" } } }),
  );
  await page
    .getByRole("button", { name: "Save delivery list", exact: true })
    .click();
  await expect(page.locator("#production").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("link", { name: /Download CSV/ })).toHaveCount(0);
});

test("AT-15 UI bulk conflict retains selection and reports atomic failure", async ({
  page,
}) => {
  await english(page);
  await page.goto(`/seller?date=${fixture.scaleDate}&meal=lunch`);
  const rows = orderRows(page);
  await expect(rows).toHaveCount(100);
  const scheduled = rows.filter({ has: page.locator(".status-scheduled") });
  const chosen = await scheduled
    .first()
    .getByRole("checkbox")
    .getAttribute("aria-label");
  await scheduled.first().getByRole("checkbox").check();
  const response = await state(page, fixture.scaleDate);
  const selected = response.deliveries.find(
    (d: any) =>
      chosen?.includes(d.customer.name) &&
      d.meals.some((m: any) => m.meal === "lunch" && m.status === "scheduled"),
  );
  const changed = await page.request.post("/api/v1/commands", {
    data: {
      action: "delivery.status",
      requestId: crypto.randomUUID(),
      payload: {
        id: selected.id,
        version: selected.version,
        meal: "lunch",
        status: "preparing",
      },
    },
  });
  expect(changed.ok()).toBe(true);
  await page.getByRole("button", { name: /Start preparing ·/ }).click();
  await expect(
    page.locator(".ops-orders-panel").getByRole("alert"),
  ).toContainText("This batch made no changes");
  await expect(page.locator(".ops-bulk-toolbar")).toContainText("1 selected");
  await expect(page.getByRole("tab", { name: /Lunch/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("AT-11 saved revision change warning reflects real allowed local transitions", async ({
  page,
}) => {
  await english(page);
  await page.goto(`/seller/schedule?date=${fixture.scaleDate}&production=1`);
  await page
    .getByRole("button", { name: "Save delivery list", exact: true })
    .click();
  await expect(page.getByRole("link", { name: /Download CSV/ })).toBeVisible();
  let data = await state(page, fixture.scaleDate);
  const changed = await page.request.post("/api/v1/commands", {
    data: {
      action: "delivery.statusBatch",
      requestId: crypto.randomUUID(),
      payload: {
        catererId: cid,
        date: fixture.scaleDate,
        meal: "dinner",
        status: "out_for_delivery",
        items: data.deliveries.map((d: any) => ({
          id: d.id,
          version: d.version,
        })),
      },
    },
  });
  expect(changed.ok()).toBe(true);
  await page.goto(`/seller?date=${fixture.date}&meal=lunch`);
  const queue = page.getByRole("region", { name: "Needs attention" });
  await expect(queue).toContainText("Production list has changed");
  await queue
    .getByRole("link", { name: /Production list has changed/ })
    .click();
  await expect(page).toHaveURL(new RegExp("date=" + fixture.scaleDate));
  await page
    .getByRole("button", { name: "Save delivery list", exact: true })
    .click();
  await expect(page.getByRole("link", { name: /Download CSV/ })).toBeVisible();
  const attention = await (
    await page.request.get(`/api/v1/seller-attention/${cid}`)
  ).json();
  expect(
    attention.data.items.some(
      (i: any) =>
        i.kind === "production_changed" && i.context === fixture.scaleDate,
    ),
  ).toBe(false);
  data = await state(page, fixture.scaleDate);
  const reset = await page.request.post("/api/v1/commands", {
    data: {
      action: "delivery.statusBatch",
      requestId: crypto.randomUUID(),
      payload: {
        catererId: cid,
        date: fixture.scaleDate,
        meal: "dinner",
        status: "issue",
        items: data.deliveries.map((d: any) => ({
          id: d.id,
          version: d.version,
        })),
      },
    },
  });
  expect(reset.ok()).toBe(true);
  await page
    .getByRole("button", { name: "Save delivery list", exact: true })
    .click();
});

test("AT-03 purchased cutoff crosses exactly in a different browser timezone", async ({
  browser,
}) => {
  const context = await browser.newContext({
    timezoneId: "America/Los_Angeles",
    baseURL: (process.env.CATERA_CATERER_UX_URL || "http://127.0.0.1:3138"),
  });
  const page = await context.newPage();
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  await english(page);
  const data = await state(page);
  const boundary = Date.parse("2026-09-21T10:00:00Z");
  await page.clock.install({ time: new Date(boundary - 1000) });
  await page.clock.pauseAt(new Date(boundary - 1000));
  await page.route(new RegExp("/api/v1/seller/" + cid), (route) =>
    route.fulfill({
      json: {
        data: {
          ...data,
          today: "2026-09-22",
          deliveries: data.deliveries.map((d: any) => ({
            ...d,
            cutoff_at: "2026-09-21T10:00:00Z",
          })),
        },
      },
    }),
  );
  await page.goto(`/seller?date=${fixture.date}&meal=lunch`);
  await expect(page.locator(".ops-deadlines summary")).toContainText(
    "21 Sept 2026, 17:00",
  );
  await expect(page.locator(".ops-deadlines summary")).toContainText(
    "Not yet passed",
  );
  await page.clock.runFor(1001);
  await expect(page.locator(".ops-deadlines summary")).toContainText("Passed");
  await expect(
    page.getByRole("heading", { name: "Operations", exact: true }),
  ).toBeVisible();
  await context.close();
});

test("AT-14 slow kitchen save cannot create a download on a newly selected day", async ({
  page,
}) => {
  await english(page);
  await page.goto(`/seller/schedule?date=${fixture.date}&production=1`);
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  let started!: () => void;
  const startedPromise = new Promise<void>((r) => {
    started = r;
  });
  await page.route("**/api/v1/commands", async (route) => {
    started();
    await gate;
    await route.fulfill({
      json: { data: { id: "synthetic-old-revision", revision: 9 } },
    });
  });
  await page
    .getByRole("button", { name: "Save delivery list", exact: true })
    .click();
  await startedPromise;
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page).not.toHaveURL(new RegExp("date=" + fixture.date));
  release();
  await expect(page.locator("#production h2")).toContainText(fixture.today);
  await expect(page.getByRole("link", { name: /Download CSV/ })).toHaveCount(0);
});

test("AT-02/04/13 lunch-only default, zero queue, old production route and invalid date", async ({
  page,
}) => {
  await english(page);
  const data = await state(page);
  await page.route(new RegExp("/api/v1/seller/" + cid), (route) =>
    route.fulfill({
      json: {
        data: {
          ...data,
          deliveries: data.deliveries.filter(
            (d: any) => d.offer.id === fixture.packages[1],
          ),
        },
      },
    }),
  );
  await page.route(/\/api\/v1\/seller-attention\//, (route) =>
    route.fulfill({
      json: { data: { timezone: "Asia/Jakarta", total: 0, items: [] } },
    }),
  );
  await page.goto(`/seller?date=${fixture.date}`);
  await expect(
    page.getByRole("tab", { name: /Lunch · 3 portions/ }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("region", { name: "Needs attention" }),
  ).toContainText("No exceptions require action right now.");
  await page.goto(
    `/seller/production?date=${fixture.date}&meal=lunch&group=customers&filter=${fixture.users[0]}`,
  );
  await expect(page).toHaveURL(/seller\/schedule.*production=1/);
  await expect(page.locator("#production")).toHaveAttribute("open", "");
  await page.goto("/seller?date=not-a-date");
  await expect(page.locator(".ops-context")).not.toContainText("not-a-date");
});

test("AT-18/19 calendar keyboard focus survives date-scoped loading", async ({
  page,
}) => {
  await english(page);
  await page.goto(`/seller/schedule?date=${fixture.date}`);
  const day = page.locator(`[data-day="${fixture.date}"]`);
  await day.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(
    page.locator(`[data-day="${fixture.dinnerDate}"]`),
  ).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(day).toBeFocused();
});

test("AT-14 late operational response cannot replace the date restored by Back", async ({
  page,
}) => {
  await english(page);
  await page.goto(`/seller/schedule?date=${fixture.date}&meal=lunch`);
  await expect(orderRows(page)).toHaveCount(4);
  let release!: () => void, started!: () => void, finished!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const begun = new Promise<void>((r) => {
    started = r;
  });
  const done = new Promise<void>((r) => {
    finished = r;
  });
  await page.route(
    `**/api/v1/seller/${cid}?date=${fixture.dinnerDate}`,
    async (route) => {
      const response = await route.fetch();
      started();
      await gate;
      await route.fulfill({ response });
      finished();
    },
  );
  await page.locator(`[data-day="${fixture.dinnerDate}"]`).click();
  await begun;
  await expect(orderRows(page)).toHaveCount(0);
  await page.goBack();
  await expect(orderRows(page)).toHaveCount(4);
  release();
  await done;
  await expect(page.locator(".ops-scope-summary")).toContainText(
    "4 orders · 8 meal portions",
  );
  await expect(page).toHaveURL(new RegExp("date=" + fixture.date));
});
