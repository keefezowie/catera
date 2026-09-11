import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { addDays, localDay } from "../../packages/domain/src/index";

const evidenceDir = process.env.CATERA_CALENDAR_EVIDENCE || "output/meal-calendar";

test("picker has one date Tab stop, full keyboard navigation and usable mobile text entry", async ({
  page,
}) => {
  await login(page);
  await jump(page, "2028-01-31");
  await page.locator(".calendar-month-button").click();
  await expect(page.locator('[data-picker-day="2028-01-31"]')).toBeFocused();
  await expect(
    page.locator('.calendar-picker-grid button[tabindex="0"]'),
  ).toHaveCount(1);
  await page.keyboard.press("PageDown");
  await expect(page.locator('[data-picker-day="2028-02-29"]')).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.locator('[data-picker-day="2028-02-28"]')).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.locator('[data-picker-day="2028-03-05"]')).toBeFocused();
  await page.keyboard.press("PageUp");
  await expect(page.locator('[data-picker-day="2028-02-05"]')).toBeFocused();
  await page.keyboard.press("Shift+PageDown");
  await expect(page.locator('[data-picker-day="2029-02-05"]')).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Langsung ke tanggal")).toBeFocused();
  await expect(page.getByLabel("Langsung ke tanggal")).toHaveAttribute(
    "inputmode",
    "text",
  );
  await page.getByLabel("Langsung ke tanggal").fill("2028-02-29");
  await page.keyboard.press("Enter");
  await expect(page.locator(".coverage-day.is-selected")).toHaveAttribute(
    "data-day",
    "2028-02-29",
  );
  await page.setViewportSize({ width: 320, height: 740 });
  await page.locator(".calendar-month-button").click();
  const sizes = await page
    .locator(".calendar-picker-grid button")
    .evaluateAll((elements) =>
      elements.map((el) => {
        const r = el.getBoundingClientRect();
        return { width: r.width, height: r.height };
      }),
    );
  expect(sizes.every((r) => r.width >= 44 && r.height >= 44)).toBe(true);
  mkdirSync(evidenceDir, { recursive: true });
  await page.screenshot({ path: `${evidenceDir}/picker-320.png` });
  await page.keyboard.press("Escape");
  await expect(page.locator(".calendar-month-button")).toBeFocused();
});

async function login(page: Page) {
  await page.request.post("/api/v1/auth/demo", { data: { role: "customer" } });
  await page.goto("/calendar");
  await expect(page.locator(".coverage-summary")).toContainText(
    "hari dengan makan siang",
  );
}
async function jump(page: Page, day: string) {
  await page.locator(".calendar-month-button").click();
  await page.getByLabel("Langsung ke tanggal").fill(day);
  await page.getByRole("button", { name: "Lihat", exact: true }).click();
  await expect(page.locator(`[data-day="${day}"]`)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
}

test("day cards layer all meal coverage states with today and selection", async ({
  page,
}) => {
  await page.request.post("/api/v1/auth/demo", { data: { role: "customer" } });
  const original = (await (await page.request.get("/api/v1/customer")).json())
    .data;
  const template = original.deliveries[0];
  const today = localDay();
  const coverageDays = {
    none: addDays(today, -1),
    both: today,
    lunch: addDays(today, 1),
    dinner: addDays(today, 2),
  };
  const records = [
    {
      ...template,
      id: "coverage-cancelled",
      service_date: coverageDays.none,
      status: "cancelled",
    },
    {
      ...template,
      id: "coverage-both",
      service_date: coverageDays.both,
      meals: [
        { meal: "lunch", status: "scheduled" },
        { meal: "dinner", status: "scheduled" },
      ],
    },
    {
      ...template,
      id: "coverage-lunch",
      service_date: coverageDays.lunch,
      meals: [
        { meal: "lunch", status: "scheduled" },
        { meal: "dinner", status: "cancelled" },
      ],
    },
    {
      ...template,
      id: "coverage-lunch-second-package",
      service_date: coverageDays.lunch,
      meals: [
        { meal: "lunch", status: "scheduled" },
        { meal: "dinner", status: "cancelled" },
      ],
    },
    {
      ...template,
      id: "coverage-dinner",
      service_date: coverageDays.dinner,
      meals: [
        { meal: "lunch", status: "cancelled" },
        { meal: "dinner", status: "scheduled" },
      ],
    },
  ];
  await page.route("**/api/v1/customer?**", async (route) => {
    const url = new URL(route.request().url());
    const from = url.searchParams.get("from")!;
    const to = url.searchParams.get("to")!;
    await route.fulfill({
      json: {
        data: {
          ...original,
          deliveries: records.filter(
            (delivery) =>
              delivery.service_date >= from && delivery.service_date <= to,
          ),
          calendarMeta: {
            nextDeliveryDate: coverageDays.both,
            lastUpcomingDeliveryDate: coverageDays.dinner,
          },
        },
      },
    });
  });
  await page.goto("/calendar");
  await expect(page.locator(".coverage-summary")).toContainText(
    "hari dengan makan siang",
  );

  for (const [coverage, day] of Object.entries(coverageDays))
    await expect(page.locator(`[data-day="${day}"]`)).toHaveAttribute(
      "data-coverage",
      coverage,
    );

  const none = page.locator(`[data-day="${coverageDays.none}"]`);
  await expect(page.locator(".coverage-rail")).toHaveCount(0);
  await expect(none.locator(".coverage-state-text")).toHaveText(
    "Belum ada makan",
  );
  await expect(none.locator(".coverage-meal-icons")).toHaveCount(0);
  await expect(none.locator(".coverage-package-count")).toHaveCount(0);

  const lunch = page.locator(`[data-day="${coverageDays.lunch}"]`);
  await expect(lunch.locator('[data-meal="lunch"]')).toHaveCount(1);
  await expect(lunch.locator('[data-meal="lunch"]')).toHaveCSS(
    "color",
    "rgb(244, 123, 42)",
  );
  await expect(lunch.locator('[data-meal="dinner"]')).toHaveCount(0);
  await expect(lunch.locator(".coverage-package-count")).toHaveText("2 paket");

  const dinner = page.locator(`[data-day="${coverageDays.dinner}"]`);
  await expect(dinner.locator('[data-meal="lunch"]')).toHaveCount(0);
  await expect(dinner.locator('[data-meal="dinner"]')).toHaveCount(1);
  await expect(dinner.locator('[data-meal="dinner"]')).toHaveCSS(
    "color",
    "rgb(22, 61, 46)",
  );
  await expect(dinner.locator(".coverage-package-count")).toHaveText("1 paket");

  const selectedToday = page.locator(`[data-day="${coverageDays.both}"]`);
  await expect(selectedToday.locator('[data-meal="lunch"]')).toHaveCount(1);
  await expect(selectedToday.locator('[data-meal="dinner"]')).toHaveCount(1);
  await expect(selectedToday.locator(".coverage-package-count")).toHaveText(
    "1 paket",
  );
  await expect(selectedToday).toHaveClass(/is-selected/);
  await expect(selectedToday).toHaveClass(/is-today/);
  await expect(selectedToday).toHaveCSS(
    "background-color",
    "rgb(237, 241, 230)",
  );
  await expect(selectedToday).toHaveCSS("border-top-width", "2px");
  await expect(selectedToday).toHaveCSS("border-top-color", "rgb(22, 61, 46)");
  await expect(selectedToday.locator(".coverage-day-top")).toHaveCSS(
    "color",
    "rgb(155, 67, 9)",
  );
  await expect(selectedToday).toHaveCSS("min-height", "120px");

  mkdirSync(evidenceDir, { recursive: true });
  await page.screenshot({
    path: `${evidenceDir}/calendar-states-1440.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(selectedToday).toHaveCSS("min-height", "116px");
  await page.screenshot({
    path: `${evidenceDir}/calendar-states-390.png`,
    fullPage: true,
  });

  await page.getByRole("combobox", { name: "Bahasa", exact: true }).click();
  await page.getByRole("option", { name: "English", exact: true }).click();
  await expect(selectedToday).toHaveAttribute(
    "aria-label",
    /Lunch: scheduled\. Dinner: scheduled/,
  );
  await expect(selectedToday.locator(".coverage-package-count")).toHaveText(
    "1 package",
  );

  await lunch.hover();
  await expect(lunch).toHaveCSS("background-color", "rgb(240, 243, 233)");
  await selectedToday.focus();
  await page.keyboard.press("ArrowRight");
  await expect(lunch).toBeFocused();
  await expect(lunch).toHaveAttribute("aria-pressed", "false");
  await expect(lunch).toHaveCSS("outline-color", "rgb(182, 91, 19)");
});

test("continuous navigation keeps selection and anchors stable, and restores after delivery details", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  const today = localDay(),
    tomorrow = addDays(today, 1),
    strip = page.locator(".coverage-strip");
  const before = await strip.evaluate((el) => el.scrollLeft);
  await page.locator(`[data-day="${tomorrow}"]`).click();
  expect(
    Math.abs((await strip.evaluate((el) => el.scrollLeft)) - before),
  ).toBeLessThan(2);
  await page
    .getByRole("button", { name: "Tanggal berikutnya", exact: true })
    .click();
  await expect
    .poll(() => strip.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(before + 300);
  await expect(page.locator(`[data-day="${tomorrow}"]`)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // Force both moving-window boundaries. The visible cell must not move during recycling.
  for (const i of [120, 5]) {
    const anchor = await strip.evaluate((el, i) => {
      const buttons = Array.from(
        el.querySelectorAll<HTMLButtonElement>("[data-day]"),
      );
      const target = buttons[i];
      el.scrollLeft = target.offsetLeft;
      return { day: target.dataset.day!, x: target.getBoundingClientRect().x };
    }, i);
    await expect
      .poll(() =>
        strip
          .locator(`[data-day="${anchor.day}"]`)
          .evaluate((el) => el.getBoundingClientRect().x),
      )
      .toBeCloseTo(anchor.x, 0);
    await expect(strip.locator("[data-day]")).toHaveCount(151);
    await page.waitForTimeout(100);
  }
  await jump(page, "2028-02-29");
  await expect(page.locator(".calendar-details > h2")).toContainText(
    "29 Februari",
  );
  await page.locator(".calendar-month-button").click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".calendar-month-button")).toBeFocused();
  await page.getByRole("button", { name: "Hari ini", exact: true }).click();
  await expect(page.locator(`[data-day="${today}"]`)).toHaveAttribute(
    "aria-current",
    "date",
  );
  await page.locator(".calendar-next").click();
  await expect(page.locator(".calendar-delivery-row").first()).toBeVisible();
  const selected = await page
    .locator(".coverage-day.is-selected")
    .getAttribute("data-day");
  await page.locator(".calendar-delivery-row").first().click();
  await expect(page).toHaveURL(/\/deliveries\//);
  await page.goBack();
  await expect(page.locator(".coverage-day.is-selected")).toHaveAttribute(
    "data-day",
    selected!,
  );
  await page.getByRole("button", { name: "Mendatang", exact: true }).click();
  await expect(page.locator(".calendar-agenda-day").first()).toBeVisible();
  await page.locator(`[data-day="${today}"]`).click();
  await expect(
    page.getByRole("button", { name: "Per hari", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});

test("Hari ini requests a smooth centered scroll and respects reduced motion", async ({
  page,
}) => {
  await login(page);
  const today = localDay();
  await page.locator(".coverage-strip").evaluate((strip) => {
    const original = strip.scrollTo.bind(strip);
    const testWindow = window as typeof window & {
      calendarScrolls?: ScrollToOptions[];
    };
    testWindow.calendarScrolls = [];
    strip.scrollTo = (options?: ScrollToOptions | number, y?: number) => {
      if (typeof options === "object")
        testWindow.calendarScrolls!.push(options);
      return typeof options !== "number"
        ? original(options)
        : original(options, y || 0);
    };
  });
  await page.getByRole("button", { name: "Hari ini", exact: true }).click();
  const smooth = await page.evaluate(() =>
    (
      window as typeof window & { calendarScrolls?: ScrollToOptions[] }
    ).calendarScrolls?.at(-1),
  );
  expect(smooth?.behavior).toBe("smooth");
  const expectedLeft = await page
    .locator(".coverage-strip")
    .evaluate((strip, today) => {
      const target = strip.querySelector<HTMLElement>(`[data-day="${today}"]`)!;
      return target.offsetLeft - (strip.clientWidth - target.offsetWidth) / 2;
    }, today);
  expect(smooth?.left).toBeCloseTo(expectedLeft, 0);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Hari ini", exact: true }).click();
  const reduced = await page.evaluate(() =>
    (
      window as typeof window & { calendarScrolls?: ScrollToOptions[] }
    ).calendarScrolls?.at(-1),
  );
  expect(reduced?.behavior).toBe("auto");
});

test("desktop and phone are accessible, localized and free of page overflow", async ({
  page,
}) => {
  await login(page);
  mkdirSync(evidenceDir, { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.getByRole("button", { name: "Hari ini", exact: true }).click();
    await expect(page.locator(".calendar-details > h2")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const audit = await new AxeBuilder({ page })
      .include(".calendar-page")
      .analyze();
    expect(
      audit.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact || ""),
      ),
    ).toEqual([]);
    await page.screenshot({
      path: `${evidenceDir}/calendar-${width}.png`,
      fullPage: true,
    });
    await page.locator(".calendar-month-button").click();
    await expect(page.locator("#calendar-date-picker")).toBeVisible();
    const pickerAudit = await new AxeBuilder({ page })
      .include("#calendar-date-picker")
      .analyze();
    expect(
      pickerAudit.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact || ""),
      ),
    ).toEqual([]);
    await page.screenshot({ path: `${evidenceDir}/picker-${width}.png` });
    await page.keyboard.press("Escape");
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("combobox", { name: "Bahasa", exact: true }).click();
  await page.getByRole("option", { name: "English", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Today", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".coverage-summary")).toContainText(
    "days with lunch",
  );
});

test("failed month data is never shown as empty coverage and retry recovers", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/api/v1/customer?**", async (route) => {
    if (fail)
      await route.fulfill({
        status: 503,
        json: { error: { code: "REQUEST_FAILED" } },
      });
    else await route.continue();
  });
  await page.request.post("/api/v1/auth/demo", { data: { role: "customer" } });
  await page.goto("/calendar");
  await expect(page.locator(".calendar-load-error")).toContainText(
    "belum berhasil dimuat",
  );
  await expect(page.locator(".coverage-day.is-selected")).toHaveAttribute(
    "aria-label",
    /gagal dimuat/,
  );
  await expect(page.locator(".coverage-day.is-selected")).not.toHaveAttribute(
    "data-coverage",
    /.+/,
  );
  await expect(
    page.locator(".coverage-day.is-selected .coverage-state-text"),
  ).toHaveText("Gagal dimuat");
  await expect(
    page.locator(".coverage-day.is-selected .coverage-meal-icons"),
  ).toHaveCount(0);
  await expect(
    page.locator(".coverage-day.is-selected .coverage-package-count"),
  ).toHaveCount(0);
  await expect(page.locator(".coverage-summary")).not.toContainText(
    "0 hari dengan",
  );
  fail = false;
  await page.getByRole("button", { name: "Coba lagi", exact: true }).click();
  await expect(page.locator(".coverage-summary")).toContainText(
    "hari dengan makan siang",
  );
  await expect(page.locator(".calendar-load-error")).toHaveCount(0);
});

test("distant jumps and delayed responses preserve the selected meal and chronological agenda", async ({
  page,
}) => {
  await page.request.post("/api/v1/auth/demo", { data: { role: "customer" } });
  const original = (await (await page.request.get("/api/v1/customer")).json())
    .data;
  const template = original.deliveries[0];
  const records = [
    {
      ...template,
      id: "synthetic-feb",
      service_date: "2028-02-29",
      meals: [
        { meal: "lunch", status: "delivered" },
        { meal: "dinner", status: "scheduled" },
      ],
    },
    {
      ...template,
      id: "synthetic-mar",
      service_date: "2028-03-01",
      meals: [
        { meal: "lunch", status: "scheduled" },
        { meal: "dinner", status: "cancelled" },
      ],
    },
  ];
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/customer?**", async (route) => {
    const url = new URL(route.request().url()),
      from = url.searchParams.get("from")!,
      to = url.searchParams.get("to")!;
    if (from === "2028-02-01") await delayed;
    await route.fulfill({
      json: {
        data: {
          ...original,
          deliveries: records.filter(
            (d) => d.service_date >= from && d.service_date <= to,
          ),
          calendarMeta: {
            nextDeliveryDate: "2028-02-29",
            lastUpcomingDeliveryDate: "2028-03-01",
          },
        },
      },
    });
  });
  await page.goto("/calendar");
  await expect(page.locator(".calendar-next")).toBeVisible();
  await page.locator(".calendar-next").click();
  await expect(page.locator(".coverage-day.is-selected")).toHaveAttribute(
    "data-day",
    "2028-02-29",
  );
  await expect(page.locator(".coverage-day.is-selected")).toHaveAttribute(
    "aria-label",
    /memuat/,
  );
  await expect(
    page.locator(".coverage-day.is-selected .coverage-state-text"),
  ).toHaveText("Memuat…");
  await expect(
    page.locator(".coverage-day.is-selected .coverage-meal-icons"),
  ).toHaveCount(0);
  await expect(
    page.locator(".coverage-day.is-selected .coverage-package-count"),
  ).toHaveCount(0);
  await jump(page, "2028-03-01");
  await expect(
    page.locator(".calendar-details .calendar-delivery-row"),
  ).toHaveCount(2);
  release();
  await expect(page.locator(".coverage-summary")).toContainText(
    "2 hari dengan makan siang · 1 hari dengan makan malam",
  );
  await expect(page.locator(".coverage-day.is-selected")).toHaveAttribute(
    "data-day",
    "2028-03-01",
  );
  await expect(page.locator(".calendar-details > h2")).toContainText("1 Maret");
  await page.getByRole("button", { name: "Mendatang", exact: true }).click();
  // The explicit month pagination reaches distant bookings without inferring empty months as missing data.
  while (
    await page
      .getByRole("button", { name: "Muat bulan berikutnya" })
      .isVisible()
  ) {
    await page.getByRole("button", { name: "Muat bulan berikutnya" }).click();
  }
  await expect(page.locator(".calendar-agenda-day")).toHaveCount(2);
  const agenda = page.locator(".calendar-agenda-day");
  await expect(agenda.nth(0)).toContainText("29 Februari 2028");
  await expect(agenda.nth(1)).toContainText("1 Maret 2028");
  await expect(agenda.nth(0).locator(".calendar-delivery-row")).toHaveCount(1);
  await expect(agenda.nth(1).locator(".calendar-delivery-row")).toHaveCount(1);
});
