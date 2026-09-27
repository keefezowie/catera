import { test, expect, type Page, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

const evidence = "output/playwright/impeccable";
test.use({ reducedMotion: "reduce" });
test.beforeAll(() => mkdir(evidence, { recursive: true }));

async function login(page: Page, role: string) {
  const response = await page.request.post("/api/v1/auth/demo", {
    data: { role },
  });
  expect(response.ok()).toBe(true);
}

async function readableSelection(control: Locator) {
  await expect(control).toHaveCSS("background-color", "rgb(22, 61, 46)");
  await expect(control).toHaveCSS("color", "rgb(255, 247, 233)");
  await control.hover();
  await expect(control).toHaveCSS("background-color", "rgb(22, 61, 46)");
  await expect(control).toHaveCSS("color", "rgb(255, 247, 233)");
  await control.press("Tab");
  await control.page().keyboard.press("Shift+Tab");
  await expect(control).toBeFocused();
  await expect(control).not.toHaveCSS("outline-style", "none");
}

for (const locale of ["id", "en"] as const) {
  test.describe(locale, () => {
    test.beforeEach(async ({ context, baseURL }) => {
      await context.addCookies([
        { name: "catera_locale", value: locale, url: baseURL! },
      ]);
    });
    const t = (id: string, en: string) => (locale === "id" ? id : en);

    test("selected seller filters stay readable through hover and focus", async ({
      page,
    }) => {
      await login(page, "owner");
      await page.goto("/seller");
      const date = page.getByRole("button", {
        name: t("Tanggal operasional", "Operational date"),
        exact: true,
      });
      await expect(date).toHaveCSS("border-width", "1px");
      await expect(date).toHaveCSS("border-style", "solid");
      await date.hover();
      await expect(date).toHaveCSS("border-color", "rgb(22, 61, 46)");
      await date.click();
      await expect(page.locator(".date-picker-popover")).toBeVisible();
      await expect(date).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Escape");
      await expect(page.locator(".date-picker-popover")).toHaveCount(0);
      await expect(date).toBeFocused();
      const stages = page.locator(".ops-stages button");
      await stages.first().click();
      await readableSelection(
        page.locator('.ops-stages [aria-pressed="true"]'),
      );
      await page.screenshot({
        path: `${evidence}/seller-selected-after-${locale}.png`,
      });
      await page.goto("/seller/customers");
      for (const name of [
        t("Semua pelanggan", "All customers"),
        t("Perlu perpanjangan", "Renewal follow-ups"),
      ]) {
        const control = page.getByRole("button", { name, exact: true });
        await control.click();
        await expect(control).toHaveAttribute("aria-pressed", "true");
        await readableSelection(control);
      }
      await expect(
        page.locator('.customer-view-switch [aria-pressed="true"]'),
      ).toHaveCount(1);
    });

    test("invalid package fields retain error styling and explain the correction", async ({
      page,
    }) => {
      await login(page, "owner");
      await page.goto("/seller/packages");
      await page
        .getByRole("button", {
          name: t("Buat paket", "Create package"),
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: t("Lanjutkan", "Continue"), exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      const invalid = dialog.locator('[aria-invalid="true"]');
      await expect(invalid).toHaveCount(3);
      for (const field of await invalid.all()) {
        await expect(field).toHaveCSS("border-color", "rgb(163, 48, 36)");
        const description = await field.getAttribute("aria-describedby");
        expect(description).toBeTruthy();
        await expect(page.locator(`[id="${description}"]`)).toBeVisible();
      }
      await expect(dialog.getByRole("alert")).toBeVisible();
      await page.screenshot({
        path: `${evidence}/validation-after-${locale}.png`,
      });
    });

    for (const width of [320, 390, 768]) {
      test(`admin menu traps focus, dismisses, and marks its current destination ${width}`, async ({
        page,
      }) => {
        await login(page, "platform_admin");
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/admin");
        await expect(page.locator(".ops-sidebar")).not.toBeVisible();
        const menu = page.locator('.ops-topbar button[aria-label="Menu"]');
        await menu.click();
        const dialog = page.getByRole("dialog", {
          name: t("Navigasi admin", "Admin navigation"),
        });
        await expect(dialog).toBeVisible();
        await expect(menu).toHaveAttribute("aria-expanded", "true");
        await expect(dialog.locator('[aria-current="page"]')).toHaveAttribute(
          "href",
          "/admin/sellers",
        );
        for (let count = 0; count < 12; count++) {
          await page.keyboard.press("Tab");
          expect(
            await dialog.evaluate((el) => el.contains(document.activeElement)),
          ).toBe(true);
        }
        await page.screenshot({
          path: `${evidence}/admin-menu-after-${locale}-${width}.png`,
        });
        const results = await new AxeBuilder({ page })
          .include('[role="dialog"]')
          .analyze();
        expect(results.violations).toEqual([]);
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(menu).toBeFocused();
        await expect(menu).toHaveAttribute("aria-expanded", "false");
        await menu.click();
        await dialog
          .getByRole("link", {
            name: t("Transaksi", "Transactions"),
            exact: true,
          })
          .click();
        await expect(page).toHaveURL(/\/admin\/transactions$/);
        await expect(dialog).toHaveCount(0);
        await menu.click();
        await expect(dialog.locator('[aria-current="page"]')).toHaveAttribute(
          "href",
          "/admin/transactions",
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      });
    }

    test("admin queue filter communicates its selection and root route", async ({
      page,
    }) => {
      await login(page, "platform_admin");
      await page.goto("/admin");
      await expect(
        page.locator('.ops-sidebar [aria-current="page"]'),
      ).toHaveAttribute("href", "/admin/sellers");
      const group = page.getByRole("group", {
        name: t("Status verifikasi", "Verification status"),
      });
      const all = group.getByRole("button", {
        name: t("Semua katerer", "All caterers"),
      });
      await expect(all).toHaveAttribute("aria-pressed", "false");
      await all.click();
      await expect(all).toHaveAttribute("aria-pressed", "true");
      await expect(group.locator('[aria-pressed="true"]')).toHaveCount(1);
      await expect(page.locator(".queue-row").first()).toBeVisible();
    });
  });
}

const surfaces = [
  [
    "guest",
    [
      "/",
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
      "/compare",
      "/packages/ayam-panggang",
      "/caterers/dapur-senja",
    ],
  ],
  [
    "customer",
    [
      "/home",
      "/calendar",
      "/subscriptions",
      "/messages",
      "/account",
      "/addresses",
      "/support",
      "/notifications",
      "/checkout/20000000-0000-4000-8000-000000000001",
      "/seller/onboarding",
    ],
  ],
  [
    "owner",
    [
      "/seller",
      "/seller/schedule",
      "/seller/packages",
      "/seller/menus",
      "/seller/customers",
      "/seller/support",
      "/seller/transactions",
      "/seller/settings",
      "/seller/profile",
      "/seller/notifications",
    ],
  ],
  [
    "platform_admin",
    [
      "/admin",
      "/admin/sellers",
      "/admin/transactions",
      "/admin/support",
      "/admin/payouts",
      "/admin/settlement",
      "/admin/promotions",
      "/admin/reviews",
      "/admin/audit",
    ],
  ],
] as const;

for (const locale of ["id", "en"] as const) {
  for (const width of [390, 1440]) {
    test(`whole-app route census ${locale} ${width}`, async ({
      page,
      context,
      baseURL,
    }) => {
      test.setTimeout(240_000);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 900 });
      await context.addCookies([
        { name: "catera_locale", value: locale, url: baseURL! },
      ]);
      for (const [role, routes] of surfaces) {
        if (role !== "guest") await login(page, role);
        for (const path of routes) {
          await test.step(`${role} ${path}`, async () => {
            await page.goto(path);
            await expect(page.locator("main h1").first()).toBeVisible();
            await page.waitForLoadState("networkidle");
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth + 1,
              ),
            ).toBe(true);
            await expect(page.locator("html")).toHaveAttribute("lang", locale);
            if (locale === "id") {
              const name = path.replaceAll("/", "-") || "discovery";
              await page.screenshot({
                path: `${evidence}/route${name}-${width}.png`,
                fullPage: true,
              });
            }
          });
        }
      }
      expect(errors).toEqual([]);
    });
  }
}
