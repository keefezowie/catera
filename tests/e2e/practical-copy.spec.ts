import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";

const phase = process.env.CATERA_COPY_PHASE || "after";
test.use({ reducedMotion: "reduce" });
const surfaces = [
  ["guest", "/", "discovery"],
  ["guest", "/login", "login"],
  ["customer", "/home", "home"],
  ["customer", "/calendar", "calendar"],
  ["customer", "/account", "account"],
  ["owner", "/seller/menus", "menus"],
  ["owner", "/seller/packages", "packages"],
  ["platform_admin", "/admin", "admin"],
] as const;

for (const locale of ["id", "en"] as const) {
  for (const width of [390, 768, 1440]) {
    test(`practical copy, controls and layout ${locale} ${width}`, async ({
      page,
      context,
    }) => {
      test.setTimeout(240_000);
      await context.addCookies([
        {
          name: "catera_locale",
          value: locale,
          domain: "127.0.0.1",
          path: "/",
        },
      ]);
      await page.setViewportSize({ width, height: 1000 });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const directory = `output/slack-bugs/0035/${phase}`;
      await mkdir(directory, { recursive: true });
      let role = "guest";
      for (const [nextRole, route, name] of surfaces) {
        if (nextRole !== role) {
          const response = await page.request.post("/api/v1/auth/demo", {
            data: { role: nextRole },
          });
          expect(response.ok()).toBeTruthy();
          role = nextRole;
        }
        await page.goto(route);
        await expect(page.locator("main h1").first()).toBeVisible();
        await expect(page.locator("main")).not.toBeEmpty();
        await expect(page).not.toHaveTitle(/error|not found/i);
        await page.waitForLoadState("networkidle");
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({
          path: `${directory}/${name}-${locale}-${width}.png`,
          fullPage: true,
        });
        if (phase === "before") continue;
        await expect(
          page.locator(
            ".login-story, .sidebar-foot img, .sidebar-foot strong, .hero-food-caption, .hero-dot, .empty > img",
          ),
        ).toHaveCount(0);
        await expect(page.locator("body")).not.toContainText(
          /Menu yang dinanti|Makanan baik dimulai|Menus your customers are waiting|Good food starts with/,
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBeTruthy();
        const headings: Record<string, [string, string]> = {
          login: ["Masuk", "Sign in"],
          home: ["Makanan saya", "My meals"],
          calendar: ["Jadwal makan", "Meal calendar"],
          account: ["Akun", "Account"],
          menus: ["Menu", "Menus"],
          packages: ["Paket", "Packages"],
          admin: ["Verifikasi katerer", "Caterer verification"],
        };
        if (headings[name])
          await expect(page.locator("main h1").first()).toHaveText(
            headings[name][locale === "id" ? 0 : 1],
          );
        if (nextRole === "owner" || nextRole === "platform_admin") {
          await expect(
            page.locator(".ops-topbar").getByRole("link", {
              name: locale === "id" ? "Notifikasi" : "Notifications",
            }),
          ).toBeVisible();
        }
      }
      expect(errors).toEqual([]);
    });
  }
}

for (const locale of ["id", "en"] as const) {
  test(`fallback hero, empty results and keyboard recovery ${locale}`, async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: "catera_locale", value: locale, domain: "127.0.0.1", path: "/" },
    ]);
    await page.addInitScript(() =>
      localStorage.setItem("catera-area", "Uncovered test area"),
    );
    await page.goto("/");
    const title =
      locale === "id"
        ? "Paket katering berlangganan"
        : "Catering subscriptions";
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await page.getByRole("searchbox").fill("id0035-no-matching-package");
    await expect(page.locator(".empty")).toBeVisible();
    await expect(
      page.locator(".empty img, .hero-food-caption, .hero-benefits, .hero-dot"),
    ).toHaveCount(0);
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.screenshot({
        path: `output/slack-bugs/0035/after/fallback-${locale}-${width}.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBeTruthy();
    }
    const area = page.getByRole("combobox", {
      name: locale === "id" ? "Area pengantaran" : "Delivery area",
    });
    await area.focus();
    await page.keyboard.press("Enter");
    await page
      .getByRole("option", { name: "Jakarta Selatan", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: locale === "id" ? "Hapus pencarian" : "Clear search",
        exact: true,
      })
      .click();
    await expect(page.locator(".featured-slide")).toHaveCount(2);
    await expect(
      page.locator(".package-grid .package-card").first(),
    ).toBeVisible();
    const violations = (
      await new AxeBuilder({ page }).include("main").analyze()
    ).violations;
    expect(
      violations.filter((v) =>
        ["serious", "critical"].includes(v.impact || ""),
      ),
    ).toEqual([]);
  });

  test(`all web route families retain useful content ${locale}`, async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000);
    await context.addCookies([
      { name: "catera_locale", value: locale, domain: "127.0.0.1", path: "/" },
    ]);
    await page.setViewportSize({
      width: locale === "id" ? 390 : 1440,
      height: 1000,
    });
    const groups: [string, string[]][] = [
      [
        "guest",
        [
          "/search",
          "/categories",
          "/locations/Jakarta%20Selatan",
          "/compare",
          "/register",
          "/forgot-password",
          "/reset-password",
          "/brand",
        ],
      ],
      [
        "customer",
        [
          "/subscriptions",
          "/messages",
          "/addresses",
          "/notifications",
          "/support",
          "/seller/onboarding",
        ],
      ],
      [
        "owner",
        [
          "/seller",
          "/seller/schedule",
          "/seller/dishes",
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
          "/admin/transactions",
          "/admin/support",
          "/admin/payouts",
          "/admin/promotions",
          "/admin/reviews",
          "/admin/audit",
          "/admin/settlement",
        ],
      ],
    ];
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const [role, routes] of groups) {
      if (role !== "guest")
        expect(
          (
            await page.request.post("/api/v1/auth/demo", { data: { role } })
          ).ok(),
        ).toBeTruthy();
      for (const route of routes) {
        await page.goto(route);
        await expect(
          page.locator("main h1, main h2").first(),
          route,
        ).toBeVisible();
        await expect(page.locator("main")).not.toContainText(
          /Kami bantu sampai selesai|Pilih yang paling pas|Akunmu, keseharianmu|Makanan dari dapurmu/,
        );
      }
    }
    expect(errors).toEqual([]);
  });
}
