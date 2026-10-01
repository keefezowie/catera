import { test, expect, type Page } from "@playwright/test";
import {
  addDays,
  localDay,
  purchaseStartAvailable,
  type Offer,
} from "@catera/domain";
import { mkdir } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";

const evidence = "output/playwright/impeccable";
test.use({ reducedMotion: "reduce" });
test.beforeAll(() => mkdir(evidence, { recursive: true }));
async function login(page: Page, role: string) {
  expect(
    (await page.request.post("/api/v1/auth/demo", { data: { role } })).ok(),
  ).toBe(true);
}

for (const locale of ["id", "en"] as const) {
  const t = (id: string, en: string) => (locale === "id" ? id : en);
  test.describe(locale, () => {
    test.beforeEach(async ({ context, baseURL, page }) => {
      await context.addCookies([
        { name: "catera_locale", value: locale, url: baseURL! },
      ]);
      await page.setViewportSize({ width: 390, height: 844 });
    });

    test("home leads with the next meal, sorts lunch before dinner, and retains both deadline groups", async ({
      page,
    }) => {
      await login(page, "customer");
      const customer = (
        await (await page.request.get("/api/v1/customer")).json()
      ).data;
      const base = customer.deliveries[0];
      expect(base).toBeTruthy();
      const day = addDays(localDay(), 3);
      const deliveries = [
        {
          ...base,
          id: "00000000-0000-4000-8000-000000000001",
          service_date: day,
          status: "scheduled",
          meals: [{ meal: "dinner", status: "scheduled" }],
          offer: { ...base.offer, name: "Synthetic dinner" },
        },
        {
          ...base,
          id: "ffffffff-0000-4000-8000-000000000001",
          service_date: day,
          status: "scheduled",
          meals: [{ meal: "lunch", status: "scheduled" }],
          offer: { ...base.offer, name: "Synthetic lunch" },
        },
      ];
      await page.route("**/api/v1/customer?**", (route) =>
        route.fulfill({ json: { data: { ...customer, deliveries } } }),
      );
      const actions = [
        {
          id: "future",
          kind: "menu_choice_due",
          status: "selection_due",
          priority: 2,
          dueAt: addDays(localDay(), 8) + "T17:00:00+07:00",
          packageName: "Synthetic future menu",
          href: "/calendar",
        },
      ];
      await page.route("**/api/v1/customer-actions?**", (route) =>
        route.fulfill({
          json: { data: { items: actions, total: actions.length } },
        }),
      );
      await page.goto("/home");
      const next = page.locator(".home-page > .next-meal-card");
      await expect(next).toContainText("Synthetic lunch");
      await expect(
        page
          .locator(".date-agenda-group")
          .first()
          .locator(".home-agenda-row strong"),
      ).toHaveText(["Synthetic lunch", "Synthetic dinner"]);
      expect((await next.boundingBox())!.y).toBeLessThan(300);
      await expect(page.locator(".customer-actions.urgent")).toHaveCount(0);
      await expect(page.locator(".customer-actions.later")).toContainText(
        "Synthetic future menu",
      );
      expect(
        await page
          .locator(".customer-actions.later")
          .evaluate(
            (el) =>
              !!(
                el.compareDocumentPosition(
                  document.querySelector(".date-agenda")!,
                ) & Node.DOCUMENT_POSITION_PRECEDING
              ),
          ),
      ).toBe(true);
      await page.screenshot({
        path: `${evidence}/home-priority-after-${locale}.png`,
        fullPage: true,
      });
      actions.push({
        ...actions[0],
        id: "urgent",
        dueAt: localDay() + "T17:00:00+07:00",
        packageName: "Synthetic urgent menu",
      });
      await page.reload();
      await expect(page.locator(".customer-actions.urgent")).toContainText(
        "Synthetic urgent menu",
      );
      await expect(page.locator(".customer-actions.urgent")).not.toContainText(
        "Synthetic future menu",
      );
      await expect(page.locator(".customer-actions.later")).toContainText(
        "Synthetic future menu",
      );
      const axe = await new AxeBuilder({ page })
        .include("main")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(
        axe.violations.filter((v) =>
          ["serious", "critical"].includes(v.impact || ""),
        ),
      ).toEqual([]);
    });

    test("phone seller filters retain values and empty attention can expand", async ({
      page,
    }) => {
      await login(page, "owner");
      await page.route("**/api/v1/seller-attention/**", async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        await route.fulfill({
          response,
          json: {
            ...body,
            data: { ...body.data, items: [], total: 0, nextCursor: null },
          },
        });
      });
      await page.goto("/seller");
      const toggle = page.getByRole("button", {
        name: t("Filter pesanan", "Order filters"),
        exact: true,
      });
      const search = page.getByRole("searchbox", {
        name: t("Cari pesanan", "Search orders"),
      });
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(search).not.toBeVisible();
      await toggle.click();
      await search.fill("Synthetic retained filter");
      await page
        .getByRole("button", {
          name: new RegExp(t("Filter pesanan", "Order filters")),
        })
        .click();
      await expect(search).not.toBeVisible();
      await page
        .getByRole("button", {
          name: new RegExp(t("Filter pesanan", "Order filters")),
        })
        .click();
      await expect(search).toHaveValue("Synthetic retained filter");
      await page
        .getByRole("region", { name: t("Cakupan pesanan", "Order scope") })
        .getByRole("button", {
          name: t("Hapus filter", "Clear filters"),
          exact: true,
        })
        .click();
      const attention = page.getByRole("region", {
        name: t("Perlu perhatian", "Needs attention"),
        exact: true,
      });
      const scope = attention.getByRole("button", {
        name: t("Filter masalah", "Filter issues"),
      });
      await expect(scope).toBeVisible();
      await expect(
        attention.getByRole("button", {
          name: t("Semua tanggal", "All dates"),
          exact: true,
        }),
      ).not.toBeVisible();
      await scope.click();
      await expect(scope).toHaveAttribute("aria-expanded", "true");
      await attention
        .getByRole("button", {
          name: t("Semua tanggal", "All dates"),
          exact: true,
        })
        .click();
      await expect(
        attention.locator('.attention-scope [aria-pressed="true"]'),
      ).toContainText(t("Semua tanggal", "All dates"));
      await page.goto("/seller");
      await expect(page.locator(".ops-workload")).toBeVisible();
      const orders = page.locator(".ops-workload-heading").getByRole("link", {
        name: t("Lihat pesanan", "View orders"),
        exact: true,
      });
      await expect(orders).toBeInViewport();
      await orders.click();
      await expect(page.locator("#ops-orders")).toBeFocused();
      await expect(page.locator("#ops-orders")).toBeInViewport();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `${evidence}/seller-priority-after-${locale}.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });

    test("support cases expose distinct customer and purchase context before a financial decision", async ({
      page,
    }) => {
      await login(page, "platform_admin");
      const state = (await (await page.request.get("/api/v1/admin")).json())
        .data;
      const purchase = state.transactions[0];
      expect(purchase).toBeTruthy();
      const base = {
        id: "10000000-0000-4000-8000-000000000111",
        subject: "Synthetic identical subject",
        description: "Synthetic context verification",
        status: "open",
        created_at: new Date().toISOString(),
        caterer_id: purchase.quote.offer.catererId,
        checkout_id: purchase.id,
        subscription_id: null,
        delivery_id: null,
        user_id: null,
        resolution: null,
        amount: null,
      };
      await page.route("**/api/v1/admin", (route) =>
        route.fulfill({
          json: {
            data: {
              ...state,
              cases: [
                { ...base, customerName: "Synthetic Nadia" },
                {
                  ...base,
                  id: "10000000-0000-4000-8000-000000000222",
                  customerName: "Synthetic Rina",
                },
              ],
            },
          },
        }),
      );
      await page.goto("/admin/support");
      await page
        .getByRole("button", {
          name: /Synthetic identical subject Synthetic Nadia/,
        })
        .click();
      await expect(page.locator(".support-case-context")).toContainText(
        "Synthetic Nadia",
      );
      await expect(page.locator(".support-case-context")).toContainText(
        purchase.quote.offer.name,
      );
      await expect(page.locator(".support-case-context")).toContainText(
        purchase.quote.offer.caterer,
      );
      await page
        .getByRole("textbox", {
          name: t("Alasan keputusan", "Decision reason"),
        })
        .fill("Synthetic first record draft");
      await page
        .getByRole("button", {
          name: /Synthetic identical subject Synthetic Rina/,
        })
        .click();
      await expect(page.locator(".support-case-context")).toContainText(
        "Synthetic Rina",
      );
      await expect(
        page.getByRole("textbox", {
          name: t("Alasan keputusan", "Decision reason"),
        }),
      ).toHaveValue("");
      await page.screenshot({
        path: `${evidence}/support-context-after-${locale}.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });

    test("overlap rejection retains checkout and offers the existing renewal route", async ({
      page,
    }) => {
      await login(page, "customer");
      const customer = (
        await (await page.request.get("/api/v1/customer")).json()
      ).data;
      const catalog = (
        await (await page.request.get("/api/v1/catalog?limit=100")).json()
      ).data.items as Offer[];
      const offer = catalog.find(
        (p) => p.id === "20000000-0000-4000-8000-000000000001",
      )!;
      expect(offer).toBeTruthy();
      const startDate = Array.from({ length: 14 }, (_, offset) =>
        addDays(localDay(), offset + 2),
      ).find((date) => purchaseStartAvailable(offer, date));
      expect(startDate).toBeTruthy();
      const subscription = customer.subscriptions.find(
        (s: any) =>
          s.package_id === offer.id &&
          s.status === "active" &&
          s.starts_on <= startDate! &&
          s.ends_on >= startDate!,
      );
      expect(subscription).toBeTruthy();
      await page.route("**/api/v1/quote", (route) =>
        route.fulfill({ status: 409, json: { error: { code: "OVERLAP" } } }),
      );
      await page.goto(
        `/checkout/${subscription.package_id}?portions=1&startDate=${startDate}`,
      );
      const date = page.getByRole("button", {
        name: t("Mulai tanggal", "Start date"),
        exact: true,
      });
      const value = await date.getAttribute("data-value");
      expect(value).toBe(startDate);
      const review = page.getByRole("button", {
        name: t("Tinjau jadwal & harga", "Review schedule & price"),
        exact: true,
      });
      await expect(review).toBeEnabled();
      await review.click();
      const recovery = page.locator(".checkout-overlap");
      await expect(recovery).toBeVisible();
      await expect(date).toHaveAttribute("data-value", value!);
      const renewal = recovery
        .getByRole("link", { name: t("Tinjau perpanjangan", "Review renewal") })
        .first();
      await expect(renewal).toHaveAttribute(
        "href",
        "/renew/" + subscription.id,
      );
      await page.screenshot({
        path: `${evidence}/overlap-recovery-after-${locale}.png`,
        fullPage: true,
      });
      await renewal.click();
      await expect(
        page.getByRole("heading", {
          name: t("Siapkan paket berikutnya", "Prepare your next package"),
        }),
      ).toBeVisible();
    });

    test("phone calendar and financial values stay readable", async ({
      page,
    }) => {
      await login(page, "customer");
      await page.goto("/calendar");
      await expect(page.locator(".mobile-bottom a").first()).toHaveCSS(
        "font-size",
        "12px",
      );
      await expect(page.locator(".coverage-state-text").first()).toHaveCSS(
        "font-size",
        "12px",
      );
      await expect(page.locator(".delivery-row small").first()).toHaveCSS(
        "font-size",
        "12px",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await login(page, "platform_admin");
      await page.goto("/admin/transactions");
      await expect(page.locator(".record-table td").first()).toHaveCSS(
        "font-size",
        "14px",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });
  });
}
