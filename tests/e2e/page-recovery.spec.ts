import { test, expect, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const evidence = "output/playwright/familiar-settings/after/page-recovery";
test.beforeAll(() => mkdir(evidence, { recursive: true }));
test.beforeEach(async ({ page, baseURL }) => {
  expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
  expect((await (await page.request.get("/api/v1/me")).json()).data.demo).toBe(
    true,
  );
  await page.route("**/api/v1/commands", (route) => route.abort());
});

async function usableRecoveryLayout(page: Page, action: Locator) {
  const main = page.locator("main.error-page");
  await expect(main).toBeVisible();
  const heading = await main.locator("h1").boundingBox();
  expect(
    heading!.x,
    "Recovery text has an inline inset",
  ).toBeGreaterThanOrEqual(16);
  expect(heading!.y, "Recovery text has room above it").toBeGreaterThanOrEqual(
    32,
  );
  expect(heading!.x + heading!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width - 16,
  );
  const box = await action.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(box!.y).toBeGreaterThanOrEqual(heading!.y + heading!.height);
  expect(
    await action.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      return element === hit || element.contains(hit);
    }),
    "The recovery action has an unobstructed hit area",
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Recovery fits the viewport without horizontal scrolling",
  ).toBe(true);
}

async function keyboardAction(page: Page, action: Locator) {
  // A failed route can leave the document's previous focus position behind;
  // Next's development fault indicator also has controls. Traverse with the
  // keyboard rather than assuming the first Tab always starts at the retry.
  for (let step = 0; step < 4; step++) {
    await page.keyboard.press("Tab");
    if (await action.evaluate((element) => element === document.activeElement))
      break;
  }
  await expect(action).toBeFocused();
  expect(
    await action.evaluate((element) => {
      const style = getComputedStyle(element);
      return (
        style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2
      );
    }),
    "Recovery has visible keyboard focus",
  ).toBe(true);
}

for (const locale of ["id", "en"] as const) {
  const t = (id: string, en: string) => (locale === "id" ? id : en);
  for (const width of [320, 390, 1440]) {
    test(`404 recovery has usable spacing and a keyboard return to discovery ${locale} ${width}`, async ({
      page,
      context,
      baseURL,
    }) => {
      await context.addCookies([
        { name: "catera_locale", value: locale, url: baseURL! },
      ]);
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/synthetic-unrecognized-recovery-route");
      await expect(
        page.getByRole("heading", {
          name: t("Halaman tidak ditemukan.", "Page not found."),
          exact: true,
        }),
      ).toBeVisible();
      const home = page.getByRole("link", {
        name: t("Jelajah katering", "Explore caterers"),
        exact: true,
      });
      await usableRecoveryLayout(page, home);
      await page.screenshot({
        path: `${evidence}/not-found-${locale}-${width}.png`,
        fullPage: true,
      });
      await keyboardAction(page, home);
      await page.screenshot({
        path: `${evidence}/not-found-focus-${locale}-${width}.png`,
        fullPage: true,
      });
      await home.press("Enter");
      await expect(page).toHaveURL(/\/$/);
      await expect(
        page.getByRole("heading", {
          name: t("Paket katering", "Catering packages"),
          exact: true,
        }),
      ).toBeVisible();
    });

    test(`render-error recovery stays readable and retries the actual route ${locale} ${width}`, async ({
      page,
      context,
      baseURL,
    }) => {
      await context.addCookies([
        { name: "catera_locale", value: locale, url: baseURL! },
      ]);
      await page.setViewportSize({ width, height: 1000 });
      expect(
        (
          await page.request.post("/api/v1/auth/demo", {
            data: { role: "owner" },
          })
        ).ok(),
      ).toBe(true);
      const actor = (await (await page.request.get("/api/v1/me")).json()).data
        .actor;
      const sellerResponse = await page.request.get(
        `/api/v1/seller/${actor.catererId}?date=2026-10-01`,
      );
      expect(sellerResponse.ok()).toBe(true);
      const seller = (await sellerResponse.json()).data;
      // This deliberate render fault is confined to an intercepted synthetic
      // response. It exercises Next's existing boundary and reset behavior;
      // the saved profile and application source remain valid.
      const malformed = structuredClone(seller);
      malformed.caterer.name = { controlledSyntheticRenderFault: true };
      await page.route("**/api/v1/seller/*?*", (route) =>
        route.fulfill({ json: { data: malformed } }),
      );
      await page.goto("/seller/settings");
      await expect(
        page.getByRole("heading", {
          name: t("Ada yang belum berhasil dimuat.", "Something did not load."),
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.locator("main.error-page")).toContainText(
        t(
          "Data Anda tetap tersimpan. Silakan coba sekali lagi.",
          "Your data is still saved. Please try once more.",
        ),
      );
      const retry = page.getByRole("button", {
        name: t("Coba lagi", "Try again"),
        exact: true,
      });
      await usableRecoveryLayout(page, retry);
      await page.screenshot({
        path: `${evidence}/render-error-${locale}-${width}.png`,
        fullPage: true,
      });
      await keyboardAction(page, retry);
      await page.screenshot({
        path: `${evidence}/render-error-focus-${locale}-${width}.png`,
        fullPage: true,
      });
      await page.unroute("**/api/v1/seller/*?*");
      await retry.press("Enter");
      await expect(page.locator("main.error-page")).toHaveCount(0);
      await expect(
        page.getByRole("heading", {
          name: t("Pengaturan", "Settings"),
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("navigation", {
          name: t("Bagian pengaturan", "Settings sections"),
          exact: true,
        }),
      ).toBeVisible();
      await expect(page).toHaveURL(/\/seller\/settings$/);
      await page.screenshot({
        path: `${evidence}/retry-recovered-${locale}-${width}.png`,
        fullPage: true,
      });
    });
  }
}
