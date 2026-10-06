import { expect, test, type Page } from "@playwright/test";
import {
  addDays,
  localDay,
  type CustomerState,
  type SellerOperationsState,
} from "@catera/domain";

const cid = "10000000-0000-4000-8000-000000000001";
const sizes = [
  [1920, 1080],
  [1920, 1200],
  [1280, 800],
  [390, 844],
] as const;
async function login(page: Page, role: string) {
  expect(
    (await page.request.post("/api/v1/auth/demo", { data: { role } })).ok(),
  ).toBe(true);
}
async function populatedSeller(page: Page) {
  for (const delta of [-1, 1, 0, 2, 3]) {
    const date = addDays(localDay(), delta);
    const state: SellerOperationsState = (
      await (
        await page.request.get(`/api/v1/seller/${cid}?date=${date}`)
      ).json()
    ).data;
    if (state.deliveries.length) return state;
  }
  throw new Error("Synthetic demo has no nearby populated seller day");
}

for (const [width, height] of sizes)
  for (const locale of ["id", "en"]) {
    const suffix = `${width}x${height}-${locale}`;
    const t = (id: string, en: string) => (locale === "id" ? id : en);
    // Each case explicitly sets its own locale; shared fixtures never change business data.
    if (width >= 1100)
      test(`attention drawer retains order geometry and distinguishes cases: ${suffix}`, async ({
        page,
        context,
        baseURL,
      }) => {
        await context.addCookies([
          { name: "catera_locale", value: locale, url: baseURL! },
        ]);
        await page.setViewportSize({ width, height });
        await login(page, "owner");
        const state = await populatedSeller(page);
        const date = state.deliveries[0].service_date;
        const items = Array.from({ length: 20 }, (_, i) => ({
          id: `case-${String(i + 1).padStart(8, "0")}-0000-4000-8000-000000000001`,
          kind: "support",
          priority: 1,
          context: `Synthetic customer ${i + 1}: delivery address correction`,
          packageName: state.deliveries[0].offer.name,
          at_time: "2026-10-06T01:00:00Z",
          href: `/seller/support?case=${i + 1}`,
        }));
        await page.route(`**/api/v1/seller/${cid}*`, (r) =>
          r.fulfill({
            json: {
              data: {
                ...state,
                today: date,
                cases: items.map((item, i) => ({
                  ...state.cases[0],
                  id: item.id.replace("case-", ""),
                  customerName: `Recipient ${i + 1}`,
                })),
              },
            },
          }),
        );
        await page.route("**/api/v1/seller-attention/**", (r) =>
          r.fulfill({
            json: {
              data: {
                timezone: "Asia/Jakarta",
                total: items.length,
                items,
                nextCursor: null,
              },
            },
          }),
        );
        await page.goto(`/seller?date=${date}`);
        const row = page
          .locator(".ops-order-table tbody tr:not(.ops-group-heading)")
          .first();
        await expect(row).toBeVisible();
        const before = (await row.boundingBox())!;
        await page
          .getByRole("button", {
            name: t("Lihat masalah", "View issues"),
            exact: true,
          })
          .click();
        const drawer = page.getByRole("dialog", { name: /20/ });
        await expect(drawer).toContainText(items[1].context);
        await expect(drawer).toContainText("00000002");
        await expect(drawer).toContainText("Recipient 2");
        await expect(drawer).toContainText("Asia/Jakarta");
        expect(Math.abs((await row.boundingBox())!.y - before.y)).toBeLessThan(
          2,
        );
        await drawer
          .getByRole("button", { name: /Lihat semua masalah|View all issues/ })
          .click();
        await expect(drawer.locator(".attention-item")).toHaveCount(20);
        await drawer
          .locator(".attention-item")
          .last()
          .getByRole("link")
          .focus();
        await expect(
          drawer.locator(".attention-item").last().getByRole("link"),
        ).toBeFocused();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.keyboard.press("Escape");
        await expect(drawer).toHaveCount(0);
        await expect(
          page.getByRole("button", {
            name: t("Lihat masalah", "View issues"),
            exact: true,
          }),
        ).toBeFocused();
        await page
          .getByRole("button", {
            name: t("Lihat masalah", "View issues"),
            exact: true,
          })
          .click();
        await page.setViewportSize({ width: Math.floor(width / 2), height });
        await page.keyboard.press("Escape");
        await expect(
          page.locator(".seller-attention > .section-heading h2"),
        ).toBeFocused();
        const visibleHeading = page.locator(
          ".seller-attention > .section-heading h2",
        );
        let bounds = await visibleHeading.boundingBox();
        // Integer scroll positions can round fractional CSS bounds by less than 1px.
        expect(bounds!.y).toBeGreaterThanOrEqual(-1);
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height + 1);
        await page.setViewportSize({ width, height });
        await page
          .getByRole("button", {
            name: t("Lihat masalah", "View issues"),
            exact: true,
          })
          .click();
        await page.setViewportSize({ width: 390, height: 844 });
        await page.keyboard.press("Escape");
        await expect(visibleHeading).toBeFocused();
        bounds = await visibleHeading.boundingBox();
        expect(bounds!.y).toBeGreaterThanOrEqual(-1);
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(845);
      });

    test(`schedule review and expired exit retain meaningful keyboard focus: ${suffix}`, async ({
      page,
      context,
      baseURL,
    }) => {
      await context.addCookies([
        { name: "catera_locale", value: locale, url: baseURL! },
      ]);
      await page.setViewportSize({ width, height });
      await login(page, "customer");
      const state: CustomerState = (
        await (await page.request.get("/api/v1/customer")).json()
      ).data;
      const original = state.deliveries[0];
      const start = Date.now();
      await page.clock.install({ time: new Date(start) });
      await page.route("**/api/v1/customer?deliveryId=*", (r) =>
        r.fulfill({
          json: {
            data: {
              ...state,
              deliveries: [
                {
                  ...original,
                  status: "scheduled",
                  canChange: true,
                  cutoff_at: new Date(start + 60000).toISOString(),
                  offer: { ...original.offer, flexible: true },
                },
              ],
            },
          },
        }),
      );
      await page.route("**/api/v1/availability/**", (r) =>
        r.fulfill({
          json: {
            data: [
              {
                date: addDays(original.service_date, 7),
                available: true,
                reason: null,
              },
            ],
          },
        }),
      );
      await page.route("**/api/v1/commands", (r) =>
        r.fulfill({ status: 409, json: { error: { code: "CONFLICT" } } }),
      );
      await page.goto(`/deliveries/${original.id}`);
      await page
        .getByRole("button", {
          name: t("Ubah jadwal", "Change schedule"),
          exact: true,
        })
        .click();
      const review = page.getByRole("button", {
        name: t("Tinjau perubahan", "Review change"),
        exact: true,
      });
      await review.focus();
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("heading", {
          name: t("Tinjau jadwal baru", "Review the new schedule"),
        }),
      ).toBeFocused();
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("button", {
          name: t("Tanggal pengganti", "Replacement date"),
          exact: true,
        }),
      ).toHaveCount(0);
      await dialog
        .getByRole("button", {
          name: t("Ubah tanggal pilihan", "Edit selected date"),
          exact: true,
        })
        .click();
      await expect(
        dialog.getByRole("button", {
          name: t("Tanggal pengganti", "Replacement date"),
          exact: true,
        }),
      ).toBeFocused();
      await review.click();
      if (width >= 1280) {
        const action = await dialog
          .getByRole("button", {
            name: t("Konfirmasi perubahan jadwal", "Confirm schedule change"),
            exact: true,
          })
          .boundingBox();
        expect(action!.y + action!.height).toBeLessThanOrEqual(height - 16);
      }
      await page
        .getByRole("button", {
          name: t("Konfirmasi perubahan jadwal", "Confirm schedule change"),
          exact: true,
        })
        .click();
      await expect(page.getByRole("dialog")).toContainText(
        t("Status pengantaran sudah dimuat ulang", "Delivery status refreshed"),
      );
      await expect(
        page.getByRole("dialog").locator("form .notice.error"),
      ).toHaveCount(0);
      await expect(review).toBeEnabled();
      await review.click();
      await page.clock.fastForward(61000);
      const notice = page.getByRole("dialog").getByRole("alert").first();
      await expect(notice).toBeFocused();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: t("Tutup", "Close"), exact: true })
        .last()
        .click();
      await expect(
        page.getByRole("heading", {
          name: t("Kelola pengantaran", "Manage delivery"),
        }),
      ).toBeFocused();
    });

    test(`final delivery requires receipt acknowledgement and resets after conflict: ${suffix}`, async ({
      page,
      context,
      baseURL,
    }) => {
      await context.addCookies([
        { name: "catera_locale", value: locale, url: baseURL! },
      ]);
      await page.setViewportSize({ width, height });
      await login(page, "owner");
      const state = await populatedSeller(page);
      const date = state.deliveries[0].service_date;
      const deliveries = state.deliveries.map((d) => ({
        ...d,
        status: "out_for_delivery",
        meals: d.meals.map((m) => ({ ...m, status: "out_for_delivery" })),
      }));
      let failedRead = false;
      await page.route(`**/api/v1/seller/${cid}*`, (r) =>
        failedRead
          ? r.fulfill({
              status: 503,
              json: { error: { code: "REQUEST_FAILED" } },
            })
          : r.fulfill({
              json: { data: { ...state, today: date, deliveries } },
            }),
      );
      let commands = 0;
      await page.route("**/api/v1/commands", async (r) => {
        commands++;
        await new Promise((resolve) => setTimeout(resolve, 650));
        failedRead = true;
        return r.fulfill({
          status: 409,
          json: { error: { code: "CONFLICT" } },
        });
      });
      await page.goto(`/seller?date=${date}&meal=lunch`);
      await page.locator(".order-next").first().click();
      const dialog = page.getByRole("dialog", {
        name: t("Konfirmasi makanan diterima", "Confirm meals received"),
      });
      const confirm = dialog.getByRole("button", {
        name: t("Tandai diterima", "Mark received"),
        exact: true,
      });
      await expect(
        dialog.getByRole("heading", {
          name: t("Konfirmasi makanan diterima", "Confirm meals received"),
        }),
      ).toBeFocused();
      await expect(confirm).toBeDisabled();
      if (width === 390) {
        const header = await dialog.getByRole("heading").boundingBox();
        const panel = await dialog.boundingBox();
        expect(header!.y - panel!.y).toBeGreaterThanOrEqual(16);
        expect(await dialog.evaluate((element) => element.scrollTop)).toBe(0);
      }
      await expect(dialog).toContainText(
        t("seluruh waktu makannya selesai", "all its meals are complete"),
      );
      expect(commands).toBe(0);
      await dialog.getByRole("checkbox").check();
      await confirm.click();
      await expect(dialog).toHaveAttribute("aria-busy", "true");
      await expect(dialog.getByRole("heading")).toBeFocused();
      await expect(dialog).toHaveCount(0);
      expect(commands).toBe(1);
      await expect(
        page.locator(".ops-orders-panel .notice.error"),
      ).toBeFocused();
      failedRead = false;
      await page
        .locator(".ops-orders-panel .notice.error")
        .getByRole("button")
        .click();
      await page.locator(".order-next").first().click();
      await expect(confirm).toBeDisabled();
      await expect(dialog.getByRole("checkbox")).not.toBeChecked();
    });
  }
