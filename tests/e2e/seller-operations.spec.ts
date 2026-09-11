import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { localDay, addDays } from "@catera/domain";
const base = process.env.CATERA_OPS_TEST_URL || "http://127.0.0.1:3106";
test.skip(
  !process.env.CATERA_OPS_TEST_URL,
  "Use the isolated operations config and synthetic fixture database",
);
const date = addDays(localDay(), -1);
test.use({ baseURL: base });
test.beforeEach(async ({ page }) => {
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
});
test("Today splits meals and addresses, bulk updates, and retains conflict selections", async ({
  page,
}) => {
  await page.goto(`/seller?date=${date}&meal=lunch`);
  const main = page.locator("#main");
  await expect(
    main.getByRole("tab", { name: "Siang", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(main.locator("tbody tr")).toHaveCount(3);
  await expect(
    main.getByText("Jalan Sintetis Kantor 2, Kelapa Gading"),
  ).toBeVisible();
  await main
    .getByRole("checkbox", { name: "Pilih semua pesanan", exact: true })
    .check();
  await expect(main.getByText("3 dipilih", { exact: true })).toBeVisible();
  // Simulate another operator changing the first selected delivery after selection.
  const response = await page.request.get(
    `/api/v1/seller/10000000-0000-4000-8000-000000000001?date=${date}`,
  );
  const state = (await response.json()).data;
  const delivery = state.deliveries[0];
  await page.request.post("/api/v1/commands", {
    data: {
      action: "delivery.status",
      requestId: crypto.randomUUID(),
      payload: {
        id: delivery.id,
        version: delivery.version,
        meal: "lunch",
        status: "preparing",
      },
    },
  });
  await main
    .getByRole("button", { name: "Perbarui status", exact: true })
    .click();
  await expect(main.getByRole("alert")).toContainText("Pesanan telah berubah");
  await expect(main.getByText("3 dipilih", { exact: true })).toBeVisible();
  await expect(
    main.getByText("Pilih pesanan dengan langkah status berikutnya yang sama."),
  ).toBeVisible();
  await main.getByRole("button", { name: "Batal pilih", exact: true }).click();
  const scheduled = main
    .locator("tbody tr")
    .filter({ has: page.locator(".status-scheduled") });
  for (const row of await scheduled.all())
    await row.getByRole("checkbox").check();
  await main
    .getByRole("button", { name: "Perbarui status", exact: true })
    .click();
  await expect(main.locator("tbody .status-preparing")).toHaveCount(3);
  await main.getByRole("tab", { name: "Malam", exact: true }).click();
  await expect(main.locator("tbody .status-scheduled")).toHaveCount(3);
  await expect(
    main.getByRole("checkbox", { name: "Pilih semua pesanan", exact: true }),
  ).not.toBeChecked();
  await page.reload();
  await expect(
    main.getByRole("tab", { name: "Malam", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await main
    .getByRole("button", { name: /^Detail Nadia/ })
    .first()
    .click();
  await expect(
    main.getByRole("complementary", { name: "Detail pesanan" }),
  ).toContainText("Fixture ID 0006");
});
test("Schedule filters, redirects, exports a whole-day CSV, and renders desktop/mobile accessibly", async ({
  page,
}) => {
  await mkdir("output/slack-bugs/0006", { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`/seller/production?date=${date}&meal=all`);
  await expect(page).toHaveURL(/\/seller\/schedule\?.*production=1/);
  const main = page.locator("#main");
  await expect(
    main.getByRole("heading", { name: "Jadwal pesanan" }),
  ).toBeVisible();
  await expect(main.locator(".ops-order-table tbody tr")).toHaveCount(3);
  const packages = main.getByRole("group", { name: "Filter paket" });
  await packages.getByRole("button").nth(1).click();
  await expect(main.locator(".ops-order-table tbody tr")).toHaveCount(1);
  await main
    .getByRole("button", { name: "Simpan revisi & buat manifest" })
    .click();
  const csv = main.getByRole("link", { name: /Unduh CSV/ });
  await expect(csv).toBeVisible();
  const exported = await page.request.get((await csv.getAttribute("href"))!);
  expect(exported.ok()).toBe(true);
  const text = await exported.text();
  expect(text).toContain("Jalan Sintetis Kantor 2");
  expect(text).toContain("Jalan Sintetis Rumah 1");
  await expect(
    main.getByRole("button", { name: "Simpan revisi & buat manifest" }),
  ).toBeEnabled();
  await expect(csv).toBeVisible();
  await packages
    .getByRole("button", { name: "Semua paket", exact: true })
    .click();
  await main.locator(".ops-production summary").click();
  await expect(main.locator(".coverage-strip")).not.toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect(main.locator(".ops-order-table tbody tr")).toHaveCount(3);
  await expect(main.locator(`[data-day="${date}"]`)).toContainText("3 pesanan");
  await expect(page.locator(".toast")).not.toHaveClass(/visible/);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: "output/slack-bugs/0006/schedule-1440.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    (await new AxeBuilder({ page }).include("#main").analyze()).violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: "output/slack-bugs/0006/schedule-390.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await main
    .getByRole("button", { name: "Bulan berikutnya", exact: true })
    .click();
  await expect(
    main.getByRole("heading", { name: "Tidak ada pesanan", exact: true }),
  ).toBeVisible();
  await page.goto(`/seller/delivery?date=${date}&meal=dinner`);
  await expect(page).toHaveURL(/\/seller\?date=.*meal=dinner/);
  await expect(
    main.getByRole("tab", { name: "Malam", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: "output/slack-bugs/0006/today-390.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: "output/slack-bugs/0006/today-1440.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("Schedule keeps keyboard focus across dates and supports English and narrow screens", async ({
  page,
}) => {
  await page
    .context()
    .addCookies([{ name: "catera_locale", value: "en", url: base }]);
  await page.goto(`/seller/schedule?date=${date}`);
  const main = page.locator("#main");
  await expect(
    main.getByRole("heading", { name: "Order schedule" }),
  ).toBeVisible();
  const active = main.locator(`.coverage-day[data-day="${date}"]`);
  await active.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    main.locator(`.coverage-day[data-day="${addDays(date, 1)}"]`),
  ).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(active).toBeFocused();
  await main.getByRole("tab", { name: "Lunch", exact: true }).click();
  await page.keyboard.press("ArrowRight");
  await expect(
    main.getByRole("tab", { name: "Dinner", exact: true }),
  ).toBeFocused();
  await expect(
    main.getByRole("tab", { name: "Dinner", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.setViewportSize({ width: 320, height: 740 });
  await expect(main.locator(".ops-order-table tbody tr")).toHaveCount(3);
  const wrap = main.locator(".ops-orders-panel .table-wrap");
  await wrap.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  await main
    .getByRole("button", { name: /^Details Nadia/ })
    .first()
    .click();
  await expect(
    main.getByRole("complementary", { name: "Order details" }),
  ).toBeVisible();
  await expect(
    main.getByRole("link", { name: "Update in Today" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (await new AxeBuilder({ page }).include("#main").analyze()).violations,
  ).toEqual([]);
});
